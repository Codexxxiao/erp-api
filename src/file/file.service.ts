import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, stat, writeFile } from 'fs/promises';
import { dirname, extname, join, resolve, sep } from 'path';
import { FileObjectStatus, Prisma } from '../generated/prisma/client';
import type { CurrentUser } from '../common/types/current-user';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFileRelationDto } from './dto/create-file-relation.dto';
import { QueryFileDto } from './dto/query-file.dto';
import { QueryFileRelationDto } from './dto/query-file-relation.dto';
import { UploadFileDto } from './dto/upload-file.dto';

const DEFAULT_MAX_SIZE = 20 * 1024 * 1024;
const BLOCKED_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.dll',
  '.msi',
  '.sh',
  '.js',
  '.vbs',
]);

export type ReplaceFileRelationInput = {
  fileId: string;
  fieldCode?: string;
  relationName?: string;
  sort?: number;
  extra?: Record<string, unknown>;
};

@Injectable()
export class FileService {
  private readonly storageRoot = resolve(
    process.env.FILE_STORAGE_ROOT ?? join(process.cwd(), 'uploads'),
  );

  constructor(private readonly prisma: PrismaService) {}

  async replaceOwnerRelations(
    user: CurrentUser,
    ownerType: string,
    ownerId: string,
    relations: ReplaceFileRelationInput[],
  ) {
    const tenantId = this.requireTenant(user);

    const uniqueRelations = Array.from(
      new Map(
        relations
          .filter((item) => item.fileId)
          .map((item) => [
            `${item.fileId}:${item.fieldCode ?? ''}`,
            {
              ...item,
              fieldCode: item.fieldCode ?? '',
            },
          ]),
      ).values(),
    );

    await this.assertTenantFiles(
      tenantId,
      uniqueRelations.map((item) => item.fileId),
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.fileRelation.deleteMany({
        where: {
          tenantId,
          ownerType,
          ownerId,
        },
      });

      if (uniqueRelations.length === 0) return;

      await tx.fileRelation.createMany({
        data: uniqueRelations.map((item, index) => ({
          tenantId,
          fileId: item.fileId,
          ownerType,
          ownerId,
          fieldCode: item.fieldCode ?? '',
          relationName: item.relationName,
          sort: item.sort ?? index,
          extra: this.toJson(item.extra),
          createdById: user.id,
        })),
        skipDuplicates: true,
      });
    });

