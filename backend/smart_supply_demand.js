// smart_supply_demand.js — 🔥 외국인 & 기관 실시간 순매수 TOP 20 및 쌍끌이 수급 레이더
import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

let cache = null;
let lastFetchTime = 0;
const CACHE_TTL = 30 * 1000; // 30초 캐시

/**
 * 네이버 금융 실시간 투자자별 순매수 상위 종목 수집
 * @param {string} sosok '01' (코스피) | '02' (코스닥)
 * @param {string} investorGubun '9000' (외국인) | '1000' (기관계)
 */
async function fetchDealRank(sosok = '01', investorGubun = '9000') {
  try {
    const url = `https://finance.naver.com/sise/sise_deal_rank_iframe.naver?sosok=${sosok}&investor_gubun=${investorGubun}&type=buy`;
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const html = iconv.decode(res.data, 'EUC-KR');
    const $ = cheerio.load(html);

    const items = [];
    $('a[href*="code="]').each((i, el) => {
      const name = $(el).text().trim();
      const href = $(el).attr('href') || '';
      const codeMatch = href.match(/code=([0-9A-Za-z]+)/);
      const code = codeMatch ? codeMatch[1] : '';

      const row = $(el).closest('tr');
      const tds = row.find('td');
      if (code && name && tds.length >= 3 && items.length < 20) {
        if (!items.some(x => x.code === code)) {
          const amtText = tds.eq(2).text().trim().replace(/,/g, '');
          const amountMillion = parseInt(amtText, 10) || 0; // 백만원 단위
          const amountBillion = parseFloat((amountMillion / 100).toFixed(1)); // 억원 단위

          items.push({
            rank: items.length + 1,
            code,
            name,
            amountBillion,
            amountText: `${amountBillion.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}억원`
          });
        }
      }
    });

    return items;
  } catch (err) {
    console.warn(`[Supply/Demand] fetchDealRank error (${sosok}, ${investorGubun}):`, err.message);
    return [];
  }
}

/**
 * 네이버 실시간 주가 폴링 API를 통한 100% 정밀 현재가 & 등락률 일괄 조회
 * @param {string[]} codes 종목코드 배열
 */
async function fetchRealtimePrices(codes = []) {
  const priceMap = new Map();
  if (!codes.length) return priceMap;

  try {
    const chunkSize = 50;
    for (let i = 0; i < codes.length; i += chunkSize) {
      const chunk = codes.slice(i, i + chunkSize);
      const pollUrl = `https://polling.finance.naver.com/api/realtime/domestic/stock/${chunk.join(',')}`;
      const res = await axios.get(pollUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 5000
      });

      const datas = res.data?.datas || [];
      datas.forEach(d => {
        const itemCode = d.itemCode || d.symbolCode;
        const price = parseInt(d.closePriceRaw, 10) || parseInt((d.closePrice || '').replace(/,/g, ''), 10) || 0;
        const fluc = parseFloat(d.fluctuationsRatio) || 0;
        const sign = fluc > 0 ? '+' : '';
        const change = `${sign}${fluc.toFixed(2)}%`;
        priceMap.set(itemCode, { price, change });
      });
    }
  } catch (err) {
    console.warn('[Supply/Demand] fetchRealtimePrices error:', err.message);
  }

  return priceMap;
}

/**
 * 전 시장 외인/기관 순매수 및 쌍끌이 종목 추출
 */
export async function getSmartSupplyDemand() {
  const now = Date.now();
  if (cache && (now - lastFetchTime < CACHE_TTL)) {
    return { success: true, ...cache };
  }

  try {
    const [kospiForeign, kospiInst, kosdaqForeign, kosdaqInst] = await Promise.all([
      fetchDealRank('01', '9000'), // 코스피 외인
      fetchDealRank('01', '1000'), // 코스피 기관
      fetchDealRank('02', '9000'), // 코스닥 외인
      fetchDealRank('02', '1000')  // 코스닥 기관
    ]);

    // 전체 종목 코드 수집 및 실시간 정밀 현재가 일괄 연동
    const allCodes = [...new Set([
      ...kospiForeign.map(x => x.code),
      ...kospiInst.map(x => x.code),
      ...kosdaqForeign.map(x => x.code),
      ...kosdaqInst.map(x => x.code)
    ])];

    const priceMap = await fetchRealtimePrices(allCodes);

    // 각 항목에 실시간 현재가와 등락률 매핑
    const attachPrice = (item) => {
      const pInfo = priceMap.get(item.code) || { price: 0, change: '0.0%' };
      return {
        ...item,
        price: pInfo.price,
        change: pInfo.change
      };
    };

    const finalKospiForeign = kospiForeign.map(attachPrice);
    const finalKospiInst = kospiInst.map(attachPrice);
    const finalKosdaqForeign = kosdaqForeign.map(attachPrice);
    const finalKosdaqInst = kosdaqInst.map(attachPrice);

    // 🔥 코스피 쌍끌이 매칭 (외인 + 기관 동시 상위 순매수)
    const kospiDual = [];
    finalKospiForeign.forEach(f => {
      const instMatch = finalKospiInst.find(i => i.code === f.code);
      if (instMatch) {
        const totalBillion = parseFloat((f.amountBillion + instMatch.amountBillion).toFixed(1));
        kospiDual.push({
          code: f.code,
          name: f.name,
          price: f.price,
          change: f.change,
          foreignAmount: f.amountText,
          instAmount: instMatch.amountText,
          totalAmountBillion: totalBillion,
          totalAmountText: `${totalBillion.toLocaleString()}억원`,
          foreignRank: f.rank,
          instRank: instMatch.rank,
          tag: '🔥 외인·기관 쌍끌이 풀매수'
        });
      }
    });
    kospiDual.sort((a, b) => b.totalAmountBillion - a.totalAmountBillion);

    // 🔥 코스닥 쌍끌이 매칭
    const kosdaqDual = [];
    finalKosdaqForeign.forEach(f => {
      const instMatch = finalKosdaqInst.find(i => i.code === f.code);
      if (instMatch) {
        const totalBillion = parseFloat((f.amountBillion + instMatch.amountBillion).toFixed(1));
        kosdaqDual.push({
          code: f.code,
          name: f.name,
          price: f.price,
          change: f.change,
          foreignAmount: f.amountText,
          instAmount: instMatch.amountText,
          totalAmountBillion: totalBillion,
          totalAmountText: `${totalBillion.toLocaleString()}억원`,
          foreignRank: f.rank,
          instRank: instMatch.rank,
          tag: '🔥 외인·기관 쌍끌이 풀매수'
        });
      }
    });
    kosdaqDual.sort((a, b) => b.totalAmountBillion - a.totalAmountBillion);

    const resultData = {
      timestamp: new Date().toISOString(),
      kospi: {
        dual: kospiDual,
        foreign: finalKospiForeign,
        inst: finalKospiInst
      },
      kosdaq: {
        dual: kosdaqDual,
        foreign: finalKosdaqForeign,
        inst: finalKosdaqInst
      }
    };

    cache = resultData;
    lastFetchTime = now;
    return { success: true, ...resultData };
  } catch (err) {
    console.error('[Smart Supply Demand] Error:', err);
    return { success: false, error: err.message };
  }
}
