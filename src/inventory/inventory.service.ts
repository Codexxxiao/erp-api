// src/inventory/inventory.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryAdjustmentStatus,
  InventoryAdjustmentType,
  InventoryDirection,
  InventoryTransactionType,
  Prisma,
  WarehouseStatus,
} from '../generated/prisma/client';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { QueryWarehouseDto } from './dto/query-warehouse.dto';
import { QueryInventoryBalanceDto } from './dto/query-inventory-balance.dto';
import { QueryInventoryTransactionDto } from './dto/query-inventory-transaction.dto';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { UpdateInventoryAdjustmentDto } from './dto/update-inventory-adjustment.dto';
import { QueryInventoryAdjustmentDto } from './dto/query-inventory-adjustment.dto';
import { InventoryAdjustmentItemInputDto } from './dto/inventory-adjustment-item-input.dto';

type StockMovementInput = {
  type: InventoryTransactionType;
  direction: InventoryDirection;
  sourceType: string;
  sourceId: string;
  sourceItemId?: string;
  reversalOfId?: string;
  productId?: string | null;
  productCode?: string | null;
  productNameCn?: string | null;
  productNameEn?: string | null;
  categoryCode?: string | null;
  unitCode?: string | null;
  warehouseCode?: string | null;
  locationCode?: string | null;
  batchNo?: string | null;
  quantity: number;
  unitCost?: number;
  amount?: number;
  currencyCode?: string | null;
  occurredAt?: Date;
  remark?: string;
  extra?: Record<string, unknown>;
};

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async createWarehouse(user: CurrentUser, dto: CreateWarehouseDto) {
    const tenantId = requireTenantId(user);
    const exists = await this.prisma.warehouse.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });
    if (exists) throw new BadRequestException('仓库编码已存在');

    return this.prisma.warehouse.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        status: dto.status ?? WarehouseStatus.ACTIVE,
        address: dto.address,
        contactName: dto.contactName,
        phone: dto.phone,
        remark: dto.remark,
        extra: this.toJson(dto.extra),
        createdById: user.id,
      },
    });
  }

  async findWarehouses(user: CurrentUser, query: QueryWarehouseDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.WarehouseWhereInput = {
      tenantId,
      status: query.status,
      ...(query.keyword
        ? {
            OR: [
              { code: { contains: query.keyword, mode: 'insensitive' } },
              { name: { contains: query.keyword, mode: 'insensitive' } },
              { address: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.warehouse.count({ where }),
      this.prisma.warehouse.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { total, page, pageSize, list };
  }

  async findWarehouse(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.warehouse.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('仓库不存在');
    return row;
  }

  async updateWarehouse(
    user: CurrentUser,
    id: string,
    dto: UpdateWarehouseDto,
  ) {
    const tenantId = requireTenantId(user);
    await this.ensureWarehouseById(tenantId, id);

    if (dto.code) {
      const exists = await this.prisma.warehouse.findFirst({
        where: { tenantId, code: dto.code, id: { not: id } },
      });
      if (exists) throw new BadRequestException('仓库编码已存在');
    }

    return this.prisma.warehouse.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        status: dto.status,
        address: dto.address,
        contactName: dto.contactName,
        phone: dto.phone,
        remark: dto.remark,
        extra: dto.extra === undefined ? undefined : this.toJson(dto.extra),
        updatedById: user.id,
      },
    });
  }

  async removeWarehouse(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    await this.ensureWarehouseById(tenantId, id);

    return this.prisma.warehouse.update({
      where: { id },
      data: { status: WarehouseStatus.INACTIVE, updatedById: user.id },
    });
  }

  async findBalances(user: CurrentUser, query: QueryInventoryBalanceDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.InventoryBalanceWhereInput = {
      tenantId,
      productId: query.productId,
      productCode: query.productCode,
      warehouseCode: query.warehouseCode,
      locationCode: query.locationCode,
      batchNo: query.batchNo,
      ...(query.keyword
        ? {
            OR: [
              { productCode: { contains: query.keyword, mode: 'insensitive' } },
              {
                productNameCn: { contains: query.keyword, mode: 'insensitive' },
              },
              {
                productNameEn: { contains: query.keyword, mode: 'insensitive' },
              },
              {
                warehouseCode: { contains: query.keyword, mode: 'insensitive' },
              },
              { batchNo: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.inventoryBalance.count({ where }),
      this.prisma.inventoryBalance.findMany({
        where,
        orderBy: [{ warehouseCode: 'asc' }, { productCode: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { total, page, pageSize, list };
  }

  async findTransactions(
    user: CurrentUser,
    query: QueryInventoryTransactionDto,
  ) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.InventoryTransactionWhereInput = {
      tenantId,
      type: query.type,
      direction: query.direction,
      sourceType: query.sourceType,
      sourceId: query.sourceId,
      productId: query.productId,
      productCode: query.productCode,
      warehouseCode: query.warehouseCode,
      ...(query.occurredFrom || query.occurredTo
        ? {
            occurredAt: {
              gte: query.occurredFrom
                ? new Date(query.occurredFrom)
                : undefined,
              lte: query.occurredTo ? new Date(query.occurredTo) : undefined,
            },
          }
        : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.inventoryTransaction.count({ where }),
      this.prisma.inventoryTransaction.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { total, page, pageSize, list };
  }

  async createAdjustment(user: CurrentUser, dto: CreateInventoryAdjustmentDto) {
    const tenantId = requireTenantId(user);

    const adjustment = await this.prisma.$transaction(async (tx) => {
      const adjustmentNo =
        dto.adjustmentNo ?? (await this.generateNoTx(tx, tenantId, 'IA'));
      await this.assertAdjustmentNoUniqueTx(tx, tenantId, adjustmentNo);

      const created = await tx.inventoryAdjustment.create({
        data: {
          tenantId,
          adjustmentNo,
          type: dto.type,
          warehouseCode: dto.warehouseCode,
          reasonCode: dto.reasonCode,
          adjustedAt: dto.adjustedAt ? new Date(dto.adjustedAt) : new Date(),
          remark: dto.remark,
          extra: this.toJson(dto.extra),
          createdById: user.id,
        },
      });

      const rows = await this.normalizeAdjustmentItemsTx(
        tx,
        tenantId,
        created.id,
        dto.warehouseCode,
        dto.items,
      );
      await tx.inventoryAdjustmentItem.createMany({ data: rows });

      await tx.inventoryAdjustment.update({
        where: { id: created.id },
        data: { totalQuantity: this.sum(rows.map((item) => item.quantity)) },
      });

      return created;
    });

    return this.findAdjustment(user, adjustment.id);
  }

  async findAdjustments(user: CurrentUser, query: QueryInventoryAdjustmentDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.InventoryAdjustmentWhereInput = {
      tenantId,
      type: query.type,
      status: query.status,
      warehouseCode: query.warehouseCode,
      ...(query.keyword
        ? {
            OR: [
              {
                adjustmentNo: { contains: query.keyword, mode: 'insensitive' },
              },
              { reasonCode: { contains: query.keyword, mode: 'insensitive' } },
              { remark: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.inventoryAdjustment.count({ where }),
      this.prisma.inventoryAdjustment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { items: true } } },
      }),
    ]);

    return { total, page, pageSize, list };
  }

  async findAdjustment(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    const row = await this.prisma.inventoryAdjustment.findFirst({
      where: { id, tenantId },
      include: { items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
    });
    if (!row) throw new NotFoundException('库存调整单不存在');
    return row;
  }

  async updateAdjustment(
    user: CurrentUser,
    id: string,
    dto: UpdateInventoryAdjustmentDto,
  ) {
    const tenantId = requireTenantId(user);

    await this.prisma.$transaction(async (tx) => {
      const adjustment = await this.ensureAdjustmentTx(tx, tenantId, id);
      if (adjustment.status !== InventoryAdjustmentStatus.DRAFT) {
        throw new BadRequestException('只有草稿调整单允许编辑');
      }

      if (dto.adjustmentNo) {
        await this.assertAdjustmentNoUniqueTx(
          tx,
          tenantId,
          dto.adjustmentNo,
          id,
        );
      }

      await tx.inventoryAdjustment.update({
        where: { id },
        data: {
          adjustmentNo: dto.adjustmentNo,
          type: dto.type,
          warehouseCode: dto.warehouseCode,
          reasonCode: dto.reasonCode,
          adjustedAt: dto.adjustedAt ? new Date(dto.adjustedAt) : undefined,
          remark: dto.remark,
          extra: dto.extra === undefined ? undefined : this.toJson(dto.extra),
          updatedById: user.id,
        },
      });

      if (dto.items !== undefined) {
        await tx.inventoryAdjustmentItem.deleteMany({
          where: { tenantId, adjustmentId: id },
        });
        const rows = await this.normalizeAdjustmentItemsTx(
          tx,
          tenantId,
          id,
          dto.warehouseCode ?? adjustment.warehouseCode ?? undefined,
          dto.items,
        );
        await tx.inventoryAdjustmentItem.createMany({ data: rows });
        await tx.inventoryAdjustment.update({
          where: { id },
          data: { totalQuantity: this.sum(rows.map((item) => item.quantity)) },
        });
      }
    });

    return this.findAdjustment(user, id);
  }

  async confirmAdjustment(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    return this.prisma.$transaction(async (tx) => {
      const adjustment = await this.ensureAdjustmentTx(tx, tenantId, id);
      if (adjustment.status !== InventoryAdjustmentStatus.DRAFT) {
        throw new BadRequestException('只有草稿调整单可以确认');
      }

      const items = await tx.inventoryAdjustmentItem.findMany({
        where: { tenantId, adjustmentId: id },
      });

      for (const item of items) {
        await this.applyMovementTx(tx, tenantId, user.id, {
          type:
            adjustment.type === InventoryAdjustmentType.INCREASE
              ? InventoryTransactionType.ADJUSTMENT_IN
              : InventoryTransactionType.ADJUSTMENT_OUT,
          direction:
            adjustment.type === InventoryAdjustmentType.INCREASE
              ? InventoryDirection.IN
              : InventoryDirection.OUT,
          sourceType: 'inventory_adjustment',
          sourceId: adjustment.id,
          sourceItemId: item.id,
          productId: item.productId,
          productCode: item.productCode,
          productNameCn: item.productNameCn,
          productNameEn: item.productNameEn,
          categoryCode: item.categoryCode,
          unitCode: item.unitCode,
          warehouseCode: item.warehouseCode,
          locationCode: item.locationCode,
          batchNo: item.batchNo,
          quantity: this.toNumber(item.quantity),
          unitCost: this.optionalNumber(item.unitCost),
          amount: this.optionalNumber(item.amount),
          currencyCode: item.currencyCode,
          occurredAt: adjustment.adjustedAt ?? new Date(),
          remark: adjustment.remark ?? undefined,
        });
      }

      return tx.inventoryAdjustment.update({
        where: { id },
        data: {
          status: InventoryAdjustmentStatus.CONFIRMED,
          confirmedAt: new Date(),
          updatedById: user.id,
        },
      });
    });
  }

  async cancelAdjustment(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    return this.prisma.$transaction(async (tx) => {
      const adjustment = await this.ensureAdjustmentTx(tx, tenantId, id);
      if (adjustment.status === InventoryAdjustmentStatus.CONFIRMED) {
        throw new BadRequestException(
          '已确认调整单不能直接取消，请创建反向调整单',
        );
      }

      return tx.inventoryAdjustment.update({
        where: { id },
        data: {
          status: InventoryAdjustmentStatus.CANCELLED,
          cancelledAt: new Date(),
          updatedById: user.id,
        },
      });
    });
  }
  async postOutboundShipment(
    params: {
      tenantId: string;
      userId: string;
      shipmentId: string;
      shipmentNo?: string | null;
      shipmentDate?: Date | null;
      items: Array<{
        shipmentItemId: string;
        productId?: string | null;
        productCode?: string | null;
        productNameCn?: string | null;
        productNameEn?: string | null;
        categoryCode?: string | null;
        unitCode?: string | null;
        warehouseCode?: string | null;
        locationCode?: string | null;
        batchNo?: string | null;
        quantity: number;
        unitCost?: number;
        amount?: number;
        currencyCode?: string | null;
      }>;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const runner = async (client: Prisma.TransactionClient) => {
      for (const item of params.items.filter((row) => row.quantity > 0)) {
        await this.applyMovementTx(client, params.tenantId, params.userId, {
          type: InventoryTransactionType.OUTBOUND_SHIPMENT,
          direction: InventoryDirection.OUT,
          sourceType: 'outbound_shipment',
          sourceId: params.shipmentId,
          sourceItemId: item.shipmentItemId,
          productId: item.productId,
          productCode: item.productCode,
          productNameCn: item.productNameCn,
          productNameEn: item.productNameEn,
          categoryCode: item.categoryCode,
          unitCode: item.unitCode,
          warehouseCode: item.warehouseCode,
          locationCode: item.locationCode,
          batchNo: item.batchNo,
          quantity: item.quantity,
          unitCost: item.unitCost,
          amount: item.amount,
          currencyCode: item.currencyCode,
          occurredAt: params.shipmentDate ?? new Date(),
          remark: `销售出运出库 ${params.shipmentNo ?? ''}`.trim(),
        });
      }
    };

    return tx ? runner(tx) : this.prisma.$transaction(runner);
  }

  async postInboundReceipt(
    params: {
      tenantId: string;
      userId: string;
      receiptId: string;
      receiptNo?: string | null;
      receiptDate?: Date | null;
      items: Array<{
        receiptItemId: string;
        productId?: string | null;
        productCode?: string | null;
        productNameCn?: string | null;
        productNameEn?: string | null;
        categoryCode?: string | null;
        unitCode?: string | null;
        warehouseCode?: string | null;
        locationCode?: string | null;
        batchNo?: string | null;
        quantity: number;
        unitCost?: number;
        amount?: number;
        currencyCode?: string | null;
      }>;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const runner = async (client: Prisma.TransactionClient) => {
      for (const item of params.items.filter((row) => row.quantity > 0)) {
        await this.applyMovementTx(client, params.tenantId, params.userId, {
          type: InventoryTransactionType.INBOUND_RECEIPT,
          direction: InventoryDirection.IN,
          sourceType: 'inbound_receipt',
          sourceId: params.receiptId,
          sourceItemId: item.receiptItemId,
          productId: item.productId,
          productCode: item.productCode,
          productNameCn: item.productNameCn,
          productNameEn: item.productNameEn,
          categoryCode: item.categoryCode,
          unitCode: item.unitCode,
          warehouseCode: item.warehouseCode,
          locationCode: item.locationCode,
          batchNo: item.batchNo,
          quantity: item.quantity,
          unitCost: item.unitCost,
          amount: item.amount,
          currencyCode: item.currencyCode,
          occurredAt: params.receiptDate ?? new Date(),
          remark: `采购收货入库 ${params.receiptNo ?? ''}`.trim(),
        });
      }
    };

    return tx ? runner(tx) : this.prisma.$transaction(runner);
  }

  async reverseSource(
    params: {
      tenantId: string;
      userId: string;
      sourceType: string;
      sourceId: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const runner = async (client: Prisma.TransactionClient) => {
      const transactions = await client.inventoryTransaction.findMany({
        where: {
          tenantId: params.tenantId,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          reversalOfId: null,
          reversedAt: null,
        },
      });

      for (const trx of transactions) {
        await this.applyMovementTx(client, params.tenantId, params.userId, {
          type: InventoryTransactionType.REVERSAL,
          direction:
            trx.direction === InventoryDirection.IN
              ? InventoryDirection.OUT
              : InventoryDirection.IN,
          sourceType: trx.sourceType,
          sourceId: trx.sourceId,
          sourceItemId: trx.sourceItemId ?? undefined,
          reversalOfId: trx.id,
          productId: trx.productId,
          productCode: trx.productCode,
          productNameCn: trx.productNameCn,
          productNameEn: trx.productNameEn,
          categoryCode: trx.categoryCode,
          unitCode: trx.unitCode,
          warehouseCode: trx.warehouseCode,
          locationCode: trx.locationCode,
          batchNo: trx.batchNo,
          quantity: this.toNumber(trx.quantity),
          unitCost: this.optionalNumber(trx.unitCost),
          amount: this.optionalNumber(trx.amount),
          currencyCode: trx.currencyCode,
          occurredAt: new Date(),
          remark: `冲销库存流水 ${trx.transactionNo}`,
        });

        await client.inventoryTransaction.update({
          where: { id: trx.id },
          data: { reversedAt: new Date(), reversedById: params.userId },
        });
      }
    };

    return tx ? runner(tx) : this.prisma.$transaction(runner);
  }

  private async applyMovementTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    input: StockMovementInput,
  ) {
    const productCode = input.productCode?.trim();
    const warehouseCode = input.warehouseCode?.trim();

    if (!productCode) throw new BadRequestException('库存流水缺少产品编码');
    if (!warehouseCode) throw new BadRequestException('库存流水缺少仓库编码');
    if (input.quantity <= 0)
      throw new BadRequestException('库存流水数量必须大于 0');

    await this.ensureActiveWarehouseTx(tx, tenantId, warehouseCode);

    const locationCode = input.locationCode?.trim() ?? '';
    const batchNo = input.batchNo?.trim() ?? '';
    const stockKey = this.buildStockKey(
      input.productId,
      productCode,
      warehouseCode,
      locationCode,
      batchNo,
    );

    const balance = await tx.inventoryBalance.findUnique({
      where: { tenantId_stockKey: { tenantId, stockKey } },
    });

    const oldQuantity = this.toNumber(balance?.quantity);

    if (
      input.direction === InventoryDirection.OUT &&
      oldQuantity < input.quantity
    ) {
      throw new BadRequestException('库存不足，无法出库或冲销');
    }

    const newQuantity = this.round(
      input.direction === InventoryDirection.IN
        ? oldQuantity + input.quantity
        : oldQuantity - input.quantity,
    );

    const lockedQuantity = this.toNumber(balance?.lockedQuantity);
    const availableQuantity = this.round(newQuantity - lockedQuantity);

    if (balance) {
      await tx.inventoryBalance.update({
        where: { id: balance.id },
        data: {
          productNameCn: input.productNameCn ?? balance.productNameCn,
          productNameEn: input.productNameEn ?? balance.productNameEn,
          categoryCode: input.categoryCode ?? balance.categoryCode,
          unitCode: input.unitCode ?? balance.unitCode,
          quantity: newQuantity,
          availableQuantity,
          lastTransactionAt: input.occurredAt ?? new Date(),
        },
      });
    } else {
      await tx.inventoryBalance.create({
        data: {
          tenantId,
          stockKey,
          productId: input.productId,
          productCode,
          productNameCn: input.productNameCn,
          productNameEn: input.productNameEn,
          categoryCode: input.categoryCode,
          unitCode: input.unitCode,
          warehouseCode,
          locationCode,
          batchNo,
          quantity: newQuantity,
          lockedQuantity: 0,
          availableQuantity: newQuantity,
          lastTransactionAt: input.occurredAt ?? new Date(),
        },
      });
    }

    return tx.inventoryTransaction.create({
      data: {
        tenantId,
        transactionNo: await this.generateNoTx(tx, tenantId, 'IT'),
        type: input.type,
        direction: input.direction,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceItemId: input.sourceItemId,
        reversalOfId: input.reversalOfId,
        stockKey,
        productId: input.productId,
        productCode,
        productNameCn: input.productNameCn,
        productNameEn: input.productNameEn,
        categoryCode: input.categoryCode,
        unitCode: input.unitCode,
        warehouseCode,
        locationCode,
        batchNo,
        quantity: input.quantity,
        balanceQuantity: newQuantity,
        unitCost: input.unitCost,
        amount: input.amount,
        currencyCode: input.currencyCode,
        occurredAt: input.occurredAt ?? new Date(),
        remark: input.remark,
        extra: this.toJson(input.extra),
        createdById: userId,
      },
    });
  }

  private async normalizeAdjustmentItemsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    adjustmentId: string,
    headerWarehouseCode: string | undefined,
    items: InventoryAdjustmentItemInputDto[],
  ): Promise<Prisma.InventoryAdjustmentItemCreateManyInput[]> {
    if (items.length === 0)
      throw new BadRequestException('库存调整明细不能为空');

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
    const productMap = new Map(products.map((item) => [item.id, item]));

    const rows: Prisma.InventoryAdjustmentItemCreateManyInput[] = [];

    for (const [index, item] of items.entries()) {
      const product = item.productId
        ? productMap.get(item.productId)
        : undefined;
      if (item.productId && !product)
        throw new BadRequestException('产品不存在或不属于当前租户');

      const productCode = item.productCode ?? product?.code;
      const warehouseCode = item.warehouseCode ?? headerWarehouseCode;

      if (!productCode) throw new BadRequestException('调整明细缺少产品编码');
      if (!warehouseCode) throw new BadRequestException('调整明细缺少仓库编码');

      await this.ensureActiveWarehouseTx(tx, tenantId, warehouseCode);

      const amount =
        item.unitCost === undefined
          ? undefined
          : this.round(item.quantity * item.unitCost);

      rows.push({
        tenantId,
        adjustmentId,
        productId: item.productId,
        productCode,
        productNameCn: item.productNameCn ?? product?.nameCn,
        productNameEn: item.productNameEn ?? product?.nameEn,
        categoryCode: item.categoryCode ?? product?.categoryCode,
        unitCode: item.unitCode ?? product?.unitCode,
        warehouseCode,
        locationCode: item.locationCode ?? '',
        batchNo: item.batchNo ?? '',
        quantity: item.quantity,
        unitCost: item.unitCost,
        amount,
        currencyCode: item.currencyCode ?? product?.currencyCode,
        remark: item.remark,
        extra: this.toJson(item.extra),
        sort: item.sort ?? index,
      });
    }

    return rows;
  }

  private async ensureWarehouseById(tenantId: string, id: string) {
    const row = await this.prisma.warehouse.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('仓库不存在');
    return row;
  }

  private async ensureActiveWarehouseTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    code: string,
  ) {
    const row = await tx.warehouse.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (!row || row.status !== WarehouseStatus.ACTIVE) {
      throw new BadRequestException(`仓库 ${code} 不存在或已停用`);
    }
    return row;
  }

  private async ensureAdjustmentTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const row = await tx.inventoryAdjustment.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('库存调整单不存在');
    return row;
  }

  private async assertAdjustmentNoUniqueTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    adjustmentNo: string,
    excludeId?: string,
  ) {
    const exists = await tx.inventoryAdjustment.findFirst({
      where: {
        tenantId,
        adjustmentNo,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (exists) throw new BadRequestException('库存调整单编号已存在');
  }

  private async generateNoTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    prefix: string,
  ) {
    const no = `${prefix}${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
    const exists =
      prefix === 'IA'
        ? await tx.inventoryAdjustment.findFirst({
            where: { tenantId, adjustmentNo: no },
            select: { id: true },
          })
        : await tx.inventoryTransaction.findFirst({
            where: { tenantId, transactionNo: no },
            select: { id: true },
          });
    return exists ? this.generateNoTx(tx, tenantId, prefix) : no;
  }

  private buildStockKey(
    productId: string | null | undefined,
    productCode: string,
    warehouseCode: string,
    locationCode: string,
    batchNo: string,
  ) {
    return [
      productId ?? productCode,
      warehouseCode,
      locationCode,
      batchNo,
    ].join('|');
  }

  private sum(values: unknown[]) {
    return this.round(
      values.reduce((sum, value) => sum + this.toNumber(value), 0),
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
