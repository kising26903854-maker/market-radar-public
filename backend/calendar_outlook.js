// calendar_outlook.js — 📅 증시 캘린더 "예상치(컨센서스) · 이전 발표치" 자동 갱신
//
// 일정별 예상치는 발표 1~2주 전에야 형성되므로, 주기적으로 무료 공개 소스를 조회해서
// 예상치가 나오는 대로 data/market_calendar_outlook.json에 채워 넣는다(캘린더 API가 병합해서 내려줌).
//  - 미국 경제지표: Forex Factory 공개 주간 캘린더 JSON (이번 주/다음 주, forecast·previous 제공)
//  - 미국 기업 실적: Nasdaq 실적 캘린더 API (EPS 예상치·전년 동기 EPS)
//  - 한국 기업 실적: 네이버 증권 분기 재무(컨센서스 열, 억원 단위)
// 한국 경제지표(물가·GDP 등)와 FOMC 의사록처럼 숫자 예상치가 없는 일정은 채우지 않는다.
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, 'data', 'market_calendar_outlook.json');
const SYNC_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3시간마다
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export const outlookKey = (evt) => `${evt.date}|${evt.title}`;

export function loadOutlookStore() {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')).items || {}; } catch { return {}; }
}

function kstToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}
function daysFromToday(dateStr) {
  const t = new Date(`${kstToday()}T00:00:00Z`).getTime();
  return Math.round((new Date(`${dateStr}T00:00:00Z`).getTime() - t) / 86400000);
}

// ── 미국 경제지표 (우리 일정 제목 → Forex Factory 항목) ──
const MACRO_RULES = [
  { test: /소비자물가|CPI/, items: [['CPI m/m', 'CPI 전월비'], ['CPI y/y', 'CPI 전년비'], ['Core CPI m/m', '근원 CPI 전월비']] },
  { test: /고용보고서/, items: [['Non-Farm Employment Change', '비농업 일자리'], ['Unemployment Rate', '실업률'], ['Average Hourly Earnings m/m', '시간당 임금 전월비']] },
  { test: /소매판매/, items: [['Retail Sales m/m', '소매판매 전월비'], ['Core Retail Sales m/m', '근원 소매판매 전월비']] },
  { test: /생산자물가|PPI/, items: [['PPI m/m', 'PPI 전월비'], ['Core PPI m/m', '근원 PPI 전월비']] },
  { test: /PCE/, items: [['Core PCE Price Index m/m', '근원 PCE 전월비']] },
  { test: /GDP 속보/, items: [['Advance GDP q/q', 'GDP 전기비 연율']] },
  { test: /GDP 2차/, items: [['Prelim GDP q/q', 'GDP 전기비 연율']] },
  { test: /GDP 3차/, items: [['Final GDP q/q', 'GDP 전기비 연율']] },
  { test: /ISM 제조업/, items: [['ISM Manufacturing PMI', 'ISM 제조업 PMI']] },
  { test: /ISM 서비스/, items: [['ISM Services PMI', 'ISM 서비스업 PMI']] },
  { test: /JOLTS/, items: [['JOLTS Job Openings', '구인 건수']] },
  { test: /고용비용|ECI/, items: [['Employment Cost Index q/q', '고용비용지수 전분기비']] },
  { test: /신규주택착공/, items: [['Housing Starts', '주택착공(연율)'], ['Building Permits', '건축허가(연율)']] },
  { test: /내구재/, items: [['Durable Goods Orders m/m', '내구재 주문 전월비'], ['Core Durable Goods Orders m/m', '근원 내구재 전월비']] },
  { test: /무역수지/, items: [['Trade Balance', '무역수지']] },
  { test: /FOMC.*금리결정|연방공개시장위원회.*금리결정/, items: [['Federal Funds Rate', '기준금리']] },
];

// 이 피드는 짧은 시간에 여러 번 호출하면 429로 막는다(약 5분에 2회 한도). 그래서 파일 캐시를 두고
// 최소 30분 간격으로만 새로 받으며, 막히거나 실패하면 12시간 이내의 마지막 성공분을 그대로 쓴다.
const FF_CACHE_PATH = path.join(__dirname, 'data', 'market_calendar_ff_cache.json');
const FF_MIN_INTERVAL_MS = 30 * 60 * 1000;
const FF_STALE_LIMIT_MS = 12 * 60 * 60 * 1000;

