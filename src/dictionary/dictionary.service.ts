import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { CreateDictionaryDto } from './dto/create-dictionary.dto';
import { UpdateDictionaryDto } from './dto/update-dictionary.dto';
import { CreateDictionaryItemDto } from './dto/create-dictionary-item.dto';
import { UpdateDictionaryItemDto } from './dto/update-dictionary-item.dto';

@Injectable()
export class DictionaryService {
  constructor(private readonly prisma: PrismaService) {}

  createSystemDictionary(dto: CreateDictionaryDto) {
    return this.createDictionary(null, this.systemScopeKey(), dto);
  }

  findSystemDictionaries() {
    return this.prisma.dictionary.findMany({
      where: { scopeKey: this.systemScopeKey() },
      include: { items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
  }

  updateSystemDictionary(id: string, dto: UpdateDictionaryDto) {
    return this.updateDictionary(id, this.systemScopeKey(), dto);
  }

  createSystemItem(dictionaryId: string, dto: CreateDictionaryItemDto) {
    return this.createItem(dictionaryId, this.systemScopeKey(), dto);
  }

  updateSystemItem(itemId: string, dto: UpdateDictionaryItemDto) {
    return this.updateItem(itemId, this.systemScopeKey(), dto);
  }

  createTenantDictionary(currentUser: CurrentUser, dto: CreateDictionaryDto) {
    const tenantId = requireTenantId(currentUser);
    return this.createDictionary(tenantId, this.tenantScopeKey(tenantId), dto);
  }

  findTenantDictionaries(currentUser: CurrentUser) {
    const tenantId = requireTenantId(currentUser);

    return this.prisma.dictionary.findMany({
      where: { scopeKey: this.tenantScopeKey(tenantId) },
      include: { items: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] } },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
  }

  findAvailableDictionaries(currentUser: CurrentUser) {
    const tenantId = requireTenantId(currentUser);

    return this.prisma.dictionary.findMany({
      where: {
        isActive: true,
        OR: [
          { scopeKey: this.systemScopeKey() },
          { scopeKey: this.tenantScopeKey(tenantId) },
        ],
      },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findTenantItemsByCode(currentUser: CurrentUser, code: string) {
    const tenantId = requireTenantId(currentUser);
    const normalizedCode = this.normalizeCode(code);

    const tenantDictionary = await this.prisma.dictionary.findFirst({
      where: {
        scopeKey: this.tenantScopeKey(tenantId),
        code: normalizedCode,
        isActive: true,
      },
    });

    const dictionary =
      tenantDictionary ??
      (await this.prisma.dictionary.findFirst({
        where: {
          scopeKey: this.systemScopeKey(),
          code: normalizedCode,
          isActive: true,
        },
      }));

    if (!dictionary) {
      throw new NotFoundException('字典不存在');
    }

    return this.prisma.dictionaryItem.findMany({
      where: {
        dictionaryId: dictionary.id,
        isActive: true,
      },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
  }

  updateTenantDictionary(
    currentUser: CurrentUser,
    id: string,
    dto: UpdateDictionaryDto,
  ) {
    const tenantId = requireTenantId(currentUser);
    return this.updateDictionary(id, this.tenantScopeKey(tenantId), dto);
  }

  createTenantItem(
    currentUser: CurrentUser,
    dictionaryId: string,
    dto: CreateDictionaryItemDto,
  ) {
    const tenantId = requireTenantId(currentUser);
    return this.createItem(dictionaryId, this.tenantScopeKey(tenantId), dto);
  }

  updateTenantItem(
    currentUser: CurrentUser,
    itemId: string,
    dto: UpdateDictionaryItemDto,
  ) {
    const tenantId = requireTenantId(currentUser);
    return this.updateItem(itemId, this.tenantScopeKey(tenantId), dto);
  }

  private async createDictionary(
    tenantId: string | null,
    scopeKey: string,
    dto: CreateDictionaryDto,
  ) {
    try {
      return await this.prisma.dictionary.create({
        data: {
          tenantId,
          scopeKey,
          code: this.normalizeCode(dto.code),
          name: dto.name.trim(),
          description: dto.description?.trim(),
          sort: dto.sort ?? 0,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new BadRequestException('字典编码已存在');
      }
      throw error;
    }
  }

  private async updateDictionary(
    id: string,
    scopeKey: string,
    dto: UpdateDictionaryDto,
  ) {
    const dictionary = await this.prisma.dictionary.findFirst({
      where: { id, scopeKey },
    });

    if (!dictionary) {
      throw new NotFoundException('字典不存在');
    }

    return this.prisma.dictionary.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        sort: dto.sort,
        isActive: dto.isActive,
      },
    });
  }

  private async createItem(
    dictionaryId: string,
    scopeKey: string,
    dto: CreateDictionaryItemDto,
  ) {
    const dictionary = await this.prisma.dictionary.findFirst({
      where: { id: dictionaryId, scopeKey },
    });

    if (!dictionary) {
      throw new NotFoundException('字典不存在');
    }

    await this.assertParentItem(dictionaryId, dto.parentId);

    try {
      return await this.prisma.dictionaryItem.create({
        data: {
          dictionaryId,
          parentId: dto.parentId ?? null,
          value: dto.value.trim(),
          label: dto.label.trim(),
          color: dto.color?.trim(),
          sort: dto.sort ?? 0,
          isActive: dto.isActive ?? true,
          extra: dto.extra as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new BadRequestException('字典项值已存在');
      }
      throw error;
    }
  }

  private async updateItem(
    itemId: string,
    scopeKey: string,
    dto: UpdateDictionaryItemDto,
  ) {
    const item = await this.prisma.dictionaryItem.findFirst({
      where: {
        id: itemId,
        dictionary: { scopeKey },
      },
      include: { dictionary: true },
    });

    if (!item) {
      throw new NotFoundException('字典项不存在');
    }

    if (dto.parentId === itemId) {
      throw new BadRequestException('父级字典项不能是自己');
    }

    await this.assertParentItem(item.dictionaryId, dto.parentId);

    return this.prisma.dictionaryItem.update({
      where: { id: itemId },
      data: {
        parentId: dto.parentId === undefined ? undefined : dto.parentId,
        label: dto.label?.trim(),
        color:
          dto.color === undefined ? undefined : (dto.color?.trim() ?? null),
        sort: dto.sort,
        isActive: dto.isActive,
        extra:
          dto.extra === undefined
            ? undefined
            : (dto.extra as Prisma.InputJsonValue | null),
      },
    });
  }

  private async assertParentItem(
    dictionaryId: string,
    parentId?: string | null,
  ) {
    if (!parentId) return;

    const parent = await this.prisma.dictionaryItem.findFirst({
      where: { id: parentId, dictionaryId },
    });

    if (!parent) {
      throw new BadRequestException('父级字典项不存在');
    }
  }

  private normalizeCode(value: string) {
    return value.trim().toLowerCase();
  }

  private systemScopeKey() {
    return 'system';
  }

  private tenantScopeKey(tenantId: string) {
    return `tenant:${tenantId}`;
  }

  private isUniqueError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
