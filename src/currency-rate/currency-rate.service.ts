import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CurrencyRateSource,
  CurrencyRateStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { requireTenantId } from '../common/tenant/tenant-scope';
import type { CurrentUser } from '../common/types/current-user';
import { CreateCurrencyRateDto } from './dto/create-currency-rate.dto';
import { UpdateCurrencyRateDto } from './dto/update-currency-rate.dto';
import { QueryCurrencyRateDto } from './dto/query-currency-rate.dto';
import { BulkUpsertCurrencyRateDto } from './dto/bulk-upsert-currency-rate.dto';

type DbClient = PrismaService | Prisma.TransactionClient;

export interface ResolveRateParams {
  tenantId: string;
  fromCurrencyCode: string;
  toCurrencyCode: string;
  rateDate?: string | Date;
  allowInverse?: boolean;
}

export interface ConvertCurrencyParams extends ResolveRateParams {
  amount: Prisma.Decimal.Value;
}

@Injectable()
export class CurrencyRateService {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: CurrentUser, dto: CreateCurrencyRateDto) {
    const tenantId = requireTenantId(user);
    const input = this.buildCreateInput(dto);

    const exists = await this.prisma.currencyRate.findUnique({
      where: {
        tenantId_fromCurrencyCode_toCurrencyCode_rateDate: {
          tenantId,
          fromCurrencyCode: input.fromCurrencyCode,
          toCurrencyCode: input.toCurrencyCode,
          rateDate: input.rateDate,
        },
      },
    });

    if (exists) throw new ConflictException('当前日期的币种汇率已存在');

