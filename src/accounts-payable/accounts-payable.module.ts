// src/accounts-payable/accounts-payable.module.ts
import { Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { AccountsPayableController } from './accounts-payable.controller';
import { AccountsPayableService } from './accounts-payable.service';

@Module({
  imports: [FileModule],
  controllers: [AccountsPayableController],
  providers: [AccountsPayableService],
  exports: [AccountsPayableService],
})
export class AccountsPayableModule {}