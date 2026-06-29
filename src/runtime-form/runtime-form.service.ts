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
  PhysicalSchemaStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { quoteIdentifier } from '../form-schema-provision/form-schema.utils';
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
      bundle.form,
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
          createdById: user.id,
          submittedAt: dto.submit ? new Date() : null,
        },
      });

      await this.replaceAllPhysicalRows(tx, {
        tenantId,
        recordId: record.id,
        form: bundle.form,
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

    const physicalTables = await this.getPhysicalTablesOrThrow(
      tenantId,
      record.formId,
    );
    const physicalData = await this.readPhysicalData(
      tenantId,
      record.id,
      record.form,
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

    const physicalTables = await this.getPhysicalTablesOrThrow(
      tenantId,
      record.formId,
    );

    const normalizedMain = dto.mainData
      ? this.normalizeMain(record.form, dto.mainData)
      : null;

    const normalizedDetails = dto.details
      ? this.normalizeDetails(record.form, dto.details)
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
          form: record.form,
          physicalTables,
          mainData: normalizedMain,
          userId: user.id,
        });
      }

      if (normalizedDetails) {
        await this.replaceAllDetailPhysicalRows(tx, {
          tenantId,
          recordId: id,
          form: record.form,
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

    const physicalTables = await this.getPhysicalTablesOrThrow(
      tenantId,
      form.id,
    );

    return {
      form,
      physicalTables,
    };
  }

  private async getPhysicalTablesOrThrow(tenantId: string, formId: string) {
    const physicalTables = await this.prisma.formPhysicalTable.findMany({
      where: {
        tenantId,
        formId,
        status: PhysicalSchemaStatus.SYNCED,
      },
      include: {
        columns: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

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

    for (const column of params.physicalTable.columns) {
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

    const mainData = this.toBusinessRows(mainPhysicalTable, mainRows)[0] ?? {};

    const details = [];

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
        rows: this.toBusinessRows(physicalTable, rows),
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
    rows: Record<string, unknown>[],
  ) {
    return rows.map((row) => {
      const result: Record<string, unknown> = {};

      for (const column of physicalTable.columns) {
        if (column.labelColumnName || column.extraColumnName) {
          result[column.fieldCode] = {
            value: row[column.columnName],
            label: column.labelColumnName ? row[column.labelColumnName] : null,
            extra: column.extraColumnName ? row[column.extraColumnName] : null,
          };
        } else {
          result[column.fieldCode] = row[column.columnName];
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
      [FormFieldType.TEXT, FormFieldType.TEXTAREA].includes(type) &&
      typeof value !== 'string'
    ) {
      throw new BadRequestException(`${label} 必须是字符串`);
    }

    if (
      [
        FormFieldType.NUMBER,
        FormFieldType.DECIMAL,
        FormFieldType.MONEY,
      ].includes(type) &&
      typeof value !== 'number'
    ) {
      throw new BadRequestException(`${label} 必须是数字`);
    }

    if (type === FormFieldType.BOOLEAN && typeof value !== 'boolean') {
      throw new BadRequestException(`${label} 必须是布尔值`);
    }

    if (
      [FormFieldType.DATE, FormFieldType.DATETIME].includes(type) &&
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

    const args = dependencies;
    const values = dependencies.map((key) => {
      const value = row[key];
      const numberValue =
        typeof value === 'number' ? value : Number(value ?? 0);
      return Number.isFinite(numberValue) ? numberValue : 0;
    });

    try {
      const fn = new Function(...args, `"use strict"; return (${expression});`);
      const result = fn(...values);

      if (typeof result !== 'number' || !Number.isFinite(result)) {
        throw new Error('invalid formula result');
      }

      return result;
    } catch {
      throw new BadRequestException(`${label} 公式计算失败`);
    }
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
