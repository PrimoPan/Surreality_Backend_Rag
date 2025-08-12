/**
 * 工具：语言验证 + 朗读时长估算
 * ----------------------------------------------
 * 规则：
 *   · 只允许中文（含粤语汉字）、英文/数字、常见符号
 *   · 朗读速度估算：
 *       - 汉字：4 字/秒
 *       - 英/拼音词：2.5 词/秒
 *   · 超过 30 秒即视为不合规
 */

const MAX_SPEECH_SECONDS = 30;

// 中英粤白名单：汉字、字母数字、空白、常用标点
const ALLOWED_RE = /^[\u4E00-\u9FFF\w\s.,;:'"!?，。！？；：“”‘’（）()\-]+$/;

/** 抛错型语言验证 */
function validateLanguages(text) {
  if (!ALLOWED_RE.test(text))
    throw new Error('Text contains disallowed characters (allowed: Chinese / English / Cantonese only).');
}

/** 估算朗读时长（秒）*/
function estimateSpeechSeconds(text) {
  const zhChars = (text.match(/[\u4E00-\u9FFF]/g) || []).length;

  const enWords = text
    .replace(/[\u4E00-\u9FFF]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const secZh = zhChars / 4;    // 4 字/秒
  const secEn = enWords / 2.5;  // 2.5 词/秒
  return Math.max(secZh, secEn);
}

module.exports = {
  validateLanguages,
  estimateSpeechSeconds,
  MAX_SPEECH_SECONDS,
};
