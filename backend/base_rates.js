import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_FILE = path.join(__dirname, 'data', 'base_rates.json');

// 한국은행 1999년 5월 이후 공식 기준금리(또는 콜금리 목표) 변동 내역
const bokBaseRates = [
  { date: '1999-05-06', rate: 4.75 },
  { date: '2000-02-10', rate: 5.00 },
  { date: '2000-10-05', rate: 5.25 },
  { date: '2001-02-08', rate: 5.00 },
  { date: '2001-07-05', rate: 4.75 },
  { date: '2001-08-09', rate: 4.50 },
  { date: '2001-09-19', rate: 4.00 },
  { date: '2002-05-07', rate: 4.25 },
  { date: '2003-05-13', rate: 4.00 },
  { date: '2003-07-10', rate: 3.75 },
  { date: '2004-11-11', rate: 3.25 },
  { date: '2005-10-11', rate: 3.50 },
  { date: '2005-12-08', rate: 3.75 },
  { date: '2006-02-09', rate: 4.00 },
  { date: '2006-06-08', rate: 4.25 },
  { date: '2006-08-10', rate: 4.50 },
  { date: '2007-07-12', rate: 4.75 },
  { date: '2007-08-09', rate: 5.00 },
  { date: '2008-08-07', rate: 5.25 },
  { date: '2008-10-09', rate: 5.00 },
  { date: '2008-10-27', rate: 4.25 },
  { date: '2008-11-07', rate: 4.00 },
  { date: '2008-12-11', rate: 3.00 },
  { date: '2009-01-09', rate: 2.50 },
  { date: '2009-02-12', rate: 2.00 },
  { date: '2010-07-09', rate: 2.25 },
  { date: '2010-11-16', rate: 2.50 },
  { date: '2011-01-13', rate: 2.75 },
  { date: '2011-03-10', rate: 3.00 },
  { date: '2011-06-10', rate: 3.25 },
  { date: '2012-07-12', rate: 3.00 },
  { date: '2012-10-11', rate: 2.75 },
  { date: '2013-05-09', rate: 2.50 },
  { date: '2014-08-14', rate: 2.25 },
  { date: '2014-10-15', rate: 2.00 },
  { date: '2015-03-12', rate: 1.75 },
  { date: '2015-06-11', rate: 1.50 },
  { date: '2016-06-09', rate: 1.25 },
  { date: '2017-11-30', rate: 1.50 },
  { date: '2018-11-30', rate: 1.75 },
  { date: '2019-07-18', rate: 1.50 },
  { date: '2019-10-16', rate: 1.25 },
  { date: '2020-03-17', rate: 0.75 },
  { date: '2020-05-28', rate: 0.50 },
  { date: '2021-08-26', rate: 0.75 },
  { date: '2021-11-25', rate: 1.00 },
  { date: '2022-01-14', rate: 1.25 },
  { date: '2022-04-14', rate: 1.50 },
  { date: '2022-05-26', rate: 1.75 },
  { date: '2022-07-13', rate: 2.25 },
  { date: '2022-08-25', rate: 2.50 },
  { date: '2022-10-12', rate: 3.00 },
  { date: '2022-11-24', rate: 3.25 },
  { date: '2023-01-13', rate: 3.50 },
  { date: '2024-10-11', rate: 3.25 },
  { date: '2024-11-28', rate: 3.00 },
  { date: '2025-02-25', rate: 2.75 },
  { date: '2025-05-29', rate: 2.50 },
  { date: '2026-07-16', rate: 2.75 },
  { date: '2026-08-27', rate: 3.00 }
];

function getBokBaseRateForDate(dateStr) {
  let activeRate = 4.75;
  for (const change of bokBaseRates) {
    if (change.date <= dateStr) {
      activeRate = change.rate;
    } else {
      break;
    }
  }
  return activeRate;
}

function parseCsv(csvText) {
  const lines = csvText.trim().split('\n');
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 2) {
      const date = parts[0].trim();
      const val = parseFloat(parts[1]);
      if (date && !isNaN(val)) {
        result.push({ date, val });
      }
    }
  }
  return result;
}

export async function getBaseRatesData(forceRefresh = false) {
  try {
    // 1. 캐시 확인 (24시간 캐싱)
    if (!forceRefresh && fs.existsSync(CACHE_FILE)) {
      const stat = fs.statSync(CACHE_FILE);
      const ageHours = (Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60);
      if (ageHours < 24) {
        const cachedData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        return { success: true, data: cachedData, fromCache: true };
      }
    }

    console.log("한·미 기준금리 캐시가 만료되어 새로 빌드합니다...");

    // 2. FRED에서 미국 연방기금 실효금리(FEDFUNDS) 다운로드
    const usRes = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=FEDFUNDS');
    if (!usRes.ok) throw new Error(`US FEDFUNDS 다운로드 실패: ${usRes.status}`);
    const usCsv = await usRes.text();
    const usData = parseCsv(usCsv);

    // 3. FRED에서 한국 과거 할인율(INTDSRKRM193N) 다운로드
    const krRes = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=INTDSRKRM193N');
    if (!krRes.ok) throw new Error(`KR INTDSRKRM193N 다운로드 실패: ${krRes.status}`);
    const krCsv = await krRes.text();
    const krDiscountData = parseCsv(krCsv);

    // 4. 데이터 맵핑 및 병합
    const usMap = new Map();
    usData.forEach(d => usMap.set(d.date, d.val));

    const krDiscountMap = new Map();
    krDiscountData.forEach(d => krDiscountMap.set(d.date, d.val));

    const combined = [];
    const usDates = Array.from(usMap.keys()).sort();

    for (const date of usDates) {
      if (date < '1970-01-01') continue;
      const usRate = usMap.get(date);

      let krRate;
      if (date < '1999-05-06') {
        krRate = krDiscountMap.get(date) || 5.0; // 데이터 누락 시 기본값
      } else {
        krRate = getBokBaseRateForDate(date);
      }

      const gap = parseFloat((krRate - usRate).toFixed(2));
      combined.push({
        date,
        usRate: parseFloat(usRate.toFixed(2)),
        krRate: parseFloat(krRate.toFixed(2)),
        gap
      });
    }

    // 5. 최신 데이터 보강 (FRED 데이터가 아직 안 올라온 현재 달 보정)
    // 2026년 8월 기준 금리 보정
    const latestCombined = combined[combined.length - 1];
    if (latestCombined && latestCombined.date < '2026-08-01') {
      combined.push({
        date: '2026-08-01',
        usRate: 3.63, // 3.50% ~ 3.75% 의 중앙값
        krRate: 3.00, // 2026.08.27 금융통화위원회 기준금리 인상 (3.00%)
        gap: -0.63
      });
    }

    // 6. 캐시 저장
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(combined, null, 2), 'utf-8');

    return { success: true, data: combined, fromCache: false };
  } catch (err) {
    console.error("getBaseRatesData 에러:", err);
    // 에러 발생 시 캐시 파일이 있으면 반환
    if (fs.existsSync(CACHE_FILE)) {
      const cachedData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
      return { success: true, data: cachedData, error: err.message, fallback: true };
    }
    return { success: false, error: err.message };
  }
}
