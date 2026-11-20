import React from 'react';
import { AggregationOverview } from '../types';

interface Props {
  anomalies: AggregationOverview['anomalies'];
  labelOf: (level: string) => string;
  onExportUnaggregated: () => void;
  onExportPartial: (childLevel: string, parentLevel: string) => void;
  onSearch: (code: string) => void;
}

const AggregationAnomalies: React.FC<Props> = ({ anomalies, labelOf, onExportUnaggregated, onExportPartial, onSearch }) => {
  const { unaggregatedCount, partialLevels, irregularGroups } = anomalies;
  const hasAny = unaggregatedCount > 0 || partialLevels.length > 0 || irregularGroups.length > 0;

  if (!hasAny) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700">
        ✓ Аномалий агрегации не обнаружено
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-4">
      <h3 className="font-bold text-amber-800">Проверка аномалий</h3>

      {unaggregatedCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span>
            Не агрегировано (нет ни одного группового кода): <b>{unaggregatedCount.toLocaleString()}</b>
          </span>
          <button type="button" onClick={onExportUnaggregated} className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold">
            ⬇ Выгрузить
          </button>
        </div>
      )}

      {partialLevels.map(p => (
        <div key={`${p.parentLevel}-${p.childLevel}`} className="flex flex-wrap items-center gap-3 text-sm">
          <span>
            Есть {labelOf(p.childLevel)}, но нет {labelOf(p.parentLevel)}: <b>{p.containersCount.toLocaleString()}</b> контейнеров,{' '}
            <b>{p.itemsCount.toLocaleString()}</b> штучек
          </span>
          <button type="button" onClick={() => onExportPartial(p.childLevel, p.parentLevel)} className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold">
            ⬇ Выгрузить
          </button>
        </div>
      ))}

      {irregularGroups.map(g => (
        <div key={g.level} className="space-y-1 text-sm">
          <div>
            {labelOf(g.level)}: типичное наполнение <b>{g.expectedCount}</b>, отличается у{' '}
            <b>{g.irregularCount.toLocaleString()}</b> из {g.totalContainers.toLocaleString()} (неполные/переполненные)
          </div>
          <div className="flex flex-wrap gap-2">
            {g.samples.slice(0, 15).map(s => (
              <button
                key={s.code}
                type="button"
                onClick={() => onSearch(s.code)}
                className="font-mono text-xs bg-white border border-amber-300 rounded px-2 py-1 hover:bg-amber-100"
                title="Показать состав"
              >
                {s.code} · {s.count}/{s.expectedCount}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AggregationAnomalies;
