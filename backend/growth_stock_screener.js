// growth_stock_screener.js — 🚀 4대 재무 퀀트 엄격 AND 조건 종목 발굴기
// 1. 최근 3년간 자산 증가율 TOP 20
// 2. 최근 3년간 영업이익 증가율 TOP 20
// 3. 부채비율 120% 이하 (재무 안정성)
// 4. 최근 3년간 매출액 증가율 TOP 20
// * 위 4가지 조건을 모두 만족하는 초우량 고성장 알짜 종목 발굴 엔진

import axios from 'axios';
import iconv from 'iconv-lite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(__dirname, 'data', 'growth_screener_cache.json');
const FINANCIALS_CACHE_FILE = path.join(__dirname, 'data', 'growth_screener_financials_cache.json');
let financialsCacheInMemory = null;

function loadFinancialsCache() {
  if (financialsCacheInMemory) return financialsCacheInMemory;
  try {
    if (fs.existsSync(FINANCIALS_CACHE_FILE)) {
      financialsCacheInMemory = JSON.parse(fs.readFileSync(FINANCIALS_CACHE_FILE, 'utf8'));
      return financialsCacheInMemory;
    }
  } catch (e) {}
  financialsCacheInMemory = {};
  return financialsCacheInMemory;
}

function saveFinancialsCache(data) {
  try {
    const dir = path.dirname(FINANCIALS_CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FINANCIALS_CACHE_FILE, JSON.stringify(data), 'utf8');
    financialsCacheInMemory = data;
  } catch (e) {}
}

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://finance.naver.com/',
  'Accept': 'application/json'
};

async function getAllMarketStockCandidates() {
  const map = new Map();
  CANDIDATE_STOCKS.forEach(s => map.set(s.code, s));

  try {
    const fetchMarketList = async (sosok, pages) => {
      const list = [];
      for (let p = 1; p <= pages; p++) {
        try {
          const url = `https://finance.naver.com/sise/sise_market_sum.naver?sosok=${sosok}&page=${p}`;
          const res = await axios.get(url, { responseType: 'arraybuffer', headers: HEADERS, timeout: 5000 });
          const html = iconv.decode(Buffer.from(res.data), 'euc-kr');
          const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
          let trMatch;
          while ((trMatch = trPattern.exec(html)) !== null) {
            const row = trMatch[1];
            const codeMatch = row.match(/code=(\d{6})/);
            const nameMatch = row.match(/<a[^>]*item\/main[^>]*>([^<]+)<\/a>/);
            if (codeMatch && nameMatch) {
              list.push({
                code: codeMatch[1],
                name: nameMatch[1].trim(),
                market: sosok === 0 ? 'KOSPI' : 'KOSDAQ'
              });
            }
          }
        } catch (e) {}
      }
      return list;
    };

    const [kospiList, kosdaqList] = await Promise.all([
      fetchMarketList(0, 15),
      fetchMarketList(1, 15)
    ]);

    kospiList.forEach(s => map.set(s.code, s));
    kosdaqList.forEach(s => map.set(s.code, s));
  } catch (e) {
    console.warn('[Growth Screener] Full candidate fetch warning:', e.message);
  }

  return Array.from(map.values());
}

