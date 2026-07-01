// src/inbound-receipt/inbound-receipt.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InboundReceiptItemStatus,
  InboundReceiptStatus,
  Prisma,
  PurchaseOrderItemStatus,
  PurchaseOrderStatus,
} from '../generated/prisma/client';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../file/file.service';
import { CreateInboundReceiptDto } from './dto/create-inbound-receipt.dto';
import { UpdateInboundReceiptDto } from './dto/update-inbound-receipt.dto';
import { QueryInboundReceiptDto } from './dto/query-inbound-receipt.dto';
import { ReplaceInboundReceiptItemsDto } from './dto/replace-inbound-receipt-items.dto';
import { CreateInboundReceiptFromPoDto } from './dto/create-inbound-receipt-from-po.dto';
import { InboundReceiptItemInputDto } from './dto/inbound-receipt-item-input.dto';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class InboundReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
    private readonly inventoryService: InventoryService,
  ) {}

  async create(user: CurrentUser, dto: CreateInboundReceiptDto) {
    const tenantId = requireTenantId(user);
    this.assertCreateStatus(dto.status);

    const receipt = await this.prisma.$transaction(async (tx) => {
      const created = await this.createReceiptTx(tx, tenantId, user.id, dto);

      if (dto.status === InboundReceiptStatus.CONFIRMED) {
        await this.applyReceiptTx(tx, tenantId, created.id, user.id);
        await tx.inboundReceipt.update({
          where: { id: created.id },
          data: {
            status: InboundReceiptStatus.CONFIRMED,
            confirmedAt: new Date(),
            updatedById: user.id,
          },
        });
      }

      return created;
    });

    if (dto.attachmentFileIds !== undefined) {
      await this.syncAttachments(user, receipt.id, dto.attachmentFileIds);
    }

    return this.findOne(user, receipt.id);
  }

  async createFromPurchaseOrder(
    user: CurrentUser,
    purchaseOrderId: string,
    dto: CreateInboundReceiptFromPoDto,
  ) {
    const tenantId = requireTenantId(user);

    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, tenantId },
      include: { items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
    });

    if (!order) throw new NotFoundException('采购订单不存在');
    this.assertPurchaseOrderReceivable(order.status);

    const inputMap = new Map(
      (dto.items ?? []).map((item) => [item.purchaseOrderItemId, item]),
    );

    const items = order.items
      .filter((item) => inputMap.has(item.id) || (dto.items ?? []).length === 0)
      .map((item) => {
        const override = inputMap.get(item.id);
        const remaining = this.round(
          this.toNumber(item.purchaseQuantity) -
            this.toNumber(item.receivedQuantity),
        );

        return {
          purchaseOrderItemId: item.id,
          receivedQuantity: override?.receivedQuantity ?? remaining,
          qualifiedQuantity:
            override?.qualifiedQuantity ??
            override?.receivedQuantity ??
            remaining,
          rejectedQuantity: override?.rejectedQuantity ?? 0,
          unitPrice: this.optionalNumber(item.unitPrice),
          batchNo: override?.batchNo,
          warehouseCode: override?.warehouseCode ?? dto.warehouseCode,
          locationCode: override?.locationCode,
          remark: override?.remark,
          sort: item.sort,
        };
      })
      .filter((item) => item.receivedQuantity > 0);

    if (items.length === 0) {
      throw new BadRequestException('采购订单没有可收货数量');
    }

    return this.create(user, {
      receiptNo: dto.receiptNo,
      purchaseOrderId,
      supplierId: order.supplierId ?? undefined,
      supplierName: order.supplierName ?? undefined,
      status: dto.status,
      receiptDate: dto.receiptDate,
      warehouseCode: dto.warehouseCode,
      ownerUserId: dto.ownerUserId ?? order.ownerUserId ?? undefined,
      remark: dto.remark,
      extra: dto.extra,
      items,
      attachmentFileIds: dto.attachmentFileIds,
    });
  }

  async findMany(user: CurrentUser, query: QueryInboundReceiptDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.InboundReceiptWhereInput = {
      tenantId,
      status: query.status,
      purchaseOrderId: query.purchaseOrderId,
      supplierId: query.supplierId,
      warehouseCode: query.warehouseCode,
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
              { receiptNo: { contains: query.keyword, mode: 'insensitive' } },
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
      this.prisma.inboundReceipt.count({ where }),
      this.prisma.inboundReceipt.findMany({
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

    const receipt = await this.prisma.inboundReceipt.findFirst({
      where: { id, tenantId },
      include: { items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
    });

    if (!receipt) throw new NotFoundException('收货单不存在');

    const attachments = await this.fileService.findRelations(user, {
      ownerType: 'inbound_receipt',
      ownerId: receipt.id,
    });

    return { ...receipt, attachments };
  }

  async update(user: CurrentUser, id: string, dto: UpdateInboundReceiptDto) {
    const tenantId = requireTenantId(user);

    await this.prisma.$transaction(async (tx) => {
      const receipt = await this.ensureTx(tx, tenantId, id);
      if (receipt.status !== InboundReceiptStatus.DRAFT) {
        throw new BadRequestException('只有草稿收货单允许编辑');
      }

      if (dto.receiptNo) {
        await this.assertNoUniqueTx(tx, tenantId, dto.receiptNo, id);
      }

      const purchaseOrderId = dto.purchaseOrderId ?? receipt.purchaseOrderId;
      const order = await this.ensurePurchaseOrderTx(
        tx,
        tenantId,
        purchaseOrderId,
      );
      this.assertPurchaseOrderReceivable(order.status);

      await tx.inboundReceipt.update({
        where: { id },
        data: {
          receiptNo: dto.receiptNo,
          purchaseOrderId,
          purchaseOrderNo: order.purchaseOrderNo,
          supplierId: dto.supplierId ?? order.supplierId,
          supplierName: dto.supplierName ?? order.supplierName,
          receiptDate: dto.receiptDate ? new Date(dto.receiptDate) : undefined,
          warehouseCode: dto.warehouseCode,
          ownerUserId: dto.ownerUserId,
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
          purchaseOrderId,
          dto.items,
          dto.warehouseCode ?? receipt.warehouseCode ?? undefined,
        );

        await tx.inboundReceipt.update({ where: { id }, data: totals });
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
    dto: ReplaceInboundReceiptItemsDto,
  ) {
    const tenantId = requireTenantId(user);

    await this.prisma.$transaction(async (tx) => {
      const receipt = await this.ensureTx(tx, tenantId, id);
      if (receipt.status !== InboundReceiptStatus.DRAFT) {
        throw new BadRequestException('只有草稿收货单允许编辑明细');
      }

      const totals = await this.replaceItemsTx(
        tx,
        tenantId,
        id,
        receipt.purchaseOrderId,
        dto.items,
        receipt.warehouseCode ?? undefined,
      );

      await tx.inboundReceipt.update({
        where: { id },
        data: { ...totals, updatedById: user.id },
      });
    });

    return this.findOne(user, id);
  }

  async confirm(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    return this.prisma.$transaction(async (tx) => {
      const receipt = await this.ensureTx(tx, tenantId, id);

      if (receipt.status !== InboundReceiptStatus.DRAFT) {
        throw new BadRequestException('只有草稿收货单可以确认');
      }

      await this.applyReceiptTx(tx, tenantId, id, user.id);

      return tx.inboundReceipt.update({
        where: { id },
        data: {
          status: InboundReceiptStatus.CONFIRMED,
          confirmedAt: new Date(),
          updatedById: user.id,
        },
      });
    });
  }

  async cancel(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    return this.prisma.$transaction(async (tx) => {
      const receipt = await this.ensureTx(tx, tenantId, id);

      if (receipt.status === InboundReceiptStatus.CANCELLED) return receipt;

      if (receipt.status === InboundReceiptStatus.CONFIRMED) {
        await this.rollbackReceiptTx(tx, tenantId, id, user.id);
      }

      await tx.inboundReceiptItem.updateMany({
        where: { tenantId, receiptId: id },
        data: { status: InboundReceiptItemStatus.CANCELLED },
      });

      return tx.inboundReceipt.update({
        where: { id },
        data: {
          status: InboundReceiptStatus.CANCELLED,
          cancelledAt: new Date(),
          updatedById: user.id,
        },
      });
    });
  }

  async remove(user: CurrentUser, id: string) {
    return this.cancel(user, id);
  }

  private async createReceiptTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    dto: CreateInboundReceiptDto,
  ) {
    const order = await this.ensurePurchaseOrderTx(
      tx,
      tenantId,
      dto.purchaseOrderId,
    );
    this.assertPurchaseOrderReceivable(order.status);

    const receiptNo = dto.receiptNo ?? (await this.generateNoTx(tx, tenantId));
    await this.assertNoUniqueTx(tx, tenantId, receiptNo);

    const created = await tx.inboundReceipt.create({
      data: {
        tenantId,
        receiptNo,
        purchaseOrderId: order.id,
        purchaseOrderNo: order.purchaseOrderNo,
        supplierId: dto.supplierId ?? order.supplierId,
        supplierName: dto.supplierName ?? order.supplierName,
        status: InboundReceiptStatus.DRAFT,
        receiptDate: dto.receiptDate ? new Date(dto.receiptDate) : new Date(),
        warehouseCode: dto.warehouseCode,
        ownerUserId: dto.ownerUserId,
        remark: dto.remark,
        extra: this.toJson(dto.extra),
        createdById: userId,
      },
    });

    const totals = await this.replaceItemsTx(
      tx,
      tenantId,
      created.id,
      order.id,
      dto.items,
      dto.warehouseCode,
    );

    await tx.inboundReceipt.update({
      where: { id: created.id },
      data: totals,
    });

    return created;
  }

  private async replaceItemsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    receiptId: string,
    purchaseOrderId: string,
    items: InboundReceiptItemInputDto[],
    headerWarehouseCode?: string,
  ) {
    await tx.inboundReceiptItem.deleteMany({ where: { tenantId, receiptId } });

    const rows = await this.normalizeItemsTx(
      tx,
      tenantId,
      receiptId,
      purchaseOrderId,
      items,
      headerWarehouseCode,
    );

    await tx.inboundReceiptItem.createMany({ data: rows });
    return this.calculateTotals(rows);
  }

  private async normalizeItemsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    receiptId: string,
    purchaseOrderId: string,
    items: InboundReceiptItemInputDto[],
    headerWarehouseCode?: string,
  ): Promise<Prisma.InboundReceiptItemCreateManyInput[]> {
    if (items.length === 0) {
      throw new BadRequestException('收货单明细不能为空');
    }

    const poItemIds = Array.from(
      new Set(items.map((item) => item.purchaseOrderItemId)),
    );

    const poItems = await tx.purchaseOrderItem.findMany({
      where: { tenantId, purchaseOrderId, id: { in: poItemIds } },
    });

    if (poItems.length !== poItemIds.length) {
      throw new BadRequestException('存在无效采购订单明细');
    }

    const poItemMap = new Map(poItems.map((item) => [item.id, item]));

    return items.map((item, index) => {
      const poItem = poItemMap.get(item.purchaseOrderItemId)!;
      const remaining = this.round(
        this.toNumber(poItem.purchaseQuantity) -
          this.toNumber(poItem.receivedQuantity),
      );

      if (item.receivedQuantity > remaining) {
        throw new BadRequestException('收货数量不能大于采购订单剩余数量');
      }

      const rejectedQuantity = item.rejectedQuantity ?? 0;
      const qualifiedQuantity =
        item.qualifiedQuantity ??
        this.round(item.receivedQuantity - rejectedQuantity);

      if (qualifiedQuantity + rejectedQuantity > item.receivedQuantity) {
        throw new BadRequestException('合格数量与不合格数量不能超过收货数量');
      }

      const unitPrice = item.unitPrice ?? this.optionalNumber(poItem.unitPrice);
      const amount = this.round(item.receivedQuantity * (unitPrice ?? 0));

      return {
        tenantId,
        receiptId,
        purchaseOrderItemId: poItem.id,
        productId: poItem.productId,
        productCode: poItem.productCode,
        productNameCn: poItem.productNameCn,
        productNameEn: poItem.productNameEn,
        categoryCode: poItem.categoryCode,
        unitCode: poItem.unitCode,
        receivedQuantity: item.receivedQuantity,
        qualifiedQuantity,
        rejectedQuantity,
        unitPrice,
        amount,
        currencyCode: poItem.currencyCode,
        batchNo: item.batchNo,
        warehouseCode: item.warehouseCode ?? headerWarehouseCode,
        locationCode: item.locationCode,
        status: InboundReceiptItemStatus.NORMAL,
        remark: item.remark,
        extra: this.toJson(item.extra),
        sort: item.sort ?? index,
      };
    });
  }

  private async applyReceiptTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    receiptId: string,
    userId: string,
  ) {
    const items = await tx.inboundReceiptItem.findMany({
      where: { tenantId, receiptId, status: InboundReceiptItemStatus.NORMAL },
    });

    if (items.length === 0) {
      throw new BadRequestException('收货单明细不能为空');
    }

    let purchaseOrderId: string | undefined;

    for (const item of items) {
      const poItem = await tx.purchaseOrderItem.findFirst({
        where: { id: item.purchaseOrderItemId, tenantId },
      });

      if (!poItem) throw new BadRequestException('采购订单明细不存在');

      purchaseOrderId = poItem.purchaseOrderId;

      const receivedQuantity = this.round(
        this.toNumber(poItem.receivedQuantity) +
          this.toNumber(item.receivedQuantity),
      );

      if (receivedQuantity > this.toNumber(poItem.purchaseQuantity)) {
        throw new BadRequestException('累计收货数量不能大于采购数量');
      }

      await tx.purchaseOrderItem.update({
        where: { id: poItem.id },
        data: {
          receivedQuantity,
          status: this.resolvePoItemStatus(
            this.toNumber(poItem.purchaseQuantity),
            receivedQuantity,
          ),
        },
      });
    }

    const receipt = await tx.inboundReceipt.findFirst({
      where: { id: receiptId, tenantId },
    });

    if (!receipt) throw new NotFoundException('收货单不存在');

    await this.inventoryService.postInboundReceipt(
      {
        tenantId,
        userId,
        receiptId,
        receiptNo: receipt.receiptNo,
        receiptDate: receipt.receiptDate,
        items: items.map((item) => ({
          receiptItemId: item.id,
          productId: item.productId,
          productCode: item.productCode,
          productNameCn: item.productNameCn,
          productNameEn: item.productNameEn,
          categoryCode: item.categoryCode,
          unitCode: item.unitCode,
          warehouseCode: item.warehouseCode ?? receipt.warehouseCode,
          locationCode: item.locationCode,
          batchNo: item.batchNo,
          quantity: this.toNumber(item.qualifiedQuantity),
          unitCost: this.optionalNumber(item.unitPrice),
          amount: this.optionalNumber(item.amount),
          currencyCode: item.currencyCode,
        })),
      },
      tx,
    );

    if (purchaseOrderId) {
      await this.recalculatePurchaseOrderStatusTx(
        tx,
        tenantId,
        purchaseOrderId,
        userId,
      );
    }
  }

  private async rollbackReceiptTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    receiptId: string,
    userId: string,
  ) {
    await this.inventoryService.reverseSource(
      {
        tenantId,
        userId,
        sourceType: 'inbound_receipt',
        sourceId: receiptId,
      },
      tx,
    );

    const items = await tx.inboundReceiptItem.findMany({
      where: { tenantId, receiptId, status: InboundReceiptItemStatus.NORMAL },
    });

    let purchaseOrderId: string | undefined;

    for (const item of items) {
      const poItem = await tx.purchaseOrderItem.findFirst({
        where: { id: item.purchaseOrderItemId, tenantId },
      });

      if (!poItem) continue;

      purchaseOrderId = poItem.purchaseOrderId;

      const receivedQuantity = Math.max(
        0,
        this.round(
          this.toNumber(poItem.receivedQuantity) -
            this.toNumber(item.receivedQuantity),
        ),
      );

      await tx.purchaseOrderItem.update({
        where: { id: poItem.id },
        data: {
          receivedQuantity,
          status: this.resolvePoItemStatus(
            this.toNumber(poItem.purchaseQuantity),
            receivedQuantity,
          ),
        },
      });
    }

    if (purchaseOrderId) {
      await this.recalculatePurchaseOrderStatusTx(
        tx,
        tenantId,
        purchaseOrderId,
        userId,
      );
    }
  }

  private async recalculatePurchaseOrderStatusTx(
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
        : items.some((item) =>
              [
                PurchaseOrderItemStatus.PARTIALLY_RECEIVED,
                PurchaseOrderItemStatus.RECEIVED,
              ].includes(item.status),
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

  private calculateTotals(
    items: Array<{
      receivedQuantity: unknown;
      qualifiedQuantity: unknown;
      rejectedQuantity: unknown;
      amount: unknown;
    }>,
  ) {
    return {
      totalReceivedQuantity: this.round(
        items.reduce(
          (sum, item) => sum + this.toNumber(item.receivedQuantity),
          0,
        ),
      ),
      totalQualifiedQuantity: this.round(
        items.reduce(
          (sum, item) => sum + this.toNumber(item.qualifiedQuantity),
          0,
        ),
      ),
      totalRejectedQuantity: this.round(
        items.reduce(
          (sum, item) => sum + this.toNumber(item.rejectedQuantity),
          0,
        ),
      ),
      totalAmount: this.round(
        items.reduce((sum, item) => sum + this.toNumber(item.amount), 0),
      ),
    };
  }

  private async ensurePurchaseOrderTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const order = await tx.purchaseOrder.findFirst({ where: { id, tenantId } });
    if (!order) throw new NotFoundException('采购订单不存在');
    return order;
  }

  private assertPurchaseOrderReceivable(status: PurchaseOrderStatus) {
    if (
      ![
        PurchaseOrderStatus.CONFIRMED,
        PurchaseOrderStatus.SENT,
        PurchaseOrderStatus.PARTIALLY_RECEIVED,
      ].includes(status)
    ) {
      throw new BadRequestException('当前采购订单状态不允许收货');
    }
  }

  private assertCreateStatus(status?: InboundReceiptStatus) {
    if (status === InboundReceiptStatus.CANCELLED) {
      throw new BadRequestException('创建收货单时不能直接创建为已取消');
    }
  }

  private resolvePoItemStatus(quantity: number, receivedQuantity: number) {
    if (receivedQuantity <= 0) return PurchaseOrderItemStatus.OPEN;
    if (receivedQuantity >= quantity) return PurchaseOrderItemStatus.RECEIVED;
    return PurchaseOrderItemStatus.PARTIALLY_RECEIVED;
  }

  private async ensureTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const receipt = await tx.inboundReceipt.findFirst({
      where: { id, tenantId },
    });
    if (!receipt) throw new NotFoundException('收货单不存在');
    return receipt;
  }

  private async assertNoUniqueTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    receiptNo: string,
    excludeId?: string,
  ) {
    const exists = await tx.inboundReceipt.findFirst({
      where: {
        tenantId,
        receiptNo,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (exists) throw new BadRequestException('收货单编号已存在');
  }

  private async generateNoTx(tx: Prisma.TransactionClient, tenantId: string) {
    const no = `IR${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
    const exists = await tx.inboundReceipt.findFirst({
      where: { tenantId, receiptNo: no },
      select: { id: true },
    });
    return exists ? this.generateNoTx(tx, tenantId) : no;
  }

  private async syncAttachments(
    user: CurrentUser,
    receiptId: string,
    fileIds: string[],
  ) {
    await this.fileService.replaceOwnerRelations(
      user,
      'inbound_receipt',
      receiptId,
      fileIds.map((fileId, index) => ({
        fileId,
        fieldCode: 'attachments',
        relationName: '收货单附件',
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
