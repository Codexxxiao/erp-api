import { Module } from '@nestjs/common';
import { DictionaryService } from './dictionary.service';
import { AdminDictionaryController } from './admin-dictionary.controller';
import { TenantDictionaryController } from './tenant-dictionary.controller';

@Module({
  controllers: [AdminDictionaryController, TenantDictionaryController],
  providers: [DictionaryService],
  exports: [DictionaryService],
})
export class DictionaryModule {}
