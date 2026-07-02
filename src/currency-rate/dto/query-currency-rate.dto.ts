import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import {
  CurrencyRateSource,
  CurrencyRateStatus,
} from '../../generated/prisma/client';

const normalizeCurrencyCode = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class QueryCurrencyRateDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 20;

  @IsOptional()
  @Transform(normalizeCurrencyCode)
  @IsString()
  @Length(3, 16)
  fromCurrencyCode?: string;

  @IsOptional()
  @Transform(normalizeCurrencyCode)
  @IsString()
  @Length(3, 16)
  toCurrencyCode?: string;

  @IsOptional()
  @IsEnum(CurrencyRateSource)
  source?: CurrencyRateSource;

  @IsOptional()
  @IsEnum(CurrencyRateStatus)
  status?: CurrencyRateStatus;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  keyword?: string;
}
