// src/accounts-receivable/accounts-receivable.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountsReceivablePaymentMethod,
  AccountsReceivablePaymentStatus,
  AccountsReceivableSourceType,
  AccountsReceivableStatus,
  OutboundShipmentStatus,
  Prisma,
  SalesOrderStatus,
} from '../generated/prisma/client';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../file/file.service';
import { CreateAccountsReceivableDto } from './dto/create-accounts-receivable.dto';
import { UpdateAccountsReceivableDto } from './dto/update-accounts-receivable.dto';
import { QueryAccountsReceivableDto } from './dto/query-accounts-receivable.dto';
import { CreateArFromSalesOrderDto } from './dto/create-ar-from-sales-order.dto';
import { CreateArFromOutboundShipmentDto } from './dto/create-ar-from-outbound-shipment.dto';
import { AccountsReceivableItemInputDto } from './dto/accounts-receivable-item-input.dto';
import { CreateArPaymentDto } from './dto/create-ar-payment.dto';
import { UpdateArPaymentDto } from './dto/update-ar-payment.dto';
import { QueryArPaymentDto } from './dto/query-ar-payment.dto';
import { ArPaymentAllocationInputDto } from './dto/ar-payment-allocation-input.dto';

@Injectable()
export class AccountsReceivableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  async createReceivable(user: CurrentUser, dto: CreateAccountsReceivableDto) {
    const tenantId = requireTenantId(user);
    const receivable = await this.prisma.$transaction((tx) =>
      this.createReceivableTx(tx, tenantId, user.id, dto),
    );

    if (dto.attachmentFileIds !== undefined) {
      await this.syncFiles(
        user,
        'accounts_receivable',
        receivable.id,
        dto.attachmentFileIds,
        '应收单附件',
      );
    }

