import { Module } from '@nestjs/common';
import { MetadataService } from './metadata.service';
import { AdminMetadataController } from './admin-metadata.controller';
import { TenantMetadataController } from './tenant-metadata.controller';

@Module({
  controllers: [AdminMetadataController, TenantMetadataController],
  providers: [MetadataService],
  exports: [MetadataService],
})
export class MetadataModule {}
