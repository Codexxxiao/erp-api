import { Module } from '@nestjs/common';
import { FileModule } from '../file/file.module';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({
  imports: [FileModule],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
