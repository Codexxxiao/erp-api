import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FormRecordStatus,
  Prisma,
  WorkflowActionType,
  WorkflowApproveMode,
  WorkflowApproverType,
  WorkflowDefinitionStatus,
  WorkflowInstanceStatus,
  WorkflowNodeType,
  WorkflowTaskStatus,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import {
  CreateWorkflowDefinitionDto,
  WorkflowNodeDto,
  WorkflowTransitionDto,
} from './dto/create-workflow-definition.dto';
import { UpdateWorkflowDefinitionDto } from './dto/update-workflow-definition.dto';
import { StartWorkflowDto } from './dto/start-workflow.dto';
import { WorkflowTaskActionDto } from './dto/workflow-task-action.dto';

type WorkflowGraph = Prisma.WorkflowDefinitionGetPayload<{
  include: { nodes: true; transitions: true };
}>;

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async createDefinition(user: CurrentUser, dto: CreateWorkflowDefinitionDto) {
    const tenantId = requireTenantId(user);
    await this.assertForm(tenantId, dto.formId, dto.formVersionId);
    this.validateDefinitionDto(dto.nodes, dto.transitions);

    return this.prisma.$transaction(async (tx) => {
      const definition = await tx.workflowDefinition.create({
        data: {
          tenantId,
          code: dto.code,
          name: dto.name,
          formId: dto.formId,
          formVersionId: dto.formVersionId,
          description: dto.description,
          config: dto.config as Prisma.InputJsonValue,
        },
      });

      const nodeMap = new Map<string, string>();

      for (const node of dto.nodes) {
        const created = await tx.workflowNode.create({
          data: {
            definitionId: definition.id,
            code: node.code,
            name: node.name,
            type: node.type,
            approverType: node.approverType,
            approverUserId: node.approverUserId,
            approverRoleId: node.approverRoleId,
            approveMode: node.approveMode ?? WorkflowApproveMode.ANY,
            sort: node.sort ?? 0,
            config: node.config as Prisma.InputJsonValue,
          },
        });

        nodeMap.set(node.code, created.id);
      }

      for (const transition of dto.transitions) {
        await tx.workflowTransition.create({
          data: {
            definitionId: definition.id,
            sourceNodeId: nodeMap.get(transition.sourceNodeCode)!,
            targetNodeId: nodeMap.get(transition.targetNodeCode)!,
            condition: transition.condition as Prisma.InputJsonValue,
            sort: transition.sort ?? 0,
          },
        });
      }

      return tx.workflowDefinition.findUnique({
        where: { id: definition.id },
        include: {
          nodes: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] },
          transitions: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] },
        },
      });
    });
  }

  async findDefinitions(user: CurrentUser) {
    const tenantId = requireTenantId(user);

    return this.prisma.workflowDefinition.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        nodes: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] },
        transitions: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] },
      },
    });
  }

  async findDefinition(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    return this.findDefinitionOrThrow(tenantId, id);
  }

  async updateDefinition(
    user: CurrentUser,
    id: string,
    dto: UpdateWorkflowDefinitionDto,
  ) {
    const tenantId = requireTenantId(user);
    const existed = await this.findDefinitionOrThrow(tenantId, id);

    const instanceCount = await this.prisma.workflowInstance.count({
      where: { definitionId: id },
    });

    if (instanceCount > 0) {
      throw new BadRequestException(
        '已有流程实例的流程定义不允许修改，请新建流程定义',
      );
    }

    if (dto.formId)
      await this.assertForm(tenantId, dto.formId, dto.formVersionId);
    if (dto.nodes && dto.transitions)
      this.validateDefinitionDto(dto.nodes, dto.transitions);

    return this.prisma.$transaction(async (tx) => {
      await tx.workflowTransition.deleteMany({ where: { definitionId: id } });
      await tx.workflowNode.deleteMany({ where: { definitionId: id } });

      const definition = await tx.workflowDefinition.update({
        where: { id },
        data: {
          code: dto.code,
          name: dto.name,
          formId: dto.formId,
          formVersionId: dto.formVersionId,
          description: dto.description,
          config: dto.config as Prisma.InputJsonValue,
          status: WorkflowDefinitionStatus.DRAFT,
        },
      });

      const nodes = dto.nodes ?? existed.nodes;
      const transitions = dto.transitions ?? [];

      const nodeMap = new Map<string, string>();

      for (const node of nodes) {
        const created = await tx.workflowNode.create({
          data: {
            definitionId: id,
            code: node.code,
            name: node.name,
            type: node.type,
            approverType: node.approverType,
            approverUserId: node.approverUserId,
            approverRoleId: node.approverRoleId,
            approveMode: node.approveMode ?? WorkflowApproveMode.ANY,
            sort: node.sort ?? 0,
            config: node.config as Prisma.InputJsonValue,
          },
        });
        nodeMap.set(node.code, created.id);
      }

      for (const transition of transitions) {
        await tx.workflowTransition.create({
          data: {
            definitionId: id,
            sourceNodeId: nodeMap.get(transition.sourceNodeCode)!,
            targetNodeId: nodeMap.get(transition.targetNodeCode)!,
            condition: transition.condition as Prisma.InputJsonValue,
            sort: transition.sort ?? 0,
          },
        });
      }

      return tx.workflowDefinition.findUnique({
        where: { id: definition.id },
        include: { nodes: true, transitions: true },
      });
    });
  }

  async enableDefinition(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    const definition = await this.findDefinitionOrThrow(tenantId, id);
    this.validateGraph(definition);

    return this.prisma.workflowDefinition.update({
      where: { id },
      data: { status: WorkflowDefinitionStatus.ENABLED },
      include: { nodes: true, transitions: true },
    });
  }

  async disableDefinition(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    await this.findDefinitionOrThrow(tenantId, id);

    return this.prisma.workflowDefinition.update({
      where: { id },
      data: { status: WorkflowDefinitionStatus.DISABLED },
      include: { nodes: true, transitions: true },
    });
  }

  async start(user: CurrentUser, dto: StartWorkflowDto) {
    const tenantId = requireTenantId(user);

    const record = await this.prisma.formRecord.findFirst({
      where: { id: dto.recordId, tenantId },
    });
    if (!record) throw new NotFoundException('单据不存在');

    if (record.status !== FormRecordStatus.DRAFT) {
      throw new BadRequestException('只有草稿单据可以发起审批');
    }

    const definition = dto.definitionId
      ? await this.findDefinitionOrThrow(tenantId, dto.definitionId)
      : await this.findEnabledDefinitionForRecord(
          tenantId,
          record.formId,
          record.formVersionId,
        );

    if (definition.status !== WorkflowDefinitionStatus.ENABLED) {
      throw new BadRequestException('流程定义未启用');
    }

    const startNode = definition.nodes.find(
      (node) => node.type === WorkflowNodeType.START,
    );
    if (!startNode) throw new BadRequestException('流程缺少开始节点');

    return this.prisma.$transaction(async (tx) => {
      const active = await tx.workflowInstance.findFirst({
        where: {
          tenantId,
          recordId: record.id,
          status: WorkflowInstanceStatus.RUNNING,
        },
      });

      if (active) throw new BadRequestException('该单据已有运行中的审批流程');

      await tx.formRecord.update({
        where: { id: record.id },
        data: {
          status: FormRecordStatus.SUBMITTED,
          updatedById: user.id,
        },
      });

      const instance = await tx.workflowInstance.create({
        data: {
          tenantId,
          definitionId: definition.id,
          formId: record.formId,
          formVersionId: record.formVersionId,
          recordId: record.id,
          activeKey: record.id,
          status: WorkflowInstanceStatus.RUNNING,
          currentNodeId: startNode.id,
          startedById: user.id,
        },
      });

      await this.log(tx, {
        tenantId,
        instanceId: instance.id,
        nodeId: startNode.id,
        action: WorkflowActionType.START,
        userId: user.id,
      });

      await this.advanceFromNode(tx, {
        tenantId,
        userId: user.id,
        instanceId: instance.id,
        recordId: record.id,
        graph: definition,
        sourceNodeId: startNode.id,
      });

      return tx.workflowInstance.findUnique({
        where: { id: instance.id },
        include: {
          definition: true,
          currentNode: true,
          tasks: { orderBy: { createdAt: 'asc' } },
          logs: { orderBy: { createdAt: 'asc' } },
        },
      });
    });
  }

  async approveTask(
    user: CurrentUser,
    taskId: string,
    dto: WorkflowTaskActionDto,
  ) {
    const tenantId = requireTenantId(user);

    const task = await this.prisma.workflowTask.findFirst({
      where: {
        id: taskId,
        tenantId,
        assigneeUserId: user.id,
        status: WorkflowTaskStatus.PENDING,
      },
      include: { instance: true, node: true },
    });

    if (!task) throw new NotFoundException('待办任务不存在');

    const graph = await this.findDefinitionOrThrow(
      tenantId,
      task.instance.definitionId,
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.workflowTask.update({
        where: { id: task.id },
        data: {
          status: WorkflowTaskStatus.APPROVED,
          comment: dto.comment,
          actedAt: new Date(),
        },
      });

      await this.log(tx, {
        tenantId,
        instanceId: task.instanceId,
        taskId: task.id,
        nodeId: task.nodeId,
        action: WorkflowActionType.APPROVE,
        userId: user.id,
        comment: dto.comment,
      });

      if (task.node.approveMode === WorkflowApproveMode.ALL) {
        const pending = await tx.workflowTask.count({
          where: {
            tenantId,
            instanceId: task.instanceId,
            nodeId: task.nodeId,
            status: WorkflowTaskStatus.PENDING,
          },
        });

        if (pending > 0) {
          return tx.workflowInstance.findUnique({
            where: { id: task.instanceId },
            include: { currentNode: true, tasks: true, logs: true },
          });
        }
      } else {
        await tx.workflowTask.updateMany({
          where: {
            tenantId,
            instanceId: task.instanceId,
            nodeId: task.nodeId,
            status: WorkflowTaskStatus.PENDING,
          },
          data: { status: WorkflowTaskStatus.CANCELED },
        });
      }

      await this.advanceFromNode(tx, {
        tenantId,
        userId: user.id,
        instanceId: task.instanceId,
        recordId: task.instance.recordId,
        graph,
        sourceNodeId: task.nodeId,
      });

      return tx.workflowInstance.findUnique({
        where: { id: task.instanceId },
        include: {
          definition: true,
          currentNode: true,
          tasks: { orderBy: { createdAt: 'asc' } },
          logs: { orderBy: { createdAt: 'asc' } },
        },
      });
    });
  }

  async rejectTask(
    user: CurrentUser,
    taskId: string,
    dto: WorkflowTaskActionDto,
  ) {
    const tenantId = requireTenantId(user);

    const task = await this.prisma.workflowTask.findFirst({
      where: {
        id: taskId,
        tenantId,
        assigneeUserId: user.id,
        status: WorkflowTaskStatus.PENDING,
      },
      include: { instance: true },
    });

    if (!task) throw new NotFoundException('待办任务不存在');

    return this.prisma.$transaction(async (tx) => {
      await tx.workflowTask.update({
        where: { id: task.id },
        data: {
          status: WorkflowTaskStatus.REJECTED,
          comment: dto.comment,
          actedAt: new Date(),
        },
      });

      await tx.workflowTask.updateMany({
        where: {
          tenantId,
          instanceId: task.instanceId,
          status: WorkflowTaskStatus.PENDING,
        },
        data: { status: WorkflowTaskStatus.CANCELED },
      });

      await tx.workflowInstance.update({
        where: { id: task.instanceId },
        data: {
          status: WorkflowInstanceStatus.REJECTED,
          activeKey: null,
          endedAt: new Date(),
        },
      });

      await tx.formRecord.update({
        where: { id: task.instance.recordId },
        data: {
          status: FormRecordStatus.DRAFT,
          updatedById: user.id,
        },
      });

      await this.log(tx, {
        tenantId,
        instanceId: task.instanceId,
        taskId: task.id,
        nodeId: task.nodeId,
        action: WorkflowActionType.REJECT,
        userId: user.id,
        comment: dto.comment,
      });

      return tx.workflowInstance.findUnique({
        where: { id: task.instanceId },
        include: { currentNode: true, tasks: true, logs: true },
      });
    });
  }

  async cancelInstance(
    user: CurrentUser,
    id: string,
    dto: WorkflowTaskActionDto,
  ) {
    const tenantId = requireTenantId(user);

    const instance = await this.prisma.workflowInstance.findFirst({
      where: { id, tenantId, status: WorkflowInstanceStatus.RUNNING },
    });

    if (!instance) throw new NotFoundException('运行中的流程实例不存在');

    if (!user.isTenantAdmin && instance.startedById !== user.id) {
      throw new ForbiddenException('只有发起人或租户管理员可以撤回流程');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.workflowTask.updateMany({
        where: { tenantId, instanceId: id, status: WorkflowTaskStatus.PENDING },
        data: { status: WorkflowTaskStatus.CANCELED },
      });

      await tx.workflowInstance.update({
        where: { id },
        data: {
          status: WorkflowInstanceStatus.CANCELED,
          activeKey: null,
          endedAt: new Date(),
        },
      });

      await tx.formRecord.update({
        where: { id: instance.recordId },
        data: {
          status: FormRecordStatus.DRAFT,
          updatedById: user.id,
        },
      });

      await this.log(tx, {
        tenantId,
        instanceId: id,
        nodeId: instance.currentNodeId ?? undefined,
        action: WorkflowActionType.CANCEL,
        userId: user.id,
        comment: dto.comment,
      });

      return tx.workflowInstance.findUnique({
        where: { id },
        include: { currentNode: true, tasks: true, logs: true },
      });
    });
  }

  async findMyPendingTasks(user: CurrentUser) {
    const tenantId = requireTenantId(user);

    return this.prisma.workflowTask.findMany({
      where: {
        tenantId,
        assigneeUserId: user.id,
        status: WorkflowTaskStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        node: true,
        instance: { include: { definition: true } },
      },
    });
  }

  async findMyDoneTasks(user: CurrentUser) {
    const tenantId = requireTenantId(user);

    return this.prisma.workflowTask.findMany({
      where: {
        tenantId,
        assigneeUserId: user.id,
        status: {
          in: [WorkflowTaskStatus.APPROVED, WorkflowTaskStatus.REJECTED],
        },
      },
      orderBy: { actedAt: 'desc' },
      include: {
        node: true,
        instance: { include: { definition: true } },
      },
    });
  }

  async findInstance(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const instance = await this.prisma.workflowInstance.findFirst({
      where: { id, tenantId },
      include: {
        definition: true,
        currentNode: true,
        tasks: { orderBy: { createdAt: 'asc' } },
        logs: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!instance) throw new NotFoundException('流程实例不存在');
    return instance;
  }

  async findRecordWorkflows(user: CurrentUser, recordId: string) {
    const tenantId = requireTenantId(user);

    return this.prisma.workflowInstance.findMany({
      where: { tenantId, recordId },
      orderBy: { createdAt: 'desc' },
      include: {
        definition: true,
        currentNode: true,
        tasks: { orderBy: { createdAt: 'asc' } },
        logs: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  private async advanceFromNode(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      userId: string;
      instanceId: string;
      recordId: string;
      graph: WorkflowGraph;
      sourceNodeId: string;
    },
  ) {
    const transition = params.graph.transitions
      .filter((item) => item.sourceNodeId === params.sourceNodeId)
      .sort((a, b) => a.sort - b.sort)[0];

    if (!transition) {
      await this.finishApproved(tx, params);
      return;
    }

    const targetNode = params.graph.nodes.find(
      (node) => node.id === transition.targetNodeId,
    );
    if (!targetNode) throw new BadRequestException('流程节点配置错误');

    if (targetNode.type === WorkflowNodeType.END) {
      await this.finishApproved(tx, { ...params, endNodeId: targetNode.id });
      return;
    }

    if (targetNode.type !== WorkflowNodeType.APPROVAL) {
      throw new BadRequestException('开始节点之后只能流转到审批节点或结束节点');
    }

    const assigneeIds = await this.resolveAssignees(
      tx,
      params.tenantId,
      targetNode,
    );

    await tx.workflowInstance.update({
      where: { id: params.instanceId },
      data: { currentNodeId: targetNode.id },
    });

    await tx.workflowTask.createMany({
      data: assigneeIds.map((assigneeUserId) => ({
        tenantId: params.tenantId,
        instanceId: params.instanceId,
        nodeId: targetNode.id,
        assigneeUserId,
      })),
    });
  }

  private async finishApproved(
    tx: Prisma.TransactionClient,
    params: {
      tenantId: string;
      userId: string;
      instanceId: string;
      recordId: string;
      endNodeId?: string;
    },
  ) {
    await tx.workflowInstance.update({
      where: { id: params.instanceId },
      data: {
        status: WorkflowInstanceStatus.APPROVED,
        activeKey: null,
        currentNodeId: params.endNodeId,
        endedAt: new Date(),
      },
    });

    await tx.formRecord.update({
      where: { id: params.recordId },
      data: {
        status: FormRecordStatus.SUBMITTED,
        updatedById: params.userId,
      },
    });
  }

  private async resolveAssignees(
    tx: Prisma.TransactionClient,
    tenantId: string,
    node: {
      approverType: WorkflowApproverType | null;
      approverUserId: string | null;
      approverRoleId: string | null;
    },
  ) {
    if (node.approverType === WorkflowApproverType.USER) {
      if (!node.approverUserId)
        throw new BadRequestException('审批节点未配置审批人');

      const user = await tx.user.findFirst({
        where: { id: node.approverUserId, tenantId, isActive: true },
      });
      if (!user) throw new BadRequestException('审批人不存在或已停用');

      return [user.id];
    }

    if (node.approverType === WorkflowApproverType.ROLE) {
      if (!node.approverRoleId)
        throw new BadRequestException('审批节点未配置审批角色');

      const userRoles = await tx.userRole.findMany({
        where: {
          roleId: node.approverRoleId,
          role: { tenantId, isActive: true },
          user: { tenantId, isActive: true },
        },
        include: { user: true },
      });

      const userIds = userRoles.map((item) => item.user.id);
      if (userIds.length === 0)
        throw new BadRequestException('审批角色下没有可用用户');

      return userIds;
    }

    if (node.approverType === WorkflowApproverType.TENANT_ADMIN) {
      const users = await tx.user.findMany({
        where: { tenantId, isTenantAdmin: true, isActive: true },
      });

      if (users.length === 0)
        throw new BadRequestException('租户暂无可用管理员');
      return users.map((item) => item.id);
    }

    throw new BadRequestException('审批节点未配置审批人类型');
  }

  private async findEnabledDefinitionForRecord(
    tenantId: string,
    formId: string,
    formVersionId?: string | null,
  ) {
    const definition = await this.prisma.workflowDefinition.findFirst({
      where: {
        tenantId,
        formId,
        status: WorkflowDefinitionStatus.ENABLED,
        OR: [{ formVersionId }, { formVersionId: null }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        nodes: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] },
        transitions: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] },
      },
    });

    if (!definition) throw new BadRequestException('当前单据没有可用审批流程');
    return definition;
  }

  private async findDefinitionOrThrow(tenantId: string, id: string) {
    const definition = await this.prisma.workflowDefinition.findFirst({
      where: { id, tenantId },
      include: {
        nodes: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] },
        transitions: { orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] },
      },
    });

    if (!definition) throw new NotFoundException('流程定义不存在');
    return definition;
  }

  private async assertForm(
    tenantId: string,
    formId: string,
    formVersionId?: string,
  ) {
    const form = await this.prisma.formDefinition.findFirst({
      where: { id: formId, tenantId },
    });
    if (!form) throw new BadRequestException('表单不存在');

    if (formVersionId) {
      const version = await this.prisma.formVersion.findFirst({
        where: { id: formVersionId, tenantId, formId },
      });
      if (!version) throw new BadRequestException('表单版本不存在');
    }
  }

  private validateDefinitionDto(
    nodes: WorkflowNodeDto[],
    transitions: WorkflowTransitionDto[],
  ) {
    const startCount = nodes.filter(
      (node) => node.type === WorkflowNodeType.START,
    ).length;
    const endCount = nodes.filter(
      (node) => node.type === WorkflowNodeType.END,
    ).length;

    if (startCount !== 1)
      throw new BadRequestException('流程必须且只能有一个开始节点');
    if (endCount !== 1)
      throw new BadRequestException('流程必须且只能有一个结束节点');

    const nodeCodes = new Set<string>();
    for (const node of nodes) {
      if (nodeCodes.has(node.code))
        throw new BadRequestException(`节点编码重复：${node.code}`);
      nodeCodes.add(node.code);

      if (node.type === WorkflowNodeType.APPROVAL && !node.approverType) {
        throw new BadRequestException(
          `审批节点必须配置审批人类型：${node.name}`,
        );
      }
    }

    const sourceCodes = new Set<string>();
    for (const transition of transitions) {
      if (!nodeCodes.has(transition.sourceNodeCode)) {
        throw new BadRequestException(
          `流转源节点不存在：${transition.sourceNodeCode}`,
        );
      }

      if (!nodeCodes.has(transition.targetNodeCode)) {
        throw new BadRequestException(
          `流转目标节点不存在：${transition.targetNodeCode}`,
        );
      }

      if (sourceCodes.has(transition.sourceNodeCode)) {
        throw new BadRequestException(
          `第一版暂不支持一个节点配置多个出口：${transition.sourceNodeCode}`,
        );
      }

      sourceCodes.add(transition.sourceNodeCode);
    }
  }

  private validateGraph(definition: WorkflowGraph) {
    this.validateDefinitionDto(
      definition.nodes.map((node) => ({
        code: node.code,
        name: node.name,
        type: node.type,
        approverType: node.approverType ?? undefined,
        approverUserId: node.approverUserId ?? undefined,
        approverRoleId: node.approverRoleId ?? undefined,
        approveMode: node.approveMode,
        sort: node.sort,
        config: node.config,
      })),
      definition.transitions.map((transition) => {
        const source = definition.nodes.find(
          (node) => node.id === transition.sourceNodeId,
        );
        const target = definition.nodes.find(
          (node) => node.id === transition.targetNodeId,
        );

        return {
          sourceNodeCode: source?.code ?? '',
          targetNodeCode: target?.code ?? '',
          condition: transition.condition,
          sort: transition.sort,
        };
      }),
    );
  }

  private log(
    tx: Prisma.TransactionClient,
    data: {
      tenantId: string;
      instanceId: string;
      taskId?: string;
      nodeId?: string;
      action: WorkflowActionType;
      userId: string;
      comment?: string;
    },
  ) {
    return tx.workflowActionLog.create({ data });
  }
}
