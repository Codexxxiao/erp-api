import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PackageInstallConflictPolicy } from '../../generated/prisma/client';

export class CreatePackageInstallDto {
  @IsString()
  tenantId: string;

  @IsString()
  packageVersionId: string;

  @IsOptional()
  @IsEnum(PackageInstallConflictPolicy)
  conflictPolicy?: PackageInstallConflictPolicy;
}
