import { IsOptional, IsString } from 'class-validator';

export class StartWorkflowDto {
  @IsString()
  recordId: string;

  @IsOptional()
  @IsString()
  definitionId?: string;
}
