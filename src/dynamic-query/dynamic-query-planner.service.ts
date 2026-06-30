import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ListViewColumnSource,
  ListViewFilterOperator,
  ListViewSortDirection,
} from '../generated/prisma/client';
import { quoteIdentifier } from '../form-schema-provision/form-schema.utils';
import {
  DynamicQueryColumnInput,
  DynamicQueryFilterInput,
  DynamicQueryPhysicalTable,
  DynamicQueryPlan,
  DynamicQueryPlanInput,
  DynamicQuerySnapshotField,
  DynamicQuerySnapshotTable,
  DynamicQuerySortInput,
} from './dynamic-query.types';

@Injectable()
export class DynamicQueryPlannerService {
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

  validateColumnsAndFilters(input: {
    columns: DynamicQueryColumnInput[];
    filters: DynamicQueryFilterInput[];
    mainTable: DynamicQuerySnapshotTable;
    physicalTable: DynamicQueryPhysicalTable;
  }) {
    if (input.columns.length === 0) {
      throw new BadRequestException('列表至少需要配置一列');
    }

    for (const column of input.columns) {
      this.validateFieldRef(column, input.mainTable, input.physicalTable);
    }

    for (const filter of input.filters) {
      this.validateFieldRef(filter, input.mainTable, input.physicalTable);
    }
  }

  buildPlan(input: DynamicQueryPlanInput): DynamicQueryPlan {
    const page = this.normalizePage(input.query?.page);
    const pageSize = this.normalizePageSize(
      input.query?.pageSize,
      input.maxPageSize ?? 100,
    );

    const values: unknown[] = [input.tenantId, input.formId];
    const whereParts = ['r."tenantId" = $1', 'r."formId" = $2'];
    const aliases = [];
    const selectParts = [
      'r.id AS "__id"',
      'r."recordNo" AS "__recordNo"',
      'r.status AS "__status"',
      'r."createdAt" AS "__createdAt"',
      'r."updatedAt" AS "__updatedAt"',
    ];

    const visibleColumns = [...input.columns]
      .filter((item) => !item.hidden)
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

    for (const column of visibleColumns) {
      if (column.source === ListViewColumnSource.SYSTEM) {
        const expr = this.getSystemExpr(column.systemKey);
        const alias = this.systemAlias(column.systemKey!);

        selectParts.push(`${expr} AS ${quoteIdentifier(alias)}`);
        aliases.push({
          alias,
          outputKey: column.systemKey!,
          isOption: false,
        });
        continue;
      }

      const field = this.findField(input.mainTable, column);
      const physicalColumn = this.findPhysicalColumn(
        input.physicalTable,
        field,
      );
      const alias = this.fieldAlias(field.id);

      if (physicalColumn.labelColumnName || physicalColumn.extraColumnName) {
        selectParts.push(
          `jsonb_build_object('value', p.${quoteIdentifier(physicalColumn.columnName)}, 'label', ${
            physicalColumn.labelColumnName
              ? `p.${quoteIdentifier(physicalColumn.labelColumnName)}`
              : 'null'
          }, 'extra', ${
            physicalColumn.extraColumnName
              ? `p.${quoteIdentifier(physicalColumn.extraColumnName)}`
              : 'null'
          }) AS ${quoteIdentifier(alias)}`,
        );
        aliases.push({ alias, outputKey: field.code, isOption: true });
      } else {
        selectParts.push(
          `p.${quoteIdentifier(physicalColumn.columnName)} AS ${quoteIdentifier(alias)}`,
        );
        aliases.push({ alias, outputKey: field.code, isOption: false });
      }
    }

    const filters = this.mergeFilters(
      input.filters ?? [],
      input.query?.filters ?? [],
    );

    for (const filter of filters) {
      const condition = this.buildFilterCondition(
        filter,
        input.mainTable,
        input.physicalTable,
        values,
      );

      if (condition) whereParts.push(condition);
    }

    const orderBy = this.buildOrderBy(
      input.query?.sorts,
      input.columns,
      input.mainTable,
      input.physicalTable,
    );

    const fromSql = `
      FROM "FormRecord" r
      INNER JOIN ${quoteIdentifier(input.physicalTable.tableName)} p
        ON p.record_id = r.id AND p.tenant_id = r."tenantId"
      WHERE ${whereParts.join(' AND ')}
    `;

    return {
      page,
      pageSize,
      values,
      aliases,
      visibleColumns,
      countSql: `SELECT COUNT(*)::bigint AS total ${fromSql}`,
      listSql: `SELECT ${selectParts.join(', ')} ${fromSql} ${orderBy}`,
    };
  }

