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
- **干员数**：420
- **标签数**：40
- **关卡数**：110
