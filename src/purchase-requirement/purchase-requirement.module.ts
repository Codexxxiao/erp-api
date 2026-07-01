// src/purchase-requirement/purchase-requirement.module.ts
import { Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { PurchaseRequirementController } from './purchase-requirement.controller';
import { PurchaseRequirementService } from './purchase-requirement.service';

@Module({
  imports: [FileModule],
  controllers: [PurchaseRequirementController],
  providers: [PurchaseRequirementService],
  exports: [PurchaseRequirementService],
})
export class PurchaseRequirementModule {}
