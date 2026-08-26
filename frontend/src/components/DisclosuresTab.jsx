// DisclosuresTab.jsx — 📑 내 보유 종목 DART 실시간 전자공시 모니터링 대시보드
import React, { useState, useEffect, useMemo } from 'react';

export default function DisclosuresTab({ positions = [] }) {
  const [disclosures, setDisclosures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'EARNINGS' | 'MANAGEMENT' | 'MARKET' | 'GENERAL'
  const [stockFilter, setStockFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDisclosures = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch('/api/disclosures');
      const data = await res.json();
      if (data.success && Array.isArray(data.disclosures)) {
        setDisclosures(data.disclosures);
      }
    } catch (err) {
      console.error('공시 데이터 조회 오류:', err);
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDisclosures();
    // 30초마다 자동 갱신
    const timer = setInterval(() => fetchDisclosures(true), 30000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDisclosures(false);
  };

  // 필터링 및 검색 연산
  const filteredDisclosures = useMemo(() => {
    return disclosures.filter(item => {
      // 공시 유형 필터
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;

      // 보유 종목 필터
      if (stockFilter !== 'ALL' && item.stockCode !== stockFilter) return false;

      // 검색어 필터
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchName = (item.stockName || '').toLowerCase().includes(q);
        const matchCode = (item.stockCode || '').toLowerCase().includes(q);
        const matchSubmitter = (item.submitter || '').toLowerCase().includes(q);
        if (!matchTitle && !matchName && !matchCode && !matchSubmitter) return false;
      }

      return true;
    });
  }, [disclosures, typeFilter, stockFilter, searchQuery]);

  // 유형별 통계
  const stats = useMemo(() => {
    const counts = {
      ALL: disclosures.length,
      EARNINGS: 0,
      MANAGEMENT: 0,
      MARKET: 0,
      GENERAL: 0
    };
    disclosures.forEach(d => {
      if (counts[d.type] !== undefined) counts[d.type]++;
      else counts.GENERAL++;
    });
    return counts;
  }, [disclosures]);

  return (
    <div style={{ padding: '10px 0', animation: 'fadeIn 0.3s ease-in-out' }}>
      {/* ─── 상단 메인 헤더 배너 ─── */}
      <div style={{
        padding: '24px 28px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(168,85,247,0.15) 100%)',
        border: '2px solid rgba(129,140,248,0.4)',
        borderRadius: 22,
        marginBottom: 22,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ filter: 'drop-shadow(0 0 10px #818cf8)' }}>📑 보유 종목 실시간 DART 전자공시</span>
              <span style={{ fontSize: '.72rem', background: 'var(--accent)', color: '#fff', padding: '3px 10px', borderRadius: 20, fontWeight: 800 }}>
                ⚡ 금융감독원 공식 연동
              </span>
            </div>
            <div style={{ fontSize: '.9rem', color: 'var(--t2)', marginTop: 6, lineHeight: 1.5 }}>
              내 포트폴리오 보유 종목의 <strong>잠정 실적, 주요 경영 사항, 대량보유 지분 변동, 시장 경보</strong> 공시를 실시간 수집 및 모니터링합니다.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ padding: '8px 16px', background: 'rgba(0,0,0,0.4)', borderRadius: 12, border: '1px solid rgba(129,140,248,0.3)', textAlign: 'center' }}>
              <div style={{ fontSize: '.72rem', color: 'var(--accent)', fontWeight: 700 }}>총 수집 공시</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff', marginTop: 2 }}>{disclosures.length}건</div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                padding: '10px 18px',
                background: refreshing ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                border: 'none',
                borderRadius: 12,
                color: '#fff',
                fontWeight: 900,
                cursor: refreshing ? 'not-allowed' : 'pointer',
                fontSize: '.88rem',
                boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>{refreshing ? '⏳' : '🔄'}</span>
              <span>{refreshing ? '공시 수집 중...' : '실시간 공시 새로고침'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── 4대 공시 유형 통계 카드 ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { id: 'ALL', label: '🌐 전체 공시', count: stats.ALL, color: '#818cf8', desc: '수집된 모든 전자공시' },
          { id: 'EARNINGS', label: '🔥 실적/결산공시', count: stats.EARNINGS, color: '#ef4444', desc: '잠정실적, 분기/반기/사업보고서' },
          { id: 'MANAGEMENT', label: '💡 경영/주주공시', count: stats.MANAGEMENT, color: '#f59e0b', desc: '지분변동, 배당, 소송, 주요사항' },
          { id: 'MARKET', label: '⚠️ 시장/수급경보', count: stats.MARKET, color: '#3b82f6', desc: '단기과열, 투자주의/경고, 조회공시' },
        ].map(card => {
          const isSelected = typeFilter === card.id;
          return (
            <div
              key={card.id}
              onClick={() => setTypeFilter(card.id)}
              style={{
                padding: '16px 18px',
                borderRadius: 16,
                background: isSelected ? `${card.color}25` : 'rgba(30, 41, 59, 0.75)',
                border: isSelected ? `2px solid ${card.color}` : '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isSelected ? `0 0 16px ${card.color}40` : 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '.84rem', fontWeight: 800, color: card.color }}>{card.label}</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', fontFamily: 'Space Mono' }}>{card.count}건</span>
              </div>
              <div style={{ fontSize: '.74rem', color: 'var(--t2)', marginTop: 4 }}>{card.desc}</div>
              <div style={{ fontSize: '.72rem', color: card.color, fontWeight: 800, marginTop: 8 }}>
                {isSelected ? '✅ 필터링 적용 중' : '클릭 시 필터 ➔'}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── 🔍 실시간 검색창 ─── */}
      <div style={{
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--bg2)',
        padding: '12px 18px',
        borderRadius: 16,
        border: '1px solid rgba(129,140,248,0.3)',
        boxShadow: '0 4px 18px rgba(0,0,0,0.25)'
      }}>
        <span style={{ fontSize: '1.2rem' }}>🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="공시 제목(예: 잠정실적, 배당, 지분), 종목명(아모레퍼시픽, 삼성전자), 종목코드(090430), 제출인 검색..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#fff',
            fontSize: '0.92rem',
            fontWeight: 600
          }}
        />
        {searchQuery && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '.78rem', color: 'var(--accent)', fontWeight: 800, background: 'rgba(99,102,241,0.15)', padding: '3px 8px', borderRadius: 8 }}>
              {filteredDisclosures.length}개 매칭
            </span>
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                cursor: 'pointer',
                fontSize: '.78rem',
                fontWeight: 800,
                padding: '4px 10px'
              }}
            >
              ✕ 초기화
            </button>
          </div>
        )}
      </div>

      {/* ─── 종목별 빠른 필터 칩 ─── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <button
          onClick={() => setStockFilter('ALL')}
          style={{
            padding: '6px 14px',
            borderRadius: 20,
            border: stockFilter === 'ALL' ? '1.5px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
            background: stockFilter === 'ALL' ? 'rgba(99,102,241,0.25)' : 'rgba(0,0,0,0.3)',
            color: stockFilter === 'ALL' ? '#fff' : 'var(--t3)',
            fontWeight: 800,
            fontSize: '.8rem',
            cursor: 'pointer'
          }}
        >
          🏢 전체 보유 종목
        </button>

        {positions.map(p => {
          const isSelected = stockFilter === p.code;
          return (
            <button
              key={p.code}
              onClick={() => setStockFilter(p.code)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: isSelected ? '1.5px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                background: isSelected ? 'rgba(16,185,129,0.25)' : 'rgba(0,0,0,0.3)',
                color: isSelected ? '#fff' : 'var(--t2)',
                fontWeight: 800,
                fontSize: '.8rem',
                cursor: 'pointer'
              }}
            >
              {p.name} ({p.code})
            </button>
          );
        })}
      </div>

      {/* ─── 공시 목록 리스트 ─── */}
      {loading ? (
        <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--accent)', fontSize: '1.1rem', fontWeight: 800 }}>
          ⏳ DART 금융감독원 전자공시 실시간 수집 중...
        </div>
      ) : filteredDisclosures.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', borderRadius: 18, border: '1px dashed rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>📑</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--t1)' }}>검색 조건과 일치하는 전자공시가 없습니다.</div>
          <div style={{ fontSize: '.82rem', color: 'var(--t3)', marginTop: 4 }}>다른 검색어를 입력하시거나 필터를 초기화해 보세요.</div>
          <button
            onClick={() => { setSearchQuery(''); setTypeFilter('ALL'); setStockFilter('ALL'); }}
            style={{ marginTop: 14, padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, cursor: 'pointer' }}
          >
            🔄 전체 필터 초기화
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredDisclosures.map(item => (
            <div
              key={item.id}
              style={{
                padding: '18px 22px',
                background: 'var(--bg2)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 14,
                transition: 'transform 0.15s ease, border-color 0.15s ease',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = item.color || 'var(--accent)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <div style={{ flex: 1, minWidth: '280px' }}>
                {/* 상단 태그 라인 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '3px 8px',
                    background: `${item.color || '#818cf8'}20`,
                    border: `1px solid ${item.color || '#818cf8'}50`,
                    borderRadius: 6,
                    color: item.color || '#818cf8',
                    fontSize: '.74rem',
                    fontWeight: 800
                  }}>
                    {item.typeBadge || '📋 일반공시'}
                  </span>

                  <span style={{ fontWeight: 900, color: '#fff', fontSize: '.9rem' }}>
                    {item.stockName}
                  </span>
                  <span style={{ fontSize: '.76rem', color: 'var(--t3)', fontFamily: 'Space Mono' }}>
                    ({item.stockCode})
                  </span>

                  <span style={{ fontSize: '.74rem', color: 'var(--t3)', marginLeft: 'auto' }}>
                    📅 {item.date}
                  </span>
                </div>

                {/* 공시 제목 */}
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--t1)', lineHeight: 1.5, marginBottom: 6 }}>
                  {item.title}
                </div>

                {/* 제출인 / 출처 */}
                <div style={{ fontSize: '.78rem', color: 'var(--t3)' }}>
                  제출인: <strong style={{ color: 'var(--t2)' }}>{item.submitter || '금융감독원 DART'}</strong>
                </div>
              </div>

              {/* DART 원문 바로가기 버튼 */}
              <div>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '8px 16px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 10,
                    color: '#fff',
                    textDecoration: 'none',
                    fontWeight: 800,
                    fontSize: '.82rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer',
                    transition: 'background 0.2s ease'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                >
                  <span>🔗</span>
                  <span>DART 원문 보기</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
