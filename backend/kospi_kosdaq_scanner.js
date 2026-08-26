// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📡 kospi_kosdaq_scanner.js
// 코스피 + 코스닥 전 종목 저평가 스캐너
// - 네이버 시가총액 순위 전 페이지 파싱 (PER, ROE 포함)
// - Naver finance/annual API로 PBR, 배당수익률 보완
// - 저평가 필터링 → 상위 종목 랭킹
// - 매일 08:40 자동 갱신 + 캐시 저장
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import axios from 'axios';
import iconv from 'iconv-lite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCAN_CACHE_PATH = path.join(__dirname, 'data', 'full_scan_cache.json');

const HEADERS_PC = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://finance.naver.com/',
  'Accept-Language': 'ko-KR,ko;q=0.9',
};
const HEADERS_M = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  'Referer': 'https://m.stock.naver.com/',
};

// ─── 1. 네이버 시가총액 1페이지 파싱 (PER, ROE, 현재가 등) ───
function parseMarketSumPage(html) {
  const stocks = [];
  const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let trMatch;

  while ((trMatch = trPattern.exec(html)) !== null) {
    const row = trMatch[1];
    if (!row.includes('/item/main.nhn?code=') && !row.includes('/item/main.naver?code=')) continue;

    const codeMatch = row.match(/code=(\d{6})/);
    const nameMatch = row.match(/<a[^>]*item\/main[^>]*>([^<]+)<\/a>/);
    if (!codeMatch || !nameMatch) continue;

    const code = codeMatch[1];
    const name = nameMatch[1].trim();

    // num 클래스 td 추출: 현재가, 전일비, 등락률, 액면가, 시총, 상장주식수, 외국인비율, 거래량, PER, ROE
    const numTds = [];
    const numPattern = /<td[^>]*class="[^"]*num[^"]*"[^>]*>([\s\S]*?)<\/td>/g;
    let numMatch;
    while ((numMatch = numPattern.exec(row)) !== null) {
      const val = numMatch[1].replace(/<[^>]+>/g, '').replace(/,/g, '').replace(/&nbsp;/g, '').trim();
      numTds.push(val);
    }

    // 인덱스 매핑: [0]현재가 [1]전일비텍스트 [2]등락률 [3]액면가 [4]시총(억) [5]상장주식수 [6]외국인비율 [7]거래량 [8]PER [9]ROE
    const price = parseFloat(numTds[0]?.replace(/[^0-9]/g, '')) || 0;
    const changePctRaw = numTds[2] || '';
    const changePct = parseFloat(changePctRaw.replace(/[^0-9.-]/g, '')) * (changePctRaw.includes('-') ? -1 : 1) || 0;
    const marketCap = parseFloat(numTds[4]) || 0; // 억원
    const per = parseFloat(numTds[8]) || null;
    const roe = parseFloat(numTds[9]) || null;

    if (code && name && price > 0) {
      stocks.push({ code, name, price, changePct, marketCap, per, roe });
    }
  }
  return stocks;
}

// ─── 2. 시가총액 전 페이지 수집 (코스피 or 코스닥) ───
async function fetchAllPages(sosok, totalPages) {
  const market = sosok === 0 ? '코스피' : '코스닥';
  const allStocks = [];
  const seen = new Set();

  // 배치 처리: 5페이지씩 동시 요청
  const batchSize = 5;
  for (let i = 1; i <= totalPages; i += batchSize) {
    const pages = [];
    for (let p = i; p < i + batchSize && p <= totalPages; p++) pages.push(p);

    const results = await Promise.all(pages.map(async (page) => {
      try {
        const url = `https://finance.naver.com/sise/sise_market_sum.naver?sosok=${sosok}&page=${page}`;
        const res = await axios.get(url, { responseType: 'arraybuffer', headers: HEADERS_PC, timeout: 8000 });
        const html = iconv.decode(Buffer.from(res.data), 'euc-kr');
        return parseMarketSumPage(html);
      } catch (e) {
        console.warn(`[SCANNER] ${market} ${page}페이지 실패: ${e.message}`);
        return [];
      }
    }));

    results.forEach(pageStocks => {
      pageStocks.forEach(s => {
        if (!seen.has(s.code)) { seen.add(s.code); allStocks.push({ ...s, market }); }
      });
    });

    // 요청 사이 딜레이 (서버 부하 방지)
    if (i + batchSize <= totalPages) await new Promise(r => setTimeout(r, 800));
    
    const done = Math.min(i + batchSize - 1, totalPages);
    process.stdout.write(`\r[SCANNER] ${market} ${done}/${totalPages}페이지 완료 (${allStocks.length}종목)`);
  }
  console.log('');
  return allStocks;
}

