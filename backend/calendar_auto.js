// calendar_auto.js — 📅 증시 캘린더 자동 일정 (어느 해든, 2027·2028년도 사람 손 없이 생성)
//
// 1) 규칙 기반(ruleEventsForYear): 날짜가 규칙으로 정해지는 일정 — 옵션만기, 한·미 휴장일/조기폐장,
//    ISM, 관세청·산업부 수출입, 분기보고서 마감, 수능, 미국 선거 등. 연도만 주면 계산된다.
// 2) 공식 사이트 수집(syncAutoEvents): 규칙으로 못 구하는 일정은 공개되는 즉시 자동으로 읽어온다.
//    - 연준 FOMC 캘린더(의사록 공개일 포함), 미국 노동통계국(BLS)·경제분석국(BEA) 발표 일정,
//      한국은행 금통위 일정, Nasdaq 실적 캘린더(주요 미국 기업 실적발표일)
//    새 연도 일정이 아직 공개 전이면 비어 있다가, 공개되는 날 다음 동기화 때 채워진다.
// ※ 한국 개별 기업의 실적발표일, 한국 통계청 지표, 미국 Census 지표(소매판매 등)는 공개 API가 없어
//    자동 수집 대상이 아니다(2026년분은 market_calendar.js에 직접 입력해 둠).
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { krxHolidaysForYear, isKrxTradingDateStr } from './krx_calendar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, 'data', 'market_calendar_auto_events.json');
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const D = (s) => new Date(`${s}T12:00:00Z`);
const addDays = (s, n) => new Date(D(s).getTime() + n * 86400000).toISOString().slice(0, 10);
const weekday = (s) => D(s).getUTCDay();
const isWeekend = (s) => weekday(s) === 0 || weekday(s) === 6;
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

const mk = (date, title, category, country, importance, emoji, description, extra = {}) =>
  ({ date, title, category, country, importance, emoji, description, auto: true, ...extra });

// ── 날짜 계산 도우미 ──
function nthWeekday(y, m, wd, n) { // m월의 n번째 wd요일 (wd: 0=일 … 6=토)
  let count = 0;
  for (let d = 1; d <= daysInMonth(y, m); d++) {
    if (weekday(ymd(y, m, d)) === wd && ++count === n) return ymd(y, m, d);
  }
  return null;
}
function lastWeekday(y, m, wd) {
  for (let d = daysInMonth(y, m); d >= 1; d--) if (weekday(ymd(y, m, d)) === wd) return ymd(y, m, d);
  return null;
}
function easterSunday(y) { // 그레고리력 부활절 (Anonymous Gregorian algorithm)
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(y, month, day);
}

// 미국 증시(NYSE) 휴장일: 토요일이면 금요일, 일요일이면 월요일로 이동 (단 신정이 토요일이면 휴장 없음)
export function usHolidaysForYear(y) {
  const out = {};
  const observed = (s, name, allowFriday = true) => {
    const w = weekday(s);
    if (w === 6) { if (allowFriday) out[addDays(s, -1)] = `${name} (observed)`; }
    else if (w === 0) out[addDays(s, 1)] = `${name} (observed)`;
    else out[s] = name;
  };
  observed(ymd(y, 1, 1), "New Year's Day", false);
  out[nthWeekday(y, 1, 1, 3)] = 'Martin Luther King Jr. Day';
  out[nthWeekday(y, 2, 1, 3)] = "Presidents' Day";
  out[addDays(easterSunday(y), -2)] = 'Good Friday';
  out[lastWeekday(y, 5, 1)] = 'Memorial Day';
  observed(ymd(y, 6, 19), 'Juneteenth');
  observed(ymd(y, 7, 4), 'Independence Day');
  out[nthWeekday(y, 9, 1, 1)] = 'Labor Day';
  out[nthWeekday(y, 11, 4, 4)] = 'Thanksgiving Day';
  observed(ymd(y, 12, 25), 'Christmas Day');
  return out;
}

const usTradingDay = (s, hol) => !isWeekend(s) && !hol[s];
const krTradingDay = (s) => isKrxTradingDateStr(s);

