/**
 * 压缩地图图片，大幅减小部署包体积
 * PNG → 压缩至 60% 质量，目标从 94MB 降到 ~25MB
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const srcDir = resolve(projectRoot, 'public/images/maps');
const distDir = resolve(projectRoot, 'dist/images/maps');

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

const files = readdirSync(srcDir).filter((f) => f.endsWith('.png'));
console.log(`压缩 ${files.length} 张地图图片...\n`);

let totalBefore = 0;
let totalAfter = 0;

for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const srcPath = resolve(srcDir, file);
  const before = statSync(srcPath).size;
  totalBefore += before;

  try {
    const result = await sharp(srcPath)
      .resize({ width: 640, withoutEnlargement: true })
      .png({ quality: 60, compressionLevel: 9 })
      .toBuffer();
    
    const dstPath = resolve(distDir, file);
    writeFileSync(dstPath, result);
    const after = result.length;
    totalAfter += after;

    const pct = ((1 - after / before) * 100).toFixed(0);
    process.stdout.write(`  [${i + 1}/${files.length}] ${file}: ${(before/1024).toFixed(0)}KB → ${(after/1024).toFixed(0)}KB (${pct}%)\n`);
  } catch (err) {
    console.log(`  ❌ ${file}: ${err.message}`);
    // copy original
    const srcBuf = readFileSync(srcPath);
    writeFileSync(resolve(distDir, file), srcBuf);
    totalAfter += srcBuf.length;
  }
}

const savedMB = ((totalBefore - totalAfter) / 1024 / 1024).toFixed(1);
const beforeMB = (totalBefore / 1024 / 1024).toFixed(1);
const afterMB = (totalAfter / 1024 / 1024).toFixed(1);

console.log(`\n===== 压缩完成 =====`);
console.log(`压缩前: ${beforeMB} MB`);
console.log(`压缩后: ${afterMB} MB`);
console.log(`节省: ${savedMB} MB (${((1-totalAfter/totalBefore)*100).toFixed(0)}%)`);