// ─── 3. PBR 보완: Naver finance/annual API ───
async function fetchPBR(code) {
  try {
    const url = `https://m.stock.naver.com/api/stock/${code}/finance/annual`;
    const res = await axios.get(url, { headers: HEADERS_M, timeout: 5000 });
    const rows = res.data?.financeInfo?.rowList || [];
    const periods = res.data?.financeInfo?.trTitleList || [];
    const confirmed = periods.filter(p => p.isConsensus === 'N');
    const latestKey = confirmed.length > 0 ? confirmed[confirmed.length - 1].key : null;
    if (!latestKey) return null;
    const pbrRow = rows.find(r => r.title === 'PBR');
    const divRow = rows.find(r => r.title === '주당배당금');
    const bpsRow = rows.find(r => r.title === 'BPS');
    const pbr = parseFloat(pbrRow?.columns?.[latestKey]?.value?.replace(/,/g, '')) || null;
    const divAmt = parseFloat(divRow?.columns?.[latestKey]?.value?.replace(/,/g, '')) || null;
    const bps = parseFloat(bpsRow?.columns?.[latestKey]?.value?.replace(/,/g, '')) || null;
    return { pbr, divAmt, bps };
  } catch { return null; }
}

// ─── 4. 저평가 필터링 기준 ───
function isUndervalued(s) {
  // 최소 조건: PER, ROE 유효값 있어야 함
  if (!s.per || s.per <= 0 || s.per > 50) return false; // PER 0초과 50이하
  if (!s.roe || s.roe < 5) return false; // ROE 5% 이상 (밸류트랩 필터)
  if (!s.marketCap || s.marketCap < 500) return false; // 시총 500억 이상만 (소형주 제외)
  return true;
}

