import type { ChallengeTag, HardConstraints, SoftConstraints, OperatorData } from '../types';

/**
 * 从 /data/tags.json 异步加载标签
 */
export async function loadTags(): Promise<ChallengeTag[]> {
  const res = await fetch('/data/tags.json');
  if (!res.ok) {
    throw new Error(`加载标签失败: ${res.status}`);
  }
  const data: ChallengeTag[] = await res.json();
  return data;
}

/**
 * Fisher-Yates 洗牌后随机抽取 count 个不重复标签
 */
export function drawRandomTags(tags: ChallengeTag[], count: number): ChallengeTag[] {
  const arr = [...tags];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(count, arr.length));
}

/**
 * 替换指定位置的标签（用于换一换功能）
 */
export function rerollSingleTag(
  currentTags: ChallengeTag[],
  index: number,
  pool: ChallengeTag[]
): ChallengeTag[] {
  // 边界检查：index 越界时直接返回原数组
  if (index < 0 || index >= currentTags.length) return currentTags;

  const currentId = currentTags[index]?.id;
  // 从池中排除当前已选的标签（除了要替换的那个）
  const usedIds = new Set(currentTags.map((t) => t.id));
  usedIds.delete(currentId);

  const available = pool.filter((t) => !usedIds.has(t.id));
  if (available.length === 0) return currentTags;

  const idx = Math.floor(Math.random() * available.length);
  const result = [...currentTags];
  result[index] = available[idx];
  return result;
}

/**
 * 合并多个标签的约束
 * - 数值类取更严格（更小）的值
 * - 白名单数组取交集
 * - 黑名单数组取并集
 * - 布尔值取并集（任意标签开启则开启）
 */
