// ma_dropout_tracker.js — 🕵️ "256 기법" 탈락 종목 추적기
//
// ma_reversal_scanner.js가 매일 스캔할 때마다 이 모듈을 호출해서, 어제까지 후보였다가
// 오늘 사라진 종목을 잡아내고 탈락 사유를 분류한다:
//   - 상승 탈락(BREAKOUT_UP): 목표선(outer MA)을 돌파해버린 "성공" 케이스
//   - 하락 탈락(BREAKDOWN): 정배열이 다시 무너진(trigger MA가 mid MA 아래로) "실패" 케이스
//   - 기간 만료(STALE): 아직 정배열·목표선 아래 상태지만 골든크로스가 너무 오래돼(신선도
//     기준 초과) 스캐너 후보에서만 빠진 케이스 (가격 자체는 실패도 성공도 아님)
// 탈락 이후에도 계속 현재가를 조회해서 수익률을 보여준다.
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchDailySeries } from './double_bottom_scanner.js';
import { sendTelegramMessage } from './telegram_alert.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_PATH = path.join(__dirname, 'data', 'ma_reversal_watch_state.json');
const HISTORY_PATH = path.join(__dirname, 'data', 'ma_reversal_dropout_history.json');
const MAX_HISTORY_PER_SET = 300;
const MAX_ENRICH_LIVE = 80; // 현재가 실시간 조회는 최근 N건까지만 (부하 방지)

const HEADERS_M = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  'Referer': 'https://m.stock.naver.com/',
};

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return fallback; }
}
function saveJson(file, data) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}
function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

// 🚀 상승 탈락(목표선 돌파 성공)만 텔레그램으로 발송 — 하락 탈락/기간만료는 보내지 않음
async function notifyBreakoutDropout(patternSetDef, item) {
  const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const message = `
🚀 <b>[256 기법 상승 탈락 - 목표선 돌파 성공] ${item.name}</b>
━━━━━━━━━━━━━━━━━
• <b>종목명:</b> ${item.name} (<code>${item.code}</code>)
• <b>구간:</b> ${patternSetDef.label}
• <b>최초 포착:</b> ${item.firstSeenDate}
• <b>돌파일:</b> ${item.dropoutDate}
• <b>돌파 당시가:</b> ${item.priceAtDropout.toLocaleString()}원
━━━━━━━━━━━━━━━━━
💡 목표선(${patternSetDef.outer}일선)을 뚫고 올라간 "성공" 케이스입니다.
⏰ <i>${nowStr}</i>
`.trim();
  await sendTelegramMessage(message);
}

function sma(closes, period, endIdx) {
  if (endIdx - period + 1 < 0) return null;
  let sum = 0;
  for (let k = endIdx - period + 1; k <= endIdx; k++) sum += closes[k];
  return sum / period;
}

// ma_reversal_scanner.js의 CROSS_LOOKBACK_DAYS(5)와 반드시 동일하게 유지 — 신선도 판정 기준.
const CROSS_LOOKBACK_DAYS = 5;

// 탈락 시점 시리즈를 기준으로 재계산해서 "왜 빠졌는지" 분류한다.
export function classifyDropoutReason(series, { trigger, mid, outer }) {
  const closes = series.map(d => d.close);
  const lastIdx = closes.length - 1;
  const t = sma(closes, trigger, lastIdx);
  const m = sma(closes, mid, lastIdx);
  const o = sma(closes, outer, lastIdx);
  if (t === null || m === null || o === null) {
    return { reason: 'DATA_INSUFFICIENT', label: '데이터 부족' };
  }

  const lastBar = series[lastIdx];
  if (lastBar.close >= o) {
    return { reason: 'BREAKOUT_UP', label: '상승 탈락 (목표선 돌파 성공)' };
  }
  if (t <= m) {
    return { reason: 'BREAKDOWN', label: '하락 탈락 (정배열 붕괴)' };
  }

  let hasFreshCross = false;
  const searchStart = Math.max(mid, lastIdx - CROSS_LOOKBACK_DAYS);
  for (let i = lastIdx; i >= searchStart; i--) {
    const ti = sma(closes, trigger, i), mi = sma(closes, mid, i);
    const tip = sma(closes, trigger, i - 1), mip = sma(closes, mid, i - 1);
    if (ti === null || mi === null || tip === null || mip === null) break;
    if (ti > mi && tip <= mip) { hasFreshCross = true; break; }
  }
  const outerGapPct = parseFloat((((o - lastBar.close) / lastBar.close) * 100).toFixed(1));
  if (!hasFreshCross) {
    return { reason: 'STALE', label: '기간 만료 (교차 신선도 초과)', outerGapPct };
  }
  return { reason: 'OTHER', label: '기타 조건 미충족', outerGapPct };
}

