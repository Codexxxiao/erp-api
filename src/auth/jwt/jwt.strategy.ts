import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TenantStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from './jwt-payload';
import { CurrentUser } from '../../common/types/current-user';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('用户不存在或已停用');
    }

    if (user.tenant && user.tenant.status === TenantStatus.DISABLED) {
      throw new ForbiddenException('租户已停用');
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      tenantCode: user.tenant?.code ?? null,
      username: user.username,
      nickname: user.nickname,
      isPlatformAdmin: user.isPlatformAdmin,
      isTenantAdmin: user.isTenantAdmin,
    };
  }
}
