import { IsOptional, IsString, MaxLength } from 'class-validator';

export class WorkflowTaskActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
