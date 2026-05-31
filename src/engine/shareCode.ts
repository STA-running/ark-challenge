import type { ChallengeTag, StageData, SoftConstraints } from '../types';

/**
 * 位掩码编码器
 *
 * 编码格式（64bit，8字节）：
 *   字节0: [版本:4bit(bit 0-3)] [标签0-3:4bit(bit 4-7)]
 *   字节1: [标签4-11:8bit]
 *   字节2: [标签12-19:8bit]
 *   字节3: [标签20-27:8bit]
 *   字节4: [标签28:1bit(bit 0)] [预留:7bit(bit 1-7)]
 *   字节5: [软约束+覆盖标记:8bit]  (noSkill=0, afkOnly=1, noRetreat=2, noRedeploy=3, zeroLeak=4, 预留5-6, 覆盖标记=7)
 *   字节6-7: [关卡索引:16bit]  (0xFFFF=无关卡)
 *
 * Base64URL 编码后约 11 字符，加前缀 "AKRL:" 共 16 字符
 */

const PREFIX = 'AKRL:';

// 软约束位偏移（共7位，与覆盖标记共用 byte 5）
const SOFT_BITS: Record<string, number> = {
  noSkill: 0,
  afkOnly: 1,
  noRetreat: 2,
  noRedeploy: 3,
  zeroLeak: 4,
  // bit 5-6 预留
};

// 覆盖标记位 (byte 5, bit 7)
const OVERRIDE_BIT = 7;

/** 无关卡标记值 */
const NO_STAGE = 0xffff;

/**
 * 将标签列表、关卡、软约束编码为分享码
 */
export function encode(
  tagIds: string[],
  stageId: string | null,
  softConstraints: SoftConstraints | null,
  allTags: ChallengeTag[],
  stages: StageData[]
): string {
  // 构建标签 ID → 索引映射
  const tagIndexMap = new Map<string, number>();
  allTags.forEach((tag, idx) => {
    tagIndexMap.set(tag.id, idx);
  });

  // 8 字节 buffer (64 bit)
  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);

  // === 字节0: 版本号(4bit) + 标签0-3(4bit) ===
  dv.setUint8(0, 1); // 版本号 = 1

  // === 字节1-4: 标签位掩码 29bit ===
  // 标签在字节中连续放置：
  //   字节0 bit4-7 = 标签0-3
  //   字节1 = 标签4-11
  //   字节2 = 标签12-19
  //   字节3 = 标签20-27
  //   字节4 bit0 = 标签28
  for (const tagId of tagIds) {
    const bitIdx = tagIndexMap.get(tagId);
    if (bitIdx === undefined) continue;
    // 全局 bit 位置：版本(4bit) + 标签偏移
    const globalBit = 4 + bitIdx;  // 标签 bit 范围 4-32
    const byteIdx = Math.floor(globalBit / 8);
    const bitOffset = globalBit % 8;
    const current = dv.getUint8(byteIdx);
    dv.setUint8(byteIdx, current | (1 << bitOffset));
  }

  // === 字节5: 软约束开关 + 覆盖标记 ===
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
  dv.setUint8(5, softByte);

  // === 字节6-7: 关卡索引 (0xFFFF = 无关卡) ===
  const stageIdx = stageId !== null
    ? stages.findIndex((s) => s.id === stageId)
    : -1;
  dv.setUint16(6, stageIdx >= 0 ? stageIdx : NO_STAGE);

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

/**
 * 解码分享码，返回编码的信息
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

  if (binary.length < 8) return null;

  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);
  for (let i = 0; i < binary.length && i < 8; i++) {
    dv.setUint8(i, binary.charCodeAt(i));
  }

  // 版本号 (bit 0-3)
  const version = dv.getUint8(0) & 0x0f;
  if (version !== 1) return null;

  // 标签位掩码 29bit (bit 4-32)
  const tagIds: string[] = [];
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
