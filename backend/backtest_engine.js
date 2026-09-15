// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📊 backtest_engine.js
// 패턴 스캐너 과거 성과 검증 백테스트 엔진
// - 쌍바닥 / 하락→횡보→상승초입 / 에너지응축 / 골든크로스 / 월봉10이평선 지지
// - 각 스캐너의 detect...() 순수 판정 함수를 과거 시계열에 슬라이딩 윈도우로 반복 적용해서,
//   "이 패턴이 과거에 뜬 시점"마다 실제로 1/2/3/4주(월봉 스캐너는 1/2/3개월) 후 수익률이
//   어땠는지 집계한다. 미래 데이터를 미리 들여다보지 않도록(look-ahead bias 방지) 판정은
//   항상 그 시점까지의 데이터(series.slice(0, t+1))만으로 수행한다.
// - 매일 09:15 자동 갱신 + 캐시 저장
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchMarketCapUniverse } from './kospi_kosdaq_scanner.js';
import { fetchDailySeries, detectDoubleBottom } from './double_bottom_scanner.js';
import { detectBaseBreakout } from './base_breakout_scanner.js';
import { detectEnergyCondensation } from './energy_condensation_scanner.js';
import { detectGoldenCross } from './momentum_scanner.js';
import { fetchMonthlySeries, detectMonthlyMA10Support } from './monthly_ma10_scanner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, 'data', 'backtest_report_cache.json');

const KOSPI_PAGES = 3; // 시총 상위 약 300종목
const KOSDAQ_PAGES = 2; // 시총 상위 약 200종목
const MIN_MARKET_CAP = 1000; // 억원 — 백테스트는 유동성 좋은 중대형주 위주(소형주 노이즈 배제)

const DAILY_HISTORY_PAGES = 8; // 약 480거래일(~2년) 일봉 히스토리
const DAILY_STEP = 3; // 슬라이딩 윈도우 테스트 간격(거래일) — 너무 촘촘하면 신호가 서로 겹쳐 통계 왜곡
const DAILY_START_IDX = 60; // 각 detect 함수 최소 요구 길이(최대 53)보다 여유있게 시작
const DAILY_COOLDOWN = 20; // 신호 발생 후 같은 종목 재탐지까지 쿨다운(4주 관찰기간과 동일 — 신호 중복 방지)
const DAILY_HORIZONS = { '1주': 5, '2주': 10, '3주': 15, '4주': 20 }; // 거래일 기준 근사치

const MONTHLY_HISTORY_COUNT = 60; // 약 5년 월봉 히스토리
const MONTHLY_STEP = 1;
const MONTHLY_START_IDX = 15; // detectMonthlyMA10Support 최소 요구(MA_PERIOD+5=15)
const MONTHLY_COOLDOWN = 3;
const MONTHLY_HORIZONS = { '1개월': 1, '2개월': 2, '3개월': 3 };

const SCANNERS_DAILY = [
  { id: 'double_bottom', name: '쌍바닥 패턴', detect: detectDoubleBottom },
  { id: 'base_breakout', name: '하락→횡보→상승초입', detect: detectBaseBreakout },
  { id: 'energy_condensation', name: '에너지 응축 돌파', detect: detectEnergyCondensation },
  { id: 'golden_cross', name: '골든크로스', detect: detectGoldenCross },
];

// ─── 1. 단일 종목 시계열에 대해 슬라이딩 윈도우로 패턴을 반복 탐지하고 이후 수익률을 기록 ───
function backtestSeries(series, detectFn, { step, startIdx, cooldown, horizons }) {
  const signals = [];
  let cooldownUntil = -1;

  for (let t = startIdx; t < series.length; t += step) {
    if (t <= cooldownUntil) continue;

    // ⚠️ look-ahead bias 방지: t 시점까지의 데이터만 판정 함수에 넘긴다 (미래 데이터 차단)
    const windowSeries = series.slice(0, t + 1);
    const pattern = detectFn(windowSeries);
    if (!pattern) continue;

    const entryPrice = series[t].close;
    const returns = {};
    let hasAnyHorizon = false;
    for (const [label, offset] of Object.entries(horizons)) {
      const idx = t + offset;
      if (idx < series.length && series[idx]?.close > 0) {
        returns[label] = parseFloat((((series[idx].close - entryPrice) / entryPrice) * 100).toFixed(2));
        hasAnyHorizon = true;
      }
    }
    if (!hasAnyHorizon) continue; // 최근에 발생해서 아직 미래 데이터가 없는 신호는 집계 제외

    signals.push({ date: series[t].date, entryPrice, returns, score: pattern.score ?? null });
    cooldownUntil = t + cooldown; // 다음 신호는 관찰기간이 끝난 뒤에만 다시 카운트(중복신호 방지)
  }

  return signals;
}

