export class CreateListViewDto {}
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  ListViewColumnSource,
  ListViewFilterOperator,
  ListViewSortDirection,
} from '../../generated/prisma/client';

export class ListViewColumnDto {
  @IsEnum(ListViewColumnSource)
  source: ListViewColumnSource;

  @IsOptional()
  @IsString()
  systemKey?: string;

  @IsOptional()
  @IsString()
  fieldId?: string;

  @IsOptional()
  @IsString()
  fieldCode?: string;

  @IsString()
  @MaxLength(100)
  title: string;

  @IsOptional()
  @IsInt()
  width?: number;

  @IsOptional()
  @IsString()
  fixed?: string;

  @IsOptional()
  @IsBoolean()
  hidden?: boolean;

  @IsOptional()
  @IsBoolean()
  sortable?: boolean;

  @IsOptional()
  @IsEnum(ListViewSortDirection)
  sortDirection?: ListViewSortDirection;

  @IsOptional()
  config?: unknown;

  @IsOptional()
  @IsInt()
  sort?: number;
}

export class ListViewFilterDto {
  @IsEnum(ListViewColumnSource)
  source: ListViewColumnSource;

  @IsOptional()
  @IsString()
  systemKey?: string;

  @IsOptional()
  @IsString()
  fieldId?: string;

  @IsOptional()
  @IsString()
  fieldCode?: string;

  @IsString()
  @MaxLength(100)
  label: string;

  @IsEnum(ListViewFilterOperator)
  operator: ListViewFilterOperator;

  @IsOptional()
  defaultValue?: unknown;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  config?: unknown;

  @IsOptional()
  @IsInt()
  sort?: number;
}

export class CreateListViewDto {
  @IsString()
  @MaxLength(64)
  code: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  formId: string;

  @IsOptional()
  @IsString()
  formVersionId?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  config?: unknown;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ListViewColumnDto)
  columns: ListViewColumnDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ListViewFilterDto)
  filters?: ListViewFilterDto[];
}
