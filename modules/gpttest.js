// modules/gpttest.js
const tencentcloud = require('tencentcloud-sdk-nodejs-hunyuan');
const fs = require('fs');

// 配置腾讯云认证信息
const secretConfig = JSON.parse(fs.readFileSync('secretkey.json', 'utf8'));

const hunyuanClientConfig = {
  credential: {
    secretId: secretConfig.SecretId,
    secretKey: secretConfig.SecretKey,
  },
  region: 'ap-beijing', // 选择适合的区域
  profile: {
    httpProfile: {
      endpoint: 'hunyuan.tencentcloudapi.com',
    },
  },
};

const hunyuanClient = new tencentcloud.hunyuan.v20230901.Client(hunyuanClientConfig);

// 向混元大模型发送请求
async function getGPTResponse(message) {
  const prompt = "请用口语化的风格简短回复，控制在两到三句话以内，不要出现特殊符号: ";
  console.log(`${prompt} ${message}`);
  const hunyuanParams = {
    Model: "hunyuan-turbo",
    Messages: [
      {
        Role: "user",
        Content: `${prompt} ${message}`,
      },
    ],
  };

  try {
    const hunyuanResponse = await hunyuanClient.ChatCompletions(hunyuanParams);
    return hunyuanResponse;
  } catch (error) {
    console.error(error);
    throw new Error(`Error calling HunYuan: ${error.message}`);
  }
}

module.exports = { getGPTResponse };
