import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateFileRelationDto {
  @IsString()
  ownerType: string;

  @IsString()
  ownerId: string;

  @IsOptional()
  @IsString()
  fieldCode?: string;

  @IsOptional()
  @IsString()
  relationName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort?: number;

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;
}
