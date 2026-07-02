import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, Length } from 'class-validator';

const normalizeCurrencyCode = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class QueryProfitOverviewDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @Transform(normalizeCurrencyCode)
  @IsString()
  @Length(3, 16)
  currencyCode?: string;

  @IsOptional()
  @Transform(normalizeCurrencyCode)
  @IsString()
  @Length(3, 16)
  targetCurrencyCode?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;
}
