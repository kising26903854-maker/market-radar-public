// leading_stock_screener.js — 🚀 "오늘의 주도주" 스크리너
//
// 조건식(그대로 구현):
// A and B and ((C and D) or (E and F)) and (G or H) and (I or J) and (K or L) and (M or N)
//
// A  시가총액 1,000억원 이상
// B  거래대금 순위 상위 100 (코스피+코스닥 통합)
// C  최근 12봉 이내 (전일종가 대비 당일고가) 15% 이상인 날이 있음
// D  최근 12봉 이내 거래대금 900억원 이상인 날이 있음
// E  최근 12봉 이내 (전일종가 대비 당일고가) 5% 이상인 날이 있음
// F  최근 12봉 이내 거래대금 1조원 이상인 날이 있음
// G  종가가 20일선 위
// H  상장 22일 이내(신규주라 20일선 계산 불가 → 조건 면제)
// I  종가가 60일선 위
// J  상장 62일 이내(신규주라 60일선 계산 불가 → 조건 면제)
// K  주봉 종가가 52주 신고가 대비 -33% 이내
// L  상장 298일 이내(52주치 데이터가 없는 신규주 → 조건 면제)
// M  종가가 최근 12봉 신고가 대비 -17% 이내
// N  상장 12일 이내(12봉치 데이터가 없는 신규주 → 조건 면제)
//
// ⚠️ 이 앱에는 종목별 정확한 상장일 데이터 소스가 없어서, "상장 N일 이내"는 일봉 시세
// 이력 전체 개수가 N 이하인지로 근사 판정한다(실제 상장일과 며칠 오차가 날 수 있음).
// 거래대금(D/F)은 일별 원본 거래대금 이력이 없어 종가×거래량으로 근사한다.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchMarketCapUniverse } from './kospi_kosdaq_scanner.js';
import { fetchDailySeries } from './double_bottom_scanner.js';
import { getStockChartData } from './stock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, 'data', 'leading_stock_cache.json');

const MIN_MARKET_CAP_EOK = 1000;       // A: 시총 1,000억원(100십억원) 이상
const TOP_TRADING_VALUE_RANK = 100;    // B

const BURST_WINDOW = 12;
const C_PCT = 0.15, D_VALUE = 90_000 * 1_000_000;   // D: 90,000백만원 = 900억원
const E_PCT = 0.05, F_VALUE = 1_000_000 * 1_000_000; // F: 1,000,000백만원 = 1조원

const MA_SHORT = 20, MA_SHORT_LISTING_DAYS = 22;   // G / H
const MA_LONG = 60, MA_LONG_LISTING_DAYS = 62;     // I / J
const WEEK_HIGH_WINDOW = 52, WEEK_GAP_PCT = 0.33, WEEK_LISTING_DAYS = 298; // K / L
const DAY_HIGH_WINDOW = 12, DAY_GAP_PCT = 0.17, DAY_LISTING_DAYS = 12;     // M / N

function sma(closes, period, endIdx) {
  if (endIdx - period + 1 < 0) return null;
  let sum = 0;
  for (let k = endIdx - period + 1; k <= endIdx; k++) sum += closes[k];
  return sum / period;
}

// 상장일 데이터가 없어 보유 일봉 개수로 "상장 N일 이내"를 근사 판정
function isWithinListingDays(dailySeries, days) {
  return dailySeries.length > 0 && dailySeries.length <= days;
}

// C/D 또는 E/F: 최근 windowSize봉 이내에 각 조건을 만족하는 날이(독립적으로) 있었는지
function checkBurst(dailySeries, pctThreshold, valueThreshold, windowSize) {
  const n = dailySeries.length;
  const start = Math.max(1, n - windowSize);
  let hitPct = false, hitValue = false, pctDate = null, valueDate = null;
  for (let i = start; i < n; i++) {
    const bar = dailySeries[i];
    const prevClose = dailySeries[i - 1].close;
    if (prevClose > 0 && (bar.high - prevClose) / prevClose >= pctThreshold) {
      hitPct = true; pctDate = pctDate || bar.date;
    }
    const approxValue = bar.close * bar.volume; // 원본 거래대금 이력이 없어 종가×거래량으로 근사
    if (approxValue >= valueThreshold) { hitValue = true; valueDate = valueDate || bar.date; }
  }
  return { ok: hitPct && hitValue, pctDate, valueDate };
}

