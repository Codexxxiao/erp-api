import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  async createPermission(dto: CreatePermissionDto) {
    try {
      return await this.prisma.permission.create({
        data: {
          code: this.normalizePermissionCode(dto.code),
          name: dto.name.trim(),
          module: dto.module?.trim(),
          type: dto.type,
          description: dto.description?.trim(),
        },
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new BadRequestException('权限编码已存在');
      }
      throw error;
    }
  }

  findPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });
  }

  async updatePermission(id: string, dto: UpdatePermissionDto) {
    try {
      return await this.prisma.permission.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          module: dto.module?.trim(),
          type: dto.type,
          description: dto.description?.trim(),
        },
      });
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new NotFoundException('权限不存在');
      }
      throw error;
    }
  }

  async createRole(currentUser: CurrentUser, dto: CreateRoleDto) {
    const tenantId = requireTenantId(currentUser);

    try {
      return await this.prisma.role.create({
        data: {
          tenantId,
          code: this.normalizeRoleCode(dto.code),
          name: dto.name.trim(),
          description: dto.description?.trim(),
        },
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new BadRequestException('角色编码已存在');
      }
      throw error;
    }
  }

  findRoles(currentUser: CurrentUser) {
    const tenantId = requireTenantId(currentUser);

    return this.prisma.role.findMany({
      where: { tenantId },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: {
          select: { userRoles: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findRole(currentUser: CurrentUser, id: string) {
    const tenantId = requireTenantId(currentUser);

    const role = await this.prisma.role.findFirst({
      where: { id, tenantId },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('角色不存在');
    }

    return role;
  }

  async updateRole(currentUser: CurrentUser, id: string, dto: UpdateRoleDto) {
    const tenantId = requireTenantId(currentUser);

    const result = await this.prisma.role.updateMany({
      where: { id, tenantId },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        isActive: dto.isActive,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('角色不存在');
    }

    return this.findRole(currentUser, id);
  }

  async setRolePermissions(
    currentUser: CurrentUser,
    roleId: string,
    permissionCodes: string[],
  ) {
    const tenantId = requireTenantId(currentUser);
    const codes = permissionCodes.map((code) =>
      this.normalizePermissionCode(code),
    );

    const role = await this.prisma.role.findFirst({
      where: { id: roleId, tenantId },
    });

    if (!role) {
      throw new NotFoundException('角色不存在');
    }

    const permissions = await this.prisma.permission.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true },
    });

    if (permissions.length !== codes.length) {
      throw new BadRequestException('存在无效权限编码');
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({
        where: { roleId },
      }),
      this.prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId,
          permissionId: permission.id,
        })),
        skipDuplicates: true,
      }),
    ]);

    return this.findRole(currentUser, roleId);
  }

  async setUserRoles(
    currentUser: CurrentUser,
    userId: string,
    roleIds: string[],
  ) {
    const tenantId = requireTenantId(currentUser);
    const uniqueRoleIds = [...new Set(roleIds)];

    const target = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!target) {
      throw new NotFoundException('用户不存在');
    }

    const roles = await this.prisma.role.findMany({
      where: {
        tenantId,
        id: { in: uniqueRoleIds },
        isActive: true,
      },
      select: { id: true },
    });

    if (roles.length !== uniqueRoleIds.length) {
      throw new BadRequestException('存在无效角色');
    }

    await this.prisma.$transaction([
      this.prisma.userRole.deleteMany({
        where: { userId },
      }),
      this.prisma.userRole.createMany({
        data: uniqueRoleIds.map((roleId) => ({
          userId,
          roleId,
        })),
        skipDuplicates: true,
      }),
    ]);

    return this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        username: true,
        nickname: true,
        isTenantAdmin: true,
        isActive: true,
        userRoles: {
          include: { role: true },
        },
      },
    });
  }

  async getCurrentPermissionCodes(currentUser: CurrentUser) {
    if (currentUser.isPlatformAdmin || currentUser.isTenantAdmin) {
      const permissions = await this.prisma.permission.findMany({
        select: { code: true },
      });
      return permissions.map((permission) => permission.code);
    }

    const tenantId = requireTenantId(currentUser);

    const rows = await this.prisma.rolePermission.findMany({
      where: {
        role: {
          tenantId,
          isActive: true,
          userRoles: {
            some: { userId: currentUser.id },
          },
        },
      },
      select: {
        permission: {
          select: { code: true },
        },
      },
    });

    return [...new Set(rows.map((row) => row.permission.code))];
  }

  private normalizePermissionCode(value: string) {
    return value.trim().toLowerCase();
  }

  private normalizeRoleCode(value: string) {
    return value.trim().toLowerCase();
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
