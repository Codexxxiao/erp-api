import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { PermissionType } from '../../generated/prisma/client';

export class CreatePermissionDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9.-]*$/)
  code: string;

  @IsString()
  name: string;

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
