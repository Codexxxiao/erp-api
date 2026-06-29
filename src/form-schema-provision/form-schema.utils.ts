import { FormFieldType } from '../generated/prisma/client';

export function normalizeIdentifier(input: string) {
  const value = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^([0-9])/, '_$1')
    .replace(/^_+/, '')
    .slice(0, 40);

  return value || 'x';
}

export function quoteIdentifier(identifier: string) {
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(identifier)) {
    throw new Error(`非法数据库标识符：${identifier}`);
  }

  return `"${identifier}"`;
}

export function buildPhysicalTableName(params: {
  tenantCode: string;
  formCode: string;
  tableCode: string;
  tableId: string;
}) {
  const suffix = `_${params.tableId.replace(/-/g, '').slice(0, 8).toLowerCase()}`;
  const base = [
    'rt',
    normalizeIdentifier(params.tenantCode),
    normalizeIdentifier(params.formCode),
    normalizeIdentifier(params.tableCode),
  ].join('_');

  return `${base.slice(0, 63 - suffix.length)}${suffix}`;
}

export function buildPhysicalColumnName(fieldCode: string, fieldId: string) {
  const suffix = `_${fieldId.replace(/-/g, '').slice(0, 8).toLowerCase()}`;
  const base = `c_${normalizeIdentifier(fieldCode)}`;

  return `${base.slice(0, 63 - suffix.length)}${suffix}`;
}

export function buildDerivedColumnName(
  baseColumnName: string,
  suffix: '_label' | '_extra',
) {
  return `${baseColumnName.slice(0, 63 - suffix.length)}${suffix}`;
}

export function buildIndexName(tableName: string, suffix: string) {
  const normalizedSuffix = `_${normalizeIdentifier(suffix)}`;
  const base = `idx_${tableName}`;

  return `${base.slice(0, 63 - normalizedSuffix.length)}${normalizedSuffix}`;
}

export function mapFieldTypeToSql(type: FormFieldType) {
  switch (type) {
    case FormFieldType.TEXT:
    case FormFieldType.TEXTAREA:
    case FormFieldType.DICTIONARY:
    case FormFieldType.DATASOURCE:
    case FormFieldType.USER:
      return 'text';

    case FormFieldType.NUMBER:
      return 'integer';

    case FormFieldType.DECIMAL:
    case FormFieldType.MONEY:
      return 'numeric(18,4)';

    case FormFieldType.DATE:
      return 'date';

    case FormFieldType.DATETIME:
      return 'timestamptz';

    case FormFieldType.BOOLEAN:
      return 'boolean';

    case FormFieldType.ATTACHMENT:
    case FormFieldType.IMAGE:
      return 'jsonb';

    default:
      return 'text';
  }
}
