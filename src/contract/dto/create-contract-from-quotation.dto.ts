// src/contract/dto/create-contract-from-quotation.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateContractDto } from './create-contract.dto';

export class CreateContractFromQuotationDto extends PartialType(
  CreateContractDto,
) {}
