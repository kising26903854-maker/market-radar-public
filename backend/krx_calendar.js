// krx_calendar.js — 한국거래소(KRX) 휴장일/장중 판정 (스케줄러가 휴일에 헛돌지 않도록)
//
// 2026년 휴장일 목록은 직접 관리한다(다음 해 목록은 매년 추가해야 함 — 목록에 없는 연도는
// 주말만 제외하고 평일은 거래일로 간주한다). 대체공휴일(삼일절·광복절·개천절·한글날이
// 토/일과 겹칠 때)과 근로자의날(5/1), 선거일, 연말 휴장(12/31)도 KRX는 쉰다.
const KRX_HOLIDAYS = new Set([
  // 2026
  '2026-01-01', // 신정
  '2026-02-16', '2026-02-17', '2026-02-18', // 설날 연휴
  '2026-03-02', // 삼일절 대체공휴일
  '2026-05-01', // 근로자의날
  '2026-05-05', // 어린이날
  '2026-05-25', // 부처님오신날 대체공휴일
  '2026-06-03', // 전국동시지방선거
  '2026-08-17', // 광복절 대체공휴일
  '2026-09-24', '2026-09-25', // 추석 연휴 (9/26은 토요일)
  '2026-10-05', // 개천절(토) 대체공휴일
  '2026-10-09', // 한글날
  '2026-12-25', // 성탄절
  '2026-12-31', // 연말 휴장
]);

function kstParts(date = new Date()) {
  const kst = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, '0');
  const d = String(kst.getDate()).padStart(2, '0');
  return { kst, dateKey: `${y}-${m}-${d}`, day: kst.getDay(), minutes: kst.getHours() * 60 + kst.getMinutes() };
}

export function isKrxHoliday(date = new Date()) {
  return KRX_HOLIDAYS.has(kstParts(date).dateKey);
}

// 평일이면서 휴장일이 아닌 날
export function isKrxTradingDay(date = new Date()) {
  const { day, dateKey } = kstParts(date);
  if (day === 0 || day === 6) return false;
  return !KRX_HOLIDAYS.has(dateKey);
}

// 거래일 09:00~15:30 (KST)
export function isKrxMarketHours(date = new Date()) {
  if (!isKrxTradingDay(date)) return false;
  const { minutes } = kstParts(date);
  return minutes >= 9 * 60 && minutes <= 15 * 60 + 30;
}
