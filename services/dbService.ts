
import { DbConnection, Product, QueryResult, FullCodeRecord, DateField } from '../types';
import * as XLSX from 'xlsx';

/**
 * Deterministic helper to simulate a consistent "database" count.
 * Returns the same number for the same GTIN and Date.
 */
const getStableCount = (gtin: string, date: string): number => {
  let hash = 0;
  const str = gtin + date;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 450) + 50; // Returns consistent number between 50 and 500
};

export const exportResultsToExcel = (data: QueryResult[], totalCount: number | null, filename: string) => {
  const headers = ['Наименование', 'GTIN', 'Кол-во в БД'];
  const table = data.map(row => [
    row.productName || row.gtin,
    row.gtin,
    row.count
  ]);

  const total = totalCount ?? data.reduce((acc, curr) => acc + curr.count, 0);
  const worksheet = XLSX.utils.aoa_to_sheet([
    headers,
    ...table,
    ['Итого найдено записей', '', total]
  ]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Результаты');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

export const generateSqlQuery = (
  selectedGtin: string | 'all',
  startDate: string,
  endDate: string | null,
  dateField: DateField,
  countOnly: boolean = false,
  status: string = 'all'
): string => {
  const selectClause = countOnly ? 'SELECT count(*)' : 'SELECT *';

  // Logic from prompt:
  // IF product selected: WHERE code LIKE (gtin) AND date >= (start) [AND date <= (end)]
  // IF all selected: WHERE date >= (start) [AND date <= (end)]

  let whereClause = "";
  if (endDate) {
    whereClause = `${dateField}::date >= '${startDate}' AND ${dateField}::date <= '${endDate}'`;
  } else {
    // For a single date, use equality (=) so the SQL matches a single-day filter exactly
    whereClause = `${dateField}::date = '${startDate}'`;
  }

  if (selectedGtin !== 'all') {
    whereClause = `code LIKE '%${selectedGtin}%' AND ` + whereClause;
  }

  if (status !== 'all') {
    whereClause = `status = '${status}' AND ` + whereClause;
  }

  return `${selectClause} FROM codes WHERE ${whereClause};`;
};

export const mockFetchSummary = async (
  products: Product[],
  gtin: string | 'all',
  startDate: string,
  endDate: string | null
): Promise<QueryResult[]> => {
  // Artificial delay to simulate DB latency
  await new Promise(r => setTimeout(r, 600));

  const itemsToProcess = gtin === 'all' ? products : products.filter(p => p.gtin === gtin);

  return itemsToProcess.map(p => ({
    productName: p.name,
    gtin: p.gtin,
    count: getStableCount(p.gtin, startDate + (endDate || ''))
  }));
};

export const exportToCsv = (data: any[], filename: string, columnMap?: { [key: string]: string }) => {
  if (data.length === 0) return;

  const keys = Object.keys(data[0]);
  const headers = keys.map(k => columnMap ? (columnMap[k] || k) : k);

  const csvRows = [
    headers.join(','),
    ...data.map(row => keys.map(k => {
      const val = row[k];
      if (val === null || val === undefined) return '';
      const s = String(val).replace(/"/g, '""');
      return (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) ? `"${s}"` : s;
    }).join(','))
  ];

  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToExcel = (data: any[], filename: string, columnMap?: { [key: string]: string }) => {
  // If columnMap is provided, rename keys to labels
  let processedData = data;
  if (columnMap) {
    processedData = data.map(item => {
      const newItem: any = {};
      Object.keys(item).forEach(key => {
        const label = columnMap[key] || key;
        newItem[label] = item[key];
      });
      return newItem;
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(processedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');
  XLSX.writeFile(workbook, `${filename}.xlsx`, { bookSST: true });
};

export const mockFetchFullRecords = async (gtin: string | 'all', count: number, date: string): Promise<FullCodeRecord[]> => {
  const records: FullCodeRecord[] = [];
  const gtinBase = gtin === 'all' ? '04600000000000' : gtin;

  for (let i = 0; i < Math.min(count, 1000); i++) {
    const id = 64262 + i;
    // We use exactly the queried date for the records as requested
    records.push({
      id,
      dtime_ins: `${date} 00:00:00.000`,
      code: `01${gtinBase}${Math.random().toString(36).substring(7).toUpperCase()} 91EE11 92...`,
      status: 1,
      dtime_status: `${date} 18:31:18.943`,
      production_date: date
    });
  }
  return records;
};
