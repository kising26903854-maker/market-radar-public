import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { fetchMarketCapUniverse } from './kospi_kosdaq_scanner.js';
import { sendTelegramMessage } from './telegram_alert.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const STOCK_CAP_FILE = path.join(DATA_DIR, 'stock_market_cap.json');
const RANKING_CACHE_FILE = path.join(DATA_DIR, 'ranking_cache.json');
const RANK_HISTORY_FILE = path.join(DATA_DIR, 'market_cap_rank_history.json');
const NOTIFY_REGISTRY_FILE = path.join(DATA_DIR, 'market_cap_notify_registry.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJson(file, fallback = {}) {
  if (fs.existsSync(file)) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.error(`Error parsing ${file}:`, e.message);
      return fallback;
    }
  }
  return fallback;
}

function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export async function getMarketCapData(code) {
  const data = loadJson(STOCK_CAP_FILE, {});
  
  let currentPrice = 0;
  let listedShares = 0;
  let currentMarketCap = 0;
  
  try {
    const url = `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${code}`;
    const res = await axios.get(url, { timeout: 3000 });
    const itemData = res.data?.result?.areas?.[0]?.datas?.[0];
    
    if (itemData) {
      currentPrice = itemData.nv; 
      listedShares = itemData.countOfListedStock;
      currentMarketCap = currentPrice * listedShares;
    }
  } catch (e) {
    console.warn(`Polling failed for ${code}:`, e.message);
  }

  if (currentMarketCap === 0) {
    try {
      const basicUrl = `https://m.stock.naver.com/api/stock/${code}/basic`;
      const basicRes = await axios.get(basicUrl, { timeout: 3000 });
      if (basicRes.data) {
        currentPrice = parseInt(String(basicRes.data.nowPrice || basicRes.data.closePrice || '0').replace(/,/g, ''), 10) || 0;
        const totalInfos = basicRes.data.totalInfos || [];
        const capInfo = totalInfos.find(t => t.key === '시가총액');
        if (capInfo && capInfo.value) {
          const capText = String(capInfo.value).replace(/,/g, '');
          let calcCap = 0;
          if (capText.includes('조')) {
            const parts = capText.split('조');
            const jo = parseInt(parts[0], 10) || 0;
            const eok = parseInt(parts[1]?.replace(/[^0-9]/g, '') || '0', 10) || 0;
            calcCap = (jo * 10000 + eok) * 100000000;
          } else {
            calcCap = (parseInt(capText.replace(/[^0-9]/g, '') || '0', 10) || 0) * 100000000;
          }
          currentMarketCap = calcCap;
        }
      }
    } catch (e2) {
      console.warn(`Fallback failed for ${code}:`, e2.message);
    }
  }

  if (currentMarketCap === 0) {
    return { success: false, error: 'Could not calculate market cap' };
  }

  const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); 
  
  // 과거 이력이 없으면 지어내지 않고 빈 배열로 시작 — 오늘 이후 실제 수집분만 누적된다.
  if (!data[code]) {
    data[code] = [];
  }

  const codeHistory = data[code];
  const existingToday = codeHistory.find(h => h.date === todayDate);
  
  if (existingToday) {
    existingToday.marketCap = currentMarketCap;
  } else {
    codeHistory.push({
      date: todayDate,
      marketCap: currentMarketCap
    });
  }
  
  saveJson(STOCK_CAP_FILE, data);
  
  return {
    success: true,
    code,
    currentPrice,
    listedShares,
    currentMarketCap,
    history: codeHistory
  };
}

// ⚠️ 예전에는 finance.naver.com/sise/sise_market_sum.naver를 HTML 스크래핑했으나, 그 구버전
// 페이지가 stock.naver.com으로 302 리다이렉트되며 완전히 죽었다(테이블 자체가 응답에 없음 →
// 조용히 빈 배열 반환). m.stock.naver.com의 marketValue API(이미 kospi_kosdaq_scanner.js에서
// 검증됨)로 교체 — 페이지당 최대 100종목, 시총 내림차순 정렬을 그대로 제공한다.
export async function fetchRanking(sosok) {
  try {
    const stocks = await fetchMarketCapUniverse(sosok, 1); // 1페이지 = 상위 100종목이면 top 25 충분
    return stocks.slice(0, 25).map((s, idx) => ({
      rank: idx + 1,
      code: s.code,
      name: s.name,
      price: s.price,
      changePct: s.changePct,
      marketCap: Math.round(s.marketCap * 100000000), // 억원 -> 원
      marketCapEok: s.marketCap,
      status: 'SAME',
      change: 0
    }));
  } catch (e) {
    console.error(`Failed to fetch ranking (sosok=${sosok}):`, e.message);
    return [];
  }
}

