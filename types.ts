
export interface DbConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
}

export interface Settings {
  connections: DbConnection[];
  products: Product[];
  fieldLabels?: Record<string, string>;
}

export interface Product {
  id: string;
  name: string;
  gtin: string; // Must be 14 digits, starts with 046
}

export interface QueryResult {
  productName: string;
  gtin: string;
  count: number;
}

export interface FullCodeRecord {
  id: number;
  dtime_ins: string;
  code: string;
  status: number;
  dtime_status: string;
  grcode?: string;
  dtime_grcode?: string;
  sscc?: string;
  dtime_sscc?: string;
  production_date: string;
}

export enum ViewMode {
  DASHBOARD = 'dashboard',
  CONNECTIONS = 'connections',
  PRODUCTS = 'products',
  FIELD_NAMES = 'field_names'
}

export type DateField = 'production_date' | 'dtime_ins';

export const ALL_CODE_FIELDS: { key: keyof FullCodeRecord; label: string }[] = [
  { key: 'id', label: 'ID' },
  { key: 'dtime_ins', label: 'Дата вставки (dtime_ins)' },
  { key: 'code', label: 'Код (code)' },
  { key: 'status', label: 'Статус (status)' },
  { key: 'dtime_status', label: 'Дата статуса (dtime_status)' },
  { key: 'grcode', label: 'Grcode' },
  { key: 'dtime_grcode', label: 'Дата Grcode' },
  { key: 'sscc', label: 'SSCC' },
  { key: 'dtime_sscc', label: 'Дата SSCC' },
  { key: 'production_date', label: 'Дата производства' }
];
