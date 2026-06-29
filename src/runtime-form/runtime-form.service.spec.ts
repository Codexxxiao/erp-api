import { Test, TestingModule } from '@nestjs/testing';
import { RuntimeFormService } from './runtime-form.service';

describe('RuntimeFormService', () => {
  let service: RuntimeFormService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RuntimeFormService],
    }).compile();

    service = module.get<RuntimeFormService>(RuntimeFormService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
