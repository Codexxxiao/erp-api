import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class FormRecordDetailInputDto {
  @IsString()
  tableCode: string;

  @IsArray()
  @IsObject({ each: true })
  rows: Record<string, unknown>[];
}

export class CreateFormRecordDto {
  @IsOptional()
  @IsString()
  formId?: string;

  @IsOptional()
  @IsString()
  formCode?: string;

  @IsObject()
  mainData: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormRecordDetailInputDto)
  details?: FormRecordDetailInputDto[];

  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}
