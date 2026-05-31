/**
 * 下载所有关卡地图预览图到本地 public/images/maps/
 * 避免 PRTS CDN 外链加载问题
 *
 * 用法：node scripts/download_maps.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const stagesPath = resolve(projectRoot, 'public/data/stages.json');
const mapDir = resolve(projectRoot, 'public/images/maps');

// 确保目录存在
if (!existsSync(mapDir)) {
  mkdirSync(mapDir, { recursive: true });
}

const stages = JSON.parse(readFileSync(stagesPath, 'utf-8'));
console.log(`共 ${stages.length} 个关卡，开始下载地图图片...\n`);

let success = 0;
let failed = 0;
let skipped = 0;

for (let i = 0; i < stages.length; i++) {
  const stage = stages[i];
  const remoteUrl = stage.mapImage;
  if (!remoteUrl) {
    skipped++;
    continue;
  }

  // 从 URL 提取文件名
  const fileName = remoteUrl.split('/').pop();
  const localPath = resolve(mapDir, fileName);
  const localUrl = `/images/maps/${fileName}`;

  // 检查是否已下载
  if (existsSync(localPath)) {
    stage.mapImage = localUrl;
    skipped++;
    process.stdout.write(`  ⏭️ [${i + 1}/${stages.length}] ${stage.name} 已存在\n`);
    continue;
  }

  try {
    const resp = await fetch(remoteUrl);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const buffer = Buffer.from(await resp.arrayBuffer());
    writeFileSync(localPath, buffer);
    stage.mapImage = localUrl;
    success++;
    process.stdout.write(`  ✅ [${i + 1}/${stages.length}] ${stage.name} → ${fileName} (${(buffer.length / 1024).toFixed(0)}KB)\n`);
  } catch (err) {
    failed++;
    process.stdout.write(`  ❌ [${i + 1}/${stages.length}] ${stage.name} 失败: ${err.message}\n`);
  }
}

// 写回 stages.json
writeFileSync(stagesPath, JSON.stringify(stages, null, 2), 'utf-8');
console.log(`\n===== 下载完成 =====`);
console.log(`✅ 成功: ${success}`);
console.log(`⏭️  跳过: ${skipped}`);
console.log(`❌ 失败: ${failed}`);
console.log(`✅ stages.json 已更新为本地路径`);
