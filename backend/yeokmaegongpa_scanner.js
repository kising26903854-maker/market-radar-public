// yeokmaegongpa_scanner.js — 🧱 "역매공파" 후보 스캐너
//
// 역(장기 역배열 하락) → 매(매집/수급) → 공(공구리: 변동폭 축소 바닥다지기) → 파(112일선 추세 전환)
// 검색식(손익비 E 조건은 제외). 원문 조건에 "일정 수준 이상" 같은 모호한
// 표현이 많아서, 아래 상수로 수치를 임의 확정했다(화면 하단 가이드에도 그대로 표기).
//
// A 장기 하락: 448일선 > 224일선 > 112일선, 최근 252거래일 고점 대비 30% 이상 하락
// B 매집/수급(최근 20거래일): 거래량 3배↑ 양봉(매집봉) + 몸통 5%↑ 강한 양봉 + 최근 20일 평균거래량이
//   직전 60일 평균의 1.5배↑
// C 공구리: 10~30거래일 전 구간의 일평균 변동폭이 그 이전 30일의 80% 이하, 이후 저점 이탈 없음,
//   거래량은 바닥 구간에서 줄었다가(이전 대비) 최근 10일에 다시 증가
// D 추세 전환: 종가가 112일선 위 ~ +10% 이내, 5일선 > 20일선 & 20일선 상승, 종가가 직전 20일 고점의 3% 이내
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchDailySeries } from './double_bottom_scanner.js';
import { fetchFullNormalUniverse, isExcludedStock } from './ma_reversal_scanner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, 'data', 'yeokmaegongpa_cache.json');

const MIN_MARKET_CAP = 300; // 억원
const STAGE2_PAGES = 9;     // 약 540거래일 (A: 448일선 계산용)

const DROP_FROM_HIGH_PCT = 30, HIGH_WINDOW = 252;
const VOL_SPIKE_MULT = 3, STRONG_BULL_PCT = 5, VOL_AVG_MULT = 1.5, B_WINDOW = 20, VOL_BASE = 60;
const RANGE_SHRINK_RATIO = 0.8;
const BREAKOUT_MAX_PCT = 10, NEAR_HIGH_PCT = 3;

const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

function sma(closes, period, endIdx) {
  if (endIdx - period + 1 < 0) return null;
  let sum = 0;
  for (let k = endIdx - period + 1; k <= endIdx; k++) sum += closes[k];
  return sum / period;
}

function checkB(s) {
  const n = s.length;
  if (n < VOL_BASE + B_WINDOW + 1) return null;
  let spike = null, strong = null;
  for (let i = n - B_WINDOW; i < n; i++) {
    const base = avg(s.slice(i - VOL_BASE, i).map(d => d.volume));
    const ratio = base > 0 ? s[i].volume / base : 0;
    const bodyPct = s[i].open > 0 ? ((s[i].close - s[i].open) / s[i].open) * 100 : 0;
    if (s[i].close > s[i].open && ratio >= VOL_SPIKE_MULT && (!spike || ratio > spike.ratio)) {
      spike = { date: s[i].date, ratio: parseFloat(ratio.toFixed(1)) };
    }
    if (bodyPct >= STRONG_BULL_PCT && (!strong || bodyPct > strong.pct)) {
      strong = { date: s[i].date, pct: parseFloat(bodyPct.toFixed(1)) };
    }
  }
  const recentAvg = avg(s.slice(n - B_WINDOW).map(d => d.volume));
  const prevAvg = avg(s.slice(n - B_WINDOW - VOL_BASE, n - B_WINDOW).map(d => d.volume));
  const volRatio = prevAvg > 0 ? recentAvg / prevAvg : 0;
  if (!spike || !strong || volRatio < VOL_AVG_MULT) return null;
  return { spike, strong, volRatio: parseFloat(volRatio.toFixed(1)) };
}

const dayRangePct = (d) => (d.close > 0 ? ((d.high - d.low) / d.close) * 100 : 0);

