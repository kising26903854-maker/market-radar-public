// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🌱 base_breakout_scanner.js
// 하락추세 → 횡보(박스권) → 상승초입 패턴 스캐너
// - 코스피 + 코스닥 시총 상위 유니버스 대상
// - 종목별 최근 120거래일 일봉(OHLC) 수집 (double_bottom_scanner.js 재사용)
// - 하락추세 저점 탐지 → 저점 이후 박스권(횡보) 판정 → 박스 상단 돌파(상승초입) 판정
// - 매일 08:55 자동 갱신 + 캐시 저장
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchAllPages } from './kospi_kosdaq_scanner.js';
import { fetchDailySeries } from './double_bottom_scanner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, 'data', 'base_breakout_cache.json');

const MIN_MARKET_CAP = 500; // 억원 — 유동성 낮은 소형주 제외
const KOSPI_SCAN_PAGES = 8; // 시총 상위 약 400종목 (finance.naver.com은 시총 내림차순 정렬)
const KOSDAQ_SCAN_PAGES = 6; // 시총 상위 약 300종목

const MIN_DECLINE_PCT = 15; // 박스 진입 전 하락추세 최소 하락률
const MIN_CONSOL_DAYS = 15; // 횡보(박스권) 최소 거래일
const MAX_CONSOL_BAND_PCT = 18; // 박스권 고점-저점 밴드 폭 최대치
const BOX_TAIL_RESERVE = 3; // 박스 계산에서 제외할 최근 거래일(=상승초입 판정 구간)
const MIN_QUALIFY_RATIO = 0.95; // 현재가가 박스 상단의 이 비율 이상이어야 "상승초입 구간"으로 인정
const MAX_EXTENSION_PCT = 15; // 박스 상단 대비 최대 이격 (너무 많이 오른 종목은 "초입"이 아니므로 제외)
const MIN_TROUGH_LEAD_DAYS = 10; // 저점이 데이터 시작부에서 최소 이만큼 떨어져 있어야 함(하락추세 확인 여유)

// ─── 1. 하락추세 저점 탐색 (박스 하단 = 하락추세 최종 저점) ───
function findTroughIndex(series) {
  const searchEnd = series.length - 1 - MIN_CONSOL_DAYS - BOX_TAIL_RESERVE;
  if (searchEnd <= MIN_TROUGH_LEAD_DAYS) return -1;

  let minIdx = -1;
  let minLow = Infinity;
  for (let i = MIN_TROUGH_LEAD_DAYS; i <= searchEnd; i++) {
    if (series[i].low < minLow) { minLow = series[i].low; minIdx = i; }
  }
  return minIdx;
}

// ─── 2. 하락추세 → 횡보(박스권) → 상승초입 패턴 판정 ───
export function detectBaseBreakout(series) {
  if (!series || series.length < 45) return null;

  const troughIdx = findTroughIndex(series);
  if (troughIdx < 0) return null;

  // 하락추세 확인: 저점 진입 전 45거래일 내 고점 대비 하락률
  const preStart = Math.max(0, troughIdx - 45);
  let priorHigh = -Infinity;
  for (let k = preStart; k <= troughIdx; k++) {
    if (series[k].high > priorHigh) priorHigh = series[k].high;
  }
  const troughLow = series[troughIdx].low;
  const declinePct = (priorHigh - troughLow) / priorHigh * 100;
  if (declinePct < MIN_DECLINE_PCT) return null;

  // 횡보(박스권) 구간: 저점 ~ (최근 BOX_TAIL_RESERVE일 제외 지점)
  const boxEnd = series.length - 1 - BOX_TAIL_RESERVE;
  if (boxEnd - troughIdx < MIN_CONSOL_DAYS) return null;

  let boxHigh = -Infinity;
  let boxLow = Infinity;
  for (let k = troughIdx; k <= boxEnd; k++) {
    if (series[k].high > boxHigh) boxHigh = series[k].high;
    if (series[k].low < boxLow) boxLow = series[k].low;
  }
  const bandPct = (boxHigh - boxLow) / boxLow * 100;
  if (bandPct > MAX_CONSOL_BAND_PCT) return null; // 박스가 너무 넓으면(=여전히 출렁이는 중) 제외

  const lastBar = series[series.length - 1];
  if (lastBar.close < boxHigh * MIN_QUALIFY_RATIO) return null; // 아직 박스 하단권 → "상승초입" 아님

  const extensionPct = ((lastBar.close - boxHigh) / boxHigh) * 100;
  if (extensionPct > MAX_EXTENSION_PCT) return null; // 이미 많이 오른 종목은 "초입"이 아니므로 제외

  const consolDays = boxEnd - troughIdx + 1;

  let status = '📦 박스권 상단 임박';
  if (extensionPct > 6) status = '🚀 상승 진행중';
  else if (extensionPct > 0) status = '🌱 상승초입 돌파';

  const declineScore = Math.min(25, declinePct) * 0.8;
  const tightnessScore = Math.max(0, MAX_CONSOL_BAND_PCT - bandPct) * 1.2;
  const durationScore = Math.min(30, consolDays) * 0.5;
  const freshnessScore = extensionPct <= 0 ? 15 : Math.max(0, 15 - extensionPct);
  const score = Math.max(0, Math.min(100, Math.round(declineScore + tightnessScore + durationScore + freshnessScore)));

  return {
    trough: { date: series[troughIdx].date, price: troughLow },
    box: {
      high: boxHigh,
      low: boxLow,
      startDate: series[troughIdx].date,
      endDate: series[boxEnd].date,
    },
    declinePct: parseFloat(declinePct.toFixed(1)),
    bandPct: parseFloat(bandPct.toFixed(1)),
    extensionPct: parseFloat(extensionPct.toFixed(1)),
    consolDays,
    currentPrice: lastBar.close,
    currentDate: lastBar.date,
    status,
    score,
  };
}

