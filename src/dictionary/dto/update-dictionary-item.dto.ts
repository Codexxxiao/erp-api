import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateDictionaryItemDto {
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  color?: string | null;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown> | null;
}