    return this.prisma.currencyRate.create({
      data: {
        tenantId,
        ...input,
        createdById: user.id,
        updatedById: user.id,
      },
    });
  }

  async bulkUpsert(user: CurrentUser, dto: BulkUpsertCurrencyRateDto) {
    const tenantId = requireTenantId(user);

    return this.prisma.$transaction(async (tx) => {
      const items = [];

      for (const item of dto.items) {
        const input = this.buildCreateInput(item);

        const saved = await tx.currencyRate.upsert({
          where: {
            tenantId_fromCurrencyCode_toCurrencyCode_rateDate: {
              tenantId,
              fromCurrencyCode: input.fromCurrencyCode,
              toCurrencyCode: input.toCurrencyCode,
              rateDate: input.rateDate,
            },
          },
          create: {
            tenantId,
            ...input,
            createdById: user.id,
            updatedById: user.id,
          },
          update: {
            rate: input.rate,
            source: input.source,
            status: input.status,
            remark: input.remark,
            updatedById: user.id,
          },
        });

        items.push(saved);
      }

      return { count: items.length, items };
    });
  }

  async findMany(user: CurrentUser, query: QueryCurrencyRateDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.CurrencyRateWhereInput = { tenantId };

    if (query.fromCurrencyCode) where.fromCurrencyCode = query.fromCurrencyCode;
    if (query.toCurrencyCode) where.toCurrencyCode = query.toCurrencyCode;
    if (query.source) where.source = query.source;
    if (query.status) where.status = query.status;

    if (query.dateFrom || query.dateTo) {
      where.rateDate = {
        gte: query.dateFrom ? this.normalizeDate(query.dateFrom) : undefined,
        lte: query.dateTo ? this.normalizeDate(query.dateTo) : undefined,
      };
    }

    if (query.keyword) {
      const keyword = query.keyword.trim().toUpperCase();
      where.OR = [
        { fromCurrencyCode: { contains: keyword, mode: 'insensitive' } },
        { toCurrencyCode: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.currencyRate.count({ where }),
      this.prisma.currencyRate.findMany({
        where,
        orderBy: [{ rateDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      total,
      page,
      pageSize,
      list: items,
    };
  }

  async findOne(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const rate = await this.prisma.currencyRate.findFirst({
      where: { id, tenantId },
    });

    if (!rate) throw new NotFoundException('汇率不存在');
    return rate;
  }

  async update(user: CurrentUser, id: string, dto: UpdateCurrencyRateDto) {
    const tenantId = requireTenantId(user);
    const current = await this.findOne(user, id);

    const next = {
      fromCurrencyCode: dto.fromCurrencyCode
        ? this.normalizeCurrencyCode(dto.fromCurrencyCode)
        : current.fromCurrencyCode,
      toCurrencyCode: dto.toCurrencyCode
        ? this.normalizeCurrencyCode(dto.toCurrencyCode)
        : current.toCurrencyCode,
      rateDate: dto.rateDate
        ? this.normalizeDate(dto.rateDate)
        : current.rateDate,
      rate:
        dto.rate === undefined
          ? current.rate
          : this.toPositiveDecimal(dto.rate),
      source: dto.source ?? current.source,
      status: dto.status ?? current.status,
      remark: dto.remark ?? current.remark,
    };

    this.assertCurrencyPair(next.fromCurrencyCode, next.toCurrencyCode);

    const conflict = await this.prisma.currencyRate.findUnique({
      where: {
        tenantId_fromCurrencyCode_toCurrencyCode_rateDate: {
          tenantId,
          fromCurrencyCode: next.fromCurrencyCode,
          toCurrencyCode: next.toCurrencyCode,
          rateDate: next.rateDate,
        },
      },
    });

    if (conflict && conflict.id !== id) {
      throw new ConflictException('当前日期的币种汇率已存在');
    }

    return this.prisma.currencyRate.update({
      where: { id },
      data: {
        ...next,
        updatedById: user.id,
      },
    });
  }

  async remove(user: CurrentUser, id: string) {
    await this.findOne(user, id);

    return this.prisma.currencyRate.update({
      where: { id },
      data: {
        status: CurrencyRateStatus.DISABLED,
        updatedById: user.id,
      },
    });
  }

  async resolveRateByTenant(
    params: ResolveRateParams,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const fromCurrencyCode = this.normalizeCurrencyCode(
      params.fromCurrencyCode,
    );
    const toCurrencyCode = this.normalizeCurrencyCode(params.toCurrencyCode);
    const requestedDate = this.normalizeDate(params.rateDate ?? new Date());

    if (fromCurrencyCode === toCurrencyCode) {
      return {
        rateId: null,
        fromCurrencyCode,
        toCurrencyCode,
        requestedDate,
        rateDate: requestedDate,
        rate: new Prisma.Decimal(1),
        inverse: false,
        source: 'IDENTITY',
      };
    }

    const direct = await this.findLatestEnabledRate(
      client,
      params.tenantId,
      fromCurrencyCode,
      toCurrencyCode,
      requestedDate,
    );

    if (direct) {
      return {
        rateId: direct.id,
        fromCurrencyCode,
        toCurrencyCode,
        requestedDate,
        rateDate: direct.rateDate,
        rate: direct.rate,
        inverse: false,
        source: direct.source,
      };
    }

    if (params.allowInverse !== false) {
      const inverse = await this.findLatestEnabledRate(
        client,
        params.tenantId,
        toCurrencyCode,
        fromCurrencyCode,
        requestedDate,
      );

      if (inverse) {
        return {
          rateId: inverse.id,
          fromCurrencyCode,
          toCurrencyCode,
          requestedDate,
          rateDate: inverse.rateDate,
          rate: new Prisma.Decimal(1).div(inverse.rate),
          inverse: true,
          source: inverse.source,
        };
      }
    }

    throw new NotFoundException(
      `未找到 ${fromCurrencyCode} 到 ${toCurrencyCode} 在 ${requestedDate
        .toISOString()
        .slice(0, 10)} 之前的可用汇率`,
    );
  }

  async convertAmountByTenant(
    params: ConvertCurrencyParams,
    tx?: Prisma.TransactionClient,
  ) {
    const amount = this.toDecimal(params.amount);
    const resolved = await this.resolveRateByTenant(params, tx);

    return {
      ...resolved,
      sourceAmount: amount,
      convertedAmount: amount.mul(resolved.rate),
    };
  }

  private async findLatestEnabledRate(
    client: DbClient,
    tenantId: string,
    fromCurrencyCode: string,
    toCurrencyCode: string,
    rateDate: Date,
  ) {
    return client.currencyRate.findFirst({
      where: {
        tenantId,
        fromCurrencyCode,
        toCurrencyCode,
        status: CurrencyRateStatus.ENABLED,
        rateDate: { lte: rateDate },
      },
      orderBy: [{ rateDate: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  private buildCreateInput(dto: CreateCurrencyRateDto) {
    const fromCurrencyCode = this.normalizeCurrencyCode(dto.fromCurrencyCode);
    const toCurrencyCode = this.normalizeCurrencyCode(dto.toCurrencyCode);

    this.assertCurrencyPair(fromCurrencyCode, toCurrencyCode);

    return {
      fromCurrencyCode,
      toCurrencyCode,
      rate: this.toPositiveDecimal(dto.rate),
      rateDate: this.normalizeDate(dto.rateDate),
      source: dto.source ?? CurrencyRateSource.MANUAL,
      status: dto.status ?? CurrencyRateStatus.ENABLED,
      remark: dto.remark,
    };
  }

  private normalizeCurrencyCode(value: string) {
    const code = value.trim().toUpperCase();
    if (code.length < 3 || code.length > 16) {
      throw new BadRequestException('币种编码长度必须在 3 到 16 位之间');
    }
    return code;
  }

  private assertCurrencyPair(fromCurrencyCode: string, toCurrencyCode: string) {
    if (fromCurrencyCode === toCurrencyCode) {
      throw new BadRequestException('原币种和目标币种不能相同');
    }
  }

  private normalizeDate(value: string | Date) {
    const raw =
      value instanceof Date
        ? value.toISOString().slice(0, 10)
        : value.slice(0, 10);

    const date = new Date(`${raw}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('汇率日期不合法');
    }

    return date;
  }

  private toDecimal(value: Prisma.Decimal.Value) {
    const decimal = new Prisma.Decimal(value);

    if (!decimal.isFinite()) {
      throw new BadRequestException('金额不合法');
    }

    return decimal;
  }

  private toPositiveDecimal(value: Prisma.Decimal.Value) {
    const decimal = this.toDecimal(value);

    if (decimal.lte(0)) {
      throw new BadRequestException('汇率必须大于 0');
    }

    return decimal;
  }
}
