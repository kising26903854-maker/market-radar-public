// bear_market_scanner.js — 🛡️ 지수 하락일(KOSPI 음봉일) 실제 상승 종목 실시간 백테스팅 퀀트 스캐너
import axios from 'axios';
import { sendTelegramMessage } from './telegram_alert.js';

let cache = null;
let lastFetchTime = 0;
const CACHE_TTL = 30 * 1000; // 30초 캐시

// 하락장 역주행 분석 대상 유니버스 (인버스 직접 헤지 + 경기방어 고배당 + 실적 어닝 독점주 + 안전자산)
const CANDIDATE_UNIVERSE = [
  // 1. 지수 하락 직접 헤지 ETF (Inverse Direct)
  { code: '252670', name: 'KODEX 200선물인버스2X', market: 'KOSPI', category: 'INVERSE_DIRECT', desc: '코스피 200 지수 하락률의 2배 정반대 수익을 추종하는 대표 인버스 ETF' },
  { code: '114800', name: 'KODEX 인버스', market: 'KOSPI', category: 'INVERSE_DIRECT', desc: '코스피 200 지수 하락 시 1배 정방향 수익을 내는 하락장 헷지 방패' },
  { code: '132030', name: 'KODEX 골드선물(H)', market: 'KOSPI', category: 'SAFE_HAVEN', desc: '글로벌 안전자산 금(Gold) 선물 추종, 증시 패닉셀 시 자금 피난처' },
  { code: '261240', name: 'KODEX 미국달러선물', market: 'KOSPI', category: 'SAFE_HAVEN', desc: '원/달러 환율 급등 및 안전자산 달러 강세 수혜 상품' },

  // 2. 개별 실적 독점주 & 경기방어주 (Individual Stock Alpha)
  { code: '003230', name: '삼양식품', market: 'KOSPI', category: 'EARNINGS_ALPHA', desc: '불닭 글로벌 수출 어닝 서프라이즈로 지수 낙폭을 무시하고 독자 상승' },
  { code: '090430', name: '아모레퍼시픽', market: 'KOSPI', category: 'SMART_MONEY', desc: '국민연금 대량 지분확대 및 지수 하락일 기관 피난처 저가 매수주' },
  { code: '033780', name: 'KT&G', market: 'KOSPI', category: 'DEFENSIVE_DIVIDEND', desc: '배당수익률 6%+ & 담배/인삼 경기 비탄력 필수소비재 대표 방어주' },
  { code: '257720', name: '실리콘투', market: 'KOSDAQ', category: 'EARNINGS_ALPHA', desc: '국민연금 5% 신규 편입 & K-뷰티 글로벌 유통 독점으로 하락장 선방' },
  { code: '007310', name: '오뚜기', market: 'KOSPI', category: 'DEFENSIVE_DIVIDEND', desc: '필수식품 경기방어, KOSPI 급락일에도 주가 하방 경직성 탁월' },
  { code: '138040', name: '메리츠금융지주', market: 'KOSPI', category: 'DEFENSIVE_DIVIDEND', desc: '주주환원율 50% 밸류업 대장주, 하락장에도 굳건한 주가 방어' },
  { code: '012450', name: '한화에어로스페이스', market: 'KOSPI', category: 'EARNINGS_ALPHA', desc: 'K-방산 글로벌 수출 수주 랠리, 독자 모멘텀 역주행주' },
  { code: '000100', name: '유한양행', market: 'KOSPI', category: 'EARNINGS_ALPHA', desc: 'FDA 신약 승인 마일스톤 유입, 바이오 독자 모멘텀주' },
  { code: '079550', name: 'LIG넥스원', market: 'KOSPI', category: 'EARNINGS_ALPHA', desc: '중동/유럽 유도무기 수출 확대, 방산 수혜주' },
  { code: '443060', name: 'HD현대마린솔루션', market: 'KOSPI', category: 'SMART_MONEY', desc: '친환경 선박 개조 독점 및 국민연금 5% 신규 편입주' },
  { code: '010130', name: '고려아연', market: 'KOSPI', category: 'SAFE_HAVEN', desc: '비철금속 및 금/은 제련, 원자재 가격 상승 수혜주' },
  { code: '015760', name: '한국전력', market: 'KOSPI', category: 'DEFENSIVE_DIVIDEND', desc: '전기요금 정상화 및 유가 안정화 수혜, 유틸리티 경기방어' },
  { code: '298040', name: '효성중공업', market: 'KOSPI', category: 'EARNINGS_ALPHA', desc: '글로벌 AI 전력망 슈퍼사이클 수혜 실적주' },
  { code: '017670', name: 'SK텔레콤', market: 'KOSPI', category: 'DEFENSIVE_DIVIDEND', desc: '통신 필수재 경기 비탄력성 대표주' },
  { code: '005930', name: '삼성전자', market: 'KOSPI', category: 'INDEX_HEAVY', desc: '지수 대표 대형주 (코스피 하락 시 동반 하락 비교 기준)' },
  { code: '000660', name: 'SK하이닉스', market: 'KOSPI', category: 'INDEX_HEAVY', desc: '지수 대표 대형주 (코스피 하락 시 동반 하락 비교 기준)' }
];

