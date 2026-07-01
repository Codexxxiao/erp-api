import { Test, TestingModule } from '@nestjs/testing';
import { InboundReceiptController } from './inbound-receipt.controller';
import { InboundReceiptService } from './inbound-receipt.service';

describe('InboundReceiptController', () => {
  let controller: InboundReceiptController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InboundReceiptController],
      providers: [InboundReceiptService],
    }).compile();

    controller = module.get<InboundReceiptController>(InboundReceiptController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