  mapRow(
    row: Record<string, unknown>,
    aliases: { alias: string; outputKey: string }[],
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

  private mergeFilters(
    storedFilters: DynamicQueryFilterInput[],
    runtimeFilters: DynamicQueryFilterInput[],
  ) {
    const defaults = [...storedFilters]
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
      .map((item) => this.normalizeStoredFilter(item))
      .filter((item): item is DynamicQueryFilterInput => Boolean(item));

    return [...defaults, ...runtimeFilters];
  }

  private normalizeStoredFilter(input: DynamicQueryFilterInput) {
    const filter: DynamicQueryFilterInput = { ...input };

    if (
      filter.operator === ListViewFilterOperator.IN &&
      !filter.values?.length &&
      Array.isArray(filter.defaultValue)
    ) {
      filter.values = filter.defaultValue;
    }

    if (filter.value === undefined && filter.defaultValue !== undefined) {
      filter.value = filter.defaultValue;
    }

    if (!this.hasFilterValue(filter)) {
      if (filter.required) {
        throw new BadRequestException(
          `筛选条件缺少默认值：${filter.fieldCode ?? filter.systemKey}`,
        );
      }

      return null;
    }

    return filter;
  }

  private buildFilterCondition(
    filter: DynamicQueryFilterInput,
    mainTable: DynamicQuerySnapshotTable,
    physicalTable: DynamicQueryPhysicalTable,
    values: unknown[],
  ) {
    if (!this.hasFilterValue(filter)) {
      if (filter.required)
        throw new BadRequestException('必填筛选条件不能为空');
      return null;
    }

    const expr =
      filter.source === ListViewColumnSource.SYSTEM
        ? this.getSystemExpr(filter.systemKey)
        : `p.${quoteIdentifier(
            this.findPhysicalColumn(
              physicalTable,
              this.findField(mainTable, filter),
            ).columnName,
          )}`;

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
        return `${expr}::text ILIKE ${push(`%${this.toFilterText(filter.value)}%`)}`;
      case ListViewFilterOperator.STARTS_WITH:
        return `${expr}::text ILIKE ${push(`${this.toFilterText(filter.value)}%`)}`;
      case ListViewFilterOperator.ENDS_WITH:
        return `${expr}::text ILIKE ${push(`%${this.toFilterText(filter.value)}`)}`;
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
      case ListViewFilterOperator.IN: {
        const inValues = this.getInValues(filter);
        return `${expr} IN (${inValues.map((value) => push(value)).join(', ')})`;
      }
      case ListViewFilterOperator.IS_NULL:
        return `${expr} IS NULL`;
      case ListViewFilterOperator.IS_NOT_NULL:
        return `${expr} IS NOT NULL`;
      default:
        throw new BadRequestException('不支持的筛选操作符');
    }
  }

