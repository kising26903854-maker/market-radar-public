// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📊 financials_sync.js
// 네이버 금융 finance/annual API → 36개 종목
// PER, PBR, ROE, EPS, BPS, 배당금 자동 수집 및 캐시
// 매일 08:35 자동 갱신 (장전 데이터 최신화)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, 'data', 'financials_cache.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  'Referer': 'https://m.stock.naver.com/',
  'Accept': 'application/json',
};

// ─── 36개 종목 목록 (market: KS=코스피, KQ=코스닥) ───
export const STOCK_LIST = [
  { code: '000270', name: '기아',          market: 'KS' },
  { code: '005380', name: '현대차',        market: 'KS' },
  { code: '012330', name: '현대모비스',    market: 'KS' },
  { code: '058470', name: '리노공업',      market: 'KQ' },
  { code: '005930', name: '삼성전자',      market: 'KS' },
  { code: '042700', name: '한미반도체',    market: 'KS' },
  { code: '035720', name: '동진쎄미켐',    market: 'KQ' },
  { code: '039030', name: '이오테크닉스',  market: 'KQ' },
  { code: '222800', name: '심텍',          market: 'KQ' },
  { code: '036930', name: '주성엔지니어링',market: 'KQ' },
  { code: '214150', name: '클래시스',      market: 'KQ' },
  { code: '145020', name: '휴젤',          market: 'KQ' },
  { code: '263800', name: '실리콘투',      market: 'KQ' },
  { code: '145720', name: '덴티움',        market: 'KS' },
  { code: '068270', name: '셀트리온',      market: 'KS' },
  { code: '028300', name: 'HLB',           market: 'KQ' },
  { code: '196170', name: '알테오젠',      market: 'KQ' },
  { code: '011200', name: 'HMM',           market: 'KS' },
  { code: '005490', name: 'POSCO홀딩스',   market: 'KS' },
  { code: '011170', name: '롯데케미칼',    market: 'KS' },
  { code: '004020', name: '현대제철',      market: 'KS' },
  { code: '247540', name: '에코프로비엠',  market: 'KQ' },
  { code: '348370', name: '엔켐',          market: 'KQ' },
  { code: '006400', name: '삼성SDI',       market: 'KS' },
  { code: '105560', name: 'KB금융',        market: 'KS' },
  { code: '055550', name: '신한지주',      market: 'KS' },
  { code: '086790', name: '하나금융지주',  market: 'KS' },
  { code: '024110', name: '기업은행',      market: 'KS' },
  { code: '017670', name: 'SK텔레콤',      market: 'KS' },
  { code: '030200', name: 'KT',            market: 'KS' },
  { code: '097950', name: 'CJ제일제당',    market: 'KS' },
  { code: '033780', name: 'KT&G',          market: 'KS' },
  { code: '263750', name: '펄어비스',      market: 'KQ' },
  { code: '259960', name: '크래프톤',      market: 'KS' },
  { code: '277810', name: '레인보우로보틱스',market: 'KQ' },
  { code: '357780', name: '솔브레인',      market: 'KQ' },
  { code: '047050', name: '포스코인터내셔널',market: 'KS' },
];

