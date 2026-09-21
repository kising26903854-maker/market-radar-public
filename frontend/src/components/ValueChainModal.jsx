// ValueChainModal.jsx — 🔗 대한민국 주요 산업별 100% 정밀 밸류체인 생태계 모달
import React, { useState, useEffect } from 'react';

export default function ValueChainModal({ stock, stockCode, stockName, onClose, onSelectStock }) {
  const currentStock = stock || { code: stockCode, name: stockName || stockCode };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chainData, setChainData] = useState(null);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'SUPPLIER' | 'CUSTOMER' | 'SUB_PROCESS' | 'PEER'

  useEffect(() => {
    if (!currentStock?.code) return;
    
    setLoading(true);
    setError(null);
    setFilterType('ALL');
    fetch(`/api/value-chain/${currentStock.code}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setChainData(data);
        } else {
          setError(data.error || '밸류체인을 불러오는 데 실패했습니다.');
        }
      })
      .catch(err => {
        setError('서버 연결 실패');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [currentStock?.code]);

  if (!currentStock || !currentStock.code) return null;

  const chainList = chainData?.valueChain || [];
  const sectorName = chainData?.sector || '산업 밸류체인 생태계';
  const sectorSummary = chainData?.summary || `${currentStock.name}과 긴밀히 연결된 전후방 산업 공급망 생태계입니다.`;

  const supplierCount = chainList.filter(i => i.relationType === 'SUPPLIER').length;
  const customerCount = chainList.filter(i => i.relationType === 'CUSTOMER').length;
  const subProcessCount = chainList.filter(i => i.relationType === 'SUB_PROCESS').length;
  const peerCount = chainList.filter(i => i.relationType === 'PEER').length;

  const filteredList = chainList.filter(item => {
    if (filterType === 'ALL') return true;
    return item.relationType === filterType;
  });

  const getRelationBadge = (type) => {
    switch (type) {
      case 'SUPPLIER':
        return { label: '장비·소재·부품 공급', bg: 'rgba(59,130,246,0.2)', border: '#3b82f6', color: '#60a5fa' };
      case 'CUSTOMER':
        return { label: '주요 고객사·수요처', bg: 'rgba(16,185,129,0.2)', border: '#10b981', color: '#34d399' };
      case 'SUB_PROCESS':
        return { label: '후공정·소켓·패키징', bg: 'rgba(234,179,8,0.2)', border: '#eab308', color: '#fbbf24' };
      case 'PEER':
      default:
        return { label: '동일 생태계·경쟁', bg: 'rgba(168,85,247,0.2)', border: '#a855f7', color: '#c084fc' };
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.84)',
        backdropFilter: 'blur(12px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '750px',
          background: 'rgba(24, 30, 48, 0.96)',
          border: '1.8px solid rgba(99, 102, 241, 0.35)',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          overflow: 'hidden',
          animation: 'fadeIn 0.3s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          style={{
            padding: '24px 30px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.18) 0%, rgba(147, 51, 234, 0.15) 100%)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.78rem', color: '#818cf8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 4 }}>
              Precision Value Chain Network
            </div>
            <div
              onClick={() => onSelectStock && onSelectStock({ code: currentStock.code, name: currentStock.name })}
              title="종목 상세 퀀트 분석 팝업 열기"
              style={{ fontSize: '1.45rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 10, cursor: onSelectStock ? 'pointer' : 'default' }}
            >
              <span style={{ color: '#fbbf24', filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.6))' }}>🔗</span>
              <span style={{ textDecoration: onSelectStock ? 'underline' : 'none', textUnderlineOffset: 4 }}>{stock.name}</span>
              <span style={{ fontSize: '0.88rem', color: 'var(--t3)', fontWeight: 600 }}>
                ({stock.code}) 전후방 생태계
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '1.3rem',
              fontWeight: 'bold',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
              e.currentTarget.style.color = '#ef4444';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = '#94a3b8';
            }}
          >
            &times;
          </button>
        </div>

        {/* 산업군 요약 배너 */}
        <div style={{
          padding: '16px 28px',
          background: 'rgba(0,0,0,0.3)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: '.75rem', background: '#4f46e5', color: '#fff', padding: '2px 8px', borderRadius: 0, fontWeight: 700 }}>
                {sectorName}
              </span>
              <span style={{ fontSize: '.84rem', fontWeight: 800, color: '#e2e8f0' }}>전후방 생태계 네트워크 분석</span>
            </div>
            <div style={{ fontSize: '.84rem', color: 'var(--t2)', lineHeight: 1.5 }}>
              {sectorSummary}
            </div>
          </div>
        </div>

        {/* 4대 영역 필터 칩 */}
        <div style={{
          padding: '14px 28px 6px 28px',
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap'
        }}>
          {[
            { id: 'ALL', label: `전체 (${chainList.length})` },
            { id: 'SUPPLIER', label: `장비·소재 공급 (${supplierCount})` },
            { id: 'CUSTOMER', label: `주요 고객사 (${customerCount})` },
            { id: 'SUB_PROCESS', label: `후공정·소켓 (${subProcessCount})` },
            { id: 'PEER', label: `동일 생태계 (${peerCount})` }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 0,
                border: 'none',
                background: filterType === f.id ? 'var(--accent)' : 'transparent',
                color: filterType === f.id ? '#ffffff' : 'var(--t3)',
                fontSize: '.8rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: filterType === f.id ? '0 0 12px rgba(129,140,248,0.3)' : 'none'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 바디 */}
        <div style={{ padding: '16px 28px 28px 28px', maxHeight: '58vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    style={{
                      height: '76px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '16px',
                      border: '1px solid rgba(255, 255, 255, 0.03)',
                      animation: 'pulse 1.5s infinite',
                    }}
                  />
                ))}
              </div>
              <div style={{ marginTop: 18, color: 'var(--t3)', fontSize: '0.9rem', fontWeight: 700 }}>
                실시간 밸류체인 시세 및 네트워크 데이터 집계 중...
              </div>
            </div>
          ) : error ? (
            <div
              style={{
                padding: '30px',
                textAlign: 'center',
                background: 'rgba(239, 68, 68, 0.05)',
                border: '1.5px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '16px',
                color: '#ef4444',
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: 10 }}>⚠️</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{error}</div>
            </div>
          ) : filteredList.length === 0 ? (
            <div
              style={{
                padding: '40px',
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                color: 'var(--t3)',
              }}
            >
              <div style={{ fontSize: '1.8rem', marginBottom: 12 }}>📦</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                선택하신 조건에 해당하는 밸류체인 종목이 없습니다.
              </div>
            </div>
          ) : (
            <div>
              <div
                style={{
                  fontSize: '0.82rem',
                  color: 'var(--t3)',
                  marginBottom: 14,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>💡 각 밸류체인 종목을 클릭하시면 **월가 퀀트 및 세력 평단가 상세 분석** 팝업이 열립니다.</span>
                <span style={{ fontWeight: 800, color: '#818cf8' }}>총 {filteredList.length}개 표시</span>
              </div>

              {/* 종목 카드 컨테이너 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredList.map(item => {
                  const isUp = item.changePct > 0;
                  const isDown = item.changePct < 0;
                  const color = isUp ? '#ef4444' : isDown ? '#3b82f6' : 'var(--t2)';
                  const sign = isUp ? '+' : '';
                  const relBadge = getRelationBadge(item.relationType);
                  
                  return (
                    <div
                      key={item.code}
                      onClick={() => onSelectStock && onSelectStock({ code: item.code, name: item.name })}
                      style={{
                        padding: '16px 20px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.borderColor = 'rgba(129, 140, 248, 0.4)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.3)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 900, color: '#fff', fontSize: '1.05rem' }}>{item.name}</span>
                          <span style={{ fontSize: '0.74rem', background: 'rgba(255, 255, 255, 0.08)', padding: '2px 6px', borderRadius: '4px', color: 'var(--t3)', fontFamily: 'Space Mono' }}>
                            {item.code}
                          </span>
                          <span style={{
                            fontSize: '0.72rem',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: relBadge.bg,
                            border: `1px solid ${relBadge.border}`,
                            color: relBadge.color,
                            fontWeight: 800
                          }}>
                            {relBadge.label}
                          </span>
                        </div>

                        {/* 역할 (Role) 텍스트 */}
                        <div style={{ fontSize: '0.84rem', color: '#c084fc', marginTop: 6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>🎯 역할:</span>
                          <span style={{ color: '#f3e8ff' }}>{item.role || '산업 생태계 핵심 파트너'}</span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', minWidth: '130px' }}>
                        <div style={{ fontWeight: 900, color: '#fff', fontSize: '1.1rem', fontFamily: 'Space Mono' }}>
                          {item.price > 0 ? `${item.price.toLocaleString()}원` : '시세 집계중'}
                        </div>
                        {item.price > 0 && (
                          <div style={{ fontSize: '0.82rem', color, fontWeight: 800, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, fontFamily: 'Space Mono' }}>
                            <span>{isUp ? '▲' : isDown ? '▼' : ''}</span>
                            <span>{Math.abs(item.change).toLocaleString()}원 ({sign}{item.changePct.toFixed(2)}%)</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(15, 23, 42, 0.4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.78rem',
            color: 'var(--t3)',
          }}
        >
          <span>실시간 시세 연동: 네이버 금융 실시간 증권 API</span>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.1)'}
            onMouseLeave={e => e.currentTarget.style.filter = 'none'}
          >
            닫기
          </button>
        </div>
      </div>
      
      {/* 키프레임 애니메이션 */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse {
          0% { opacity: 0.3; }
          50% { opacity: 0.6; }
          100% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