  private buildOrderBy(
    sorts: DynamicQuerySortInput[] | undefined,
    columns: DynamicQueryColumnInput[],
    mainTable: DynamicQuerySnapshotTable,
    physicalTable: DynamicQueryPhysicalTable,
  ) {
    const finalSorts = sorts?.length ? sorts : this.defaultSorts(columns);
    if (!finalSorts.length) return 'ORDER BY r."createdAt" DESC';

    const orderBy = finalSorts.slice(0, 5).map((sort) => {
      const direction =
        sort.direction === ListViewSortDirection.ASC ? 'ASC' : 'DESC';

      if (sort.source === ListViewColumnSource.SYSTEM) {
        return `${this.getSystemExpr(sort.systemKey)} ${direction} NULLS LAST`;
      }

      const field = this.findField(mainTable, sort);
      const physicalColumn = this.findPhysicalColumn(physicalTable, field);

      return `p.${quoteIdentifier(physicalColumn.columnName)} ${direction} NULLS LAST`;
    });

    return `ORDER BY ${orderBy.join(', ')}`;
  }

  private validateFieldRef(
    input: {
      source: ListViewColumnSource;
      systemKey?: string | null;
      fieldId?: string | null;
      fieldCode?: string | null;
    },
    mainTable: DynamicQuerySnapshotTable,
    physicalTable: DynamicQueryPhysicalTable,
  ) {
    if (input.source === ListViewColumnSource.SYSTEM) {
      this.getSystemExpr(input.systemKey);
      return;
    }

    this.findPhysicalColumn(physicalTable, this.findField(mainTable, input));
  }

  private findField(
    mainTable: DynamicQuerySnapshotTable,
    input: { fieldId?: string | null; fieldCode?: string | null },
  ): DynamicQuerySnapshotField {
    const field = mainTable.fields.find(
      (item) =>
        (input.fieldId && item.id === input.fieldId) ||
        (input.fieldCode && item.code === input.fieldCode),
    );

    if (!field) {
      throw new BadRequestException(
        `字段不存在：${input.fieldCode ?? input.fieldId}`,
      );
    }

    return field;
  }

  private findPhysicalColumn(
    physicalTable: DynamicQueryPhysicalTable,
    field: DynamicQuerySnapshotField,
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

  private defaultSorts(
    columns: DynamicQueryColumnInput[],
  ): DynamicQuerySortInput[] {
    const column = columns.find((item) => item.sortDirection);
    if (!column?.sortDirection) return [];

    return [
      {
        source: column.source,
        systemKey: column.systemKey,
        fieldId: column.fieldId,
        fieldCode: column.fieldCode,
        direction: column.sortDirection,
      },
    ];
  }

  private hasFilterValue(filter: DynamicQueryFilterInput) {
    switch (filter.operator) {
      case ListViewFilterOperator.IS_NULL:
      case ListViewFilterOperator.IS_NOT_NULL:
        return true;
      case ListViewFilterOperator.BETWEEN:
        return (
          filter.value !== undefined &&
          filter.value !== null &&
          filter.valueTo !== undefined &&
          filter.valueTo !== null
        );
      case ListViewFilterOperator.IN:
        return this.getInValues(filter).length > 0;
      default:
        return filter.value !== undefined && filter.value !== null;
    }
  }

  private getInValues(filter: DynamicQueryFilterInput) {
    if (filter.values?.length) return filter.values;
    if (Array.isArray(filter.value)) return filter.value;
    return [];
  }

  private toFilterText(value: unknown): string {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean')
      return String(value);
    throw new BadRequestException('筛选值必须是字符串、数字或布尔值');
  }

  private fieldAlias(fieldId: string) {
    return `f_${fieldId.replace(/-/g, '_').toLowerCase()}`;
  }

  private systemAlias(systemKey: string) {
    const normalized = systemKey
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^([0-9])/, '_$1')
      .replace(/^_+/, '');

    return `s_${normalized || 'x'}`;
  }

  private normalizePage(value?: number) {
    const page = Number(value ?? 1);
    if (!Number.isFinite(page) || page < 1) return 1;
    return Math.floor(page);
  }

  private normalizePageSize(value: number | undefined, max: number) {
    const pageSize = Number(value ?? 20);
    if (!Number.isFinite(pageSize) || pageSize < 1) return 20;
    return Math.min(Math.floor(pageSize), max);
  }
}
