// dart_asset_growth.js — 📊 DART 공식 재무제표(재무상태표) 기반 실제 자산총계 3개년 추이
//
// growth_stock_screener.js는 BPS×(1+부채비율/100)로 자산총계를 "추정"하지만, 이 모듈은
// DART 정기보고서 API(fnlttSinglAcntAll.json)에서 재무상태표의 "자산총계" 원본 수치를 그대로
// 가져온다 — 연간보고서(reprt_code=11011) 1회 조회로 당기·전기·전전기 3개년이 한 번에 온다.
import axios from 'axios';
import { DART_KEY } from './nps_tracker.js';
import { getCorpCodeMap } from './nps_holding_history.js';

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12시간
const cache = new Map();

async function fetchAssetRow(corpCode, bsnsYear, fsDiv) {
  const res = await axios.get('https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json', {
    params: { crtfc_key: DART_KEY, corp_code: corpCode, bsns_year: String(bsnsYear), reprt_code: '11011', fs_div: fsDiv },
    timeout: 8000,
  });
  if (res.data?.status !== '000') return null;
  const row = (res.data.list || []).find(r => r.sj_div === 'BS' && r.account_nm === '자산총계');
  if (!row) return null;
  return row;
}

// 최근 완결 사업연도부터 1개 과거로 거슬러 올라가며(사업보고서 미제출 대비), 연결(CFS)
// 우선 조회 후 없으면 별도(OFS)로 재시도 — 소규모 종목은 연결재무제표가 없는 경우가 많다.
async function findAssetRow(corpCode) {
  const currentYear = new Date().getFullYear();
  for (const yearOffset of [1, 2]) {
    const bsnsYear = currentYear - yearOffset;
    for (const fsDiv of ['CFS', 'OFS']) {
      try {
        const row = await fetchAssetRow(corpCode, bsnsYear, fsDiv);
        if (row) return { row, fsDiv, bsnsYear };
      } catch { /* 다음 조합 시도 */ }
    }
  }
  return null;
}

// DART가 주는 thstrm_nm 등("제 57 기")은 사업연도를 바로 알기 어려워서, 조회에 쓴 bsnsYear
// 기준으로 실제 캘린더 연도 레이블("2025년")을 직접 계산해 붙인다.
function buildHistory(row, bsnsYear) {
  const points = [
    { period: `${bsnsYear - 2}년`, fiscalTerm: row.bfefrmtrm_nm, amount: Number(row.bfefrmtrm_amount) },
    { period: `${bsnsYear - 1}년`, fiscalTerm: row.frmtrm_nm, amount: Number(row.frmtrm_amount) },
    { period: `${bsnsYear}년`, fiscalTerm: row.thstrm_nm, amount: Number(row.thstrm_amount) },
  ].filter(p => Number.isFinite(p.amount) && p.amount > 0);

  const history = points.map((p, i) => {
    const prev = points[i - 1];
    const growthRate = prev ? parseFloat((((p.amount - prev.amount) / prev.amount) * 100).toFixed(2)) : null;
    return { period: p.period, fiscalTerm: p.fiscalTerm, totalAssets: p.amount, growthRate };
  });

  const first = points[0];
  const last = points[points.length - 1];
  const overallGrowthRate = (first && last && first !== last)
    ? parseFloat((((last.amount - first.amount) / first.amount) * 100).toFixed(2))
    : null;

  return { history, overallGrowthRate };
}

// 종목 상세 팝업용 — 3개년 자산총계 추이 전체(그래프용)
export async function getAssetGrowthHistory(code) {
  const cached = cache.get(code);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) return cached.data;

  const map = getCorpCodeMap();
  const corpInfo = map[code];
  if (!corpInfo) {
    const empty = { success: false, code, error: 'DART 고유번호 매핑을 찾을 수 없는 종목입니다.', history: [] };
    cache.set(code, { data: empty, ts: Date.now() });
    return empty;
  }

  try {
    const found = await findAssetRow(corpInfo.corpCode);
    if (!found) {
      const empty = { success: false, code, corpName: corpInfo.corpName, error: '자산총계 데이터를 찾을 수 없습니다.', history: [] };
      cache.set(code, { data: empty, ts: Date.now() });
      return empty;
    }
    const { history, overallGrowthRate } = buildHistory(found.row, found.bsnsYear);
    const result = {
      success: true,
      code,
      corpName: corpInfo.corpName,
      fsDiv: found.fsDiv === 'CFS' ? '연결재무제표' : '별도재무제표',
      history,
      overallGrowthRate,
      source: 'DART 정기보고서(재무상태표 자산총계)',
    };
    cache.set(code, { data: result, ts: Date.now() });
    return result;
  } catch (e) {
    const err = { success: false, code, corpName: corpInfo.corpName, error: e.message, history: [] };
    cache.set(code, { data: err, ts: Date.now() });
    return err;
  }
}

// 종목 발굴기 콤보 스캐너용 — 3개년 전체 성장률 숫자 하나만 (동일 캐시 재사용, 조회 실패 시 null)
export async function getRealAssetGrowthRate(code) {
  const data = await getAssetGrowthHistory(code);
  return data.success ? data.overallGrowthRate : null;
}
