import { Test, TestingModule } from '@nestjs/testing';
import { ListViewController } from './list-view.controller';
import { ListViewService } from './list-view.service';

describe('ListViewController', () => {
  let controller: ListViewController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListViewController],
      providers: [ListViewService],
    }).compile();

    controller = module.get<ListViewController>(ListViewController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
