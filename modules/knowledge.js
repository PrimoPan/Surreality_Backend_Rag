// modules/knowledge.js
// --------------------------------------------------
// 本地向量检索（Brute-force）
// --------------------------------------------------

/* ① 依赖 */
const { MongoClient } = require('mongodb');
const cosine          = require('cosine-similarity');
const fs              = require('fs');
const tencentcloud    = require('tencentcloud-sdk-nodejs-hunyuan');

/* ② 常量 */
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME   = 'aaa_project';
const COLL_NAME = 'artists_embeddings';
const TOP_K     = 8;       // 返回条数：给 RAG 足够素材
const MIN_SIM   = 0.15;    // 相似度下限（0-1)

/* ③ 混元向量化 Client */
const { SecretId, SecretKey } = JSON.parse(
  fs.readFileSync('secretkey.json', 'utf8')
);

const hunyuanClient = new tencentcloud.hunyuan.v20230901.Client({
  credential: { secretId: SecretId, secretKey: SecretKey },
  region : 'ap-guangzhou',
  profile: { httpProfile: { endpoint: 'hunyuan.tencentcloudapi.com' } }
});

/* ④ 把一句话转 1024 维向量 */
async function embed(text) {
  const resp = await hunyuanClient.GetEmbedding({ InputList: [text] });
  if (!resp?.Data?.length) throw new Error('HunYuan GetEmbedding 返回空');
  return resp.Data[0].Embedding;   // Float64Array(1024)
}

/* ⑤ 在本地向量库做余弦相似度排序 */
// modules/knowledge.js 只改 search 函数


async function search(question, k = TOP_K) {
  // 1) embed query
  const qVec = await embed(question);

  // 2) 读全部元数据（含向量）
  const mongo = new MongoClient(MONGO_URI);
  await mongo.connect();
  const docs = await mongo.db(DB_NAME).collection(COLL_NAME)
                     .find({}, { projection: { _id: 0 } }).toArray();
  await mongo.close();

  if (!docs.length) return [];

  /* ---------- A. 关键字初筛 ---------- */
  const qLower = question.toLowerCase();
  const rough = docs.filter(d =>
    // 这里可按需加字段：
    (d.artist?.toLowerCase().includes(qLower)) ||
    (d.workTitleEN?.toLowerCase().includes(qLower)) ||
    (d.workTitleCN?.includes(question))           // 中文直接包含
  );

  const cand = rough.length ? rough : docs;  // 若初筛为空再回退全量

  /* ---------- B. 语义排序 ---------- */
  return cand
    .map(d => ({ meta: d, score: cosine(qVec, d.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(r => r.meta);
}
module.exports = { search };

/* ⑥ 导出 */
module.exports = { search };
