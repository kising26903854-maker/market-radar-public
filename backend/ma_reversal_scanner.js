// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎯 ma_reversal_scanner.js
// "2·5·6 기법" — 역배열(하락) → 단기 이평선 골든크로스 → 장기 이평선 돌파 직전 구간 스캐너
// - 단기: 5일선이 20일선을 상향 돌파, 아직 60일선 아래 ("256 자리")
// - 중장기: 5일선이 112일선을 상향 돌파, 아직 224일선 아래
// - 매집봉(거래량 급증 + 양봉) 동반 시 보너스 점수
// - 코스피 + 코스닥 전 종목(ETF/ETN, 거래정지/관리종목/투자주의환기종목 제외) 대상
// - 매일 09:25 자동 갱신 + 캐시 저장
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchDailySeries } from './double_bottom_scanner.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, 'data', 'ma_reversal_cache.json');

const HEADERS_M = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  'Referer': 'https://m.stock.naver.com/',
};

const MIN_MARKET_CAP = 300; // 억원 — 관리종목/부실주가 몰리는 초소형주를 간접적으로 배제
const PAGE_SIZE = 100;

// 패턴 세트: 단기(5/20/60일선), 중장기(5/112/224일선)
const PATTERN_SETS = [
  { key: 'short', label: '단기 (5·20·60일선)', trigger: 5, mid: 20, outer: 60, historyPages: 2 },   // 120거래일
  { key: 'long', label: '중장기 (5·112·224일선)', trigger: 5, mid: 112, outer: 224, historyPages: 6 }, // 360거래일
];

const CROSS_LOOKBACK_DAYS = 5;      // 최근 며칠 내 교차만 "신선한" 신호로 인정
const PRIOR_DOWNTREND_DAYS = 10;    // 교차 이전 이 기간 동안 역배열(outer>mid>가격)이었는지 확인
const MAX_OUTER_GAP_PCT = 25;       // outer선까지 너무 멀면(이미 다른 이유로 괴리) 제외
const VOLUME_SPIKE_MULT = 1.5;      // 매집봉 판정: 20일 평균거래량 대비 배수
const VOLUME_LOOKBACK = 20;

const num = (v) => parseFloat(String(v ?? '').replace(/,/g, '')) || 0;

// 거래정지/관리종목(투자주의환기종목 포함) 여부 확인 — 종목별 basic API의
// isManagement(관리·주의환기 등 행정조치 여부)와 tradeStopType(실시간 거래정지 여부)로 판별.
// bulk marketValue API에는 이 필드가 없어 종목별로 별도 호출해야 한다.
export async function isExcludedStock(code) {
  try {
    const url = `https://m.stock.naver.com/api/stock/${code}/basic`;
    const res = await axios.get(url, { headers: HEADERS_M, timeout: 5000 });
    const isManagement = res.data?.isManagement === true;
    const isHalted = (res.data?.tradeStopType?.code ?? '1') !== '1';
    return isManagement || isHalted;
  } catch {
    return false; // 조회 실패 시엔 보수적으로 제외하지 않음(과도한 스캔 누락 방지)
  }
}

