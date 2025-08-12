// modules/gpttest.js
// ==================================================
// 混元问答 + FAQ 本地命中 + RAG（作品向量检索）
// ==================================================

/* ---------- ① 依赖 ---------- */
require('dotenv').config();
const tencentcloud = require('tencentcloud-sdk-nodejs-hunyuan');
const { search }   = require('./knowledge');  // 向量/文本检索（你那边已做回退的话更稳）
const { matchFAQ } = require('./faq');        // 本地 FAQ 匹配（新增）

/* ---------- ② SDK（从 .env 读，不再用 secretkey.json） ---------- */
const SecretId  = process.env.TENCENT_SECRET_ID;
const SecretKey = process.env.TENCENT_SECRET_KEY;

if (!SecretId || !SecretKey) {
  throw new Error('缺少 TENCENT_SECRET_ID / TENCENT_SECRET_KEY（.env）');
}

const hunyuanClient = new tencentcloud.hunyuan.v20230901.Client({
  credential: { secretId: SecretId, secretKey: SecretKey },
  region : process.env.TENCENT_REGION || 'ap-guangzhou',
  profile: { httpProfile: { endpoint: process.env.TENCENT_ENDPOINT || 'hunyuan.tencentcloudapi.com' } }
});

/* ---------- ③ 把检索结果拼接成上下文 ---------- */
function buildContext(docs) {
  return docs.map((d, i) => {
    const title  = d.workTitleCN   || d.workTitleEN   || '未命名作品';
    const descW  = d.workDescCN    || d.workDescEN    || '暂无作品简介';
    const introA = d.artistIntroCN || d.artistIntroEN || '暂无作者简介';
    return `【段落${i + 1}}
作品：${title}
作者：${d.artist}
作者简介：${introA}
作品简介：${descW}`;
  }).join('\n\n');
}

/* ---------- ④ 主入口 ---------- */
async function getGPTResponse(question) {
  // 0) FAQ 命中
  const faqHit = matchFAQ?.(question);
  if (faqHit) {
    console.log('[FAQ 命中] -> 直接返回预设答案');
    return { text: faqHit, meta: { source: 'faq' } };
  }

  // 1) RAG 检索
  let docs = [];
  try {
    docs = await search(question, 8);   // 修：补上 k，建议 8
  } catch (err) {
    console.error('[RAG] 检索失败：', err);
  }
  console.log('[RAG] hits =', docs.length, 'example =', docs[0]?.workTitleCN || docs[0]?.workTitleEN);

  // 2) System Prompt（明确中文，防飘粤语；没文档就放开发挥）
  const systemPrompt = (docs.length ? `
这是一场元宇宙（VR/XR/MR)与 AIGC 结合的艺术展。领导者是许彬（Pan HUI）教授，你也可以叫他 Ben。注意他的粤语拼音是 Pan HUI，不是 Xu Bin。以下资料来自展览官方手册，请仅依据资料回答；若资料缺失可合理推测。
--------------------
${buildContext(docs)}
--------------------
回答要求：默认用简体中文、口语化，3-4 句，不要出现特殊符号。`
  :
`你是一名展览讲解员。目前没有查询到官方资料，请基于常识或合理推测回答。
回答要求：默认用简体中文、口语化，3-4 句，不要出现特殊符号。`).trim();

  // 3) 调 HunYuan ChatCompletions
  const params = {
    Model: process.env.HUNYUAN_MODEL || 'hunyuan-turbo',
    Stream: false,
    Messages: [
      { Role: 'system', Content: systemPrompt },
      { Role: 'user',   Content: question }
    ]
  };

  console.log('userPrompt:', String(question).slice(0, 120));

  const raw  = await hunyuanClient.ChatCompletions(params);
  const resp = raw.Response ?? raw;
  const text = resp?.Choices?.[0]?.Message?.Content?.trim() || '（未获得回复）';

  return { text, meta: resp };
}

module.exports = { getGPTResponse };
