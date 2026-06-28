import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '../../common/types/current-user';

interface RequestWithUser extends Request {
  user?: CurrentUser;
}

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user?.isPlatformAdmin) {
      throw new ForbiddenException('仅平台管理员可操作');
    }

    return true;
  }
}
