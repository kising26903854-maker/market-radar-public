// SmartSupplyDemand.jsx — 🔥 외국인 & 기관 실시간 순매수 TOP 20 및 쌍끌이 수급 레이더
import React, { useState, useEffect } from 'react';

export default function SmartSupplyDemand({ onSelectStock }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [market, setMarket] = useState('KOSPI'); // 'KOSPI' | 'KOSDAQ'
  const [tab, setTab] = useState('DUAL'); // 'DUAL' | 'FOREIGN' | 'INST'

  const loadData = () => {
    setLoading(true);
    fetch('/api/smart-supply-demand')
      .then(res => res.json())
      .then(json => {
        if (json.success) setData(json);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 30000); // 30초 자동 갱신
    return () => clearInterval(timer);
  }, []);

  if (loading && !data) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--t2)', fontWeight: 700, fontSize: '1.2rem' }}>
        실시간 외국인·기관 수급 데이터 집계 중... (잠시만 기다려 주세요)
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--dn)' }}>
        수급 데이터를 불러오지 못했습니다. <button onClick={loadData} style={{ padding: '6px 12px', marginLeft: 10, borderRadius: 0 }}>다시 시도</button>
      </div>
    );
  }

  const marketData = market === 'KOSPI' ? data.kospi : data.kosdaq;
  const dualList = marketData?.dual || [];
  const foreignList = marketData?.foreign || [];
  const instList = marketData?.inst || [];

  return (
    <div style={{ padding: '10px 0', animation: 'fadeIn 0.4s ease' }}>
      {/* 🌟 상단 헤더 배너 */}
      <div style={{
        padding: '22px 26px',
        background: 'var(--bg2)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 0,
        marginBottom: 18,
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span>외인·기관 실시간 쌍끌이 순매수 TOP 20 수급 레이더</span>
              <span style={{ fontSize: '.74rem', background: 'var(--accent)', color: '#fff', padding: '3px 10px', borderRadius: 0, fontWeight: 700 }}>
                실시간 30초 무소음 갱신
              </span>
            </div>
            <div style={{ fontSize: '.9rem', color: 'var(--t2)', marginTop: 6, lineHeight: 1.5 }}>
              외국인과 기관이 <strong>동시에 대량으로 쓸어담는 쌍끌이 주도주</strong>와 각각의 순매수 랭킹을 실시간 추적합니다.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ padding: '8px 14px', background: 'rgba(0,0,0,0.25)', borderRadius: 0, border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
              <div style={{ fontSize: '.7rem', color: 'var(--t3)', fontWeight: 700 }}>동시 쌍끌이 종목</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24', marginTop: 2 }}>{dualList.length}개 포착</div>
            </div>
            <button
              onClick={loadData}
              style={{ padding: '10px 16px', background: 'var(--accent)', border: 'none', borderRadius: 0, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '.88rem' }}
            >
              새로고침
            </button>
          </div>
        </div>
      </div>

      {/* ─── 시장 필터 & 탭 바 ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        {/* 코스피 / 코스닥 토글 */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.25)', padding: 3, borderRadius: 0 }}>
          {[
            { id: 'KOSPI', label: '코스피 수급' },
            { id: 'KOSDAQ', label: '코스닥 수급' }
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setMarket(m.id)}
              style={{
                padding: '8px 16px',
                borderRadius: 0,
                border: 'none',
                background: market === m.id ? 'var(--accent)' : 'transparent',
                color: market === m.id ? '#fff' : 'var(--t3)',
                fontSize: '.85rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* 세부 탭 (쌍끌이 / 외인 TOP20 / 기관 TOP20) */}
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.25)', padding: 3, borderRadius: 0 }}>
          {[
            { id: 'DUAL', label: `동시 쌍끌이 (${dualList.length})` },
            { id: 'FOREIGN', label: `외국인 순매수 TOP 20 (${foreignList.length})` },
            { id: 'INST', label: `기관 순매수 TOP 20 (${instList.length})` }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '7px 14px',
                borderRadius: 0,
                border: 'none',
                background: tab === t.id ? 'var(--accent)' : 'transparent',
                color: tab === t.id ? '#fff' : 'var(--t3)',
                fontSize: '.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 쌍끌이 매수 종목 뷰 (DUAL TAB) ─── */}
      {tab === 'DUAL' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
          {dualList.map((item, idx) => (
            <div
              key={idx}
              className="card stock-card"
              onClick={() => onSelectStock && onSelectStock({ ...item, currentPrice: item.price })}
              style={{
                background: 'var(--bg2)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 0,
                padding: '20px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fbbf24' }}>#{idx + 1}</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>{item.name}</span>
                  <span style={{ fontSize: '.8rem', color: 'var(--t3)' }}>({item.code})</span>
                </div>
                <span style={{ fontSize: '.72rem', background: 'rgba(239,68,68,0.2)', color: '#f87171', padding: '3px 9px', borderRadius: 0, fontWeight: 700, border: '1px solid rgba(239,68,68,0.4)' }}>
                  외인+기관 쌍끌이
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--t1)' }}>
                  {item.price ? `${item.price.toLocaleString()}원` : '-'}
                  <span style={{ fontSize: '.85rem', marginLeft: 8, color: (item.change || '').includes('-') ? 'var(--dn)' : 'var(--up)' }}>
                    {item.change}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '.7rem', color: 'var(--t3)' }}>총 순매수 합계</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fbbf24' }}>{item.totalAmountText}</div>
                </div>
              </div>

              {/* 외인 & 기관 각 순매수 대금 배지 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'rgba(0,0,0,0.25)', padding: '10px 12px', borderRadius: 0 }}>
                <div>
                  <div style={{ fontSize: '.7rem', color: '#60a5fa', fontWeight: 700 }}>외국인 순매수 (#{item.foreignRank}위)</div>
                  <div style={{ fontSize: '.95rem', fontWeight: 800, color: '#fff', marginTop: 2 }}>{item.foreignAmount}</div>
                </div>
                <div>
                  <div style={{ fontSize: '.7rem', color: '#34d399', fontWeight: 700 }}>기관계 순매수 (#{item.instRank}위)</div>
                  <div style={{ fontSize: '.95rem', fontWeight: 800, color: '#fff', marginTop: 2 }}>{item.instAmount}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <span style={{ fontSize: '.74rem', color: 'var(--accent)', fontWeight: 700 }}>
                  차트 & 퀀트 분석 ➔
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── 단일 순매수 랭킹 뷰 (FOREIGN OR INST TAB) ─── */}
      {tab !== 'DUAL' && (
        <div style={{ background: 'var(--bg2)', borderRadius: 0, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '.88rem' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid var(--border)', color: 'var(--t3)', fontSize: '.78rem' }}>
                <th style={{ padding: '14px 16px', width: 60 }}>순위</th>
                <th style={{ padding: '14px 16px' }}>종목명</th>
                <th style={{ padding: '14px 16px' }}>현재가</th>
                <th style={{ padding: '14px 16px' }}>등락률</th>
                <th style={{ padding: '14px 16px', textAlign: 'right' }}>순매수 대금</th>
                <th style={{ padding: '14px 16px', textAlign: 'center' }}>상세</th>
              </tr>
            </thead>
            <tbody>
              {(tab === 'FOREIGN' ? foreignList : instList).map((item, idx) => (
                <tr
                  key={idx}
                  onClick={() => onSelectStock && onSelectStock({ ...item, currentPrice: item.price })}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '14px 16px', fontWeight: 800, color: idx < 3 ? '#fbbf24' : 'var(--t3)' }}>
                    {idx + 1}
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 800, color: '#fff' }}>
                    {item.name} <span style={{ fontSize: '.75rem', color: 'var(--t3)', fontWeight: 500 }}>({item.code})</span>
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--t1)' }}>
                    {item.price ? `${item.price.toLocaleString()}원` : '-'}
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: 800, color: (item.change || '').includes('-') ? 'var(--dn)' : 'var(--up)' }}>
                    {item.change}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 800, color: tab === 'FOREIGN' ? '#60a5fa' : '#34d399', fontFamily: 'Space Mono' }}>
                    {item.amountText}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <span style={{ fontSize: '.75rem', color: 'var(--accent)', fontWeight: 800 }}>차트보기 ➔</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
