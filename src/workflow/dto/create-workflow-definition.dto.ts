import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  WorkflowApproveMode,
  WorkflowApproverType,
  WorkflowNodeType,
} from '../../generated/prisma/client';

export class WorkflowNodeDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsEnum(WorkflowNodeType)
  type: WorkflowNodeType;

  @IsOptional()
  @IsEnum(WorkflowApproverType)
  approverType?: WorkflowApproverType;

  @IsOptional()
  @IsString()
  approverUserId?: string;

  @IsOptional()
  @IsString()
  approverRoleId?: string;

  @IsOptional()
  @IsEnum(WorkflowApproveMode)
  approveMode?: WorkflowApproveMode;

  @IsOptional()
  @IsInt()
  sort?: number;

  @IsOptional()
  config?: unknown;
}

export class WorkflowTransitionDto {
  @IsString()
  sourceNodeCode: string;

  @IsString()
  targetNodeCode: string;

  @IsOptional()
  condition?: unknown;

  @IsOptional()
  @IsInt()
  sort?: number;
}

export class CreateWorkflowDefinitionDto {
  @IsString()
  @MaxLength(64)
  code: string;

  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  formId: string;

  @IsOptional()
  @IsString()
  formVersionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  config?: unknown;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowNodeDto)
  nodes: WorkflowNodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowTransitionDto)
  transitions: WorkflowTransitionDto[];
}
