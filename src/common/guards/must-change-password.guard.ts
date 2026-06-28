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
export class MustChangePasswordGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<RequestWithUser>().user;

    if (user?.mustChangePassword) {
      throw new ForbiddenException('请先修改密码');
    }

    return true;
  }
}
