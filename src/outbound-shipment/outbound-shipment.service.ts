// src/outbound-shipment/outbound-shipment.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OutboundShipmentItemStatus,
  OutboundShipmentStatus,
  Prisma,
  SalesOrderStatus,
} from '../generated/prisma/client';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../file/file.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateOutboundShipmentDto } from './dto/create-outbound-shipment.dto';
import { UpdateOutboundShipmentDto } from './dto/update-outbound-shipment.dto';
import { QueryOutboundShipmentDto } from './dto/query-outbound-shipment.dto';
import { ReplaceOutboundShipmentItemsDto } from './dto/replace-outbound-shipment-items.dto';
import { CreateOutboundShipmentFromSalesOrderDto } from './dto/create-outbound-shipment-from-sales-order.dto';
import { OutboundShipmentItemInputDto } from './dto/outbound-shipment-item-input.dto';

@Injectable()
export class OutboundShipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
    private readonly inventoryService: InventoryService,
  ) {}

  async create(user: CurrentUser, dto: CreateOutboundShipmentDto) {
    const tenantId = requireTenantId(user);
    this.assertCreateStatus(dto.status);

    const shipment = await this.prisma.$transaction(async (tx) => {
      const created = await this.createShipmentTx(tx, tenantId, user.id, dto);

      if (dto.status === OutboundShipmentStatus.CONFIRMED) {
        await this.applyShipmentTx(tx, tenantId, created.id, user.id);
        await tx.outboundShipment.update({
          where: { id: created.id },
          data: {
            status: OutboundShipmentStatus.CONFIRMED,
            confirmedAt: new Date(),
            updatedById: user.id,
          },
        });
      }

      return created;
    });

    if (dto.attachmentFileIds !== undefined) {
      await this.syncAttachments(user, shipment.id, dto.attachmentFileIds);
    }

    return this.findOne(user, shipment.id);
  }

  async createFromSalesOrder(
    user: CurrentUser,
    salesOrderId: string,
    dto: CreateOutboundShipmentFromSalesOrderDto,
  ) {
    const tenantId = requireTenantId(user);

    const order = await this.prisma.salesOrder.findFirst({
      where: { id: salesOrderId, tenantId },
      include: { items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
    });

    if (!order) throw new NotFoundException('销售订单不存在');
    this.assertSalesOrderShippable(order.status);

    const inputMap = new Map(
      (dto.items ?? []).map((item) => [item.salesOrderItemId, item]),
    );

    const items = order.items
      .filter((item) => inputMap.has(item.id) || (dto.items ?? []).length === 0)
      .map((item) => {
        const override = inputMap.get(item.id);
        const remaining = this.round(
          this.toNumber(item.orderedQuantity) -
            this.toNumber(item.shippedQuantity),
        );

        return {
          salesOrderItemId: item.id,
          shippedQuantity: override?.shippedQuantity ?? remaining,
          warehouseCode: override?.warehouseCode ?? dto.warehouseCode,
          locationCode: override?.locationCode,
          batchNo: override?.batchNo,
          unitPrice: this.optionalNumber(item.unitPrice),
          remark: override?.remark ?? item.remark ?? undefined,
          sort: item.sort,
        };
      })
      .filter((item) => item.shippedQuantity > 0);

    if (items.length === 0) {
      throw new BadRequestException('销售订单没有可出运数量');
    }

    return this.create(user, {
      shipmentNo: dto.shipmentNo,
      salesOrderId,
      status: dto.status,
      shipmentDate: dto.shipmentDate,
      warehouseCode: dto.warehouseCode,
      transportMode: dto.transportMode,
      carrierName: dto.carrierName,
      trackingNo: dto.trackingNo,
      bookingNo: dto.bookingNo,
      containerNo: dto.containerNo,
      blNo: dto.blNo,
      etd: dto.etd,
      eta: dto.eta,
      destinationPort: dto.destinationPort,
      shippingAddress: dto.shippingAddress,
      consigneeName: dto.consigneeName,
      ownerUserId: dto.ownerUserId ?? order.ownerUserId ?? undefined,
      remark: dto.remark,
      extra: dto.extra,
      items,
      attachmentFileIds: dto.attachmentFileIds,
    });
  }

  async findMany(user: CurrentUser, query: QueryOutboundShipmentDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.OutboundShipmentWhereInput = {
      tenantId,
      status: query.status,
      salesOrderId: query.salesOrderId,
      customerId: query.customerId,
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
              { shipmentNo: { contains: query.keyword, mode: 'insensitive' } },
              {
                salesOrderNo: { contains: query.keyword, mode: 'insensitive' },
              },
              {
                customerName: { contains: query.keyword, mode: 'insensitive' },
              },
              { trackingNo: { contains: query.keyword, mode: 'insensitive' } },
              { containerNo: { contains: query.keyword, mode: 'insensitive' } },
              { blNo: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.outboundShipment.count({ where }),
      this.prisma.outboundShipment.findMany({
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

    const shipment = await this.prisma.outboundShipment.findFirst({
      where: { id, tenantId },
      include: { items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
    });

    if (!shipment) throw new NotFoundException('出运单不存在');

    const attachments = await this.fileService.findRelations(user, {
      ownerType: 'outbound_shipment',
      ownerId: shipment.id,
    });

    return { ...shipment, attachments };
  }

  async update(user: CurrentUser, id: string, dto: UpdateOutboundShipmentDto) {
    const tenantId = requireTenantId(user);

    await this.prisma.$transaction(async (tx) => {
      const shipment = await this.ensureTx(tx, tenantId, id);

      if (shipment.status !== OutboundShipmentStatus.DRAFT) {
        throw new BadRequestException('只有草稿出运单允许编辑');
      }

      if (dto.shipmentNo) {
        await this.assertNoUniqueTx(tx, tenantId, dto.shipmentNo, id);
      }

      const salesOrderId = dto.salesOrderId ?? shipment.salesOrderId;
      const order = await this.ensureSalesOrderTx(tx, tenantId, salesOrderId);
      this.assertSalesOrderShippable(order.status);

      await tx.outboundShipment.update({
        where: { id },
        data: {
          shipmentNo: dto.shipmentNo,
          salesOrderId,
          salesOrderNo: order.orderNo,
          customerId: order.customerId,
          customerName: order.customerName,
          shipmentDate: dto.shipmentDate
            ? new Date(dto.shipmentDate)
            : undefined,
          warehouseCode: dto.warehouseCode,
          transportMode: dto.transportMode,
          carrierName: dto.carrierName,
          trackingNo: dto.trackingNo,
          bookingNo: dto.bookingNo,
          containerNo: dto.containerNo,
          blNo: dto.blNo,
          etd: dto.etd ? new Date(dto.etd) : undefined,
          eta: dto.eta ? new Date(dto.eta) : undefined,
          destinationPort: dto.destinationPort,
          shippingAddress: dto.shippingAddress,
          consigneeName: dto.consigneeName,
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
          salesOrderId,
          dto.items,
          dto.warehouseCode ?? shipment.warehouseCode ?? undefined,
        );

        await tx.outboundShipment.update({ where: { id }, data: totals });
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
    dto: ReplaceOutboundShipmentItemsDto,
  ) {
    const tenantId = requireTenantId(user);

    await this.prisma.$transaction(async (tx) => {
      const shipment = await this.ensureTx(tx, tenantId, id);

      if (shipment.status !== OutboundShipmentStatus.DRAFT) {
        throw new BadRequestException('只有草稿出运单允许编辑明细');
      }

      const totals = await this.replaceItemsTx(
        tx,
        tenantId,
        id,
        shipment.salesOrderId,
        dto.items,
        shipment.warehouseCode ?? undefined,
      );

      await tx.outboundShipment.update({
        where: { id },
        data: { ...totals, updatedById: user.id },
      });
    });

    return this.findOne(user, id);
  }

  async confirm(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    return this.prisma.$transaction(async (tx) => {
      const shipment = await this.ensureTx(tx, tenantId, id);

      if (shipment.status !== OutboundShipmentStatus.DRAFT) {
        throw new BadRequestException('只有草稿出运单可以确认');
      }

      await this.applyShipmentTx(tx, tenantId, id, user.id);

      return tx.outboundShipment.update({
        where: { id },
        data: {
          status: OutboundShipmentStatus.CONFIRMED,
          confirmedAt: new Date(),
          updatedById: user.id,
        },
      });
    });
  }

  async markShipped(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    return this.prisma.$transaction(async (tx) => {
      const shipment = await this.ensureTx(tx, tenantId, id);

      if (shipment.status !== OutboundShipmentStatus.CONFIRMED) {
        throw new BadRequestException('只有已确认出运单可以标记已发运');
      }

      return tx.outboundShipment.update({
        where: { id },
        data: {
          status: OutboundShipmentStatus.SHIPPED,
          shippedAt: new Date(),
          updatedById: user.id,
        },
      });
    });
  }

  async cancel(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    return this.prisma.$transaction(async (tx) => {
      const shipment = await this.ensureTx(tx, tenantId, id);

      if (shipment.status === OutboundShipmentStatus.CANCELLED) return shipment;

      if (
        [
          OutboundShipmentStatus.CONFIRMED,
          OutboundShipmentStatus.SHIPPED,
        ].includes(shipment.status)
      ) {
        await this.rollbackShipmentTx(tx, tenantId, id, user.id);
      }

      await tx.outboundShipmentItem.updateMany({
        where: { tenantId, shipmentId: id },
        data: { status: OutboundShipmentItemStatus.CANCELLED },
      });

      return tx.outboundShipment.update({
        where: { id },
        data: {
          status: OutboundShipmentStatus.CANCELLED,
          cancelledAt: new Date(),
          updatedById: user.id,
        },
      });
    });
  }

  async remove(user: CurrentUser, id: string) {
    return this.cancel(user, id);
  }

  private async createShipmentTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    dto: CreateOutboundShipmentDto,
  ) {
    const order = await this.ensureSalesOrderTx(tx, tenantId, dto.salesOrderId);
    this.assertSalesOrderShippable(order.status);

    const shipmentNo =
      dto.shipmentNo ?? (await this.generateNoTx(tx, tenantId));
    await this.assertNoUniqueTx(tx, tenantId, shipmentNo);

    const created = await tx.outboundShipment.create({
      data: {
        tenantId,
        shipmentNo,
        salesOrderId: order.id,
        salesOrderNo: order.orderNo,
        customerId: order.customerId,
        customerName: order.customerName,
        status: OutboundShipmentStatus.DRAFT,
        shipmentDate: dto.shipmentDate
          ? new Date(dto.shipmentDate)
          : new Date(),
        warehouseCode: dto.warehouseCode,
        transportMode: dto.transportMode,
        carrierName: dto.carrierName,
        trackingNo: dto.trackingNo,
        bookingNo: dto.bookingNo,
        containerNo: dto.containerNo,
        blNo: dto.blNo,
        etd: dto.etd ? new Date(dto.etd) : undefined,
        eta: dto.eta ? new Date(dto.eta) : undefined,
        destinationPort: dto.destinationPort,
        shippingAddress: dto.shippingAddress,
        consigneeName: dto.consigneeName,
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

    await tx.outboundShipment.update({
      where: { id: created.id },
      data: totals,
    });

    return created;
  }

  private async replaceItemsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    shipmentId: string,
    salesOrderId: string,
    items: OutboundShipmentItemInputDto[],
    headerWarehouseCode?: string,
  ) {
    await tx.outboundShipmentItem.deleteMany({
      where: { tenantId, shipmentId },
    });

    const rows = await this.normalizeItemsTx(
      tx,
      tenantId,
      shipmentId,
      salesOrderId,
      items,
      headerWarehouseCode,
    );

    await tx.outboundShipmentItem.createMany({ data: rows });
    return this.calculateTotals(rows);
  }

  private async normalizeItemsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    shipmentId: string,
    salesOrderId: string,
    items: OutboundShipmentItemInputDto[],
    headerWarehouseCode?: string,
  ): Promise<Prisma.OutboundShipmentItemCreateManyInput[]> {
    if (items.length === 0) throw new BadRequestException('出运单明细不能为空');

    const orderItemIds = Array.from(
      new Set(items.map((item) => item.salesOrderItemId)),
    );

    const orderItems = await tx.salesOrderItem.findMany({
      where: { tenantId, orderId: salesOrderId, id: { in: orderItemIds } },
    });

    if (orderItems.length !== orderItemIds.length) {
      throw new BadRequestException('存在无效销售订单明细');
    }

    const orderItemMap = new Map(orderItems.map((item) => [item.id, item]));

    return items.map((item, index) => {
      const orderItem = orderItemMap.get(item.salesOrderItemId)!;
      const remaining = this.round(
        this.toNumber(orderItem.orderedQuantity) -
          this.toNumber(orderItem.shippedQuantity),
      );

      if (item.shippedQuantity > remaining) {
        throw new BadRequestException('出运数量不能大于销售订单剩余可出运数量');
      }

      const warehouseCode = item.warehouseCode ?? headerWarehouseCode;
      if (!warehouseCode) throw new BadRequestException('出运明细缺少仓库编码');

      const unitPrice =
        item.unitPrice ?? this.optionalNumber(orderItem.unitPrice);
      const amount = this.round(item.shippedQuantity * (unitPrice ?? 0));

      return {
        tenantId,
        shipmentId,
        salesOrderItemId: orderItem.id,
        productId: orderItem.productId,
        productCode: orderItem.productCode,
        productNameCn: orderItem.productNameCn,
        productNameEn: orderItem.productNameEn,
        categoryCode: orderItem.categoryCode,
        unitCode: orderItem.unitCode,
        warehouseCode,
        locationCode: item.locationCode ?? '',
        batchNo: item.batchNo ?? '',
        shippedQuantity: item.shippedQuantity,
        unitPrice,
        amount,
        currencyCode: orderItem.currencyCode,
        status: OutboundShipmentItemStatus.NORMAL,
        remark: item.remark,
        extra: this.toJson(item.extra),
        sort: item.sort ?? index,
      };
    });
  }

  private async applyShipmentTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    shipmentId: string,
    userId: string,
  ) {
    const shipment = await tx.outboundShipment.findFirst({
      where: { id: shipmentId, tenantId },
    });

    if (!shipment) throw new NotFoundException('出运单不存在');

    const items = await tx.outboundShipmentItem.findMany({
      where: {
        tenantId,
        shipmentId,
        status: OutboundShipmentItemStatus.NORMAL,
      },
    });

    if (items.length === 0) throw new BadRequestException('出运单明细不能为空');

    await this.inventoryService.postOutboundShipment(
      {
        tenantId,
        userId,
        shipmentId,
        shipmentNo: shipment.shipmentNo,
        shipmentDate: shipment.shipmentDate,
        items: items.map((item) => ({
          shipmentItemId: item.id,
          productId: item.productId,
          productCode: item.productCode,
          productNameCn: item.productNameCn,
          productNameEn: item.productNameEn,
          categoryCode: item.categoryCode,
          unitCode: item.unitCode,
          warehouseCode: item.warehouseCode,
          locationCode: item.locationCode,
          batchNo: item.batchNo,
          quantity: this.toNumber(item.shippedQuantity),
          unitCost: this.optionalNumber(item.unitPrice),
          amount: this.optionalNumber(item.amount),
          currencyCode: item.currencyCode,
        })),
      },
      tx,
    );

    for (const item of items) {
      const orderItem = await tx.salesOrderItem.findFirst({
        where: { id: item.salesOrderItemId, tenantId },
      });

      if (!orderItem) throw new BadRequestException('销售订单明细不存在');

      const shippedQuantity = this.round(
        this.toNumber(orderItem.shippedQuantity) +
          this.toNumber(item.shippedQuantity),
      );

      if (shippedQuantity > this.toNumber(orderItem.orderedQuantity)) {
        throw new BadRequestException('累计出运数量不能大于销售订单数量');
      }

      await tx.salesOrderItem.update({
        where: { id: orderItem.id },
        data: { shippedQuantity },
      });
    }

    await this.recalculateSalesOrderStatusTx(
      tx,
      tenantId,
      shipment.salesOrderId,
      userId,
    );
  }

  private async rollbackShipmentTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    shipmentId: string,
    userId: string,
  ) {
    const shipment = await tx.outboundShipment.findFirst({
      where: { id: shipmentId, tenantId },
    });

    if (!shipment) throw new NotFoundException('出运单不存在');

    await this.inventoryService.reverseSource(
      {
        tenantId,
        userId,
        sourceType: 'outbound_shipment',
        sourceId: shipmentId,
      },
      tx,
    );

    const items = await tx.outboundShipmentItem.findMany({
      where: {
        tenantId,
        shipmentId,
        status: OutboundShipmentItemStatus.NORMAL,
      },
    });

    for (const item of items) {
      const orderItem = await tx.salesOrderItem.findFirst({
        where: { id: item.salesOrderItemId, tenantId },
      });

      if (!orderItem) continue;

      const shippedQuantity = Math.max(
        0,
        this.round(
          this.toNumber(orderItem.shippedQuantity) -
            this.toNumber(item.shippedQuantity),
        ),
      );

      await tx.salesOrderItem.update({
        where: { id: orderItem.id },
        data: { shippedQuantity },
      });
    }

    await this.recalculateSalesOrderStatusTx(
      tx,
      tenantId,
      shipment.salesOrderId,
      userId,
    );
  }

  private async recalculateSalesOrderStatusTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    salesOrderId: string,
    userId: string,
  ) {
    const items = await tx.salesOrderItem.findMany({
      where: { tenantId, orderId: salesOrderId },
    });

    const allShipped =
      items.length > 0 &&
      items.every(
        (item) =>
          this.toNumber(item.shippedQuantity) >=
          this.toNumber(item.orderedQuantity),
      );

    const anyShipped = items.some(
      (item) => this.toNumber(item.shippedQuantity) > 0,
    );

    const status = allShipped
      ? SalesOrderStatus.SHIPPED
      : anyShipped
        ? SalesOrderStatus.PROCESSING
        : SalesOrderStatus.CONFIRMED;

    await tx.salesOrder.update({
      where: { id: salesOrderId },
      data: {
        status,
        shippedAt: status === SalesOrderStatus.SHIPPED ? new Date() : undefined,
        processingAt:
          status === SalesOrderStatus.PROCESSING ? new Date() : undefined,
        updatedById: userId,
      },
    });
  }

  private async ensureSalesOrderTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const order = await tx.salesOrder.findFirst({ where: { id, tenantId } });
    if (!order) throw new NotFoundException('销售订单不存在');
    return order;
  }

  private assertSalesOrderShippable(status: SalesOrderStatus) {
    if (
      ![
        SalesOrderStatus.CONFIRMED,
        SalesOrderStatus.PROCESSING,
        SalesOrderStatus.SHIPPED,
      ].includes(status)
    ) {
      throw new BadRequestException('当前销售订单状态不允许出运');
    }
  }

  private assertCreateStatus(status?: OutboundShipmentStatus) {
    if (
      [
        OutboundShipmentStatus.SHIPPED,
        OutboundShipmentStatus.CANCELLED,
      ].includes(status as OutboundShipmentStatus)
    ) {
      throw new BadRequestException('创建出运单时不能直接创建为已发运或已取消');
    }
  }

  private calculateTotals(
    items: Array<{ shippedQuantity: unknown; amount: unknown }>,
  ) {
    return {
      totalShippedQuantity: this.round(
        items.reduce(
          (sum, item) => sum + this.toNumber(item.shippedQuantity),
          0,
        ),
      ),
      totalAmount: this.round(
        items.reduce((sum, item) => sum + this.toNumber(item.amount), 0),
      ),
    };
  }

  private async ensureTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const shipment = await tx.outboundShipment.findFirst({
      where: { id, tenantId },
    });
    if (!shipment) throw new NotFoundException('出运单不存在');
    return shipment;
  }

  private async assertNoUniqueTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    shipmentNo: string,
    excludeId?: string,
  ) {
    const exists = await tx.outboundShipment.findFirst({
      where: {
        tenantId,
        shipmentNo,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (exists) throw new BadRequestException('出运单编号已存在');
  }

  private async generateNoTx(tx: Prisma.TransactionClient, tenantId: string) {
    const no = `OS${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
    const exists = await tx.outboundShipment.findFirst({
      where: { tenantId, shipmentNo: no },
      select: { id: true },
    });
    return exists ? this.generateNoTx(tx, tenantId) : no;
  }

  private async syncAttachments(
    user: CurrentUser,
    shipmentId: string,
    fileIds: string[],
  ) {
    await this.fileService.replaceOwnerRelations(
      user,
      'outbound_shipment',
      shipmentId,
      fileIds.map((fileId, index) => ({
        fileId,
        fieldCode: 'attachments',
        relationName: '出运单附件',
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