function checkC(s) {
  const n = s.length;
  if (n < 61) return null;
  const pre = s.slice(n - 60, n - 30);
  const base = s.slice(n - 30, n - 10);
  const recent = s.slice(n - 10);
  const shrinkRatio = avg(pre.map(dayRangePct)) > 0 ? avg(base.map(dayRangePct)) / avg(pre.map(dayRangePct)) : 9;
  const noBreak = Math.min(...recent.map(d => d.low)) >= Math.min(...base.map(d => d.low)) * 0.99;
  const volDown = avg(base.map(d => d.volume)) < avg(pre.map(d => d.volume));
  const volUp = avg(recent.map(d => d.volume)) > avg(base.map(d => d.volume));
  if (shrinkRatio > RANGE_SHRINK_RATIO || !noBreak || !volDown || !volUp) return null;
  return { shrinkRatio: parseFloat(shrinkRatio.toFixed(2)) };
}

function checkD(s) {
  const n = s.length;
  if (n < 118) return null;
  const closes = s.map(d => d.close);
  const last = n - 1;
  const ma112 = sma(closes, 112, last);
  const ma5 = sma(closes, 5, last), ma20 = sma(closes, 20, last), ma20Prev = sma(closes, 20, last - 5);
  if ([ma112, ma5, ma20, ma20Prev].some(v => v === null)) return null;
  const close = closes[last];
  const gap112 = ((close - ma112) / ma112) * 100;
  const high20 = Math.max(...s.slice(n - 21, n - 1).map(d => d.high));
  const highGap = ((high20 - close) / high20) * 100;
  if (gap112 < 0 || gap112 > BREAKOUT_MAX_PCT) return null;
  if (!(ma5 > ma20 && ma20 >= ma20Prev)) return null;
  if (highGap > NEAR_HIGH_PCT) return null;
  return { ma5: Math.round(ma5), ma20: Math.round(ma20), ma112: Math.round(ma112), gap112: parseFloat(gap112.toFixed(1)), highGap: parseFloat(highGap.toFixed(1)) };
}

// A 장기 하락: 448 > 224 > 112일선 역배열 + 252거래일 고점 대비 30%↑ 하락 (448일치 시세 필요)
function checkA(s) {
  const n = s.length;
  if (n < 448) return null;
  const closes = s.map(d => d.close);
  const last = n - 1;
  const ma112 = sma(closes, 112, last), ma224 = sma(closes, 224, last), ma448 = sma(closes, 448, last);
  if (!(ma448 > ma224 && ma224 > ma112)) return null;
  const high = Math.max(...s.slice(n - HIGH_WINDOW).map(d => d.high));
  const dropPct = ((high - closes[last]) / high) * 100;
  if (dropPct < DROP_FROM_HIGH_PCT) return null;
  return { ma224: Math.round(ma224), ma448: Math.round(ma448), dropPct: parseFloat(dropPct.toFixed(1)) };
}

let scanInFlight = null;
export function runYeokmaegongpaScan() {
  if (scanInFlight) return scanInFlight;
  scanInFlight = executeScan().finally(() => { scanInFlight = null; });
  return scanInFlight;
}

