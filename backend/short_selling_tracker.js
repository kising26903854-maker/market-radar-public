// short_selling_tracker.js — 📉 한국거래소(KRX) 공식 개별종목 공매도(Short Selling) 거래량·거래대금·비중(%) 추이 트래커

// 5분 캐시 저장소
const shortSellingCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

/**
 * 6자리 종목코드를 ISO 6166 표준 한국 ISIN 코드로 변환 (Luhn mod 10 알고리즘)
 * 예: 005930 -> KR7005930003, 000660 -> KR7000660001
 */
export function calculateIsin(ticker, issueType = '00') {
  const cleanTicker = String(ticker).trim();
  const isinPrefix = 'KR7' + cleanTicker + issueType;
  let numStr = '';
  for (const ch of isinPrefix) {
    if (ch >= '0' && ch <= '9') {
      numStr += ch;
    } else {
      numStr += (ch.charCodeAt(0) - 55).toString(); // K=20, R=27
    }
  }

  let sum = 0;
  let multiplyByTwo = true;
  for (let i = numStr.length - 1; i >= 0; i--) {
    let digit = parseInt(numStr[i], 10);
    if (multiplyByTwo) {
      digit *= 2;
      if (digit >= 10) digit = Math.floor(digit / 10) + (digit % 10);
    }
    sum += digit;
    multiplyByTwo = !multiplyByTwo;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return isinPrefix + checkDigit;
}

/**
 * 기간(period)에 따른 YYYYMMDD 시작일 및 종료일 계산
 */
function getDateRange(period = '3m') {
  const now = new Date();
  const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  
  const endYear = kstNow.getUTCFullYear();
  const endMonth = String(kstNow.getUTCMonth() + 1).padStart(2, '0');
  const endDay = String(kstNow.getUTCDate()).padStart(2, '0');
  const endDd = `${endYear}${endMonth}${endDay}`;

  const daysBack = period === '1m' ? 35 : period === '6m' ? 185 : period === '1y' ? 365 : 95;
  const startDate = new Date(kstNow.getTime() - (daysBack * 24 * 60 * 60 * 1000));
  const startYear = startDate.getUTCFullYear();
  const startMonth = String(startDate.getUTCMonth() + 1).padStart(2, '0');
  const startDay = String(startDate.getUTCDate()).padStart(2, '0');
  const strtDd = `${startYear}${startMonth}${startDay}`;

  return { strtDd, endDd };
}

/**
 * 네이버 일별 주가 다중 페이지 수집 헬퍼 (네이버 API는 pageSize 최대 60 지원)
 */
async function fetchNaverPrices(ticker, targetPages = 2) {
  const allPrices = [];
  const headers = { 'User-Agent': 'Mozilla/5.0' };

  for (let p = 1; p <= targetPages; p++) {
    try {
      const url = `https://m.stock.naver.com/api/stock/${ticker}/price?page=${p}&pageSize=60`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          allPrices.push(...list);
        }
      }
    } catch (e) {
      console.warn(`[Naver Price] page ${p} error for ${ticker}:`, e.message);
    }
  }

  return allPrices;
}

/**
 * 개별 종목 공매도 일별 추이 및 주가 결합 데이터 수집
 */
