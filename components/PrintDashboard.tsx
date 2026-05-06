import React, { useState } from 'react';
import { DbConnection, Product } from '../types';
import { exportResultsToExcel } from '../services/dbService';

interface PrintDashboardProps {
    connections: DbConnection[];
    products: Product[];
}

const PrintDashboard: React.FC<PrintDashboardProps> = ({ connections, products }) => {
    const [selectedDb, setSelectedDb] = useState<string>('');
    const [selectedProductGtin, setSelectedProductGtin] = useState<string>('all');
    const [expirationDays, setExpirationDays] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<{ gtin: string; count: number; productName: string }[]>([]);
    const [totalCount, setTotalCount] = useState<number | null>(null);

    const handleQuery = async () => {
        if (!selectedDb) {
            alert('Пожалуйста, выберите базу данных');
            return;
        }

        const conn = connections.find(c => c.id === selectedDb);
        if (!conn) {
            alert('Подключение не найдено');
            return;
        }

        setIsLoading(true);
        try {
            const apiBase = (import.meta.env.VITE_API_BASE as string) || '';
            const url = apiBase ? `${apiBase}/api/print-summary` : `/api/print-summary`;

            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    connection: conn,
                    selectedGtin: selectedProductGtin,
                    expirationDays: expirationDays ? Number(expirationDays) : null
                })
            });

            if (!resp.ok) {
                const errText = await resp.text();
                throw new Error(errText || 'Server error');
            }

            const respJson = await resp.json() as { rows: Array<{ gtin: string; count: number }>, totalCount: number };
            const data = respJson.rows || [];

            let mappedResults = [];

            if (selectedProductGtin === 'all') {
                mappedResults = data.map(d => {
                    const prod = products.find(p => p.gtin === d.gtin);
                    return {
                        productName: prod ? prod.name : (d.gtin || 'Unknown'),
                        gtin: d.gtin || '',
                        count: d.count || 0
                    };
                });
            } else {
                const total = data.reduce((acc, curr) => acc + (curr.count || 0), 0);
                const prod = products.find(p => p.gtin === selectedProductGtin);
                mappedResults = [{
                    productName: prod ? prod.name : selectedProductGtin,
                    gtin: selectedProductGtin,
                    count: total
                }];
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

    const handleExport = () => {
        if (results.length === 0) return;
        const filename = `print_summary_${selectedProductGtin}`;
        // Re-use exportResultsToExcel if needed, it works for this array structure
        exportResultsToExcel(results as any, totalCount, filename);
    };

    return (
        <div className="space-y-6 animate-fadeIn pb-12">
            <h2 className="text-2xl font-bold mb-6">Печать: Статистика нераспечатанных кодов</h2>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2 lg:col-span-1" data-tour="print-db-select">
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

                <div className="space-y-2 lg:col-span-1">
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

                <div className="space-y-2 lg:col-span-1" data-tour="print-expiration-days">
                    <label className="text-sm font-semibold text-gray-700">3. Срок годности (дней)</label>
                    <input
                        type="number"
                        min="1"
                        placeholder="Например: 30"
                        className="w-full border border-gray-300 rounded-lg p-2 bg-[#F9FAFB] focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                        value={expirationDays}
                        onChange={e => setExpirationDays(e.target.value)}
                        title="Укажите количество дней, старше которых коды не подлежат печати"
                    />
                </div>

                <div className="flex items-end lg:col-span-1" data-tour="print-query-btn">
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

            {results.length > 0 ? (
                <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden animate-slideUp">
                    <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <h3 className="font-bold text-gray-700 uppercase text-xs tracking-wider">Результаты поиска (остаток для печати)</h3>
                        </div>
                        <button
                            onClick={handleExport}
                            disabled={isLoading}
                            className="bg-lime-600 hover:bg-lime-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm active:scale-95 disabled:opacity-50"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Скачать сводку
                        </button>
                    </div>
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-white">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Наименование</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">GTIN</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Осталось кодов</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {results.map((res, i) => (
                                <tr key={i} className="hover:bg-blue-50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{res.productName}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500 font-mono">{res.gtin}</td>
                                    <td className="px-6 py-4 text-sm text-right font-bold text-blue-600">{res.count.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50 font-bold border-t border-gray-200">
                            <tr>
                                <td colSpan={2} className="px-6 py-4 text-sm text-gray-600 text-right uppercase tracking-wider">Итого кодов для печати</td>
                                <td className="px-6 py-4 text-sm text-right text-slate-900 text-lg">
                                    {(totalCount !== null ? totalCount : results.reduce((a, b) => a + b.count, 0)).toLocaleString()}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            ) : !isLoading && totalCount !== null && (
                <div className="bg-white p-12 rounded-xl border border-gray-200 text-center animate-fadeIn">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <p className="text-gray-500 italic text-lg">Все коды для данного продукта распечатаны (или нет доступных).</p>
                </div>
            )}
        </div>
    );
};

export default PrintDashboard;
