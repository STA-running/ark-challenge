import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppStore } from '../stores/appStore';
import { loadTags, drawRandomTags, rerollSingleTag, mergeTagsToConstraints, filterOperatorsByHardConstraints } from '../engine/tagEngine';
import { validateSquad } from '../engine/validator';
import type { ChallengeTag, StageData, OperatorData } from '../types';

// 共用常量和图标
const RARITY_COLORS: Record<number, string> = { 1: '#8b949e', 2: '#58a6ff', 3: '#d2a8ff', 4: '#f0883e', 5: '#ffd700', 6: '#ff6b6b' };
const STAGE_TYPE_LABELS: Record<string, string> = { normal: '普通', boss: 'Boss', hard: '超难', hard_boss: '超难Boss' };

const EXCLUDED_CHAPTERS = ['第一章', '第二章', '第三章', '第四章'];

interface MobileViewProps {
  onSwitchToDesktop?: () => void;
}

export default function MobileView({ onSwitchToDesktop }: MobileViewProps) {
  const store = useAppStore();

  // 标记手机模式，隐藏 App 顶栏的编队/设置按钮
  useEffect(() => {
    document.body.classList.add('mobile-mode');
    return () => document.body.classList.remove('mobile-mode');
  }, []);

  const [allTags, setAllTags] = useState<ChallengeTag[]>([]);
  const [allStages, setAllStages] = useState<StageData[]>([]);
  const [activeTab, setActiveTab] = useState(0);

  // 标签
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [randomTags, setRandomTags] = useState<ChallengeTag[]>([]);
  const [randomCount] = useState(3);
  const [tagMode, setTagMode] = useState<'manual' | 'random'>('manual');

  // 关卡
  const [randomStage, setRandomStage] = useState<StageData | null>(null);
  const [stageFilterTypes, setStageFilterTypes] = useState<string[]>([]);
  const [showStageFilter, setShowStageFilter] = useState(false);

  // 编队
  const [professionFilter, setProfessionFilter] = useState<string | null>(null);
  const [rarityFilter, setRarityFilter] = useState<number | null>(null);
  const [positionFilter, setPositionFilter] = useState<string>('全部');
  const [raceFilter, setRaceFilter] = useState<string | null>(null);

  // 设置
  const [tagBlacklist, setTagBlacklist] = useState<string[]>([]);
  const [stageBlacklist, setStageBlacklist] = useState<string[]>([]);
  const [showViolations, setShowViolations] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [importCodeInput, setImportCodeInput] = useState('');

  useEffect(() => {
    loadTags().then(setAllTags).catch(console.error);
    fetch('/data/stages.json').then((r) => r.json()).then(setAllStages).catch(console.error);
    if (!store.operatorsLoaded) {
      fetch('/data/operators.json')
        .then((r) => r.json())
        .then((data) => store.setOperators(data.operators))
        .catch(console.error);
    }
    try {
      const raw = localStorage.getItem('ark_challenge_tag_blacklist');
      if (raw) setTagBlacklist(JSON.parse(raw));
    } catch {}
    try {
      const raw = localStorage.getItem('ark_challenge_stage_blacklist');
      if (raw) setStageBlacklist(JSON.parse(raw));
    } catch {}
  }, []);

  // 所有干员
  const allOps = useMemo(() => Object.values(store.operators), [store.operators]);

  const PROFESSIONS = ['先锋', '近卫', '重装', '狙击', '术师', '医疗', '辅助', '特种'];  // 不含全职业/近战位/远程位

  // 标签过滤
  const manualTags = useMemo(() => allTags.filter((t) => !tagBlacklist.includes(t.id)), [allTags, tagBlacklist]);

  // 标签分类
  const tagsByCategory = useMemo(() => {
    const map = new Map<string, ChallengeTag[]>();
    const cats = ['squad', 'rarity', 'cost', 'position', 'operation', 'special', 'faction', 'race', 'block', 'other'];
    for (const cat of cats) {
      const t = manualTags.filter((x) => x.category === cat);
      if (t.length > 0) map.set(cat, t);
    }
    return map;
  }, [manualTags]);

  const CATEGORY_LABELS: Record<string, string> = { squad: '编队', rarity: '稀有度', cost: '费用', position: '位置', operation: '操作', special: '特殊', faction: '阵营', race: '种族', block: '阻挡数', other: '其他' };

  // 随机标签
  const handleRandomDraw = useCallback(() => {
    const bl = tagBlacklist.length > 0 ? new Set(tagBlacklist) : new Set<string>();
    const pool = allTags.filter((t) => !bl.has(t.id));
    setRandomTags(drawRandomTags(pool, randomCount));
  }, [allTags, tagBlacklist, randomCount]);

  const handleRerollTag = useCallback((idx: number) => {
    const bl = tagBlacklist.length > 0 ? new Set(tagBlacklist) : new Set<string>();
    const pool = allTags.filter((t) => !bl.has(t.id));
    setRandomTags((prev) => rerollSingleTag(prev, idx, pool));
  }, [allTags, tagBlacklist]);

  // 关卡
  const handleStageRandom = useCallback(() => {
    const bl: string[] = [];
    try { const raw = localStorage.getItem('ark_challenge_stage_blacklist'); if (raw) bl.push(...JSON.parse(raw)); } catch {}
    let filtered = allStages;
    if (stageFilterTypes.length > 0) {
      filtered = allStages.filter((s) => stageFilterTypes.includes(s.type));
    }
    filtered = filtered.filter((s) => !bl.includes(s.chapter) && !EXCLUDED_CHAPTERS.includes(s.chapter));
    if (filtered.length === 0) return;
    setRandomStage(filtered[Math.floor(Math.random() * filtered.length)]);
  }, [allStages, stageFilterTypes]);

  // 编队校验
  const squadValidationResult = useMemo(() => validateSquad(store.squad, store.hardConstraints), [store.squad, store.hardConstraints]);

  // 标签确认后更新约束
  useEffect(() => {
    if (store.confirmedTags.length === 0) return;
    const confirmedTagObjects = allTags.filter((t) => store.confirmedTags.includes(t.id));
    if (confirmedTagObjects.length === 0) return;
    const { hard, soft } = mergeTagsToConstraints(confirmedTagObjects);
    store.setHardConstraints(hard);
    store.setSoftConstraints(soft);
  }, [store.confirmedTags, allTags]);

  // 确认标签
  const handleConfirmTags = () => {
    const ids = tagMode === 'manual' ? selectedTagIds : randomTags.map((t) => t.id);
    store.confirmTags(ids);
    setActiveTab(1);
  };

  // 添加干员
  const handleAddToSquad = useCallback((op: OperatorData) => { store.addToSquad(op); }, [store]);

  // 删除干员
  const handleRemoveFromSquad = useCallback((idx: number) => {
    store.removeFromSquad(idx);
  }, [store]);

  // 筛选干员
  const filteredOps = useMemo(() => {
    let ops = allOps;
    if (professionFilter) {
      ops = ops.filter((o) => o.profession === professionFilter);
    }
    if (rarityFilter !== null) {
      ops = ops.filter((o) => o.rarity === rarityFilter);
    }
    if (positionFilter !== '全部') {
      ops = ops.filter((o) => o.position === positionFilter);
    }
    if (raceFilter) {
      ops = ops.filter((o) => o.race === raceFilter);
    }
    const tagsConfirmed = store.confirmedTags.length > 0;
    const validOpNames = tagsConfirmed ? new Set(filterOperatorsByHardConstraints(store.operators, store.hardConstraints).map((o) => o.name)) : new Set(allOps.map((o) => o.name));
    ops = [...ops].sort((a, b) => {
      if (a.rarity !== b.rarity) return b.rarity - a.rarity;
      const aBlock = a.block ?? -1;
      const bBlock = b.block ?? -1;
      return bBlock - aBlock;
    });
    return ops.map((o) => ({ ...o, _valid: tagsConfirmed ? validOpNames.has(o.name) : true, _reason: '' }));
  }, [allOps, store.operators, store.confirmedTags, store.hardConstraints, professionFilter, rarityFilter, positionFilter, raceFilter]);

  const ALL_RACES = useMemo(() => {
    const races = new Set<string>();
    allOps.forEach((op) => { if (op.race) races.add(op.race); });
    return Array.from(races).sort();
  }, [allOps]);

  // 分享码
  const handleShareCode = () => {
    import('../engine/shareCode').then(({ encode }) => {
      const code = encode(store.confirmedTags, store.confirmedStage, store.softConstraints, allTags, allStages);
      setShareCode(code);
      navigator.clipboard?.writeText(code).catch(() => {});
    });
  };

  const handleImportCode = () => {
    import('../engine/shareCode').then(({ decode }) => {
      const result = decode(importCodeInput.trim(), allTags, allStages);
      if (!result) { setShareCode('无效'); return; }
      store.confirmTags(result.tagIds);
      setActiveTab(0);
      setImportCodeInput('');
    });
  };

  // 筛选按钮样式
  const filterBtnStyle = (active: boolean, accentColor?: string) => ({
    fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
    background: active ? (accentColor ? `${accentColor}22` : 'rgba(45,212,191,0.12)') : 'rgba(255,255,255,0.03)',
    border: `1px solid ${active ? (accentColor || '#2dd4bf') : 'rgba(255,255,255,0.08)'}`,
    color: active ? (accentColor || '#2dd4bf') : 'var(--text-muted)',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }}>
      {/* 顶部信息条 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
        background: 'rgba(13,17,23,0.98)', borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <span style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
          明日方舟自限挑战规则器
        </span>
        {onSwitchToDesktop && (
          <button onClick={onSwitchToDesktop} style={{
            fontSize: 12, padding: '3px 10px', borderRadius: 5,
            background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.3)',
            color: '#2dd4bf', cursor: 'pointer', whiteSpace: 'nowrap',
            fontWeight: 500,
          }}>
            💻 桌面
          </button>
        )}
      </div>

      {/* 内容区域 */}
      <div style={{ flex: 1, overflow: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', padding: '10px 14px 0' }}>

        {/* ========== Tab 0: 挑战（关卡 + 标签） ========== */}
        {activeTab === 0 && (
          <>
            {/* 关卡 */}
            <div style={{
              background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.2)',
              borderRadius: 12, padding: 12, textAlign: 'center', marginBottom: 10,
            }}>
            {/* 地图缩略图 */}
            {randomStage?.mapImage && (
              <div style={{
                width: '100%', aspectRatio: '16/9', overflow: 'hidden',
                borderRadius: 8, marginBottom: 6, background: '#0d1117',
              }}>
                <img src={randomStage.mapImage} alt={randomStage.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
              </div>
            )}
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                {randomStage ? randomStage.name : '点击抽取关卡'}
              </div>
              {randomStage && (
                <div style={{ marginBottom: 6 }} />
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleStageRandom} style={{
                  flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 12,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                  color: 'var(--text-muted)', cursor: 'pointer',
                }}>
                  🔁 抽关卡
                </button>
                <button onClick={() => setShowStageFilter(!showStageFilter)} style={{
                  flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 12,
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                  color: 'var(--text-muted)', cursor: 'pointer',
                }}>
                  🔍 类型筛选
                </button>
              </div>
              {showStageFilter && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                  {Object.entries(STAGE_TYPE_LABELS).map(([k, v]) => (
                    <span key={k} onClick={() => setStageFilterTypes((prev) => prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k])}
                      style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
                        background: stageFilterTypes.includes(k) ? 'rgba(45,212,191,0.12)' : 'transparent',
                        border: `1px solid ${stageFilterTypes.includes(k) ? '#2dd4bf' : 'rgba(255,255,255,0.1)'}`,
                        color: stageFilterTypes.includes(k) ? '#2dd4bf' : 'var(--text-muted)',
                      }}>
                      {v}
                    </span>
                  ))}
                </div>
              )}
              {randomStage && (
                <button onClick={() => store.confirmStage(randomStage.id)}
                  style={{ marginTop: 6, padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                    background: '#2dd4bf', color: '#0d1117', border: 'none', cursor: 'pointer' }}>
                  ✅ 确认关卡
                </button>
              )}
            </div>

            {/* 标签 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>🏷️ 挑战标签</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
                {tagMode === 'manual' ? `已选 ${selectedTagIds.length} 个` : ''}
              </span>
              {selectedTagIds.length > 0 && tagMode === 'manual' && (
                <button onClick={() => setSelectedTagIds([])} style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 4,
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 4,
                }}>一键清除</button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button onClick={() => setTagMode('manual')} style={{
                flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 12, fontWeight: 500,
                cursor: 'pointer',
                background: tagMode === 'manual' ? '#2dd4bf' : 'transparent',
                color: tagMode === 'manual' ? '#0d1117' : 'var(--text-muted)',
                border: tagMode === 'manual' ? 'none' : '1px solid rgba(45,212,191,0.3)',
              }}>😐 手动</button>
              <button onClick={() => { setTagMode('random'); if (randomTags.length === 0) handleRandomDraw(); }} style={{
                flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 12, fontWeight: 500,
                cursor: 'pointer',
                background: tagMode === 'random' ? '#2dd4bf' : 'transparent',
                color: tagMode === 'random' ? '#0d1117' : 'var(--text-muted)',
                border: tagMode === 'random' ? 'none' : '1px solid rgba(45,212,191,0.3)',
              }}>🎲 随机</button>
            </div>

            {tagMode === 'manual' ? (
              <div style={{ maxHeight: 360, overflow: 'auto', overscrollBehavior: 'contain', marginBottom: 10 }}>
                {Array.from(tagsByCategory).map(([cat, tags]) => (
                  <div key={cat} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 12, color: '#2dd4bf', fontWeight: 500, marginBottom: 4 }}>
                      {CATEGORY_LABELS[cat] || cat}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {tags.map((t) => {
                        const sel = selectedTagIds.includes(t.id);
                        return (
                          <span key={t.id} onClick={() => setSelectedTagIds((prev) => prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id])}
                            style={{
                              padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                              background: sel ? 'rgba(45,212,191,0.12)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${sel ? '#2dd4bf' : 'rgba(255,255,255,0.1)'}`,
                              color: sel ? '#2dd4bf' : 'var(--text-muted)',
                            }}>
                            {t.icon} {t.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.2)',
                borderRadius: 12, padding: 12, marginBottom: 10,
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                  🎲 {randomTags.length > 0 ? '本次挑战' : '点击抽取'}
                </div>
                {randomTags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                    {randomTags.map((t, i) => (
                      <span key={t.id} style={{
                        background: 'rgba(45,212,191,0.12)', border: '1px solid #2dd4bf',
                        borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#2dd4bf',
                      }}>
                        {t.icon} {t.name}
                        <span onClick={() => handleRerollTag(i)}
                          style={{ marginLeft: 6, cursor: 'pointer', opacity: 0.6 }}>↻</span>
                      </span>
                    ))}
                  </div>
                )}
                {randomTags.length === 0 && (
                  <button onClick={handleRandomDraw} style={{
                    width: '100%', padding: '6px 0', borderRadius: 6, fontSize: 12,
                    background: '#2dd4bf', color: '#0d1117', border: 'none', cursor: 'pointer',
                    fontWeight: 500,
                  }}>
                    🎲 一次性抽取
                  </button>
                )}
              </div>
            )}
            {selectedTagIds.length > 0 && tagMode === 'manual' && (
              <div style={{
                background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.2)',
                borderRadius: 10, padding: '8px 12px', marginBottom: 10,
                fontSize: 12, color: 'var(--text-muted)', maxHeight: 160, overflow: 'auto',
              }}>
                <div style={{ fontWeight: 500, color: '#2dd4bf', marginBottom: 6 }}>📜 规则说明</div>
                {allTags.filter((t) => selectedTagIds.includes(t.id)).map((t) => (
                  <div key={t.id} style={{ marginBottom: 6, lineHeight: 1.5, borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 4 }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{t.icon} {t.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}> — {t.detail}</span>
                  </div>
                ))}
              </div>
            )}
            {randomTags.length > 0 && tagMode === 'random' && (
              <div style={{
                background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.2)',
                borderRadius: 10, padding: '8px 12px', marginBottom: 10,
                fontSize: 12, color: 'var(--text-muted)', maxHeight: 160, overflow: 'auto',
              }}>
                <div style={{ fontWeight: 500, color: '#2dd4bf', marginBottom: 6 }}>📜 规则说明</div>
                {randomTags.map((t) => (
                  <div key={t.id} style={{ marginBottom: 6, lineHeight: 1.5, borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 4 }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{t.icon} {t.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}> — {t.detail}</span>
                  </div>
                ))}
              </div>
            )}

            <button onClick={handleConfirmTags} style={{
              width: '100%', padding: '9px 0', borderRadius: 8,
              background: '#2dd4bf', color: '#0d1117',
              fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer', marginBottom: 10,
            }}>
              ✅ 确认并前往编队
            </button>
          </>
        )}

        {/* ========== Tab 1: 编队 ========== */}
        {activeTab === 1 && (
          <>
            {/* 已确认的标签和关卡（从 Tab 0 带来） */}
            {store.confirmedTags.length > 0 && (() => {
              const confirmedTagObjects = allTags.filter((t) => store.confirmedTags.includes(t.id));
              const confirmedStageObj = allStages.find((s) => s.id === store.confirmedStage);
              const hasContent = confirmedTagObjects.length > 0 || !!confirmedStageObj;
              if (!hasContent) return null;
              return (
                <div style={{
                  background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.2)',
                  borderRadius: 10, padding: 10, marginBottom: 10,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#2dd4bf', marginBottom: 6 }}>
                    ⚡ 当前挑战
                  </div>
                  {/* 关卡信息 */}
                  {confirmedStageObj && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: confirmedTagObjects.length > 0 ? 8 : 0 }}>
                      {confirmedStageObj.mapImage && (
                        <div style={{
                          width: 80, aspectRatio: '16/9', borderRadius: 6, overflow: 'hidden',
                          background: '#0d1117', flexShrink: 0,
                        }}>
                          <img src={confirmedStageObj.mapImage} alt={confirmedStageObj.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            referrerPolicy="no-referrer" loading="lazy"
                          />
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {confirmedStageObj.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }} />
                      </div>
                    </div>
                  )}
                  {/* 已选标签 */}
                  {confirmedTagObjects.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {confirmedTagObjects.map((t) => (
                        <span key={t.id} style={{
                          padding: '3px 8px', borderRadius: 5, fontSize: 11,
                          background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.3)',
                          color: '#2dd4bf', fontWeight: 500,
                        }}>
                          {t.icon} {t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)' }}>
                👥 编队
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
                {store.squad.length}/12
              </span>
            </div>

            {/* 编队合规检测 — 编队12人上方 */}
            <div style={{ marginBottom: 8 }}>
              <button onClick={() => setShowViolations(!showViolations)} style={{
                width: '100%', padding: '6px 0', borderRadius: 8, fontSize: 12, fontWeight: 500,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                color: 'var(--text-muted)', cursor: 'pointer',
              }}>
                🔍 检测编队
                {squadValidationResult.violations.length > 0 && (
                  <span style={{ color: '#f97583', marginLeft: 6 }}>
                    ⚠️{squadValidationResult.violations.length}项违规
                  </span>
                )}
              </button>
              {showViolations && squadValidationResult.violations.length > 0 && (
                <div style={{
                  marginTop: 4, background: 'rgba(249,117,131,0.08)',
                  border: '1px solid rgba(249,117,131,0.3)', borderRadius: 8,
                  padding: '6px 10px', fontSize: 11, color: '#f97583',
                }}>
                  {squadValidationResult.violations.map((v, i) => <div key={i}>• {v}</div>)}
                </div>
              )}
              {showViolations && squadValidationResult.violations.length === 0 && (
                <div style={{
                  marginTop: 4, background: 'rgba(45,212,191,0.08)',
                  border: '1px solid var(--accent)', borderRadius: 8,
                  padding: '4px 10px', fontSize: 11, color: 'var(--text-accent)',
                }}>
                  ✅ 编队全部合规
                </div>
              )}
            </div>

            {/* 编队格子 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 10 }}>
              {Array.from({ length: 12 }).map((_, i) => {
                const op = store.squad[i];
                if (!op) return (
                  <div key={i} style={{
                    background: 'rgba(13,17,23,0.5)', border: '1px dashed rgba(48,54,80,0.4)',
                    borderRadius: 10, height: 80, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 18, color: 'rgba(48,54,80,0.4)',
                  }}>+</div>
                );
                return (
                  <div key={i} style={{
                    background: 'rgba(45,212,191,0.08)', border: '1px solid #2dd4bf',
                    borderRadius: 10, padding: '5px 3px', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 1, position: 'relative',
                  }}>
                    <div onClick={() => handleRemoveFromSquad(i)} style={{
                      position: 'absolute', top: -5, right: -5, width: 16, height: 16,
                      borderRadius: '50%', background: '#f97583', color: '#fff',
                      fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', zIndex: 2,
                    }}>✕</div>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', background: '#0d1117',
                      border: '1px solid rgba(45,212,191,0.2)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 14,
                    }}>
                      {op.avatar ? <img src={op.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} /> : '👤'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.2 }}>{op.name}</div>
                    <div style={{ fontSize: 7, color: RARITY_COLORS[op.rarity] || '#8b949e' }}>{'★'.repeat(op.rarity)}</div>
                    <div style={{ display: 'flex', gap: 4, fontSize: 8, color: 'var(--text-muted)' }}>
                      <span>🛡{op.block ?? '?'}</span>
                      <span>💰{op.cost ?? '?'}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 职业筛选 */}
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
              <span onClick={() => setProfessionFilter(null)}
                style={filterBtnStyle(!professionFilter)}>全职业</span>
              {PROFESSIONS.map((p) => (
                <span key={p} onClick={() => setProfessionFilter(professionFilter === p ? null : p)}
                  style={filterBtnStyle(professionFilter === p)}>{p}</span>
              ))}
            </div>

            {/* 星级筛选 */}
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
              <span onClick={() => setRarityFilter(null)}
                style={filterBtnStyle(rarityFilter === null)}>全星级</span>
              {[6, 5, 4, 3, 2, 1].map((r) => (
                <span key={r} onClick={() => setRarityFilter(rarityFilter === r ? null : r)}
                  style={filterBtnStyle(rarityFilter === r, RARITY_COLORS[r])}>{'★'.repeat(r)}</span>
              ))}
            </div>

            {/* 位置筛选 */}
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
              {['全部', '近战位', '远程位'].map((pos) => (
                <span key={pos} onClick={() => setPositionFilter(pos)}
                  style={filterBtnStyle(positionFilter === pos)}>{pos}</span>
              ))}
            </div>

            {/* 种族筛选 */}
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
              <span onClick={() => setRaceFilter(null)}
                style={filterBtnStyle(!raceFilter)}>全种族</span>
              {ALL_RACES.map((r) => (
                <span key={r} onClick={() => setRaceFilter(raceFilter === r ? null : r)}
                  style={filterBtnStyle(raceFilter === r)}>{r}</span>
              ))}
            </div>

            {/* 干员数量提示 */}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              显示 {filteredOps.length} / {allOps.length} 名干员
            </div>

            {/* 干员列表 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5, maxHeight: 240, overflow: 'auto', overscrollBehavior: 'contain', marginBottom: 8 }}>
              {filteredOps.map((op: any) => {
                const inSquad = store.squad.some((s: OperatorData) => s.name === op.name);
                const canAdd = op._valid && !inSquad;
                return (
                <div key={op.name}
                  onClick={() => { if (canAdd) handleAddToSquad(op); }}
                  style={{
                    background: inSquad ? 'rgba(45,212,191,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${inSquad ? '#2dd4bf' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 8, padding: 5, textAlign: 'center',
                    cursor: canAdd ? 'pointer' : 'default',
                    opacity: canAdd ? 1 : 0.4,
                  }}>
                  {/* 头像 */}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', margin: '0 auto 2px',
                    background: '#0d1117', overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    {op.avatar
                      ? <img src={op.avatar} alt="" style={{ width: 32, height: 32, objectFit: 'cover' }} />
                      : <span style={{ fontSize: 14, lineHeight: '32px' }}>👤</span>
                    }
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500, lineHeight: 1.2 }}>
                    {op.name.length > 4 ? op.name.slice(0, 4) + '…' : op.name}
                  </div>
                  <div style={{ fontSize: 8, color: RARITY_COLORS[op.rarity] || '#8b949e' }}>
                    {'★'.repeat(op.rarity)}
                  </div>
                  <div style={{ display: 'flex', gap: 3, justifyContent: 'center', fontSize: 8, color: 'var(--text-muted)' }}>
                    <span>🛡{op.block ?? '?'}</span>
                    <span>💰{op.cost ?? '?'}</span>
                  </div>
                </div>
              );
              })}
            </div>

            <button onClick={() => { setActiveTab(0); }}
              style={{ width: '100%', padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 500,
                background: '#2dd4bf', color: '#0d1117', border: 'none', cursor: 'pointer', marginBottom: 10 }}>
              ← 返回挑战
            </button>
          </>
        )}

        {/* ========== Tab 2: 设置 ========== */}
        {activeTab === 2 && (
          <>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 10 }}>
              ⚙️ 设置
            </div>

            {/* 章节黑名单 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, flex: 1 }}>
                  🗺️ 章节黑名单
                </span>
                {stageBlacklist.length > 0 && (
                  <button onClick={() => { setStageBlacklist([]); localStorage.setItem('ark_challenge_stage_blacklist', '[]'); }} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4,
                    background: 'transparent', border: '1px solid var(--border)',
                    color: 'var(--text-muted)', cursor: 'pointer',
                  }}>全部恢复</button>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {['第五章','第六章','第七章','第八章','第九章','第十章','第十一章','第十二章','第十三章','第十四章','第十五章','第十六章','第十七章'].map((ch) => {
                  const sel = stageBlacklist.includes(ch);
                  return (
                    <span key={ch} onClick={() => {
                      const next = sel ? stageBlacklist.filter((x) => x !== ch) : [...stageBlacklist, ch];
                      setStageBlacklist(next);
                      localStorage.setItem('ark_challenge_stage_blacklist', JSON.stringify(next));
                    }} style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                      background: sel ? 'rgba(249,117,131,0.1)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${sel ? '#f97583' : 'rgba(255,255,255,0.1)'}`,
                      color: sel ? '#f97583' : 'var(--text-muted)',
                    }}>
                      {ch}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* 标签黑名单 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, flex: 1 }}>
                  🏷️ 标签黑名单
                </span>
                {tagBlacklist.length > 0 && (
                  <button onClick={() => { setTagBlacklist([]); localStorage.setItem('ark_challenge_tag_blacklist', '[]'); }} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4,
                    background: 'transparent', border: '1px solid var(--border)',
                    color: 'var(--text-muted)', cursor: 'pointer',
                  }}>全部恢复</button>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 260, overflow: 'auto' }}>
                {Array.from(tagsByCategory).map(([cat, tags]) => (
                  <div key={cat} style={{ width: '100%', marginBottom: 4 }}>
                    <div style={{ fontSize: 11, color: '#2dd4bf', marginBottom: 2 }}>
                      {CATEGORY_LABELS[cat] || cat}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {tags.map((t) => {
                        const sel = tagBlacklist.includes(t.id);
                        return (
                          <span key={t.id} onClick={() => {
                            const next = sel ? tagBlacklist.filter((x) => x !== t.id) : [...tagBlacklist, t.id];
                            setTagBlacklist(next);
                            localStorage.setItem('ark_challenge_tag_blacklist', JSON.stringify(next));
                          }} style={{
                            padding: '2px 8px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
                            background: sel ? 'rgba(249,117,131,0.1)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${sel ? '#f97583' : 'rgba(255,255,255,0.08)'}`,
                            color: sel ? '#f97583' : 'var(--text-muted)',
                          }}>
                            {t.icon} {t.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 分享码 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 6 }}>
                🔗 分享码
              </div>
              <button onClick={handleShareCode} style={{
                width: '100%', padding: '7px 0', borderRadius: 8, fontSize: 13, fontWeight: 500,
                background: 'rgba(45,212,191,0.1)', border: '1px solid var(--accent)',
                color: 'var(--text-accent)', cursor: 'pointer', marginBottom: 6,
              }}>
                🔗 生成分享码
              </button>
              {shareCode && shareCode !== '无效' && (
                <div style={{
                  background: 'rgba(13,17,23,0.5)', borderRadius: 8, padding: '8px 10px',
                  fontSize: 11, color: 'var(--text-accent)', wordBreak: 'break-all', marginBottom: 6,
                }}>
                  {shareCode}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={importCodeInput} onChange={(e) => setImportCodeInput(e.target.value)}
                  placeholder="粘贴分享码..."
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 6, fontSize: 12,
                    background: 'var(--bg-input)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', outline: 'none',
                  }}
                />
                <button onClick={handleImportCode} style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                  background: '#2dd4bf', color: '#0d1117', border: 'none', cursor: 'pointer',
                }}>
                  导入
                </button>
              </div>
            </div>

            {/* 方案管理 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 6 }}>
                📦 我的方案
              </div>
              {store.plans.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>
                  暂无方案
                </div>
              ) : (
                store.plans.slice(0, 5).map((plan) => (
                  <div key={plan.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 10px', background: 'rgba(13,17,23,0.5)',
                    borderRadius: 8, border: '1px solid var(--border)', marginBottom: 4,
                  }}>
                    <button onClick={() => store.toggleFav(plan.id)} style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      fontSize: 16, color: plan.fav ? '#f0883e' : 'var(--border)', padding: 0,
                    }}>
                      {plan.fav ? '★' : '☆'}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {plan.name}
                      </div>
                    </div>
                    <button onClick={() => store.deletePlan(plan.id)} style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11,
                      background: 'rgba(249,117,131,0.1)', border: '1px solid #f97583',
                      color: '#f97583', cursor: 'pointer',
                    }}>
                      删除
                    </button>
                  </div>
                ))
              )}
            </div>

            <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.12)', marginTop: 16, marginBottom: 20 }}>
              v3.3 · {allOps.length}干员 · {allTags.length}标签
            </div>

            <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.08)', marginBottom: 24 }}>
              本程序素材美术版权全部属于鹰角网络
            </div>
          </>
        )}
      </div>

      {/* 底部导航 */}
      <div style={{
        display: 'flex', borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(13,17,23,0.95)', flexShrink: 0,
      }}>
        {[
          { icon: '🏷️', label: '挑战', tab: 0 },
          { icon: '👥', label: '编队', tab: 1 },
          { icon: '⚙️', label: '设置', tab: 2 },
        ].map(({ icon, label, tab }) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 2, padding: '8px 0 10px', border: 'none', background: 'transparent',
            cursor: 'pointer',
            color: activeTab === tab ? '#2dd4bf' : 'rgba(255,255,255,0.3)',
          }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span style={{ fontSize: 10, fontWeight: activeTab === tab ? 500 : 400 }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
