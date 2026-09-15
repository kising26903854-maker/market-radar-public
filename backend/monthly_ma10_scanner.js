// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎯 monthly_ma10_scanner.js
// 월봉 10이평선(10개월 이동평균)을 깨지 않고 지지하며 2개월 연속 상승 중인 종목 스캐너
// - 코스피 + 코스닥 시총 상위 유니버스 대상
// - 종목별 최근 24개월 월봉(OHLC) 수집 (네이버 fchart 월봉 API, 종목당 1회 요청)
// - 최근 N개월간 월봉 종가가 10개월 이평선을 한 번도 깨지 않았는지(지지) 확인
// - 최근 2개월 연속 전월 대비 상승했는지 확인 ("2달째 올라가는 중")
// - 매일 09:05 자동 갱신 + 캐시 저장
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchMarketCapUniverse } from './kospi_kosdaq_scanner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, 'data', 'monthly_ma10_cache.json');

const HEADERS = { 'User-Agent': 'Mozilla/5.0' };

const MIN_MARKET_CAP = 500; // 억원 — 유동성 낮은 소형주 제외
const KOSPI_SCAN_PAGES = 4; // 시총 상위 약 400종목 (marketValue API는 페이지당 100종목, 시총 내림차순 정렬)
const KOSDAQ_SCAN_PAGES = 3; // 시총 상위 약 300종목

const MA_PERIOD = 10; // 월봉 이동평균 기간(개월)
const FETCH_COUNT = 24; // 조회할 월봉 개수(2년)
const MIN_MONTHS_REQUIRED = MA_PERIOD + 5; // 최소 확보되어야 하는 월봉 개수
const SUPPORT_TOLERANCE = 0.98; // 종가가 10이평선의 이 비율 이상이면 "지지 유지"로 인정(2% 이내 이탈 허용)
const MIN_STREAK_MONTHS = 4; // 최근 연속 지지 개월 수 최소치
const MIN_TWO_MONTH_GAIN_PCT = 3; // 최근 2개월 누적 상승률 최소치

