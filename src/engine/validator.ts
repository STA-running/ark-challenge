import type { OperatorData, HardConstraints } from '../types';

/**
 * 获取干员的部署费用（以精二为准）
 * 注意：operators.json 中当前无 cost 字段，返回 undefined
 */
function getOpCost(op: OperatorData): number | undefined {
  return op.cost;
}

/** 验证单个干员是否满足所有硬约束 */
export function validateOperator(
  op: OperatorData,
  hard: HardConstraints
): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // 职业约束
  if (hard.allowedProfessions && !hard.allowedProfessions.includes(op.profession)) {
    reasons.push(`职业"${op.profession}"不在允许列表中`);
  }
  if (hard.bannedProfessions.includes(op.profession)) {
    reasons.push(`职业"${op.profession}"已被禁用`);
  }

  // 稀有度约束
  if (hard.maxRarity !== null && op.rarity > hard.maxRarity) {
    reasons.push(`稀有度${op.rarity}超出上限(${hard.maxRarity})`);
  }
  if (hard.minRarity !== null && op.rarity < hard.minRarity) {
    reasons.push(`稀有度${op.rarity}低于下限(${hard.minRarity})`);
  }

  // 位置约束
  if (hard.positionRestriction && !hard.positionRestriction.includes(op.position)) {
    reasons.push(`部署位置"${op.position}"不符合要求`);
  }

  // 国家/地区约束
  if (hard.allowedNations && op.nation && !hard.allowedNations.includes(op.nation)) {
    reasons.push(`国家/地区"${op.nation}"不在允许列表中`);
  }
  if (hard.bannedNations.includes(op.nation || '')) {
    reasons.push(`国家/地区"${op.nation}"已被禁用`);
  }

  // 组织约束
  if (hard.allowedOrgs && op.org && !hard.allowedOrgs.includes(op.org)) {
    reasons.push(`组织"${op.org}"不在允许列表中`);
  }
  if (hard.bannedOrgs.includes(op.org || '')) {
    reasons.push(`组织"${op.org}"已被禁用`);
  }

  // 种族约束
  if (hard.allowedRaces && op.race && !hard.allowedRaces.includes(op.race)) {
    reasons.push(`种族"${op.race}"不在允许列表中`);
  }
  if (hard.bannedRaces.includes(op.race || '')) {
    reasons.push(`种族"${op.race}"已被禁用`);
  }

  // 阻挡数约束
  if (hard.blockTier !== null) {
    if (op.block === null || op.block === undefined) {
      // 无阻挡数数据的干员（极少见），在 exact 模式下拒绝
      if (hard.blockTierMode === 'exact') {
        reasons.push(`阻挡数未知，无法匹配要求(${hard.blockTier})`);
      }
    } else {
      if (hard.blockTierMode === 'exact' && op.block !== hard.blockTier) {
        reasons.push(`阻挡数${op.block}不匹配要求(${hard.blockTier})`);
      } else if (hard.blockTierMode === 'max' && op.block > hard.blockTier) {
        reasons.push(`阻挡数${op.block}超出上限(${hard.blockTier})`);
      }
    }
  }

  // 单干员费用约束（需有 cost 数据）
  const cost = getOpCost(op);
  if (cost !== undefined) {
    if (hard.maxSingleCost !== null && cost > hard.maxSingleCost) {
      reasons.push(`部署费用(${cost})超出单干员上限(${hard.maxSingleCost})`);
    }
    if (hard.minSingleCost !== null && cost < hard.minSingleCost) {
      reasons.push(`部署费用(${cost})低于单干员下限(${hard.minSingleCost})`);
    }
  }

  return { valid: reasons.length === 0, reasons };
}

/** 验证整个编队 */
export function validateSquad(
  squad: OperatorData[],
  hard: HardConstraints
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  // 人数检查
  if (hard.maxSquadSize !== null && squad.length > hard.maxSquadSize) {
    violations.push(`编队人数(${squad.length})超出上限(${hard.maxSquadSize})`);
  }

  // 同职业上限
  if (hard.maxSameProfession !== null) {
    const profCount = new Map<string, number>();
    squad.forEach((o) => {
      profCount.set(o.profession, (profCount.get(o.profession) || 0) + 1);
    });
    for (const [prof, count] of profCount) {
      if (count > hard.maxSameProfession) {
        violations.push(`职业"${prof}"(${count}人)超出上限(${hard.maxSameProfession})`);
      }
    }
  }

  // 6星数量上限
  if (hard.maxSixStarCount !== null) {
    const sixStarCount = squad.filter((o) => o.rarity === 6).length;
    if (sixStarCount > hard.maxSixStarCount) {
      violations.push(`6星干员(${sixStarCount}人)超出上限(${hard.maxSixStarCount})`);
    }
  }

  // 编队总费用上限
  if (hard.maxTotalCost !== null) {
    const totalCost = squad.reduce((sum, o) => {
      const cost = o.cost;
      return sum + (typeof cost === 'number' ? cost : 0);
    }, 0);
    if (totalCost > hard.maxTotalCost) {
      violations.push(`编队总费用(${totalCost})超出上限(${hard.maxTotalCost})`);
    }
  }

  // 同国家约束
  if (hard.sameNationOnly) {
    const nations = [...new Set(squad.filter((o) => o.nation).map((o) => o.nation))];
    if (nations.length > 1) violations.push(`编队含多个国家/地区: ${nations.join('、')}`);
  }

  // 同组织约束
  if (hard.sameOrgOnly) {
    const orgs = [...new Set(squad.filter((o) => o.org).map((o) => o.org))];
    if (orgs.length > 1) violations.push(`编队含多个组织: ${orgs.join('、')}`);
  }

  // 同种族约束
  if (hard.sameRaceOnly) {
    const races = [...new Set(squad.filter((o) => o.race).map((o) => o.race))];
    if (races.length > 1) violations.push(`编队含多个种族: ${races.join('、')}`);
  }

  // 同阻挡数上限
  if (hard.maxSameBlockTier !== null) {
    const tierCount = new Map<number, number>();
    squad.forEach((o) => {
      if (o.block !== null && o.block !== undefined) {
        tierCount.set(o.block, (tierCount.get(o.block) || 0) + 1);
      }
    });
    for (const [tier, count] of tierCount) {
      if (count > hard.maxSameBlockTier) {
        violations.push(`阻挡数${tier}的干员(${count}人)超出上限(${hard.maxSameBlockTier})`);
      }
    }
  }

  // 逐个干员约束检查（职业、种族、稀有度、位置、阻挡数、费用）
  for (const op of squad) {
    const result = validateOperator(op, hard);
    if (!result.valid) {
      violations.push(`${op.name}: ${result.reasons.join('；')}`);
    }
  }

  return { valid: violations.length === 0, violations };
}
