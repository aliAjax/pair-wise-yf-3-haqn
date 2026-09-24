import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Lock, Crown, ArrowLeftRight, Scale } from 'lucide-react';
import type { SourceItem } from '../utils/constants';
import {
  MAX_SOURCES,
  TOTAL_CONFIDENCE,
  createSource,
  clampConfidence,
  getPrimarySource,
  sumConfidence,
  distributeConfidence,
} from '../utils/sources';

interface Props {
  /** 是否编辑已有记录：仅已保存记录的主来源受"不能直接移除"保护 */
  isEditing: boolean;
  initialSources: SourceItem[];
  value: SourceItem[];
  onChange: (sources: SourceItem[]) => void;
  error?: string;
}

export default function SourceListEditor({ isEditing, initialSources, value, onChange, error }: Props) {
  // 本次编辑开始时已确认的主来源 id；它被移除前必须先让另一条接手
  const [confirmedPrimaryId, setConfirmedPrimaryId] = useState<string | null>(null);

  useEffect(() => {
    // 弹窗每次打开都会重新挂载该组件，初始化一次即可
    setConfirmedPrimaryId(isEditing ? getPrimarySource(initialSources)?.id ?? null : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const livePrimaryId = useMemo(() => getPrimarySource(value)?.id ?? null, [value]);
  const total = sumConfidence(value);
  const atLimit = value.length >= MAX_SOURCES;

  const patch = (id: string, patch: Partial<SourceItem>) => {
    onChange(value.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const addSource = () => {
    if (atLimit) return;
    onChange([...value, createSource('', 0)]);
  };

  const removeSource = (id: string) => {
    if (id === confirmedPrimaryId) return; // 主来源不能直接移除，请先让另一条接手
    onChange(value.filter((s) => s.id !== id));
  };

  /** 让另一条来源接手主来源：交换把握（并列时调整录入顺序），再移交保护身份 */
  const takeOver = (id: string) => {
    const current = livePrimaryId;
    if (!current || current === id) return;
    const target = value.find((s) => s.id === id);
    const primary = value.find((s) => s.id === current);
    if (!target || !primary) return;

    const ok = window.confirm(`确定让「${target.name || '这条来源'}」接手主来源吗？`);
    if (!ok) return;

    let next = value.map((s) => {
      if (s.id === primary.id) return { ...s, confidence: target.confidence };
      if (s.id === target.id) return { ...s, confidence: primary.confidence };
      return s;
    });

    // 把握相同、靠顺序决出主来源时，把接手项挪到原主来源之前
    if (primary.confidence === target.confidence) {
      const pi = next.findIndex((s) => s.id === primary.id);
      next = next.filter((s) => s.id !== target.id);
      next.splice(pi, 0, { ...target, confidence: primary.confidence });
    }

    setConfirmedPrimaryId(target.id);
    onChange(next);
  };

  const splitEvenly = () => {
    onChange(distributeConfidence(value));
  };

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-xs text-ink-700/50 font-hand">还没有登记来源，可以留空，以后再补～</p>
      )}

      {value.map((s, idx) => {
        const isLivePrimary = s.id === livePrimaryId;
        const isLocked = s.id === confirmedPrimaryId;
        const canTakeOver = isEditing && confirmedPrimaryId !== null && !isLivePrimary;
        return (
          <div
            key={s.id}
            className={`flex items-center gap-2 rounded-xl border p-2 transition-colors ${
              isLocked
                ? 'bg-ochre-100/60 border-ochre-300'
                : 'bg-paper-100/70 border-paper-200'
            }`}
          >
            <div className="w-5 shrink-0 text-center text-xs font-semibold text-ink-700/40">
              {idx + 1}
            </div>
            <input
              type="text"
              value={s.name}
              onChange={(e) => patch(s.id, { name: e.target.value })}
              placeholder={`来源 ${idx + 1}，例如：陈年樟木`}
              className="scent-input flex-1 min-w-0 !py-1.5"
            />
            <div className="relative shrink-0">
              <input
                type="number"
                min={0}
                max={TOTAL_CONFIDENCE}
                value={s.confidence}
                onChange={(e) =>
                  patch(s.id, { confidence: clampConfidence(Number(e.target.value)) })
                }
                className="scent-input w-16 !py-1.5 pr-6 text-center tabular-nums"
                aria-label={`${s.name || '来源'} 的把握程度`}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-700/40 pointer-events-none">
                %
              </span>
            </div>

            {isLivePrimary && (
              <span
                className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-ochre-500 text-paper-50 text-[10px] font-medium"
                title="把握最高的一条，并列时取录入最靠前的"
              >
                <Crown className="w-3 h-3" />
                主来源
              </span>
            )}

            {isEditing && (
              isLocked ? (
                <span
                  className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-1 text-[10px] text-ochre-600"
                  title="已确认的主来源不能直接移除，请先让另一条接手"
                >
                  <Lock className="w-3 h-3" />
                </span>
              ) : canTakeOver ? (
                <button
                  type="button"
                  onClick={() => takeOver(s.id)}
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-moss-600 hover:bg-moss-100 transition-colors"
                  title="让这条来源接手成为主来源"
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  接手
                </button>
              ) : null
            )}

            <button
              type="button"
              onClick={() => removeSource(s.id)}
              disabled={isLocked}
              title={isLocked ? '主来源不能直接移除，请先让另一条接手' : '移除这条来源'}
              className={`shrink-0 p-1 rounded-lg transition-colors ${
                isLocked
                  ? 'text-ink-700/25 cursor-not-allowed'
                  : 'text-brick-500/60 hover:text-brick-500 hover:bg-brick-500/10'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={addSource}
          disabled={atLimit}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            atLimit
              ? 'bg-paper-200 text-ink-700/40 cursor-not-allowed'
              : 'bg-paper-200 text-ochre-600 hover:bg-ochre-100'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          添加来源（{value.length}/{MAX_SOURCES}）
        </button>
        {value.length > 1 && (
          <button
            type="button"
            onClick={splitEvenly}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-paper-200 text-moss-600 hover:bg-moss-100 transition-colors"
          >
            <Scale className="w-3.5 h-3.5" />
            平分把握
          </button>
        )}
        <span
          className={`ml-auto text-xs tabular-nums font-medium ${
            total === TOTAL_CONFIDENCE ? 'text-moss-600' : 'text-brick-500'
          }`}
        >
          合计 {total} / {TOTAL_CONFIDENCE}
        </span>
      </div>

      <p className={`text-xs ${error ? 'text-brick-500' : 'text-ink-700/45'}`}>
        {error ?? `最多 ${MAX_SOURCES} 项，每项把握 0-${TOTAL_CONFIDENCE}，合计需为 ${TOTAL_CONFIDENCE}`}
      </p>
    </div>
  );
}
