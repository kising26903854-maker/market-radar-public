// GrowthStockScreener.jsx — 🚀 4대 재무 퀀트 엄격 AND 조건 종목 발굴기 (동적 체크박스 AND 필터 탑재)
import React, { useState, useEffect, useMemo } from 'react';

export default function GrowthStockScreener({ onSelectStock, onOpenValueChain }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  // 🎯 4대 조건 실시간 동적 체크박스 상태 (기본값: 4개 모두 선택된 AND 올킬 모드)
  const [selectedConditions, setSelectedConditions] = useState({
    asset: true, // 조건 1: 최근 3개년 자산 증가율 TOP 20
    op: true,    // 조건 2: 최근 3개년 영업이익 증가율 TOP 20
    debt: true,  // 조건 3: 부채비율 120% 이하 (재무 건전성)
    rev: true    // 조건 4: 최근 3개년 매출액 증가율 TOP 20
  });

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

  const toggleCondition = (key) => {
    setSelectedConditions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const selectAll = () => {
    setSelectedConditions({
      asset: true,
      op: true,
      debt: true,
      rev: true
    });
  };

  const deselectAll = () => {
    setSelectedConditions({
      asset: false,
      op: false,
      debt: false,
      rev: false
    });
  };

  const activeCount = useMemo(() => {
    return Object.values(selectedConditions).filter(Boolean).length;
  }, [selectedConditions]);

  // 🔍 체크된 조건들의 실시간 동적 AND 결합 필터링
  const filteredList = useMemo(() => {
    if (!data) return [];
    const pool = data.allStocks || data.perfectMatches || [];

    if (activeCount === 0) return [];

    let res = pool.filter(stock => {
      if (selectedConditions.asset && !stock.inTopAsset) return false;
      if (selectedConditions.op && !stock.inTopOp) return false;
      if (selectedConditions.debt && !stock.isSoundDebt) return false;
      if (selectedConditions.rev && !stock.inTopRev) return false;
      return true;
    });

    if (searchFilter.trim()) {
      const q = searchFilter.trim().toLowerCase();
      res = res.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.code.includes(q)
      );
    }

    return res;
  }, [data, selectedConditions, activeCount, searchFilter]);

  // 4대 조건 정의 목록
  const conditionsConfig = [
    {
      id: 'asset',
      title: '자산 증가율 TOP 20',
      subtitle: '최근 3개년 외형 자산 성장',
      icon: '🏢',
      color: '#c084fc',
      borderActive: '#c084fc',
      bgActive: 'rgba(192, 132, 252, 0.18)',
      statCount: data?.summary?.topAssetCount || 20
    },
    {
      id: 'op',
      title: '영업익 증가율 TOP 20',
      subtitle: '최근 3개년 본업 이익 폭발력',
      icon: '📈',
      color: '#f87171',
      borderActive: '#ef4444',
      bgActive: 'rgba(239, 68, 68, 0.18)',
      statCount: data?.summary?.topOpCount || 20
    },
    {
      id: 'debt',
      title: '부채비율 120% 이하',
      subtitle: '부도 위험 없는 안전 재무',
      icon: '🛡️',
      color: '#34d399',
      borderActive: '#10b981',
      bgActive: 'rgba(16, 185, 129, 0.18)',
      statCount: data?.summary?.soundDebtCount || '건전'
    },
    {
      id: 'rev',
      title: '매출액 증가율 TOP 20',
      subtitle: '최근 3개년 전방 수요 급증',
      icon: '💰',
      color: '#fbbf24',
      borderActive: '#f59e0b',
      bgActive: 'rgba(234, 179, 8, 0.18)',
      statCount: data?.summary?.topRevCount || 20
    }
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* ─── 1. 상단 타이틀 & 스캔 새로고침 헤더 ─── */}
      <div style={{
        padding: '22px 26px',
        background: 'var(--bg2)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 0,
        marginBottom: 20,
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.3px' }}>
                  4대 재무 퀀트 맞춤형 종목 발굴기
                </h1>
                <div style={{ fontSize: '.84rem', color: 'var(--t2)', marginTop: 3 }}>
                  원하는 조건을 상단 체크박스로 자유롭게 선택하세요. 선택된 조건들을 <strong>실시간 AND 결합</strong>하여 종목을 정밀 발굴합니다.
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => loadData(true)}
              disabled={refreshing || loading}
              style={{
                padding: '9px 16px',
                background: refreshing ? 'rgba(255,255,255,0.08)' : 'var(--accent)',
                border: 'none',
                borderRadius: 0,
                color: '#fff',
                fontSize: '.85rem',
                fontWeight: 700,
                cursor: refreshing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s'
              }}
            >
              <span>{refreshing ? '퀀트 재계산 중...' : '4대 퀀트 스캔 새로고침'}</span>
            </button>
          </div>
        </div>

        {/* ─── ⚡ 상단 4대 조건 인터랙티브 체크박스 카드 바 (핵심 신규 기능) ─── */}
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>체크박스를 클릭하여 원하는 AND 조건을 결합하세요</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={selectAll}
                style={{
                  padding: '4px 10px',
                  background: activeCount === 4 ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                  border: 'none',
                  color: activeCount === 4 ? '#fff' : 'var(--t2)',
                  borderRadius: 0,
                  fontSize: '.75rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                전체 선택 (4대 올킬)
              </button>
              <button
                onClick={deselectAll}
                style={{
                  padding: '4px 10px',
                  background: 'rgba(255,255,255,0.06)',
                  border: 'none',
                  color: 'var(--t3)',
                  borderRadius: 0,
                  fontSize: '.75rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                전체 해제
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
            {conditionsConfig.map(c => {
              const isChecked = !!selectedConditions[c.id];
              return (
                <div
                  key={c.id}
                  onClick={() => toggleCondition(c.id)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 0,
                    cursor: 'pointer',
                    background: isChecked ? 'rgba(129,140,248,0.14)' : 'rgba(0,0,0,0.35)',
                    border: isChecked ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                    transition: 'all 0.18s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none'
                  }}
                  onMouseEnter={e => {
                    if (!isChecked) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
                  }}
                  onMouseLeave={e => {
                    if (!isChecked) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: 0,
                      background: isChecked ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                      border: isChecked ? 'none' : '1.5px solid var(--t3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '.9rem',
                      fontWeight: 800,
                      transition: 'all 0.15s'
                    }}>
                      {isChecked ? '✓' : ''}
                    </div>
                    <div>
                      <div style={{ fontSize: '.88rem', fontWeight: 800, color: isChecked ? '#ffffff' : 'var(--t2)' }}>
                        {c.title}
                      </div>
                      <div style={{ fontSize: '.72rem', color: isChecked ? 'var(--t2)' : 'var(--t3)', marginTop: 2 }}>
                        {c.subtitle}
                      </div>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '.72rem',
                    padding: '2px 7px',
                    borderRadius: 0,
                    background: isChecked ? 'rgba(0,0,0,0.3)' : 'transparent',
                    color: isChecked ? '#fff' : 'var(--t3)',
                    fontFamily: 'Space Mono',
                    fontWeight: 700
                  }}>
                    {isChecked ? 'AND ON' : 'OFF'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── 2. 동적 AND 결과 브리핑 배너 & 검색창 ─── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
        padding: '14px 18px',
        background: 'var(--bg2)',
        borderRadius: 0,
        border: '1px solid rgba(255,255,255,0.08)'
      }}>
        {/* 결과 카운터 뱃지 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontSize: '.95rem', fontWeight: 800, color: '#fff' }}>
              {activeCount === 4 ? (
                <span>4대 재무 퀀트 올킬 (전체 4개 조건 AND 만족)</span>
              ) : activeCount > 0 ? (
                <span>선택된 {activeCount}개 조건 동시 만족 (AND 결합 필터)</span>
              ) : (
                <span style={{ color: '#f87171' }}>선택된 조건이 없습니다. 상단 체크박스를 선택해주세요.</span>
              )}
            </div>
            <div style={{ fontSize: '.76rem', color: 'var(--t2)', marginTop: 2 }}>
              {activeCount > 0
                ? `총 ${filteredList.length}개 종목이 선택된 조건을 모두 통과했습니다.`
                : '최소 1개 이상의 조건을 체크하시면 실시간으로 종목이 발굴됩니다.'}
            </div>
          </div>
        </div>

        {/* 종목 수 칩 & 종목 검색창 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            padding: '6px 14px',
            background: 'rgba(0,0,0,0.4)',
            borderRadius: 0,
            border: '1px solid rgba(255,255,255,0.1)',
            fontSize: '.85rem',
            fontWeight: 800,
            color: activeCount > 0 ? 'var(--t1)' : 'var(--t3)',
            fontFamily: 'Space Mono'
          }}>
            발굴: {filteredList.length} 종목
          </div>

          <input
            type="text"
            placeholder="발굴 종목 검색..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            style={{
              padding: '8px 14px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid var(--border)',
              borderRadius: 0,
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
        <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--t2)', fontSize: '1.1rem', fontWeight: 700 }}>
          80여 개 주요 상장사 3개년 IFRS 재무제표 수집 및 맞춤형 퀀트 연산 중...
        </div>
      ) : activeCount === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', background: 'var(--bg2)', borderRadius: 0, border: '1px dashed var(--border)', color: 'var(--t3)' }}>
          상단에서 원하시는 재무 퀀트 조건을 1개 이상 체크해주세요.
        </div>
      ) : filteredList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', background: 'var(--bg2)', borderRadius: 0, border: '1px dashed var(--border)', color: 'var(--t3)' }}>
          선택하신 {activeCount}개 AND 조건을 동시에 모두 만족하는 종목이 유니버스 내에 없습니다.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          {filteredList.map((stock, idx) => {
            const isPerfect = stock.isPerfectMatch;
            return (
              <div
                key={stock.code || idx}
                onClick={() => onSelectStock && onSelectStock(stock)}
                style={{
                  padding: '20px 22px',
                  background: 'var(--bg2)',
                  borderRadius: 0,
                  border: isPerfect ? '1px solid var(--accent)' : '1px solid var(--border)',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.borderColor = 'var(--accent)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = isPerfect ? 'var(--accent)' : 'var(--border)';
                }}
              >
                {/* 상단 뱃지 & 종목 헤더 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff' }}>
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
                        borderRadius: 0,
                        fontWeight: 700
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
                      background: 'var(--accent)',
                      color: '#fff',
                      borderRadius: 0,
                      fontSize: '.74rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <span>4대 AND 올킬</span>
                    </div>
                  ) : (
                    <div style={{
                      padding: '3px 8px',
                      background: 'rgba(255,255,255,0.06)',
                      color: 'var(--t2)',
                      borderRadius: 0,
                      fontSize: '.72rem',
                      fontWeight: 700
                    }}>
                      {stock.matchedCount ? `${stock.matchedCount}개 조건 만족` : '조건 일치'}
                    </div>
                  )}
                </div>

                {/* 4대 조건 만족 태그 칩스 */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span style={{
                    fontSize: '.68rem',
                    padding: '2px 7px',
                    borderRadius: 0,
                    background: stock.inTopAsset ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.04)',
                    color: stock.inTopAsset ? 'var(--t1)' : 'var(--t3)',
                    border: `1px solid ${stock.inTopAsset ? 'var(--accent)' : 'transparent'}`,
                    fontWeight: 700
                  }}>
                    {stock.inTopAsset ? '✓ 자산 TOP20' : '자산 미달'}
                  </span>
                  <span style={{
                    fontSize: '.68rem',
                    padding: '2px 7px',
                    borderRadius: 0,
                    background: stock.inTopOp ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.04)',
                    color: stock.inTopOp ? 'var(--t1)' : 'var(--t3)',
                    border: `1px solid ${stock.inTopOp ? 'var(--accent)' : 'transparent'}`,
                    fontWeight: 700
                  }}>
                    {stock.inTopOp ? '✓ 영업익 TOP20' : '영업익 미달'}
                  </span>
                  <span style={{
                    fontSize: '.68rem',
                    padding: '2px 7px',
                    borderRadius: 0,
                    background: stock.isSoundDebt ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.04)',
                    color: stock.isSoundDebt ? 'var(--t1)' : 'var(--t3)',
                    border: `1px solid ${stock.isSoundDebt ? 'var(--accent)' : 'transparent'}`,
                    fontWeight: 700
                  }}>
                    {stock.isSoundDebt ? '✓ 부채 ≤120%' : '부채 초과'}
                  </span>
                  <span style={{
                    fontSize: '.68rem',
                    padding: '2px 7px',
                    borderRadius: 0,
                    background: stock.inTopRev ? 'rgba(129,140,248,0.15)' : 'rgba(255,255,255,0.04)',
                    color: stock.inTopRev ? 'var(--t1)' : 'var(--t3)',
                    border: `1px solid ${stock.inTopRev ? 'var(--accent)' : 'transparent'}`,
                    fontWeight: 700
                  }}>
                    {stock.inTopRev ? '✓ 매출 TOP20' : '매출 미달'}
                  </span>
                </div>

                {/* 4대 핵심 지표 2x2 그리드 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  padding: '12px 14px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: 0,
                  marginBottom: 14,
                  border: '1px solid rgba(255,255,255,0.06)'
                }}>
                  {/* 1. 자산 증가율 */}
                  <div>
                    <div style={{ fontSize: '.7rem', color: 'var(--t3)', fontWeight: 700 }}>자산 증가율</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', fontFamily: 'Space Mono', marginTop: 1 }}>
                      {stock.assetGrowthRate !== null ? `+${stock.assetGrowthRate}%` : '-'}
                    </div>
                  </div>

                  {/* 2. 영업이익 증가율 */}
                  <div>
                    <div style={{ fontSize: '.7rem', color: 'var(--t3)', fontWeight: 700 }}>영업익 증가율</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', fontFamily: 'Space Mono', marginTop: 1 }}>
                      {stock.opProfitGrowthRate !== null ? `+${stock.opProfitGrowthRate}%` : '-'}
                    </div>
                  </div>

                  {/* 3. 매출액 증가율 */}
                  <div>
                    <div style={{ fontSize: '.7rem', color: 'var(--t3)', fontWeight: 700 }}>매출액 증가율</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', fontFamily: 'Space Mono', marginTop: 1 }}>
                      {stock.revenueGrowthRate !== null ? `+${stock.revenueGrowthRate}%` : '-'}
                    </div>
                  </div>

                  {/* 4. 부채비율 */}
                  <div>
                    <div style={{ fontSize: '.7rem', color: 'var(--t3)', fontWeight: 700 }}>부채비율 (≤120%)</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: stock.debtRatio <= 120 ? '#10b981' : '#f87171', fontFamily: 'Space Mono', marginTop: 1 }}>
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
                        borderRadius: 0,
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
                  <span>ROE: <strong style={{ color: '#fff' }}>{stock.roe || '-'}%</strong> · PER: <strong style={{ color: '#fff' }}>{stock.per || '-'}배</strong></span>
                  <span style={{ color: 'var(--accent)', fontWeight: 700 }}>클릭 시 퀀트 차트 & 개요 보기 ➔</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
