// LeadingStockScreenerTab.jsx — 🚀 "오늘의 주도주" 스크리너 (시총·거래대금·모멘텀·추세·신고가 근접 복합조건)
import React, { useState, useEffect, useMemo } from 'react';

const formatNumber = (num) => new Intl.NumberFormat('ko-KR').format(num || 0);

const formatEok = (eok) => {
  if (!eok) return '-';
  if (eok >= 10000) {
    const jo = Math.floor(eok / 10000);
    const rem = Math.round(eok % 10000);
    return `${jo.toLocaleString()}조${rem > 0 ? ' ' + rem.toLocaleString() + '억' : ''}`;
  }
  return `${Math.round(eok).toLocaleString()}억`;
};

const formatWon = (val) => {
  if (!val) return '-';
  if (Math.abs(val) >= 1e12) return `${(val / 1e12).toFixed(1)}조원`;
  if (Math.abs(val) >= 1e8) return `${Math.round(val / 1e8).toLocaleString()}억원`;
  return `${Math.round(val).toLocaleString()}원`;
};

const BURST_META = {
  STRONG: { label: '🔥 강한 폭발', color: '#f87171', desc: '12봉내 고가 +15%↑ & 거래대금 900억↑' },
  MODERATE: { label: '⚡ 완만한 폭발', color: '#fbbf24', desc: '12봉내 고가 +5%↑ & 거래대금 1조↑' },
  BOTH: { label: '🔥⚡ 이중 폭발', color: '#f472b6', desc: '강한 폭발 + 완만한 폭발 모두 충족' },
};

