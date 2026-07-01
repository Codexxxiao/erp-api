import { Test, TestingModule } from '@nestjs/testing';
import { InboundReceiptService } from './inbound-receipt.service';

describe('InboundReceiptService', () => {
  let service: InboundReceiptService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InboundReceiptService],
    }).compile();

    service = module.get<InboundReceiptService>(InboundReceiptService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
