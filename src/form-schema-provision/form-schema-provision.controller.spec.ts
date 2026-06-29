import { Test, TestingModule } from '@nestjs/testing';
import { FormSchemaProvisionController } from './form-schema-provision.controller';
import { FormSchemaProvisionService } from './form-schema-provision.service';

describe('FormSchemaProvisionController', () => {
  let controller: FormSchemaProvisionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FormSchemaProvisionController],
      providers: [FormSchemaProvisionService],
    }).compile();

    controller = module.get<FormSchemaProvisionController>(FormSchemaProvisionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
