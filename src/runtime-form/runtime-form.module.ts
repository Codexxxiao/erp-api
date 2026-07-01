import { Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { RuntimeFormService } from './runtime-form.service';
import { RuntimeFormController } from './runtime-form.controller';

@Module({
  imports: [FileModule],
  controllers: [RuntimeFormController],
  providers: [RuntimeFormService],
  exports: [RuntimeFormService],
})
export class RuntimeFormModule {}
