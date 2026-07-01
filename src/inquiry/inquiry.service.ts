import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InquiryStatus, Prisma } from '../generated/prisma/client';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../file/file.service';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { UpdateInquiryDto } from './dto/update-inquiry.dto';
import { QueryInquiryDto } from './dto/query-inquiry.dto';
import { ChangeInquiryStatusDto } from './dto/change-inquiry-status.dto';
import { InquiryItemInputDto } from './dto/inquiry-item-input.dto';
import { ReplaceInquiryItemsDto } from './dto/replace-inquiry-items.dto';

@Injectable()
export class InquiryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  async create(user: CurrentUser, dto: CreateInquiryDto) {
    const tenantId = requireTenantId(user);

    const inquiry = await this.prisma.$transaction(async (tx) => {
      const inquiryNo =
        dto.inquiryNo ?? (await this.generateInquiryNoTx(tx, tenantId));
      await this.assertInquiryNoUniqueTx(tx, tenantId, inquiryNo);

      const customer = await this.resolveCustomerSnapshotTx(tx, tenantId, {
        customerId: dto.customerId,
        customerName: dto.customerName,
        customerContactId: dto.customerContactId,
        customerContactName: dto.customerContactName,
      });

      const created = await tx.inquiry.create({
        data: {
          tenantId,
          inquiryNo,
          customerId: customer.customerId,
          customerName: customer.customerName,
          customerContactId: customer.customerContactId,
          customerContactName: customer.customerContactName,
          subject: dto.subject,
          sourceCode: dto.sourceCode,
          priority: dto.priority,
          status: dto.status ?? InquiryStatus.OPEN,
          currencyCode: dto.currencyCode,
          tradeTerm: dto.tradeTerm,
          paymentTerm: dto.paymentTerm,
          expectedDeliveryDate: dto.expectedDeliveryDate
            ? new Date(dto.expectedDeliveryDate)
            : undefined,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
          ownerUserId: dto.ownerUserId,
          remark: dto.remark,
          extra: this.toJson(dto.extra),
          createdById: user.id,
        },
      });

      await this.replaceItemsTx(tx, tenantId, created.id, dto.items ?? []);
      return created;
    });

    if (dto.attachmentFileIds !== undefined) {
      await this.syncAttachments(user, inquiry.id, dto.attachmentFileIds);
    }

