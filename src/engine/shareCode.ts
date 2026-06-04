import type { ChallengeTag, StageData, SoftConstraints } from '../types';

/**
 * 位掩码编码器
 *
 * 版本2 编码格式（80bit，10字节），支持最多 40 个标签：
 *   字节0: [版本:4bit(bit 0-3)=2] [标签0-3:4bit(bit 4-7)]
 *   字节1: [标签4-11:8bit]
 *   字节2: [标签12-19:8bit]
 *   字节3: [标签20-27:8bit]
 *   字节4: [标签28-35:8bit]
 *   字节5: [标签36-39:4bit(bit 0-3)] [预留:4bit(bit 4-7)]
 *   字节6: [软约束+覆盖标记:8bit]  (noSkill=0, afkOnly=1, noRetreat=2, noRedeploy=3, zeroLeak=4, 预留5-6, 覆盖标记=7)
 *   字节7-8: [关卡索引:16bit]  (0xFFFF=无关卡)
 *   字节9: [预留]
 *
 * 版本1 编码格式（64bit，8字节），支持最多 29 个标签（已废弃但支持解码）：
 *   字节0: [版本:4bit(bit 0-3)=1] [标签0-3:4bit(bit 4-7)]
 *   字节1: [标签4-11:8bit]
 *   字节2: [标签12-19:8bit]
 *   字节3: [标签20-27:8bit]
 *   字节4: [标签28:1bit(bit 0)] [预留:7bit(bit 1-7)]
 *   字节5: [软约束+覆盖标记:8bit]
 *   字节6-7: [关卡索引:16bit]
 *
 * Base64URL 编码后：v1 约 11 字符，v2 约 14 字符，加前缀 "AKRL:" 共 16/19 字符
 */

const PREFIX = 'AKRL:';

// 版本号
const VERSION_1 = 1;
const VERSION_2 = 2;

// 软约束位偏移（与覆盖标记共用软约束字节）
const SOFT_BITS: Record<string, number> = {
  noSkill: 0,
  afkOnly: 1,
  noRetreat: 2,
  noRedeploy: 3,
  zeroLeak: 4,
  // bit 5-6 预留
};

// 覆盖标记位
const OVERRIDE_BIT = 7;

/** 无关卡标记值 */
const NO_STAGE = 0xffff;

/** v2 标签编码上限（支持 40 个标签，索引 0-39） */
const V2_MAX_TAGS = 40;

/** v1 标签编码上限（支持 29 个标签，索引 0-28） */
const V1_MAX_TAGS = 29;

// ==================== 编码 v2 ====================

