/**
 * 修复下载失败的地图图片URL并重新下载
 * 
 * 已知问题：
 * 1. H关图片使用 hard_ 前缀而非 h_
 * 2. 部分主线关卡的内部ID与显示编号不同
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const stagesPath = resolve(projectRoot, 'public/data/stages.json');
const mapDir = resolve(projectRoot, 'public/images/maps');
if (!existsSync(mapDir)) mkdirSync(mapDir, { recursive: true });

const stages = JSON.parse(readFileSync(stagesPath, 'utf-8'));

// 已知的正确内部ID映射（显示名 → 内部图片ID）
const KNOWN_FIXES = {
  '6-16': 'main_06-14',
  '7-18': 'main_07-16',
  '9-18': 'main_09-16',
  '9-19': 'main_09-17',
  '10-17': 'main_10-15',
  '11-20': 'main_11-18',
  '12-19': 'main_12-17',
  '12-20': 'main_12-18',
  '13-21': 'main_13-19',
  '14-21': 'main_14-19',
  '15-20': 'main_15-18',
  '17-18': 'main_17-17',
};

let fixed = 0;
let downloaded = 0;

for (const stage of stages) {
  const url = stage.mapImage;
  if (!url || !url.startsWith('https://torappu')) continue;

  let newUrl = url;

  // H关：h_ → hard_
  if (url.includes('/h_')) {
    newUrl = url.replace('/h_', '/hard_');
    console.log(`  🔧 ${stage.name}: ${url.split('/').pop()} → ${newUrl.split('/').pop()}`);
    stage.mapImage = newUrl;
    fixed++;
    continue;
  }

  // 主线关：检查是否有已知的正确ID
  const knownFix = KNOWN_FIXES[stage.name];
  if (knownFix) {
    newUrl = `https://torappu.prts.wiki/assets/map_preview/${knownFix}.png`;
    console.log(`  🔧 ${stage.name}: ${url.split('/').pop()} → ${knownFix}.png`);
    stage.mapImage = newUrl;
    fixed++;
  }
}

// 写回
writeFileSync(stagesPath, JSON.stringify(stages, null, 2), 'utf-8');
console.log(`\n✅ 已修复 ${fixed} 个关卡的图片URL`);

// 重新下载
console.log('\n=== 开始重新下载 ===\n');
let success = 0, failed = 0;

for (let i = 0; i < stages.length; i++) {
  const stage = stages[i];
  const remoteUrl = stage.mapImage;
  if (!remoteUrl || !remoteUrl.startsWith('https://')) continue;

  const fileName = remoteUrl.split('/').pop();
  const localPath = resolve(mapDir, fileName);
  const localUrl = `/images/maps/${fileName}`;

  if (existsSync(localPath)) {
    stage.mapImage = localUrl;
    continue;
  }

  try {
    const resp = await fetch(remoteUrl);
    if (!resp.ok) { failed++; console.log(`  ❌ [${i+1}] ${stage.name}: HTTP ${resp.status}`); continue; }
    const buffer = Buffer.from(await resp.arrayBuffer());
    writeFileSync(localPath, buffer);
    stage.mapImage = localUrl;
    success++;
    process.stdout.write(`  ✅ [${i+1}] ${stage.name} (${(buffer.length/1024).toFixed(0)}KB)\n`);
  } catch (err) {
    failed++;
    console.log(`  ❌ [${i+1}] ${stage.name}: ${err.message}`);
  }
}

writeFileSync(stagesPath, JSON.stringify(stages, null, 2), 'utf-8');
console.log(`\n===== 结果 =====`);
console.log(`✅ 成功: ${success}`);
console.log(`❌ 失败: ${failed}`);
console.log(`已下载文件数: ${existsSync(mapDir) ? require('fs').readdirSync(mapDir).length : 0}`);