// ─── 전 종목(ETF/ETN, 실시간 거래정지 제외) 유니버스 수집 ───
async function fetchFullNormalUniverse(sosok) {
  const market = sosok === 0 ? '코스피' : '코스닥';
  const marketParam = sosok === 0 ? 'KOSPI' : 'KOSDAQ';
  // 코스피 약 950종목(10페이지), 코스닥 약 1,820종목(19페이지) — 여유 있게 넉넉히 순회
  const totalPages = sosok === 0 ? 11 : 20;
  const allStocks = [];
  const seen = new Set();

  const batchSize = 4;
  for (let i = 1; i <= totalPages; i += batchSize) {
    const pages = [];
    for (let p = i; p < i + batchSize && p <= totalPages; p++) pages.push(p);

    const results = await Promise.all(pages.map(async (page) => {
      try {
        const url = `https://m.stock.naver.com/api/stocks/marketValue/${marketParam}?page=${page}&pageSize=${PAGE_SIZE}`;
        const res = await axios.get(url, { headers: HEADERS_M, timeout: 6000 });
        const list = res.data?.stocks || [];
        return list
          // ETF/ETN 제외: stockEndType이 "stock"인 것만 (ETF/ETN은 다른 값을 가짐)
          .filter(s => s.stockEndType === 'stock')
          // 실시간 거래정지 제외
          .filter(s => (s.tradeStopType?.code ?? '1') === '1')
          .map(s => ({
            code: s.itemCode,
            name: s.stockName,
            price: parseInt(String(s.closePriceRaw || '0'), 10) || 0,
            changePct: parseFloat(s.fluctuationsRatio) || 0,
            marketCap: Math.round((parseFloat(s.marketValueRaw) || 0) / 100000000),
          }));
      } catch (e) {
        console.warn(`[MA REVERSAL] ${market} ${page}페이지 실패: ${e.message}`);
        return [];
      }
    }));

    results.forEach(pageStocks => {
      pageStocks.forEach(s => {
        if (s.code && s.price > 0 && !seen.has(s.code)) { seen.add(s.code); allStocks.push({ ...s, market }); }
      });
    });

    if (i + batchSize <= totalPages) await new Promise(r => setTimeout(r, 300));
  }
  console.log(`[MA REVERSAL] ${market} 전 종목(ETF/거래정지 제외) ${allStocks.length}종목 수집 완료`);
  return allStocks;
}

// ─── 단순 이동평균(SMA) ───
function sma(closes, period, endIdx) {
  if (endIdx - period + 1 < 0) return null;
  let sum = 0;
  for (let k = endIdx - period + 1; k <= endIdx; k++) sum += closes[k];
  return sum / period;
}

// ─── 매집봉(거래량 급증 + 양봉) 탐지: 구간 내 가장 강력한 매집봉 1개 반환 ───
function findAccumulationBar(series, fromIdx, toIdx) {
  let best = null;
  for (let i = Math.max(VOLUME_LOOKBACK, fromIdx); i <= toIdx; i++) {
    let volSum = 0;
    for (let k = i - VOLUME_LOOKBACK; k < i; k++) volSum += series[k].volume;
    const avgVol = volSum / VOLUME_LOOKBACK;
    const bar = series[i];
    if (avgVol > 0 && bar.volume >= avgVol * VOLUME_SPIKE_MULT && bar.close >= bar.open * 0.995) {
      const ratio = bar.volume / avgVol;
      if (!best || ratio > best.ratio) best = { date: bar.date, volumeRatio: parseFloat(ratio.toFixed(1)) };
    }
  }
  return best;
}

/**
 * "256 기법" 패턴 판정
 * - 교차 이전 PRIOR_DOWNTREND_DAYS 동안 outer선 > mid선 (역배열)이었는지 확인
 * - trigger선이 mid선을 최근 CROSS_LOOKBACK_DAYS 이내에 상향 돌파했는지
 * - 오늘 현재가가 아직 outer선 아래인지 ("초입" 구간, 이미 뚫었으면 제외)
 * - 구간 내 매집봉 동반 여부로 보너스 점수
 */
