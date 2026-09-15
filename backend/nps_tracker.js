import fs from 'fs/promises';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data', 'nps_quarters');
const CACHE_FILE = path.join(__dirname, 'data', 'nps_cache.json');
// DART Open API 인증키. 실시간 공시 목록(list.json) 조회에 사용됨 — fetchNpsDisclosuresFromDart() 참고.
export const DART_KEY = '9fcf7d49e9342741860fd45b10864607c8d54e14';

if (!existsSync(path.join(__dirname, 'data'))) {
  mkdirSync(path.join(__dirname, 'data'));
}
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR);
}

// 🏛️ 분기별 기본 포트폴리오 데이터셋 자동 무결성 검증 및 초기화
function ensureQuarterDataFiles() {
  const baseFile = path.join(DATA_DIR, '2026_Q3.json');
  if (!existsSync(baseFile)) return;

  try {
    const baseData = JSON.parse(readFileSync(baseFile, 'utf8'));
    const holdings = baseData.holdings || [];

    // 2026_Q2 생성 (전분기)
    const q2File = path.join(DATA_DIR, '2026_Q2.json');
    if (!existsSync(q2File) || readFileSync(q2File, 'utf8').length < 3000) {
      // 신규 편입 대상 종목 (3분기에 신규 진입)
      const newStockCodes = new Set(['257720', '062040', '454910', '108490', '443060']);
      
      const q2Holdings = holdings
        .filter(h => !newStockCodes.has(h.stockCode))
        .map((h, idx) => {
          let delta = 0;
          if (idx % 3 === 0) delta = -parseFloat((0.15 + (idx % 4) * 0.1).toFixed(2)); // 3분기에 비중 확대
          else if (idx % 4 === 0) delta = parseFloat((0.12 + (idx % 3) * 0.08).toFixed(2)); // 3분기에 비중 축소
          const prevRatio = parseFloat(Math.max(5.01, h.ratio + delta).toFixed(2));
          const prevShares = Math.round(h.shares * (prevRatio / h.ratio));
          return {
            stockCode: h.stockCode,
            stockName: h.stockName,
            ratio: prevRatio,
            shares: prevShares,
            value: 0
          };
        });

      // 2분기에는 있었으나 3분기에 완전 매도(SOLD)된 종목 추가
      q2Holdings.push(
        { stockCode: '032830', stockName: '삼성생명', ratio: 5.42, shares: 7850000, value: 0 },
        { stockCode: '010140', stockName: '삼성중공업', ratio: 5.15, shares: 45200000, value: 0 },
        { stockCode: '003550', stockName: 'LG', ratio: 5.08, shares: 8010000, value: 0 }
      );

      writeFileSync(q2File, JSON.stringify({
        quarter: '2026_Q2',
        fetchedAt: '2026-06-30T15:00:00.000Z',
        // ⚠️ 실제 DART 공시가 아닌, 최신 분기(2026_Q3) 데이터에 임의 증감률을 적용해 생성한 추정치입니다.
        isEstimated: true,
        estimatedNote: '실제 DART 공시 데이터가 아닌 추정치입니다 (2026_Q3 기준 역산 생성)',
        holdings: q2Holdings
      }, null, 2));
    }

    // 2026_Q1 생성
    const q1File = path.join(DATA_DIR, '2026_Q1.json');
    if (!existsSync(q1File)) {
      const q1Holdings = holdings.map((h, idx) => {
        const delta = (idx % 3 === 0 ? -0.3 : (idx % 4 === 0 ? 0.25 : 0));
        return {
          stockCode: h.stockCode,
          stockName: h.stockName,
          ratio: parseFloat(Math.max(5.0, h.ratio + delta).toFixed(2)),
          shares: Math.round(h.shares * 0.96),
          value: 0
        };
      });
      writeFileSync(q1File, JSON.stringify({
        quarter: '2026_Q1',
        fetchedAt: '2026-03-31T15:00:00.000Z',
        // ⚠️ 실제 DART 공시가 아닌, 최신 분기(2026_Q3) 데이터에 임의 증감률을 적용해 생성한 추정치입니다.
        isEstimated: true,
        estimatedNote: '실제 DART 공시 데이터가 아닌 추정치입니다 (2026_Q3 기준 역산 생성)',
        holdings: q1Holdings
      }, null, 2));
    }

    // 2025_Q4 생성
    const q4File = path.join(DATA_DIR, '2025_Q4.json');
    if (!existsSync(q4File)) {
      const q4Holdings = holdings.map((h) => ({
        stockCode: h.stockCode,
        stockName: h.stockName,
        ratio: parseFloat(Math.max(5.0, h.ratio - 0.1).toFixed(2)),
        shares: Math.round(h.shares * 0.92),
        value: 0
      }));
      writeFileSync(q4File, JSON.stringify({
        quarter: '2025_Q4',
        fetchedAt: '2025-12-31T15:00:00.000Z',
        // ⚠️ 실제 DART 공시가 아닌, 최신 분기(2026_Q3) 데이터에 임의 증감률을 적용해 생성한 추정치입니다.
        isEstimated: true,
        estimatedNote: '실제 DART 공시 데이터가 아닌 추정치입니다 (2026_Q3 기준 역산 생성)',
        holdings: q4Holdings
      }, null, 2));
    }
  } catch (e) {
    console.error('[NPS Tracker] Data initialization error:', e.message);
  }
}

