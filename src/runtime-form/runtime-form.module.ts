import { Module } from '@nestjs/common';
import { RuntimeFormService } from './runtime-form.service';
import { RuntimeFormController } from './runtime-form.controller';

@Module({
  controllers: [RuntimeFormController],
  providers: [RuntimeFormService],
  exports: [RuntimeFormService],
})
export class RuntimeFormModule {}
