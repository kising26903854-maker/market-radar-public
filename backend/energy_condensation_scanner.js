// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 💥 energy_condensation_scanner.js
// 에너지 응축(변동성·거래량 수축) 후 거래량 급증 + 저항선 돌파 스캐너
// - 코스피 + 코스닥 시총 상위 유니버스 대상
// - 종목별 최근 120거래일 일봉(OHLC+거래량) 수집 (double_bottom_scanner.js 재사용)
// - 최근 구간의 변동폭·거래량이 직전 구간 대비 충분히 수축했는지 확인(에너지 응축)
// - 응축구간 고점(저항선)을 거래량 급증과 함께 돌파했는지 판정
// - 매일 09:00 자동 갱신 + 캐시 저장
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchAllPages } from './kospi_kosdaq_scanner.js';
import { fetchDailySeries } from './double_bottom_scanner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, 'data', 'energy_condensation_cache.json');

const MIN_MARKET_CAP = 500; // 억원 — 유동성 낮은 소형주 제외
const KOSPI_SCAN_PAGES = 8; // 시총 상위 약 400종목 (finance.naver.com은 시총 내림차순 정렬)
const KOSDAQ_SCAN_PAGES = 6; // 시총 상위 약 300종목

const CONTRACTION_WINDOW = 15; // 에너지 응축(박스) 판정 구간 길이(거래일)
const PRIOR_WINDOW = 30; // 응축 이전과 비교할 직전 구간 길이(거래일)
const BREAKOUT_TAIL = 3; // 최근 며칠 내 거래량 돌파 여부를 확인하는 구간
const MAX_RECENT_RANGE_PCT = 14; // 응축구간 밴드폭(고점-저점) 상한
const MIN_CONTRACTION_RATIO = 0.6; // 응축구간 밴드폭이 직전구간의 이 비율 이하여야 "충분히 수축"
const MIN_VOLUME_DRYUP_RATIO = 0.8; // 응축구간 평균거래량이 직전구간의 이 비율 이하여야 "거래량 마름"
const VOLUME_SURGE_MULT = 1.8; // 돌파일 거래량이 응축구간 평균거래량의 이 배수 이상이면 "거래량 급증"
const MAX_EXTENSION_PCT = 12; // 저항선 대비 최대 이격(너무 늦은 돌파는 제외)
const MIN_QUALIFY_RATIO = 0.9; // 현재가가 저항선의 이 비율 이상이어야 후보로 인정(저항선 임박~돌파)

const avg = (arr) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);

// ─── 1. 에너지 응축(변동성·거래량 수축) → 저항선 돌파 패턴 판정 ───
export function detectEnergyCondensation(series) {
  if (!series || series.length < PRIOR_WINDOW + CONTRACTION_WINDOW + BREAKOUT_TAIL + 5) return null;

  const coilEnd = series.length - 1 - BREAKOUT_TAIL;
  const coilStart = coilEnd - CONTRACTION_WINDOW + 1;
  const priorEnd = coilStart - 1;
  const priorStart = priorEnd - PRIOR_WINDOW + 1;
  if (priorStart < 0) return null;

  const coilZone = series.slice(coilStart, coilEnd + 1);
  const priorZone = series.slice(priorStart, priorEnd + 1);

  const coilHigh = Math.max(...coilZone.map(d => d.high));
  const coilLow = Math.min(...coilZone.map(d => d.low));
  const recentRangePct = (coilHigh - coilLow) / coilLow * 100;
  if (recentRangePct > MAX_RECENT_RANGE_PCT) return null; // 아직 충분히 좁혀지지 않음

  const priorHigh = Math.max(...priorZone.map(d => d.high));
  const priorLow = Math.min(...priorZone.map(d => d.low));
  const priorRangePct = (priorHigh - priorLow) / priorLow * 100;
  if (priorRangePct <= 0 || recentRangePct > priorRangePct * MIN_CONTRACTION_RATIO) return null; // 변동성 수축 부족

  const recentAvgVol = avg(coilZone.map(d => d.volume));
  const priorAvgVol = avg(priorZone.map(d => d.volume));
  if (priorAvgVol <= 0 || recentAvgVol > priorAvgVol * MIN_VOLUME_DRYUP_RATIO) return null; // 거래량 마름 부족

  const resistance = coilHigh; // 저항선 = 응축구간 고점

  // 최근 BREAKOUT_TAIL 거래일 중 "거래량 급증 + 저항선 돌파" 여부 확인
  let breakoutIdx = null;
  for (let k = coilEnd + 1; k < series.length; k++) {
    if (series[k].close > resistance && series[k].volume >= recentAvgVol * VOLUME_SURGE_MULT) {
      breakoutIdx = k; // 가장 최근 매칭일을 채택 (순차 진행하며 덮어씀)
    }
  }

  const lastBar = series[series.length - 1];
  if (lastBar.close < resistance * MIN_QUALIFY_RATIO) return null; // 저항선과 아직 너무 멀리 있음

  const extensionPct = ((lastBar.close - resistance) / resistance) * 100;
  if (extensionPct > MAX_EXTENSION_PCT) return null; // 이미 신호가 지난(너무 많이 간) 종목 제외

  const todayVolumeRatio = recentAvgVol > 0 ? lastBar.volume / recentAvgVol : 0;

  let status = '🔒 저항선 임박 (응축 지속)';
  if (breakoutIdx !== null) status = '💥 거래량 돌파 신호';
  else if (lastBar.close > resistance) status = '⚡ 저항선 돌파 (거래량 미동반)';

  const rangeContractionPct = (1 - recentRangePct / priorRangePct) * 100;
  const volumeDryUpPct = (1 - recentAvgVol / priorAvgVol) * 100;

  const contractionScore = Math.min(60, Math.max(0, rangeContractionPct)) * 0.3; // 최대 18
  const dryUpScore = Math.min(60, Math.max(0, volumeDryUpPct)) * 0.25; // 최대 15
  const breakoutScore = breakoutIdx !== null ? 25 : (lastBar.close > resistance ? 12 : 0);
  const freshnessScore = extensionPct <= 0 ? 15 : Math.max(0, 15 - extensionPct);
  const volumeSurgeScore = Math.min(20, Math.max(0, (todayVolumeRatio - 1) * 10));
  const score = Math.max(0, Math.min(100, Math.round(contractionScore + dryUpScore + breakoutScore + freshnessScore + volumeSurgeScore)));

  return {
    coilBox: {
      high: coilHigh,
      low: coilLow,
      startDate: coilZone[0].date,
      endDate: coilZone[coilZone.length - 1].date,
      days: CONTRACTION_WINDOW,
    },
    resistance,
    rangeContractionPct: parseFloat(rangeContractionPct.toFixed(1)),
    volumeDryUpPct: parseFloat(volumeDryUpPct.toFixed(1)),
    extensionPct: parseFloat(extensionPct.toFixed(1)),
    todayVolumeRatio: parseFloat(todayVolumeRatio.toFixed(2)),
    breakoutDate: breakoutIdx !== null ? series[breakoutIdx].date : null,
    currentPrice: lastBar.close,
    currentDate: lastBar.date,
    status,
    score,
  };
}

