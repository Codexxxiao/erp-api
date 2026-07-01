import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class ImportTemplateMappingDto {
  @IsOptional()
  @IsString()
  header?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @IsString()
  fieldCode: string;

  @IsOptional()
  defaultValue?: unknown;
}
