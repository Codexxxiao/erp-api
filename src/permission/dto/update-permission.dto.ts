import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PermissionType } from '../../generated/prisma/client';

export class UpdatePermissionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsEnum(PermissionType)
  type?: PermissionType;

  @IsOptional()
  @IsString()
  description?: string;
}
