import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateDictionaryItemDto {
  @IsOptional()
  @IsString()
  parentId?: string | null;

  @IsString()
  value: string;

  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;
}
