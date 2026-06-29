import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentUser } from '../types/current-user';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

interface RequestWithUser extends Request {
  user?: CurrentUser;
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest<RequestWithUser>().user;

    if (!user) {
      throw new ForbiddenException('缺少用户上下文');
    }

    if (user.isPlatformAdmin || user.isTenantAdmin) {
      return true;
    }

    if (!user.tenantId) {
      throw new ForbiddenException('缺少租户上下文');
    }

    const rows = await this.prisma.rolePermission.findMany({
      where: {
        permission: {
          code: { in: required },
        },
        role: {
          tenantId: user.tenantId,
          isActive: true,
          userRoles: {
            some: { userId: user.id },
          },
        },
      },
      select: {
        permission: {
          select: { code: true },
        },
      },
    });

    const owned = new Set(rows.map((row) => row.permission.code));
    const passed = required.every((code) => owned.has(code));

    if (!passed) {
      throw new ForbiddenException('缺少权限');
    }

    return true;
  }
}
