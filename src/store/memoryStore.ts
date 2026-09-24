import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SmellMemory, Season, SmellType, Emotion, SourceItem } from '../utils/constants';
import { generateId } from '../utils/helpers';
import { normalizeMemory } from '../utils/sources';
import { mockMemories } from '../data/mockData';

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
  addMemory: (input: MemoryInput) => void;
  updateMemory: (id: string, input: MemoryInput) => void;
  deleteMemory: (id: string) => void;
  initIfEmpty: () => void;
}

/** 入库前清洗来源清单：剔除空名称、重新编号保证结构合法 */
function cleanInput(input: MemoryInput): MemoryInput {
  return {
    ...input,
    sources: input.sources
      .filter((s) => s.name.trim())
      .map((s) => ({ ...s, name: s.name.trim() })),
  };
}

export const useMemoryStore = create<MemoryStore>()(
  persist(
    (set, get) => ({
      memories: [],
      addMemory: (input) => {
        const now = new Date().toISOString();
        const newMem: SmellMemory = {
          id: generateId(),
          ...cleanInput(input),
          created_at: now,
          updated_at: now,
        };
        set({ memories: [newMem, ...get().memories] });
      },
      updateMemory: (id, input) => {
        set({
          memories: get().memories.map((m) =>
            m.id === id
              ? { ...m, ...cleanInput(input), updated_at: new Date().toISOString() }
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
      version: 2,
      storage: createJSONStorage(() => localStorage),
      // 旧记录没有来源清单：用原来的来源猜测整句补成单项 100
      migrate: (persisted: unknown, version: number) => {
        if (version < 2) {
          const state = persisted as { memories?: SmellMemory[] } | undefined;
          if (state && Array.isArray(state.memories)) {
            return { ...state, memories: state.memories.map((m) => normalizeMemory(m)) };
          }
        }
        return persisted;
      },
      // 双保险：即便没有走版本迁移，读取时也对每条记录做一次来源规整
      merge: (persisted, currentState) => {
        const state = (persisted ?? {}) as { memories?: SmellMemory[] };
        if (Array.isArray(state.memories)) {
          return {
            ...currentState,
            ...state,
            memories: state.memories.map((m) => normalizeMemory(m)),
          };
        }
        return { ...currentState, ...state };
      },
    },
  ),
);