function readFfCache() {
  try { return JSON.parse(fs.readFileSync(FF_CACHE_PATH, 'utf-8')); } catch { return null; }
}

async function fetchForexFactory() {
  const cached = readFfCache();
  if (cached && Date.now() - cached.fetchedAt < FF_MIN_INTERVAL_MS) return cached.rows;

  const rows = [];
  for (const file of ['ff_calendar_thisweek.json', 'ff_calendar_nextweek.json']) {
    try {
      const res = await axios.get(`https://nfs.faireconomy.media/${file}`, { headers: { 'User-Agent': UA }, timeout: 10000 });
      if (Array.isArray(res.data)) rows.push(...res.data.filter(r => r.country === 'USD'));
    } catch (e) {
      if (e.response?.status === 429) console.warn('[CALENDAR OUTLOOK] 경제 캘린더 피드 호출 한도(429) — 잠시 후 재시도, 이번엔 마지막 캐시 사용');
      // 다음 주 파일은 주말 전엔 없을 수 있음
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  if (rows.length) {
    try { fs.writeFileSync(FF_CACHE_PATH, JSON.stringify({ fetchedAt: Date.now(), rows }), 'utf-8'); } catch { /* 캐시 저장 실패는 무시 */ }
    return rows;
  }
  return cached && Date.now() - cached.fetchedAt < FF_STALE_LIMIT_MS ? cached.rows : [];
}

function fillMacro(events, ffRows, out) {
  let n = 0;
  for (const evt of events) {
    if (evt.country !== 'US' || !['ECONOMIC', 'FOMC'].includes(evt.category)) continue;
    const rule = MACRO_RULES.find(r => r.test.test(evt.title));
    if (!rule) continue;
    const fc = [], pv = [];
    for (const [ffTitle, label] of rule.items) {
      const row = ffRows.find(r => r.date.slice(0, 10) === evt.date && r.title === ffTitle);
      if (!row) continue;
      if (row.forecast) fc.push(`${label} ${row.forecast}`);
      if (row.previous) pv.push(`${label} ${row.previous}`);
    }
    if (fc.length === 0) continue;
    out[outlookKey(evt)] = {
      forecast: fc.join(' · '),
      previous: pv.join(' · ') || '-',
      source: 'Forex Factory 경제 캘린더 컨센서스',
      updatedAt: new Date().toISOString(),
    };
    n++;
  }
  return n;
}

// ── 미국 기업 실적 (Nasdaq 실적 캘린더 — 날짜별 조회) ──
const nasdaqCache = new Map();
async function nasdaqEarningsByDate(date) {
  if (nasdaqCache.has(date)) return nasdaqCache.get(date);
  let rows = [];
  try {
    const res = await axios.get(`https://api.nasdaq.com/api/calendar/earnings?date=${date}`, {
      headers: { 'User-Agent': UA, 'Accept': 'application/json', 'Origin': 'https://www.nasdaq.com', 'Referer': 'https://www.nasdaq.com/' },
      timeout: 10000,
    });
    rows = res.data?.data?.rows || [];
  } catch { /* 일시 차단/오류 시 이번 주기는 건너뜀 */ }
  nasdaqCache.set(date, rows);
  return rows;
}

const TIME_LABEL = { 'time-pre-market': '장 시작 전', 'time-after-hours': '장 마감 후' };

async function fillUsEarnings(events, out) {
  let n = 0;
  for (const evt of events) {
    if (evt.country !== 'US' || evt.category !== 'EARNINGS') continue;
    const tickers = evt.ticker ? [evt.ticker] : (evt.tickers || []);
    if (!tickers.length) continue;
    const rows = await nasdaqEarningsByDate(evt.date);
    const parts = tickers.map(t => rows.find(r => r.symbol === t)).filter(r => r && r.epsForecast);
    if (!parts.length) continue;
    const multi = parts.length > 1;
    out[outlookKey(evt)] = {
      forecast: parts.map(r => `${multi ? r.symbol + ' ' : ''}EPS ${r.epsForecast} (추정 ${r.noOfEsts || '-'}곳${TIME_LABEL[r.time] ? ', ' + TIME_LABEL[r.time] : ''})`).join(' · '),
      previous: parts.map(r => `${multi ? r.symbol + ' ' : ''}전년 동기 EPS ${r.lastYearEPS || '-'}`).join(' · '),
      source: 'Nasdaq 실적 캘린더 (애널리스트 컨센서스)',
      updatedAt: new Date().toISOString(),
    };
    n++;
  }
  return n;
}

// ── 한국 기업 실적 (네이버 증권 분기 컨센서스, 억원 → 조원) ──
const eokToJo = (v) => {
  const num = parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(num) ? `${(num / 10000).toFixed(1)}조원` : '-';
};

async function fillKrEarnings(events, out) {
  let n = 0;
  for (const evt of events) {
    if (evt.country !== 'KR' || evt.category !== 'EARNINGS' || !evt.ticker || !/분기/.test(evt.title)) continue;
    try {
      const res = await axios.get(`https://m.stock.naver.com/api/stock/${evt.ticker}/finance/quarter`, {
        headers: { 'User-Agent': UA, 'Referer': 'https://m.stock.naver.com/' }, timeout: 8000,
      });
      const info = res.data?.financeInfo;
      const periods = info?.trTitleList || [];
      const consIdx = periods.findIndex(p => p.isConsensus === 'Y');
      if (consIdx < 1) continue;
      const rowOf = (title) => info.rowList.find(r => r.title === title);
      const val = (title, p) => rowOf(title)?.columns?.[p.key]?.value;
      const cons = periods[consIdx], prev = periods[consIdx - 1];
      const yoy = periods.find(p => p.key.slice(0, 4) === String(parseInt(cons.key.slice(0, 4), 10) - 1) && p.key.slice(4) === cons.key.slice(4));
      out[outlookKey(evt)] = {
        consensus: { rev: toNum(val('매출액', cons)), op: toNum(val('영업이익', cons)) }, // 발표 후 서프라이즈 계산용(억원)
        forecast: `매출 ${eokToJo(val('매출액', cons))} · 영업이익 ${eokToJo(val('영업이익', cons))}`,
        previous: `직전 분기(${prev.title.replace(/\.$/, '')}) 매출 ${eokToJo(val('매출액', prev))} · 영업이익 ${eokToJo(val('영업이익', prev))}`
          + (yoy ? ` / 전년 동기(${yoy.title.replace(/\.$/, '')}) 영업이익 ${eokToJo(val('영업이익', yoy))}` : ''),
        source: '네이버 증권 (에프앤가이드 컨센서스)',
        updatedAt: new Date().toISOString(),
      };
      n++;
    } catch { /* 종목별 실패는 건너뜀 */ }
  }
  return n;
}

const toNum = (v) => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : null; };

// ── 발표 결과(실제 발표치) 자동 채우기 — 이미 발표된 일정(최근 30일) 대상 ──
//  - 미국 고용·CPI·PPI: 미국 노동통계국(BLS) 공개 API (키 불필요, 하루 25회 한도 → 동기화당 1회만 호출)
//  - 미국 기업 실적: Nasdaq 실적 캘린더의 실제 EPS·서프라이즈
//  - 한국 기업 실적: 네이버 증권에 확정 실적이 올라오면 저장해 둔 컨센서스와 비교
// 소매판매·GDP·PCE·ISM 등은 무료 공개 API가 없어 자동 집계 대상이 아니다.
const BLS_SERIES = ['CES0000000001', 'LNS14000000', 'CUSR0000SA0', 'CUUR0000SA0', 'CUSR0000SA0L1E', 'WPSFD4'];

async function loadBls(year) {
  try {
    const res = await fetch('https://api.bls.gov/publicAPI/v1/timeseries/data/', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seriesid: BLS_SERIES, startyear: String(year - 1), endyear: String(year) }),
    });
    const j = await res.json();
    if (j.status !== 'REQUEST_SUCCEEDED') return null;
    const map = {};
    for (const s of j.Results.series) {
      map[s.seriesID] = s.data.filter(d => /^M\d\d$/.test(d.period)).map(d => ({ y: +d.year, m: +d.period.slice(1), v: parseFloat(d.value) }));
    }
    return map;
  } catch { return null; }
}

