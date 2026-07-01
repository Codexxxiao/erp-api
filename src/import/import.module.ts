import { Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { RuntimeFormModule } from '../runtime-form/runtime-form.module';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [FileModule, RuntimeFormModule],
  controllers: [ImportController],
  providers: [ImportService],
  exports: [ImportService],
})
export class ImportModule {}
