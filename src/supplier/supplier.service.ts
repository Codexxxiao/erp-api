// src/supplier/supplier.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SupplierStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { FileService } from '../file/file.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { QuerySupplierDto } from './dto/query-supplier.dto';
import { CreateSupplierContactDto } from './dto/create-supplier-contact.dto';
import { UpdateSupplierContactDto } from './dto/update-supplier-contact.dto';
import { CreateSupplierFollowUpDto } from './dto/create-supplier-follow-up.dto';
import { SupplierFileRelationDto } from './dto/supplier-file-relation.dto';

@Injectable()
export class SupplierService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
  ) {}

  async create(user: CurrentUser, dto: CreateSupplierDto) {
    const tenantId = requireTenantId(user);
    await this.assertCodeUnique(tenantId, dto.code);

    const primaryCount =
      dto.contacts?.filter((item) => item.isPrimary).length ?? 0;
    if (primaryCount > 1) {
      throw new BadRequestException('只能设置一个默认联系人');
    }

    const supplier = await this.prisma.supplier.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        shortName: dto.shortName,
        type: dto.type,
        status: dto.status,
        countryRegion: dto.countryRegion,
        province: dto.province,
        city: dto.city,
        address: dto.address,
        website: dto.website,
        email: dto.email,
        phone: dto.phone,
        source: dto.source,
        level: dto.level,
        settlementCurrency: dto.settlementCurrency,
        paymentTerm: dto.paymentTerm,
        tradeTerm: dto.tradeTerm,
        tags: dto.tags ?? Prisma.JsonNull,
        remark: dto.remark,
        createdById: user.userId,
        contacts: dto.contacts?.length
          ? {
              create: dto.contacts.map((contact, index) => ({
                tenantId,
                name: contact.name,
                title: contact.title,
                email: contact.email,
                phone: contact.phone,
                mobile: contact.mobile,
                whatsapp: contact.whatsapp,
                wechat: contact.wechat,
                skype: contact.skype,
                isPrimary: contact.isPrimary ?? index === 0,
                sort: contact.sort ?? index,
                remark: contact.remark,
              })),
            }
          : undefined,
      },
    });

    await this.syncFiles(user, supplier.id, dto.fileRelations);
    return this.findOne(user, supplier.id);
  }

  async findMany(user: CurrentUser, query: QuerySupplierDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.SupplierWhereInput = {
      tenantId,
      code: query.code
        ? { contains: query.code, mode: 'insensitive' }
        : undefined,
      name: query.name
        ? { contains: query.name, mode: 'insensitive' }
        : undefined,
      status: query.status,
      type: query.type,
      source: query.source,
      level: query.level,
      countryRegion: query.countryRegion,
      OR: query.keyword
        ? [
            { code: { contains: query.keyword, mode: 'insensitive' } },
            { name: { contains: query.keyword, mode: 'insensitive' } },
            { shortName: { contains: query.keyword, mode: 'insensitive' } },
            { phone: { contains: query.keyword, mode: 'insensitive' } },
            { email: { contains: query.keyword, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.supplier.count({ where }),
      this.prisma.supplier.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          contacts: {
            where: { isPrimary: true },
            take: 1,
            orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
          },
          _count: {
            select: {
              contacts: true,
              followUps: true,
              productQuotes: true,
            },
          },
        },
      }),
    ]);

    return { total, page, pageSize, items };
  }

  async findOne(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId },
      include: {
        contacts: {
          orderBy: [
            { isPrimary: 'desc' },
            { sort: 'asc' },
            { createdAt: 'asc' },
          ],
        },
        followUps: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
        productQuotes: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            product: {
              select: {
                id: true,
                code: true,
                sku: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            contacts: true,
            followUps: true,
            productQuotes: true,
          },
        },
      },
    });

    if (!supplier) {
      throw new NotFoundException('供应商不存在');
    }

    const files = await this.fileService.findRelations(user, {
      ownerType: 'supplier',
      ownerId: supplier.id,
    });

    return { ...supplier, files };
  }

  async update(user: CurrentUser, id: string, dto: UpdateSupplierDto) {
    const tenantId = requireTenantId(user);
    await this.ensureSupplier(tenantId, id);

    if (dto.code) {
      await this.assertCodeUnique(tenantId, dto.code, id);
    }

    await this.prisma.supplier.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        shortName: dto.shortName,
        type: dto.type,
        status: dto.status,
        countryRegion: dto.countryRegion,
        province: dto.province,
        city: dto.city,
        address: dto.address,
        website: dto.website,
        email: dto.email,
        phone: dto.phone,
        source: dto.source,
        level: dto.level,
        settlementCurrency: dto.settlementCurrency,
        paymentTerm: dto.paymentTerm,
        tradeTerm: dto.tradeTerm,
        tags: dto.tags === undefined ? undefined : dto.tags,
        remark: dto.remark,
        updatedById: user.userId,
      },
    });

    if (dto.fileRelations !== undefined) {
      await this.syncFiles(user, id, dto.fileRelations);
    }

    return this.findOne(user, id);
  }

  async remove(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    await this.ensureSupplier(tenantId, id);

    return this.prisma.supplier.update({
      where: { id },
      data: {
        status: SupplierStatus.INACTIVE,
        updatedById: user.userId,
      },
    });
  }

  async createContact(
    user: CurrentUser,
    supplierId: string,
    dto: CreateSupplierContactDto,
  ) {
    const tenantId = requireTenantId(user);
    await this.ensureSupplier(tenantId, supplierId);

    if (dto.isPrimary) {
      await this.clearPrimaryContact(tenantId, supplierId);
    }

    return this.prisma.supplierContact.create({
      data: {
        tenantId,
        supplierId,
        name: dto.name,
        title: dto.title,
        email: dto.email,
        phone: dto.phone,
        mobile: dto.mobile,
        whatsapp: dto.whatsapp,
        wechat: dto.wechat,
        skype: dto.skype,
        isPrimary: dto.isPrimary ?? false,
        sort: dto.sort ?? 0,
        remark: dto.remark,
      },
    });
  }

  async updateContact(
    user: CurrentUser,
    supplierId: string,
    contactId: string,
    dto: UpdateSupplierContactDto,
  ) {
    const tenantId = requireTenantId(user);
    await this.ensureSupplier(tenantId, supplierId);
    await this.ensureContact(tenantId, supplierId, contactId);

    if (dto.isPrimary) {
      await this.clearPrimaryContact(tenantId, supplierId);
    }

    return this.prisma.supplierContact.update({
      where: { id: contactId },
      data: dto,
    });
  }

  async removeContact(
    user: CurrentUser,
    supplierId: string,
    contactId: string,
  ) {
    const tenantId = requireTenantId(user);
    await this.ensureSupplier(tenantId, supplierId);
    await this.ensureContact(tenantId, supplierId, contactId);

    return this.prisma.supplierContact.delete({
      where: { id: contactId },
    });
  }

  async createFollowUp(
    user: CurrentUser,
    supplierId: string,
    dto: CreateSupplierFollowUpDto,
  ) {
    const tenantId = requireTenantId(user);
    await this.ensureSupplier(tenantId, supplierId);

    return this.prisma.supplierFollowUp.create({
      data: {
        tenantId,
        supplierId,
        type: dto.type,
        content: dto.content,
        nextFollowAt: dto.nextFollowAt ? new Date(dto.nextFollowAt) : undefined,
        createdById: user.userId,
      },
    });
  }

  async findFollowUps(user: CurrentUser, supplierId: string) {
    const tenantId = requireTenantId(user);
    await this.ensureSupplier(tenantId, supplierId);

    return this.prisma.supplierFollowUp.findMany({
      where: { tenantId, supplierId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertCodeUnique(
    tenantId: string,
    code: string,
    excludeId?: string,
  ) {
    const existed = await this.prisma.supplier.findFirst({
      where: {
        tenantId,
        code,
        id: excludeId ? { not: excludeId } : undefined,
      },
      select: { id: true },
    });

    if (existed) {
      throw new BadRequestException('供应商编码已存在');
    }
  }

  private async ensureSupplier(tenantId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });

    if (!supplier) {
      throw new NotFoundException('供应商不存在');
    }

    return supplier;
  }

  private async ensureContact(
    tenantId: string,
    supplierId: string,
    contactId: string,
  ) {
    const contact = await this.prisma.supplierContact.findFirst({
      where: { id: contactId, tenantId, supplierId },
      select: { id: true },
    });

    if (!contact) {
      throw new NotFoundException('联系人不存在');
    }

    return contact;
  }

  private async clearPrimaryContact(tenantId: string, supplierId: string) {
    await this.prisma.supplierContact.updateMany({
      where: { tenantId, supplierId, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  private async syncFiles(
    user: CurrentUser,
    supplierId: string,
    relations?: SupplierFileRelationDto[],
  ) {
    if (relations === undefined) {
      return;
    }

    await this.fileService.replaceOwnerRelations(
      user,
      'supplier',
      supplierId,
      relations.map((item, index) => ({
        fileId: item.fileId,
        fieldCode: item.fieldCode ?? 'attachments',
        relationName: item.relationName,
        sort: item.sort ?? index,
        extra: item.extra,
      })),
    );
  }
}
