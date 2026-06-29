
import React, { useState, useRef } from 'react';
import { DbConnection, Product, DateField, FullCodeRecord } from '../types';

interface MaintenanceDashboardProps {
  connections: DbConnection[];
  products: Product[];
}

const MaintenanceDashboard: React.FC<MaintenanceDashboardProps> = ({ connections, products }) => {
  const [selectedDb, setSelectedDb] = useState<string>('');
  const [selectedProductGtin, setSelectedProductGtin] = useState<string>('all');
  const [dateField, setDateField] = useState<DateField>('production_date');
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isRange, setIsRange] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [customStatus, setCustomStatus] = useState<string>('');
  const [searchCode, setSearchCode] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [foundCount, setFoundCount] = useState<number | null>(null);
  const [detailedRecords, setDetailedRecords] = useState<FullCodeRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  const [sortField, setSortField] = useState<keyof FullCodeRecord | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: keyof FullCodeRecord) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'all' | 'selected'>('all');
  const [confirmText, setConfirmText] = useState('');
  
  const startInputRef = useRef<HTMLInputElement | null>(null);
  const endInputRef = useRef<HTMLInputElement | null>(null);

  const formatDate = (d: Date | null) => {
    if (!d) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const handleSearch = async (showDetails: boolean = false) => {
    if (!selectedDb || !startDate) {
      alert('Пожалуйста, выберите базу данных и дату начала');
      return;
    }
    
    const conn = connections.find(c => c.id === selectedDb);
    if (!conn) return;

    setIsLoading(true);
    setDetailedRecords([]);
    setSelectedIds([]);
    setSortField(null);
    setSortDirection('asc');
    try {
      const finalStatus = selectedStatus === 'custom' ? customStatus : selectedStatus;
      const apiBase = (import.meta.env.VITE_API_BASE as string) || '';
      
      // 1. Get summary count
      const summaryUrl = apiBase ? `${apiBase}/api/summary` : `/api/summary`;
      const summaryResp = await fetch(summaryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: conn,
          selectedGtin: selectedProductGtin,
          startDate: formatDate(startDate),
          endDate: isRange ? formatDate(endDate) : null,
          dateField,
          status: finalStatus,
          searchCode // This will be handled if I added it to summary too, but for now summary might not have it. 
          // Wait, I only added it to /api/full and /api/delete. 
        })
      });

      if (!summaryResp.ok) throw new Error(await summaryResp.text());
      const summaryData = await summaryResp.json();
      
      // If searchCode is present, the summary count might be inaccurate if I didn't update /api/summary.
      // Let's assume the user wants to see records if they use searchCode.
      
      if (showDetails || searchCode) {
        const fullUrl = apiBase ? `${apiBase}/api/full` : `/api/full`;
        const fullResp = await fetch(fullUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connection: conn,
            selectedGtin: selectedProductGtin,
            startDate: formatDate(startDate),
            endDate: isRange ? formatDate(endDate) : null,
            dateField,
            status: finalStatus,
            searchCode,
            limit: 500 // Limit for safety in UI
          })
        });
        if (!fullResp.ok) throw new Error(await fullResp.text());
        const fullData = await fullResp.json();
        setDetailedRecords(fullData);
        setFoundCount(fullData.length);
      } else {
        setFoundCount(summaryData.totalCount || 0);
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка при поиске: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDelete = (mode: 'all' | 'selected') => {
    setConfirmMode(mode);
    setShowConfirmModal(true);
  };

  const handleDelete = async () => {
    if (confirmText !== 'УДАЛИТЬ') {
      alert('Для подтверждения введите слово УДАЛИТЬ');
      return;
    }

    if (!selectedDb || !startDate) return;
    
    const conn = connections.find(c => c.id === selectedDb);
    if (!conn) return;

    setIsLoading(true);
    setShowConfirmModal(false);
    try {
      const finalStatus = selectedStatus === 'custom' ? customStatus : selectedStatus;
      const apiBase = (import.meta.env.VITE_API_BASE as string) || '';
      const url = apiBase ? `${apiBase}/api/delete` : `/api/delete`;

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: conn,
          selectedGtin: selectedProductGtin,
          startDate: formatDate(startDate),
          endDate: isRange ? formatDate(endDate) : null,
          dateField,
          status: finalStatus,
          searchCode,
          ids: confirmMode === 'selected' ? selectedIds : null
        })
      });

      if (!resp.ok) throw new Error(await resp.text());
      const result = await resp.json();
      alert(`Успешно удалено ${result.deletedCount} кодов`);
      setFoundCount(null);
      setDetailedRecords([]);
      setSelectedIds([]);
      setConfirmText('');
    } catch (err) {
      console.error(err);
      alert('Ошибка при удалении: ' + (err instanceof Error ? err.message : ''));
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === detailedRecords.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(detailedRecords.map(r => r.id));
    }
  };

  const toggleSelectId = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const sortedRecords = React.useMemo(() => {
    if (!sortField) return detailedRecords;
    return [...detailedRecords].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      if (aVal === undefined || aVal === null) return sortDirection === 'asc' ? 1 : -1;
      if (bVal === undefined || bVal === null) return sortDirection === 'asc' ? -1 : 1;
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDirection === 'asc' 
        ? aStr.localeCompare(bStr) 
        : bStr.localeCompare(aStr);
    });
  }, [detailedRecords, sortField, sortDirection]);

  const renderSortableHeader = (field: keyof FullCodeRecord, label: string, className = "text-left") => {
    const isSorted = sortField === field;
    return (
      <th 
        className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none transition-colors ${className}`}
        onClick={() => handleSort(field)}
      >
        <div className={`flex items-center gap-1 ${className.includes('text-right') ? 'justify-end' : ''}`}>
          <span>{label}</span>
          {isSorted && (
            <span className="text-blue-600 text-sm">
              {sortDirection === 'asc' ? ' ↑' : ' ↓'}
            </span>
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl">🛠️</span>
        <h2 className="text-2xl font-bold">Обслуживание: Удаление кодов</h2>
      </div>

      <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-r-lg mb-6 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="text-orange-500 text-xl font-bold">⚠️</span>
          <div>
            <h4 className="font-bold text-orange-800">Внимание!</h4>
            <p className="text-sm text-orange-700">Удаление кодов из базы данных — это необратимая операция. Пожалуйста, дважды проверьте выбранные параметры перед началом.</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-6">
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

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-semibold text-gray-700">4. Период</label>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1 relative">
              <span className="text-[10px] uppercase text-gray-400 font-bold">От / Дата</span>
              <input
                ref={startInputRef}
                type="date"
                className="border border-gray-300 rounded-lg p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors min-w-[200px]"
                value={formatDate(startDate)}
                onChange={e => setStartDate(e.target.value ? new Date(e.target.value) : null)}
              />
            </div>

            {isRange && (
              <div className="flex flex-col gap-1 relative animate-fadeIn">
                <span className="text-[10px] uppercase text-gray-400 font-bold">До</span>
                <input
                  ref={endInputRef}
                  type="date"
                  className="border border-gray-300 rounded-lg p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors min-w-[200px]"
                  value={formatDate(endDate)}
                  onChange={e => setEndDate(e.target.value ? new Date(e.target.value) : null)}
                />
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
                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                <span className="ms-3 text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">Диапазон</span>
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-gray-700">5. Статус кода</label>
          <div className="flex flex-col gap-2">
            <select
              className="w-full border border-gray-300 rounded-lg p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
            >
              <option value="all">Все статусы</option>
              <option value="1">1 - Новые</option>
              <option value="9">9 - Выгруженные</option>
              <option value="custom">Другой...</option>
            </select>
            {selectedStatus === 'custom' && (
              <input
                type="text"
                placeholder="Введите статус..."
                className="w-full border border-gray-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-colors animate-fadeIn"
                value={customStatus}
                onChange={e => setCustomStatus(e.target.value)}
              />
            )}
          </div>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-semibold text-gray-700">6. Поиск по коду (целиком или часть)</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Например: 01046... или конкретный хвост"
              className="flex-1 border border-gray-300 rounded-lg p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
              value={searchCode}
              onChange={e => setSearchCode(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-end md:col-span-1 gap-2">
          <button
            disabled={isLoading || !selectedDb || !startDate}
            onClick={() => handleSearch(false)}
            className={`flex-1 h-[42px] bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-50`}
          >
            {isLoading ? <span className="animate-spin">⏳</span> : 'Найти (кол-во)'}
          </button>
          <button
            disabled={isLoading || !selectedDb || !startDate}
            onClick={() => handleSearch(true)}
            className={`flex-1 h-[42px] bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-50`}
          >
            Показать список
          </button>
        </div>
      </div>

      {foundCount !== null && (
        <div className="bg-white p-8 rounded-xl shadow-md border border-gray-200 text-center animate-slideUp">
          <div className="text-gray-500 uppercase text-xs font-bold tracking-widest mb-2">Найдено записей по фильтрам</div>
          <div className="text-5xl font-black text-slate-900 mb-6">{foundCount.toLocaleString()}</div>
          
          <div className="flex justify-center gap-4">
            {foundCount > 0 && (
              <button
                onClick={() => handleConfirmDelete('all')}
                className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-red-200 active:scale-95 flex items-center gap-3"
              >
                <span className="text-2xl">🗑️</span>
                Удалить ВСЕ найденные
              </button>
            )}
            {selectedIds.length > 0 && (
              <button
                onClick={() => handleConfirmDelete('selected')}
                className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-orange-200 active:scale-95 flex items-center gap-3"
              >
                <span className="text-2xl">🧹</span>
                Удалить выбранные ({selectedIds.length})
              </button>
            )}
          </div>
          {foundCount === 0 && <p className="text-gray-400 italic text-sm">Нет кодов для удаления по этим параметрам</p>}
        </div>
      )}

      {detailedRecords.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden animate-slideUp">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <h3 className="font-bold text-gray-700 uppercase text-xs tracking-wider">Список найденных кодов (до 500 шт.)</h3>
            <button
              onClick={toggleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {selectedIds.length === detailedRecords.length ? 'Снять выделение' : 'Выбрать все'}
            </button>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white sticky top-0 border-b border-gray-200 shadow-sm z-10">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <input type="checkbox" checked={selectedIds.length === detailedRecords.length && detailedRecords.length > 0} onChange={toggleSelectAll} className="rounded" />
                  </th>
                  {renderSortableHeader('dtime_ins', 'Дата вставки')}
                  {renderSortableHeader('production_date', 'Дата производства')}
                  {renderSortableHeader('code', 'Код')}
                  {renderSortableHeader('status', 'Статус', 'text-right')}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedRecords.map((rec) => (
                  <tr key={rec.id} className={`hover:bg-blue-50 transition-colors ${selectedIds.includes(rec.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.includes(rec.id)} onChange={() => toggleSelectId(rec.id)} className="rounded" />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{rec.dtime_ins}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{rec.production_date}</td>
                    <td className="px-4 py-3 text-sm font-mono break-all">{rec.code}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-600">{rec.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-zoomIn">
            <div className="bg-red-600 p-6 text-white text-center">
              <div className="text-5xl mb-4">😱</div>
              <h3 className="text-xl font-bold">Вы абсолютно уверены?</h3>
              <p className="opacity-90 text-sm mt-2">
                Будет удалено {confirmMode === 'all' ? foundCount?.toLocaleString() : selectedIds.length} записей без возможности восстановления.
              </p>
            </div>
            <div className="p-8">
              <p className="text-sm text-gray-600 mb-4">Для подтверждения введите слово <span className="font-bold text-red-600 select-all">УДАЛИТЬ</span> большими буквами:</p>
              <input
                type="text"
                autoFocus
                className="w-full border-2 border-gray-200 rounded-xl p-4 text-center text-xl font-bold focus:border-red-500 outline-none transition-colors mb-6"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="..."
              />
              <div className="flex gap-4">
                <button
                  onClick={() => { setShowConfirmModal(false); setConfirmText(''); }}
                  className="flex-1 px-6 py-3 border-2 border-gray-200 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
                <button
                  disabled={confirmText !== 'УДАЛИТЬ'}
                  onClick={handleDelete}
                  className={`flex-1 px-6 py-3 rounded-xl font-bold text-white transition-all ${confirmText === 'УДАЛИТЬ' ? 'bg-red-600 hover:bg-red-700 shadow-md active:scale-95' : 'bg-gray-300 cursor-not-allowed'}`}
                >
                  Да, удалить!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MaintenanceDashboard;
