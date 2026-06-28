export interface JwtPayload {
  sub: string;
  tenantId: string | null;
  tenantCode: string | null;
  username: string;
}