// ─── 대상 종목 유니버스 (KOSPI & KOSDAQ 대표 실적 우량주 및 성장주 80선) ───
export const CANDIDATE_STOCKS = [
  { code: '005930', name: '삼성전자', market: 'KOSPI' },
  { code: '000660', name: 'SK하이닉스', market: 'KOSPI' },
  { code: '005380', name: '현대차', market: 'KOSPI' },
  { code: '000270', name: '기아', market: 'KOSPI' },
  { code: '012330', name: '현대모비스', market: 'KOSPI' },
  { code: '068270', name: '셀트리온', market: 'KOSPI' },
  { code: '263800', name: '실리콘투', market: 'KOSDAQ' },
  { code: '277810', name: '레인보우로보틱스', market: 'KOSDAQ' },
  { code: '214150', name: '클래시스', market: 'KOSDAQ' },
  { code: '145020', name: '휴젤', market: 'KOSDAQ' },
  { code: '259960', name: '크래프톤', market: 'KOSPI' },
  { code: '042700', name: '한미반도체', market: 'KOSPI' },
  { code: '058470', name: '리노공업', market: 'KOSDAQ' },
  { code: '005490', name: 'POSCO홀딩스', market: 'KOSPI' },
  { code: '035720', name: '카카오', market: 'KOSPI' },
  { code: '035420', name: 'NAVER', market: 'KOSPI' },
  { code: '247540', name: '에코프로비엠', market: 'KOSDAQ' },
  { code: '086520', name: '에코프로', market: 'KOSDAQ' },
  { code: '348370', name: '엔켐', market: 'KOSDAQ' },
  { code: '003670', name: '포스코퓨처엠', market: 'KOSPI' },
  { code: '006400', name: '삼성SDI', market: 'KOSPI' },
  { code: '373220', name: 'LG에너지솔루션', market: 'KOSPI' },
  { code: '105560', name: 'KB금융', market: 'KOSPI' },
  { code: '055550', name: '신한지주', market: 'KOSPI' },
  { code: '086790', name: '하나금융지주', market: 'KOSPI' },
  { code: '024110', name: '기업은행', market: 'KOSPI' },
  { code: '017670', name: 'SK텔레콤', market: 'KOSPI' },
  { code: '030200', name: 'KT', market: 'KOSPI' },
  { code: '097950', name: 'CJ제일제당', market: 'KOSPI' },
  { code: '033780', name: 'KT&G', market: 'KOSPI' },
  { code: '009150', name: '삼성전기', market: 'KOSPI' },
  { code: '018260', name: '삼성에스디에스', market: 'KOSPI' },
  { code: '010130', name: '고려아연', market: 'KOSPI' },
  { code: '047050', name: '포스코인터내셔널', market: 'KOSPI' },
  { code: '011200', name: 'HMM', market: 'KOSPI' },
  { code: '010950', name: 'S-Oil', market: 'KOSPI' },
  { code: '003230', name: '삼양식품', market: 'KOSPI' },
  { code: '267250', name: 'HD현대일렉트릭', market: 'KOSPI' },
  { code: '042660', name: '한화오션', market: 'KOSPI' },
  { code: '012450', name: '한화에어로스페이스', market: 'KOSPI' },
  { code: '079550', name: 'LIG넥스원', market: 'KOSPI' },
  { code: '047810', name: '한국항공우주', market: 'KOSPI' },
  { code: '009830', name: '한화솔루션', market: 'KOSPI' },
  { code: '032640', name: 'LG유플러스', market: 'KOSPI' },
  { code: '004020', name: '현대제철', market: 'KOSPI' },
  { code: '011170', name: '롯데케미칼', market: 'KOSPI' },
  { code: '282330', name: 'BGF리테일', market: 'KOSPI' },
  { code: '139480', name: '이마트', market: 'KOSPI' },
  { code: '069500', name: 'KODEX 200', market: 'KOSPI' },
  { code: '196170', name: '알테오젠', market: 'KOSDAQ' },
  { code: '028300', name: 'HLB', market: 'KOSDAQ' },
  { code: '253450', name: '스튜디오드래곤', market: 'KOSDAQ' },
  { code: '035900', name: 'JYP Ent.', market: 'KOSDAQ' },
  { code: '041510', name: '에스엠', market: 'KOSDAQ' },
  { code: '352820', name: '하이브', market: 'KOSPI' },
  { code: '357780', name: '솔브레인', market: 'KOSDAQ' },
  { code: '039030', name: '이오테크닉스', market: 'KOSDAQ' },
  { code: '036930', name: '주성엔지니어링', market: 'KOSDAQ' },
  { code: '222800', name: '심텍', market: 'KOSDAQ' },
  { code: '090430', name: '아모레퍼시픽', market: 'KOSPI' },
  { code: '051900', name: 'LG생활건강', market: 'KOSPI' },
  { code: '192820', name: '코스맥스', market: 'KOSPI' },
  { code: '161890', name: '한국콜마', market: 'KOSPI' },
  { code: '018880', name: '한온시스템', market: 'KOSPI' },
  { code: '271560', name: '오리온', market: 'KOSPI' },
  { code: '007070', name: 'GS리테일', market: 'KOSPI' },
  { code: '030000', name: '제일기획', market: 'KOSPI' },
  { code: '023530', name: '롯데쇼핑', market: 'KOSPI' },
  { code: '008770', name: '호텔신라', market: 'KOSPI' },
  { code: '010770', name: '평화홀딩스', market: 'KOSPI' },
  { code: '143240', name: '사람인', market: 'KOSDAQ' },
  { code: '068160', name: '메디톡스', market: 'KOSDAQ' },
  { code: '214320', name: '이노션', market: 'KOSPI' },
  { code: '068760', name: '셀트리온제약', market: 'KOSDAQ' },
  { code: '403870', name: 'HPSP', market: 'KOSDAQ' },
  { code: '022100', name: '포스코DX', market: 'KOSPI' },
  { code: '307950', name: '현대오토에버', market: 'KOSPI' },
  { code: '066970', name: '엘앤에프', market: 'KOSPI' },
  { code: '000100', name: '유한양행', market: 'KOSPI' },
  { code: '128940', name: '한미약품', market: 'KOSPI' }
];

