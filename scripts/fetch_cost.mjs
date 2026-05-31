/**
 * 从PRTS Wikitext提取干员部署费用 (cost)
 * 
 * 从干员页面 wikitext 中提取 |部署费用=XX 字段。
 * 
 * 用法：node scripts/fetch_cost.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const operatorsPath = resolve(projectRoot, 'public/data/operators.json');
const API = 'https://prts.wiki/api.php';

const db = JSON.parse(readFileSync(operatorsPath, 'utf-8'));
const operators = db.operators;

// 建立 名字 → charId 映射
const nameToId = {};
for (const [charId, op] of Object.entries(operators)) {
  nameToId[op.name] = charId;
}

const names = Object.keys(nameToId);
console.log(`共 ${names.length} 名干员`);

const batchSize = 50;
const batches = [];
for (let i = 0; i < names.length; i += batchSize) {
  batches.push(names.slice(i, i + batchSize));
}
console.log(`分 ${batches.length} 批获取\n`);

let totalCost = 0;
let noCost = 0;

for (let b = 0; b < batches.length; b++) {
  const batch = batches[b];
  const titles = batch.map((n) => encodeURIComponent(n)).join('|');
  const url = `${API}?action=query&prop=revisions&rvprop=content&format=json&titles=${titles}`;

  console.log(`[${b + 1}/${batches.length}] 请求 ${batch.length} 人...`);

  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'ArknightsDataBuilder/2.0' } });
    const data = await resp.json();
    const pages = data.query?.pages || {};

    for (const pageId of Object.keys(pages)) {
      const page = pages[pageId];
      const name = page.title;
      const wikitext = page.revisions?.[0]?.['*'] || '';

      const match = wikitext.match(/\|部署费用\s*=\s*(\d+)/);
      if (match) {
        const cost = parseInt(match[1], 10);
        const charId = nameToId[name];
        if (charId) {
          operators[charId].cost = cost;
          totalCost++;
        }
      } else {
        noCost++;
        if (noCost <= 5) console.log(`  ⚠️ ${name}: 未找到部署费用`);
      }
    }
  } catch (err) {
    console.error(`  ❌ 批次 ${b + 1} 失败: ${err.message}`);
  }

  await new Promise((r) => setTimeout(r, 800));
}

console.log(`\n===== 完成 =====`);
console.log(`✅ 已获取费用: ${totalCost} 人`);
console.log(`❌ 无费用数据: ${noCost} 人`);

// 更新统计信息
const costs = Object.values(operators).filter((o) => o.cost !== undefined).map((o) => o.cost);
if (costs.length > 0) {
  db.stats.costMin = Math.min(...costs);
  db.stats.costMax = Math.max(...costs);
  db.stats.costAvg = (costs.reduce((a, b) => a + b, 0) / costs.length).toFixed(1);
}

writeFileSync(operatorsPath, JSON.stringify(db, null, 2), 'utf-8');
console.log(`\n✅ operators.json 已更新`);
console.log(`   费用范围: ${db.stats.costMin} ~ ${db.stats.costMax}, 平均 ${db.stats.costAvg}`);
