import { Star } from 'lucide-react';
import type { SourceItem } from '../utils/sources';
import { getPrimarySource } from '../utils/sources';

interface Props {
  sources: SourceItem[];
  onConfirm: (sourceId: string | null) => void;
}

export default function SourceList({ sources, onConfirm }: Props) {
  const primary = getPrimarySource(sources);

  return (
    <div className="p-4 rounded-xl bg-paper-100/70 border border-paper-200/80">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="font-hand text-lg text-ochre-600">气味来源清单</span>
        <span className="text-[11px] text-ink-700/50">
          把握合计 {sources.reduce((acc, s) => acc + s.confidence, 0)}%
        </span>
      </div>
      <ul className="space-y-2">
        {sources.map((s) => {
          const isConfirmed = s.confirmed === true;
          const isPrimary = primary?.id === s.id;
          return (
            <li key={s.id} className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => onConfirm(isConfirmed ? null : s.id)}
                title={isConfirmed ? '取消主来源确认' : '确认为主来源'}
                className={`shrink-0 p-1 rounded-lg transition-colors ${
                  isConfirmed
                    ? 'text-ochre-500'
                    : 'text-ink-700/30 hover:text-ochre-500 hover:bg-ochre-100'
                }`}
              >
                <Star className={`w-4 h-4 ${isConfirmed ? 'fill-current' : ''}`} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span
                    className={`truncate ${
                      isPrimary ? 'font-semibold text-ink-800' : 'text-ink-700/80'
                    }`}
                  >
                    {s.name}
                    {isPrimary && (
                      <span className="ml-1.5 text-[10px] font-normal text-ochre-600">
                        {isConfirmed ? '· 已确认主来源' : '· 把握最高'}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-semibold text-ochre-600 text-xs">
                    {s.confidence}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 bg-paper-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isConfirmed ? 'bg-ochre-500' : 'bg-ochre-300'
                    }`}
                    style={{ width: `${s.confidence}%` }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
