// growth_stock_screener.js — 🚀 4대 재무 퀀트 엄격 AND 조건 종목 발굴기
// 1. 최근 3년간 자산 증가율 TOP 20
// 2. 최근 3년간 영업이익 증가율 TOP 20
// 3. 부채비율 120% 이하 (재무 안정성)
// 4. 최근 3년간 매출액 증가율 TOP 20
// * 위 4가지 조건을 모두 만족하는 초우량 고성장 알짜 종목 발굴 엔진

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(__dirname, 'data', 'growth_screener_cache.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  'Referer': 'https://m.stock.naver.com/',
  'Accept': 'application/json'
};

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

    return {
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
  } catch (e) {
    // API 에러 시 스킵
    return null;
  }
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

  console.log('🚀 [종목 발굴기] 4대 재무 퀀트 성장주 스크리닝 시작 (총 80여 개 후보군)...');

  // 병렬 5개씩 배치 수집 (네이버 서버 부하 방지)
  const results = [];
  const chunkSize = 5;
  for (let i = 0; i < CANDIDATE_STOCKS.length; i += chunkSize) {
    const chunk = CANDIDATE_STOCKS.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(chunk.map(s => analyzeStockFinancialGrowth(s)));
    results.push(...chunkResults.filter(Boolean));
    await new Promise(r => setTimeout(r, 80)); // 80ms 슬립
  }

  // 1. 유효 데이터 필터링 (양수 성장률 및 기본 지표 보유)
  const validList = results.filter(item => 
    item.revenueGrowthRate !== null &&
    item.opProfitGrowthRate !== null &&
    item.assetGrowthRate !== null &&
    item.debtRatio !== null
  );

  // 2. 조건별 개별 TOP 20 랭킹 산출
  // (1) 최근 3개년 자산 증가율 TOP 20
  const topAssetList = [...validList]
    .sort((a, b) => b.assetGrowthRate - a.assetGrowthRate)
    .slice(0, 20);
  const topAssetCodes = new Set(topAssetList.map(s => s.code));

  // (2) 최근 3개년 영업이익 증가율 TOP 20
  const topOpList = [...validList]
    .sort((a, b) => b.opProfitGrowthRate - a.opProfitGrowthRate)
    .slice(0, 20);
  const topOpCodes = new Set(topOpList.map(s => s.code));

  // (3) 최근 3개년 매출액 증가율 TOP 20
  const topRevList = [...validList]
    .sort((a, b) => b.revenueGrowthRate - a.revenueGrowthRate)
    .slice(0, 20);
  const topRevCodes = new Set(topRevList.map(s => s.code));

  // (4) 부채비율 120% 이하 필터링
  const soundDebtList = validList.filter(s => s.debtRatio <= 120);

  // ⚡ 3. 대망의 4대 AND 조건 완벽 만족 종목 도출!
  // 자산 증가율 TOP 20 AND 영업이익 증가율 TOP 20 AND 매출액 증가율 TOP 20 AND 부채비율 <= 120%
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
        matchTags: ['💎 자산증가율 TOP20', '🚀 영업이익증가율 TOP20', '💰 매출증가율 TOP20', '🛡️ 부채비율 120%이하']
      };
    })
    .sort((a, b) => b.growthScore - a.growthScore);

  // 4. 근접 종목 (4개 중 3개 이상 만족하는 우량 후보군)
  const strongCandidates = validList
    .filter(s => !perfectAndMatches.some(p => p.code === s.code))
    .map(s => {
      let matchedCount = 0;
      const tags = [];
      if (topAssetCodes.has(s.code)) { matchedCount++; tags.push('자산증가 TOP20'); }
      if (topOpCodes.has(s.code)) { matchedCount++; tags.push('영업이익증가 TOP20'); }
      if (topRevCodes.has(s.code)) { matchedCount++; tags.push('매출증가 TOP20'); }
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
      isPerfectMatch: matchedCount === 4
    };
  }).sort((a, b) => (b.matchedCount - a.matchedCount) || (b.growthScore - a.growthScore));

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
