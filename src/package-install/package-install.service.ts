import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PackageAsset,
  PackageAssetType,
  PackageInstallAssetAction,
  PackageInstallAssetStatus,
  PackageInstallConflictPolicy,
  PackageInstallLogLevel,
  PackageInstallStatus,
  PackageVersionStatus,
  Prisma,
  WorkflowDefinitionStatus,
  PhysicalSchemaStatus,
  PackageTenantVersionStatus,
} from '../generated/prisma/client';
import type { CurrentUser } from '../common/types/current-user';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePackageInstallDto } from './dto/create-package-install.dto';
import { QueryPackageInstallDto } from './dto/query-package-install.dto';
import { FormSchemaProvisionService } from '../form-schema-provision/form-schema-provision.service';

type Tx = Prisma.TransactionClient;

type ProvisionTarget = {
  formId: string;
  formCode: string;
  version: number;
};

type ProvisionResultItem = ProvisionTarget & {
  status: 'SUCCESS' | 'FAILED';
  physicalTableCount?: number;
  error?: string;
};

type ValidationResultItem = ProvisionTarget & {
  status: 'SUCCESS';
  snapshotTableCount: number;
  physicalTableCount: number;
};

type SnapshotFieldForValidation = {
  id: string;
  code: string;
};

type SnapshotTableForValidation = {
  id: string;
  code: string;
  fields?: SnapshotFieldForValidation[];
};

type FormVersionSnapshotForValidation = {
  tables?: SnapshotTableForValidation[];
};

type InstallablePackageVersion = Prisma.PackageVersionGetPayload<{
  include: {
    package: true;
    assets: true;
  };
}>;

type InstallContext = {
  tenantId: string;
  userId: string;
  conflictPolicy: PackageInstallConflictPolicy;
  assetIdMap: Map<string, string>;
  formIdMap: Map<string, string>;
  formCodeMap: Map<string, string>;
  formVersionIdMap: Map<string, string>;
  tableIdMap: Map<string, string>;
  fieldIdMap: Map<string, string>;
  menuIdMap: Map<string, string>;
  provisionTargets: Map<string, ProvisionTarget>;
};

type ExistingTarget = { id: string } | null;