const at = (rows, y, m) => rows?.find(r => r.y === y && r.m === m)?.v;
const prevYM = (y, m) => (m === 1 ? [y - 1, 12] : [y, m - 1]);
const pct = (a, b) => (a / b - 1) * 100;
const sgn = (n, d = 1) => `${n >= 0 ? '+' : ''}${n.toFixed(d)}%`;

function blsResult(evt, bls) {
  const dm = parseInt(evt.title.match(/(\d{1,2})월/)?.[1], 10);
  if (!dm || !bls) return null;
  const evYear = +evt.date.slice(0, 4), evMonth = +evt.date.slice(5, 7);
  const y = dm > evMonth ? evYear - 1 : evYear; // 1월 발표분은 전년 12월 데이터
  const [py, pm] = prevYM(y, dm);
  if (/고용보고서/.test(evt.title)) {
    const jobs = bls.CES0000000001, un = bls.LNS14000000;
    const cur = at(jobs, y, dm), prev = at(jobs, py, pm);
    if (cur == null || prev == null) return null; // 아직 해당 월 데이터가 안 올라옴
    const [ppy, ppm] = prevYM(py, pm), prev2 = at(jobs, ppy, ppm);
    const chg = cur - prev; // 천명
    const fmtMan = (k) => `${k >= 0 ? '+' : ''}${(k / 10).toFixed(1)}만명`;
    return {
      actual: `비농업 일자리 ${fmtMan(chg)} · 실업률 ${at(un, y, dm)}%`,
      previous: prev2 != null ? `직전월 일자리 ${fmtMan(prev - prev2)} · 실업률 ${at(un, py, pm)}%` : null,
    };
  }
  if (/소비자물가/.test(evt.title)) {
    const sa = bls.CUSR0000SA0, nsa = bls.CUUR0000SA0, core = bls.CUSR0000SA0L1E;
    const c = at(sa, y, dm), p = at(sa, py, pm), yy = at(nsa, y - 1, dm), cn = at(nsa, y, dm);
    if (c == null || p == null || yy == null || cn == null) return null;
    const cc = at(core, y, dm), cp = at(core, py, pm);
    return { actual: `CPI 전월비 ${sgn(pct(c, p))} · 전년비 ${sgn(pct(cn, yy))}` + (cc != null && cp != null ? ` · 근원 전월비 ${sgn(pct(cc, cp))}` : '') };
  }
  if (/생산자물가/.test(evt.title)) {
    const ppi = bls.WPSFD4, c = at(ppi, y, dm), p = at(ppi, py, pm);
    if (c == null || p == null) return null;
    return { actual: `PPI(최종수요) 전월비 ${sgn(pct(c, p))}` };
  }
  return null;
}

