// src/sales-order/sales-order.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SalesContractStatus,
  SalesOrderStatus,
} from '../generated/prisma/client';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../file/file.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { QuerySalesOrderDto } from './dto/query-sales-order.dto';
import { ChangeSalesOrderStatusDto } from './dto/change-sales-order-status.dto';
import { CreateSalesOrderFromContractDto } from './dto/create-sales-order-from-contract.dto';
import { SalesOrderItemInputDto } from './dto/sales-order-item-input.dto';

@Injectable()
export class SalesOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  async create(user: CurrentUser, dto: CreateSalesOrderDto) {
    const tenantId = requireTenantId(user);
    const order = await this.prisma.$transaction(async (tx) => {
      const contract = dto.contractId
        ? await this.findContractTx(tx, tenantId, dto.contractId)
        : undefined;
      const orderNo = dto.orderNo ?? (await this.generateNoTx(tx, tenantId));
      await this.assertNoUniqueTx(tx, tenantId, orderNo);

      const created = await tx.salesOrder.create({
        data: {
          tenantId,
          orderNo,
          contractId: dto.contractId,
          quotationId: dto.quotationId ?? contract?.quotationId,
          customerId: dto.customerId ?? contract?.customerId,
          customerName: dto.customerName ?? contract?.customerName,
          customerContactId:
            dto.customerContactId ?? contract?.customerContactId,
          customerContactName:
            dto.customerContactName ?? contract?.customerContactName,
          subject: dto.subject,
          status: dto.status ?? SalesOrderStatus.DRAFT,
          currencyCode: dto.currencyCode,
          exchangeRate: dto.exchangeRate ?? contract?.exchangeRate,
          tradeTerm: dto.tradeTerm ?? contract?.tradeTerm,
          paymentTerm: dto.paymentTerm ?? contract?.paymentTerm,
          expectedDeliveryDate: dto.expectedDeliveryDate
            ? new Date(dto.expectedDeliveryDate)
            : contract?.expectedDeliveryDate,
          ownerUserId: dto.ownerUserId ?? contract?.ownerUserId,
          freightAmount:
            dto.freightAmount ?? this.toNumber(contract?.freightAmount),
          otherAmount: dto.otherAmount ?? this.toNumber(contract?.otherAmount),
          remark: dto.remark,
          extra: this.toJson(dto.extra),
          createdById: user.id,
        },
      });

      const items =
        dto.items ?? (contract ? this.mapContractItems(contract) : []);
      const totals = await this.replaceItemsTx(
        tx,
        tenantId,
        created.id,
        items,
        dto.freightAmount ?? this.toNumber(contract?.freightAmount),
        dto.otherAmount ?? this.toNumber(contract?.otherAmount),
      );
      await tx.salesOrder.update({ where: { id: created.id }, data: totals });

      return created;
    });

