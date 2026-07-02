import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { CurrencyRateService } from '../currency-rate/currency-rate.service';
import { QueryProfitDto } from './dto/query-profit.dto';
import { QueryProfitOverviewDto } from './dto/query-profit-overview.dto';

type MoneyBucket = Map<string, Prisma.Decimal>;
type MoneyByOrder = Map<string, MoneyBucket>;
type ShareMap = Map<string, Prisma.Decimal>;
type ShareBySource = Map<string, ShareMap>;

interface ExchangeRateInfo {
  fromCurrencyCode: string;
  toCurrencyCode: string;
  requestedDate: string;
  rateDate: string;
  rate: number;
  inverse: boolean;
  source: string | null;
}

@Injectable()
export class ProfitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyRateService: CurrencyRateService,
  ) {}

  async findSalesOrderProfits(user: CurrentUser, query: QueryProfitDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const targetCurrencyCode = query.targetCurrencyCode
      ? this.normalizeCurrencyCode(query.targetCurrencyCode)
      : undefined;

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
                customerName: {
                  contains: query.keyword,
                  mode: 'insensitive',
                },
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

    const list = await this.buildProfitRows(
      tenantId,
      orders,
      targetCurrencyCode,
    );

    return {
      total,
      page,
      pageSize,
      targetCurrencyCode,
      list,
    };
  }

  async findSalesOrderProfit(
    user: CurrentUser,
    salesOrderId: string,
    targetCurrencyCode?: string,
  ) {
    const tenantId = requireTenantId(user);
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: salesOrderId, tenantId },
    });

    if (!order) throw new NotFoundException('销售订单不存在');

    const [row] = await this.buildProfitRows(
      tenantId,
      [order],
      targetCurrencyCode
        ? this.normalizeCurrencyCode(targetCurrencyCode)
        : undefined,
    );

    return row;
  }

  async overview(user: CurrentUser, query: QueryProfitOverviewDto) {
    const tenantId = requireTenantId(user);
    const targetCurrencyCode = query.targetCurrencyCode
      ? this.normalizeCurrencyCode(query.targetCurrencyCode)
      : undefined;

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

    const rows = await this.buildProfitRows(
      tenantId,
      orders,
      targetCurrencyCode,
    );

    const result: Record<string, unknown> = {
      salesOrderCount: rows.length,
      salesAmount: this.sumRows(rows, 'salesAmount'),
      shippedAmount: this.sumRows(rows, 'shippedAmount'),
      receivableAmount: this.sumRows(rows, 'receivableAmount'),
      receivedAmount: this.sumRows(rows, 'receivedAmount'),
      receivableOutstandingAmount: this.sumRows(
        rows,
        'receivableOutstandingAmount',
      ),
      purchaseCostAmount: this.sumRows(rows, 'purchaseCostAmount'),
      inboundCostAmount: this.sumRows(rows, 'inboundCostAmount'),
      payableAmount: this.sumRows(rows, 'payableAmount'),
      paidAmount: this.sumRows(rows, 'paidAmount'),
      payableOutstandingAmount: this.sumRows(rows, 'payableOutstandingAmount'),
      grossProfitAmount: this.sumRows(rows, 'grossProfitAmount'),
      cashProfitAmount: this.sumRows(rows, 'cashProfitAmount'),
      grossMarginRate: this.rate(
        this.sumRows(rows, 'grossProfitAmount'),
        this.sumRows(rows, 'salesAmount'),
      ),
    };

    if (targetCurrencyCode) {
      const baseSalesAmount = this.sumRows(rows, 'baseSalesAmount');
      const baseGrossProfitAmount = this.sumRows(rows, 'baseGrossProfitAmount');

      Object.assign(result, {
        targetCurrencyCode,
        baseSalesAmount,
        baseShippedAmount: this.sumRows(rows, 'baseShippedAmount'),
        baseReceivableAmount: this.sumRows(rows, 'baseReceivableAmount'),
        baseReceivedAmount: this.sumRows(rows, 'baseReceivedAmount'),
        baseReceivableOutstandingAmount: this.sumRows(
          rows,
          'baseReceivableOutstandingAmount',
        ),
        basePurchaseCostAmount: this.sumRows(rows, 'basePurchaseCostAmount'),
        baseInboundCostAmount: this.sumRows(rows, 'baseInboundCostAmount'),
        basePayableAmount: this.sumRows(rows, 'basePayableAmount'),
        basePaidAmount: this.sumRows(rows, 'basePaidAmount'),
        basePayableOutstandingAmount: this.sumRows(
          rows,
          'basePayableOutstandingAmount',
        ),
        baseGrossProfitAmount,
        baseCashProfitAmount: this.sumRows(rows, 'baseCashProfitAmount'),
        baseGrossMarginRate: this.rate(baseGrossProfitAmount, baseSalesAmount),
      });
    }

    return result;
  }

  private async buildProfitRows(
    tenantId: string,
    orders: any[],
    targetCurrencyCode?: string,
  ) {
    const orderIds = orders.map((item) => item.id);
    if (orderIds.length === 0) return [];

    const orderCurrencyMap = new Map<string, string>();
    for (const order of orders) {
      orderCurrencyMap.set(
        order.id,
        this.normalizeCurrencyCode(order.currencyCode),
      );
    }

    const salesByOrder: MoneyByOrder = new Map();
    for (const order of orders) {
      this.addMoney(
        salesByOrder,
        order.id,
        order.currencyCode,
        order.totalAmount,
      );
    }

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

    const shipmentByOrder: MoneyByOrder = new Map();
    for (const item of shipments) {
      const currencyCode = this.normalizeCurrencyCode(
        (item as any).currencyCode,
        orderCurrencyMap.get(item.salesOrderId),
      );
      this.addMoney(
        shipmentByOrder,
        item.salesOrderId,
        currencyCode,
        item.totalAmount,
      );
    }

    const arTotalByOrder: MoneyByOrder = new Map();
    const arReceivedByOrder: MoneyByOrder = new Map();
    const arOutstandingByOrder: MoneyByOrder = new Map();

    for (const item of receivables) {
      if (!item.salesOrderId) continue;

      const currencyCode = this.normalizeCurrencyCode(
        item.currencyCode,
        orderCurrencyMap.get(item.salesOrderId),
      );

      this.addMoney(
        arTotalByOrder,
        item.salesOrderId,
        currencyCode,
        item.totalAmount,
      );
      this.addMoney(
        arReceivedByOrder,
        item.salesOrderId,
        currencyCode,
        item.receivedAmount,
      );
      this.addMoney(
        arOutstandingByOrder,
        item.salesOrderId,
        currencyCode,
        item.outstandingAmount,
      );
    }

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
    const poItemCurrency = new Map<string, string>();
    const poIds = new Set<string>();
    const poCostByOrder: MoneyByOrder = new Map();
    const poCostByPoOrder: ShareBySource = new Map();

    for (const item of poItems) {
      const orderId = item.sourceRequirementId
        ? requirementToOrder.get(item.sourceRequirementId)
        : undefined;

      if (!orderId) continue;

      const currencyCode = this.normalizeCurrencyCode(
        (item as any).purchaseOrder?.currencyCode,
        orderCurrencyMap.get(orderId),
      );

      poItemToOrder.set(item.id, orderId);
      poItemCurrency.set(item.id, currencyCode);
      poIds.add(item.purchaseOrderId);

      this.addMoney(poCostByOrder, orderId, currencyCode, item.amount);
      this.addShare(
        poCostByPoOrder,
        item.purchaseOrderId,
        orderId,
        item.amount,
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
        : this.prisma.inboundReceipt.findMany({ where: { id: { in: [] } } }),
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
            where: { id: { in: [] } },
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
        : this.prisma.accountsPayable.findMany({
            where: { id: { in: [] } },
          }),
    ]);

    const inboundCostByOrder: MoneyByOrder = new Map();
    const receiptCostByReceiptOrder: ShareBySource = new Map();

    for (const item of receiptItems) {
      const orderId = poItemToOrder.get(item.purchaseOrderItemId);
      if (!orderId) continue;

      const currencyCode = this.normalizeCurrencyCode(
        (item as any).receipt?.currencyCode,
        poItemCurrency.get(item.purchaseOrderItemId),
      );

      this.addMoney(inboundCostByOrder, orderId, currencyCode, item.amount);
      this.addShare(
        receiptCostByReceiptOrder,
        item.receiptId,
        orderId,
        item.amount,
      );
    }

    const apTotalByOrder: MoneyByOrder = new Map();
    const apPaidByOrder: MoneyByOrder = new Map();
    const apOutstandingByOrder: MoneyByOrder = new Map();

    for (const ap of payables) {
      const sourceMap = ap.purchaseOrderId
        ? poCostByPoOrder.get(ap.purchaseOrderId)
        : ap.inboundReceiptId
          ? receiptCostByReceiptOrder.get(ap.inboundReceiptId)
          : undefined;

      if (!sourceMap) continue;

      const base = this.sumShare(sourceMap);
      if (!base.gt(0)) continue;

      const currencyCode = this.normalizeCurrencyCode(ap.currencyCode);

      for (const [orderId, orderCost] of sourceMap.entries()) {
        const ratio = orderCost.div(base);

        this.addMoney(
          apTotalByOrder,
          orderId,
          currencyCode,
          this.decimal(ap.totalAmount).mul(ratio),
        );
        this.addMoney(
          apPaidByOrder,
          orderId,
          currencyCode,
          this.decimal(ap.paidAmount).mul(ratio),
        );
        this.addMoney(
          apOutstandingByOrder,
          orderId,
          currencyCode,
          this.decimal(ap.outstandingAmount).mul(ratio),
        );
      }
    }

    const rateCache = new Map<string, any>();

    return Promise.all(
      orders.map(async (order) => {
        const exchangeRates: ExchangeRateInfo[] = [];
        const rateDate = order.createdAt;

        const salesAmount = this.sumMoney(salesByOrder.get(order.id));
        const shippedAmount = this.sumMoney(shipmentByOrder.get(order.id));
        const receivableAmount = this.sumMoney(arTotalByOrder.get(order.id));
        const receivedAmount = this.sumMoney(arReceivedByOrder.get(order.id));
        const receivableOutstandingAmount = this.sumMoney(
          arOutstandingByOrder.get(order.id),
        );
        const purchaseCostAmount = this.sumMoney(poCostByOrder.get(order.id));
        const inboundCostAmount = this.sumMoney(
          inboundCostByOrder.get(order.id),
        );
        const payableAmount = this.sumMoney(apTotalByOrder.get(order.id));
        const paidAmount = this.sumMoney(apPaidByOrder.get(order.id));
        const payableOutstandingAmount = this.sumMoney(
          apOutstandingByOrder.get(order.id),
        );

        const grossProfitAmount = salesAmount.minus(purchaseCostAmount);
        const cashProfitAmount = receivedAmount.minus(paidAmount);

        const row: Record<string, unknown> = {
          salesOrderId: order.id,
          salesOrderNo: order.orderNo,
          customerId: order.customerId,
          customerName: order.customerName,
          subject: order.subject,
          status: order.status,
          currencyCode: order.currencyCode,
          salesAmount: this.round(salesAmount),
          shippedAmount: this.round(shippedAmount),
          receivableAmount: this.round(receivableAmount),
          receivedAmount: this.round(receivedAmount),
          receivableOutstandingAmount: this.round(receivableOutstandingAmount),
          purchaseCostAmount: this.round(purchaseCostAmount),
          inboundCostAmount: this.round(inboundCostAmount),
          payableAmount: this.round(payableAmount),
          paidAmount: this.round(paidAmount),
          payableOutstandingAmount: this.round(payableOutstandingAmount),
          grossProfitAmount: this.round(grossProfitAmount),
          grossMarginRate: this.rate(grossProfitAmount, salesAmount),
          cashProfitAmount: this.round(cashProfitAmount),
          createdAt: order.createdAt,
        };

        if (targetCurrencyCode) {
          const baseSalesAmount = await this.convertMoneyBucket(
            tenantId,
            salesByOrder.get(order.id),
            targetCurrencyCode,
            rateDate,
            rateCache,
            exchangeRates,
          );
          const baseShippedAmount = await this.convertMoneyBucket(
            tenantId,
            shipmentByOrder.get(order.id),
            targetCurrencyCode,
            rateDate,
            rateCache,
            exchangeRates,
          );
          const baseReceivableAmount = await this.convertMoneyBucket(
            tenantId,
            arTotalByOrder.get(order.id),
            targetCurrencyCode,
            rateDate,
            rateCache,
            exchangeRates,
          );
          const baseReceivedAmount = await this.convertMoneyBucket(
            tenantId,
            arReceivedByOrder.get(order.id),
            targetCurrencyCode,
            rateDate,
            rateCache,
            exchangeRates,
          );
          const baseReceivableOutstandingAmount = await this.convertMoneyBucket(
            tenantId,
            arOutstandingByOrder.get(order.id),
            targetCurrencyCode,
            rateDate,
            rateCache,
            exchangeRates,
          );
          const basePurchaseCostAmount = await this.convertMoneyBucket(
            tenantId,
            poCostByOrder.get(order.id),
            targetCurrencyCode,
            rateDate,
            rateCache,
            exchangeRates,
          );
          const baseInboundCostAmount = await this.convertMoneyBucket(
            tenantId,
            inboundCostByOrder.get(order.id),
            targetCurrencyCode,
            rateDate,
            rateCache,
            exchangeRates,
          );
          const basePayableAmount = await this.convertMoneyBucket(
            tenantId,
            apTotalByOrder.get(order.id),
            targetCurrencyCode,
            rateDate,
            rateCache,
            exchangeRates,
          );
          const basePaidAmount = await this.convertMoneyBucket(
            tenantId,
            apPaidByOrder.get(order.id),
            targetCurrencyCode,
            rateDate,
            rateCache,
            exchangeRates,
          );
          const basePayableOutstandingAmount = await this.convertMoneyBucket(
            tenantId,
            apOutstandingByOrder.get(order.id),
            targetCurrencyCode,
            rateDate,
            rateCache,
            exchangeRates,
          );

          const baseGrossProfitAmount = baseSalesAmount.minus(
            basePurchaseCostAmount,
          );
          const baseCashProfitAmount = baseReceivedAmount.minus(basePaidAmount);

          Object.assign(row, {
            targetCurrencyCode,
            baseSalesAmount: this.round(baseSalesAmount),
            baseShippedAmount: this.round(baseShippedAmount),
            baseReceivableAmount: this.round(baseReceivableAmount),
            baseReceivedAmount: this.round(baseReceivedAmount),
            baseReceivableOutstandingAmount: this.round(
              baseReceivableOutstandingAmount,
            ),
            basePurchaseCostAmount: this.round(basePurchaseCostAmount),
            baseInboundCostAmount: this.round(baseInboundCostAmount),
            basePayableAmount: this.round(basePayableAmount),
            basePaidAmount: this.round(basePaidAmount),
            basePayableOutstandingAmount: this.round(
              basePayableOutstandingAmount,
            ),
            baseGrossProfitAmount: this.round(baseGrossProfitAmount),
            baseGrossMarginRate: this.rate(
              baseGrossProfitAmount,
              baseSalesAmount,
            ),
            baseCashProfitAmount: this.round(baseCashProfitAmount),
            exchangeRates,
          });
        }

        return row;
      }),
    );
  }

  private async convertMoneyBucket(
    tenantId: string,
    bucket: MoneyBucket | undefined,
    targetCurrencyCode: string,
    rateDate: Date,
    rateCache: Map<string, any>,
    exchangeRates: ExchangeRateInfo[],
  ) {
    if (!bucket) return this.decimal(0);

    let total = this.decimal(0);

    for (const [fromCurrencyCode, amount] of bucket.entries()) {
      if (amount.eq(0)) continue;

      const resolved = await this.resolveRateCached(
        tenantId,
        fromCurrencyCode,
        targetCurrencyCode,
        rateDate,
        rateCache,
      );

      total = total.plus(amount.mul(resolved.rate));
      this.collectExchangeRate(exchangeRates, resolved);
    }

    return total;
  }

  private async resolveRateCached(
    tenantId: string,
    fromCurrencyCode: string,
    toCurrencyCode: string,
    rateDate: Date,
    cache: Map<string, any>,
  ) {
    const from = this.normalizeCurrencyCode(fromCurrencyCode);
    const to = this.normalizeCurrencyCode(toCurrencyCode);
    const dateKey = this.formatDate(rateDate);
    const key = `${tenantId}:${from}:${to}:${dateKey}`;

    const cached = cache.get(key);
    if (cached) return cached;

    const resolved = await this.currencyRateService.resolveRateByTenant({
      tenantId,
      fromCurrencyCode: from,
      toCurrencyCode: to,
      rateDate,
      allowInverse: true,
    });

    cache.set(key, resolved);
    return resolved;
  }

  private collectExchangeRate(
    exchangeRates: ExchangeRateInfo[],
    resolved: any,
  ) {
    const item: ExchangeRateInfo = {
      fromCurrencyCode: resolved.fromCurrencyCode,
      toCurrencyCode: resolved.toCurrencyCode,
      requestedDate: this.formatDate(resolved.requestedDate),
      rateDate: this.formatDate(resolved.rateDate),
      rate: this.round(resolved.rate, 12),
      inverse: resolved.inverse,
      source: resolved.source ? String(resolved.source) : null,
    };

    const exists = exchangeRates.some(
      (rate) =>
        rate.fromCurrencyCode === item.fromCurrencyCode &&
        rate.toCurrencyCode === item.toCurrencyCode &&
        rate.rateDate === item.rateDate &&
        rate.rate === item.rate &&
        rate.inverse === item.inverse,
    );

    if (!exists) exchangeRates.push(item);
  }

  private addMoney(
    map: MoneyByOrder,
    orderId: string,
    currencyCode: unknown,
    amount: Prisma.Decimal.Value,
  ) {
    const currency = this.normalizeCurrencyCode(currencyCode);

    if (!map.has(orderId)) map.set(orderId, new Map());

    const bucket = map.get(orderId)!;
    bucket.set(currency, this.sumDecimal(bucket.get(currency), amount));
  }

  private addShare(
    map: ShareBySource,
    sourceId: string,
    orderId: string,
    amount: Prisma.Decimal.Value,
  ) {
    if (!map.has(sourceId)) map.set(sourceId, new Map());

    const bucket = map.get(sourceId)!;
    bucket.set(orderId, this.sumDecimal(bucket.get(orderId), amount));
  }

  private sumMoney(bucket?: MoneyBucket) {
    if (!bucket) return this.decimal(0);

    return Array.from(bucket.values()).reduce(
      (sum, value) => sum.plus(value),
      this.decimal(0),
    );
  }

  private sumShare(bucket: ShareMap) {
    return Array.from(bucket.values()).reduce(
      (sum, value) => sum.plus(value),
      this.decimal(0),
    );
  }

  private sumRows(rows: any[], key: string) {
    return this.round(
      rows.reduce(
        (sum, row) => sum.plus(this.decimal(row[key] ?? 0)),
        this.decimal(0),
      ),
    );
  }

  private sumDecimal(
    current: Prisma.Decimal.Value | undefined,
    amount: Prisma.Decimal.Value,
  ) {
    return this.decimal(current ?? 0).plus(this.decimal(amount));
  }

  private decimal(value: Prisma.Decimal.Value) {
    return new Prisma.Decimal(value ?? 0);
  }

  private rate(
    numerator: Prisma.Decimal.Value,
    denominator: Prisma.Decimal.Value,
  ) {
    const base = this.decimal(denominator);
    if (base.eq(0)) return 0;
    return this.round(this.decimal(numerator).div(base).mul(100));
  }

  private round(value: Prisma.Decimal.Value, scale = 4) {
    return Number(this.decimal(value).toDecimalPlaces(scale).toString());
  }

  private normalizeCurrencyCode(value: unknown, fallback?: string) {
    const raw =
      typeof value === 'string' && value.trim().length > 0 ? value : fallback;

    if (!raw) throw new BadRequestException('缺少币种编码');

    const code = raw.trim().toUpperCase();

    if (code.length < 3 || code.length > 16) {
      throw new BadRequestException('币种编码长度必须在 3 到 16 位之间');
    }

    return code;
  }

  private formatDate(value: string | Date) {
    const date =
      value instanceof Date
        ? value
        : new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('日期不合法');
    }

    return date.toISOString().slice(0, 10);
  }
}