async function usEarningsResult(evt) {
  const tickers = evt.ticker ? [evt.ticker] : (evt.tickers || []);
  if (!tickers.length) return null;
  const rows = await nasdaqEarningsByDate(evt.date);
  const hit = tickers.map(t => rows.find(r => r.symbol === t)).filter(r => r && r.eps && r.eps !== '' && r.epsForecast);
  if (!hit.length) return null;
  const multi = hit.length > 1;
  const sur = hit.map(r => parseFloat(r.surprise)).filter(Number.isFinite);
  const avgSur = sur.length ? sur.reduce((a, b) => a + b, 0) / sur.length : 0;
  return {
    actual: hit.map(r => `${multi ? r.symbol + ' ' : ''}EPS ${r.eps} (예상 ${r.epsForecast}${r.surprise !== undefined && r.surprise !== '' ? `, 서프라이즈 ${sgn(parseFloat(r.surprise), 2)}` : ''})`).join(' · '),
    surprise: avgSur > 0 ? 'BEAT' : avgSur < 0 ? 'MISS' : 'INLINE',
    surpriseLabel: avgSur > 0 ? `어닝 서프라이즈 ${sgn(avgSur, 2)}` : avgSur < 0 ? `어닝 쇼크 ${sgn(avgSur, 2)}` : '예상치 부합',
  };
}

