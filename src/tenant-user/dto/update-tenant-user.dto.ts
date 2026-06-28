import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateTenantUserDto {
  @IsOptional()
  @IsString()
  nickname?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isTenantAdmin?: boolean;
}
