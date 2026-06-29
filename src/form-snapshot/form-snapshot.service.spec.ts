import { Test, TestingModule } from '@nestjs/testing';
import { FormSnapshotService } from './form-snapshot.service';

describe('FormSnapshotService', () => {
  let service: FormSnapshotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FormSnapshotService],
    }).compile();

    service = module.get<FormSnapshotService>(FormSnapshotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
