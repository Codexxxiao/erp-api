import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as XLSX from 'xlsx';
import {
  FormFieldType,
  FormStatus,
  FormTableType,
  FormVersionStatus,
  ImportTaskRowStatus,
  ImportTaskStatus,
  Prisma,
} from '../generated/prisma/client';
import type { CurrentUser } from '../common/types/current-user';
import { requireTenantId } from '../common/tenant/tenant-scope';
import { FileService } from '../file/file.service';
import { RuntimeFormService } from '../runtime-form/runtime-form.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateImportTaskDto } from './dto/create-import-task.dto';
import { ExecuteImportTaskDto } from './dto/execute-import-task.dto';
import { PreviewImportTaskDto } from './dto/preview-import-task.dto';
import { QueryImportTaskDto } from './dto/query-import-task.dto';
import {
  ImportFieldMappingDto,
  ValidateImportTaskDto,
} from './dto/validate-import-task.dto';
import { ImportTemplateService } from '../import-template/import-template.service';
import type { FormSnapshot } from '../form-snapshot/form-snapshot.types';

type RuntimeTableInfo = {
  code: string;
  name: string;
  type: FormTableType;
  fields: RuntimeField[];
};

type RuntimeField = {
  code: string;
  name: string;
  type: FormFieldType;
  required: boolean;
};

type ImportTemplateMappingItem = {
  header?: string;
  aliases?: string[];
  tableCode?: string;
  fieldCode: string;
  defaultValue?: unknown;
};

type GroupedMappedData = {
  mainData: Record<string, unknown>;
  details: Array<{
    tableCode: string;
    rows: Record<string, unknown>[];
  }>;
};

