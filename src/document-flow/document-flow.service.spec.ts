import { Test, TestingModule } from '@nestjs/testing';
import { DocumentFlowService } from './document-flow.service';

describe('DocumentFlowService', () => {
  let service: DocumentFlowService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DocumentFlowService],
    }).compile();

    service = module.get<DocumentFlowService>(DocumentFlowService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
