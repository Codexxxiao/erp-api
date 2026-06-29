import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFormDto {
  @IsString()
  @MaxLength(64)
  code: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  layout?: unknown;

  @IsOptional()
  config?: unknown;

  @IsOptional()
  @IsInt()
  sort?: number;
}
