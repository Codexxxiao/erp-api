import { Module } from '@nestjs/common';
import { ImportTemplateController } from './import-template.controller';
import { ImportTemplateService } from './import-template.service';

@Module({
  controllers: [ImportTemplateController],
  providers: [ImportTemplateService],
  exports: [ImportTemplateService],
})
export class ImportTemplateModule {}
