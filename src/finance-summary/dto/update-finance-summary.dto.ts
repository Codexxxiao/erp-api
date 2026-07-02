import { PartialType } from '@nestjs/swagger';
import { CreateFinanceSummaryDto } from './create-finance-summary.dto';

export class UpdateFinanceSummaryDto extends PartialType(CreateFinanceSummaryDto) {}
