import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppStore } from '../stores/appStore';
import { loadTags, drawRandomTags, rerollSingleTag, mergeTagsToConstraints, filterOperatorsByHardConstraints } from '../engine/tagEngine';
import { validateSquad } from '../engine/validator';
import { encode, decode } from '../engine/shareCode';
import type { ChallengeTag, StageData, OperatorData } from '../types';

// 职业列表
const PROFESSIONS = ['先锋', '近卫', '重装', '狙击', '术师', '医疗', '辅助', '特种'];
const PROFESSION_COLORS: Record<string, string> = {
  '先锋': '#f97583',
  '近卫': '#e5c07b',
  '重装': '#56b6c2',
  '狙击': '#98c379',
  '术师': '#c678dd',
  '医疗': '#61afef',
  '辅助': '#d19a66',
  '特种': '#be5046',
};
const PROFESSION_ICONS: Record<string, string> = {
  '先锋': 'https://media.prts.wiki/f/fc/%E5%85%88%E9%94%8B.png',
  '近卫': 'https://media.prts.wiki/5/5e/%E8%BF%91%E5%8D%AB.png',
  '重装': 'https://media.prts.wiki/e/e0/%E9%87%8D%E8%A3%85.png',
  '狙击': 'https://media.prts.wiki/7/7d/%E7%8B%99%E5%87%BB.png',
  '术师': 'https://media.prts.wiki/8/83/%E6%9C%AF%E5%B8%88.png',
  '医疗': 'https://media.prts.wiki/7/78/%E5%8C%BB%E7%96%97.png',
  '辅助': 'https://media.prts.wiki/1/1c/%E8%BE%85%E5%8A%A9.png',
  '特种': 'https://media.prts.wiki/3/32/%E7%89%B9%E7%A7%8D.png',
};

// 费用图标SVG（菱形币）
const CostIcon = () => (
  <svg width="13" height="13" viewBox="0 0 12 12" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }}>
    <rect x="1.5" y="1.5" width="9" height="9" rx="2" fill="none" stroke="#e5c07b" strokeWidth="1.2"/>
    <text x="6" y="8.8" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="#e5c07b" fontFamily="Arial">C</text>
  </svg>
);

// 阻挡数图标SVG（盾牌）
const BlockIcon = () => (
  <svg width="13" height="13" viewBox="0 0 12 12" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }}>
    <path d="M6 1L10 3v3c0 2.2-1.8 4-4 5-2.2-1-4-2.8-4-5V3l4-2z" fill="none" stroke="#8b949e" strokeWidth="1.2"/>
    <text x="6" y="8.2" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#8b949e" fontFamily="Arial">B</text>
  </svg>
);

// 关卡类型中文名
const STAGE_TYPE_LABELS: Record<string, string> = {
  normal: '普通',
  boss: 'Boss',
  hard: '超难',
  hard_boss: '超难Boss',
};
const STAGE_TYPE_COLORS: Record<string, string> = {
  normal: '#8b949e',
  boss: '#e5c07b',
  hard: '#c678dd',
  hard_boss: '#e06c75',
};

// 标签分类中文名
const CATEGORY_LABELS: Record<string, string> = {
  squad: '编队', rarity: '稀有度', cost: '费用', position: '位置',
  operation: '操作', special: '特殊', faction: '阵营', race: '种族', block: '阻挡数', other: '其他',
};

// 稀有度颜色
const RARITY_COLORS: Record<number, string> = {
  1: '#8b949e', 2: '#58a6ff', 3: '#d2a8ff', 4: '#f0883e', 5: '#ffd700', 6: '#ff6b6b',
};

const POSITIONS = ['全部', '近战位', '远程位'];

