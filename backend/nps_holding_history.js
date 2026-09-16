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
import { DART_KEY, fetchNpsDisclosuresFromDart } from './nps_tracker.js';

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

// 하루에 한 번, 매일 새벽 01:00 시점을 기준으로 캐시를 갱신한다 (단순 "마지막 조회 후 24시간"이 아니라
// 시각 고정 — 예: 00:50에 조회된 캐시는 01:00이 지나면 바로 갱신 대상이 되도록).
function getLastOneAmBoundary() {
  const now = new Date();
  const boundary = new Date(now);
  boundary.setHours(1, 0, 0, 0);
  if (now < boundary) boundary.setDate(boundary.getDate() - 1);
  return boundary.getTime();
}

export async function getNpsHoldingHistory(code) {
  const now = Date.now();
  const boundary = getLastOneAmBoundary();
  if (historyCache[code] && historyCache[code].ts >= boundary) {
    // isNew는 배치가 registry를 갱신하는 시점과 무관하게 항상 최신 상태로 재평가한다
    // (캐시에 박제해두면 배치 실행 도중/직후 조회 시 갱신 전 값이 굳어버리는 문제가 있었다).
    return { ...historyCache[code].data, isNew: isStockNpsNew(code) };
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
    result.isNew = isStockNpsNew(code);
    return result;

  } catch (e) {
    console.error(`[nps-holding-history] ${code} 조회 오류:`, e.message);
    return { success: false, code, error: e.message, history: [] };
  }
}

// ─── 🌙 매일 새벽 01:00 배치: 국민연금 신규 대량보유 공시 전수 스캔 & "NEW" 감지 ───
//
// DART majorstock.json은 종목(corp_code) 단위로만 조회되므로 전종목을 매일 순회하는 건 비효율적이다.
// 대신 DART list.json(대량보유상황보고 목록, D001)에서 "국민연금"이 제출인인 최근 공시만 먼저 골라내고
// (nps_tracker.js의 fetchNpsDisclosuresFromDart — 실제 전자공시 원문 기반, 소수의 종목만 매칭됨),
// 그 종목들에 대해서만 majorstock.json으로 실제 보유비중을 갱신한다.
const RECENT_UPDATES_FILE = path.join(__dirname, 'data', 'nps_recent_updates.json');
const NEW_BADGE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 감지 후 3일간 "NEW" 배지 유지

function loadRecentUpdatesRegistry() {
  if (!existsSync(RECENT_UPDATES_FILE)) return {};
  try {
    return JSON.parse(readFileSync(RECENT_UPDATES_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveRecentUpdatesRegistry(registry) {
  writeFileSync(RECENT_UPDATES_FILE, JSON.stringify(registry, null, 2), 'utf-8');
}

// 특정 종목이 최근(기본 3일 이내) 새로 감지된 국민연금 공시 대상인지 여부
export function isStockNpsNew(code) {
  const registry = loadRecentUpdatesRegistry();
  const entry = registry[code];
  if (!entry) return false;
  return (Date.now() - entry.seenAt) < NEW_BADGE_WINDOW_MS;
}

// 최근 NEW 윈도우 내의 전체 업데이트 목록 (다른 화면에서도 재사용 가능하도록 공개)
export function getNpsRecentUpdates() {
  const registry = loadRecentUpdatesRegistry();
  const cutoff = Date.now() - NEW_BADGE_WINDOW_MS;
  return Object.values(registry)
    .filter(r => r.seenAt >= cutoff)
    .sort((a, b) => b.seenAt - a.seenAt);
}

// 오늘 새벽 01:00 배치에서 "처음" 감지된 종목만 (아침에 그날 신규 공시만 확인하고 싶은 용도).
// NEW 배지(3일 유지)와 달리, 이건 마지막 01:00 경계 이후에 seenAt이 찍힌 것만 추린다.
export function getNpsTodayNewDisclosures() {
  const registry = loadRecentUpdatesRegistry();
  const boundary = getLastOneAmBoundary();
  return Object.values(registry)
    .filter(r => r.seenAt >= boundary)
    .sort((a, b) => b.seenAt - a.seenAt);
}

let batchInFlight = null;

export async function runNpsHoldingBatchScan() {
  if (batchInFlight) return batchInFlight;
  batchInFlight = executeNpsHoldingBatchScan().finally(() => { batchInFlight = null; });
  return batchInFlight;
}

async function executeNpsHoldingBatchScan() {
  const startedAt = Date.now();
  console.log('[NPS HOLDING BATCH] 국민연금 신규 대량보유 공시 스캔 시작...');

  let disclosures = [];
  try {
    disclosures = await fetchNpsDisclosuresFromDart();
  } catch (e) {
    console.error('[NPS HOLDING BATCH] DART 공시 목록 조회 실패:', e.message);
    return { success: false, error: e.message };
  }

  const targetCodes = [...new Set(
    disclosures.filter(d => d.stockCode && /^\d{6}$/.test(d.stockCode)).map(d => d.stockCode)
  )];

  const registry = loadRecentUpdatesRegistry();
  let newlyDetected = 0;

  for (const code of targetCodes) {
    // 캐시를 비우고 majorstock.json에서 실제 최신 보유비중을 재조회
    delete historyCache[code];
    const data = await getNpsHoldingHistory(code);
    if (!data.success || data.history.length === 0) continue;

    const latest = data.history[data.history.length - 1];
    const existing = registry[code];

    // 직전 배치에서 이미 같은 공시(rceptNo)를 감지했다면 "처음 감지된 시각"을 유지해 NEW 배지가
    // 매번 갱신되지 않고 정확히 3일 후 만료되도록 한다.
    if (!existing || existing.rceptNo !== latest.rceptNo) {
      registry[code] = {
        stockCode: code,
        corpName: data.corpName,
        date: latest.date,
        ratio: latest.ratio,
        ratioChange: latest.ratioChange,
        reason: latest.reason,
        rceptNo: latest.rceptNo,
        seenAt: startedAt
      };
      newlyDetected++;
    }
  }

  saveRecentUpdatesRegistry(registry);

  const tookSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[NPS HOLDING BATCH] 완료 — 대상 ${targetCodes.length}종목 중 신규 감지 ${newlyDetected}건 (${tookSec}초 소요)`);
  return { success: true, scanned: targetCodes.length, newlyDetected };
}

// ─── 🌙 매일 새벽 01:00 자동 배치 스케줄러 ───
export function startDailyNpsHoldingBatchScan() {
  const scheduleNext = () => {
    const now = new Date();
    const target = new Date(now);
    target.setHours(1, 0, 0, 0);
    if (now >= target) target.setDate(target.getDate() + 1);
    const msUntil = target.getTime() - now.getTime();
    console.log(`[NPS HOLDING BATCH] 다음 자동 스캔: ${target.toLocaleString('ko-KR')} (${Math.round(msUntil / 60000)}분 후)`);
    setTimeout(async () => {
      await runNpsHoldingBatchScan();
      scheduleNext();
    }, msUntil);
  };

  // 서버 기동 시 최초 1회 즉시 실행하여 NEW 감지 데이터를 미리 구축
  runNpsHoldingBatchScan().then(() => scheduleNext()).catch(e => {
    console.error('[NPS HOLDING BATCH] 초기 스캔 실패:', e.message);
    scheduleNext();
  });
}