    return this.findRelations(user, { ownerType, ownerId });
  }

  async upload(
    user: CurrentUser,
    file: Express.Multer.File,
    dto: UploadFileDto,
  ) {
    const tenantId = this.requireTenant(user);
    this.validateUploadFile(file);

    const extension = extname(file.originalname).toLowerCase() || null;
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const now = new Date();
    const datePath = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('/');

    const storageKey = `${tenantId}/${datePath}/${randomUUID()}${extension ?? ''}`;
    const absolutePath = this.resolveStoragePath(storageKey);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer);

    const created = await this.prisma.fileObject.create({
      data: {
        tenantId,
        originalName: file.originalname,
        storageKey,
        mimeType: file.mimetype,
        extension,
        size: file.size,
        checksum,
        isPublic: dto.isPublic ?? false,
        uploadedById: user.id,
      },
    });

    if (dto.ownerType && dto.ownerId) {
      await this.createRelation(user, created.id, {
        ownerType: dto.ownerType,
        ownerId: dto.ownerId,
        fieldCode: dto.fieldCode,
        relationName: dto.relationName,
        extra: this.parseExtra(dto.extra),
      });
    }

    return this.findOne(user, created.id);
  }

  async findMany(user: CurrentUser, query: QueryFileDto) {
    const tenantId = this.requireTenant(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.FileObjectWhereInput = {
      tenantId,
      status: query.status ?? FileObjectStatus.ACTIVE,
      ...(query.keyword
        ? {
            OR: [
              {
                originalName: { contains: query.keyword, mode: 'insensitive' },
              },
              { mimeType: { contains: query.keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.ownerType && query.ownerId
        ? {
            relations: {
              some: {
                tenantId,
                ownerType: query.ownerType,
                ownerId: query.ownerId,
                fieldCode: query.fieldCode ?? undefined,
              },
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.fileObject.count({ where }),
      this.prisma.fileObject.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { relations: true } } },
      }),
    ]);

    return { total, page, pageSize, items };
  }

  async findOne(user: CurrentUser, id: string) {
    const tenantId = this.requireTenant(user);

    const file = await this.prisma.fileObject.findFirst({
      where: { id, tenantId },
      include: { relations: { orderBy: { createdAt: 'asc' } } },
    });

    if (!file) throw new NotFoundException('文件不存在');
    return file;
  }

  async prepareDownload(user: CurrentUser, id: string) {
    const file = await this.findOne(user, id);

    if (file.status !== FileObjectStatus.ACTIVE) {
      throw new BadRequestException('文件已删除');
    }

    const absolutePath = this.resolveStoragePath(file.storageKey);

    try {
      await stat(absolutePath);
    } catch {
      throw new NotFoundException('文件实体不存在');
    }

    return {
      file,
      stream: createReadStream(absolutePath),
    };
  }

  async remove(user: CurrentUser, id: string) {
    const tenantId = this.requireTenant(user);
    const file = await this.findOne(user, id);

    const relationCount = await this.prisma.fileRelation.count({
      where: { tenantId, fileId: file.id },
    });

    if (relationCount > 0) {
      throw new BadRequestException('文件已被业务引用，请先解除关联');
    }

    return this.prisma.fileObject.update({
      where: { id: file.id },
      data: {
        status: FileObjectStatus.DELETED,
        deletedAt: new Date(),
      },
    });
  }

  async createRelation(
    user: CurrentUser,
    fileId: string,
    dto: CreateFileRelationDto,
  ) {
    const tenantId = this.requireTenant(user);

    const file = await this.prisma.fileObject.findFirst({
      where: { id: fileId, tenantId, status: FileObjectStatus.ACTIVE },
    });

    if (!file) throw new NotFoundException('文件不存在或已删除');

    const fieldCode = dto.fieldCode ?? '';

    return this.prisma.fileRelation.upsert({
      where: {
        tenantId_fileId_ownerType_ownerId_fieldCode: {
          tenantId,
          fileId,
          ownerType: dto.ownerType,
          ownerId: dto.ownerId,
          fieldCode,
        },
      },
      update: {
        relationName: dto.relationName,
        sort: dto.sort ?? 0,
        extra: this.toJson(dto.extra),
      },
      create: {
        tenantId,
        fileId,
        ownerType: dto.ownerType,
        ownerId: dto.ownerId,
        fieldCode,
        relationName: dto.relationName,
        sort: dto.sort ?? 0,
        extra: this.toJson(dto.extra),
        createdById: user.id,
      },
      include: { file: true },
    });
  }

  async findRelations(user: CurrentUser, query: QueryFileRelationDto) {
    const tenantId = this.requireTenant(user);

    return this.prisma.fileRelation.findMany({
      where: {
        tenantId,
        ownerType: query.ownerType,
        ownerId: query.ownerId,
        fieldCode: query.fieldCode ?? undefined,
        file: { status: FileObjectStatus.ACTIVE },
      },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
      include: { file: true },
    });
  }

  async removeRelation(user: CurrentUser, fileId: string, relationId: string) {
    const tenantId = this.requireTenant(user);

    const deleted = await this.prisma.fileRelation.deleteMany({
      where: { id: relationId, fileId, tenantId },
    });

    if (deleted.count === 0) throw new NotFoundException('文件关联不存在');

    return { success: true };
  }

  async assertTenantFiles(tenantId: string, fileIds: string[]) {
    const uniqueIds = Array.from(new Set(fileIds.filter(Boolean)));
    if (uniqueIds.length === 0) return;

    const count = await this.prisma.fileObject.count({
      where: {
        tenantId,
        id: { in: uniqueIds },
        status: FileObjectStatus.ACTIVE,
      },
    });

    if (count !== uniqueIds.length) {
      throw new BadRequestException('存在无效或无权访问的文件');
    }
  }

  private validateUploadFile(file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('请选择上传文件');
    if (!file.buffer?.length) throw new BadRequestException('文件内容为空');

    const maxSize = Number(process.env.FILE_MAX_SIZE ?? DEFAULT_MAX_SIZE);
    if (file.size > maxSize) throw new BadRequestException('文件大小超出限制');

    const extension = extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(extension)) {
      throw new BadRequestException('不允许上传该类型文件');
    }

    const allowed = process.env.FILE_ALLOWED_MIME_TYPES;
    if (allowed && allowed !== '*') {
      const allowSet = new Set(allowed.split(',').map((item) => item.trim()));
      if (!allowSet.has(file.mimetype)) {
        throw new BadRequestException('文件 MIME 类型不在白名单内');
      }
    }
  }

  private resolveStoragePath(storageKey: string) {
    const absolutePath = resolve(this.storageRoot, storageKey);
    if (
      absolutePath !== this.storageRoot &&
      !absolutePath.startsWith(this.storageRoot + sep)
    ) {
      throw new BadRequestException('非法文件路径');
    }
    return absolutePath;
  }

  private requireTenant(user: CurrentUser) {
    if (!user.tenantId) throw new ForbiddenException('租户身份缺失');
    return user.tenantId;
  }

  private parseExtra(value?: string) {
    if (!value) return undefined;
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('extra 必须是合法 JSON 字符串');
    }
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
