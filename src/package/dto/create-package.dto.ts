import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePackageDto {
  @IsString()
  @MaxLength(64)
  code: string;

  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @IsOptional()
  tags?: unknown;

  @IsOptional()
  config?: unknown;
}
