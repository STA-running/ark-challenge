import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';
import { loadTags } from '../engine/tagEngine';
import type { ChallengeTag, StageData, OperatorData } from '../types';

const CATEGORY_LABELS: Record<string, string> = {
  squad: '编队', rarity: '稀有度', cost: '费用', position: '位置',
  operation: '操作', special: '特殊', faction: '阵营', race: '种族', block: '阻挡数', other: '其他',
};

export default function SettingsPage() {
  const store = useAppStore();

  const [allTags, setAllTags] = useState<ChallengeTag[]>([]);
  const [allStages, setAllStages] = useState<StageData[]>([]);

  const [tagBlacklist, setTagBlacklist] = useState<string[]>([]);
  const [stageBlacklist, setStageBlacklist] = useState<string[]>([]);

  const [devMode, setDevMode] = useState(false);
  const clickCount = [0];

  // 卡池黑名单筛选
  const [allOperators, setAllOperators] = useState<OperatorData[]>([]);
  const [blProfessionFilter, setBlProfessionFilter] = useState<string | null>(null);
  const [blRarityFilter, setBlRarityFilter] = useState<number | null>(null);

  const PROFESSIONS = ['先锋', '近卫', '重装', '狙击', '术师', '医疗', '辅助', '特种'];
  const RARITIES = [6, 5, 4, 3, 2, 1];
  const RARITY_COLORS: Record<number, string> = { 6: '#ff6b4a', 5: '#e8c560', 4: '#7eb8da', 3: '#6b7c8e', 2: '#7eb8da', 1: '#6b7c8e' };

  useEffect(() => {
    loadTags().then(setAllTags).catch(console.error);
    fetch('/data/stages.json')
      .then((r) => r.json())
      .then(setAllStages)
      .catch(console.error);
    fetch('/data/operators.json')
      .then((r) => r.json())
      .then((d) => setAllOperators(Object.values(d.operators) as OperatorData[]))
      .catch(console.error);
    store.loadGachaBlacklist();
  }, []);

  useEffect(() => {
    try { const raw = localStorage.getItem('ark_challenge_tag_blacklist'); if (raw) setTagBlacklist(JSON.parse(raw)); } catch {}
    try { const raw = localStorage.getItem('ark_challenge_stage_blacklist'); if (raw) setStageBlacklist(JSON.parse(raw)); } catch {}
  }, []);

  const persistTagBlacklist = useCallback((list: string[]) => {
    setTagBlacklist(list);
    localStorage.setItem('ark_challenge_tag_blacklist', JSON.stringify(list));
  }, []);

  const persistStageBlacklist = useCallback((list: string[]) => {
    setStageBlacklist(list);
    localStorage.setItem('ark_challenge_stage_blacklist', JSON.stringify(list));
  }, []);

  const toggleTagBlacklist = useCallback((tagId: string) => {
    persistTagBlacklist(
      tagBlacklist.includes(tagId)
        ? tagBlacklist.filter((id) => id !== tagId)
        : [...tagBlacklist, tagId]
    );
  }, [tagBlacklist, persistTagBlacklist]);

  const stagesByChapter = useMemo(() => {
    const map = new Map<string, StageData[]>();
    allStages.forEach((s) => {
      const ch = s.chapter || '其他';
      if (!map.has(ch)) map.set(ch, []);
      map.get(ch)!.push(s);
    });
    return Array.from(map.entries());
  }, [allStages]);

  const toggleChapterBlacklist = useCallback((chapter: string) => {
    if (stageBlacklist.includes(chapter)) {
      persistStageBlacklist(stageBlacklist.filter((c) => c !== chapter));
    } else {
      persistStageBlacklist([...stageBlacklist, chapter]);
    }
  }, [stageBlacklist, persistStageBlacklist]);

  const toggleDev = () => {
    clickCount[0]++;
    if (clickCount[0] >= 3) { setDevMode(!devMode); clickCount[0] = 0; }
  };

  const filterChipStyle = (active: boolean): React.CSSProperties => ({
    padding: '3px 8px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
    background: active ? 'rgba(45,212,191,0.15)' : 'transparent',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    color: active ? 'var(--text-accent)' : 'var(--text-muted)',
    fontWeight: active ? 600 : 400,
  });

  return (
    <div>
      {/* 🏷️ 标签黑名单 */}
      <div className="setting-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h3>🏷️ 标签黑名单</h3>
          <button onClick={() => persistTagBlacklist([])} className="btn-secondary" style={{ fontSize: 13 }}>
            全部恢复
          </button>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 10 }}>
          被拉黑的标签不会出现在标签列表中。
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
          {(['squad', 'rarity', 'cost', 'position', 'operation', 'special', 'faction', 'race', 'block', 'other'] as const).map((cat) => {
            const catTags = allTags.filter((t) => t.category === cat);
            if (catTags.length === 0) return null;
            return (
              <div key={cat} style={{ width: '100%', marginBottom: 6 }}>
                <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 3, fontWeight: 500 }}>
                  {CATEGORY_LABELS[cat]}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {catTags.map((tag) => (
                    <label key={tag.id} style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '3px 8px', borderRadius: 6, fontSize: 14,
                      background: tagBlacklist.includes(tag.id) ? 'rgba(249,117,131,0.1)' : 'transparent',
                      border: `1px solid ${tagBlacklist.includes(tag.id) ? '#f97583' : 'var(--border)'}`,
                      cursor: 'pointer',
                      color: tagBlacklist.includes(tag.id) ? '#f97583' : 'var(--text-secondary)',
                      userSelect: 'none',
                    }}>
                      <input type="checkbox"
                        checked={tagBlacklist.includes(tag.id)}
                        onChange={() => toggleTagBlacklist(tag.id)}
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
      </div>

      {/* 🗺️ 关卡黑名单 */}
      <div className="setting-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h3>🗺️ 关卡黑名单（按章节）</h3>
          <button onClick={() => persistStageBlacklist([])} className="btn-secondary" style={{ fontSize: 13 }}>
            全部恢复
          </button>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 10 }}>
          隐藏章节的关卡不参与随机关卡抽取。前四章关卡已永久排除。
        </p>

        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {stagesByChapter
            .filter(([chapter]) => !['第一章', '第二章', '第三章', '第四章'].includes(chapter))
            .map(([chapter, stages]) => (
            <div key={chapter} style={{ marginBottom: 8 }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 6,
                cursor: 'pointer', fontSize: 15, fontWeight: 500,
                color: stageBlacklist.includes(chapter) ? '#f97583' : 'var(--text-primary)',
                marginBottom: 4,
              }}>
                <input type="checkbox"
                  checked={stageBlacklist.includes(chapter)}
                  onChange={() => toggleChapterBlacklist(chapter)}
                  style={{ accentColor: '#2dd4bf', width: 14, height: 14 }}
                />
                {chapter}（{stages.length}关）
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginLeft: 24 }}>
                {stages.map((s) => (
                  <span key={s.id} style={{
                    fontSize: 13, padding: '2px 6px', borderRadius: 4,
                    background: 'var(--bg-input)', border: '1px solid var(--border-light)',
                    color: stageBlacklist.includes(chapter) ? '#6b7280' : 'var(--text-muted)',
                  }}>
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 🎰 卡池干员黑名单 */}
      <div className="setting-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h3>🎰 卡池干员黑名单</h3>
          <button onClick={() => store.clearGachaBlacklist()} className="btn-secondary" style={{ fontSize: 13 }}>
            全部恢复
          </button>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 10 }}>
          被拉黑的干员不会出现在十连抽卡池中（手动模式不受影响）。
        </p>

        {/* 已拉黑列表 */}
        {store.gachaBlacklist.length > 0 && (
          <div style={{
            background: 'rgba(249,117,131,0.06)', border: '1px solid rgba(249,117,131,0.2)',
            borderRadius: 8, padding: 10, marginBottom: 10,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#f97583', marginBottom: 6 }}>
              🚫 已拉黑 · {store.gachaBlacklist.length} 名
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {store.gachaBlacklist.map((name) => {
                const op = allOperators.find(o => o.name === name);
                return (
                  <span key={name} onClick={() => store.toggleGachaBlacklist(name)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      padding: '3px 8px', borderRadius: 6, fontSize: 13,
                      background: 'rgba(249,117,131,0.12)',
                      border: '1px solid rgba(249,117,131,0.3)',
                      color: '#f97583', cursor: 'pointer',
                    }}>
                    {op ? <span style={{ color: RARITY_COLORS[op.rarity] || '#8b949e', fontWeight: 600 }}>{op.rarity}★</span> : null}
                    {name}
                    <span style={{ fontSize: 11, marginLeft: 2 }}>✕</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* 筛选栏 */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', marginRight: 4 }}>职业：</span>
            <span onClick={() => setBlProfessionFilter(null)}
              style={filterChipStyle(!blProfessionFilter)}>全部</span>
            {PROFESSIONS.map(p => (
              <span key={p} onClick={() => setBlProfessionFilter(blProfessionFilter === p ? null : p)}
                style={filterChipStyle(blProfessionFilter === p)}>{p}</span>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', marginRight: 4 }}>星级：</span>
            <span onClick={() => setBlRarityFilter(null)}
              style={filterChipStyle(!blRarityFilter)}>全部</span>
            {RARITIES.map(r => (
              <span key={r} onClick={() => setBlRarityFilter(blRarityFilter === r ? null : r)}
                style={filterChipStyle(blRarityFilter === r)}>{r}★</span>
            ))}
          </div>
        </div>

        {/* 干员列表 */}
        <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {allOperators
            .filter(o => !blProfessionFilter || o.profession === blProfessionFilter)
            .filter(o => blRarityFilter === null || o.rarity === blRarityFilter)
            .sort((a, b) => b.rarity - a.rarity)
            .map(op => {
              const isBlacklisted = store.gachaBlacklist.includes(op.name);
              return (
                <span key={op.name} onClick={() => store.toggleGachaBlacklist(op.name)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 2,
                    padding: '3px 8px', borderRadius: 6, fontSize: 13,
                    cursor: 'pointer',
                    background: isBlacklisted ? 'rgba(249,117,131,0.1)' : 'transparent',
                    border: `1px solid ${isBlacklisted ? '#f97583' : 'var(--border)'}`,
                    color: isBlacklisted ? '#f97583' : 'var(--text-secondary)',
                  }}>
                  <span style={{ color: RARITY_COLORS[op.rarity] || '#8b949e', fontWeight: 600, marginRight: 2 }}>
                    {op.rarity}★
                  </span>
                  {op.name}
                </span>
              );
            })}
        </div>
      </div>

      {/* 📋 方案管理 */}
      <div className="setting-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h3>📋 方案管理</h3>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 10 }}>
          管理你的挑战方案。
        </p>

        {store.plans.length === 0 ? (
          <div style={{ fontSize: 15, color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>
            暂无已保存的方案
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 420, overflowY: 'auto' }}>
            {store.plans.map((plan) => (
              <div key={plan.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 12px', background: 'rgba(13,17,23,0.5)',
                borderRadius: 8, border: '1px solid var(--border)',
              }}>
                <button onClick={() => store.toggleFav(plan.id)}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontSize: 18, color: plan.fav ? '#f0883e' : 'var(--border)', padding: 0, flexShrink: 0,
                  }}>
                  {plan.fav ? '★' : '☆'}
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {plan.name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                    {plan.squad.length}名干员 · {plan.createdAt}
                    {plan.tags.length > 0 && ` · ${plan.tags.length}个标签`}
                  </div>
                </div>

                <button onClick={() => {
                  store.confirmTags(plan.tags);
                  if (plan.stage) store.confirmStage(plan.stage);
                  store.setHardConstraints(plan.hardConstraints);
                  store.setSoftConstraints(plan.softConstraints);
                }} title="加载方案"
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                    background: 'rgba(45,212,191,0.1)', border: '1px solid var(--accent)',
                    color: 'var(--text-accent)', cursor: 'pointer', flexShrink: 0,
                  }}>
                  加载
                </button>

                <button onClick={() => store.deletePlan(plan.id)} title="删除"
                  style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 13, fontWeight: 500,
                    background: 'rgba(249,117,131,0.1)', border: '1px solid #f97583',
                    color: '#f97583', cursor: 'pointer', flexShrink: 0,
                  }}>
                  删除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 开发者模式 */}
      <div className="setting-section" style={{ display: devMode ? 'block' : 'none' }}>
        <h3>🔄 数据更新</h3>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>
          上次更新：2026-05-31 | 417名干员
        </p>
        <button onClick={() => {
          alert('数据更新功能：从 PRTS 抓取最新干员数据。\n此功能为演示占位，实际需后端 API 支持。');
        }}
          style={{
            padding: '7px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500,
            border: '1px solid var(--accent)', background: 'var(--accent-bg)',
            color: 'var(--text-accent)', cursor: 'pointer',
          }}>
          更新数据（2次API）
        </button>

        <div style={{
          marginTop: 10, fontSize: 14, color: 'var(--text-secondary)',
          padding: '10px 12px', background: 'rgba(13,17,23,0.5)', borderRadius: 8,
          border: '1px solid var(--border-light)',
        }}>
          <div>版本: 3.3</div>
          <div>干员总数: 417</div>
          <div>标签总数: {allTags.length}</div>
          <div>关卡总数: {allStages.length}</div>
        </div>
      </div>

      {/* 版本号点击 */}
      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <span onClick={toggleDev}
          style={{ fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer', letterSpacing: '1px' }}>
          v3.3-dev {devMode ? '🔧' : ''}
        </span>
      </div>
    </div>
  );
}