// ─── 단일 종목 재무제표 3개년 수집 및 증가율 계산 ───
async function analyzeStockFinancialGrowth(stock) {
  const finCache = loadFinancialsCache();
  const cachedItem = finCache[stock.code];
  if (cachedItem && (Date.now() - (cachedItem.updatedAt || 0) < 24 * 60 * 60 * 1000)) {
    return cachedItem.data;
  }

  try {
    const url = `https://m.stock.naver.com/api/stock/${stock.code}/finance/annual`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 5000 });
    const rows = res.data?.financeInfo?.rowList || [];
    const periods = res.data?.financeInfo?.trTitleList || [];

    if (!rows.length || periods.length < 2) return null;

    // 확정 및 컨센서스 포함 최근 3개 기간 추출 (예: 2023, 2024, 2025)
    const confirmed = periods.filter(p => p.isConsensus === 'N');
    const validPeriods = confirmed.length >= 2 ? confirmed : periods.slice(0, 3);
    
    const startPeriod = validPeriods[0];
    const endPeriod = validPeriods[validPeriods.length - 1];

    const getNum = (title, key) => {
      const row = rows.find(r => r.title === title);
      const raw = row?.columns?.[key]?.value;
      if (!raw || raw === '-' || raw === 'N/A') return null;
      const num = parseFloat(raw.replace(/,/g, ''));
      return isNaN(num) ? null : num;
    };

    // 1. 매출액
    const revStart = getNum('매출액', startPeriod.key);
    const revEnd = getNum('매출액', endPeriod.key);
    const revGrowth = (revStart && revEnd && revStart > 0)
      ? parseFloat((((revEnd - revStart) / revStart) * 100).toFixed(2))
      : null;

    // 2. 영업이익
    const opStart = getNum('영업이익', startPeriod.key);
    const opEnd = getNum('영업이익', endPeriod.key);
    let opGrowth = null;
    if (opStart !== null && opEnd !== null && opStart !== 0) {
      opGrowth = parseFloat((((opEnd - opStart) / Math.abs(opStart)) * 100).toFixed(2));
    }

    // 3. 부채비율 (최근 기간 확정 부채비율)
    const debtRatio = getNum('부채비율', endPeriod.key) ?? getNum('부채비율', startPeriod.key);

    // 4. 자산총계 (주당자산 BPS × (1 + 부채비율/100))
    const bpsStart = getNum('BPS', startPeriod.key);
    const debtStart = getNum('부채비율', startPeriod.key) || 50;
    const bpsEnd = getNum('BPS', endPeriod.key);
    const debtEnd = getNum('부채비율', endPeriod.key) || 50;

    let assetGrowth = null;
    if (bpsStart && bpsEnd && bpsStart > 0) {
      const assetPerShareStart = bpsStart * (1 + debtStart / 100);
      const assetPerShareEnd = bpsEnd * (1 + debtEnd / 100);
      assetGrowth = parseFloat((((assetPerShareEnd - assetPerShareStart) / assetPerShareStart) * 100).toFixed(2));
    } else if (bpsStart && bpsEnd) {
      assetGrowth = parseFloat((((bpsEnd - bpsStart) / bpsStart) * 100).toFixed(2));
    }

    // 추가 보조 지표 (ROE, PER, PBR)
    const roe = getNum('ROE', endPeriod.key) || getNum('ROE', startPeriod.key);
    const per = getNum('PER', endPeriod.key);
    const pbr = getNum('PBR', endPeriod.key);

    // 최근 3개년 연도별 요약 데이터 (차트/표 시각화용)
    const history = validPeriods.map(p => ({
      year: p.title.replace('.', '년 '),
      revenue: getNum('매출액', p.key),
      opProfit: getNum('영업이익', p.key),
      debtRatio: getNum('부채비율', p.key),
      bps: getNum('BPS', p.key),
      roe: getNum('ROE', p.key)
    }));

    const resultData = {
      code: stock.code,
      name: stock.name,
      market: stock.market,
      startYear: startPeriod.title,
      endYear: endPeriod.title,
      revenueStart: revStart,
      revenueEnd: revEnd,
      revenueGrowthRate: revGrowth,
      opProfitStart: opStart,
      opProfitEnd: opEnd,
      opProfitGrowthRate: opGrowth,
      debtRatio: debtRatio,
      assetGrowthRate: assetGrowth,
      roe: roe,
      per: per,
      pbr: pbr,
      history: history
    };

    finCache[stock.code] = { updatedAt: Date.now(), data: resultData };
    return resultData;
  } catch (e) {
    return null;
  }
}

