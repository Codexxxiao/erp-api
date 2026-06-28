import { ForbiddenException } from '@nestjs/common';
import type { CurrentUser } from '../types/current-user';

/** 租户成员：返回当前 tenantId */
export function requireTenantId(user: CurrentUser): string {
  if (!user.tenantId) {
    throw new ForbiddenException('缺少租户上下文');
  }
  return user.tenantId;
}

/** 校验资源是否属于当前租户 */
export function assertSameTenant(
  user: CurrentUser,
  resourceTenantId: string | null | undefined,
) {
  const tenantId = requireTenantId(user);
  if (resourceTenantId !== tenantId) {
    throw new ForbiddenException('无权访问其他租户数据');
  }
}

/** Prisma where 片段：租户内列表查询 */
export function tenantWhere(user: CurrentUser) {
  return { tenantId: requireTenantId(user) };
}
