import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ImportFieldMappingDto {
  @IsString()
  header: string;

  @IsString()
  fieldCode: string;

  @IsOptional()
  @IsObject()
  defaultValue?: unknown;
}

export class ValidateImportTaskDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportFieldMappingDto)
  mappings: ImportFieldMappingDto[];

  @IsOptional()
  @IsBoolean()
  skipEmptyRows?: boolean = true;
}
