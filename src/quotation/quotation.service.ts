import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InquiryStatus,
  Prisma,
  QuotationStatus,
} from '../generated/prisma/client';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../file/file.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QueryQuotationDto } from './dto/query-quotation.dto';
import { ChangeQuotationStatusDto } from './dto/change-quotation-status.dto';
import { QuotationItemInputDto } from './dto/quotation-item-input.dto';
import { ReplaceQuotationItemsDto } from './dto/replace-quotation-items.dto';
import { CreateQuotationFromInquiryDto } from './dto/create-quotation-from-inquiry.dto';

@Injectable()
export class QuotationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  async create(user: CurrentUser, dto: CreateQuotationDto) {
    const tenantId = requireTenantId(user);
    this.assertCreateStatus(dto.status);

    const quotation = await this.prisma.$transaction(async (tx) => {
      const sourceInquiry = dto.inquiryId
        ? await this.findInquiryForQuotationTx(tx, tenantId, dto.inquiryId)
        : undefined;

      const quotationNo =
        dto.quotationNo ?? (await this.generateQuotationNoTx(tx, tenantId));
      await this.assertQuotationNoUniqueTx(tx, tenantId, quotationNo);

      const customer = await this.resolveCustomerSnapshotTx(tx, tenantId, {
        customerId: dto.customerId ?? sourceInquiry?.customerId ?? undefined,
        customerName:
          dto.customerName ?? sourceInquiry?.customerName ?? undefined,
        customerContactId:
          dto.customerContactId ??
          sourceInquiry?.customerContactId ??
          undefined,
        customerContactName:
          dto.customerContactName ??
          sourceInquiry?.customerContactName ??
          undefined,
      });

      const status = dto.status ?? QuotationStatus.DRAFT;
      const now = new Date();

      const created = await tx.quotation.create({
        data: {
          tenantId,
          quotationNo,
          inquiryId: dto.inquiryId,
          customerId: customer.customerId,
          customerName: customer.customerName,
          customerContactId: customer.customerContactId,
          customerContactName: customer.customerContactName,
          subject: dto.subject,
          status,
          currencyCode: dto.currencyCode,
          exchangeRate: dto.exchangeRate,
          tradeTerm: dto.tradeTerm,
          paymentTerm: dto.paymentTerm,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
          ownerUserId: dto.ownerUserId,
          sentAt: status === QuotationStatus.SENT ? now : undefined,
          freightAmount: dto.freightAmount ?? 0,
          otherAmount: dto.otherAmount ?? 0,
          remark: dto.remark,
          extra: this.toJson(dto.extra),
          createdById: user.id,
        },
      });

      const items =
        dto.items ??
        (sourceInquiry
          ? this.mapInquiryItems(sourceInquiry, dto.currencyCode)
          : []);

      const totals = await this.replaceItemsTx(
        tx,
        tenantId,
        created.id,
        items,
        dto.freightAmount ?? 0,
        dto.otherAmount ?? 0,
      );

      await tx.quotation.update({
        where: { id: created.id },
        data: totals,
      });

      if (sourceInquiry && status === QuotationStatus.SENT) {
        await tx.inquiry.update({
          where: { id: sourceInquiry.id },
          data: {
            status: InquiryStatus.QUOTED,
            quotedAt: now,
            updatedById: user.id,
          },
        });
      }

      return created;
    });

    if (dto.attachmentFileIds !== undefined) {
      await this.syncAttachments(user, quotation.id, dto.attachmentFileIds);
    }

