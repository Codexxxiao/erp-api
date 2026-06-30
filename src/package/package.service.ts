import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PackageAssetType,
  PackageStatus,
  PackageVersionStatus,
  Prisma,
} from '../generated/prisma/client';
import type { CurrentUser } from '../common/types/current-user';
import { PrismaService } from '../prisma/prisma.service';
import { AddPackageAssetDto } from './dto/add-package-asset.dto';
import { CreatePackageDto } from './dto/create-package.dto';
import { CreatePackageVersionDto } from './dto/create-package-version.dto';
import { QueryPackageDto } from './dto/query-package.dto';
import { UpdatePackageAssetDto } from './dto/update-package-asset.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

type ResolvedAsset = {
  sourceTenantId?: string | null;
  assetCode?: string | null;
  assetName?: string | null;
  snapshot?: Prisma.InputJsonValue;
  dependencies?: Prisma.InputJsonValue;
};

@Injectable()
export class PackageService {
  constructor(private readonly prisma: PrismaService) {}

  createPackage(user: CurrentUser, dto: CreatePackageDto) {
    return this.prisma.package.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        tags: this.toJson(dto.tags),
        config: this.toJson(dto.config),
        createdById: user.id,
        updatedById: user.id,
      },
    });
  }

  findPackages(query: QueryPackageDto) {
    return this.prisma.package.findMany({
      where: {
        status: query.status,
        ...(query.keyword
          ? {
              OR: [
                { code: { contains: query.keyword, mode: 'insensitive' } },
                { name: { contains: query.keyword, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { versions: true } },
      },
    });
  }

  async findPackage(id: string) {
    const item = await this.prisma.package.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNo: 'desc' },
          include: { _count: { select: { assets: true } } },
        },
      },
    });

    if (!item) throw new NotFoundException('套餐不存在');
    return item;
  }

  async updatePackage(user: CurrentUser, id: string, dto: UpdatePackageDto) {
    await this.ensurePackage(id);

    return this.prisma.package.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        category: dto.category,
        status: dto.status,
        tags: this.toJson(dto.tags),
        config: this.toJson(dto.config),
        updatedById: user.id,
      },
    });
  }

  async createVersion(
    user: CurrentUser,
    packageId: string,
    dto: CreatePackageVersionDto,
  ) {
    const pkg = await this.ensurePackage(packageId);

    if (pkg.status === PackageStatus.DISABLED) {
      throw new BadRequestException('套餐已禁用，不能新增版本');
    }

    const versionNo = dto.versionNo ?? (await this.nextVersionNo(packageId));

    const exists = await this.prisma.packageVersion.findUnique({
      where: { packageId_versionNo: { packageId, versionNo } },
    });

    if (exists) throw new BadRequestException('套餐版本号已存在');

    return this.prisma.packageVersion.create({
      data: {
        packageId,
        versionNo,
        name: dto.name,
        description: dto.description,
        changelog: dto.changelog,
        config: this.toJson(dto.config),
        createdById: user.id,
      },
      include: { assets: true },
    });
  }

  findVersions(packageId: string) {
    return this.prisma.packageVersion.findMany({
      where: { packageId },
      orderBy: { versionNo: 'desc' },
      include: { _count: { select: { assets: true } } },
    });
  }

  async findVersion(versionId: string) {
    const version = await this.prisma.packageVersion.findUnique({
      where: { id: versionId },
      include: {
        package: true,
        assets: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] },
      },
    });

    if (!version) throw new NotFoundException('套餐版本不存在');
    return version;
  }

  async publishVersion(user: CurrentUser, versionId: string) {
    const version = await this.prisma.packageVersion.findUnique({
      where: { id: versionId },
      include: { assets: true },
    });

    if (!version) throw new NotFoundException('套餐版本不存在');

    if (version.status === PackageVersionStatus.PUBLISHED) return version;

    if (version.status !== PackageVersionStatus.DRAFT) {
      throw new BadRequestException('只有草稿版本可以发布');
    }

    if (version.assets.length === 0) {
      throw new BadRequestException('套餐版本没有资产，不能发布');
    }

    return this.prisma.$transaction(async (tx) => {
      const published = await tx.packageVersion.update({
        where: { id: versionId },
        data: {
          status: PackageVersionStatus.PUBLISHED,
          publishedAt: new Date(),
          publishedById: user.id,
        },
        include: { assets: true },
      });

      await tx.package.update({
        where: { id: version.packageId },
        data: {
          status: PackageStatus.ACTIVE,
          updatedById: user.id,
        },
      });

      return published;
    });
  }

  async addAsset(versionId: string, dto: AddPackageAssetDto) {
    await this.ensureDraftVersion(versionId);

    const resolved = await this.resolveAsset(dto);

    return this.prisma.packageAsset.create({
      data: {
        packageVersionId: versionId,
        type: dto.type,
        assetId: dto.assetId,
        sourceTenantId: resolved.sourceTenantId,
        assetCode: resolved.assetCode,
        assetName: resolved.assetName,
        assetSnapshot:
          dto.includeSnapshot === false ? undefined : resolved.snapshot,
        dependencies: resolved.dependencies,
        config: this.toJson(dto.config),
        sort: dto.sort ?? 0,
      },
    });
  }

  findAssets(versionId: string) {
    return this.prisma.packageAsset.findMany({
      where: { packageVersionId: versionId },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async updateAsset(assetId: string, dto: UpdatePackageAssetDto) {
    const asset = await this.prisma.packageAsset.findUnique({
      where: { id: assetId },
      include: { packageVersion: true },
    });

    if (!asset) throw new NotFoundException('套餐资产不存在');
    this.assertDraft(asset.packageVersion.status);

    return this.prisma.packageAsset.update({
      where: { id: assetId },
      data: {
        sort: dto.sort,
        config: this.toJson(dto.config),
      },
    });
  }

  async removeAsset(assetId: string) {
    const asset = await this.prisma.packageAsset.findUnique({
      where: { id: assetId },
      include: { packageVersion: true },
    });

    if (!asset) throw new NotFoundException('套餐资产不存在');
    this.assertDraft(asset.packageVersion.status);

    return this.prisma.packageAsset.delete({ where: { id: assetId } });
  }

  private async ensurePackage(id: string) {
    const item = await this.prisma.package.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('套餐不存在');
    return item;
  }

  private async ensureDraftVersion(versionId: string) {
    const version = await this.prisma.packageVersion.findUnique({
      where: { id: versionId },
    });

    if (!version) throw new NotFoundException('套餐版本不存在');
    this.assertDraft(version.status);
    return version;
  }

  private assertDraft(status: PackageVersionStatus) {
    if (status !== PackageVersionStatus.DRAFT) {
      throw new BadRequestException('只有草稿版本可以维护资产');
    }
  }

  private async nextVersionNo(packageId: string) {
    const latest = await this.prisma.packageVersion.findFirst({
      where: { packageId },
      orderBy: { versionNo: 'desc' },
    });

    return (latest?.versionNo ?? 0) + 1;
  }

  private async resolveAsset(dto: AddPackageAssetDto): Promise<ResolvedAsset> {
    switch (dto.type) {
      case PackageAssetType.PERMISSION:
        return this.resolvePermission(dto.assetId);
      case PackageAssetType.MENU:
        return this.resolveMenu(dto.assetId, dto.sourceTenantId);
      case PackageAssetType.DICTIONARY:
        return this.resolveDictionary(dto.assetId, dto.sourceTenantId);
      case PackageAssetType.DATA_SOURCE:
        return this.resolveDataSource(dto.assetId, dto.sourceTenantId);
      case PackageAssetType.FORM:
        return this.resolveForm(dto.assetId, dto.sourceTenantId);
      case PackageAssetType.FORM_VERSION:
        return this.resolveFormVersion(dto.assetId, dto.sourceTenantId);
      case PackageAssetType.LIST_VIEW:
        return this.resolveListView(dto.assetId, dto.sourceTenantId);
      case PackageAssetType.DOCUMENT_FLOW:
        return this.resolveDocumentFlow(dto.assetId, dto.sourceTenantId);
      case PackageAssetType.WORKFLOW:
        return this.resolveWorkflow(dto.assetId, dto.sourceTenantId);
      case PackageAssetType.MESSAGE_TEMPLATE:
        return this.resolveMessageTemplate(dto.assetId, dto.sourceTenantId);
      default:
        throw new BadRequestException('不支持的套餐资产类型');
    }
  }

  private async resolvePermission(id: string): Promise<ResolvedAsset> {
    const item = await this.prisma.permission.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('权限不存在');

    return {
      assetCode: item.code,
      assetName: item.name,
      snapshot: this.toJson(item),
    };
  }

  private async resolveMenu(id: string, sourceTenantId?: string) {
    this.requireSourceTenant(sourceTenantId, PackageAssetType.MENU);

    const item = await this.prisma.menu.findFirst({
      where: { id, tenantId: sourceTenantId },
    });

    if (!item) throw new NotFoundException('菜单不存在');

    return {
      sourceTenantId,
      assetCode: item.name,
      assetName: item.title,
      snapshot: this.toJson(item),
      dependencies: this.toJson({ permissionCode: item.permissionCode }),
    };
  }

  private async resolveDictionary(id: string, sourceTenantId?: string) {
    const item = await this.prisma.dictionary.findFirst({
      where: { id, tenantId: sourceTenantId ?? null },
      include: { items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
    });

    if (!item) throw new NotFoundException('字典不存在');

    return {
      sourceTenantId: item.tenantId,
      assetCode: item.code,
      assetName: item.name,
      snapshot: this.toJson(item),
    };
  }

  private async resolveDataSource(id: string, sourceTenantId?: string) {
    const item = await this.prisma.dataSource.findFirst({
      where: { id, tenantId: sourceTenantId ?? null },
      include: { fields: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
    });

    if (!item) throw new NotFoundException('数据源不存在');

    return {
      sourceTenantId: item.tenantId,
      assetCode: item.code,
      assetName: item.name,
      snapshot: this.toJson(item),
    };
  }

  private async resolveForm(id: string, sourceTenantId?: string) {
    const item = await this.prisma.formDefinition.findFirst({
      where: { id, tenantId: sourceTenantId ?? null },
      include: {
        tables: {
          orderBy: { sort: 'asc' },
          include: { fields: { orderBy: { sort: 'asc' } } },
        },
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
    });

    if (!item) throw new NotFoundException('表单不存在');

    return {
      sourceTenantId: item.tenantId,
      assetCode: item.code,
      assetName: item.name,
      snapshot: this.toJson(item),
    };
  }

  private async resolveFormVersion(id: string, sourceTenantId?: string) {
    this.requireSourceTenant(sourceTenantId, PackageAssetType.FORM_VERSION);

    const item = await this.prisma.formVersion.findFirst({
      where: { id, tenantId: sourceTenantId },
      include: { form: true },
    });

    if (!item) throw new NotFoundException('表单版本不存在');

    return {
      sourceTenantId,
      assetCode: `${item.formCode}@${item.version}`,
      assetName: `${item.form.name} v${item.version}`,
      snapshot: this.toJson(item),
      dependencies: this.toJson({
        formId: item.formId,
        formCode: item.formCode,
      }),
    };
  }

  private async resolveListView(id: string, sourceTenantId?: string) {
    this.requireSourceTenant(sourceTenantId, PackageAssetType.LIST_VIEW);

    const item = await this.prisma.listView.findFirst({
      where: { id, tenantId: sourceTenantId },
      include: {
        columns: { orderBy: { sort: 'asc' } },
        filters: { orderBy: { sort: 'asc' } },
      },
    });

    if (!item) throw new NotFoundException('列表视图不存在');

    return {
      sourceTenantId,
      assetCode: item.code,
      assetName: item.name,
      snapshot: this.toJson(item),
      dependencies: this.toJson({
        formId: item.formId,
        formVersionId: item.formVersionId,
      }),
    };
  }

  private async resolveDocumentFlow(id: string, sourceTenantId?: string) {
    this.requireSourceTenant(sourceTenantId, PackageAssetType.DOCUMENT_FLOW);

    const item = await this.prisma.documentFlow.findFirst({
      where: { id, tenantId: sourceTenantId },
      include: { mappings: { orderBy: { createdAt: 'asc' } } },
    });

    if (!item) throw new NotFoundException('单据流转不存在');

    return {
      sourceTenantId,
      assetCode: item.code,
      assetName: item.name,
      snapshot: this.toJson(item),
      dependencies: this.toJson({
        sourceFormId: item.sourceFormId,
        targetFormId: item.targetFormId,
      }),
    };
  }

  private async resolveWorkflow(id: string, sourceTenantId?: string) {
    this.requireSourceTenant(sourceTenantId, PackageAssetType.WORKFLOW);

    const item = await this.prisma.workflowDefinition.findFirst({
      where: { id, tenantId: sourceTenantId },
      include: {
        nodes: { orderBy: { sort: 'asc' } },
        transitions: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!item) throw new NotFoundException('工作流定义不存在');

    return {
      sourceTenantId,
      assetCode: item.code,
      assetName: item.name,
      snapshot: this.toJson(item),
      dependencies: this.toJson({
        formId: item.formId,
        formVersionId: item.formVersionId,
      }),
    };
  }

  private async resolveMessageTemplate(id: string, sourceTenantId?: string) {
    const item = await this.prisma.messageTemplate.findFirst({
      where: { id, tenantId: sourceTenantId ?? null },
    });

    if (!item) throw new NotFoundException('消息模板不存在');

    return {
      sourceTenantId: item.tenantId,
      assetCode: item.code,
      assetName: item.name,
      snapshot: this.toJson(item),
    };
  }

  private requireSourceTenant(
    sourceTenantId: string | undefined,
    type: PackageAssetType,
  ) {
    if (!sourceTenantId) {
      throw new BadRequestException(`${type} 类型资产必须指定 sourceTenantId`);
    }
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
