
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
  AGGREGATION = 'aggregation',
  CONNECTIONS = 'connections',
  PRODUCTS = 'products',
  FIELD_NAMES = 'field_names',
  PRINT = 'print',
  MAINTENANCE = 'maintenance'
}

export type AggregationLevel = 'sscc1' | 'sscc' | 'grcode' | 'code';

export interface AggregationLevelSummary {
  level: 'sscc1' | 'sscc' | 'grcode';
  distinctCount: number;
  itemsCount: number;
}

export interface SummaryAggregationInfo {
  levels: Array<'sscc1' | 'sscc' | 'grcode'>;
  stats: AggregationLevelSummary[];
  unaggregatedCount: number;
}

export interface AggregationNode {
  level: 'sscc1' | 'sscc' | 'grcode';
  code: string;
  itemsCount: number;
  childLevel: AggregationLevel | null;
  childCount: number;
  gtins: string[];
  lastDate: string | null;
}

export interface AggregationLeafRecord {
  id?: number;
  code: string;
  status?: number | string;
  production_date?: string;
  dtime_ins?: string;
  dtime_status?: string;
  grcode?: string | null;
  sscc?: string | null;
  sscc1?: string | null;
}

export interface AggregationPartialAnomaly {
  childLevel: 'sscc' | 'grcode';
  parentLevel: 'sscc1' | 'sscc';
  containersCount: number;
  itemsCount: number;
}

export interface AggregationIrregularItem {
  code: string;
  count: number;
  expectedCount: number;
}

export interface AggregationIrregularGroup {
  level: 'sscc1' | 'sscc' | 'grcode';
  expectedCount: number;
  totalContainers: number;
  irregularCount: number;
  samples: AggregationIrregularItem[];
}

export interface AggregationOverview {
  availableLevels: Array<'sscc1' | 'sscc' | 'grcode'>;
  activeRootLevel: 'sscc1' | 'sscc' | 'grcode' | null;
  totalCodes: number;
  unaggregatedCount: number;
  levelStats: AggregationLevelSummary[];
  nodes: AggregationNode[];
  totalNodesCount: number;
  anomalies: {
    unaggregatedCount: number;
    partialLevels: AggregationPartialAnomaly[];
    irregularGroups: AggregationIrregularGroup[];
  };
}

export interface AggregationSearchResult {
  found: boolean;
  matchedLevel?: AggregationLevel;
  matchedValue?: string;
  exactMatch?: boolean;
  availableLevels: Array<'sscc1' | 'sscc' | 'grcode'>;
  chain?: {
    sscc1: string | null;
    sscc: string | null;
    grcode: string | null;
    code: string | null;
  };
  itemsCount?: number;
  childLevel?: AggregationLevel | null;
  childCount?: number;
  children?: AggregationNode[];
  leaves?: AggregationLeafRecord[];
  matches?: Array<{ level: AggregationLevel; value: string; itemsCount: number }>;
}

export interface AggregationFilterPreset {
  dbId?: string;
  selectedProductGtin?: string;
  dateField?: DateField;
  startDate?: Date | null;
  endDate?: Date | null;
  isRange?: boolean;
  selectedStatus?: string;
  customStatus?: string;
}

export type DateField = 'production_date' | 'dtime_ins';

export interface CodeField {
  key: string;
  label: string;
  dataType?: string;
  isCustom?: boolean;
}

export const ALL_CODE_FIELDS: CodeField[] = [
  { key: 'id', label: 'ID' },
  { key: 'dtime_ins', label: 'Дата вставки (dtime_ins)' },
  { key: 'code', label: 'Код (code)' },
  { key: 'status', label: 'Статус (status)' },
  { key: 'dtime_status', label: 'Дата статуса (dtime_status)' },
  { key: 'grcode', label: 'Grcode' },
  { key: 'dtime_grcode', label: 'Дата Grcode' },
  { key: 'sscc', label: 'SSCC' },
  { key: 'dtime_sscc', label: 'Дата SSCC' },
  { key: 'sscc1', label: 'SSCC1' },
  { key: 'dtime_sscc1', label: 'Дата SSCC1' },
  { key: 'production_date', label: 'Дата производства' }
];