// ─── 3. 전체 스캔 실행 (코스피 + 코스닥) ───
let scanInFlight = null;

export function runBaseBreakoutScan() {
  if (scanInFlight) {
    console.log('[BASE BREAKOUT] 이미 스캔이 진행 중이라 요청을 건너뜁니다.');
    return scanInFlight;
  }
  scanInFlight = executeBaseBreakoutScan().finally(() => { scanInFlight = null; });
  return scanInFlight;
}

async function executeBaseBreakoutScan() {
  console.log('\n[BASE BREAKOUT] 하락추세→횡보→상승초입 패턴 스캔 시작...');
  const startTime = Date.now();

  const [kospiStocks, kosdaqStocks] = await Promise.all([
    fetchAllPages(0, KOSPI_SCAN_PAGES),
    fetchAllPages(1, KOSDAQ_SCAN_PAGES),
  ]);

  const universe = [...kospiStocks, ...kosdaqStocks].filter(s => s.marketCap >= MIN_MARKET_CAP);
  console.log(`[BASE BREAKOUT] 스캔 대상: ${universe.length}종목 (시총 상위, 코스피 ${kospiStocks.length} + 코스닥 ${kosdaqStocks.length})`);

  const matches = [];
  const batchSize = 10;
  for (let i = 0; i < universe.length; i += batchSize) {
    const batch = universe.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async (s) => {
      const series = await fetchDailySeries(s.code);
      const pattern = detectBaseBreakout(series);
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
    process.stdout.write(`\r[BASE BREAKOUT] 진행: ${Math.min(i + batchSize, universe.length)}/${universe.length}종목 (발굴: ${matches.length})`);
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

  console.log(`[BASE BREAKOUT] ✅ 완료! ${elapsed}초 소요. ${matches.length}종목 발굴 (코스피 ${kospiMatches.length} / 코스닥 ${kosdaqMatches.length}) → ${CACHE_PATH}`);
  return cache;
}

// ─── 4. 캐시 읽기 ───
export function getBaseBreakoutCache() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch { return null; }
}

// ─── 5. 캐시 만료 확인 (24시간) ───
export function isBaseBreakoutScanStale() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return true;
    const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    const hoursSince = (Date.now() - new Date(cache.lastSyncAt).getTime()) / 3600000;
    return hoursSince > 24;
  } catch { return true; }
}

// ─── 6. 매일 08:55 자동 스캔 스케줄러 ───
export function startDailyBaseBreakoutScan() {
  const scheduleNext = () => {
    const now = new Date();
    const target = new Date(now);
    target.setHours(8, 55, 0, 0);
    if (now >= target) target.setDate(target.getDate() + 1);
    const msUntil = target.getTime() - now.getTime();
    console.log(`[BASE BREAKOUT] 다음 자동 스캔: ${target.toLocaleString('ko-KR')} (${Math.round(msUntil / 60000)}분 후)`);
    setTimeout(async () => {
      await runBaseBreakoutScan();
      scheduleNext();
    }, msUntil);
  };

  if (isBaseBreakoutScanStale()) {
    console.log('[BASE BREAKOUT] 캐시 없음 또는 만료 → 즉시 스캔 시작 (백그라운드)');
    runBaseBreakoutScan().then(() => scheduleNext()).catch(e => {
      console.error('[BASE BREAKOUT] 초기 스캔 실패:', e.message);
      scheduleNext();
    });
  } else {
    console.log('[BASE BREAKOUT] 캐시 유효. 다음 예약 시간에 스캔합니다.');
    scheduleNext();
  }
}
