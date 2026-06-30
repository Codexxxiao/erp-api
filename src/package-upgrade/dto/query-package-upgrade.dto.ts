import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PackageUpgradeStatus } from '../../generated/prisma/client';

export class QueryPackageUpgradeDto {
  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  packageId?: string;

  @IsOptional()
  @IsEnum(PackageUpgradeStatus)
  status?: PackageUpgradeStatus;
}
