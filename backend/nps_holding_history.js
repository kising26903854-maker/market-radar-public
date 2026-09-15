// nps_holding_history.js — 📈 종목별 국민연금공단 보유비중 변동 이력 (DART 대량보유 상황보고서 원문 기반)
//
// DART의 대량보유 상황보고 목록 API(list.json)는 공시 제목/날짜만 제공하고 실제 지분율·주식수를
// 주지 않으므로, 여기서는 종목별 상세 변동 이력을 제공하는 majorstock.json(대량보유 상황보고)을
// corp_code 단위로 직접 조회해 국민연금공단(repror) 보고 건만 추출한다.
// 5%룰 특성상 보유비중이 1%p 이상 변동하거나 보유목적이 바뀔 때만 신규 공시가 발생하므로,
// 결과는 촘촘한 시계열이 아니라 "변동 시점 스냅샷"의 계단형 이력이 된다 — 이것이 실제 데이터의 형태다.
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { DART_KEY } from './nps_tracker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CORPCODE_XML = path.join(__dirname, 'data', 'nps_quarters', 'CORPCODE.xml');
const CORPCODE_MAP_CACHE = path.join(__dirname, 'data', 'corp_code_map.json');

let corpCodeMapMemo = null;

// ── stockCode → { corpCode, corpName } 매핑 (DART 고유번호 전체 목록 1회 파싱 후 캐시) ──
function buildCorpCodeMap() {
  if (existsSync(CORPCODE_MAP_CACHE)) {
    try {
      return JSON.parse(readFileSync(CORPCODE_MAP_CACHE, 'utf-8'));
    } catch { /* 캐시 손상 시 재생성 */ }
  }
  if (!existsSync(CORPCODE_XML)) return {};

  const xml = readFileSync(CORPCODE_XML, 'utf-8');
  const re = /<corp_code>(\d+)<\/corp_code>\s*<corp_name>([^<]*)<\/corp_name>\s*<corp_eng_name>[^<]*<\/corp_eng_name>\s*<stock_code>\s*(\d{6})?\s*<\/stock_code>/g;
  const map = {};
  let m;
  while ((m = re.exec(xml)) !== null) {
    const [, corpCode, corpName, stockCode] = m;
    if (stockCode) map[stockCode] = { corpCode, corpName };
  }
  writeFileSync(CORPCODE_MAP_CACHE, JSON.stringify(map));
  return map;
}

function getCorpCodeMap() {
  if (!corpCodeMapMemo) corpCodeMapMemo = buildCorpCodeMap();
  return corpCodeMapMemo;
}

const historyCache = {};
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function getNpsHoldingHistory(code) {
  const now = Date.now();
  if (historyCache[code] && now - historyCache[code].ts < CACHE_TTL_MS) {
    return historyCache[code].data;
  }

  const map = getCorpCodeMap();
  const corpInfo = map[code];
  if (!corpInfo) {
    return { success: false, code, error: 'DART 고유번호 매핑을 찾을 수 없는 종목입니다.', history: [] };
  }

  try {
    const res = await axios.get('https://opendart.fss.or.kr/api/majorstock.json', {
      params: { crtfc_key: DART_KEY, corp_code: corpInfo.corpCode, page_no: 1, page_count: 100 },
      timeout: 10000
    });

    if (res.data.status !== '000') {
      // status '013' = 조회된 데이터 없음 (해당 기업의 대량보유 공시 이력 자체가 없음)
      const empty = { success: true, code, corpCode: corpInfo.corpCode, corpName: corpInfo.corpName, history: [], isLive: true, source: 'DART 대량보유상황보고서(majorstock.json)' };
      historyCache[code] = { data: empty, ts: now };
      return empty;
    }

    const npsFilings = (res.data.list || [])
      .filter(r => r.repror && r.repror.includes('국민연금'))
      .map(r => ({
        date: r.rcept_dt,
        ratio: parseFloat(r.stkrt),
        ratioChange: r.stkrt_irds !== '-' ? parseFloat(r.stkrt_irds) : null,
        shares: r.stkqy !== '-' ? parseInt(r.stkqy.replace(/,/g, ''), 10) : null,
        sharesChange: r.stkqy_irds !== '-' ? parseInt(r.stkqy_irds.replace(/,/g, ''), 10) : null,
        reportType: r.report_tp,
        reason: r.report_resn,
        rceptNo: r.rcept_no
      }))
      .filter(h => !isNaN(h.ratio))
      .sort((a, b) => a.date.localeCompare(b.date));

    const result = {
      success: true,
      code,
      corpCode: corpInfo.corpCode,
      corpName: corpInfo.corpName,
      history: npsFilings,
      isLive: true,
      source: 'DART 대량보유상황보고서(majorstock.json)',
      note: '5%룰 특성상 보유비중이 1%p 이상 변동하거나 보유목적이 변경될 때만 공시가 발생합니다. 매일/매분기 데이터가 아닌 변동 시점 스냅샷입니다.'
    };
    historyCache[code] = { data: result, ts: now };
    return result;

  } catch (e) {
    console.error(`[nps-holding-history] ${code} 조회 오류:`, e.message);
    return { success: false, code, error: e.message, history: [] };
  }
}
