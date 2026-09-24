import { generateId } from './helpers';

export const MAX_SOURCES = 4;
export const TOTAL_CONFIDENCE = 100;

export interface SourceItem {
  id: string;
  name: string;
  /** 0–100 的把握 */
  confidence: number;
  /** 是否被用户确认为主来源 */
  confirmed?: boolean;
}

interface SourceLike {
  id?: unknown;
  name?: unknown;
  confidence?: unknown;
  confirmed?: unknown;
}

export interface SourceListLike {
  sources?: unknown;
  source_guess?: unknown;
}

export function clampConfidence(n: unknown): number {
  const num = Math.round(Number(n));
  if (!Number.isFinite(num)) return 0;
  return Math.min(TOTAL_CONFIDENCE, Math.max(0, num));
}

export function createSourceItem(name = '', confidence = 0, confirmed = false): SourceItem {
  return {
    id: generateId(),
    name,
    confidence: clampConfidence(confidence),
    confirmed: confirmed || undefined,
  };
}

/**
 * 旧记录兼容：没有来源清单时，用原来的来源猜测补成单项 100。
 */
export function normalizeSources(data: SourceListLike | null | undefined): SourceItem[] {
  if (data && Array.isArray(data.sources) && data.sources.length > 0) {
    let seenConfirmed = false;
    return (data.sources as SourceLike[]).map((s) => {
      const isConfirmed = s?.confirmed === true && !seenConfirmed;
      if (s?.confirmed === true) seenConfirmed = true;
      return {
        id: typeof s?.id === 'string' && s.id ? s.id : generateId(),
        name: typeof s?.name === 'string' && s.name.trim() ? s.name : '未知来源',
        confidence: clampConfidence(s?.confidence),
        confirmed: isConfirmed || undefined,
      };
    });
  }
  const legacy = typeof data?.source_guess === 'string' ? data.source_guess.trim() : '';
  return [
    {
      id: generateId(),
      name: legacy || '未知来源',
      confidence: TOTAL_CONFIDENCE,
    },
  ];
}

export function getConfirmedSource(sources: SourceItem[]): SourceItem | undefined {
  return sources.find((s) => s.confirmed);
}

/**
 * 卡片显示用：已确认的主来源优先；否则取把握最高的一条，并列按录入顺序。
 */
export function getPrimarySource(sources: SourceItem[]): SourceItem | null {
  if (!sources.length) return null;
  const confirmed = getConfirmedSource(sources);
  if (confirmed) return confirmed;
  let best = sources[0];
  for (const s of sources) {
    if (s.confidence > best.confidence) best = s;
  }
  return best;
}

export type SourcesCheck =
  | { valid: true }
  | { valid: false; error: string };

/** 保存规则：1–4 项、名称非空、把握 0–100 整数、合计 100。 */
export function validateSources(items: SourceItem[]): SourcesCheck {
  if (!items.length) return { valid: false, error: '至少保留一项气味来源' };
  if (items.length > MAX_SOURCES) {
    return { valid: false, error: `气味来源最多 ${MAX_SOURCES} 项` };
  }
  if (items.some((s) => !s.name.trim())) {
    return { valid: false, error: '请为每项来源填写名称' };
  }
  if (
    items.some(
      (s) => !Number.isInteger(s.confidence) || s.confidence < 0 || s.confidence > TOTAL_CONFIDENCE,
    )
  ) {
    return { valid: false, error: '每项把握需为 0–100 的整数' };
  }
  const total = items.reduce((acc, s) => acc + s.confidence, 0);
  if (total !== TOTAL_CONFIDENCE) {
    return { valid: false, error: `把握合计需为 ${TOTAL_CONFIDENCE}，当前为 ${total}` };
  }
  return { valid: true };
}

/**
 * 保存规则：已确认的主来源不能直接移除——
 * 只有当新清单中确认了另一条来源接手时，才允许移除原主来源。
 */
export function canReplaceSources(
  prev: SourceItem[] | undefined,
  next: SourceItem[],
): SourcesCheck {
  const validation = validateSources(next);
  if (validation.valid === false) return validation;
  const prevConfirmed = prev?.find((s) => s.confirmed);
  if (!prevConfirmed) return { valid: true };
  const stillExists = next.some((s) => s.id === prevConfirmed.id);
  if (stillExists) return { valid: true };
  const successor = next.find((s) => s.confirmed);
  if (!successor || successor.id === prevConfirmed.id) {
    return {
      valid: false,
      error: '已确认的主来源不能直接移除，请先确认另一条来源接手',
    };
  }
  return { valid: true };
}

/** 按权重把 total 分摊成整数，余数从末项往前补（新加入的项排在最后）。 */
function apportion(weights: number[], total: number): number[] {
  const safe = weights.map((w) => Math.max(0, w || 0));
  const sum = safe.reduce((a, b) => a + b, 0);
  const exact = safe.map((w) => (sum === 0 ? total / safe.length : (total * w) / sum));
  const result = exact.map(Math.floor);
  let leftover = total - result.reduce((a, b) => a + b, 0);
  // 余数优先补给排在最后的项，并列（如均分）时与录入顺序相反
  for (let i = result.length - 1; i >= 0 && leftover > 0; i--) {
    result[i] += 1;
    leftover -= 1;
  }
  return result;
}

/**
 * 新增一项：现有各项保持彼此相对比例、整体缩到 n/(n+1)，
 * 新项分得 1/(n+1)。单项 100 → 50/50 → 33/33/34，合计始终 100。
 */
export function addSourceItem(sources: SourceItem[]): SourceItem[] {
  if (sources.length >= MAX_SOURCES) return sources;
  const n = sources.length;
  const values = apportion(
    [...sources.map((s) => s.confidence * n), TOTAL_CONFIDENCE],
    TOTAL_CONFIDENCE,
  );
  return [
    ...sources.map((s, i) => ({ ...s, confidence: values[i] })),
    createSourceItem('', values[values.length - 1]),
  ];
}

/** 删除一项：剩余项按比例补足 100。已确认的主来源不在此移除（需先接手）。 */
export function removeSourceItem(sources: SourceItem[], id: string): SourceItem[] {
  if (sources.length <= 1) return sources;
  const target = sources.find((s) => s.id === id);
  if (target?.confirmed) return sources;
  const kept = sources.filter((s) => s.id !== id);
  if (kept.length === sources.length) return sources;
  const values = apportion(
    kept.map((s) => s.confidence),
    TOTAL_CONFIDENCE,
  );
  return kept.map((s, i) => ({ ...s, confidence: values[i] }));
}

export function updateSourceItem(
  sources: SourceItem[],
  id: string,
  patch: Partial<Omit<SourceItem, 'id'>>,
): SourceItem[] {
  return sources.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

/** 确认主来源；传 null 表示取消确认（卡片入口允许取消）。 */
export function setConfirmedSource(sources: SourceItem[], id: string | null): SourceItem[] {
  return sources.map((s) => ({
    ...s,
    confirmed: id === null ? undefined : s.id === id ? true : undefined,
  }));
}

/** 按当前相对比例把合计凑回 100。 */
export function rebalanceSources(sources: SourceItem[]): SourceItem[] {
  if (sources.length <= 1) {
    return sources.map((s) => ({ ...s, confidence: TOTAL_CONFIDENCE }));
  }
  const values = apportion(
    sources.map((s) => s.confidence),
    TOTAL_CONFIDENCE,
  );
  return sources.map((s, i) => ({ ...s, confidence: values[i] }));
}

export function getTotalConfidence(sources: SourceItem[]): number {
  return sources.reduce((acc, s) => acc + s.confidence, 0);
}