// ─── 2. 신호 배열을 구간(호라이즌)별로 집계 — 신호 수 / 승률 / 평균·중앙값 수익률 ───
function aggregateSignals(signals, horizonLabels) {
  const stats = {};
  for (const label of horizonLabels) {
    const rets = signals.map(s => s.returns[label]).filter(r => r !== undefined);
    if (rets.length === 0) { stats[label] = null; continue; }
    const wins = rets.filter(r => r > 0).length;
    const sorted = [...rets].sort((a, b) => a - b);
    const avg = rets.reduce((a, b) => a + b, 0) / rets.length;
    stats[label] = {
      signalCount: rets.length,
      winRate: parseFloat(((wins / rets.length) * 100).toFixed(1)),
      avgReturnPct: parseFloat(avg.toFixed(2)),
      medianReturnPct: parseFloat(sorted[Math.floor(sorted.length / 2)].toFixed(2)),
      bestReturnPct: parseFloat(sorted[sorted.length - 1].toFixed(2)),
      worstReturnPct: parseFloat(sorted[0].toFixed(2)),
    };
  }
  return stats;
}

// ─── 3. 전체 백테스트 실행 ───
let backtestInFlight = null;

export function runBacktest() {
  if (backtestInFlight) {
    console.log('[BACKTEST] 이미 백테스트가 진행 중이라 요청을 건너뜁니다.');
    return backtestInFlight;
  }
  backtestInFlight = executeBacktest().finally(() => { backtestInFlight = null; });
  return backtestInFlight;
}

