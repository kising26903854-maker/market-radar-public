// MaReversalScannerTab.jsx — 🎯 "2·5·6 기법" 이평선 역배열→골든크로스 전 종목 스캐너 (단기/중장기)
import React, { useState, useEffect, useMemo } from 'react';

const formatNumber = (num) => new Intl.NumberFormat('ko-KR').format(num || 0);

const formatMarketCap = (eok) => {
  if (!eok) return '-';
  if (eok >= 10000) {
    const jo = Math.floor(eok / 10000);
    const rem = Math.round(eok % 10000);
    return `${jo.toLocaleString()}조${rem > 0 ? ' ' + rem.toLocaleString() + '억' : ''}`;
  }
  return `${Math.round(eok).toLocaleString()}억`;
};

export default function MaReversalScannerTab({ onSelectStock }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const [termType, setTermType] = useState('short'); // 'short' | 'long'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('SCORE_DESC'); // 'SCORE_DESC' | 'CAP_DESC' | 'FRESH_DESC'

  // 상단 요약 카드 체크박스 — 체크된 카드가 있으면 해당 조건에 해당하는 종목만 표시 (OR 조건)
  const [cardChecks, setCardChecks] = useState({ KOSPI: false, KOSDAQ: false, ACCUM: false });
  const toggleCard = (key) => setCardChecks(prev => ({ ...prev, [key]: !prev[key] }));

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchStocks = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch('/api/ma-reversal-stocks');
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error('256 기법 스캐너 로드 실패:', err);
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStocks();
    const interval = setInterval(() => fetchStocks(true), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/trigger-ma-reversal-scan', { method: 'POST' });
      showToast('🔄 전 종목 재스캔이 백그라운드에서 시작되었습니다 (코스피+코스닥 전체라 몇 분 걸릴 수 있어요). 잠시 후 새로고침 해주세요.');
    } catch (e) {
      showToast('재스캔 요청 중 오류가 발생했습니다.');
    } finally {
      setTimeout(() => fetchStocks(false), 3000);
    }
  };

  const rawList = termType === 'short' ? (data?.short || []) : (data?.long || []);

  const filteredStocks = useMemo(() => {
    let list = [...rawList];

    // 체크된 카드가 하나라도 있으면 OR 조건으로 좁힘
    const anyCardChecked = cardChecks.KOSPI || cardChecks.KOSDAQ || cardChecks.ACCUM;
    if (anyCardChecked) {
      list = list.filter(s =>
        (cardChecks.KOSPI && s.market === '코스피') ||
        (cardChecks.KOSDAQ && s.market === '코스닥') ||
        (cardChecks.ACCUM && s.hasAccumulationBar)
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s => (s.name || '').toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q));
    }
    if (sortBy === 'SCORE_DESC') list.sort((a, b) => b.score - a.score);
    else if (sortBy === 'CAP_DESC') list.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    else if (sortBy === 'FRESH_DESC') list.sort((a, b) => a.daysSinceCross - b.daysSinceCross);
    return list;
  }, [rawList, cardChecks, searchQuery, sortBy]);

  const kospiCount = rawList.filter(s => s.market === '코스피').length;
  const kosdaqCount = rawList.filter(s => s.market === '코스닥').length;
  const accumCount = rawList.filter(s => s.hasAccumulationBar).length;
  const totalScanned = data?.totalScanned || 0;
  const lastSyncAt = data?.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString('ko-KR') : '스캔 대기 중';
  const isScanning = data?.scanning;

  const activeSet = termType === 'short'
    ? { trigger: 5, mid: 20, outer: 60 }
    : { trigger: 5, mid: 112, outer: 224 };

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
              <span>🎯 "2·5·6 기법" 역배열→골든크로스 스캐너</span>
              <span style={{ fontSize: '.75rem', background: 'rgba(255,255,255,0.06)', color: 'var(--t2)', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 12px', borderRadius: 0, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: isScanning ? '#fbbf24' : '#10b981', display: 'inline-block' }} />
                {isScanning ? '전종목 최초 스캔 진행 중...' : `코스피+코스닥 ${totalScanned.toLocaleString()}종목 스캔 완료`}
              </span>
            </div>
            <div style={{ fontSize: '.86rem', color: 'var(--t3)', marginTop: 6, lineHeight: 1.6 }}>
              하락 역배열이던 종목이 <strong>5일선이 {activeSet.mid}일선을 상향 돌파</strong>하고 아직 <strong>{activeSet.outer}일선을 뚫기 전</strong>인 "초입 구간"을 코스피·코스닥 <strong>전 종목</strong>(ETF/ETN·실시간 거래정지 제외) 대상으로 찾습니다. 거래량 급증 양봉(매집봉)이 동반되면 가산점을 줍니다.
            </div>
            <div style={{ fontSize: '.76rem', color: 'var(--t3)', marginTop: 6 }}>마지막 스캔: {lastSyncAt}</div>
          </div>
          <button onClick={handleRefresh} disabled={refreshing} style={{ padding: '9px 16px', background: 'var(--accent)', border: 'none', borderRadius: 0, color: '#fff', fontWeight: 700, cursor: refreshing ? 'not-allowed' : 'pointer', fontSize: '.82rem' }}>
            {refreshing ? '스캔 요청 중...' : '전종목 재스캔'}
          </button>
        </div>
      </div>

      {/* ─── 단기/중장기 토글 ─── */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.25)', padding: 3, borderRadius: 0, marginBottom: 18, width: 'fit-content' }}>
        <button onClick={() => setTermType('short')} style={{ padding: '8px 18px', borderRadius: 0, border: 'none', background: termType === 'short' ? 'var(--accent)' : 'transparent', color: termType === 'short' ? '#fff' : 'var(--t3)', fontWeight: 700, fontSize: '.85rem', cursor: 'pointer' }}>
          단기 (5·20·60일선) {data?.short ? `${data.short.length}` : ''}
        </button>
        <button onClick={() => setTermType('long')} style={{ padding: '8px 18px', borderRadius: 0, border: 'none', background: termType === 'long' ? 'var(--accent)' : 'transparent', color: termType === 'long' ? '#fff' : 'var(--t3)', fontWeight: 700, fontSize: '.85rem', cursor: 'pointer' }}>
          중장기 (5·112·224일선) {data?.long ? `${data.long.length}` : ''}
        </button>
      </div>

      {/* ─── 요약 카드 (체크박스로 필터링 가능) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 8 }}>
        <label style={{ cursor: 'pointer', padding: '18px 20px', background: cardChecks.KOSPI ? 'rgba(129,140,248,0.12)' : 'var(--bg2)', border: cardChecks.KOSPI ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--t2)' }}>코스피 발굴</span>
            <input type="checkbox" checked={cardChecks.KOSPI} onChange={() => toggleCard('KOSPI')} style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fff', marginTop: 8, fontFamily: 'Space Mono' }}>
            {kospiCount.toLocaleString()} <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--t3)' }}>종목</span>
          </div>
        </label>
        <label style={{ cursor: 'pointer', padding: '18px 20px', background: cardChecks.KOSDAQ ? 'rgba(129,140,248,0.12)' : 'var(--bg2)', border: cardChecks.KOSDAQ ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--t2)' }}>코스닥 발굴</span>
            <input type="checkbox" checked={cardChecks.KOSDAQ} onChange={() => toggleCard('KOSDAQ')} style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fff', marginTop: 8, fontFamily: 'Space Mono' }}>
            {kosdaqCount.toLocaleString()} <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--t3)' }}>종목</span>
          </div>
        </label>
        <label style={{ cursor: 'pointer', padding: '18px 20px', background: cardChecks.ACCUM ? 'rgba(245,158,11,0.12)' : 'var(--bg2)', border: cardChecks.ACCUM ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--t2)' }}>🕵️ 매집봉 동반</span>
            <input type="checkbox" checked={cardChecks.ACCUM} onChange={() => toggleCard('ACCUM')} style={{ width: 18, height: 18, accentColor: '#f59e0b', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#f59e0b', marginTop: 8, fontFamily: 'Space Mono' }}>
            {accumCount.toLocaleString()} <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--t3)' }}>종목</span>
          </div>
        </label>
        <div style={{ padding: '18px 20px', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--t2)' }}>전체 스캔 종목</div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fff', marginTop: 8, fontFamily: 'Space Mono' }}>
            {totalScanned.toLocaleString()} <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--t3)' }}>종목</span>
          </div>
        </div>
      </div>
      {(cardChecks.KOSPI || cardChecks.KOSDAQ || cardChecks.ACCUM) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: '.78rem', color: 'var(--t3)' }}>체크된 카드 조건으로 {filteredStocks.length}개 종목만 표시 중</span>
          <button onClick={() => setCardChecks({ KOSPI: false, KOSDAQ: false, ACCUM: false })} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 0, color: 'var(--t2)', fontSize: '.74rem', fontWeight: 700, cursor: 'pointer' }}>
            체크 초기화
          </button>
        </div>
      )}

      {/* ─── 검색 & 정렬 바 ─── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', padding: '8px 14px', borderRadius: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="종목명, 코드 검색..." style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '.85rem', width: '140px' }} />
            {searchQuery && <button onClick={() => setSearchQuery('')} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer' }}>✕</button>}
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 0, color: '#fff', fontSize: '.84rem', outline: 'none', cursor: 'pointer' }}>
            <option value="SCORE_DESC">패턴 스코어 높은순</option>
            <option value="CAP_DESC">시가총액 큰순</option>
            <option value="FRESH_DESC">교차 최신순</option>
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
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>코스피+코스닥 전종목 최초 스캔이 백그라운드에서 진행 중입니다.</div>
          <div style={{ fontSize: '.85rem', marginTop: 8 }}>전 종목 대상이라 몇 분 걸릴 수 있어요. 잠시 후 새로고침 해주세요.</div>
        </div>
      ) : filteredStocks.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>해당 조건의 종목이 없습니다.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 16, marginBottom: 24 }}>
          {filteredStocks.map((stock, idx) => {
            const isUp = stock.changePct >= 0;

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
                      <span style={{ padding: '2px 8px', borderRadius: 0, fontSize: '.7rem', fontWeight: 700, background: 'rgba(255,255,255,0.06)', color: 'var(--t2)' }}>스코어 {stock.score}점</span>
                      <span style={{ padding: '2px 8px', borderRadius: 0, fontSize: '.7rem', fontWeight: 700, background: 'rgba(255,255,255,0.06)', color: 'var(--t2)' }}>시총 {formatMarketCap(stock.marketCap)}</span>
                    </div>
                  </div>
                  {stock.hasAccumulationBar && (
                    <span style={{ padding: '4px 10px', borderRadius: 0, fontSize: '.74rem', fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.5)', whiteSpace: 'nowrap' }}>
                      🕵️ 매집봉 포착
                    </span>
                  )}
                </div>

                <div style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: 0, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', marginBottom: 8 }}>
                    <div>
                      <div style={{ color: 'var(--t3)' }}>{stock.trigger}일선</div>
                      <div style={{ fontWeight: 900, color: '#fff', fontFamily: 'Space Mono' }}>{formatNumber(stock.triggerMa)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'var(--t3)' }}>{stock.mid}일선</div>
                      <div style={{ fontWeight: 900, color: '#fff', fontFamily: 'Space Mono' }}>{formatNumber(stock.midMa)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--t3)' }}>{stock.outer}일선(목표)</div>
                      <div style={{ fontWeight: 900, color: '#34d399', fontFamily: 'Space Mono' }}>{formatNumber(stock.outerMa)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: '.72rem', color: 'var(--t2)', flexWrap: 'wrap' }}>
                    <span>교차 시점 <strong style={{ color: '#fff' }}>{stock.crossDate}</strong></span>
                    <span>{stock.outer}일선까지 <strong style={{ color: '#34d399' }}>+{stock.outerGapPct}%</strong></span>
                    {stock.hasAccumulationBar && <span>매집봉 <strong style={{ color: '#f59e0b' }}>{stock.accumulationBar?.volumeRatio}배 거래량</strong></span>}
                  </div>
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
        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', marginBottom: 12 }}>"2·5·6 기법" 판정 기준</div>
        <div style={{ fontSize: '.86rem', color: 'var(--t2)', lineHeight: 1.7 }}>
          • <strong>사전 역배열 확인:</strong> 교차 시점 이전 10거래일 동안 {activeSet.outer}일선이 {activeSet.mid}일선보다 위에 있는 역배열(하락) 상태였는지 확인합니다.<br />
          • <strong>골든크로스:</strong> {activeSet.trigger}일선이 {activeSet.mid}일선을 최근 5거래일 이내에 상향 돌파했는지 확인합니다.<br />
          • <strong>"초입 구간" 확인:</strong> 현재가가 아직 {activeSet.outer}일선 아래에 있어야 합니다 — 이미 돌파했으면 초입이 아니므로 제외합니다.<br />
          • <strong>매집봉 가산점:</strong> 구간 내에 20일 평균 대비 거래량 1.5배 이상 + 양봉인 "매집봉"이 있으면 가산점을 줍니다.<br />
          • <strong>스캔 대상:</strong> 코스피+코스닥 전 종목 중 ETF/ETN과 실시간 거래정지 종목을 제외합니다. (⚠️ 관리종목/투자위험종목 지정 여부는 안정적인 무료 API를 찾지 못해 이번 버전엔 반영하지 못했습니다 — 최소 시가총액 필터로 일부 간접 배제됩니다.)
        </div>
      </div>
    </div>
  );
}