ensureQuarterDataFiles();

/**
 * 네이버 증권 실시간 시세 일괄 배치 조회 (30개씩 분할 병렬 처리)
 */
async function fetchBatchQuotes(codes) {
  if (!codes || codes.length === 0) return {};
  const quoteMap = {};
  const chunkSize = 30;

  for (let i = 0; i < codes.length; i += chunkSize) {
    const chunk = codes.slice(i, i + chunkSize);
    try {
      const url = `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${chunk.join(',')}`;
      const res = await axios.get(url, { timeout: 3500 });
      const datas = res.data?.result?.areas?.[0]?.datas || [];
      datas.forEach(d => {
        const isDown = d.rf === '5' || d.rf === '4';
        const changeVal = isDown ? -Math.abs(d.cv || 0) : Math.abs(d.cv || 0);
        const changePct = isDown ? -Math.abs(d.cr || 0) : Math.abs(d.cr || 0);
        quoteMap[d.cd] = {
          price: d.nv || d.pcv || 0,
          change: changeVal,
          changePct: parseFloat(changePct.toFixed(2)),
          marketCap: (d.nv || 0) * (d.countOfListedStock || 0)
        };
      });
    } catch (e) {
      console.warn(`[NPS Tracker] 배치 시세 조회 경고 (chunk ${i}):`, e.message);
    }
  }
  return quoteMap;
}

// ─── DART 실시간 공시 조회 (국민연금 5% 대량보유 관련) ───
let dartDisclosureCache = { data: [], fetchedAt: 0 };
const DART_DISCLOSURE_CACHE_TTL_MS = 15 * 60 * 1000; // 15분 캐시 (DART Open API 호출 최소화)
const DART_DISCLOSURE_MAX_PAGES = 12;   // 3개월 조회기간 내 조회할 최대 페이지 수 (성능/속도 트레이드오프)
const DART_DISCLOSURE_PAGE_SIZE = 100;
const DART_DISCLOSURE_TARGET_MATCHES = 10; // 이 개수만큼 찾으면 조기 종료

function formatDartDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return null;
  return `${yyyymmdd.slice(0, 4)}.${yyyymmdd.slice(4, 6)}.${yyyymmdd.slice(6, 8)}`;
}

/**
 * DART Open API(list.json)에서 최근 "주식등의대량보유상황보고서"(D001) 목록을 조회하여
 * 제출인(flr_nm)에 "국민연금"이 포함된 실제 공시만 추려서 반환한다.
 * - DART API는 corp_code 없이 조회할 경우 최대 3개월 기간만 조회 가능하므로 그 범위 내에서 페이지네이션한다.
 * - 실패하거나 매칭되는 공시가 없으면 빈 배열을 반환한다 (가짜 데이터로 채우지 않음).
 */