async function executeBacktest() {
  console.log('\n[BACKTEST] 패턴 스캐너 과거 성과 백테스트 시작...');
  const startTime = Date.now();

  const [kospiStocks, kosdaqStocks] = await Promise.all([
    fetchMarketCapUniverse(0, KOSPI_PAGES),
    fetchMarketCapUniverse(1, KOSDAQ_PAGES),
  ]);
  const universe = [...kospiStocks, ...kosdaqStocks].filter(s => s.marketCap >= MIN_MARKET_CAP);
  console.log(`[BACKTEST] 대상 유니버스: ${universe.length}종목 (시총 ${MIN_MARKET_CAP}억 이상)`);

  // 스캐너별 신호 누적 버킷
  const dailySignals = {};
  SCANNERS_DAILY.forEach(s => { dailySignals[s.id] = []; });
  const monthlySignals = [];

  let processed = 0;
  const batchSize = 12;
  for (let i = 0; i < universe.length; i += batchSize) {
    const batch = universe.slice(i, i + batchSize);
    await Promise.all(batch.map(async (stock) => {
      // ── 일봉 기반 4개 스캐너 백테스트 (긴 일봉 히스토리 1회 수집으로 재사용) ──
      const dailySeries = await fetchDailySeries(stock.code, DAILY_HISTORY_PAGES);
      if (dailySeries.length >= DAILY_START_IDX) {
        for (const scanner of SCANNERS_DAILY) {
          const signals = backtestSeries(dailySeries, scanner.detect, {
            step: DAILY_STEP, startIdx: DAILY_START_IDX, cooldown: DAILY_COOLDOWN, horizons: DAILY_HORIZONS,
          });
          if (signals.length > 0) dailySignals[scanner.id].push(...signals);
        }
      }

      // ── 월봉 10이평선 지지 스캐너 백테스트 (별도 월봉 히스토리 수집) ──
      const monthlySeries = await fetchMonthlySeries(stock.code, MONTHLY_HISTORY_COUNT);
      if (monthlySeries.length >= MONTHLY_START_IDX) {
        const signals = backtestSeries(monthlySeries, detectMonthlyMA10Support, {
          step: MONTHLY_STEP, startIdx: MONTHLY_START_IDX, cooldown: MONTHLY_COOLDOWN, horizons: MONTHLY_HORIZONS,
        });
        if (signals.length > 0) monthlySignals.push(...signals);
      }
    }));

    processed += batch.length;
    if (i + batchSize < universe.length) await new Promise(r => setTimeout(r, 150));
    process.stdout.write(`\r[BACKTEST] 진행: ${processed}/${universe.length}종목`);
  }
  console.log('');

  const results = SCANNERS_DAILY.map(scanner => ({
    id: scanner.id,
    name: scanner.name,
    timeframe: '일봉',
    totalSignals: dailySignals[scanner.id].length,
    horizons: aggregateSignals(dailySignals[scanner.id], Object.keys(DAILY_HORIZONS)),
  }));
  results.push({
    id: 'monthly_ma10',
    name: '월봉 10이평선 지지',
    timeframe: '월봉',
    totalSignals: monthlySignals.length,
    horizons: aggregateSignals(monthlySignals, Object.keys(MONTHLY_HORIZONS)),
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const cache = {
    lastSyncAt: new Date().toISOString(),
    elapsedSec: parseFloat(elapsed),
    universeSize: universe.length,
    methodology: {
      universe: `코스피 상위 ${kospiStocks.length}종목 + 코스닥 상위 ${kosdaqStocks.length}종목 중 시총 ${MIN_MARKET_CAP}억 이상`,
      dailyHistory: `약 ${DAILY_HISTORY_PAGES * 60}거래일(~2년), ${DAILY_STEP}거래일 간격 슬라이딩 검사, 신호 후 ${DAILY_COOLDOWN}거래일 쿨다운`,
      monthlyHistory: `약 ${MONTHLY_HISTORY_COUNT}개월(~5년), 매월 검사, 신호 후 ${MONTHLY_COOLDOWN}개월 쿨다운`,
      note: '과거 데이터 기반 검증이며 미래 수익을 보장하지 않습니다. look-ahead bias(미래 데이터 참조)를 방지하기 위해 각 시점까지의 데이터만으로 판정했습니다.',
    },
    scanners: results,
  };

  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');

  console.log(`[BACKTEST] ✅ 완료! ${elapsed}초 소요.`);
  results.forEach(r => {
    const h4w = r.horizons['4주'] || r.horizons['3개월'];
    console.log(`  - ${r.name}: 신호 ${r.totalSignals}건${h4w ? `, 최장구간 승률 ${h4w.winRate}% / 평균 ${h4w.avgReturnPct}%` : ''}`);
  });

  return cache;
}

// ─── 4. 캐시 읽기 ───
export function getBacktestCache() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch { return null; }
}

// ─── 5. 캐시 만료 확인 (7일 — 백테스트는 매일 크게 바뀌지 않고 연산 비용이 크므로 주간 갱신) ───
export function isBacktestStale() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return true;
    const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    const hoursSince = (Date.now() - new Date(cache.lastSyncAt).getTime()) / 3600000;
    return hoursSince > 24 * 7;
  } catch { return true; }
}

// ─── 6. 매주 월요일 09:15 자동 백테스트 스케줄러 ───
export function startWeeklyBacktest() {
  const scheduleNext = () => {
    const now = new Date();
    const target = new Date(now);
    target.setHours(9, 15, 0, 0);
    let daysUntilMonday = (1 - target.getDay() + 7) % 7; // 0=이번주 월요일, ...
    if (daysUntilMonday === 0 && target <= now) daysUntilMonday = 7; // 이번주 월요일 09:15가 이미 지남
    target.setDate(target.getDate() + daysUntilMonday);
    const msUntil = target.getTime() - now.getTime();
    console.log(`[BACKTEST] 다음 자동 백테스트: ${target.toLocaleString('ko-KR')} (${Math.round(msUntil / 60000)}분 후)`);
    setTimeout(async () => {
      await runBacktest();
      scheduleNext();
    }, msUntil);
  };

  if (isBacktestStale()) {
    console.log('[BACKTEST] 캐시 없음 또는 7일 이상 경과 → 즉시 백테스트 시작 (백그라운드)');
    runBacktest().then(() => scheduleNext()).catch(e => {
      console.error('[BACKTEST] 초기 백테스트 실패:', e.message);
      scheduleNext();
    });
  } else {
    console.log('[BACKTEST] 캐시 유효. 다음 예약 시간에 갱신합니다.');
    scheduleNext();
  }
}
