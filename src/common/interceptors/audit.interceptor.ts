import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { Prisma } from '../../generated/prisma/client';
import { AuditService } from '../../audit/audit.service';
import { AUDIT_KEY, AuditMeta } from '../decorators/audit.decorator';
import type { CurrentUser } from '../types/current-user';
import { sanitizeForAudit } from '../utils/sanitize-audit';

interface RequestWithUser extends Request {
  user?: CurrentUser;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditMeta | undefined>(
      AUDIT_KEY,
      context.getHandler(),
    );
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest<RequestWithUser>();
    const user = req.user;

    return next.handle().pipe(
      tap((body: unknown) => {
        void this.audit.log(
          meta.action,
          {
            tenantId: user?.tenantId,
            userId: user?.id,
            ip: req.ip,
          },
          meta.resource,
          sanitizeForAudit({
            method: req.method,
            path: req.url,
            body: req.body as unknown,
            result: body,
          }) as Prisma.InputJsonValue,
        );
      }),
    );
  }
}
