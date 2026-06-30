import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PackageUpgradeConflictPolicy } from '../../generated/prisma/client';

export class ExecutePackageUpgradeDto {
  @IsString()
  tenantId: string;

  @IsString()
  packageId: string;

  @IsOptional()
  @IsString()
  targetVersionId?: string;

  @IsOptional()
  @IsEnum(PackageUpgradeConflictPolicy)
  conflictPolicy?: PackageUpgradeConflictPolicy;

  @IsOptional()
  @IsString()
  previewSignature?: string;
}
