/**
 * 引擎模块测试脚本
 *
 * 测试 tagEngine, shareCode, validator 三个模块
 * 将 TypeScript 的关键函数逻辑翻译为 JS 进行测试
 * 在 Node.js 22+ 上以 ESM 模式运行
 */
import { readFileSync, writeFileSync } from 'fs';

// ============================================================
// 0. 辅助函数
// ============================================================
let passed = 0;
let failed = 0;
const failures = [];
let currentSection = '';

function assert(condition, msg) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push({ msg, err: new Error(msg) });
    console.error(`  ❌ ${msg}`);
  }
}

function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    const errMsg = `${msg}\n    预期: ${e}\n    实际: ${a}`;
    failures.push({ msg: errMsg, err: new Error(errMsg) });
    console.error(`  ❌ ${msg}`);
    console.error(`    预期: ${e}`);
    console.error(`    实际: ${a}`);
  }
}

function assertDeepEqual(actual, expected, msg) {
  assertEqual(actual, expected, msg);
}

function describe(section) {
  currentSection = section;
  console.log(`\n## ${section}`);
  return section;
}

// ============================================================
// 加载数据文件
// ============================================================
const tags = JSON.parse(readFileSync('public/data/tags.json', 'utf8'));
const stages = JSON.parse(readFileSync('public/data/stages.json', 'utf8'));
const operatorsRaw = JSON.parse(readFileSync('public/data/operators.json', 'utf8'));
const operators = operatorsRaw.operators;
const operatorList = Object.values(operators);

console.log('========================================');
console.log('  明日方舟自限挑战规则器 - 引擎测试');
console.log('========================================');
console.log(`标签数: ${tags.length}, 关卡数: ${stages.length}, 干员数: ${operatorList.length}`);
console.log();

// ============================================================
// 1. 重写被测试函数（JS 版，逻辑与 TS 一致）
// ============================================================

// ---- Fisher-Yates 洗牌后随机抽取 ----
function drawRandomTags(tagsArr, count) {
  const arr = [...tagsArr];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(count, arr.length));
}

// ---- 替换指定位置的标签 ----
function rerollSingleTag(currentTags, index, pool) {
  // 边界检查：index 越界时直接返回原数组
  if (index < 0 || index >= currentTags.length) return currentTags;

  const currentId = currentTags[index]?.id;
  const usedIds = new Set(currentTags.map((t) => t.id));
  usedIds.delete(currentId);
  const available = pool.filter((t) => !usedIds.has(t.id));
  if (available.length === 0) return currentTags;
  const idx = Math.floor(Math.random() * available.length);
  const result = [...currentTags];
  result[index] = available[idx];
  return result;
}

