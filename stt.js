// stt.js  （或你的这段独立服务文件）
require("dotenv").config();
const express = require("express");
const multer = require("multer");
const tencentcloud = require("tencentcloud-sdk-nodejs-asr");

const AsrClient = tencentcloud.asr.v20190614.Client;
const app = express();
const port = process.env.PORT || 2123;

// 1) 上传（内存存储）
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// 2) 从 .env 读密钥
const secretId  = process.env.TENCENT_SECRET_ID;
const secretKey = process.env.TENCENT_SECRET_KEY;
if (!secretId || !secretKey) {
  console.error("[ASR] Missing TENCENT_SECRET_ID / TENCENT_SECRET_KEY in .env");
  process.exit(1);
}

const client = new AsrClient({
  credential: { secretId, secretKey },
  region: process.env.TENCENT_REGION || "ap-guangzhou",
  profile: { httpProfile: { endpoint: process.env.TENCENT_ASR_ENDPOINT || "asr.tencentcloudapi.com" } },
});

// 3) 轮询工具：等识别结束
async function waitForResult(taskId, { timeoutMs = 30000, intervalMs = 1500 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { Data } = await client.DescribeTaskStatus({ TaskId: taskId });
    if (Data?.StatusStr === "success") return Data;         // Data.Result 有最终文本
    if (Data?.StatusStr === "failed")  throw new Error(Data?.ErrorMsg || "ASR task failed");
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error("ASR polling timeout");
}

// 4) 路由：接收音频并返回识别文本
app.post("/api/sendVoice", upload.single("audioFile"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No audio file uploaded" });

    const engine = req.body.EngineModelType || "16k_zh_dialect"; // 16k_zh / 16k_en / 16k_zh_dialect...
    const params = {
      EngineModelType: engine,
      ChannelNum: 1,
      ResTextFormat: 2,         // JSON
      SourceType: 1,            // 直接传数据
      ConvertNumMode: 0,
      AudioData: req.file.buffer.toString("base64"),
    };

    // 先创建任务
    const { Data } = await client.CreateRecTask(params);
    const taskId = Data?.TaskId;
    if (!taskId) throw new Error("CreateRecTask did not return TaskId");

    // 轮询拿结果
    const finalData = await waitForResult(taskId);

    return res.json({ success: true, taskId, engine, data: finalData });
  } catch (err) {
    console.error("[ASR] Error:", err);
    return res.status(500).json({ success: false, message: err.message || "ASR error" });
  }
});

app.listen(port, () => {
  console.log(`ASR server running at http://localhost:${port}`);
});
