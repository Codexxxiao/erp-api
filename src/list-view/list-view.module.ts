import { Module } from '@nestjs/common';
import { ListViewController } from './list-view.controller';
import { ListViewService } from './list-view.service';

@Module({
  controllers: [ListViewController],
  providers: [ListViewService],
  exports: [ListViewService],
})
export class ListViewModule {}
