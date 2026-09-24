import { Plus, Trash2, Star, Scale } from 'lucide-react';
import type { SourceItem } from '../utils/sources';
import {
  MAX_SOURCES,
  addSourceItem,
  clampConfidence,
  getTotalConfidence,
  rebalanceSources,
  removeSourceItem,
  setConfirmedSource,
  updateSourceItem,
} from '../utils/sources';

interface Props {
  sources: SourceItem[];
  onChange: (sources: SourceItem[]) => void;
}

export default function SourceEditor({ sources, onChange }: Props) {
  const total = getTotalConfidence(sources);
  const single = sources.length === 1;

  const handleDelete = (id: string) => {
    const target = sources.find((s) => s.id === id);
    if (target?.confirmed) return; // 已确认主来源需先在同一编辑里把星标交给另一条
    onChange(removeSourceItem(sources, id));
  };

  // 编辑器里星标只做「确认 / 交接给另一条」，不能清空确认
  const handleConfirm = (id: string) => onChange(setConfirmedSource(sources, id));

  return (
    <div className="space-y-2.5">
      {sources.map((s, index) => {
        const isConfirmed = s.confirmed === true;
        return (
          <div
            key={s.id}
            className={`rounded-xl border p-3 transition-colors ${
              isConfirmed
                ? 'border-ochre-400 bg-ochre-100/50'
                : 'border-paper-300 bg-paper-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleConfirm(s.id)}
                title={isConfirmed ? '已确认的主来源' : '确认为主来源'}
                className={`shrink-0 p-1 rounded-lg transition-colors ${
                  isConfirmed
                    ? 'text-ochre-500 hover:text-ochre-600'
                    : 'text-ink-700/30 hover:text-ochre-500 hover:bg-ochre-100'
                }`}
              >
                <Star className={`w-4 h-4 ${isConfirmed ? 'fill-current' : ''}`} />
              </button>
              <input
                type="text"
                value={s.name}
                onChange={(e) => onChange(updateSourceItem(sources, s.id, { name: e.target.value }))}
                placeholder={`来源 ${index + 1}，例如：陈年樟木`}
                className="scent-input py-2"
              />
              <button
                type="button"
                onClick={() => handleDelete(s.id)}
                disabled={single}
                title={
                  single
                    ? '至少保留一项来源'
                    : isConfirmed
                      ? '已确认的主来源不能直接移除，请先确认另一条接手'
                      : '移除该来源'
                }
                className={`shrink-0 p-2 rounded-lg transition-colors ${
                  single || isConfirmed
                    ? 'text-ink-700/25 cursor-not-allowed'
                    : 'text-brick-500 hover:bg-brick-500/10'
                }`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-3 mt-2 pl-8">
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={single ? 100 : s.confidence}
                disabled={single}
                onChange={(e) =>
                  onChange(
                    updateSourceItem(sources, s.id, {
                      confidence: clampConfidence(e.target.value),
                    }),
                  )
                }
                className="scent-slider flex-1"
              />
              <span
                className={`shrink-0 inline-flex items-center min-w-[3.5rem] justify-center px-2 py-0.5 rounded-full text-sm font-semibold ${
                  isConfirmed ? 'bg-ochre-200 text-ochre-700' : 'bg-paper-200 text-ink-700'
                }`}
              >
                {single ? 100 : s.confidence}%
              </span>
            </div>
            {isConfirmed && (
              <p className="mt-1.5 pl-8 text-[11px] text-ochre-600/80">
                已确认的主来源：移除前需先把星标交给另一条来源接手
              </p>
            )}
          </div>
        );
      })}

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={() => onChange(addSourceItem(sources))}
          disabled={sources.length >= MAX_SOURCES}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
            sources.length >= MAX_SOURCES
              ? 'bg-paper-100 text-ink-700/40 cursor-not-allowed'
              : 'bg-paper-100 text-ochre-600 hover:bg-paper-200 border border-paper-200'
          }`}
        >
          <Plus className="w-4 h-4" />
          添加来源（{sources.length}/{MAX_SOURCES}）
        </button>

        <div className="flex items-center gap-2">
          {total !== 100 && (
            <button
              type="button"
              onClick={() => onChange(rebalanceSources(sources))}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-moss-100 text-moss-600 hover:bg-moss-200 transition-colors"
              title="按当前比例把合计凑成 100"
            >
              <Scale className="w-3.5 h-3.5" />
              凑成 100
            </button>
          )}
          <span
            className={`text-sm font-semibold ${
              total === 100 ? 'text-moss-600' : 'text-brick-500'
            }`}
          >
            合计 {total}/100
          </span>
        </div>
      </div>
    </div>
  );
}