function prevTrading(s, ok) { let d = s; while (!ok(d)) d = addDays(d, -1); return d; }
function nextTrading(s, ok) { let d = s; while (!ok(d)) d = addDays(d, 1); return d; }
function nthTradingDay(y, m, n, ok) {
  let count = 0;
  for (let d = 1; d <= daysInMonth(y, m); d++) { const s = ymd(y, m, d); if (ok(s) && ++count === n) return s; }
  return null;
}

const prevMonth = (m) => (m === 1 ? 12 : m - 1);

export function ruleEventsForYear(y) {
  const ev = [];
  const usHol = usHolidaysForYear(y);
  const usOk = (s) => usTradingDay(s, usHol);

  // 한국 휴장일
  for (const [date, name] of Object.entries(krxHolidaysForYear(y))) {
    ev.push(mk(date, name, 'HOLIDAY', 'KR', 'MEDIUM', '🇰🇷', '한국 증시 휴장일', { kind: 'HOLIDAY' }));
  }
  // 한국 폐장일(올해 마지막 거래일)
  ev.push(mk(prevTrading(ymd(y, 12, 31), krTradingDay), '한국 증시 폐장일 (올해 마지막 거래일)', 'HOLIDAY', 'KR', 'MEDIUM', '🔔',
    '연말 휴장 전 마지막 거래일', { kind: 'KR_LAST_DAY' }));
  // 미국 휴장일 / 조기폐장
  for (const [date, name] of Object.entries(usHol)) {
    ev.push(mk(date, name, 'HOLIDAY', 'US', 'MEDIUM', '🏖️', '미국 증시 휴장일', { kind: 'HOLIDAY' }));
  }
  const tg = nthWeekday(y, 11, 4, 4);
  ev.push(mk(addDays(tg, 1), '미국 추수감사절 다음날 조기폐장', 'HOLIDAY', 'US', 'MEDIUM', '🛍️', '미국 증시 오후 1시(동부) 조기 마감', { kind: 'US_EARLY' }));
  const xmasEve = ymd(y, 12, 24);
  if (usOk(xmasEve) && weekday(xmasEve) !== 5) {
    ev.push(mk(xmasEve, '미국 크리스마스 이브 조기폐장', 'HOLIDAY', 'US', 'MEDIUM', '🎄', '미국 증시 오후 1시(동부) 조기 마감', { kind: 'US_EARLY' }));
  }

  for (let m = 1; m <= 12; m++) {
    const quarter = m % 3 === 0;
    // 한국 옵션 만기 (둘째 목요일, 휴장이면 앞당김)
    const krExp = prevTrading(nthWeekday(y, m, 4, 2), krTradingDay);
    ev.push(quarter
      ? mk(krExp, `한국 ${m}월 선물옵션 동시 만기일 (네 마녀의 날)`, 'OPTIONS', 'KR', 'HIGH', '🧙‍♀️', '한국 분기 선물옵션 동시 만기일', { kind: 'KR_OPT' })
      : mk(krExp, `한국 ${m}월 옵션 만기일`, 'OPTIONS', 'KR', 'MEDIUM', '🧙', '코스피200 옵션 월간 만기일 (매월 둘째 목요일)', { kind: 'KR_OPT' }));
    if (m === 6 || m === 12) {
      ev.push(mk(krExp, '코스피200 정기변경 반영', 'POLICY', 'KR', 'MEDIUM', '🔄', '통상 6·12월 선물옵션 동시만기일 장마감 시점 반영 — 한국거래소 공지 확인 필요', { kind: 'KOSPI200' }));
    }
    // 미국 옵션 만기 (셋째 금요일, 휴장이면 앞당김)
    const usExp = prevTrading(nthWeekday(y, m, 5, 3), usOk);
    ev.push(quarter
      ? mk(usExp, `미국 ${m}월 네 마녀의 날 (Quad Witching)`, 'OPTIONS', 'US', 'HIGH', '🧙‍♀️', '미국 분기 쿼드러플 위칭데이', { kind: 'US_OPT' })
      : mk(usExp, `미국 ${m}월 옵션 만기일`, 'OPTIONS', 'US', 'MEDIUM', '🧙', '미국 월간 옵션 만기일 (매월 셋째 금요일)', { kind: 'US_OPT' }));
    // ISM (제조업: 첫 영업일, 서비스업: 셋째 영업일 — 전월 데이터)
    const ismM = nthTradingDay(y, m, 1, usOk), ismS = nthTradingDay(y, m, 3, usOk);
    if (ismM) ev.push(mk(ismM, `미국 ${prevMonth(m)}월 ISM 제조업 PMI`, 'ECONOMIC', 'US', 'MEDIUM', '🏭', '매월 첫 영업일 발표', { kind: 'US_ISM_MFG' }));
    if (ismS) ev.push(mk(ismS, `미국 ${prevMonth(m)}월 ISM 서비스업 PMI`, 'ECONOMIC', 'US', 'MEDIUM', '🛎️', '매월 셋째 영업일 발표', { kind: 'US_ISM_SVC' }));
    // 관세청 수출입 현황 (11일·21일, 휴장이면 다음 영업일) / 산업부 월간 수출입동향 (매월 1일)
    const c10 = nextTrading(ymd(y, m, 11), krTradingDay), c20 = nextTrading(ymd(y, m, 21), krTradingDay);
    ev.push(mk(c10, `관세청 ${m}월 1~10일 수출입 현황`, 'ECONOMIC', 'KR', 'MEDIUM', '🚢', `${m}월 1~10일 수출입 잠정치 (관세청 통상 11일 발표, 휴일이면 다음 영업일)`, { kind: 'KR_CUSTOMS_10' }));
    ev.push(mk(c20, `관세청 ${m}월 1~20일 수출입 현황`, 'ECONOMIC', 'KR', 'MEDIUM', '🚢', `${m}월 1~20일 수출입 잠정치 (관세청 통상 21일 발표, 휴일이면 다음 영업일)`, { kind: 'KR_CUSTOMS_20' }));
    ev.push(mk(ymd(y, m, 1), `산업통상부 ${prevMonth(m)}월 수출입동향`, 'ECONOMIC', 'KR', 'HIGH', '🚢', `${prevMonth(m)}월 한국 수출입 확정치 (매월 1일 발표)`, { kind: 'KR_TRADE_MONTHLY' }));
  }

  // 상장사 정기보고서 법정 제출 마감 (사업 3/31, 1분기 5/15, 반기 8/14, 3분기 11/14 — 휴일이면 다음 영업일)
  for (const [m, d, label] of [[3, 31, '사업보고서'], [5, 15, '1분기 분기보고서'], [8, 14, '반기보고서'], [11, 14, '3분기 분기보고서']]) {
    ev.push(mk(nextTrading(ymd(y, m, d), krTradingDay), `${label} 제출 마감`, 'EARNINGS', 'KR', 'MEDIUM', '📑',
      '상장사 정기보고서 법정 제출 기한 — 기업별 실적발표는 개별 공지', { kind: 'KR_REPORT_DEADLINE' }));
  }
  // 수능 (11월 셋째 목요일)
  ev.push(mk(nthWeekday(y, 11, 4, 3), '대학수학능력시험 (증시 1시간 늦게 개장)', 'POLICY', 'KR', 'MEDIUM', '📚', '수능일에는 한국 증시 개장·종료가 1시간 늦춰짐 (10:00~16:30)', { kind: 'KR_CSAT' }));
  // 미국 선거 (11월 첫 월요일 다음 화요일)
  const firstMon = nthWeekday(y, 11, 1, 1);
  if (y % 2 === 0) {
    ev.push(mk(addDays(firstMon, 1), y % 4 === 0 ? '미국 대통령 선거' : '미국 중간선거', 'POLICY', 'US', 'HIGH', '🗳️',
      y % 4 === 0 ? '미국 대통령·상하원 선거 — 정책 방향과 시장 변동성에 큰 영향' : '미국 중간선거 (상·하원 의회 구도 변화)', { kind: 'US_ELECTION' }));
  }
  return ev;
}

