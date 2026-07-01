import { Test, TestingModule } from '@nestjs/testing';
import { OutboundShipmentService } from './outbound-shipment.service';

describe('OutboundShipmentService', () => {
  let service: OutboundShipmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OutboundShipmentService],
    }).compile();

    service = module.get<OutboundShipmentService>(OutboundShipmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
