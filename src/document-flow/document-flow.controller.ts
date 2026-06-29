import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt/jwt.guard';
import { TenantAdminGuard } from '../common/guards/tenant-admin.guard';
import { TenantMemberGuard } from '../common/guards/tenant-member.guard';
import { MustChangePasswordGuard } from '../common/guards/must-change-password.guard';
import { CurrentUserDecorator } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/types/current-user.type';
import { CreateDocumentFlowDto } from './dto/create-document-flow.dto';
import { UpdateDocumentFlowDto } from './dto/update-document-flow.dto';
import { ExecuteDocumentFlowDto } from './dto/execute-document-flow.dto';
import { DocumentFlowService } from './document-flow.service';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/document-flows')
export class DocumentFlowController {
  constructor(private readonly documentFlowService: DocumentFlowService) {}

  @UseGuards(TenantAdminGuard)
  @Post()
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateDocumentFlowDto,
  ) {
    return this.documentFlowService.create(user, dto);
  }

  @Get()
  findAll(@CurrentUserDecorator() user: CurrentUser) {
    return this.documentFlowService.findAll(user);
  }

  @Get(':id')
  findOne(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.documentFlowService.findOne(user, id);
  }

  @UseGuards(TenantAdminGuard)
  @Patch(':id')
  update(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentFlowDto,
  ) {
    return this.documentFlowService.update(user, id, dto);
  }

  @UseGuards(TenantAdminGuard)
  @Patch(':id/enable')
  enable(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.documentFlowService.enable(user, id);
  }

  @UseGuards(TenantAdminGuard)
  @Patch(':id/disable')
  disable(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.documentFlowService.disable(user, id);
  }

  @Post(':id/execute')
  execute(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: ExecuteDocumentFlowDto,
  ) {
    return this.documentFlowService.execute(user, id, dto);
  }

  @Get(':id/executions')
  executions(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
  ) {
    return this.documentFlowService.findExecutions(user, id);
  }
}
