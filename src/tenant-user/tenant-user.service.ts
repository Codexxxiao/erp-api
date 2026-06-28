import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, TenantStatus } from '../generated/prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId, tenantWhere } from '../common/tenant/tenant-scope';
import { CreateTenantUserDto } from './dto/create-tenant-user.dto';
import { InviteTenantUserDto } from './dto/invite-tenant-user.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { UpdateTenantUserDto } from './dto/update-tenant-user.dto';

@Injectable()
export class TenantUserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  findMany(currentUser: CurrentUser) {
    return this.prisma.user.findMany({
      where: tenantWhere(currentUser),
      select: {
        id: true,
        username: true,
        nickname: true,
        isTenantAdmin: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(
    currentUser: CurrentUser,
    dto: CreateTenantUserDto,
    ip?: string,
  ) {
    const tenantId = requireTenantId(currentUser);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('租户不存在');

    const username = this.normalize(dto.username);
    const passwordHash = await bcrypt.hash(dto.password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          tenantId,
          identity: this.tenantIdentity(tenant.code, username),
          username,
          nickname: dto.nickname,
          passwordHash,
          mustChangePassword: true,
        },
        select: this.publicSelect(),
      });

      await this.audit.log(
        'tenant.user.create',
        {
          tenantId,
          userId: currentUser.id,
          ip,
        },
        'User',
        { targetUserId: user.id },
      );

      return user;
    } catch (e) {
      if (this.isUniqueError(e)) {
        throw new BadRequestException('用户名已存在');
      }
      throw e;
    }
  }

  async invite(
    currentUser: CurrentUser,
    dto: InviteTenantUserDto,
    ip?: string,
  ) {
    const tenantId = requireTenantId(currentUser);
    const username = this.normalize(dto.username);

    const existingUser = await this.prisma.user.findFirst({
      where: { tenantId, username },
    });
    if (existingUser) {
      throw new BadRequestException('用户名已存在');
    }

    await this.prisma.userInvite.deleteMany({
      where: { tenantId, username, acceptedAt: null },
    });

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const inviteDays = Number(
      this.config.get<string>('INVITE_TOKEN_DAYS') ?? 7,
    );
    const expiresAt = new Date(Date.now() + inviteDays * 86400000);

    await this.prisma.userInvite.create({
      data: {
        tenantId,
        username,
        nickname: dto.nickname,
        tokenHash,
        expiresAt,
        invitedById: currentUser.id,
      },
    });

    await this.audit.log(
      'tenant.user.invite',
      {
        tenantId,
        userId: currentUser.id,
        ip,
      },
      'UserInvite',
      { username },
    );

    return {
      inviteToken: rawToken,
      expiresAt,
      acceptPath: '/api/tenant/users/accept-invite',
    };
  }

  async acceptInvite(dto: AcceptInviteDto, ip?: string) {
    const tokenHash = this.hashToken(dto.token);
    const invite = await this.prisma.userInvite.findUnique({
      where: { tokenHash },
      include: { tenant: true },
    });

    if (!invite || invite.acceptedAt) {
      throw new BadRequestException('邀请无效');
    }
    if (invite.expiresAt < new Date()) {
      throw new BadRequestException('邀请已过期');
    }
    if (invite.tenant.status === TenantStatus.DISABLED) {
      throw new ForbiddenException('租户已停用');
    }

    const existingUser = await this.prisma.user.findFirst({
      where: { tenantId: invite.tenantId, username: invite.username },
    });
    if (existingUser) {
      throw new BadRequestException('用户名已存在');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          tenantId: invite.tenantId,
          identity: this.tenantIdentity(invite.tenant.code, invite.username),
          username: invite.username,
          nickname: invite.nickname,
          passwordHash,
        },
        select: this.publicSelect(),
      });

      await tx.userInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date(), acceptedById: created.id },
      });

      return created;
    });

    await this.audit.log(
      'tenant.user.accept_invite',
      {
        tenantId: invite.tenantId,
        userId: user.id,
        ip,
      },
      'User',
      { inviteId: invite.id },
    );

    return user;
  }

  async update(
    currentUser: CurrentUser,
    id: string,
    dto: UpdateTenantUserDto,
    ip?: string,
  ) {
    const tenantId = requireTenantId(currentUser);
    const target = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!target) throw new NotFoundException('用户不存在');

    if (id === currentUser.id && dto.isActive === false) {
      throw new ForbiddenException('不能停用自己');
    }
    if (target.isTenantAdmin && dto.isTenantAdmin === false) {
      const adminCount = await this.prisma.user.count({
        where: { tenantId, isTenantAdmin: true, isActive: true },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('至少保留一名租户管理员');
      }
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        nickname: dto.nickname,
        isActive: dto.isActive,
        isTenantAdmin: dto.isTenantAdmin,
      },
      select: this.publicSelect(),
    });

    if (dto.isActive === false) {
      await this.revokeRefreshTokens(id);
    }

    await this.audit.log(
      'tenant.user.update',
      {
        tenantId,
        userId: currentUser.id,
        ip,
      },
      'User',
      { targetUserId: id, changes: { ...dto } },
    );

    return user;
  }

  async resetPassword(
    currentUser: CurrentUser,
    id: string,
    newPassword: string,
    ip?: string,
  ) {
    const tenantId = requireTenantId(currentUser);
    const target = await this.prisma.user.findFirst({
      where: { id, tenantId },
    });
    if (!target) throw new NotFoundException('用户不存在');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          passwordHash: await bcrypt.hash(newPassword, 10),
          mustChangePassword: true,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.log(
      'tenant.user.reset_password',
      {
        tenantId,
        userId: currentUser.id,
        ip,
      },
      'User',
      { targetUserId: id },
    );

    return { ok: true };
  }

  private async revokeRefreshTokens(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private publicSelect() {
    return {
      id: true,
      username: true,
      nickname: true,
      isTenantAdmin: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
    } as const;
  }

  private normalize(v: string) {
    return v.trim().toLowerCase();
  }

  private tenantIdentity(code: string, username: string) {
    return `tenant:${code}:${username}`;
  }

  private hashToken(raw: string) {
    return createHash('sha256').update(raw).digest('hex');
  }

  private isUniqueError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
