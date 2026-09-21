// trade_stats.js — 🚢 관세청 10일 단위 수출입 잠정치 통계 (공공데이터포털 오픈API)
//
// 관세청이 매월 1~10일/1~20일/1~말일 세 차례(각 11일/21일/익월 1일 발표) 공개하는
// 품목별·국가별 수출입 잠정치를 가져와 품목/국가 비중, 전월·전분기·작년동기 대비
// 증감률까지 계산해 캐시에 저장한다. 정부 API 호출은 하루 한 번(자동 스케줄)만
// 수행하고, 프론트엔드는 이 캐시를 읽는 /api/trade-stats 엔드포인트만 호출한다.
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_PATH = path.join(__dirname, 'data', 'trade_stats_cache.json');

// data.go.kr 공식 API 상세 스펙(Swagger)에서 확인한 오퍼레이션 경로 + 10대 품목/국가 순서
const ENDPOINTS = {
  importItem: {
    url: 'https://apis.data.go.kr/1220000/prlstMmUtPrviImpAcrs/getPrlstMmUtPrviImpAcrs',
    labels: ['반도체', '원유', '기계류', '가스', '반도체 제조용장비', '정밀기기', '석유제품', '무선 통신기기', '승용차', '석탄']
  },
  exportItem: {
    url: 'https://apis.data.go.kr/1220000/prlstMmUtPrviExpAcrs/getPrlstMmUtPrviExpAcrs',
    labels: ['반도체', '철강제품', '승용차', '석유제품', '무선통신기기', '선박', '자동차부품', '컴퓨터 주변기기', '정밀기기', '가전제품']
  },
  importCountry: {
    url: 'https://apis.data.go.kr/1220000/cntyMmUtPrviImpAcrs/getCntyMmUtPrviImpAcrs',
    labels: ['중국', '미국', '유럽연합', '일본', '베트남', '호주', '대만', '사우디아라비아', '러시아연방', '말레이시아']
  },
  exportCountry: {
    url: 'https://apis.data.go.kr/1220000/cntyMmUtPrviExpAcrs/getCntyMmUtPrviExpAcrs',
    labels: ['중국', '미국', '유럽연합', '베트남', '홍콩', '일본', '대만', '인도', '싱가포르', '말레이시아']
  }
};

