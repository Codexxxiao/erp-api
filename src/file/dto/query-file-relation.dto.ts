import { IsOptional, IsString } from 'class-validator';

export class QueryFileRelationDto {
  @IsString()
  ownerType: string;

  @IsString()
  ownerId: string;

  @IsOptional()
  @IsString()
  fieldCode?: string;
}
