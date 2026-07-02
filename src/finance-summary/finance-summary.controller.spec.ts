import { Test, TestingModule } from '@nestjs/testing';
import { FinanceSummaryController } from './finance-summary.controller';
import { FinanceSummaryService } from './finance-summary.service';

describe('FinanceSummaryController', () => {
  let controller: FinanceSummaryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinanceSummaryController],
      providers: [FinanceSummaryService],
    }).compile();

    controller = module.get<FinanceSummaryController>(FinanceSummaryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