export function detectMaReversalPattern(series, { trigger, mid, outer, label }) {
  const minHistory = outer + PRIOR_DOWNTREND_DAYS + CROSS_LOOKBACK_DAYS + 5;
  if (!series || series.length < minHistory) return null;

  const closes = series.map(d => d.close);
  const lastIdx = closes.length - 1;

  const triggerToday = sma(closes, trigger, lastIdx);
  const midToday = sma(closes, mid, lastIdx);
  const outerToday = sma(closes, outer, lastIdx);
  if (triggerToday === null || midToday === null || outerToday === null) return null;
  if (triggerToday <= midToday) return null; // 오늘 기준 정배열 전환 안 됐으면 후보 아님

  const lastBar = series[lastIdx];
  if (lastBar.close >= outerToday) return null; // 이미 outer선 돌파 → "초입"이 아니므로 제외

  // 최근 CROSS_LOOKBACK_DAYS 이내 실제 교차 시점 탐색
  const searchStart = Math.max(mid, lastIdx - CROSS_LOOKBACK_DAYS);
  let crossIdx = null;
  for (let i = lastIdx; i >= searchStart; i--) {
    const t = sma(closes, trigger, i), m = sma(closes, mid, i);
    const tp = sma(closes, trigger, i - 1), mp = sma(closes, mid, i - 1);
    if (t === null || m === null || tp === null || mp === null) break;
    if (t > m && tp <= mp) { crossIdx = i; break; }
  }
  if (crossIdx === null) return null;

  // 교차 이전 PRIOR_DOWNTREND_DAYS 동안 역배열(outer > mid) 상태였는지 확인
  const checkIdx = crossIdx - PRIOR_DOWNTREND_DAYS;
  if (checkIdx < outer - 1) return null;
  const midBefore = sma(closes, mid, checkIdx);
  const outerBefore = sma(closes, outer, checkIdx);
  if (midBefore === null || outerBefore === null || midBefore >= outerBefore) return null; // 진짜 역배열이 아니었으면 제외

  const outerGapPct = ((outerToday - lastBar.close) / lastBar.close) * 100;
  if (outerGapPct > MAX_OUTER_GAP_PCT) return null; // outer선까지 너무 멀면 제외

  const daysSinceCross = lastIdx - crossIdx;
  const accumulationBar = findAccumulationBar(series, crossIdx - PRIOR_DOWNTREND_DAYS, lastIdx);

  let crossDateLabel;
  if (daysSinceCross === 0) crossDateLabel = '오늘';
  else if (daysSinceCross === 1) crossDateLabel = '어제';
  else crossDateLabel = `${daysSinceCross}일 전`;

  // 점수: 신선도 + 사전 역배열 뚜렷함 + outer선까지 남은 여력 + 매집봉 보너스
  const freshnessScore = Math.max(0, (CROSS_LOOKBACK_DAYS - daysSinceCross)) * (25 / CROSS_LOOKBACK_DAYS);
  const priorGapPct = ((outerBefore - midBefore) / midBefore) * 100;
  const downtrendScore = Math.min(25, priorGapPct * 5);
  const roomScore = Math.min(25, outerGapPct * 1.2);
  const accumulationScore = accumulationBar ? 25 : 0;
  const score = Math.max(0, Math.min(100, Math.round(freshnessScore + downtrendScore + roomScore + accumulationScore)));

  return {
    patternLabel: label,
    trigger, mid, outer,
    triggerMa: Math.round(triggerToday),
    midMa: Math.round(midToday),
    outerMa: Math.round(outerToday),
    outerGapPct: parseFloat(outerGapPct.toFixed(1)),
    daysSinceCross,
    crossDate: crossDateLabel,
    crossActualDate: series[crossIdx].date,
    currentPrice: lastBar.close,
    currentDate: lastBar.date,
    hasAccumulationBar: !!accumulationBar,
    accumulationBar,
    score,
  };
}

// ─── 전체 스캔 실행 (코스피 + 코스닥 전 종목, 단기/중장기 세트 각각) ───
let scanInFlight = null;

export function runMaReversalScan() {
  if (scanInFlight) {
    console.log('[MA REVERSAL] 이미 스캔이 진행 중이라 요청을 건너뜁니다.');
    return scanInFlight;
  }
  scanInFlight = executeMaReversalScan().finally(() => { scanInFlight = null; });
  return scanInFlight;
}

