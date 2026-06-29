import { Module } from '@nestjs/common';
import { PermissionModule } from '../permission/permission.module';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  imports: [PermissionModule],
  controllers: [MenuController],
  providers: [MenuService],
})
export class MenuModule {}
