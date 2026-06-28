import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import type { CurrentUser } from '../types/current-user';

interface RequestWithUser extends Request {
  user?: CurrentUser;
}

@Injectable()
export class TenantAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<RequestWithUser>().user;

    if (!user?.tenantId || !user.isTenantAdmin) {
      throw new ForbiddenException('仅租户管理员可操作');
    }

    return true;
  }
}