function parseAmount(raw) {
  const n = parseInt(String(raw || '').replace(/[^0-9-]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

// "YYYYMM" + "01~10|01~20|01~말일" → 시간순 정렬/비교용 정렬키
function periodSortKey(item) {
  const rangeOrder = item.periodRange.startsWith('01~1') ? 0 : (item.periodRange.startsWith('01~2') ? 1 : 2);
  return `${item.month}-${rangeOrder}`;
}

async function fetchEndpoint(key) {
  const { url, labels } = ENDPOINTS[key];
  const serviceKey = process.env.DATA_GO_KR_API_KEY;
  if (!serviceKey) throw new Error('DATA_GO_KR_API_KEY 환경변수가 설정되지 않았습니다.');

  // 최근 25개월치 조회 (작년 동기 비교까지 여유있게 커버)
  const now = new Date();
  const endYymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const startDate = new Date(now.getFullYear(), now.getMonth() - 24, 1);
  const strtYymm = `${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, '0')}`;

  const res = await axios.get(url, {
    params: { serviceKey, strtYymm, endYymm },
    timeout: 15000
  });

  const $ = cheerio.load(res.data, { xmlMode: true });
  const resultCode = $('resultCode').first().text().trim();
  if (resultCode !== '00') {
    throw new Error(`[${key}] API 오류 (${resultCode}) ${$('resultMsg').first().text().trim()}`);
  }

  const items = [];
  $('item').each((i, el) => {
    const field = (name) => $(el).find(name).first().text();
    const total = parseAmount(field('itemUsdAmt00'));
    const breakdown = labels.map((label, idx) => ({
      label,
      amount: parseAmount(field(`itemUsdAmt${String(idx + 1).padStart(2, '0')}`))
    }));
    items.push({
      year: field('priodYear').trim(),
      month: field('priodMon').trim(),        // "YYYYMM"
      periodRange: field('priodDt').trim(),   // "01~10" | "01~20" | "01~30/31"
      total,
      breakdown
    });
  });

  items.sort((a, b) => periodSortKey(a).localeCompare(periodSortKey(b)));
  return items;
}

// 같은 구간(01~10/01~20/월말)을 기준으로 n개월 전 데이터를 찾는다
function findComparablePeriod(items, latest, monthsAgo) {
  const y = parseInt(latest.month.slice(0, 4), 10);
  const m = parseInt(latest.month.slice(4, 6), 10);
  const targetDate = new Date(y, m - 1 - monthsAgo, 1);
  const targetMonth = `${targetDate.getFullYear()}${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
  const sameRangeType = latest.periodRange.startsWith('01~1') ? '01~1' : (latest.periodRange.startsWith('01~2') ? '01~2' : '01~3');
  return items.find(it => it.month === targetMonth && it.periodRange.startsWith(sameRangeType)) || null;
}

function pctChange(cur, prev) {
  if (!prev || prev.total === 0) return null;
  return Math.round(((cur.total - prev.total) / prev.total) * 1000) / 10;
}

function buildComparison(items) {
  if (!items.length) return null;
  const latest = items[items.length - 1];
  const mom = findComparablePeriod(items, latest, 1);   // 전월 같은 구간
  const qoq = findComparablePeriod(items, latest, 3);   // 전분기(3개월전) 같은 구간
  const yoy = findComparablePeriod(items, latest, 12);  // 작년 동기 같은 구간
  return {
    latest,
    mom: mom ? { ...mom, pct: pctChange(latest, mom) } : null,
    qoq: qoq ? { ...qoq, pct: pctChange(latest, qoq) } : null,
    yoy: yoy ? { ...yoy, pct: pctChange(latest, yoy) } : null,
    // 최근 24개 구간 정도만 시계열 그래프용으로 추려서 보관 (월별 상세보기용으로 품목/국가 breakdown도 함께 저장)
    trend: items.slice(-24).map(it => ({ month: it.month, periodRange: it.periodRange, total: it.total, breakdown: it.breakdown }))
  };
}

export async function runTradeStatsSync() {
  const [importItem, exportItem, importCountry, exportCountry] = await Promise.all([
    fetchEndpoint('importItem'),
    fetchEndpoint('exportItem'),
    fetchEndpoint('importCountry'),
    fetchEndpoint('exportCountry')
  ]);

  const cache = {
    updatedAt: new Date().toISOString(),
    importItem: buildComparison(importItem),
    exportItem: buildComparison(exportItem),
    importCountry: buildComparison(importCountry),
    exportCountry: buildComparison(exportCountry)
  };

  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
  console.log(`✅ [TRADE STATS] 관세청 10일 단위 수출입 잠정치 동기화 완료 (최신: ${cache.exportItem?.latest?.month || '-'} ${cache.exportItem?.latest?.periodRange || ''})`);
  return cache;
}

export function getTradeStatsCache() {
  if (!fs.existsSync(CACHE_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

// 서버 기동 시 최초 1회 즉시 실행 + 매일 정해진 시각(07:30)에 자동 재동기화
export function startDailyTradeStatsSync() {
  const scheduleNext = () => {
    const now = new Date();
    const target = new Date(now);
    target.setHours(7, 30, 0, 0);
    if (now >= target) target.setDate(target.getDate() + 1);
    const msUntil = target.getTime() - now.getTime();
    console.log(`[TRADE STATS] 다음 자동 동기화: ${target.toLocaleString('ko-KR')} (${Math.round(msUntil / 60000)}분 후)`);
    setTimeout(async () => {
      try { await runTradeStatsSync(); } catch (e) { console.error('[TRADE STATS] 자동 동기화 실패:', e.message); }
      scheduleNext();
    }, msUntil);
  };

  runTradeStatsSync().catch(e => console.error('[TRADE STATS] 초기 동기화 실패:', e.message)).finally(scheduleNext);
}
