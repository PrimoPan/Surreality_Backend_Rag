// modules/textToSpeech.js
require('dotenv').config();
const tencentcloud = require('tencentcloud-sdk-nodejs-tts');

const TtsClient = tencentcloud.tts.v20190823.Client;

const client = new TtsClient({
  credential: {
    secretId : process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
  },
  region : process.env.TENCENT_REGION || 'ap-guangzhou',
  profile: {
    httpProfile: {
      endpoint: process.env.TENCENT_TTS_ENDPOINT || 'tts.tencentcloudapi.com',
    },
  },
});

/**
 * 文字转语音，返回任务结果 URL
 * @param {string} text
 * @param {'CHN'|'ENG'|'CAN'} lan
 */
async function textToSpeechAndWaitForResult(text, lan = 'CHN') {
  let voiceType;
  switch (lan) {
    case 'ENG': voiceType = 101050; break; // 英文
    case 'CAN': voiceType = 101019; break; // 粤语
    case 'CHN':
    default:    voiceType = 301038; break; // 普通话
  }

  const params = {
    Text: text,
    Volume: 8,
    Speed: 0,
    ProjectId: 0,
    ModelType: 1,
    VoiceType: voiceType,
    PrimaryLanguage: 1,
    SampleRate: 16000,
    Codec: 'wav',
  };

  const { Data } = await client.CreateTtsTask(params);
  const taskId = Data?.TaskId;
  if (!taskId) throw new Error('CreateTtsTask 未返回 TaskId');

  return await queryTaskStatus(taskId);
}

async function queryTaskStatus(taskId) {
  // 轮询直到完成
  while (true) {
    const { Data } = await client.DescribeTtsTaskStatus({ TaskId: taskId });
    if (Data?.Status === 2) return Data.ResultUrl;             // 完成
    if (Data?.Status === 3) throw new Error(`TTS 失败: ${Data?.StatusStr || 'unknown'}`);
    await new Promise(r => setTimeout(r, 2000));               // 处理中，等 2s
  }
}

module.exports = { textToSpeechAndWaitForResult };
