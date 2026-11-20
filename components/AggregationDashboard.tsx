import React, { useState, useEffect, useRef } from 'react';
import {
  DbConnection, Product, DateField, ALL_CODE_FIELDS,
  AggregationOverview, AggregationSearchResult, AggregationFilterPreset
} from '../types';
import { exportToCsv, exportToExcel } from '../services/dbService';
import { postJson, ContainerNode, LeavesTable, LEVEL_TITLES, LEVEL_STYLES, TreeCtx } from './AggregationTree';
import AggregationAnomalies from './AggregationAnomalies';

interface Props {
  connections: DbConnection[];
  products: Product[];
  fieldLabels: Record<string, string>;
  preset: { data: AggregationFilterPreset; version: number } | null;
}

interface Filters {
  dbId: string;
  gtin: string;
  dateField: DateField;
  startDate: Date | null;
  endDate: Date | null;
  isRange: boolean;
  status: string;
  customStatus: string;
}

const formatDate = (d: Date | null) => {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const safeName = (s: string) => s.replace(/[^\w.-]+/g, '_').slice(0, 60);

const AggregationDashboard: React.FC<Props> = ({ connections, products, fieldLabels, preset }) => {
  const [filters, setFilters] = useState<Filters>({
    dbId: '', gtin: 'all', dateField: 'production_date',
    startDate: new Date(), endDate: null, isRange: false, status: 'all', customStatus: ''
  });
  const [overview, setOverview] = useState<AggregationOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<AggregationSearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [exportFormat, setExportFormat] = useState<'excel' | 'csv'>('excel');
  const [treeKey, setTreeKey] = useState(0);
  const lastPresetVersion = useRef<number>(-1);

  const labelOf = (level: string) => fieldLabels[level] || LEVEL_TITLES[level] || level;
  const getConn = (dbId: string) => connections.find(c => c.id === dbId);

  const buildBaseBody = (f: Filters): Record<string, unknown> => {
    const conn = getConn(f.dbId);
    return {
      connection: conn,
      selectedGtin: f.gtin,
      startDate: formatDate(f.startDate),
      endDate: f.isRange ? formatDate(f.endDate) : null,
      dateField: f.dateField,
      status: f.status === 'custom' ? f.customStatus : f.status
    };
  };

  const runOverview = async (f: Filters, rootLevel?: string) => {
    if (!f.dbId || !getConn(f.dbId)) { alert('Выберите базу данных'); return; }
    if (!f.startDate) { alert('Выберите дату'); return; }
    setIsLoading(true);
    setError(null);
    try {
      const res = await postJson<AggregationOverview>('/api/aggregation/overview', { ...buildBaseBody(f), rootLevel });
      setOverview(res);
      setTreeKey(k => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка запроса');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!preset || preset.version === lastPresetVersion.current) return;
    lastPresetVersion.current = preset.version;
    const p = preset.data;
    const next: Filters = {
      dbId: p.dbId || '',
      gtin: p.selectedProductGtin || 'all',
      dateField: p.dateField || 'production_date',
      startDate: p.startDate ?? new Date(),
      endDate: p.endDate ?? null,
      isRange: !!p.isRange,
      status: p.selectedStatus || 'all',
      customStatus: p.customStatus || ''
    };
    setFilters(next);
    if (next.dbId) runOverview(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const exportRows = async (extra: Record<string, unknown>, baseBody: Record<string, unknown>, name: string) => {
    try {
      const rows = await postJson<Record<string, unknown>[]>('/api/aggregation/export', { ...baseBody, ...extra });
      if (rows.length === 0) { alert('Нет данных для выгрузки'); return; }
      const columnMap = ALL_CODE_FIELDS.reduce((acc, f) => {
        acc[f.key] = fieldLabels[f.key] || f.label;
        return acc;
      }, {} as Record<string, string>);
      if (exportFormat === 'excel') exportToExcel(rows, name, columnMap);
      else exportToCsv(rows, name, columnMap);
    } catch (e) {
      alert('Ошибка выгрузки: ' + (e instanceof Error ? e.message : ''));
    }
  };

  const runSearch = async (query: string) => {
    const q = query.trim();
    if (!q) return;
    const conn = getConn(filters.dbId);
    if (!conn) { alert('Выберите базу данных'); return; }
    setSearchQuery(q);
    setIsSearching(true);
    setSearchError(null);
    try {
      const res = await postJson<AggregationSearchResult>('/api/aggregation/search', { connection: conn, query: q });
      setSearchResult(res);
    } catch (e) {
      setSearchResult(null);
      setSearchError(e instanceof Error ? e.message : 'Ошибка поиска');
    } finally {
      setIsSearching(false);
    }
  };

  const filterCtx: TreeCtx = {
    baseBody: buildBaseBody(filters),
    labelOf,
    onExport: (level, code, base) => exportRows({ filterLevel: level, filterCode: code }, base, `aggregation_${level}_${safeName(code)}`),
    onSearch: runSearch
  };

  const searchCtx: TreeCtx = {
    baseBody: { connection: getConn(filters.dbId) },
    labelOf,
    onExport: (level, code, base) => exportRows({ filterLevel: level, filterCode: code }, base, `aggregation_${level}_${safeName(code)}`),
    onSearch: runSearch
  };

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters(prev => ({ ...prev, [key]: value }));

  const inputCls = 'w-full border border-gray-300 rounded-lg p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors';

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <h2 className="text-2xl font-bold">Агрегация</h2>

      {/* Filters */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4" data-tour="aggregation-filters">
        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-700">База данных</label>
          <select className={inputCls} value={filters.dbId} onChange={e => set('dbId', e.target.value)}>
            <option value="">Выберите подключение...</option>
            {connections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.host})</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-700">Продукция</label>
          <select className={inputCls} value={filters.gtin} onChange={e => set('gtin', e.target.value)}>
            <option value="all">Все наименования</option>
            {products.map(p => <option key={p.id} value={p.gtin}>{p.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-700">Поле даты</label>
          <select className={inputCls} value={filters.dateField} onChange={e => set('dateField', e.target.value as DateField)}>
            <option value="production_date">Production Date</option>
            <option value="dtime_ins">Dtime Ins</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-semibold text-gray-700">Статус</label>
          <select className={inputCls} value={filters.status} onChange={e => set('status', e.target.value)}>
            <option value="all">Все статусы</option>
            <option value="1">1 - Новые</option>
            <option value="9">9 - Выгруженные</option>
            <option value="custom">Другой...</option>
          </select>
          {filters.status === 'custom' && (
            <input className={inputCls} placeholder="Введите статус..." value={filters.customStatus} onChange={e => set('customStatus', e.target.value)} />
          )}
        </div>
        <div className="space-y-1 md:col-span-3">
          <label className="text-sm font-semibold text-gray-700">Период</label>
          <div className="flex flex-wrap items-center gap-3">
            <input type="date" className={`${inputCls} !w-auto`} value={formatDate(filters.startDate)}
              onChange={e => set('startDate', e.target.value ? new Date(e.target.value) : null)} />
            {filters.isRange && (
              <input type="date" className={`${inputCls} !w-auto`} value={formatDate(filters.endDate)}
                onChange={e => set('endDate', e.target.value ? new Date(e.target.value) : null)} />
            )}
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={filters.isRange} onChange={e => set('isRange', e.target.checked)} /> Диапазон
            </label>
          </div>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => runOverview(filters, overview?.activeRootLevel || undefined)}
            className={`w-full h-[42px] bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md active:scale-95 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? 'Загрузка...' : 'Показать агрегацию'}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4" data-tour="aggregation-search">
        <h3 className="font-bold text-gray-700">Поиск по любому коду (штучка, короб, палета)</h3>
        <div className="flex gap-3">
          <input
            className={`${inputCls} font-mono`}
            placeholder="Отсканируйте или вставьте код..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') runSearch(searchQuery); }}
          />
          <button type="button" onClick={() => runSearch(searchQuery)} disabled={isSearching}
            className="px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg disabled:opacity-50">
            {isSearching ? '...' : 'Найти'}
          </button>
        </div>
        {searchError && <div className="text-sm text-red-600">{searchError}</div>}
        {searchResult && !searchResult.found && <div className="text-sm text-gray-500">Ничего не найдено</div>}
        {searchResult && searchResult.found && searchResult.exactMatch === false && searchResult.matches && (
          <div className="space-y-1">
            <div className="text-xs text-gray-500">Точного совпадения нет. Частичные совпадения:</div>
            {searchResult.matches.map((m, i) => (
              <button key={i} type="button" onClick={() => runSearch(m.value)} className="block text-left font-mono text-xs hover:text-blue-600">
                <span className={`mr-2 px-1.5 py-0.5 rounded border text-[10px] ${LEVEL_STYLES[m.level]}`}>{labelOf(m.level)}</span>{m.value}
              </button>
            ))}
          </div>
        )}
        {searchResult && searchResult.found && searchResult.matchedLevel && searchResult.chain && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {(['sscc1', 'sscc', 'grcode', 'code'] as const)
                .filter(l => l === 'code' || searchResult.availableLevels.includes(l))
                .map((l, i, arr) => {
                  const val = searchResult.chain![l];
                  const isMatch = l === searchResult.matchedLevel;
                  return (
                    <React.Fragment key={l}>
                      <div className={`border rounded-lg px-3 py-1 ${isMatch ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                        <div className="text-[10px] uppercase text-gray-400">{labelOf(l)}</div>
                        <div className="font-mono text-xs break-all">{val || '—'}</div>
                      </div>
                      {i < arr.length - 1 && <span className="text-gray-300">›</span>}
                    </React.Fragment>
                  );
                })}
            </div>
            {searchResult.matchedLevel !== 'code' && (
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <span>Штучек внутри: <b>{(searchResult.itemsCount || 0).toLocaleString()}</b></span>
                <button type="button" className="text-xs text-emerald-700 font-semibold"
                  onClick={() => exportRows({ filterLevel: searchResult.matchedLevel, filterCode: searchResult.matchedValue }, { connection: getConn(filters.dbId) }, `aggregation_${searchResult.matchedLevel}_${safeName(searchResult.matchedValue || '')}`)}>
                  ⬇ Выгрузить состав
                </button>
              </div>
            )}
            <div className="space-y-2">
              {(searchResult.children || []).map(n => (
                <ContainerNode key={`${n.level}-${n.code}`} node={n} ancestors={{ [searchResult.matchedLevel as string]: searchResult.matchedValue || '' }} ctx={searchCtx} />
              ))}
              <LeavesTable leaves={searchResult.leaves || []} onSearch={runSearch} />
            </div>
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      {/* Overview */}
      {overview && (
        <>
          {overview.availableLevels.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              В таблице codes нет полей агрегации (sscc1 / sscc / grcode).
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="border border-gray-200 rounded-lg p-3 bg-white">
                  <div className="text-[11px] uppercase font-bold text-gray-400">Всего кодов</div>
                  <div className="text-2xl font-bold text-gray-800">{overview.totalCodes.toLocaleString()}</div>
                </div>
                {overview.levelStats.map(s => (
                  <button key={s.level} type="button" onClick={() => runOverview(filters, s.level)}
                    className={`text-left border rounded-lg p-3 bg-white hover:bg-gray-50 ${overview.activeRootLevel === s.level ? 'ring-2 ring-indigo-500' : 'border-gray-200'}`}>
                    <div className="text-[11px] uppercase font-bold text-gray-400">{labelOf(s.level)}</div>
                    <div className="text-2xl font-bold text-indigo-600">{s.distinctCount.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">штучек: {s.itemsCount.toLocaleString()}</div>
                  </button>
                ))}
                <div className="border border-gray-200 rounded-lg p-3 bg-white">
                  <div className="text-[11px] uppercase font-bold text-gray-400">Не агрегировано</div>
                  <div className="text-2xl font-bold text-amber-600">{overview.unaggregatedCount.toLocaleString()}</div>
                </div>
              </div>

              <AggregationAnomalies
                anomalies={overview.anomalies}
                labelOf={labelOf}
                onExportUnaggregated={() => exportRows({ anomalyType: 'unaggregated' }, buildBaseBody(filters), 'aggregation_unaggregated')}
                onExportPartial={(childLevel, parentLevel) => exportRows({ anomalyType: 'partial', childLevel, parentLevel }, buildBaseBody(filters), `aggregation_partial_${childLevel}`)}
                onSearch={runSearch}
              />

              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-bold text-gray-700">
                    Дерево: {overview.activeRootLevel ? labelOf(overview.activeRootLevel) : ''}
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      показано {overview.nodes.length.toLocaleString()} из {overview.totalNodesCount.toLocaleString()}
                    </span>
                  </h3>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-500">Формат выгрузки:</span>
                    <select className="border border-gray-300 rounded p-1 text-sm" value={exportFormat} onChange={e => setExportFormat(e.target.value as 'excel' | 'csv')}>
                      <option value="excel">Excel</option>
                      <option value="csv">CSV</option>
                    </select>
                    <button type="button" className="text-emerald-700 font-semibold"
                      onClick={() => exportRows({}, buildBaseBody(filters), `aggregation_all_${formatDate(filters.startDate)}`)}>
                      ⬇ Выгрузить всё
                    </button>
                  </div>
                </div>
                <div key={treeKey} className="space-y-2">
                  {overview.nodes.map(n => (
                    <ContainerNode key={`${n.level}-${n.code}`} node={n} ancestors={{}} ctx={filterCtx} />
                  ))}
                  {overview.nodes.length === 0 && <div className="text-sm text-gray-400">Нет данных по выбранным фильтрам</div>}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default AggregationDashboard;
