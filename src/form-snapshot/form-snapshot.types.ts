import {
  FormFieldType,
  FormStatus,
  FormTableType,
} from '../generated/prisma/client';

export type FormSnapshot = {
  schemaVersion: 1;
  form: {
    id: string;
    tenantId: string;
    code: string;
    name: string;
    description: string | null;
    status: FormStatus;
    version: number;
    layout: unknown;
    config: unknown;
  };
  tables: Array<{
    id: string;
    parentId: string | null;
    code: string;
    name: string;
    type: FormTableType;
    layout: unknown;
    config: unknown;
    sort: number;
    fields: Array<{
      id: string;
      code: string;
      name: string;
      type: FormFieldType;
      required: boolean;
      unique: boolean;
      readonly: boolean;
      hidden: boolean;
      defaultValue: unknown;
      dictionaryCode: string | null;
      dataSourceCode: string | null;
      dataSourceMapping: unknown;
      formula: unknown;
      validationRules: unknown;
      visibleWhen: unknown;
      config: unknown;
      sort: number;
    }>;
  }>;
  publishedAt: string;
  publishedById: string;
};
