// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📉 double_bottom_scanner.js
// 하락추세 이후 쌍바닥(Double Bottom) 패턴 스캐너
// - 코스피 + 코스닥 전 종목 시총 상위 유니버스 대상
// - 종목별 최근 120거래일 일봉(OHLC) 수집 (네이버 모바일 API)
// - 스윙 저점 탐지 → 하락추세 + 쌍바닥 패턴 판정 → 스코어링
// - 매일 08:50 자동 갱신 + 캐시 저장
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchAllPages } from './kospi_kosdaq_scanner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, 'data', 'double_bottom_cache.json');

const HEADERS_M = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  'Referer': 'https://m.stock.naver.com/',
};

const MIN_MARKET_CAP = 500; // 억원 — 유동성 낮은 소형주 제외
const KOSPI_SCAN_PAGES = 8; // 시총 상위 약 400종목 (finance.naver.com은 시총 내림차순 정렬)
const KOSDAQ_SCAN_PAGES = 6; // 시총 상위 약 300종목
const SWING_WINDOW = 4; // 좌우 4거래일보다 낮으면 스윙 저점으로 인정
const MIN_GAP_DAYS = 8; // 두 저점 사이 최소 거래일
const MAX_GAP_DAYS = 55; // 두 저점 사이 최대 거래일
const RECENT_LOOKBACK_DAYS = 26; // 우측 바닥(2차 저점)이 이 안에 있어야 "최근" 신호로 인정
const MAX_PRICE_DIFF_PCT = 4.5; // 두 저점 가격 차이 허용 오차
const MIN_REBOUND_PCT = 5; // 두 저점 사이 넥라인 반등폭 최소치
const MIN_DECLINE_PCT = 12; // 1차 저점 진입 전 하락추세 최소 하락률

const num = (v) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0;

// ─── 1. 종목별 최근 120거래일 일봉(OHLC) 수집 (2페이지 × 60일) ───
export async function fetchDailySeries(code) {
  try {
    const [p1, p2] = await Promise.all([
      axios.get(`https://m.stock.naver.com/api/stock/${code}/price?page=1&pageSize=60`, { headers: HEADERS_M, timeout: 4500 }),
      axios.get(`https://m.stock.naver.com/api/stock/${code}/price?page=2&pageSize=60`, { headers: HEADERS_M, timeout: 4500 }),
    ]);
    const raw = [...(Array.isArray(p1.data) ? p1.data : []), ...(Array.isArray(p2.data) ? p2.data : [])];

    const seen = new Set();
    const series = raw
      .filter(d => {
        if (!d?.localTradedAt || seen.has(d.localTradedAt)) return false;
        seen.add(d.localTradedAt);
        return true;
      })
      .map(d => ({
        date: d.localTradedAt,
        open: num(d.openPrice),
        high: num(d.highPrice),
        low: num(d.lowPrice),
        close: num(d.closePrice),
        volume: d.accumulatedTradingVolume || 0,
      }))
      .filter(d => d.low > 0 && d.close > 0)
      .sort((a, b) => a.date.localeCompare(b.date)); // 과거 → 최근 순 정렬

    return series;
  } catch (e) {
    return [];
  }
}

// ─── 2. 로컬 스윙 저점(Swing Low) 탐지 ───
function findSwingLows(series, windowSize = SWING_WINDOW) {
  const lows = [];
  for (let i = windowSize; i < series.length - windowSize; i++) {
    const cur = series[i].low;
    let isLow = true;
    for (let j = i - windowSize; j <= i + windowSize; j++) {
      if (j === i) continue;
      if (series[j].low < cur) { isLow = false; break; }
    }
    if (isLow) lows.push(i);
  }
  // 인접(5거래일 이내) 저점은 더 낮은 쪽 하나만 채택
  const merged = [];
  for (const idx of lows) {
    const last = merged[merged.length - 1];
    if (last !== undefined && idx - last <= 5) {
      if (series[idx].low < series[last].low) merged[merged.length - 1] = idx;
    } else {
      merged.push(idx);
    }
  }
  return merged;
}

