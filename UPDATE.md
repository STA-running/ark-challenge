# 数据更新指南

明日方舟游戏更新后，按以下步骤更新本地数据并部署上线。

---

## 三步更新

### 第一步：更新干员数据

```cmd
cd F:\ark-challenge\scripts
python build_operators.py --mode=quick
```

> 约 20~30 秒，从 PRTS Wiki 抓取新干员。Quick 模式只拉增量，很快。

### 第二步：更新部署费用

```cmd
cd F:\ark-challenge
node scripts/fetch_cost.mjs
```

> 约 30 秒，从 PRTS 干员页面提取部署费用。420 人大概跑 9 批请求。

### 第三步：构建并部署

```cmd
npm run build
C:\Users\sta\.workbuddy\binaries\node\versions\22.22.2\tcb.cmd hosting deploy dist/ -e ark-challenge-d8gfpl2vg7a303d46
```

> 如果上传超时，加上 `--skip-exists` 跳过已有文件。

---

## 完整指令（直接复制粘贴）

```cmd
cd F:\ark-challenge\scripts && python build_operators.py --mode=quick && cd F:\ark-challenge && node scripts/fetch_cost.mjs && npm run build && C:\Users\sta\.workbuddy\binaries\node\versions\22.22.2\tcb.cmd hosting deploy dist/ -e ark-challenge-d8gfpl2vg7a303d46 --skip-exists
```

---

## 环境信息

| 项目 | 值 |
|------|-----|
| Python | `C:\Users\sta\.workbuddy\binaries\python\versions\3.13.12\python.exe` |
| Node.js | `C:\Users\sta\.workbuddy\binaries\node\versions\22.22.2\node.exe` |
| TCB CLI | `C:\Users\sta\.workbuddy\binaries\node\versions\22.22.2\tcb.cmd` |
| 腾讯云环境 | `ark-challenge-d8gfpl2vg7a303d46` |
| 网页地址 | `https://ark-challenge-d8gfpl2vg7a303d46-1438716144.tcloudbaseapp.com` |

---

## 单独部署到 Vercel（海外）

```cmd
C:\Users\sta\.workbuddy\binaries\node\versions\22.22.2\vercel.cmd --prod
```

---

## 手动添加关卡

编辑 `public/data/stages.json` 添加新关卡，构建部署即可。关卡地图图片放入 `public/images/maps/`。

---

## 上次更新

- **日期**：2026-06-01
- **版本**：v3.3
- **干员数**：420
- **标签数**：40
- **关卡数**：110

### v3.3 更新内容

- 修复：标签黑名单功能失效（SquadPage 未读取 localStorage）
- 修复：一键清理标签不再跳转到随机模式
- 修复：关卡黑名单排除前四章
- 修复：职业图标 PRTS 图片全挂了（改用内联 SVG）
- 新增：编队≤6、编队≤8 标签
- 新增：检测编队按钮（点击显示全部违规项）
- 新增：部署费用数据全部补全（420人）
- 新增：干员编队卡片显示阻挡数和费用
- 优化：地图图片压缩 94MB→10MB
- 优化：种族筛选分类（主力种族 + 其他 19种）
- 数据：干员 417→420 人