function maAboveClose(dailySeries, period) {
  const closes = dailySeries.map(d => d.close);
  const idx = closes.length - 1;
  const maVal = sma(closes, period, idx);
  if (maVal === null) return { pass: null, maVal: null };
  return { pass: closes[idx] >= maVal, maVal: Math.round(maVal) };
}

function highProximity(series, windowSize, gapPct) {
  if (!series || series.length === 0) return { pass: null, highVal: null, gapPct: null };
  const window = series.slice(-windowSize);
  const highVal = Math.max(...window.map(w => w.high));
  const lastClose = series[series.length - 1].close;
  if (highVal <= 0) return { pass: null, highVal: null, gapPct: null };
  const gap = ((lastClose - highVal) / highVal) * 100; // 0 이하 값 (고점 대비 몇 % 낮은지)
  return { pass: gap >= -gapPct * 100, highVal, gapPct: parseFloat(gap.toFixed(1)) };
}

async function evaluateStock(candidate) {
  const { code, name, market, price, changePct, marketCap, tradingValue } = candidate;
  const dailySeries = await fetchDailySeries(code, 6); // 최대 ~360거래일
  if (!dailySeries || dailySeries.length < 2) return null;

  const burst1 = checkBurst(dailySeries, C_PCT, D_VALUE, BURST_WINDOW); // C and D
  const burst2 = checkBurst(dailySeries, E_PCT, F_VALUE, BURST_WINDOW); // E and F
  if (!burst1.ok && !burst2.ok) return null;

  const listedWithin22 = isWithinListingDays(dailySeries, MA_SHORT_LISTING_DAYS);
  const listedWithin62 = isWithinListingDays(dailySeries, MA_LONG_LISTING_DAYS);
  const listedWithin298 = isWithinListingDays(dailySeries, WEEK_LISTING_DAYS);
  const listedWithin12 = isWithinListingDays(dailySeries, DAY_LISTING_DAYS);

  const ma20 = maAboveClose(dailySeries, MA_SHORT);
  if (!(ma20.pass === true || listedWithin22)) return null; // G or H

  const ma60 = maAboveClose(dailySeries, MA_LONG);
  if (!(ma60.pass === true || listedWithin62)) return null; // I or J

  const dayHigh = highProximity(dailySeries, DAY_HIGH_WINDOW, DAY_GAP_PCT);
  if (!(dayHigh.pass === true || listedWithin12)) return null; // M or N

  // 여기까지 통과한 종목만 주봉까지 추가 조회 (52주 신고가 근접 판정)
  const weeklySeries = await getStockChartData(code, 'week').catch(() => []);
  const weekHigh = highProximity(weeklySeries, WEEK_HIGH_WINDOW, WEEK_GAP_PCT);
  if (!(weekHigh.pass === true || listedWithin298)) return null; // K or L

  const burstType = burst1.ok && burst2.ok ? 'BOTH' : (burst1.ok ? 'STRONG' : 'MODERATE'); // STRONG=C&D(15%+900억), MODERATE=E&F(5%+1조)

  return {
    code, name, market, price, changePct, marketCap, tradingValue,
    burstType,
    burstDate: burst1.ok ? (burst1.pctDate || burst1.valueDate) : (burst2.pctDate || burst2.valueDate),
    ma20: ma20.maVal, ma20Pass: ma20.pass, listedWithin22,
    ma60: ma60.maVal, ma60Pass: ma60.pass, listedWithin62,
    weekHighVal: weekHigh.highVal, weekHighGapPct: weekHigh.gapPct, listedWithin298,
    dayHighVal: dayHigh.highVal, dayHighGapPct: dayHigh.gapPct, listedWithin12,
  };
}

