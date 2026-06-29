import { Type } from 'class-transformer';
import { IsArray, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { FormRecordDetailInputDto } from './create-form-record.dto';

export class UpdateFormRecordDto {
  @IsOptional()
  @IsObject()
  mainData?: Record<string, unknown>;

  // 传入 details 时，表示全量替换当前单据的所有附表数据
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormRecordDetailInputDto)
  details?: FormRecordDetailInputDto[];
}
