// GrowthStockScreener.jsx — 🚀 4대 재무 퀀트 엄격 AND 조건 종목 발굴기
import React, { useState, useEffect } from 'react';

export default function GrowthStockScreener({ onSelectStock, onOpenValueChain }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('perfect'); // 'perfect' | 'asset' | 'op' | 'rev' | 'debt' | 'near'
  const [searchFilter, setSearchFilter] = useState('');

  const loadData = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/growth-screener${force ? '?force=true' : ''}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (e) {
      console.error('종목 발굴기 데이터 로드 실패:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getFilteredList = () => {
    if (!data) return [];
    let list = [];
    switch (activeTab) {
      case 'perfect':
        list = data.perfectMatches || [];
        break;
      case 'asset':
        list = data.topAssetList || [];
        break;
      case 'op':
        list = data.topOpList || [];
        break;
      case 'rev':
        list = data.topRevList || [];
        break;
      case 'debt':
        list = data.soundDebtList || [];
        break;
      case 'near':
        list = data.strongCandidates || [];
        break;
      default:
        list = data.perfectMatches || [];
    }

    if (!searchFilter.trim()) return list;
    const q = searchFilter.trim().toLowerCase();
    return list.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.code.includes(q)
    );
  };

  const list = getFilteredList();

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* ─── 1. 상단 타이틀 & 4대 조건 소개 헤더 ─── */}
      <div style={{
        padding: '24px 28px',
        background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
        border: '1.5px solid rgba(168, 85, 247, 0.4)',
        borderRadius: 20,
        marginBottom: 24,
        boxShadow: '0 12px 36px rgba(0,0,0,0.4)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                boxShadow: '0 0 20px rgba(168,85,247,0.5)'
              }}>
                🔍
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.3px' }}>
                  4대 재무 퀀트 엄격 AND 조건 <span style={{
                    background: 'linear-gradient(135deg, #c084fc 0%, #f472b6 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}>종목 발굴기</span>
                </h1>
                <div style={{ fontSize: '.84rem', color: 'var(--t2)', marginTop: 3 }}>
                  최근 3개년 <strong>[자산 증가율 TOP 20 ⋂ 영업이익 증가율 TOP 20 ⋂ 매출액 증가율 TOP 20 ⋂ 부채비율 120% 이하]</strong> 4대 올킬 알짜 기업
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => loadData(true)}
              disabled={refreshing || loading}
              style={{
                padding: '10px 18px',
                background: refreshing ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, rgba(168,85,247,0.25) 0%, rgba(236,72,153,0.25) 100%)',
                border: '1px solid rgba(168,85,247,0.6)',
                borderRadius: 12,
                color: '#fff',
                fontSize: '.85rem',
                fontWeight: 800,
                cursor: refreshing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s'
              }}
            >
              <span>{refreshing ? '⏳' : '🔄'}</span>
              <span>{refreshing ? '퀀트 재계산 중...' : '4대 퀀트 스캔 새로고침'}</span>
            </button>
          </div>
        </div>

        {/* 4대 퀀트 조건 요약 칩 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 18 }}>
          <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.35)', borderRadius: 12, border: '1px solid rgba(168,85,247,0.3)' }}>
            <div style={{ fontSize: '.74rem', color: '#c084fc', fontWeight: 800 }}>조건 1 · 자산 성장성</div>
            <div style={{ fontSize: '.95rem', fontWeight: 900, color: '#fff', marginTop: 2 }}>🏢 3개년 자산 증가율 TOP 20</div>
          </div>
          <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.35)', borderRadius: 12, border: '1px solid rgba(239,68,68,0.3)' }}>
            <div style={{ fontSize: '.74rem', color: '#f87171', fontWeight: 800 }}>조건 2 · 이익 폭발력</div>
            <div style={{ fontSize: '.95rem', fontWeight: 900, color: '#fff', marginTop: 2 }}>📈 3개년 영업익 증가율 TOP 20</div>
          </div>
          <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.35)', borderRadius: 12, border: '1px solid rgba(16,185,129,0.3)' }}>
            <div style={{ fontSize: '.74rem', color: '#34d399', fontWeight: 800 }}>조건 3 · 재무 건전성</div>
            <div style={{ fontSize: '.95rem', fontWeight: 900, color: '#fff', marginTop: 2 }}>🛡️ 부채비율 120% 이하 안전</div>
          </div>
          <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.35)', borderRadius: 12, border: '1px solid rgba(234,179,8,0.3)' }}>
            <div style={{ fontSize: '.74rem', color: '#fbbf24', fontWeight: 800 }}>조건 4 · 외형 성장성</div>
            <div style={{ fontSize: '.95rem', fontWeight: 900, color: '#fff', marginTop: 2 }}>💰 3개년 매출액 증가율 TOP 20</div>
          </div>
        </div>
      </div>

      {/* ─── 2. 서브 탭 네비게이션 & 검색창 ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'perfect', label: `🏆 4대 AND 올킬 발굴주 (${data?.summary?.perfectCount || 0})`, glow: true },
            { id: 'asset', label: '🏢 자산 증가율 TOP 20' },
            { id: 'op', label: '📈 영업익 증가율 TOP 20' },
            { id: 'rev', label: '💰 매출액 증가율 TOP 20' },
            { id: 'debt', label: '🛡️ 저부채 우량주' },
            { id: 'near', label: `⭐ 근접 후보군 (${data?.strongCandidates?.length || 0})` }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '9px 16px',
                borderRadius: 12,
                border: activeTab === t.id ? (t.glow ? '1.5px solid #ec4899' : '1.5px solid var(--accent)') : '1px solid var(--border)',
                background: activeTab === t.id 
                  ? (t.glow ? 'linear-gradient(135deg, rgba(236,72,153,0.3) 0%, rgba(168,85,247,0.3) 100%)' : 'rgba(129,140,248,0.25)') 
                  : 'rgba(255,255,255,0.03)',
                color: activeTab === t.id ? '#ffffff' : 'var(--t2)',
                fontSize: '.85rem',
                fontWeight: activeTab === t.id ? 900 : 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: (activeTab === t.id && t.glow) ? '0 0 16px rgba(236,72,153,0.4)' : 'none'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div>
          <input
            type="text"
            placeholder="발굴 종목 검색..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            style={{
              padding: '8px 14px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: '#fff',
              fontSize: '.85rem',
              outline: 'none',
              width: 180
            }}
          />
        </div>
      </div>

      {/* ─── 3. 메인 콘텐츠 리스트 ─── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--gold)', fontSize: '1.1rem', fontWeight: 800 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⏳</div>
          80여 개 주요 상장사 3개년 IFRS 재무제표 수집 및 4대 AND 조건 정밀 연산 중...
        </div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', background: 'var(--bg2)', borderRadius: 16, border: '1px dashed var(--border)', color: 'var(--t3)' }}>
          조건에 부합하는 종목이 없습니다.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          {list.map((stock, idx) => {
            const isPerfect = stock.isPerfectMatch || activeTab === 'perfect';
            return (
              <div
                key={stock.code || idx}
                onClick={() => onSelectStock && onSelectStock(stock)}
                style={{
                  padding: '20px 22px',
                  background: isPerfect 
                    ? 'linear-gradient(135deg, rgba(30, 27, 75, 0.7) 0%, rgba(15, 23, 42, 0.95) 100%)' 
                    : 'var(--bg2)',
                  borderRadius: 16,
                  border: isPerfect ? '1.8px solid rgba(236, 72, 153, 0.6)' : '1px solid var(--border)',
                  boxShadow: isPerfect ? '0 10px 30px rgba(236, 72, 153, 0.2)' : '0 4px 14px rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.borderColor = isPerfect ? '#ec4899' : 'var(--accent)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = isPerfect ? 'rgba(236, 72, 153, 0.6)' : 'var(--border)';
                }}
              >
                {/* 상단 뱃지 & 종목 헤더 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#ffffff' }}>
                        {stock.name}
                      </span>
                      <span style={{ fontSize: '.8rem', color: 'var(--t3)', fontFamily: 'Space Mono' }}>
                        {stock.code}
                      </span>
                      <span style={{
                        fontSize: '.68rem',
                        background: stock.market === 'KOSPI' ? 'rgba(56, 189, 248, 0.18)' : 'rgba(168, 85, 247, 0.18)',
                        color: stock.market === 'KOSPI' ? '#38bdf8' : '#c084fc',
                        border: `1px solid ${stock.market === 'KOSPI' ? 'rgba(56, 189, 248, 0.4)' : 'rgba(168, 85, 247, 0.4)'}`,
                        padding: '1px 6px',
                        borderRadius: 6,
                        fontWeight: 800
                      }}>
                        {stock.market}
                      </span>
                    </div>
                    <div style={{ fontSize: '.75rem', color: 'var(--t3)', marginTop: 2 }}>
                      분석 기준: {stock.startYear} ~ {stock.endYear} (3개년 누적)
                    </div>
                  </div>

                  {isPerfect ? (
                    <div style={{
                      padding: '4px 10px',
                      background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)',
                      color: '#fff',
                      borderRadius: 14,
                      fontSize: '.74rem',
                      fontWeight: 900,
                      boxShadow: '0 0 12px rgba(236,72,153,0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <span>🎯</span>
                      <span>4대 AND 올킬</span>
                    </div>
                  ) : (
                    <div style={{
                      padding: '3px 8px',
                      background: 'rgba(255,255,255,0.06)',
                      color: 'var(--gold)',
                      borderRadius: 8,
                      fontSize: '.72rem',
                      fontWeight: 800
                    }}>
                      {stock.rank ? `TOP ${stock.rank}위` : `${stock.matchedCount || 2}개 조건 만족`}
                    </div>
                  )}
                </div>

                {/* 4대 핵심 지표 2x2 그리드 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  padding: '12px 14px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: 12,
                  marginBottom: 14,
                  border: '1px solid rgba(255,255,255,0.06)'
                }}>
                  {/* 1. 자산 증가율 */}
                  <div>
                    <div style={{ fontSize: '.7rem', color: '#c084fc', fontWeight: 800 }}>🏢 자산 증가율</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff', fontFamily: 'Space Mono', marginTop: 1 }}>
                      {stock.assetGrowthRate !== null ? `+${stock.assetGrowthRate}%` : '-'}
                    </div>
                  </div>

                  {/* 2. 영업이익 증가율 */}
                  <div>
                    <div style={{ fontSize: '.7rem', color: '#f87171', fontWeight: 800 }}>📈 영업익 증가율</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#ef4444', fontFamily: 'Space Mono', marginTop: 1 }}>
                      {stock.opProfitGrowthRate !== null ? `+${stock.opProfitGrowthRate}%` : '-'}
                    </div>
                  </div>

                  {/* 3. 매출액 증가율 */}
                  <div>
                    <div style={{ fontSize: '.7rem', color: '#fbbf24', fontWeight: 800 }}>💰 매출액 증가율</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#f59e0b', fontFamily: 'Space Mono', marginTop: 1 }}>
                      {stock.revenueGrowthRate !== null ? `+${stock.revenueGrowthRate}%` : '-'}
                    </div>
                  </div>

                  {/* 4. 부채비율 */}
                  <div>
                    <div style={{ fontSize: '.7rem', color: '#34d399', fontWeight: 800 }}>🛡️ 부채비율 (≤120%)</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 900, color: stock.debtRatio <= 120 ? '#10b981' : '#f87171', fontFamily: 'Space Mono', marginTop: 1 }}>
                      {stock.debtRatio !== null ? `${stock.debtRatio}%` : '-'}
                    </div>
                  </div>
                </div>

                {/* 3개년 연도별 실적 미니 카드 트렌드 */}
                {stock.history && stock.history.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stock.history.length}, 1fr)`, gap: 6, marginBottom: 12 }}>
                    {stock.history.map((h, hIdx) => (
                      <div key={hIdx} style={{
                        padding: '6px 8px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: 8,
                        fontSize: '.68rem',
                        textAlign: 'center',
                        border: '1px solid rgba(255,255,255,0.04)'
                      }}>
                        <div style={{ color: 'var(--t3)', fontWeight: 700 }}>{h.year}</div>
                        <div style={{ color: '#fff', fontWeight: 800, marginTop: 1 }}>
                          {h.revenue ? `${Math.round(h.revenue).toLocaleString()}억` : '-'}
                        </div>
                        <div style={{ color: h.opProfit >= 0 ? '#10b981' : '#ef4444', fontWeight: 800 }}>
                          영 {h.opProfit ? `${Math.round(h.opProfit).toLocaleString()}억` : '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 하단 클릭 액션 가이드 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px dashed rgba(255,255,255,0.08)', fontSize: '.74rem', color: 'var(--t3)' }}>
                  <span>ROE: <strong style={{ color: '#c084fc' }}>{stock.roe || '-'}%</strong> · PER: <strong style={{ color: '#fff' }}>{stock.per || '-'}배</strong></span>
                  <span style={{ color: 'var(--accent)', fontWeight: 800 }}>👆 클릭 시 퀀트 차트 & 개요 보기 ➔</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
