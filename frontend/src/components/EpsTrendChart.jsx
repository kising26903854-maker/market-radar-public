// EpsTrendChart.jsx — 📊 실제 EPS 추이 차트 (연간/분기별 토글 탭 탑재)
import React, { useState, useEffect } from 'react'

export default function EpsTrendChart({ stock }) {
  const [financials, setFinancials] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [activeTab, setActiveTab] = useState('annual') // 'annual' | 'quarter'
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const code = stock?.code

  useEffect(() => {
    if (!code) return
    setLoading(true)
    setError(null)
    fetch(`/api/financials/${code}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setFinancials(data)
        else setError('재무데이터를 불러올 수 없습니다.')
      })
      .catch(() => setError('네트워크 오류'))
      .finally(() => setLoading(false))
  }, [code])

  if (loading) return (
    <div style={{ background: 'var(--bg2)', borderRadius: 0, padding: '28px 24px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', color: 'var(--t3)' }}>
      <div style={{ fontSize: '1rem', fontWeight: 700 }}>네이버 증권 실제 EPS 데이터 로딩 중...</div>
    </div>
  )

  if (error || !financials) return (
    <div style={{ background: 'var(--bg2)', borderRadius: 0, padding: '20px 24px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.08)', color: 'var(--t3)', textAlign: 'center' }}>
      <div style={{ fontSize: '.9rem' }}>EPS 재무데이터를 파싱하지 못했습니다 — {error || '데이터 없음'}</div>
    </div>
  )

  // 탭 선택 데이터 가공 (구버전 호환성용 폴백 포함)
  const activeDataset = activeTab === 'annual'
    ? (financials.annual || { years: financials.years || [], eps: financials.eps || [] })
    : (financials.quarter || { years: [], eps: [] })

  const { years = [], eps = [] } = activeDataset
  const currentYear = new Date().getFullYear()

  // 데이터 포인트 구성
  const rawData = years.map((year, i) => {
    const isEst = year.includes('(E)')
    const isCurrentYear = year.includes(String(currentYear)) && !isEst
    return {
      year,
      eps: eps[i] ?? null,
      isFuture: isEst,
      isCurrentYear,
      label: isEst ? '예상(E)' : '실적'
    }
  }).filter(d => d.eps !== null)

  if (rawData.length === 0) {
    return (
      <div style={{ background: 'var(--bg2)', borderRadius: 0, padding: '20px 24px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.08)', color: 'var(--t2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>{stock?.name} EPS (주당순이익) 추이</div>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', padding: 3, borderRadius: 0, border: '1px solid rgba(255,255,255,0.08)' }}>
            <button onClick={() => setActiveTab('annual')} style={{ padding: '6px 14px', background: activeTab === 'annual' ? 'var(--accent)' : 'transparent', border: 'none', borderRadius: 0, color: activeTab === 'annual' ? '#fff' : 'var(--t3)', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' }}>연간</button>
            <button onClick={() => setActiveTab('quarter')} style={{ padding: '6px 14px', background: activeTab === 'quarter' ? 'var(--accent)' : 'transparent', border: 'none', borderRadius: 0, color: activeTab === 'quarter' ? '#fff' : 'var(--t3)', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' }}>분기별</button>
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--t3)', fontSize: '.85rem' }}>
          선택하신 {activeTab === 'annual' ? '연간' : '분기별'} EPS 데이터가 네이버 금융에 존재하지 않습니다.
        </div>
      </div>
    )
  }

  const epsValues = rawData.map(d => d.eps)
  const minEps = Math.min(...epsValues)
  const maxEps = Math.max(...epsValues)
  const padding2 = (maxEps - minEps) * 0.18 || Math.abs(maxEps) * 0.15 || 100

  const width = 740, height = 220
  const pad = { top: 42, right: 50, bottom: 44, left: 72 }

  const getX = (i) => pad.left + (i / (rawData.length - 1)) * (width - pad.left - pad.right)
  const getY = (v) => height - pad.bottom - ((v - (minEps - padding2)) / ((maxEps + padding2) - (minEps - padding2))) * (height - pad.top - pad.bottom)

  const points = rawData.map((d, i) => ({ ...d, x: getX(i), y: getY(d.eps) }))

  const solidPts = points.filter(p => !p.isFuture)
  const solidPath = solidPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  const dashStart = solidPts[solidPts.length - 1]
  const dashPts = dashStart ? [dashStart, ...points.filter(p => p.isFuture)] : points.filter(p => p.isFuture)
  const dashedPath = dashPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  // 성장률 계산
  const lastActual = solidPts[solidPts.length - 1]
  const firstEst = points.find(p => p.isFuture)
  const growthPct = lastActual && firstEst && lastActual.eps !== 0
    ? (((firstEst.eps - lastActual.eps) / Math.abs(lastActual.eps)) * 100).toFixed(1)
    : null

  // Y축 가이드라인 3개
  const yTicks = [0.25, 0.5, 0.75].map(r => {
    const val = (minEps - padding2) + r * ((maxEps + padding2) - (minEps - padding2))
    return { y: height - pad.bottom - r * (height - pad.top - pad.bottom), val: Math.round(val).toLocaleString() }
  })

  return (
    <div style={{ background: 'var(--bg2)', borderRadius: 0, padding: '20px 24px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            {stock?.name} EPS (주당순이익) 추이 ({activeTab === 'annual' ? '연간' : '분기별'})
          </div>
          <div style={{ fontSize: '.78rem', color: 'var(--t2)', marginTop: 4 }}>
            실적은 <strong style={{ color: '#10b981' }}>실선</strong> · 예상치는 <strong style={{ color: '#eab308' }}>점선</strong> &nbsp;|&nbsp;
            <span style={{ color: 'var(--t3)' }}>출처: 네이버 증권 재무제표</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* 전환 토글 */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', padding: 3, borderRadius: 0 }}>
            <button
              onClick={() => setActiveTab('annual')}
              style={{
                padding: '6px 14px',
                background: activeTab === 'annual' ? 'var(--accent)' : 'transparent',
                border: 'none',
                borderRadius: 0,
                color: activeTab === 'annual' ? '#fff' : 'var(--t3)',
                fontSize: '.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              연간
            </button>
            <button
              onClick={() => setActiveTab('quarter')}
              style={{
                padding: '6px 14px',
                background: activeTab === 'quarter' ? 'var(--accent)' : 'transparent',
                border: 'none',
                borderRadius: 0,
                color: activeTab === 'quarter' ? '#fff' : 'var(--t3)',
                fontSize: '.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              분기별
            </button>
          </div>

          {/* 성장률 배지 */}
          {growthPct !== null && (
            <div style={{ padding: '6px 14px', background: parseFloat(growthPct) >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border: `1px solid ${parseFloat(growthPct) >= 0 ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`, borderRadius: 0, textAlign: 'right' }}>
              <span style={{ fontSize: '.68rem', color: 'var(--t3)', fontWeight: 700, marginRight: 6 }}>{activeTab === 'annual' ? '올해 (E) 성장률' : '차기 분기 (E) 성장률'}</span>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: parseFloat(growthPct) >= 0 ? '#10b981' : '#ef4444' }}>
                {parseFloat(growthPct) >= 0 ? '+' : ''}{growthPct}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* SVG */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <linearGradient id="epsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* 그리드 + Y축 눈금 */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={pad.left} y1={t.y} x2={width - pad.right} y2={t.y} stroke="rgba(255,255,255,0.06)" strokeDasharray="4,4" />
              <text x={pad.left - 6} y={t.y + 4} fill="var(--t3)" fontSize={isMobile ? "13.5" : "10"} textAnchor="end">{t.val}원</text>
            </g>
          ))}

          {/* 실선 면적 */}
          {solidPts.length > 1 && (
            <path d={`${solidPath} L ${solidPts[solidPts.length-1].x} ${height - pad.bottom} L ${solidPts[0].x} ${height - pad.bottom} Z`} fill="url(#epsGrad)" />
          )}

          {/* 실선 */}
          {solidPts.length > 1 && (
            <path d={solidPath} fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.5))' }} />
          )}

          {/* 점선 */}
          {dashPts.length > 1 && (
            <path d={dashedPath} fill="none" stroke="#eab308" strokeWidth="3.5" strokeDasharray="7,7" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 5px rgba(234,179,8,0.5))' }} />
          )}

          {/* 0원 기준선 */}
          {minEps < 0 && (
            <line x1={pad.left} y1={getY(0)} x2={width - pad.right} y2={getY(0)} stroke="rgba(239,68,68,0.4)" strokeDasharray="4,3" />
          )}

          {/* 데이터 포인트 */}
          {points.map((p, i) => {
            if (p.eps === null) return null
            const isHov = hoveredPoint === i
            const col = p.isFuture ? '#eab308' : '#10b981'
            const lblCol = p.isFuture ? '#fde047' : '#6ee7b7'
            return (
              <g key={i} style={{ cursor: 'pointer' }} onMouseEnter={() => setHoveredPoint(i)} onMouseLeave={() => setHoveredPoint(null)}>
                {isHov && <circle cx={p.x} cy={p.y} r={15} fill={col} opacity={0.15} />}
                <circle cx={p.x} cy={p.y} r={isHov ? 9 : (p.isCurrentYear ? 7.5 : 5.5)} fill={col} stroke="#0f172a" strokeWidth="2.5" style={{ transition: 'all .2s' }} />
                <text x={p.x} y={p.y - 14} fill={lblCol} fontSize={isMobile ? (p.isCurrentYear ? '16' : '15') : (p.isCurrentYear ? '12' : '11')} fontWeight={p.isCurrentYear ? '900' : '700'} textAnchor="middle">
                  {p.eps < 0 ? '-' : ''}{Math.abs(p.eps).toLocaleString()}원
                </text>
                <text x={p.x} y={height - 15} fill={p.isFuture ? '#eab308' : 'var(--t2)'} fontSize={isMobile ? "14.5" : "11"} fontWeight={p.isFuture || p.isCurrentYear ? '900' : '600'} textAnchor="middle">
                  {p.year}
                </text>
                <text x={p.x} y={height - 3} fill="var(--t3)" fontSize={isMobile ? "12" : "9"} textAnchor="middle">({p.label})</text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* 범례 */}
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.25)', padding: '7px 13px', borderRadius: 0, fontSize: '.74rem', color: 'var(--t2)', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
            <span style={{ display: 'inline-block', width: 16, height: 3, background: '#10b981' }} /> 실적 EPS (실선)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
            <span style={{ display: 'inline-block', width: 16, height: 3, borderTop: '2.5px dashed #eab308' }} /> 예상 EPS (점선)
          </span>
        </div>
        <div>EPS 우상향 = 기업 순이익 상승 → 주가 밸류에이션 리레이팅 유발</div>
      </div>
    </div>
  )
}