/**
 * 전일 랭킹과 금일 랭킹을 정밀 비교하여 변동(UP, DOWN, SAME, NEW, OUT) 계산
 */
function computeComparison(currentList, prevList) {
  if (!prevList || prevList.length === 0) {
    // 이전 랭킹 기록이 없을 때(최초 실행일): 실제 순위 변동을 알 수 없으므로 절대 지어내지 않고
    // 전부 'SAME'(변동없음)으로 정직하게 표시한다. 다음 날부터는 실제 이력과 비교된다.
    return {
      current: currentList.slice(0, 20).map(item => ({ ...item, status: 'SAME', change: 0 })),
      out: []
    };
  }

  const prevTop20 = prevList.slice(0, 20);
  const currentTop20 = currentList.slice(0, 20);
  const currentTop20Codes = new Set(currentTop20.map(item => item.code));

  // 1. 현재 TOP 20 종목의 순위 변동 계산
  const currentWithChanges = currentTop20.map(item => {
    const prevItem = prevTop20.find(p => p.code === item.code);
    if (prevItem) {
      const rankDiff = prevItem.rank - item.rank;
      if (rankDiff > 0) {
        return { ...item, status: 'UP', change: rankDiff };
      } else if (rankDiff < 0) {
        return { ...item, status: 'DOWN', change: Math.abs(rankDiff) };
      } else {
        return { ...item, status: 'SAME', change: 0 };
      }
    } else {
      // 전일 TOP 20 밖에서 신규 진입
      return { ...item, status: 'NEW', change: 0 };
    }
  });

  // 2. 20위권 밖으로 밀려난 종목 (OUT) 탐지
  const outList = prevTop20
    .filter(prevItem => !currentTop20Codes.has(prevItem.code))
    .map(prevItem => {
      // 현재 21~25위 순위 탐색
      const currentPos = currentList.find(c => c.code === prevItem.code);
      return {
        code: prevItem.code,
        name: prevItem.name,
        rank: prevItem.rank,
        currentRank: currentPos ? currentPos.rank : '20위권 밖',
        marketCap: prevItem.marketCap
      };
    });

  return {
    current: currentWithChanges,
    out: outList
  };
}

// ─── 🚨 TOP20 신규진입/이탈 텔레그램 알림 (5분마다 재계산되지만, "오늘 아직 알리지 않은
// 변동"에 대해서만 1회 발송 — 안 그러면 같은 종목이 하루 종일 5분마다 재발송된다) ───
function loadNotifyRegistry() {
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const reg = loadJson(NOTIFY_REGISTRY_FILE, {});
  if (reg.date !== todayKey) {
    return { date: todayKey, notifiedNew: [], notifiedOut: [] };
  }
  return reg;
}

