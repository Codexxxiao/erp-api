import { Test, TestingModule } from '@nestjs/testing';
import { CurrencyRateController } from './currency-rate.controller';
import { CurrencyRateService } from './currency-rate.service';

describe('CurrencyRateController', () => {
  let controller: CurrencyRateController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CurrencyRateController],
      providers: [CurrencyRateService],
    }).compile();

    controller = module.get<CurrencyRateController>(CurrencyRateController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
