// modules/gpttest.js
// ==================================================
// 混元问答 + FAQ 本地命中 + RAG（作品向量检索）
// ==================================================

/* ---------- ① 依赖 ---------- */
const fs             = require('fs');
const tencentcloud   = require('tencentcloud-sdk-nodejs-hunyuan');
const { search }     = require('./knowledge');  // 向量检索
const { matchFAQ }   = require('./faq');        // 本地 FAQ 匹配（新增）

/* ---------- ② SDK ---------- */
const { SecretId, SecretKey } = JSON.parse(fs.readFileSync('secretkey.json', 'utf8'));

const hunyuanClient = new tencentcloud.hunyuan.v20230901.Client({
  credential: { secretId: SecretId, secretKey: SecretKey },
  region : 'ap-guangzhou',
  profile: { httpProfile: { endpoint: 'hunyuan.tencentcloudapi.com' } }
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

  /* === 0. 先看 FAQ 能否直接命中 === */
  const faqHit = matchFAQ(question);          // 命中返回字符串；未命中返回 null/undefined
  if (faqHit) {
    console.log('[FAQ 命中] -> 直接返回预设答案');
    return { text: faqHit, meta: { source: 'faq' } };
  }

  /* === 1. RAG 向量检索 === */
  let docs = [];
  try {
    docs = await search(question, 25);         // 挑 8 条上下文，比原 k=3 丰富
  } catch (err) {
    console.error('[RAG] 检索失败：', err);
  }

  /* === 2. System Prompt === */
  const systemPrompt = docs.length
    ? `
    这是一场元宇宙（VR/XR/MR)与AIGC结合的艺术展。领导者是许彬(Pan HUI）教授，你也可以叫他Ben。注意他的粤语拼音是Pan HUI，千万不要说成Xu Bin。许彬是香港科技大学，香港科技大学新兴跨学科领域讲席教授、香港科技大学（广州）计算媒体与艺术 (CMA) 讲席教授、元宇宙与计算创意中心主任。这场展览汇聚了世界各地一流艺术家的作品的投稿，希望你在这里玩的开心。
你是一名展览讲解员。以下资料来自展览官方手册，请**仅依据资料**回答；若资料缺失请根据你的智慧自由发挥。
--------------------
${buildContext(docs)}
--------------------
回答要求：口语化，3-4 句，不要出现特殊符号。`.trim()
    : `
你是一名展览讲解员。目前没有查询到官方资料，请基于常识或合理推测回答。
回答要求：口语化，3-4 句，不要出现特殊符号。`.trim();

  /* === 3. 调 HunYuan ChatCompletions === */
  const params = {
    Model: 'hunyuan-turbo',
    Stream: false,
    Messages: [
      { Role: 'system', Content: systemPrompt },
      { Role: 'user',   Content: question }
    ]
  };

  console.log('systemPrompt:\n', systemPrompt);
  console.log('userPrompt   :', question);

  const raw  = await hunyuanClient.ChatCompletions(params);
  const resp = raw.Response ?? raw;
  const text = resp?.Choices?.[0]?.Message?.Content?.trim() || '（未获得回复）';

  console.log('[HunYuan Raw]', raw);

  return { text, meta: resp };
}

module.exports = { getGPTResponse };
