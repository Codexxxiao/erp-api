// src/purchase-requirement/purchase-requirement.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductSupplierQuoteStatus,
  PurchaseRequirementItemStatus,
  PurchaseRequirementSourceType,
  PurchaseRequirementStatus,
  SalesOrderStatus,
} from '../generated/prisma/client';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../file/file.service';
import { CreatePurchaseRequirementDto } from './dto/create-purchase-requirement.dto';
import { UpdatePurchaseRequirementDto } from './dto/update-purchase-requirement.dto';
import { QueryPurchaseRequirementDto } from './dto/query-purchase-requirement.dto';
import { CreatePurchaseRequirementFromSalesOrderDto } from './dto/create-purchase-requirement-from-sales-order.dto';
import { PurchaseRequirementItemInputDto } from './dto/purchase-requirement-item-input.dto';
import { ReplacePurchaseRequirementItemsDto } from './dto/replace-purchase-requirement-items.dto';
import { ChangePurchaseRequirementStatusDto } from './dto/change-purchase-requirement-status.dto';
import { UpdateRequirementItemOrderedQuantityDto } from './dto/update-requirement-item-ordered-quantity.dto';

@Injectable()
export class PurchaseRequirementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  async create(user: CurrentUser, dto: CreatePurchaseRequirementDto) {
    const tenantId = requireTenantId(user);

    const requirement = await this.prisma.$transaction(async (tx) => {
      const requirementNo =
        dto.requirementNo ?? (await this.generateNoTx(tx, tenantId));
      await this.assertNoUniqueTx(tx, tenantId, requirementNo);

      if (dto.sourceSalesOrderId) {
        await this.assertSalesOrderUsableTx(
          tx,
          tenantId,
          dto.sourceSalesOrderId,
        );
        await this.assertNoDuplicateSalesOrderRequirementTx(
          tx,
          tenantId,
          dto.sourceSalesOrderId,
        );
      }

      const created = await tx.purchaseRequirement.create({
        data: {
          tenantId,
          requirementNo,
          sourceType:
            dto.sourceType ??
            (dto.sourceSalesOrderId
              ? PurchaseRequirementSourceType.SALES_ORDER
              : PurchaseRequirementSourceType.MANUAL),
          sourceSalesOrderId: dto.sourceSalesOrderId,
          customerId: dto.customerId,
          customerName: dto.customerName,
          subject: dto.subject,
          status: dto.status ?? PurchaseRequirementStatus.OPEN,
          priority: dto.priority,
          requiredDate: dto.requiredDate
            ? new Date(dto.requiredDate)
            : undefined,
          ownerUserId: dto.ownerUserId,
          remark: dto.remark,
          extra: this.toJson(dto.extra),
          createdById: user.id,
        },
      });

      await this.replaceItemsTx(tx, tenantId, created.id, dto.items ?? []);
      return created;
    });

    if (dto.attachmentFileIds !== undefined) {
      await this.syncAttachments(user, requirement.id, dto.attachmentFileIds);
    }

