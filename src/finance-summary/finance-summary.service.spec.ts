import { Test, TestingModule } from '@nestjs/testing';
import { FinanceSummaryService } from './finance-summary.service';

describe('FinanceSummaryService', () => {
  let service: FinanceSummaryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FinanceSummaryService],
    }).compile();

    service = module.get<FinanceSummaryService>(FinanceSummaryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