// ─── 네이버 finance/annual API에서 재무 데이터 수집 ───
async function fetchFinancials(code) {
  try {
    const url = `https://m.stock.naver.com/api/stock/${code}/finance/annual`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 6000 });
    const rows = res.data?.financeInfo?.rowList || [];
    const periods = res.data?.financeInfo?.trTitleList || [];

    // 최신 확정 기간 찾기 (isConsensus === 'N' 중 가장 최신)
    const confirmed = periods.filter(p => p.isConsensus === 'N');
    const latestKey = confirmed.length > 0 ? confirmed[confirmed.length - 1].key : null;
    const prevKey   = confirmed.length > 1 ? confirmed[confirmed.length - 2].key : null;

    const getVal = (title, key) => {
      const row = rows.find(r => r.title === title);
      const raw = row?.columns?.[key]?.value;
      if (!raw || raw === '-' || raw === 'N/A') return null;
      return parseFloat(raw.replace(/,/g, '')) || null;
    };

    const per     = getVal('PER',  latestKey);
    const pbr     = getVal('PBR',  latestKey);
    const roe     = getVal('ROE',  latestKey);
    const eps     = getVal('EPS',  latestKey);
    const bps     = getVal('BPS',  latestKey);
    const divRaw  = getVal('주당배당금', latestKey);

    // 배당수익률 계산: 배당금 / BPS * PBR (BPS * PBR ≒ 현재가)
    // 또는 직접 current price로 나눔 (정확도 높임)
    // 여기서는 BPS*PBR로 추정 주가 계산
    const approxPrice = (bps && pbr) ? Math.round(bps * pbr) : null;
    const divYield = (divRaw && approxPrice && approxPrice > 0)
      ? parseFloat(((divRaw / approxPrice) * 100).toFixed(2))
      : null;

    // 전년도 ROE (성장 추세 분석용)
    const roePrev = getVal('ROE', prevKey);

    return {
      code,
      fetchedAt: new Date().toISOString(),
      period: latestKey,
      per:      per      ? parseFloat(per.toFixed(1))  : null,
      pbr:      pbr      ? parseFloat(pbr.toFixed(2))  : null,
      roe:      roe      ? parseFloat(roe.toFixed(1))  : null,
      roePrev:  roePrev  ? parseFloat(roePrev.toFixed(1)): null,
      eps:      eps      ? Math.round(eps)              : null,
      bps:      bps      ? Math.round(bps)              : null,
      divAmount:divRaw   ? Math.round(divRaw)           : null,
      divYield: divYield,
      roeGrowth: (roe && roePrev) ? parseFloat((roe - roePrev).toFixed(1)) : null,
    };
  } catch (e) {
    console.warn(`[FINANCIALS] ${code} 수집 실패:`, e.message);
    return { code, fetchedAt: new Date().toISOString(), error: e.message };
  }
}

// ─── 전체 36개 종목 일괄 수집 ───
export async function syncAllFinancials() {
  console.log('[FINANCIALS SYNC] 네이버 finance/annual API에서 36개 종목 재무 데이터 수집 시작...');
  const results = {};
  
  // 배치 처리 (한 번에 5개씩, API 부하 방지)
  const batchSize = 5;
  for (let i = 0; i < STOCK_LIST.length; i += batchSize) {
    const batch = STOCK_LIST.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(s => fetchFinancials(s.code)));
    batchResults.forEach(r => { results[r.code] = r; });
    if (i + batchSize < STOCK_LIST.length) {
      await new Promise(res => setTimeout(res, 500)); // 500ms 딜레이
    }
  }

  // 캐시 파일 저장
  const cache = {
    lastSyncAt: new Date().toISOString(),
    count: Object.keys(results).length,
    data: results,
  };
  
  const dir = path.dirname(CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
  console.log(`[FINANCIALS SYNC] ✅ ${cache.count}개 종목 재무 데이터 저장 완료 → ${CACHE_PATH}`);
  return results;
}

// ─── 캐시에서 단일 종목 재무 데이터 읽기 ───
export function getCachedFinancials(code) {
  try {
    if (!fs.existsSync(CACHE_PATH)) return null;
    const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    return cache.data?.[code] || null;
  } catch {
    return null;
  }
}

// ─── 캐시 전체 읽기 ───
export function getAllCachedFinancials() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return {};
    const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    return cache.data || {};
  } catch {
    return {};
  }
}

// ─── 캐시가 오래됐는지 확인 (24시간 기준) ───
export function isCacheStale() {
  try {
    if (!fs.existsSync(CACHE_PATH)) return true;
    const cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    const lastSync = new Date(cache.lastSyncAt);
    const hoursSince = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
    return hoursSince > 24;
  } catch {
    return true;
  }
}

// ─── 자동 스케줄러 (매일 08:35 갱신) ───
export function startDailyFinancialsSync() {
  const scheduleNext = () => {
    const now = new Date();
    const target = new Date(now);
    target.setHours(8, 35, 0, 0);
    if (now >= target) target.setDate(target.getDate() + 1); // 이미 지났으면 다음날
    
    const msUntil = target.getTime() - now.getTime();
    console.log(`[FINANCIALS SYNC] 다음 자동 갱신: ${target.toLocaleString('ko-KR')} (${Math.round(msUntil/60000)}분 후)`);
    
    setTimeout(async () => {
      await syncAllFinancials();
      scheduleNext(); // 다음 날 예약
    }, msUntil);
  };
  
  // 앱 시작 시 캐시가 없거나 오래됐으면 즉시 갱신
  if (isCacheStale()) {
    console.log('[FINANCIALS SYNC] 캐시가 없거나 24시간 이상 경과 → 즉시 갱신 시작');
    syncAllFinancials().then(() => scheduleNext());
  } else {
    console.log('[FINANCIALS SYNC] 캐시가 최신 상태입니다.');
    scheduleNext();
  }
}
