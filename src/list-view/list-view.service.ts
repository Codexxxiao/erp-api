import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FormTableType,
  FormVersion,
  ListViewColumn,
  ListViewColumnSource,
  ListViewFilter,
  ListViewFilterOperator,
  ListViewSortDirection,
  ListViewStatus,
  PhysicalSchemaStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { quoteIdentifier } from '../form-schema-provision/form-schema.utils';
import type { FormSnapshot } from '../form-snapshot/form-snapshot.types';
import {
  CreateListViewDto,
  ListViewColumnDto,
  ListViewFilterDto,
} from './dto/create-list-view.dto';
import { UpdateListViewDto } from './dto/update-list-view.dto';
import {
  QueryListViewDto,
  QueryListViewFilterDto,
  QueryListViewSortDto,
} from './dto/query-list-view.dto';

type ListViewFull = Prisma.ListViewGetPayload<{
  include: { columns: true; filters: true };
}>;

type PhysicalTable = Prisma.FormPhysicalTableGetPayload<{
  include: { columns: true };
}>;

type SnapshotTable = FormSnapshot['tables'][number];
type SnapshotField = SnapshotTable['fields'][number];

@Injectable()
export class ListViewService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly systemColumns = new Map<string, string>([
    ['id', 'r.id'],
    ['recordNo', 'r."recordNo"'],
    ['status', 'r.status'],
    ['createdAt', 'r."createdAt"'],
    ['updatedAt', 'r."updatedAt"'],
    ['submittedAt', 'r."submittedAt"'],
    ['canceledAt', 'r."canceledAt"'],
    ['createdById', 'r."createdById"'],
  ]);

  async create(user: CurrentUser, dto: CreateListViewDto) {
    const tenantId = requireTenantId(user);
    const bundle = await this.resolveSchema(
      tenantId,
      dto.formId,
      dto.formVersionId,
    );
    this.validateViewConfig(
      dto.columns,
      dto.filters ?? [],
      bundle.mainTable,
      bundle.physicalTable,
    );

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.listView.updateMany({
          where: { tenantId, formId: dto.formId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.listView.create({
        data: {
          tenantId,
          formId: dto.formId,
          formVersionId: bundle.formVersion.id,
          code: dto.code,
          name: dto.name,
          isDefault: dto.isDefault ?? false,
          config: dto.config as Prisma.InputJsonValue,
          sort: dto.sort ?? 0,
          columns: {
            create: dto.columns.map((item) => this.toColumnCreateInput(item)),
          },
          filters: {
            create: (dto.filters ?? []).map((item) =>
              this.toFilterCreateInput(item),
            ),
          },
        },
        include: {
          columns: { orderBy: { sort: 'asc' } },
          filters: { orderBy: { sort: 'asc' } },
        },
      });
    });
  }

  async findAll(user: CurrentUser, formId?: string) {
    const tenantId = requireTenantId(user);

    return this.prisma.listView.findMany({
      where: { tenantId, formId },
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
      include: {
        columns: { orderBy: { sort: 'asc' } },
        filters: { orderBy: { sort: 'asc' } },
      },
    });
  }

  async findDefault(user: CurrentUser, formId: string) {
    const tenantId = requireTenantId(user);

    const view = await this.prisma.listView.findFirst({
      where: {
        tenantId,
        formId,
        status: ListViewStatus.ENABLED,
        isDefault: true,
      },
      include: {
        columns: { orderBy: { sort: 'asc' } },
        filters: { orderBy: { sort: 'asc' } },
      },
    });

    if (!view) throw new NotFoundException('默认列表视图不存在');
    return view;
  }

  async findOne(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    return this.findViewOrThrow(tenantId, id);
  }

  async update(user: CurrentUser, id: string, dto: UpdateListViewDto) {
    const tenantId = requireTenantId(user);
    const existed = await this.findViewOrThrow(tenantId, id);

    const formId = dto.formId ?? existed.formId;
    const formVersionId =
      dto.formVersionId ?? existed.formVersionId ?? undefined;
    const bundle = await this.resolveSchema(tenantId, formId, formVersionId);

    if (dto.columns || dto.filters) {
      this.validateViewConfig(
        dto.columns ?? existed.columns,
        dto.filters ?? existed.filters,
        bundle.mainTable,
        bundle.physicalTable,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.listView.updateMany({
          where: { tenantId, formId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      return tx.listView.update({
        where: { id },
        data: {
          code: dto.code,
          name: dto.name,
          formId: dto.formId,
          formVersionId: bundle.formVersion.id,
          isDefault: dto.isDefault,
          config: dto.config as Prisma.InputJsonValue,
          sort: dto.sort,
          status: ListViewStatus.DRAFT,
          columns: dto.columns
            ? {
                deleteMany: {},
                create: dto.columns.map((item) =>
                  this.toColumnCreateInput(item),
                ),
              }
            : undefined,
          filters: dto.filters
            ? {
                deleteMany: {},
                create: dto.filters.map((item) =>
                  this.toFilterCreateInput(item),
                ),
              }
            : undefined,
        },
        include: {
          columns: { orderBy: { sort: 'asc' } },
          filters: { orderBy: { sort: 'asc' } },
        },
      });
    });
  }

  async enable(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    const view = await this.findViewOrThrow(tenantId, id);
    const bundle = await this.resolveSchema(
      tenantId,
      view.formId,
      view.formVersionId ?? undefined,
    );
    this.validateViewConfig(
      view.columns,
      view.filters,
      bundle.mainTable,
      bundle.physicalTable,
    );

    return this.prisma.listView.update({
      where: { id },
      data: { status: ListViewStatus.ENABLED },
      include: { columns: true, filters: true },
    });
  }

  async disable(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    await this.findViewOrThrow(tenantId, id);

    return this.prisma.listView.update({
      where: { id },
      data: { status: ListViewStatus.DISABLED },
      include: { columns: true, filters: true },
    });
  }

  async queryView(user: CurrentUser, id: string, dto: QueryListViewDto) {
    const tenantId = requireTenantId(user);
    const view = await this.findViewOrThrow(tenantId, id);

    if (view.status !== ListViewStatus.ENABLED) {
      throw new BadRequestException('列表视图未启用');
    }

    const bundle = await this.resolveSchema(
      tenantId,
      view.formId,
      view.formVersionId ?? undefined,
    );
    const plan = this.buildQueryPlan(
      view,
      dto,
      bundle.mainTable,
      bundle.physicalTable,
    );
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const countRows = await this.prisma.$queryRawUnsafe<
      Array<{ total: bigint }>
    >(plan.countSql, ...plan.values);

    const rows = await this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `${plan.listSql} LIMIT $${plan.values.length + 1} OFFSET $${plan.values.length + 2}`,
      ...plan.values,
      pageSize,
      offset,
    );

    return {
      total: Number(countRows[0]?.total ?? 0),
      page,
      pageSize,
      columns: view.columns
        .filter((item) => !item.hidden)
        .sort((a, b) => a.sort - b.sort),
      list: rows.map((row) => this.mapRow(row, plan.aliases)),
    };
  }

  private buildQueryPlan(
    view: ListViewFull,
    dto: QueryListViewDto,
    mainTable: SnapshotTable,
    physicalTable: PhysicalTable,
  ) {
    const values: unknown[] = [view.tenantId, view.formId];
    const whereParts = ['r."tenantId" = $1', 'r."formId" = $2'];

    const aliases: Array<{
      alias: string;
      outputKey: string;
      isOption: boolean;
    }> = [];
    const selectParts = [
      'r.id AS "__id"',
      'r."recordNo" AS "__recordNo"',
      'r.status AS "__status"',
      'r."createdAt" AS "__createdAt"',
      'r."updatedAt" AS "__updatedAt"',
    ];

    const columns = view.columns
      .filter((item) => !item.hidden)
      .sort((a, b) => a.sort - b.sort);

    for (const column of columns) {
      if (column.source === ListViewColumnSource.SYSTEM) {
        const expr = this.getSystemExpr(column.systemKey);
        const alias = `s_${column.systemKey}`;
        selectParts.push(`${expr} AS ${quoteIdentifier(alias)}`);
        aliases.push({ alias, outputKey: column.systemKey!, isOption: false });
      } else {
        const field = this.findField(mainTable, column);
        const physicalColumn = this.findPhysicalColumn(physicalTable, field);
        const alias = this.fieldAlias(field.id);

        if (physicalColumn.labelColumnName || physicalColumn.extraColumnName) {
          selectParts.push(
            `jsonb_build_object('value', p.${quoteIdentifier(physicalColumn.columnName)}, 'label', ${physicalColumn.labelColumnName ? `p.${quoteIdentifier(physicalColumn.labelColumnName)}` : 'null'}, 'extra', ${physicalColumn.extraColumnName ? `p.${quoteIdentifier(physicalColumn.extraColumnName)}` : 'null'}) AS ${quoteIdentifier(alias)}`,
          );
          aliases.push({ alias, outputKey: field.code, isOption: true });
        } else {
          selectParts.push(
            `p.${quoteIdentifier(physicalColumn.columnName)} AS ${quoteIdentifier(alias)}`,
          );
          aliases.push({ alias, outputKey: field.code, isOption: false });
        }
      }
    }

    const filters = [
      ...view.filters.map((item) => this.defaultFilterToQuery(item)),
      ...(dto.filters ?? []),
    ];

    for (const filter of filters) {
      const condition = this.buildFilterCondition(
        filter,
        mainTable,
        physicalTable,
        values,
      );
      if (condition) whereParts.push(condition);
    }

    const orderBy = this.buildOrderBy(
      dto.sorts,
      view.columns,
      mainTable,
      physicalTable,
    );
    const fromSql = `
      FROM "FormRecord" r
      INNER JOIN ${quoteIdentifier(physicalTable.tableName)} p
        ON p.record_id = r.id AND p.tenant_id = r."tenantId"
      WHERE ${whereParts.join(' AND ')}
    `;

    return {
      values,
      aliases,
      countSql: `SELECT COUNT(*)::bigint AS total ${fromSql}`,
      listSql: `SELECT ${selectParts.join(', ')} ${fromSql} ${orderBy}`,
    };
  }

  private buildFilterCondition(
    filter: QueryListViewFilterDto,
    mainTable: SnapshotTable,
    physicalTable: PhysicalTable,
    values: unknown[],
  ) {
    const expr =
      filter.source === ListViewColumnSource.SYSTEM
        ? this.getSystemExpr(filter.systemKey)
        : `p.${quoteIdentifier(this.findPhysicalColumn(physicalTable, this.findField(mainTable, filter)).columnName)}`;

    const push = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };

    switch (filter.operator) {
      case ListViewFilterOperator.EQ:
        return `${expr} = ${push(filter.value)}`;
      case ListViewFilterOperator.NE:
        return `${expr} <> ${push(filter.value)}`;
      case ListViewFilterOperator.CONTAINS:
        return `${expr}::text ILIKE ${push(`%${filter.value ?? ''}%`)}`;
      case ListViewFilterOperator.STARTS_WITH:
        return `${expr}::text ILIKE ${push(`${filter.value ?? ''}%`)}`;
      case ListViewFilterOperator.ENDS_WITH:
        return `${expr}::text ILIKE ${push(`%${filter.value ?? ''}`)}`;
      case ListViewFilterOperator.GT:
        return `${expr} > ${push(filter.value)}`;
      case ListViewFilterOperator.GTE:
        return `${expr} >= ${push(filter.value)}`;
      case ListViewFilterOperator.LT:
        return `${expr} < ${push(filter.value)}`;
      case ListViewFilterOperator.LTE:
        return `${expr} <= ${push(filter.value)}`;
      case ListViewFilterOperator.BETWEEN:
        return `${expr} BETWEEN ${push(filter.value)} AND ${push(filter.valueTo)}`;
      case ListViewFilterOperator.IN:
        if (!filter.values?.length) return null;
        return `${expr} IN (${filter.values.map((value) => push(value)).join(', ')})`;
      case ListViewFilterOperator.IS_NULL:
        return `${expr} IS NULL`;
      case ListViewFilterOperator.IS_NOT_NULL:
        return `${expr} IS NOT NULL`;
      default:
        throw new BadRequestException('不支持的筛选操作符');
    }
  }

  private buildOrderBy(
    sorts: QueryListViewSortDto[] | undefined,
    columns: ListViewColumn[],
    mainTable: SnapshotTable,
    physicalTable: PhysicalTable,
  ) {
    const sort = sorts?.[0] ?? this.defaultSort(columns);
    if (!sort) return 'ORDER BY r."createdAt" DESC';

    const direction =
      sort.direction === ListViewSortDirection.ASC ? 'ASC' : 'DESC';

    if (sort.source === ListViewColumnSource.SYSTEM) {
      return `ORDER BY ${this.getSystemExpr(sort.systemKey)} ${direction}`;
    }

    const field = this.findField(mainTable, sort);
    const physicalColumn = this.findPhysicalColumn(physicalTable, field);
    return `ORDER BY p.${quoteIdentifier(physicalColumn.columnName)} ${direction}`;
  }

  private async resolveSchema(
    tenantId: string,
    formId: string,
    formVersionId?: string,
  ) {
    const form = await this.prisma.formDefinition.findFirst({
      where: { id: formId, tenantId },
    });
    if (!form) throw new BadRequestException('表单不存在');

    const formVersion = await this.prisma.formVersion.findFirst({
      where: {
        tenantId,
        formId,
        ...(formVersionId ? { id: formVersionId } : {}),
      },
      orderBy: { version: 'desc' },
    });

    if (!formVersion) throw new BadRequestException('请先发布表单快照');

    const snapshot = formVersion.snapshot as unknown as FormSnapshot;
    const mainTable = snapshot.tables.find(
      (item) => item.type === FormTableType.MAIN,
    );
    if (!mainTable) throw new BadRequestException('表单快照缺少主表');

    const physicalTable = await this.prisma.formPhysicalTable.findFirst({
      where: {
        tenantId,
        formId,
        tableId: mainTable.id,
        status: PhysicalSchemaStatus.SYNCED,
      },
      include: { columns: { orderBy: { createdAt: 'asc' } } },
    });

    if (!physicalTable)
      throw new BadRequestException('请先发布表单并生成实体表');

    return {
      form,
      formVersion: formVersion,
      snapshot,
      mainTable,
      physicalTable,
    };
  }

  private validateViewConfig(
    columns: Array<ListViewColumnDto | ListViewColumn>,
    filters: Array<ListViewFilterDto | ListViewFilter>,
    mainTable: SnapshotTable,
    physicalTable: PhysicalTable,
  ) {
    if (columns.length === 0)
      throw new BadRequestException('列表至少需要配置一列');

    for (const column of columns) {
      if (column.source === ListViewColumnSource.SYSTEM)
        this.getSystemExpr(column.systemKey);
      else
        this.findPhysicalColumn(
          physicalTable,
          this.findField(mainTable, column),
        );
    }

    for (const filter of filters) {
      if (filter.source === ListViewColumnSource.SYSTEM)
        this.getSystemExpr(filter.systemKey);
      else
        this.findPhysicalColumn(
          physicalTable,
          this.findField(mainTable, filter),
        );
    }
  }

  private findViewOrThrow(tenantId: string, id: string) {
    return this.prisma.listView
      .findFirst({
        where: { id, tenantId },
        include: {
          columns: { orderBy: { sort: 'asc' } },
          filters: { orderBy: { sort: 'asc' } },
        },
      })
      .then((view) => {
        if (!view) throw new NotFoundException('列表视图不存在');
        return view;
      });
  }

  private findField(
    mainTable: SnapshotTable,
    input: { fieldId?: string | null; fieldCode?: string | null },
  ) {
    const field = mainTable.fields.find(
      (item) =>
        (input.fieldId && item.id === input.fieldId) ||
        (input.fieldCode && item.code === input.fieldCode),
    );

    if (!field)
      throw new BadRequestException(
        `字段不存在：${input.fieldCode ?? input.fieldId}`,
      );
    return field;
  }

  private findPhysicalColumn(
    physicalTable: PhysicalTable,
    field: SnapshotField,
  ) {
    const column = physicalTable.columns.find(
      (item) => item.fieldId === field.id,
    );
    if (!column)
      throw new BadRequestException(`字段未生成物理列：${field.code}`);
    return column;
  }

  private getSystemExpr(systemKey?: string | null) {
    if (!systemKey || !this.systemColumns.has(systemKey)) {
      throw new BadRequestException(`不支持的系统字段：${systemKey}`);
    }

    return this.systemColumns.get(systemKey)!;
  }

  private defaultSort(columns: ListViewColumn[]): QueryListViewSortDto | null {
    const column = columns.find((item) => item.sortDirection);
    if (!column?.sortDirection) return null;

    return {
      source: column.source,
      systemKey: column.systemKey ?? undefined,
      fieldId: column.fieldId ?? undefined,
      fieldCode: column.fieldCode ?? undefined,
      direction: column.sortDirection,
    };
  }

  private defaultFilterToQuery(filter: ListViewFilter): QueryListViewFilterDto {
    return {
      source: filter.source,
      systemKey: filter.systemKey ?? undefined,
      fieldId: filter.fieldId ?? undefined,
      fieldCode: filter.fieldCode ?? undefined,
      operator: filter.operator,
      value: filter.defaultValue,
    };
  }

  private fieldAlias(fieldId: string) {
    return `f_${fieldId.replace(/-/g, '_')}`;
  }

  private mapRow(
    row: Record<string, unknown>,
    aliases: Array<{ alias: string; outputKey: string }>,
  ) {
    const item: Record<string, unknown> = {
      id: row.__id,
      recordNo: row.__recordNo,
      status: row.__status,
      createdAt: row.__createdAt,
      updatedAt: row.__updatedAt,
    };

    for (const alias of aliases) {
      item[alias.outputKey] = row[alias.alias];
    }

    return item;
  }

  private toColumnCreateInput(column: ListViewColumnDto) {
    return {
      source: column.source,
      systemKey: column.systemKey,
      fieldId: column.fieldId,
      fieldCode: column.fieldCode,
      title: column.title,
      width: column.width,
      fixed: column.fixed,
      hidden: column.hidden ?? false,
      sortable: column.sortable ?? true,
      sortDirection: column.sortDirection,
      config: column.config as Prisma.InputJsonValue,
      sort: column.sort ?? 0,
    };
  }

  private toFilterCreateInput(filter: ListViewFilterDto) {
    return {
      source: filter.source,
      systemKey: filter.systemKey,
      fieldId: filter.fieldId,
      fieldCode: filter.fieldCode,
      label: filter.label,
      operator: filter.operator,
      defaultValue: filter.defaultValue as Prisma.InputJsonValue,
      required: filter.required ?? false,
      config: filter.config as Prisma.InputJsonValue,
      sort: filter.sort ?? 0,
    };
  }
}
