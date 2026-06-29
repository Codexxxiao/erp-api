import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FormStatus, FormTableType, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import type { FormSnapshot } from './form-snapshot.types';

type SnapshotForm = Prisma.FormDefinitionGetPayload<{
  include: {
    tables: {
      include: {
        fields: true;
      };
    };
  };
}>;

@Injectable()
export class FormSnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  async publish(user: CurrentUser, formId: string) {
    const tenantId = requireTenantId(user);

    const form = await this.prisma.formDefinition.findFirst({
      where: { id: formId, tenantId },
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

    if (!form) throw new NotFoundException('表单不存在');
    this.validateBeforePublish(form);

    return this.prisma.$transaction(async (tx) => {
      const latest = await tx.formVersion.findFirst({
        where: { formId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const nextVersion = Math.max(latest?.version ?? 0, form.version ?? 0) + 1;
      const publishedAt = new Date();

      const snapshot = this.buildSnapshot(form, {
        version: nextVersion,
        publishedAt,
        publishedById: user.id,
      });

      const formVersion = await tx.formVersion.create({
        data: {
          tenantId,
          formId: form.id,
          formCode: form.code,
          version: nextVersion,
          snapshot: this.toJson(snapshot),
          publishedById: user.id,
          publishedAt,
        },
      });

      await tx.formDefinition.update({
        where: { id: form.id },
        data: {
          status: FormStatus.ENABLED,
          version: nextVersion,
        },
      });

      return formVersion;
    });
  }

  async findVersions(user: CurrentUser, formId: string) {
    const tenantId = requireTenantId(user);
    await this.assertTenantForm(tenantId, formId);

    return this.prisma.formVersion.findMany({
      where: { tenantId, formId },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        formId: true,
        formCode: true,
        version: true,
        status: true,
        publishedById: true,
        publishedAt: true,
        createdAt: true,
      },
    });
  }

  async findLatest(user: CurrentUser, formId: string) {
    const tenantId = requireTenantId(user);
    const version = await this.prisma.formVersion.findFirst({
      where: { tenantId, formId },
      orderBy: { version: 'desc' },
    });

    if (!version) throw new NotFoundException('表单暂无发布版本');
    return version;
  }

  async findOne(user: CurrentUser, formId: string, version: number) {
    const tenantId = requireTenantId(user);

    const formVersion = await this.prisma.formVersion.findFirst({
      where: { tenantId, formId, version },
    });

    if (!formVersion) throw new NotFoundException('表单版本不存在');
    return formVersion;
  }

  private validateBeforePublish(form: SnapshotForm) {
    const mainTables = form.tables.filter(
      (table) => table.type === FormTableType.MAIN,
    );
    if (mainTables.length !== 1) {
      throw new BadRequestException('发布表单必须且只能有一张主表');
    }

    for (const table of form.tables) {
      if (table.fields.length === 0) {
        throw new BadRequestException(`表 ${table.name} 至少需要配置一个字段`);
      }
    }
  }

  private buildSnapshot(
    form: SnapshotForm,
    params: { version: number; publishedAt: Date; publishedById: string },
  ): FormSnapshot {
    if (!form.tenantId)
      throw new BadRequestException('系统模板不能直接发布为租户快照');

    return {
      schemaVersion: 1,
      form: {
        id: form.id,
        tenantId: form.tenantId,
        code: form.code,
        name: form.name,
        description: form.description,
        status: FormStatus.ENABLED,
        version: params.version,
        layout: form.layout,
        config: form.config,
      },
      tables: form.tables.map((table) => ({
        id: table.id,
        parentId: table.parentId,
        code: table.code,
        name: table.name,
        type: table.type,
        layout: table.layout,
        config: table.config,
        sort: table.sort,
        fields: table.fields.map((field) => ({
          id: field.id,
          code: field.code,
          name: field.name,
          type: field.type,
          required: field.required,
          unique: field.unique,
          readonly: field.readonly,
          hidden: field.hidden,
          defaultValue: field.defaultValue,
          dictionaryCode: field.dictionaryCode,
          dataSourceCode: field.dataSourceCode,
          dataSourceMapping: field.dataSourceMapping,
          formula: field.formula,
          validationRules: field.validationRules,
          visibleWhen: field.visibleWhen,
          config: field.config,
          sort: field.sort,
        })),
      })),
      publishedAt: params.publishedAt.toISOString(),
      publishedById: params.publishedById,
    };
  }

  private async assertTenantForm(tenantId: string, formId: string) {
    const form = await this.prisma.formDefinition.findFirst({
      where: { id: formId, tenantId },
    });

    if (!form) throw new NotFoundException('表单不存在');
    return form;
  }

  private toJson(value: unknown) {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