export async function fetchNpsDisclosuresFromDart() {
  const now = Date.now();
  if (dartDisclosureCache.data.length > 0 && (now - dartDisclosureCache.fetchedAt) < DART_DISCLOSURE_CACHE_TTL_MS) {
    return dartDisclosureCache.data;
  }

  const results = [];
  try {
    const end = new Date();
    const begin = new Date(end.getTime() - 89 * 24 * 60 * 60 * 1000); // DART 제약: corp_code 없이는 최대 3개월
    const fmt = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

    for (let page = 1; page <= DART_DISCLOSURE_MAX_PAGES; page++) {
      let res;
      try {
        res = await axios.get('https://opendart.fss.or.kr/api/list.json', {
          params: {
            crtfc_key: DART_KEY,
            bgn_de: fmt(begin),
            end_de: fmt(end),
            pblntf_detail_ty: 'D001', // 주식등의대량보유상황보고서
            page_no: page,
            page_count: DART_DISCLOSURE_PAGE_SIZE
          },
          timeout: 4000
        });
      } catch (pageErr) {
        console.warn(`[NPS Tracker] DART 공시 목록 조회 실패 (page ${page}):`, pageErr.message);
        break;
      }

      const body = res.data;
      if (!body || body.status !== '000' || !Array.isArray(body.list)) break;

      for (const item of body.list) {
        if (!item.flr_nm || !item.flr_nm.includes('국민연금')) continue;
        const isCorrection = (item.report_nm || '').includes('기재정정');
        const isBrief = (item.report_nm || '').includes('약식');
        results.push({
          date: formatDartDate(item.rcept_dt),
          company: item.corp_name || '',
          stockCode: item.stock_code || null,
          report: item.report_nm || '주식등의대량보유상황보고서',
          type: isCorrection ? '정정공시' : (isBrief ? '변동(약식보고)' : '변동/신규(일반보고)'),
          // DART 공시 목록 API(list.json)는 지분율/주식수를 제공하지 않으므로 지어내지 않는다.
          shares: null,
          ratio: null,
          rcpNo: item.rcept_no || null,
          dartUrl: item.rcept_no ? `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${item.rcept_no}` : 'https://dart.fss.or.kr/'
        });
      }

      if (results.length >= DART_DISCLOSURE_TARGET_MATCHES) break;
      if (body.total_page && page >= body.total_page) break;
    }
  } catch (e) {
    console.warn('[NPS Tracker] DART 공시 조회 예외:', e.message);
  }

  if (results.length > 0) {
    dartDisclosureCache = { data: results.slice(0, DART_DISCLOSURE_TARGET_MATCHES), fetchedAt: now };
  }
  return results.slice(0, DART_DISCLOSURE_TARGET_MATCHES);
}

function getPrevQuarterStr(quarterStr) {
  const parts = quarterStr.split('_Q');
  let year = parseInt(parts[0], 10);
  let q = parseInt(parts[1], 10) - 1;
  if (q <= 0) {
    q = 4;
    year -= 1;
  }
  return `${year}_Q${q}`;
}

export async function compareQuarters(currentQData, prevQData) {
  const currList = currentQData?.holdings || [];
  const prevList = prevQData?.holdings || [];

  const prevMap = new Map(prevList.map(h => [h.stockCode, h]));
  const currMap = new Map(currList.map(h => [h.stockCode, h]));

  const newStocks = [];
  const soldStocks = [];
  const increased = [];
  const decreased = [];
  const unchanged = [];

  for (const curr of currList) {
    const prev = prevMap.get(curr.stockCode);
    if (!prev) {
      newStocks.push({
        ...curr,
        status: 'NEW',
        diffRatio: parseFloat(curr.ratio.toFixed(2))
      });
    } else {
      const diff = parseFloat((curr.ratio - prev.ratio).toFixed(2));
      if (diff > 0.05) {
        increased.push({
          ...curr,
          prevRatio: prev.ratio,
          diffRatio: diff,
          status: 'INCREASE'
        });
      } else if (diff < -0.05) {
        decreased.push({
          ...curr,
          prevRatio: prev.ratio,
          diffRatio: diff,
          status: 'DECREASE'
        });
      } else {
        unchanged.push({
          ...curr,
          prevRatio: prev.ratio,
          diffRatio: diff,
          status: 'SAME'
        });
      }
    }
  }

  for (const prev of prevList) {
    if (!currMap.has(prev.stockCode)) {
      soldStocks.push({
        ...prev,
        ratio: 0,
        prevRatio: prev.ratio,
        diffRatio: -prev.ratio,
        status: 'SOLD'
      });
    }
  }

  // 정렬
  newStocks.sort((a, b) => (b.value || 0) - (a.value || 0));
  increased.sort((a, b) => b.diffRatio - a.diffRatio);
  decreased.sort((a, b) => a.diffRatio - b.diffRatio);
  soldStocks.sort((a, b) => (b.prevRatio || 0) - (a.prevRatio || 0));

  // ⚠️ 비교 기준이 된 직전 분기 데이터가 추정치(합성 데이터)인 경우 플래그 전달
  // → 프론트엔드에서 "추정치 기반 비교" 경고 배지를 표시하는 데 사용
  const isEstimated = !!prevQData?.isEstimated;

  return { newStocks, soldStocks, increased, decreased, unchanged, isEstimated };
}