    return this.findOne(user, quotation.id);
  }

  async createFromInquiry(
    user: CurrentUser,
    inquiryId: string,
    dto: CreateQuotationFromInquiryDto,
  ) {
    const tenantId = requireTenantId(user);

    const inquiry = await this.prisma.inquiry.findFirst({
      where: { id: inquiryId, tenantId },
      include: {
        items: {
          orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!inquiry) throw new NotFoundException('询盘不存在');

    const currencyCode = dto.currencyCode ?? inquiry.currencyCode ?? 'USD';

    return this.create(user, {
      quotationNo: dto.quotationNo,
      inquiryId,
      customerId: inquiry.customerId ?? undefined,
      customerName: inquiry.customerName ?? undefined,
      customerContactId: inquiry.customerContactId ?? undefined,
      customerContactName: inquiry.customerContactName ?? undefined,
      subject: dto.subject ?? inquiry.subject,
      status: dto.status,
      currencyCode,
      exchangeRate: dto.exchangeRate,
      tradeTerm: dto.tradeTerm ?? inquiry.tradeTerm ?? undefined,
      paymentTerm: dto.paymentTerm ?? inquiry.paymentTerm ?? undefined,
      validUntil: dto.validUntil,
      ownerUserId: dto.ownerUserId ?? inquiry.ownerUserId ?? undefined,
      freightAmount: dto.freightAmount,
      otherAmount: dto.otherAmount,
      remark: dto.remark,
      extra: dto.extra,
      items: dto.items ?? this.mapInquiryItems(inquiry, currencyCode),
      attachmentFileIds: dto.attachmentFileIds,
    });
  }

  async findMany(user: CurrentUser, query: QueryQuotationDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.QuotationWhereInput = {
      tenantId,
      status: query.status,
      inquiryId: query.inquiryId,
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
              { quotationNo: { contains: query.keyword, mode: 'insensitive' } },
              { subject: { contains: query.keyword, mode: 'insensitive' } },
              {
                customerName: { contains: query.keyword, mode: 'insensitive' },
              },
              { remark: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.quotation.count({ where }),
      this.prisma.quotation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: {
            select: { items: true },
          },
        },
      }),
    ]);

    return { total, page, pageSize, list };
  }

  async findOne(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const quotation = await this.prisma.quotation.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!quotation) throw new NotFoundException('报价单不存在');

    const attachments = await this.fileService.findRelations(user, {
      ownerType: 'quotation',
      ownerId: quotation.id,
    });

    return { ...quotation, attachments };
  }

  async update(user: CurrentUser, id: string, dto: UpdateQuotationDto) {
    const tenantId = requireTenantId(user);

    await this.prisma.$transaction(async (tx) => {
      const quotation = await this.ensureQuotationTx(tx, tenantId, id);
      this.assertEditable(quotation.status);

      if (dto.quotationNo) {
        await this.assertQuotationNoUniqueTx(tx, tenantId, dto.quotationNo, id);
      }

      const customer =
        dto.customerId !== undefined ||
        dto.customerName !== undefined ||
        dto.customerContactId !== undefined ||
        dto.customerContactName !== undefined
          ? await this.resolveCustomerSnapshotTx(tx, tenantId, {
              customerId: dto.customerId ?? quotation.customerId ?? undefined,
              customerName:
                dto.customerName ?? quotation.customerName ?? undefined,
              customerContactId:
                dto.customerContactId ??
                quotation.customerContactId ??
                undefined,
              customerContactName:
                dto.customerContactName ??
                quotation.customerContactName ??
                undefined,
            })
          : undefined;

      const freightAmount =
        dto.freightAmount ?? this.toNumber(quotation.freightAmount);
      const otherAmount =
        dto.otherAmount ?? this.toNumber(quotation.otherAmount);

      await tx.quotation.update({
        where: { id },
        data: {
          quotationNo: dto.quotationNo,
          customerId: customer?.customerId,
          customerName: customer?.customerName,
          customerContactId: customer?.customerContactId,
          customerContactName: customer?.customerContactName,
          subject: dto.subject,
          currencyCode: dto.currencyCode,
          exchangeRate: dto.exchangeRate,
          tradeTerm: dto.tradeTerm,
          paymentTerm: dto.paymentTerm,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
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
          freightAmount,
          otherAmount,
        );

        await tx.quotation.update({
          where: { id },
          data: totals,
        });
      } else if (
        dto.freightAmount !== undefined ||
        dto.otherAmount !== undefined
      ) {
        const totals = await this.recalculateTotalsTx(
          tx,
          tenantId,
          id,
          freightAmount,
          otherAmount,
        );

        await tx.quotation.update({
          where: { id },
          data: totals,
        });
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
    dto: ReplaceQuotationItemsDto,
  ) {
    const tenantId = requireTenantId(user);

    await this.prisma.$transaction(async (tx) => {
      const quotation = await this.ensureQuotationTx(tx, tenantId, id);
      this.assertEditable(quotation.status);

      const totals = await this.replaceItemsTx(
        tx,
        tenantId,
        id,
        dto.items,
        this.toNumber(quotation.freightAmount),
        this.toNumber(quotation.otherAmount),
      );

      await tx.quotation.update({
        where: { id },
        data: {
          ...totals,
          updatedById: user.id,
        },
      });
    });

    return this.findOne(user, id);
  }

  async changeStatus(
    user: CurrentUser,
    id: string,
    dto: ChangeQuotationStatusDto,
  ) {
    const tenantId = requireTenantId(user);

    return this.prisma.$transaction(async (tx) => {
      const quotation = await this.ensureQuotationTx(tx, tenantId, id);

      if (quotation.status === dto.status) return quotation;

      this.assertStatusTransition(quotation.status, dto.status);

      const now = new Date();
      const data: Prisma.QuotationUpdateInput = {
        status: dto.status,
        updatedById: user.id,
      };

      if (dto.status === QuotationStatus.SENT) data.sentAt = now;
      if (dto.status === QuotationStatus.ACCEPTED) {
        data.acceptedAt = now;
        data.closedAt = now;
      }
      if (dto.status === QuotationStatus.REJECTED) {
        data.rejectedAt = now;
        data.closedAt = now;
        data.rejectReason = dto.reason;
      }
      if (
        dto.status === QuotationStatus.EXPIRED ||
        dto.status === QuotationStatus.CANCELLED
      ) {
        data.closedAt = now;
      }

      const updated = await tx.quotation.update({
        where: { id },
        data,
      });

      if (quotation.inquiryId && dto.status === QuotationStatus.SENT) {
        await tx.inquiry.update({
          where: { id: quotation.inquiryId },
          data: {
            status: InquiryStatus.QUOTED,
            quotedAt: now,
            updatedById: user.id,
          },
        });
      }

      if (quotation.inquiryId && dto.status === QuotationStatus.ACCEPTED) {
        await tx.inquiry.update({
          where: { id: quotation.inquiryId },
          data: {
            status: InquiryStatus.WON,
            closedAt: now,
            updatedById: user.id,
          },
        });
      }

      return updated;
    });
  }

  async remove(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    await this.ensureQuotation(tenantId, id);

    return this.prisma.quotation.update({
      where: { id },
      data: {
        status: QuotationStatus.CANCELLED,
        closedAt: new Date(),
        updatedById: user.id,
      },
    });
  }

  private async replaceItemsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    quotationId: string,
    items: QuotationItemInputDto[],
    freightAmount: number,
    otherAmount: number,
  ) {
    await tx.quotationItem.deleteMany({
      where: { tenantId, quotationId },
    });

    const normalized = await this.normalizeItemsTx(
      tx,
      tenantId,
      quotationId,
      items,
    );

    if (normalized.length > 0) {
      await tx.quotationItem.createMany({
        data: normalized,
      });
    }

    return this.calculateTotals(normalized, freightAmount, otherAmount);
  }

  private async normalizeItemsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    quotationId: string,
    items: QuotationItemInputDto[],
  ): Promise<Prisma.QuotationItemCreateManyInput[]> {
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

    for (const productId of productIds) {
      if (!productMap.has(productId)) {
        throw new BadRequestException('产品不存在或不属于当前租户');
      }
    }

    return items.map((item, index) => {
      const product = item.productId
        ? productMap.get(item.productId)
        : undefined;
      const amount = this.calculateItemAmount(item);

      return {
        tenantId,
        quotationId,
        sourceInquiryItemId: item.sourceInquiryItemId,
        productId: item.productId,
        productCode: item.productCode ?? product?.code,
        productNameCn: item.productNameCn ?? product?.nameCn,
        productNameEn: item.productNameEn ?? product?.nameEn,
        categoryCode: item.categoryCode ?? product?.categoryCode,
        unitCode: item.unitCode ?? product?.unitCode,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        grossAmount: amount.grossAmount,
        discountRate: item.discountRate,
        discountAmount: amount.discountAmount,
        taxRate: item.taxRate,
        taxAmount: amount.taxAmount,
        amount: amount.amount,
        currencyCode: item.currencyCode ?? product?.currencyCode,
        expectedDeliveryDate: item.expectedDeliveryDate
          ? new Date(item.expectedDeliveryDate)
          : undefined,
        remark: item.remark,
        extra: this.toJson(item.extra),
        sort: item.sort ?? index,
      };
    });
  }

  private async recalculateTotalsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    quotationId: string,
    freightAmount: number,
    otherAmount: number,
  ) {
    const items = await tx.quotationItem.findMany({
      where: { tenantId, quotationId },
    });

    return this.calculateTotals(items, freightAmount, otherAmount);
  }

  private calculateItemAmount(item: QuotationItemInputDto) {
    const grossAmount = this.round(item.quantity * item.unitPrice);
    const discountAmount =
      item.discountAmount ??
      this.round(grossAmount * ((item.discountRate ?? 0) / 100));
    const taxableAmount = grossAmount - discountAmount;
    const taxAmount =
      item.taxAmount ?? this.round(taxableAmount * ((item.taxRate ?? 0) / 100));
    const amount = this.round(taxableAmount + taxAmount);

    return { grossAmount, discountAmount, taxAmount, amount };
  }

  private calculateTotals(
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
    const totalAmount = this.round(
      subtotalAmount - discountAmount + taxAmount + freightAmount + otherAmount,
    );

    return {
      subtotalAmount,
      discountAmount,
      taxAmount,
      freightAmount,
      otherAmount,
      totalAmount,
    };
  }

  private mapInquiryItems(
    inquiry: {
      currencyCode?: string | null;
      items: Array<{
        id: string;
        productId?: string | null;
        productCode?: string | null;
        productNameCn?: string | null;
        productNameEn?: string | null;
        categoryCode?: string | null;
        unitCode?: string | null;
        quantity: unknown;
        targetPrice?: unknown;
        currencyCode?: string | null;
        expectedDeliveryDate?: Date | null;
        remark?: string | null;
        extra?: unknown;
        sort: number;
      }>;
    },
    currencyCode: string,
  ): QuotationItemInputDto[] {
    return inquiry.items.map((item) => ({
      sourceInquiryItemId: item.id,
      productId: item.productId ?? undefined,
      productCode: item.productCode ?? undefined,
      productNameCn: item.productNameCn ?? undefined,
      productNameEn: item.productNameEn ?? undefined,
      categoryCode: item.categoryCode ?? undefined,
      unitCode: item.unitCode ?? undefined,
      quantity: this.toNumber(item.quantity),
      unitPrice: this.toNumber(item.targetPrice),
      currencyCode: item.currencyCode ?? inquiry.currencyCode ?? currencyCode,
      expectedDeliveryDate: item.expectedDeliveryDate?.toISOString(),
      remark: item.remark ?? undefined,
      extra: this.toPlainObject(item.extra),
      sort: item.sort,
    }));
  }

  private async findInquiryForQuotationTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    inquiryId: string,
  ) {
    const inquiry = await tx.inquiry.findFirst({
      where: { id: inquiryId, tenantId },
      include: {
        items: {
          orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!inquiry) throw new NotFoundException('询盘不存在');
    if (inquiry.status === InquiryStatus.CANCELLED) {
      throw new BadRequestException('已取消的询盘不能生成报价');
    }

    return inquiry;
  }

  private async resolveCustomerSnapshotTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    params: {
      customerId?: string;
      customerName?: string;
      customerContactId?: string;
      customerContactName?: string;
    },
  ) {
    if (!params.customerId) {
      return {
        customerId: null,
        customerName: params.customerName?.trim() || null,
        customerContactId: null,
        customerContactName: params.customerContactName?.trim() || null,
      };
    }

    const customer = await tx.customer.findFirst({
      where: { id: params.customerId, tenantId },
      select: { id: true, name: true },
    });

    if (!customer) throw new BadRequestException('客户不存在');

    if (!params.customerContactId) {
      return {
        customerId: customer.id,
        customerName: params.customerName?.trim() || customer.name,
        customerContactId: null,
        customerContactName: params.customerContactName?.trim() || null,
      };
    }

    const contact = await tx.customerContact.findFirst({
      where: {
        id: params.customerContactId,
        tenantId,
        customerId: customer.id,
      },
      select: { id: true, name: true },
    });

    if (!contact) throw new BadRequestException('客户联系人不存在');

    return {
      customerId: customer.id,
      customerName: params.customerName?.trim() || customer.name,
      customerContactId: contact.id,
      customerContactName: params.customerContactName?.trim() || contact.name,
    };
  }

  private async syncAttachments(
    user: CurrentUser,
    quotationId: string,
    fileIds: string[],
  ) {
    await this.fileService.replaceOwnerRelations(
      user,
      'quotation',
      quotationId,
      fileIds.map((fileId, index) => ({
        fileId,
        fieldCode: 'attachments',
        relationName: '报价单附件',
        sort: index,
      })),
    );
  }

  private async ensureQuotation(tenantId: string, id: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, tenantId },
    });

    if (!quotation) throw new NotFoundException('报价单不存在');
    return quotation;
  }

  private async ensureQuotationTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const quotation = await tx.quotation.findFirst({
      where: { id, tenantId },
    });

    if (!quotation) throw new NotFoundException('报价单不存在');
    return quotation;
  }

  private assertCreateStatus(status?: QuotationStatus) {
    if (
      status === QuotationStatus.ACCEPTED ||
      status === QuotationStatus.REJECTED ||
      status === QuotationStatus.EXPIRED ||
      status === QuotationStatus.CANCELLED
    ) {
      throw new BadRequestException('创建报价单时只能为草稿或已发送状态');
    }
  }

  private assertEditable(status: QuotationStatus) {
    if (status !== QuotationStatus.DRAFT) {
      throw new BadRequestException('只有草稿状态的报价单允许编辑');
    }
  }

  private assertStatusTransition(
    current: QuotationStatus,
    next: QuotationStatus,
  ) {
    const allowed: Record<QuotationStatus, QuotationStatus[]> = {
      [QuotationStatus.DRAFT]: [
        QuotationStatus.SENT,
        QuotationStatus.CANCELLED,
      ],
      [QuotationStatus.SENT]: [
        QuotationStatus.ACCEPTED,
        QuotationStatus.REJECTED,
        QuotationStatus.EXPIRED,
        QuotationStatus.CANCELLED,
      ],
      [QuotationStatus.ACCEPTED]: [],
      [QuotationStatus.REJECTED]: [],
      [QuotationStatus.EXPIRED]: [],
      [QuotationStatus.CANCELLED]: [],
    };

    if (!allowed[current].includes(next)) {
      throw new BadRequestException('报价单状态不允许这样流转');
    }
  }

  private async assertQuotationNoUniqueTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    quotationNo: string,
    excludeId?: string,
  ) {
    const exists = await tx.quotation.findFirst({
      where: {
        tenantId,
        quotationNo,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (exists) throw new BadRequestException('报价单编号已存在');
  }

  private async generateQuotationNoTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
  ) {
    for (let i = 0; i < 5; i += 1) {
      const now = new Date();
      const date = [
        now.getFullYear(),
        this.pad(now.getMonth() + 1),
        this.pad(now.getDate()),
      ].join('');
      const time = [
        this.pad(now.getHours()),
        this.pad(now.getMinutes()),
        this.pad(now.getSeconds()),
      ].join('');
      const random = Math.floor(Math.random() * 900 + 100);
      const quotationNo = `QT${date}${time}${random}`;

      const exists = await tx.quotation.findFirst({
        where: { tenantId, quotationNo },
        select: { id: true },
      });

      if (!exists) return quotationNo;
    }

    throw new BadRequestException('报价单编号生成失败，请重试');
  }

  private pad(value: number) {
    return value.toString().padStart(2, '0');
  }

  private round(value: number) {
    return Math.round(value * 10000) / 10000;
  }

  private toNumber(value: unknown) {
    if (value === null || value === undefined) return 0;
    return Number(value);
  }

  private toPlainObject(value: unknown): Record<string, unknown> | undefined {
    if (!value) return undefined;
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
