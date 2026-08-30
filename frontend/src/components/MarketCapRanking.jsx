// MarketCapRanking.jsx — 🏆 코스피/코스닥 일간 시가총액 랭킹 및 실시간 순위 변동 현황
import React, { useState, useEffect } from 'react'

export default function MarketCapRanking({ onOpenValueChain }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [market, setMarket] = useState('KOSPI') // 'KOSPI' | 'KOSDAQ'
  const [refreshing, setRefreshing] = useState(false)

  const formatMarketCap = (val) => {
    if (!val || isNaN(val)) return '0원';
    // 만약 원 단위(1조 = 1,000,000,000,000)로 전달된 경우 억원으로 환산
    let eok = val >= 100000000 ? Math.floor(val / 100000000) : Math.floor(val);
    if (eok >= 10000) {
      const jo = Math.floor(eok / 10000);
      const rem = Math.floor(eok % 10000);
      return `${jo.toLocaleString()}조 ${rem > 0 ? rem.toLocaleString() + '억 ' : ''}원`.trim();
    }
    return `${eok.toLocaleString()}억 원`;
  };

  const loadData = () => {
    setLoading(true)
    fetch('/api/market-cap-ranking')
      .then(res => res.json())
      .then(json => {
        if (json.success && json.data) setData(json.data)
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }

  const triggerRefresh = () => {
    if (refreshing) return
    setRefreshing(true)
    fetch('/api/trigger-market-cap-ranking', { method: 'POST' })
      .then(res => res.json())
      .then(json => {
        if (json.success) loadData()
      })
      .catch(err => console.error(err))
      .finally(() => setRefreshing(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading && !data) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--gold)', fontWeight: 800, fontSize: '1.2rem' }}>
        🏆 시가총액 랭킹 및 순위 변동 데이터를 집계하는 중...
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--dn)' }}>
        데이터를 불러오지 못했습니다. <button onClick={loadData} style={{ padding: '6px 12px', marginLeft: 10, cursor: 'pointer' }}>🔄 다시 시도</button>
      </div>
    )
  }

  const currentList = (market === 'KOSPI' ? data?.kospi?.current : data?.kosdaq?.current) || []
  const outList = (market === 'KOSPI' ? data?.kospi?.out : data?.kosdaq?.out) || []

  return (
    <div>
      {/* 헤더 */}
      <div style={{
        padding: '24px 28px',
        background: 'linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(147,51,234,0.18) 100%)',
        border: '2px solid rgba(59,130,246,0.5)',
        borderRadius: 20,
        marginBottom: 24,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ filter: 'drop-shadow(0 0 10px #3b82f6)' }}>🏆 일간 시가총액 랭킹 & 순위 변동</span>
              <span style={{ fontSize: '.72rem', background: '#3b82f6', color: '#fff', padding: '3px 10px', borderRadius: 20, fontWeight: 800 }}>
                {data?.day || '오늘'} (기준: {data?.date ? new Date(data.date).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '실시간'})
              </span>
            </div>
            <div style={{ fontSize: '.9rem', color: 'var(--t2)', marginTop: 6, lineHeight: 1.5 }}>
              코스피·코스닥 시가총액 상위 20위 종목의 일간 순위 등락(▲/▼), 신규 진입(NEW), 이탈(OUT) 현황입니다. <strong style={{ color: 'var(--gold)' }}>종목 클릭 시 밸류체인 생태계</strong>를 확인하실 수 있습니다.
            </div>
          </div>
          <div>
            <button
              onClick={triggerRefresh}
              disabled={refreshing}
              style={{
                padding: '10px 18px',
                background: refreshing ? 'rgba(59,130,246,0.3)' : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                border: 'none', borderRadius: 12, color: '#fff', fontWeight: 800,
                cursor: refreshing ? 'not-allowed' : 'pointer', fontSize: '.9rem',
                boxShadow: '0 4px 14px rgba(59,130,246,0.4)'
              }}
            >
              {refreshing ? '⏳ 실시간 집계 중...' : '🔄 실시간 순위 재집계'}
            </button>
          </div>
        </div>
      </div>

      {/* 탭 토글 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {['KOSPI', 'KOSDAQ'].map(m => (
          <button
            key={m}
            onClick={() => setMarket(m)}
            style={{
              flex: 1,
              padding: '14px 0',
              background: market === m ? 'rgba(59,130,246,0.25)' : 'rgba(0,0,0,0.3)',
              border: `2px solid ${market === m ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 14,
              color: market === m ? '#fff' : 'var(--t3)',
              fontSize: '1.1rem',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: market === m ? '0 0 16px rgba(59,130,246,0.35)' : 'none'
            }}
          >
            {m === 'KOSPI' ? '🏢 코스피 TOP 20' : '🚀 코스닥 TOP 20'}
          </button>
        ))}
      </div>

      {/* 랭킹 테이블 */}
      <div style={{ background: 'var(--bg2)', borderRadius: 18, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={{ padding: '16px 20px', color: 'var(--t3)', fontWeight: 800, width: '90px' }}>순위</th>
              <th style={{ padding: '16px 20px', color: 'var(--t3)', fontWeight: 800 }}>종목명 / 코드</th>
              <th style={{ padding: '16px 20px', color: 'var(--t3)', fontWeight: 800, textAlign: 'right' }}>현재가</th>
              <th style={{ padding: '16px 20px', color: 'var(--t3)', fontWeight: 800, textAlign: 'right' }}>시가총액</th>
              <th style={{ padding: '16px 20px', color: 'var(--t3)', fontWeight: 800, textAlign: 'center', width: '130px' }}>전일 대비 순위</th>
            </tr>
          </thead>
          <tbody>
            {currentList.map((item) => {
              const medal = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : null;
              return (
                <tr 
                  key={item.code} 
                  onClick={() => onOpenValueChain && onOpenValueChain(item.code, item.name)}
                  style={{ 
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '16px 20px', fontWeight: 900, fontSize: '1.05rem', color: item.rank <= 3 ? 'var(--gold)' : 'var(--t1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {medal && <span>{medal}</span>}
                      <span>{item.rank}위</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{item.name}</span>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                        밸류체인 🔗
                      </span>
                    </div>
                    <div style={{ fontSize: '.78rem', color: 'var(--t3)', marginTop: 2, fontFamily: 'Space Mono' }}>{item.code}</div>
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 800, color: '#fff', fontFamily: 'Space Mono' }}>
                    {(item.price || 0).toLocaleString()}원
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 900, color: 'var(--t2)', fontSize: '1.02rem', fontFamily: 'Space Mono' }}>
                    {formatMarketCap(item.marketCap)}
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                    {item.status === 'NEW' && (
                      <span style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(16,185,129,0.2)', border: '1px solid #10b981', color: '#10b981', fontWeight: 900, fontSize: '.78rem' }}>
                        🆕 신규 진입
                      </span>
                    )}
                    {item.status === 'UP' && (
                      <span style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#ef4444', fontWeight: 900, fontSize: '.85rem' }}>
                        ▲ {item.change}
                      </span>
                    )}
                    {item.status === 'DOWN' && (
                      <span style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(59,130,246,0.15)', border: '1px solid #3b82f6', color: '#3b82f6', fontWeight: 900, fontSize: '.85rem' }}>
                        ▼ {Math.abs(item.change)}
                      </span>
                    )}
                    {item.status === 'SAME' && (
                      <span style={{ color: 'var(--t3)', fontWeight: 800, fontSize: '.9rem' }}>−</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 밀려난 종목 (OUT) */}
      {outList && outList.length > 0 && (
        <div style={{ marginTop: 24, padding: '20px 24px', background: 'rgba(244,63,94,0.06)', border: '1.5px solid rgba(244,63,94,0.3)', borderRadius: 16 }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#f43f5e', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📉</span>
            <span>20위권 밖으로 밀려난 종목 (OUT)</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {outList.map(item => (
              <div 
                key={item.code} 
                onClick={() => onOpenValueChain && onOpenValueChain(item.code, item.name)}
                style={{ 
                  padding: '10px 16px', 
                  background: 'rgba(0,0,0,0.4)', 
                  borderRadius: 10, 
                  border: '1px solid rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <span style={{ fontWeight: 800, color: '#fff' }}>{item.name}</span>
                <span style={{ fontSize: '.78rem', color: '#f43f5e', fontWeight: 700 }}>(전일 {item.rank}위 → 이탈)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
