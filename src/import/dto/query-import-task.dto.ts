import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ImportTaskStatus } from '../../generated/prisma/client';

export class QueryImportTaskDto {
  @IsOptional()
  @IsString()
  formCode?: string;

  @IsOptional()
  @IsEnum(ImportTaskStatus)
  status?: ImportTaskStatus;

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
