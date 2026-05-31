import { create } from 'zustand';
import type { OperatorData, HardConstraints, SoftConstraints, ChallengePlan } from '../types';

// 默认约束
const defaultHardConstraints: HardConstraints = {
  maxSquadSize: null,
  maxSameProfession: null,
  allowedProfessions: null,
  bannedProfessions: [],
  allowedSubProfessions: null,
  bannedSubProfessions: [],
  maxRarity: null,
  minRarity: null,
  maxSixStarCount: null,
  maxTotalCost: null,
  maxSingleCost: null,
  minSingleCost: null,
  allowedOperators: null,
  bannedOperators: [],
  positionRestriction: null,
  sameNationOnly: false,
  sameOrgOnly: false,
  allowedNations: null,
  bannedNations: [],
  allowedOrgs: null,
  bannedOrgs: [],
  allowedRaces: null,
  bannedRaces: [],
  sameRaceOnly: false,
  rareRaceOnly: null,
  blockTier: null,
  blockTierMode: 'exact',
  maxSameBlockTier: null,
};

const defaultSoftConstraints: SoftConstraints = {
  noSkill: false,
  afkOnly: false,
  noRetreat: false,
  noRedeploy: false,
  zeroLeak: false,
  maxSteps: null,
  customRules: [],
};

interface AppState {
  // 干员数据
  operators: Record<string, OperatorData>;
  operatorsLoaded: boolean;

  // 编队
  squad: OperatorData[];
  squadValidation: Record<number, { valid: boolean; reasons: string[] }>;

  // 约束
  hardConstraints: HardConstraints;
  softConstraints: SoftConstraints;

  // 标签
  confirmedTags: string[];
  tagMode: 'manual' | 'random';

  // 关卡
  confirmedStage: string | null;

  // 方案
  plans: ChallengePlan[];

  // 编辑状态
  editingEnabled: boolean;
  currentPage: 'squad' | 'settings';

  // 操作
  setOperators: (data: Record<string, OperatorData>) => void;
  setPage: (page: 'squad' | 'settings') => void;
  addToSquad: (op: OperatorData) => void;
  removeFromSquad: (index: number) => void;
  clearSquad: () => void;
  confirmTags: (tags: string[]) => void;
  setTagMode: (mode: 'manual' | 'random') => void;
  confirmStage: (stage: string | null) => void;
  enableEditing: () => void;
  setHardConstraints: (c: Partial<HardConstraints>) => void;
  setSoftConstraints: (c: Partial<SoftConstraints>) => void;
  savePlan: (name: string) => void;
  deletePlan: (id: number) => void;
  toggleFav: (id: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  operators: {},
  operatorsLoaded: false,
  squad: [],
  squadValidation: {},
  hardConstraints: { ...defaultHardConstraints },
  softConstraints: { ...defaultSoftConstraints },
  confirmedTags: [],
  tagMode: 'manual',
  confirmedStage: null,
  plans: [],
  editingEnabled: false,
  currentPage: 'squad',

  setOperators: (data) => set({ operators: data, operatorsLoaded: true }),
  setPage: (page) => set({ currentPage: page }),

  addToSquad: (op) => {
    const squad = get().squad;
    if (squad.length >= 12) return;
    if (squad.some((s) => s.name === op.name)) return;
    set({ squad: [...squad, op] });
  },

  removeFromSquad: (index) => {
    const squad = get().squad.filter((_, i) => i !== index);
    set({ squad });
  },

  clearSquad: () => set({ squad: [] }),

  confirmTags: (tags) =>
    set({ confirmedTags: tags, tagMode: tags.length > 0 ? 'manual' : get().tagMode }),

  setTagMode: (mode) => set({ tagMode: mode }),

  confirmStage: (stage) => set({ confirmedStage: stage }),

  enableEditing: () => set({ editingEnabled: true }),

  setHardConstraints: (c) =>
    set({ hardConstraints: { ...get().hardConstraints, ...c } }),

  setSoftConstraints: (c) =>
    set({ softConstraints: { ...get().softConstraints, ...c } }),

  savePlan: (name) => {
    const { squad, hardConstraints, softConstraints, confirmedTags, confirmedStage } = get();
    const newPlan: ChallengePlan = {
      id: Date.now(),
      name: name || squad.map((o) => o.name).slice(0, 3).join('+') || '空编队',
      tags: confirmedTags,
      stage: confirmedStage,
      fav: false,
      squad: squad.map((o) => o.name),
      hardConstraints,
      softConstraints,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    set({ plans: [newPlan, ...get().plans] });
  },

  deletePlan: (id) =>
    set({ plans: get().plans.filter((p) => p.id !== id) }),

  toggleFav: (id) =>
    set({
      plans: get().plans.map((p) =>
        p.id === id ? { ...p, fav: !p.fav } : p
      ),
    }),
}));
