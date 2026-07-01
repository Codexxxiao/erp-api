// src/supplier/supplier.module.ts
import { Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { SupplierController } from './supplier.controller';
import { SupplierService } from './supplier.service';

@Module({
  imports: [FileModule],
  controllers: [SupplierController],
  providers: [SupplierService],
  exports: [SupplierService],
})
export class SupplierModule {}
