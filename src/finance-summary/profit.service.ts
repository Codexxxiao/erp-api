import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AccountsPayableStatus,
  AccountsReceivableStatus,
  InboundReceiptStatus,
  OutboundShipmentStatus,
  Prisma,
  PurchaseOrderStatus,
} from '../generated/prisma/client';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { QueryProfitDto } from './dto/query-profit.dto';
import { QueryProfitOverviewDto } from './dto/query-profit-overview.dto';

@Injectable()
export class ProfitService {
  constructor(private readonly prisma: PrismaService) {}

  async findSalesOrderProfits(user: CurrentUser, query: QueryProfitDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.SalesOrderWhereInput = {
      tenantId,
      status: query.status,
      customerId: query.customerId,
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
              { orderNo: { contains: query.keyword, mode: 'insensitive' } },
              { subject: { contains: query.keyword, mode: 'insensitive' } },
              {
                customerName: { contains: query.keyword, mode: 'insensitive' },
              },
            ],
          }
        : {}),
    };

    const [total, orders] = await this.prisma.$transaction([
      this.prisma.salesOrder.count({ where }),
      this.prisma.salesOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const list = await this.buildProfitRows(tenantId, orders);
    return { total, page, pageSize, list };
  }

  async findSalesOrderProfit(user: CurrentUser, salesOrderId: string) {
    const tenantId = requireTenantId(user);
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: salesOrderId, tenantId },
    });

    if (!order) throw new NotFoundException('销售订单不存在');

    const [row] = await this.buildProfitRows(tenantId, [order]);
    return row;
  }

  async overview(user: CurrentUser, query: QueryProfitOverviewDto) {
    const tenantId = requireTenantId(user);

    const orders = await this.prisma.salesOrder.findMany({
      where: {
        tenantId,
        customerId: query.customerId,
        currencyCode: query.currencyCode,
        ...(query.createdFrom || query.createdTo
          ? {
              createdAt: {
                gte: query.createdFrom
                  ? new Date(query.createdFrom)
                  : undefined,
                lte: query.createdTo ? new Date(query.createdTo) : undefined,
              },
            }
          : {}),
      },
    });

    const rows = await this.buildProfitRows(tenantId, orders);

    return {
      salesOrderCount: rows.length,
      salesAmount: this.sum(rows.map((row) => row.salesAmount)),
      shippedAmount: this.sum(rows.map((row) => row.shippedAmount)),
      receivableAmount: this.sum(rows.map((row) => row.receivableAmount)),
      receivedAmount: this.sum(rows.map((row) => row.receivedAmount)),
      receivableOutstandingAmount: this.sum(
        rows.map((row) => row.receivableOutstandingAmount),
      ),
      purchaseCostAmount: this.sum(rows.map((row) => row.purchaseCostAmount)),
      inboundCostAmount: this.sum(rows.map((row) => row.inboundCostAmount)),
      payableAmount: this.sum(rows.map((row) => row.payableAmount)),
      paidAmount: this.sum(rows.map((row) => row.paidAmount)),
      payableOutstandingAmount: this.sum(
        rows.map((row) => row.payableOutstandingAmount),
      ),
      grossProfitAmount: this.sum(rows.map((row) => row.grossProfitAmount)),
      cashProfitAmount: this.sum(rows.map((row) => row.cashProfitAmount)),
      grossMarginRate: this.rate(
        this.sum(rows.map((row) => row.grossProfitAmount)),
        this.sum(rows.map((row) => row.salesAmount)),
      ),
    };
  }

  private async buildProfitRows(tenantId: string, orders: any[]) {
    const orderIds = orders.map((item) => item.id);
    if (orderIds.length === 0) return [];

    const [receivables, shipments, requirements] =
      await this.prisma.$transaction([
        this.prisma.accountsReceivable.findMany({
          where: {
            tenantId,
            salesOrderId: { in: orderIds },
            status: { not: AccountsReceivableStatus.CANCELLED },
          },
        }),
        this.prisma.outboundShipment.findMany({
          where: {
            tenantId,
            salesOrderId: { in: orderIds },
            status: { not: OutboundShipmentStatus.CANCELLED },
          },
        }),
        this.prisma.purchaseRequirement.findMany({
          where: { tenantId, sourceSalesOrderId: { in: orderIds } },
        }),
      ]);

    const requirementToOrder = new Map(
      requirements.map((item) => [item.id, item.sourceSalesOrderId]),
    );
    const requirementIds = requirements.map((item) => item.id);

    const poItems = requirementIds.length
      ? await this.prisma.purchaseOrderItem.findMany({
          where: {
            tenantId,
            sourceRequirementId: { in: requirementIds },
            purchaseOrder: { status: { not: PurchaseOrderStatus.CANCELLED } },
          },
          include: { purchaseOrder: true },
        })
      : [];

    const poItemToOrder = new Map<string, string>();
    const poIds = new Set<string>();
    const poCostByOrder = new Map<string, number>();
    const poCostByPoOrder = new Map<string, Map<string, number>>();

    for (const item of poItems) {
      const orderId = item.sourceRequirementId
        ? requirementToOrder.get(item.sourceRequirementId)
        : undefined;
      if (!orderId) continue;

      poItemToOrder.set(item.id, orderId);
      poIds.add(item.purchaseOrderId);
      this.add(poCostByOrder, orderId, this.toNumber(item.amount));

      if (!poCostByPoOrder.has(item.purchaseOrderId))
        poCostByPoOrder.set(item.purchaseOrderId, new Map());
      this.add(
        poCostByPoOrder.get(item.purchaseOrderId)!,
        orderId,
        this.toNumber(item.amount),
      );
    }

    const poIdList = Array.from(poIds);

    const [receipts, receiptItems, payables] = await this.prisma.$transaction([
      poIdList.length
        ? this.prisma.inboundReceipt.findMany({
            where: {
              tenantId,
              purchaseOrderId: { in: poIdList },
              status: InboundReceiptStatus.CONFIRMED,
            },
          })
        : this.prisma.inboundReceipt.findMany({ where: { id: '__none__' } }),
      poIdList.length
        ? this.prisma.inboundReceiptItem.findMany({
            where: {
              tenantId,
              receipt: {
                purchaseOrderId: { in: poIdList },
                status: InboundReceiptStatus.CONFIRMED,
              },
            },
            include: { receipt: true },
          })
        : this.prisma.inboundReceiptItem.findMany({
            where: { id: '__none__' },
          }),
      poIdList.length
        ? this.prisma.accountsPayable.findMany({
            where: {
              tenantId,
              status: { not: AccountsPayableStatus.CANCELLED },
              OR: [
                { purchaseOrderId: { in: poIdList } },
                { inboundReceiptId: { in: receipts.map((item) => item.id) } },
              ],
            },
          })
        : this.prisma.accountsPayable.findMany({ where: { id: '__none__' } }),
    ]);

    const inboundCostByOrder = new Map<string, number>();
    const receiptCostByReceiptOrder = new Map<string, Map<string, number>>();

    for (const item of receiptItems) {
      const orderId = poItemToOrder.get(item.purchaseOrderItemId);
      if (!orderId) continue;

      this.add(inboundCostByOrder, orderId, this.toNumber(item.amount));

      if (!receiptCostByReceiptOrder.has(item.receiptId))
        receiptCostByReceiptOrder.set(item.receiptId, new Map());
      this.add(
        receiptCostByReceiptOrder.get(item.receiptId)!,
        orderId,
        this.toNumber(item.amount),
      );
    }

    const arByOrder = this.groupFinancialBy(
      receivables,
      'salesOrderId',
      'receivedAmount',
      'outstandingAmount',
    );
    const shipmentByOrder = this.groupAmountBy(
      shipments,
      'salesOrderId',
      'totalAmount',
    );

    const apByOrder = new Map<
      string,
      { totalAmount: number; paidAmount: number; outstandingAmount: number }
    >();

    for (const ap of payables) {
      const sourceMap = ap.purchaseOrderId
        ? poCostByPoOrder.get(ap.purchaseOrderId)
        : ap.inboundReceiptId
          ? receiptCostByReceiptOrder.get(ap.inboundReceiptId)
          : undefined;

      if (!sourceMap) continue;

      const base = this.sum(Array.from(sourceMap.values()));
      for (const [orderId, orderCost] of sourceMap.entries()) {
        const ratio = base > 0 ? orderCost / base : 0;
        const current = apByOrder.get(orderId) ?? {
          totalAmount: 0,
          paidAmount: 0,
          outstandingAmount: 0,
        };
        current.totalAmount += this.toNumber(ap.totalAmount) * ratio;
        current.paidAmount += this.toNumber(ap.paidAmount) * ratio;
        current.outstandingAmount +=
          this.toNumber(ap.outstandingAmount) * ratio;
        apByOrder.set(orderId, current);
      }
    }

    return orders.map((order) => {
      const ar = arByOrder.get(order.id) ?? {
        totalAmount: 0,
        receivedAmount: 0,
        outstandingAmount: 0,
      };
      const ap = apByOrder.get(order.id) ?? {
        totalAmount: 0,
        paidAmount: 0,
        outstandingAmount: 0,
      };
      const salesAmount = this.toNumber(order.totalAmount);
      const purchaseCostAmount = this.round(poCostByOrder.get(order.id) ?? 0);
      const grossProfitAmount = this.round(salesAmount - purchaseCostAmount);

      return {
        salesOrderId: order.id,
        salesOrderNo: order.orderNo,
        customerId: order.customerId,
        customerName: order.customerName,
        subject: order.subject,
        status: order.status,
        currencyCode: order.currencyCode,
        salesAmount,
        shippedAmount: this.round(shipmentByOrder.get(order.id) ?? 0),
        receivableAmount: this.round(ar.totalAmount),
        receivedAmount: this.round(ar.receivedAmount),
        receivableOutstandingAmount: this.round(ar.outstandingAmount),
        purchaseCostAmount,
        inboundCostAmount: this.round(inboundCostByOrder.get(order.id) ?? 0),
        payableAmount: this.round(ap.totalAmount),
        paidAmount: this.round(ap.paidAmount),
        payableOutstandingAmount: this.round(ap.outstandingAmount),
        grossProfitAmount,
        grossMarginRate: this.rate(grossProfitAmount, salesAmount),
        cashProfitAmount: this.round(ar.receivedAmount - ap.paidAmount),
        createdAt: order.createdAt,
      };
    });
  }

  private groupAmountBy(rows: any[], key: string, amountKey: string) {
    const map = new Map<string, number>();
    for (const row of rows) {
      if (row[key]) this.add(map, row[key], this.toNumber(row[amountKey]));
    }
    return map;
  }

  private groupFinancialBy(
    rows: any[],
    key: string,
    receivedKey: string,
    outstandingKey: string,
  ) {
    const map = new Map<
      string,
      { totalAmount: number; receivedAmount: number; outstandingAmount: number }
    >();
    for (const row of rows) {
      if (!row[key]) continue;
      const current = map.get(row[key]) ?? {
        totalAmount: 0,
        receivedAmount: 0,
        outstandingAmount: 0,
      };
      current.totalAmount += this.toNumber(row.totalAmount);
      current.receivedAmount += this.toNumber(row[receivedKey]);
      current.outstandingAmount += this.toNumber(row[outstandingKey]);
      map.set(row[key], current);
    }
    return map;
  }

  private add(map: Map<string, number>, key: string, value: number) {
    map.set(key, this.round((map.get(key) ?? 0) + value));
  }

  private rate(numerator: number, denominator: number) {
    if (!denominator) return 0;
    return this.round((numerator / denominator) * 100);
  }

  private sum(values: number[]) {
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
}
