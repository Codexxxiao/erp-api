import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FormFieldType,
  FormStatus,
  FormTableType,
  PhysicalSchemaStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import {
  buildDerivedColumnName,
  buildIndexName,
  buildPhysicalColumnName,
  buildPhysicalTableName,
  mapFieldTypeToSql,
  quoteIdentifier,
} from './form-schema.utils';
import type { FormSnapshot } from '../form-snapshot/form-snapshot.types';

type SnapshotTable = FormSnapshot['tables'][number];

type PhysicalTablePlan = {
  tableId: string;
  tableCode: string;
  tableName: string;
  tableType: SnapshotTable['type'];
  columns: Array<{
    fieldId: string;
    fieldCode: string;
    columnName: string;
    labelColumnName: string | null;
    extraColumnName: string | null;
    sqlType: string;
    isRequired: boolean;
  }>;
};

type ProvisionForm = Prisma.FormDefinitionGetPayload<{
  include: {
    tenant: true;
    tables: {
      include: {
        fields: true;
      };
    };
  };
}>;

type PhysicalColumnPlan = {
  fieldId: string;
  fieldCode: string;
  columnName: string;
  labelColumnName: string | null;
  extraColumnName: string | null;
  sqlType: string;
  isRequired: boolean;
};

@Injectable()
export class FormSchemaProvisionService {
  constructor(private readonly prisma: PrismaService) {}

  private validateSnapshot(snapshot: FormSnapshot) {
    const mainTables = snapshot.tables.filter(
      (table) => table.type === FormTableType.MAIN,
    );

    if (mainTables.length !== 1) {
      throw new BadRequestException('快照必须且只能包含一张主表');
    }
  }

  private buildPlansFromSnapshot(
    snapshot: FormSnapshot,
    tenantCode: string,
  ): PhysicalTablePlan[] {
    return snapshot.tables.map((table) => {
      const tableName = buildPhysicalTableName({
        tenantCode,
        formCode: snapshot.form.code,
        tableCode: table.code,
        tableId: table.id,
      });

      return {
        tableId: table.id,
        tableCode: table.code,
        tableName,
        tableType: table.type,
        columns: table.fields.map((field) => {
          const columnName = buildPhysicalColumnName(field.code, field.id);
          const needExtra =
            field.type === FormFieldType.DICTIONARY ||
            field.type === FormFieldType.DATASOURCE;

          return {
            fieldId: field.id,
            fieldCode: field.code,
            columnName,
            labelColumnName: needExtra
              ? buildDerivedColumnName(columnName, '_label')
              : null,
            extraColumnName: needExtra
              ? buildDerivedColumnName(columnName, '_extra')
              : null,
            sqlType: mapFieldTypeToSql(field.type),
            isRequired: field.required,
          };
        }),
      };
    });
  }

