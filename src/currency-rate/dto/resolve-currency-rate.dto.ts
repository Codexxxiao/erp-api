import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

const normalizeCurrencyCode = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const normalizeBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return true;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};

export class ResolveCurrencyRateDto {
  @Transform(normalizeCurrencyCode)
  @IsString()
  @Length(3, 16)
  fromCurrencyCode: string;

  @Transform(normalizeCurrencyCode)
  @IsString()
  @Length(3, 16)
  toCurrencyCode: string;

  @IsOptional()
  @IsDateString()
  rateDate?: string;

  @IsOptional()
  @Transform(normalizeBoolean)
  @IsBoolean()
  allowInverse?: boolean = true;
}
