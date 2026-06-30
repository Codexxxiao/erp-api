import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreatePackageVersionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  versionNo?: number;

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
  changelog?: string;

  @IsOptional()
  config?: unknown;
}
