# 项目长期记忆 — 明日方舟自限挑战规则器

## 基本信息

- **项目名**：明日方舟自限挑战规则器（Arknights Self-Limit Challenge Builder）
- **当前版本**：v3.3（标签系统+编队UI+方案管理+分享码已实现）
- **开发状态**：M3/M4/M5 核心功能已实现（2026-05-31）

## 技术栈

| 层 | 技术 |
|---|---|
| 构建 | Vite + TypeScript |
| UI | React + Tailwind CSS |
| 状态 | Zustand |
| 路由 | react-router-dom（自定义） |
| 数据验证 | Zod |
| 图标 | lucide-react |

## 核心决策汇总

| 决策 | 结论 |
|------|------|
| 交付形态 | 前端网页 → Electron exe（两阶段） |
| 数据更新 | 干员：PRTS Cargo API 一键更新；关卡：手动维护 JSON |
| 约束体系 | 硬约束（工具验证）+ 软约束（声明自律）双轨 |
| 标签数据 | 外置 `public/data/tags.json`，免动代码 |
| 关卡数据 | 外置 `public/data/stages.json`，手动维护（110关已分类+图片已本地下载） |
| 分享码 | 位掩码64bit，约15字符（AKRL:前缀+Base64URL） |
| 干员头像 | N/A，用职业名称+中文名 |
| 账号系统 | 纯本地 localStorage |
| UI风格 | 仿游戏深色主题 + 赛博工业风背景（ak.hypergryph.com风格） |
| 精英化 | 不可逆，费用验证统一用精二值，不提供限制精英化选项 |

## 关键数据接口

```
PRTS Cargo API: https://prts.wiki/api.php?action=cargoquery
表: chara JOIN chara_data ON _pageName
关键字段: cn, charId, rarity, profession, subProfession, position, 
          nation, team, cost, block, reDeploy
```

## 分享码位布局（64bit）

```
字节0: [版本:4bit]    [标签0-3:4bit]
字节1: [标签4-11:8bit]
字节2: [标签12-19:8bit]
字节3: [标签20-27:8bit]
字节4: [标签28:1bit]  [预留:7bit]
字节5: [软约束+覆盖标记:8bit]
字节6-7: [关卡索引:16bit]  (0xFFFF=无关卡)
```

## 待办事项

1. **关卡分类表**：`docs/关卡分类表.md` 中约296关的 type 字段待用户填写
2. **M6 发布**：PWA + 部署
3. **数据补全**：干员面板 cost/reDeploy 字段待补充
4. **不开技能标签**：需要从PRTS提取技能类型数据
5. **stages.json**：关卡数据110关已完善分类+地图图片已本地下载
6. **UI背景重设计**：多层赛博工业风背景已完成（CRT扫描线+战术网格+多光源辉光+HUD角标+噪点纹理）
