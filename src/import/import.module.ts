import { Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { RuntimeFormModule } from '../runtime-form/runtime-form.module';
import { ImportTemplateModule } from '../import-template/import-template.module';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [FileModule, RuntimeFormModule, ImportTemplateModule],
  controllers: [ImportController],
  providers: [ImportService],
  exports: [ImportService],
})
export class ImportModule {}
