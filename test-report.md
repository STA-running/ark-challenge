# 测试报告 — 十连抽卡功能

> 测试时间: 2026-06-04 | 测试环境: http://localhost:4173 | 测试方法: 代码审查 + 浏览器自动化测试

---

## 一、严重 Bug（阻塞级）

### #1 抽卡池受手动筛选条件污染（gachaPool 使用了手动筛选器）

| 项目 | 内容 |
|------|------|
| **源文件** | `src/pages/SquadPage.tsx` 第 338–355 行 |
| **严重程度** | 🔴 阻塞 |
| **复现步骤** | 1. 手动模式下设置筛选（如职业=近卫）2. 切换到抽卡模式 3. 观察合法池人数 |
| **实测结果** | 初始池 420 人 → 切换近卫筛选 → 手动模式 → 切回抽卡 → 合法池变为 80 人（仅近卫） |
| **预期结果** | 抽卡池不应受手动筛选影响，应始终使用标签约束（或无标签时全池） |
| **根因** | `gachaPool` useMemo 中应用了 `professionFilter` / `rarityFilter` / `positionFilter` / `raceFilter`，这些 state 在切换到抽卡模式时未重置 |
| **影响** | 用户在手动模式操作筛选后，抽卡结果被意外限制，可能导致困惑甚至无法抽出目标干员 |

**修复建议:**
```tsx
// gachaPool 应移除手动筛选条件，仅保留标签约束和已锁定排除
const gachaPool = useMemo(() => {
    let ops = allOps;
    if (store.confirmedTags.length > 0) {
      const validNames = new Set(
        filterOperatorsByHardConstraints(store.operators, store.hardConstraints)
          .map((o: OperatorData) => o.name)
      );
      ops = ops.filter(o => validNames.has(o.name));
    }
    // 移除以下四行：不应在 gachaPool 中应用手动筛选
    // if (professionFilter) ops = ops.filter(...)
    // if (rarityFilter !== null) ops = ops.filter(...)
    // if (positionFilter !== '全部') ops = ops.filter(...)
    // if (raceFilter) ops = ops.filter(...)
    const lockedNames = new Set(gachaLocked.map(o => o.name));
    return ops.filter(o => !lockedNames.has(o.name));
}, [allOps, store.confirmedTags, store.hardConstraints, gachaLocked]);
```

---

### #2 抽卡锁定区双击加入编队跳过了标签约束检查

| 项目 | 内容 |
|------|------|
| **源文件** | `src/pages/SquadPage.tsx` 第 970–972 行 |
| **严重程度** | 🔴 阻塞 |
| **复现步骤** | 1. 确认标签「🐱 菲林」（仅允许菲林种族）2. 抽卡 → 锁定一轮（含非菲林干员）3. 双击非菲林干员加入编队 |
| **实测结果** | 非菲林干员「百炼嘉维尔」(阿达克利斯) 成功加入编队，检测编队后显示违规：`种族"阿达克利斯"不在允许列表中` |
| **预期结果** | 锁定区的双击应与手动模式一致，先检查 `op._valid` 再允许加入 |
| **根因** | 手动模式 double-click 有 `if (op._valid && !inSquad)` 检查（第 789 行），但锁定区只有 `if (!inSquad)`（第 972 行），缺少 `op._valid` 检查 |

**修复建议:**
```tsx
// 第 972 行，修改为：
onDoubleClick={() => { 
  // 需要先计算该 op 在锁定区是否满足约束
  // 方案A：在 gachaLocked 存入时附带 _valid 标记
  // 方案B：双击时实时调用 validateOperator
  if (!inSquad && op._valid !== false) handleAddToSquad(op); 
}}
```
注意：`gachaLocked` 中的 operator 是原始 `OperatorData`，没有 `_valid` 属性。建议在锁定操作时重新计算约束合规性，或在 `gachaLocked` 区域渲染时也使用 `filteredOps` 逻辑。

---

## 二、中等 Bug（功能缺陷）

### #3 `ringSpin` CSS 动画缺失，DRIVE 按钮外圈无旋转效果

| 项目 | 内容 |
|------|------|
| **源文件** | `src/pages/SquadPage.tsx` 第 904–905 行 + `src/index.css` |
| **严重程度** | 🟡 中等 |
| **复现步骤** | 切换抽卡模式，观察 DRIVE 按钮外圈 |
| **实测结果** | 外圈（菱形边框）静止不动，浏览器控制台无报错但动画不生效 |
| **预期结果** | 外圈以 `ringSpin 4s linear infinite` 持续旋转，内圈以 `ringSpin 6s linear infinite reverse` 反向旋转 |
| **根因** | `SquadPage.tsx` 引用了 `animation: 'ringSpin 4s linear infinite'`，但 `src/index.css` 中仅定义了 `@keyframes flipIn`，缺少 `@keyframes ringSpin` |

**修复建议:** 在 `src/index.css` 的 `/* ========== 十连抽卡动效 ========== */` 区块添加：
```css
@keyframes ringSpin {
  0%   { transform: translate(-50%, -50%) rotate(45deg); }
  100% { transform: translate(-50%, -50%) rotate(405deg); }
}
```

---

### #4 概率说明弹窗未标注 6★ 池为空的边界情况

| 项目 | 内容 |
|------|------|
| **源文件** | `src/pages/SquadPage.tsx` 第 369 行 + 第 1020–1052 行 |
| **严重程度** | 🟡 中等（文档/UI 不一致） |
| **说明** | 代码第 369 行 `usable.some(o => o.rarity === 6) && Math.random() < 0.50` — 第 10 抽 50% 锁定 6★ 的前提是**池中存在至少一名 6★ 干员**。如果标签约束导致池中无 6★（例如标签「限 1★~5★」），第 10 抽的 6★ 概率退化为普通 10%。但弹窗始终显示 55%，未标注此前提条件 |
| **影响** | 用户可能困惑为何第 10 抽永远不出 6★ |

