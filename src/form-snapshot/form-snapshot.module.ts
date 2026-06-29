import { Module } from '@nestjs/common';
import { FormSnapshotController } from './form-snapshot.controller';
import { FormSnapshotService } from './form-snapshot.service';

@Module({
  controllers: [FormSnapshotController],
  providers: [FormSnapshotService],
  exports: [FormSnapshotService],
})
export class FormSnapshotModule {}
