import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerStatus, Prisma } from '../generated/prisma/client';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { FileService } from '../file/file.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { CustomerContactInputDto } from './dto/customer-contact-input.dto';
import { CreateCustomerFollowUpDto } from './dto/create-customer-follow-up.dto';

@Injectable()
export class CustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  async create(user: CurrentUser, dto: CreateCustomerDto) {
    const tenantId = requireTenantId(user);

    const exists = await this.prisma.customer.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });

    if (exists) throw new BadRequestException('客户编码已存在');

    const customer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          tenantId,
          code: dto.code,
          name: dto.name,
          shortName: dto.shortName,
          type: dto.type,
          status: dto.status ?? CustomerStatus.ACTIVE,
          levelCode: dto.levelCode,
          sourceCode: dto.sourceCode,
          countryCode: dto.countryCode,
          region: dto.region,
          address: dto.address,
          website: dto.website,
          email: dto.email,
          phone: dto.phone,
          taxNo: dto.taxNo,
          ownerUserId: dto.ownerUserId,
          remark: dto.remark,
          extra: this.toJson(dto.extra),
          createdById: user.id,
        },
      });

      await this.replaceContacts(
        tx,
        tenantId,
        created.id,
        user.id,
        dto.contacts ?? [],
      );

      return created;
    });

    if (dto.attachmentFileIds) {
      await this.syncAttachments(user, customer.id, dto.attachmentFileIds);
    }

    return this.findOne(user, customer.id);
  }

  async findMany(user: CurrentUser, query: QueryCustomerDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.CustomerWhereInput = {
      tenantId,
      status: query.status,
      levelCode: query.levelCode,
      sourceCode: query.sourceCode,
      countryCode: query.countryCode,
      ownerUserId: query.ownerUserId,
      ...(query.keyword
        ? {
            OR: [
              { code: { contains: query.keyword, mode: 'insensitive' } },
              { name: { contains: query.keyword, mode: 'insensitive' } },
              { shortName: { contains: query.keyword, mode: 'insensitive' } },
              { email: { contains: query.keyword, mode: 'insensitive' } },
              { phone: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          contacts: {
            where: { isPrimary: true },
            take: 1,
          },
          _count: {
            select: { contacts: true, followUps: true },
          },
        },
      }),
    ]);

    return { total, page, pageSize, list };
  }

  async findOne(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
      include: {
        contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        followUps: { orderBy: { followedAt: 'desc' }, take: 20 },
      },
    });

    if (!customer) throw new NotFoundException('客户不存在');

    const attachments = await this.fileService.findRelations(user, {
      ownerType: 'customer',
      ownerId: customer.id,
    });

    return { ...customer, attachments };
  }

  async update(user: CurrentUser, id: string, dto: UpdateCustomerDto) {
    const tenantId = requireTenantId(user);
    await this.ensureCustomer(tenantId, id);

    if (dto.code) {
      const exists = await this.prisma.customer.findFirst({
        where: {
          tenantId,
          code: dto.code,
          id: { not: id },
        },
      });

      if (exists) throw new BadRequestException('客户编码已存在');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id },
        data: {
          code: dto.code,
          name: dto.name,
          shortName: dto.shortName,
          type: dto.type,
          status: dto.status,
          levelCode: dto.levelCode,
          sourceCode: dto.sourceCode,
          countryCode: dto.countryCode,
          region: dto.region,
          address: dto.address,
          website: dto.website,
          email: dto.email,
          phone: dto.phone,
          taxNo: dto.taxNo,
          ownerUserId: dto.ownerUserId,
          remark: dto.remark,
          extra: dto.extra ? this.toJson(dto.extra) : undefined,
          updatedById: user.id,
        },
      });

      if (dto.contacts) {
        await this.replaceContacts(tx, tenantId, id, user.id, dto.contacts);
      }
    });

    if (dto.attachmentFileIds) {
      await this.syncAttachments(user, id, dto.attachmentFileIds);
    }

    return this.findOne(user, id);
  }

  async remove(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    await this.ensureCustomer(tenantId, id);

    return this.prisma.customer.update({
      where: { id },
      data: {
        status: CustomerStatus.INACTIVE,
        updatedById: user.id,
      },
    });
  }

  async createContact(
    user: CurrentUser,
    customerId: string,
    dto: CustomerContactInputDto,
  ) {
    const tenantId = requireTenantId(user);
    await this.ensureCustomer(tenantId, customerId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.customerContact.updateMany({
          where: { tenantId, customerId },
          data: { isPrimary: false },
        });
      }

      return tx.customerContact.create({
        data: {
          tenantId,
          customerId,
          name: dto.name,
          title: dto.title,
          email: dto.email,
          phone: dto.phone,
          mobile: dto.mobile,
          whatsapp: dto.whatsapp,
          wechat: dto.wechat,
          isPrimary: dto.isPrimary ?? false,
          remark: dto.remark,
          extra: this.toJson(dto.extra),
          createdById: user.id,
        },
      });
    });
  }

  async updateContact(
    user: CurrentUser,
    customerId: string,
    contactId: string,
    dto: CustomerContactInputDto,
  ) {
    const tenantId = requireTenantId(user);
    await this.ensureCustomer(tenantId, customerId);

    return this.prisma.$transaction(async (tx) => {
      const contact = await tx.customerContact.findFirst({
        where: { id: contactId, tenantId, customerId },
      });

      if (!contact) throw new NotFoundException('联系人不存在');

      if (dto.isPrimary) {
        await tx.customerContact.updateMany({
          where: { tenantId, customerId, id: { not: contactId } },
          data: { isPrimary: false },
        });
      }

      return tx.customerContact.update({
        where: { id: contactId },
        data: {
          name: dto.name,
          title: dto.title,
          email: dto.email,
          phone: dto.phone,
          mobile: dto.mobile,
          whatsapp: dto.whatsapp,
          wechat: dto.wechat,
          isPrimary: dto.isPrimary,
          remark: dto.remark,
          extra: this.toJson(dto.extra),
          updatedById: user.id,
        },
      });
    });
  }

  async removeContact(
    user: CurrentUser,
    customerId: string,
    contactId: string,
  ) {
    const tenantId = requireTenantId(user);

    const deleted = await this.prisma.customerContact.deleteMany({
      where: { id: contactId, tenantId, customerId },
    });

    if (deleted.count === 0) throw new NotFoundException('联系人不存在');

    return { success: true };
  }

  async createFollowUp(
    user: CurrentUser,
    customerId: string,
    dto: CreateCustomerFollowUpDto,
  ) {
    const tenantId = requireTenantId(user);
    await this.ensureCustomer(tenantId, customerId);

    return this.prisma.customerFollowUp.create({
      data: {
        tenantId,
        customerId,
        typeCode: dto.typeCode,
        content: dto.content,
        followedAt: dto.followedAt ? new Date(dto.followedAt) : new Date(),
        nextFollowAt: dto.nextFollowAt ? new Date(dto.nextFollowAt) : null,
        extra: this.toJson(dto.extra),
        createdById: user.id,
      },
    });
  }

  async findFollowUps(user: CurrentUser, customerId: string) {
    const tenantId = requireTenantId(user);
    await this.ensureCustomer(tenantId, customerId);

    return this.prisma.customerFollowUp.findMany({
      where: { tenantId, customerId },
      orderBy: { followedAt: 'desc' },
    });
  }

  private async replaceContacts(
    tx: Prisma.TransactionClient,
    tenantId: string,
    customerId: string,
    userId: string,
    contacts: CustomerContactInputDto[],
  ) {
    await tx.customerContact.deleteMany({ where: { tenantId, customerId } });

    if (contacts.length === 0) return;

    const hasPrimary = contacts.some((item) => item.isPrimary);

    await tx.customerContact.createMany({
      data: contacts.map((item, index) => ({
        tenantId,
        customerId,
        name: item.name,
        title: item.title,
        email: item.email,
        phone: item.phone,
        mobile: item.mobile,
        whatsapp: item.whatsapp,
        wechat: item.wechat,
        isPrimary: item.isPrimary ?? (!hasPrimary && index === 0),
        remark: item.remark,
        extra: this.toJson(item.extra),
        createdById: userId,
      })),
    });
  }

  private async syncAttachments(
    user: CurrentUser,
    customerId: string,
    fileIds: string[],
  ) {
    await this.fileService.replaceOwnerRelations(
      user,
      'customer',
      customerId,
      fileIds.map((fileId, index) => ({
        fileId,
        fieldCode: 'attachments',
        relationName: '客户附件',
        sort: index,
      })),
    );
  }

  private async ensureCustomer(tenantId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, tenantId },
    });

    if (!customer) throw new NotFoundException('客户不存在');
    return customer;
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