async function krEarningsResult(evt, stored) {
  if (!evt.ticker || !/분기/.test(evt.title)) return null;
  try {
    const res = await axios.get(`https://m.stock.naver.com/api/stock/${evt.ticker}/finance/quarter`, { headers: { 'User-Agent': UA, 'Referer': 'https://m.stock.naver.com/' }, timeout: 8000 });
    const info = res.data?.financeInfo;
    const q = { 1: '03', 2: '06', 3: '09', 4: '12' }[parseInt(evt.title.match(/(\d)분기/)?.[1], 10)];
    const period = (info?.trTitleList || []).find(p => p.key === `${evt.date.slice(0, 4)}${q}`);
    if (!period || period.isConsensus !== 'N') return null; // 아직 확정 실적 반영 전
    const val = (title) => toNum(info.rowList.find(r => r.title === title)?.columns?.[period.key]?.value);
    const rev = val('매출액'), op = val('영업이익');
    if (rev == null || op == null) return null;
    const cOp = stored?.consensus?.op;
    const sur = cOp ? ((op - cOp) / Math.abs(cOp)) * 100 : null;
    return {
      actual: `매출 ${eokToJo(rev)} · 영업이익 ${eokToJo(op)}` + (sur != null ? ` (컨센서스 대비 영업이익 ${sgn(sur)})` : ''),
      surprise: sur == null ? undefined : sur > 1 ? 'BEAT' : sur < -1 ? 'MISS' : 'INLINE',
      surpriseLabel: sur == null ? undefined : sur > 1 ? `어닝 서프라이즈 ${sgn(sur)}` : sur < -1 ? `어닝 쇼크 ${sgn(sur)}` : '컨센서스 부합',
    };
  } catch { return null; }
}

async function fillResults(events, items) {
  const today = kstToday();
  const past = events.filter(e => { const d = daysFromToday(e.date); return d <= 0 && d >= -30; });
  const needBls = past.some(e => e.country === 'US' && /고용보고서|소비자물가|생산자물가/.test(e.title));
  const bls = needBls ? await loadBls(+today.slice(0, 4)) : null;
  let n = 0;
  for (const evt of past) {
    const key = outlookKey(evt);
    let r = null;
    if (evt.country === 'US' && evt.category === 'ECONOMIC') r = blsResult(evt, bls);
    else if (evt.country === 'US' && evt.category === 'EARNINGS') r = await usEarningsResult(evt);
    else if (evt.country === 'KR' && evt.category === 'EARNINGS') r = await krEarningsResult(evt, items[key]);
    if (!r) continue;
    const prev = items[key] || {};
    items[key] = {
      ...prev, ...r,
      previous: prev.previous && prev.previous !== '-' ? prev.previous : (r.previous || prev.previous || '-'),
      forecast: prev.forecast || '발표 전 예상치 기록 없음',
      source: prev.source || (evt.category === 'ECONOMIC' ? '미국 노동통계국(BLS) 공개 API' : evt.country === 'KR' ? '네이버 증권' : 'Nasdaq 실적 캘린더'),
      resultUpdatedAt: new Date().toISOString(),
    };
    n++;
  }
  return n;
}

let syncInFlight = null;
export function syncCalendarOutlook(getEvents) {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    const started = Date.now();
    nasdaqCache.clear(); // 날짜별 실적 조회 결과는 주기마다 새로 받는다(추정치·실제치가 계속 바뀜)
    const allEvents = getEvents();
    // 발표가 임박한(과거 1일 ~ 14일 이내) 일정만 예상치 조회 대상
    const events = allEvents.filter(e => { const d = daysFromToday(e.date); return d >= -1 && d <= 14; });
    const items = { ...loadOutlookStore() };
    const fresh = {};
    const ff = await fetchForexFactory();
    const macro = fillMacro(events, ff, fresh);
    const us = await fillUsEarnings(events, fresh);
    const kr = await fillKrEarnings(events, fresh);
    // 예상치 갱신은 이미 저장된 발표 결과(actual)를 지우지 않도록 병합한다
    for (const [k, v] of Object.entries(fresh)) items[k] = { ...(items[k] || {}), ...v };
    const results = await fillResults(allEvents, items);

    // 지난 일정의 오래된 예상치는 정리 (30일 이전 일정은 삭제)
    for (const k of Object.keys(items)) {
      const date = k.split('|')[0];
      if (daysFromToday(date) < -30) delete items[k];
    }
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify({ updatedAt: new Date().toISOString(), items }, null, 2), 'utf-8');
    console.log(`[CALENDAR OUTLOOK] 예상치 갱신 완료 — 미국 지표 ${macro} / 미국 실적 ${us} / 한국 실적 ${kr}건, 발표 결과 ${results}건 (${((Date.now() - started) / 1000).toFixed(1)}초)`);
  })().catch(e => console.error('[CALENDAR OUTLOOK] 갱신 실패:', e.message)).finally(() => { syncInFlight = null; });
  return syncInFlight;
}

export function startCalendarOutlookSync(getEvents) {
  syncCalendarOutlook(getEvents);
  setInterval(() => syncCalendarOutlook(getEvents), SYNC_INTERVAL_MS);
}
