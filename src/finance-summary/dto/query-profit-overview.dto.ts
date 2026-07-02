import { IsDateString, IsOptional, IsString } from 'class-validator';

export class QueryProfitOverviewDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() currencyCode?: string;
  @IsOptional() @IsDateString() createdFrom?: string;
  @IsOptional() @IsDateString() createdTo?: string;
}