// ── 공식 사이트 수집 ──
const MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const monthNum = (s) => MONTHS[String(s).toLowerCase()] || (String(s).slice(0, 3).toLowerCase() && Object.entries(MONTHS).find(([k]) => k.startsWith(String(s).slice(0, 3).toLowerCase()))?.[1]);
const http = (url, opts = {}) => axios.get(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/json' }, timeout: 20000, ...opts });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchFedEvents() {
  const out = [];
  const $ = cheerio.load((await http('https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm')).data);
  $('.panel.panel-default').each((_, panel) => {
    const year = parseInt($(panel).find('.panel-heading').text().match(/(\d{4}) FOMC Meetings/)?.[1], 10);
    if (!year || year < new Date().getFullYear() - 1) return; // 오래된 연도는 달력에 불필요
    $(panel).find('.row.fomc-meeting').each((__, row) => {
      const text = $(row).text().replace(/\s+/g, ' ').trim();
      const m = text.match(/^([A-Za-z/]+)\s+(\d{1,2})-(\d{1,2})(\*?)/);
      if (!m) return;
      const endMonth = monthNum(m[1].split('/').pop());
      const startMonth = monthNum(m[1].split('/')[0]);
      if (!endMonth) return;
      const decision = ymd(year, endMonth, parseInt(m[3], 10));
      const hasProjection = m[4] === '*';
      out.push(mk(decision, hasProjection ? '미국 FOMC 금리결정 & 경제전망(점도표)' : '미국 연방공개시장위원회 (FOMC) 금리결정', 'FOMC', 'US', 'HIGH', '🏦',
        `미 연준 ${startMonth}/${m[2]}~${endMonth}/${m[3]} 회의 통화정책 결정 (Fed 공식 일정)`, { kind: 'FOMC', source: 'federalreserve.gov' }));
      const released = text.match(/Released ([A-Za-z]+) (\d{1,2}), (\d{4})/);
      const minutes = released ? ymd(+released[3], monthNum(released[1]), +released[2]) : addDays(decision, 21); // 연준은 회의 3주 뒤 공개
      out.push(mk(minutes, `FOMC ${endMonth}월 회의 의사록 공개`, 'FOMC', 'US', 'HIGH', '📝', `${startMonth}/${m[2]}~${endMonth}/${m[3]} FOMC 회의 의사록 (Fed 공식 일정)`, { kind: 'FOMC_MINUTES', source: 'federalreserve.gov' }));
    });
  });
  return out;
}

