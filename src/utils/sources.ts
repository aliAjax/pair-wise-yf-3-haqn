import type { SmellMemory, SourceItem } from './constants';
import { generateId } from './helpers';

/** 单条气味记录最多登记的来源数量 */
export const MAX_SOURCES = 4;
/** 所有来源把握程度之和 */
export const TOTAL_CONFIDENCE = 100;

export function createSource(name = '', confidence = TOTAL_CONFIDENCE): SourceItem {
  return { id: generateId(), name, confidence };
}

export function clampConfidence(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(TOTAL_CONFIDENCE, Math.round(value)));
}

/**
 * 把任意来源数据规整为合法清单。
 * 旧记录没有来源清单、但保留着 source_guess 整句时，补成单项 100。
 */
export function normalizeSources(raw: unknown, legacyGuess?: string): SourceItem[] {
  if (Array.isArray(raw)) {
    const items = raw
      .filter((s): s is Partial<SourceItem> => !!s && typeof s === 'object')
      .map((s) => ({
        id: typeof s.id === 'string' && s.id ? s.id : generateId(),
        name: typeof s.name === 'string' ? s.name.trim() : '',
        confidence: clampConfidence(Number(s.confidence)),
      }));
    return items;
  }
  const guess = (legacyGuess ?? '').trim();
  return guess ? [createSource(guess, TOTAL_CONFIDENCE)] : [];
}

/** 规整单条记忆：兼容没有 sources 字段的旧数据，并去掉废弃的 source_guess */
export function normalizeMemory(memory: Partial<SmellMemory> & { source_guess?: string }): SmellMemory {
  const sources = normalizeSources(memory.sources, memory.source_guess);
  const result = { ...memory, sources } as SmellMemory & { source_guess?: string };
  delete result.source_guess;
  return result;
}

/** 把握最高的一条；并列时按录入顺序取最靠前的 */
export function getPrimarySource(sources: SourceItem[]): SourceItem | null {
  if (!sources.length) return null;
  return sources.reduce((best, cur) => (cur.confidence > best.confidence ? cur : best), sources[0]);
}

/** 按把握从高到低排序；并列时保持录入顺序（稳定排序） */
export function sortSourcesByConfidence(sources: SourceItem[]): SourceItem[] {
  return sources
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (b.s.confidence - a.s.confidence) || (a.i - b.i))
    .map((x) => x.s);
}

export function sumConfidence(sources: SourceItem[]): number {
  return sources.reduce((acc, s) => acc + s.confidence, 0);
}

/** 把 100 平分给当前各项（余数分给最前面的项） */
export function distributeConfidence(sources: SourceItem[]): SourceItem[] {
  if (!sources.length) return sources;
  const base = Math.floor(TOTAL_CONFIDENCE / sources.length);
  const remainder = TOTAL_CONFIDENCE - base * sources.length;
  return sources.map((s, i) => ({ ...s, confidence: base + (i < remainder ? 1 : 0) }));
}

export interface SourceValidation {
  valid: boolean;
  message?: string;
}

/** 保存规则：清单可留空；非空时名称必填、把握 0-100、不超过四项、合计 100 */
export function validateSources(sources: SourceItem[]): SourceValidation {
  if (sources.length > MAX_SOURCES) {
    return { valid: false, message: `来源最多 ${MAX_SOURCES} 项` };
  }
  if (sources.some((s) => !s.name.trim())) {
    return { valid: false, message: '每条来源都要填写名称' };
  }
  if (sources.some((s) => s.confidence < 0 || s.confidence > TOTAL_CONFIDENCE)) {
    return { valid: false, message: '把握程度需要在 0-100 之间' };
  }
  if (sources.length && sumConfidence(sources) !== TOTAL_CONFIDENCE) {
    return { valid: false, message: `把握合计需要等于 ${TOTAL_CONFIDENCE}，当前为 ${sumConfidence(sources)}` };
  }
  return { valid: true };
}
