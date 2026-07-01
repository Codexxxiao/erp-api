// src/contract/contract.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  QuotationStatus,
  SalesContractStatus,
} from '../generated/prisma/client';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../file/file.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { QueryContractDto } from './dto/query-contract.dto';
import { ChangeContractStatusDto } from './dto/change-contract-status.dto';
import { CreateContractFromQuotationDto } from './dto/create-contract-from-quotation.dto';
import { ContractItemInputDto } from './dto/contract-item-input.dto';

@Injectable()
export class ContractService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  async create(user: CurrentUser, dto: CreateContractDto) {
    const tenantId = requireTenantId(user);
    const contract = await this.prisma.$transaction(async (tx) => {
      const quotation = dto.quotationId
        ? await this.findQuotationTx(tx, tenantId, dto.quotationId)
        : undefined;
      const contractNo =
        dto.contractNo ?? (await this.generateNoTx(tx, tenantId));
      await this.assertNoUniqueTx(tx, tenantId, contractNo);

      const created = await tx.salesContract.create({
        data: {
          tenantId,
          contractNo,
          quotationId: dto.quotationId,
          customerId: dto.customerId ?? quotation?.customerId,
          customerName: dto.customerName ?? quotation?.customerName,
          customerContactId:
            dto.customerContactId ?? quotation?.customerContactId,
          customerContactName:
            dto.customerContactName ?? quotation?.customerContactName,
          subject: dto.subject,
          status: dto.status ?? SalesContractStatus.DRAFT,
          currencyCode: dto.currencyCode,
          exchangeRate: dto.exchangeRate,
          tradeTerm: dto.tradeTerm ?? quotation?.tradeTerm,
          paymentTerm: dto.paymentTerm ?? quotation?.paymentTerm,
          signDate: dto.signDate ? new Date(dto.signDate) : undefined,
          effectiveDate: dto.effectiveDate
            ? new Date(dto.effectiveDate)
            : undefined,
          expectedDeliveryDate: dto.expectedDeliveryDate
            ? new Date(dto.expectedDeliveryDate)
            : undefined,
          ownerUserId: dto.ownerUserId ?? quotation?.ownerUserId,
          freightAmount:
            dto.freightAmount ?? this.toNumber(quotation?.freightAmount),
          otherAmount: dto.otherAmount ?? this.toNumber(quotation?.otherAmount),
          remark: dto.remark,
          extra: this.toJson(dto.extra),
          createdById: user.id,
        },
      });

      const items =
        dto.items ?? (quotation ? this.mapQuotationItems(quotation) : []);
      const totals = await this.replaceItemsTx(
        tx,
        tenantId,
        created.id,
        items,
        dto.freightAmount ?? this.toNumber(quotation?.freightAmount),
        dto.otherAmount ?? this.toNumber(quotation?.otherAmount),
      );
      await tx.salesContract.update({
        where: { id: created.id },
        data: totals,
      });
      return created;
    });

