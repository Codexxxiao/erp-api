import { Test, TestingModule } from '@nestjs/testing';
import { ImportTemplateController } from './import-template.controller';
import { ImportTemplateService } from './import-template.service';

describe('ImportTemplateController', () => {
  let controller: ImportTemplateController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImportTemplateController],
      providers: [ImportTemplateService],
    }).compile();

    controller = module.get<ImportTemplateController>(ImportTemplateController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
