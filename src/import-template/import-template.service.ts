import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FormStatus,
  FormVersionStatus,
  Prisma,
} from '../generated/prisma/client';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { CreateImportTemplateDto } from './dto/create-import-template.dto';
import { QueryImportTemplateDto } from './dto/query-import-template.dto';
import { UpdateImportTemplateDto } from './dto/update-import-template.dto';
import { ImportTemplateMappingDto } from './dto/import-template-mapping.dto';

@Injectable()
export class ImportTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: CurrentUser, dto: CreateImportTemplateDto) {
    const tenantId = requireTenantId(user);
    const form = await this.ensureForm(tenantId, dto.formId, dto.formCode);

    await this.validateMapping(tenantId, form.id, dto.mapping);

    if (dto.isDefault) {
      await this.clearDefault(tenantId, form.code);
    }

    return this.prisma.importTemplate.create({
      data: {
        tenantId,
        formId: form.id,
        formCode: form.code,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        mapping: this.toJson(dto.mapping)!,
        config: this.toJson(dto.config),
        isDefault: dto.isDefault ?? false,
        isActive: dto.isActive ?? true,
        createdById: user.id,
      },
    });
  }

  findMany(user: CurrentUser, query: QueryImportTemplateDto) {
    const tenantId = requireTenantId(user);

    return this.prisma.importTemplate.findMany({
      where: {
        tenantId,
        formCode: query.formCode,
        isActive: query.isActive,
        isDefault: query.isDefault,
      },
      orderBy: [
        { formCode: 'asc' },
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async findOne(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const item = await this.prisma.importTemplate.findFirst({
      where: { id, tenantId },
    });

    if (!item) throw new NotFoundException('导入模板不存在');
    return item;
  }

  async update(user: CurrentUser, id: string, dto: UpdateImportTemplateDto) {
    const tenantId = requireTenantId(user);
    const template = await this.findOne(user, id);

    if (dto.mapping) {
      await this.validateMapping(tenantId, template.formId, dto.mapping);
    }

    if (dto.isDefault) {
      await this.clearDefault(tenantId, template.formCode, id);
    }

    return this.prisma.importTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        mapping: dto.mapping ? this.toJson(dto.mapping) : undefined,
        config: dto.config ? this.toJson(dto.config) : undefined,
        isDefault: dto.isDefault,
        isActive: dto.isActive,
        updatedById: user.id,
      },
    });
  }

  async remove(user: CurrentUser, id: string) {
    await this.findOne(user, id);

    return this.prisma.importTemplate.update({
      where: { id },
      data: {
        isActive: false,
        isDefault: false,
        updatedById: user.id,
      },
    });
  }

  async setDefault(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    const template = await this.findOne(user, id);

    if (!template.isActive) {
      throw new BadRequestException('已停用模板不能设为默认');
    }

    await this.clearDefault(tenantId, template.formCode, id);

    return this.prisma.importTemplate.update({
      where: { id },
      data: {
        isDefault: true,
        updatedById: user.id,
      },
    });
  }

  async findDefault(tenantId: string, formCode: string) {
    return this.prisma.importTemplate.findFirst({
      where: {
        tenantId,
        formCode,
        isActive: true,
        isDefault: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async ensureUsableTemplate(
    tenantId: string,
    templateId: string,
    formCode: string,
  ) {
    const template = await this.prisma.importTemplate.findFirst({
      where: {
        id: templateId,
        tenantId,
        isActive: true,
      },
    });

    if (!template) throw new NotFoundException('导入模板不存在或已停用');

    if (template.formCode !== formCode) {
      throw new BadRequestException('导入模板与目标表单不匹配');
    }

    return template;
  }

  private async validateMapping(
    tenantId: string,
    formId: string | null,
    mapping: ImportTemplateMappingDto[],
  ) {
    if (mapping.length === 0) {
      throw new BadRequestException('模板映射不能为空');
    }

    const fields = await this.loadMainFields(tenantId, formId);
    const fieldCodes = new Set(fields.map((field) => field.code));
    const usedFields = new Set<string>();

    for (const item of mapping) {
      if (!fieldCodes.has(item.fieldCode)) {
        throw new BadRequestException(`字段不存在：${item.fieldCode}`);
      }

      if (usedFields.has(item.fieldCode)) {
        throw new BadRequestException(`字段重复映射：${item.fieldCode}`);
      }

      if (!item.header && (!item.aliases || item.aliases.length === 0)) {
        throw new BadRequestException(
          `字段 ${item.fieldCode} 必须配置 header 或 aliases`,
        );
      }

      usedFields.add(item.fieldCode);
    }
  }

  private async loadMainFields(tenantId: string, formId: string | null) {
    const version = await this.prisma.formVersion.findFirst({
      where: {
        tenantId,
        formId: formId ?? undefined,
        status: FormVersionStatus.PUBLISHED,
      },
      orderBy: { version: 'desc' },
    });

    if (!version) throw new BadRequestException('表单尚未发布');

    const snapshot = version.snapshot as any;
    const mainTable = snapshot.tables?.find(
      (table: any) => table.type === 'MAIN',
    );

    if (!mainTable) throw new BadRequestException('表单未配置主表');

    return (mainTable.fields ?? []) as Array<{ code: string; name: string }>;
  }

  private async ensureForm(
    tenantId: string,
    formId?: string,
    formCode?: string,
  ) {
    const form = await this.prisma.formDefinition.findFirst({
      where: {
        tenantId,
        status: FormStatus.ENABLED,
        ...(formId ? { id: formId } : { code: formCode }),
      },
    });

    if (!form) throw new NotFoundException('启用表单不存在');
    return form;
  }

  private async clearDefault(
    tenantId: string,
    formCode: string,
    excludeId?: string,
  ) {
    await this.prisma.importTemplate.updateMany({
      where: {
        tenantId,
        formCode,
        isDefault: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: { isDefault: false },
    });
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