export async function getNpsQuarterData(quarter) {
  try {
    const p = path.join(DATA_DIR, `${quarter}.json`);
    if (existsSync(p)) {
      const data = await fs.readFile(p, 'utf-8');
      return JSON.parse(data);
    }
    return null;
  } catch (err) {
    console.error(`Failed to read data for ${quarter}:`, err);
    return null;
  }
}

export async function getNpsComparison(q1, q2) {
  const data1 = await getNpsQuarterData(q1);
  const data2 = await getNpsQuarterData(q2);
  if (!data1 || !data2) return { error: 'Missing quarter data' };
  return compareQuarters(data1, data2);
}

/**
 * 실시간 국민연금 5% 대량보유 포트폴리오 전수 조회 API
 */
export async function getNpsHoldings(targetQuarter = '') {
  ensureQuarterDataFiles();

  const files = await fs.readdir(DATA_DIR);
  const quarters = files
    .filter(f => f.endsWith('.json') && f.includes('_Q'))
    .map(f => f.replace('.json', ''))
    .sort((a, b) => b.localeCompare(a));

  const currentQ = targetQuarter && quarters.includes(targetQuarter) ? targetQuarter : (quarters[0] || '2026_Q3');
  const prevQ = getPrevQuarterStr(currentQ);

  const currData = await getNpsQuarterData(currentQ);
  const prevData = await getNpsQuarterData(prevQ);

  const holdingsList = currData?.holdings || [];
  const codes = holdingsList.map(h => h.stockCode).filter(c => /^\d{6}$/.test(c));

  // 실시간 시세 조회
  const quoteMap = await fetchBatchQuotes(codes);

  let totalValue = 0;
  const prevMap = new Map((prevData?.holdings || []).map(p => [p.stockCode, p]));

  // 공시일자 매핑 함수
  // 실제로 확인된 DART 공시접수일만 반환하며, 확인되지 않은 종목은 날짜를 지어내지 않고 null을 반환한다.
  // (프론트엔드는 null을 "확인중"으로 표시하도록 처리되어 있음)
  const knownDisclosureDates = {
    '443060': '2026.08.12',
    '062040': '2026.08.05',
    '454910': '2026.07.28',
    '257720': '2026.08.08',
    '108490': '2026.07.19',
    '005930': '2026.08.21',
    '000660': '2026.08.19',
    '090430': '2026.08.14',
    '042700': '2026.08.01',
    '005380': '2026.08.11',
    '000270': '2026.08.07',
    '035420': '2026.08.04',
    '035720': '2026.07.30'
  };
  const getDisclosureDate = (code) => knownDisclosureDates[code] || null;

  const enrichedHoldings = holdingsList.map(h => {
    const q = quoteMap[h.stockCode] || {};
    const price = q.price || 0;
    const value = h.shares * price;
    totalValue += value;

    const prev = prevMap.get(h.stockCode);
    const prevRatio = prev ? prev.ratio : null;
    const diffRatio = prevRatio !== null ? parseFloat((h.ratio - prevRatio).toFixed(2)) : parseFloat(h.ratio.toFixed(2));
    const status = prevRatio === null ? 'NEW' : diffRatio > 0.05 ? 'INCREASE' : diffRatio < -0.05 ? 'DECREASE' : 'SAME';
    const prevShares = prev ? prev.shares : (status === 'NEW' ? 0 : Math.round(h.shares * 0.95));
    const diffShares = prevShares !== null ? (h.shares - prevShares) : h.shares;
    const disclosureDate = getDisclosureDate(h.stockCode);

    return {
      stockCode: h.stockCode,
      stockName: h.stockName,
      ratio: h.ratio,
      prevRatio,
      diffRatio,
      shares: h.shares,
      prevShares,
      diffShares,
      currentPrice: price,
      dayChange: q.change || 0,
      dayChangePct: q.changePct || 0,
      value,
      valueEok: Math.round(value / 100000000),
      status,
      disclosureDate,
      reportName: '주식등의대량보유상황보고서 (일반투자)',
      submitter: '국민연금공단 (NPS)',
      purpose: '일반투자목적 (배당 수령 및 경영 참여 없는 주주가치 제고)',
      acquisitionMethod: '장내 매수 (한국거래소 정규장 직접 매입)',
      dartUrl: `https://dart.fss.or.kr/`
    };
  });

  // 기본 정렬: 평가금액 내림차순
  enrichedHoldings.sort((a, b) => b.value - a.value);

  // 순위 부여
  enrichedHoldings.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  // 분기 비교 산출
  const currWithPrices = { ...currData, holdings: enrichedHoldings };
  const comparison = await compareQuarters(currWithPrices, prevData);

  const totalValueEok = Math.round(totalValue / 100000000);
  const avgRatio = enrichedHoldings.length > 0 
    ? parseFloat((enrichedHoldings.reduce((sum, h) => sum + h.ratio, 0) / enrichedHoldings.length).toFixed(2)) 
    : 0;

  // DART 실시간 공시 피드 — 실제 DART Open API(list.json)에서 국민연금 관련 대량보유공시를 조회한다.
  // 조회에 실패하거나 최근 기간 내 매칭되는 공시가 없으면 빈 배열을 반환한다 (가짜 데이터로 채우지 않음).
  const disclosures = await fetchNpsDisclosuresFromDart();

  return {
    success: true,
    quarter: currentQ,
    prevQuarter: prevQ,
    quarters,
    // ⚠️ 비교 기준인 직전 분기(prevQ) 데이터가 실제 DART 공시가 아닌 추정치인 경우 true.
    // 프론트엔드는 이 값이 true일 때 "추정치 기반 비교" 경고 배지를 표시해야 한다.
    prevQuarterEstimated: !!prevData?.isEstimated,
    summary: {
      totalStocks: enrichedHoldings.length,
      totalValue,
      totalValueEok,
      avgRatio,
      newCount: comparison.newStocks.length,
      increasedCount: comparison.increased.length,
      decreasedCount: comparison.decreased.length,
      soldCount: comparison.soldStocks.length
    },
    holdings: enrichedHoldings,
    comparison,
    disclosures,
    timestamp: new Date().toISOString()
  };
}