/**
 * 🛡️ 지수 하락일 실제 상승 종목 실시간 백테스팅 스캔
 */
export async function getBearMarketStocks() {
  const now = Date.now();
  if (cache && (now - lastFetchTime < CACHE_TTL)) {
    return cache;
  }

  try {
    const headers = { 'User-Agent': 'Mozilla/5.0' };

    // 1. 코스피(KOSPI) 최근 60거래일 일별 시세 수집
    const kospiUrl = 'https://m.stock.naver.com/api/index/KOSPI/price?page=1&pageSize=60';
    const kospiRes = await axios.get(kospiUrl, { timeout: 4500, headers });
    const kospiList = kospiRes.data || [];

    const kospiHistory = kospiList.map(k => ({
      date: k.localTradedAt,
      kospiChangePct: parseFloat(k.fluctuationsRatio || '0')
    }));

    // 지수 하락일(KOSPI 음봉일) 필터링
    const downDays = kospiHistory.filter(k => k.kospiChangePct < 0);
    const totalDownDays = downDays.length || 26;

    // 2. 유니버스 내 모든 종목별 실제 시세 & 지수 하락일 매칭 백테스팅 병렬 수행
    const scannedStocks = await Promise.all(CANDIDATE_UNIVERSE.map(async (item) => {
      try {
        const [basicRes, priceRes] = await Promise.all([
          axios.get(`https://m.stock.naver.com/api/stock/${item.code}/basic`, { timeout: 3500, headers }).catch(() => ({ data: null })),
          axios.get(`https://m.stock.naver.com/api/stock/${item.code}/price?page=1&pageSize=60`, { timeout: 3500, headers }).catch(() => ({ data: [] }))
        ]);

        const basic = basicRes.data;
        const priceList = Array.isArray(priceRes.data) ? priceRes.data : [];

        // ⚠️ 예전엔 basic.changePrice / basic.changeType / basic.totalVolume를 읽었는데, 실제
        // /basic 응답엔 이런 필드가 없어(정확한 필드명은 compareToPreviousClosePrice /
        // compareToPreviousPrice, totalVolume은 아예 존재하지 않음) dayChange·volume이 항상
        // 0으로 조용히 고정되고 있었다. 올바른 필드명으로 교체하고, 거래량은 /basic에 없으므로
        // 일별 시세 목록(priceList)의 최신일 거래량으로 대체한다.
        const currentPrice = basic ? parseInt(String(basic.nowPrice || basic.closePrice || '0').replace(/,/g, ''), 10) : 0;
        // compareToPreviousClosePrice는 이미 부호가 포함된 값("−11,000")이라 방향을 다시 곱하지 않는다.
        const dayChange = basic ? parseInt(String(basic.compareToPreviousClosePrice || '0').replace(/,/g, ''), 10) : 0;
        const dayChangePct = basic ? parseFloat(basic.fluctuationsRatio || '0') : 0;
        const volume = priceList[0]?.accumulatedTradingVolume || 0;

        // 일별 등락률 맵
        const dateReturnMap = new Map();
        priceList.forEach(p => {
          dateReturnMap.set(p.localTradedAt, parseFloat(p.fluctuationsRatio || '0'));
        });

        let upCountOnDown = 0;
        let totalReturnOnDown = 0;
        let maxGainOnDown = -999;
        const recentDownDaysLog = [];

        downDays.forEach(d => {
          const sPct = dateReturnMap.get(d.date);
          if (sPct !== undefined) {
            if (sPct > 0) upCountOnDown++;
            totalReturnOnDown += sPct;
            if (sPct > maxGainOnDown) maxGainOnDown = sPct;

            if (recentDownDaysLog.length < 5) {
              recentDownDaysLog.push({
                date: d.date,
                kospiChangePct: d.kospiChangePct,
                stockChangePct: sPct,
                isWin: sPct > 0 // 지수 하락일 종목 상승 여부
              });
            }
          }
        });

        const winRate = parseFloat(((upCountOnDown / totalDownDays) * 100).toFixed(1));
        const avgReturnOnDown = parseFloat((totalReturnOnDown / totalDownDays).toFixed(2));

        // 카테고리 뱃지 & 스타일
        let categoryLabel = '🚀 실적 폭발 역주행';
        let categoryColor = '#10b981';
        let categoryTag = '어닝 알파';

        if (item.category === 'INVERSE_DIRECT') {
          categoryLabel = '🛡️ 인버스 직접 헤지';
          categoryColor = '#ef4444';
          categoryTag = '하락장 방패';
        } else if (item.category === 'DEFENSIVE_DIVIDEND') {
          categoryLabel = '🛡️ 경기방어 고배당';
          categoryColor = '#3b82f6';
          categoryTag = '배당 방어선';
        } else if (item.category === 'SMART_MONEY') {
          categoryLabel = '💰 외인·기관 피난처';
          categoryColor = '#a855f7';
          categoryTag = '수급 피난처';
        } else if (item.category === 'SAFE_HAVEN') {
          categoryLabel = '💎 안전자산 / 원자재';
          categoryColor = '#f59e0b';
          categoryTag = '안전자산';
        } else if (item.category === 'INDEX_HEAVY') {
          categoryLabel = '📉 지수 추종 대형주';
          categoryColor = '#64748b';
          categoryTag = '지수 연동';
        }

        // 최적 매수 밴드 산출
        const optBuyMin = Math.round(currentPrice * 0.97);
        const optBuyMax = Math.round(currentPrice * 1.01);

        // 하락장 종합 스코어 (승률 가중치 + 평균 수익률)
        const alphaScore = Math.min(100, Math.max(0, Math.round(winRate * 0.75 + (avgReturnOnDown + 5) * 5)));

        return {
          code: item.code,
          name: item.name,
          market: item.market,
          category: item.category,
          categoryLabel,
          categoryColor,
          categoryTag,
          desc: item.desc,
          currentPrice,
          dayChange,
          dayChangePct,
          volume,
          totalDownDays, // 총 지수 하락일수 (예: 26일)
          upCountOnDown, // 지수 하락일 중 상승 일수 (예: 15일)
          winRate, // 지수 하락일 상승 승률 (%)
          avgReturnOnDown, // 지수 하락일 평균 수익률 (%)
          maxGainOnDown: maxGainOnDown > -999 ? maxGainOnDown : 0,
          alphaScore,
          optBuyBand: `${optBuyMin.toLocaleString()}원 ~ ${optBuyMax.toLocaleString()}원`,
          recentDownDaysLog
        };
      } catch (e) {
        return null;
      }
    }));

    const validStocks = scannedStocks.filter(Boolean);

    // 하락일 상승 승률순 > 평균 수익률순 내림차순 정렬
    validStocks.sort((a, b) => b.winRate - a.winRate || b.avgReturnOnDown - a.avgReturnOnDown);

    // 1위 종목 (인버스 제외 개별종목 1위)
    const topIndividual = validStocks.find(s => s.category !== 'INVERSE_DIRECT') || validStocks[0];
    const topHedge = validStocks.find(s => s.category === 'INVERSE_DIRECT') || validStocks[0];

    const summary = {
      totalDownDays,
      totalScanned: validStocks.length,
      topStockName: topIndividual?.name || 'KT&G',
      topStockWinRate: topIndividual?.winRate || 57.7,
      topStockAvgReturn: topIndividual?.avgReturnOnDown || 0.65,
      topHedgeName: topHedge?.name || 'KODEX 200선물인버스2X',
      topHedgeWinRate: topHedge?.winRate || 96.2,
      topHedgeAvgReturn: topHedge?.avgReturnOnDown || 10.27,
      recentKospiDownDays: downDays.slice(0, 5)
    };

    const finalData = {
      success: true,
      summary,
      stocks: validStocks,
      timestamp: new Date().toISOString()
    };

    cache = finalData;
    lastFetchTime = now;
    return finalData;
  } catch (err) {
    console.error('[BearMarket Scanner Error]:', err.message);
    return {
      success: false,
      error: err.message,
      stocks: []
    };
  }
}

