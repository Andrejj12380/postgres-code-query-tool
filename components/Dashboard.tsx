
import React, { useState, useRef } from 'react';
import { DbConnection, Product, QueryResult, DateField } from '../types';
import { generateSqlQuery, exportToCsv, exportResultsToExcel } from '../services/dbService';

interface DashboardProps {
  connections: DbConnection[];
  products: Product[];
}

const Dashboard: React.FC<DashboardProps> = ({ connections, products }) => {
  const [selectedDb, setSelectedDb] = useState<string>('');
  const [selectedProductGtin, setSelectedProductGtin] = useState<string>('all');
  const [dateField, setDateField] = useState<DateField>('production_date');
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isRange, setIsRange] = useState(false);

  const formatDate = (d: Date | null) => {
    if (!d) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<QueryResult[]>([]);
  const [lastQuery, setLastQuery] = useState<string>('');
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const startInputRef = useRef<HTMLInputElement | null>(null);
  const endInputRef = useRef<HTMLInputElement | null>(null);

  const handleQuery = async () => {
    if (!selectedDb) {
      alert('Пожалуйста, выберите базу данных');
      return;
    }

    if (!startDate) {
      alert('Пожалуйста, выберите дату начала');
      return;
    }

    const conn = connections.find(c => c.id === selectedDb);
    if (!conn) {
      alert('Подключение не найдено');
      return;
    }

    setIsLoading(true);
    try {
      const sql = generateSqlQuery(selectedProductGtin, formatDate(startDate), isRange ? formatDate(endDate) : null, dateField, false);
      setLastQuery(sql);

      const apiBase = (import.meta.env.VITE_API_BASE as string) || '';
      const url = apiBase ? `${apiBase}/api/summary` : `/api/summary`;

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: conn,
          selectedGtin: selectedProductGtin,
          startDate: formatDate(startDate),
          endDate: isRange ? formatDate(endDate) : null,
          dateField
        })
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(errText || 'Server error');
      }

      const respJson = await resp.json() as { rows: Array<{ gtin: string; count: number }>, totalCount: number, prefixCount: number, nonPrefixCount: number };
      const data = respJson.rows || [];
      let mappedResults: QueryResult[] = [];

      if (selectedProductGtin === 'all') {
        // Rows show counts per GTIN *only for codes starting with 01046*
        mappedResults = data.map(d => {
          const prod = products.find(p => p.gtin === d.gtin);
          return {
            productName: prod ? prod.name : (d.gtin || 'Unknown'),
            gtin: d.gtin || '',
            count: d.count || 0
          };
        });

        // Add summary rows (these are NOT included in the total footer - footer uses server totalCount)
        mappedResults.push({ productName: `Начинаются с 01046`, gtin: '01046', count: respJson.prefixCount || 0 });
        mappedResults.push({ productName: `Подозрительные (не начинаются с 01046)`, gtin: '-', count: respJson.nonPrefixCount || 0 });
      } else {
        // For single product, we show the total matches for that product (respecting filters) and also prefix/non-prefix counts
        const total = data.reduce((acc, curr) => acc + (curr.count || 0), 0);
        const prod = products.find(p => p.gtin === selectedProductGtin);
        mappedResults = [{
          productName: prod ? prod.name : selectedProductGtin,
          gtin: selectedProductGtin,
          count: total
        }];

        mappedResults.push({ productName: `Начинаются с 01046`, gtin: '01046', count: respJson.prefixCount || 0 });
        mappedResults.push({ productName: `Подозрительные (не начинаются с 01046)`, gtin: '-', count: respJson.nonPrefixCount || 0 });
      }

      setResults(mappedResults);
      setTotalCount(respJson.totalCount ?? 0);
    } catch (err) {
      console.error(err);
      alert('Ошибка при выполнении запроса: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsLoading(false);
    }
  };

  const handleExcelExport = () => {
    if (results.length === 0) return;
    const filename = `summary_${selectedProductGtin}_${formatDate(startDate)}`;
    exportResultsToExcel(results, totalCount, filename);
  };

  const handleExport = async () => {
    if (!selectedDb || results.length === 0) return;
    
    const conn = connections.find(c => c.id === selectedDb);
    if (!conn) {
      alert('Подключение не найдено');
      return;
    }

    setIsLoading(true);
    try {
      const totalCount = results.reduce((acc, curr) => acc + curr.count, 0);

      const apiBase = (import.meta.env.VITE_API_BASE as string) || '';
      const url = apiBase ? `${apiBase}/api/full` : `/api/full`;

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: conn,
          selectedGtin: selectedProductGtin,
          startDate: formatDate(startDate),
          endDate: isRange ? formatDate(endDate) : null,
          dateField,
          limit: Math.min(totalCount, 10000),
          exportAll: true
        })
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(errText || 'Server error');
      }

      const records = await resp.json() as any[];
      const filename = `export_${selectedProductGtin}_${formatDate(startDate)}`;
      exportToCsv(records, filename);
    } catch (err) {
      console.error(err);
      alert('Ошибка при выгрузке: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <h2 className="text-2xl font-bold mb-6">Запрос данных</h2>

      {/* Filter Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Step 1: DB */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">1. База данных</label>
          <select 
            className="w-full border border-gray-300 rounded-lg p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
            value={selectedDb}
            onChange={e => setSelectedDb(e.target.value)}
          >
            <option value="">Выберите подключение...</option>
            {connections.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.host})</option>
            ))}
          </select>
        </div>

        {/* Step 2: Product */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">2. Продукция</label>
          <select 
            className="w-full border border-gray-300 rounded-lg p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
            value={selectedProductGtin}
            onChange={e => setSelectedProductGtin(e.target.value)}
          >
            <option value="all">Все наименования</option>
            {products.map(p => (
              <option key={p.id} value={p.gtin}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Step 3: Date Field */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">3. Поле даты</label>
          <div className="flex gap-4 p-1 bg-gray-100 rounded-lg">
            <button 
              onClick={() => setDateField('production_date')}
              className={`flex-1 py-1 px-3 rounded-md text-sm font-medium transition-all ${dateField === 'production_date' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
            >
              Production Date
            </button>
            <button 
              onClick={() => setDateField('dtime_ins')}
              className={`flex-1 py-1 px-3 rounded-md text-sm font-medium transition-all ${dateField === 'dtime_ins' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
            >
              Dtime Ins
            </button>
          </div>
        </div>

        {/* Step 4: Dates */}
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-semibold text-gray-700">4. Период (выбор календарем или ввод вручную)</label>
          <div className="flex flex-wrap items-end gap-4">
             <div className="flex flex-col gap-1 relative group">
                <span className="text-[10px] uppercase text-gray-400 font-bold">От / Дата</span>
                <div className="relative">
                    <div onClick={() => startInputRef.current?.focus()} className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 cursor-pointer">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="Refine 8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                      ref={startInputRef}
                      type="date"
                      className="border border-gray-300 rounded-lg p-2 pl-9 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors min-w-[200px] cursor-pointer"
                      value={formatDate(startDate)}
                      onChange={e => setStartDate(e.target.value ? new Date(e.target.value) : null)}
                      title="Выберите дату или введите её"
                  />
                </div>
             </div>
             
             {isRange && (
               <div className="flex flex-col gap-1 relative animate-fadeIn">
                 <span className="text-[10px] uppercase text-gray-400 font-bold">До</span>
                 <div className="relative">
                    <div onClick={() => endInputRef.current?.focus()} className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 cursor-pointer">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="Refine 8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                        ref={endInputRef}
                        type="date"
                        className="border border-gray-300 rounded-lg p-2 pl-9 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors min-w-[200px] cursor-pointer"
                        value={formatDate(endDate)}
                        onChange={e => setEndDate(e.target.value ? new Date(e.target.value) : null)}
                        title="Выберите дату или введите её"
                    />
                 </div>
               </div>
             )}

             <div className="flex items-center h-[42px]">
               <label className="inline-flex items-center cursor-pointer group">
                 <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={isRange}
                    onChange={e => setIsRange(e.target.checked)}
                 />
                 <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                 <span className="ms-3 text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">Диапазон</span>
               </label>
             </div>
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-end md:col-span-1">
          <button 
            disabled={isLoading}
            onClick={handleQuery}
            className={`w-full h-[42px] bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${isLoading ? 'opacity-50 cursor-not-allowed shadow-inner' : 'shadow-md active:scale-95'}`}
          >
            {isLoading ? (
              <span className="animate-spin text-xl">⏳</span>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Запросить данные
              </>
            )}
          </button>
        </div>
      </div>

      {/* SQL Preview */}
      {lastQuery && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 animate-slideUp">
          <div className="flex items-center gap-2 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            <span className="text-[10px] uppercase font-bold text-slate-400">Generated SQL</span>
          </div>
          <code className="text-xs text-slate-600 font-mono break-all">{lastQuery}</code>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 ? (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden animate-slideUp">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <h3 className="font-bold text-gray-700 uppercase text-xs tracking-wider">Результаты поиска</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={handleExport}
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm active:scale-95 disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Выгрузить в CSV
              </button>
              <button
                onClick={handleExcelExport}
                disabled={isLoading}
                className="bg-lime-600 hover:bg-lime-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm active:scale-95 disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v8m4-4H8m12 0a8 8 0 11-16 0 8 8 0 0116 0z" />
                </svg>
                Выгрузить в Excel
              </button>
            </div>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Наименование</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">GTIN</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Кол-во в БД</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {results.map((res, i) => (
                <tr key={i} className={`hover:bg-blue-50 transition-colors ${res.productName && res.productName.toLowerCase().includes('подозр') ? 'bg-red-50' : ''}`}>
                  <td className={`px-6 py-4 text-sm font-medium ${res.productName && res.productName.toLowerCase().includes('подозр') ? 'text-red-600' : 'text-gray-900'}`}>{res.productName}</td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">{res.gtin}</td>
                  <td className={`px-6 py-4 text-sm text-right font-bold ${res.productName && res.productName.toLowerCase().includes('подозр') ? 'text-red-600' : 'text-blue-600'}`}>{res.count.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-bold border-t border-gray-200">
              <tr>
                <td colSpan={2} className="px-6 py-4 text-sm text-gray-600 text-right uppercase tracking-wider">Итого найдено записей</td>
                <td className="px-6 py-4 text-sm text-right text-slate-900 text-lg">
                  {(totalCount !== null ? totalCount : results.reduce((a, b) => a + b.count, 0)).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : !isLoading && lastQuery && (
        <div className="bg-white p-12 rounded-xl border border-gray-200 text-center animate-fadeIn">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-500 italic text-lg">Данные не найдены по указанным критериям</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
