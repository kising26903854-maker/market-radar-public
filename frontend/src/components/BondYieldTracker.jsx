// BondYieldTracker.jsx — 📈 글로벌 국채금리, 실시간 채권가격(Clean Price), 듀레이션 & 매크로 일드커브 분석기
import React, { useState, useEffect } from 'react';

export default function BondYieldTracker() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'US' | 'SPREAD' | 'KR' | 'CURRENCY'
  const [refreshing, setRefreshing] = useState(false);

  const fetchYields = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch('/api/bond-yields');
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      const result = await res.json();
      if (result.success) {
        setData(result);
        setError(null);
      } else {
        throw new Error('국채금리 데이터를 불러오지 못했습니다.');
      }
    } catch (err) {
      console.error(err);
      if (!isSilent) setError(err.message);
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchYields();
    // 30초 주기 실시간 자동 갱신
    const timer = setInterval(() => {
      fetchYields(true);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchYields(false);
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--gold)', fontSize: '1.2rem', fontWeight: 800 }}>
        📈 글로벌 국채금리 및 미국 30년물 일드커브·채권가격 분석 데이터 집계 중...
      </div>
    );
  }

  const sections = data?.sections || {};
  const usBonds = sections.usBonds || [];
  const krBonds = sections.krBonds || [];
  const macroSpreads = sections.macroSpreads || [];
  const currencies = sections.currencies || [];
  const usCurve = data?.yieldCurve?.usCurve || [];

  return (
    <div style={{ padding: '10px 0', animation: 'fadeIn 0.3s ease-in-out' }}>
      {/* ─── 상단 메인 배너 ─── */}
      <div style={{
        padding: '26px 30px',
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(99, 102, 241, 0.18) 100%)',
        border: '2px solid rgba(239, 68, 68, 0.4)',
        borderRadius: 22,
        marginBottom: 24,
        boxShadow: '0 10px 36px rgba(0,0,0,0.45)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ filter: 'drop-shadow(0 0 10px #ef4444)' }}>📈 글로벌 국채금리 &amp; 국채가격 실시간 분석기</span>
              <span style={{ fontSize: '.75rem', background: '#ef4444', color: '#fff', padding: '3px 10px', borderRadius: 20, fontWeight: 900 }}>
                ⚡ 실시간 금리 ↔ 가격 연동
              </span>
            </div>
            <div style={{ fontSize: '.9rem', color: 'var(--t2)', marginTop: 6, lineHeight: 1.6 }}>
              미국 국채 풀라인업(<strong>30Y 초장기물</strong> / 10Y / 5Y / 2Y / 3M) · 한국 국고채 · <strong>이론 채권가격(Clean Price) &amp; 듀레이션</strong> · 경기침체 스프레드 종합 추적
            </div>
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            style={{
              padding: '10px 18px',
              background: refreshing ? 'rgba(239,68,68,0.3)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              border: 'none',
              borderRadius: 12,
              color: '#fff',
              fontWeight: 900,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              fontSize: '.9rem',
              boxShadow: '0 4px 14px rgba(239,68,68,0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span>{refreshing ? '⏳' : '🔄'}</span>
            <span>{refreshing ? '시세 갱신 중...' : '실시간 금리·가격 갱신'}</span>
          </button>
        </div>

        {/* ─── 💡 핵심 원리: 금리 ↔ 채권가격 반비례 공식 안내 배너 ─── */}
        <div style={{
          marginTop: 18,
          padding: '12px 18px',
          background: 'rgba(0,0,0,0.35)',
          borderRadius: 14,
          border: '1px solid rgba(234,179,8,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '1.2rem' }}>⚖️</span>
          <div style={{ fontSize: '.84rem', color: 'var(--t1)', lineHeight: 1.5, flex: 1 }}>
            <strong style={{ color: 'var(--gold)' }}>채권 가격 산출 핵심 원리:</strong> 국채 금리(수익률)와 국채 가격은 <strong>반비례(역의 관계)</strong>합니다.
            <span style={{ marginLeft: 8, color: '#34d399', fontWeight: 800 }}>금리 하락(▼) ➔ 채권가격 상승(▲)</span> |
            <span style={{ marginLeft: 8, color: '#f87171', fontWeight: 800 }}>금리 상승(▲) ➔ 채권가격 하락(▼)</span>
          </div>
        </div>

        {/* ─── 🇺🇸 미국 국채 일드커브 (금리 & 채권가격) 동시 시각화 ─── */}
        {usCurve.length > 0 && (
          <div style={{
            marginTop: 16,
            padding: '16px 20px',
            background: 'rgba(0,0,0,0.45)',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.08)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: '.85rem', fontWeight: 800, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🇺🇸</span>
                <span>미국 국채 만기별 일드커브 (Yield Curve) &amp; 환산 채권가격:</span>
              </div>
              <div style={{
                fontSize: '.78rem',
                fontWeight: 900,
                padding: '2px 10px',
                borderRadius: 12,
                background: data?.yieldCurve?.isInverted ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                border: `1px solid ${data?.yieldCurve?.isInverted ? '#ef4444' : '#10b981'}`,
                color: data?.yieldCurve?.isInverted ? '#f87171' : '#34d399'
              }}>
                {data?.yieldCurve?.isInverted ? '🔴 일드커브 역전 (경기침체 경보)' : '🟢 정상 우상향 일드커브'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
              {usCurve.map((c, i) => (
                <div
                  key={c.term}
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.06)',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '.74rem', color: 'var(--t3)', fontWeight: 800 }}>{c.term} 만기</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', marginTop: 3, fontFamily: 'Space Mono' }}>
                    {c.rate ? `${c.rate.toFixed(3)}%` : '-'}
                  </div>
                  {c.price && (
                    <div style={{ fontSize: '.76rem', color: 'var(--gold)', marginTop: 2, fontFamily: 'Space Mono', fontWeight: 800 }}>
                      💵 {c.price}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── 탭 필터 바 ─── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { id: 'ALL', label: `🌐 전체 종합 대시보드 (${data?.data?.length || 15})` },
          { id: 'US', label: `🇺🇸 미국 국채 & 국채가격 (${usBonds.length})` },
          { id: 'SPREAD', label: `⚡ 경기침체 & 매크로 스프레드 (${macroSpreads.length})` },
          { id: 'KR', label: `🇰🇷 한국 국고채 & 국채가격 (${krBonds.length})` },
          { id: 'CURRENCY', label: `💵 글로벌 외환 & 달러 (${currencies.length})` }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '9px 16px',
              borderRadius: 14,
              border: activeTab === t.id ? '1.5px solid #ef4444' : '1px solid rgba(255,255,255,0.08)',
              background: activeTab === t.id ? 'linear-gradient(135deg, rgba(239,68,68,0.3) 0%, rgba(185,28,28,0.2) 100%)' : 'rgba(0,0,0,0.3)',
              color: activeTab === t.id ? '#ffffff' : 'var(--t3)',
              fontSize: '.85rem',
              fontWeight: 900,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: activeTab === t.id ? '0 0 14px rgba(239,68,68,0.35)' : 'none'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── 1. 🇺🇸 미국 국채 풀라인업 & 실시간 채권가격 ─── */}
      {(activeTab === 'ALL' || activeTab === 'US') && (
        <div style={{ marginBottom: 30 }}>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fff', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🇺🇸</span>
            <span>미국 국채 (US Treasury) 수익률 &amp; 실시간 국채가격 (Par $100 기준)</span>
            <span style={{ fontSize: '.75rem', background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>30Y ~ 3M</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
            {usBonds.map(item => {
              const bp = item.bondPrice || {};
              const etf = item.benchmarkEtf;

              return (
                <div
                  key={item.id}
                  style={{
                    padding: '22px 24px',
                    background: 'rgba(30, 41, 59, 0.75)',
                    border: item.type === '30Y' ? '1.8px solid #fbbf24' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 18,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = item.type === '30Y' ? '#fbbf24' : 'rgba(255,255,255,0.08)'; }}
                >
                  {/* 상단 뱃지 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '.75rem', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>
                      🇺🇸 {item.badge}
                    </span>
                    <span style={{ fontSize: '.72rem', color: 'var(--t3)', fontFamily: 'Space Mono' }}>{item.type}</span>
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>{item.name}</div>
                  <div style={{ fontSize: '.78rem', color: 'var(--t3)', marginTop: 2 }}>{item.desc}</div>

                  {/* 1. 국채 수익률 (금리) */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12 }}>
                    <div>
                      <div style={{ fontSize: '.75rem', color: 'var(--t3)', fontWeight: 700 }}>국채 수익률 (YTM)</div>
                      <div style={{ fontSize: '2.0rem', fontWeight: 900, color: item.type === '30Y' ? 'var(--gold)' : '#fff', fontFamily: 'Space Mono', lineHeight: 1.1 }}>
                        {item.value ? `${item.value}%` : '-'}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '.82rem',
                      fontWeight: 800,
                      color: item.isUp ? 'var(--up)' : item.isDown ? 'var(--dn)' : 'var(--t3)',
                      fontFamily: 'Space Mono',
                      textAlign: 'right'
                    }}>
                      <span>{item.isUp ? '▲' : item.isDown ? '▼' : '−'}</span>
                      <span>{item.diff} ({item.diffPct || ''})</span>
                    </div>
                  </div>

                  {/* 2. 💵 [NEW] 환산 국채가격 (Clean Price, Par $100) */}
                  <div style={{
                    marginTop: 14,
                    padding: '12px 14px',
                    background: 'rgba(0,0,0,0.35)',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '.76rem', color: 'var(--t2)', fontWeight: 800 }}>
                        💵 이론 국채가격 (액면 $100 기준)
                      </span>
                      <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#10b981', fontFamily: 'Space Mono' }}>
                        {bp.formattedPrice || '$100.00'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: '.72rem', color: 'var(--t3)' }}>
                      <span>액면가 대비: <strong style={{ color: bp.diffFromPar?.startsWith('+') ? '#10b981' : '#f87171' }}>{bp.diffFromPar || '0.00%'}</strong></span>
                      <span>수정 듀레이션: <strong>{bp.duration || item.type}년</strong></span>
                    </div>
                    {bp.sensitivity10bp > 0 && (
                      <div style={{ fontSize: '.71rem', color: 'var(--gold)', marginTop: 4, fontWeight: 700 }}>
                        🎯 금리 10bp 하락 시 채권가격 <strong>+{bp.sensitivity10bp}%</strong> 상승
                      </div>
                    )}
                  </div>

                  {/* 3. 📊 연동 채권 ETF 시세 */}
                  {etf && (
                    <div style={{
                      marginTop: 10,
                      padding: '8px 12px',
                      background: 'rgba(59,130,246,0.1)',
                      borderRadius: 10,
                      border: '1px solid rgba(59,130,246,0.25)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '.78rem'
                    }}>
                      <span style={{ color: '#93c5fd', fontWeight: 800 }}>
                        📊 대표 ETF ({etf.ticker}): <strong style={{ color: '#fff' }}>{etf.price}</strong>
                      </span>
                      <span style={{ color: etf.isUp ? '#34d399' : '#f87171', fontWeight: 800, fontFamily: 'Space Mono' }}>
                        {etf.diff}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 2. ⚡ 경기침체 조기경보 & 매크로 스프레드 ─── */}
      {(activeTab === 'ALL' || activeTab === 'SPREAD') && (
        <div style={{ marginBottom: 30 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚡</span>
              <span>월가 퀀트 경기침체 조기경보 &amp; 매크로 스프레드</span>
              <span style={{ fontSize: '.75rem', background: '#f59e0b', color: '#000', padding: '2px 8px', borderRadius: 10, fontWeight: 900 }}>Recession Radar</span>
            </div>
          </div>

          {/* 💡 실전 투자 가이드 배너 */}
          <div style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(59, 130, 246, 0.12) 100%)',
            border: '1.5px solid rgba(16, 185, 129, 0.4)',
            borderRadius: 16,
            marginBottom: 16,
            boxShadow: '0 6px 20px rgba(0,0,0,0.25)'
          }}>
            <div style={{ fontSize: '.92rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span>💡</span>
              <span style={{ color: '#34d399' }}>초보자를 위한 1초 실전 투자 가이드: "지금 무엇을 사야 할까?"</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10, marginTop: 10, fontSize: '.84rem' }}>
              <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.12)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.3)' }}>
                <div style={{ fontWeight: 900, color: '#34d399', marginBottom: 2 }}>🟢 정상 구간 (현재 상황): 주식 매수 우호 환경</div>
                <div style={{ color: 'var(--t1)', lineHeight: 1.5 }}>
                  은행 대출 마진이 생겨 <strong>기업들의 설비 투자 및 이익이 증가</strong>합니다. ➔ <strong>주식(AI·반도체 우량주)을 적극 매수 &amp; 보유하기에 가장 좋은 시기</strong>입니다!
                </div>
              </div>
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.12)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)' }}>
                <div style={{ fontWeight: 900, color: '#f87171', marginBottom: 2 }}>🔴 역전 구간 (위험 경보): 국채/현금 피신 필요</div>
                <div style={{ color: 'var(--t1)', lineHeight: 1.5 }}>
                  은행이 대출을 조여 기업들이 돈맥경화에 빠집니다. ➔ <strong>주식 비중을 축소하고 안전한 미국 국채 및 현금을 확보(피신)</strong>해야 합니다.
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {macroSpreads.map(item => {
              const isNormal = item.status !== 'INVERTED';
              
              let actionGuide = '';
              if (item.id === 'spread_10y_2y') {
                actionGuide = isNormal 
                  ? '🎯 실전 가이드: 경기침체 공포가 걷히고 주식 시장 투자 환경이 매우 우호적입니다. 우량주 분할 매수 적기!'
                  : '⚠️ 실전 가이드: 1~2년 뒤 경기 침체 위험 80%+. 무리한 빚투를 줄이고 안전자산(국채/현금)을 늘리세요.';
              } else if (item.id === 'spread_10y_3m') {
                actionGuide = '🎯 실전 가이드: 뉴욕 연준 경기침체 확률 모델 5% 미만으로 단기 금융시장에 돈이 원활하게 돌고 있습니다.';
              } else if (item.id === 'credit_spread_kr') {
                actionGuide = '🎯 실전 가이드: 한국 대기업들의 회사채 조달이 원활하여 기업 부도 위험이 매우 낮습니다.';
              } else if (item.id === 'kr_us_10y_spread') {
                actionGuide = '🎯 실전 가이드: 미국 금리가 높아 달러 강세가 유지되므로 국내 수출 기업(반도체/자동차/K뷰티) 실적에 유리합니다.';
              }

              return (
                <div
                  key={item.id}
                  style={{
                    padding: '20px 22px',
                    background: 'rgba(30, 41, 59, 0.75)',
                    border: isNormal ? '1px solid rgba(255,255,255,0.08)' : '2px solid #ef4444',
                    borderRadius: 18,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    transition: 'transform 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '.72rem', background: 'rgba(234,179,8,0.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>
                      ⚡ {item.name}
                    </span>
                    <span style={{
                      fontSize: '.72rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: isNormal ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                      color: isNormal ? '#34d399' : '#f87171'
                    }}>
                      {item.statusLabel}
                    </span>
                  </div>

                  <div style={{ fontSize: '1.9rem', fontWeight: 900, color: isNormal ? '#fff' : '#f87171', marginTop: 10, fontFamily: 'Space Mono' }}>
                    {item.value}
                  </div>

                  <div style={{ fontSize: '.76rem', color: 'var(--t3)', marginTop: 4 }}>
                    {item.desc}
                  </div>

                  <div style={{
                    marginTop: 12,
                    padding: '10px 12px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.06)',
                    fontSize: '.78rem',
                    color: isNormal ? '#cbd5e1' : '#fca5a5',
                    lineHeight: 1.45
                  }}>
                    {actionGuide}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 3. 🇰🇷 대한민국 국고채 & 실시간 채권가격 ─── */}
      {(activeTab === 'ALL' || activeTab === 'KR') && (
        <div style={{ marginBottom: 30 }}>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fff', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🇰🇷</span>
            <span>대한민국 국고채 &amp; 실시간 채권가격 (액면 10,000원 기준)</span>
            <span style={{ fontSize: '.75rem', background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>한은 통화정책</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {krBonds.map(item => {
              const bp = item.bondPrice || {};
              const etf = item.benchmarkEtf;

              return (
                <div
                  key={item.id}
                  style={{
                    padding: '20px 22px',
                    background: 'rgba(30, 41, 59, 0.75)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 18,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: '.75rem', background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>
                      🇰🇷 {item.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff' }}>{item.name}</div>
                  <div style={{ fontSize: '.76rem', color: 'var(--t3)', marginTop: 2 }}>{item.desc}</div>

                  {/* 금리 수치 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 }}>
                    <div>
                      <div style={{ fontSize: '.75rem', color: 'var(--t3)', fontWeight: 700 }}>국채 수익률 (금리)</div>
                      <div style={{ fontSize: '1.9rem', fontWeight: 900, color: '#fff', fontFamily: 'Space Mono', lineHeight: 1.1 }}>
                        {item.value ? `${item.value}%` : '-'}
                      </div>
                    </div>
                    <div style={{
                      fontSize: '.82rem',
                      fontWeight: 800,
                      color: item.isUp ? 'var(--up)' : item.isDown ? 'var(--dn)' : 'var(--t3)',
                      fontFamily: 'Space Mono',
                      textAlign: 'right'
                    }}>
                      <span>{item.isUp ? '▲' : item.isDown ? '▼' : '−'}</span>
                      <span>{item.diff} ({item.diffPct || '전일대비'})</span>
                    </div>
                  </div>

                  {/* 💵 [NEW] 환산 국고채 가격 */}
                  {bp.formattedPrice && (
                    <div style={{
                      marginTop: 12,
                      padding: '10px 12px',
                      background: 'rgba(0,0,0,0.35)',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.06)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '.76rem', color: 'var(--t2)', fontWeight: 800 }}>
                          💵 이론 채권가격 (액면 1만원)
                        </span>
                        <span style={{ fontSize: '1.1rem', fontWeight: 900, color: '#34d399', fontFamily: 'Space Mono' }}>
                          {bp.formattedPrice}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, fontSize: '.72rem', color: 'var(--t3)' }}>
                        <span>액면 대비: <strong style={{ color: bp.diffFromPar?.startsWith('+') ? '#10b981' : '#f87171' }}>{bp.diffFromPar || '0.00%'}</strong></span>
                        {bp.duration && <span>듀레이션: <strong>{bp.duration}년</strong></span>}
                      </div>
                    </div>
                  )}

                  {/* 📊 국내 연동 채권 ETF */}
                  {etf && (
                    <div style={{
                      marginTop: 10,
                      padding: '8px 12px',
                      background: 'rgba(16,185,129,0.1)',
                      borderRadius: 10,
                      border: '1px solid rgba(16,185,129,0.25)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '.78rem'
                    }}>
                      <span style={{ color: '#6ee7b7', fontWeight: 800 }}>
                        📊 연동 ETF: <strong style={{ color: '#fff' }}>{etf.name}</strong>
                      </span>
                      <span style={{ color: '#fff', fontWeight: 800, fontFamily: 'Space Mono' }}>
                        {etf.price}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 4. 💵 글로벌 외환 & 달러 ─── */}
      {(activeTab === 'ALL' || activeTab === 'CURRENCY') && (
        <div style={{ marginBottom: 30 }}>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fff', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>💵</span>
            <span>글로벌 기축통화 &amp; 외환시장 (Currencies &amp; DXY)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {currencies.map(item => (
              <div
                key={item.id}
                style={{
                  padding: '22px 24px',
                  background: 'rgba(30, 41, 59, 0.75)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 18,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '.75rem', background: 'rgba(168,85,247,0.15)', color: '#c084fc', padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>
                    🌐 {item.badge}
                  </span>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>{item.name}</div>
                <div style={{ fontSize: '.78rem', color: 'var(--t3)', marginTop: 2 }}>{item.desc}</div>

                <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#fff', marginTop: 12, fontFamily: 'Space Mono' }}>
                  {item.value} {item.id === 'usdkrw' ? '원' : 'pt'}
                </div>

                <div style={{
                  fontSize: '.85rem',
                  fontWeight: 800,
                  color: item.isUp ? 'var(--up)' : item.isDown ? 'var(--dn)' : 'var(--t3)',
                  marginTop: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'Space Mono'
                }}>
                  <span>{item.isUp ? '▲' : item.isDown ? '▼' : '−'}</span>
                  <span>{item.diff} ({item.diffPct || ''})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
