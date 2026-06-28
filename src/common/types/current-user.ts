export interface CurrentUser {
  id: string;
  tenantId: string | null;
  tenantCode: string | null;
  username: string;
  nickname: string | null;
  isPlatformAdmin: boolean;
  isTenantAdmin: boolean;
  mustChangePassword: boolean;
}