// ─── 🍚 밥그릇 3번 패턴 (1번 급락 -> 2번 바닥 매집 완료 -> 3번 상승초입 맥점) 정밀 진단 ───
export async function fetchDailyCandlesForBowl(code) {
  try {
    const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${code}&timeframe=day&count=120&requestType=0`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      responseType: 'arraybuffer',
      timeout: 5000
    });
    const xml = iconv.decode(Buffer.from(res.data), 'euc-kr');
    const matches = [...xml.matchAll(/<item data="([^"]+)"\s*\/?>/g)];
    return matches.map(m => {
      const p = m[1].split('|');
      return {
        date: p[0],
        open: parseInt(p[1], 10),
        high: parseInt(p[2], 10),
        low: parseInt(p[3], 10),
        close: parseInt(p[4], 10),
        volume: parseInt(p[5], 10)
      };
    });
  } catch (e) {
    return [];
  }
}

export function analyzeBowlPattern(candles, name, code) {
  if (!candles || candles.length < 60) return null;

  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const n = candles.length;
  const curClose = closes[n - 1];

  const ma5 = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;

  const historical = closes.slice(0, n - 5);
  const maxPrice = Math.max(...historical);
  const maxIdx = historical.indexOf(maxPrice);

  const minPrice = Math.min(...historical);
  const minIdx = historical.indexOf(minPrice);

  const dropRate = ((minPrice - maxPrice) / maxPrice) * 100;
  const hasValidDrop = maxIdx < minIdx && dropRate <= -15;

  const daysSinceMin = (n - 1) - minIdx;
  const hasConsolidation = daysSinceMin >= 12;

  const reboundFromBottom = ((curClose - minPrice) / minPrice) * 100;

  const isAboveMa20 = curClose >= ma20 * 0.98;
  const isMa5Above20 = ma5 >= ma20 * 0.99;
  const isEarlyStage = reboundFromBottom >= 2.0 && reboundFromBottom <= 32.0;

  const baseVolumes = volumes.slice(Math.max(0, minIdx - 5), minIdx + 15);
  const avgBaseVol = baseVolumes.length > 0 ? baseVolumes.reduce((a, b) => a + b, 0) / baseVolumes.length : 1;
  const recent5Vol = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const volRatio = avgBaseVol > 0 ? (recent5Vol / avgBaseVol) : 1;

  let score = 0;
  const criteria = [];

  if (hasValidDrop) {
    score += 25;
    criteria.push(`① 1번 하락 확인: 고점 ${maxPrice.toLocaleString()}원 대비 ${dropRate.toFixed(1)}% 낙폭`);
  }
  if (hasConsolidation) {
    score += 25;
    criteria.push(`② 2번 매집 횡보: 바닥 ${minPrice.toLocaleString()}원 형성 후 ${daysSinceMin}일간 매집 완료`);
  }
  if (isEarlyStage) {
    score += 25;
    criteria.push(`③ 3번 상승초입 가격대: 바닥 대비 +${reboundFromBottom.toFixed(1)}% (과열 없는 맥점)`);
  }
  if (isAboveMa20 && isMa5Above20) {
    score += 15;
    criteria.push(`④ 이평선 정배열 전환: 5일선(${Math.round(ma5).toLocaleString()}원) ≥ 20일선(${Math.round(ma20).toLocaleString()}원)`);
  }
  if (volRatio >= 1.05) {
    score += 10;
    criteria.push(`⑤ 거래량 점증: 바닥권 대비 최근 거래량 ${volRatio.toFixed(1)}배 증가`);
  }

  const isBowlStage3 = score >= 70;
  const stage = isBowlStage3 ? '3번 상승초기' : (hasConsolidation ? '2번 바닥매집' : (hasValidDrop ? '1번 하락진행' : '패턴미달'));
  const stageNum = isBowlStage3 ? 3 : (hasConsolidation ? 2 : (hasValidDrop ? 1 : 0));

  return {
    isBowlStage3,
    score,
    stage,
    stageNum,
    curPrice: curClose,
    minPrice,
    maxPrice,
    dropRate: parseFloat(dropRate.toFixed(1)),
    daysSinceMin,
    reboundFromBottom: parseFloat(reboundFromBottom.toFixed(1)),
    ma5: Math.round(ma5),
    ma20: Math.round(ma20),
    volRatio: parseFloat(volRatio.toFixed(1)),
    criteria,
    summaryDesc: `1번 하락(${dropRate.toFixed(1)}%) 후 ${daysSinceMin}일간 2번 바닥 매집 완료 → 바닥 대비 +${reboundFromBottom.toFixed(1)}% 3번 상승초입 진입`
  };
}

export async function fetchStockTrendData(code) {
  try {
    const url = `https://m.stock.naver.com/api/stock/${code}/trend`;
    const res = await axios.get(url, {
      headers: HEADERS,
      timeout: 4000
    });
    return Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    return [];
  }
}