// ---- 合并多个标签的约束 ----
function mergeTagsToConstraints(tags) {
  const hard = {
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

  const soft = {
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
      hard.maxSquadSize = hard.maxSquadSize === null ? hc.maxSquadSize : Math.min(hard.maxSquadSize, hc.maxSquadSize);
    }
    if (hc.maxSameProfession !== undefined && hc.maxSameProfession !== null) {
      hard.maxSameProfession = hard.maxSameProfession === null ? hc.maxSameProfession : Math.min(hard.maxSameProfession, hc.maxSameProfession);
    }
    if (hc.maxRarity !== undefined && hc.maxRarity !== null) {
      hard.maxRarity = hard.maxRarity === null ? hc.maxRarity : Math.min(hard.maxRarity, hc.maxRarity);
    }
    if (hc.minRarity !== undefined && hc.minRarity !== null) {
      hard.minRarity = hard.minRarity === null ? hc.minRarity : Math.max(hard.minRarity, hc.minRarity);
    }
    if (hc.maxSixStarCount !== undefined && hc.maxSixStarCount !== null) {
      hard.maxSixStarCount = hard.maxSixStarCount === null ? hc.maxSixStarCount : Math.min(hard.maxSixStarCount, hc.maxSixStarCount);
    }
    if (hc.maxTotalCost !== undefined && hc.maxTotalCost !== null) {
      hard.maxTotalCost = hard.maxTotalCost === null ? hc.maxTotalCost : Math.min(hard.maxTotalCost, hc.maxTotalCost);
    }
    if (hc.maxSingleCost !== undefined && hc.maxSingleCost !== null) {
      hard.maxSingleCost = hard.maxSingleCost === null ? hc.maxSingleCost : Math.min(hard.maxSingleCost, hc.maxSingleCost);
    }
    if (hc.minSingleCost !== undefined && hc.minSingleCost !== null) {
      hard.minSingleCost = hard.minSingleCost === null ? hc.minSingleCost : Math.max(hard.minSingleCost, hc.minSingleCost);
    }
    if (hc.rareRaceOnly !== undefined && hc.rareRaceOnly !== null) {
      hard.rareRaceOnly = hard.rareRaceOnly === null ? hc.rareRaceOnly : Math.min(hard.rareRaceOnly, hc.rareRaceOnly);
    }
    if (hc.blockTier !== undefined && hc.blockTier !== null) {
      hard.blockTier = hard.blockTier === null ? hc.blockTier : Math.min(hard.blockTier, hc.blockTier);
    }

    // blockTierMode
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
      soft.maxSteps = soft.maxSteps === null ? sc.maxSteps : Math.min(soft.maxSteps, sc.maxSteps);
    }

    // ---- 布尔值取并集 ----
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
        hard.allowedProfessions = hard.allowedProfessions.filter((p) => hc.allowedProfessions.includes(p));
      }
    }
    if (hc.allowedSubProfessions !== undefined && hc.allowedSubProfessions !== null) {
      if (hard.allowedSubProfessions === null) {
        hard.allowedSubProfessions = [...hc.allowedSubProfessions];
      } else {
        hard.allowedSubProfessions = hard.allowedSubProfessions.filter((p) => hc.allowedSubProfessions.includes(p));
      }
    }
    if (hc.allowedOperators !== undefined && hc.allowedOperators !== null) {
      if (hard.allowedOperators === null) {
        hard.allowedOperators = [...hc.allowedOperators];
      } else {
        hard.allowedOperators = hard.allowedOperators.filter((o) => hc.allowedOperators.includes(o));
      }
    }
    if (hc.allowedNations !== undefined && hc.allowedNations !== null) {
      if (hard.allowedNations === null) {
        hard.allowedNations = [...hc.allowedNations];
      } else {
        hard.allowedNations = hard.allowedNations.filter((n) => hc.allowedNations.includes(n));
      }
    }
    if (hc.allowedOrgs !== undefined && hc.allowedOrgs !== null) {
      if (hard.allowedOrgs === null) {
        hard.allowedOrgs = [...hc.allowedOrgs];
      } else {
        hard.allowedOrgs = hard.allowedOrgs.filter((o) => hc.allowedOrgs.includes(o));
      }
    }
    if (hc.allowedRaces !== undefined && hc.allowedRaces !== null) {
      if (hard.allowedRaces === null) {
        hard.allowedRaces = [...hc.allowedRaces];
      } else {
        hard.allowedRaces = hard.allowedRaces.filter((r) => hc.allowedRaces.includes(r));
      }
    }
    if (hc.positionRestriction !== undefined && hc.positionRestriction !== null) {
      if (hard.positionRestriction === null) {
        hard.positionRestriction = [...hc.positionRestriction];
      } else {
        hard.positionRestriction = hard.positionRestriction.filter((p) => hc.positionRestriction.includes(p));
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

// ---- 验证单个干员 ----
function validateOperator(op, hard) {
  const reasons = [];

  if (hard.allowedProfessions && !hard.allowedProfessions.includes(op.profession)) {
    reasons.push(`职业"${op.profession}"不在允许列表中`);
  }
  if (hard.bannedProfessions.includes(op.profession)) {
    reasons.push(`职业"${op.profession}"已被禁用`);
  }
  if (hard.maxRarity !== null && op.rarity > hard.maxRarity) {
    reasons.push(`稀有度${op.rarity}超出上限(${hard.maxRarity})`);
  }
  if (hard.minRarity !== null && op.rarity < hard.minRarity) {
    reasons.push(`稀有度${op.rarity}低于下限(${hard.minRarity})`);
  }
  if (hard.positionRestriction && !hard.positionRestriction.includes(op.position)) {
    reasons.push(`部署位置"${op.position}"不符合要求`);
  }
  if (hard.allowedNations && op.nation && !hard.allowedNations.includes(op.nation)) {
    reasons.push(`国家/地区"${op.nation}"不在允许列表中`);
  }
  if (hard.bannedNations.includes(op.nation || '')) {
    reasons.push(`国家/地区"${op.nation}"已被禁用`);
  }
  if (hard.allowedOrgs && op.org && !hard.allowedOrgs.includes(op.org)) {
    reasons.push(`组织"${op.org}"不在允许列表中`);
  }
  if (hard.bannedOrgs.includes(op.org || '')) {
    reasons.push(`组织"${op.org}"已被禁用`);
  }
  if (hard.allowedRaces && op.race && !hard.allowedRaces.includes(op.race)) {
    reasons.push(`种族"${op.race}"不在允许列表中`);
  }
  if (hard.bannedRaces.includes(op.race || '')) {
    reasons.push(`种族"${op.race}"已被禁用`);
  }
  if (hard.blockTier !== null && op.block !== null && op.block !== undefined) {
    if (hard.blockTierMode === 'exact' && op.block !== hard.blockTier) {
      reasons.push(`阻挡数${op.block}不匹配要求(${hard.blockTier})`);
    } else if (hard.blockTierMode === 'max' && op.block > hard.blockTier) {
      reasons.push(`阻挡数${op.block}超出上限(${hard.blockTier})`);
    }
  }

  return { valid: reasons.length === 0, reasons };
}

// ---- 验证整个编队 ----
function validateSquad(squad, hard) {
  const violations = [];

  if (hard.maxSquadSize !== null && squad.length > hard.maxSquadSize) {
    violations.push(`编队人数(${squad.length})超出上限(${hard.maxSquadSize})`);
  }
  if (hard.sameNationOnly) {
    const nations = [...new Set(squad.filter((o) => o.nation).map((o) => o.nation))];
    if (nations.length > 1) violations.push(`编队含多个国家/地区: ${nations.join('、')}`);
  }
  if (hard.sameRaceOnly) {
    const races = [...new Set(squad.filter((o) => o.race).map((o) => o.race))];
    if (races.length > 1) violations.push(`编队含多个种族: ${races.join('、')}`);
  }

  return { valid: violations.length === 0, violations };
}

// ---- 按硬约束过滤干员 ----
function filterOperatorsByHardConstraints(ops, hard) {
  return Object.values(ops).filter((op) => {
    if (hard.allowedProfessions !== null && !hard.allowedProfessions.includes(op.profession)) return false;
    if (hard.bannedProfessions.includes(op.profession)) return false;
    if (hard.maxRarity !== null && op.rarity > hard.maxRarity) return false;
    if (hard.minRarity !== null && op.rarity < hard.minRarity) return false;
    if (hard.positionRestriction !== null && !hard.positionRestriction.includes(op.position)) return false;
    if (hard.allowedRaces !== null && op.race !== null && !hard.allowedRaces.includes(op.race)) return false;
    if (hard.bannedRaces.includes(op.race || '')) return false;
    if (hard.blockTier !== null && op.block !== null) {
      if (hard.blockTierMode === 'exact' && op.block !== hard.blockTier) return false;
      if (hard.blockTierMode === 'max' && op.block > hard.blockTier) return false;
    }
    if (hard.allowedNations !== null && op.nation !== null && !hard.allowedNations.includes(op.nation)) return false;
    if (hard.bannedNations.includes(op.nation || '')) return false;
    if (hard.allowedOrgs !== null && op.org !== null && !hard.allowedOrgs.includes(op.org)) return false;
    if (hard.bannedOrgs.includes(op.org || '')) return false;
    return true;
  });
}

// ---- 分享码编码 (新位布局) ----
// 字节0: [版本:4bit] [标签0-3:4bit]
// 字节1: [标签4-11:8bit]
// 字节2: [标签12-19:8bit]
// 字节3: [标签20-27:8bit]
// 字节4: [标签28:1bit] [预留:7bit]
// 字节5: [软约束+覆盖标记:8bit] (OVERIDE_BIT=7)
// 字节6-7: [关卡索引:16bit] (0xFFFF=无关卡)
const NO_STAGE = 0xffff;
const SOFT_BITS = { noSkill: 0, afkOnly: 1, noRetreat: 2, noRedeploy: 3, zeroLeak: 4 };
const OVERRIDE_BIT = 7;

function encode(tagIds, stageId, softConstraints, allTags, allStages) {
  const PREFIX = 'AKRL:';

  const tagIndexMap = new Map();
  allTags.forEach((tag, idx) => tagIndexMap.set(tag.id, idx));

  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);

  // === 字节0: 版本号(4bit) + 标签0-3(4bit) ===
  dv.setUint8(0, 1); // 版本号 = 1

  // === 字节1-4: 标签位掩码 29bit ===
  for (const tagId of tagIds) {
    const bitIdx = tagIndexMap.get(tagId);
    if (bitIdx === undefined) continue;
    const globalBit = 4 + bitIdx;
    const byteIdx = Math.floor(globalBit / 8);
    const bitOffset = globalBit % 8;
    const current = dv.getUint8(byteIdx);
    dv.setUint8(byteIdx, current | (1 << bitOffset));
  }

  // === 字节5: 软约束 + 覆盖标记 ===
  let softByte = 0;
  if (softConstraints) {
    for (const [key, bitPos] of Object.entries(SOFT_BITS)) {
      if (softConstraints[key]) {
        softByte |= (1 << bitPos);
      }
    }
    softByte |= (1 << OVERRIDE_BIT);
  }
  dv.setUint8(5, softByte);

  // === 字节6-7: 关卡索引 (0xFFFF = 无关卡) ===
  const stageIdx = stageId !== null
    ? allStages.findIndex((s) => s.id === stageId)
    : -1;
  dv.setUint16(6, stageIdx >= 0 ? stageIdx : NO_STAGE);

  // Base64URL
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return PREFIX + base64;
}

// ---- 分享码解码 ----
function decode(code, allTags, allStages) {
  const PREFIX = 'AKRL:';

  if (!code.startsWith(PREFIX)) return null;

  const base64 = code.slice(PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

  let binary;
  try {
    binary = atob(padded);
  } catch {
    return null;
  }

  if (binary.length < 8) return null;

  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);
  for (let i = 0; i < binary.length && i < 8; i++) {
    dv.setUint8(i, binary.charCodeAt(i));
  }

  const version = dv.getUint8(0) & 0x0f;
  if (version !== 1) return null;

  // 标签位掩码 29bit (bit 4-32)
  const tagIds = [];
  for (let i = 0; i < 29; i++) {
    const globalBit = 4 + i;
    const byteIdx = Math.floor(globalBit / 8);
    const bitOffset = globalBit % 8;
    const bit = (dv.getUint8(byteIdx) >> bitOffset) & 1;
    if (bit === 1 && allTags[i]) {
      tagIds.push(allTags[i].id);
    }
  }

  // 关卡索引 (字节6-7, 0xFFFF = 无关卡)
  const stageIdx = dv.getUint16(6);
  const stageId = (stageIdx !== NO_STAGE && allStages[stageIdx])
    ? allStages[stageIdx].id
    : null;

  // 软约束 + 覆盖标记 (字节5)
  const softByte = dv.getUint8(5);
  const hasOverride = ((softByte >> OVERRIDE_BIT) & 1) === 1;

  let softConstraints = null;
  if (hasOverride) {
    softConstraints = { noSkill: false, afkOnly: false, noRetreat: false, noRedeploy: false, zeroLeak: false, maxSteps: null, customRules: [] };
    for (const [key, bitPos] of Object.entries(SOFT_BITS)) {
      if ((softByte >> bitPos) & 1) {
        softConstraints[key] = true;
      }
    }
  }

  return { tagIds, stageId, softConstraints };
}


// ============================================================
// 2. 运行测试
// ============================================================

// ---- tagEngine 测试 ----
describe('1. tagEngine 测试');

// drawRandomTags
describe('  1.1 drawRandomTags');
{
  const drawn = drawRandomTags(tags, 3);
  assert(drawn.length === 3, `抽取3个标签，实际${drawn.length}个`);
  // 验证不重复
  const ids = drawn.map(t => t.id);
  assert(new Set(ids).size === ids.length, '抽取的标签不重复');

  // 边界：抽取0个
  const empty = drawRandomTags(tags, 0);
  assert(empty.length === 0, '抽取0个返回空数组');

  // 边界：抽取超过总数
  const all = drawRandomTags(tags, 999);
  assert(all.length === tags.length, '抽取超过总数应返回全部标签');
}

// rerollSingleTag
describe('  1.2 rerollSingleTag');
{
  const pool = tags;
  const current = pool.slice(0, 3);
  const rerolled = rerollSingleTag(current, 0, pool);
  assert(rerolled.length === 3, '换一换后长度不变');
  // 新标签不应与原有重复（除非池子不够）
  const originalIds = new Set(current.map(t => t.id));
  const newId = rerolled[0].id;
  // ID0被替换，所以新ID不可能在originalIds中（除非池中只有这一个选项）
  // 但如果池子大小够，应该不一样
  if (pool.length > 3) {
    assert(!originalIds.has(newId) || rerolled[0].id === current[0].id, 
      '换一换后的标签不应与已选重复（池子够大时）');
  }

  // 边界：替换超出范围的索引
  const outOfBounds = rerollSingleTag(current, 999, pool);
  assert(outOfBounds.length === 3, '超出范围索引应返回原数组');
  assert(outOfBounds[0] === current[0], '超出范围索引不改变原数组');
}

// mergeTagsToConstraints
describe('  1.3 mergeTagsToConstraints');

// 测试"禁医疗"（no_healer, bannedProfessions=["医疗"]）
{
  const noHealerTag = tags.find(t => t.id === 'no_healer');
  assert(noHealerTag !== undefined, '找到 no_healer 标签');
  const result = mergeTagsToConstraints([noHealerTag]);
  assertDeepEqual(result.hard.bannedProfessions, ['医疗'], '禁医疗标签 → bannedProfessions=["医疗"]');
}

// 测试"★≤3"（low_rarity, maxRarity=3）
{
  const lowRarityTag = tags.find(t => t.id === 'low_rarity');
  assert(lowRarityTag !== undefined, '找到 low_rarity 标签');
  const result = mergeTagsToConstraints([lowRarityTag]);
  assert(result.hard.maxRarity === 3, `★≤3标签 → maxRarity=3，实际${result.hard.maxRarity}`);
}

// 测试"禁医疗"+"★≤3"合并
{
  const noHealerTag = tags.find(t => t.id === 'no_healer');
  const lowRarityTag = tags.find(t => t.id === 'low_rarity');
  const result = mergeTagsToConstraints([noHealerTag, lowRarityTag]);
  assertDeepEqual(result.hard.bannedProfessions, ['医疗'], '合并后 bannedProfessions=["医疗"]');
  assert(result.hard.maxRarity === 3, '合并后 maxRarity=3');
}

// 测试"萨卡兹之力"+"禁常见种族"合并（allowedRaces vs bannedRaces）
{
  const sarkazTag = tags.find(t => t.id === 'sarkaz_power');
  const banRaceTag = tags.find(t => t.id === 'ban_top_race');
  assert(sarkazTag !== undefined, '找到 sarkaz_power 标签');
  assert(banRaceTag !== undefined, '找到 ban_top_race 标签');

  const result = mergeTagsToConstraints([sarkazTag, banRaceTag]);
  // "萨卡兹之力": allowedRaces=["萨卡兹"]
  // "禁常见种族": bannedRaces=["菲林", "黎博利", "萨卡兹"]
  // 注意：allowedRaces 和 bannedRaces 不冲突处理
  // allowedRaces 是白名单（取交集），bannedRaces 是黑名单（取并集）
  assertDeepEqual(result.hard.allowedRaces, ['萨卡兹'], '萨卡兹之力 → allowedRaces=["萨卡兹"]');
  assert(result.hard.bannedRaces.includes('菲林'), '禁常见种族 → bannedRaces 包含菲林');
  assert(result.hard.bannedRaces.includes('黎博利'), '禁常见种族 → bannedRaces 包含黎博利');
  assert(result.hard.bannedRaces.includes('萨卡兹'), '禁常见种族 → bannedRaces 包含萨卡兹');

  // 注意：这里 allowedRaces=["萨卡兹"] 和 bannedRaces=["菲林","黎博利","萨卡兹"]
  // allowedRaces 和 bannedRaces 同时包含萨卡兹 → 这是矛盾的
  // 但这是标签本身的特性，mergeTagsToConstraints 只忠实地合并
  // filterOperatorsByHardConstraints 会先检查 allowedRaces 再检查 bannedRaces
  // 所以萨卡兹被允许但又被禁止... 这是用户需要意识到的冲突
  // 我们要测试的是：合并逻辑正确地产生了这个配置
  assert(result.hard.allowedRaces.length === 1 && result.hard.bannedRaces.length === 3, 
    '矛盾但合规：allowedRaces=["萨卡兹"], bannedRaces=["菲林","黎博利","萨卡兹"]');
}

// 测试软约束合并（多个标签合并 noSkill, afkOnly 等）
{
  const afkTag = tags.find(t => t.id === 'afk_only');
  const noRetreatTag = tags.find(t => t.id === 'no_retreat');
  assert(afkTag !== undefined, '找到 afk_only 标签');
  assert(noRetreatTag !== undefined, '找到 no_retreat 标签');

  const result = mergeTagsToConstraints([afkTag, noRetreatTag]);
  assert(result.soft.afkOnly === true, '挂机+不撤退 → afkOnly=true');
  assert(result.soft.noRetreat === true, '挂机+不撤退 → noRetreat=true');
  assert(result.soft.noSkill === false, '挂机+不撤退 → noSkill=false');
}

// 测试空标签数组
{
  const result = mergeTagsToConstraints([]);
  assert(result.hard.maxSquadSize === null, '空标签 → maxSquadSize=null');
  assertDeepEqual(result.hard.bannedProfessions, [], '空标签 → bannedProfessions=[]');
  assert(result.soft.noSkill === false, '空标签 → noSkill=false');
}

// filterOperatorsByHardConstraints
describe('  1.4 filterOperatorsByHardConstraints');
{
  // 空约束
  const emptyHard = {
    maxSquadSize: null, maxSameProfession: null, allowedProfessions: null, bannedProfessions: [],
    allowedSubProfessions: null, bannedSubProfessions: [], maxRarity: null, minRarity: null,
    maxSixStarCount: null, maxTotalCost: null, maxSingleCost: null, minSingleCost: null,
    allowedOperators: null, bannedOperators: [], positionRestriction: null,
    sameNationOnly: false, sameOrgOnly: false, allowedNations: null, bannedNations: [],
    allowedOrgs: null, bannedOrgs: [], allowedRaces: null, bannedRaces: [],
    sameRaceOnly: false, rareRaceOnly: null, blockTier: null, blockTierMode: 'exact', maxSameBlockTier: null,
  };
  const allFiltered = filterOperatorsByHardConstraints(operators, emptyHard);
  assert(allFiltered.length === Object.keys(operators).length, '空约束应返回所有干员');

  // 职业过滤
  const medicHard = { ...emptyHard, allowedProfessions: ['医疗'] };
  const medics = filterOperatorsByHardConstraints(operators, medicHard);
  assert(medics.length > 0, '医疗过滤应有结果');
  assert(medics.every(o => o.profession === '医疗'), '所有结果均为医疗职业');

  // 稀有度过滤
  const lowRarityHard = { ...emptyHard, maxRarity: 3 };
  const lowOps = filterOperatorsByHardConstraints(operators, lowRarityHard);
  assert(lowOps.length > 0, '稀有度≤3应有结果');
  assert(lowOps.every(o => o.rarity <= 3), '所有结果稀有度≤3');

  // 边界：空编队
  const emptyOps = filterOperatorsByHardConstraints({}, emptyHard);
  assert(emptyOps.length === 0, '空编队返回空数组');

  // 位置过滤
  const meleeHard = { ...emptyHard, positionRestriction: ['近战位'] };
  const meleeOps = filterOperatorsByHardConstraints(operators, meleeHard);
  assert(meleeOps.length > 0, '近战位过滤应有结果');
  assert(meleeOps.every(o => o.position === '近战位'), '所有结果均为近战位');
}

// ---- shareCode 测试 ----
describe('2. shareCode 测试');

describe('  2.1 encode/decode roundtrip');
{
  // 测试1: 基本 roundtrip — 选中一些标签，编码再解码
  const tagIds = ['no_healer', 'low_rarity', 'melee_only'];
  const stageId = null;
  const softConstraints = null;

  const code = encode(tagIds, stageId, softConstraints, tags, stages);
  assert(code.startsWith('AKRL:'), `分享码应以 AKRL: 开头，实际: ${code}`);

  const decoded = decode(code, tags, stages);
  assert(decoded !== null, '解码应成功');
  assertDeepEqual(decoded.tagIds.sort(), tagIds.sort(), '编码-解码后标签ID一致');
  assert(decoded.stageId === null, '编码-解码后关卡ID一致(null)');

  // 测试2: 带关卡
  const tagIds2 = ['few_ops', 'no_healer'];
  const stageId2 = 'main_01-07';

  const code2 = encode(tagIds2, stageId2, softConstraints, tags, stages);
  const decoded2 = decode(code2, tags, stages);
  assert(decoded2 !== null, '带关卡的编码解码应成功');
  assertDeepEqual(decoded2.tagIds.sort(), tagIds2.sort(), '带关卡：标签ID一致');
  assert(decoded2.stageId === 'main_01-07', '带关卡：关卡ID一致');

  // 测试3: 带软约束
  const tagIds3 = ['afk_only', 'no_retreat'];
  const stageId3 = 'main_06-16';
  const softConstraints3 = { noSkill: false, afkOnly: true, noRetreat: true, noRedeploy: false, zeroLeak: false, maxSteps: null, customRules: [] };

  const code3 = encode(tagIds3, stageId3, softConstraints3, tags, stages);
  const decoded3 = decode(code3, tags, stages);
  assert(decoded3 !== null, '带软约束的编码解码应成功');
  assertDeepEqual(decoded3.tagIds.sort(), tagIds3.sort(), '带软约束：标签ID一致');
  assert(decoded3.stageId === 'main_06-16', '带软约束：关卡ID一致');
  assert(decoded3.softConstraints.afkOnly === true, '带软约束：afkOnly=true');
  assert(decoded3.softConstraints.noRetreat === true, '带软约束：noRetreat=true');
  assert(decoded3.softConstraints.noSkill === false, '带软约束：noSkill=false');

  // 测试4: 所有标签全部选中
  const allTagIds = tags.map(t => t.id);
  const code4 = encode(allTagIds, 'main_08-20', softConstraints, tags, stages);
  const decoded4 = decode(code4, tags, stages);
  assert(decoded4 !== null, '全部标签编码解码应成功');
  assert(decoded4.tagIds.length === 29, '全部标签解码后有29个');
  assertDeepEqual(decoded4.tagIds.sort(), allTagIds.sort(), '全部标签编码解码后一致');

  // 测试5: 无效分享码
  const badResult = decode('INVALID_PREFIX_xxx', tags, stages);
  assert(badResult === null, '无效前缀应返回null');

  // 测试6: 空标签
  const code6 = encode([], 'main_01-07', softConstraints, tags, stages);
  const decoded6 = decode(code6, tags, stages);
  assert(decoded6 !== null, '空标签数组编码解码应成功');
  assertDeepEqual(decoded6.tagIds, [], '空标签数组解码后为空');
}

// ---- Bug #2 回归: null 关卡编码解码后仍为 null ----
describe('  2.2 Bug #2 regression: null stage roundtrip');
{
  const tagIds = ['no_healer', 'low_rarity', 'melee_only'];
  const code = encode(tagIds, null, null, tags, stages);
  const decoded = decode(code, tags, stages);
  assert(decoded !== null, 'null关卡编码解码应成功');
  assert(decoded.stageId === null, 'null关卡编码解码后应为 null');
}

// ---- Bug #3/#4 回归: 第29个标签 block_two + 关卡 ----
describe('  2.3 Bug #3/#4 regression: block_two + stage');
{
  // 纯 block_two + 无关卡
  const code1 = encode(['block_two'], null, null, tags, stages);
  const decoded1 = decode(code1, tags, stages);
  assert(decoded1 !== null, '纯block_two编码解码应成功');
  assertDeepEqual(decoded1.tagIds, ['block_two'], '纯block_two解码后应为 [block_two]');
  assert(decoded1.stageId === null, '纯block_two+无关卡 → stageId=null');

  // block_two + 关卡 4-10
  const code2 = encode(['block_two'], 'main_04-10', null, tags, stages);
  const decoded2 = decode(code2, tags, stages);
  assert(decoded2 !== null, 'block_two+关卡编码解码应成功');
  assert(decoded2.tagIds.includes('block_two'), 'block_two+关卡解码后应包含block_two');
  assert(decoded2.stageId === 'main_04-10', 'block_two+关卡解码后关卡应为 main_04-10');
  assert(decoded2.tagIds.length === 1, 'block_two+关卡解码后仅1个标签');
}

// ---- Bug #3/#4 回归: 全部29标签 + 关卡 + 软约束 ----
describe('  2.4 Bug #3/#4 regression: all 29 tags + stage + soft');
{
  const allTagIds = tags.map(t => t.id);
  const soft = { noSkill: false, afkOnly: true, noRetreat: false, noRedeploy: true, zeroLeak: false, maxSteps: null, customRules: [] };
  const code = encode(allTagIds, 'main_08-20', soft, tags, stages);
  const decoded = decode(code, tags, stages);
  assert(decoded !== null, '全部标签+关卡+软约束编码解码应成功');
  assert(decoded.tagIds.length === 29, '全部标签解码后应有29个');
  assertDeepEqual(decoded.tagIds.sort(), allTagIds.sort(), '全部标签编码解码后一致');
  assert(decoded.stageId === 'main_08-20', '关卡应为 main_08-20');
  assert(decoded.softConstraints.afkOnly === true, '软约束 afkOnly=true');
  assert(decoded.softConstraints.noRedeploy === true, '软约束 noRedeploy=true');
}

// ---- validator 测试 ----
describe('3. validator 测试');

describe('  3.1 validateOperator');
{
  // 找个6星近卫干员测试
  const sixStarGuard = operatorList.find(o => o.rarity === 6 && o.profession === '近卫');
  assert(sixStarGuard !== undefined, '找到6星近卫干员');

  const emptyHard = {
    maxSquadSize: null, maxSameProfession: null, allowedProfessions: null, bannedProfessions: [],
    allowedSubProfessions: null, bannedSubProfessions: [], maxRarity: null, minRarity: null,
    maxSixStarCount: null, maxTotalCost: null, maxSingleCost: null, minSingleCost: null,
    allowedOperators: null, bannedOperators: [], positionRestriction: null,
    sameNationOnly: false, sameOrgOnly: false, allowedNations: null, bannedNations: [],
    allowedOrgs: null, bannedOrgs: [], allowedRaces: null, bannedRaces: [],
    sameRaceOnly: false, rareRaceOnly: null, blockTier: null, blockTierMode: 'exact', maxSameBlockTier: null,
  };

  const result1 = validateOperator(sixStarGuard, emptyHard);
  assert(result1.valid === true, '无约束时任何干员应有效');

  // 稀有度限制
  const lowRarityHard = { ...emptyHard, maxRarity: 3 };
  const result2 = validateOperator(sixStarGuard, lowRarityHard);
  assert(result2.valid === false, 'maxRarity=3 时6星干员应无效');

  // 职业限制
  const noGuardHard = { ...emptyHard, bannedProfessions: ['近卫'] };
  const result3 = validateOperator(sixStarGuard, noGuardHard);
  assert(result3.valid === false, '禁止近卫时近卫干员应无效');
  assert(result3.reasons.some(r => r.includes('已被禁用')), '禁用原因应包含"已被禁用"');
}

describe('  3.2 validateSquad');
{
  const emptyHard = {
    maxSquadSize: null, maxSameProfession: null, allowedProfessions: null, bannedProfessions: [],
    allowedSubProfessions: null, bannedSubProfessions: [], maxRarity: null, minRarity: null,
    maxSixStarCount: null, maxTotalCost: null, maxSingleCost: null, minSingleCost: null,
    allowedOperators: null, bannedOperators: [], positionRestriction: null,
    sameNationOnly: false, sameOrgOnly: false, allowedNations: null, bannedNations: [],
    allowedOrgs: null, bannedOrgs: [], allowedRaces: null, bannedRaces: [],
    sameRaceOnly: false, rareRaceOnly: null, blockTier: null, blockTierMode: 'exact', maxSameBlockTier: null,
  };

  // 空编队
  const result1 = validateSquad([], emptyHard);
  assert(result1.valid === true, '空编队应有效');

  // 人数限制
  const squad2 = [operatorList[0], operatorList[1], operatorList[2]];
  const squadSizeHard = { ...emptyHard, maxSquadSize: 2 };
  const result2 = validateSquad(squad2, squadSizeHard);
  assert(result2.valid === false, '超过人数限制应无效');
  assert(result2.violations.some(v => v.includes('超出上限')), '违规原因应包含"超出上限"');

  // sameNationOnly
  const differentNationSquad = [];
  // 找两个不同国家的干员
  const op1 = operatorList.find(o => o.nation === '罗德岛');
  const op2 = operatorList.find(o => o.nation !== null && o.nation !== '罗德岛');
  if (op1 && op2) {
    const nationHard = { ...emptyHard, sameNationOnly: true };
    const result3 = validateSquad([op1, op2], nationHard);
    assert(result3.valid === false, '同国家约束下不同国家应无效');
  }
}


// ============================================================
// 3. 测试结果报告
// ============================================================
console.log('\n========================================');
console.log('  测试报告');
console.log('========================================');
console.log(`\n总计: ${passed + failed}  |  通过: ${passed} ✅  |  失败: ${failed} ❌`);
console.log();

// 生成最终报告
const report = {
  total: passed + failed,
  passed,
  failed,
  failures: failures.map(f => f.msg),
};

const outputPath = 'test_engine_report.json';
writeFileSync(outputPath, JSON.stringify(report, null, 2));
console.log(`测试报告已保存到: ${outputPath}`);

process.exit(failed > 0 ? 1 : 0);