    return this.findOne(user, requirement.id);
  }

  async createFromSalesOrder(
    user: CurrentUser,
    salesOrderId: string,
    dto: CreatePurchaseRequirementFromSalesOrderDto,
  ) {
    const tenantId = requireTenantId(user);

    const salesOrder = await this.prisma.salesOrder.findFirst({
      where: { id: salesOrderId, tenantId },
      include: {
        items: {
          orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!salesOrder) throw new NotFoundException('销售订单不存在');

    if (
      ![SalesOrderStatus.CONFIRMED, SalesOrderStatus.PROCESSING].includes(
        salesOrder.status,
      )
    ) {
      throw new BadRequestException(
        '只有已确认或执行中的销售订单才能生成采购需求',
      );
    }

    return this.create(user, {
      requirementNo: dto.requirementNo,
      sourceType: PurchaseRequirementSourceType.SALES_ORDER,
      sourceSalesOrderId: salesOrder.id,
      customerId: salesOrder.customerId ?? undefined,
      customerName: salesOrder.customerName ?? undefined,
      subject: dto.subject ?? salesOrder.subject,
      status: dto.status ?? PurchaseRequirementStatus.OPEN,
      priority: dto.priority,
      requiredDate:
        dto.requiredDate ?? salesOrder.expectedDeliveryDate?.toISOString(),
      ownerUserId: dto.ownerUserId ?? salesOrder.ownerUserId ?? undefined,
      remark: dto.remark,
      extra: dto.extra,
      items: dto.items ?? this.mapSalesOrderItems(salesOrder),
      attachmentFileIds: dto.attachmentFileIds,
    });
  }

  async findMany(user: CurrentUser, query: QueryPurchaseRequirementDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.PurchaseRequirementWhereInput = {
      tenantId,
      status: query.status,
      priority: query.priority,
      sourceType: query.sourceType,
      sourceSalesOrderId: query.sourceSalesOrderId,
      customerId: query.customerId,
      ownerUserId: query.ownerUserId,
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              gte: query.createdFrom ? new Date(query.createdFrom) : undefined,
              lte: query.createdTo ? new Date(query.createdTo) : undefined,
            },
          }
        : {}),
      ...(query.keyword
        ? {
            OR: [
              {
                requirementNo: { contains: query.keyword, mode: 'insensitive' },
              },
              { subject: { contains: query.keyword, mode: 'insensitive' } },
              {
                customerName: { contains: query.keyword, mode: 'insensitive' },
              },
              { remark: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.purchaseRequirement.count({ where }),
      this.prisma.purchaseRequirement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { items: true } } },
      }),
    ]);

    return { total, page, pageSize, list };
  }

  async findOne(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const requirement = await this.prisma.purchaseRequirement.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!requirement) throw new NotFoundException('采购需求不存在');

    const attachments = await this.fileService.findRelations(user, {
      ownerType: 'purchase_requirement',
      ownerId: requirement.id,
    });

    return {
      ...requirement,
      items: requirement.items.map((item) => ({
        ...item,
        remainingQuantity: this.round(
          this.toNumber(item.requiredQuantity) -
            this.toNumber(item.orderedQuantity),
        ),
      })),
      attachments,
    };
  }

  async update(
    user: CurrentUser,
    id: string,
    dto: UpdatePurchaseRequirementDto,
  ) {
    const tenantId = requireTenantId(user);

    await this.prisma.$transaction(async (tx) => {
      const requirement = await this.ensureTx(tx, tenantId, id);
      this.assertEditable(requirement.status);

      if (dto.requirementNo) {
        await this.assertNoUniqueTx(tx, tenantId, dto.requirementNo, id);
      }

      await tx.purchaseRequirement.update({
        where: { id },
        data: {
          requirementNo: dto.requirementNo,
          customerId: dto.customerId,
          customerName: dto.customerName,
          subject: dto.subject,
          status: dto.status,
          priority: dto.priority,
          requiredDate: dto.requiredDate
            ? new Date(dto.requiredDate)
            : undefined,
          ownerUserId: dto.ownerUserId,
          remark: dto.remark,
          extra: dto.extra === undefined ? undefined : this.toJson(dto.extra),
          updatedById: user.id,
        },
      });

      if (dto.items !== undefined) {
        await this.replaceItemsTx(tx, tenantId, id, dto.items);
        await this.recalculateHeaderStatusTx(tx, tenantId, id, user.id);
      }
    });

    if (dto.attachmentFileIds !== undefined) {
      await this.syncAttachments(user, id, dto.attachmentFileIds);
    }

    return this.findOne(user, id);
  }

  async replaceItems(
    user: CurrentUser,
    id: string,
    dto: ReplacePurchaseRequirementItemsDto,
  ) {
    const tenantId = requireTenantId(user);

    await this.prisma.$transaction(async (tx) => {
      const requirement = await this.ensureTx(tx, tenantId, id);
      this.assertEditable(requirement.status);

      await this.replaceItemsTx(tx, tenantId, id, dto.items);
      await this.recalculateHeaderStatusTx(tx, tenantId, id, user.id);
    });

    return this.findOne(user, id);
  }

  async updateOrderedQuantity(
    user: CurrentUser,
    requirementId: string,
    itemId: string,
    dto: UpdateRequirementItemOrderedQuantityDto,
  ) {
    const tenantId = requireTenantId(user);

    await this.prisma.$transaction(async (tx) => {
      const requirement = await this.ensureTx(tx, tenantId, requirementId);

      if (
        [
          PurchaseRequirementStatus.CLOSED,
          PurchaseRequirementStatus.CANCELLED,
        ].includes(requirement.status)
      ) {
        throw new BadRequestException('当前采购需求状态不允许更新已采购数量');
      }

      const item = await tx.purchaseRequirementItem.findFirst({
        where: { id: itemId, tenantId, requirementId },
      });

      if (!item) throw new NotFoundException('采购需求明细不存在');

      const status = this.resolveItemStatus(
        this.toNumber(item.requiredQuantity),
        dto.orderedQuantity,
      );

      await tx.purchaseRequirementItem.update({
        where: { id: itemId },
        data: {
          orderedQuantity: dto.orderedQuantity,
          status,
        },
      });

      await this.recalculateHeaderStatusTx(
        tx,
        tenantId,
        requirementId,
        user.id,
      );
    });

    return this.findOne(user, requirementId);
  }

  async changeStatus(
    user: CurrentUser,
    id: string,
    dto: ChangePurchaseRequirementStatusDto,
  ) {
    const tenantId = requireTenantId(user);

    return this.prisma.$transaction(async (tx) => {
      await this.ensureTx(tx, tenantId, id);

      const now = new Date();
      const data: Prisma.PurchaseRequirementUpdateInput = {
        status: dto.status,
        updatedById: user.id,
      };

      if (dto.status === PurchaseRequirementStatus.CLOSED) {
        data.closedAt = now;
      }

      if (dto.status === PurchaseRequirementStatus.CANCELLED) {
        data.cancelledAt = now;

        await tx.purchaseRequirementItem.updateMany({
          where: { tenantId, requirementId: id },
          data: { status: PurchaseRequirementItemStatus.CANCELLED },
        });
      }

      return tx.purchaseRequirement.update({
        where: { id },
        data,
      });
    });
  }

  async remove(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    await this.ensure(tenantId, id);

    return this.prisma.purchaseRequirement.update({
      where: { id },
      data: {
        status: PurchaseRequirementStatus.CANCELLED,
        cancelledAt: new Date(),
        updatedById: user.id,
      },
    });
  }

  private async replaceItemsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    requirementId: string,
    items: PurchaseRequirementItemInputDto[],
  ) {
    await tx.purchaseRequirementItem.deleteMany({
      where: { tenantId, requirementId },
    });

    const rows = await this.normalizeItemsTx(
      tx,
      tenantId,
      requirementId,
      items,
    );

    if (rows.length > 0) {
      await tx.purchaseRequirementItem.createMany({ data: rows });
    }
  }

  private async normalizeItemsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    requirementId: string,
    items: PurchaseRequirementItemInputDto[],
  ): Promise<Prisma.PurchaseRequirementItemCreateManyInput[]> {
    const productIds = Array.from(
      new Set(items.map((item) => item.productId).filter(Boolean) as string[]),
    );

    const products = productIds.length
      ? await tx.product.findMany({
          where: { tenantId, id: { in: productIds } },
          select: {
            id: true,
            code: true,
            nameCn: true,
            nameEn: true,
            categoryCode: true,
            unitCode: true,
            currencyCode: true,
            supplierQuotes: {
              where: {
                isDefault: true,
                status: ProductSupplierQuoteStatus.ACTIVE,
              },
              take: 1,
              include: {
                supplier: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        })
      : [];

    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );

    for (const productId of productIds) {
      if (!productMap.has(productId)) {
        throw new BadRequestException('产品不存在或不属于当前租户');
      }
    }

    return items.map((item, index) => {
      const product = item.productId
        ? productMap.get(item.productId)
        : undefined;
      const quote = product?.supplierQuotes?.[0];

      return {
        tenantId,
        requirementId,
        sourceSalesOrderItemId: item.sourceSalesOrderItemId,
        productId: item.productId,
        productCode: item.productCode ?? product?.code,
        productNameCn: item.productNameCn ?? product?.nameCn,
        productNameEn: item.productNameEn ?? product?.nameEn,
        categoryCode: item.categoryCode ?? product?.categoryCode,
        unitCode: item.unitCode ?? product?.unitCode,
        requiredQuantity: item.requiredQuantity,
        orderedQuantity: 0,
        suggestedSupplierId: item.suggestedSupplierId ?? quote?.supplierId,
        suggestedSupplierName:
          item.suggestedSupplierName ??
          quote?.supplierName ??
          quote?.supplier?.name,
        targetPurchasePrice:
          item.targetPurchasePrice ?? this.optionalNumber(quote?.purchasePrice),
        currencyCode:
          item.currencyCode ?? quote?.currencyCode ?? product?.currencyCode,
        requiredDate: item.requiredDate
          ? new Date(item.requiredDate)
          : undefined,
        status: PurchaseRequirementItemStatus.OPEN,
        remark: item.remark,
        extra: this.toJson(item.extra),
        sort: item.sort ?? index,
      };
    });
  }

  private mapSalesOrderItems(salesOrder: {
    expectedDeliveryDate?: Date | null;
    items: Array<{
      id: string;
      productId?: string | null;
      productCode?: string | null;
      productNameCn?: string | null;
      productNameEn?: string | null;
      categoryCode?: string | null;
      unitCode?: string | null;
      orderedQuantity: unknown;
      currencyCode?: string | null;
      expectedDeliveryDate?: Date | null;
      remark?: string | null;
      extra?: unknown;
      sort: number;
    }>;
  }): PurchaseRequirementItemInputDto[] {
    return salesOrder.items.map((item) => ({
      sourceSalesOrderItemId: item.id,
      productId: item.productId ?? undefined,
      productCode: item.productCode ?? undefined,
      productNameCn: item.productNameCn ?? undefined,
      productNameEn: item.productNameEn ?? undefined,
      categoryCode: item.categoryCode ?? undefined,
      unitCode: item.unitCode ?? undefined,
      requiredQuantity: this.toNumber(item.orderedQuantity),
      currencyCode: item.currencyCode ?? undefined,
      requiredDate:
        item.expectedDeliveryDate?.toISOString() ??
        salesOrder.expectedDeliveryDate?.toISOString(),
      remark: item.remark ?? undefined,
      extra: this.toPlainObject(item.extra),
      sort: item.sort,
    }));
  }

  private async recalculateHeaderStatusTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    requirementId: string,
    userId: string,
  ) {
    const requirement = await tx.purchaseRequirement.findFirst({
      where: { id: requirementId, tenantId },
      select: { status: true },
    });

    if (!requirement) throw new NotFoundException('采购需求不存在');

    if (
      [
        PurchaseRequirementStatus.DRAFT,
        PurchaseRequirementStatus.CLOSED,
        PurchaseRequirementStatus.CANCELLED,
      ].includes(requirement.status)
    ) {
      return;
    }

    const items = await tx.purchaseRequirementItem.findMany({
      where: { tenantId, requirementId },
      select: { status: true },
    });

    let status = PurchaseRequirementStatus.OPEN;

    if (
      items.length > 0 &&
      items.every(
        (item) => item.status === PurchaseRequirementItemStatus.ORDERED,
      )
    ) {
      status = PurchaseRequirementStatus.ORDERED;
    } else if (
      items.some((item) =>
        [
          PurchaseRequirementItemStatus.PARTIALLY_ORDERED,
          PurchaseRequirementItemStatus.ORDERED,
        ].includes(item.status),
      )
    ) {
      status = PurchaseRequirementStatus.PARTIALLY_ORDERED;
    }

    await tx.purchaseRequirement.update({
      where: { id: requirementId },
      data: { status, updatedById: userId },
    });
  }

  private resolveItemStatus(requiredQuantity: number, orderedQuantity: number) {
    if (orderedQuantity <= 0) return PurchaseRequirementItemStatus.OPEN;
    if (orderedQuantity >= requiredQuantity)
      return PurchaseRequirementItemStatus.ORDERED;
    return PurchaseRequirementItemStatus.PARTIALLY_ORDERED;
  }

  private async assertSalesOrderUsableTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    salesOrderId: string,
  ) {
    const order = await tx.salesOrder.findFirst({
      where: { id: salesOrderId, tenantId },
      select: { id: true, status: true },
    });

    if (!order) throw new NotFoundException('销售订单不存在');

    if (
      ![SalesOrderStatus.CONFIRMED, SalesOrderStatus.PROCESSING].includes(
        order.status,
      )
    ) {
      throw new BadRequestException(
        '只有已确认或执行中的销售订单才能生成采购需求',
      );
    }

    return order;
  }

  private async assertNoDuplicateSalesOrderRequirementTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    salesOrderId: string,
  ) {
    const exists = await tx.purchaseRequirement.findFirst({
      where: {
        tenantId,
        sourceSalesOrderId: salesOrderId,
        status: { not: PurchaseRequirementStatus.CANCELLED },
      },
      select: { id: true },
    });

    if (exists) throw new BadRequestException('该销售订单已生成采购需求');
  }

  private async ensure(tenantId: string, id: string) {
    const row = await this.prisma.purchaseRequirement.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('采购需求不存在');
    return row;
  }

  private async ensureTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const row = await tx.purchaseRequirement.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('采购需求不存在');
    return row;
  }

  private assertEditable(status: PurchaseRequirementStatus) {
    if (
      ![
        PurchaseRequirementStatus.DRAFT,
        PurchaseRequirementStatus.OPEN,
      ].includes(status)
    ) {
      throw new BadRequestException('当前采购需求状态不允许编辑');
    }
  }

  private async assertNoUniqueTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    requirementNo: string,
    excludeId?: string,
  ) {
    const exists = await tx.purchaseRequirement.findFirst({
      where: {
        tenantId,
        requirementNo,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (exists) throw new BadRequestException('采购需求编号已存在');
  }

  private async generateNoTx(tx: Prisma.TransactionClient, tenantId: string) {
    const no = `PR${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
    const exists = await tx.purchaseRequirement.findFirst({
      where: { tenantId, requirementNo: no },
      select: { id: true },
    });
    return exists ? this.generateNoTx(tx, tenantId) : no;
  }

  private async syncAttachments(
    user: CurrentUser,
    requirementId: string,
    fileIds: string[],
  ) {
    await this.fileService.replaceOwnerRelations(
      user,
      'purchase_requirement',
      requirementId,
      fileIds.map((fileId, index) => ({
        fileId,
        fieldCode: 'attachments',
        relationName: '采购需求附件',
        sort: index,
      })),
    );
  }

  private round(value: number) {
    return Math.round(value * 10000) / 10000;
  }

  private toNumber(value: unknown) {
    if (value === null || value === undefined) return 0;
    return Number(value);
  }

  private optionalNumber(value: unknown) {
    if (value === null || value === undefined) return undefined;
    return Number(value);
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private toPlainObject(value: unknown): Record<string, unknown> | undefined {
    if (!value) return undefined;
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  }
}
