import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ExecuteDocumentFlowDto {
  @IsString()
  sourceRecordId: string;

  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}
