import { Test, TestingModule } from '@nestjs/testing';
import { DocumentFlowController } from './document-flow.controller';
import { DocumentFlowService } from './document-flow.service';

describe('DocumentFlowController', () => {
  let controller: DocumentFlowController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentFlowController],
      providers: [DocumentFlowService],
    }).compile();

    controller = module.get<DocumentFlowController>(DocumentFlowController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
