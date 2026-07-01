import { IsArray, IsOptional, IsString } from 'class-validator';

export class ImportTemplateMappingDto {
  @IsOptional()
  @IsString()
  header?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  // main 表示主表；附表使用真实 tableCode，例如 items
  @IsOptional()
  @IsString()
  tableCode?: string;

  @IsString()
  fieldCode: string;

  @IsOptional()
  defaultValue?: unknown;
}
