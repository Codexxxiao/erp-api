import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { PermissionService } from '../permission/permission.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';

export interface MenuTreeNode {
  id: string;
  parentId: string | null;
  type: string;
  title: string;
  name: string;
  path: string | null;
  component: string | null;
  redirect: string | null;
  icon: string | null;
  sort: number;
  permissionCode: string | null;
  isVisible: boolean;
  isEnabled: boolean;
  meta: unknown;
  children: MenuTreeNode[];
}

@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
  ) {}

  async create(currentUser: CurrentUser, dto: CreateMenuDto) {
    const tenantId = requireTenantId(currentUser);

    await this.assertParentBelongsToTenant(tenantId, dto.parentId);
    await this.assertPermissionExists(dto.permissionCode);

    try {
      return await this.prisma.menu.create({
        data: {
          tenantId,
          parentId: dto.parentId ?? null,
          type: dto.type,
          title: dto.title.trim(),
          name: dto.name.trim().toLowerCase(),
          path: dto.path?.trim(),
          component: dto.component?.trim(),
          redirect: dto.redirect?.trim(),
          icon: dto.icon?.trim(),
          sort: dto.sort ?? 0,
          permissionCode: dto.permissionCode?.trim().toLowerCase(),
          isVisible: dto.isVisible ?? true,
          isEnabled: dto.isEnabled ?? true,
          meta: dto.meta as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new BadRequestException('菜单名称已存在');
      }
      throw error;
    }
  }

  findMany(currentUser: CurrentUser) {
    const tenantId = requireTenantId(currentUser);

    return this.prisma.menu.findMany({
      where: { tenantId },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async update(currentUser: CurrentUser, id: string, dto: UpdateMenuDto) {
    const tenantId = requireTenantId(currentUser);

    const menu = await this.prisma.menu.findFirst({
      where: { id, tenantId },
    });

    if (!menu) {
      throw new NotFoundException('菜单不存在');
    }

    if (dto.parentId === id) {
      throw new BadRequestException('父级菜单不能是自己');
    }

    await this.assertParentBelongsToTenant(tenantId, dto.parentId);
    await this.assertPermissionExists(dto.permissionCode ?? undefined);

    await this.prisma.menu.update({
      where: { id },
      data: {
        parentId: dto.parentId === undefined ? undefined : dto.parentId,
        type: dto.type,
        title: dto.title?.trim(),
        path: dto.path?.trim(),
        component: dto.component?.trim(),
        redirect: dto.redirect?.trim(),
        icon: dto.icon?.trim(),
        sort: dto.sort,
        permissionCode:
          dto.permissionCode === undefined
            ? undefined
            : (dto.permissionCode?.trim().toLowerCase() ?? null),
        isVisible: dto.isVisible,
        isEnabled: dto.isEnabled,
        meta:
          dto.meta === undefined
            ? undefined
            : (dto.meta as Prisma.InputJsonValue),
      },
    });

    return this.prisma.menu.findUnique({ where: { id } });
  }

  async getCurrentUserMenuTree(currentUser: CurrentUser) {
    const tenantId = requireTenantId(currentUser);

    const menus = await this.prisma.menu.findMany({
      where: {
        tenantId,
        isEnabled: true,
        isVisible: true,
      },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    });

    const permissionCodes = new Set(
      await this.permissionService.getCurrentPermissionCodes(currentUser),
    );

    const filtered = menus.filter((menu) => {
      if (currentUser.isTenantAdmin) return true;
      if (!menu.permissionCode) return true;
      return permissionCodes.has(menu.permissionCode);
    });

    return this.buildTree(filtered);
  }

  private buildTree(menus: Array<Omit<MenuTreeNode, 'children'>>) {
    const map = new Map<string, MenuTreeNode>();
    const roots: MenuTreeNode[] = [];

    for (const menu of menus) {
      map.set(menu.id, { ...menu, children: [] });
    }

    for (const menu of map.values()) {
      if (menu.parentId && map.has(menu.parentId)) {
        map.get(menu.parentId)!.children.push(menu);
      } else {
        roots.push(menu);
      }
    }

    return roots;
  }

  private async assertParentBelongsToTenant(
    tenantId: string,
    parentId?: string | null,
  ) {
    if (!parentId) return;

    const parent = await this.prisma.menu.findFirst({
      where: { id: parentId, tenantId },
    });

    if (!parent) {
      throw new BadRequestException('父级菜单不存在');
    }
  }

  private async assertPermissionExists(permissionCode?: string | null) {
    if (!permissionCode) return;

    const permission = await this.prisma.permission.findUnique({
      where: { code: permissionCode.trim().toLowerCase() },
    });

    if (!permission) {
      throw new BadRequestException('权限编码不存在');
    }
  }

  private isUniqueError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