// 오늘 스캔 결과(currentMatches)를 기준으로 watch state를 갱신하고, 사라진 종목을 탈락으로 기록.
// patternSetDef: { key, trigger, mid, outer, historyPages } — ma_reversal_scanner.js의 PATTERN_SETS 항목.
export async function updateDropoutTracking(patternSetDef, currentMatches) {
  const { key } = patternSetDef;
  const state = loadJson(STATE_PATH, {});
  const history = loadJson(HISTORY_PATH, {});
  const today = todayKey();

  const bucket = state[key] || {};
  const currentCodes = new Set(currentMatches.map(s => s.code));

  for (const s of currentMatches) {
    const existing = bucket[s.code];
    bucket[s.code] = {
      code: s.code, name: s.name, market: s.market,
      firstSeenDate: existing?.firstSeenDate || today,
      lastSeenDate: today,
    };
  }

  const droppedCodes = Object.keys(bucket).filter(code => !currentCodes.has(code));
  if (droppedCodes.length > 0) {
    history[key] = history[key] || [];
    for (const code of droppedCodes) {
      const entry = bucket[code];
      try {
        const series = await fetchDailySeries(code, patternSetDef.historyPages);
        if (series && series.length > 0) {
          const { reason, label, outerGapPct } = classifyDropoutReason(series, patternSetDef);
          const lastBar = series[series.length - 1];
          const dropoutItem = {
            code, name: entry.name, market: entry.market,
            firstSeenDate: entry.firstSeenDate,
            dropoutDate: today,
            reason, reasonLabel: label,
            priceAtDropout: lastBar.close,
            outerGapPctAtDropout: outerGapPct ?? null,
          };
          history[key].unshift(dropoutItem);

          if (reason === 'BREAKOUT_UP') {
            try { await notifyBreakoutDropout(patternSetDef, dropoutItem); }
            catch (e) { console.warn(`[MA DROPOUT] ${code} 상승 탈락 텔레그램 발송 실패:`, e.message); }
          }
        }
      } catch (e) {
        console.warn(`[MA DROPOUT] ${code} 탈락 사유 분류 실패:`, e.message);
      }
      delete bucket[code];
    }
    history[key] = history[key].slice(0, MAX_HISTORY_PER_SET);
  }

  state[key] = bucket;
  saveJson(STATE_PATH, state);
  saveJson(HISTORY_PATH, history);
}

async function fetchCurrentPrice(code) {
  try {
    const res = await axios.get(`https://m.stock.naver.com/api/stock/${code}/basic`, { headers: HEADERS_M, timeout: 5000 });
    const raw = String(res.data?.closePrice ?? '').replace(/,/g, '');
    const price = parseInt(raw, 10);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

// 탈락 이력 + 탈락 이후 수익률(최근 N건만 실시간 조회)
export async function getDropoutHistory(patternSetKey) {
  const history = loadJson(HISTORY_PATH, {});
  const list = history[patternSetKey] || [];

  const toEnrich = list.slice(0, MAX_ENRICH_LIVE);
  const rest = list.slice(MAX_ENRICH_LIVE);

  const enriched = await Promise.all(toEnrich.map(async (item) => {
    const currentPrice = await fetchCurrentPrice(item.code);
    const returnPct = (currentPrice && item.priceAtDropout > 0)
      ? parseFloat((((currentPrice - item.priceAtDropout) / item.priceAtDropout) * 100).toFixed(2))
      : null;
    return { ...item, currentPrice, returnSinceDropoutPct: returnPct };
  }));

  return [...enriched, ...rest.map(item => ({ ...item, currentPrice: null, returnSinceDropoutPct: null }))];
}
