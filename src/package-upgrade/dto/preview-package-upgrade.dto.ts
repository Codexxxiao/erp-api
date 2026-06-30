import { IsOptional, IsString } from 'class-validator';

export class PreviewPackageUpgradeDto {
  @IsString()
  tenantId: string;

  @IsString()
  packageId: string;

  @IsOptional()
  @IsString()
  targetVersionId?: string;
}
