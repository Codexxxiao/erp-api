import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentFlow,
  DocumentFlowExecutionStatus,
  DocumentFlowMapping,
  DocumentFlowMappingType,
  DocumentFlowStatus,
  FormStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RuntimeFormService } from '../runtime-form/runtime-form.service';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import {
  CreateDocumentFlowDto,
  CreateDocumentFlowMappingDto,
} from './dto/create-document-flow.dto';
import { UpdateDocumentFlowDto } from './dto/update-document-flow.dto';
import { ExecuteDocumentFlowDto } from './dto/execute-document-flow.dto';

type FlowWithMappings = DocumentFlow & {
  mappings: DocumentFlowMapping[];
};

type SourcePhysicalData = {
  mainData: Record<string, unknown>;
  details: Array<{
    tableCode: string;
    rows: Record<string, unknown>[];
  }>;
};

@Injectable()
export class DocumentFlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtimeFormService: RuntimeFormService,
  ) {}

  async create(user: CurrentUser, dto: CreateDocumentFlowDto) {
    const tenantId = requireTenantId(user);

    await this.assertTenantForm(tenantId, dto.sourceFormId, '源表单');
    await this.assertTenantForm(tenantId, dto.targetFormId, '目标表单');

    this.validateMappingDtos(dto.mappings ?? []);

    return this.prisma.documentFlow.create({
      data: {
        tenantId,
        code: dto.code,
        name: dto.name,
        direction: dto.direction,
        sourceFormId: dto.sourceFormId,
        targetFormId: dto.targetFormId,
        description: dto.description,
        config: dto.config as Prisma.InputJsonValue,
        mappings: {
          create: (dto.mappings ?? []).map((item) =>
            this.toMappingCreateInput(item),
          ),
        },
      },
      include: {
        mappings: {
          orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
  }

  async findAll(user: CurrentUser) {
    const tenantId = requireTenantId(user);

    return this.prisma.documentFlow.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        mappings: {
          orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
  }

  async findOne(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    return this.findFlowOrThrow(tenantId, id);
  }

  async update(user: CurrentUser, id: string, dto: UpdateDocumentFlowDto) {
    const tenantId = requireTenantId(user);
    await this.findFlowOrThrow(tenantId, id);

    if (dto.sourceFormId)
      await this.assertTenantForm(tenantId, dto.sourceFormId, '源表单');
    if (dto.targetFormId)
      await this.assertTenantForm(tenantId, dto.targetFormId, '目标表单');
    if (dto.mappings) this.validateMappingDtos(dto.mappings);

    return this.prisma.documentFlow.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        direction: dto.direction,
        sourceFormId: dto.sourceFormId,
        targetFormId: dto.targetFormId,
        description: dto.description,
        config: dto.config as Prisma.InputJsonValue,
        status: DocumentFlowStatus.DRAFT,
        mappings: dto.mappings
          ? {
              deleteMany: {},
              create: dto.mappings.map((item) =>
                this.toMappingCreateInput(item),
              ),
            }
          : undefined,
      },
      include: {
        mappings: {
          orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
  }

  async enable(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    const flow = await this.findFlowOrThrow(tenantId, id);

    if (flow.mappings.length === 0) {
      throw new BadRequestException('启用前必须配置字段映射');
    }

    await this.assertTenantForm(tenantId, flow.sourceFormId, '源表单', true);
    await this.assertTenantForm(tenantId, flow.targetFormId, '目标表单', true);
    this.validateMappings(flow.mappings);

    return this.prisma.documentFlow.update({
      where: { id },
      data: { status: DocumentFlowStatus.ENABLED },
      include: {
        mappings: {
          orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
  }

  async disable(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);
    await this.findFlowOrThrow(tenantId, id);

    return this.prisma.documentFlow.update({
      where: { id },
      data: { status: DocumentFlowStatus.DISABLED },
      include: {
        mappings: {
          orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
  }

  async execute(user: CurrentUser, id: string, dto: ExecuteDocumentFlowDto) {
    const tenantId = requireTenantId(user);
    const flow = await this.findFlowOrThrow(tenantId, id);

    if (flow.status !== DocumentFlowStatus.ENABLED) {
      throw new BadRequestException('数据流转规则未启用');
    }

    const sourceRecord = (await this.runtimeFormService.findOne(
      user,
      dto.sourceRecordId,
    )) as {
      id: string;
      formId: string;
      physicalData: SourcePhysicalData;
    };

    if (sourceRecord.formId !== flow.sourceFormId) {
      throw new BadRequestException('源单据不属于当前数据流转规则的源表单');
    }

    const targetPayload = this.buildTargetPayload(
      flow,
      sourceRecord.physicalData,
    );

    try {
      const targetRecord = (await this.runtimeFormService.create(user, {
        formId: flow.targetFormId,
        mainData: targetPayload.mainData,
        details: targetPayload.details,
        submit: dto.submit ?? false,
      })) as { id: string };

      const execution = await this.prisma.documentFlowExecution.create({
        data: {
          tenantId,
          flowId: flow.id,
          sourceFormId: flow.sourceFormId,
          targetFormId: flow.targetFormId,
          sourceRecordId: sourceRecord.id,
          targetRecordId: targetRecord.id,
          status: DocumentFlowExecutionStatus.SUCCESS,
          payload: targetPayload as Prisma.InputJsonValue,
          createdById: user.id,
        },
      });

      return {
        targetRecord,
        execution,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '数据流转执行失败';

      await this.prisma.documentFlowExecution.create({
        data: {
          tenantId,
          flowId: flow.id,
          sourceFormId: flow.sourceFormId,
          targetFormId: flow.targetFormId,
          sourceRecordId: sourceRecord.id,
          status: DocumentFlowExecutionStatus.FAILED,
          errorMessage: message,
          payload: targetPayload as Prisma.InputJsonValue,
          createdById: user.id,
        },
      });

      throw new BadRequestException(`数据流转执行失败：${message}`);
    }
  }

  async findExecutions(user: CurrentUser, flowId: string) {
    const tenantId = requireTenantId(user);
    await this.findFlowOrThrow(tenantId, flowId);

    return this.prisma.documentFlowExecution.findMany({
      where: {
        tenantId,
        flowId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private buildTargetPayload(
    flow: FlowWithMappings,
    sourceData: SourcePhysicalData,
  ) {
    const mainData: Record<string, unknown> = {};

    const mainMappings = flow.mappings.filter((item) => !item.targetTableCode);
    for (const mapping of mainMappings) {
      mainData[mapping.targetFieldCode] = this.resolveValue(
        mapping,
        sourceData.mainData,
      );
    }

    const detailMappings = flow.mappings.filter((item) => item.targetTableCode);
    const grouped = this.groupByTargetTable(detailMappings);

    const details = Object.entries(grouped).map(
      ([targetTableCode, mappings]) => {
        const sourceDetailTableCodes = Array.from(
          new Set(
            mappings
              .map((item) => item.sourceTableCode)
              .filter((value): value is string => Boolean(value)),
          ),
        );

        if (sourceDetailTableCodes.length > 1) {
          throw new BadRequestException(
            `目标附表 ${targetTableCode} 暂不支持多个源附表合并`,
          );
        }

        const sourceTableCode = sourceDetailTableCodes[0];

        if (!sourceTableCode) {
          return {
            tableCode: targetTableCode,
            rows: [this.buildTargetRow(mappings, sourceData.mainData)],
          };
        }

        const sourceDetail = sourceData.details.find(
          (item) => item.tableCode === sourceTableCode,
        );
        const sourceRows = sourceDetail?.rows ?? [];

        return {
          tableCode: targetTableCode,
          rows: sourceRows.map((sourceRow) =>
            this.buildTargetRow(mappings, sourceData.mainData, sourceRow),
          ),
        };
      },
    );

    return {
      mainData,
      details,
    };
  }

  private buildTargetRow(
    mappings: DocumentFlowMapping[],
    sourceMainData: Record<string, unknown>,
    sourceRow?: Record<string, unknown>,
  ) {
    const row: Record<string, unknown> = {};

    for (const mapping of mappings) {
      row[mapping.targetFieldCode] = this.resolveValue(
        mapping,
        sourceMainData,
        sourceRow,
      );
    }

    return row;
  }

  private resolveValue(
    mapping: DocumentFlowMapping,
    sourceMainData: Record<string, unknown>,
    sourceRow?: Record<string, unknown>,
  ) {
    if (mapping.mappingType === DocumentFlowMappingType.CONSTANT) {
      return mapping.constantValue;
    }

    if (!mapping.sourceFieldCode) {
      throw new BadRequestException(
        `字段映射缺少 sourceFieldCode：${mapping.targetFieldCode}`,
      );
    }

    if (mapping.sourceTableCode) {
      return sourceRow?.[mapping.sourceFieldCode] ?? null;
    }

    return sourceMainData[mapping.sourceFieldCode] ?? null;
  }

  private groupByTargetTable(mappings: DocumentFlowMapping[]) {
    return mappings.reduce<Record<string, DocumentFlowMapping[]>>(
      (acc, item) => {
        if (!item.targetTableCode) return acc;

        acc[item.targetTableCode] ??= [];
        acc[item.targetTableCode].push(item);

        return acc;
      },
      {},
    );
  }

  private async findFlowOrThrow(
    tenantId: string,
    id: string,
  ): Promise<FlowWithMappings> {
    const flow = await this.prisma.documentFlow.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        mappings: {
          orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!flow) throw new NotFoundException('数据流转规则不存在');
    return flow;
  }

  private async assertTenantForm(
    tenantId: string,
    formId: string,
    label: string,
    requireEnabled = false,
  ) {
    const form = await this.prisma.formDefinition.findFirst({
      where: {
        id: formId,
        tenantId,
        ...(requireEnabled ? { status: FormStatus.ENABLED } : {}),
      },
    });

    if (!form) {
      throw new BadRequestException(
        requireEnabled ? `${label}不存在或未启用` : `${label}不存在`,
      );
    }

    return form;
  }

  private validateMappingDtos(mappings: CreateDocumentFlowMappingDto[]) {
    this.validateMappings(mappings as DocumentFlowMapping[]);
  }

  private validateMappings(mappings: DocumentFlowMapping[]) {
    const targetKeys = new Set<string>();

    for (const mapping of mappings) {
      if (!mapping.targetFieldCode) {
        throw new BadRequestException('映射必须配置 targetFieldCode');
      }

      if (
        mapping.mappingType === DocumentFlowMappingType.FIELD &&
        !mapping.sourceFieldCode
      ) {
        throw new BadRequestException(
          `字段映射必须配置 sourceFieldCode：${mapping.targetFieldCode}`,
        );
      }

      const targetKey = `${mapping.targetTableCode ?? 'main'}:${mapping.targetFieldCode}`;
      if (targetKeys.has(targetKey)) {
        throw new BadRequestException(`目标字段重复映射：${targetKey}`);
      }

      targetKeys.add(targetKey);
    }
  }

  private toMappingCreateInput(mapping: CreateDocumentFlowMappingDto) {
    return {
      sourceTableCode: mapping.sourceTableCode,
      sourceFieldCode: mapping.sourceFieldCode,
      targetTableCode: mapping.targetTableCode,
      targetFieldCode: mapping.targetFieldCode,
      mappingType: mapping.mappingType,
      constantValue:
        mapping.constantValue === undefined
          ? undefined
          : (mapping.constantValue as Prisma.InputJsonValue),
      sort: mapping.sort ?? 0,
    };
  }
}
