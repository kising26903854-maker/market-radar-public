// MaReversalDropoutTab.jsx — 🕵️ "256 기법" 탈락 종목 추적기 (상승 돌파 / 하락 붕괴 / 기간 만료)
import React, { useState, useEffect, useMemo } from 'react';

const formatNumber = (num) => new Intl.NumberFormat('ko-KR').format(num || 0);

const REASON_META = {
  BREAKOUT_UP: { label: '상승 탈락', color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.4)', desc: '목표선 돌파 성공' },
  BREAKDOWN: { label: '하락 탈락', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.4)', desc: '정배열 붕괴' },
  STALE: { label: '기간 만료', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.4)', desc: '교차 신선도 초과' },
  OTHER: { label: '기타', color: 'var(--t3)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.15)', desc: '조건 미충족' },
  DATA_INSUFFICIENT: { label: '데이터 부족', color: 'var(--t3)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.15)', desc: '' },
};

export default function MaReversalDropoutTab({ onSelectStock }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [termType, setTermType] = useState('short'); // 'short' | 'long'
  const [reasonFilter, setReasonFilter] = useState('ALL'); // 'ALL' | 'BREAKOUT_UP' | 'BREAKDOWN' | 'STALE'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('RECENT'); // 'RECENT' | 'RETURN_DESC' | 'RETURN_ASC'

  const fetchDropouts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ma-reversal-dropouts');
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error('256 기법 탈락 추적 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDropouts();
    const interval = setInterval(() => fetchDropouts(), 120000);
    return () => clearInterval(interval);
  }, []);

  const rawList = termType === 'short' ? (data?.short || []) : (data?.long || []);

  const filteredList = useMemo(() => {
    let list = [...rawList];
    if (reasonFilter !== 'ALL') list = list.filter(s => s.reason === reasonFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s => (s.name || '').toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q));
    }
    if (sortBy === 'RETURN_DESC') list.sort((a, b) => (b.returnSinceDropoutPct ?? -999) - (a.returnSinceDropoutPct ?? -999));
    else if (sortBy === 'RETURN_ASC') list.sort((a, b) => (a.returnSinceDropoutPct ?? 999) - (b.returnSinceDropoutPct ?? 999));
    else list.sort((a, b) => (b.dropoutDate || '').localeCompare(a.dropoutDate || ''));
    return list;
  }, [rawList, reasonFilter, searchQuery, sortBy]);

  const breakoutCount = rawList.filter(s => s.reason === 'BREAKOUT_UP').length;
  const breakdownCount = rawList.filter(s => s.reason === 'BREAKDOWN').length;
  const staleCount = rawList.filter(s => s.reason === 'STALE').length;

  return (
    <div style={{ padding: '10px 0', animation: 'fadeIn 0.3s ease-in-out' }}>
      {/* ─── 헤더 배너 ─── */}
      <div style={{ padding: '22px 26px', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0, marginBottom: 18, boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff' }}>🕵️ "256 기법" 탈락 종목 추적</div>
        <div style={{ fontSize: '.86rem', color: 'var(--t3)', marginTop: 6, lineHeight: 1.6 }}>
          한 번 "256 기법" 후보로 잡혔다가 스캐너에서 사라진 종목을 계속 추적합니다. <strong style={{ color: '#f87171' }}>상승 탈락</strong>(목표선을 뚫고 올라간 성공 케이스), <strong style={{ color: '#60a5fa' }}>하락 탈락</strong>(정배열이 다시 무너진 실패 케이스), <strong style={{ color: '#fbbf24' }}>기간 만료</strong>(가격대는 그대로지만 교차가 오래돼서 신선도 기준만 벗어난 케이스)로 구분하고, 탈락 이후 수익률도 함께 보여줍니다.
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

      {/* ─── 탈락 사유 요약 카드 (클릭으로 필터링) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { key: 'ALL', label: '전체', count: rawList.length, color: '#fff' },
          { key: 'BREAKOUT_UP', label: '🔴 상승 탈락', count: breakoutCount, color: '#f87171' },
          { key: 'BREAKDOWN', label: '🔵 하락 탈락', count: breakdownCount, color: '#60a5fa' },
          { key: 'STALE', label: '🟡 기간 만료', count: staleCount, color: '#fbbf24' },
        ].map(c => (
          <button key={c.key} onClick={() => setReasonFilter(c.key)}
            style={{
              textAlign: 'left', cursor: 'pointer', padding: '16px 20px',
              background: reasonFilter === c.key ? 'rgba(129,140,248,0.12)' : 'var(--bg2)',
              border: reasonFilter === c.key ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
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
            <option value="RECENT">최근 탈락순</option>
            <option value="RETURN_DESC">탈락 후 수익률 높은순</option>
            <option value="RETURN_ASC">탈락 후 수익률 낮은순</option>
          </select>
        </div>
      </div>

      {/* ─── 종목 카드 그리드 ─── */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>탈락 추적 데이터를 불러오는 중...</div>
        </div>
      ) : filteredList.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>아직 추적된 탈락 종목이 없습니다.</div>
          <div style={{ fontSize: '.85rem', marginTop: 8 }}>다음 자동 스캔(매일 09:25)부터 탈락이 감지되면 여기에 쌓입니다.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
          {filteredList.map((stock) => {
            const meta = REASON_META[stock.reason] || REASON_META.OTHER;
            const ret = stock.returnSinceDropoutPct;
            const retColor = ret === null || ret === undefined ? 'var(--t3)' : (ret >= 0 ? '#f87171' : '#60a5fa');

            return (
              <div key={`${stock.code}-${stock.dropoutDate}`} className="card"
                onClick={() => onSelectStock && onSelectStock({ code: stock.code, name: stock.name, market: stock.market, current_price: stock.currentPrice })}
                style={{ padding: 20, background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>{stock.name}</span>
                      <span style={{ fontSize: '.78rem', color: 'var(--t3)', fontFamily: 'Space Mono' }}>{stock.code}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 0, fontSize: '.7rem', fontWeight: 700, background: 'rgba(255,255,255,0.06)', color: 'var(--t2)' }}>{stock.market}</span>
                    </div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 0, fontSize: '.74rem', fontWeight: 700, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, whiteSpace: 'nowrap' }}>
                    {meta.label}
                  </span>
                </div>

                <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: 0, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 12, fontSize: '.78rem', color: 'var(--t2)' }}>
                  <div style={{ marginBottom: 6 }}>최초 포착 <strong style={{ color: '#fff' }}>{stock.firstSeenDate}</strong> → 탈락 <strong style={{ color: '#fff' }}>{stock.dropoutDate}</strong></div>
                  <div>{meta.desc}{stock.outerGapPctAtDropout != null && stock.reason === 'STALE' ? ` (목표선까지 ${stock.outerGapPctAtDropout}% 남음)` : ''}</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div style={{ fontSize: '.72rem', color: 'var(--t3)' }}>탈락 당시가 → 현재가</div>
                    <div style={{ fontWeight: 800, color: '#fff', fontFamily: 'Space Mono', fontSize: '.92rem' }}>
                      {formatNumber(stock.priceAtDropout)} → {stock.currentPrice != null ? formatNumber(stock.currentPrice) : '-'}원
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '.72rem', color: 'var(--t3)' }}>탈락 후 수익률</div>
                    <div style={{ fontWeight: 900, color: retColor, fontFamily: 'Space Mono', fontSize: '1.05rem' }}>
                      {ret === null || ret === undefined ? '-' : `${ret >= 0 ? '+' : ''}${ret}%`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
