import {
  ListViewColumnSource,
  ListViewFilterOperator,
  ListViewSortDirection,
  Prisma,
} from '../generated/prisma/client';
import type { FormSnapshot } from '../form-snapshot/form-snapshot.types';

export type DynamicQuerySnapshotTable = FormSnapshot['tables'][number];
export type DynamicQuerySnapshotField =
  DynamicQuerySnapshotTable['fields'][number];

export type DynamicQueryPhysicalTable = Prisma.FormPhysicalTableGetPayload<{
  include: { columns: true };
}>;

export type DynamicQueryColumnInput = {
  source: ListViewColumnSource;
  systemKey?: string | null;
  fieldId?: string | null;
  fieldCode?: string | null;
  title?: string | null;
  hidden?: boolean | null;
  sortable?: boolean | null;
  sortDirection?: ListViewSortDirection | null;
  sort?: number | null;
};

export type DynamicQueryFilterInput = {
  source: ListViewColumnSource;
  systemKey?: string | null;
  fieldId?: string | null;
  fieldCode?: string | null;
  operator: ListViewFilterOperator;
  value?: unknown;
  valueTo?: unknown;
  values?: unknown[];
  defaultValue?: unknown;
  required?: boolean | null;
  sort?: number | null;
};

export type DynamicQuerySortInput = {
  source: ListViewColumnSource;
  systemKey?: string | null;
  fieldId?: string | null;
  fieldCode?: string | null;
  direction: ListViewSortDirection;
};

export type DynamicQueryRequest = {
  page?: number;
  pageSize?: number;
  filters?: DynamicQueryFilterInput[];
  sorts?: DynamicQuerySortInput[];
};

export type DynamicQueryPlanInput = {
  tenantId: string;
  formId: string;
  mainTable: DynamicQuerySnapshotTable;
  physicalTable: DynamicQueryPhysicalTable;
  columns: DynamicQueryColumnInput[];
  filters?: DynamicQueryFilterInput[];
  query?: DynamicQueryRequest;
  maxPageSize?: number;
};

export type DynamicQueryAlias = {
  alias: string;
  outputKey: string;
  isOption: boolean;
};

export type DynamicQueryPlan = {
  countSql: string;
  listSql: string;
  values: unknown[];
  aliases: DynamicQueryAlias[];
  page: number;
  pageSize: number;
  visibleColumns: DynamicQueryColumnInput[];
};
