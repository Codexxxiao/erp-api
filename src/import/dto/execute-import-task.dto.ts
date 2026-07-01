import { IsBoolean, IsOptional } from 'class-validator';

export class ExecuteImportTaskDto {
  @IsOptional()
  @IsBoolean()
  submit?: boolean = false;
}
