import { Test, TestingModule } from '@nestjs/testing';
import { RuntimeFormController } from './runtime-form.controller';
import { RuntimeFormService } from './runtime-form.service';

describe('RuntimeFormController', () => {
  let controller: RuntimeFormController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RuntimeFormController],
      providers: [RuntimeFormService],
    }).compile();

    controller = module.get<RuntimeFormController>(RuntimeFormController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
