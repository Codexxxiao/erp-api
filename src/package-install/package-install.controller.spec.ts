import { Test, TestingModule } from '@nestjs/testing';
import { PackageInstallController } from './package-install.controller';
import { PackageInstallService } from './package-install.service';

describe('PackageInstallController', () => {
  let controller: PackageInstallController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PackageInstallController],
      providers: [PackageInstallService],
    }).compile();

    controller = module.get<PackageInstallController>(PackageInstallController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
