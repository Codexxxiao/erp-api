import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateCurrencyRateDto } from './create-currency-rate.dto';

export class BulkUpsertCurrencyRateDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCurrencyRateDto)
  items: CreateCurrencyRateDto[];
}
