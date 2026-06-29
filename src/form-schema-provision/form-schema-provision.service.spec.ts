import { Test, TestingModule } from '@nestjs/testing';
import { FormSchemaProvisionService } from './form-schema-provision.service';

describe('FormSchemaProvisionService', () => {
  let service: FormSchemaProvisionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FormSchemaProvisionService],
    }).compile();

    service = module.get<FormSchemaProvisionService>(FormSchemaProvisionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
