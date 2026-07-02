import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';
import { ResolveCurrencyRateDto } from './resolve-currency-rate.dto';

export class ConvertCurrencyDto extends ResolveCurrencyRateDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  amount: number;
}
