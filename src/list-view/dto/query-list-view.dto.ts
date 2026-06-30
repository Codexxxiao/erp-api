import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  ListViewColumnSource,
  ListViewFilterOperator,
  ListViewSortDirection,
} from '../../generated/prisma/client';

export class QueryListViewFilterDto {
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

  @IsEnum(ListViewFilterOperator)
  operator: ListViewFilterOperator;

  @IsOptional()
  value?: unknown;

  @IsOptional()
  valueTo?: unknown;

  @IsOptional()
  @IsArray()
  values?: unknown[];
}

export class QueryListViewSortDto {
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

  @IsEnum(ListViewSortDirection)
  direction: ListViewSortDirection;
}

export class QueryListViewDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QueryListViewFilterDto)
  filters?: QueryListViewFilterDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QueryListViewSortDto)
  sorts?: QueryListViewSortDto[];
}
