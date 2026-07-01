// src/purchase-order/purchase-order.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PurchaseOrderItemStatus,
  PurchaseOrderSourceType,
  PurchaseOrderStatus,
  PurchaseRequirementItemStatus,
  PurchaseRequirementStatus,
} from '../generated/prisma/client';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../file/file.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { QueryPurchaseOrderDto } from './dto/query-purchase-order.dto';
import { PurchaseOrderItemInputDto } from './dto/purchase-order-item-input.dto';
import { CreatePurchaseOrderFromRequirementsDto } from './dto/create-purchase-order-from-requirements.dto';
import { ChangePurchaseOrderStatusDto } from './dto/change-purchase-order-status.dto';
import { UpdatePurchaseOrderItemReceivedQuantityDto } from './dto/update-purchase-order-item-received-quantity.dto';

@Injectable()
export class PurchaseOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  async create(user: CurrentUser, dto: CreatePurchaseOrderDto) {
    const tenantId = requireTenantId(user);

    const order = await this.prisma.$transaction((tx) =>
      this.createOrderTx(tx, tenantId, user.id, dto),
    );

    if (dto.attachmentFileIds !== undefined) {
      await this.syncAttachments(user, order.id, dto.attachmentFileIds);
    }

    return this.findOne(user, order.id);
  }

  async createFromRequirements(
    user: CurrentUser,
    dto: CreatePurchaseOrderFromRequirementsDto,
  ) {
    const tenantId = requireTenantId(user);
    const createdIds: string[] = [];

    await this.prisma.$transaction(async (tx) => {
      const groups = await this.buildRequirementGroupsTx(tx, tenantId, dto);

      for (const group of groups) {
        const created = await this.createOrderTx(tx, tenantId, user.id, {
          purchaseOrderNo:
            groups.length === 1 ? dto.purchaseOrderNo : undefined,
          sourceType: PurchaseOrderSourceType.PURCHASE_REQUIREMENT,
          supplierId: group.supplierId ?? undefined,
          supplierName: group.supplierName,
          status: dto.status ?? PurchaseOrderStatus.DRAFT,
          currencyCode: dto.currencyCode ?? group.currencyCode ?? 'USD',
          exchangeRate: dto.exchangeRate,
          expectedDeliveryDate: dto.expectedDeliveryDate,
          ownerUserId: dto.ownerUserId,
          freightAmount: dto.freightAmount,
          otherAmount: dto.otherAmount,
          remark: dto.remark,
          extra: dto.extra,
          items: group.items,
        });

        createdIds.push(created.id);
      }
    });

    for (const id of createdIds) {
      if (dto.attachmentFileIds !== undefined) {
        await this.syncAttachments(user, id, dto.attachmentFileIds);
      }
    }

    return Promise.all(createdIds.map((id) => this.findOne(user, id)));
  }

  async findMany(user: CurrentUser, query: QueryPurchaseOrderDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.PurchaseOrderWhereInput = {
      tenantId,
      status: query.status,
      sourceType: query.sourceType,
      supplierId: query.supplierId,
      ownerUserId: query.ownerUserId,
      currencyCode: query.currencyCode,
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
                purchaseOrderNo: {
                  contains: query.keyword,
                  mode: 'insensitive',
                },
              },
              {
                supplierName: { contains: query.keyword, mode: 'insensitive' },
              },
              { remark: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
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

    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: { items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
    });

    if (!order) throw new NotFoundException('采购订单不存在');

    const attachments = await this.fileService.findRelations(user, {
      ownerType: 'purchase_order',
      ownerId: order.id,
    });

    return { ...order, attachments };
  }

  async update(user: CurrentUser, id: string, dto: UpdatePurchaseOrderDto) {
    const tenantId = requireTenantId(user);

    await this.prisma.$transaction(async (tx) => {
      const order = await this.ensureTx(tx, tenantId, id);
      if (order.status !== PurchaseOrderStatus.DRAFT) {
        throw new BadRequestException('只有草稿采购订单允许编辑');
      }

      if (dto.purchaseOrderNo) {
        await this.assertNoUniqueTx(tx, tenantId, dto.purchaseOrderNo, id);
      }

      const supplier =
        dto.supplierId !== undefined || dto.supplierName !== undefined
          ? await this.resolveSupplierTx(
              tx,
              tenantId,
              dto.supplierId,
              dto.supplierName,
            )
          : undefined;

      await tx.purchaseOrder.update({
        where: { id },
        data: {
          purchaseOrderNo: dto.purchaseOrderNo,
          supplierId: supplier?.supplierId,
          supplierName: supplier?.supplierName,
          currencyCode: dto.currencyCode,
          exchangeRate: dto.exchangeRate,
          expectedDeliveryDate: dto.expectedDeliveryDate
            ? new Date(dto.expectedDeliveryDate)
            : undefined,
          ownerUserId: dto.ownerUserId,
          freightAmount: dto.freightAmount,
          otherAmount: dto.otherAmount,
          remark: dto.remark,
          extra: dto.extra === undefined ? undefined : this.toJson(dto.extra),
          updatedById: user.id,
        },
      });

      if (dto.items !== undefined) {
        const totals = await this.replaceItemsTx(
          tx,
          tenantId,
          id,
          dto.items,
          dto.freightAmount ?? this.toNumber(order.freightAmount),
          dto.otherAmount ?? this.toNumber(order.otherAmount),
          dto.currencyCode ?? order.currencyCode,
        );

        await tx.purchaseOrder.update({ where: { id }, data: totals });
      }
    });

    if (dto.attachmentFileIds !== undefined) {
      await this.syncAttachments(user, id, dto.attachmentFileIds);
    }

    return this.findOne(user, id);
  }

  async changeStatus(
    user: CurrentUser,
    id: string,
    dto: ChangePurchaseOrderStatusDto,
  ) {
    const tenantId = requireTenantId(user);

    return this.prisma.$transaction(async (tx) => {
      const order = await this.ensureTx(tx, tenantId, id);
      if (order.status === dto.status) return order;

      this.assertStatusTransition(order.status, dto.status);

      const now = new Date();
      const data: Prisma.PurchaseOrderUpdateInput = {
        status: dto.status,
        updatedById: user.id,
      };

      if (
        [PurchaseOrderStatus.CONFIRMED, PurchaseOrderStatus.SENT].includes(
          dto.status,
        ) &&
        order.status === PurchaseOrderStatus.DRAFT
      ) {
        data.confirmedAt = now;
        await this.applyRequirementOrderedQtyTx(tx, tenantId, id, user.id);
      }

      if (dto.status === PurchaseOrderStatus.SENT) data.sentAt = now;
      if (dto.status === PurchaseOrderStatus.RECEIVED) data.receivedAt = now;
      if (dto.status === PurchaseOrderStatus.CLOSED) data.closedAt = now;

      if (dto.status === PurchaseOrderStatus.CANCELLED) {
        data.cancelledAt = now;
        if (order.status !== PurchaseOrderStatus.DRAFT) {
          await this.rollbackRequirementOrderedQtyTx(tx, tenantId, id, user.id);
        }
        await tx.purchaseOrderItem.updateMany({
          where: { tenantId, purchaseOrderId: id },
          data: { status: PurchaseOrderItemStatus.CANCELLED },
        });
      }

      return tx.purchaseOrder.update({ where: { id }, data });
    });
  }

  async updateReceivedQuantity(
    user: CurrentUser,
    orderId: string,
    itemId: string,
    dto: UpdatePurchaseOrderItemReceivedQuantityDto,
  ) {
    const tenantId = requireTenantId(user);

    await this.prisma.$transaction(async (tx) => {
      const order = await this.ensureTx(tx, tenantId, orderId);

      if (
        ![
          PurchaseOrderStatus.CONFIRMED,
          PurchaseOrderStatus.SENT,
          PurchaseOrderStatus.PARTIALLY_RECEIVED,
          PurchaseOrderStatus.RECEIVED,
        ].includes(order.status)
      ) {
        throw new BadRequestException('当前采购订单状态不允许收货');
      }

      const item = await tx.purchaseOrderItem.findFirst({
        where: { id: itemId, tenantId, purchaseOrderId: orderId },
      });

      if (!item) throw new NotFoundException('采购订单明细不存在');

      const status = this.resolvePoItemStatus(
        this.toNumber(item.purchaseQuantity),
        dto.receivedQuantity,
      );

      await tx.purchaseOrderItem.update({
        where: { id: itemId },
        data: { receivedQuantity: dto.receivedQuantity, status },
      });

      await this.recalculateReceiveStatusTx(tx, tenantId, orderId, user.id);
    });

    return this.findOne(user, orderId);
  }

  async remove(user: CurrentUser, id: string) {
    return this.changeStatus(user, id, {
      status: PurchaseOrderStatus.CANCELLED,
    });
  }

  private async createOrderTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    dto: CreatePurchaseOrderDto,
  ) {
    const purchaseOrderNo =
      dto.purchaseOrderNo ?? (await this.generateNoTx(tx, tenantId));
    await this.assertNoUniqueTx(tx, tenantId, purchaseOrderNo);

    const supplier = await this.resolveSupplierTx(
      tx,
      tenantId,
      dto.supplierId,
      dto.supplierName,
    );
    const status = dto.status ?? PurchaseOrderStatus.DRAFT;
    const now = new Date();

    const created = await tx.purchaseOrder.create({
      data: {
        tenantId,
        purchaseOrderNo,
        sourceType: dto.sourceType ?? PurchaseOrderSourceType.MANUAL,
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
        status,
        currencyCode: dto.currencyCode,
        exchangeRate: dto.exchangeRate,
        expectedDeliveryDate: dto.expectedDeliveryDate
          ? new Date(dto.expectedDeliveryDate)
          : undefined,
        ownerUserId: dto.ownerUserId,
        confirmedAt: [
          PurchaseOrderStatus.CONFIRMED,
          PurchaseOrderStatus.SENT,
        ].includes(status)
          ? now
          : undefined,
        sentAt: status === PurchaseOrderStatus.SENT ? now : undefined,
        freightAmount: dto.freightAmount ?? 0,
        otherAmount: dto.otherAmount ?? 0,
        remark: dto.remark,
        extra: this.toJson(dto.extra),
        createdById: userId,
      },
    });

    const totals = await this.replaceItemsTx(
      tx,
      tenantId,
      created.id,
      dto.items ?? [],
      dto.freightAmount ?? 0,
      dto.otherAmount ?? 0,
      dto.currencyCode,
    );

    await tx.purchaseOrder.update({ where: { id: created.id }, data: totals });

    if (
      [PurchaseOrderStatus.CONFIRMED, PurchaseOrderStatus.SENT].includes(status)
    ) {
      await this.applyRequirementOrderedQtyTx(tx, tenantId, created.id, userId);
    }

    return created;
  }

  private async replaceItemsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    purchaseOrderId: string,
    items: PurchaseOrderItemInputDto[],
    freightAmount: number,
    otherAmount: number,
    orderCurrencyCode: string,
  ) {
    await tx.purchaseOrderItem.deleteMany({
      where: { tenantId, purchaseOrderId },
    });
    const rows = await this.normalizeItemsTx(
      tx,
      tenantId,
      purchaseOrderId,
      items,
      orderCurrencyCode,
    );

    if (rows.length > 0) {
      await tx.purchaseOrderItem.createMany({ data: rows });
    }

    return this.totals(rows, freightAmount, otherAmount);
  }

  private async normalizeItemsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    purchaseOrderId: string,
    items: PurchaseOrderItemInputDto[],
    orderCurrencyCode: string,
  ): Promise<Prisma.PurchaseOrderItemCreateManyInput[]> {
    const requirementItemIds = Array.from(
      new Set(
        items
          .map((item) => item.sourceRequirementItemId)
          .filter(Boolean) as string[],
      ),
    );
    const requirementItems = requirementItemIds.length
      ? await tx.purchaseRequirementItem.findMany({
          where: { tenantId, id: { in: requirementItemIds } },
        })
      : [];
    const requirementMap = new Map(
      requirementItems.map((item) => [item.id, item]),
    );

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
          },
        })
      : [];
    const productMap = new Map(
      products.map((product) => [product.id, product]),
    );

    return items.map((item, index) => {
      const requirementItem = item.sourceRequirementItemId
        ? requirementMap.get(item.sourceRequirementItemId)
        : undefined;
      if (item.sourceRequirementItemId && !requirementItem) {
        throw new BadRequestException('采购需求明细不存在或不属于当前租户');
      }

      if (requirementItem) {
        if (
          [
            PurchaseRequirementItemStatus.ORDERED,
            PurchaseRequirementItemStatus.CLOSED,
            PurchaseRequirementItemStatus.CANCELLED,
          ].includes(requirementItem.status)
        ) {
          throw new BadRequestException('采购需求明细状态不允许生成采购订单');
        }

        const remaining =
          this.toNumber(requirementItem.requiredQuantity) -
          this.toNumber(requirementItem.orderedQuantity);
        if (item.purchaseQuantity > remaining) {
          throw new BadRequestException('采购数量不能大于采购需求剩余数量');
        }
      }

      const product = item.productId
        ? productMap.get(item.productId)
        : undefined;
      if (item.productId && !product)
        throw new BadRequestException('产品不存在或不属于当前租户');

      const unitPrice =
        item.unitPrice ??
        this.optionalNumber(requirementItem?.targetPurchasePrice) ??
        0;
      const grossAmount = this.round(item.purchaseQuantity * unitPrice);
      const discountAmount = item.discountAmount ?? 0;
      const taxAmount = item.taxAmount ?? 0;

      return {
        tenantId,
        purchaseOrderId,
        sourceRequirementId: requirementItem?.requirementId,
        sourceRequirementItemId: item.sourceRequirementItemId,
        productId: item.productId ?? requirementItem?.productId,
        productCode:
          item.productCode ?? requirementItem?.productCode ?? product?.code,
        productNameCn:
          item.productNameCn ??
          requirementItem?.productNameCn ??
          product?.nameCn,
        productNameEn:
          item.productNameEn ??
          requirementItem?.productNameEn ??
          product?.nameEn,
        categoryCode:
          item.categoryCode ??
          requirementItem?.categoryCode ??
          product?.categoryCode,
        unitCode:
          item.unitCode ?? requirementItem?.unitCode ?? product?.unitCode,
        purchaseQuantity: item.purchaseQuantity,
        receivedQuantity: 0,
        unitPrice,
        grossAmount,
        discountAmount,
        taxAmount,
        amount: this.round(grossAmount - discountAmount + taxAmount),
        currencyCode:
          item.currencyCode ??
          requirementItem?.currencyCode ??
          product?.currencyCode ??
          orderCurrencyCode,
        expectedDeliveryDate: item.expectedDeliveryDate
          ? new Date(item.expectedDeliveryDate)
          : requirementItem?.requiredDate,
        status: PurchaseOrderItemStatus.OPEN,
        remark: item.remark,
        extra: this.toJson(item.extra),
        sort: item.sort ?? index,
      };
    });
  }

  private async buildRequirementGroupsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    dto: CreatePurchaseOrderFromRequirementsDto,
  ) {
    const ids = dto.items.map((item) => item.requirementItemId);
    const requirementItems = await tx.purchaseRequirementItem.findMany({
      where: { tenantId, id: { in: ids } },
      include: { requirement: true },
    });

    if (requirementItems.length !== ids.length) {
      throw new BadRequestException('存在无效采购需求明细');
    }

    const inputMap = new Map(
      dto.items.map((item) => [item.requirementItemId, item]),
    );
    const groups = new Map<
      string,
      {
        supplierId: string | null;
        supplierName: string;
        currencyCode?: string;
        items: PurchaseOrderItemInputDto[];
      }
    >();

    for (const item of requirementItems) {
      if (
        [
          PurchaseRequirementItemStatus.ORDERED,
          PurchaseRequirementItemStatus.CLOSED,
          PurchaseRequirementItemStatus.CANCELLED,
        ].includes(item.status)
      ) {
        throw new BadRequestException('采购需求明细状态不允许生成采购订单');
      }

      const input = inputMap.get(item.id)!;
      const remaining =
        this.toNumber(item.requiredQuantity) -
        this.toNumber(item.orderedQuantity);
      const purchaseQuantity = input.purchaseQuantity ?? remaining;

      if (purchaseQuantity <= 0 || purchaseQuantity > remaining) {
        throw new BadRequestException('采购数量必须大于 0 且不能超过剩余数量');
      }

      const supplier =
        dto.supplierId || dto.supplierName
          ? await this.resolveSupplierTx(
              tx,
              tenantId,
              dto.supplierId,
              dto.supplierName,
            )
          : {
              supplierId: item.suggestedSupplierId,
              supplierName: item.suggestedSupplierName,
            };

      if (!supplier.supplierId && !supplier.supplierName) {
        throw new BadRequestException('采购需求明细缺少建议供应商');
      }

      const key =
        dto.groupBySupplier === false
          ? 'single'
          : (supplier.supplierId ?? `name:${supplier.supplierName}`);

      if (!groups.has(key)) {
        groups.set(key, {
          supplierId: supplier.supplierId ?? null,
          supplierName: supplier.supplierName!,
          currencyCode: item.currencyCode ?? undefined,
          items: [],
        });
      }

      groups.get(key)!.items.push({
        sourceRequirementItemId: item.id,
        productId: item.productId ?? undefined,
        productCode: item.productCode ?? undefined,
        productNameCn: item.productNameCn ?? undefined,
        productNameEn: item.productNameEn ?? undefined,
        categoryCode: item.categoryCode ?? undefined,
        unitCode: item.unitCode ?? undefined,
        purchaseQuantity,
        unitPrice:
          input.unitPrice ?? this.optionalNumber(item.targetPurchasePrice),
        currencyCode: dto.currencyCode ?? item.currencyCode ?? undefined,
        expectedDeliveryDate:
          input.expectedDeliveryDate ?? item.requiredDate?.toISOString(),
        remark: input.remark ?? item.remark ?? undefined,
        sort: item.sort,
      });
    }

    return Array.from(groups.values());
  }

  private async applyRequirementOrderedQtyTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    purchaseOrderId: string,
    userId: string,
  ) {
    const items = await tx.purchaseOrderItem.findMany({
      where: {
        tenantId,
        purchaseOrderId,
        sourceRequirementItemId: { not: null },
      },
    });

    const requirementIds = new Set<string>();

    for (const item of items) {
      const reqItem = await tx.purchaseRequirementItem.findFirst({
        where: { id: item.sourceRequirementItemId!, tenantId },
      });
      if (!reqItem) continue;

      const orderedQuantity =
        this.toNumber(reqItem.orderedQuantity) +
        this.toNumber(item.purchaseQuantity);
      if (orderedQuantity > this.toNumber(reqItem.requiredQuantity)) {
        throw new BadRequestException('采购订单数量超过采购需求剩余数量');
      }

      await tx.purchaseRequirementItem.update({
        where: { id: reqItem.id },
        data: {
          orderedQuantity,
          status: this.resolveRequirementItemStatus(
            this.toNumber(reqItem.requiredQuantity),
            orderedQuantity,
          ),
        },
      });

      requirementIds.add(reqItem.requirementId);
    }

    for (const requirementId of requirementIds) {
      await this.recalculateRequirementStatusTx(
        tx,
        tenantId,
        requirementId,
        userId,
      );
    }
  }

  private async rollbackRequirementOrderedQtyTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    purchaseOrderId: string,
    userId: string,
  ) {
    const items = await tx.purchaseOrderItem.findMany({
      where: {
        tenantId,
        purchaseOrderId,
        sourceRequirementItemId: { not: null },
      },
    });

    const requirementIds = new Set<string>();

    for (const item of items) {
      const reqItem = await tx.purchaseRequirementItem.findFirst({
        where: { id: item.sourceRequirementItemId!, tenantId },
      });
      if (!reqItem) continue;

      const orderedQuantity = Math.max(
        0,
        this.toNumber(reqItem.orderedQuantity) -
          this.toNumber(item.purchaseQuantity),
      );

      await tx.purchaseRequirementItem.update({
        where: { id: reqItem.id },
        data: {
          orderedQuantity,
          status: this.resolveRequirementItemStatus(
            this.toNumber(reqItem.requiredQuantity),
            orderedQuantity,
          ),
        },
      });

      requirementIds.add(reqItem.requirementId);
    }

    for (const requirementId of requirementIds) {
      await this.recalculateRequirementStatusTx(
        tx,
        tenantId,
        requirementId,
        userId,
      );
    }
  }

  private async recalculateRequirementStatusTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    requirementId: string,
    userId: string,
  ) {
    const items = await tx.purchaseRequirementItem.findMany({
      where: { tenantId, requirementId },
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
          PurchaseRequirementItemStatus.ORDERED,
          PurchaseRequirementItemStatus.PARTIALLY_ORDERED,
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

  private async recalculateReceiveStatusTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    purchaseOrderId: string,
    userId: string,
  ) {
    const items = await tx.purchaseOrderItem.findMany({
      where: { tenantId, purchaseOrderId },
    });

    const status =
      items.length > 0 &&
      items.every((item) => item.status === PurchaseOrderItemStatus.RECEIVED)
        ? PurchaseOrderStatus.RECEIVED
        : items.some(
              (item) =>
                item.status === PurchaseOrderItemStatus.PARTIALLY_RECEIVED ||
                item.status === PurchaseOrderItemStatus.RECEIVED,
            )
          ? PurchaseOrderStatus.PARTIALLY_RECEIVED
          : PurchaseOrderStatus.SENT;

    await tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        status,
        receivedAt:
          status === PurchaseOrderStatus.RECEIVED ? new Date() : undefined,
        updatedById: userId,
      },
    });
  }

  private async resolveSupplierTx(
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
      if (!supplier) throw new BadRequestException('供应商不存在');
      return { supplierId: supplier.id, supplierName: supplier.name };
    }

    const name = supplierName?.trim();
    if (!name) throw new BadRequestException('supplierId 或 supplierName 必填');
    return { supplierId: null, supplierName: name };
  }

  private assertStatusTransition(
    current: PurchaseOrderStatus,
    next: PurchaseOrderStatus,
  ) {
    const allowed: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
      [PurchaseOrderStatus.DRAFT]: [
        PurchaseOrderStatus.CONFIRMED,
        PurchaseOrderStatus.SENT,
        PurchaseOrderStatus.CANCELLED,
      ],
      [PurchaseOrderStatus.CONFIRMED]: [
        PurchaseOrderStatus.SENT,
        PurchaseOrderStatus.PARTIALLY_RECEIVED,
        PurchaseOrderStatus.RECEIVED,
        PurchaseOrderStatus.CANCELLED,
      ],
      [PurchaseOrderStatus.SENT]: [
        PurchaseOrderStatus.PARTIALLY_RECEIVED,
        PurchaseOrderStatus.RECEIVED,
        PurchaseOrderStatus.CANCELLED,
      ],
      [PurchaseOrderStatus.PARTIALLY_RECEIVED]: [
        PurchaseOrderStatus.RECEIVED,
        PurchaseOrderStatus.CLOSED,
      ],
      [PurchaseOrderStatus.RECEIVED]: [PurchaseOrderStatus.CLOSED],
      [PurchaseOrderStatus.CLOSED]: [],
      [PurchaseOrderStatus.CANCELLED]: [],
    };

    if (!allowed[current].includes(next)) {
      throw new BadRequestException('采购订单状态不允许这样流转');
    }
  }

  private resolvePoItemStatus(quantity: number, receivedQuantity: number) {
    if (receivedQuantity <= 0) return PurchaseOrderItemStatus.OPEN;
    if (receivedQuantity >= quantity) return PurchaseOrderItemStatus.RECEIVED;
    return PurchaseOrderItemStatus.PARTIALLY_RECEIVED;
  }

  private resolveRequirementItemStatus(
    requiredQuantity: number,
    orderedQuantity: number,
  ) {
    if (orderedQuantity <= 0) return PurchaseRequirementItemStatus.OPEN;
    if (orderedQuantity >= requiredQuantity)
      return PurchaseRequirementItemStatus.ORDERED;
    return PurchaseRequirementItemStatus.PARTIALLY_ORDERED;
  }

  private totals(
    items: Array<{
      grossAmount: unknown;
      discountAmount: unknown;
      taxAmount: unknown;
    }>,
    freightAmount: number,
    otherAmount: number,
  ) {
    const subtotalAmount = this.round(
      items.reduce((sum, item) => sum + this.toNumber(item.grossAmount), 0),
    );
    const discountAmount = this.round(
      items.reduce((sum, item) => sum + this.toNumber(item.discountAmount), 0),
    );
    const taxAmount = this.round(
      items.reduce((sum, item) => sum + this.toNumber(item.taxAmount), 0),
    );
    return {
      subtotalAmount,
      discountAmount,
      taxAmount,
      freightAmount,
      otherAmount,
      totalAmount: this.round(
        subtotalAmount -
          discountAmount +
          taxAmount +
          freightAmount +
          otherAmount,
      ),
    };
  }

  private async ensureTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const row = await tx.purchaseOrder.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('采购订单不存在');
    return row;
  }

  private async assertNoUniqueTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    purchaseOrderNo: string,
    excludeId?: string,
  ) {
    const exists = await tx.purchaseOrder.findFirst({
      where: {
        tenantId,
        purchaseOrderNo,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (exists) throw new BadRequestException('采购订单编号已存在');
  }

  private async generateNoTx(tx: Prisma.TransactionClient, tenantId: string) {
    const no = `PO${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
    const exists = await tx.purchaseOrder.findFirst({
      where: { tenantId, purchaseOrderNo: no },
      select: { id: true },
    });
    return exists ? this.generateNoTx(tx, tenantId) : no;
  }

  private async syncAttachments(
    user: CurrentUser,
    purchaseOrderId: string,
    fileIds: string[],
  ) {
    await this.fileService.replaceOwnerRelations(
      user,
      'purchase_order',
      purchaseOrderId,
      fileIds.map((fileId, index) => ({
        fileId,
        fieldCode: 'attachments',
        relationName: '采购订单附件',
        sort: index,
      })),
    );
  }

  private round(value: number) {
    return Math.round(value * 10000) / 10000;
  }
  private toNumber(value: unknown) {
    return value === null || value === undefined ? 0 : Number(value);
  }
  private optionalNumber(value: unknown) {
    return value === null || value === undefined ? undefined : Number(value);
  }
  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }
}