export default function LeadingStockScreenerTab({ onSelectStock }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const [burstFilter, setBurstFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('VALUE_DESC'); // 'VALUE_DESC' | 'CAP_DESC' | 'DAYHIGH_DESC'

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const ownerKey = (() => { try { return localStorage.getItem('ownerKey') || '' } catch { return '' } })();
  const ownerHeaders = { 'x-owner-key': ownerKey };

  const fetchStocks = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch('/api/leading-stocks', { headers: ownerHeaders });
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error('오늘의 주도주 로드 실패:', err);
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStocks();
    const interval = setInterval(() => fetchStocks(true), 120000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/trigger-leading-stock-scan', { method: 'POST', headers: ownerHeaders });
      showToast('🔄 재스캔이 백그라운드에서 시작되었습니다. 잠시 후 새로고침 해주세요.');
    } catch (e) {
      showToast('재스캔 요청 중 오류가 발생했습니다.');
    } finally {
      setTimeout(() => fetchStocks(false), 3000);
    }
  };

  const rawList = data?.matched || [];

  const filteredList = useMemo(() => {
    let list = [...rawList];
    if (burstFilter !== 'ALL') list = list.filter(s => s.burstType === burstFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s => (s.name || '').toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q));
    }
    if (sortBy === 'CAP_DESC') list.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    else if (sortBy === 'DAYHIGH_DESC') list.sort((a, b) => (b.dayHighGapPct ?? -999) - (a.dayHighGapPct ?? -999));
    else list.sort((a, b) => (b.tradingValue || 0) - (a.tradingValue || 0));
    return list;
  }, [rawList, burstFilter, searchQuery, sortBy]);

  const strongCount = rawList.filter(s => s.burstType === 'STRONG').length;
  const moderateCount = rawList.filter(s => s.burstType === 'MODERATE').length;
  const bothCount = rawList.filter(s => s.burstType === 'BOTH').length;
  const totalCandidates = data?.totalCandidates || 0;
  const lastSyncAt = data?.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString('ko-KR') : '스캔 대기 중';
  const isScanning = data?.scanning;

  return (
    <div style={{ padding: '10px 0', animation: 'fadeIn 0.3s ease-in-out' }}>
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '14px 20px',
          background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 0,
          color: '#fff', fontWeight: 800, fontSize: '.9rem', zIndex: 5000,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
        }}>
          {toastMessage}
        </div>
      )}

      {/* ─── 헤더 배너 ─── */}
      <div style={{ padding: '22px 26px', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0, marginBottom: 18, boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span>🚀 오늘의 주도주</span>
              <span style={{ fontSize: '.75rem', background: 'rgba(255,255,255,0.06)', color: 'var(--t2)', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 12px', borderRadius: 0, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: isScanning ? '#fbbf24' : '#10b981', display: 'inline-block' }} />
                {isScanning ? '최초 스캔 진행 중...' : `1차 후보 ${totalCandidates.toLocaleString()}종목 스캔 완료`}
              </span>
            </div>
            <div style={{ fontSize: '.86rem', color: 'var(--t3)', marginTop: 6, lineHeight: 1.6 }}>
              시가총액 1,000억↑ & 거래대금 순위 TOP100 종목 중에서, <strong style={{ color: '#fff' }}>최근 12거래일 내 강한 거래량 동반 급등</strong>이 있었고, <strong style={{ color: '#fff' }}>20·60일선 위(또는 신규상장)</strong>이며, <strong style={{ color: '#fff' }}>52주·최근 고점에 근접</strong>한 종목만 찾습니다. (신규상장주는 데이터가 짧은 조건은 자동 면제)
            </div>
            <div style={{ fontSize: '.76rem', color: 'var(--t3)', marginTop: 6 }}>마지막 스캔: {lastSyncAt}</div>
          </div>
          <button onClick={handleRefresh} disabled={refreshing} style={{ padding: '9px 16px', background: 'var(--accent)', border: 'none', borderRadius: 0, color: '#fff', fontWeight: 700, cursor: refreshing ? 'not-allowed' : 'pointer', fontSize: '.82rem' }}>
            {refreshing ? '스캔 요청 중...' : '재스캔'}
          </button>
        </div>
      </div>

      {/* ─── 폭발 유형 요약 카드 (클릭으로 필터링) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { key: 'ALL', label: '전체', count: rawList.length, color: '#fff' },
          { key: 'STRONG', label: BURST_META.STRONG.label, count: strongCount, color: BURST_META.STRONG.color },
          { key: 'MODERATE', label: BURST_META.MODERATE.label, count: moderateCount, color: BURST_META.MODERATE.color },
          { key: 'BOTH', label: BURST_META.BOTH.label, count: bothCount, color: BURST_META.BOTH.color },
        ].map(c => (
          <button key={c.key} onClick={() => setBurstFilter(c.key)}
            style={{
              textAlign: 'left', cursor: 'pointer', padding: '16px 20px',
              background: burstFilter === c.key ? 'rgba(129,140,248,0.12)' : 'var(--bg2)',
              border: burstFilter === c.key ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
            }}>
            <div style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--t2)' }}>{c.label}</div>
            <div style={{ fontSize: '1.7rem', fontWeight: 900, color: c.color, marginTop: 6, fontFamily: 'Space Mono' }}>
              {c.count.toLocaleString()} <span style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--t3)' }}>종목</span>
            </div>
          </button>
        ))}
      </div>

      {/* ─── 검색 & 정렬 바 ─── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', padding: '8px 14px', borderRadius: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="종목명, 코드 검색..." style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '.85rem', width: '140px' }} />
            {searchQuery && <button onClick={() => setSearchQuery('')} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer' }}>✕</button>}
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 0, color: '#fff', fontSize: '.84rem', outline: 'none', cursor: 'pointer' }}>
            <option value="VALUE_DESC">거래대금 큰순</option>
            <option value="CAP_DESC">시가총액 큰순</option>
            <option value="DAYHIGH_DESC">최근 고점 근접순</option>
          </select>
        </div>
      </div>

      {/* ─── 종목 카드 그리드 ─── */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>스캔 데이터를 불러오는 중...</div>
        </div>
      ) : isScanning ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>최초 스캔이 백그라운드에서 진행 중입니다.</div>
          <div style={{ fontSize: '.85rem', marginTop: 8 }}>잠시 후 새로고침 해주세요.</div>
        </div>
      ) : filteredList.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>해당 조건의 종목이 없습니다.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 16, marginBottom: 24 }}>
          {filteredList.map((stock, idx) => {
            const isUp = stock.changePct >= 0;
            const meta = BURST_META[stock.burstType] || BURST_META.MODERATE;

            return (
              <div key={stock.code} className="card"
                onClick={() => onSelectStock && onSelectStock({ ...stock, current_price: stock.price, type: stock.market })}
                style={{ padding: 20, background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 8px', background: idx < 3 ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.08)', color: idx < 3 ? '#fbbf24' : 'var(--t3)', borderRadius: 0, fontWeight: 700, fontSize: '.75rem' }}>#{idx + 1}</span>
                      <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>{stock.name}</span>
                      <span style={{ fontSize: '.78rem', color: 'var(--t3)', fontFamily: 'Space Mono' }}>{stock.code}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 0, fontSize: '.7rem', fontWeight: 700, background: 'rgba(255,255,255,0.06)', color: 'var(--t2)' }}>{stock.market}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 0, fontSize: '.7rem', fontWeight: 700, background: 'rgba(255,255,255,0.06)', color: 'var(--t2)' }}>시총 {formatEok(stock.marketCap)}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 0, fontSize: '.7rem', fontWeight: 700, background: 'rgba(255,255,255,0.06)', color: 'var(--t2)' }}>거래대금 {formatWon(stock.tradingValue)}</span>
                    </div>
                  </div>
                  <span title={meta.desc} style={{ padding: '4px 10px', borderRadius: 0, fontSize: '.74rem', fontWeight: 700, background: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}66`, whiteSpace: 'nowrap' }}>
                    {meta.label}
                  </span>
                </div>

                <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: 0, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 12, fontSize: '.76rem', color: 'var(--t2)' }}>
                  <div style={{ display: 'flex', gap: 14, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span>20일선 <strong style={{ color: '#fff' }}>{stock.listedWithin22 ? '신규상장 면제' : formatNumber(stock.ma20)}</strong></span>
                    <span>60일선 <strong style={{ color: '#fff' }}>{stock.listedWithin62 ? '신규상장 면제' : formatNumber(stock.ma60)}</strong></span>
                  </div>
                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                    <span>52주 고점 대비 <strong style={{ color: '#34d399' }}>{stock.listedWithin298 ? '신규상장 면제' : `${stock.weekHighGapPct}%`}</strong></span>
                    <span>최근 고점 대비 <strong style={{ color: '#34d399' }}>{stock.listedWithin12 ? '신규상장 면제' : `${stock.dayHighGapPct}%`}</strong></span>
                  </div>
                  <div style={{ marginTop: 6, color: 'var(--t3)' }}>폭발 시점: {stock.burstDate}</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <span style={{ fontSize: '.74rem', color: 'var(--t3)' }}>현재가: </span>
                    <strong style={{ color: '#fff', fontSize: '1rem', fontFamily: 'Space Mono' }}>{formatNumber(stock.price)}원</strong>
                    <span style={{ color: isUp ? 'var(--up)' : 'var(--dn)', fontSize: '.8rem', fontWeight: 800, marginLeft: 6 }}>({isUp ? '+' : ''}{stock.changePct}%)</span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onSelectStock && onSelectStock({ ...stock, current_price: stock.price, type: stock.market }); }}
                    style={{ padding: '6px 12px', background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.4)', borderRadius: 0, color: 'var(--accent)', fontSize: '.76rem', fontWeight: 700, cursor: 'pointer' }}>
                    차트 상세보기 ➔
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── 판정 기준 가이드 ─── */}
      <div style={{ padding: '22px 26px', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0 }}>
        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', marginBottom: 12 }}>"오늘의 주도주" 판정 기준</div>
        <div style={{ fontSize: '.86rem', color: 'var(--t2)', lineHeight: 1.7 }}>
          • <strong>기본 자격:</strong> 시가총액 1,000억원 이상 & 거래대금 순위(코스피+코스닥 통합) 상위 100위 이내.<br />
          • <strong>모멘텀 폭발(택1):</strong> 최근 12거래일 내 <strong style={{ color: '#f87171' }}>고가가 전일종가 대비 +15% 이상 & 거래대금 900억 이상</strong>인 날이 있었거나, <strong style={{ color: '#fbbf24' }}>+5% 이상 & 거래대금 1조 이상</strong>인 날이 있었어야 합니다.<br />
          • <strong>추세:</strong> 종가가 20일선 위 & 60일선 위 — 단, 상장한 지 얼마 안 돼 해당 이평선을 계산할 데이터가 없는 신규상장주는 면제됩니다.<br />
          • <strong>고점 근접:</strong> 주봉 기준 52주 신고가 대비 -33% 이내 & 최근 12거래일 고점 대비 -17% 이내 — 역시 데이터가 짧은 신규상장주는 면제됩니다.<br />
          • ⚠️ 이 앱은 종목별 정확한 상장일 데이터가 없어 "신규상장 며칠 이내" 조건은 보유 시세 이력 개수로 근사 판정하며, 거래대금은 종가×거래량으로 근사 계산합니다.
        </div>
      </div>
    </div>
  );
}
