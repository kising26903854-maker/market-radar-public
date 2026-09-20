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
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--t2)', fontWeight: 700, fontSize: '1.2rem' }}>
        시가총액 랭킹 및 순위 변동 데이터를 집계하는 중...
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--dn)' }}>
        데이터를 불러오지 못했습니다. <button onClick={loadData} style={{ padding: '6px 12px', marginLeft: 10, cursor: 'pointer', borderRadius: 0 }}>다시 시도</button>
      </div>
    )
  }

  const currentList = (market === 'KOSPI' ? data?.kospi?.current : data?.kosdaq?.current) || []
  const outList = (market === 'KOSPI' ? data?.kospi?.out : data?.kosdaq?.out) || []

  return (
    <div>
      {/* 헤더 */}
      <div style={{
        padding: '22px 26px',
        background: 'var(--bg2)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 0,
        marginBottom: 20,
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>일간 시가총액 랭킹 & 순위 변동</span>
              <span style={{ fontSize: '.72rem', color: 'var(--t3)', padding: '3px 10px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 0, fontWeight: 700 }}>
                {data?.day || '오늘'} (기준: {data?.date ? new Date(data.date).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '실시간'})
              </span>
            </div>
            <div style={{ fontSize: '.9rem', color: 'var(--t2)', marginTop: 6, lineHeight: 1.5 }}>
              코스피·코스닥 시가총액 상위 20위 종목의 일간 순위 등락(▲/▼), 신규 진입(NEW), 이탈(OUT) 현황입니다. <strong style={{ color: 'var(--t1)' }}>종목 클릭 시 밸류체인 생태계</strong>를 확인하실 수 있습니다.
            </div>
          </div>
          <div>
            <button
              onClick={triggerRefresh}
              disabled={refreshing}
              style={{
                padding: '9px 16px',
                background: refreshing ? 'rgba(255,255,255,0.08)' : 'var(--accent)',
                border: 'none', borderRadius: 0, color: '#fff', fontWeight: 700,
                cursor: refreshing ? 'not-allowed' : 'pointer', fontSize: '.85rem',
              }}
            >
              {refreshing ? '실시간 집계 중...' : '실시간 순위 재집계'}
            </button>
          </div>
        </div>
      </div>

      {/* 탭 토글 */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.25)', padding: 3, borderRadius: 0, marginBottom: 20 }}>
        {['KOSPI', 'KOSDAQ'].map(m => (
          <button
            key={m}
            onClick={() => setMarket(m)}
            style={{
              flex: 1,
              padding: '12px 0',
              background: market === m ? 'var(--accent)' : 'transparent',
              border: 'none',
              borderRadius: 0,
              color: market === m ? '#fff' : 'var(--t3)',
              fontSize: '1.05rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {m === 'KOSPI' ? '코스피 TOP 20' : '코스닥 TOP 20'}
          </button>
        ))}
      </div>

      {/* 랭킹 테이블 */}
      <div style={{ background: 'var(--bg2)', borderRadius: 0, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
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
                      <span style={{ fontSize: '0.72rem', background: 'transparent', color: 'var(--t3)', border: '1px solid rgba(255,255,255,0.12)', padding: '1px 6px', borderRadius: 0, fontWeight: 700 }}>
                        밸류체인
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
                      <span style={{ padding: '4px 10px', borderRadius: 0, background: 'rgba(16,185,129,0.2)', border: '1px solid #10b981', color: '#10b981', fontWeight: 800, fontSize: '.78rem' }}>
                        신규 진입
                      </span>
                    )}
                    {item.status === 'UP' && (
                      <span style={{ padding: '4px 10px', borderRadius: 0, background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#ef4444', fontWeight: 800, fontSize: '.85rem' }}>
                        ▲ {item.change}
                      </span>
                    )}
                    {item.status === 'DOWN' && (
                      <span style={{ padding: '4px 10px', borderRadius: 0, background: 'rgba(59,130,246,0.15)', border: '1px solid #3b82f6', color: '#3b82f6', fontWeight: 800, fontSize: '.85rem' }}>
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
        <div style={{ marginTop: 24, padding: '20px 24px', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0 }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--t2)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
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
                  borderRadius: 0,
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
