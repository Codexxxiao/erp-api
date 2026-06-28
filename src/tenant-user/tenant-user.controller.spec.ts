import { Test, TestingModule } from '@nestjs/testing';
import { TenantUserController } from './tenant-user.controller';
import { TenantUserService } from './tenant-user.service';

describe('TenantUserController', () => {
  let controller: TenantUserController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantUserController],
      providers: [TenantUserService],
    }).compile();

    controller = module.get<TenantUserController>(TenantUserController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