    if (dto.attachmentFileIds !== undefined)
      await this.syncAttachments(user, contract.id, dto.attachmentFileIds);
    return this.findOne(user, contract.id);
  }

  async createFromQuotation(
    user: CurrentUser,
    quotationId: string,
    dto: CreateContractFromQuotationDto,
  ) {
    const tenantId = requireTenantId(user);
    const quotation = await this.prisma.quotation.findFirst({
      where: { id: quotationId, tenantId },
      include: { items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
    });
    if (!quotation) throw new NotFoundException('报价单不存在');
    if (quotation.status !== QuotationStatus.ACCEPTED)
      throw new BadRequestException('只有已接受的报价单才能生成合同');

    return this.create(user, {
      ...dto,
      quotationId,
      subject: dto.subject ?? quotation.subject,
      currencyCode: dto.currencyCode ?? quotation.currencyCode,
      customerId: dto.customerId ?? quotation.customerId ?? undefined,
      customerName: dto.customerName ?? quotation.customerName ?? undefined,
      customerContactId:
        dto.customerContactId ?? quotation.customerContactId ?? undefined,
      customerContactName:
        dto.customerContactName ?? quotation.customerContactName ?? undefined,
      items: dto.items ?? this.mapQuotationItems(quotation),
    });
  }

  async findMany(user: CurrentUser, query: QueryContractDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where: Prisma.SalesContractWhereInput = {
      tenantId,
      status: query.status,
      quotationId: query.quotationId,
      customerId: query.customerId,
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
              { contractNo: { contains: query.keyword, mode: 'insensitive' } },
              { subject: { contains: query.keyword, mode: 'insensitive' } },
              {
                customerName: { contains: query.keyword, mode: 'insensitive' },
              },
            ],
          }
        : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.salesContract.count({ where }),
      this.prisma.salesContract.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { items: true, salesOrders: true } } },
      }),
    ]);

    return { total, page, pageSize, list };
  }

  async findOne(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    const contract = await this.prisma.salesContract.findFirst({
      where: { id, tenantId },
      include: {
        items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] },
        salesOrders: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!contract) throw new NotFoundException('合同不存在');
    const attachments = await this.fileService.findRelations(user, {
      ownerType: 'sales_contract',
      ownerId: contract.id,
    });
    return { ...contract, attachments };
  }

  async update(user: CurrentUser, id: string, dto: UpdateContractDto) {
    const tenantId = requireTenantId(user);
    await this.prisma.$transaction(async (tx) => {
      const contract = await this.ensureTx(tx, tenantId, id);
      if (contract.status !== SalesContractStatus.DRAFT)
        throw new BadRequestException('只有草稿合同允许编辑');
      if (dto.contractNo)
        await this.assertNoUniqueTx(tx, tenantId, dto.contractNo, id);

      await tx.salesContract.update({
        where: { id },
        data: {
          contractNo: dto.contractNo,
          customerId: dto.customerId,
          customerName: dto.customerName,
          customerContactId: dto.customerContactId,
          customerContactName: dto.customerContactName,
          subject: dto.subject,
          currencyCode: dto.currencyCode,
          exchangeRate: dto.exchangeRate,
          tradeTerm: dto.tradeTerm,
          paymentTerm: dto.paymentTerm,
          signDate: dto.signDate ? new Date(dto.signDate) : undefined,
          effectiveDate: dto.effectiveDate
            ? new Date(dto.effectiveDate)
            : undefined,
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
          dto.freightAmount ?? this.toNumber(contract.freightAmount),
          dto.otherAmount ?? this.toNumber(contract.otherAmount),
        );
        await tx.salesContract.update({ where: { id }, data: totals });
      }
    });

    if (dto.attachmentFileIds !== undefined)
      await this.syncAttachments(user, id, dto.attachmentFileIds);
    return this.findOne(user, id);
  }

  async changeStatus(
    user: CurrentUser,
    id: string,
    dto: ChangeContractStatusDto,
  ) {
    const tenantId = requireTenantId(user);
    return this.prisma.$transaction(async (tx) => {
      const contract = await this.ensureTx(tx, tenantId, id);
      const now = new Date();
      const data: Prisma.SalesContractUpdateInput = {
        status: dto.status,
        updatedById: user.id,
      };
      if (dto.status === SalesContractStatus.CONFIRMED) data.confirmedAt = now;
      if (dto.status === SalesContractStatus.COMPLETED) data.completedAt = now;
      if (dto.status === SalesContractStatus.CANCELLED) data.cancelledAt = now;
      return tx.salesContract.update({ where: { id }, data });
    });
  }

  async remove(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    await this.ensure(tenantId, id);
    return this.prisma.salesContract.update({
      where: { id },
      data: {
        status: SalesContractStatus.CANCELLED,
        cancelledAt: new Date(),
        updatedById: user.id,
      },
    });
  }

  private async replaceItemsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    contractId: string,
    items: ContractItemInputDto[],
    freightAmount: number,
    otherAmount: number,
  ) {
    await tx.salesContractItem.deleteMany({ where: { tenantId, contractId } });
    const rows = items.map((item, index) => {
      const amount = this.calc(
        item.quantity,
        item.unitPrice,
        item.discountRate,
        item.discountAmount,
        item.taxRate,
        item.taxAmount,
      );
      return {
        tenantId,
        contractId,
        sourceQuotationItemId: item.sourceQuotationItemId,
        productId: item.productId,
        productCode: item.productCode,
        productNameCn: item.productNameCn,
        productNameEn: item.productNameEn,
        categoryCode: item.categoryCode,
        unitCode: item.unitCode,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        grossAmount: amount.grossAmount,
        discountRate: item.discountRate,
        discountAmount: amount.discountAmount,
        taxRate: item.taxRate,
        taxAmount: amount.taxAmount,
        amount: amount.amount,
        currencyCode: item.currencyCode,
        expectedDeliveryDate: item.expectedDeliveryDate
          ? new Date(item.expectedDeliveryDate)
          : undefined,
        remark: item.remark,
        extra: this.toJson(item.extra),
        sort: item.sort ?? index,
      };
    });
    if (rows.length) await tx.salesContractItem.createMany({ data: rows });
    return this.totals(rows, freightAmount, otherAmount);
  }

  private mapQuotationItems(quotation: any): ContractItemInputDto[] {
    return quotation.items.map((item) => ({
      sourceQuotationItemId: item.id,
      productId: item.productId ?? undefined,
      productCode: item.productCode ?? undefined,
      productNameCn: item.productNameCn ?? undefined,
      productNameEn: item.productNameEn ?? undefined,
      categoryCode: item.categoryCode ?? undefined,
      unitCode: item.unitCode ?? undefined,
      description: item.description ?? undefined,
      quantity: this.toNumber(item.quantity),
      unitPrice: this.toNumber(item.unitPrice),
      discountAmount: this.toNumber(item.discountAmount),
      taxAmount: this.toNumber(item.taxAmount),
      currencyCode: item.currencyCode ?? quotation.currencyCode,
      expectedDeliveryDate: item.expectedDeliveryDate?.toISOString(),
      remark: item.remark ?? undefined,
      extra: this.toPlainObject(item.extra),
      sort: item.sort,
    }));
  }

  private async findQuotationTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const quotation = await tx.quotation.findFirst({
      where: { id, tenantId },
      include: { items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
    });
    if (!quotation) throw new NotFoundException('报价单不存在');
    return quotation;
  }

  private calc(
    qty: number,
    price: number,
    discountRate?: number,
    discountAmount?: number,
    taxRate?: number,
    taxAmount?: number,
  ) {
    const grossAmount = this.round(qty * price);
    const d =
      discountAmount ?? this.round(grossAmount * ((discountRate ?? 0) / 100));
    const taxable = grossAmount - d;
    const t = taxAmount ?? this.round(taxable * ((taxRate ?? 0) / 100));
    return {
      grossAmount,
      discountAmount: d,
      taxAmount: t,
      amount: this.round(taxable + t),
    };
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
    contractId: string,
    fileIds: string[],
  ) {
    await this.fileService.replaceOwnerRelations(
      user,
      'sales_contract',
      contractId,
      fileIds.map((fileId, index) => ({
        fileId,
        fieldCode: 'attachments',
        relationName: '销售合同附件',
        sort: index,
      })),
    );
  }

  private async ensure(tenantId: string, id: string) {
    const row = await this.prisma.salesContract.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('合同不存在');
    return row;
  }

  private async ensureTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const row = await tx.salesContract.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('合同不存在');
    return row;
  }

  private async assertNoUniqueTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    contractNo: string,
    excludeId?: string,
  ) {
    const exists = await tx.salesContract.findFirst({
      where: {
        tenantId,
        contractNo,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (exists) throw new BadRequestException('合同编号已存在');
  }

  private async generateNoTx(tx: Prisma.TransactionClient, tenantId: string) {
    const no = `SC${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
    const exists = await tx.salesContract.findFirst({
      where: { tenantId, contractNo: no },
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
