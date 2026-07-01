import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseRequirementController } from './purchase-requirement.controller';
import { PurchaseRequirementService } from './purchase-requirement.service';

describe('PurchaseRequirementController', () => {
  let controller: PurchaseRequirementController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PurchaseRequirementController],
      providers: [PurchaseRequirementService],
    }).compile();

    controller = module.get<PurchaseRequirementController>(PurchaseRequirementController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
