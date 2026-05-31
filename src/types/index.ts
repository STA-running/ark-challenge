// 干员数据类型
export interface OperatorData {
  name: string;
  profession: string;
  subProfession: string;
  rarity: number;
  position: string;
  tags: string[] | null;
  nation: string | null;
  org: string | null;
  race: string | null;
  block: number | null;
  cost: number;
  avatar: string | null;
  charIndex: number;
}

// 干员数据索引
export interface OperatorsDB {
  version: string;
  builtAt: string;
  total: number;
  operators: Record<string, OperatorData>;
  stats: {
    withNation: number;
    withOrg: number;
    withRace: number;
    noNation: number;
    noOrg: number;
    noRace: number;
    blockByCount: {
      zero: number;
      one: number;
      two: number;
      threePlus: number;
      null: number;
    };
  };
}

// 硬约束类型
export interface HardConstraints {
  maxSquadSize: number | null;
  maxSameProfession: number | null;
  allowedProfessions: string[] | null;
  bannedProfessions: string[];
  allowedSubProfessions: string[] | null;
  bannedSubProfessions: string[];
  maxRarity: number | null;
  minRarity: number | null;
  maxSixStarCount: number | null;
  maxTotalCost: number | null;
  maxSingleCost: number | null;
  minSingleCost: number | null;
  allowedOperators: string[] | null;
  bannedOperators: string[];
  positionRestriction: string[] | null;
  sameNationOnly: boolean;
  sameOrgOnly: boolean;
  allowedNations: string[] | null;
  bannedNations: string[];
  allowedOrgs: string[] | null;
  bannedOrgs: string[];
  allowedRaces: string[] | null;
  bannedRaces: string[];
  sameRaceOnly: boolean;
  rareRaceOnly: number | null;
  blockTier: 0 | 1 | 2 | 3 | null;
  blockTierMode: 'exact' | 'max';
  maxSameBlockTier: number | null;
}

// 软约束类型
export interface SoftConstraints {
  noSkill: boolean;
  afkOnly: boolean;
  noRetreat: boolean;
  noRedeploy: boolean;
  zeroLeak: boolean;
  maxSteps: number | null;
  customRules: string[];
}

// 标签分类
export type TagCategory =
  | 'squad' | 'rarity' | 'cost' | 'position'
  | 'operation' | 'special' | 'faction' | 'race' | 'block' | 'other';

// 挑战标签
export interface ChallengeTag {
  id: string;
  name: string;
  icon: string;
  category: TagCategory;
  detail: string;
  difficulty: number;
  hardConstraints: Partial<HardConstraints>;
  softConstraints: Partial<SoftConstraints>;
}

// 关卡数据
export interface StageData {
  id: string;
  name: string;
  fullName: string;
  chapter: string;
  type: 'normal' | 'boss' | 'hard' | 'hard_boss';
  mapImage?: string;
  detail?: string;
  recommendedLevel?: string;
  hasSandtable?: boolean;
}

// 挑战方案
export interface ChallengePlan {
  id: number;
  name: string;
  tags: string[];
  stage: string | null;
  fav: boolean;
  squad: string[];
  hardConstraints: HardConstraints;
  softConstraints: SoftConstraints;
  createdAt: string;
}