async function executeMaReversalScan() {
  console.log('\n[MA REVERSAL] "256 기법" 전 종목 스캔 시작...');
  const startTime = Date.now();

  const [kospiStocks, kosdaqStocks] = await Promise.all([
    fetchFullNormalUniverse(0),
    fetchFullNormalUniverse(1),
  ]);
  const universe = [...kospiStocks, ...kosdaqStocks].filter(s => s.marketCap >= MIN_MARKET_CAP);
  console.log(`[MA REVERSAL] 스캔 대상: ${universe.length}종목 (전 종목, ETF/거래정지 제외, 시총 ${MIN_MARKET_CAP}억 이상)`);

  const resultsBySet = { short: [], long: [] };
  const seriesCache = new Map(); // 종목당 최장 이력(중장기용) 한 번만 수집해서 단기/중장기 공용으로 씀
  const maxPages = Math.max(...PATTERN_SETS.map(s => s.historyPages));
  let excludedCount = 0;

  const batchSize = 8;
  for (let i = 0; i < universe.length; i += batchSize) {
    const batch = universe.slice(i, i + batchSize);
    await Promise.all(batch.map(async (s) => {
      if (await isExcludedStock(s.code)) { excludedCount++; return; } // 거래정지/관리종목 제외

      const series = await fetchDailySeries(s.code, maxPages);
      if (!series || series.length === 0) return;

      for (const set of PATTERN_SETS) {
        const pattern = detectMaReversalPattern(series, set);
        if (!pattern) continue;
        const changeText = `${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%`;
        resultsBySet[set.key].push({
          code: s.code, name: s.name, market: s.market, price: s.price,
          change: changeText, changePct: s.changePct, marketCap: s.marketCap,
          catalyst: `${set.trigger}일선이 ${set.mid}일선을 상향 돌파 (${pattern.crossDate}), ${set.outer}일선 돌파 직전`,
          ...pattern,
        });
      }
    }));

    if (i + batchSize < universe.length) await new Promise(r => setTimeout(r, 150));
    process.stdout.write(`\r[MA REVERSAL] 진행: ${Math.min(i + batchSize, universe.length)}/${universe.length}종목 (단기 ${resultsBySet.short.length} / 중장기 ${resultsBySet.long.length}, 거래정지·관리종목 제외 ${excludedCount})`);
  }
  console.log('');

  PATTERN_SETS.forEach(set => resultsBySet[set.key].sort((a, b) => b.score - a.score));
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const cache = {
    lastSyncAt: new Date().toISOString(),
    elapsedSec: parseFloat(elapsed),
    totalScanned: universe.length,
    excludedCount, // 거래정지/관리종목(투자주의환기 포함)으로 제외된 종목 수
    short: resultsBySet.short.slice(0, 150),
    long: resultsBySet.long.slice(0, 150),
  };

  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');

  console.log(`[MA REVERSAL] ✅ 완료! ${elapsed}초 소요. 거래정지·관리종목 ${excludedCount}종목 제외, 단기 ${resultsBySet.short.length}종목 / 중장기 ${resultsBySet.long.length}종목 발굴 → ${CACHE_PATH}`);
  return cache;
}

export function getMaReversalCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

export function isMaReversalScanStale() {
  const cache = getMaReversalCache();
  if (!cache?.lastSyncAt) return true;
  const ageMs = Date.now() - new Date(cache.lastSyncAt).getTime();
  return ageMs > 20 * 60 * 60 * 1000; // 20시간 이상 지났으면 stale
}

// 서버 기동 시 최초 1회(캐시 없거나 오래됐을 때만) + 매일 09:25 자동 재스캔
export function startDailyMaReversalScan() {
  const scheduleNext = () => {
    const now = new Date();
    const target = new Date(now);
    target.setHours(9, 25, 0, 0);
    if (now >= target) target.setDate(target.getDate() + 1);
    const msUntil = target.getTime() - now.getTime();
    console.log(`[MA REVERSAL] 다음 자동 스캔: ${target.toLocaleString('ko-KR')} (${Math.round(msUntil / 60000)}분 후)`);
    setTimeout(async () => {
      try { await runMaReversalScan(); } catch (e) { console.error('[MA REVERSAL] 자동 스캔 실패:', e.message); }
      scheduleNext();
    }, msUntil);
  };

  if (isMaReversalScanStale()) {
    runMaReversalScan().then(() => scheduleNext()).catch(e => {
      console.error('[MA REVERSAL] 초기 스캔 실패:', e.message);
      scheduleNext();
    });
  } else {
    console.log('[MA REVERSAL] 캐시 유효. 다음 예약 시간으로 스케줄합니다.');
    scheduleNext();
  }
}