// ─── 3. 하락추세 진입 후 쌍바닥(Double Bottom) 패턴 판정 ───
export function detectDoubleBottom(series) {
  if (!series || series.length < 40) return null;
  const swingLows = findSwingLows(series);
  if (swingLows.length < 2) return null;

  let best = null;

  for (let a = 0; a < swingLows.length - 1; a++) {
    for (let b = a + 1; b < swingLows.length; b++) {
      const i1 = swingLows[a];
      const i2 = swingLows[b];
      const gap = i2 - i1;
      if (gap < MIN_GAP_DAYS || gap > MAX_GAP_DAYS) continue;
      if (i2 < series.length - 1 - RECENT_LOOKBACK_DAYS) continue; // 우측 바닥이 최근 구간에 있어야 함

      const low1 = series[i1].low;
      const low2 = series[i2].low;
      const priceDiffPct = Math.abs(low2 - low1) / low1 * 100;
      if (priceDiffPct > MAX_PRICE_DIFF_PCT) continue;

      // 두 저점 사이 반등 고점(넥라인)
      let neckline = -Infinity;
      let necklineIdx = i1;
      for (let k = i1 + 1; k < i2; k++) {
        if (series[k].high > neckline) { neckline = series[k].high; necklineIdx = k; }
      }
      if (!Number.isFinite(neckline)) continue;

      const avgBottom = (low1 + low2) / 2;
      const reboundPct = (neckline - avgBottom) / avgBottom * 100;
      if (reboundPct < MIN_REBOUND_PCT) continue;

      // 하락추세 확인: 1차 저점 진입 전 40거래일 고점 대비 하락률
      const preStart = Math.max(0, i1 - 40);
      let priorHigh = -Infinity;
      for (let k = preStart; k <= i1; k++) {
        if (series[k].high > priorHigh) priorHigh = series[k].high;
      }
      const declinePct = (priorHigh - low1) / priorHigh * 100;
      if (declinePct < MIN_DECLINE_PCT) continue;

      const lastBar = series[series.length - 1];
      // 우측 바닥이 무너지지 않았는지 (저점 대비 6% 이상 추가 급락 시 패턴 무효)
      if (lastBar.close < low2 * 0.94) continue;

      let status = '🔍 패턴 형성중';
      if (lastBar.close > neckline) status = '🚀 넥라인 돌파';
      else if (lastBar.close > avgBottom * 1.02) status = '⚡ 우측바닥 반등중';

      const score = Math.round(
        Math.min(30, declinePct) * 0.8 +
        Math.min(20, reboundPct) * 0.9 +
        (MAX_PRICE_DIFF_PCT - priceDiffPct) * 6 +
        (lastBar.close > neckline ? 15 : lastBar.close > avgBottom * 1.02 ? 8 : 0)
      );

      const candidate = {
        bottom1: { date: series[i1].date, price: low1 },
        bottom2: { date: series[i2].date, price: low2 },
        neckline: { date: series[necklineIdx].date, price: neckline },
        declinePct: parseFloat(declinePct.toFixed(1)),
        priceDiffPct: parseFloat(priceDiffPct.toFixed(1)),
        reboundPct: parseFloat(reboundPct.toFixed(1)),
        gapDays: gap,
        currentPrice: lastBar.close,
        currentDate: lastBar.date,
        status,
        score: Math.max(0, Math.min(100, score)),
      };

      if (!best || candidate.score > best.score) best = candidate;
    }
  }

  return best;
}

// ─── 4. 전체 스캔 실행 (코스피 + 코스닥) ───
let scanInFlight = null;

export function runDoubleBottomScan() {
  if (scanInFlight) {
    console.log('[DOUBLE BOTTOM] 이미 스캔이 진행 중이라 요청을 건너뜁니다.');
    return scanInFlight;
  }
  scanInFlight = executeDoubleBottomScan().finally(() => { scanInFlight = null; });
  return scanInFlight;
}

