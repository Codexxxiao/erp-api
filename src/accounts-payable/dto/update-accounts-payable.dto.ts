// src/accounts-payable/dto/update-accounts-payable.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateAccountsPayableDto } from './create-accounts-payable.dto';
export class UpdateAccountsPayableDto extends PartialType(
  CreateAccountsPayableDto,
) {}
