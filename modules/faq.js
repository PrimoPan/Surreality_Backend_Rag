/**
 *  modules/faq.js
 *  ---------------------------
 *  固定问答（FAQ）简单匹配
 *  用法：
 *      const { matchFAQ } = require('./faq');
 *      const hit = matchFAQ('什么是VR');
 */

const fs = require('fs');
const path = require('path');
const stringSimilarity = require('string-similarity');   // npm i string-similarity

const RAW = JSON.parse(
  fs.readFileSync(path.resolve('knowledge/faq.json'), 'utf8')
);

/* 扁平化所有问句 */
const FLAT = RAW.flatMap(item =>
  item.q.map(q => ({ q: q.toLowerCase(), a: item.a }))
);

function matchFAQ(question, threshold = 0.7) {
  const q = question.trim().toLowerCase();

  /* ① 子串包含（最快）*/
  for (const item of FLAT) {
    if (q.includes(item.q)) return item.a;
  }

  /* ② 相似度（fallback）*/
  const { bestMatch } = stringSimilarity.findBestMatch(
    q,
    FLAT.map(v => v.q)
  );
  if (bestMatch.rating >= threshold) {
    const hit = FLAT.find(v => v.q === bestMatch.target);
    return hit?.a || null;
  }
  return null;
}

module.exports = { matchFAQ };