const BLS_RELEASES = [
  [/^Employment Situation for (\w+)/, (m) => [`미국 ${monthNum(m[1])}월 고용보고서 (NFP & 실업률)`, 'ECONOMIC', 'HIGH', '👥', 'US_NFP']],
  [/^Consumer Price Index for (\w+)/, (m) => [`미국 ${monthNum(m[1])}월 소비자물가지수 (CPI)`, 'ECONOMIC', 'HIGH', '📈', 'US_CPI']],
  [/^Producer Price Index for (\w+)/, (m) => [`미국 ${monthNum(m[1])}월 생산자물가지수 (PPI)`, 'ECONOMIC', 'MEDIUM', '🏭', 'US_PPI']],
  [/^Job Openings and Labor Turnover Survey for (\w+)/, (m) => [`미국 ${monthNum(m[1])}월 구인·이직 (JOLTS)`, 'ECONOMIC', 'MEDIUM', '👥', 'US_JOLTS']],
  [/^U\.S\. Import and Export Price Indexes for (\w+)/, (m) => [`미국 ${monthNum(m[1])}월 수출입물가지수`, 'ECONOMIC', 'LOW', '📦', 'US_IMPORT_PRICE']],
  [/^Employment Cost Index for (\w+) Quarter/i, (m) => [`미국 ${{ first: 1, second: 2, third: 3, fourth: 4 }[m[1].toLowerCase()] || ''}분기 고용비용지수 (ECI)`, 'ECONOMIC', 'MEDIUM', '👷', 'US_ECI']],
];

async function fetchBlsEvents() {
  const out = [];
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1;
    // bls.gov는 axios 요청을 403으로 막고 Node 기본 fetch만 허용한다
    let html;
    try {
      const res = await fetch(`https://www.bls.gov/schedule/${y}/${pad(m)}_sched_list.htm`, { headers: { 'User-Agent': UA } });
      if (!res.ok) { await sleep(300); continue; } // 아직 미공개(404)
      html = await res.text();
    } catch { await sleep(300); continue; }
    const $ = cheerio.load(html);
    $('table tr').each((_, tr) => {
      const t = $(tr).text().replace(/\s+/g, ' ').trim();
      const dm = t.match(/^\w+, (\w+) (\d{1,2}), (\d{4}) \d{1,2}:\d{2} [AP]M (.+)$/);
      if (!dm) return;
      const rel = dm[4];
      for (const [re, build] of BLS_RELEASES) {
        const rm = rel.match(re);
        if (!rm) continue;
        const [title, category, importance, emoji, kind] = build(rm);
        out.push(mk(ymd(+dm[3], monthNum(dm[1]), +dm[2]), title, category, 'US', importance, emoji, 'BLS 공식 일정', { kind, source: 'bls.gov' }));
        break;
      }
    });
    await sleep(300);
  }
  return out;
}