@Injectable()
export class PackageInstallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formSchemaProvisionService: FormSchemaProvisionService,
  ) {}

  private sortAssetsForInstall(assets: PackageAsset[]) {
    const order = new Map<PackageAssetType, number>([
      [PackageAssetType.PERMISSION, 10],
      [PackageAssetType.MENU, 20],
      [PackageAssetType.DICTIONARY, 30],
      [PackageAssetType.DATA_SOURCE, 40],
      [PackageAssetType.FORM, 50],
      [PackageAssetType.FORM_VERSION, 60],
      [PackageAssetType.LIST_VIEW, 70],
      [PackageAssetType.DOCUMENT_FLOW, 80],
      [PackageAssetType.WORKFLOW, 90],
      [PackageAssetType.MESSAGE_TEMPLATE, 100],
    ]);

    return [...assets].sort((a, b) => {
      const left = order.get(a.type) ?? 999;
      const right = order.get(b.type) ?? 999;
      if (left !== right) return left - right;
      return a.sort - b.sort;
    });
  }

  private async provisionInstalledForms(
    installId: string,
    user: CurrentUser,
    tenantId: string,
    targets: ProvisionTarget[],
  ) {
    const uniqueTargets = this.uniqueProvisionTargets(targets);

    if (uniqueTargets.length === 0) {
      await this.createInstallLog(
        installId,
        PackageInstallLogLevel.INFO,
        '本次安装没有需要生成实体表的表单版本',
      );

      return { total: 0, success: 0, failed: 0, items: [] };
    }

    const provisionUser: CurrentUser = {
      ...user,
      tenantId,
      tenantCode: user.tenantId === tenantId ? user.tenantCode : null,
      isTenantAdmin: true,
    };

    const items: ProvisionResultItem[] = [];

    for (const target of uniqueTargets) {
      try {
        await this.createInstallLog(
          installId,
          PackageInstallLogLevel.INFO,
          `开始生成实体表：${target.formCode}@${target.version}`,
          target,
        );

        const result = await this.formSchemaProvisionService.publishTenantForm(
          provisionUser,
          target.formId,
          target.version,
        );

        items.push({
          ...target,
          status: 'SUCCESS',
          physicalTableCount: result.physicalTables.length,
        });

        await this.createInstallLog(
          installId,
          PackageInstallLogLevel.INFO,
          `实体表生成成功：${target.formCode}@${target.version}`,
          {
            formId: target.formId,
            version: target.version,
            physicalTableCount: result.physicalTables.length,
          },
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '实体表生成失败';

        items.push({
          ...target,
          status: 'FAILED',
          error: message,
        });

        await this.createInstallLog(
          installId,
          PackageInstallLogLevel.ERROR,
          `实体表生成失败：${target.formCode}@${target.version}`,
          { ...target, error: message },
        );
      }
    }

    const failed = items.filter((item) => item.status === 'FAILED');

    if (failed.length > 0) {
      throw new BadRequestException(
        `实体表生成失败：${failed.map((item) => this.formatProvisionTarget(item)).join(', ')}`,
      );
    }

    return {
      total: items.length,
      success: items.length,
      failed: 0,
      items,
    };
  }

  private async validateProvisionTargets(
    installId: string,
    tenantId: string,
    targets: ProvisionTarget[],
  ) {
    const uniqueTargets = this.uniqueProvisionTargets(targets);
    const items: ValidationResultItem[] = [];

    for (const target of uniqueTargets) {
      const formVersion = await this.prisma.formVersion.findFirst({
        where: {
          tenantId,
          formId: target.formId,
          version: target.version,
        },
      });

      if (!formVersion) {
        throw new BadRequestException(
          `安装后校验失败，表单版本不存在：${target.formCode}@${target.version}`,
        );
      }

      const snapshot = formVersion.snapshot as FormVersionSnapshotForValidation;
      const snapshotTables = snapshot.tables ?? [];

      const physicalTables = await this.prisma.formPhysicalTable.findMany({
        where: {
          tenantId,
          formId: target.formId,
          formVersionId: formVersion.id,
          status: PhysicalSchemaStatus.SYNCED,
        },
        include: { columns: true },
      });

      for (const table of snapshotTables) {
        const physicalTable = physicalTables.find(
          (item) => item.tableId === table.id,
        );

        if (!physicalTable) {
          throw new BadRequestException(
            `安装后校验失败，物理表缺失：${target.formCode}.${table.code}`,
          );
        }

        for (const field of table.fields ?? []) {
          const physicalColumn = physicalTable.columns.find(
            (item) => item.fieldId === field.id,
          );

          if (!physicalColumn) {
            throw new BadRequestException(
              `安装后校验失败，物理列缺失：${target.formCode}.${table.code}.${field.code}`,
            );
          }
        }
      }

      items.push({
        ...target,
        status: 'SUCCESS',
        snapshotTableCount: snapshotTables.length,
        physicalTableCount: physicalTables.length,
      });
    }

    await this.createInstallLog(
      installId,
      PackageInstallLogLevel.INFO,
      '安装后实体表校验通过',
      { items },
    );

    return {
      total: items.length,
      success: items.length,
      failed: 0,
      items,
    };
  }

  private formatProvisionTarget(target: ProvisionTarget) {
    return `${target.formCode}@${target.version}`;
  }

  private uniqueProvisionTargets(targets: ProvisionTarget[]) {
    const map = new Map<string, ProvisionTarget>();

    for (const target of targets) {
      map.set(`${target.formId}:${target.version}`, target);
    }

    return Array.from(map.values());
  }

  private async createInstallLog(
    installId: string,
    level: PackageInstallLogLevel,
    message: string,
    detail?: unknown,
  ) {
    return this.prisma.packageInstallLog.create({
      data: {
        installId,
        level,
        message,
        detail: this.toJson(detail),
      },
    });
  }

  async preview(dto: CreatePackageInstallDto) {
    const tenant = await this.ensureTenant(dto.tenantId);
    const version = await this.loadPublishedVersion(dto.packageVersionId);
    const assets = await Promise.all(
      version.assets.map(async (asset) => {
        const existing = await this.findExistingTarget(
          this.prisma,
          dto.tenantId,
          asset,
        );
        return {
          packageAssetId: asset.id,
          type: asset.type,
          assetId: asset.assetId,
          assetCode: asset.assetCode,
          assetName: asset.assetName,
          exists: Boolean(existing),
          targetAssetId: existing?.id,
        };
      }),
    );

    return {
      tenant,
      packageVersion: {
        id: version.id,
        packageId: version.packageId,
        versionNo: version.versionNo,
        status: version.status,
      },
      assets,
      hasConflict: assets.some((item) => item.exists),
    };
  }

  private async resolveTargetFormId(
    tx: Tx,
    ctx: InstallContext,
    sourceFormId: string,
  ) {
    return (
      ctx.formIdMap.get(sourceFormId) ??
      ctx.assetIdMap.get(sourceFormId) ??
      (await this.findTargetFormIdBySource(tx, ctx.tenantId, sourceFormId))
    );
  }

  private async resolveTargetFormVersionId(
    tx: Tx,
    ctx: InstallContext,
    sourceFormVersionId: string,
  ) {
    const mapped = ctx.formVersionIdMap.get(sourceFormVersionId);
    if (mapped) return mapped;

    const source = await this.prisma.formVersion.findUnique({
      where: { id: sourceFormVersionId },
      select: { formCode: true, version: true },
    });

    if (!source) {
      throw new BadRequestException('来源表单版本不存在');
    }

    const target = await tx.formVersion.findUnique({
      where: {
        tenantId_formCode_version: {
          tenantId: ctx.tenantId,
          formCode: source.formCode,
          version: source.version,
        },
      },
      select: { id: true },
    });

    if (!target) {
      throw new BadRequestException(
        `目标租户表单版本不存在：${source.formCode}@${source.version}`,
      );
    }

    return target.id;
  }

  private workflowNeedsApproverRebind(nodes: any[]) {
    return nodes.some(
      (node) => Boolean(node.approverUserId) || Boolean(node.approverRoleId),
    );
  }

  private rewriteWorkflowNodeConfig(node: any) {
    const config =
      node.config && typeof node.config === 'object' ? { ...node.config } : {};

    if (node.approverUserId) {
      config.sourceApproverUserId = node.approverUserId;
      config.needRebindApprover = true;
    }

    if (node.approverRoleId) {
      config.sourceApproverRoleId = node.approverRoleId;
      config.needRebindApprover = true;
    }

    return config;
  }
  private async installDocumentFlow(
    tx: Tx,
    asset: PackageAsset,
    existing: ExistingTarget,
    ctx: InstallContext,
  ) {
    const s = this.snapshotOrThrow<any>(asset);

    const sourceFormId = await this.resolveTargetFormId(
      tx,
      ctx,
      s.sourceFormId,
    );
    const targetFormId = await this.resolveTargetFormId(
      tx,
      ctx,
      s.targetFormId,
    );

    const base = {
      tenantId: ctx.tenantId,
      code: s.code,
      name: s.name,
      direction: s.direction,
      sourceFormId,
      targetFormId,
      status: s.status,
      repeatPolicy: s.repeatPolicy,
      description: s.description,
      config: this.toJson(s.config),
    };

    const flow = existing
      ? await tx.documentFlow.update({
          where: { id: existing.id },
          data: base,
        })
      : await tx.documentFlow.create({ data: base });

    if (existing) {
      await tx.documentFlowMapping.deleteMany({
        where: { flowId: flow.id },
      });
    }

    if (s.mappings?.length) {
      await tx.documentFlowMapping.createMany({
        data: s.mappings.map((mapping: any) => ({
          flowId: flow.id,
          sourceTableCode: mapping.sourceTableCode,
          sourceFieldCode: mapping.sourceFieldCode,
          targetTableCode: mapping.targetTableCode,
          targetFieldCode: mapping.targetFieldCode,
          mappingType: mapping.mappingType,
          constantValue: this.toJson(mapping.constantValue),
          sort: mapping.sort,
        })),
      });
    }

    return flow.id;
  }

  private async installWorkflow(
    tx: Tx,
    asset: PackageAsset,
    existing: ExistingTarget,
    ctx: InstallContext,
  ) {
    const s = this.snapshotOrThrow<any>(asset);

    const formId = await this.resolveTargetFormId(tx, ctx, s.formId);
    const formVersionId = s.formVersionId
      ? await this.resolveTargetFormVersionId(tx, ctx, s.formVersionId)
      : null;

    if (existing) {
      const instanceCount = await tx.workflowInstance.count({
        where: { definitionId: existing.id },
      });

      if (instanceCount > 0) {
        throw new BadRequestException(
          `工作流已有流程实例，不能覆盖：${s.code}`,
        );
      }
    }

    const needRebindApprover = this.workflowNeedsApproverRebind(s.nodes ?? []);

    const base = {
      tenantId: ctx.tenantId,
      code: s.code,
      name: s.name,
      formId,
      formVersionId,
      status: needRebindApprover ? WorkflowDefinitionStatus.DRAFT : s.status,
      description: s.description,
      config: this.toJson(s.config),
    };

    const definition = existing
      ? await tx.workflowDefinition.update({
          where: { id: existing.id },
          data: base,
        })
      : await tx.workflowDefinition.create({ data: base });

    if (existing) {
      await tx.workflowTransition.deleteMany({
        where: { definitionId: definition.id },
      });
      await tx.workflowNode.deleteMany({
        where: { definitionId: definition.id },
      });
    }

    const nodeIdMap = new Map<string, string>();

    for (const node of s.nodes ?? []) {
      const created = await tx.workflowNode.create({
        data: {
          definitionId: definition.id,
          code: node.code,
          name: node.name,
          type: node.type,
          approverType: node.approverType,
          approverUserId: null,
          approverRoleId: null,
          approveMode: node.approveMode,
          sort: node.sort,
          config: this.toJson(this.rewriteWorkflowNodeConfig(node)),
        },
      });

      nodeIdMap.set(node.id, created.id);
      nodeIdMap.set(node.code, created.id);
    }

    for (const transition of s.transitions ?? []) {
      const sourceNodeId =
        nodeIdMap.get(transition.sourceNodeId) ??
        nodeIdMap.get(transition.sourceNodeCode);

      const targetNodeId =
        nodeIdMap.get(transition.targetNodeId) ??
        nodeIdMap.get(transition.targetNodeCode);

      if (!sourceNodeId || !targetNodeId) {
        throw new BadRequestException(
          `工作流连线节点不存在：${s.code}（${transition.sourceNodeCode ?? transition.sourceNodeId} → ${transition.targetNodeCode ?? transition.targetNodeId}）`,
        );
      }

      await tx.workflowTransition.create({
        data: {
          definitionId: definition.id,
          sourceNodeId,
          targetNodeId,
          condition: this.toJson(transition.condition),
          sort: transition.sort,
        },
      });
    }

    return definition.id;
  }

  async install(user: CurrentUser, dto: CreatePackageInstallDto) {
    const conflictPolicy =
      dto.conflictPolicy ?? PackageInstallConflictPolicy.FAIL;

    await this.ensureTenant(dto.tenantId);
    const version = await this.loadPublishedVersion(dto.packageVersionId);
    const sortedAssets = this.sortAssetsForInstall(version.assets);

    const conflicts = await this.preview(dto);
    if (
      conflictPolicy === PackageInstallConflictPolicy.FAIL &&
      conflicts.hasConflict
    ) {
      throw new BadRequestException(
        '目标租户存在冲突资产，请选择 SKIP 或 OVERWRITE',
      );
    }

    const install = await this.prisma.packageInstall.create({
      data: {
        tenantId: dto.tenantId,
        packageVersionId: dto.packageVersionId,
        conflictPolicy,
        installedById: user.id,
      },
    });

    try {
      const copyResult = await this.prisma.$transaction(async (tx) => {
        const ctx: InstallContext = {
          tenantId: dto.tenantId,
          userId: user.id,
          conflictPolicy,
          assetIdMap: new Map(),
          formIdMap: new Map(),
          formCodeMap: new Map(),
          formVersionIdMap: new Map(),
          tableIdMap: new Map(),
          fieldIdMap: new Map(),
          menuIdMap: new Map(),
          provisionTargets: new Map(),
        };

        await this.addLog(
          tx,
          install.id,
          PackageInstallLogLevel.INFO,
          '开始安装套餐配置资产',
        );

        for (const asset of sortedAssets) {
          await this.installAsset(tx, install.id, asset, ctx);
        }

        const assetSummary = await this.buildSummary(tx, install.id);
        const provisionTargets = Array.from(ctx.provisionTargets.values());

        await this.addLog(
          tx,
          install.id,
          PackageInstallLogLevel.INFO,
          '套餐配置资产安装完成，准备生成实体表',
          { assetSummary, provisionTargets },
        );

        return { assetSummary, provisionTargets };
      });

      const provisionSummary = await this.provisionInstalledForms(
        install.id,
        user,
        dto.tenantId,
        copyResult.provisionTargets,
      );

      const validationSummary = await this.validateProvisionTargets(
        install.id,
        dto.tenantId,
        copyResult.provisionTargets,
      );

      const summary = {
        assets: copyResult.assetSummary,
        provision: provisionSummary,
        validation: validationSummary,
      };

      await this.createInstallLog(
        install.id,
        PackageInstallLogLevel.INFO,
        '套餐安装完成',
        summary,
      );

      return this.prisma.$transaction(async (tx) => {
        await this.upsertTenantPackageVersion(
          tx,
          dto.tenantId,
          version,
          install.id,
          user.id,
        );

        return tx.packageInstall.update({
          where: { id: install.id },
          data: {
            status: PackageInstallStatus.SUCCESS,
            finishedAt: new Date(),
            summary: this.toJson(summary),
          },
          include: {
            assets: { orderBy: { createdAt: 'asc' } },
            logs: { orderBy: { createdAt: 'asc' } },
          },
        });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '套餐安装失败';

      await this.prisma.packageInstall.update({
        where: { id: install.id },
        data: {
          status: PackageInstallStatus.FAILED,
          finishedAt: new Date(),
          error: message,
        },
      });

      await this.createInstallLog(
        install.id,
        PackageInstallLogLevel.ERROR,
        message,
        error instanceof Error
          ? { name: error.name, message: error.message }
          : undefined,
      );

      throw error;
    }
  }

  findMany(query: QueryPackageInstallDto) {
    return this.prisma.packageInstall.findMany({
      where: {
        tenantId: query.tenantId,
        packageVersionId: query.packageVersionId,
        status: query.status,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { assets: true, logs: true } },
      },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.packageInstall.findUnique({
      where: { id },
      include: {
        assets: { orderBy: { createdAt: 'asc' } },
        logs: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!item) throw new NotFoundException('套餐安装记录不存在');
    return item;
  }

  private async installAsset(
    tx: Tx,
    installId: string,
    asset: PackageAsset,
    ctx: InstallContext,
  ) {
    const existing = await this.findExistingTarget(tx, ctx.tenantId, asset);

    if (existing && ctx.conflictPolicy === PackageInstallConflictPolicy.SKIP) {
      this.rememberExisting(asset, existing.id, ctx);

      await this.recordAsset(tx, installId, asset, {
        targetAssetId: existing.id,
        status: PackageInstallAssetStatus.SKIPPED,
        action: PackageInstallAssetAction.SKIPPED,
      });

      return;
    }

    if (existing && ctx.conflictPolicy === PackageInstallConflictPolicy.FAIL) {
      throw new BadRequestException(
        `资产已存在：${asset.type} ${asset.assetCode ?? asset.assetId}`,
      );
    }

    let targetId: string;

    switch (asset.type) {
      case PackageAssetType.PERMISSION:
        targetId = await this.installPermission(tx, asset, existing);
        break;
      case PackageAssetType.MENU:
        targetId = await this.installMenu(tx, asset, existing, ctx);
        break;
      case PackageAssetType.DICTIONARY:
        targetId = await this.installDictionary(tx, asset, existing, ctx);
        break;
      case PackageAssetType.DATA_SOURCE:
        targetId = await this.installDataSource(tx, asset, existing, ctx);
        break;
      case PackageAssetType.FORM:
        targetId = await this.installForm(tx, asset, existing, ctx);
        break;
      case PackageAssetType.FORM_VERSION:
        targetId = await this.installFormVersion(tx, asset, existing, ctx);
        break;
      case PackageAssetType.LIST_VIEW:
        targetId = await this.installListView(tx, asset, existing, ctx);
        break;
      case PackageAssetType.MESSAGE_TEMPLATE:
        targetId = await this.installMessageTemplate(tx, asset, existing, ctx);
        break;
      case PackageAssetType.DOCUMENT_FLOW:
        targetId = await this.installDocumentFlow(tx, asset, existing, ctx);
        break;

      case PackageAssetType.WORKFLOW:
        targetId = await this.installWorkflow(tx, asset, existing, ctx);
        break;
      default:
        throw new BadRequestException('暂不支持安装资产类型');
    }

    ctx.assetIdMap.set(asset.assetId, targetId);

    await this.recordAsset(tx, installId, asset, {
      targetAssetId: targetId,
      status: PackageInstallAssetStatus.SUCCESS,
      action: existing
        ? PackageInstallAssetAction.UPDATED
        : PackageInstallAssetAction.CREATED,
    });
  }

  private async installPermission(
    tx: Tx,
    asset: PackageAsset,
    existing: ExistingTarget,
  ) {
    const s = this.snapshotOrThrow<any>(asset);

    if (existing) {
      const updated = await tx.permission.update({
        where: { id: existing.id },
        data: {
          name: s.name,
          module: s.module,
          type: s.type,
          description: s.description,
        },
      });
      return updated.id;
    }

    const created = await tx.permission.create({
      data: {
        code: s.code,
        name: s.name,
        module: s.module,
        type: s.type,
        description: s.description,
      },
    });

    return created.id;
  }

  private async installMenu(
    tx: Tx,
    asset: PackageAsset,
    existing: ExistingTarget,
    ctx: InstallContext,
  ) {
    const s = this.snapshotOrThrow<any>(asset);
    const parentId = s.parentId ? ctx.menuIdMap.get(s.parentId) : undefined;

    if (existing) {
      const updated = await tx.menu.update({
        where: { id: existing.id },
        data: {
          parentId,
          type: s.type,
          title: s.title,
          path: s.path,
          component: s.component,
          redirect: s.redirect,
          icon: s.icon,
          sort: s.sort,
          permissionCode: s.permissionCode,
          isVisible: s.isVisible,
          isEnabled: s.isEnabled,
          meta: this.toJson(s.meta),
        },
      });

      ctx.menuIdMap.set(s.id, updated.id);
      return updated.id;
    }

    const created = await tx.menu.create({
      data: {
        tenantId: ctx.tenantId,
        parentId,
        type: s.type,
        title: s.title,
        name: s.name,
        path: s.path,
        component: s.component,
        redirect: s.redirect,
        icon: s.icon,
        sort: s.sort,
        permissionCode: s.permissionCode,
        isVisible: s.isVisible,
        isEnabled: s.isEnabled,
        meta: this.toJson(s.meta),
      },
    });

    ctx.menuIdMap.set(s.id, created.id);
    return created.id;
  }

  private async installDictionary(
    tx: Tx,
    asset: PackageAsset,
    existing: ExistingTarget,
    ctx: InstallContext,
  ) {
    const s = this.snapshotOrThrow<any>(asset);
    const scopeKey = this.tenantScopeKey(ctx.tenantId);

    const base = {
      tenantId: ctx.tenantId,
      scopeKey,
      code: s.code,
      name: s.name,
      description: s.description,
      sort: s.sort,
      isActive: s.isActive,
    };

    const dictionary = existing
      ? await tx.dictionary.update({
          where: { id: existing.id },
          data: base,
        })
      : await tx.dictionary.create({ data: base });

    await tx.dictionaryItem.deleteMany({
      where: { dictionaryId: dictionary.id },
    });
    await this.createDictionaryItems(tx, dictionary.id, s.items ?? []);

    return dictionary.id;
  }

  private async installDataSource(
    tx: Tx,
    asset: PackageAsset,
    existing: ExistingTarget,
    ctx: InstallContext,
  ) {
    const s = this.snapshotOrThrow<any>(asset);
    const scopeKey = this.tenantScopeKey(ctx.tenantId);

    const base = {
      tenantId: ctx.tenantId,
      scopeKey,
      code: s.code,
      name: s.name,
      type: s.type,
      description: s.description,
      config: this.toJson(s.config ?? {})!,
      sort: s.sort,
      isActive: s.isActive,
    };

    const dataSource = existing
      ? await tx.dataSource.update({ where: { id: existing.id }, data: base })
      : await tx.dataSource.create({ data: base });

    await tx.dataSourceField.deleteMany({
      where: { dataSourceId: dataSource.id },
    });

    if (s.fields?.length) {
      await tx.dataSourceField.createMany({
        data: s.fields.map((field: any) => ({
          dataSourceId: dataSource.id,
          key: field.key,
          label: field.label,
          path: field.path,
          type: field.type,
          isValue: field.isValue,
          isLabel: field.isLabel,
          isExtra: field.isExtra,
          sort: field.sort,
        })),
      });
    }

    return dataSource.id;
  }

  private async installForm(
    tx: Tx,
    asset: PackageAsset,
    existing: ExistingTarget,
    ctx: InstallContext,
  ) {
    const s = this.snapshotOrThrow<any>(asset);
    const scopeKey = this.tenantScopeKey(ctx.tenantId);

    const base = {
      tenantId: ctx.tenantId,
      scopeKey,
      code: s.code,
      name: s.name,
      description: s.description,
      status: s.status,
      version: s.version,
      layout: this.toJson(s.layout),
      config: this.toJson(s.config),
      sort: s.sort,
    };

    const form = existing
      ? await tx.formDefinition.update({
          where: { id: existing.id },
          data: base,
        })
      : await tx.formDefinition.create({ data: base });

    if (existing) {
      await tx.formTable.deleteMany({ where: { formId: form.id } });
    }

    ctx.formIdMap.set(s.id, form.id);
    ctx.formCodeMap.set(s.code, form.id);

    await this.createFormTables(tx, form.id, s.tables ?? [], null, ctx);

    return form.id;
  }

  private async installFormVersion(
    tx: Tx,
    asset: PackageAsset,
    existing: ExistingTarget,
    ctx: InstallContext,
  ) {
    const s = this.snapshotOrThrow<any>(asset);
    const formId =
      ctx.formCodeMap.get(s.formCode) ??
      (await this.findTargetFormId(tx, ctx.tenantId, s.formCode));
    const snapshot = this.rewriteFormSnapshot(s.snapshot, ctx, formId);

    const data = {
      tenantId: ctx.tenantId,
      formId,
      formCode: s.formCode,
      version: s.version,
      status: s.status,
      snapshot: this.toJson(snapshot)!,
      publishedById: ctx.userId,
      publishedAt: new Date(),
    };

    const formVersion = existing
      ? await tx.formVersion.update({ where: { id: existing.id }, data })
      : await tx.formVersion.create({ data });

    ctx.formVersionIdMap.set(s.id, formVersion.id);

    ctx.provisionTargets.set(`${formId}:${s.version}`, {
      formId,
      formCode: s.formCode,
      version: s.version,
    });

    return formVersion.id;
  }

  private async installListView(
    tx: Tx,
    asset: PackageAsset,
    existing: ExistingTarget,
    ctx: InstallContext,
  ) {
    const s = this.snapshotOrThrow<any>(asset);
    const formId = await this.resolveTargetFormId(tx, ctx, s.formId);
    const formVersionId = s.formVersionId
      ? await this.resolveTargetFormVersionId(tx, ctx, s.formVersionId)
      : undefined;

    const base = {
      tenantId: ctx.tenantId,
      formId,
      formVersionId,
      code: s.code,
      name: s.name,
      status: s.status,
      isDefault: s.isDefault,
      config: this.toJson(s.config),
      sort: s.sort,
    };

    const listView = existing
      ? await tx.listView.update({ where: { id: existing.id }, data: base })
      : await tx.listView.create({ data: base });

    await tx.listViewColumn.deleteMany({ where: { viewId: listView.id } });
    await tx.listViewFilter.deleteMany({ where: { viewId: listView.id } });

    if (s.columns?.length) {
      await tx.listViewColumn.createMany({
        data: s.columns.map((column: any) => ({
          viewId: listView.id,
          source: column.source,
          systemKey: column.systemKey,
          fieldId: column.fieldId
            ? this.resolveMappedFieldId(
                ctx,
                column.fieldId,
                `列表列 ${column.fieldCode ?? column.title ?? ''}`,
              )
            : null,
          fieldCode: column.fieldCode,
          title: column.title,
          width: column.width,
          fixed: column.fixed,
          hidden: column.hidden,
          sortable: column.sortable,
          sortDirection: column.sortDirection,
          config: this.toJson(column.config),
          sort: column.sort,
        })),
      });
    }

    if (s.filters?.length) {
      await tx.listViewFilter.createMany({
        data: s.filters.map((filter: any) => ({
          viewId: listView.id,
          source: filter.source,
          systemKey: filter.systemKey,
          fieldId: filter.fieldId
            ? this.resolveMappedFieldId(
                ctx,
                filter.fieldId,
                `列表筛选 ${filter.fieldCode ?? filter.label ?? ''}`,
              )
            : null,
          fieldCode: filter.fieldCode,
          label: filter.label,
          operator: filter.operator,
          defaultValue: this.toJson(filter.defaultValue),
          required: filter.required,
          config: this.toJson(filter.config),
          sort: filter.sort,
        })),
      });
    }

    return listView.id;
  }

  private async installMessageTemplate(
    tx: Tx,
    asset: PackageAsset,
    existing: ExistingTarget,
    ctx: InstallContext,
  ) {
    const s = this.snapshotOrThrow<any>(asset);
    const scopeKey = this.tenantScopeKey(ctx.tenantId);

    const base = {
      tenantId: ctx.tenantId,
      scopeKey,
      code: s.code,
      name: s.name,
      type: s.type,
      level: s.level,
      titleTemplate: s.titleTemplate,
      contentTemplate: s.contentTemplate,
      config: this.toJson(s.config),
      isActive: s.isActive,
    };

    const item = existing
      ? await tx.messageTemplate.update({
          where: { id: existing.id },
          data: base,
        })
      : await tx.messageTemplate.create({ data: base });

    return item.id;
  }

  private async findExistingTarget(
    client: Tx | PrismaService,
    tenantId: string,
    asset: PackageAsset,
  ): Promise<ExistingTarget> {
    const code = asset.assetCode;
    const scopeKey = this.tenantScopeKey(tenantId);

    switch (asset.type) {
      case PackageAssetType.PERMISSION:
        return code
          ? client.permission.findUnique({
              where: { code },
              select: { id: true },
            })
          : null;
      case PackageAssetType.MENU:
        return code
          ? client.menu.findFirst({
              where: { tenantId, name: code },
              select: { id: true },
            })
          : null;
      case PackageAssetType.DICTIONARY:
        return code
          ? client.dictionary.findUnique({
              where: { scopeKey_code: { scopeKey, code } },
              select: { id: true },
            })
          : null;
      case PackageAssetType.DATA_SOURCE:
        return code
          ? client.dataSource.findUnique({
              where: { scopeKey_code: { scopeKey, code } },
              select: { id: true },
            })
          : null;
      case PackageAssetType.FORM:
        return code
          ? client.formDefinition.findUnique({
              where: { scopeKey_code: { scopeKey, code } },
              select: { id: true },
            })
          : null;
      case PackageAssetType.FORM_VERSION: {
        const s = this.snapshotOrThrow<any>(asset);
        return client.formVersion.findUnique({
          where: {
            tenantId_formCode_version: {
              tenantId,
              formCode: s.formCode,
              version: s.version,
            },
          },
          select: { id: true },
        });
      }
      case PackageAssetType.LIST_VIEW:
        return code
          ? client.listView.findUnique({
              where: { tenantId_code: { tenantId, code } },
              select: { id: true },
            })
          : null;
      case PackageAssetType.MESSAGE_TEMPLATE:
        return code
          ? client.messageTemplate.findUnique({
              where: { scopeKey_code: { scopeKey, code } },
              select: { id: true },
            })
          : null;
      case PackageAssetType.DOCUMENT_FLOW:
        return code
          ? client.documentFlow.findUnique({
              where: { tenantId_code: { tenantId, code } },
              select: { id: true },
            })
          : null;

      case PackageAssetType.WORKFLOW:
        return code
          ? client.workflowDefinition.findUnique({
              where: { tenantId_code: { tenantId, code } },
              select: { id: true },
            })
          : null;
      default:
        return null;
    }
  }

  private async createDictionaryItems(
    tx: Tx,
    dictionaryId: string,
    items: any[],
    oldParentId: string | null = null,
    newParentId: string | null = null,
  ) {
    const children = items
      .filter((item) => (item.parentId ?? null) === oldParentId)
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

    for (const item of children) {
      const created = await tx.dictionaryItem.create({
        data: {
          dictionaryId,
          parentId: newParentId,
          value: item.value,
          label: item.label,
          color: item.color,
          sort: item.sort,
          isActive: item.isActive,
          extra: this.toJson(item.extra),
        },
      });

      await this.createDictionaryItems(
        tx,
        dictionaryId,
        items,
        item.id,
        created.id,
      );
    }
  }

  private async createFormTables(
    tx: Tx,
    formId: string,
    tables: any[],
    oldParentId: string | null,
    ctx: InstallContext,
  ) {
    const children = tables
      .filter((table) => (table.parentId ?? null) === oldParentId)
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

    for (const table of children) {
      const parentId = table.parentId
        ? ctx.tableIdMap.get(table.parentId)
        : undefined;

      const createdTable = await tx.formTable.create({
        data: {
          formId,
          parentId,
          code: table.code,
          name: table.name,
          type: table.type,
          layout: this.toJson(table.layout),
          config: this.toJson(table.config),
          sort: table.sort,
        },
      });

      ctx.tableIdMap.set(table.id, createdTable.id);

      for (const field of table.fields ?? []) {
        const createdField = await tx.formField.create({
          data: {
            tableId: createdTable.id,
            code: field.code,
            name: field.name,
            type: field.type,
            required: field.required,
            unique: field.unique,
            readonly: field.readonly,
            hidden: field.hidden,
            defaultValue: this.toJson(field.defaultValue),
            dictionaryCode: field.dictionaryCode,
            dataSourceCode: field.dataSourceCode,
            dataSourceMapping: this.toJson(field.dataSourceMapping),
            formula: this.toJson(field.formula),
            validationRules: this.toJson(field.validationRules),
            visibleWhen: this.toJson(field.visibleWhen),
            config: this.toJson(field.config),
            sort: field.sort,
          },
        });

        ctx.fieldIdMap.set(field.id, createdField.id);
      }

      await this.createFormTables(tx, formId, tables, table.id, ctx);
    }
  }

  private rewriteFormSnapshot(
    snapshot: any,
    ctx: InstallContext,
    formId: string,
  ) {
    const cloned = JSON.parse(JSON.stringify(snapshot ?? {}));

    if (cloned.form) {
      cloned.form.id = formId;
      cloned.form.tenantId = ctx.tenantId;
    }

    if (Array.isArray(cloned.tables)) {
      cloned.tables = cloned.tables.map((table: any) => ({
        ...table,
        id: ctx.tableIdMap.get(table.id) ?? table.id,
        parentId: table.parentId
          ? (ctx.tableIdMap.get(table.parentId) ?? table.parentId)
          : null,
        fields: (table.fields ?? []).map((field: any) => ({
          ...field,
          id: ctx.fieldIdMap.get(field.id) ?? field.id,
        })),
      }));
    }

    return cloned;
  }

  private rememberExisting(
    asset: PackageAsset,
    targetId: string,
    ctx: InstallContext,
  ) {
    ctx.assetIdMap.set(asset.assetId, targetId);

    if (asset.type === PackageAssetType.FORM) {
      ctx.formIdMap.set(asset.assetId, targetId);
      if (asset.assetCode) ctx.formCodeMap.set(asset.assetCode, targetId);
    }

    if (asset.type === PackageAssetType.FORM_VERSION) {
      ctx.formVersionIdMap.set(asset.assetId, targetId);
    }

    if (asset.type === PackageAssetType.MENU) {
      ctx.menuIdMap.set(asset.assetId, targetId);
    }
  }

  private async recordAsset(
    tx: Tx,
    installId: string,
    asset: PackageAsset,
    data: {
      targetAssetId?: string;
      status: PackageInstallAssetStatus;
      action: PackageInstallAssetAction;
      error?: string;
    },
  ) {
    return tx.packageInstallAsset.create({
      data: {
        installId,
        packageAssetId: asset.id,
        type: asset.type,
        sourceAssetId: asset.assetId,
        targetAssetId: data.targetAssetId,
        assetCode: asset.assetCode,
        status: data.status,
        action: data.action,
        error: data.error,
      },
    });
  }

  private async addLog(
    tx: Tx,
    installId: string,
    level: PackageInstallLogLevel,
    message: string,
    detail?: unknown,
  ) {
    return tx.packageInstallLog.create({
      data: {
        installId,
        level,
        message,
        detail: this.toJson(detail),
      },
    });
  }

  private async buildSummary(tx: Tx, installId: string) {
    const rows = await tx.packageInstallAsset.groupBy({
      by: ['status'],
      where: { installId },
      _count: { status: true },
    });

    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count.status;
      return acc;
    }, {});
  }

  private async upsertTenantPackageVersion(
    tx: Tx,
    tenantId: string,
    version: InstallablePackageVersion,
    installId: string,
    userId: string,
  ) {
    return tx.packageTenantVersion.upsert({
      where: {
        tenantId_packageId: {
          tenantId,
          packageId: version.packageId,
        },
      },
      update: {
        packageCode: version.package.code,
        packageName: version.package.name,
        currentVersionId: version.id,
        currentVersionNo: version.versionNo,
        lastInstallId: installId,
        status: PackageTenantVersionStatus.INSTALLED,
        installedById: userId,
        installedAt: new Date(),
      },
      create: {
        tenantId,
        packageId: version.packageId,
        packageCode: version.package.code,
        packageName: version.package.name,
        currentVersionId: version.id,
        currentVersionNo: version.versionNo,
        lastInstallId: installId,
        status: PackageTenantVersionStatus.INSTALLED,
        installedById: userId,
      },
    });
  }

  private async ensureTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('租户不存在');
    return tenant;
  }

  private async loadPublishedVersion(
    packageVersionId: string,
  ): Promise<InstallablePackageVersion> {
    const version = await this.prisma.packageVersion.findUnique({
      where: { id: packageVersionId },
      include: {
        package: true,
        assets: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] },
      },
    });

    if (!version) throw new NotFoundException('套餐版本不存在');

    if (version.status !== PackageVersionStatus.PUBLISHED) {
      throw new BadRequestException('只能安装已发布的套餐版本');
    }

    if (version.assets.length === 0) {
      throw new BadRequestException('套餐版本没有资产');
    }

    return version;
  }

  private async findTargetFormId(tx: Tx, tenantId: string, formCode: string) {
    const form = await tx.formDefinition.findUnique({
      where: {
        scopeKey_code: {
          scopeKey: this.tenantScopeKey(tenantId),
          code: formCode,
        },
      },
      select: { id: true },
    });

    if (!form) throw new BadRequestException(`目标租户表单不存在：${formCode}`);
    return form.id;
  }

  private async findTargetFormIdBySource(
    tx: Tx,
    tenantId: string,
    sourceFormId: string,
  ) {
    const source = await this.prisma.formDefinition.findUnique({
      where: { id: sourceFormId },
      select: { code: true },
    });

    if (!source) throw new BadRequestException('来源表单不存在');

    return this.findTargetFormId(tx, tenantId, source.code);
  }

  private snapshotOrThrow<T>(asset: PackageAsset): T {
    if (!asset.assetSnapshot) {
      throw new BadRequestException(
        `套餐资产缺少快照：${asset.type} ${asset.assetCode ?? asset.assetId}`,
      );
    }

    return asset.assetSnapshot as T;
  }

  private resolveMappedFieldId(
    ctx: InstallContext,
    sourceFieldId: string,
    context: string,
  ): string {
    const mapped = ctx.fieldIdMap.get(sourceFieldId);
    if (!mapped) {
      throw new BadRequestException(
        `字段映射失败（${context}）：${sourceFieldId}`,
      );
    }
    return mapped;
  }

  private tenantScopeKey(tenantId: string) {
    return `tenant:${tenantId}`;
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
