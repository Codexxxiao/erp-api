import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdatePackageAssetDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  sort?: number;

  @IsOptional()
  config?: unknown;
}
