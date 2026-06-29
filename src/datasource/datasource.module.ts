import { Module } from '@nestjs/common';
import { DictionaryModule } from '../dictionary/dictionary.module';
import { DatasourceService } from './datasource.service';
import { AdminDatasourceController } from './admin-datasource.controller';
import { TenantDatasourceController } from './tenant-datasource.controller';

@Module({
  imports: [DictionaryModule],
  controllers: [AdminDatasourceController, TenantDatasourceController],
  providers: [DatasourceService],
  exports: [DatasourceService],
})
export class DatasourceModule {}