async function executeDoubleBottomScan() {
  console.log('\n[DOUBLE BOTTOM] 코스피+코스닥 하락추세 후 쌍바닥 패턴 스캔 시작...');
  const startTime = Date.now();

  const [kospiStocks, kosdaqStocks] = await Promise.all([
    fetchAllPages(0, KOSPI_SCAN_PAGES),
    fetchAllPages(1, KOSDAQ_SCAN_PAGES),
  ]);

  // finance.naver.com 시가총액 순위는 이미 내림차순 정렬이므로, 상위 페이지만 가져오는 것 자체가
  // "시총 상위 유니버스"로 스캔 범위를 좁히는 효과 → 스캔 속도 대폭 단축
  const universe = [...kospiStocks, ...kosdaqStocks].filter(s => s.marketCap >= MIN_MARKET_CAP);
  console.log(`[DOUBLE BOTTOM] 스캔 대상: ${universe.length}종목 (시총 상위, 코스피 ${kospiStocks.length} + 코스닥 ${kosdaqStocks.length})`);

  const matches = [];
  const batchSize = 10;
  for (let i = 0; i < universe.length; i += batchSize) {
    const batch = universe.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async (s) => {
      const series = await fetchDailySeries(s.code);
      const pattern = detectDoubleBottom(series);
      if (!pattern) return null;
      return {
        code: s.code,
        name: s.name,
        market: s.market,
        price: s.price,
        changePct: s.changePct,
        marketCap: s.marketCap,
        ...pattern,
      };
    }));
    results.forEach(r => { if (r) matches.push(r); });

    if (i + batchSize < universe.length) await new Promise(r => setTimeout(r, 150));
    process.stdout.write(`\r[DOUBLE BOTTOM] 진행: ${Math.min(i + batchSize, universe.length)}/${universe.length}종목 (발굴: ${matches.length})`);
  }
  console.log('');

  matches.sort((a, b) => b.score - a.score);
  const kospiMatches = matches.filter(m => m.market === '코스피');
  const kosdaqMatches = matches.filter(m => m.market === '코스닥');
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const cache = {
    lastSyncAt: new Date().toISOString(),
    elapsedSec: parseFloat(elapsed),
    totalScanned: universe.length,
    totalMatches: matches.length,
    kospiCount: kospiMatches.length,
    kosdaqCount: kosdaqMatches.length,
    stocks: matches.slice(0, 150),
  };

  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');

  console.log(`[DOUBLE BOTTOM] ✅ 완료! ${elapsed}초 소요. ${matches.length}종목 발굴 (코스피 ${kospiMatches.length} / 코스닥 ${kosdaqMatches.length}) → ${CACHE_PATH}`);
  return cache;
}

// ─── 5. 캐시 읽기 ───
export function getDoubleBottomCache() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch { return null; }
}

// ─── 6. 캐시 만료 확인 (24시간) ───
export function isDoubleBottomScanStale() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return true;
    const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    const hoursSince = (Date.now() - new Date(cache.lastSyncAt).getTime()) / 3600000;
    return hoursSince > 24;
  } catch { return true; }
}

// ─── 7. 매일 08:50 자동 스캔 스케줄러 ───
export function startDailyDoubleBottomScan() {
  const scheduleNext = () => {
    const now = new Date();
    const target = new Date(now);
    target.setHours(8, 50, 0, 0);
    if (now >= target) target.setDate(target.getDate() + 1);
    const msUntil = target.getTime() - now.getTime();
    console.log(`[DOUBLE BOTTOM] 다음 자동 스캔: ${target.toLocaleString('ko-KR')} (${Math.round(msUntil / 60000)}분 후)`);
    setTimeout(async () => {
      await runDoubleBottomScan();
      scheduleNext();
    }, msUntil);
  };

  if (isDoubleBottomScanStale()) {
    console.log('[DOUBLE BOTTOM] 캐시 없음 또는 만료 → 즉시 스캔 시작 (백그라운드)');
    runDoubleBottomScan().then(() => scheduleNext()).catch(e => {
      console.error('[DOUBLE BOTTOM] 초기 스캔 실패:', e.message);
      scheduleNext();
    });
  } else {
    console.log('[DOUBLE BOTTOM] 캐시 유효. 다음 예약 시간에 스캔합니다.');
    scheduleNext();
  }
}
