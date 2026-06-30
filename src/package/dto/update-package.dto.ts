import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PackageStatus } from '../../generated/prisma/client';

export class UpdatePackageDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @IsOptional()
  @IsEnum(PackageStatus)
  status?: PackageStatus;

  @IsOptional()
  tags?: unknown;

  @IsOptional()
  config?: unknown;
}
