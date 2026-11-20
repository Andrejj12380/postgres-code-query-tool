import React, { useState } from 'react';
import { AggregationNode, AggregationLeafRecord, AggregationLevel } from '../types';

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const apiBase = (import.meta.env.VITE_API_BASE as string) || '';
  const resp = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    throw new Error((await resp.text()) || 'Server error');
  }
  return resp.json() as Promise<T>;
}

export const LEVEL_TITLES: Record<string, string> = {
  sscc1: 'Уровень 3 (sscc1)',
  sscc: 'Палета (sscc)',
  grcode: 'Короб (grcode)',
  code: 'Штучный код (code)'
};

export const LEVEL_STYLES: Record<string, string> = {
  sscc1: 'bg-purple-100 text-purple-700 border-purple-200',
  sscc: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  grcode: 'bg-sky-100 text-sky-700 border-sky-200',
  code: 'bg-gray-100 text-gray-700 border-gray-200'
};

export interface TreeCtx {
  baseBody: Record<string, unknown>;
  labelOf: (level: string) => string;
  onExport: (level: string, code: string, baseBody: Record<string, unknown>) => void;
  onSearch: (code: string) => void;
}

interface ChildrenResponse {
  childLevel: AggregationLevel;
  nodes: AggregationNode[];
  leaves: AggregationLeafRecord[];
}

export const LeavesTable: React.FC<{ leaves: AggregationLeafRecord[]; onSearch: (code: string) => void }> = ({ leaves, onSearch }) => {
  if (leaves.length === 0) return null;
  return (
    <div className="overflow-x-auto border border-gray-100 rounded-lg bg-white">
      <table className="min-w-full text-xs">
        <thead className="bg-gray-50 text-gray-500 uppercase">
          <tr>
            <th className="px-3 py-2 text-left">Код</th>
            <th className="px-3 py-2 text-left">Статус</th>
            <th className="px-3 py-2 text-left">Дата</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {leaves.map((l, i) => (
            <tr key={`${l.id ?? l.code}-${i}`} className="hover:bg-blue-50">
              <td className="px-3 py-1.5 font-mono break-all">
                <button type="button" className="text-left hover:text-blue-600" onClick={() => onSearch(l.code)} title="Показать цепочку агрегации">
                  {l.code}
                </button>
              </td>
              <td className="px-3 py-1.5 text-gray-600">{l.status ?? ''}</td>
              <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{String(l.production_date || l.dtime_ins || '').slice(0, 19)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface ContainerNodeProps {
  node: AggregationNode;
  ancestors: Record<string, string>;
  ctx: TreeCtx;
}

export const ContainerNode: React.FC<ContainerNodeProps> = ({ node, ancestors, ctx }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ChildrenResponse | null>(null);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !data && !loading) {
      setLoading(true);
      setError(null);
      try {
        const res = await postJson<ChildrenResponse>('/api/aggregation/children', {
          ...ctx.baseBody,
          parentLevel: node.level,
          parentCode: node.code,
          ancestors
        });
        setData(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    }
  };

  const childAncestors = { ...ancestors, [node.level]: node.code };

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <div className="flex flex-wrap items-center gap-3 px-3 py-2">
        <button type="button" onClick={toggle} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500" aria-label="Раскрыть">
          {open ? '▾' : '▸'}
        </button>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${LEVEL_STYLES[node.level] || LEVEL_STYLES.code}`}>
          {ctx.labelOf(node.level)}
        </span>
        <button type="button" onClick={() => ctx.onSearch(node.code)} className="font-mono text-sm text-gray-800 hover:text-blue-600 break-all text-left" title="Найти / показать цепочку">
          {node.code}
        </button>
        <span className="text-xs text-gray-500">
          вложено: <b>{node.childCount.toLocaleString()}</b> ({ctx.labelOf(node.childLevel || 'code')}) · штучек: <b>{node.itemsCount.toLocaleString()}</b>
        </span>
        {node.lastDate && <span className="text-xs text-gray-400">{String(node.lastDate).slice(0, 19)}</span>}
        <button
          type="button"
          onClick={() => ctx.onExport(node.level, node.code, ctx.baseBody)}
          className="ml-auto text-xs text-emerald-700 hover:text-emerald-900 font-semibold"
          title="Выгрузить состав"
        >
          ⬇ Выгрузить состав
        </button>
      </div>
      {open && (
        <div className="px-3 pb-3 pl-8 space-y-2">
          {loading && <div className="text-xs text-blue-600 animate-pulse">Загрузка...</div>}
          {error && <div className="text-xs text-red-600">{error}</div>}
          {data && data.nodes.map(child => (
            <ContainerNode key={`${child.level}-${child.code}`} node={child} ancestors={childAncestors} ctx={ctx} />
          ))}
          {data && data.leaves.length > 0 && (
            <>
              {data.nodes.length > 0 && <div className="text-xs text-amber-600">Без группы нижнего уровня:</div>}
              <LeavesTable leaves={data.leaves} onSearch={ctx.onSearch} />
            </>
          )}
          {data && data.nodes.length === 0 && data.leaves.length === 0 && (
            <div className="text-xs text-gray-400">Пусто</div>
          )}
        </div>
      )}
    </div>
  );
};
