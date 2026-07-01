import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { InquiryItemInputDto } from './inquiry-item-input.dto';

export class ReplaceInquiryItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InquiryItemInputDto)
  items: InquiryItemInputDto[];
}
