import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ProductStatus,
  ProductSupplierQuoteStatus,
  Prisma,
} from '../generated/prisma/client';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../file/file.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { CreateProductSupplierQuoteDto } from './dto/create-product-supplier-quote.dto';
import { UpdateProductSupplierQuoteDto } from './dto/update-product-supplier-quote.dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  async create(user: CurrentUser, dto: CreateProductDto) {
    const tenantId = requireTenantId(user);

    await this.assertUniqueCode(tenantId, dto.code);
    if (dto.sku) await this.assertUniqueSku(tenantId, dto.sku);

    const product = await this.prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          tenantId,
          code: dto.code,
          sku: dto.sku,
          nameCn: dto.nameCn,
          nameEn: dto.nameEn,
          categoryCode: dto.categoryCode,
          unitCode: dto.unitCode,
          currencyCode: dto.currencyCode,
          costPrice: dto.costPrice,
          salePrice: dto.salePrice,
          defaultSupplierCustomerId: dto.defaultSupplierCustomerId,
          mainImageFileId: dto.mainImageFileId,
          status: dto.status ?? ProductStatus.ACTIVE,
          description: dto.description,
          remark: dto.remark,
          extra: this.toJson(dto.extra),
          createdById: user.id,
        },
      });

      for (const quote of dto.supplierQuotes ?? []) {
        await this.createSupplierQuoteTx(
          tx,
          tenantId,
          created.id,
          user.id,
          quote,
        );
      }

      return created;
    });

    await this.syncFiles(user, product.id, {
      mainImageFileId: dto.mainImageFileId,
      imageFileIds: dto.imageFileIds,
      attachmentFileIds: dto.attachmentFileIds,
    });

    return this.findOne(user, product.id);
  }

  async findMany(user: CurrentUser, query: QueryProductDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ProductWhereInput = {
      tenantId,
      status: query.status,
      categoryCode: query.categoryCode,
      unitCode: query.unitCode,
      currencyCode: query.currencyCode,
      defaultSupplierCustomerId: query.defaultSupplierCustomerId,
      ...(query.keyword
        ? {
            OR: [
              { code: { contains: query.keyword, mode: 'insensitive' } },
              { sku: { contains: query.keyword, mode: 'insensitive' } },
              { nameCn: { contains: query.keyword, mode: 'insensitive' } },
              { nameEn: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          supplierQuotes: {
            where: { isDefault: true },
            take: 1,
            include: {
              supplier: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  shortName: true,
                  type: true,
                  status: true,
                  countryRegion: true,
                  settlementCurrency: true,
                  paymentTerm: true,
                },
              },
            },
          },
          _count: {
            select: { supplierQuotes: true },
          },
        },
      }),
    ]);

    return { total, page, pageSize, list };
  }

  async findOne(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      include: {
        supplierQuotes: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
          include: {
            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
                shortName: true,
                type: true,
                status: true,
                countryRegion: true,
                settlementCurrency: true,
                paymentTerm: true,
                tradeTerm: true,
                phone: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!product) throw new NotFoundException('产品不存在');

    const files = await this.fileService.findRelations(user, {
      ownerType: 'product',
      ownerId: product.id,
    });

    return { ...product, files };
  }

  async update(user: CurrentUser, id: string, dto: UpdateProductDto) {
    const tenantId = requireTenantId(user);
    await this.ensureProduct(tenantId, id);

    if (dto.code) await this.assertUniqueCode(tenantId, dto.code, id);
    if (dto.sku) await this.assertUniqueSku(tenantId, dto.sku, id);

    await this.prisma.product.update({
      where: { id },
      data: {
        code: dto.code,
        sku: dto.sku,
        nameCn: dto.nameCn,
        nameEn: dto.nameEn,
        categoryCode: dto.categoryCode,
        unitCode: dto.unitCode,
        currencyCode: dto.currencyCode,
        costPrice: dto.costPrice,
        salePrice: dto.salePrice,
        defaultSupplierCustomerId: dto.defaultSupplierCustomerId,
        mainImageFileId: dto.mainImageFileId,
        status: dto.status,
        description: dto.description,
        remark: dto.remark,
        extra: dto.extra ? this.toJson(dto.extra) : undefined,
        updatedById: user.id,
      },
    });

    await this.syncFiles(user, id, {
      mainImageFileId: dto.mainImageFileId,
      imageFileIds: dto.imageFileIds,
      attachmentFileIds: dto.attachmentFileIds,
    });

    return this.findOne(user, id);
  }

  async remove(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    await this.ensureProduct(tenantId, id);

    return this.prisma.product.update({
      where: { id },
      data: {
        status: ProductStatus.INACTIVE,
        updatedById: user.id,
      },
    });
  }

  async createSupplierQuote(
    user: CurrentUser,
    productId: string,
    dto: CreateProductSupplierQuoteDto,
  ) {
    const tenantId = requireTenantId(user);
    await this.ensureProduct(tenantId, productId);

    return this.prisma.$transaction((tx) =>
      this.createSupplierQuoteTx(tx, tenantId, productId, user.id, dto),
    );
  }

  async updateSupplierQuote(
    user: CurrentUser,
    productId: string,
    quoteId: string,
    dto: UpdateProductSupplierQuoteDto,
  ) {
    const tenantId = requireTenantId(user);
    await this.ensureProduct(tenantId, productId);

    return this.prisma.$transaction(async (tx) => {
      const quote = await tx.productSupplierQuote.findFirst({
        where: { id: quoteId, tenantId, productId },
      });

      if (!quote) throw new NotFoundException('供应商报价不存在');

      const supplierPatch =
        dto.supplierId !== undefined || dto.supplierName !== undefined
          ? await this.resolveQuoteSupplierTx(
              tx,
              tenantId,
              dto.supplierId,
              dto.supplierName,
            )
          : undefined;

      if (dto.isDefault) {
        await tx.productSupplierQuote.updateMany({
          where: { tenantId, productId, id: { not: quoteId } },
          data: { isDefault: false },
        });
      }

      const updated = await tx.productSupplierQuote.update({
        where: { id: quoteId },
        data: {
          supplierId: supplierPatch?.supplierId,
          supplierName: supplierPatch?.supplierName,
          currencyCode: dto.currency,
          purchasePrice: dto.price,
          moq: dto.moq,
          leadTimeDays: dto.leadTimeDays,
          isDefault: dto.isDefault,
          status: dto.status,
          remark: dto.remark,
          updatedById: user.id,
        },
      });

      if (updated.isDefault) {
        await tx.product.update({
          where: { id: productId },
          data: {
            defaultSupplierCustomerId:
              updated.supplierId ?? updated.supplierCustomerId,
            costPrice: updated.purchasePrice,
            currencyCode: updated.currencyCode,
            updatedById: user.id,
          },
        });
      }

      return updated;
    });
  }

  async removeSupplierQuote(
    user: CurrentUser,
    productId: string,
    quoteId: string,
  ) {
    const tenantId = requireTenantId(user);

    const deleted = await this.prisma.productSupplierQuote.deleteMany({
      where: { id: quoteId, tenantId, productId },
    });

    if (deleted.count === 0) throw new NotFoundException('供应商报价不存在');

    return { success: true };
  }

  async setDefaultSupplierQuote(
    user: CurrentUser,
    productId: string,
    quoteId: string,
  ) {
    const tenantId = requireTenantId(user);

    return this.prisma.$transaction(async (tx) => {
      const quote = await tx.productSupplierQuote.findFirst({
        where: { id: quoteId, tenantId, productId },
      });

      if (!quote) throw new NotFoundException('供应商报价不存在');

      await tx.productSupplierQuote.updateMany({
        where: { tenantId, productId },
        data: { isDefault: false },
      });

      const updated = await tx.productSupplierQuote.update({
        where: { id: quoteId },
        data: { isDefault: true, updatedById: user.id },
      });

      await tx.product.update({
        where: { id: productId },
        data: {
          defaultSupplierCustomerId:
            updated.supplierId ?? updated.supplierCustomerId,
          costPrice: updated.purchasePrice,
          currencyCode: updated.currencyCode,
          updatedById: user.id,
        },
      });

      return updated;
    });
  }

  private async createSupplierQuoteTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    productId: string,
    userId: string,
    dto: CreateProductSupplierQuoteDto,
  ) {
    const supplier = await this.resolveQuoteSupplierTx(
      tx,
      tenantId,
      dto.supplierId,
      dto.supplierName,
    );

    if (dto.isDefault) {
      await tx.productSupplierQuote.updateMany({
        where: { tenantId, productId },
        data: { isDefault: false },
      });
    }

    const created = await tx.productSupplierQuote.create({
      data: {
        tenantId,
        productId,
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
        currencyCode: dto.currency,
        purchasePrice: dto.price,
        moq: dto.moq,
        leadTimeDays: dto.leadTimeDays,
        isDefault: dto.isDefault ?? false,
        status: dto.status ?? ProductSupplierQuoteStatus.ACTIVE,
        remark: dto.remark,
        createdById: userId,
      },
    });

    if (created.isDefault) {
      await tx.product.update({
        where: { id: productId },
        data: {
          defaultSupplierCustomerId:
            created.supplierId ?? created.supplierCustomerId,
          costPrice: created.purchasePrice,
          currencyCode: created.currencyCode,
          updatedById: userId,
        },
      });
    }

    return created;
  }

  private async resolveQuoteSupplierTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    supplierId?: string,
    supplierName?: string,
  ) {
    if (supplierId) {
      const supplier = await tx.supplier.findFirst({
        where: { id: supplierId, tenantId },
        select: { id: true, name: true },
      });

      if (!supplier) {
        throw new BadRequestException('供应商不存在');
      }

      return {
        supplierId: supplier.id,
        supplierName: supplier.name,
      };
    }

    const normalizedSupplierName = supplierName?.trim();

    if (!normalizedSupplierName) {
      throw new BadRequestException('supplierId 或 supplierName 必填');
    }

    return {
      supplierId: null,
      supplierName: normalizedSupplierName,
    };
  }

  private async syncFiles(
    user: CurrentUser,
    productId: string,
    params: {
      mainImageFileId?: string;
      imageFileIds?: string[];
      attachmentFileIds?: string[];
    },
  ) {
    const relations = [];

    if (params.mainImageFileId) {
      relations.push({
        fileId: params.mainImageFileId,
        fieldCode: 'mainImage',
        relationName: '产品主图',
        sort: 0,
      });
    }

    for (const [index, fileId] of (params.imageFileIds ?? []).entries()) {
      relations.push({
        fileId,
        fieldCode: 'images',
        relationName: '产品图片',
        sort: index,
      });
    }

    for (const [index, fileId] of (params.attachmentFileIds ?? []).entries()) {
      relations.push({
        fileId,
        fieldCode: 'attachments',
        relationName: '产品附件',
        sort: index,
      });
    }

    if (relations.length === 0) return;

    await this.fileService.replaceOwnerRelations(
      user,
      'product',
      productId,
      relations,
    );
  }

  private async ensureProduct(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
    });

    if (!product) throw new NotFoundException('产品不存在');
    return product;
  }

  private async assertUniqueCode(
    tenantId: string,
    code: string,
    excludeId?: string,
  ) {
    const exists = await this.prisma.product.findFirst({
      where: {
        tenantId,
        code,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (exists) throw new BadRequestException('产品编码已存在');
  }

  private async assertUniqueSku(
    tenantId: string,
    sku: string,
    excludeId?: string,
  ) {
    const exists = await this.prisma.product.findFirst({
      where: {
        tenantId,
        sku,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (exists) throw new BadRequestException('SKU 已存在');
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
