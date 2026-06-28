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
export class TenantMemberGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<RequestWithUser>().user;

    if (!user?.tenantId) {
      throw new ForbiddenException('仅租户成员可访问');
    }

    return true;
  }
}
