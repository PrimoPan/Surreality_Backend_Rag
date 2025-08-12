const express = require('express');
const multer = require('multer');
const { recognizeAudio } = require('./modules/asr');  // 引入语音识别模块
const { getGPTResponse } = require('./modules/gpttest');  // 引入混元大模型模块
const { textToSpeechAndWaitForResult } = require('./modules/textToSpeech');  // 引入文字转语音模块
const fs = require('fs');
const app = express();
const port = 2123;

// 设置multer存储配置，用于接收上传的音频文件（这里只使用 FormData 来接收）
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.urlencoded({ extended: true, limit: '1000mb' }));  // 处理表单请求
app.use(express.json({ limit: '1000mb' }));

// **ASR - 语音转文字接口**
app.post('/api/sendVoice', upload.none(), async (req, res) => {
  if (!req.body.Data) {
    return res.status(400).send('No audio data uploaded');
  }

  const audioData = req.body.Data;
  const lan = req.body.Lan || 'CHN';  // 默认使用中文

  try {
    const recognitionResult = await recognizeAudio(audioData, lan);
    res.json({
      success: true,
      data: recognitionResult,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// --------------- 30s 语速估算（4 汉字/秒，2.5 英词/秒）---------------
const maxSeconds = 30;
function speechSeconds(str = '') {
  const zh = (str.match(/[\u4e00-\u9fff]/g) || []).length;               // 中文字数
  const en = str.replace(/[\u4e00-\u9fff]/g, ' ').trim()
                .split(/\s+/).filter(Boolean).length;                   // 英单词数
  return Math.max(zh / 4, en / 2.5);
}

// ------------------------ GPTTest ------------------------
app.post('/api/gpttest', async (req, res) => {
  const { message } = req.body;
  console.log(message);
  if (!message?.trim())
    return res.status(400).json({ success: false, message: 'Message field is required' });

  try {
    // 给模型加前置指令，先从源头控长
    const prompt   = `请在 30 秒之内、仅用中文/英文/粤语回答：\n${message.trim()}`;
    const { text } = await getGPTResponse(prompt);      // 假设 getGPTResponse 返回 { text }

    // 二次校验，双保险
    if (speechSeconds(text) > maxSeconds)
      return res.status(400).json({ success: false, message: 'Answer exceeds 30-second limit' });

    res.json({ success: true, answer: text });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// **Text to Speech - 文字转语音接口**
app.post('/api/textToSpeech', async (req, res) => {
  const { text, Lan } = req.body;  // 提取 Lan 参数

  if (!text) {
    return res.status(400).json({ success: false, message: 'Text field is required' });
  }

  try {
    const result = await textToSpeechAndWaitForResult(text, Lan);  // 传递 Lan 参数
    console.log(result);
    // 返回合成语音的 URL
    res.json({
      success: true,
      data: result    
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
});


// 给前端key
app.get('/api/getTencentKey', (req, res) => {
  // 读你在后端保存的 secretkey.json
  const secretConfig = JSON.parse(fs.readFileSync('secretkey.json', 'utf8'));
  // 返回给客户端
  res.json({
    appId: secretConfig.appId,        
    SecretId: secretConfig.SecretId,
    SecretKey: secretConfig.SecretKey
  });
});


// 启动服务器
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