type ImportRowValidationResult = {
  rowNumber: number;
  rawData: Record<string, unknown>;
  mappedData: Record<string, unknown> | GroupedMappedData;
  errors: string[];
};

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileService: FileService,
    private readonly runtimeFormService: RuntimeFormService,
    private readonly importTemplateService: ImportTemplateService,
  ) {}

  private async resolveTaskTemplateMappings(
    task: {
      tenantId: string;
      formCode: string;
      templateId: string | null;
    },
    headers: string[],
  ): Promise<ImportFieldMappingDto[]> {
    const template = task.templateId
      ? await this.importTemplateService.ensureUsableTemplate(
          task.tenantId,
          task.templateId,
          task.formCode,
        )
      : await this.importTemplateService.findDefault(
          task.tenantId,
          task.formCode,
        );

    if (!template) {
      throw new BadRequestException(
        '未传 mappings，且当前表单没有可用导入模板',
      );
    }

    return this.resolveTemplateMappings(
      this.parseTemplateMapping(template.mapping),
      headers,
    );
  }

  private parseTemplateMapping(value: unknown): ImportTemplateMappingItem[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException('导入模板 mapping 格式无效');
    }

    return value as ImportTemplateMappingItem[];
  }
  private getMainTable(tables: RuntimeTableInfo[]) {
    const mainTable = tables.find((table) => table.type === FormTableType.MAIN);
    if (!mainTable) throw new BadRequestException('表单未配置主表');
    return mainTable;
  }

  private buildFieldMap(tables: RuntimeTableInfo[]) {
    const map = new Map<string, RuntimeField>();

    for (const table of tables) {
      for (const field of table.fields) {
        map.set(`${table.code}.${field.code}`, field);
      }
    }

    return map;
  }

  private validateRequiredFields(
    table: RuntimeTableInfo,
    data: Record<string, unknown>,
    errors: string[],
    label: string,
  ) {
    for (const field of table.fields) {
      if (field.required && !this.hasValue(data[field.code])) {
        errors.push(`${label}字段 ${field.name} 必填`);
      }
    }
  }

  private buildGroupKey(data: Record<string, unknown>, groupBy: string[]) {
    const values = groupBy.map((fieldCode) => data[fieldCode]);

    if (values.some((value) => !this.hasValue(value))) {
      return '';
    }

    return values.map((value) => String(value).trim()).join('||');
  }

  private isEmptyObject(value: Record<string, unknown>) {
    return Object.values(value).every((item) => !this.hasValue(item));
  }

  private async loadTemplateConfig(tenantId: string, templateId: string) {
    const template = await this.prisma.importTemplate.findFirst({
      where: {
        id: templateId,
        tenantId,
        isActive: true,
      },
      select: {
        config: true,
      },
    });

    return template?.config as { mode?: string; groupBy?: string[] } | null;
  }

  private getGroupByFromConfig(
    config: { mode?: string; groupBy?: string[] } | null,
  ) {
    if (config?.mode !== 'SINGLE_SHEET_GROUP') return [];
    return Array.isArray(config.groupBy) ? config.groupBy : [];
  }

  private resolveTemplateMappings(
    templateMapping: ImportTemplateMappingItem[],
    headers: string[],
  ): ImportFieldMappingDto[] {
    const headerSet = new Set(headers.map((item) => item.trim()));
    const result: ImportFieldMappingDto[] = [];

    for (const item of templateMapping) {
      const candidates = [item.header, ...(item.aliases ?? [])]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.trim());

      const matchedHeader = candidates.find((candidate) =>
        headerSet.has(candidate),
      );

      if (!matchedHeader) continue;

      const mapping: ImportFieldMappingDto = {
        header: matchedHeader,
        fieldCode: item.fieldCode,
        tableCode: item.tableCode ?? 'main',
      };

      if (item.defaultValue !== undefined) {
        mapping.defaultValue = item.defaultValue;
      }

      result.push(mapping);
    }

    return result;
  }

  async createTask(user: CurrentUser, dto: CreateImportTaskDto) {
    const tenantId = requireTenantId(user);
    await this.fileService.findOne(user, dto.fileId);

    const form = await this.ensureForm(tenantId, dto.formId, dto.formCode);

    const template = dto.templateId
      ? await this.importTemplateService.ensureUsableTemplate(
          tenantId,
          dto.templateId,
          form.code,
        )
      : await this.importTemplateService.findDefault(tenantId, form.code);

    return this.prisma.importTask.create({
      data: {
        tenantId,
        fileId: dto.fileId,
        templateId: template?.id,
        formId: form.id,
        formCode: form.code,
        sheetName: dto.sheetName,
        headerRow: dto.headerRow ?? 1,
        dataStartRow: dto.dataStartRow ?? 2,
        createdById: user.id,
      },
    });
  }

  async preview(user: CurrentUser, id: string, dto: PreviewImportTaskDto) {
    const task = await this.ensureTask(user, id);
    const parsed = await this.parseExcel(user, task);

    const previewRows = parsed.rows.slice(0, dto.limit ?? 20);

    const template = task.templateId
      ? await this.importTemplateService.ensureUsableTemplate(
          task.tenantId,
          task.templateId,
          task.formCode,
        )
      : await this.importTemplateService.findDefault(
          task.tenantId,
          task.formCode,
        );

    const suggestedMappings = template
      ? this.resolveTemplateMappings(
          this.parseTemplateMapping(template.mapping),
          parsed.headers,
        )
      : [];

    const preview = {
      sheetName: parsed.sheetName,
      headers: parsed.headers,
      previewRows,
      template: template
        ? {
            id: template.id,
            code: template.code,
            name: template.name,
          }
        : null,
      suggestedMappings,
    };

    return this.prisma.importTask.update({
      where: { id },
      data: {
        status: ImportTaskStatus.PREVIEWED,
        preview: this.toJson(preview),
        totalRows: parsed.rows.length,
      },
    });
  }

  async validate(user: CurrentUser, id: string, dto: ValidateImportTaskDto) {
    const task = await this.ensureTask(user, id);
    const parsed = await this.parseExcel(user, task);
    const tables = await this.loadRuntimeTables(task.tenantId, task.formId);

    const mappingSource =
      dto.mappings && dto.mappings.length > 0
        ? dto.mappings
        : await this.resolveTaskTemplateMappings(task, parsed.headers);

    const mapping = this.normalizeMapping(mappingSource, tables);
    const mappedHeaders = new Set(mapping.map((item) => item.header));

    const templateConfig = task.templateId
      ? await this.loadTemplateConfig(task.tenantId, task.templateId)
      : null;

    const groupBy =
      dto.groupBy && dto.groupBy.length > 0
        ? dto.groupBy
        : this.getGroupByFromConfig(templateConfig);

    const rawRows = parsed.rows.filter(
      (row) => !dto.skipEmptyRows || !this.isEmptyRawRow(row, mappedHeaders),
    );

    const rowResults: ImportRowValidationResult[] =
      groupBy.length > 0
        ? this.validateGroupedRows(rawRows, mapping, tables, groupBy)
        : rawRows.map((rawRow) =>
            this.validateMainOnlyRow(rawRow, mapping, tables),
          );

    await this.prisma.$transaction(async (tx) => {
      await tx.importTaskRow.deleteMany({ where: { taskId: task.id } });

      if (rowResults.length > 0) {
        await tx.importTaskRow.createMany({
          data: rowResults.map((row) => ({
            taskId: task.id,
            rowNumber: row.rowNumber,
            status:
              row.errors.length > 0
                ? ImportTaskRowStatus.INVALID
                : ImportTaskRowStatus.VALID,
            rawData: this.toJson(row.rawData)!,
            mappedData: this.toJson(row.mappedData),
            errors: this.toJson(row.errors),
          })),
        });
      }

      await tx.importTask.update({
        where: { id: task.id },
        data: {
          status: ImportTaskStatus.VALIDATED,
          mapping: this.toJson(mapping),
          totalRows: rowResults.length,
          failedRows: rowResults.filter((item) => item.errors.length > 0)
            .length,
          successRows: 0,
          error: null,
        },
      });
    });

    return this.findOne(user, id);
  }

  private toRuntimeCreatePayload(
    task: { formCode: string; formId: string | null },
    mappedData: unknown,
  ): GroupedMappedData {
    const value = mappedData as Partial<GroupedMappedData>;

    if (value.mainData && Array.isArray(value.details)) {
      return {
        mainData: value.mainData,
        details: value.details,
      };
    }

    return {
      mainData: mappedData as Record<string, unknown>,
      details: [],
    };
  }

  private validateGroupedRows(
    rows: Array<{ rowNumber: number; rawData: Record<string, unknown> }>,
    mappings: ImportFieldMappingDto[],
    tables: RuntimeTableInfo[],
    groupBy: string[],
  ): ImportRowValidationResult[] {
    const mainTable = this.getMainTable(tables);
    const fieldMap = this.buildFieldMap(tables);
    const groups = new Map<
      string,
      {
        firstRowNumber: number;
        rawRows: Record<string, unknown>[];
        rowNumbers: number[];
        mainData: Record<string, unknown>;
        detailsMap: Map<string, Record<string, unknown>[]>;
        errors: string[];
      }
    >();

    for (const row of rows) {
      const rowErrors: string[] = [];
      const rowMainData: Record<string, unknown> = {};
      const rowDetailsMap = new Map<string, Record<string, unknown>>();

      for (const mapping of mappings) {
        const tableCode = mapping.tableCode ?? 'main';
        const tableKey = tableCode === 'main' ? mainTable.code : tableCode;
        const fieldKey = `${tableKey}.${mapping.fieldCode}`;
        const field = fieldMap.get(fieldKey);

        if (!field) {
          rowErrors.push(`字段不存在：${tableCode}.${mapping.fieldCode}`);
          continue;
        }

        const rawValue = row.rawData[mapping.header];
        const value = this.hasValue(rawValue) ? rawValue : mapping.defaultValue;

        try {
          const casted = this.castValue(field, value);

          if (tableCode === 'main' || tableCode === mainTable.code) {
            rowMainData[mapping.fieldCode] = casted;
          } else {
            const detailRow = rowDetailsMap.get(tableCode) ?? {};
            detailRow[mapping.fieldCode] = casted;
            rowDetailsMap.set(tableCode, detailRow);
          }
        } catch (error) {
          rowErrors.push(
            error instanceof Error
              ? `${tableCode}.${field.name}: ${error.message}`
              : `${tableCode}.${field.name}: 格式错误`,
          );
        }
      }

      const groupKey = this.buildGroupKey(rowMainData, groupBy);

      if (!groupKey) {
        rowErrors.push(`分组字段不能为空：${groupBy.join(', ')}`);
      }

      const safeGroupKey = groupKey || `__invalid_row_${row.rowNumber}`;

      const group = groups.get(safeGroupKey) ?? {
        firstRowNumber: row.rowNumber,
        rawRows: [],
        rowNumbers: [],
        mainData: {},
        detailsMap: new Map<string, Record<string, unknown>[]>(),
        errors: [],
      };

      group.rawRows.push(row.rawData);
      group.rowNumbers.push(row.rowNumber);
      group.errors.push(...rowErrors);

      for (const [key, value] of Object.entries(rowMainData)) {
        if (!this.hasValue(group.mainData[key]) && this.hasValue(value)) {
          group.mainData[key] = value;
        }
      }

      for (const [tableCode, detailRow] of rowDetailsMap.entries()) {
        if (this.isEmptyObject(detailRow)) continue;

        const list = group.detailsMap.get(tableCode) ?? [];
        list.push(detailRow);
        group.detailsMap.set(tableCode, list);
      }

      groups.set(safeGroupKey, group);
    }

    return Array.from(groups.values()).map((group) => {
      const errors = [...group.errors];

      this.validateRequiredFields(mainTable, group.mainData, errors, '主表');

      for (const table of tables.filter(
        (item) => item.type === FormTableType.SUB,
      )) {
        const detailRows = group.detailsMap.get(table.code) ?? [];

        detailRows.forEach((detailRow, index) => {
          this.validateRequiredFields(
            table,
            detailRow,
            errors,
            `${table.name}第${index + 1}行`,
          );
        });
      }

      return {
        rowNumber: group.firstRowNumber,
        rawData: {
          rowNumbers: group.rowNumbers,
          rows: group.rawRows,
        },
        mappedData: {
          mainData: group.mainData,
          details: Array.from(group.detailsMap.entries()).map(
            ([tableCode, detailRows]) => ({
              tableCode,
              rows: detailRows,
            }),
          ),
        },
        errors,
      };
    });
  }

  async execute(user: CurrentUser, id: string, dto: ExecuteImportTaskDto) {
    const task = await this.ensureTask(user, id);

    if (task.status !== ImportTaskStatus.VALIDATED) {
      throw new BadRequestException('请先完成导入校验');
    }

    const rows = await this.prisma.importTaskRow.findMany({
      where: { taskId: id, status: ImportTaskRowStatus.VALID },
      orderBy: { rowNumber: 'asc' },
    });

    await this.prisma.importTask.update({
      where: { id },
      data: { status: ImportTaskStatus.IMPORTING },
    });

    let successRows = 0;
    let failedRows = await this.prisma.importTaskRow.count({
      where: { taskId: id, status: ImportTaskRowStatus.INVALID },
    });

    for (const row of rows) {
      try {
        const mappedData = row.mappedData as unknown;

        const payload = this.toRuntimeCreatePayload(task, mappedData);

        const record = await this.runtimeFormService.create(user, {
          formId: task.formId ?? undefined,
          formCode: task.formCode,
          mainData: payload.mainData,
          details: payload.details,
          submit: dto.submit ?? false,
        });

        await this.prisma.importTaskRow.update({
          where: { id: row.id },
          data: {
            status: ImportTaskRowStatus.SUCCESS,
            recordId: record.id,
          },
        });

        successRows += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : '导入行失败';

        await this.prisma.importTaskRow.update({
          where: { id: row.id },
          data: {
            status: ImportTaskRowStatus.FAILED,
            errors: this.toJson([message]),
          },
        });

        failedRows += 1;
      }
    }

    const status =
      failedRows === 0
        ? ImportTaskStatus.SUCCESS
        : successRows > 0
          ? ImportTaskStatus.PARTIAL_SUCCESS
          : ImportTaskStatus.FAILED;

    return this.prisma.importTask.update({
      where: { id },
      data: {
        status,
        successRows,
        failedRows,
        executedAt: new Date(),
      },
      include: { rows: { orderBy: { rowNumber: 'asc' } } },
    });
  }

  async findMany(user: CurrentUser, query: QueryImportTaskDto) {
    const tenantId = requireTenantId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ImportTaskWhereInput = {
      tenantId,
      formCode: query.formCode,
      status: query.status,
    };

    const [total, list] = await this.prisma.$transaction([
      this.prisma.importTask.count({ where }),
      this.prisma.importTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { rows: true } } },
      }),
    ]);

    return { total, page, pageSize, list };
  }

  async findOne(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const item = await this.prisma.importTask.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { rows: true } } },
    });

    if (!item) throw new NotFoundException('导入任务不存在');

    const template = item.templateId
      ? await this.prisma.importTemplate.findFirst({
          where: { id: item.templateId, tenantId },
          select: { id: true, code: true, name: true, isActive: true },
        })
      : null;

    return { ...item, template };
  }

  async findRows(user: CurrentUser, id: string) {
    await this.ensureTask(user, id);

    return this.prisma.importTaskRow.findMany({
      where: { taskId: id },
      orderBy: { rowNumber: 'asc' },
    });
  }

  private async parseExcel(
    user: CurrentUser,
    task: {
      fileId: string;
      sheetName: string | null;
      headerRow: number;
      dataStartRow: number;
    },
  ) {
    const { file, buffer } = await this.fileService.readFileBuffer(
      user,
      task.fileId,
    );

    if (!file.originalName.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('第一版仅支持 .xlsx 文件');
    }

    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = task.sheetName ?? workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) throw new BadRequestException(`Sheet 不存在：${sheetName}`);

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
    });

    const headerIndex = task.headerRow - 1;
    const dataStartIndex = task.dataStartRow - 1;
    const headerRow = matrix[headerIndex] ?? [];

    const headers = headerRow.map((item) => this.cellToHeaderText(item).trim());

    const rows = matrix.slice(dataStartIndex).map((line, index) => {
      const rawData: Record<string, unknown> = {};

      headers.forEach((header, columnIndex) => {
        if (!header) return;
        rawData[header] = line[columnIndex] ?? '';
      });

      return {
        rowNumber: dataStartIndex + index + 1,
        rawData,
      };
    });

    return { sheetName, headers: headers.filter(Boolean), rows };
  }

  private validateMainOnlyRow(
    row: { rowNumber: number; rawData: Record<string, unknown> },
    mappings: ImportFieldMappingDto[],
    tables: RuntimeTableInfo[],
  ): ImportRowValidationResult {
    const mainTable = this.getMainTable(tables);
    const fieldMap = new Map(
      mainTable.fields.map((field) => [field.code, field]),
    );
    const errors: string[] = [];
    const mappedData: Record<string, unknown> = {};

    for (const item of mappings.filter(
      (mapping) => !mapping.tableCode || mapping.tableCode === 'main',
    )) {
      const field = fieldMap.get(item.fieldCode);
      if (!field) continue;

      const rawValue = row.rawData[item.header];
      const value = this.hasValue(rawValue) ? rawValue : item.defaultValue;

      try {
        mappedData[item.fieldCode] = this.castValue(field, value);
      } catch (error) {
        errors.push(
          error instanceof Error
            ? `${field.name}: ${error.message}`
            : `${field.name}: 格式错误`,
        );
      }
    }

    this.validateRequiredFields(mainTable, mappedData, errors, '主表');

    return {
      rowNumber: row.rowNumber,
      rawData: row.rawData,
      mappedData,
      errors,
    };
  }

  private castValue(field: RuntimeField, value: unknown) {
    if (!this.hasValue(value)) return null;

    if (
      field.type === FormFieldType.TEXT ||
      field.type === FormFieldType.TEXTAREA ||
      field.type === FormFieldType.DICTIONARY ||
      field.type === FormFieldType.DATASOURCE ||
      field.type === FormFieldType.USER
    ) {
      return String(value).trim();
    }

    if (
      field.type === FormFieldType.NUMBER ||
      field.type === FormFieldType.DECIMAL ||
      field.type === FormFieldType.MONEY
    ) {
      const numberValue = Number(String(value).replace(/,/g, ''));
      if (!Number.isFinite(numberValue)) throw new Error('必须是数字');
      return numberValue;
    }

    if (field.type === FormFieldType.BOOLEAN) {
      const text = String(value).trim().toLowerCase();
      if (['true', '1', 'yes', 'y', '是'].includes(text)) return true;
      if (['false', '0', 'no', 'n', '否'].includes(text)) return false;
      throw new Error('必须是布尔值');
    }

    if (
      field.type === FormFieldType.DATE ||
      field.type === FormFieldType.DATETIME
    ) {
      return String(value).trim();
    }

    if (
      field.type === FormFieldType.ATTACHMENT ||
      field.type === FormFieldType.IMAGE
    ) {
      return String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return value;
  }

  private normalizeMapping(
    mappings: ImportFieldMappingDto[],
    tables: RuntimeTableInfo[],
  ) {
    const tableMap = new Map(tables.map((table) => [table.code, table]));
    const mainTable = this.getMainTable(tables);
    const usedTargets = new Set<string>();

    for (const item of mappings) {
      const tableCode = item.tableCode ?? 'main';
      const runtimeTable =
        tableCode === 'main' ? mainTable : tableMap.get(tableCode);

      if (!runtimeTable) {
        throw new BadRequestException(`表不存在：${tableCode}`);
      }

      const field = runtimeTable.fields.find(
        (fieldItem) => fieldItem.code === item.fieldCode,
      );

      if (!field) {
        throw new BadRequestException(
          `字段不存在：${tableCode}.${item.fieldCode}`,
        );
      }

      const targetKey = `${runtimeTable.code}.${item.fieldCode}`;

      if (usedTargets.has(targetKey)) {
        throw new BadRequestException(`目标字段重复映射：${targetKey}`);
      }

      usedTargets.add(targetKey);
    }

    return mappings.map((item) => ({
      ...item,
      tableCode: item.tableCode ?? 'main',
    }));
  }

  private async loadRuntimeTables(tenantId: string, formId: string | null) {
    const version = await this.prisma.formVersion.findFirst({
      where: {
        tenantId,
        formId: formId ?? undefined,
        status: FormVersionStatus.PUBLISHED,
      },
      orderBy: { version: 'desc' },
    });

    if (!version) throw new BadRequestException('表单尚未发布');

    const snapshot = version.snapshot as unknown as FormSnapshot;

    return snapshot.tables.map((table) => ({
      code: table.code,
      name: table.name,
      type: table.type,
      fields: table.fields.map((field) => ({
        code: field.code,
        name: field.name,
        type: field.type,
        required: field.required,
      })),
    }));
  }

  private async ensureForm(
    tenantId: string,
    formId?: string,
    formCode?: string,
  ) {
    const form = await this.prisma.formDefinition.findFirst({
      where: {
        tenantId,
        status: FormStatus.ENABLED,
        ...(formId ? { id: formId } : { code: formCode }),
      },
    });

    if (!form) throw new NotFoundException('启用表单不存在');
    return form;
  }

  private async ensureTask(user: CurrentUser, id: string) {
    const tenantId = requireTenantId(user);

    const task = await this.prisma.importTask.findFirst({
      where: { id, tenantId },
    });

    if (!task) throw new NotFoundException('导入任务不存在');
    return task;
  }

  private isEmptyRawRow(
    row: { rawData: Record<string, unknown> },
    headers: Set<string>,
  ) {
    return Array.from(headers).every(
      (header) => !this.hasValue(row.rawData[header]),
    );
  }

  private cellToHeaderText(value: unknown): string {
    if (value === undefined || value === null) return '';

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value);
    }

    return '';
  }

  private hasValue(value: unknown) {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && value !== '';
  }

  private toJson(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
