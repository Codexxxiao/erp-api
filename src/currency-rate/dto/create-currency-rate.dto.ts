import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import {
  CurrencyRateSource,
  CurrencyRateStatus,
} from '../../generated/prisma/client';

const normalizeCurrencyCode = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateCurrencyRateDto {
  @Transform(normalizeCurrencyCode)
  @IsString()
  @Length(3, 16)
  fromCurrencyCode: string;

  @Transform(normalizeCurrencyCode)
  @IsString()
  @Length(3, 16)
  toCurrencyCode: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 12 })
  @Min(0.000000000001)
  rate: number;

  @IsDateString()
  rateDate: string;

  @IsOptional()
  @IsEnum(CurrencyRateSource)
  source?: CurrencyRateSource;

  @IsOptional()
  @IsEnum(CurrencyRateStatus)
  status?: CurrencyRateStatus;

  @IsOptional()
  @IsString()
  remark?: string;
}
