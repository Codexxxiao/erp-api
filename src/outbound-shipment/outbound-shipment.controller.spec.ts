import { Test, TestingModule } from '@nestjs/testing';
import { OutboundShipmentController } from './outbound-shipment.controller';
import { OutboundShipmentService } from './outbound-shipment.service';

describe('OutboundShipmentController', () => {
  let controller: OutboundShipmentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OutboundShipmentController],
      providers: [OutboundShipmentService],
    }).compile();

    controller = module.get<OutboundShipmentController>(OutboundShipmentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
