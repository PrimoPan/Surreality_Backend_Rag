const tencentcloud = require("tencentcloud-sdk-nodejs-tts");
const fs = require("fs");

const TtsClient = tencentcloud.tts.v20190823.Client;

// 从 secretkey.json 文件读取 SecretId 和 SecretKey
const secretConfig = JSON.parse(fs.readFileSync('secretkey.json', 'utf8'));

// 配置腾讯云认证信息
const clientConfig = {
  credential: {
    secretId: secretConfig.SecretId,
    secretKey: secretConfig.SecretKey,
  },
  region: "ap-guangzhou", // 设置区域为广州
  profile: {
    httpProfile: {
      endpoint: "tts.tencentcloudapi.com", // 腾讯云语音合成接口
    },
  },
};

// 实例化 TtsClient 对象
const client = new TtsClient(clientConfig);

/**
 * 调用腾讯语音合成接口，生成语音文件，并递归查询任务状态，直到完成
 * @param {string} text - 要合成的文本内容
 * @returns {Promise} - 返回生成语音的任务结果，包含ResultUrl
 */
async function textToSpeechAndWaitForResult(text, lan = 'CHN') {
  let voiceType;

  switch (lan) {
    case 'ENG':
      voiceType = 101050;  // 英文
      break;
    case 'CAN':
      voiceType = 101019;  // 粤语
      break;
    case 'CHN':
    default:
      voiceType = 301038;  // 普通话
      break;
  }

  const params = {
    "Text": text,
    "Volume": 8,
    "Speed": 0,
    "ProjectId": 0,
    "ModelType": 1,
    "VoiceType": voiceType,
    "PrimaryLanguage": 1,
    "SampleRate": 16000,
    "Codec": "wav",
  };

  try {
    // 调用 CreateTtsTask 创建语音合成任务
    const createTaskResponse = await client.CreateTtsTask(params);
    console.log("语音合成任务已创建，TaskId:", createTaskResponse?.Data?.TaskId);

    // 获取 TaskId
    const taskId = createTaskResponse?.Data?.TaskId;

    if (!taskId) {
      throw new Error("未能成功创建语音合成任务！");
    }

    // 调用递归查询任务状态，直到任务完成
    const resultUrl = await queryTaskStatus(taskId);

    // 返回语音合成结果的 URL
    return resultUrl;
  } catch (err) {
    console.error("语音合成失败:", err);
    throw err;
  }
}

/**
 * 递归查询语音合成任务状态，直到完成
 * @param {string} taskId - 要查询的任务ID
 * @returns {Promise} - 返回任务完成时的结果（包含ResultUrl）
 */
async function queryTaskStatus(taskId) {
  const params = {
    TaskId: taskId,
  };

  try {
    const result = await client.DescribeTtsTaskStatus(params);
    console.log('查询任务状态:', result);

    const status = result?.Data?.Status;
    const statusStr = result?.Data?.StatusStr;

    if (status === 2) {
      // 任务完成，返回结果
      console.log("任务完成，返回语音文件 URL:", result?.Data?.ResultUrl);
      return result?.Data?.ResultUrl;  // 返回语音文件的 URL
    } else if (status === 1 || status ===0) {
      // 任务处理中，继续查询
      console.log(`任务状态: ${statusStr}, 正在处理中...`);
      await new Promise(resolve => setTimeout(resolve, 2000));  // 延时2秒
      return queryTaskStatus(taskId);  // 递归调用继续查询
    } else {
      // 任务失败
      console.log(`任务失败，状态: ${statusStr}`);
      throw new Error(`任务失败，状态: ${statusStr}`);
    }
  } catch (error) {
    console.error('查询任务状态出错:', error);
    throw error;
  }
}

module.exports = { textToSpeechAndWaitForResult };

