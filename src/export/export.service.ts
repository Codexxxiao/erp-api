import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  FormTableType,
  ListViewColumn,
  ListViewColumnSource,
  ListViewStatus,
  PhysicalSchemaStatus,
  Prisma,
} from '../generated/prisma/client';
import { requireTenantId } from '../common/tenant/tenant-scope';
import type { CurrentUser } from '../common/types/current-user';
import type { FormSnapshot } from '../form-snapshot/form-snapshot.types';
import { PrismaService } from '../prisma/prisma.service';
import { DynamicQueryExecutorService } from '../dynamic-query/dynamic-query-executor.service';
import { ExportListViewDto } from './dto/export-list-view.dto';
import { ExportFileResult } from './export.types';

type ListViewFull = Prisma.ListViewGetPayload<{
  include: { columns: true; filters: true };
}>;

type SnapshotTable = FormSnapshot['tables'][number];
type SnapshotField = SnapshotTable['fields'][number];

type ExportColumn = {
  key: string;
  rowKey: string;
  title: string;
  width?: number | null;
};

@Injectable()
export class ExportService {
  private readonly defaultMaxRows = 5000;
  private readonly hardMaxRows = 10000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly dynamicQueryExecutor: DynamicQueryExecutorService,
  ) {}

  async exportListViewExcel(
    user: CurrentUser,
    listViewId: string,
    dto: ExportListViewDto,
  ): Promise<ExportFileResult> {
    const tenantId = requireTenantId(user);
    const context = await this.resolveListViewContext(tenantId, listViewId);
    const maxRows = this.normalizeMaxRows(dto.maxRows);

    const result = await this.dynamicQueryExecutor.query({
      tenantId,
      formId: context.view.formId,
      mainTable: context.mainTable,
      physicalTable: context.physicalTable,
      columns: context.view.columns,
      filters: context.view.filters,
      query: {
        page: 1,
        pageSize: maxRows,
        filters: dto.filters,
        sorts: dto.sorts,
      },
      maxPageSize: maxRows,
    });

    if (result.total > maxRows) {
      throw new BadRequestException(
        `导出数据量 ${result.total} 条超过上限 ${maxRows} 条，请缩小筛选条件`,
      );
    }

    const exportColumns = this.resolveExportColumns(
      context.view.columns,
      context.mainTable,
    );

    if (exportColumns.length === 0) {
      throw new BadRequestException('当前列表视图没有可导出的列');
    }

    const buffer = await this.buildWorkbookBuffer(exportColumns, result.list);
    const fileName = this.normalizeFileName(
      dto.fileName ??
        `${context.view.name}-${this.formatDateForFile(new Date())}`,
    );

    return {
      fileName,
      contentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
      total: result.total,
    };
  }

  private async resolveListViewContext(tenantId: string, listViewId: string) {
    const view = await this.prisma.listView.findFirst({
      where: { id: listViewId, tenantId },
      include: {
        columns: { orderBy: { sort: 'asc' } },
        filters: { orderBy: { sort: 'asc' } },
      },
    });

    if (!view) throw new NotFoundException('列表视图不存在');

    if (view.status !== ListViewStatus.ENABLED) {
      throw new BadRequestException('列表视图未启用');
    }

    const formVersion = await this.prisma.formVersion.findFirst({
      where: {
        tenantId,
        formId: view.formId,
        ...(view.formVersionId ? { id: view.formVersionId } : {}),
      },
      orderBy: { version: 'desc' },
    });

    if (!formVersion) throw new BadRequestException('请先发布表单快照');

    const snapshot = formVersion.snapshot as unknown as FormSnapshot;
    const mainTable = snapshot.tables.find(
      (item) => item.type === FormTableType.MAIN,
    );

    if (!mainTable) throw new BadRequestException('表单快照缺少主表');

    const physicalTable = await this.prisma.formPhysicalTable.findFirst({
      where: {
        tenantId,
        formId: view.formId,
        tableId: mainTable.id,
        status: PhysicalSchemaStatus.SYNCED,
      },
      include: { columns: { orderBy: { createdAt: 'asc' } } },
    });

    if (!physicalTable) {
      throw new BadRequestException('请先发布表单并生成实体表');
    }

    return { view, snapshot, mainTable, physicalTable };
  }

  private resolveExportColumns(
    columns: ListViewColumn[],
    mainTable: SnapshotTable,
  ): ExportColumn[] {
    return columns
      .filter((item) => !item.hidden)
      .sort((a, b) => a.sort - b.sort)
      .map((column, index) => {
        if (column.source === ListViewColumnSource.SYSTEM) {
          return {
            key: `c_${index}`,
            rowKey: column.systemKey!,
            title: column.title || this.systemColumnTitle(column.systemKey),
            width: column.width,
          };
        }

        const field = this.findSnapshotField(mainTable, column);

        return {
          key: `c_${index}`,
          rowKey: field.code,
          title: column.title || field.name || field.code,
          width: column.width,
        };
      });
  }

  private async buildWorkbookBuffer(
    columns: ExportColumn[],
    rows: Record<string, unknown>[],
  ) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'erp-api';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('导出数据', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = columns.map((column) => ({
      header: column.title,
      key: column.key,
      width: this.normalizeColumnWidth(column.width),
    }));

    for (const row of rows) {
      const item: Record<string, unknown> = {};

      for (const column of columns) {
        item[column.key] = this.normalizeCellValue(row[column.rowKey]);
      }

      sheet.addRow(item);
    }

    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };
    header.alignment = { vertical: 'middle', horizontal: 'center' };
    header.height = 22;

    sheet.autoFilter = `A1:${this.columnLetter(columns.length)}1`;

    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', wrapText: true };
      });
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private findSnapshotField(
    mainTable: SnapshotTable,
    input: { fieldId?: string | null; fieldCode?: string | null },
  ): SnapshotField {
    const field = mainTable.fields.find(
      (item) =>
        (input.fieldId && item.id === input.fieldId) ||
        (input.fieldCode && item.code === input.fieldCode),
    );

    if (!field) {
      throw new BadRequestException(
        `字段不存在：${input.fieldCode ?? input.fieldId}`,
      );
    }

    return field;
  }

  private normalizeCellValue(value: unknown): unknown {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value;
    if (typeof value === 'bigint') return value.toString();

    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;

      if (record.label !== undefined && record.label !== null) {
        return String(record.label);
      }

      if (record.value !== undefined && record.value !== null) {
        return this.normalizeCellValue(record.value);
      }

      return JSON.stringify(record);
    }

    return value;
  }

  private normalizeMaxRows(value?: number) {
    const maxRows = Number(value ?? this.defaultMaxRows);

    if (!Number.isFinite(maxRows) || maxRows < 1) return this.defaultMaxRows;

    return Math.min(Math.floor(maxRows), this.hardMaxRows);
  }

  private normalizeColumnWidth(width?: number | null) {
    if (!width) return 18;
    return Math.min(Math.max(Math.floor(width / 8), 12), 60);
  }

  private normalizeFileName(input: string) {
    const name = input
      .trim()
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 120);

    const finalName = name || 'export';
    return finalName.toLowerCase().endsWith('.xlsx')
      ? finalName
      : `${finalName}.xlsx`;
  }

  private formatDateForFile(date: Date) {
    const pad = (value: number) => String(value).padStart(2, '0');

    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds()),
    ].join('');
  }

  private systemColumnTitle(systemKey?: string | null) {
    const map = new Map<string, string>([
      ['id', 'ID'],
      ['recordNo', '单据编号'],
      ['status', '状态'],
      ['createdAt', '创建时间'],
      ['updatedAt', '更新时间'],
      ['submittedAt', '提交时间'],
      ['canceledAt', '取消时间'],
      ['createdById', '创建人'],
    ]);

    return systemKey ? (map.get(systemKey) ?? systemKey) : '系统字段';
  }

  private columnLetter(index: number) {
    let current = index;
    let result = '';

    while (current > 0) {
      const remainder = (current - 1) % 26;
      result = String.fromCharCode(65 + remainder) + result;
      current = Math.floor((current - 1) / 26);
    }

    return result || 'A';
  }
}