    return this.findOne(user, inquiry.id);
  }

  async findMany(user: CurrentUser, query: QueryInquiryDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.InquiryWhereInput = {
      tenantId,
      status: query.status,
      priority: query.priority,
      customerId: query.customerId,
      sourceCode: query.sourceCode,
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
              { inquiryNo: { contains: query.keyword, mode: 'insensitive' } },
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
      this.prisma.inquiry.count({ where }),
      this.prisma.inquiry.findMany({
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

    const inquiry = await this.prisma.inquiry.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!inquiry) throw new NotFoundException('询盘不存在');

    const attachments = await this.fileService.findRelations(user, {
      ownerType: 'inquiry',
      ownerId: inquiry.id,
    });

    return { ...inquiry, attachments };
  }

  async update(user: CurrentUser, id: string, dto: UpdateInquiryDto) {
    const tenantId = requireTenantId(user);

    await this.prisma.$transaction(async (tx) => {
      const inquiry = await this.ensureInquiryTx(tx, tenantId, id);
      this.assertEditable(inquiry.status);

      if (dto.inquiryNo) {
        await this.assertInquiryNoUniqueTx(tx, tenantId, dto.inquiryNo, id);
      }

      const customer =
        dto.customerId !== undefined ||
        dto.customerName !== undefined ||
        dto.customerContactId !== undefined ||
        dto.customerContactName !== undefined
          ? await this.resolveCustomerSnapshotTx(tx, tenantId, {
              customerId: dto.customerId,
              customerName: dto.customerName,
              customerContactId: dto.customerContactId,
              customerContactName: dto.customerContactName,
            })
          : undefined;

      await tx.inquiry.update({
        where: { id },
        data: {
          inquiryNo: dto.inquiryNo,
          customerId: customer?.customerId,
          customerName: customer?.customerName,
          customerContactId: customer?.customerContactId,
          customerContactName: customer?.customerContactName,
          subject: dto.subject,
          sourceCode: dto.sourceCode,
          priority: dto.priority,
          status: dto.status,
          currencyCode: dto.currencyCode,
          tradeTerm: dto.tradeTerm,
          paymentTerm: dto.paymentTerm,
          expectedDeliveryDate: dto.expectedDeliveryDate
            ? new Date(dto.expectedDeliveryDate)
            : undefined,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
          ownerUserId: dto.ownerUserId,
          remark: dto.remark,
          extra: dto.extra ? this.toJson(dto.extra) : undefined,
          updatedById: user.id,
        },
      });

      if (dto.items !== undefined) {
        await this.replaceItemsTx(tx, tenantId, id, dto.items);
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
    dto: ReplaceInquiryItemsDto,
  ) {
    const tenantId = requireTenantId(user);

    await this.prisma.$transaction(async (tx) => {
      const inquiry = await this.ensureInquiryTx(tx, tenantId, id);
      this.assertEditable(inquiry.status);
      await this.replaceItemsTx(tx, tenantId, id, dto.items);
    });

    return this.findOne(user, id);
  }

  async changeStatus(
    user: CurrentUser,
    id: string,
    dto: ChangeInquiryStatusDto,
  ) {
    const tenantId = requireTenantId(user);

    const updated = await this.prisma.$transaction(async (tx) => {
      await this.ensureInquiryTx(tx, tenantId, id);

      const now = new Date();
      const data: Prisma.InquiryUpdateInput = {
        status: dto.status,
        updatedById: user.id,
      };

      if (dto.status === InquiryStatus.QUOTED) {
        data.quotedAt = now;
      }

      if (
        dto.status === InquiryStatus.WON ||
        dto.status === InquiryStatus.LOST ||
        dto.status === InquiryStatus.CLOSED ||
        dto.status === InquiryStatus.CANCELLED
      ) {
        data.closedAt = now;
      }

      if (dto.status === InquiryStatus.LOST) {
        data.lostReason = dto.reason;
      }

      if (
        dto.status === InquiryStatus.OPEN ||
        dto.status === InquiryStatus.DRAFT
      ) {
        data.closedAt = null;
        data.lostReason = null;
      }

      return tx.inquiry.update({
        where: { id },
        data,
      });
    });

    return updated;
  }

  async remove(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    await this.ensureInquiry(tenantId, id);

    return this.prisma.inquiry.update({
      where: { id },
      data: {
        status: InquiryStatus.CANCELLED,
        closedAt: new Date(),
        updatedById: user.id,
      },
    });
  }

  private async replaceItemsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    inquiryId: string,
    items: InquiryItemInputDto[],
  ) {
    await tx.inquiryItem.deleteMany({
      where: { tenantId, inquiryId },
    });

    if (items.length === 0) return;

    const normalized = await this.normalizeItemsTx(
      tx,
      tenantId,
      inquiryId,
      items,
    );

    await tx.inquiryItem.createMany({
      data: normalized,
    });
  }

  private async normalizeItemsTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    inquiryId: string,
    items: InquiryItemInputDto[],
  ): Promise<Prisma.InquiryItemCreateManyInput[]> {
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

      return {
        tenantId,
        inquiryId,
        productId: item.productId,
        productCode: item.productCode ?? product?.code,
        productNameCn: item.productNameCn ?? product?.nameCn,
        productNameEn: item.productNameEn ?? product?.nameEn,
        categoryCode: item.categoryCode ?? product?.categoryCode,
        unitCode: item.unitCode ?? product?.unitCode,
        quantity: item.quantity,
        targetPrice: item.targetPrice,
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

    if (!customer) {
      throw new BadRequestException('客户不存在');
    }

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

    if (!contact) {
      throw new BadRequestException('客户联系人不存在');
    }

    return {
      customerId: customer.id,
      customerName: params.customerName?.trim() || customer.name,
      customerContactId: contact.id,
      customerContactName: params.customerContactName?.trim() || contact.name,
    };
  }

  private async syncAttachments(
    user: CurrentUser,
    inquiryId: string,
    fileIds: string[],
  ) {
    await this.fileService.replaceOwnerRelations(
      user,
      'inquiry',
      inquiryId,
      fileIds.map((fileId, index) => ({
        fileId,
        fieldCode: 'attachments',
        relationName: '询盘附件',
        sort: index,
      })),
    );
  }

  private async ensureInquiry(tenantId: string, id: string) {
    const inquiry = await this.prisma.inquiry.findFirst({
      where: { id, tenantId },
    });

    if (!inquiry) throw new NotFoundException('询盘不存在');
    return inquiry;
  }

  private async ensureInquiryTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    id: string,
  ) {
    const inquiry = await tx.inquiry.findFirst({
      where: { id, tenantId },
    });

    if (!inquiry) throw new NotFoundException('询盘不存在');
    return inquiry;
  }

  private assertEditable(status: InquiryStatus) {
    if (
      status === InquiryStatus.QUOTED ||
      status === InquiryStatus.WON ||
      status === InquiryStatus.LOST ||
      status === InquiryStatus.CLOSED ||
      status === InquiryStatus.CANCELLED
    ) {
      throw new BadRequestException('当前询盘状态不允许编辑');
    }
  }

  private async assertInquiryNoUniqueTx(
    tx: Prisma.TransactionClient,
    tenantId: string,
    inquiryNo: string,
    excludeId?: string,
  ) {
    const exists = await tx.inquiry.findFirst({
      where: {
        tenantId,
        inquiryNo,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (exists) throw new BadRequestException('询盘编号已存在');
  }

  private async generateInquiryNoTx(
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
      const inquiryNo = `INQ${date}${time}${random}`;

      const exists = await tx.inquiry.findFirst({
        where: { tenantId, inquiryNo },
        select: { id: true },
      });

      if (!exists) return inquiryNo;
    }

    throw new BadRequestException('询盘编号生成失败，请重试');
  }

  private pad(value: number) {
    return value.toString().padStart(2, '0');
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
