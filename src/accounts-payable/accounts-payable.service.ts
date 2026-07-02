// src/accounts-payable/accounts-payable.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountsPayablePaymentMethod,
  AccountsPayablePaymentStatus,
  AccountsPayableSourceType,
  AccountsPayableStatus,
  InboundReceiptStatus,
  Prisma,
  PurchaseOrderStatus,
} from '../generated/prisma/client';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../file/file.service';
import { CreateAccountsPayableDto } from './dto/create-accounts-payable.dto';
import { UpdateAccountsPayableDto } from './dto/update-accounts-payable.dto';
import { QueryAccountsPayableDto } from './dto/query-accounts-payable.dto';
import { CreateApFromPurchaseOrderDto } from './dto/create-ap-from-purchase-order.dto';
import { CreateApFromInboundReceiptDto } from './dto/create-ap-from-inbound-receipt.dto';
import { AccountsPayableItemInputDto } from './dto/accounts-payable-item-input.dto';
import { CreateApPaymentDto } from './dto/create-ap-payment.dto';
import { UpdateApPaymentDto } from './dto/update-ap-payment.dto';
import { QueryApPaymentDto } from './dto/query-ap-payment.dto';
import { ApPaymentAllocationInputDto } from './dto/ap-payment-allocation-input.dto';

@Injectable()
export class AccountsPayableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  async createPayable(user: CurrentUser, dto: CreateAccountsPayableDto) {
    const tenantId = requireTenantId(user);
    const payable = await this.prisma.$transaction((tx) =>
      this.createPayableTx(tx, tenantId, user.id, dto),
    );

    if (dto.attachmentFileIds !== undefined) {
      await this.syncFiles(
        user,
        'accounts_payable',
        payable.id,
        dto.attachmentFileIds,
        '应付单附件',
      );
    }

