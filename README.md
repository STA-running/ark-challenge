# 明日方舟自限挑战规则器

> Arknights Self-Limit Challenge Builder — 构建你的个性化挑战方案

---

## 🚀 在线使用

| 平台 | 地址 |
|------|------|
| 🇨🇳 腾讯云 | https://ark-challenge-d8gfpl2vg7a303d46-1438716144.tcloudbaseapp.com |
| 🌍 Vercel | https://ark-challenge.vercel.app |

## ✨ 功能

- **挑战标签系统** — 40 个标签，覆盖编队人数、职业限制、稀有度、费用、种族等 9 大分类
- **手动/随机双模式** — 手动挑选标签组合，或一键随机抽取挑战方案
- **干员编队构建** — 浏览全部 417 名干员，双击加入编队，直观查看头像/星级/阻挡数/费用
- **关卡随机抽取** — 内置 110 关主线+H关，支持按类型筛选和章节黑名单
- **智能约束校验** — 点「检测编队」一键验证编队是否合规，详细列出违规项
- **方案管理** — 保存/加载/收藏挑战方案，一键复用
- **分享码** — 64bit 位掩码编码，分享给好友直接导入挑战配置
- **仿游戏深色主题** — 参考 `ak.hypergryph.com` 设计，赛博工业风背景

## 🛠 技术栈

| 层 | 技术 |
|---|---|
| 构建工具 | Vite |
| 前端框架 | React + TypeScript |
| 样式 | Tailwind CSS + 自定义 CSS |
| 状态管理 | Zustand |
| 数据验证 | Zod |
| 数据来源 | PRTS Wiki API（干员数据）+ 手动维护（关卡） |

## 📁 项目结构

```
ark-challenge/
├── public/
│   ├── data/              ← 标签/关卡/干员 JSON 数据
│   │   ├── tags.json       # 40 个挑战标签
│   │   ├── stages.json     # 110 个关卡
│   │   └── operators.json  # 417 名干员（含费用/种族/职业等）
│   └── images/maps/        # 关卡地图预览图（本地缓存）
├── src/
│   ├── engine/             # 核心逻辑
│   │   ├── tagEngine.ts    # 标签加载/随机/合并
│   │   ├── validator.ts    # 约束校验引擎
│   │   └── shareCode.ts    # 分享码编解码
│   ├── pages/
│   │   ├── SquadPage.tsx   # 主页面：编队 + 标签 + 关卡
│   │   └── SettingsPage.tsx # 设置：黑名单 + 方案管理
│   ├── stores/
│   │   └── appStore.ts     # Zustand 全局状态
│   └── types/
│       └── index.ts        # TypeScript 类型定义
├── scripts/                # 数据构建脚本
│   ├── build_operators.py  # 从 PRTS 抓取干员数据
│   ├── fetch_cost.mjs      # 从 PRTS 提取部署费用
│   └── download_maps.mjs   # 下载关卡地图
└── dist/                   # 构建产物（部署用）
```

## 🔧 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 更新干员数据（从 PRTS Wiki）
python scripts/build_operators.py
```

## 📦 部署

### 腾讯云 CloudBase（国内高速）

```bash
npm run build
tcb hosting deploy dist/ -e <环境ID>
```

### Vercel（海外）

```bash
npx vercel --prod
```

## 📝 标签管理

编辑 `public/data/tags.json`，刷新即可生效，无需改代码：

```json
{
  "id": "unique_id",
  "name": "标签名",
  "icon": "🔥",
  "category": "squad",
  "detail": "详细规则说明...",
  "hardConstraints": { "maxSquadSize": 4 },
  "softConstraints": {}
}
```

## ⚠️ 版权声明

本程序所有素材版权归**鹰角网络**所有。干员数据来源于 PRTS Wiki，仅供学习交流使用。

## 📄 License

MIT
