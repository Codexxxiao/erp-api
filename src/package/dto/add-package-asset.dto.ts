import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PackageAssetType } from '../../generated/prisma/client';

export class AddPackageAssetDto {
  @IsEnum(PackageAssetType)
  type: PackageAssetType;

  @IsString()
  assetId: string;

  @IsOptional()
  @IsString()
  sourceTenantId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort?: number;

  @IsOptional()
  @IsBoolean()
  includeSnapshot?: boolean;

  @IsOptional()
  config?: unknown;
}
