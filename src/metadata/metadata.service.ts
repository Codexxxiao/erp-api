import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FormFieldType,
  FormStatus,
  FormTableType,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { CreateFormDto } from './dto/create-form.dto';
import { UpdateFormDto } from './dto/update-form.dto';
import { CreateFormTableDto } from './dto/create-form-table.dto';
import { UpdateFormTableDto } from './dto/update-form-table.dto';
import { CreateFormFieldDto } from './dto/create-form-field.dto';
import { UpdateFormFieldDto } from './dto/update-form-field.dto';

@Injectable()
export class MetadataService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly includeFull = {
    tables: {
      orderBy: [{ sort: 'asc' as const }, { createdAt: 'asc' as const }],
      include: {
        fields: {
          orderBy: [{ sort: 'asc' as const }, { createdAt: 'asc' as const }],
        },
        children: true,
      },
    },
  };

  async createSystemForm(dto: CreateFormDto) {
    return this.prisma.formDefinition.create({
      data: {
        tenantId: null,
        scopeKey: 'system',
        code: dto.code,
        name: dto.name,
        description: dto.description,
        layout: dto.layout as Prisma.InputJsonValue,
        config: dto.config as Prisma.InputJsonValue,
        sort: dto.sort ?? 0,
      },
      include: this.includeFull,
    });
  }

  async createTenantForm(user: CurrentUser, dto: CreateFormDto) {
    const tenantId = requireTenantId(user);

    return this.prisma.formDefinition.create({
      data: {
        tenantId,
        scopeKey: `tenant:${tenantId}`,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        layout: dto.layout as Prisma.InputJsonValue,
        config: dto.config as Prisma.InputJsonValue,
        sort: dto.sort ?? 0,
      },
      include: this.includeFull,
    });
  }

  async findSystemForms() {
    return this.prisma.formDefinition.findMany({
      where: { scopeKey: 'system' },
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
      include: this.includeFull,
    });
  }

  async findTenantForms(user: CurrentUser) {
    const tenantId = requireTenantId(user);

    return this.prisma.formDefinition.findMany({
      where: { tenantId },
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
      include: this.includeFull,
    });
  }

  async findAvailableForms(user: CurrentUser) {
    const tenantId = requireTenantId(user);

    return this.prisma.formDefinition.findMany({
      where: {
        OR: [{ scopeKey: 'system', status: FormStatus.ENABLED }, { tenantId }],
      },
      orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
      include: this.includeFull,
    });
  }

  async findOneForTenant(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const form = await this.prisma.formDefinition.findFirst({
      where: {
        id,
        OR: [{ scopeKey: 'system', status: FormStatus.ENABLED }, { tenantId }],
      },
      include: this.includeFull,
    });

    if (!form) throw new NotFoundException('表单不存在');
    return form;
  }

  async updateForm(id: string, dto: UpdateFormDto, user?: CurrentUser) {
    const form = await this.prisma.formDefinition.findUnique({ where: { id } });
    if (!form) throw new NotFoundException('表单不存在');

    if (
      user &&
      !user.isPlatformAdmin &&
      form.tenantId !== requireTenantId(user)
    ) {
      throw new ForbiddenException('不能修改其他租户的表单');
    }

    return this.prisma.formDefinition.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        layout: dto.layout as Prisma.InputJsonValue,
        config: dto.config as Prisma.InputJsonValue,
        sort: dto.sort,
        version: { increment: 1 },
      },
      include: this.includeFull,
    });
  }

  async enableForm(id: string, user?: CurrentUser) {
    const form = await this.prisma.formDefinition.findUnique({
      where: { id },
      include: { tables: true },
    });

    if (!form) throw new NotFoundException('表单不存在');

    if (
      user &&
      !user.isPlatformAdmin &&
      form.tenantId !== requireTenantId(user)
    ) {
      throw new ForbiddenException('不能启用其他租户的表单');
    }

    const hasMainTable = form.tables.some(
      (table) => table.type === FormTableType.MAIN,
    );
    if (!hasMainTable) throw new BadRequestException('启用表单前必须配置主表');

    return this.prisma.formDefinition.update({
      where: { id },
      data: {
        status: FormStatus.ENABLED,
        version: { increment: 1 },
      },
      include: this.includeFull,
    });
  }

  async disableForm(id: string, user?: CurrentUser) {
    const form = await this.prisma.formDefinition.findUnique({ where: { id } });
    if (!form) throw new NotFoundException('表单不存在');

    if (
      user &&
      !user.isPlatformAdmin &&
      form.tenantId !== requireTenantId(user)
    ) {
      throw new ForbiddenException('不能停用其他租户的表单');
    }

    return this.prisma.formDefinition.update({
      where: { id },
      data: {
        status: FormStatus.DISABLED,
        version: { increment: 1 },
      },
      include: this.includeFull,
    });
  }

  async createTable(
    formId: string,
    dto: CreateFormTableDto,
    user?: CurrentUser,
  ) {
    const form = await this.assertCanOperateForm(formId, user);

    if (dto.type === FormTableType.MAIN) {
      const exists = await this.prisma.formTable.findFirst({
        where: { formId: form.id, type: FormTableType.MAIN },
      });
      if (exists) throw new BadRequestException('一个表单只能有一张主表');
    }

    if (dto.type === FormTableType.SUB && dto.parentId) {
      const parent = await this.prisma.formTable.findFirst({
        where: { id: dto.parentId, formId },
      });
      if (!parent) throw new BadRequestException('父表不存在');
    }

    return this.prisma.formTable.create({
      data: {
        formId,
        parentId: dto.type === FormTableType.MAIN ? null : dto.parentId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        layout: dto.layout as Prisma.InputJsonValue,
        config: dto.config as Prisma.InputJsonValue,
        sort: dto.sort ?? 0,
      },
      include: { fields: true, children: true },
    });
  }

  async updateTable(
    tableId: string,
    dto: UpdateFormTableDto,
    user?: CurrentUser,
  ) {
    const table = await this.prisma.formTable.findUnique({
      where: { id: tableId },
      include: { form: true },
    });
    if (!table) throw new NotFoundException('表不存在');

    await this.assertCanOperateForm(table.formId, user);

    return this.prisma.formTable.update({
      where: { id: tableId },
      data: {
        name: dto.name,
        layout: dto.layout as Prisma.InputJsonValue,
        config: dto.config as Prisma.InputJsonValue,
        sort: dto.sort,
      },
      include: { fields: true, children: true },
    });
  }

  async createField(
    tableId: string,
    dto: CreateFormFieldDto,
    user?: CurrentUser,
  ) {
    const table = await this.prisma.formTable.findUnique({
      where: { id: tableId },
      include: { form: true },
    });
    if (!table) throw new NotFoundException('表不存在');

    await this.assertCanOperateForm(table.formId, user);
    this.validateFieldConfig(dto.type, dto);

    return this.prisma.formField.create({
      data: {
        tableId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        required: dto.required ?? false,
        unique: dto.unique ?? false,
        readonly: dto.readonly ?? false,
        hidden: dto.hidden ?? false,
        defaultValue: dto.defaultValue as Prisma.InputJsonValue,
        dictionaryCode: dto.dictionaryCode,
        dataSourceCode: dto.dataSourceCode,
        dataSourceMapping: dto.dataSourceMapping as Prisma.InputJsonValue,
        formula: dto.formula as Prisma.InputJsonValue,
        validationRules: dto.validationRules as Prisma.InputJsonValue,
        visibleWhen: dto.visibleWhen as Prisma.InputJsonValue,
        config: dto.config as Prisma.InputJsonValue,
        sort: dto.sort ?? 0,
      },
    });
  }

  async updateField(
    fieldId: string,
    dto: UpdateFormFieldDto,
    user?: CurrentUser,
  ) {
    const field = await this.prisma.formField.findUnique({
      where: { id: fieldId },
      include: { table: true },
    });
    if (!field) throw new NotFoundException('字段不存在');

    await this.assertCanOperateForm(field.table.formId, user);

    if (dto.type) this.validateFieldConfig(dto.type, dto);

    return this.prisma.formField.update({
      where: { id: fieldId },
      data: {
        name: dto.name,
        type: dto.type,
        required: dto.required,
        unique: dto.unique,
        readonly: dto.readonly,
        hidden: dto.hidden,
        defaultValue: dto.defaultValue as Prisma.InputJsonValue,
        dictionaryCode: dto.dictionaryCode,
        dataSourceCode: dto.dataSourceCode,
        dataSourceMapping: dto.dataSourceMapping as Prisma.InputJsonValue,
        formula: dto.formula as Prisma.InputJsonValue,
        validationRules: dto.validationRules as Prisma.InputJsonValue,
        visibleWhen: dto.visibleWhen as Prisma.InputJsonValue,
        config: dto.config as Prisma.InputJsonValue,
        sort: dto.sort,
      },
    });
  }

  private async assertCanOperateForm(formId: string, user?: CurrentUser) {
    const form = await this.prisma.formDefinition.findUnique({
      where: { id: formId },
    });
    if (!form) throw new NotFoundException('表单不存在');

    if (
      user &&
      !user.isPlatformAdmin &&
      form.tenantId !== requireTenantId(user)
    ) {
      throw new ForbiddenException('不能操作其他租户的表单');
    }

    return form;
  }

  private validateFieldConfig(
    type: FormFieldType,
    dto: Partial<CreateFormFieldDto>,
  ) {
    if (type === FormFieldType.DICTIONARY && !dto.dictionaryCode) {
      throw new BadRequestException('字典字段必须配置 dictionaryCode');
    }

    if (type === FormFieldType.DATASOURCE && !dto.dataSourceCode) {
      throw new BadRequestException('数据源字段必须配置 dataSourceCode');
    }
  }
}