export default function SquadPage() {
  const store = useAppStore();

  // 数据加载
  const [allTags, setAllTags] = useState<ChallengeTag[]>([]);
  const [allStages, setAllStages] = useState<StageData[]>([]);
  const [tagsLoaded, setTagsLoaded] = useState(false);
  const [stagesLoaded, setStagesLoaded] = useState(false);

  // 标签 UI 状态
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [randomCount, setRandomCount] = useState(3);
  const [randomTags, setRandomTags] = useState<ChallengeTag[]>([]);

  // 关卡 UI 状态
  const [stageFilterTypes, setStageFilterTypes] = useState<string[]>([]);
  const [randomStage, setRandomStage] = useState<StageData | null>(null);

  // 干员筛选
  const [professionFilter, setProfessionFilter] = useState<string | null>(null);
  const [rarityFilter, setRarityFilter] = useState<number | null>(null);
  const [raceFilter, setRaceFilter] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] = useState<string>('全部');
  const [selectedOp, setSelectedOp] = useState<OperatorData | null>(null);

  // 编队违规面板显示
  const [showViolations, setShowViolations] = useState(false);

  // 方案保存对话框
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [planName, setPlanName] = useState('');

  // 分享码
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [importCodeInput, setImportCodeInput] = useState('');
  const [showImportInput, setShowImportInput] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // === 数据加载 ===
  useEffect(() => {
    if (!store.operatorsLoaded) {
      fetch('/data/operators.json')
        .then((r) => r.json())
        .then((data) => store.setOperators(data.operators))
        .catch(console.error);
    }
    if (!tagsLoaded) {
      loadTags()
        .then((tags) => { setAllTags(tags); setTagsLoaded(true); })
        .catch(console.error);
    }
    if (!stagesLoaded) {
      fetch('/data/stages.json')
        .then((r) => r.json())
        .then((data) => { setAllStages(data); setStagesLoaded(true); })
        .catch(console.error);
    }
  }, []);

  const allOps = useMemo(() => Object.values(store.operators), [store.operators]);

  const { majorRaces, minorRaces } = useMemo(() => {
    // 统计每种族的干员人数
    const count = new Map<string, number>();
    allOps.forEach((op) => {
      if (!op.race) return;
      count.set(op.race, (count.get(op.race) || 0) + 1);
    });
    // 人数≥4为主力种族，≤3纳入"其他"
    const major: string[] = [];
    const minor = new Set<string>();
    for (const [race, cnt] of count) {
      if (cnt >= 4) major.push(race);
      else minor.add(race);
    }
    return { majorRaces: major.sort(), minorRaces: minor };
  }, [allOps]);

  const RACE_OTHER = '___OTHER___'; // 其他种族的特殊标记

  // === 标签功能 ===
  const handleToggleTag = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  const handleRandomDraw = useCallback(() => {
    const drawn = drawRandomTags(allTags, randomCount);
    setRandomTags(drawn);
  }, [allTags, randomCount]);

  const handleRerollTag = useCallback((index: number) => {
    setRandomTags((prev) => rerollSingleTag(prev, index, allTags));
  }, [allTags]);

  const handleConfirmTags = useCallback(() => {
    const tags = store.tagMode === 'manual' ? selectedTagIds : randomTags.map((t) => t.id);
    store.confirmTags(tags);
  }, [store, selectedTagIds, randomTags]);

  const confirmedTagObjects = useMemo(() => {
    return allTags.filter((t) => store.confirmedTags.includes(t.id));
  }, [allTags, store.confirmedTags]);

  // 待确认标签（已选但尚未确认的标签，用于即时展示说明）
  const pendingTagObjects = useMemo(() => {
    if (store.confirmedTags.length > 0) return []; // 已确认就不显示待确认
    if (store.tagMode === 'manual') {
      return allTags.filter((t) => selectedTagIds.includes(t.id));
    } else {
      return randomTags;
    }
  }, [allTags, store.confirmedTags, store.tagMode, selectedTagIds, randomTags]);

  useEffect(() => {
    if (confirmedTagObjects.length > 0) {
      const { hard, soft } = mergeTagsToConstraints(confirmedTagObjects);
      store.setHardConstraints(hard);
      store.setSoftConstraints(soft);
    }
  }, [confirmedTagObjects]);

  // === 关卡功能 ===
  const handleStageRandom = useCallback(() => {
    let blacklist: string[] = [];
    try {
      const raw = localStorage.getItem('ark_challenge_stage_blacklist');
      if (raw) blacklist = JSON.parse(raw);
    } catch { /* ignore */ }

    let filtered = allStages;
    if (stageFilterTypes.length > 0) {
      filtered = allStages.filter((s) => stageFilterTypes.includes(s.type));
    }
    // 先过滤黑名单，再排除前四章（前四章太简单，不参与挑战）
    const EXCLUDED_CHAPTERS = ['第一章', '第二章', '第三章', '第四章'];
    filtered = filtered.filter((s) => !blacklist.includes(s.chapter) && !EXCLUDED_CHAPTERS.includes(s.chapter));
    if (filtered.length === 0) return;
    const idx = Math.floor(Math.random() * filtered.length);
    setRandomStage(filtered[idx]);
  }, [allStages, stageFilterTypes]);

  const handleConfirmStage = useCallback(() => {
    if (randomStage) store.confirmStage(randomStage.id);
  }, [store, randomStage]);

  // === 编队功能 ===
  const handleAddToSquad = useCallback((op: OperatorData) => {
    store.addToSquad(op);
  }, [store]);

  const handleRemoveFromSquad = useCallback((index: number) => {
    store.removeFromSquad(index);
  }, [store]);

  const squadValidationResult = useMemo(() => {
    return validateSquad(store.squad, store.hardConstraints);
  }, [store.squad, store.hardConstraints]);

  const filteredOps = useMemo(() => {
    let ops = allOps;

    // 标签确认后才应用硬约束过滤
    const tagsConfirmed = store.confirmedTags.length > 0;
    const validOpNames = tagsConfirmed ? new Set(
      filterOperatorsByHardConstraints(store.operators, store.hardConstraints).map((o) => o.name)
    ) : new Set(allOps.map((o) => o.name)); // 未确认时全部可用

    if (professionFilter) {
      ops = ops.filter((o) => o.profession === professionFilter);
    }
    if (rarityFilter !== null) {
      ops = ops.filter((o) => o.rarity === rarityFilter);
    }
    if (raceFilter === RACE_OTHER) {
      ops = ops.filter((o) => o.race && minorRaces.has(o.race));
    } else if (raceFilter) {
      ops = ops.filter((o) => o.race === raceFilter);
    }
    if (positionFilter !== '全部') {
      ops = ops.filter((o) => o.position === positionFilter);
    }

    // 排序：星级高优先 > 阻挡数高优先（null 排最后）
    ops = [...ops].sort((a, b) => {
      if (a.rarity !== b.rarity) return b.rarity - a.rarity;
      const aBlock = a.block ?? -1;
      const bBlock = b.block ?? -1;
      return bBlock - aBlock;
    });

    return ops.map((o) => ({
      ...o,
      _valid: tagsConfirmed ? validOpNames.has(o.name) : true,
      _reason: tagsConfirmed ? getDisabledReason(o, store.hardConstraints) : '',
    }));
  }, [allOps, store.operators, store.hardConstraints, professionFilter, rarityFilter, raceFilter, positionFilter, majorRaces, minorRaces]);

  // 生成分享码
  const handleGenerateShareCode = useCallback(() => {
    const code = encode(store.confirmedTags, store.confirmedStage, store.softConstraints, allTags, allStages);
    setShareCode(code);
    navigator.clipboard?.writeText(code).catch(() => {});
  }, [store, allTags, allStages]);

  // 导入分享码
  const handleImportCode = useCallback(() => {
    const result = decode(importCodeInput.trim(), allTags, allStages);
    if (!result) {
      setImportError('分享码无效或格式错误');
      return;
    }
    setImportError(null);
    setShowImportInput(false);
    setImportCodeInput('');
    store.confirmTags(result.tagIds);
    if (result.stageId) store.confirmStage(result.stageId);
    if (result.softConstraints) store.setSoftConstraints(result.softConstraints);
  }, [importCodeInput, allTags, allStages, store]);

  const handleSavePlan = useCallback(() => {
    if (!planName.trim()) return;
    store.savePlan(planName.trim());
    setPlanName('');
    setShowSaveDialog(false);
  }, [store, planName]);

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      {/* ======== 左栏 ======== */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* 已确认方案横幅 */}
        <div className="card" style={{ padding: '14px 18px' }}>
          {store.confirmedTags.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-accent)' }}>⚡ 当前挑战</span>
              {confirmedTagObjects.map((tag) => (
                <span key={tag.id} className="tag-badge tag-badge-active">
                  {tag.icon} {tag.name}
                </span>
              ))}
              {store.confirmedStage && (() => {
                const stage = allStages.find((s) => s.id === store.confirmedStage);
                return stage ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 10px', borderRadius: 6, fontSize: 14, fontWeight: 500,
                    border: '1px solid #e5c07b', background: 'rgba(229,192,123,0.1)',
                    color: '#e5c07b',
                  }}>
                    🗺️ {stage.fullName || stage.name}
                  </span>
                ) : null;
              })()}
              <button
                onClick={() => { store.confirmTags([]); store.confirmStage(null); }}
                className="btn-secondary"
                style={{ marginLeft: 'auto' }}
              >
                重新选择
              </button>
            </div>
          ) : (
            <div style={{ fontSize: 15, color: 'var(--text-muted)', textAlign: 'center', padding: '6px 0' }}>
              请先在右侧选择挑战标签，开始你的自限挑战！
            </div>
          )}
        </div>

        {/* 编队网格 */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 17, fontWeight: 600 }}>编队</span>
            <span style={{
              fontSize: 15, fontWeight: 600,
              color: store.squad.length > 0 ? 'var(--text-accent)' : 'var(--text-muted)',
              background: 'rgba(45,212,191,0.08)', padding: '1px 8px', borderRadius: 4,
            }}>
              {store.squad.length} / 12
            </span>
            {/* 检测编队按钮 + 违规提示 */}
            {store.squad.length > 0 && (
              <>
                <button
                  onClick={() => setShowViolations(!showViolations)}
                  style={{
                    fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 6,
                    background: showViolations
                      ? (squadValidationResult.violations.length > 0
                        ? 'rgba(249,117,131,0.15)'
                        : 'rgba(45,212,191,0.1)')
                      : 'transparent',
                    border: `1px solid ${
                      showViolations
                        ? (squadValidationResult.violations.length > 0 ? '#f97583' : 'var(--accent)')
                        : 'var(--border)'
                    }`,
                    color: showViolations
                      ? (squadValidationResult.violations.length > 0 ? '#f97583' : 'var(--text-accent)')
                      : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {showViolations
                    ? (squadValidationResult.violations.length > 0
                        ? `⚠️ ${squadValidationResult.violations.length}项违规`
                        : '✅ 编队合规')
                    : '🔍 检测编队'}
                </button>
                {showViolations && squadValidationResult.violations.length > 0 && (
                  <div style={{
                    width: '100%', marginTop: 4, padding: '8px 12px',
                    background: 'rgba(249,117,131,0.08)',
                    border: '1px solid rgba(249,117,131,0.3)',
                    borderRadius: 8, fontSize: 13, lineHeight: 1.6,
                    color: '#f97583',
                  }}>
                    {squadValidationResult.violations.map((v, i) => (
                      <div key={i}>• {v}</div>
                    ))}
                  </div>
                )}
                {showViolations && squadValidationResult.violations.length === 0 && (
                  <div style={{
                    width: '100%', marginTop: 4, padding: '6px 12px',
                    background: 'rgba(45,212,191,0.08)',
                    border: '1px solid var(--accent)',
                    borderRadius: 8, fontSize: 13, color: 'var(--text-accent)',
                  }}>
                    ✅ 编队全部合规，所有干员满足约束条件！
                  </div>
                )}
              </>
            )}
            {store.squad.length > 0 && (
              <button onClick={store.clearSquad} className="btn-danger" style={{ marginLeft: 'auto' }}>
                ✕ 清空编队
              </button>
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 100px)',
            gridTemplateRows: 'repeat(2, auto)',
            gridAutoFlow: 'column',
            gap: 8,
            minHeight: 140,
          }}>
            {Array.from({ length: Math.max(12, store.squad.length) }).map((_, idx) => {
              const op = store.squad[idx];
              if (!op) {
                return (
                  <div key={`empty-${idx}`} style={{
                    width: 100, height: 140,
                    background: 'rgba(13,17,23,0.5)', border: '1px dashed rgba(48,54,80,0.4)',
                    borderRadius: 10, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 24, color: 'rgba(48,54,80,0.4)',
                  }}>
                    +
                  </div>
                );
              }
              return (
                <div key={`${op.name}-${idx}`} style={{
                  position: 'relative', width: 100, height: 140,
                  background: 'linear-gradient(180deg, rgba(30,38,60,0.9), rgba(18,24,38,0.9))',
                  border: '1px solid var(--border)',
                  borderRadius: 10, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', padding: '6px 4px 4px',
                  cursor: 'default', transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.boxShadow = '0 0 8px rgba(45,212,191,0.15)';
                    (e.currentTarget.querySelector('.del-btn') as HTMLElement)!.style.display = 'flex';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'none';
                    (e.currentTarget.querySelector('.del-btn') as HTMLElement)!.style.display = 'none';
                  }}
                >
                  <button
                    className="del-btn"
                    onClick={() => handleRemoveFromSquad(idx)}
                    style={{
                      position: 'absolute', top: -7, right: -7, display: 'none',
                      width: 20, height: 20, borderRadius: '50%',
                      background: '#f97583', border: '2px solid #0a0e17',
                      color: '#fff', fontSize: 13, cursor: 'pointer',
                      alignItems: 'center', justifyContent: 'center',
                      zIndex: 2, lineHeight: 1,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    }}
                  >✕</button>
                  {/* 头像 */}
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', overflow: 'hidden',
                    background: '#0d1117', marginBottom: 4, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid rgba(45,212,191,0.15)',
                  }}>
                    {op.avatar ? (
                      <img src={op.avatar} alt={op.name}
                        style={{ width: 40, height: 40, objectFit: 'cover' }}
                        onError={(e) => { (e.target as HTMLImageElement).src = PROFESSION_ICONS[op.profession] || ''; }}
                      />
                    ) : (
                      <img src={PROFESSION_ICONS[op.profession] || ''} alt={op.profession}
                        style={{ width: 24, height: 24, opacity: 0.6 }}
                      />
                    )}
                  </div>
                  {/* 名字 */}
                  <div style={{
                    fontSize: 13, fontWeight: 500, textAlign: 'center',
                    lineHeight: 1.2, maxWidth: 88, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: 'var(--text-primary)',
                  }}>
                    {op.name}
                  </div>
                  {/* 星级 */}
                  <div style={{
                    fontSize: 12, color: RARITY_COLORS[op.rarity] || '#8b949e', marginTop: 2,
                    lineHeight: 1.3,
                  }}>
                    {'★'.repeat(op.rarity)}
                  </div>
                  {/* 阻挡数 */}
                  {op.block !== null && op.block !== undefined && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      <BlockIcon/>{op.block}
                    </div>
                  )}
                  {/* 费用 */}
                  {op.cost !== undefined && (
                    <div style={{ fontSize: 11, color: '#e5c07b', lineHeight: 1.4 }}>
                      <CostIcon/>{op.cost}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 自限玩法标签详细说明 — 已确认或待确认的标签都即时显示 */}
        {(confirmedTagObjects.length > 0 || pendingTagObjects.length > 0) && (
          <div className="card" style={{ padding: '12px 16px', borderLeft: '3px solid var(--accent)' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-accent)', marginBottom: 8 }}>
              📜 自限规则
            </div>
            {(confirmedTagObjects.length > 0 ? confirmedTagObjects : pendingTagObjects).map((tag) => (
              <div key={tag.id} style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                padding: '6px 0', borderBottom: '1px solid rgba(48,54,80,0.3)',
                fontSize: 15, lineHeight: 1.6,
              }}>
                <span style={{ flexShrink: 0, marginTop: 2, fontSize: 18 }}>{tag.icon}</span>
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tag.name}</span>
                  <div style={{ color: 'var(--text-secondary)', marginTop: 2, fontSize: 14 }}>{tag.detail}</div>
                </div>
              </div>
            ))}
            {confirmedTagObjects.length === 0 && pendingTagObjects.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                点击「✅ 确认标签」后才会应用约束
              </div>
            )}
          </div>
        )}

        {/* 干员选择区 */}
        <div className="card" style={{
          padding: '14px 16px',
          transition: 'opacity 0.2s',
        }}>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 10 }}>
            <span style={{ color: 'var(--text-accent)' }}>◆</span> 选择干员
          </div>

          <div style={{ marginBottom: 8 }}>
            {/* 职业 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              <button onClick={() => setProfessionFilter(null)}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 14,
                  border: `1px solid ${professionFilter === null ? 'var(--accent)' : 'var(--border)'}`,
                  background: professionFilter === null ? 'var(--accent-bg)' : 'transparent',
                  color: professionFilter === null ? 'var(--text-accent)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}>全职业</button>
              {PROFESSIONS.map((prof) => (
                <button key={prof} onClick={() => setProfessionFilter(professionFilter === prof ? null : prof)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 14,
                    border: `1px solid ${professionFilter === prof ? PROFESSION_COLORS[prof] : 'var(--border)'}`,
                    background: professionFilter === prof ? 'rgba(255,255,255,0.05)' : 'transparent',
                    color: professionFilter === prof ? PROFESSION_COLORS[prof] : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}>{prof}</button>
              ))}
            </div>

            {/* 稀有度 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              <button onClick={() => setRarityFilter(null)}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 14,
                  border: `1px solid ${rarityFilter === null ? 'var(--accent)' : 'var(--border)'}`,
                  background: rarityFilter === null ? 'var(--accent-bg)' : 'transparent',
                  color: rarityFilter === null ? 'var(--text-accent)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}>全星级</button>
              {[1, 2, 3, 4, 5, 6].map((r) => (
                <button key={r} onClick={() => setRarityFilter(rarityFilter === r ? null : r)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 14,
                    border: `1px solid ${rarityFilter === r ? RARITY_COLORS[r] : 'var(--border)'}`,
                    background: rarityFilter === r ? 'rgba(255,255,255,0.05)' : 'transparent',
                    color: rarityFilter === r ? RARITY_COLORS[r] : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}>{r}★</button>
              ))}
            </div>

            {/* 位置 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {POSITIONS.map((pos) => (
                <button key={pos}
                  onClick={() => setPositionFilter(pos === '全部' ? '全部' : positionFilter === pos ? '全部' : pos)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 14,
                    border: `1px solid ${positionFilter === pos ? 'var(--accent)' : 'var(--border)'}`,
                    background: positionFilter === pos ? 'var(--accent-bg)' : 'transparent',
                    color: positionFilter === pos ? 'var(--text-accent)' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}>{pos}</button>
              ))}
            </div>

            {/* 种族 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6, maxHeight: 120, overflowY: 'auto' }}>
              <button onClick={() => setRaceFilter(null)}
                style={{
                  padding: '4px 10px', borderRadius: 6, fontSize: 14,
                  border: `1px solid ${raceFilter === null ? 'var(--accent)' : 'var(--border)'}`,
                  background: raceFilter === null ? 'var(--accent-bg)' : 'transparent',
                  color: raceFilter === null ? 'var(--text-accent)' : 'var(--text-muted)',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}>全种族</button>
              {majorRaces.map((race) => (
                <button key={race} onClick={() => setRaceFilter(raceFilter === race ? null : race)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 14,
                    border: `1px solid ${raceFilter === race ? 'var(--accent)' : 'var(--border)'}`,
                    background: raceFilter === race ? 'var(--accent-bg)' : 'transparent',
                    color: raceFilter === race ? 'var(--text-accent)' : 'var(--text-muted)',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>{race}</button>
              ))}
              {minorRaces.size > 0 && (
                <button onClick={() => setRaceFilter(raceFilter === RACE_OTHER ? null : RACE_OTHER)}
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 14,
                    border: `1px solid ${raceFilter === RACE_OTHER ? 'var(--accent)' : 'var(--border)'}`,
                    background: raceFilter === RACE_OTHER ? 'var(--accent-bg)' : 'transparent',
                    color: raceFilter === RACE_OTHER ? 'var(--text-accent)' : 'var(--text-muted)',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>其他（{minorRaces.size}种）</button>
              )}
            </div>
          </div>

          {/* 干员列表 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 320, overflowY: 'auto' }}>
            {filteredOps.map((op: any) => {
              const inSquad = store.squad.some((s) => s.name === op.name);
              return (
                <div key={op.name}
                  onClick={() => setSelectedOp(selectedOp?.name === op.name ? null : op)}
                  onDoubleClick={() => { if (op._valid && !inSquad) handleAddToSquad(op); }}
                  style={{
                    width: 78, padding: '5px 4px', borderRadius: 8,
                    background: selectedOp?.name === op.name ? 'rgba(45,212,191,0.12)' : 'transparent',
                    border: `1px solid ${inSquad ? 'var(--accent)' : 'transparent'}`,
                    cursor: op._valid && !inSquad ? 'pointer' : 'not-allowed',
                    opacity: (!op._valid || inSquad) ? 0.4 : 1,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!inSquad && op._valid) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                  }}
                  onMouseLeave={(e) => {
                    if (selectedOp?.name !== op.name) (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                  title={!op._valid ? op._reason : inSquad ? '已在编队中' : ''}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
                    background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    {op.avatar ? (
                      <img src={op.avatar} alt={op.name}
                        style={{ width: 36, height: 36, objectFit: 'cover' }}
                        onError={(e) => { (e.target as HTMLImageElement).src = PROFESSION_ICONS[op.profession] || ''; }}
                      />
                    ) : (
                      <img src={PROFESSION_ICONS[op.profession] || ''} alt={op.profession}
                        style={{ width: 22, height: 22, opacity: 0.5 }}
                      />
                    )}
                  </div>
                  <div style={{
                    fontSize: 13, textAlign: 'center', lineHeight: 1.1,
                    maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: 'var(--text-primary)',
                  }}>{op.name}</div>
                  <div style={{ fontSize: 12, color: RARITY_COLORS[op.rarity] || '#8b949e' }}>
                    {op.rarity}★
                  </div>
                </div>
              );
            })}
          </div>

          {/* 选中干员详情 */}
          {selectedOp && (
            <div style={{
              marginTop: 10, padding: '10px 14px', background: 'rgba(13,17,23,0.6)',
              borderRadius: 10, border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', overflow: 'hidden',
                background: '#111827', flexShrink: 0,
                border: '2px solid rgba(45,212,191,0.2)',
              }}>
                {selectedOp.avatar ? (
                  <img src={selectedOp.avatar} alt={selectedOp.name}
                    style={{ width: 48, height: 48, objectFit: 'cover' }}
                    onError={(e) => { (e.target as HTMLImageElement).src = PROFESSION_ICONS[selectedOp.profession] || ''; }}
                  />
                ) : null}
              </div>
              <div style={{ flex: 1, fontSize: 15, lineHeight: 1.7 }}>
                <div style={{ fontWeight: 600, fontSize: 16 }}>
                  {selectedOp.name}
                  <span style={{ color: RARITY_COLORS[selectedOp.rarity], marginLeft: 6 }}>
                    {selectedOp.rarity}★
                  </span>
                </div>
                <div style={{ color: 'var(--text-secondary)' }}>
                  <span style={{ color: PROFESSION_COLORS[selectedOp.profession] || '#8b949e' }}>
                    {selectedOp.profession}
                  </span>
                  {' · '}{selectedOp.position}
                  {selectedOp.block !== null && (
                    <span> · <BlockIcon/>{selectedOp.block}</span>
                  )}
                  {selectedOp.race && <span> · {selectedOp.race}</span>}
                  {selectedOp.cost !== undefined && (
                    <span> · <CostIcon/>{selectedOp.cost}</span>
                  )}
                </div>
              </div>
              <button onClick={() => handleAddToSquad(selectedOp)}
                disabled={store.squad.some((s) => s.name === selectedOp.name)}
                className="btn-success"
                style={{
                  opacity: store.squad.some((s) => s.name === selectedOp.name) ? 0.5 : 1,
                  cursor: store.squad.some((s) => s.name === selectedOp.name) ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap', fontSize: 14, padding: '6px 14px',
                }}>
                {store.squad.some((s) => s.name === selectedOp.name) ? '已在编队' : '+ 加入编队'}
              </button>
            </div>
          )}

          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
            显示 {filteredOps.length} / {allOps.length} 名干员 · 双击或点击「加入编队」
          </div>
        </div>
        {/* 版权声明 — 卡片下方 */}
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 4, letterSpacing: 0.5 }}>
          本程序所有素材版权归鹰角网络所有
        </div>
      </div>

      {/* ======== 右栏 ======== */}
      <div style={{ width: 350, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* 🏷️ 挑战标签 */}
        <div className="right-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3>🏷️ 挑战标签</h3>
            {(selectedTagIds.length > 0 || randomTags.length > 0 || store.confirmedTags.length > 0) && (
              <button onClick={() => { store.confirmTags([]); setSelectedTagIds([]); setRandomTags([]); setShareCode(null); }}
                style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 4,
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', cursor: 'pointer',
                }}>
                一键清理
              </button>
            )}
          </div>

          <div style={{
            display: 'flex', gap: 4, marginBottom: 10,
            background: 'rgba(13,17,23,0.5)', borderRadius: 8, padding: 3,
          }}>
            <button onClick={() => store.setTagMode('manual')}
              style={{
                flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 14, fontWeight: 500,
                background: store.tagMode === 'manual' ? 'linear-gradient(135deg, #0d9488, #2dd4bf)' : 'transparent',
                color: store.tagMode === 'manual' ? '#fff' : 'var(--text-muted)',
                border: 'none', cursor: 'pointer', letterSpacing: '0.3px',
              }}>📝 手动</button>
            <button onClick={() => store.setTagMode('random')}
              style={{
                flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 14, fontWeight: 500,
                background: store.tagMode === 'random' ? 'linear-gradient(135deg, #0d9488, #2dd4bf)' : 'transparent',
                color: store.tagMode === 'random' ? '#fff' : 'var(--text-muted)',
                border: 'none', cursor: 'pointer', letterSpacing: '0.3px',
              }}>🎲 随机</button>
          </div>

          {store.tagMode === 'manual' ? (
            <div>
              {(['squad', 'rarity', 'cost', 'position', 'operation', 'special', 'faction', 'race', 'block', 'other'] as const).map((cat) => {
                const catTags = allTags.filter((t) => t.category === cat);
                if (catTags.length === 0) return null;
                return (
                  <div key={cat} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }}>
                      {CATEGORY_LABELS[cat]}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {catTags.map((tag) => (
                        <label key={tag.id} style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '3px 8px', borderRadius: 6, fontSize: 14,
                          background: selectedTagIds.includes(tag.id) ? 'rgba(45,212,191,0.1)' : 'transparent',
                          border: `1px solid ${selectedTagIds.includes(tag.id) ? 'var(--accent)' : 'var(--border)'}`,
                          cursor: 'pointer',
                          color: selectedTagIds.includes(tag.id) ? 'var(--text-accent)' : 'var(--text-muted)',
                          userSelect: 'none', transition: 'all 0.15s',
                        }}>
                          <input type="checkbox"
                            checked={selectedTagIds.includes(tag.id)}
                            onChange={() => handleToggleTag(tag.id)}
                            style={{ display: 'none' }}
                          />
                          {tag.icon} {tag.name}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                {[2, 3, 4].map((n) => (
                  <button key={n} onClick={() => setRandomCount(n)}
                    style={{
                      flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 14,
                      background: randomCount === n ? 'rgba(45,212,191,0.12)' : 'transparent',
                      border: `1px solid ${randomCount === n ? 'var(--accent)' : 'var(--border)'}`,
                      color: randomCount === n ? 'var(--text-accent)' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}>抽{n}个</button>
                ))}
              </div>
              <button onClick={handleRandomDraw}
                style={{
                  width: '100%', padding: '6px 0', borderRadius: 8, fontSize: 15, fontWeight: 500,
                  background: 'linear-gradient(135deg, #0d9488, #2dd4bf)',
                  border: 'none', color: '#fff', cursor: 'pointer', marginBottom: 8,
                  boxShadow: '0 2px 8px rgba(45,212,191,0.2)',
                }}>
                🎲 抽奖
              </button>
              {randomTags.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {randomTags.map((tag, idx) => (
                    <div key={tag.id} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 8px', background: 'rgba(255,255,255,0.03)',
                      borderRadius: 8, border: '1px solid var(--border)',
                    }}>
                      <span style={{ fontSize: 16 }}>{tag.icon}</span>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{tag.name}</span>
                      <button onClick={() => handleRerollTag(idx)} title="换一换"
                        style={{
                          background: 'transparent', border: 'none',
                          color: 'var(--text-accent)', cursor: 'pointer', fontSize: 16, padding: '0 2px',
                        }}>🔄</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {((store.tagMode === 'manual' && selectedTagIds.length > 0) ||
            (store.tagMode === 'random' && randomTags.length > 0)) && (
            <button onClick={handleConfirmTags}
              style={{
                width: '100%', padding: '8px 0', borderRadius: 8, fontSize: 15, fontWeight: 600,
                background: 'linear-gradient(135deg, #0d9488, #2dd4bf)',
                border: 'none', color: '#fff', cursor: 'pointer', marginTop: 10,
                letterSpacing: '0.5px',
                boxShadow: '0 2px 8px rgba(45,212,191,0.25)',
              }}>
              ✅ 确认标签
            </button>
          )}
        </div>

        {/* 🗺️ 关卡 */}
        <div className="right-section">
          <h3>🗺️ 关卡</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
            <button onClick={() => setStageFilterTypes([])}
              style={{
                padding: '3px 8px', borderRadius: 6, fontSize: 13,
                background: stageFilterTypes.length === 0 ? 'var(--accent-bg)' : 'transparent',
                border: `1px solid ${stageFilterTypes.length === 0 ? 'var(--accent)' : 'var(--border)'}`,
                color: stageFilterTypes.length === 0 ? 'var(--text-accent)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}>全部</button>
            {Object.entries(STAGE_TYPE_LABELS).map(([type, label]) => {
              const active = stageFilterTypes.includes(type);
              return (
                <button key={type}
                  onClick={() => setStageFilterTypes((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type])}
                  style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: 13,
                    background: active ? 'rgba(255,255,255,0.05)' : 'transparent',
                    border: `1px solid ${active ? STAGE_TYPE_COLORS[type] : 'var(--border)'}`,
                    color: active ? STAGE_TYPE_COLORS[type] : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}>{label}</button>
              );
            })}
          </div>

          <button onClick={handleStageRandom}
            style={{
              width: '100%', padding: '6px 0', borderRadius: 8, fontSize: 14, fontWeight: 500,
              background: 'rgba(13,17,23,0.5)', border: '1px solid var(--accent)',
              color: 'var(--text-accent)', cursor: 'pointer', marginBottom: 8,
            }}>
            🎲 随机关卡
          </button>

          {randomStage && (
            <div style={{
              padding: '8px 10px', background: 'rgba(255,255,255,0.03)',
              borderRadius: 8, border: '1px solid var(--border)', marginBottom: 8,
            }}>
              {randomStage.mapImage && (
                <div style={{
                  width: '100%', aspectRatio: '16/9', overflow: 'hidden',
                  borderRadius: 6, marginBottom: 8, background: '#0d1117',
                  position: 'relative',
                }}>
                  <img src={randomStage.mapImage} alt={randomStage.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              <div style={{ fontSize: 15, fontWeight: 600, color: STAGE_TYPE_COLORS[randomStage.type] }}>
                {randomStage.fullName || randomStage.name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
                {randomStage.chapter} · {STAGE_TYPE_LABELS[randomStage.type]}
              </div>
              {randomStage.detail && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{randomStage.detail}</div>
              )}
            </div>
          )}

          {randomStage && (
            <button onClick={handleConfirmStage}
              style={{
                width: '100%', padding: '6px 0', borderRadius: 8, fontSize: 14, fontWeight: 500,
                background: 'linear-gradient(135deg, #0d9488, #2dd4bf)',
                border: 'none', color: '#fff', cursor: 'pointer',
              }}>
              ✅ 确认关卡
            </button>
          )}
        </div>

        {/* 📋 方案 */}
        <div className="right-section">
          <h3>📋 方案</h3>

          {store.confirmedTags.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                <button onClick={handleGenerateShareCode}
                  style={{
                    flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 13, fontWeight: 500,
                    background: 'rgba(45,212,191,0.1)', border: '1px solid var(--accent)',
                    color: 'var(--text-accent)', cursor: 'pointer',
                  }}>
                  🔗 导出分享码
                </button>
                <button onClick={() => { setShowImportInput(!showImportInput); setImportError(null); }}
                  style={{
                    flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 13, fontWeight: 500,
                    background: 'rgba(210,168,255,0.1)', border: '1px solid #d2a8ff',
                    color: '#d2a8ff', cursor: 'pointer',
                  }}>
                  📥 导入分享码
                </button>
              </div>

              {shareCode && (
                <div style={{
                  fontSize: 13, color: 'var(--text-secondary)', padding: '5px 8px',
                  background: 'rgba(13,17,23,0.6)', borderRadius: 6,
                  wordBreak: 'break-all', fontFamily: 'var(--font-mono)', marginBottom: 4,
                  border: '1px solid var(--border-light)',
                }}>
                  {shareCode}
                  <span style={{ color: 'var(--text-accent)', marginLeft: 6, fontSize: 12 }}>（已复制）</span>
                </div>
              )}

              {showImportInput && (
                <div style={{ marginBottom: 4 }}>
                  <input type="text" placeholder="粘贴分享码，如 AKRL:..."
                    value={importCodeInput}
                    onChange={(e) => setImportCodeInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleImportCode(); }}
                    style={{
                      width: '100%', padding: '6px 10px', borderRadius: 6,
                      background: 'var(--bg-input)', border: '1px solid var(--border)',
                      color: 'var(--text-primary)', fontSize: 14, outline: 'none',
                      marginBottom: 4, boxSizing: 'border-box',
                      fontFamily: 'var(--font-mono)',
                    }}
                  />
                  {importError && (
                    <div style={{ fontSize: 13, color: '#f97583', marginBottom: 4 }}>{importError}</div>
                  )}
                  <button onClick={handleImportCode}
                    style={{
                      width: '100%', padding: '5px 0', borderRadius: 6, fontSize: 14, fontWeight: 500,
                      background: 'linear-gradient(135deg, #059669, #10b981)',
                      border: 'none', color: '#fff', cursor: 'pointer',
                    }}>
                    确认导入
                  </button>
                </div>
              )}
            </div>
          )}

          {store.plans.length === 0 ? (
            <div style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
              暂无保存方案
            </div>
          ) : (
            <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 8 }}>
              {store.plans.map((plan) => (
                <div key={plan.id} style={{
                  padding: '7px 8px', background: 'rgba(13,17,23,0.5)', borderRadius: 8,
                  border: '1px solid var(--border)', marginBottom: 5,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <button onClick={() => store.toggleFav(plan.id)}
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      fontSize: 16, color: plan.fav ? '#f0883e' : 'var(--border)', padding: 0,
                    }}>
                    {plan.fav ? '★' : '☆'}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 500, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{plan.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {plan.squad.length}人 · {plan.createdAt}
                    </div>
                  </div>
                  <button onClick={() => {
                    store.confirmTags(plan.tags);
                    if (plan.stage) store.confirmStage(plan.stage);
                    store.setHardConstraints(plan.hardConstraints);
                    store.setSoftConstraints(plan.softConstraints);
                  }} title="加载"
                    style={{
                      background: 'transparent', border: 'none',
                      color: 'var(--text-accent)', cursor: 'pointer', fontSize: 15, padding: '2px 4px',
                    }}>📂</button>
                  <button onClick={() => store.deletePlan(plan.id)} title="删除"
                    style={{
                      background: 'transparent', border: 'none',
                      color: '#f97583', cursor: 'pointer', fontSize: 15, padding: '2px 4px',
                    }}>🗑️</button>
                </div>
              ))}
            </div>
          )}

          <button onClick={() => setShowSaveDialog(true)}
            style={{
              width: '100%', padding: '7px 0', borderRadius: 8, fontSize: 14, fontWeight: 600,
              background: 'linear-gradient(135deg, #059669, #10b981)',
              border: 'none', color: '#fff', cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(16,185,129,0.2)',
            }}>
            💾 保存当前方案
          </button>

          {showSaveDialog && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 100, backdropFilter: 'blur(4px)',
            }} onClick={() => setShowSaveDialog(false)}>
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 14, padding: 24, width: 320,
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }} onClick={(e) => e.stopPropagation()}>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 14, color: 'var(--text-accent)' }}>
                  💾 保存方案
                </div>
                <input type="text" placeholder="方案名称"
                  value={planName} onChange={(e) => setPlanName(e.target.value)} autoFocus
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    background: 'var(--bg-input)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 16, outline: 'none',
                    marginBottom: 12, boxSizing: 'border-box',
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSavePlan(); }}
                />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setShowSaveDialog(false)}
                    style={{
                      padding: '7px 16px', borderRadius: 8, fontSize: 15,
                      background: 'transparent', border: '1px solid var(--border)',
                      color: 'var(--text-secondary)', cursor: 'pointer',
                    }}>取消</button>
                  <button onClick={handleSavePlan}
                    style={{
                      padding: '7px 16px', borderRadius: 8, fontSize: 15, fontWeight: 500,
                      background: 'linear-gradient(135deg, #059669, #10b981)',
                      border: 'none', color: '#fff', cursor: 'pointer',
                    }}>保存</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getDisabledReason(op: OperatorData, hard: import('../types').HardConstraints): string {
  if (hard.allowedProfessions && !hard.allowedProfessions.includes(op.profession)) return `职业"${op.profession}"不在允许列表`;
  if (hard.bannedProfessions.includes(op.profession)) return `职业"${op.profession}"已被禁用`;
  if (hard.maxRarity !== null && op.rarity > hard.maxRarity) return `稀有度过高(${op.rarity})`;
  if (hard.minRarity !== null && op.rarity < hard.minRarity) return `稀有度过低(${op.rarity})`;
  if (hard.positionRestriction && !hard.positionRestriction.includes(op.position)) return '部署位置不符合要求';
  if (hard.allowedRaces && op.race && !hard.allowedRaces.includes(op.race)) return `种族"${op.race}"不在允许列表`;
  if (hard.bannedRaces.includes(op.race || '')) return `种族"${op.race}"已被禁用`;
  if (hard.allowedNations && op.nation && !hard.allowedNations.includes(op.nation)) return `国家"${op.nation}"不在允许列表`;
  if (hard.bannedNations.includes(op.nation || '')) return `国家"${op.nation}"已被禁用`;
  if (hard.blockTier !== null) {
    if (op.block === null && hard.blockTierMode === 'exact') return `阻挡数未知`;
    if (op.block !== null && hard.blockTierMode === 'exact' && op.block !== hard.blockTier) return `阻挡数不匹配(${op.block}≠${hard.blockTier})`;
    if (op.block !== null && hard.blockTierMode === 'max' && op.block > hard.blockTier) return `阻挡数超限(${op.block}>${hard.blockTier})`;
  }
  const cost = op.cost;
  if (typeof cost === 'number') {
    if (hard.maxSingleCost !== null && cost > hard.maxSingleCost) return `部署费用(${cost})过高`;
    if (hard.minSingleCost !== null && cost < hard.minSingleCost) return `部署费用(${cost})过低`;
  }
  return '不满足约束条件';
}
