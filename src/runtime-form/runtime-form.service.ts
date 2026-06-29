import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FormFieldType,
  FormRecordStatus,
  FormStatus,
  FormTableType,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import {
  CreateFormRecordDto,
  FormRecordDetailInputDto,
} from './dto/create-form-record.dto';
import { UpdateFormRecordDto } from './dto/update-form-record.dto';
import { QueryFormRecordDto } from './dto/query-form-record.dto';

type RuntimeForm = Prisma.FormDefinitionGetPayload<{
  include: {
    tables: {
      include: {
        fields: true;
      };
    };
  };
}>;

type RuntimeTable = RuntimeForm['tables'][number];

@Injectable()
export class RuntimeFormService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: CurrentUser, dto: CreateFormRecordDto) {
    const tenantId = requireTenantId(user);
    const form = await this.findEnabledForm(tenantId, dto.formId, dto.formCode);

    const normalized = this.normalizeAndValidate(
      form,
      dto.mainData,
      dto.details ?? [],
    );
    const recordNo = this.generateRecordNo(form.code);
    const status = dto.submit
      ? FormRecordStatus.SUBMITTED
      : FormRecordStatus.DRAFT;

    return this.prisma.$transaction(async (tx) => {
      const record = await tx.formRecord.create({
        data: {
          tenantId,
          formId: form.id,
          formCode: form.code,
          recordNo,
          status,
          mainData: normalized.mainData as Prisma.InputJsonValue,
          createdById: user.id,
          submittedAt: dto.submit ? new Date() : null,
        },
      });

      for (const detail of normalized.details) {
        await tx.formRecordDetail.createMany({
          data: detail.rows.map((row, index) => ({
            recordId: record.id,
            tableId: detail.table.id,
            tableCode: detail.table.code,
            rowIndex: index,
            rowData: row as Prisma.InputJsonValue,
          })),
        });
      }

      return tx.formRecord.findUnique({
        where: { id: record.id },
        include: {
          details: {
            orderBy: [{ tableCode: 'asc' }, { rowIndex: 'asc' }],
          },
        },
      });
    });
  }

  async findAll(user: CurrentUser, query: QueryFormRecordDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.FormRecordWhereInput = {
      tenantId,
      formCode: query.formCode,
      status: query.status,
      OR: query.keyword
        ? [
            { recordNo: { contains: query.keyword, mode: 'insensitive' } },
            { formCode: { contains: query.keyword, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.formRecord.count({ where }),
      this.prisma.formRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          details: {
            orderBy: [{ tableCode: 'asc' }, { rowIndex: 'asc' }],
          },
        },
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      list,
    };
  }

  async findOne(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const record = await this.prisma.formRecord.findFirst({
      where: { id, tenantId },
      include: {
        form: {
          include: {
            tables: {
              orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
              include: {
                fields: {
                  orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
                },
              },
            },
          },
        },
        details: {
          orderBy: [{ tableCode: 'asc' }, { rowIndex: 'asc' }],
        },
      },
    });

    if (!record) throw new NotFoundException('单据不存在');
    return record;
  }

  async update(user: CurrentUser, id: string, dto: UpdateFormRecordDto) {
    const tenantId = requireTenantId(user);

    const record = await this.prisma.formRecord.findFirst({
      where: { id, tenantId },
      include: {
        form: {
          include: {
            tables: {
              include: { fields: true },
            },
          },
        },
      },
    });

    if (!record) throw new NotFoundException('单据不存在');
    if (record.status !== FormRecordStatus.DRAFT) {
      throw new ForbiddenException('只有草稿单据允许修改');
    }

    const normalized = this.normalizeAndValidate(
      record.form,
      dto.mainData ?? (record.mainData as Record<string, unknown>),
      dto.details ?? [],
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.formRecord.update({
        where: { id },
        data: {
          mainData: normalized.mainData as Prisma.InputJsonValue,
          updatedById: user.id,
        },
      });

      if (dto.details) {
        await tx.formRecordDetail.deleteMany({ where: { recordId: id } });

        for (const detail of normalized.details) {
          await tx.formRecordDetail.createMany({
            data: detail.rows.map((row, index) => ({
              recordId: id,
              tableId: detail.table.id,
              tableCode: detail.table.code,
              rowIndex: index,
              rowData: row as Prisma.InputJsonValue,
            })),
          });
        }
      }

      return tx.formRecord.findUnique({
        where: { id },
        include: {
          details: {
            orderBy: [{ tableCode: 'asc' }, { rowIndex: 'asc' }],
          },
        },
      });
    });
  }

  async submit(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const record = await this.prisma.formRecord.findFirst({
      where: { id, tenantId },
    });

    if (!record) throw new NotFoundException('单据不存在');
    if (record.status !== FormRecordStatus.DRAFT) {
      throw new BadRequestException('只有草稿单据可以提交');
    }

    return this.prisma.formRecord.update({
      where: { id },
      data: {
        status: FormRecordStatus.SUBMITTED,
        submittedAt: new Date(),
        updatedById: user.id,
      },
      include: {
        details: {
          orderBy: [{ tableCode: 'asc' }, { rowIndex: 'asc' }],
        },
      },
    });
  }

  async cancel(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const record = await this.prisma.formRecord.findFirst({
      where: { id, tenantId },
    });

    if (!record) throw new NotFoundException('单据不存在');
    if (record.status === FormRecordStatus.CANCELED) {
      throw new BadRequestException('单据已撤销');
    }

    return this.prisma.formRecord.update({
      where: { id },
      data: {
        status: FormRecordStatus.CANCELED,
        canceledAt: new Date(),
        updatedById: user.id,
      },
      include: {
        details: {
          orderBy: [{ tableCode: 'asc' }, { rowIndex: 'asc' }],
        },
      },
    });
  }

  private async findEnabledForm(
    tenantId: string,
    formId?: string,
    formCode?: string,
  ) {
    if (!formId && !formCode) {
      throw new BadRequestException('formId 和 formCode 至少传一个');
    }

    const include = {
      tables: {
        orderBy: [{ sort: 'asc' as const }, { createdAt: 'asc' as const }],
        include: {
          fields: {
            orderBy: [{ sort: 'asc' as const }, { createdAt: 'asc' as const }],
          },
        },
      },
    };

    if (formId) {
      const form = await this.prisma.formDefinition.findFirst({
        where: {
          id: formId,
          status: FormStatus.ENABLED,
          OR: [{ tenantId }, { scopeKey: 'system' }],
        },
        include,
      });

      if (!form) throw new NotFoundException('启用表单不存在');
      return form;
    }

    const tenantForm = await this.prisma.formDefinition.findFirst({
      where: {
        tenantId,
        code: formCode,
        status: FormStatus.ENABLED,
      },
      include,
    });

    if (tenantForm) return tenantForm;

    const systemForm = await this.prisma.formDefinition.findFirst({
      where: {
        scopeKey: 'system',
        code: formCode,
        status: FormStatus.ENABLED,
      },
      include,
    });

    if (!systemForm) throw new NotFoundException('启用表单不存在');
    return systemForm;
  }

  private normalizeAndValidate(
    form: RuntimeForm,
    mainData: Record<string, unknown>,
    details: FormRecordDetailInputDto[],
  ) {
    const mainTable = form.tables.find(
      (table) => table.type === FormTableType.MAIN,
    );
    if (!mainTable) throw new BadRequestException('表单未配置主表');

    const normalizedMain = this.normalizeRow(mainTable, mainData, '主表');

    const normalizedDetails = details.map((detail) => {
      const table = form.tables.find(
        (item) =>
          item.code === detail.tableCode && item.type === FormTableType.SUB,
      );

      if (!table)
        throw new BadRequestException(`附表不存在：${detail.tableCode}`);

      return {
        table,
        rows: detail.rows.map((row, index) =>
          this.normalizeRow(table, row, `${table.name}第${index + 1}行`),
        ),
      };
    });

    return {
      mainData: normalizedMain,
      details: normalizedDetails,
    };
  }

  private normalizeRow(
    table: RuntimeTable,
    row: Record<string, unknown>,
    label: string,
  ) {
    const result = { ...row };

    for (const field of table.fields) {
      const value = result[field.code];

      if (field.required && !this.hasValue(value)) {
        throw new BadRequestException(`${label}字段 ${field.name} 必填`);
      }

      if (this.hasValue(value)) {
        this.validateFieldValue(
          field.type,
          value,
          `${label}字段 ${field.name}`,
        );
      }
    }

    for (const field of table.fields) {
      const formula = field.formula as {
        expression?: string;
        dependencies?: string[];
      } | null;

      if (formula?.expression) {
        result[field.code] = this.evaluateArithmeticFormula(
          formula.expression,
          result,
          formula.dependencies ?? [],
          `${label}字段 ${field.name}`,
        );
      }
    }

    return result;
  }

  private validateFieldValue(
    type: FormFieldType,
    value: unknown,
    label: string,
  ) {
    switch (type) {
      case FormFieldType.TEXT:
      case FormFieldType.TEXTAREA:
        if (typeof value !== 'string') {
          throw new BadRequestException(`${label} 必须是字符串`);
        }
        break;
      case FormFieldType.NUMBER:
      case FormFieldType.DECIMAL:
      case FormFieldType.MONEY:
        if (typeof value !== 'number') {
          throw new BadRequestException(`${label} 必须是数字`);
        }
        break;
      case FormFieldType.BOOLEAN:
        if (typeof value !== 'boolean') {
          throw new BadRequestException(`${label} 必须是布尔值`);
        }
        break;
      case FormFieldType.DATE:
      case FormFieldType.DATETIME:
        if (typeof value !== 'string') {
          throw new BadRequestException(`${label} 必须是日期字符串`);
        }
        break;
      default:
        break;
    }
  }

  private evaluateArithmeticFormula(
    expression: string,
    row: Record<string, unknown>,
    dependencies: string[],
    label: string,
  ) {
    if (!/^[0-9A-Za-z_+\-*/().\s]+$/.test(expression)) {
      throw new BadRequestException(`${label} 公式包含非法字符`);
    }

    const identifiers = expression.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
    const allowed = new Set(dependencies);

    for (const identifier of identifiers) {
      if (!allowed.has(identifier)) {
        throw new BadRequestException(`${label} 公式依赖未声明：${identifier}`);
      }
    }

    const substituted = [...dependencies]
      .sort((a, b) => b.length - a.length)
      .reduce((expr, key) => {
        const value = row[key];
        const numberValue =
          typeof value === 'number' ? value : Number(value ?? 0);
        const safeNum = Number.isFinite(numberValue) ? numberValue : 0;
        return expr.replace(
          new RegExp(`\\b${this.escapeRegExp(key)}\\b`, 'g'),
          String(safeNum),
        );
      }, expression);

    if (!/^[0-9+\-*/().\s]+$/.test(substituted)) {
      throw new BadRequestException(`${label} 公式包含非法字符`);
    }

    try {
      return this.evaluateNumericExpression(substituted, label);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`${label} 公式计算失败`);
    }
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private evaluateNumericExpression(expression: string, label: string) {
    const chars = expression.replace(/\s/g, '');
    let index = 0;

    const parseExpression = (): number => {
      let result = parseTerm();
      while (index < chars.length) {
        const op = chars[index];
        if (op !== '+' && op !== '-') break;
        index++;
        const term = parseTerm();
        result = op === '+' ? result + term : result - term;
      }
      return result;
    };

    const parseTerm = (): number => {
      let result = parseFactor();
      while (index < chars.length) {
        const op = chars[index];
        if (op !== '*' && op !== '/') break;
        index++;
        const factor = parseFactor();
        if (op === '/') {
          if (factor === 0) {
            throw new BadRequestException(`${label} 除数不能为 0`);
          }
          result = result / factor;
        } else {
          result = result * factor;
        }
      }
      return result;
    };

    const parseFactor = (): number => {
      if (chars[index] === '(') {
        index++;
        const result = parseExpression();
        if (chars[index] !== ')') {
          throw new BadRequestException(`${label} 公式括号不匹配`);
        }
        index++;
        return result;
      }

      if (chars[index] === '-') {
        index++;
        return -parseFactor();
      }

      if (chars[index] === '+') {
        index++;
        return parseFactor();
      }

      const start = index;
      while (index < chars.length && /[0-9.]/.test(chars[index])) {
        index++;
      }

      if (start === index) {
        throw new BadRequestException(`${label} 公式格式错误`);
      }

      const num = Number(chars.slice(start, index));
      if (!Number.isFinite(num)) {
        throw new BadRequestException(`${label} 公式数字无效`);
      }

      return num;
    };

    const result = parseExpression();
    if (index !== chars.length) {
      throw new BadRequestException(`${label} 公式格式错误`);
    }

    if (!Number.isFinite(result)) {
      throw new BadRequestException(`${label} 公式计算失败`);
    }

    return result;
  }

  private hasValue(value: unknown) {
    return value !== undefined && value !== null && value !== '';
  }

  private generateRecordNo(formCode: string) {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const suffix = `${now.getTime()}`.slice(-6);
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();

    return `${formCode.toUpperCase()}-${date}-${suffix}${random}`;
  }
}