// ─── 5. 저평가 점수 산정 (100점 만점) ───
function calcScore(s) {
  let score = 0;

  // ROE 품질 (최대 30점)
  if (s.roe >= 25) score += 30;
  else if (s.roe >= 18) score += 25;
  else if (s.roe >= 12) score += 18;
  else if (s.roe >= 8)  score += 12;
  else                  score += 5;

  // PBR 저평가 (최대 25점) - PBR 있을 때만
  if (s.pbr != null) {
    if      (s.pbr < 0.4) score += 25;
    else if (s.pbr < 0.7) score += 22;
    else if (s.pbr < 1.0) score += 18;
    else if (s.pbr < 1.5) score += 14;
    else if (s.pbr < 2.5) score += 10;
    else if (s.pbr < 4.0) score += 6;
    else                  score += 2;
  } else score += 10; // PBR 없으면 중립 점수

  // PER 저평가 (최대 25점)
  if      (s.per < 5)  score += 25;
  else if (s.per < 8)  score += 22;
  else if (s.per < 12) score += 18;
  else if (s.per < 18) score += 14;
  else if (s.per < 25) score += 10;
  else                 score += 5;

  // 배당수익률 (최대 15점)
  if (s.divYield != null) {
    if      (s.divYield >= 7) score += 15;
    else if (s.divYield >= 5) score += 12;
    else if (s.divYield >= 3) score += 8;
    else if (s.divYield >= 1) score += 4;
  }

  // 밸류트랩 패널티: ROE가 낮고 PBR도 극단적으로 낮으면 의심
  if (s.pbr != null && s.pbr < 0.3 && s.roe < 8) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getGrade(score) {
  if      (score >= 88) return { grade: 'S', desc: '최우선 매수', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' };
  else if (score >= 75) return { grade: 'A', desc: '적극 매수',   color: '#34d399', bg: 'rgba(52,211,153,0.15)' };
  else if (score >= 60) return { grade: 'B', desc: '분할 매수',   color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' };
  else if (score >= 45) return { grade: 'C', desc: '소량 보유',   color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' };
  else                  return { grade: 'D', desc: '관망',        color: '#f87171', bg: 'rgba(248,113,113,0.15)' };
}

// ─── 6. 전체 스캔 실행 ───
export async function runFullMarketScan() {
  console.log('\n[FULL SCAN] 코스피 + 코스닥 전 종목 저평가 스캔 시작...');
  const startTime = Date.now();

  // 코스피 + 코스닥 전 종목 수집
  const [kospiStocks, kosdaqStocks] = await Promise.all([
    fetchAllPages(0, 50),   // 코스피 50페이지
    fetchAllPages(1, 37),   // 코스닥 37페이지
  ]);

  const allStocks = [...kospiStocks, ...kosdaqStocks];
  console.log(`[FULL SCAN] 수집 완료: 코스피 ${kospiStocks.length}종목 + 코스닥 ${kosdaqStocks.length}종목 = 총 ${allStocks.length}종목`);

  // 저평가 1차 필터 (PER + ROE 기준)
  const candidates = allStocks.filter(isUndervalued);
  console.log(`[FULL SCAN] 1차 필터(PER<50, ROE≥5%, 시총≥500억): ${candidates.length}종목`);

  // PBR 보완 수집 (상위 후보만, 배치 처리)
  console.log(`[FULL SCAN] PBR 보완 수집 중...`);
  const batchSize = 10;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const pbrResults = await Promise.all(batch.map(s => fetchPBR(s.code)));
    pbrResults.forEach((res, idx) => {
      if (res) {
        batch[idx].pbr = res.pbr;
        batch[idx].divAmt = res.divAmt;
        batch[idx].bps = res.bps;
        // 배당수익률 계산
        if (res.divAmt && batch[idx].price > 0) {
          batch[idx].divYield = parseFloat(((res.divAmt / batch[idx].price) * 100).toFixed(2));
        }
      }
    });
    if (i + batchSize < candidates.length) await new Promise(r => setTimeout(r, 300));
    process.stdout.write(`\r[FULL SCAN] PBR 수집: ${Math.min(i+batchSize, candidates.length)}/${candidates.length}`);
  }
  console.log('');

  // 점수 산정 및 정렬
  const scored = candidates.map((s, idx) => {
    const score = calcScore(s);
    const grade = getGrade(score);
    const isValueTrap = (s.roe < 8 && s.pbr != null && s.pbr < 0.4);
    return {
      ...s,
      sector: '🏢 일반제조·가치주',
      reason: '퀀트 스크리닝 저평가 우량주 발굴 대상',
      investmentScore: score,
      investmentGrade: grade,
      isValueTrap,
      trapReason: isValueTrap ? `ROE ${s.roe}% + PBR ${s.pbr}배 — 저ROE 극단 저PBR 밸류트랩 주의` : null,
      trapLevel: isValueTrap ? (s.roe < 5 ? 'HIGH' : 'MEDIUM') : null,
      per: s.per,
      pbr: s.pbr,
      roe: s.roe,
      // 하드코딩 형식 호환
      perStr: s.per ? `${s.per}배` : 'N/A',
      pbrStr: s.pbr ? `${s.pbr}배` : 'N/A',
      roeStr: s.roe ? `${s.roe}%` : 'N/A',
      divYieldStr: s.divYield ? `${s.divYield}%` : 'N/A',
      upsidePct: null, // 전 종목은 목표가 없음
      quantScore: score,
      dataSource: '📡 네이버 금융 실시간 전종목 스캔',
    };
  }).sort((a, b) => b.investmentScore - a.investmentScore);

  // 순위 부여
  scored.forEach((s, i) => { s.investmentRank = i + 1; });

  // 상위 200개만 저장 (UI 성능)
  const top200 = scored.slice(0, 200);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const cache = {
    lastSyncAt: new Date().toISOString(),
    elapsedSec: parseFloat(elapsed),
    totalScanned: allStocks.length,
    totalCandidates: candidates.length,
    topCount: top200.length,
    kospiCount: kospiStocks.length,
    kosdaqCount: kosdaqStocks.length,
    stocks: top200,
  };

  const dir = path.dirname(SCAN_CACHE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SCAN_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');

  console.log(`[FULL SCAN] ✅ 완료! ${elapsed}초 소요. 상위 ${top200.length}개 저장 → ${SCAN_CACHE_PATH}`);
  console.log(`[FULL SCAN] TOP5: ${top200.slice(0,5).map(s => `${s.name}(${s.investmentGrade.grade}/${s.investmentScore}점)`).join(', ')}`);

  return cache;
}

// ─── 7. 캐시 읽기 ───
export function getFullScanCache() {
  try {
    if (!fs.existsSync(SCAN_CACHE_PATH)) return null;
    return JSON.parse(fs.readFileSync(SCAN_CACHE_PATH, 'utf8'));
  } catch { return null; }
}

// ─── 8. 캐시 만료 확인 (24시간) ───
export function isFullScanStale() {
  try {
    if (!fs.existsSync(SCAN_CACHE_PATH)) return true;
    const cache = JSON.parse(fs.readFileSync(SCAN_CACHE_PATH, 'utf8'));
    const hoursSince = (Date.now() - new Date(cache.lastSyncAt).getTime()) / 3600000;
    return hoursSince > 24;
  } catch { return true; }
}

// ─── 9. 매일 08:40 자동 스캔 스케줄러 ───
export function startDailyMarketScan() {
  const scheduleNext = () => {
    const now = new Date();
    const target = new Date(now);
    target.setHours(8, 40, 0, 0);
    if (now >= target) target.setDate(target.getDate() + 1);
    const msUntil = target.getTime() - now.getTime();
    console.log(`[FULL SCAN] 다음 자동 스캔: ${target.toLocaleString('ko-KR')} (${Math.round(msUntil/60000)}분 후)`);
    setTimeout(async () => {
      await runFullMarketScan();
      scheduleNext();
    }, msUntil);
  };

  if (isFullScanStale()) {
    console.log('[FULL SCAN] 캐시 없음 또는 만료 → 즉시 스캔 시작 (백그라운드)');
    runFullMarketScan().then(() => scheduleNext()).catch(e => {
      console.error('[FULL SCAN] 초기 스캔 실패:', e.message);
      scheduleNext();
    });
  } else {
    console.log('[FULL SCAN] 캐시 유효. 다음 예약 시간에 스캔합니다.');
    scheduleNext();
  }
}
