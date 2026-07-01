// src/supplier/dto/update-supplier-contact.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateSupplierContactDto } from './create-supplier-contact.dto';

export class UpdateSupplierContactDto extends PartialType(
  CreateSupplierContactDto,
) {}
