import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DataSourceType,
  Prisma,
  type DataSourceField,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { DictionaryService } from '../dictionary/dictionary.service';
import { CreateDataSourceDto } from './dto/create-datasource.dto';
import { UpdateDataSourceDto } from './dto/update-datasource.dto';
import { CreateDataSourceFieldDto } from './dto/create-datasource-field.dto';
import { UpdateDataSourceFieldDto } from './dto/update-datasource-field.dto';
import { QueryDataSourceDto } from './dto/query-datasource.dto';

export interface DataSourceOption {
  value: string;
  label: string;
  extra: Record<string, unknown>;
  raw: unknown;
}

@Injectable()
export class DatasourceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dictionary: DictionaryService,
  ) {}

  createSystemDataSource(dto: CreateDataSourceDto) {
    return this.createDataSource(null, this.systemScopeKey(), dto);
  }

  findSystemDataSources() {
    return this.prisma.dataSource.findMany({
      where: { scopeKey: this.systemScopeKey() },
      include: { fields: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
  }

  updateSystemDataSource(id: string, dto: UpdateDataSourceDto) {
    return this.updateDataSource(id, this.systemScopeKey(), dto);
  }

  createSystemField(dataSourceId: string, dto: CreateDataSourceFieldDto) {
    return this.createField(dataSourceId, this.systemScopeKey(), dto);
  }

  updateSystemField(fieldId: string, dto: UpdateDataSourceFieldDto) {
    return this.updateField(fieldId, this.systemScopeKey(), dto);
  }

  createTenantDataSource(currentUser: CurrentUser, dto: CreateDataSourceDto) {
    const tenantId = requireTenantId(currentUser);
    return this.createDataSource(tenantId, this.tenantScopeKey(tenantId), dto);
  }

  findTenantDataSources(currentUser: CurrentUser) {
    const tenantId = requireTenantId(currentUser);

    return this.prisma.dataSource.findMany({
      where: { scopeKey: this.tenantScopeKey(tenantId) },
      include: { fields: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findAvailableDataSources(currentUser: CurrentUser) {
    const tenantId = requireTenantId(currentUser);

    return this.prisma.dataSource.findMany({
      where: {
        isActive: true,
        OR: [
          { scopeKey: this.systemScopeKey() },
          { scopeKey: this.tenantScopeKey(tenantId) },
        ],
      },
      include: { fields: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
  }

  updateTenantDataSource(
    currentUser: CurrentUser,
    id: string,
    dto: UpdateDataSourceDto,
  ) {
    const tenantId = requireTenantId(currentUser);
    return this.updateDataSource(id, this.tenantScopeKey(tenantId), dto);
  }

  createTenantField(
    currentUser: CurrentUser,
    dataSourceId: string,
    dto: CreateDataSourceFieldDto,
  ) {
    const tenantId = requireTenantId(currentUser);
    return this.createField(dataSourceId, this.tenantScopeKey(tenantId), dto);
  }

  updateTenantField(
    currentUser: CurrentUser,
    fieldId: string,
    dto: UpdateDataSourceFieldDto,
  ) {
    const tenantId = requireTenantId(currentUser);
    return this.updateField(fieldId, this.tenantScopeKey(tenantId), dto);
  }

  async getEffectiveFields(currentUser: CurrentUser, code: string) {
    const dataSource = await this.findEffectiveDataSource(currentUser, code);
    return dataSource.fields;
  }

  async query(
    currentUser: CurrentUser,
    code: string,
    query: QueryDataSourceDto,
  ): Promise<DataSourceOption[]> {
    const dataSource = await this.findEffectiveDataSource(currentUser, code);

    if (dataSource.type === DataSourceType.STATIC) {
      return this.queryStatic(dataSource.config, dataSource.fields, query);
    }

    if (dataSource.type === DataSourceType.DICTIONARY) {
      return this.queryDictionary(currentUser, dataSource.config, query);
    }

    throw new BadRequestException('该数据源类型暂未支持查询');
  }

  private async createDataSource(
    tenantId: string | null,
    scopeKey: string,
    dto: CreateDataSourceDto,
  ) {
    try {
      return await this.prisma.dataSource.create({
        data: {
          tenantId,
          scopeKey,
          code: this.normalizeCode(dto.code),
          name: dto.name.trim(),
          type: dto.type,
          config: dto.config as Prisma.InputJsonValue,
          description: dto.description?.trim(),
          sort: dto.sort ?? 0,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new BadRequestException('数据源编码已存在');
      }
      throw error;
    }
  }

  private async updateDataSource(
    id: string,
    scopeKey: string,
    dto: UpdateDataSourceDto,
  ) {
    const dataSource = await this.prisma.dataSource.findFirst({
      where: { id, scopeKey },
    });

    if (!dataSource) {
      throw new NotFoundException('数据源不存在');
    }

    return this.prisma.dataSource.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        type: dto.type,
        config:
          dto.config === undefined
            ? undefined
            : (dto.config as Prisma.InputJsonValue),
        description: dto.description?.trim(),
        sort: dto.sort,
        isActive: dto.isActive,
      },
    });
  }

  private async createField(
    dataSourceId: string,
    scopeKey: string,
    dto: CreateDataSourceFieldDto,
  ) {
    const dataSource = await this.prisma.dataSource.findFirst({
      where: { id: dataSourceId, scopeKey },
    });

    if (!dataSource) {
      throw new NotFoundException('数据源不存在');
    }

    try {
      return await this.prisma.dataSourceField.create({
        data: {
          dataSourceId,
          key: dto.key.trim(),
          label: dto.label.trim(),
          path: dto.path.trim(),
          type: dto.type,
          isValue: dto.isValue ?? false,
          isLabel: dto.isLabel ?? false,
          isExtra: dto.isExtra ?? true,
          sort: dto.sort ?? 0,
        },
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new BadRequestException('返回字段 key 已存在');
      }
      throw error;
    }
  }

  private async updateField(
    fieldId: string,
    scopeKey: string,
    dto: UpdateDataSourceFieldDto,
  ) {
    const field = await this.prisma.dataSourceField.findFirst({
      where: {
        id: fieldId,
        dataSource: { scopeKey },
      },
    });

    if (!field) {
      throw new NotFoundException('返回字段不存在');
    }

    return this.prisma.dataSourceField.update({
      where: { id: fieldId },
      data: {
        label: dto.label?.trim(),
        path: dto.path?.trim(),
        type: dto.type,
        isValue: dto.isValue,
        isLabel: dto.isLabel,
        isExtra: dto.isExtra,
        sort: dto.sort,
      },
    });
  }

  private async findEffectiveDataSource(
    currentUser: CurrentUser,
    code: string,
  ) {
    const tenantId = requireTenantId(currentUser);
    const normalizedCode = this.normalizeCode(code);

    const tenantDataSource = await this.prisma.dataSource.findFirst({
      where: {
        scopeKey: this.tenantScopeKey(tenantId),
        code: normalizedCode,
        isActive: true,
      },
      include: { fields: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
    });

    if (tenantDataSource) return tenantDataSource;

    const systemDataSource = await this.prisma.dataSource.findFirst({
      where: {
        scopeKey: this.systemScopeKey(),
        code: normalizedCode,
        isActive: true,
      },
      include: { fields: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
    });

    if (!systemDataSource) {
      throw new NotFoundException('数据源不存在');
    }

    return systemDataSource;
  }

  private queryStatic(
    configValue: Prisma.JsonValue,
    fields: DataSourceField[],
    query: QueryDataSourceDto,
  ): DataSourceOption[] {
    const config = this.asRecord(configValue);
    const items = Array.isArray(config.items) ? config.items : [];

    const valueField =
      this.findValuePath(fields) ?? this.asString(config.valueField) ?? 'value';
    const labelField =
      this.findLabelPath(fields) ?? this.asString(config.labelField) ?? 'label';

    const options = items.map((item) =>
      this.toOption(item, fields, valueField, labelField),
    );

    return this.filterOptions(options, query);
  }

  private async queryDictionary(
    currentUser: CurrentUser,
    configValue: Prisma.JsonValue,
    query: QueryDataSourceDto,
  ): Promise<DataSourceOption[]> {
    const config = this.asRecord(configValue);
    const dictionaryCode = this.asString(config.dictionaryCode);

    if (!dictionaryCode) {
      throw new BadRequestException('字典数据源缺少 dictionaryCode');
    }

    const items = await this.dictionary.findTenantItemsByCode(
      currentUser,
      dictionaryCode,
    );

    const options = items.map((item) => ({
      value: item.value,
      label: item.label,
      extra: {
        id: item.id,
        parentId: item.parentId,
        color: item.color,
        sort: item.sort,
        extra: item.extra,
      },
      raw: item,
    }));

    return this.filterOptions(options, query);
  }

  private toOption(
    row: unknown,
    fields: DataSourceField[],
    valuePath: string,
    labelPath: string,
  ): DataSourceOption {
    const value = this.getByPath(row, valuePath);
    const label = this.getByPath(row, labelPath);

    const extra: Record<string, unknown> = {};

    if (fields.length > 0) {
      for (const field of fields) {
        if (field.isExtra || field.isValue || field.isLabel) {
          extra[field.key] = this.getByPath(row, field.path);
        }
      }
    } else if (this.isRecord(row)) {
      Object.assign(extra, row);
    }

    const valueStr = this.stringifyOptionValue(value);
    const labelStr = this.stringifyOptionValue(
      label !== undefined && label !== null ? label : value,
    );

    return {
      value: valueStr,
      label: labelStr || valueStr,
      extra,
      raw: row,
    };
  }

  private filterOptions(
    options: DataSourceOption[],
    query: QueryDataSourceDto,
  ) {
    const limit = query.limit ?? 50;
    const keyword = query.q?.trim().toLowerCase();

    const filtered = keyword
      ? options.filter((option) => {
          return (
            option.value.toLowerCase().includes(keyword) ||
            option.label.toLowerCase().includes(keyword)
          );
        })
      : options;

    return filtered.slice(0, limit);
  }

  private findValuePath(fields: DataSourceField[]) {
    return fields.find((field) => field.isValue)?.path;
  }

  private findLabelPath(fields: DataSourceField[]) {
    return fields.find((field) => field.isLabel)?.path;
  }

  private getByPath(row: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
      if (!this.isRecord(current)) return undefined;
      return current[key];
    }, row);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return this.isRecord(value) ? value : {};
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }

  private stringifyOptionValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }
    return JSON.stringify(value);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private normalizeCode(value: string) {
    return value.trim().toLowerCase();
  }

  private systemScopeKey() {
    return 'system';
  }

  private tenantScopeKey(tenantId: string) {
    return `tenant:${tenantId}`;
  }

  private isUniqueError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
