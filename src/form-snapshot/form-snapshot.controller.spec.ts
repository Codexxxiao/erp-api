import { Test, TestingModule } from '@nestjs/testing';
import { FormSnapshotController } from './form-snapshot.controller';
import { FormSnapshotService } from './form-snapshot.service';

describe('FormSnapshotController', () => {
  let controller: FormSnapshotController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FormSnapshotController],
      providers: [FormSnapshotService],
    }).compile();

    controller = module.get<FormSnapshotController>(FormSnapshotController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
