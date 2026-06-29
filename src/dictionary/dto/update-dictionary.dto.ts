import { IsBoolean, IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateDictionaryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