// ─── 2. 전체 스캔 실행 (코스피 + 코스닥) ───
let scanInFlight = null;

export function runEnergyCondensationScan() {
  if (scanInFlight) {
    console.log('[ENERGY] 이미 스캔이 진행 중이라 요청을 건너뜁니다.');
    return scanInFlight;
  }
  scanInFlight = executeEnergyCondensationScan().finally(() => { scanInFlight = null; });
  return scanInFlight;
}

async function executeEnergyCondensationScan() {
  console.log('\n[ENERGY] 에너지 응축 → 거래량 돌파 패턴 스캔 시작...');
  const startTime = Date.now();

  const [kospiStocks, kosdaqStocks] = await Promise.all([
    fetchAllPages(0, KOSPI_SCAN_PAGES),
    fetchAllPages(1, KOSDAQ_SCAN_PAGES),
  ]);

  const universe = [...kospiStocks, ...kosdaqStocks].filter(s => s.marketCap >= MIN_MARKET_CAP);
  console.log(`[ENERGY] 스캔 대상: ${universe.length}종목 (시총 상위, 코스피 ${kospiStocks.length} + 코스닥 ${kosdaqStocks.length})`);

  const matches = [];
  const batchSize = 10;
  for (let i = 0; i < universe.length; i += batchSize) {
    const batch = universe.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(async (s) => {
      const series = await fetchDailySeries(s.code);
      const pattern = detectEnergyCondensation(series);
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
    process.stdout.write(`\r[ENERGY] 진행: ${Math.min(i + batchSize, universe.length)}/${universe.length}종목 (발굴: ${matches.length})`);
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

  console.log(`[ENERGY] ✅ 완료! ${elapsed}초 소요. ${matches.length}종목 발굴 (코스피 ${kospiMatches.length} / 코스닥 ${kosdaqMatches.length}) → ${CACHE_PATH}`);
  return cache;
}

// ─── 3. 캐시 읽기 ───
export function getEnergyCondensationCache() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch { return null; }
}

// ─── 4. 캐시 만료 확인 (24시간) ───
export function isEnergyCondensationScanStale() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return true;
    const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    const hoursSince = (Date.now() - new Date(cache.lastSyncAt).getTime()) / 3600000;
    return hoursSince > 24;
  } catch { return true; }
}

// ─── 5. 매일 09:00 자동 스캔 스케줄러 ───
export function startDailyEnergyCondensationScan() {
  const scheduleNext = () => {
    const now = new Date();
    const target = new Date(now);
    target.setHours(9, 0, 0, 0);
    if (now >= target) target.setDate(target.getDate() + 1);
    const msUntil = target.getTime() - now.getTime();
    console.log(`[ENERGY] 다음 자동 스캔: ${target.toLocaleString('ko-KR')} (${Math.round(msUntil / 60000)}분 후)`);
    setTimeout(async () => {
      await runEnergyCondensationScan();
      scheduleNext();
    }, msUntil);
  };

  if (isEnergyCondensationScanStale()) {
    console.log('[ENERGY] 캐시 없음 또는 만료 → 즉시 스캔 시작 (백그라운드)');
    runEnergyCondensationScan().then(() => scheduleNext()).catch(e => {
      console.error('[ENERGY] 초기 스캔 실패:', e.message);
      scheduleNext();
    });
  } else {
    console.log('[ENERGY] 캐시 유효. 다음 예약 시간에 스캔합니다.');
    scheduleNext();
  }
}
