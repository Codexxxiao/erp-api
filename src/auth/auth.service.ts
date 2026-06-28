import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Tenant, TenantStatus, User } from '../generated/prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { BootstrapPlatformAdminDto } from './dto/bootstrap-platform-admin.dto';
import { LoginDto } from './dto/login.dto';

type UserWithTenant = User & { tenant: Tenant | null };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

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

    return this.buildLoginResult(user);
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

    return this.buildLoginResult(user);
  }

  private buildLoginResult(user: UserWithTenant) {
    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      tenantCode: user.tenant?.code ?? null,
      username: user.username,
    };

    return {
      accessToken: this.jwt.sign(payload),
      user: {
        id: user.id,
        tenantId: user.tenantId,
        tenantCode: user.tenant?.code ?? null,
        username: user.username,
        nickname: user.nickname,
        isPlatformAdmin: user.isPlatformAdmin,
        isTenantAdmin: user.isTenantAdmin,
      },
    };
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
