import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SmellMemory, Season, SmellType, Emotion } from '../utils/constants';
import { generateId } from '../utils/helpers';
import { mockMemories } from '../data/mockData';
import {
  type SourceItem,
  MAX_SOURCES,
  canReplaceSources,
  clampConfidence,
  normalizeSources,
  setConfirmedSource,
} from '../utils/sources';

export interface MemoryInput {
  location: string;
  sources: SourceItem[];
  intensity: number;
  humidity: number;
  season: Season;
  smell_type: SmellType;
  memory_text: string;
  color_association: string;
  emotion: Emotion;
  want_again: boolean;
}

interface MemoryStore {
  memories: SmellMemory[];
  addMemory: (input: MemoryInput) => boolean;
  updateMemory: (id: string, input: MemoryInput) => boolean;
  confirmSource: (memoryId: string, sourceId: string | null) => void;
  deleteMemory: (id: string) => void;
  initIfEmpty: () => void;
}

/** 保存规则兜底：清洗来源清单，最多四项、把握取整到 0–100，录入顺序保持不变。 */
function sanitizeSources(sources: SourceItem[]): SourceItem[] {
  const list = (Array.isArray(sources) ? sources : []).slice(0, MAX_SOURCES);
  let seenConfirmed = false;
  return list.map((s) => {
    const isConfirmed = s.confirmed === true && !seenConfirmed;
    if (s.confirmed === true) seenConfirmed = true;
    return {
      id: typeof s.id === 'string' && s.id ? s.id : generateId(),
      name: typeof s.name === 'string' ? s.name.trim() : '',
      confidence: clampConfidence(s.confidence),
      confirmed: isConfirmed || undefined,
    };
  });
}

function buildMemory(input: MemoryInput, id: string, now: string): SmellMemory {
  return {
    id,
    location: input.location.trim(),
    sources: sanitizeSources(input.sources),
    intensity: input.intensity,
    humidity: input.humidity,
    season: input.season,
    smell_type: input.smell_type,
    memory_text: input.memory_text,
    color_association: input.color_association,
    emotion: input.emotion,
    want_again: input.want_again,
    created_at: now,
    updated_at: now,
  };
}

export const useMemoryStore = create<MemoryStore>()(
  persist(
    (set, get) => ({
      memories: [],
      addMemory: (input) => {
        const sources = sanitizeSources(input.sources);
        const check = canReplaceSources(undefined, sources);
        if (check.valid === false) return false;
        const now = new Date().toISOString();
        const newMem = buildMemory({ ...input, sources }, generateId(), now);
        set({ memories: [newMem, ...get().memories] });
        return true;
      },
      updateMemory: (id, input) => {
        const target = get().memories.find((m) => m.id === id);
        const sources = sanitizeSources(input.sources);
        const replaceCheck = canReplaceSources(target?.sources, sources);
        // 已确认主来源不能直接移除：需在同一提交里确认另一条接手
        if (replaceCheck.valid === false) return false;
        const now = new Date().toISOString();
        set({
          memories: get().memories.map((m) =>
            m.id === id
              ? { ...buildMemory({ ...input, sources }, m.id, m.created_at), updated_at: now }
              : m,
          ),
        });
        return true;
      },
      confirmSource: (memoryId, sourceId) => {
        set({
          memories: get().memories.map((m) =>
            m.id === memoryId
              ? { ...m, sources: setConfirmedSource(m.sources, sourceId), updated_at: new Date().toISOString() }
              : m,
          ),
        });
      },
      deleteMemory: (id) => {
        set({ memories: get().memories.filter((m) => m.id !== id) });
      },
      initIfEmpty: () => {
        if (get().memories.length === 0) {
          set({ memories: mockMemories });
        }
      },
    }),
    {
      name: 'scent-memory-storage',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // 旧记录没有清单时，用原来的来源猜测补成单项 100
      migrate: (persisted) => {
        const state = persisted as { memories?: SmellMemory[] } | undefined;
        if (!state || !Array.isArray(state.memories)) return state;
        return {
          ...state,
          memories: state.memories.map((m) => ({
            ...m,
            sources: normalizeSources(m as unknown as { sources?: unknown; source_guess?: unknown }),
          })),
        };
      },
    },
  ),
);
