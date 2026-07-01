// src/accounts-receivable/dto/update-ar-payment.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateArPaymentDto } from './create-ar-payment.dto';

export class UpdateArPaymentDto extends PartialType(CreateArPaymentDto) {}