**修复建议:** 在概率表下方添加说明：`* 第10抽55%前提为卡池中存在6★干员，否则退化为10%`

---

## 三、轻微问题（体验优化）

### #5 「重新选择」按钮未清空本地标签选中状态

| 项目 | 内容 |
|------|------|
| **源文件** | `src/pages/SquadPage.tsx` 第 441 行 |
| **说明** | 点击「重新选择」调用 `store.confirmTags([])` 但不调用 `setSelectedTagIds([])` / `setRandomTags([])`。导致标签面板中的 checkbox 仍保持选中状态，`pendingTagObjects` 仍显示未确认的标签 |
| **影响** | 用户可能以为标签已被清除，实际仍需手动取消勾选 |

**修复建议:** `onClick` 中添加 `setSelectedTagIds([]); setRandomTags([]);`

---

### #6 手动筛选状态切换模式后无视觉反馈

| 项目 | 内容 |
|------|------|
| **说明** | 在手动模式设置了职业/星级/位置/种族筛选后切换到抽卡模式，筛选器 UI 隐藏但 state 仍保留（这本身是 #1 的根因）。即使修复 #1 后，切换回手动模式时之前的筛选状态仍存在，用户可能忘记之前的筛选条件 |
| **建议** | 切换模式时考虑重置筛选条件，或在手动模式筛选栏显示当前有效筛选的数量徽标 |

---

## 四、通过项 ✅

以下功能点经过代码审查 + 浏览器测试，验证通过：

| # | 功能点 | 验证方式 |
|---|--------|----------|
| 1 | 模式切换按钮「✋ 手动」/「🎰 抽卡」正常切换 | 浏览器点击测试 ✅ |
| 2 | 未确认标签时抽卡池 = 全部干员 (420) | 浏览器验证：合法池 420 人 ✅ |
| 3 | 确认标签后抽卡池只含标签约束干员 | 浏览器验证：菲林标签 → 合法池 59 人 ✅ |
| 4 | 已锁定干员从后续抽卡池排除 | 浏览器验证：420 → 410 → 下一轮前排除 ✅ |
| 5 | 十连产生 10 个不同干员（无重复） | 代码审查：`taken` Set 排除重复 ✅ |
| 6 | 第 10 抽有 50% 概率为 6★（前提有 6★ 在池） | 代码审查：`idx===9 && Math.random()<0.50` ✅ |
| 7 | 各星级概率分布合理（6★:10%, 5★:20%, 4★:60%, 3★:10%） | 代码审查：概率表与实现一致 ✅ |
| 8 | 轮数上限 3 轮正常工作 | 代码审查：`gachaMaxBatches = 3` + `gachaBatch >= gachaMaxBatches` 保护 ✅ |
| 9 | 重抽次数上限 10 次，用完后按钮禁用 | 代码审查：`gachaRerolls <= 0` 禁用 ✅ |
| 10 | 第 3 轮锁定后显示「十连结束」 | 代码审查：`gachaStage === 'done'` 渲染 ✅ |
| 11 | 重抽后回到 DRIVE 触发状态 | 浏览器验证：点击「🔄 不要」→ 回到 trigger 状态 ✅ |
| 12 | 重抽次数正确递减 | 浏览器验证：第 1 次重抽后显示「放弃剩余 9 次」✅ |
| 13 | 锁定后重抽次数重置 | 代码审查：`setGachaRerolls(gachaMaxRerolls)` ✅ |
| 14 | 编队检测功能正常（检测到违规会显示） | 浏览器验证：违规检测显示"⚠️ 1项违规" ✅ |
| 15 | 卡牌翻转动画 `flipIn` CSS 定义存在 | 代码审查：`index.css` 第 388–391 行 ✅ |
| 16 | 抽卡池为空时 DRIVE 按钮受保护 | 代码审查：`gachaPool.length === 0` 时 `handleGachaPull` 直接 return ✅ |
| 17 | 池子不足 10 人时正确截断 | 代码审查：`Math.min(10, gachaPool.length)` ✅ |
| 18 | 抽卡模式下抽卡中再次点击不响应 | 代码审查：`gachaPulling` 状态保护 ✅ |
| 19 | 模式切换不丢失已锁定干员 | 代码审查：`gachaLocked` 为独立 state，不受 `selectionMode` 影响 ✅ |
| 20 | 手动模式功能未受影响（筛选/双击/详情） | 浏览器验证：切换回手动模式后筛选器和干员列表正常 ✅ |
| 21 | ℹ 信息按钮弹窗存在且内容完整 | 代码审查：概率表、使用方式、提示完整 ✅ |
| 22 | 概率表第 10 抽有效概率计算正确 | 代码分析：55% = 50% + 50%×10% ✅ |

---

## 五、总结

| 分类 | 数量 |
|------|------|
| 🔴 严重 Bug | 2 |
| 🟡 中等 Bug | 2 |
| 🔵 轻微问题 | 2 |
| ✅ 通过项 | 22 |

**核心结论:** 十连抽卡功能的主体逻辑（概率系统、锁定/重抽流程、轮次控制、池约束）设计正确、实现合理。两个严重 Bug（筛选污染 + 约束检查缺失）虽影响特定场景下的正确性，但修复成本低、改动范围小。建议在修复 #1 和 #2 后即可上线。
