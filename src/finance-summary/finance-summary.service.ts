import { Injectable } from '@nestjs/common';
import { CreateFinanceSummaryDto } from './dto/create-finance-summary.dto';
import { UpdateFinanceSummaryDto } from './dto/update-finance-summary.dto';

@Injectable()
export class FinanceSummaryService {
  create(createFinanceSummaryDto: CreateFinanceSummaryDto) {
    return 'This action adds a new financeSummary';
  }

  findAll() {
    return `This action returns all financeSummary`;
  }

  findOne(id: number) {
    return `This action returns a #${id} financeSummary`;
  }

  update(id: number, updateFinanceSummaryDto: UpdateFinanceSummaryDto) {
    return `This action updates a #${id} financeSummary`;
  }

  remove(id: number) {
    return `This action removes a #${id} financeSummary`;
  }
}