async function notifyMarketCapChanges(marketLabel, comparison, registry) {
  const newEntries = (comparison.current || []).filter(
    s => s.status === 'NEW' && !registry.notifiedNew.includes(`${marketLabel}_${s.code}`)
  );
  const outEntries = (comparison.out || []).filter(
    s => !registry.notifiedOut.includes(`${marketLabel}_${s.code}`)
  );

  const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  for (const s of newEntries) {
    const marketCapEok = s.marketCapEok ?? Math.round((s.marketCap || 0) / 100000000);
    const message = `
🆕 <b>[${marketLabel} 시가총액 TOP20 신규 진입]</b>
━━━━━━━━━━━━━━━━━
• <b>종목명:</b> ${s.name} (<code>${s.code}</code>)
• <b>현재 순위:</b> ${s.rank}위
• <b>현재가:</b> ${(s.price || 0).toLocaleString()}원 (${(s.changePct ?? 0) >= 0 ? '+' : ''}${s.changePct ?? 0}%)
• <b>시가총액:</b> ${marketCapEok.toLocaleString()}억원
━━━━━━━━━━━━━━━━━
💡 시총 상위권 진입은 수급 쏠림·지수 반영 비중 확대의 신호일 수 있습니다.
⏰ <i>${nowStr}</i>
`.trim();
    const result = await sendTelegramMessage(message);
    if (result.success) registry.notifiedNew.push(`${marketLabel}_${s.code}`);
  }

  for (const s of outEntries) {
    const message = `
📉 <b>[${marketLabel} 시가총액 TOP20 이탈]</b>
━━━━━━━━━━━━━━━━━
• <b>종목명:</b> ${s.name} (<code>${s.code}</code>)
• <b>이전 순위:</b> ${s.rank}위 → <b>현재 순위:</b> ${s.currentRank}
━━━━━━━━━━━━━━━━━
⏰ <i>${nowStr}</i>
`.trim();
    const result = await sendTelegramMessage(message);
    if (result.success) registry.notifiedOut.push(`${marketLabel}_${s.code}`);
  }
}

export function getMarketCapComparison() {
  const file = RANKING_CACHE_FILE;
  if (fs.existsSync(file)) {
    return loadJson(file);
  }
  return { 
    kospi: { current: [], out: [] }, 
    kosdaq: { current: [], out: [] }, 
    day: '오늘', 
    date: new Date().toISOString() 
  }; 
}

export async function runMarketCapTracking() {
  const kospiRaw = await fetchRanking(0);
  const kosdaqRaw = await fetchRanking(1);

  // 두 시장 모두 0건이면 수집 자체가 실패한 것 — 기존 캐시를 빈 데이터로 덮어쓰지 않고
  // 실패를 그대로 알린다 (예전엔 이 경우에도 항상 "성공" 응답과 함께 빈 랭킹을 저장했다).
  if (kospiRaw.length === 0 && kosdaqRaw.length === 0) {
    console.error('[MARKET CAP] 코스피/코스닥 랭킹 수집 실패(0건) — 기존 캐시 유지, 이번 갱신은 건너뜀');
    return { success: false, error: '시가총액 랭킹 데이터를 가져오지 못했습니다.', ...getMarketCapComparison() };
  }

  const history = loadJson(RANK_HISTORY_FILE, {});
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

  // 가장 최근 이전 거래일 탐색
  const pastDates = Object.keys(history).filter(d => d !== todayKey).sort();
  const prevDateKey = pastDates.length > 0 ? pastDates[pastDates.length - 1] : null;
  const prevData = prevDateKey ? history[prevDateKey] : null;

  const kospiComparison = computeComparison(kospiRaw, prevData?.kospi || []);
  const kosdaqComparison = computeComparison(kosdaqRaw, prevData?.kosdaq || []);

  try {
    const registry = loadNotifyRegistry();
    await notifyMarketCapChanges('코스피', kospiComparison, registry);
    await notifyMarketCapChanges('코스닥', kosdaqComparison, registry);
    saveJson(NOTIFY_REGISTRY_FILE, registry);
  } catch (e) {
    console.error('[MARKET CAP] TOP20 변동 텔레그램 알림 실패:', e.message);
  }

  const result = {
    success: true,
    kospi: kospiComparison,
    kosdaq: kosdaqComparison,
    day: '오늘',
    date: new Date().toISOString(),
    prevDay: prevDateKey || '전일 장마감'
  };

  // 오늘자 기록 저장
  history[todayKey] = {
    kospi: kospiRaw.slice(0, 25),
    kosdaq: kosdaqRaw.slice(0, 25),
    updatedAt: new Date().toISOString()
  };
  saveJson(RANK_HISTORY_FILE, history);
  saveJson(RANKING_CACHE_FILE, result);

  return result;
}

export function startDailyMarketCapTracker() {
  // 초기 실행 및 5분 주기 실시간 추적
  runMarketCapTracking().catch(e => console.warn('Initial market cap tracking failed:', e.message));
  setInterval(() => {
    runMarketCapTracking().catch(e => console.warn('Interval market cap tracking failed:', e.message));
  }, 5 * 60 * 1000);
}
