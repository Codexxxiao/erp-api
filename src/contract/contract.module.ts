// src/contract/contract.module.ts
import { Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { ContractController } from './contract.controller';
import { ContractService } from './contract.service';

@Module({
  imports: [FileModule],
  controllers: [ContractController],
  providers: [ContractService],
  exports: [ContractService],
})
export class ContractModule {}