    if (dto.attachmentFileIds !== undefined)
      await this.syncAttachments(user, order.id, dto.attachmentFileIds);
    return this.findOne(user, order.id);
  }

  async createFromContract(
    user: CurrentUser,
    contractId: string,
    dto: CreateSalesOrderFromContractDto,
  ) {
    const tenantId = requireTenantId(user);
    const contract = await this.prisma.salesContract.findFirst({
      where: { id: contractId, tenantId },
      include: { items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
    });
    if (!contract) throw new NotFoundException('合同不存在');
    if (
      ![SalesContractStatus.CONFIRMED, SalesContractStatus.ACTIVE].includes(
        contract.status,
      )
    )
      throw new BadRequestException('只有已确认或执行中的合同才能生成销售订单');

    return this.create(user, {
      ...dto,
      contractId,
      quotationId: dto.quotationId ?? contract.quotationId ?? undefined,
      subject: dto.subject ?? contract.subject,
      currencyCode: dto.currencyCode ?? contract.currencyCode,
      customerId: dto.customerId ?? contract.customerId ?? undefined,
      customerName: dto.customerName ?? contract.customerName ?? undefined,
      customerContactId:
        dto.customerContactId ?? contract.customerContactId ?? undefined,
      customerContactName:
        dto.customerContactName ?? contract.customerContactName ?? undefined,
      items: dto.items ?? this.mapContractItems(contract),
    });
  }

  async findMany(user: CurrentUser, query: QuerySalesOrderDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.SalesOrderWhereInput = {
      tenantId,
      status: query.status,
      contractId: query.contractId,
      quotationId: query.quotationId,
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
              { orderNo: { contains: query.keyword, mode: 'insensitive' } },
              { subject: { contains: query.keyword, mode: 'insensitive' } },
              {
                customerName: { contains: query.keyword, mode: 'insensitive' },
              },
            ],
          }
        : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.salesOrder.count({ where }),
      this.prisma.salesOrder.findMany({
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
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, tenantId },
      include: {
        items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] },
        contract: true,
      },
    });
    if (!order) throw new NotFoundException('销售订单不存在');
    const attachments = await this.fileService.findRelations(user, {
      ownerType: 'sales_order',
      ownerId: order.id,
    });
    return { ...order, attachments };
  }

  async update(user: CurrentUser, id: string, dto: UpdateSalesOrderDto) {
    const tenantId = requireTenantId(user);
    await this.prisma.$transaction(async (tx) => {
      const order = await this.ensureTx(tx, tenantId, id);
      if (order.status !== SalesOrderStatus.DRAFT)
        throw new BadRequestException('只有草稿销售订单允许编辑');
      if (dto.orderNo)
        await this.assertNoUniqueTx(tx, tenantId, dto.orderNo, id);

      await tx.salesOrder.update({
        where: { id },
        data: {
          orderNo: dto.orderNo,
          customerId: dto.customerId,
          customerName: dto.customerName,
          customerContactId: dto.customerContactId,
          customerContactName: dto.customerContactName,
          subject: dto.subject,
          currencyCode: dto.currencyCode,
          exchangeRate: dto.exchangeRate,
          tradeTerm: dto.tradeTerm,
          paymentTerm: dto.paymentTerm,
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
        );
        await tx.salesOrder.update({ where: { id }, data: totals });
      }
    });

    if (dto.attachmentFileIds !== undefined)
      await this.syncAttachments(user, id, dto.attachmentFileIds);
    return this.findOne(user, id);
  }

  async changeStatus(
    user: CurrentUser,
    id: string,
    dto: ChangeSalesOrderStatusDto,
  ) {
    const tenantId = requireTenantId(user);
    return this.prisma.$transaction(async (tx) => {
      const order = await this.ensureTx(tx, tenantId, id);
      const now = new Date();
      const data: Prisma.SalesOrderUpdateInput = {
        status: dto.status,
        updatedById: user.id,
      };
      if (dto.status === SalesOrderStatus.CONFIRMED) data.confirmedAt = now;
      if (dto.status === SalesOrderStatus.PROCESSING) data.processingAt = now;
      if (dto.status === SalesOrderStatus.SHIPPED) data.shippedAt = now;
      if (dto.status === SalesOrderStatus.COMPLETED) data.completedAt = now;
      if (dto.status === SalesOrderStatus.CANCELLED) data.cancelledAt = now;

      if (order.contractId && dto.status === SalesOrderStatus.CONFIRMED) {
        await tx.salesContract.update({
          where: { id: order.contractId },
          data: { status: SalesContractStatus.ACTIVE, updatedById: user.id },
        });
      }

      return tx.salesOrder.update({ where: { id }, data });
    });
  }

  async remove(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    await this.ensure(tenantId, id);
    return this.prisma.salesOrder.update({
      where: { id },
      data: {
        status: SalesOrderStatus.CANCELLED,
        cancelledAt: new Date(),
        updatedById: user.id,
      },
    });
  }

  private async replaceItemsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    orderId: string,
    items: SalesOrderItemInputDto[],
    freightAmount: number,
    otherAmount: number,
  ) {
    await tx.salesOrderItem.deleteMany({ where: { tenantId, orderId } });
    const rows = items.map((item, index) => {
      const grossAmount = this.round(item.orderedQuantity * item.unitPrice);
      const discountAmount = item.discountAmount ?? 0;
      const taxAmount = item.taxAmount ?? 0;
      return {
        tenantId,
        orderId,
        sourceContractItemId: item.sourceContractItemId,
        sourceQuotationItemId: item.sourceQuotationItemId,
        productId: item.productId,
        productCode: item.productCode,
        productNameCn: item.productNameCn,
        productNameEn: item.productNameEn,
        categoryCode: item.categoryCode,
        unitCode: item.unitCode,
        orderedQuantity: item.orderedQuantity,
        unitPrice: item.unitPrice,
        grossAmount,
        discountAmount,
        taxAmount,
        amount: this.round(grossAmount - discountAmount + taxAmount),
        currencyCode: item.currencyCode,
        expectedDeliveryDate: item.expectedDeliveryDate
          ? new Date(item.expectedDeliveryDate)
          : undefined,
        remark: item.remark,
        extra: this.toJson(item.extra),
        sort: item.sort ?? index,
      };
    });
    if (rows.length) await tx.salesOrderItem.createMany({ data: rows });
    return this.totals(rows, freightAmount, otherAmount);
  }

  private mapContractItems(contract: any): SalesOrderItemInputDto[] {
    return contract.items.map((item) => ({
      sourceContractItemId: item.id,
      sourceQuotationItemId: item.sourceQuotationItemId ?? undefined,
      productId: item.productId ?? undefined,
      productCode: item.productCode ?? undefined,
      productNameCn: item.productNameCn ?? undefined,
      productNameEn: item.productNameEn ?? undefined,
      categoryCode: item.categoryCode ?? undefined,
      unitCode: item.unitCode ?? undefined,
      orderedQuantity: this.toNumber(item.quantity),
      unitPrice: this.toNumber(item.unitPrice),
      discountAmount: this.toNumber(item.discountAmount),
      taxAmount: this.toNumber(item.taxAmount),
      currencyCode: item.currencyCode ?? contract.currencyCode,
      expectedDeliveryDate: item.expectedDeliveryDate?.toISOString(),
      remark: item.remark ?? undefined,
      extra: this.toPlainObject(item.extra),
      sort: item.sort,
    }));
  }

  private async findContractTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const contract = await tx.salesContract.findFirst({
      where: { id, tenantId },
      include: { items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
    });
    if (!contract) throw new NotFoundException('合同不存在');
    return contract;
  }

  private totals(items: any[], freightAmount: number, otherAmount: number) {
    const subtotalAmount = this.round(
      items.reduce((s, i) => s + this.toNumber(i.grossAmount), 0),
    );
    const discountAmount = this.round(
      items.reduce((s, i) => s + this.toNumber(i.discountAmount), 0),
    );
    const taxAmount = this.round(
      items.reduce((s, i) => s + this.toNumber(i.taxAmount), 0),
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

  private async syncAttachments(
    user: CurrentUser,
    orderId: string,
    fileIds: string[],
  ) {
    await this.fileService.replaceOwnerRelations(
      user,
      'sales_order',
      orderId,
      fileIds.map((fileId, index) => ({
        fileId,
        fieldCode: 'attachments',
        relationName: '销售订单附件',
        sort: index,
      })),
    );
  }

  private async ensure(tenantId: string, id: string) {
    const row = await this.prisma.salesOrder.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('销售订单不存在');
    return row;
  }

  private async ensureTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const row = await tx.salesOrder.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('销售订单不存在');
    return row;
  }

  private async assertNoUniqueTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    orderNo: string,
    excludeId?: string,
  ) {
    const exists = await tx.salesOrder.findFirst({
      where: {
        tenantId,
        orderNo,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (exists) throw new BadRequestException('销售订单编号已存在');
  }

  private async generateNoTx(tx: Prisma.TransactionClient, tenantId: string) {
    const no = `SO${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
    const exists = await tx.salesOrder.findFirst({
      where: { tenantId, orderNo: no },
    });
    return exists ? this.generateNoTx(tx, tenantId) : no;
  }

  private round(v: number) {
    return Math.round(v * 10000) / 10000;
  }
  private toNumber(v: unknown) {
    return v === null || v === undefined ? 0 : Number(v);
  }
  private toJson(v: unknown): Prisma.InputJsonValue | undefined {
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  }
  private toPlainObject(v: unknown): Record<string, unknown> | undefined {
    return v ? JSON.parse(JSON.stringify(v)) : undefined;
  }
}