    return this.findPayable(user, payable.id);
  }

  async createFromPurchaseOrder(
    user: CurrentUser,
    purchaseOrderId: string,
    dto: CreateApFromPurchaseOrderDto,
  ) {
    const tenantId = requireTenantId(user);

    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, tenantId },
      include: { items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
    });

    if (!order) throw new NotFoundException('采购订单不存在');
    if (
      ![
        PurchaseOrderStatus.CONFIRMED,
        PurchaseOrderStatus.SENT,
        PurchaseOrderStatus.PARTIALLY_RECEIVED,
        PurchaseOrderStatus.RECEIVED,
        PurchaseOrderStatus.CLOSED,
      ].includes(order.status)
    ) {
      throw new BadRequestException('当前采购订单状态不允许生成应付');
    }

    return this.createPayable(user, {
      payableNo: dto.payableNo,
      sourceType: AccountsPayableSourceType.PURCHASE_ORDER,
      sourceId: order.id,
      sourceNo: order.purchaseOrderNo,
      purchaseOrderId: order.id,
      supplierId: order.supplierId ?? undefined,
      supplierName: order.supplierName ?? undefined,
      subject: dto.subject ?? `采购应付 ${order.purchaseOrderNo}`,
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
        quantity: this.toNumber(item.purchaseQuantity),
        unitPrice: this.toNumber(item.unitPrice),
        currencyCode: item.currencyCode ?? order.currencyCode,
        remark: item.remark ?? undefined,
        sort: item.sort,
      })),
    });
  }

  async createFromInboundReceipt(
    user: CurrentUser,
    receiptId: string,
    dto: CreateApFromInboundReceiptDto,
  ) {
    const tenantId = requireTenantId(user);

    const receipt = await this.prisma.inboundReceipt.findFirst({
      where: { id: receiptId, tenantId },
      include: { items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
    });

    if (!receipt) throw new NotFoundException('收货单不存在');
    if (receipt.status !== InboundReceiptStatus.CONFIRMED) {
      throw new BadRequestException('只有已确认收货单才能生成应付');
    }

    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id: receipt.purchaseOrderId, tenantId },
    });

    const currencyCode =
      order?.currencyCode ?? receipt.items[0]?.currencyCode ?? 'USD';

    return this.createPayable(user, {
      payableNo: dto.payableNo,
      sourceType: AccountsPayableSourceType.INBOUND_RECEIPT,
      sourceId: receipt.id,
      sourceNo: receipt.receiptNo,
      purchaseOrderId: receipt.purchaseOrderId,
      inboundReceiptId: receipt.id,
      supplierId: receipt.supplierId ?? undefined,
      supplierName: receipt.supplierName ?? undefined,
      subject: dto.subject ?? `收货应付 ${receipt.receiptNo}`,
      currencyCode,
      exchangeRate: this.optionalNumber(order?.exchangeRate),
      totalAmount: this.toNumber(receipt.totalAmount),
      dueDate: dto.dueDate,
      remark: dto.remark,
      extra: dto.extra,
      items: receipt.items.map((item) => ({
        sourceItemId: item.id,
        productId: item.productId ?? undefined,
        productCode: item.productCode ?? undefined,
        productNameCn: item.productNameCn ?? undefined,
        productNameEn: item.productNameEn ?? undefined,
        categoryCode: item.categoryCode ?? undefined,
        unitCode: item.unitCode ?? undefined,
        quantity: this.toNumber(item.receivedQuantity),
        unitPrice: this.toNumber(item.unitPrice),
        currencyCode: item.currencyCode ?? currencyCode,
        remark: item.remark ?? undefined,
        sort: item.sort,
      })),
    });
  }

  async findPayables(user: CurrentUser, query: QueryAccountsPayableDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.AccountsPayableWhereInput = {
      tenantId,
      status: query.status,
      sourceType: query.sourceType,
      supplierId: query.supplierId,
      purchaseOrderId: query.purchaseOrderId,
      inboundReceiptId: query.inboundReceiptId,
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
              { payableNo: { contains: query.keyword, mode: 'insensitive' } },
              { sourceNo: { contains: query.keyword, mode: 'insensitive' } },
              {
                supplierName: { contains: query.keyword, mode: 'insensitive' },
              },
              { subject: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.accountsPayable.count({ where }),
      this.prisma.accountsPayable.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { items: true, allocations: true } } },
      }),
    ]);

    return { total, page, pageSize, list };
  }

  async findPayable(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const row = await this.prisma.accountsPayable.findFirst({
      where: { id, tenantId },
      include: {
        items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] },
        allocations: {
          include: { payment: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!row) throw new NotFoundException('应付单不存在');

    const attachments = await this.fileService.findRelations(user, {
      ownerType: 'accounts_payable',
      ownerId: row.id,
    });

    return { ...row, attachments };
  }

  async updatePayable(
    user: CurrentUser,
    id: string,
    dto: UpdateAccountsPayableDto,
  ) {
    const tenantId = requireTenantId(user);

    await this.prisma.$transaction(async (tx) => {
      const row = await this.ensurePayableTx(tx, tenantId, id);
      if (row.status !== AccountsPayableStatus.DRAFT)
        throw new BadRequestException('只有草稿应付单允许编辑');

      if (dto.payableNo)
        await this.assertPayableNoUniqueTx(tx, tenantId, dto.payableNo, id);

      await tx.accountsPayable.update({
        where: { id },
        data: {
          payableNo: dto.payableNo,
          supplierId: dto.supplierId,
          supplierName: dto.supplierName,
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
          ? await this.replacePayableItemsTx(
              tx,
              tenantId,
              id,
              dto.items,
              dto.currencyCode ?? row.currencyCode,
            )
          : dto.totalAmount!;

        await tx.accountsPayable.update({
          where: { id },
          data: {
            totalAmount,
            outstandingAmount: this.round(
              totalAmount - this.toNumber(row.paidAmount),
            ),
          },
        });
      }
    });

    if (dto.attachmentFileIds !== undefined) {
      await this.syncFiles(
        user,
        'accounts_payable',
        id,
        dto.attachmentFileIds,
        '应付单附件',
      );
    }

    return this.findPayable(user, id);
  }

  async confirmPayable(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    return this.prisma.$transaction(async (tx) => {
      const row = await this.ensurePayableTx(tx, tenantId, id);
      if (row.status !== AccountsPayableStatus.DRAFT)
        throw new BadRequestException('只有草稿应付单可以确认');

      return tx.accountsPayable.update({
        where: { id },
        data: {
          status: AccountsPayableStatus.CONFIRMED,
          confirmedAt: new Date(),
          outstandingAmount: this.round(
            this.toNumber(row.totalAmount) - this.toNumber(row.paidAmount),
          ),
          updatedById: user.id,
        },
      });
    });
  }

  async cancelPayable(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    return this.prisma.$transaction(async (tx) => {
      const row = await this.ensurePayableTx(tx, tenantId, id);
      if (this.toNumber(row.paidAmount) > 0)
        throw new BadRequestException('已有付款核销的应付单不能取消');

      return tx.accountsPayable.update({
        where: { id },
        data: {
          status: AccountsPayableStatus.CANCELLED,
          cancelledAt: new Date(),
          updatedById: user.id,
        },
      });
    });
  }

  async createPayment(user: CurrentUser, dto: CreateApPaymentDto) {
    const tenantId = requireTenantId(user);
    this.assertCreatePaymentStatus(dto.status);

    const payment = await this.prisma.$transaction(async (tx) => {
      const paymentNo =
        dto.paymentNo ?? (await this.generateNoTx(tx, tenantId, 'APP'));
      await this.assertPaymentNoUniqueTx(tx, tenantId, paymentNo);

      const created = await tx.accountsPayablePayment.create({
        data: {
          tenantId,
          paymentNo,
          supplierId: dto.supplierId,
          supplierName: dto.supplierName,
          status: AccountsPayablePaymentStatus.DRAFT,
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          method: dto.method ?? AccountsPayablePaymentMethod.BANK_TRANSFER,
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

      if (dto.status === AccountsPayablePaymentStatus.CONFIRMED) {
        await this.applyPaymentTx(tx, tenantId, created.id, user.id);
      }

      return created;
    });

    if (dto.attachmentFileIds !== undefined) {
      await this.syncFiles(
        user,
        'accounts_payable_payment',
        payment.id,
        dto.attachmentFileIds,
        '付款单附件',
      );
    }

    return this.findPayment(user, payment.id);
  }

  async findPayments(user: CurrentUser, query: QueryApPaymentDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.AccountsPayablePaymentWhereInput = {
      tenantId,
      status: query.status,
      supplierId: query.supplierId,
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
                supplierName: { contains: query.keyword, mode: 'insensitive' },
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
      this.prisma.accountsPayablePayment.count({ where }),
      this.prisma.accountsPayablePayment.findMany({
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

    const row = await this.prisma.accountsPayablePayment.findFirst({
      where: { id, tenantId },
      include: {
        allocations: {
          include: { payable: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!row) throw new NotFoundException('付款单不存在');

    const attachments = await this.fileService.findRelations(user, {
      ownerType: 'accounts_payable_payment',
      ownerId: row.id,
    });

    return { ...row, attachments };
  }

  async updatePayment(user: CurrentUser, id: string, dto: UpdateApPaymentDto) {
    const tenantId = requireTenantId(user);

    await this.prisma.$transaction(async (tx) => {
      const payment = await this.ensurePaymentTx(tx, tenantId, id);
      if (payment.status !== AccountsPayablePaymentStatus.DRAFT)
        throw new BadRequestException('只有草稿付款单允许编辑');

      if (dto.paymentNo)
        await this.assertPaymentNoUniqueTx(tx, tenantId, dto.paymentNo, id);

      await tx.accountsPayablePayment.update({
        where: { id },
        data: {
          paymentNo: dto.paymentNo,
          supplierId: dto.supplierId,
          supplierName: dto.supplierName,
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
        'accounts_payable_payment',
        id,
        dto.attachmentFileIds,
        '付款单附件',
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
      if (payment.status === AccountsPayablePaymentStatus.CANCELLED)
        return payment;

      if (payment.status === AccountsPayablePaymentStatus.CONFIRMED) {
        const allocations = await tx.accountsPayablePaymentAllocation.findMany({
          where: { tenantId, paymentId: id },
        });

        for (const allocation of allocations) {
          const payable = await this.ensurePayableTx(
            tx,
            tenantId,
            allocation.payableId,
          );
          const paidAmount = Math.max(
            0,
            this.round(
              this.toNumber(payable.paidAmount) -
                this.toNumber(allocation.amount),
            ),
          );
          await this.updatePayablePaidStateTx(
            tx,
            payable.id,
            paidAmount,
            user.id,
          );
        }
      }

      return tx.accountsPayablePayment.update({
        where: { id },
        data: {
          status: AccountsPayablePaymentStatus.CANCELLED,
          cancelledAt: new Date(),
          updatedById: user.id,
        },
      });
    });
  }

  private async createPayableTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    userId: string,
    dto: CreateAccountsPayableDto,
  ) {
    this.assertCreatePayableStatus(dto.status);

    if (dto.sourceType && dto.sourceId) {
      await this.assertSourceNotUsedTx(
        tx,
        tenantId,
        dto.sourceType,
        dto.sourceId,
      );
    }

    const payableNo =
      dto.payableNo ?? (await this.generateNoTx(tx, tenantId, 'AP'));
    await this.assertPayableNoUniqueTx(tx, tenantId, payableNo);

    const totalAmount = dto.items?.length
      ? this.sum(dto.items.map((item) => item.quantity * item.unitPrice))
      : (dto.totalAmount ?? 0);

    const status = dto.status ?? AccountsPayableStatus.DRAFT;

    const created = await tx.accountsPayable.create({
      data: {
        tenantId,
        payableNo,
        sourceType: dto.sourceType ?? AccountsPayableSourceType.MANUAL,
        sourceId: dto.sourceId,
        sourceNo: dto.sourceNo,
        purchaseOrderId: dto.purchaseOrderId,
        inboundReceiptId: dto.inboundReceiptId,
        supplierId: dto.supplierId,
        supplierName: dto.supplierName,
        subject: dto.subject,
        status,
        currencyCode: dto.currencyCode,
        exchangeRate: dto.exchangeRate,
        totalAmount,
        paidAmount: 0,
        outstandingAmount: totalAmount,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        confirmedAt:
          status === AccountsPayableStatus.CONFIRMED ? new Date() : undefined,
        remark: dto.remark,
        extra: this.toJson(dto.extra),
        createdById: userId,
      },
    });

    if (dto.items?.length) {
      await this.replacePayableItemsTx(
        tx,
        tenantId,
        created.id,
        dto.items,
        dto.currencyCode,
      );
    }

    return created;
  }

  private async replacePayableItemsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    payableId: string,
    items: AccountsPayableItemInputDto[],
    currencyCode: string,
  ) {
    await tx.accountsPayableItem.deleteMany({ where: { tenantId, payableId } });

    const rows = items.map((item, index) => ({
      tenantId,
      payableId,
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

    if (rows.length) await tx.accountsPayableItem.createMany({ data: rows });
    return this.sum(rows.map((item) => item.amount));
  }

  private async replaceAllocationsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    paymentId: string,
    currencyCode: string,
    paymentAmount: number,
    allocations: ApPaymentAllocationInputDto[],
  ) {
    await tx.accountsPayablePaymentAllocation.deleteMany({
      where: { tenantId, paymentId },
    });

    const totalAllocated = this.sum(allocations.map((item) => item.amount));
    if (totalAllocated > paymentAmount)
      throw new BadRequestException('核销金额不能大于付款金额');

    for (const allocation of allocations) {
      const payable = await this.ensurePayableTx(
        tx,
        tenantId,
        allocation.payableId,
      );
      if (
        ![
          AccountsPayableStatus.CONFIRMED,
          AccountsPayableStatus.PARTIALLY_PAID,
        ].includes(payable.status)
      ) {
        throw new BadRequestException('应付单状态不允许核销');
      }
      if (payable.currencyCode !== currencyCode)
        throw new BadRequestException('付款币种与应付单币种不一致');
      if (allocation.amount > this.toNumber(payable.outstandingAmount))
        throw new BadRequestException('核销金额不能大于应付未付金额');

      await tx.accountsPayablePaymentAllocation.create({
        data: {
          tenantId,
          paymentId,
          payableId: allocation.payableId,
          amount: allocation.amount,
          currencyCode,
          remark: allocation.remark,
        },
      });
    }

    await tx.accountsPayablePayment.update({
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
    if (payment.status !== AccountsPayablePaymentStatus.DRAFT)
      throw new BadRequestException('只有草稿付款单可以确认');

    const allocations = await tx.accountsPayablePaymentAllocation.findMany({
      where: { tenantId, paymentId },
    });

    for (const allocation of allocations) {
      const payable = await this.ensurePayableTx(
        tx,
        tenantId,
        allocation.payableId,
      );
      const paidAmount = this.round(
        this.toNumber(payable.paidAmount) + this.toNumber(allocation.amount),
      );
      await this.updatePayablePaidStateTx(tx, payable.id, paidAmount, userId);
    }

    return tx.accountsPayablePayment.update({
      where: { id: paymentId },
      data: {
        status: AccountsPayablePaymentStatus.CONFIRMED,
        confirmedAt: new Date(),
        updatedById: userId,
      },
    });
  }

  private async updatePayablePaidStateTx(
    tx: Prisma.TransactionClient,
    payableId: string,
    paidAmount: number,
    userId: string,
  ) {
    const payable = await tx.accountsPayable.findUnique({
      where: { id: payableId },
    });
    if (!payable) throw new NotFoundException('应付单不存在');

    const totalAmount = this.toNumber(payable.totalAmount);
    const outstandingAmount = this.round(totalAmount - paidAmount);
    const status =
      paidAmount <= 0
        ? AccountsPayableStatus.CONFIRMED
        : paidAmount >= totalAmount
          ? AccountsPayableStatus.PAID
          : AccountsPayableStatus.PARTIALLY_PAID;

    return tx.accountsPayable.update({
      where: { id: payableId },
      data: {
        paidAmount,
        outstandingAmount,
        status,
        closedAt: status === AccountsPayableStatus.PAID ? new Date() : null,
        updatedById: userId,
      },
    });
  }

  private async currentAllocationInputsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    paymentId: string,
  ): Promise<ApPaymentAllocationInputDto[]> {
    const rows = await tx.accountsPayablePaymentAllocation.findMany({
      where: { tenantId, paymentId },
    });
    return rows.map((row) => ({
      payableId: row.payableId,
      amount: this.toNumber(row.amount),
      remark: row.remark ?? undefined,
    }));
  }

  private async ensurePayableTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const row = await tx.accountsPayable.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('应付单不存在');
    return row;
  }

  private async ensurePaymentTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const row = await tx.accountsPayablePayment.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('付款单不存在');
    return row;
  }

  private async assertPayableNoUniqueTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    payableNo: string,
    excludeId?: string,
  ) {
    const exists = await tx.accountsPayable.findFirst({
      where: {
        tenantId,
        payableNo,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (exists) throw new BadRequestException('应付单编号已存在');
  }

  private async assertPaymentNoUniqueTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    paymentNo: string,
    excludeId?: string,
  ) {
    const exists = await tx.accountsPayablePayment.findFirst({
      where: {
        tenantId,
        paymentNo,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (exists) throw new BadRequestException('付款单编号已存在');
  }

  private async assertSourceNotUsedTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    sourceType: AccountsPayableSourceType,
    sourceId: string,
  ) {
    const exists = await tx.accountsPayable.findFirst({
      where: {
        tenantId,
        sourceType,
        sourceId,
        status: { not: AccountsPayableStatus.CANCELLED },
      },
      select: { id: true },
    });
    if (exists) throw new BadRequestException('来源单据已生成应付单');
  }

  private assertCreatePayableStatus(status?: AccountsPayableStatus) {
    if (
      status &&
      ![AccountsPayableStatus.DRAFT, AccountsPayableStatus.CONFIRMED].includes(
        status,
      )
    ) {
      throw new BadRequestException('创建应付单时只能为草稿或已确认状态');
    }
  }

  private assertCreatePaymentStatus(status?: AccountsPayablePaymentStatus) {
    if (status === AccountsPayablePaymentStatus.CANCELLED) {
      throw new BadRequestException('创建付款单时不能直接创建为已取消');
    }
  }

  private async generateNoTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    prefix: 'AP' | 'APP',
  ) {
    const no = `${prefix}${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
    const exists =
      prefix === 'AP'
        ? await tx.accountsPayable.findFirst({
            where: { tenantId, payableNo: no },
            select: { id: true },
          })
        : await tx.accountsPayablePayment.findFirst({
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
