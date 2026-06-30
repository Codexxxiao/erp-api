import { Module } from '@nestjs/common';
import { DynamicQueryModule } from '../dynamic-query/dynamic-query.module';
import { ListViewController } from './list-view.controller';
import { ListViewService } from './list-view.service';

@Module({
  imports: [DynamicQueryModule],
  controllers: [ListViewController],
  providers: [ListViewService],
  exports: [ListViewService],
})
export class ListViewModule {}
