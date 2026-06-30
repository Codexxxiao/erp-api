import { Test, TestingModule } from '@nestjs/testing';
import { ListViewService } from './list-view.service';

describe('ListViewService', () => {
  let service: ListViewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ListViewService],
    }).compile();

    service = module.get<ListViewService>(ListViewService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
