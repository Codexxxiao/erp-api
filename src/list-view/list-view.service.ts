import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FormTableType,
  ListViewColumn,
  ListViewFilter,
  ListViewStatus,
  PhysicalSchemaStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import type { FormSnapshot } from '../form-snapshot/form-snapshot.types';
import {
  CreateListViewDto,
  ListViewColumnDto,
  ListViewFilterDto,
} from './dto/create-list-view.dto';
import { UpdateListViewDto } from './dto/update-list-view.dto';
import { QueryListViewDto } from './dto/query-list-view.dto';
import { DynamicQueryExecutorService } from '../dynamic-query/dynamic-query-executor.service';
import { DynamicQueryPlannerService } from '../dynamic-query/dynamic-query-planner.service';

type PhysicalTable = Prisma.FormPhysicalTableGetPayload<{
  include: { columns: true };
}>;

type SnapshotTable = FormSnapshot['tables'][number];

@Injectable()
export class ListViewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dynamicQueryExecutor: DynamicQueryExecutorService,
    private readonly dynamicQueryPlanner: DynamicQueryPlannerService,
  ) {}

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

    return this.dynamicQueryExecutor.query({
      tenantId,
      formId: view.formId,
      mainTable: bundle.mainTable,
      physicalTable: bundle.physicalTable,
      columns: view.columns,
      filters: view.filters,
      query: dto,
    });
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
    this.dynamicQueryPlanner.validateColumnsAndFilters({
      columns,
      filters,
      mainTable,
      physicalTable,
    });
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