export async function getStockShortSelling(ticker, period = '3m') {
  if (!ticker) {
    return { success: false, error: '종목코드가 필요합니다.' };
  }

  const cleanCode = String(ticker).trim();
  const cacheKey = `${cleanCode}_${period}`;
  const cached = shortSellingCache.get(cacheKey);
  const now = Date.now();

  if (cached && (now - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  try {
    const isin = calculateIsin(cleanCode);
    const { strtDd, endDd } = getDateRange(period);

    // 1. 한국거래소(KRX) 공식 공매도 종합 현황 API 호출
    const krxUrl = 'https://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd';
    const krxParams = new URLSearchParams({
      bld: 'dbms/MDC_OUT/STAT/srt/MDCSTAT30001_OUT',
      isuCd: isin,
      strtDd,
      endDd,
      share: '1',
      money: '1',
      csvxls_isNo: 'false'
    });

    let krxError = null;
    const krxPromise = fetch(krxUrl, {
      method: 'POST',
      body: krxParams,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': `https://data.krx.co.kr/comm/srt/srtLoader/index.cmd?screenId=MDCSTAT300&isuCd=${cleanCode}`,
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      }
    }).then(async r => {
      const text = await r.text();
      if (text.includes('<!DOCTYPE') || text.includes('시스템 점검') || text.includes('<html>')) {
        krxError = '한국거래소(KRX) 서버 점검 중';
        return { OutBlock_1: [] };
      }
      try {
        return JSON.parse(text);
      } catch (e) {
        krxError = '한국거래소(KRX) 데이터 파싱 실패';
        return { OutBlock_1: [] };
      }
    }).catch(err => {
      console.warn(`[KRX Short Selling] Error for ${cleanCode}:`, err.message);
      krxError = '한국거래소(KRX) 통신 실패';
      return { OutBlock_1: [] };
    });

    // 2. 네이버 주가 일별 시세 다중 페이지 병렬 호출
    const targetPages = period === '1m' ? 1 : period === '6m' ? 4 : 2;
    const naverPromise = fetchNaverPrices(cleanCode, targetPages);

    const [krxRes, naverPrices] = await Promise.all([krxPromise, naverPromise]);
    
    if (krxError) {
      const errorResult = {
        success: false,
        error: krxError,
        ticker: cleanCode
      };
      shortSellingCache.set(cacheKey, { timestamp: now - 4 * 60 * 1000, data: errorResult });
      return errorResult;
    }

    const rawKrxList = Array.isArray(krxRes?.OutBlock_1) ? krxRes.OutBlock_1 : [];

    // 네이버 주가 매핑 테이블
    const priceMap = new Map();
    let fallbackClose = 0;

    if (Array.isArray(naverPrices)) {
      naverPrices.forEach(p => {
        if (p.localTradedAt) {
          const dateKey = p.localTradedAt.replace(/-/g, '/');
          const cPrice = parseFloat(String(p.closePrice || 0).replace(/,/g, ''));
          if (cPrice > 0 && fallbackClose === 0) fallbackClose = cPrice;
          priceMap.set(dateKey, {
            close: cPrice,
            volume: Number(p.accumulatedTradingVolume) || 0,
            changePct: parseFloat(p.fluctuationsRatio) || 0
          });
        }
      });
    }

    // 3. 거래소 공매도 데이터와 주가 데이터 병합 (과거부터 시간순 정렬)
    let lastValidClose = fallbackClose;
    const mergedList = rawKrxList.map(row => {
      const d = row.TRD_DD; // 'YYYY/MM/DD'
      const pInfo = priceMap.get(d) || {};
      const shortVol = parseFloat((row.CVSRTSELL_TRDVOL || '0').replace(/,/g, ''));
      const shortVal = parseFloat((row.CVSRTSELL_TRDVAL || '0').replace(/,/g, ''));
      const uptickVol = parseFloat((row.UPTICKRULE_APPL_TRDVOL || '0').replace(/,/g, ''));
      const uptickExceptVol = parseFloat((row.UPTICKRULE_EXCPT_TRDVOL || '0').replace(/,/g, ''));
      
      const rawTotalVol = pInfo.volume || (row.STR_CONST_VAL1 && row.STR_CONST_VAL1 !== '-' ? parseFloat(row.STR_CONST_VAL1.replace(/,/g, '')) : 0);
      const totalVol = Math.max(rawTotalVol, shortVol);
      
      let shortRatio = totalVol > 0 ? parseFloat(((shortVol / totalVol) * 100).toFixed(2)) : 0;
      if (shortRatio > 60.0) shortRatio = 60.0;

      if (pInfo.close > 0) lastValidClose = pInfo.close;

      return {
        date: d.replace(/\//g, '-'), // 'YYYY-MM-DD'
        shortVolume: shortVol,
        shortValue: shortVal,
        uptickVol,
        uptickExceptVol,
        totalVolume: totalVol,
        closePrice: pInfo.close || lastValidClose,
        priceChangePct: pInfo.changePct || 0,
        shortRatio
      };
    })
    .filter(item => {
      // ⚠️ 당일(오늘) KRX 공매도 미집계 데이터 제거: 공매도량=0이고 날짜가 오늘인 경우 차트에서 제외
      // KRX 공매도 데이터는 장 마감 후 수 시간 뒤 집계되므로 장중에는 0으로 반환됨
      // → 이 데이터를 포함하면 차트 우측 끝이 0%로 뚝 떨어지는 시각적 오해 유발
      if (item.shortVolume === 0) {
        const todayKst = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
        if (item.date === todayKst) return false; // 오늘 미집계 0 데이터 제거
      }
      return item.shortVolume > 0 || item.totalVolume > 0;
    })
    .reverse(); // 오래된 순으로 정렬

    // 4. 공매도 퀀트 분석 지표 산출
    let totalShortVolume = 0;
    let totalShortValue = 0;
    let totalUptickVol = 0;
    let maxRatio = 0;
    let maxRatioDay = null;

    mergedList.forEach(item => {
      totalShortVolume += item.shortVolume;
      totalShortValue += item.shortValue;
      totalUptickVol += item.uptickVol;
      if (item.shortRatio > maxRatio) {
        maxRatio = item.shortRatio;
        maxRatioDay = item.date;
      }
    });

    // 5. 공매도 거래가 있었던 날 기준 최근 5거래일 & 직전 5거래일 추세 분석
    const validShortDays = mergedList.filter(item => item.shortVolume > 0);
    const recent5 = validShortDays.slice(-5);
    const prior5 = validShortDays.slice(-10, -5);

    const avgRecentShortRatio = recent5.length > 0
      ? parseFloat((recent5.reduce((acc, cur) => acc + cur.shortRatio, 0) / recent5.length).toFixed(2))
      : 0;

    const avgPriorShortRatio = prior5.length > 0
      ? parseFloat((prior5.reduce((acc, cur) => acc + cur.shortRatio, 0) / prior5.length).toFixed(2))
      : avgRecentShortRatio;

    const latest = validShortDays[validShortDays.length - 1] || mergedList[mergedList.length - 1] || null;
    const latestRatio = latest?.shortRatio || 0;
    const peakRecentRatio = recent5.length > 0 ? Math.max(...recent5.map(r => r.shortRatio)) : latestRatio;

    // ⚡ 6. 실시간 공매도 추세(Trend) 판정 (축소 vs 확대 vs 횡보)
    const isConsecutiveDrop = recent5.length >= 3 &&
      recent5[recent5.length - 1].shortRatio < recent5[recent5.length - 2].shortRatio &&
      recent5[recent5.length - 2].shortRatio <= recent5[recent5.length - 3].shortRatio;

    const isRatioShrinking = isConsecutiveDrop || 
      (latestRatio < peakRecentRatio * 0.6 && latestRatio <= 5.0) || 
      (avgRecentShortRatio < avgPriorShortRatio * 0.75 && latestRatio <= 5.0) ||
      (latestRatio <= 3.0);

    const isRatioExpanding = (latestRatio > avgRecentShortRatio * 1.3 && latestRatio >= 10.0) ||
      (avgRecentShortRatio >= 14.0 && latestRatio >= 12.0);

    let trendType = 'STABLE';
    let trendLabel = '➡️ 공매도 횡보 (통상 유지)';
    let trendColor = '#94a3b8';

    if (isRatioShrinking) {
      trendType = 'DECREASING';
      trendLabel = '📉 공매도 급격 축소 (하방압력 완화 / 숏커버링 진행)';
      trendColor = '#10b981';
    } else if (isRatioExpanding) {
      trendType = 'INCREASING';
      trendLabel = '📈 공매도 급증 추세 (하방 매도압력 확대)';
      trendColor = '#ef4444';
    }

    // ⚡ 7. 스마트 퀀트 진단 배지 및 설명문 (과거 스파이크가 아닌 "현재 진행형 추세" 완벽 반영!)
    let overheatStatus = 'NORMAL';
    let overheatLabel = '🟢 안정 (통상 수준)';
    let overheatDesc = `최근 5일 평균 공매도 비중이 ${avgRecentShortRatio}%로 정상적인 유동성 공급 범위 내에 있습니다.`;

    if (trendType === 'DECREASING') {
      if (latestRatio <= 3.0) {
        overheatStatus = 'SHRINKING';
        overheatLabel = '🟢 공매도 급감 / 숏커버링 유입';
        overheatDesc = `최근 공매도 비중이 고점(${peakRecentRatio}%)에서 최신 ${latestRatio}%까지 연속으로 가파르게 축소되며 하방 압력이 대폭 소멸되었습니다. 숏커버링(환매수) 유입에 따른 반등 탄력을 주시하세요.`;
      } else {
        overheatStatus = 'STABILIZING';
        overheatLabel = '🟢 공매도 하향 안정세';
        overheatDesc = `최근 공매도 비중이 ${latestRatio}%로 뚜렷하게 하향 안정화 추세에 진입하여 하방 매도 압력이 점진적으로 완화되고 있습니다.`;
      }
    } else if (trendType === 'INCREASING' || avgRecentShortRatio >= 14 || latestRatio >= 14) {
      overheatStatus = 'OVERHEAT';
      overheatLabel = '🔴 공매도 과열 경보 (Short Overheat)';
      overheatDesc = `최근 공매도 비중이 ${avgRecentShortRatio}%(최신 ${latestRatio}%)로 급증하여 하방 매도 압력이 집중되고 있습니다. 숏스퀴즈 반등 또는 지지선 확인이 필요합니다.`;
    } else if (avgRecentShortRatio >= 8 || latestRatio >= 8) {
      overheatStatus = 'CAUTION';
      overheatLabel = '🟡 공매도 주의 구간 (Caution)';
      overheatDesc = `공매도 비중(${avgRecentShortRatio}%)이 다소 높은 수준입니다. 주요 지지선 방어 및 수급 변화를 주시하세요.`;
    }

    const resultData = {
      success: true,
      ticker: cleanCode,
      isin,
      period,
      timestamp: new Date().toISOString(),
      summary: {
        latestDate: latest?.date || '-',
        latestShortVolume: latest?.shortVolume || 0,
        latestShortValue: latest?.shortValue || 0,
        latestShortRatio: latestRatio,
        avgRecentShortRatio,
        trendType,
        trendLabel,
        trendColor,
        isDecreasing: trendType === 'DECREASING',
        overheatStatus,
        overheatLabel,
        overheatDesc,
        totalShortVolume,
        totalShortValue,
        totalShortValueIn100M: Math.round(totalShortValue / 100000000), // 억원 단위
        maxRatio,
        maxRatioDay,
        uptickApplyRatio: totalShortVolume > 0 ? parseFloat(((totalUptickVol / totalShortVolume) * 100).toFixed(1)) : 0
      },
      timeline: mergedList
    };

    shortSellingCache.set(cacheKey, { timestamp: now, data: resultData });
    return resultData;
  } catch (err) {
    console.error(`[Stock Short Selling Error] for ${cleanCode}:`, err.message);
    return {
      success: false,
      error: err.message,
      ticker: cleanCode
    };
  }
}
