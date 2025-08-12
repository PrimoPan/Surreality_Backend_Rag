// index.js —— 只负责启动 HTTP 服务
require('dotenv').config();
const express = require('express');
const multer  = require('multer');

const { recognizeAudio } = require('./modules/asr');
const { getGPTResponse } = require('./modules/gpttest');
const { textToSpeechAndWaitForResult } = require('./modules/textToSpeech');

const app  = express();
const port = Number(process.env.PORT) || 2123;

const storage = multer.memoryStorage();
const upload  = multer({ storage });

app.use(express.urlencoded({ extended: true, limit: '1000mb' }));
app.use(express.json({ limit: '1000mb' }));

app.get('/healthz', (_req, res) => res.status(200).send('ok'));

app.post('/api/sendVoice', upload.none(), async (req, res) => {
  if (!req.body.Data) return res.status(400).send('No audio data uploaded');
  try {
    const lan  = req.body.Lan || 'CHN';
    const data = await recognizeAudio(req.body.Data, lan);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

const maxSeconds = 30;
function speechSeconds(str = '') {
  const zh = (str.match(/[\u4e00-\u9fff]/g) || []).length;
  const en = str.replace(/[\u4e00-\u9fff]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(zh / 4, en / 2.5);
}

app.post('/api/gpttest', async (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message field is required' });
  try {
    const prompt   = `请在 30 秒之内、仅用中文/英文/粤语回答：\n${message.trim()}`;
    const { text } = await getGPTResponse(prompt);
    if (speechSeconds(text) > maxSeconds)
      return res.status(400).json({ success: false, message: 'Answer exceeds 30-second limit' });
    res.json({ success: true, answer: text });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/textToSpeech', async (req, res) => {
  const { text, Lan } = req.body;
  if (!text) return res.status(400).json({ success: false, message: 'Text field is required' });
  try {
    const url = await textToSpeechAndWaitForResult(text, Lan);
    res.json({ success: true, data: url });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