export function mergeTagsToConstraints(tags: ChallengeTag[]): {
  hard: HardConstraints;
  soft: SoftConstraints;
} {
  const hard: HardConstraints = {
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

  const soft: SoftConstraints = {
    noSkill: false,
    afkOnly: false,
    noRetreat: false,
    noRedeploy: false,
    zeroLeak: false,
    maxSteps: null,
    customRules: [],
  };

  for (const tag of tags) {
    const hc = tag.hardConstraints;
    const sc = tag.softConstraints;

    // ---- 数值类约束：取更严格（更小）的值 ----
    if (hc.maxSquadSize !== undefined && hc.maxSquadSize !== null) {
      hard.maxSquadSize = hard.maxSquadSize === null
        ? hc.maxSquadSize
        : Math.min(hard.maxSquadSize, hc.maxSquadSize);
    }
    if (hc.maxSameProfession !== undefined && hc.maxSameProfession !== null) {
      hard.maxSameProfession = hard.maxSameProfession === null
        ? hc.maxSameProfession
        : Math.min(hard.maxSameProfession, hc.maxSameProfession);
    }
    if (hc.maxRarity !== undefined && hc.maxRarity !== null) {
      hard.maxRarity = hard.maxRarity === null
        ? hc.maxRarity
        : Math.min(hard.maxRarity, hc.maxRarity);
    }
    if (hc.minRarity !== undefined && hc.minRarity !== null) {
      hard.minRarity = hard.minRarity === null
        ? hc.minRarity
        : Math.max(hard.minRarity, hc.minRarity);
    }
    if (hc.maxSixStarCount !== undefined && hc.maxSixStarCount !== null) {
      hard.maxSixStarCount = hard.maxSixStarCount === null
        ? hc.maxSixStarCount
        : Math.min(hard.maxSixStarCount, hc.maxSixStarCount);
    }
    if (hc.maxTotalCost !== undefined && hc.maxTotalCost !== null) {
      hard.maxTotalCost = hard.maxTotalCost === null
        ? hc.maxTotalCost
        : Math.min(hard.maxTotalCost, hc.maxTotalCost);
    }
    if (hc.maxSingleCost !== undefined && hc.maxSingleCost !== null) {
      hard.maxSingleCost = hard.maxSingleCost === null
        ? hc.maxSingleCost
        : Math.min(hard.maxSingleCost, hc.maxSingleCost);
    }
    if (hc.minSingleCost !== undefined && hc.minSingleCost !== null) {
      hard.minSingleCost = hard.minSingleCost === null
        ? hc.minSingleCost
        : Math.max(hard.minSingleCost, hc.minSingleCost);
    }
    if (hc.rareRaceOnly !== undefined && hc.rareRaceOnly !== null) {
      hard.rareRaceOnly = hard.rareRaceOnly === null
        ? hc.rareRaceOnly
        : Math.min(hard.rareRaceOnly, hc.rareRaceOnly);
    }
    if (hc.blockTier !== undefined && hc.blockTier !== null) {
      // blockTier 取最严格的（数值最小的）
      hard.blockTier = hard.blockTier === null
        ? hc.blockTier
        : (Math.min(hard.blockTier, hc.blockTier) as 0 | 1 | 2 | 3);
    }

    // blockTierMode: 如果已有约束且新约束不同，取 'exact'（更严格）
    if (hc.blockTierMode !== undefined) {
      if (hard.blockTierMode === 'max' && hc.blockTierMode === 'exact') {
        hard.blockTierMode = 'exact';
      } else if (hard.blockTierMode === 'exact' && hc.blockTierMode === 'max') {
        // 保持 exact
      } else {
        hard.blockTierMode = hc.blockTierMode;
      }
    }

    // maxSteps (软约束)
    if (sc.maxSteps !== undefined && sc.maxSteps !== null) {
      soft.maxSteps = soft.maxSteps === null
        ? sc.maxSteps
        : Math.min(soft.maxSteps, sc.maxSteps);
    }

    // ---- 布尔值取并集（任一 true 则为 true） ----
    if (hc.sameNationOnly) hard.sameNationOnly = true;
    if (hc.sameOrgOnly) hard.sameOrgOnly = true;
    if (hc.sameRaceOnly) hard.sameRaceOnly = true;
    if (sc.noSkill) soft.noSkill = true;
    if (sc.afkOnly) soft.afkOnly = true;
    if (sc.noRetreat) soft.noRetreat = true;
    if (sc.noRedeploy) soft.noRedeploy = true;
    if (sc.zeroLeak) soft.zeroLeak = true;

    // ---- 白名单数组取交集 ----
    if (hc.allowedProfessions !== undefined && hc.allowedProfessions !== null) {
      if (hard.allowedProfessions === null) {
        hard.allowedProfessions = [...hc.allowedProfessions];
      } else {
        hard.allowedProfessions = hard.allowedProfessions.filter(
          (p) => hc.allowedProfessions!.includes(p)
        );
      }
    }
    if (hc.allowedSubProfessions !== undefined && hc.allowedSubProfessions !== null) {
      if (hard.allowedSubProfessions === null) {
        hard.allowedSubProfessions = [...hc.allowedSubProfessions];
      } else {
        hard.allowedSubProfessions = hard.allowedSubProfessions.filter(
          (p) => hc.allowedSubProfessions!.includes(p)
        );
      }
    }
    if (hc.allowedOperators !== undefined && hc.allowedOperators !== null) {
      if (hard.allowedOperators === null) {
        hard.allowedOperators = [...hc.allowedOperators];
      } else {
        hard.allowedOperators = hard.allowedOperators.filter(
          (o) => hc.allowedOperators!.includes(o)
        );
      }
    }
    if (hc.allowedNations !== undefined && hc.allowedNations !== null) {
      if (hard.allowedNations === null) {
        hard.allowedNations = [...hc.allowedNations];
      } else {
        hard.allowedNations = hard.allowedNations.filter(
          (n) => hc.allowedNations!.includes(n)
        );
      }
    }
    if (hc.allowedOrgs !== undefined && hc.allowedOrgs !== null) {
      if (hard.allowedOrgs === null) {
        hard.allowedOrgs = [...hc.allowedOrgs];
      } else {
        hard.allowedOrgs = hard.allowedOrgs.filter(
          (o) => hc.allowedOrgs!.includes(o)
        );
      }
    }
    if (hc.allowedRaces !== undefined && hc.allowedRaces !== null) {
      if (hard.allowedRaces === null) {
        hard.allowedRaces = [...hc.allowedRaces];
      } else {
        hard.allowedRaces = hard.allowedRaces.filter(
          (r) => hc.allowedRaces!.includes(r)
        );
      }
    }
    if (hc.positionRestriction !== undefined && hc.positionRestriction !== null) {
      if (hard.positionRestriction === null) {
        hard.positionRestriction = [...hc.positionRestriction];
      } else {
        hard.positionRestriction = hard.positionRestriction.filter(
          (p) => hc.positionRestriction!.includes(p)
        );
      }
    }

    // ---- 黑名单数组取并集 ----
    if (hc.bannedProfessions !== undefined && hc.bannedProfessions.length > 0) {
      for (const p of hc.bannedProfessions) {
        if (!hard.bannedProfessions.includes(p)) hard.bannedProfessions.push(p);
      }
    }
    if (hc.bannedSubProfessions !== undefined && hc.bannedSubProfessions.length > 0) {
      for (const p of hc.bannedSubProfessions) {
        if (!hard.bannedSubProfessions.includes(p)) hard.bannedSubProfessions.push(p);
      }
    }
    if (hc.bannedOperators !== undefined && hc.bannedOperators.length > 0) {
      for (const o of hc.bannedOperators) {
        if (!hard.bannedOperators.includes(o)) hard.bannedOperators.push(o);
      }
    }
    if (hc.bannedNations !== undefined && hc.bannedNations.length > 0) {
      for (const n of hc.bannedNations) {
        if (!hard.bannedNations.includes(n)) hard.bannedNations.push(n);
      }
    }
    if (hc.bannedOrgs !== undefined && hc.bannedOrgs.length > 0) {
      for (const o of hc.bannedOrgs) {
        if (!hard.bannedOrgs.includes(o)) hard.bannedOrgs.push(o);
      }
    }
    if (hc.bannedRaces !== undefined && hc.bannedRaces.length > 0) {
      for (const r of hc.bannedRaces) {
        if (!hard.bannedRaces.includes(r)) hard.bannedRaces.push(r);
      }
    }

    // ---- 自定义规则 ----
    if (sc.customRules !== undefined && sc.customRules.length > 0) {
      for (const rule of sc.customRules) {
        if (!soft.customRules.includes(rule)) soft.customRules.push(rule);
      }
    }
  }

  return { hard, soft };
}

/**
 * 从干员列表中过滤出符合所有硬约束的干员
 * 注意：编队级约束（maxSquadSize, sameNationOnly等）在此不检查
 */
export function filterOperatorsByHardConstraints(
  operators: Record<string, OperatorData>,
  hard: HardConstraints
): OperatorData[] {
  const ops = Object.values(operators);
  return ops.filter((op) => {
    // 指名干员约束（白名单/黑名单）
    if (hard.allowedOperators !== null && !hard.allowedOperators.includes(op.name)) {
      return false;
    }
    if (hard.bannedOperators.includes(op.name)) {
      return false;
    }

    // 职业约束
    if (hard.allowedProfessions !== null && !hard.allowedProfessions.includes(op.profession)) {
      return false;
    }
    if (hard.bannedProfessions.includes(op.profession)) {
      return false;
    }

    // 子职业约束
    if (hard.allowedSubProfessions !== null && !hard.allowedSubProfessions.includes(op.subProfession)) {
      return false;
    }
    if (hard.bannedSubProfessions.includes(op.subProfession)) {
      return false;
    }

    // 稀有度约束
    if (hard.maxRarity !== null && op.rarity > hard.maxRarity) {
      return false;
    }
    if (hard.minRarity !== null && op.rarity < hard.minRarity) {
      return false;
    }

    // 位置约束
    if (hard.positionRestriction !== null && !hard.positionRestriction.includes(op.position)) {
      return false;
    }

    // 种族约束
    if (hard.allowedRaces !== null && op.race !== null && !hard.allowedRaces.includes(op.race)) {
      return false;
    }
    if (hard.bannedRaces.includes(op.race || '')) {
      return false;
    }

    // 稀有种族约束（rareRaceOnly：最多允许 N 种族的干员通过）
    // 此处为个体过滤，rareRaceOnly 语义为"编队中最多出现N个种族"，
    // 属于编队级约束，不在个体过滤中检查。
    // 注：如果 rareRaceOnly 是标签级的"只允许稀有度≤N的种族"，语义模糊，暂不实现。

    // 阻挡数约束
    if (hard.blockTier !== null && op.block !== null) {
      if (hard.blockTierMode === 'exact' && op.block !== hard.blockTier) {
        return false;
      }
      if (hard.blockTierMode === 'max' && op.block > hard.blockTier) {
        return false;
      }
    }

    // 国家/地区
    if (hard.allowedNations !== null && op.nation !== null && !hard.allowedNations.includes(op.nation)) {
      return false;
    }
    if (hard.bannedNations.includes(op.nation || '')) {
      return false;
    }

    // 组织
    if (hard.allowedOrgs !== null && op.org !== null && !hard.allowedOrgs.includes(op.org)) {
      return false;
    }
    if (hard.bannedOrgs.includes(op.org || '')) {
      return false;
    }

    // 单干员费用约束
    const cost = op.cost;
    if (typeof cost === 'number') {
      if (hard.maxSingleCost !== null && cost > hard.maxSingleCost) {
        return false;
      }
      if (hard.minSingleCost !== null && cost < hard.minSingleCost) {
        return false;
      }
    }

    return true;
  });
}
