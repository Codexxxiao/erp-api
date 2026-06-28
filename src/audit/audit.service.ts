import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditContext {
  tenantId?: string | null;
  userId?: string | null;
  ip?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    action: string,
    ctx: AuditContext,
    resource?: string,
    detail?: Prisma.InputJsonValue,
  ) {
    await this.prisma.auditLog.create({
      data: {
        action,
        tenantId: ctx.tenantId ?? null,
        userId: ctx.userId ?? null,
        resource: resource ?? null,
        detail: detail ?? undefined,
        ip: ctx.ip ?? null,
      },
    });
  }
}
