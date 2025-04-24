#!/usr/bin/env node
/**
 * scripts/enbed_artists.js
 * ----------------------------------------------------------
 * 将 JSON 数据向量化写入 MongoDB
 *
 * USAGE
 *   node scripts/enbed_artists.js                        # 读取 knowledge/artists_clean.json
 *   node scripts/enbed_artists.js ./data/my_artists.json # 指定源文件
 *   node scripts/enbed_artists.js --rebuild              # 先清空集合再重算
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import tencentcloud from 'tencentcloud-sdk-nodejs-hunyuan';

/* -------- 0. 解析 CLI 参数 ---------------------------------- */
const argv = process.argv.slice(2);
const REBUILD  = argv.includes('--rebuild');
const SRC_FILE = argv.find(a => a.endsWith('.json')) || 'knowledge/artists_clean.json';

/* -------- 1. MongoDB 连接信息 ------------------------------- */
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME   = 'aaa_project';
const COLL_NAME = 'artists_embeddings';

/* -------- 2. HunYuan SDK ----------------------------------- */
const { SecretId, SecretKey } = JSON.parse(fs.readFileSync('secretkey.json', 'utf8'));
const hunyuanClient = new tencentcloud.hunyuan.v20230901.Client({
  credential: { secretId: SecretId, secretKey: SecretKey },
  region   : 'ap-guangzhou',
  profile  : { httpProfile: { endpoint: 'hunyuan.tencentcloudapi.com' } }
});

/* -------- 3. util: 组装待嵌入文本 --------------------------- */
function recordToText(r){
  return [
    `关键词#${r.keywords}`,
    r.artist,
    (r.artistIntroCN || r.artistIntroEN || '').slice(0, 400),
    r.workTitleCN || r.workTitleEN || '',
    (r.workDescCN || r.workDescEN || '').slice(0, 400)
  ].join('\n').trim();
}

/* -------- 4. util: 调一次 GetEmbedding --------------------- */
async function embedBatch(textArr){
  const { Data } = await hunyuanClient.GetEmbedding({ InputList: textArr });
  if(!Data?.length) throw new Error('HunYuan GetEmbedding 返回空 Data');
  return Data.map(d => d.Embedding);
}

/* -------- 5. 主流程 ---------------------------------------- */
(async () => {
  const absPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', SRC_FILE);
  console.log(`🚀  读取源文件: ${absPath}`);

  const raw = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  if(!Array.isArray(raw)) throw new Error('❌ 源文件需为数组！');

  /* 连接 Mongo */
  const mongo = new MongoClient(MONGO_URI);
  await mongo.connect();
  const coll  = mongo.db(DB_NAME).collection(COLL_NAME);

  /* rebuild? */
  if(REBUILD){
    console.log('🔄  --rebuild 检测到，先清空旧集合…');
    await coll.deleteMany({});
  }

  /* 确保索引（可选）*/
  await coll.createIndex({ keywords: 1 });
  await coll.createIndex({ 'embedding': 1 });

  const BATCH = 50;
  let success = 0;

  for(let i = 0; i < raw.length; i += BATCH){
    const slice = raw.slice(i, i+BATCH);

    /* 批量向量化 */
    let vectors;
    try{
      vectors = await embedBatch(slice.map(recordToText));
    }catch(err){
      console.error(`❌  向量化失败 (第 ${i}-${i+slice.length-1} 条):`, err.message);
      continue;  // 跳过本批
    }

    /* 组合 doc */
    const docs = slice.map((r, idx) => ({
      embedding     : vectors[idx],
      text          : recordToText(r),
      keywords      : r.keywords,
      artist        : r.artist,
      artistIntroCN : r.artistIntroCN || '',
      artistIntroEN : r.artistIntroEN || '',
      workTitleCN   : r.workTitleCN   || '',
      workTitleEN   : r.workTitleEN   || '',
      workDescCN    : r.workDescCN    || '',
      workDescEN    : r.workDescEN    || '',
      createdAt     : new Date()
    }));

    /* 写库 */
    try{
      await coll.insertMany(docs);
      success += docs.length;
      console.log(`✔︎  已写入 ${success}/${raw.length}`);
    }catch(dbErr){
      console.error(`❌  Mongo insertMany 失败 (第 ${i}-${i+slice.length-1}):`, dbErr.message);
    }
  }

  console.log(`🎉  完成！共写入 ${success} 条 -> ${DB_NAME}.${COLL_NAME}`);
  await mongo.close();
  process.exit(0);
})();
