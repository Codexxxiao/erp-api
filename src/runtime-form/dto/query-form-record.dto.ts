import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { FormRecordStatus } from '../../generated/prisma/client';

export class QueryFormRecordDto {
  @IsOptional()
  @IsString()
  formCode?: string;

  @IsOptional()
  @IsEnum(FormRecordStatus)
  status?: FormRecordStatus;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