function parsePureBuyNum(str) {
  if (!str) return 0;
  return parseInt(String(str).replace(/[^0-9-]/g, ''), 10) || 0;
}

export function analyzeAccumulationBreakout(candles, trends, name, code) {
  if (!candles || candles.length < 60) return null;

  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const n = candles.length;
  const curClose = closes[n - 1];
  const curVol = volumes[n - 1];

  const ma5 = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const ma20 = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const ma60 = closes.slice(-60).reduce((a, b) => a + b, 0) / 60;

  const boxPeriod = closes.slice(Math.max(0, n - 45), n - 3);
  const boxTop = Math.max(...boxPeriod);
  const boxBottom = Math.min(...boxPeriod);
  const boxHeightPct = ((boxTop - boxBottom) / boxBottom) * 100;

  const isTightBox = boxHeightPct <= 30;
  const breakoutPct = ((curClose - boxTop) / boxTop) * 100;
  const isBoxBreakout = isTightBox && breakoutPct >= -3.5 && breakoutPct <= 12.0;
  const isBoxJustBroken = isTightBox && breakoutPct >= 0 && breakoutPct <= 12.0;

  const prev20Vol = volumes.slice(Math.max(0, n - 25), n - 5);
  const avgPrev20Vol = prev20Vol.length > 0 ? (prev20Vol.reduce((a, b) => a + b, 0) / prev20Vol.length) : 1;
  const recentVolRatio = avgPrev20Vol > 0 ? (curVol / avgPrev20Vol) : 1;
  const hasVolumeSurge = recentVolRatio >= 1.15;

  const maMax = Math.max(ma5, ma20, ma60);
  const maMin = Math.min(ma5, ma20, ma60);
  const maConvergenceSpread = ((maMax - maMin) / maMin) * 100;
  const isMaConverged = maConvergenceSpread <= 8.5;
  const isMaBullish = ma5 >= ma20 && curClose >= ma20 * 0.98;

  let isDualBuy = false;
  let isForeignNetBuy = false;
  let isInstNetBuy = false;

  if (trends && trends.length > 0) {
    const top3 = trends.slice(0, 3);
    const sumF = top3.reduce((acc, t) => acc + parsePureBuyNum(t.foreignerPureBuyQuant), 0);
    const sumO = top3.reduce((acc, t) => acc + parsePureBuyNum(t.organPureBuyQuant), 0);
    isForeignNetBuy = sumF > 0;
    isInstNetBuy = sumO > 0;
    isDualBuy = sumF > 0 && sumO > 0;
  }

  let score = 0;
  const signals = [];

  if (isBoxJustBroken) {
    score += 35;
    signals.push(`📦 ${boxPeriod.length}일 박스권 상단(${boxTop.toLocaleString()}원) 막 상향 돌파 (+${breakoutPct.toFixed(1)}%)`);
  } else if (isBoxBreakout) {
    score += 25;
    signals.push(`📦 ${boxPeriod.length}일 박스권 상단(${boxTop.toLocaleString()}원) 돌파 임박 (현재가 ${curClose.toLocaleString()}원)`);
  }

  if (isMaConverged) {
    score += 20;
    signals.push(`⚡ 5·20·60일선 초밀집(이격도 ${maConvergenceSpread.toFixed(1)}%) 에너지 응축 완료`);
  }
  if (isMaBullish) {
    score += 10;
    signals.push(`📈 5일선 > 20일선 정배열 전환 및 상향 발산`);
  }

  if (isDualBuy) {
    score += 25;
    signals.push(`🔥 최근 3일 외인·기관 동시 쌍끌이 순매수 (주포 수급 유입)`);
  } else if (isForeignNetBuy) {
    score += 15;
    signals.push(`💵 최근 3일 외국인 연속 순매수 유입 중`);
  } else if (isInstNetBuy) {
    score += 15;
    signals.push(`💵 최근 3일 기관 연속 순매수 유입 중`);
  }

  if (hasVolumeSurge) {
    score += 10;
    signals.push(`📊 거래량 ${recentVolRatio.toFixed(1)}배 실린 출발`);
  }

  const isTripleBreakout = score >= 50;
  const grade = score >= 80 ? '⭐ 트리플 올킬 폭발주' : (score >= 50 ? '🔥 매집완료 급등초입' : '일반');

  return {
    isTripleBreakout,
    score,
    grade,
    boxTop,
    boxBottom,
    boxHeightPct: parseFloat(boxHeightPct.toFixed(1)),
    breakoutPct: parseFloat(breakoutPct.toFixed(1)),
    recentVolRatio: parseFloat(recentVolRatio.toFixed(1)),
    maConvergenceSpread: parseFloat(maConvergenceSpread.toFixed(1)),
    isBoxBreakout,
    isBoxJustBroken,
    isMaConverged,
    isDualBuy,
    isForeignNetBuy,
    isInstNetBuy,
    signals,
    summaryDesc: `${boxPeriod.length}일 박스권(${boxTop.toLocaleString()}원) 상향 돌파 + 이평선 밀집 발산 + ${isDualBuy ? '외인·기관 쌍끌이' : '거래량 실린'} 시세 분출 초입`
  };
}