    return this.findReceivable(user, receivable.id);
  }

  async createFromSalesOrder(
    user: CurrentUser,
    salesOrderId: string,
    dto: CreateArFromSalesOrderDto,
  ) {
    const tenantId = requireTenantId(user);

    const order = await this.prisma.salesOrder.findFirst({
      where: { id: salesOrderId, tenantId },
      include: { items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
    });

    if (!order) throw new NotFoundException('销售订单不存在');
    if (
      ![
        SalesOrderStatus.CONFIRMED,
        SalesOrderStatus.PROCESSING,
        SalesOrderStatus.SHIPPED,
        SalesOrderStatus.COMPLETED,
      ].includes(order.status)
    ) {
      throw new BadRequestException('当前销售订单状态不允许生成应收');
    }

    return this.createReceivable(user, {
      receivableNo: dto.receivableNo,
      sourceType: AccountsReceivableSourceType.SALES_ORDER,
      sourceId: order.id,
      sourceNo: order.orderNo,
      salesOrderId: order.id,
      customerId: order.customerId ?? undefined,
      customerName: order.customerName ?? undefined,
      subject: dto.subject ?? order.subject,
      currencyCode: order.currencyCode,
      exchangeRate: this.optionalNumber(order.exchangeRate),
      totalAmount: this.toNumber(order.totalAmount),
      dueDate: dto.dueDate,
      remark: dto.remark,
      extra: dto.extra,
      items: order.items.map((item) => ({
        sourceItemId: item.id,
        productId: item.productId ?? undefined,
        productCode: item.productCode ?? undefined,
        productNameCn: item.productNameCn ?? undefined,
        productNameEn: item.productNameEn ?? undefined,
        categoryCode: item.categoryCode ?? undefined,
        unitCode: item.unitCode ?? undefined,
        quantity: this.toNumber(item.orderedQuantity),
        unitPrice: this.toNumber(item.unitPrice),
        currencyCode: item.currencyCode ?? order.currencyCode,
        remark: item.remark ?? undefined,
        sort: item.sort,
      })),
    });
  }

  async createFromOutboundShipment(
    user: CurrentUser,
    shipmentId: string,
    dto: CreateArFromOutboundShipmentDto,
  ) {
    const tenantId = requireTenantId(user);

    const shipment = await this.prisma.outboundShipment.findFirst({
      where: { id: shipmentId, tenantId },
      include: { items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
    });

    if (!shipment) throw new NotFoundException('出运单不存在');
    if (
      ![
        OutboundShipmentStatus.CONFIRMED,
        OutboundShipmentStatus.SHIPPED,
      ].includes(shipment.status)
    ) {
      throw new BadRequestException('当前出运单状态不允许生成应收');
    }

    const salesOrder = await this.prisma.salesOrder.findFirst({
      where: { id: shipment.salesOrderId, tenantId },
    });

    return this.createReceivable(user, {
      receivableNo: dto.receivableNo,
      sourceType: AccountsReceivableSourceType.OUTBOUND_SHIPMENT,
      sourceId: shipment.id,
      sourceNo: shipment.shipmentNo,
      salesOrderId: shipment.salesOrderId,
      outboundShipmentId: shipment.id,
      customerId: shipment.customerId ?? undefined,
      customerName: shipment.customerName ?? undefined,
      subject: dto.subject ?? `出运应收 ${shipment.shipmentNo}`,
      currencyCode: salesOrder?.currencyCode ?? 'USD',
      exchangeRate: this.optionalNumber(salesOrder?.exchangeRate),
      totalAmount: this.toNumber(shipment.totalAmount),
      dueDate: dto.dueDate,
      remark: dto.remark,
      extra: dto.extra,
      items: shipment.items.map((item) => ({
        sourceItemId: item.id,
        productId: item.productId ?? undefined,
        productCode: item.productCode ?? undefined,
        productNameCn: item.productNameCn ?? undefined,
        productNameEn: item.productNameEn ?? undefined,
        categoryCode: item.categoryCode ?? undefined,
        unitCode: item.unitCode ?? undefined,
        quantity: this.toNumber(item.shippedQuantity),
        unitPrice: this.toNumber(item.unitPrice),
        currencyCode: item.currencyCode ?? salesOrder?.currencyCode ?? 'USD',
        remark: item.remark ?? undefined,
        sort: item.sort,
      })),
    });
  }

  async findReceivables(user: CurrentUser, query: QueryAccountsReceivableDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.AccountsReceivableWhereInput = {
      tenantId,
      status: query.status,
      sourceType: query.sourceType,
      customerId: query.customerId,
      salesOrderId: query.salesOrderId,
      outboundShipmentId: query.outboundShipmentId,
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
                receivableNo: { contains: query.keyword, mode: 'insensitive' },
              },
              { sourceNo: { contains: query.keyword, mode: 'insensitive' } },
              {
                customerName: { contains: query.keyword, mode: 'insensitive' },
              },
              { subject: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.accountsReceivable.count({ where }),
      this.prisma.accountsReceivable.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { items: true, allocations: true } } },
      }),
    ]);

    return { total, page, pageSize, list };
  }

  async findReceivable(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const row = await this.prisma.accountsReceivable.findFirst({
      where: { id, tenantId },
      include: {
        items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] },
        allocations: {
          include: { payment: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!row) throw new NotFoundException('应收单不存在');

    const attachments = await this.fileService.findRelations(user, {
      ownerType: 'accounts_receivable',
      ownerId: row.id,
    });

    return { ...row, attachments };
  }

  async updateReceivable(
    user: CurrentUser,
    id: string,
    dto: UpdateAccountsReceivableDto,
  ) {
    const tenantId = requireTenantId(user);

    await this.prisma.$transaction(async (tx) => {
      const row = await this.ensureReceivableTx(tx, tenantId, id);
      if (row.status !== AccountsReceivableStatus.DRAFT)
        throw new BadRequestException('只有草稿应收单允许编辑');

      if (dto.receivableNo)
        await this.assertReceivableNoUniqueTx(
          tx,
          tenantId,
          dto.receivableNo,
          id,
        );

      await tx.accountsReceivable.update({
        where: { id },
        data: {
          receivableNo: dto.receivableNo,
          customerId: dto.customerId,
          customerName: dto.customerName,
          subject: dto.subject,
          currencyCode: dto.currencyCode,
          exchangeRate: dto.exchangeRate,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          remark: dto.remark,
          extra: dto.extra === undefined ? undefined : this.toJson(dto.extra),
          updatedById: user.id,
        },
      });

      if (dto.items !== undefined || dto.totalAmount !== undefined) {
        const totalAmount = dto.items
          ? await this.replaceReceivableItemsTx(
              tx,
              tenantId,
              id,
              dto.items,
              dto.currencyCode ?? row.currencyCode,
            )
          : dto.totalAmount!;

        await tx.accountsReceivable.update({
          where: { id },
          data: {
            totalAmount,
            outstandingAmount: this.round(
              totalAmount - this.toNumber(row.receivedAmount),
            ),
          },
        });
      }
    });

    if (dto.attachmentFileIds !== undefined) {
      await this.syncFiles(
        user,
        'accounts_receivable',
        id,
        dto.attachmentFileIds,
        '应收单附件',
      );
    }

    return this.findReceivable(user, id);
  }

  async confirmReceivable(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    return this.prisma.$transaction(async (tx) => {
      const row = await this.ensureReceivableTx(tx, tenantId, id);
      if (row.status !== AccountsReceivableStatus.DRAFT)
        throw new BadRequestException('只有草稿应收单可以确认');

      return tx.accountsReceivable.update({
        where: { id },
        data: {
          status: AccountsReceivableStatus.CONFIRMED,
          confirmedAt: new Date(),
          outstandingAmount: this.round(
            this.toNumber(row.totalAmount) - this.toNumber(row.receivedAmount),
          ),
          updatedById: user.id,
        },
      });
    });
  }

  async cancelReceivable(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    return this.prisma.$transaction(async (tx) => {
      const row = await this.ensureReceivableTx(tx, tenantId, id);
      if (this.toNumber(row.receivedAmount) > 0)
        throw new BadRequestException('已有收款核销的应收单不能取消');

      return tx.accountsReceivable.update({
        where: { id },
        data: {
          status: AccountsReceivableStatus.CANCELLED,
          cancelledAt: new Date(),
          updatedById: user.id,
        },
      });
    });
  }

  async createPayment(user: CurrentUser, dto: CreateArPaymentDto) {
    const tenantId = requireTenantId(user);
    this.assertCreatePaymentStatus(dto.status);

    const payment = await this.prisma.$transaction(async (tx) => {
      const paymentNo =
        dto.paymentNo ?? (await this.generateNoTx(tx, tenantId, 'ARP'));
      await this.assertPaymentNoUniqueTx(tx, tenantId, paymentNo);

      const created = await tx.accountsReceivablePayment.create({
        data: {
          tenantId,
          paymentNo,
          customerId: dto.customerId,
          customerName: dto.customerName,
          status: AccountsReceivablePaymentStatus.DRAFT,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          method: dto.method ?? AccountsReceivablePaymentMethod.BANK_TRANSFER,
          bankAccountNo: dto.bankAccountNo,
          transactionNo: dto.transactionNo,
          currencyCode: dto.currencyCode,
          amount: dto.amount,
          unappliedAmount: dto.amount,
          remark: dto.remark,
          extra: this.toJson(dto.extra),
          createdById: user.id,
        },
      });

      await this.replaceAllocationsTx(
        tx,
        tenantId,
        created.id,
        dto.currencyCode,
        dto.amount,
        dto.allocations ?? [],
      );
      if (dto.status === AccountsReceivablePaymentStatus.CONFIRMED) {
        await this.applyPaymentTx(tx, tenantId, created.id, user.id);
      }

      return created;
    });

    if (dto.attachmentFileIds !== undefined) {
      await this.syncFiles(
        user,
        'accounts_receivable_payment',
        payment.id,
        dto.attachmentFileIds,
        '收款单附件',
      );
    }

    return this.findPayment(user, payment.id);
  }

  async findPayments(user: CurrentUser, query: QueryArPaymentDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.AccountsReceivablePaymentWhereInput = {
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
              { paymentNo: { contains: query.keyword, mode: 'insensitive' } },
              {
                customerName: { contains: query.keyword, mode: 'insensitive' },
              },
              {
                transactionNo: { contains: query.keyword, mode: 'insensitive' },
              },
              { remark: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.accountsReceivablePayment.count({ where }),
      this.prisma.accountsReceivablePayment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { allocations: true } } },
      }),
    ]);

    return { total, page, pageSize, list };
  }

  async findPayment(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const row = await this.prisma.accountsReceivablePayment.findFirst({
      where: { id, tenantId },
      include: {
        allocations: {
          include: { receivable: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!row) throw new NotFoundException('收款单不存在');

    const attachments = await this.fileService.findRelations(user, {
      ownerType: 'accounts_receivable_payment',
      ownerId: row.id,
    });

    return { ...row, attachments };
  }

  async updatePayment(user: CurrentUser, id: string, dto: UpdateArPaymentDto) {
    const tenantId = requireTenantId(user);

    await this.prisma.$transaction(async (tx) => {
      const payment = await this.ensurePaymentTx(tx, tenantId, id);
      if (payment.status !== AccountsReceivablePaymentStatus.DRAFT)
        throw new BadRequestException('只有草稿收款单允许编辑');

      if (dto.paymentNo)
        await this.assertPaymentNoUniqueTx(tx, tenantId, dto.paymentNo, id);

      await tx.accountsReceivablePayment.update({
        where: { id },
        data: {
          paymentNo: dto.paymentNo,
          customerId: dto.customerId,
          customerName: dto.customerName,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : undefined,
          method: dto.method,
          bankAccountNo: dto.bankAccountNo,
          transactionNo: dto.transactionNo,
          currencyCode: dto.currencyCode,
          amount: dto.amount,
          remark: dto.remark,
          extra: dto.extra === undefined ? undefined : this.toJson(dto.extra),
          updatedById: user.id,
        },
      });

      if (
        dto.allocations !== undefined ||
        dto.amount !== undefined ||
        dto.currencyCode !== undefined
      ) {
        await this.replaceAllocationsTx(
          tx,
          tenantId,
          id,
          dto.currencyCode ?? payment.currencyCode,
          dto.amount ?? this.toNumber(payment.amount),
          dto.allocations ??
            (await this.currentAllocationInputsTx(tx, tenantId, id)),
        );
      }
    });

    if (dto.attachmentFileIds !== undefined) {
      await this.syncFiles(
        user,
        'accounts_receivable_payment',
        id,
        dto.attachmentFileIds,
        '收款单附件',
      );
    }

    return this.findPayment(user, id);
  }

  async confirmPayment(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    await this.prisma.$transaction((tx) =>
      this.applyPaymentTx(tx, tenantId, id, user.id),
    );
    return this.findPayment(user, id);
  }

  async cancelPayment(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    return this.prisma.$transaction(async (tx) => {
      const payment = await this.ensurePaymentTx(tx, tenantId, id);
      if (payment.status === AccountsReceivablePaymentStatus.CANCELLED)
        return payment;

      if (payment.status === AccountsReceivablePaymentStatus.CONFIRMED) {
        const allocations =
          await tx.accountsReceivablePaymentAllocation.findMany({
            where: { tenantId, paymentId: id },
          });

        for (const allocation of allocations) {
          const receivable = await this.ensureReceivableTx(
            tx,
            tenantId,
            allocation.receivableId,
          );
          const receivedAmount = Math.max(
            0,
            this.round(
              this.toNumber(receivable.receivedAmount) -
                this.toNumber(allocation.amount),
            ),
          );
          await this.updateReceivableReceiveStateTx(
            tx,
            receivable.id,
            receivedAmount,
            user.id,
          );
        }
      }

      return tx.accountsReceivablePayment.update({
        where: { id },
        data: {
          status: AccountsReceivablePaymentStatus.CANCELLED,
          cancelledAt: new Date(),
          updatedById: user.id,
        },
      });
    });
  }

  private async createReceivableTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    dto: CreateAccountsReceivableDto,
  ) {
    this.assertCreateReceivableStatus(dto.status);

    if (dto.sourceType && dto.sourceId) {
      await this.assertSourceNotUsedTx(
        tx,
        tenantId,
        dto.sourceType,
        dto.sourceId,
      );
    }

    const receivableNo =
      dto.receivableNo ?? (await this.generateNoTx(tx, tenantId, 'AR'));
    await this.assertReceivableNoUniqueTx(tx, tenantId, receivableNo);

    const totalAmount = dto.items?.length
      ? this.sum(dto.items.map((item) => item.quantity * item.unitPrice))
      : (dto.totalAmount ?? 0);

    const status = dto.status ?? AccountsReceivableStatus.DRAFT;

    const created = await tx.accountsReceivable.create({
      data: {
        tenantId,
        receivableNo,
        sourceType: dto.sourceType ?? AccountsReceivableSourceType.MANUAL,
        sourceId: dto.sourceId,
        sourceNo: dto.sourceNo,
        salesOrderId: dto.salesOrderId,
        outboundShipmentId: dto.outboundShipmentId,
        customerId: dto.customerId,
        customerName: dto.customerName,
        subject: dto.subject,
        status,
        currencyCode: dto.currencyCode,
        exchangeRate: dto.exchangeRate,
        totalAmount,
        receivedAmount: 0,
        outstandingAmount: totalAmount,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        confirmedAt:
          status === AccountsReceivableStatus.CONFIRMED
            ? new Date()
            : undefined,
        remark: dto.remark,
        extra: this.toJson(dto.extra),
        createdById: userId,
      },
    });

    if (dto.items?.length) {
      await this.replaceReceivableItemsTx(
        tx,
        tenantId,
        created.id,
        dto.items,
        dto.currencyCode,
      );
    }

    return created;
  }

  private async replaceReceivableItemsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    receivableId: string,
    items: AccountsReceivableItemInputDto[],
    currencyCode: string,
  ) {
    await tx.accountsReceivableItem.deleteMany({
      where: { tenantId, receivableId },
    });

    const rows = items.map((item, index) => ({
      tenantId,
      receivableId,
      sourceItemId: item.sourceItemId,
      productId: item.productId,
      productCode: item.productCode,
      productNameCn: item.productNameCn,
      productNameEn: item.productNameEn,
      categoryCode: item.categoryCode,
      unitCode: item.unitCode,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: this.round(item.quantity * item.unitPrice),
      currencyCode: item.currencyCode ?? currencyCode,
      remark: item.remark,
      extra: this.toJson(item.extra),
      sort: item.sort ?? index,
    }));

    if (rows.length) await tx.accountsReceivableItem.createMany({ data: rows });
    return this.sum(rows.map((item) => item.amount));
  }

  private async replaceAllocationsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    paymentId: string,
    currencyCode: string,
    paymentAmount: number,
    allocations: ArPaymentAllocationInputDto[],
  ) {
    await tx.accountsReceivablePaymentAllocation.deleteMany({
      where: { tenantId, paymentId },
    });

    const totalAllocated = this.sum(allocations.map((item) => item.amount));
    if (totalAllocated > paymentAmount)
      throw new BadRequestException('核销金额不能大于收款金额');

    for (const allocation of allocations) {
      const receivable = await this.ensureReceivableTx(
        tx,
        tenantId,
        allocation.receivableId,
      );
      if (
        ![
          AccountsReceivableStatus.CONFIRMED,
          AccountsReceivableStatus.PARTIALLY_RECEIVED,
        ].includes(receivable.status)
      ) {
        throw new BadRequestException('应收单状态不允许核销');
      }
      if (receivable.currencyCode !== currencyCode)
        throw new BadRequestException('收款币种与应收单币种不一致');
      if (allocation.amount > this.toNumber(receivable.outstandingAmount))
        throw new BadRequestException('核销金额不能大于应收未收金额');

      await tx.accountsReceivablePaymentAllocation.create({
        data: {
          tenantId,
          paymentId,
          receivableId: allocation.receivableId,
          amount: allocation.amount,
          currencyCode,
          remark: allocation.remark,
        },
      });
    }

    await tx.accountsReceivablePayment.update({
      where: { id: paymentId },
      data: {
        allocatedAmount: totalAllocated,
        unappliedAmount: this.round(paymentAmount - totalAllocated),
      },
    });
  }

  private async applyPaymentTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    paymentId: string,
    userId: string,
  ) {
    const payment = await this.ensurePaymentTx(tx, tenantId, paymentId);
    if (payment.status !== AccountsReceivablePaymentStatus.DRAFT)
      throw new BadRequestException('只有草稿收款单可以确认');

    const allocations = await tx.accountsReceivablePaymentAllocation.findMany({
      where: { tenantId, paymentId },
    });

    for (const allocation of allocations) {
      const receivable = await this.ensureReceivableTx(
        tx,
        tenantId,
        allocation.receivableId,
      );
      const receivedAmount = this.round(
        this.toNumber(receivable.receivedAmount) +
          this.toNumber(allocation.amount),
      );
      await this.updateReceivableReceiveStateTx(
        tx,
        receivable.id,
        receivedAmount,
        userId,
      );
    }

    return tx.accountsReceivablePayment.update({
      where: { id: paymentId },
      data: {
        status: AccountsReceivablePaymentStatus.CONFIRMED,
        confirmedAt: new Date(),
        updatedById: userId,
      },
    });
  }

  private async updateReceivableReceiveStateTx(
    tx: Prisma.TransactionClient,
    receivableId: string,
    receivedAmount: number,
    userId: string,
  ) {
    const receivable = await tx.accountsReceivable.findUnique({
      where: { id: receivableId },
    });
    if (!receivable) throw new NotFoundException('应收单不存在');

    const totalAmount = this.toNumber(receivable.totalAmount);
    const outstandingAmount = this.round(totalAmount - receivedAmount);
    const status =
      receivedAmount <= 0
        ? AccountsReceivableStatus.CONFIRMED
        : receivedAmount >= totalAmount
          ? AccountsReceivableStatus.RECEIVED
          : AccountsReceivableStatus.PARTIALLY_RECEIVED;

    return tx.accountsReceivable.update({
      where: { id: receivableId },
      data: {
        receivedAmount,
        outstandingAmount,
        status,
        closedAt:
          status === AccountsReceivableStatus.RECEIVED ? new Date() : null,
        updatedById: userId,
      },
    });
  }

  private async currentAllocationInputsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    paymentId: string,
  ): Promise<ArPaymentAllocationInputDto[]> {
    const rows = await tx.accountsReceivablePaymentAllocation.findMany({
      where: { tenantId, paymentId },
    });
    return rows.map((row) => ({
      receivableId: row.receivableId,
      amount: this.toNumber(row.amount),
      remark: row.remark ?? undefined,
    }));
  }

  private async ensureReceivableTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const row = await tx.accountsReceivable.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('应收单不存在');
    return row;
  }

  private async ensurePaymentTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const row = await tx.accountsReceivablePayment.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('收款单不存在');
    return row;
  }

  private async assertReceivableNoUniqueTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    receivableNo: string,
    excludeId?: string,
  ) {
    const exists = await tx.accountsReceivable.findFirst({
      where: {
        tenantId,
        receivableNo,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (exists) throw new BadRequestException('应收单编号已存在');
  }

  private async assertPaymentNoUniqueTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    paymentNo: string,
    excludeId?: string,
  ) {
    const exists = await tx.accountsReceivablePayment.findFirst({
      where: {
        tenantId,
        paymentNo,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (exists) throw new BadRequestException('收款单编号已存在');
  }

  private async assertSourceNotUsedTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    sourceType: AccountsReceivableSourceType,
    sourceId: string,
  ) {
    const exists = await tx.accountsReceivable.findFirst({
      where: {
        tenantId,
        sourceType,
        sourceId,
        status: { not: AccountsReceivableStatus.CANCELLED },
      },
      select: { id: true },
    });
    if (exists) throw new BadRequestException('来源单据已生成应收单');
  }

  private assertCreateReceivableStatus(status?: AccountsReceivableStatus) {
    if (
      status &&
      ![
        AccountsReceivableStatus.DRAFT,
        AccountsReceivableStatus.CONFIRMED,
      ].includes(status)
    ) {
      throw new BadRequestException('创建应收单时只能为草稿或已确认状态');
    }
  }

  private assertCreatePaymentStatus(status?: AccountsReceivablePaymentStatus) {
    if (status === AccountsReceivablePaymentStatus.CANCELLED) {
      throw new BadRequestException('创建收款单时不能直接创建为已取消');
    }
  }

  private async generateNoTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    prefix: 'AR' | 'ARP',
  ) {
    const no = `${prefix}${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
    const exists =
      prefix === 'AR'
        ? await tx.accountsReceivable.findFirst({
            where: { tenantId, receivableNo: no },
            select: { id: true },
          })
        : await tx.accountsReceivablePayment.findFirst({
            where: { tenantId, paymentNo: no },
            select: { id: true },
          });
    return exists ? this.generateNoTx(tx, tenantId, prefix) : no;
  }

  private async syncFiles(
    user: CurrentUser,
    ownerType: string,
    ownerId: string,
    fileIds: string[],
    relationName: string,
  ) {
    await this.fileService.replaceOwnerRelations(
      user,
      ownerType,
      ownerId,
      fileIds.map((fileId, index) => ({
        fileId,
        fieldCode: 'attachments',
        relationName,
        sort: index,
      })),
    );
  }

  private round(value: number) {
    return Math.round(value * 10000) / 10000;
  }
  private sum(values: number[]) {
    return this.round(
      values.reduce((sum, value) => sum + this.toNumber(value), 0),
    );
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
