import { Module } from '@nestjs/common';
import { DynamicQueryModule } from '../dynamic-query/dynamic-query.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [DynamicQueryModule],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
