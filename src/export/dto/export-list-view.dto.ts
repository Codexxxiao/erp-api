import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  QueryListViewFilterDto,
  QueryListViewSortDto,
} from '../../list-view/dto/query-list-view.dto';

export class ExportListViewDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fileName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  maxRows?: number = 5000;

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