  async publishTenantForm(user: CurrentUser, formId: string, version?: number) {
    const tenantId = requireTenantId(user);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new BadRequestException('租户不存在');

    const formVersion = await this.prisma.formVersion.findFirst({
      where: {
        tenantId,
        formId,
        ...(version ? { version } : {}),
      },
      orderBy: { version: 'desc' },
    });

    if (!formVersion) {
      throw new BadRequestException('请先发布表单快照');
    }

    const snapshot = formVersion.snapshot as FormSnapshot;
    this.validateSnapshot(snapshot);

    const plans = this.buildPlansFromSnapshot(snapshot, tenant.code);

    return this.prisma.$transaction(async (tx) => {
      for (const plan of plans) {
        const physicalTable = await this.upsertPhysicalTable(tx, {
          tenantId,
          formId,
          tableId: plan.tableId,
          tableCode: plan.tableCode,
          tableName: plan.tableName,
          formVersion: snapshot.form.version,
          formVersionId: formVersion.id,
        });

        await this.ensureBaseTable(tx, plan);
        await this.ensureIndexes(tx, plan);

        for (const column of plan.columns) {
          await this.ensureColumn(
            tx,
            plan.tableName,
            column.columnName,
            column.sqlType,
          );

          if (column.labelColumnName) {
            await this.ensureColumn(
              tx,
              plan.tableName,
              column.labelColumnName,
              'text',
            );
          }

          if (column.extraColumnName) {
            await this.ensureColumn(
              tx,
              plan.tableName,
              column.extraColumnName,
              'jsonb',
            );
          }

          await this.upsertPhysicalColumn(tx, physicalTable.id, column);
        }

        await tx.formPhysicalTable.update({
          where: { id: physicalTable.id },
          data: {
            status: PhysicalSchemaStatus.SYNCED,
            lastError: null,
            formVersion: snapshot.form.version,
            formVersionId: formVersion.id,
          },
        });
      }

      const physicalTables = await tx.formPhysicalTable.findMany({
        where: { tenantId, formId },
        include: { columns: { orderBy: { createdAt: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      });

      return { formVersion, physicalTables };
    });
  }

  async getPhysicalSchema(user: CurrentUser, formId: string) {
    const tenantId = requireTenantId(user);

    const form = await this.prisma.formDefinition.findFirst({
      where: {
        id: formId,
        tenantId,
      },
    });

    if (!form) throw new NotFoundException('表单不存在');

    return this.prisma.formPhysicalTable.findMany({
      where: {
        tenantId,
        formId,
      },
      include: {
        columns: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  private validateBeforePublish(form: ProvisionForm) {
    if (!form.tenantId) {
      throw new BadRequestException(
        '系统模板不能直接生成实体表，请先下发为租户表单',
      );
    }

    const mainTables = form.tables.filter(
      (table) => table.type === FormTableType.MAIN,
    );
    if (mainTables.length !== 1) {
      throw new BadRequestException('发布表单必须且只能配置一张主表');
    }

    const tableNames = new Set<string>();

    for (const table of form.tables) {
      const tableName = buildPhysicalTableName({
        tenantCode: form.tenant.code,
        formCode: form.code,
        tableCode: table.code,
        tableId: table.id,
      });

      if (tableNames.has(tableName)) {
        throw new BadRequestException(`物理表名冲突：${tableName}`);
      }

      tableNames.add(tableName);

      const columnNames = new Set<string>();

      for (const field of table.fields) {
        const columnName = buildPhysicalColumnName(field.code, field.id);
        this.assertUniqueColumn(columnNames, columnName, field.code);

        if (
          field.type === FormFieldType.DICTIONARY ||
          field.type === FormFieldType.DATASOURCE
        ) {
          this.assertUniqueColumn(
            columnNames,
            buildDerivedColumnName(columnName, '_label'),
            field.code,
          );
          this.assertUniqueColumn(
            columnNames,
            buildDerivedColumnName(columnName, '_extra'),
            field.code,
          );
        }
      }
    }
  }

  private buildPlans(form: ProvisionForm): PhysicalTablePlan[] {
    return form.tables.map((table) => {
      const tableName = buildPhysicalTableName({
        tenantCode: form.tenant.code,
        formCode: form.code,
        tableCode: table.code,
        tableId: table.id,
      });

      const columns = table.fields.map((field) => {
        const columnName = buildPhysicalColumnName(field.code, field.id);
        const needExtra =
          field.type === FormFieldType.DICTIONARY ||
          field.type === FormFieldType.DATASOURCE;

        return {
          fieldId: field.id,
          fieldCode: field.code,
          columnName,
          labelColumnName: needExtra
            ? buildDerivedColumnName(columnName, '_label')
            : null,
          extraColumnName: needExtra
            ? buildDerivedColumnName(columnName, '_extra')
            : null,
          sqlType: mapFieldTypeToSql(field.type),
          isRequired: field.required,
        };
      });

      return {
        tableId: table.id,
        tableCode: table.code,
        tableName,
        tableType: table.type,
        columns,
      };
    });
  }

  private async ensureBaseTable(
    tx: Prisma.TransactionClient,
    plan: PhysicalTablePlan,
  ) {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${quoteIdentifier(plan.tableName)} (
        id text PRIMARY KEY,
        tenant_id text NOT NULL,
        record_id text NOT NULL,
        row_index integer NOT NULL DEFAULT 0,
        form_id text NOT NULL,
        form_version integer NOT NULL,
        created_by_id text,
        updated_by_id text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    await tx.$executeRawUnsafe(sql);
  }

  private async ensureIndexes(
    tx: Prisma.TransactionClient,
    plan: PhysicalTablePlan,
  ) {
    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS ${quoteIdentifier(buildIndexName(plan.tableName, 'tenant'))}
      ON ${quoteIdentifier(plan.tableName)} (tenant_id)
    `);

    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS ${quoteIdentifier(buildIndexName(plan.tableName, 'record'))}
      ON ${quoteIdentifier(plan.tableName)} (record_id)
    `);

    if (plan.tableType === FormTableType.MAIN) {
      await tx.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS ${quoteIdentifier(buildIndexName(plan.tableName, 'record_unique'))}
        ON ${quoteIdentifier(plan.tableName)} (record_id)
      `);
    }
  }

  private async ensureColumn(
    tx: Prisma.TransactionClient,
    tableName: string,
    columnName: string,
    sqlType: string,
  ) {
    await tx.$executeRawUnsafe(`
      ALTER TABLE ${quoteIdentifier(tableName)}
      ADD COLUMN IF NOT EXISTS ${quoteIdentifier(columnName)} ${sqlType}
    `);
  }

  private async upsertPhysicalTable(
    tx: Prisma.TransactionClient,
    data: {
      tenantId: string;
      formId: string;
      tableId: string;
      tableCode: string;
      tableName: string;
      formVersion: number;
      formVersionId: string;
    },
  ) {
    const existed = await tx.formPhysicalTable.findUnique({
      where: { tableId: data.tableId },
    });

    if (existed) {
      return tx.formPhysicalTable.update({
        where: { id: existed.id },
        data: {
          tableCode: data.tableCode,
          tableName: data.tableName,
          formVersion: data.formVersion,
          formVersionId: data.formVersionId,
          status: PhysicalSchemaStatus.DRAFT,
        },
      });
    }

    return tx.formPhysicalTable.create({
      data: {
        ...data,
        status: PhysicalSchemaStatus.DRAFT,
      },
    });
  }

  private async upsertPhysicalColumn(
    tx: Prisma.TransactionClient,
    physicalTableId: string,
    column: PhysicalColumnPlan,
  ) {
    const existed = await tx.formPhysicalColumn.findFirst({
      where: {
        physicalTableId,
        fieldId: column.fieldId,
      },
    });

    const data = {
      fieldCode: column.fieldCode,
      columnName: column.columnName,
      labelColumnName: column.labelColumnName,
      extraColumnName: column.extraColumnName,
      sqlType: column.sqlType,
      isRequired: column.isRequired,
      isNullable: true,
      isActive: true,
    };

    if (existed) {
      return tx.formPhysicalColumn.update({
        where: { id: existed.id },
        data,
      });
    }

    return tx.formPhysicalColumn.create({
      data: {
        physicalTableId,
        fieldId: column.fieldId,
        ...data,
      },
    });
  }

  private assertUniqueColumn(
    seen: Set<string>,
    columnName: string,
    fieldCode: string,
  ) {
    if (seen.has(columnName)) {
      throw new BadRequestException(
        `字段生成物理列名冲突：${fieldCode} -> ${columnName}`,
      );
    }

    seen.add(columnName);
  }
}
