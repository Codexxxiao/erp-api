import { Test, TestingModule } from '@nestjs/testing';
import { PackageInstallService } from './package-install.service';

describe('PackageInstallService', () => {
  let service: PackageInstallService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PackageInstallService],
    }).compile();

    service = module.get<PackageInstallService>(PackageInstallService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