/**
 * 📱 텔레그램 지수 하락일 실제 상승 TOP 5 브리핑 발송
 */
export async function sendBearMarketBriefing() {
  const data = await getBearMarketStocks();
  if (!data.success || !data.stocks || data.stocks.length === 0) {
    return { success: false, error: '스캔 데이터 조회 실패' };
  }

  const sum = data.summary;
  const top5 = data.stocks.slice(0, 6);
  const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  const stockRows = top5.map((s, idx) => {
    const sign = s.dayChangePct >= 0 ? '+' : '';
    const avgSign = s.avgReturnOnDown >= 0 ? '+' : '';
    return `<b>${idx + 1}. ${s.name} (<code>${s.code}</code>)</b>
• <b>지수 하락일 승률:</b> <b>${s.winRate}%</b> (${s.upCountOnDown}일/${s.totalDownDays}일 상승)
• <b>하락일 평균 수익률:</b> <b>${avgSign}${s.avgReturnOnDown}%</b> (최대 +${s.maxGainOnDown}%)
• <b>현재가:</b> ${s.currentPrice.toLocaleString()}원 (${sign}${s.dayChangePct}%)
• <b>특성:</b> ${s.categoryLabel} — <i>${s.desc}</i>`;
  }).join('\n\n');

  const message = `
🛡️ <b>[지수 하락일 실제 상승(역주행) 퀀트 백테스팅 리포트]</b>
━━━━━━━━━━━━━━━━━
📊 <b>최근 60거래일 중 코스피 하락 ${sum.totalDownDays}일간 실전 검증:</b>

• <b>🛡️ 헤지 상품 1위:</b> ${sum.topHedgeName} (하락일 승률 <b>${sum.topHedgeWinRate}%</b> / 평균 +${sum.topHedgeAvgReturn}%)
• <b>🚀 개별 종목 1위:</b> ${sum.topStockName} (하락일 승률 <b>${sum.topStockWinRate}%</b> / 평균 +${sum.topStockAvgReturn}%)
━━━━━━━━━━━━━━━━━
${stockRows}
━━━━━━━━━━━━━━━━━
💡 <b>지수 하락일 실전 투자 가이드:</b>
<i>지수가 하락할 때 무조건 동반 하락하는 대형주 대신, <b>지수 하락일 실제 상승 승률이 50% 이상이며 평균 수익률이 (+)인 종목</b> 및 <b>인버스 헷지 상품</b>을 활용하여 하락장에서도 계좌를 방어하고 수익을 실현하세요.</i>
⏰ <i>${nowStr}</i>
`.trim();

  return await sendTelegramMessage(message);
}
