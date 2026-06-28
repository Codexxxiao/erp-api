import { IsOptional, IsString } from 'class-validator';

export class InviteTenantUserDto {
  @IsString()
  username: string;

  @IsOptional()
  @IsString()
  nickname?: string;
}
