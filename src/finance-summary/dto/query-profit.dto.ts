import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { SalesOrderStatus } from '../../generated/prisma/client';

export class QueryProfitDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize = 20;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() @IsEnum(SalesOrderStatus) status?: SalesOrderStatus;
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() currencyCode?: string;
  @IsOptional() @IsDateString() createdFrom?: string;
  @IsOptional() @IsDateString() createdTo?: string;
}
