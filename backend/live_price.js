// live_price.js — 종목 실시간 현재가 (차트 전체화면의 현재가 수평선용)
// 네이버 realtime API 한 번으로 정규장(nv)과 NXT(넥스트레이드) 프리·애프터 가격(nxtOverMarketPriceInfo)을 같이 받는다.
// 09:00 이전과 15:30 이후엔 NXT 가격이 최신이므로 그걸 현재가로 쓰고, 그 외엔 정규장 가격을 쓴다.
const CACHE_TTL_MS = 2000;
const cache = new Map(); // code -> { at, data }

const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};

function kstMinutes(date = new Date()) {
  const k = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return k.getUTCHours() * 60 + k.getUTCMinutes();
}

export async function getLivePrice(code) {
  const hit = cache.get(code);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const res = await fetch(`https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${code}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://m.stock.naver.com/' },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`realtime HTTP ${res.status}`);
  const json = await res.json();
  const d = json?.result?.areas?.[0]?.datas?.[0];
  if (!d) throw new Error('realtime 응답에 종목 데이터 없음');

  const krxPrice = num(d.nv);
  const nxt = d.nxtOverMarketPriceInfo || null;
  const nxtPrice = nxt ? num(nxt.overPrice) : 0;
  const mins = kstMinutes();
  const outsideRegular = mins < 9 * 60 || mins >= 15 * 60 + 30;
  const useNxt = outsideRegular && nxtPrice > 0;

  const data = {
    code,
    price: useNxt ? nxtPrice : krxPrice,
    source: useNxt ? 'NXT' : 'KRX',
    session: useNxt ? (nxt.tradingSessionType || null) : null,
    krxPrice,
    nxtPrice: nxtPrice || null,
    prevClose: num(d.pcv) || null,
    marketStatus: d.ms || null,
    nxtStatus: nxt?.overMarketStatus || null,
    tradedAt: useNxt ? (nxt.localTradedAt || null) : null,
    fetchedAt: new Date().toISOString(),
  };
  cache.set(code, { at: Date.now(), data });
  return data;
}
