import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseRequirementService } from './purchase-requirement.service';

describe('PurchaseRequirementService', () => {
  let service: PurchaseRequirementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PurchaseRequirementService],
    }).compile();

    service = module.get<PurchaseRequirementService>(PurchaseRequirementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