function encodeV2(
  tagIds: string[],
  stageId: string | null,
  softConstraints: SoftConstraints | null,
  allTags: ChallengeTag[],
  stages: StageData[]
): string {
  const tagIndexMap = new Map<string, number>();
  allTags.forEach((tag, idx) => {
    tagIndexMap.set(tag.id, idx);
  });

  // 10 字节 buffer
  const buf = new ArrayBuffer(10);
  const dv = new DataView(buf);

  // === 字节0: 版本号(4bit) + 标签0-3(4bit) ===
  dv.setUint8(0, VERSION_2); // 版本号 = 2 (低4位)

  // === 字节1-5: 标签位掩码 40bit (标签 0-39) ===
  for (const tagId of tagIds) {
    const bitIdx = tagIndexMap.get(tagId);
    if (bitIdx === undefined || bitIdx >= V2_MAX_TAGS) continue;
    // 全局 bit 位置：版本(4bit) + 标签偏移
    const globalBit = 4 + bitIdx;  // bit 范围 4-43
    const byteIdx = Math.floor(globalBit / 8);
    const bitOffset = globalBit % 8;
    const current = dv.getUint8(byteIdx);
    dv.setUint8(byteIdx, current | (1 << bitOffset));
  }

  // === 字节6: 软约束开关 + 覆盖标记 ===
  let softByte = 0;
  if (softConstraints) {
    for (const [key, bitPos] of Object.entries(SOFT_BITS)) {
      if ((softConstraints as unknown as Record<string, unknown>)[key]) {
        softByte |= (1 << bitPos);
      }
    }
    // 覆盖标记 bit 7
    softByte |= (1 << OVERRIDE_BIT);
  }
  dv.setUint8(6, softByte);

  // === 字节7-8: 关卡索引 (0xFFFF = 无关卡) ===
  const stageIdx = stageId !== null
    ? stages.findIndex((s) => s.id === stageId)
    : -1;
  dv.setUint16(7, stageIdx >= 0 ? stageIdx : NO_STAGE);

  // 字节9: 预留

  // Base64URL 编码
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

// ==================== 解码 v1（兼容） ====================

function decodeV1(
  dv: DataView,
  allTags: ChallengeTag[],
  stages: StageData[]
): {
  tagIds: string[];
  stageId: string | null;
  softConstraints: SoftConstraints | null;
} | null {
  // 标签位掩码 29bit (bit 4-32)
  const tagIds: string[] = [];
  for (let i = 0; i < V1_MAX_TAGS; i++) {
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
  const stageId = (stageIdx !== NO_STAGE && stages[stageIdx])
    ? stages[stageIdx].id
    : null;

  // 软约束 + 覆盖标记 (字节5)
  const softByte = dv.getUint8(5);
  const hasOverride = ((softByte >> OVERRIDE_BIT) & 1) === 1;

  let softConstraints: SoftConstraints | null = null;
  if (hasOverride) {
    softConstraints = {
      noSkill: false,
      afkOnly: false,
      noRetreat: false,
      noRedeploy: false,
      zeroLeak: false,
      maxSteps: null,
      customRules: [],
    };
    for (const [key, bitPos] of Object.entries(SOFT_BITS)) {
      if ((softByte >> bitPos) & 1) {
        (softConstraints as unknown as Record<string, unknown>)[key] = true;
      }
    }
  }

  return { tagIds, stageId, softConstraints };
}

// ==================== 解码 v2 ====================

function decodeV2(
  dv: DataView,
  allTags: ChallengeTag[],
  stages: StageData[]
): {
  tagIds: string[];
  stageId: string | null;
  softConstraints: SoftConstraints | null;
} | null {
  // 标签位掩码 40bit (bit 4-43)
  const tagIds: string[] = [];
  for (let i = 0; i < V2_MAX_TAGS; i++) {
    const globalBit = 4 + i;
    const byteIdx = Math.floor(globalBit / 8);
    const bitOffset = globalBit % 8;
    const bit = (dv.getUint8(byteIdx) >> bitOffset) & 1;
    if (bit === 1 && allTags[i]) {
      tagIds.push(allTags[i].id);
    }
  }

  // 关卡索引 (字节7-8, 0xFFFF = 无关卡)
  const stageIdx = dv.getUint16(7);
  const stageId = (stageIdx !== NO_STAGE && stages[stageIdx])
    ? stages[stageIdx].id
    : null;

  // 软约束 + 覆盖标记 (字节6)
  const softByte = dv.getUint8(6);
  const hasOverride = ((softByte >> OVERRIDE_BIT) & 1) === 1;

  let softConstraints: SoftConstraints | null = null;
  if (hasOverride) {
    softConstraints = {
      noSkill: false,
      afkOnly: false,
      noRetreat: false,
      noRedeploy: false,
      zeroLeak: false,
      maxSteps: null,
      customRules: [],
    };
    for (const [key, bitPos] of Object.entries(SOFT_BITS)) {
      if ((softByte >> bitPos) & 1) {
        (softConstraints as unknown as Record<string, unknown>)[key] = true;
      }
    }
  }

  return { tagIds, stageId, softConstraints };
}

// ==================== 对外接口 ====================

/**
 * 将标签列表、关卡、软约束编码为分享码
 * 自动使用 v2 编码（支持 40 标签）
 */
export function encode(
  tagIds: string[],
  stageId: string | null,
  softConstraints: SoftConstraints | null,
  allTags: ChallengeTag[],
  stages: StageData[]
): string {
  if (allTags.length > V1_MAX_TAGS) {
    return encodeV2(tagIds, stageId, softConstraints, allTags, stages);
  }
  // 如果标签数量 ≤29，仍然使用 v2 以保证一致性
  return encodeV2(tagIds, stageId, softConstraints, allTags, stages);
}

/**
 * 解码分享码，返回编码的信息
 * 支持 v1 和 v2 格式
 */
export function decode(
  code: string,
  allTags: ChallengeTag[],
  stages: StageData[]
): {
  tagIds: string[];
  stageId: string | null;
  softConstraints: SoftConstraints | null;
} | null {
  if (!code.startsWith(PREFIX)) return null;

  const base64 = code.slice(PREFIX.length)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  // 补齐 padding
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

  let binary: string;
  try {
    binary = atob(padded);
  } catch {
    return null;
  }

  // v1 最小需要 8 字节，v2 需要 10 字节
  const minLen = 8;
  if (binary.length < minLen) return null;

  const buf = new ArrayBuffer(Math.max(binary.length, 10));
  const dv = new DataView(buf);
  for (let i = 0; i < binary.length; i++) {
    dv.setUint8(i, binary.charCodeAt(i));
  }

  // 版本号 (bit 0-3)
  const version = dv.getUint8(0) & 0x0f;

  if (version === VERSION_2) {
    if (binary.length < 10) return null;
    return decodeV2(dv, allTags, stages);
  }

  if (version === VERSION_1) {
    return decodeV1(dv, allTags, stages);
  }

  // 未知版本
  return null;
}