// ─── 4대 엄격 AND 조건 스크리닝 실행 ───
export async function runGrowthStockScreener(forceRefresh = false) {
  // 1. 캐시 확인 (2시간 유효)
  if (!forceRefresh && fs.existsSync(CACHE_FILE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (Date.now() - (cached.timestamp || 0) < 2 * 60 * 60 * 1000) {
        return cached;
      }
    } catch (e) {
      console.error('캐시 파싱 에러:', e.message);
    }
  }

  const allCandidates = await getAllMarketStockCandidates();
  console.log(`🚀 [종목 발굴기] 코스피+코스닥 전 종목 4대 재무 퀀트 스크리닝 시작 (총 ${allCandidates.length}개 후보군)...`);

  // 병렬 15개씩 배치 수집 (네이버 서버 부하 방지 및 24시간 재무 캐시 적용)
  const results = [];
  const chunkSize = 15;
  for (let i = 0; i < allCandidates.length; i += chunkSize) {
    const chunk = allCandidates.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(chunk.map(s => analyzeStockFinancialGrowth(s)));
    results.push(...chunkResults.filter(Boolean));
    await new Promise(r => setTimeout(r, 20)); // 20ms 슬립
  }

  saveFinancialsCache(financialsCacheInMemory || {});

  // 1. 유효 데이터 필터링 (양수 성장률 및 기본 지표 보유)
  const validList = results.filter(item => 
    item.revenueGrowthRate !== null &&
    item.opProfitGrowthRate !== null &&
    item.assetGrowthRate !== null &&
    item.debtRatio !== null
  );

  // 2. 조건별 개별 TOP 80 랭킹 산출 (전 종목 1400+개 스캔용)
  // (1) 최근 3개년 자산 증가율 TOP 80
  const topAssetList = [...validList]
    .sort((a, b) => b.assetGrowthRate - a.assetGrowthRate)
    .slice(0, 80);
  const topAssetCodes = new Set(topAssetList.map(s => s.code));

  // (2) 최근 3개년 영업이익 증가율 TOP 80
  const topOpList = [...validList]
    .sort((a, b) => b.opProfitGrowthRate - a.opProfitGrowthRate)
    .slice(0, 80);
  const topOpCodes = new Set(topOpList.map(s => s.code));

  // (3) 최근 3개년 매출액 증가율 TOP 80
  const topRevList = [...validList]
    .sort((a, b) => b.revenueGrowthRate - a.revenueGrowthRate)
    .slice(0, 80);
  const topRevCodes = new Set(topRevList.map(s => s.code));

  // (4) 부채비율 120% 이하 필터링
  const soundDebtList = validList.filter(s => s.debtRatio <= 120);

  // ⚡ 3. 대망의 4대 AND 조건 완벽 만족 종목 도출!
  // 자산 증가율 TOP 80 AND 영업이익 증가율 TOP 80 AND 매출액 증가율 TOP 80 AND 부채비율 <= 120%
  const perfectAndMatches = validList
    .filter(s => 
      topAssetCodes.has(s.code) &&
      topOpCodes.has(s.code) &&
      topRevCodes.has(s.code) &&
      s.debtRatio <= 120
    )
    .map(s => {
      // 4대 종합 성장 점수 계산
      const score = Math.round(
        (s.assetGrowthRate * 0.25) + 
        (s.opProfitGrowthRate * 0.35) + 
        (s.revenueGrowthRate * 0.25) + 
        (Math.max(0, 120 - s.debtRatio) * 0.15)
      );
      return {
        ...s,
        growthScore: score,
        isPerfectMatch: true,
        matchTags: ['💎 자산증가율 TOP80', '🚀 영업이익증가율 TOP80', '💰 매출증가율 TOP80', '🛡️ 부채비율 120%이하']
      };
    })
    .sort((a, b) => b.growthScore - a.growthScore);

  // 4. 근접 종목 (4개 중 3개 이상 만족하는 우량 후보군)
  const strongCandidates = validList
    .filter(s => !perfectAndMatches.some(p => p.code === s.code))
    .map(s => {
      let matchedCount = 0;
      const tags = [];
      if (topAssetCodes.has(s.code)) { matchedCount++; tags.push('자산증가 TOP80'); }
      if (topOpCodes.has(s.code)) { matchedCount++; tags.push('영업이익증가 TOP80'); }
      if (topRevCodes.has(s.code)) { matchedCount++; tags.push('매출증가 TOP80'); }
      if (s.debtRatio <= 120) { matchedCount++; tags.push('부채 120%이하'); }

      const score = Math.round(
        (s.assetGrowthRate * 0.25) + 
        (s.opProfitGrowthRate * 0.35) + 
        (s.revenueGrowthRate * 0.25) + 
        (Math.max(0, 120 - s.debtRatio) * 0.15)
      );

      return {
        ...s,
        growthScore: score,
        matchedCount,
        matchTags: tags,
        isPerfectMatch: false
      };
    })
    .filter(s => s.matchedCount >= 2 && s.debtRatio <= 120)
    .sort((a, b) => (b.matchedCount - a.matchedCount) || (b.growthScore - a.growthScore));

  console.log('🚀 [종목 발굴기] 4대 퀀트 종목 대상 [밥그릇 3번 & 매집완료 트리플 돌파] 초고속 병렬 분석 수행 중...');
  const bowlChunkSize = 25;
  for (let i = 0; i < validList.length; i += bowlChunkSize) {
    const chunk = validList.slice(i, i + bowlChunkSize);
    await Promise.all(chunk.map(async s => {
      try {
        const [candles, trends] = await Promise.all([
          fetchDailyCandlesForBowl(s.code),
          fetchStockTrendData(s.code)
        ]);
        s.bowlPattern = analyzeBowlPattern(candles, s.name, s.code);
        s.breakoutAnalysis = analyzeAccumulationBreakout(candles, trends, s.name, s.code);
      } catch (err) {
        s.bowlPattern = null;
        s.breakoutAnalysis = null;
      }
    }));
    await new Promise(r => setTimeout(r, 10)); // 10ms 슬립
  }

  // 5. 전체 평가 종목 풀 (체크박스 동적 AND 결합 필터링용)
  const allStocks = validList.map(s => {
    const inTopAsset = topAssetCodes.has(s.code);
    const inTopOp = topOpCodes.has(s.code);
    const inTopRev = topRevCodes.has(s.code);
    const isSoundDebt = s.debtRatio <= 120;
    let matchedCount = 0;
    const matchTags = [];
    if (inTopAsset) { matchedCount++; matchTags.push('자산증가 TOP20'); }
    if (inTopOp) { matchedCount++; matchTags.push('영업이익증가 TOP20'); }
    if (inTopRev) { matchedCount++; matchTags.push('매출증가 TOP20'); }
    if (isSoundDebt) { matchedCount++; matchTags.push('부채 120%이하'); }

    const score = Math.round(
      (s.assetGrowthRate * 0.25) + 
      (s.opProfitGrowthRate * 0.35) + 
      (s.revenueGrowthRate * 0.25) + 
      (Math.max(0, 120 - s.debtRatio) * 0.15)
    );

    return {
      ...s,
      inTopAsset,
      inTopOp,
      inTopRev,
      isSoundDebt,
      matchedCount,
      matchTags,
      growthScore: score,
      isPerfectMatch: matchedCount === 4,
      bowlPattern: s.bowlPattern || null,
      breakoutAnalysis: s.breakoutAnalysis || null
    };
  }).sort((a, b) => (b.matchedCount - a.matchedCount) || (b.growthScore - a.growthScore));

  const bowlMatches = allStocks
    .filter(s => s.bowlPattern && s.bowlPattern.isBowlStage3)
    .sort((a, b) => (b.bowlPattern.score - a.bowlPattern.score) || (a.bowlPattern.reboundFromBottom - b.bowlPattern.reboundFromBottom));

  const breakoutMatches = allStocks
    .filter(s => s.breakoutAnalysis && s.breakoutAnalysis.isTripleBreakout)
    .sort((a, b) => (b.breakoutAnalysis.score - a.breakoutAnalysis.score));

  const responseData = {
    success: true,
    timestamp: new Date().toISOString(),
    totalScanned: results.length,
    validScanned: validList.length,
    summary: {
      perfectCount: perfectAndMatches.length,
      topAssetCount: topAssetList.length,
      topOpCount: topOpList.length,
      topRevCount: topRevList.length,
      soundDebtCount: soundDebtList.length
    },
    allStocks,
    perfectMatches: perfectAndMatches,
    strongCandidates: strongCandidates.slice(0, 15),
    topAssetList: topAssetList.map((s, idx) => ({ ...s, rank: idx + 1 })),
    topOpList: topOpList.map((s, idx) => ({ ...s, rank: idx + 1 })),
    topRevList: topRevList.map((s, idx) => ({ ...s, rank: idx + 1 })),
    soundDebtList: soundDebtList.sort((a, b) => a.debtRatio - b.debtRatio).slice(0, 20)
  };

  // 캐시 저장
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(responseData, null, 2), 'utf8');
    console.log(`✅ [종목 발굴기] 스크리닝 완료: 4대 AND 올킬 종목 ${perfectAndMatches.length}개 포착!`);
  } catch (e) {
    console.error('캐시 저장 에러:', e.message);
  }

  return responseData;
}