async function fetchBeaEvents() {
  const out = [];
  const $ = cheerio.load((await http('https://www.bea.gov/news/schedule')).data);
  let year = null;
  $('tr').each((_, tr) => {
    const t = $(tr).text().replace(/\s+/g, ' ').trim();
    const yh = t.match(/^Year (\d{4})/);
    if (yh) { year = parseInt(yh[1], 10); return; }
    const dm = t.match(/^(\w+) (\d{1,2}) \d{1,2}:\d{2} [AP]M \w+ (.+)$/);
    if (!dm || !year || !monthNum(dm[1])) return;
    const date = ymd(year, monthNum(dm[1]), +dm[2]);
    const title = dm[3];
    const q = title.match(/(\d)(?:st|nd|rd|th) Quarter/)?.[1];
    let m;
    if ((m = title.match(/^GDP \((Advance|Second|Third) Estimate\)/))) {
      const label = { Advance: ['미국 ' + q + '분기 GDP 속보치', 'US_GDP_ADV'], Second: ['미국 ' + q + '분기 GDP 2차 추정 · 기업이익', 'US_GDP_2'], Third: ['미국 ' + q + '분기 GDP 3차 추정', 'US_GDP_3'] }[m[1]];
      out.push(mk(date, label[0], 'ECONOMIC', 'US', m[1] === 'Advance' ? 'HIGH' : 'MEDIUM', '📊', 'BEA 공식 일정', { kind: label[1], source: 'bea.gov' }));
    } else if ((m = title.match(/^Personal Income and Outlays, (\w+) \d{4}/))) {
      out.push(mk(date, `미국 ${monthNum(m[1])}월 근원 개인소비지출 (PCE) 물가지수`, 'ECONOMIC', 'US', 'HIGH', '🛒', '연준이 가장 선호하는 핵심 물가 지표 (BEA 공식 일정)', { kind: 'US_PCE', source: 'bea.gov' }));
    } else if ((m = title.match(/^U\.S\. International Trade in Goods and Services, (\w+) \d{4}/))) {
      out.push(mk(date, `미국 ${monthNum(m[1])}월 무역수지`, 'ECONOMIC', 'US', 'MEDIUM', '🚢', 'BEA 공식 일정', { kind: 'US_TRADE', source: 'bea.gov' }));
    }
  });
  return out;
}

