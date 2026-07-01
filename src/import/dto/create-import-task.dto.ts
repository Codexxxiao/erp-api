import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateImportTaskDto {
  @IsString()
  fileId: string;

  @IsOptional()
  @IsString()
  formId?: string;

  @IsString()
  formCode: string;

  @IsOptional()
  @IsString()
  sheetName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  headerRow?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dataStartRow?: number = 2;
}
