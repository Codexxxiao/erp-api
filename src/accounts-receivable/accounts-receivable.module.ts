// src/accounts-receivable/accounts-receivable.module.ts
import { Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { AccountsReceivableController } from './accounts-receivable.controller';
import { AccountsReceivableService } from './accounts-receivable.service';

@Module({
  imports: [FileModule],
  controllers: [AccountsReceivableController],
  providers: [AccountsReceivableService],
  exports: [AccountsReceivableService],
})
export class AccountsReceivableModule {}
