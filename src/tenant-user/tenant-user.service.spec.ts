import { Test, TestingModule } from '@nestjs/testing';
import { TenantUserService } from './tenant-user.service';

describe('TenantUserService', () => {
  let service: TenantUserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantUserService],
    }).compile();

    service = module.get<TenantUserService>(TenantUserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
