import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { PrismaService } from '../prisma/prisma.service';
import { InitMasterDataDto } from './dto/init-master-data.dto';

type PresetItem = {
  value: string;
  label: string;
  color?: string;
  sort?: number;
  extra?: Record<string, unknown>;
};

type PresetDictionary = {
  code: string;
  name: string;
  description?: string;
  items: PresetItem[];
};

const PRESETS: PresetDictionary[] = [
  {
    code: 'customer_level',
    name: '客户等级',
    items: [
      { value: 'A', label: 'A级客户', color: '#16a34a', sort: 10 },
      { value: 'B', label: 'B级客户', color: '#2563eb', sort: 20 },
      { value: 'C', label: 'C级客户', color: '#f59e0b', sort: 30 },
      { value: 'D', label: 'D级客户', color: '#64748b', sort: 40 },
    ],
  },
  {
    code: 'customer_source',
    name: '客户来源',
    items: [
      { value: 'EXHIBITION', label: '展会', sort: 10 },
      { value: 'WEBSITE', label: '官网', sort: 20 },
      { value: 'PLATFORM', label: 'B2B平台', sort: 30 },
      { value: 'REFERRAL', label: '转介绍', sort: 40 },
      { value: 'OTHER', label: '其他', sort: 99 },
    ],
  },
  {
    code: 'country_region',
    name: '国家地区',
    items: [
      { value: 'US', label: '美国', sort: 10 },
      { value: 'GB', label: '英国', sort: 20 },
      { value: 'DE', label: '德国', sort: 30 },
      { value: 'FR', label: '法国', sort: 40 },
      { value: 'JP', label: '日本', sort: 50 },
      { value: 'KR', label: '韩国', sort: 60 },
      { value: 'CN', label: '中国', sort: 70 },
    ],
  },
  {
    code: 'currency',
    name: '币种',
    items: [
      { value: 'USD', label: '美元', sort: 10 },
      { value: 'EUR', label: '欧元', sort: 20 },
      { value: 'CNY', label: '人民币', sort: 30 },
      { value: 'GBP', label: '英镑', sort: 40 },
      { value: 'JPY', label: '日元', sort: 50 },
    ],
  },
  {
    code: 'trade_term',
    name: '贸易条款',
    items: [
      { value: 'EXW', label: 'EXW', sort: 10 },
      { value: 'FOB', label: 'FOB', sort: 20 },
      { value: 'CFR', label: 'CFR', sort: 30 },
      { value: 'CIF', label: 'CIF', sort: 40 },
      { value: 'DDP', label: 'DDP', sort: 50 },
    ],
  },
  {
    code: 'payment_term',
    name: '付款方式',
    items: [
      { value: 'TT', label: 'T/T', sort: 10 },
      { value: 'LC', label: 'L/C', sort: 20 },
      { value: 'DP', label: 'D/P', sort: 30 },
      { value: 'OA', label: 'OA', sort: 40 },
      { value: 'PAYPAL', label: 'PayPal', sort: 50 },
    ],
  },
  {
    code: 'transport_mode',
    name: '运输方式',
    items: [
      { value: 'SEA', label: '海运', sort: 10 },
      { value: 'AIR', label: '空运', sort: 20 },
      { value: 'RAIL', label: '铁路', sort: 30 },
      { value: 'TRUCK', label: '陆运', sort: 40 },
      { value: 'EXPRESS', label: '快递', sort: 50 },
    ],
  },
  {
    code: 'follow_up_type',
    name: '跟进方式',
    items: [
      { value: 'CALL', label: '电话', sort: 10 },
      { value: 'EMAIL', label: '邮件', sort: 20 },
      { value: 'MEETING', label: '会议', sort: 30 },
      { value: 'WHATSAPP', label: 'WhatsApp', sort: 40 },
      { value: 'VISIT', label: '拜访', sort: 50 },
      { value: 'OTHER', label: '其他', sort: 99 },
    ],
  },
];

@Injectable()
export class MasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  presets() {
    return PRESETS;
  }

  async initTenant(user: CurrentUser, dto: InitMasterDataDto) {
    const tenantId = requireTenantId(user);
    const scopeKey = `tenant:${tenantId}`;
    const overwrite = dto.overwrite ?? false;

    return this.prisma.$transaction(async (tx) => {
      const result = [];

      for (const preset of PRESETS) {
        const dictionary = await tx.dictionary.upsert({
          where: {
            scopeKey_code: {
              scopeKey,
              code: preset.code,
            },
          },
          update: {
            name: preset.name,
            description: preset.description,
            isActive: true,
          },
          create: {
            tenantId,
            scopeKey,
            code: preset.code,
            name: preset.name,
            description: preset.description,
            isActive: true,
          },
        });

        if (overwrite) {
          await tx.dictionaryItem.deleteMany({
            where: { dictionaryId: dictionary.id },
          });
        }

        for (const item of preset.items) {
          await tx.dictionaryItem.upsert({
            where: {
              dictionaryId_value: {
                dictionaryId: dictionary.id,
                value: item.value,
              },
            },
            update: {
              label: item.label,
              color: item.color,
              sort: item.sort ?? 0,
              extra: this.toJson(item.extra),
              isActive: true,
            },
            create: {
              dictionaryId: dictionary.id,
              value: item.value,
              label: item.label,
              color: item.color,
              sort: item.sort ?? 0,
              extra: this.toJson(item.extra),
              isActive: true,
            },
          });
        }

        result.push({
          code: preset.code,
          name: preset.name,
          itemCount: preset.items.length,
        });
      }

      return result;
    });
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
