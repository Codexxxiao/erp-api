import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTenantDto) {
    const code = this.normalize(dto.code);
    const adminUsername = this.normalize(dto.adminUsername);
    const passwordHash = await bcrypt.hash(dto.adminPassword, 10);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: dto.name.trim(),
            code,
          },
        });

        const admin = await tx.user.create({
          data: {
            tenantId: tenant.id,
            identity: this.tenantIdentity(code, adminUsername),
            username: adminUsername,
            nickname: dto.adminNickname,
            passwordHash,
            isTenantAdmin: true,
          },
        });

        return {
          tenant,
          admin: {
            id: admin.id,
            username: admin.username,
            nickname: admin.nickname,
            isTenantAdmin: admin.isTenantAdmin,
          },
        };
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new BadRequestException('租户编码或管理员账号已存在');
      }

      throw error;
    }
  }

  async findMany() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            nickname: true,
            isTenantAdmin: true,
            isActive: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('租户不存在');
    }

    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    try {
      return await this.prisma.tenant.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          status: dto.status,
        },
      });
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new NotFoundException('租户不存在');
      }

      throw error;
    }
  }

  private normalize(value: string) {
    return value.trim().toLowerCase();
  }

  private tenantIdentity(tenantCode: string, username: string) {
    return `tenant:${tenantCode}:${username}`;
  }

  private isUniqueError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private isNotFoundError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    );
  }
}
