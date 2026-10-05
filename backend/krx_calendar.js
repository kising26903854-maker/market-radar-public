// krx_calendar.js — 한국거래소(KRX) 휴장일/장중 판정 (어느 해든 자동 계산)
//
// 고정 공휴일은 규칙으로, 음력 공휴일(설날·추석·부처님오신날)은 Intl 중국력(음력) 변환으로 계산하고,
// 대체공휴일 규칙(일요일/겹침/토요일(일부 국경일))과 KRX 자체 휴장(근로자의날 5/1, 연말 12/31)을 더한다.
// 선거일처럼 법으로 날짜가 정해지지만 규칙으로는 못 구하는 휴장일만 EXTRA_HOLIDAYS에 직접 적는다
// (새 선거일이 확정되면 한 줄 추가). ⚠️ 음력 변환은 중국력 기준이라 한국 음력과 드물게 하루 다를 수 있다.
const EXTRA_HOLIDAYS = {
  '2026-06-03': '전국동시지방선거',
  '2028-04-12': '국회의원 선거',
};

const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const dateOf = (s) => new Date(`${s}T12:00:00+09:00`);
const keyOf = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
const addDays = (s, n) => keyOf(new Date(dateOf(s).getTime() + n * 86400000));

const chineseFmt = new Intl.DateTimeFormat('en-US-u-ca-chinese', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Seoul' });
function lunarToSolar(year, lunarMonth, lunarDay, fromMD, toMD) {
  const [fm, fd] = fromMD, [tm, td] = toMD;
  let cur = ymd(year, fm, fd);
  const end = ymd(year, tm, td);
  while (cur <= end) {
    const parts = Object.fromEntries(chineseFmt.formatToParts(dateOf(cur)).map(p => [p.type, p.value]));
    if (parts.month === String(lunarMonth) && parts.day === String(lunarDay)) return cur; // 윤달("4bis" 등)은 제외됨
    cur = addDays(cur, 1);
  }
  return null;
}

// 국경일 중 토·일과 겹치면 대체공휴일이 생기는 날(어린이날·석가탄신일·성탄절 포함)
const SUBSTITUTABLE = new Set(['삼일절', '어린이날', '부처님오신날', '광복절', '개천절', '한글날', '성탄절']);
const holidayCache = new Map();

// 해당 연도의 KRX 휴장일(평일만) → { 'YYYY-MM-DD': '이름' }
export function krxHolidaysForYear(year) {
  if (holidayCache.has(year)) return holidayCache.get(year);
  const base = []; // { date, name, kind }  kind: 'national' | 'lunar'
  base.push({ date: ymd(year, 1, 1), name: '신정', kind: 'plain' });
  base.push({ date: ymd(year, 3, 1), name: '삼일절', kind: 'national' });
  base.push({ date: ymd(year, 5, 5), name: '어린이날', kind: 'national' });
  base.push({ date: ymd(year, 8, 15), name: '광복절', kind: 'national' });
  base.push({ date: ymd(year, 10, 3), name: '개천절', kind: 'national' });
  base.push({ date: ymd(year, 10, 9), name: '한글날', kind: 'national' });
  base.push({ date: ymd(year, 12, 25), name: '성탄절', kind: 'national' });
  const buddha = lunarToSolar(year, 4, 8, [4, 10], [6, 10]);
  if (buddha) base.push({ date: buddha, name: '부처님오신날', kind: 'national' });

  const lunarClusters = [];
  const seol = lunarToSolar(year, 1, 1, [1, 15], [2, 25]);
  if (seol) lunarClusters.push({ name: '설날', days: [addDays(seol, -1), seol, addDays(seol, 1)], center: seol });
  const chuseok = lunarToSolar(year, 8, 15, [8, 25], [10, 15]);
  if (chuseok) lunarClusters.push({ name: '추석', days: [addDays(chuseok, -1), chuseok, addDays(chuseok, 1)], center: chuseok });

  // 날짜별 이름 먼저 채우기 (겹침 판단용)
  const occupied = new Map();
  for (const h of base) occupied.set(h.date, h.name);
  for (const c of lunarClusters) c.days.forEach(d => occupied.set(d, d === c.center ? c.name : `${c.name} 연휴`));
  for (const [d, n] of Object.entries(EXTRA_HOLIDAYS)) if (d.startsWith(String(year))) occupied.set(d, n);

  const isWeekend = (s) => { const w = dateOf(s).getDay(); return w === 0 || w === 6; };
  const substitutes = [];
  const nextFreeWeekday = (from) => {
    let d = addDays(from, 1);
    while (isWeekend(d) || occupied.has(d) || substitutes.includes(d)) d = addDays(d, 1);
    return d;
  };
  const sortedBase = base.filter(h => h.kind === 'national').sort((a, b) => a.date.localeCompare(b.date));
  for (const h of sortedBase) {
    if (!SUBSTITUTABLE.has(h.name)) continue;
    const w = dateOf(h.date).getDay();
    const overlapsOther = [...lunarClusters.flatMap(c => c.days)].includes(h.date);
    if (w === 0 || w === 6 || overlapsOther) substitutes.push({ for: h.name, date: nextFreeWeekday(h.date) });
  }
  // 설날/추석 연휴: 일요일과 겹치면 대체공휴일 (토요일만 겹치면 없음).
  // 다른 국경일과 겹치는 경우는 위 국경일 쪽에서 이미 하루 대체되므로 여기서 또 만들지 않는다.
  const substituteDates = substitutes.map(s => s.date);
  for (const c of lunarClusters) {
    const hasSunday = c.days.some(d => dateOf(d).getDay() === 0);
    if (hasSunday) {
      let d = addDays(c.days[2], 1);
      while (isWeekend(d) || occupied.has(d) || substituteDates.includes(d)) d = addDays(d, 1);
      substitutes.push({ for: c.name, date: d });
      substituteDates.push(d);
    }
  }

  const out = {};
  const put = (d, name) => { if (d.startsWith(String(year)) && !isWeekend(d)) out[d] = out[d] ? `${out[d]}·${name}` : name; };
  for (const [d, n] of occupied) put(d, n);
  for (const s of substitutes) put(s.date, `${s.for} 대체공휴일`);
  put(ymd(year, 5, 1), '근로자의날');     // KRX 휴장
  put(ymd(year, 12, 31), '연말 휴장');    // KRX 휴장
  holidayCache.set(year, out);
  return out;
}

function kstParts(date = new Date()) {
  const kst = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const dateKey = keyOf(date);
  return { dateKey, day: kst.getDay(), minutes: kst.getHours() * 60 + kst.getMinutes(), year: kst.getFullYear() };
}

export function isKrxHoliday(date = new Date()) {
  const { dateKey, year } = kstParts(date);
  return Boolean(krxHolidaysForYear(year)[dateKey]);
}

// 평일이면서 휴장일이 아닌 날
export function isKrxTradingDay(date = new Date()) {
  const { dateKey, day, year } = kstParts(date);
  if (day === 0 || day === 6) return false;
  return !krxHolidaysForYear(year)[dateKey];
}

// 거래일 09:00~15:30 (KST) — KRX 정규장
export function isKrxRegularHours(date = new Date()) {
  if (!isKrxTradingDay(date)) return false;
  const { minutes } = kstParts(date);
  return minutes >= 9 * 60 && minutes <= 15 * 60 + 30;
}

// 거래일 08:00~20:00 (KST) — 넥스트레이드(NXT) 프리마켓 08:00~08:50 · 메인 09:00~15:20 · 애프터 15:30~20:00 포함.
// 마지막 집계가 20:00 종가를 담도록 5분 여유를 둔다.
export function isKrxMarketHours(date = new Date()) {
  if (!isKrxTradingDay(date)) return false;
  const { minutes } = kstParts(date);
  return minutes >= 8 * 60 && minutes <= 20 * 60 + 5;
}

// 달력 일정 생성용: 'YYYY-MM-DD' 문자열이 한국 거래일인지
export function isKrxTradingDateStr(s) {
  const w = dateOf(s).getDay();
  if (w === 0 || w === 6) return false;
  return !krxHolidaysForYear(Number(s.slice(0, 4)))[s];
}