let scanInFlight = null;
export function runLeadingStockScan() {
  if (scanInFlight) {
    console.log('[LEADING STOCK] 이미 스캔이 진행 중이라 요청을 건너뜁니다.');
    return scanInFlight;
  }
  scanInFlight = executeScan().finally(() => { scanInFlight = null; });
  return scanInFlight;
}

async function executeScan() {
  console.log('\n[LEADING STOCK] "오늘의 주도주" 스캔 시작...');
  const startTime = Date.now();

  const [kospi, kosdaq] = await Promise.all([
    fetchMarketCapUniverse(0, 26), // 코스피 최대 2,600종목
    fetchMarketCapUniverse(1, 20), // 코스닥 최대 2,000종목
  ]);
  const universe = [...kospi, ...kosdaq];

  // B: 거래대금 순위 상위 100 (통합 유니버스 기준, A 필터 적용 전)
  const top100Codes = new Set(
    [...universe].sort((a, b) => b.tradingValue - a.tradingValue).slice(0, TOP_TRADING_VALUE_RANK).map(s => s.code)
  );

  // A and B
  const candidates = universe.filter(s => s.marketCap >= MIN_MARKET_CAP_EOK && top100Codes.has(s.code));
  console.log(`[LEADING STOCK] 1차 필터(시총 ${MIN_MARKET_CAP_EOK}억+ & 거래대금 TOP${TOP_TRADING_VALUE_RANK}) 통과: ${candidates.length}종목`);

  const matched = [];
  const batchSize = 8;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(c => evaluateStock(c).catch(() => null)));
    results.forEach(r => { if (r) matched.push(r); });
    if (i + batchSize < candidates.length) await new Promise(r => setTimeout(r, 150));
    process.stdout.write(`\r[LEADING STOCK] 진행: ${Math.min(i + batchSize, candidates.length)}/${candidates.length}종목 (발굴 ${matched.length})`);
  }
  console.log('');

  matched.sort((a, b) => b.tradingValue - a.tradingValue);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const cache = {
    lastSyncAt: new Date().toISOString(),
    elapsedSec: parseFloat(elapsed),
    totalCandidates: candidates.length,
    matched,
  };

  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');

  console.log(`[LEADING STOCK] ✅ 완료! ${elapsed}초 소요. 1차 후보 ${candidates.length}종목 중 ${matched.length}종목 최종 발굴 → ${CACHE_PATH}`);
  return cache;
}

export function getLeadingStockCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

export function isLeadingStockScanStale() {
  const cache = getLeadingStockCache();
  if (!cache?.lastSyncAt) return true;
  return (Date.now() - new Date(cache.lastSyncAt).getTime()) > 20 * 60 * 60 * 1000;
}

// 서버 기동 시 최초 1회(캐시 없거나 오래됐을 때만) + 매일 09:50 자동 재스캔
export function startDailyLeadingStockScan() {
  const scheduleNext = () => {
    const now = new Date();
    const target = new Date(now);
    target.setHours(9, 50, 0, 0);
    if (now >= target) target.setDate(target.getDate() + 1);
    const msUntil = target.getTime() - now.getTime();
    console.log(`[LEADING STOCK] 다음 자동 스캔: ${target.toLocaleString('ko-KR')} (${Math.round(msUntil / 60000)}분 후)`);
    setTimeout(async () => {
      try { await runLeadingStockScan(); } catch (e) { console.error('[LEADING STOCK] 자동 스캔 실패:', e.message); }
      scheduleNext();
    }, msUntil);
  };

  if (isLeadingStockScanStale()) {
    runLeadingStockScan().then(() => scheduleNext()).catch(e => {
      console.error('[LEADING STOCK] 초기 스캔 실패:', e.message);
      scheduleNext();
    });
  } else {
    console.log('[LEADING STOCK] 캐시 유효. 다음 예약 시간으로 스케줄합니다.');
    scheduleNext();
  }
}
