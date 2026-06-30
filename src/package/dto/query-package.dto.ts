import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PackageStatus } from '../../generated/prisma/client';

export class QueryPackageDto {
  @IsOptional()
  @IsEnum(PackageStatus)
  status?: PackageStatus;

  @IsOptional()
  @IsString()
  keyword?: string;
}