// ─── 1. 종목별 월봉(OHLC) 수집 (네이버 fchart, 1회 요청) — 기본 24개월, count로 확장 가능(백테스트용) ───
export async function fetchMonthlySeries(code, count = FETCH_COUNT) {
  try {
    const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=month&count=${count}&requestType=0`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 4500 });
    const raw = typeof res.data === 'string' ? res.data : String(res.data);

    const series = [];
    const itemRegex = /<item data="([^"]+)"/g;
    let m;
    while ((m = itemRegex.exec(raw)) !== null) {
      const parts = m[1].split('|');
      if (parts.length < 6) continue;
      const [date, open, high, low, close, volume] = parts;
      const c = parseFloat(close);
      const o = parseFloat(open);
      const h = parseFloat(high);
      const l = parseFloat(low);
      if (!c || c <= 0) continue;
      series.push({ date, open: o, high: h, low: l, close: c, volume: parseFloat(volume) || 0 });
    }

    // fchart는 과거→현재 오름차순으로 반환되지만, 방어적으로 날짜순 재정렬
    series.sort((a, b) => a.date.localeCompare(b.date));
    return series;
  } catch (e) {
    return [];
  }
}

// ─── 2. 월봉 10이평선 지지 + 2개월 연속 상승 패턴 판정 ───
export function detectMonthlyMA10Support(series) {
  if (!series || series.length < MIN_MONTHS_REQUIRED) return null;

  const ma10 = new Array(series.length).fill(null);
  for (let i = MA_PERIOD - 1; i < series.length; i++) {
    let sum = 0;
    for (let k = i - MA_PERIOD + 1; k <= i; k++) sum += series[k].close;
    ma10[i] = sum / MA_PERIOD;
  }

  const checkStart = MA_PERIOD - 1;
  const checkEnd = series.length - 1;

  // 최근 연속 지지 개월수: 가장 최근 달부터 거슬러 올라가며 종가가 10이평선을 지켰는지 확인
  let streak = 0;
  let totalMargin = 0;
  for (let i = checkEnd; i >= checkStart; i--) {
    const marginPct = (series[i].close / ma10[i] - 1) * 100;
    if (series[i].close >= ma10[i] * SUPPORT_TOLERANCE) {
      streak++;
      totalMargin += marginPct;
    } else {
      break;
    }
  }
  if (streak < MIN_STREAK_MONTHS) return null; // 최근 지지 기록이 충분치 않음(=최근에 깨진 적 있음)

  const last = series.length - 1;
  const closeNow = series[last].close;
  const closePrev1 = series[last - 1].close;
  const closePrev2 = series[last - 2].close;

  // "2달째 올라가고 있는" = 최근 2개월 연속 전월 대비 상승
  if (!(closeNow > closePrev1 && closePrev1 > closePrev2)) return null;

  const twoMonthGainPct = (closeNow / closePrev2 - 1) * 100;
  if (twoMonthGainPct < MIN_TWO_MONTH_GAIN_PCT) return null;

  const currentMa10 = ma10[last];
  const currentMarginPct = (closeNow / currentMa10 - 1) * 100;
  const avgMarginPct = totalMargin / streak;

  let status = '📈 10선 지지 상승';
  if (currentMarginPct <= 5) status = '🎯 10선 밀착 지지';
  else if (currentMarginPct > 15) status = '🚀 10선 위 강한 상승';

  const consistencyScore = Math.min(20, streak) * 1.0; // 최대 20
  const gainScore = Math.min(25, Math.max(0, twoMonthGainPct)) * 0.8; // 최대 20
  const marginScore = Math.max(0, 20 - Math.abs(currentMarginPct - 8)); // 여유폭 8% 부근을 이상적으로 평가
  const score = Math.max(0, Math.min(100, Math.round(consistencyScore + gainScore + marginScore + 15)));

  return {
    ma10: parseFloat(currentMa10.toFixed(2)),
    currentPrice: closeNow,
    currentDate: series[last].date,
    prevMonthClose: closePrev1,
    prevMonth2Close: closePrev2,
    supportStreakMonths: streak,
    marginPct: parseFloat(currentMarginPct.toFixed(1)),
    avgMarginPct: parseFloat(avgMarginPct.toFixed(1)),
    twoMonthGainPct: parseFloat(twoMonthGainPct.toFixed(1)),
    status,
    score,
  };
}

// ─── 3. 전체 스캔 실행 (코스피 + 코스닥) ───
let scanInFlight = null;

export function runMonthlyMA10Scan() {
  if (scanInFlight) {
    console.log('[MONTHLY MA10] 이미 스캔이 진행 중이라 요청을 건너뜁니다.');
    return scanInFlight;
  }
  scanInFlight = executeMonthlyMA10Scan().finally(() => { scanInFlight = null; });
  return scanInFlight;
}

async function executeMonthlyMA10Scan() {
  console.log('\n[MONTHLY MA10] 월봉 10이평선 지지 + 2개월 연속 상승 패턴 스캔 시작...');
  const startTime = Date.now();

  const [kospiStocks, kosdaqStocks] = await Promise.all([
    fetchMarketCapUniverse(0, KOSPI_SCAN_PAGES),
    fetchMarketCapUniverse(1, KOSDAQ_SCAN_PAGES),
  ]);

  const universe = [...kospiStocks, ...kosdaqStocks].filter(s => s.marketCap >= MIN_MARKET_CAP);
  console.log(`[MONTHLY MA10] 스캔 대상: ${universe.length}종목 (시총 상위, 코스피 ${kospiStocks.length} + 코스닥 ${kosdaqStocks.length})`);

  const matches = [];
  const batchSize = 12;
  for (let i = 0; i < universe.length; i += batchSize) {
    const batch = universe.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async (s) => {
      const series = await fetchMonthlySeries(s.code);
      const pattern = detectMonthlyMA10Support(series);
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
    process.stdout.write(`\r[MONTHLY MA10] 진행: ${Math.min(i + batchSize, universe.length)}/${universe.length}종목 (발굴: ${matches.length})`);
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

  console.log(`[MONTHLY MA10] ✅ 완료! ${elapsed}초 소요. ${matches.length}종목 발굴 (코스피 ${kospiMatches.length} / 코스닥 ${kosdaqMatches.length}) → ${CACHE_PATH}`);
  return cache;
}

// ─── 4. 캐시 읽기 ───
export function getMonthlyMA10Cache() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch { return null; }
}

// ─── 5. 캐시 만료 확인 (24시간) ───
export function isMonthlyMA10ScanStale() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return true;
    const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    const hoursSince = (Date.now() - new Date(cache.lastSyncAt).getTime()) / 3600000;
    return hoursSince > 24;
  } catch { return true; }
}

// ─── 6. 매일 09:05 자동 스캔 스케줄러 ───
export function startDailyMonthlyMA10Scan() {
  const scheduleNext = () => {
    const now = new Date();
    const target = new Date(now);
    target.setHours(9, 5, 0, 0);
    if (now >= target) target.setDate(target.getDate() + 1);
    const msUntil = target.getTime() - now.getTime();
    console.log(`[MONTHLY MA10] 다음 자동 스캔: ${target.toLocaleString('ko-KR')} (${Math.round(msUntil / 60000)}분 후)`);
    setTimeout(async () => {
      await runMonthlyMA10Scan();
      scheduleNext();
    }, msUntil);
  };

  if (isMonthlyMA10ScanStale()) {
    console.log('[MONTHLY MA10] 캐시 없음 또는 만료 → 즉시 스캔 시작 (백그라운드)');
    runMonthlyMA10Scan().then(() => scheduleNext()).catch(e => {
      console.error('[MONTHLY MA10] 초기 스캔 실패:', e.message);
      scheduleNext();
    });
  } else {
    console.log('[MONTHLY MA10] 캐시 유효. 다음 예약 시간에 스캔합니다.');
    scheduleNext();
  }
}
