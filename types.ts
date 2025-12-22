
export interface DbConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
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
  PRODUCTS = 'products'
}

export type DateField = 'production_date' | 'dtime_ins';
