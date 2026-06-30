import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  FormFieldType,
  FormRecordStatus,
  FormStatus,
  FormTableType,
  FormVersion,
  FormVersionStatus,
  PhysicalSchemaStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { quoteIdentifier } from '../form-schema-provision/form-schema.utils';
import type { FormSnapshot } from '../form-snapshot/form-snapshot.types';
import {
  CreateFormRecordDto,
  FormRecordDetailInputDto,
} from './dto/create-form-record.dto';
import { UpdateFormRecordDto } from './dto/update-form-record.dto';
import { QueryFormRecordDto } from './dto/query-form-record.dto';

type RuntimeForm = Prisma.FormDefinitionGetPayload<{
  include: {
    tables: {
      include: {
        fields: true;
      };
    };
  };
}>;

type RuntimeTable = RuntimeForm['tables'][number];

type PhysicalTable = Prisma.FormPhysicalTableGetPayload<{
  include: {
    columns: true;
  };
}>;

type NormalizedDetail = {
  table: RuntimeTable;
  rows: Record<string, unknown>[];
};

type SchemaBundle = {
  form: RuntimeForm;
  physicalTables: PhysicalTable[];
  formVersion: FormVersion;
};

@Injectable()
export class RuntimeFormService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: CurrentUser, dto: CreateFormRecordDto) {
    const tenantId = requireTenantId(user);
    const bundle = await this.findEnabledFormWithPhysicalSchema(
      tenantId,
      dto.formId,
      dto.formCode,
    );

    const normalized = this.normalizeAndValidate(
      this.snapshotToRuntimeForm(
        bundle.formVersion.snapshot as unknown as FormSnapshot,
      ),
      dto.mainData,
      dto.details ?? [],
    );

    const recordNo = this.generateRecordNo(bundle.form.code);
    const status = dto.submit
      ? FormRecordStatus.SUBMITTED
      : FormRecordStatus.DRAFT;

    const recordId = await this.prisma.$transaction(async (tx) => {
      const record = await tx.formRecord.create({
        data: {
          tenantId,
          formId: bundle.form.id,
          formCode: bundle.form.code,
          recordNo,
          status,
          mainData: normalized.mainData as Prisma.InputJsonValue,
          formVersion: bundle.formVersion.version,
          formVersionId: bundle.formVersion.id,
          createdById: user.id,
          submittedAt: dto.submit ? new Date() : null,
        },
      });

      await this.replaceAllPhysicalRows(tx, {
        tenantId,
        recordId: record.id,
        form: this.snapshotToRuntimeForm(
          bundle.formVersion.snapshot as unknown as FormSnapshot,
        ),
        physicalTables: bundle.physicalTables,
        mainData: normalized.mainData,
        details: normalized.details,
        userId: user.id,
      });

      await this.replaceSnapshotDetails(tx, record.id, normalized.details);

      return record.id;
    });

