// MomentumScanner.jsx — ⚡ 52주 신고가 돌파 & 20-60일선 골든크로스 모멘텀 감시기
import React, { useState, useEffect } from 'react';

export default function MomentumScanner({ onSelectStock }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('HIGH52'); // 'HIGH52' | 'GOLDEN_CROSS'

  const loadData = () => {
    setLoading(true);
    fetch('/api/momentum-stocks')
      .then(res => res.json())
      .then(json => {
        if (json.success) setData(json);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 30000);
    return () => clearInterval(timer);
  }, []);

  if (loading && !data) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: '#f59e0b', fontWeight: 800, fontSize: '1.2rem' }}>
        ⚡ 실시간 52주 신고가 및 골든크로스 모멘텀 종목 스캔 중...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--dn)' }}>
        모멘텀 데이터를 불러오지 못했습니다. <button onClick={loadData} style={{ padding: '6px 12px', marginLeft: 10 }}>🔄 다시 시도</button>
      </div>
    );
  }

  const { high52 = [], goldenCross = [], summary = {} } = data;

  return (
    <div style={{ padding: '10px 0', animation: 'fadeIn 0.4s ease' }}>
      {/* 🌟 헤더 배너 */}
      <div style={{
        padding: '24px 28px',
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(239, 68, 68, 0.15) 50%, rgba(30, 41, 59, 0.8) 100%)',
        border: '2px solid rgba(245, 158, 11, 0.5)',
        borderRadius: 22,
        marginBottom: 20,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span>⚡ 52주 신고가 돌파 & 골든크로스 모멘텀 감시기</span>
              <span style={{ fontSize: '.74rem', background: '#f59e0b', color: '#fff', padding: '3px 10px', borderRadius: 20, fontWeight: 800 }}>
                🚀 실시간 추세 주도주
              </span>
            </div>
            <div style={{ fontSize: '.9rem', color: 'var(--t2)', marginTop: 6, lineHeight: 1.5 }}>
              바닥 저항선을 뚫고 <strong>52주 신고가에 진입한 돌파 주도주</strong>와 <strong>20일-60일선 정배열 골든크로스</strong> 종목을 포착합니다.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={loadData}
              style={{ padding: '10px 16px', background: '#f59e0b', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: '.88rem' }}
            >
              🔄 새로고침
            </button>
          </div>
        </div>
      </div>

      {/* ─── 탭 필터 바 ─── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => setTab('HIGH52')}
          style={{
            padding: '10px 20px',
            borderRadius: 14,
            border: tab === 'HIGH52' ? '2px solid #f59e0b' : '1px solid rgba(255,255,255,0.1)',
            background: tab === 'HIGH52' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(0,0,0,0.3)',
            color: '#fff',
            fontSize: '.9rem',
            fontWeight: 900,
            cursor: 'pointer'
          }}
        >
          🚀 52주 신고가 돌파/근접 ({high52.length}개)
        </button>
        <button
          onClick={() => setTab('GOLDEN_CROSS')}
          style={{
            padding: '10px 20px',
            borderRadius: 14,
            border: tab === 'GOLDEN_CROSS' ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
            background: tab === 'GOLDEN_CROSS' ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(0,0,0,0.3)',
            color: '#fff',
            fontSize: '.9rem',
            fontWeight: 900,
            cursor: 'pointer'
          }}
        >
          📈 20-60일선 골든크로스 ({goldenCross.length}개)
        </button>
      </div>

      {/* ─── 52주 신고가 리스트 ─── */}
      {tab === 'HIGH52' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
          {high52.map((item, idx) => (
            <div
              key={idx}
              className="card stock-card"
              onClick={() => onSelectStock && onSelectStock(item)}
              style={{
                background: 'var(--bg2)',
                border: '1.8px solid rgba(245, 158, 11, 0.5)',
                borderRadius: 16,
                padding: '20px',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(245, 158, 11, 0.15)',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff' }}>{item.name}</span>
                  <span style={{ fontSize: '.8rem', color: 'var(--t3)', marginLeft: 6 }}>({item.code})</span>
                </div>
                <span style={{ fontSize: '.74rem', background: 'rgba(245,158,11,0.2)', color: '#fbbf24', padding: '3px 10px', borderRadius: 8, fontWeight: 900, border: '1px solid rgba(245,158,11,0.4)' }}>
                  {item.status}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--t1)' }}>
                  {item.price ? `${item.price.toLocaleString()}원` : '-'}
                  <span style={{ fontSize: '.85rem', marginLeft: 8, color: 'var(--up)' }}>
                    {item.change}
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '.7rem', color: 'var(--t3)' }}>52주 최고가 괴리</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fbbf24' }}>{item.diffPct}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: 10 }}>
                <span style={{ fontSize: '.76rem', color: 'var(--t3)' }}>52주 최고가: <strong>{(item.high52 || 0).toLocaleString()}원</strong></span>
                <span style={{ fontSize: '.76rem', color: '#10b981', fontWeight: 800 }}>모멘텀 점수: <strong>{item.momentumScore}점</strong></span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <span style={{ fontSize: '.74rem', color: 'var(--accent)', fontWeight: 800 }}>
                  📈 실시간 챠트 ➔
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── 골든크로스 리스트 ─── */}
      {tab === 'GOLDEN_CROSS' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
          {goldenCross.map((item, idx) => (
            <div
              key={idx}
              className="card stock-card"
              onClick={() => onSelectStock && onSelectStock(item)}
              style={{
                background: 'var(--bg2)',
                border: '1.8px solid rgba(16, 185, 129, 0.5)',
                borderRadius: 16,
                padding: '20px',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.15)',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff' }}>{item.name}</span>
                  <span style={{ fontSize: '.8rem', color: 'var(--t3)', marginLeft: 6 }}>({item.code})</span>
                </div>
                <span style={{ fontSize: '.74rem', background: 'rgba(16,185,129,0.2)', color: '#34d399', padding: '3px 10px', borderRadius: 8, fontWeight: 900, border: '1px solid rgba(16,185,129,0.4)' }}>
                  📈 골든크로스 ({item.crossDate})
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--t1)' }}>
                  {item.price ? `${item.price.toLocaleString()}원` : '-'}
                  <span style={{ fontSize: '.85rem', marginLeft: 8, color: 'var(--up)' }}>
                    {item.change}
                  </span>
                </div>
                <span style={{ fontSize: '.8rem', color: '#10b981', fontWeight: 900 }}>
                  20일선 {item.ma20?.toLocaleString()}원 &gt; 60일선 {item.ma60?.toLocaleString()}원
                </span>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 12px', borderRadius: 10, fontSize: '.82rem', color: 'var(--t2)', lineHeight: 1.5 }}>
                💡 <strong>모멘텀 모멘텀 요인:</strong> {item.catalyst}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <span style={{ fontSize: '.74rem', color: 'var(--accent)', fontWeight: 800 }}>
                  📈 실시간 챠트 ➔
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