async function fetchBokEvents() {
  const out = [];
  const now = new Date().getUTCFullYear();
  for (const year of [now, now + 1, now + 2]) {
    let html;
    try { html = (await http(`https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=200755&pYear=${year}`)).data; } catch { continue; }
    const $ = cheerio.load(html);
    const dates = [];
    $('table tbody tr').each((_, tr) => {
      const m = $(tr).text().replace(/\s+/g, ' ').trim().match(/^(\d{2})월 (\d{2})일\(/);
      if (m) dates.push(ymd(year, +m[1], +m[2]));
    });
    for (const date of dates) {
      out.push(mk(date, '한국은행 금융통화위원회 금리결정', 'POLICY', 'KR', 'HIGH', '🏛️', '한국은행 금통위 통화정책방향 결정회의 (한국은행 공식 일정)', { kind: 'BOK', source: 'bok.or.kr' }));
      // 의사록: 회의일로부터 2주 경과 후 첫 화요일 (한국은행 공시 규칙)
      let d = addDays(date, 14);
      while (weekday(d) !== 2) d = addDays(d, 1);
      out.push(mk(d, `한국은행 ${+date.slice(5, 7)}월 금통위 의사록 공개`, 'POLICY', 'KR', 'MEDIUM', '📝', '회의일로부터 2주 경과 후 첫 화요일 공개 (한국은행 공시 규칙)', { kind: 'BOK_MINUTES', source: 'bok.or.kr' }));
    }
    await sleep(300);
  }
  return out;
}

// 주요 미국 기업 실적발표일 (Nasdaq 실적 캘린더, 향후 75일)
const US_WATCHLIST = {
  AAPL: '애플', MSFT: '마이크로소프트', GOOGL: '알파벳', AMZN: '아마존', META: '메타', NVDA: '엔비디아', TSLA: '테슬라', NFLX: '넷플릭스',
  AVGO: '브로드컴', AMD: 'AMD', INTC: '인텔', MU: '마이크론', ORCL: '오라클', JPM: 'JP모건', BAC: '뱅크오브아메리카', GS: '골드만삭스',
  WMT: '월마트', COST: '코스트코', TSM: 'TSMC', ASML: 'ASML', QCOM: '퀄컴',
};
const QUARTER_BY_END_MONTH = { Mar: '1분기말', Jun: '2분기말', Sep: '3분기말', Dec: '4분기말' };

async function fetchUsEarningsEvents() {
  const out = [];
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < 75; i++) {
    const date = addDays(today, i);
    if (isWeekend(date)) continue;
    try {
      const res = await http(`https://api.nasdaq.com/api/calendar/earnings?date=${date}`, { headers: { 'User-Agent': UA, Accept: 'application/json', Origin: 'https://www.nasdaq.com', Referer: 'https://www.nasdaq.com/' } });
      for (const r of res.data?.data?.rows || []) {
        if (!US_WATCHLIST[r.symbol]) continue;
        const endMon = (r.fiscalQuarterEnding || '').slice(0, 3);
        // 회계연도가 달라 분기말이 3·6·9·12월이 아닌 회사(엔비디아·월마트 등)는 분기 표기 없이 회사명만 쓴다
        out.push(mk(date, `${US_WATCHLIST[r.symbol]} ${QUARTER_BY_END_MONTH[endMon] || ''} 실적발표`.replace(/\s+/g, ' ').trim(),
          'EARNINGS', 'US', 'HIGH', '💼', `${US_WATCHLIST[r.symbol]} 실적 — 회계 분기말 ${r.fiscalQuarterEnding || '-'} (Nasdaq 실적 캘린더 기준, 회사 확정 시 변동 가능)`, { ticker: r.symbol, kind: `EARN_${r.symbol}`, source: 'nasdaq.com' }));
      }
    } catch { /* 일시 오류는 다음 동기화에서 재시도 */ }
    await sleep(250);
  }
  return out;
}

export function loadAutoStore() {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')); } catch { return { updatedAt: null, events: [] }; }
}

let syncInFlight = null;
export function syncAutoEvents() {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    const started = Date.now();
    const prev = loadAutoStore();
    const sources = [['FOMC', fetchFedEvents], ['BLS', fetchBlsEvents], ['BEA', fetchBeaEvents], ['한국은행', fetchBokEvents], ['미국 실적', fetchUsEarningsEvents]];
    const bySource = {};
    const events = [];
    for (const [name, fn] of sources) {
      try { const list = await fn(); bySource[name] = list.length; events.push(...list); }
      catch (e) {
        console.warn(`[CALENDAR AUTO] ${name} 수집 실패: ${e.message} — 이전 데이터 유지`);
        const keep = (prev.events || []).filter(ev => ev.source === { FOMC: 'federalreserve.gov', BLS: 'bls.gov', BEA: 'bea.gov', 한국은행: 'bok.or.kr', '미국 실적': 'nasdaq.com' }[name]);
        bySource[name] = `실패(이전 ${keep.length}건 유지)`; events.push(...keep);
      }
    }
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify({ updatedAt: new Date().toISOString(), events }, null, 2), 'utf-8');
    console.log(`[CALENDAR AUTO] 공식 일정 수집 완료 — ${Object.entries(bySource).map(([k, v]) => `${k} ${v}`).join(' / ')} (${((Date.now() - started) / 1000).toFixed(0)}초)`);
  })().catch(e => console.error('[CALENDAR AUTO] 수집 실패:', e.message)).finally(() => { syncInFlight = null; });
  return syncInFlight;
}

export function startAutoEventSync() {
  syncAutoEvents();
  setInterval(syncAutoEvents, SYNC_INTERVAL_MS);
}