    return this.findOne(user, recordId);
  }

  async findAll(user: CurrentUser, query: QueryFormRecordDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.FormRecordWhereInput = {
      tenantId,
      formCode: query.formCode,
      status: query.status,
      OR: query.keyword
        ? [
            { recordNo: { contains: query.keyword, mode: 'insensitive' } },
            { formCode: { contains: query.keyword, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.formRecord.count({ where }),
      this.prisma.formRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      list,
    };
  }

  async findOne(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const record = await this.prisma.formRecord.findFirst({
      where: { id, tenantId },
      include: {
        formVersionRef: true,
        form: {
          include: {
            tables: {
              orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
              include: {
                fields: {
                  orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
                },
              },
            },
          },
        },
      },
    });

    if (!record) throw new NotFoundException('单据不存在');

    const runtimeForm = this.resolveRuntimeFormFromRecord(record);
    const physicalTables = await this.getPhysicalTablesOrThrow(
      tenantId,
      record.formId,
      record.formVersionId,
    );
    const physicalData = await this.readPhysicalData(
      tenantId,
      record.id,
      runtimeForm,
      physicalTables,
    );

    return {
      ...record,
      physicalData,
    };
  }

  async update(user: CurrentUser, id: string, dto: UpdateFormRecordDto) {
    const tenantId = requireTenantId(user);

    const record = await this.prisma.formRecord.findFirst({
      where: { id, tenantId },
      include: {
        formVersionRef: true,
        form: {
          include: {
            tables: {
              include: { fields: true },
            },
          },
        },
      },
    });

    if (!record) throw new NotFoundException('单据不存在');

    if (record.status !== FormRecordStatus.DRAFT) {
      throw new ForbiddenException('只有草稿单据允许修改');
    }

    const runtimeForm = this.resolveRuntimeFormFromRecord(record);
    const physicalTables = await this.getPhysicalTablesOrThrow(
      tenantId,
      record.formId,
      record.formVersionId,
    );

    const normalizedMain = dto.mainData
      ? this.normalizeMain(runtimeForm, dto.mainData)
      : null;

    const normalizedDetails = dto.details
      ? this.normalizeDetails(runtimeForm, dto.details)
      : null;

    await this.prisma.$transaction(async (tx) => {
      if (normalizedMain) {
        await tx.formRecord.update({
          where: { id },
          data: {
            mainData: normalizedMain as Prisma.InputJsonValue,
            updatedById: user.id,
          },
        });

        await this.replaceMainPhysicalRow(tx, {
          tenantId,
          recordId: id,
          form: runtimeForm,
          physicalTables,
          mainData: normalizedMain,
          userId: user.id,
        });
      }

      if (normalizedDetails) {
        await this.replaceAllDetailPhysicalRows(tx, {
          tenantId,
          recordId: id,
          form: runtimeForm,
          physicalTables,
          details: normalizedDetails,
          userId: user.id,
        });

        await this.replaceSnapshotDetails(tx, id, normalizedDetails);
      }

      if (!normalizedMain && !normalizedDetails) {
        await tx.formRecord.update({
          where: { id },
          data: {
            updatedById: user.id,
          },
        });
      }
    });

    return this.findOne(user, id);
  }

  async submit(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const record = await this.prisma.formRecord.findFirst({
      where: { id, tenantId },
    });

    if (!record) throw new NotFoundException('单据不存在');

    if (record.status !== FormRecordStatus.DRAFT) {
      throw new BadRequestException('只有草稿单据可以提交');
    }

    return this.prisma.formRecord.update({
      where: { id },
      data: {
        status: FormRecordStatus.SUBMITTED,
        submittedAt: new Date(),
        updatedById: user.id,
      },
    });
  }

  async cancel(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const record = await this.prisma.formRecord.findFirst({
      where: { id, tenantId },
    });

    if (!record) throw new NotFoundException('单据不存在');

    if (record.status === FormRecordStatus.CANCELED) {
      throw new BadRequestException('单据已撤销');
    }

    return this.prisma.formRecord.update({
      where: { id },
      data: {
        status: FormRecordStatus.CANCELED,
        canceledAt: new Date(),
        updatedById: user.id,
      },
    });
  }

  private async findEnabledFormWithPhysicalSchema(
    tenantId: string,
    formId?: string,
    formCode?: string,
  ): Promise<SchemaBundle> {
    if (!formId && !formCode) {
      throw new BadRequestException('formId 和 formCode 至少传一个');
    }

    const form = await this.prisma.formDefinition.findFirst({
      where: {
        tenantId,
        status: FormStatus.ENABLED,
        ...(formId ? { id: formId } : { code: formCode }),
      },
      include: {
        tables: {
          orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
          include: {
            fields: {
              orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });

    if (!form) throw new NotFoundException('启用表单不存在');

    const formVersion = await this.findLatestPublishedFormVersion(
      tenantId,
      form.id,
    );

    const physicalTables = await this.getPhysicalTablesOrThrow(
      tenantId,
      form.id,
      formVersion.id,
    );

    return {
      form,
      physicalTables,
      formVersion,
    };
  }

  private async findLatestPublishedFormVersion(
    tenantId: string,
    formId: string,
  ) {
    const formVersion = await this.prisma.formVersion.findFirst({
      where: {
        tenantId,
        formId,
        status: FormVersionStatus.PUBLISHED,
      },
      orderBy: { version: 'desc' },
    });

    if (!formVersion) {
      throw new BadRequestException('请先发布表单逻辑版本');
    }

    return formVersion;
  }

  private resolveRuntimeFormFromRecord(
    record: Prisma.FormRecordGetPayload<{
      include: {
        formVersionRef: true;
        form: {
          include: {
            tables: {
              include: { fields: true };
            };
          };
        };
      };
    }>,
  ) {
    if (record.formVersionRef?.snapshot) {
      return this.snapshotToRuntimeForm(
        record.formVersionRef.snapshot as unknown as FormSnapshot,
      );
    }

    return record.form;
  }

  private snapshotToRuntimeForm(snapshot: FormSnapshot): RuntimeForm {
    const now = new Date();

    return {
      id: snapshot.form.id,
      tenantId: snapshot.form.tenantId,
      scopeKey: `tenant:${snapshot.form.tenantId}`,
      code: snapshot.form.code,
      name: snapshot.form.name,
      description: snapshot.form.description,
      status: snapshot.form.status,
      version: snapshot.form.version,
      layout: snapshot.form.layout as Prisma.JsonValue,
      config: snapshot.form.config as Prisma.JsonValue,
      sort: 0,
      createdAt: now,
      updatedAt: now,
      tables: snapshot.tables.map((table) => ({
        id: table.id,
        formId: snapshot.form.id,
        parentId: table.parentId,
        code: table.code,
        name: table.name,
        type: table.type,
        layout: table.layout as Prisma.JsonValue,
        config: table.config as Prisma.JsonValue,
        sort: table.sort,
        createdAt: now,
        updatedAt: now,
        fields: table.fields.map((field) => ({
          id: field.id,
          tableId: table.id,
          code: field.code,
          name: field.name,
          type: field.type,
          required: field.required,
          unique: field.unique,
          readonly: field.readonly,
          hidden: field.hidden,
          defaultValue: field.defaultValue as Prisma.JsonValue,
          dictionaryCode: field.dictionaryCode,
          dataSourceCode: field.dataSourceCode,
          dataSourceMapping: field.dataSourceMapping as Prisma.JsonValue,
          formula: field.formula as Prisma.JsonValue,
          validationRules: field.validationRules as Prisma.JsonValue,
          visibleWhen: field.visibleWhen as Prisma.JsonValue,
          config: field.config as Prisma.JsonValue,
          sort: field.sort,
          createdAt: now,
          updatedAt: now,
        })),
      })),
    };
  }

  private getRuntimeColumns(
    physicalTable: PhysicalTable,
    runtimeTable: RuntimeTable,
  ) {
    const columnMap = new Map(
      physicalTable.columns.map((column) => [column.fieldId, column]),
    );

    return runtimeTable.fields
      .map((field) => columnMap.get(field.id))
      .filter((column): column is PhysicalTable['columns'][number] =>
        Boolean(column),
      );
  }

  private async getPhysicalTablesOrThrow(
    tenantId: string,
    formId: string,
    formVersionId?: string | null,
  ) {
    const baseWhere = {
      tenantId,
      formId,
      status: PhysicalSchemaStatus.SYNCED,
    };

    let physicalTables = await this.prisma.formPhysicalTable.findMany({
      where: {
        ...baseWhere,
        ...(formVersionId ? { formVersionId } : {}),
      },
      include: {
        columns: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (physicalTables.length === 0 && formVersionId) {
      physicalTables = await this.prisma.formPhysicalTable.findMany({
        where: baseWhere,
        include: {
          columns: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (physicalTables.length === 0) {
      throw new BadRequestException('请先发布表单并生成实体表');
    }

    return physicalTables;
  }

  private normalizeAndValidate(
    form: RuntimeForm,
    mainData: Record<string, unknown>,
    details: FormRecordDetailInputDto[],
  ) {
    return {
      mainData: this.normalizeMain(form, mainData),
      details: this.normalizeDetails(form, details),
    };
  }

  private normalizeMain(form: RuntimeForm, mainData: Record<string, unknown>) {
    const mainTable = form.tables.find(
      (table) => table.type === FormTableType.MAIN,
    );
    if (!mainTable) throw new BadRequestException('表单未配置主表');

    return this.normalizeRow(mainTable, mainData, '主表');
  }

  private normalizeDetails(
    form: RuntimeForm,
    details: FormRecordDetailInputDto[],
  ) {
    return details.map((detail) => {
      const table = form.tables.find(
        (item) =>
          item.code === detail.tableCode && item.type === FormTableType.SUB,
      );

      if (!table)
        throw new BadRequestException(`附表不存在：${detail.tableCode}`);

      return {
        table,
        rows: detail.rows.map((row, index) =>
          this.normalizeRow(table, row, `${table.name}第${index + 1}行`),
        ),
      };
    });
  }

  private normalizeRow(
    table: RuntimeTable,
    row: Record<string, unknown>,
    label: string,
  ) {
    const result = { ...row };

    for (const field of table.fields) {
      const value = result[field.code];

      if (field.required && !this.hasValue(value)) {
        throw new BadRequestException(`${label}字段 ${field.name} 必填`);
      }

      if (this.hasValue(value)) {
        this.validateFieldValue(
          field.type,
          value,
          `${label}字段 ${field.name}`,
        );
      }
    }

    for (const field of table.fields) {
      const formula = field.formula as {
        expression?: string;
        dependencies?: string[];
      } | null;

      if (formula?.expression) {
        result[field.code] = this.evaluateArithmeticFormula(
          formula.expression,
          result,
          formula.dependencies ?? [],
          `${label}字段 ${field.name}`,
        );
      }
    }

    return result;
  }

  private async replaceAllPhysicalRows(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      recordId: string;
      form: RuntimeForm;
      physicalTables: PhysicalTable[];
      mainData: Record<string, unknown>;
      details: NormalizedDetail[];
      userId: string;
    },
  ) {
    await this.replaceMainPhysicalRow(tx, params);
    await this.replaceAllDetailPhysicalRows(tx, params);
  }

  private async replaceMainPhysicalRow(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      recordId: string;
      form: RuntimeForm;
      physicalTables: PhysicalTable[];
      mainData: Record<string, unknown>;
      userId: string;
    },
  ) {
    const mainTable = params.form.tables.find(
      (table) => table.type === FormTableType.MAIN,
    );
    if (!mainTable) throw new BadRequestException('表单未配置主表');

    const physicalTable = this.findPhysicalTable(
      params.physicalTables,
      mainTable.id,
    );

    await this.deletePhysicalRows(
      tx,
      physicalTable.tableName,
      params.tenantId,
      params.recordId,
    );

    await this.insertPhysicalRow(tx, {
      physicalTable,
      runtimeTable: mainTable,
      tenantId: params.tenantId,
      recordId: params.recordId,
      formId: params.form.id,
      formVersion: params.form.version,
      rowIndex: 0,
      rowData: params.mainData,
      userId: params.userId,
    });
  }

  private async replaceAllDetailPhysicalRows(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      recordId: string;
      form: RuntimeForm;
      physicalTables: PhysicalTable[];
      details: NormalizedDetail[];
      userId: string;
    },
  ) {
    const subTables = params.form.tables.filter(
      (table) => table.type === FormTableType.SUB,
    );

    for (const table of subTables) {
      const physicalTable = this.findPhysicalTable(
        params.physicalTables,
        table.id,
      );
      await this.deletePhysicalRows(
        tx,
        physicalTable.tableName,
        params.tenantId,
        params.recordId,
      );
    }

    for (const detail of params.details) {
      const physicalTable = this.findPhysicalTable(
        params.physicalTables,
        detail.table.id,
      );

      for (const [index, row] of detail.rows.entries()) {
        await this.insertPhysicalRow(tx, {
          physicalTable,
          runtimeTable: detail.table,
          tenantId: params.tenantId,
          recordId: params.recordId,
          formId: params.form.id,
          formVersion: params.form.version,
          rowIndex: index,
          rowData: row,
          userId: params.userId,
        });
      }
    }
  }

  private async deletePhysicalRows(
    tx: Prisma.TransactionClient,
    tableName: string,
    tenantId: string,
    recordId: string,
  ) {
    await tx.$executeRawUnsafe(
      `
        DELETE FROM ${quoteIdentifier(tableName)}
        WHERE tenant_id = $1 AND record_id = $2
      `,
      tenantId,
      recordId,
    );
  }

  private async insertPhysicalRow(
    tx: Prisma.TransactionClient,
    params: {
      physicalTable: PhysicalTable;
      runtimeTable: RuntimeTable;
      tenantId: string;
      recordId: string;
      formId: string;
      formVersion: number;
      rowIndex: number;
      rowData: Record<string, unknown>;
      userId: string;
    },
  ) {
    const columnNames: string[] = [];
    const placeholders: string[] = [];
    const values: unknown[] = [];

    const pushValue = (
      columnName: string,
      value: unknown,
      sqlType?: string,
    ) => {
      columnNames.push(columnName);
      values.push(
        sqlType === 'jsonb' ? JSON.stringify(value ?? null) : (value ?? null),
      );

      const index = values.length;
      placeholders.push(sqlType === 'jsonb' ? `$${index}::jsonb` : `$${index}`);
    };

    pushValue('id', randomUUID());
    pushValue('tenant_id', params.tenantId);
    pushValue('record_id', params.recordId);
    pushValue('row_index', params.rowIndex);
    pushValue('form_id', params.formId);
    pushValue('form_version', params.formVersion);
    pushValue('created_by_id', params.userId);
    pushValue('updated_by_id', params.userId);

    for (const column of this.getRuntimeColumns(
      params.physicalTable,
      params.runtimeTable,
    )) {
      const rawValue = params.rowData[column.fieldCode];

      if (rawValue && typeof rawValue === 'object' && 'value' in rawValue) {
        const option = rawValue as {
          value?: unknown;
          label?: unknown;
          extra?: unknown;
        };

        pushValue(column.columnName, option.value, column.sqlType);

        if (column.labelColumnName) {
          pushValue(column.labelColumnName, option.label);
        }

        if (column.extraColumnName) {
          pushValue(column.extraColumnName, option.extra, 'jsonb');
        }
      } else {
        pushValue(column.columnName, rawValue, column.sqlType);
      }
    }

    const sql = `
      INSERT INTO ${quoteIdentifier(params.physicalTable.tableName)}
      (${columnNames.map(quoteIdentifier).join(', ')})
      VALUES (${placeholders.join(', ')})
    `;

    await tx.$executeRawUnsafe(sql, ...values);
  }

  private async replaceSnapshotDetails(
    tx: Prisma.TransactionClient,
    recordId: string,
    details: NormalizedDetail[],
  ) {
    await tx.formRecordDetail.deleteMany({
      where: { recordId },
    });

    for (const detail of details) {
      await tx.formRecordDetail.createMany({
        data: detail.rows.map((row, index) => ({
          recordId,
          tableId: detail.table.id,
          tableCode: detail.table.code,
          rowIndex: index,
          rowData: row as Prisma.InputJsonValue,
        })),
      });
    }
  }

  private async readPhysicalData(
    tenantId: string,
    recordId: string,
    form: RuntimeForm,
    physicalTables: PhysicalTable[],
  ) {
    const mainTable = form.tables.find(
      (table) => table.type === FormTableType.MAIN,
    );
    if (!mainTable) throw new BadRequestException('表单未配置主表');

    const mainPhysicalTable = this.findPhysicalTable(
      physicalTables,
      mainTable.id,
    );
    const mainRows = await this.queryPhysicalRows(
      mainPhysicalTable.tableName,
      tenantId,
      recordId,
    );

    const mainData =
      this.toBusinessRows(mainPhysicalTable, mainTable, mainRows)[0] ?? {};

    const details: Array<{
      tableId: string;
      tableCode: string;
      tableName: string;
      rows: Record<string, unknown>[];
    }> = [];

    for (const table of form.tables.filter(
      (item) => item.type === FormTableType.SUB,
    )) {
      const physicalTable = this.findPhysicalTable(physicalTables, table.id);
      const rows = await this.queryPhysicalRows(
        physicalTable.tableName,
        tenantId,
        recordId,
      );

      details.push({
        tableId: table.id,
        tableCode: table.code,
        tableName: table.name,
        rows: this.toBusinessRows(physicalTable, table, rows),
      });
    }

    return {
      mainData,
      details,
    };
  }

  private async queryPhysicalRows(
    tableName: string,
    tenantId: string,
    recordId: string,
  ) {
    return this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `
        SELECT *
        FROM ${quoteIdentifier(tableName)}
        WHERE tenant_id = $1 AND record_id = $2
        ORDER BY row_index ASC, created_at ASC
      `,
      tenantId,
      recordId,
    );
  }

  private toBusinessRows(
    physicalTable: PhysicalTable,
    runtimeTable: RuntimeTable,
    rows: Record<string, unknown>[],
  ) {
    const fieldMap = new Map(
      runtimeTable.fields.map((field) => [field.id, field]),
    );
    const columns = this.getRuntimeColumns(physicalTable, runtimeTable);

    return rows.map((row) => {
      const result: Record<string, unknown> = {};

      for (const column of columns) {
        const field = fieldMap.get(column.fieldId);
        if (!field) continue;

        if (column.labelColumnName || column.extraColumnName) {
          result[field.code] = {
            value: row[column.columnName],
            label: column.labelColumnName ? row[column.labelColumnName] : null,
            extra: column.extraColumnName ? row[column.extraColumnName] : null,
          };
        } else {
          result[field.code] = row[column.columnName];
        }
      }

      return result;
    });
  }

  private findPhysicalTable(physicalTables: PhysicalTable[], tableId: string) {
    const physicalTable = physicalTables.find(
      (item) => item.tableId === tableId,
    );

    if (!physicalTable) {
      throw new BadRequestException('表单实体表未同步，请重新发布表单');
    }

    return physicalTable;
  }

  private validateFieldValue(
    type: FormFieldType,
    value: unknown,
    label: string,
  ) {
    if (
      (type === FormFieldType.TEXT || type === FormFieldType.TEXTAREA) &&
      typeof value !== 'string'
    ) {
      throw new BadRequestException(`${label} 必须是字符串`);
    }

    if (
      (type === FormFieldType.NUMBER ||
        type === FormFieldType.DECIMAL ||
        type === FormFieldType.MONEY) &&
      typeof value !== 'number'
    ) {
      throw new BadRequestException(`${label} 必须是数字`);
    }

    if (type === FormFieldType.BOOLEAN && typeof value !== 'boolean') {
      throw new BadRequestException(`${label} 必须是布尔值`);
    }

    if (
      (type === FormFieldType.DATE || type === FormFieldType.DATETIME) &&
      typeof value !== 'string'
    ) {
      throw new BadRequestException(`${label} 必须是日期字符串`);
    }
  }

  private evaluateArithmeticFormula(
    expression: string,
    row: Record<string, unknown>,
    dependencies: string[],
    label: string,
  ) {
    if (!/^[0-9A-Za-z_+\-*/().\s]+$/.test(expression)) {
      throw new BadRequestException(`${label} 公式包含非法字符`);
    }

    const identifiers = expression.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
    const allowed = new Set(dependencies);

    for (const identifier of identifiers) {
      if (!allowed.has(identifier)) {
        throw new BadRequestException(`${label} 公式依赖未声明：${identifier}`);
      }
    }

    const scope: Record<string, number> = {};
    for (const key of dependencies) {
      const value = row[key];
      const numberValue =
        typeof value === 'number' ? value : Number(value ?? 0);
      scope[key] = Number.isFinite(numberValue) ? numberValue : 0;
    }

    const normalized = expression.replace(
      /[A-Za-z_][A-Za-z0-9_]*/g,
      (identifier) => String(scope[identifier] ?? 0),
    );

    try {
      const result = this.evaluateNumericExpression(normalized);

      if (typeof result !== 'number' || !Number.isFinite(result)) {
        throw new Error('invalid formula result');
      }

      return result;
    } catch {
      throw new BadRequestException(`${label} 公式计算失败`);
    }
  }

  private evaluateNumericExpression(expression: string): number {
    let index = 0;
    const source = expression.replace(/\s+/g, '');

    const peek = () => source[index];
    const consume = () => source[index++];

    const parseExpression = (): number => {
      let value = parseTerm();

      while (peek() === '+' || peek() === '-') {
        const operator = consume();
        const right = parseTerm();
        value = operator === '+' ? value + right : value - right;
      }

      return value;
    };

    const parseTerm = (): number => {
      let value = parseFactor();

      while (peek() === '*' || peek() === '/') {
        const operator = consume();
        const right = parseFactor();
        if (operator === '*') {
          value *= right;
        } else {
          if (right === 0) throw new Error('division by zero');
          value /= right;
        }
      }

      return value;
    };

    const parseFactor = (): number => {
      const char = peek();

      if (char === '(') {
        consume();
        const value = parseExpression();
        if (consume() !== ')') throw new Error('missing closing parenthesis');
        return value;
      }

      if (char === '+' || char === '-') {
        const operator = consume();
        const value = parseFactor();
        return operator === '-' ? -value : value;
      }

      const start = index;
      while (/[0-9.]/.test(peek() ?? '')) {
        consume();
      }

      if (start === index) throw new Error('expected number');

      const token = source.slice(start, index);
      if (!/^\d+(\.\d+)?$/.test(token)) throw new Error('invalid number');

      return Number(token);
    };

    if (!source.length) throw new Error('empty expression');

    const result = parseExpression();
    if (index !== source.length) throw new Error('unexpected trailing input');

    return result;
  }

  private hasValue(value: unknown) {
    return value !== undefined && value !== null && value !== '';
  }

  private generateRecordNo(formCode: string) {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = `${now.getTime()}`.slice(-6);
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();

    return `${formCode.toUpperCase()}-${date}-${suffix}${random}`;
  }
}
