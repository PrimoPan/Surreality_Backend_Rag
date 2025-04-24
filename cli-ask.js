#!/usr/bin/env node
/**
 * cli-ask.js
 * -------------------------------------------
 * 在终端里一问一答调用本地接口：
 *    node cli-ask.js
 * 或  chmod +x cli-ask.js && ./cli-ask.js
 */

const readline = require('readline');
const http     = require('http');          // 也可以换成 node-fetch / axios

const ENDPOINT = 'http://127.0.0.1:2126/api/gpttest';

function askApi(question) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ message: question });

    const req = http.request(
      ENDPOINT,
      {
        method : 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            parsed.success ? resolve(parsed.answer) : reject(parsed.message);
          } catch (e) {
            reject(e.message);
          }
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/* ----------- 交互循环 ----------- */
const rl = readline.createInterface({
  input : process.stdin,
  output: process.stdout,
  prompt: '你> '
});

console.log('💬 输入问题，回车发送；按 Ctrl+C 退出。\n');
rl.prompt();

rl.on('line', async line => {
  const q = line.trim();
  if (!q) return rl.prompt();

  try {
    const ans = await askApi(q);
    console.log('🤖', ans, '\n');
  } catch (err) {
    console.error('⚠️  请求失败：', err, '\n');
  }
  rl.prompt();
});

rl.on('close', () => {
  console.log('\n👋  再见！');
  process.exit(0);
});
