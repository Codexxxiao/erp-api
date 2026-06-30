import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PackageInstallStatus } from '../../generated/prisma/client';

export class QueryPackageInstallDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  packageVersionId?: string;

  @IsOptional()
  @IsEnum(PackageInstallStatus)
  status?: PackageInstallStatus;
}