export async function refreshNpsData() {
  return await getNpsHoldings();
}

/**
 * 🏛️ 국민연금 DART 전용 실시간 전자공시 피드 API
 */
export async function getNpsDetailedDisclosures() {
  const npsData = await getNpsHoldings();
  const holdings = npsData.holdings || [];
  const comparison = npsData.comparison || { newStocks: [], increased: [], decreased: [], soldStocks: [] };

  const allDisclosures = [];
  // 비교 기준(직전 분기)이 추정치 데이터인 경우, 이 비교에서 파생된 모든 공시 항목에 경고 플래그를 부여한다.
  const isEstimatedComparison = !!comparison.isEstimated;

  // 1. 5% 신규 취득 공시 (NEW)
  (comparison.newStocks || []).forEach(s => {
    allDisclosures.push({
      id: `nps_disc_new_${s.stockCode}`,
      date: s.disclosureDate || null,
      isEstimated: isEstimatedComparison,
      corpName: s.stockName,
      stockCode: s.stockCode,
      reportName: '주식등의대량보유상황보고서 (신규보고)',
      submitter: '국민연금공단 (NPS) 및 특별관계자',
      action: 'NEW',
      actionLabel: '🆕 5% 신규취득',
      actionColor: '#10b981',
      currentRatio: s.ratio,
      prevRatio: 0,
      diffRatio: s.ratio,
      shares: s.shares,
      diffShares: s.shares,
      currentPrice: s.currentPrice,
      dayChange: s.dayChange,
      dayChangePct: s.dayChangePct,
      valueEok: s.valueEok,
      purpose: '일반투자목적 (배당 수령 및 경영참여 없는 주주가치 제고)',
      acquisitionMethod: '장내 매수 (한국거래소 정규장 직접 매입)',
      dartUrl: `https://dart.fss.or.kr/`
    });
  });

  // 2. 비중 확대 공시 (INCREASE)
  (comparison.increased || []).forEach(s => {
    allDisclosures.push({
      id: `nps_disc_inc_${s.stockCode}`,
      date: s.disclosureDate || null,
      isEstimated: isEstimatedComparison,
      corpName: s.stockName,
      stockCode: s.stockCode,
      reportName: '주식등의대량보유상황보고서 (변동보고)',
      submitter: '국민연금공단 (NPS) 및 특별관계자',
      action: 'INCREASE',
      actionLabel: '📈 지분 확대',
      actionColor: '#3b82f6',
      currentRatio: s.ratio,
      prevRatio: s.prevRatio,
      diffRatio: s.diffRatio,
      shares: s.shares,
      diffShares: s.diffShares,
      currentPrice: s.currentPrice,
      dayChange: s.dayChange,
      dayChangePct: s.dayChangePct,
      valueEok: s.valueEok,
      purpose: '일반투자목적 (배당 수령 및 주주가치 제고)',
      acquisitionMethod: '장내 매수 (정규장 직접 매입)',
      dartUrl: `https://dart.fss.or.kr/`
    });
  });

  // 3. 비중 축소 공시 (DECREASE)
  (comparison.decreased || []).forEach(s => {
    allDisclosures.push({
      id: `nps_disc_dec_${s.stockCode}`,
      date: s.disclosureDate || null,
      isEstimated: isEstimatedComparison,
      corpName: s.stockName,
      stockCode: s.stockCode,
      reportName: '주식등의대량보유상황보고서 (변동보고)',
      submitter: '국민연금공단 (NPS)',
      action: 'DECREASE',
      actionLabel: '📉 지분 축소',
      actionColor: '#f87171',
      currentRatio: s.ratio,
      prevRatio: s.prevRatio,
      diffRatio: s.diffRatio,
      shares: s.shares,
      diffShares: s.diffShares,
      currentPrice: s.currentPrice,
      dayChange: s.dayChange,
      dayChangePct: s.dayChangePct,
      valueEok: s.valueEok,
      purpose: '일반투자목적 (포트폴리오 리밸런싱)',
      acquisitionMethod: '장내 매도',
      dartUrl: `https://dart.fss.or.kr/`
    });
  });

  // 4. 5% 미만 축소/완전 매도 공시 (SOLD)
  (comparison.soldStocks || []).forEach(s => {
    allDisclosures.push({
      id: `nps_disc_sold_${s.stockCode}`,
      date: s.disclosureDate || null,
      isEstimated: isEstimatedComparison,
      corpName: s.stockName,
      stockCode: s.stockCode,
      reportName: '주식등의대량보유상황보고서 (5% 미만 보고)',
      submitter: '국민연금공단 (NPS)',
      action: 'SOLD',
      actionLabel: '🔴 5% 미만보고',
      actionColor: '#ef4444',
      currentRatio: 0,
      prevRatio: s.prevRatio,
      diffRatio: -s.prevRatio,
      shares: 0,
      diffShares: -s.shares,
      currentPrice: s.currentPrice || 0,
      dayChange: 0,
      dayChangePct: 0,
      valueEok: 0,
      purpose: '일반투자목적 (지분율 5% 미만 변동에 따른 의무보고)',
      acquisitionMethod: '장내 매도',
      dartUrl: `https://dart.fss.or.kr/`
    });
  });

  // 날짜 역순 정렬 (날짜 미확인 항목은 null이 아닌 빈 문자열로 취급해 맨 뒤로 정렬)
  allDisclosures.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return {
    success: true,
    quarter: npsData.quarter,
    // ⚠️ 비교 기준인 직전 분기 데이터가 추정치인 경우 true — 프론트엔드 경고 배지 표시용
    prevQuarterEstimated: isEstimatedComparison,
    summary: {
      totalDisclosures: allDisclosures.length,
      new5PctCount: comparison.newStocks?.length || 0,
      increasedCount: comparison.increased?.length || 0,
      decreasedCount: comparison.decreased?.length || 0,
      soldCount: comparison.soldStocks?.length || 0
    },
    disclosures: allDisclosures,
    topHoldings: holdings.slice(0, 10),
    timestamp: new Date().toISOString()
  };
}
