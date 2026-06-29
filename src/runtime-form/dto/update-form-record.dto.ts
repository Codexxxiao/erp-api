import { Type } from 'class-transformer';
import { IsArray, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { FormRecordDetailInputDto } from './create-form-record.dto';

export class UpdateFormRecordDto {
  @IsOptional()
  @IsObject()
  mainData?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormRecordDetailInputDto)
  details?: FormRecordDetailInputDto[];
}
