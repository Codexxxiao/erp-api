import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
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
  defaultValue?: unknown;
}

export class ValidateImportTaskDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportFieldMappingDto)
  mappings?: ImportFieldMappingDto[];

  @IsOptional()
  @IsBoolean()
  skipEmptyRows?: boolean = true;
}
