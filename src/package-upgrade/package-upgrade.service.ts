import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import {
  PackageAsset,
  PackageAssetType,
  PackageVersionStatus,
  Prisma,
  PackageInstallConflictPolicy,
  PackageUpgradeConflictPolicy,
  PackageUpgradeStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PreviewPackageUpgradeDto } from './dto/preview-package-upgrade.dto';
import type { CurrentUser } from '../common/types/current-user';
import { PackageInstallService } from '../package-install/package-install.service';
import { ExecutePackageUpgradeDto } from './dto/execute-package-upgrade.dto';
import { QueryPackageUpgradeDto } from './dto/query-package-upgrade.dto';

type PackageVersionWithAssets = Prisma.PackageVersionGetPayload<{
  include: {
    package: true;
    assets: true;
  };
}>;

type DiffAction = 'ADDED' | 'UPDATED' | 'REMOVED' | 'UNCHANGED' | 'CONFLICT';

@Injectable()
export class PackageUpgradeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly packageInstallService: PackageInstallService,
  ) {}

  findMany(query: QueryPackageUpgradeDto) {
    return this.prisma.packageUpgrade.findMany({
      where: {
        tenantId: query.tenantId,
        packageId: query.packageId,
        status: query.status,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const item = await this.prisma.packageUpgrade.findUnique({
      where: { id },
    });

    if (!item) throw new NotFoundException('套餐升级记录不存在');
    return item;
  }

  async execute(user: CurrentUser, dto: ExecutePackageUpgradeDto) {
    const conflictPolicy =
      dto.conflictPolicy ?? PackageUpgradeConflictPolicy.FAIL;

    const preview = await this.preview({
      tenantId: dto.tenantId,
      packageId: dto.packageId,
      targetVersionId: dto.targetVersionId,
    });

    const conflictCount = Number(preview.summary.conflicts ?? 0);

    const upgrade = await this.prisma.packageUpgrade.create({
      data: {
        tenantId: dto.tenantId,
        packageId: dto.packageId,
        fromVersionId: preview.currentVersion.id,
        fromVersionNo: preview.currentVersion.versionNo,
        toVersionId: preview.targetVersion.id,
        toVersionNo: preview.targetVersion.versionNo,
        status: PackageUpgradeStatus.UPGRADING,
        conflictPolicy,
        preview: this.toJson(preview),
        upgradedById: user.id,
      },
    });

    try {
      if (
        conflictCount > 0 &&
        conflictPolicy === PackageUpgradeConflictPolicy.FAIL
      ) {
        return this.failUpgrade(
          upgrade.id,
          `存在 ${conflictCount} 个冲突资产，请先处理冲突或选择 OVERWRITE`,
        );
      }

      const install = await this.packageInstallService.install(user, {
        tenantId: dto.tenantId,
        packageVersionId: preview.targetVersion.id,
        conflictPolicy: PackageInstallConflictPolicy.OVERWRITE,
      });

      const summary = {
        preview: preview.summary,
        removedAssetPolicy: 'KEEP',
        install: {
          id: install.id,
          status: install.status,
          summary: install.summary,
        },
      };

      const success = await this.prisma.packageUpgrade.update({
        where: { id: upgrade.id },
        data: {
          status: PackageUpgradeStatus.SUCCESS,
          installId: install.id,
          summary: this.toJson(summary),
          finishedAt: new Date(),
        },
      });

      return {
        ...success,
        install,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '套餐升级失败';

      await this.prisma.packageUpgrade.update({
        where: { id: upgrade.id },
        data: {
          status: PackageUpgradeStatus.FAILED,
          error: message,
          finishedAt: new Date(),
        },
      });

      throw error;
    }
  }

  private async failUpgrade(id: string, message: string) {
    const failed = await this.prisma.packageUpgrade.update({
      where: { id },
      data: {
        status: PackageUpgradeStatus.FAILED,
        error: message,
        finishedAt: new Date(),
      },
    });

    throw new BadRequestException(failed.error);
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  async findTenantPackages(tenantId: string) {
    await this.ensureTenant(tenantId);

    const rows = await this.prisma.packageTenantVersion.findMany({
      where: { tenantId },
      orderBy: { installedAt: 'desc' },
    });

    return Promise.all(
      rows.map(async (row) => {
        const latestVersion = await this.prisma.packageVersion.findFirst({
          where: {
            packageId: row.packageId,
            status: PackageVersionStatus.PUBLISHED,
          },
          orderBy: { versionNo: 'desc' },
          select: {
            id: true,
            versionNo: true,
            name: true,
            publishedAt: true,
          },
        });

        const upgradeAvailable =
          Boolean(latestVersion) &&
          latestVersion!.versionNo > row.currentVersionNo;

        return {
          ...row,
          latestVersion,
          upgradeAvailable,
          computedStatus: upgradeAvailable ? 'UPGRADE_AVAILABLE' : row.status,
        };
      }),
    );
  }

  async findAvailableVersions(tenantId: string, packageId: string) {
    const installed = await this.ensureInstalledPackage(tenantId, packageId);

    return this.prisma.packageVersion.findMany({
      where: {
        packageId,
        status: PackageVersionStatus.PUBLISHED,
        versionNo: { gt: installed.currentVersionNo },
      },
      orderBy: { versionNo: 'desc' },
      include: {
        package: true,
        _count: { select: { assets: true } },
      },
    });
  }

  async preview(dto: PreviewPackageUpgradeDto) {
    const installed = await this.ensureInstalledPackage(
      dto.tenantId,
      dto.packageId,
    );

    const currentVersion = await this.loadVersion(installed.currentVersionId);
    const targetVersion = await this.resolveTargetVersion(installed, dto);

    const installAssets = installed.lastInstallId
      ? await this.prisma.packageInstallAsset.findMany({
          where: { installId: installed.lastInstallId },
        })
      : [];

    const installedAssetMap = new Map(
      installAssets.map((asset) => [this.installAssetKey(asset), asset]),
    );

    const oldMap = new Map(
      currentVersion.assets.map((asset) => [
        this.packageAssetKey(asset),
        asset,
      ]),
    );

    const newMap = new Map(
      targetVersion.assets.map((asset) => [this.packageAssetKey(asset), asset]),
    );

    const keys = Array.from(new Set([...oldMap.keys(), ...newMap.keys()]));
    const items = [];

    for (const key of keys) {
      const oldAsset = oldMap.get(key);
      const newAsset = newMap.get(key);

      let baseAction: DiffAction;

      if (!oldAsset && newAsset) {
        baseAction = 'ADDED';
      } else if (oldAsset && !newAsset) {
        baseAction = 'REMOVED';
      } else if (
        oldAsset &&
        newAsset &&
        this.packageAssetHash(oldAsset) !== this.packageAssetHash(newAsset)
      ) {
        baseAction = 'UPDATED';
      } else {
        baseAction = 'UNCHANGED';
      }

      const conflict = await this.detectConflict(
        dto.tenantId,
        baseAction,
        oldAsset,
        newAsset,
        oldAsset ? installedAssetMap.get(this.packageAssetKey(oldAsset)) : null,
      );

      items.push({
        key,
        action: conflict.hasConflict ? 'CONFLICT' : baseAction,
        baseAction,
        type: newAsset?.type ?? oldAsset?.type,
        assetCode: newAsset?.assetCode ?? oldAsset?.assetCode,
        assetName: newAsset?.assetName ?? oldAsset?.assetName,
        oldPackageAssetId: oldAsset?.id,
        newPackageAssetId: newAsset?.id,
        targetAssetId: conflict.targetAssetId,
        hasConflict: conflict.hasConflict,
        conflictReason: conflict.reason,
      });
    }

    const summary = items.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.action.toLowerCase()] += 1;
        if (item.hasConflict) acc.conflicts += 1;
        return acc;
      },
      {
        total: 0,
        added: 0,
        updated: 0,
        removed: 0,
        unchanged: 0,
        conflict: 0,
        conflicts: 0,
      } as Record<string, number>,
    );

    return {
      tenantPackage: installed,
      currentVersion: {
        id: currentVersion.id,
        versionNo: currentVersion.versionNo,
        name: currentVersion.name,
      },
      targetVersion: {
        id: targetVersion.id,
        versionNo: targetVersion.versionNo,
        name: targetVersion.name,
      },
      summary,
      executable: summary.conflicts === 0,
      items,
    };
  }

  private async detectConflict(
    tenantId: string,
    action: DiffAction,
    oldAsset?: PackageAsset,
    newAsset?: PackageAsset,
    installedAsset?: { targetAssetId: string | null } | null,
  ) {
    if (action === 'ADDED' && newAsset) {
      const existing = await this.findExistingTarget(tenantId, newAsset);

      return {
        hasConflict: Boolean(existing),
        targetAssetId: existing?.id,
        reason: existing
          ? '目标租户已存在同编码资产，但它不是当前套餐旧版本资产'
          : undefined,
      };
    }

    if (!oldAsset) {
      return {
        hasConflict: false,
        targetAssetId: undefined,
        reason: undefined,
      };
    }

    const targetAssetId =
      installedAsset?.targetAssetId ??
      (await this.findExistingTarget(tenantId, oldAsset))?.id;

    if (!targetAssetId) {
      return {
        hasConflict: true,
        targetAssetId: undefined,
        reason: '目标租户找不到旧版本已安装资产，可能被手动删除',
      };
    }

    const liveSnapshot = await this.loadLiveSnapshot(
      oldAsset.type,
      targetAssetId,
    );

    if (!liveSnapshot) {
      return {
        hasConflict: true,
        targetAssetId,
        reason: '目标资产不存在，可能被手动删除',
      };
    }

    const oldHash = this.snapshotHash(oldAsset.assetSnapshot);
    const liveHash = this.snapshotHash(liveSnapshot);

    return {
      hasConflict: oldHash !== liveHash,
      targetAssetId,
      reason:
        oldHash !== liveHash
          ? '目标资产已被租户侧修改，需要人工确认覆盖策略'
          : undefined,
    };
  }

  private async resolveTargetVersion(
    installed: { packageId: string; currentVersionNo: number },
    dto: PreviewPackageUpgradeDto,
  ): Promise<PackageVersionWithAssets> {
    const version = dto.targetVersionId
      ? await this.prisma.packageVersion.findUnique({
          where: { id: dto.targetVersionId },
          include: {
            package: true,
            assets: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] },
          },
        })
      : await this.prisma.packageVersion.findFirst({
          where: {
            packageId: installed.packageId,
            status: PackageVersionStatus.PUBLISHED,
            versionNo: { gt: installed.currentVersionNo },
          },
          orderBy: { versionNo: 'desc' },
          include: {
            package: true,
            assets: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] },
          },
        });

    if (!version) throw new BadRequestException('没有可升级的套餐版本');

    if (version.packageId !== installed.packageId) {
      throw new BadRequestException('目标版本不属于当前套餐');
    }

    if (version.status !== PackageVersionStatus.PUBLISHED) {
      throw new BadRequestException('目标版本未发布，不能升级');
    }

    if (version.versionNo <= installed.currentVersionNo) {
      throw new BadRequestException('目标版本必须高于当前版本');
    }

    return version;
  }

  private async loadVersion(id: string): Promise<PackageVersionWithAssets> {
    const version = await this.prisma.packageVersion.findUnique({
      where: { id },
      include: {
        package: true,
        assets: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] },
      },
    });

    if (!version) throw new NotFoundException('当前套餐版本不存在');
    return version;
  }

  private async ensureInstalledPackage(tenantId: string, packageId: string) {
    await this.ensureTenant(tenantId);

    const item = await this.prisma.packageTenantVersion.findUnique({
      where: {
        tenantId_packageId: {
          tenantId,
          packageId,
        },
      },
    });

    if (!item) throw new NotFoundException('租户尚未安装该套餐');
    return item;
  }

  private async ensureTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) throw new NotFoundException('租户不存在');
    return tenant;
  }

  private packageAssetKey(asset: PackageAsset) {
    return `${asset.type}:${asset.assetCode ?? asset.assetId}`;
  }

  private installAssetKey(asset: {
    type: PackageAssetType;
    assetCode: string | null;
    sourceAssetId: string;
  }) {
    return `${asset.type}:${asset.assetCode ?? asset.sourceAssetId}`;
  }

  private packageAssetHash(asset: PackageAsset) {
    return this.snapshotHash({
      type: asset.type,
      assetCode: asset.assetCode,
      assetName: asset.assetName,
      assetSnapshot: asset.assetSnapshot,
      dependencies: asset.dependencies,
      config: asset.config,
    });
  }

  private snapshotHash(value: unknown) {
    return createHash('sha256')
      .update(this.stableStringify(this.normalizeSnapshot(value)))
      .digest('hex');
  }

  private normalizeSnapshot(value: unknown): unknown {
    if (value === null || typeof value !== 'object') return value;

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeSnapshot(item));
    }

    const volatileKeys = new Set([
      'id',
      'tenantId',
      'scopeKey',
      'createdAt',
      'updatedAt',
      'createdById',
      'updatedById',
      'publishedAt',
      'publishedById',
      'packageVersionId',
      'sourceTenantId',
    ]);

    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(source)) {
      if (volatileKeys.has(key)) continue;
      if (key.endsWith('Id')) continue;
      result[key] = this.normalizeSnapshot(source[key]);
    }

    return result;
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }

    const obj = value as Record<string, unknown>;

    return `{${Object.keys(obj)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${this.stableStringify(obj[key])}`)
      .join(',')}}`;
  }

  private tenantScopeKey(tenantId: string) {
    return `tenant:${tenantId}`;
  }

  private async findExistingTarget(tenantId: string, asset: PackageAsset) {
    const code = asset.assetCode;
    const scopeKey = this.tenantScopeKey(tenantId);

    switch (asset.type) {
      case PackageAssetType.PERMISSION:
        return code
          ? this.prisma.permission.findUnique({
              where: { code },
              select: { id: true },
            })
          : null;

      case PackageAssetType.MENU:
        return code
          ? this.prisma.menu.findFirst({
              where: { tenantId, name: code },
              select: { id: true },
            })
          : null;

      case PackageAssetType.DICTIONARY:
        return code
          ? this.prisma.dictionary.findUnique({
              where: { scopeKey_code: { scopeKey, code } },
              select: { id: true },
            })
          : null;

      case PackageAssetType.DATA_SOURCE:
        return code
          ? this.prisma.dataSource.findUnique({
              where: { scopeKey_code: { scopeKey, code } },
              select: { id: true },
            })
          : null;

      case PackageAssetType.FORM:
        return code
          ? this.prisma.formDefinition.findUnique({
              where: { scopeKey_code: { scopeKey, code } },
              select: { id: true },
            })
          : null;

      case PackageAssetType.FORM_VERSION: {
        if (!asset.assetSnapshot) return null;
        const s = asset.assetSnapshot as any;

        return this.prisma.formVersion.findUnique({
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
          ? this.prisma.listView.findUnique({
              where: { tenantId_code: { tenantId, code } },
              select: { id: true },
            })
          : null;

      case PackageAssetType.DOCUMENT_FLOW:
        return code
          ? this.prisma.documentFlow.findUnique({
              where: { tenantId_code: { tenantId, code } },
              select: { id: true },
            })
          : null;

      case PackageAssetType.WORKFLOW:
        return code
          ? this.prisma.workflowDefinition.findUnique({
              where: { tenantId_code: { tenantId, code } },
              select: { id: true },
            })
          : null;

      case PackageAssetType.MESSAGE_TEMPLATE:
        return code
          ? this.prisma.messageTemplate.findUnique({
              where: { scopeKey_code: { scopeKey, code } },
              select: { id: true },
            })
          : null;

      default:
        return null;
    }
  }

  private loadLiveSnapshot(type: PackageAssetType, id: string) {
    switch (type) {
      case PackageAssetType.PERMISSION:
        return this.prisma.permission.findUnique({ where: { id } });

      case PackageAssetType.MENU:
        return this.prisma.menu.findUnique({ where: { id } });

      case PackageAssetType.DICTIONARY:
        return this.prisma.dictionary.findUnique({
          where: { id },
          include: {
            items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] },
          },
        });

      case PackageAssetType.DATA_SOURCE:
        return this.prisma.dataSource.findUnique({
          where: { id },
          include: {
            fields: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] },
          },
        });

      case PackageAssetType.FORM:
        return this.prisma.formDefinition.findUnique({
          where: { id },
          include: {
            tables: {
              orderBy: { sort: 'asc' },
              include: { fields: { orderBy: { sort: 'asc' } } },
            },
            versions: { orderBy: { version: 'desc' }, take: 1 },
          },
        });

      case PackageAssetType.FORM_VERSION:
        return this.prisma.formVersion.findUnique({
          where: { id },
          include: { form: true },
        });

      case PackageAssetType.LIST_VIEW:
        return this.prisma.listView.findUnique({
          where: { id },
          include: {
            columns: { orderBy: { sort: 'asc' } },
            filters: { orderBy: { sort: 'asc' } },
          },
        });

      case PackageAssetType.DOCUMENT_FLOW:
        return this.prisma.documentFlow.findUnique({
          where: { id },
          include: { mappings: { orderBy: { createdAt: 'asc' } } },
        });

      case PackageAssetType.WORKFLOW:
        return this.prisma.workflowDefinition.findUnique({
          where: { id },
          include: {
            nodes: { orderBy: { sort: 'asc' } },
            transitions: { orderBy: { createdAt: 'asc' } },
          },
        });

      case PackageAssetType.MESSAGE_TEMPLATE:
        return this.prisma.messageTemplate.findUnique({ where: { id } });

      default:
        return null;
    }
  }
}
