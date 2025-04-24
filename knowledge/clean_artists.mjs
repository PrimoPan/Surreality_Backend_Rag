#!/usr/bin/env node
// tools/clean_artists.mjs
//----------------------------------------------------------
// 用法：node tools/clean_artists.mjs [原文件路径]
// 默认读取 knowledge/artists.json，输出到同目录
//----------------------------------------------------------
import fs   from 'node:fs';
import path from 'node:path';

// ---------- 1. 读入 ----------
const SRC   = process.argv[2] || path.resolve('./artists.json');
const DIR   = path.dirname(SRC);
const RAW   = fs.readFileSync(SRC, 'utf8');

// 如果原文件本身就是合法 JSON，直接 parse；
// 否则先把“裸换行”替换成 \n 再尝试 parse
let arr;
try {
  arr = JSON.parse(RAW);
} catch (_) {
  const fixed = RAW.replace(/(?<!\\)\n/g, '\\n');   // 把所有裸回车→\n
  arr = JSON.parse(fixed);
}

// ---------- 2. 清洗规则 ----------
function sanitizeText(t = '') {
  return t                               // Null/undefined 兜底
    .replace(/\r?\n/g, '\\n')            // 所有换行 → 字面量 \n
    .replace(/\s{2,}/g, ' ')             // 连续空格收敛
    .trim();
}

function truncate(t, max = 500) {
  return t.length > max ? t.slice(0, max) + '…' : t;
}

// 你可以在这里增减字段、裁剪策略
function cleanRecord(r) {
  return {
    keywords     : r.keywords ?? '',
    artist       : sanitizeText(r.artist),
    artistIntroCN: truncate(sanitizeText(r.artistIntroCN)),
    artistIntroEN: truncate(sanitizeText(r.artistIntroEN)),
    workTitleCN  : sanitizeText(r.workTitleCN),
    workTitleEN  : sanitizeText(r.workTitleEN),
    workDescCN   : truncate(sanitizeText(r.workDescCN)),
    workDescEN   : truncate(sanitizeText(r.workDescEN))
  };
}

// ---------- 3. 执行清洗 ----------
const cleaned = arr.map(cleanRecord);

// ---------- 4. 输出 ----------
const OUT_JSON = path.join(DIR, 'artists_clean.json');
const OUT_JL   = path.join(DIR, 'artists.jsonl');

fs.writeFileSync(OUT_JSON, JSON.stringify(cleaned, null, 2), 'utf8');
fs.writeFileSync(OUT_JL,   cleaned.map(o => JSON.stringify(o)).join('\n'), 'utf8');

console.log(`✅ 清洗完成：
   • ${OUT_JSON}  （数组 JSON）
   • ${OUT_JL}    （JSON Lines，一行一个对象）`);
