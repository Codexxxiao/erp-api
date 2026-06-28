import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Tenant, TenantStatus, User } from '../generated/prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import type { CurrentUser } from '../common/types/current-user';
import { PrismaService } from '../prisma/prisma.service';
import { BootstrapPlatformAdminDto } from './dto/bootstrap-platform-admin.dto';
import { LoginDto } from './dto/login.dto';

type UserWithTenant = User & { tenant: Tenant | null };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private hashToken(raw: string) {
    return createHash('sha256').update(raw).digest('hex');
  }

  private getRefreshExpiresDays() {
    return Number(this.config.get<string>('REFRESH_TOKEN_DAYS') ?? 30);
  }

  private toPublicUser(user: UserWithTenant) {
    return {
      id: user.id,
      tenantId: user.tenantId,
      tenantCode: user.tenant?.code ?? null,
      username: user.username,
      nickname: user.nickname,
      isPlatformAdmin: user.isPlatformAdmin,
      isTenantAdmin: user.isTenantAdmin,
      mustChangePassword: user.mustChangePassword,
    };
  }

  private assertUserTenantActive(user: UserWithTenant) {
    if (user.tenant?.status === TenantStatus.DISABLED) {
      throw new ForbiddenException('租户已停用');
    }
  }

  private async issueTokenPair(user: UserWithTenant) {
    const accessToken = this.jwt.sign({
      sub: user.id,
      tenantId: user.tenantId,
      tenantCode: user.tenant?.code ?? null,
      username: user.username,
    });
    const rawRefresh = randomBytes(48).toString('hex');
    const refreshExpiresDays = this.getRefreshExpiresDays();

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(rawRefresh),
        expiresAt: new Date(Date.now() + refreshExpiresDays * 86400000),
      },
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      user: this.toPublicUser(user),
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { tenant: true } } },
    });

    if (!row || row.revokedAt || row.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token 无效');
    }
    if (!row.user.isActive) {
      throw new UnauthorizedException('用户已停用');
    }

    this.assertUserTenantActive(row.user);

    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(row.user);
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async changePassword(
    currentUser: CurrentUser,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
    });
    if (!user) throw new UnauthorizedException();

    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('原密码错误');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await bcrypt.hash(newPassword, 10),
          mustChangePassword: false,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { ok: true };
  }

  async bootstrapPlatformAdmin(dto: BootstrapPlatformAdminDto) {
    const exists = await this.prisma.user.count({
      where: { isPlatformAdmin: true },
    });

    if (exists > 0) {
      throw new ForbiddenException('平台管理员已初始化');
    }

    const username = this.normalize(dto.username);
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        tenantId: null,
        identity: this.platformIdentity(username),
        username,
        nickname: dto.nickname,
        passwordHash,
        isPlatformAdmin: true,
        isTenantAdmin: false,
      },
      include: { tenant: true },
    });

    return this.issueTokenPair(user);
  }

  async login(dto: LoginDto) {
    const username = this.normalize(dto.username);
    const tenantCode = dto.tenantCode ? this.normalize(dto.tenantCode) : null;

    let identity: string;

    if (tenantCode) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { code: tenantCode },
      });

      if (!tenant) {
        throw new UnauthorizedException('租户不存在');
      }

      if (tenant.status === TenantStatus.DISABLED) {
        throw new ForbiddenException('租户已停用');
      }

      identity = this.tenantIdentity(tenant.code, username);
    } else {
      identity = this.platformIdentity(username);
    }

    const user = await this.prisma.user.findUnique({
      where: { identity },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('账号或密码错误');
    }

    const matched = await bcrypt.compare(dto.password, user.passwordHash);

    if (!matched) {
      throw new UnauthorizedException('账号或密码错误');
    }

    return this.issueTokenPair(user);
  }

  private normalize(value: string) {
    return value.trim().toLowerCase();
  }

  private platformIdentity(username: string) {
    return `platform:${username}`;
  }

  private tenantIdentity(tenantCode: string, username: string) {
    return `tenant:${tenantCode}:${username}`;
  }
}
