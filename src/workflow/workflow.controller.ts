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
import type { CurrentUser } from '../common/types/current-user';
import { CreateWorkflowDefinitionDto } from './dto/create-workflow-definition.dto';
import { UpdateWorkflowDefinitionDto } from './dto/update-workflow-definition.dto';
import { StartWorkflowDto } from './dto/start-workflow.dto';
import { WorkflowTaskActionDto } from './dto/workflow-task-action.dto';
import { WorkflowService } from './workflow.service';

@UseGuards(JwtAuthGuard, TenantMemberGuard, MustChangePasswordGuard)
@Controller('tenant/workflows')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @UseGuards(TenantAdminGuard)
  @Post()
  create(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: CreateWorkflowDefinitionDto,
  ) {
    return this.workflowService.createDefinition(user, dto);
  }

  @Get()
  findAll(@CurrentUserDecorator() user: CurrentUser) {
    return this.workflowService.findDefinitions(user);
  }

  @Get('tasks/pending')
  pendingTasks(@CurrentUserDecorator() user: CurrentUser) {
    return this.workflowService.findMyPendingTasks(user);
  }

  @Get('tasks/done')
  doneTasks(@CurrentUserDecorator() user: CurrentUser) {
    return this.workflowService.findMyDoneTasks(user);
  }

  @Post('start')
  start(
    @CurrentUserDecorator() user: CurrentUser,
    @Body() dto: StartWorkflowDto,
  ) {
    return this.workflowService.start(user, dto);
  }

  @Get('records/:recordId')
  recordWorkflows(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('recordId') recordId: string,
  ) {
    return this.workflowService.findRecordWorkflows(user, recordId);
  }

  @Get('instances/:id')
  instance(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.workflowService.findInstance(user, id);
  }

  @Post('instances/:id/cancel')
  cancelInstance(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: WorkflowTaskActionDto,
  ) {
    return this.workflowService.cancelInstance(user, id, dto);
  }

  @Post('tasks/:taskId/approve')
  approveTask(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('taskId') taskId: string,
    @Body() dto: WorkflowTaskActionDto,
  ) {
    return this.workflowService.approveTask(user, taskId, dto);
  }

  @Post('tasks/:taskId/reject')
  rejectTask(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('taskId') taskId: string,
    @Body() dto: WorkflowTaskActionDto,
  ) {
    return this.workflowService.rejectTask(user, taskId, dto);
  }

  @Get(':id')
  findOne(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.workflowService.findDefinition(user, id);
  }

  @UseGuards(TenantAdminGuard)
  @Patch(':id')
  update(
    @CurrentUserDecorator() user: CurrentUser,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDefinitionDto,
  ) {
    return this.workflowService.updateDefinition(user, id, dto);
  }

  @UseGuards(TenantAdminGuard)
  @Patch(':id/enable')
  enable(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.workflowService.enableDefinition(user, id);
  }

  @UseGuards(TenantAdminGuard)
  @Patch(':id/disable')
  disable(@CurrentUserDecorator() user: CurrentUser, @Param('id') id: string) {
    return this.workflowService.disableDefinition(user, id);
  }
}
