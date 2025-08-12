// modules/asr.js
require('dotenv').config();
const tencentcloud = require('tencentcloud-sdk-nodejs-asr');

// --- 从 .env 读取密钥 ---
const secretId  = process.env.TENCENT_SECRET_ID;
const secretKey = process.env.TENCENT_SECRET_KEY;
if (!secretId || !secretKey) {
  throw new Error('缺少 TENCENT_SECRET_ID / TENCENT_SECRET_KEY，请在 .env 中配置');
}

// --- 配置客户端 ---
const clientConfig = {
  credential: {
    secretId,
    secretKey,
  },
  region: process.env.TENCENT_REGION || 'ap-guangzhou', // 可通过 .env 配置
  profile: {
    httpProfile: {
      endpoint: process.env.TENCENT_ASR_ENDPOINT || 'asr.tencentcloudapi.com',
    },
  },
};

const client = new tencentcloud.asr.v20190614.Client(clientConfig);

// 语音识别的任务函数
async function recognizeAudio(audioData, lan = 'CHN') {
  let engineModelType;
  switch (lan) {
    case 'ENG':
      engineModelType = '16k_en';
      break;
    case 'CAN':
      engineModelType = '16k_yue';
      break;
    case 'CHN':
    default:
      engineModelType = '16k_zh_dialect';
      break;
  }

  const params = {
    EngineModelType: engineModelType,
    ChannelNum: 1,
    ResTextFormat: 3,          // 返回文本格式
    SourceType: 1,             // 音频数据来源
    Data: audioData,           // Base64编码的音频数据
  };

  try {
    const result = await client.CreateRecTask(params);
    const taskId = result.Data.TaskId;
    return await queryTaskResult(taskId);
  } catch (error) {
    throw new Error(`Error in audio recognition: ${error.message}`);
  }
}

// 查询任务结果（递归轮询）
async function queryTaskResult(taskId) {
  const params = { TaskId: taskId };

  try {
    const result = await client.DescribeTaskStatus(params);
    if (result && result.Data) {
      const { Status, StatusStr, Result, ErrorMsg } = result.Data;
      if (Status === 2) {
        return { status: StatusStr, result: Result };
      } else if (Status === 0 || Status === 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return queryTaskResult(taskId);
      } else if (Status === 3) {
        return { status: StatusStr, errorMsg: ErrorMsg };
      }
    } else {
      return { status: 'Error', message: 'Unable to retrieve task result. Please try again later.' };
    }
  } catch (error) {
    throw new Error(`Error querying task: ${error.message}`);
  }
}

module.exports = { recognizeAudio };