async function executeScan() {
  console.log('\n[YEOKMAEGONGPA] "역매공파" 스캔 시작...');
  const startTime = Date.now();

  const [kospi, kosdaq] = await Promise.all([fetchFullNormalUniverse(0), fetchFullNormalUniverse(1)]);
  const universe = [...kospi, ...kosdaq].filter(s => s.marketCap >= MIN_MARKET_CAP);
  console.log(`[YEOKMAEGONGPA] 스캔 대상: ${universe.length}종목 (시총 ${MIN_MARKET_CAP}억 이상)`);

  // 화면에서 조건별 체크박스로 켜고 끌 수 있도록, 종목마다 A~E를 전부 독립적으로 평가해서
  // 하나라도 통과한 종목은 조건별 통과 여부(flags)와 상세 수치를 함께 저장한다.
  const funnel = { scanned: universe.length, A: 0, B: 0, C: 0, D: 0, all: 0 };
  const candidates = [];

  const batchSize = 8;
  for (let i = 0; i < universe.length; i += batchSize) {
    const batch = universe.slice(i, i + batchSize);
    await Promise.all(batch.map(async (stock) => {
      const series = await fetchDailySeries(stock.code, STAGE2_PAGES);
      if (!series || series.length < 118) return;
      const r = { A: checkA(series), B: checkB(series), C: checkC(series), D: checkD(series) };
      const flags = {};
      let passed = 0;
      for (const k of ['A', 'B', 'C', 'D']) {
        flags[k] = !!r[k];
        if (r[k]) { funnel[k]++; passed++; }
      }
      if (passed === 0) return;
      candidates.push({
        code: stock.code, name: stock.name, market: stock.market, price: stock.price,
        changePct: stock.changePct, marketCap: stock.marketCap, passed, flags,
        ...(r.A || {}), ...(r.B || {}), ...(r.C || {}), ...(r.D || {}),
      });
    }));
    if (i + batchSize < universe.length) await new Promise(r => setTimeout(r, 150));
    process.stdout.write(`\r[YEOKMAEGONGPA] 진행: ${Math.min(i + batchSize, universe.length)}/${universe.length} (후보 ${candidates.length})`);
  }
  console.log('');

  // 관리종목/거래정지 제외 (조건을 하나라도 통과한 후보에만 종목별 상태 조회)
  const matched = [];
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const excluded = await Promise.all(batch.map(c => isExcludedStock(c.code)));
    batch.forEach((c, idx) => { if (!excluded[idx]) matched.push(c); });
  }
  // 체크박스 숫자가 실제 목록 개수와 일치하도록, 관리종목/거래정지 제외까지 끝난 뒤 다시 센다
  for (const k of ['A', 'B', 'C', 'D']) funnel[k] = matched.filter(m => m.flags[k]).length;
  funnel.all = matched.filter(m => m.passed === 4).length;
  matched.sort((a, b) => (b.passed - a.passed) || ((b.dropPct || 0) - (a.dropPct || 0)));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const cache = { lastSyncAt: new Date().toISOString(), elapsedSec: parseFloat(elapsed), funnel, matched };
  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
  console.log(`[YEOKMAEGONGPA] ✅ 완료! ${elapsed}초. A ${funnel.A} / B ${funnel.B} / C ${funnel.C} / D ${funnel.D} → 전체 충족 ${funnel.all}종목 (저장 후보 ${matched.length})`);
  return cache;
}

export function getYeokmaegongpaCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8')); } catch { return null; }
}

export function isYeokmaegongpaStale() {
  const cache = getYeokmaegongpaCache();
  if (!cache?.lastSyncAt) return true;
  return (Date.now() - new Date(cache.lastSyncAt).getTime()) > 20 * 60 * 60 * 1000;
}

// 일봉 기준 패턴이라 장 마감 후(16:00) 하루 한 번 + 서버 기동 시 캐시가 오래됐을 때만 즉시 1회
export function startDailyYeokmaegongpaScan() {
  const scheduleNext = () => {
    const now = new Date();
    const target = new Date(now);
    target.setHours(16, 0, 0, 0);
    if (now >= target) target.setDate(target.getDate() + 1);
    const msUntil = target.getTime() - now.getTime();
    console.log(`[YEOKMAEGONGPA] 다음 자동 스캔: ${target.toLocaleString('ko-KR')} (${Math.round(msUntil / 60000)}분 후)`);
    setTimeout(async () => {
      try { await runYeokmaegongpaScan(); } catch (e) { console.error('[YEOKMAEGONGPA] 자동 스캔 실패:', e.message); }
      scheduleNext();
    }, msUntil);
  };
  if (isYeokmaegongpaStale()) {
    runYeokmaegongpaScan().then(scheduleNext).catch(e => { console.error('[YEOKMAEGONGPA] 초기 스캔 실패:', e.message); scheduleNext(); });
  } else {
    scheduleNext();
  }
}
