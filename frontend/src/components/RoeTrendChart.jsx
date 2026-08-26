// RoeTrendChart.jsx — 📊 실제 ROE 추이 & 향후 전망 차트 (연간/분기별 토글 탭 탑재)
import React, { useState, useEffect } from 'react'

export default function RoeTrendChart({ stock }) {
  const [financials, setFinancials] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hoveredPoint, setHoveredPoint] = useState(null)
  const [activeTab, setActiveTab] = useState('annual') // 'annual' | 'quarter'

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
    <div style={{ background: 'var(--bg3)', borderRadius: 16, padding: '28px 24px', marginBottom: 20, border: '1.5px solid rgba(99,102,241,0.3)', textAlign: 'center', color: 'var(--t3)' }}>
      <div style={{ fontSize: '1rem', fontWeight: 700 }}>📊 네이버 증권 실제 ROE 데이터 로딩 중...</div>
    </div>
  )

  if (error || !financials) return (
    <div style={{ background: 'var(--bg3)', borderRadius: 16, padding: '20px 24px', marginBottom: 20, border: '1.5px solid rgba(99,102,241,0.2)', color: 'var(--t3)', textAlign: 'center' }}>
      <div style={{ fontSize: '.9rem' }}>📋 ROE 재무데이터를 파싱하지 못했습니다 — {error || '데이터 없음'}</div>
    </div>
  )

  // 탭 선택 데이터 가공 (구버전 호환성용 폴백 포함)
  const activeDataset = activeTab === 'annual'
    ? (financials.annual || { years: financials.years || [], roe: financials.roe || [] })
    : (financials.quarter || { years: [], roe: [] })

  const { years = [], roe = [] } = activeDataset
  const currentYear = new Date().getFullYear()

  const rawData = years.map((year, i) => {
    const isEst = year.includes('(E)')
    const isCurrentYear = year.includes(String(currentYear)) && !isEst
    return {
      year,
      roe: roe[i] ?? null,
      isFuture: isEst,
      isCurrentYear,
      label: isEst ? '예상(E)' : '실적'
    }
  }).filter(d => d.roe !== null)

  if (rawData.length === 0) {
    return (
      <div style={{ background: 'var(--bg3)', borderRadius: 16, padding: '20px 24px', marginBottom: 20, border: '1.5px solid rgba(99,102,241,0.35)', color: 'var(--t2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#818cf8' }}>📊 {stock?.name} ROE (자기자본이익률) 추이</div>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: 3, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
            <button onClick={() => setActiveTab('annual')} style={{ padding: '6px 14px', background: activeTab === 'annual' ? 'var(--accent)' : 'transparent', border: 'none', borderRadius: 8, color: '#fff', fontSize: '.78rem', fontWeight: 800, cursor: 'pointer' }}>연간</button>
            <button onClick={() => setActiveTab('quarter')} style={{ padding: '6px 14px', background: activeTab === 'quarter' ? 'var(--accent)' : 'transparent', border: 'none', borderRadius: 8, color: '#fff', fontSize: '.78rem', fontWeight: 800, cursor: 'pointer' }}>분기별</button>
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--t3)', fontSize: '.85rem' }}>
          📭 선택하신 {activeTab === 'annual' ? '연간' : '분기별'} ROE 데이터가 네이버 금융에 존재하지 않습니다.
        </div>
      </div>
    )
  }

  const roeValues = rawData.map(d => d.roe)
  const minRoe = Math.min(...roeValues)
  const maxRoe = Math.max(...roeValues)
  const pad2 = (maxRoe - minRoe) * 0.2 || Math.abs(maxRoe) * 0.15 || 5

  const width = 740, height = 220
  const pad = { top: 42, right: 50, bottom: 44, left: 58 }

  const getX = (i) => pad.left + (i / (rawData.length - 1)) * (width - pad.left - pad.right)
  const getY = (v) => height - pad.bottom - ((v - (minRoe - pad2)) / ((maxRoe + pad2) - (minRoe - pad2))) * (height - pad.top - pad.bottom)

  const points = rawData.map((d, i) => ({ ...d, x: getX(i), y: getY(d.roe) }))

  const solidPts = points.filter(p => !p.isFuture)
  const solidPath = solidPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  const dashStart = solidPts[solidPts.length - 1]
  const dashPts = dashStart ? [dashStart, ...points.filter(p => p.isFuture)] : points.filter(p => p.isFuture)
  const dashedPath = dashPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  const lastActual = solidPts[solidPts.length - 1]
  const firstEst = points.find(p => p.isFuture)
  const growthPct = lastActual && firstEst && lastActual.roe !== 0
    ? (((firstEst.roe - lastActual.roe) / Math.abs(lastActual.roe)) * 100).toFixed(1)
    : null

  // 현재 ROE 수준 판정 (실제 최근 실적 기준)
  const latestRoe = lastActual?.roe ?? 0
  let roeLevel, roeLevelColor
  if (latestRoe >= 20) { roeLevel = '🏆 우량 (20%+)'; roeLevelColor = '#10b981' }
  else if (latestRoe >= 12) { roeLevel = '✅ 양호 (12%+)'; roeLevelColor = '#34d399' }
  else if (latestRoe >= 6)  { roeLevel = '🟡 평균 (6%+)';  roeLevelColor = '#f59e0b' }
  else if (latestRoe >= 0)  { roeLevel = '🔴 낮음 (6% 미만)'; roeLevelColor = '#ef4444' }
  else                       { roeLevel = '🔴 적자 (음수)';  roeLevelColor = '#ef4444' }

  // Y축 가이드라인 3개
  const yTicks = [0.25, 0.5, 0.75].map(r => {
    const val = (minRoe - pad2) + r * ((maxRoe + pad2) - (minRoe - pad2))
    return { y: height - pad.bottom - r * (height - pad.top - pad.bottom), val: val.toFixed(1) }
  })

  return (
    <div style={{ background: 'var(--bg3)', borderRadius: 16, padding: '20px 24px', marginBottom: 20, border: '1.5px solid rgba(99,102,241,0.35)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 8 }}>
            📊 {stock?.name} ROE (자기자본이익률) 추이 ({activeTab === 'annual' ? '연간' : '분기별'})
          </div>
          <div style={{ fontSize: '.78rem', color: 'var(--t2)', marginTop: 4 }}>
            실적은 <strong style={{ color: '#818cf8' }}>🟣 실선</strong> · 예상치는 <strong style={{ color: '#f59e0b' }}>⚡ 점선</strong> &nbsp;|&nbsp;
            <span style={{ color: 'var(--t3)' }}>출처: 네이버 증권 재무제표</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* 전환 탭 */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.4)', padding: 3, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
            <button 
              onClick={() => setActiveTab('annual')} 
              style={{ 
                padding: '6px 14px', 
                background: activeTab === 'annual' ? 'linear-gradient(135deg, #818cf8 0%, #4f46e5 100%)' : 'transparent', 
                border: 'none', 
                borderRadius: 8, 
                color: activeTab === 'annual' ? '#fff' : 'var(--t2)', 
                fontSize: '.78rem', 
                fontWeight: 900, 
                cursor: 'pointer',
                boxShadow: activeTab === 'annual' ? '0 2px 8px rgba(129,140,248,0.4)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              📅 연간
            </button>
            <button 
              onClick={() => setActiveTab('quarter')} 
              style={{ 
                padding: '6px 14px', 
                background: activeTab === 'quarter' ? 'linear-gradient(135deg, #818cf8 0%, #4f46e5 100%)' : 'transparent', 
                border: 'none', 
                borderRadius: 8, 
                color: activeTab === 'quarter' ? '#fff' : 'var(--t2)', 
                fontSize: '.78rem', 
                fontWeight: 900, 
                cursor: 'pointer',
                boxShadow: activeTab === 'quarter' ? '0 2px 8px rgba(129,140,248,0.4)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              ⏱️ 분기별
            </button>
          </div>

          {/* 실시간 판단 결과 및 성장률 배지 */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ padding: '5px 12px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 10 }}>
              <span style={{ fontSize: '.68rem', color: 'var(--t3)', fontWeight: 700, marginRight: 6 }}>{activeTab === 'annual' ? '최근 연간' : '최근 분기'} 실적</span>
              <span style={{ fontSize: '.9rem', fontWeight: 900, color: roeLevelColor }}>{latestRoe}%</span>
            </div>
            {growthPct !== null && (
              <div style={{ padding: '5px 12px', background: parseFloat(growthPct) >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${parseFloat(growthPct) >= 0 ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`, borderRadius: 10 }}>
                <span style={{ fontSize: '.68rem', color: 'var(--t3)', fontWeight: 700, marginRight: 6 }}>{activeTab === 'annual' ? '차기년도' : '차기분기'} (E)</span>
                <span style={{ fontSize: '.9rem', fontWeight: 900, color: parseFloat(growthPct) >= 0 ? '#10b981' : '#ef4444' }}>
                  {parseFloat(growthPct) >= 0 ? '+' : ''}{growthPct}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SVG */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <linearGradient id="roeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* 그리드 + Y축 눈금 */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={pad.left} y1={t.y} x2={width - pad.right} y2={t.y} stroke="rgba(255,255,255,0.06)" strokeDasharray="4,4" />
              <text x={pad.left - 5} y={t.y + 4} fill="var(--t3)" fontSize="10" textAnchor="end">{t.val}%</text>
            </g>
          ))}

          {/* 0% 기준선 */}
          {minRoe < 0 && (
            <line x1={pad.left} y1={getY(0)} x2={width - pad.right} y2={getY(0)} stroke="rgba(239,68,68,0.4)" strokeDasharray="4,3" />
          )}

          {/* 실선 면적 */}
          {solidPts.length > 1 && (
            <path d={`${solidPath} L ${solidPts[solidPts.length-1].x} ${height - pad.bottom} L ${solidPts[0].x} ${height - pad.bottom} Z`} fill="url(#roeGrad)" />
          )}

          {/* 실선 */}
          {solidPts.length > 1 && (
            <path d={solidPath} fill="none" stroke="#818cf8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px rgba(129,140,248,0.55))' }} />
          )}

          {/* 점선 */}
          {dashPts.length > 1 && (
            <path d={dashedPath} fill="none" stroke="#f59e0b" strokeWidth="3.5" strokeDasharray="7,7" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 5px rgba(245,158,11,0.5))' }} />
          )}

          {/* 데이터 포인트 */}
          {points.map((p, i) => {
            if (p.roe === null) return null
            const isHov = hoveredPoint === i
            const col = p.isFuture ? '#f59e0b' : '#818cf8'
            const lblCol = p.isFuture ? '#fde047' : '#c4b5fd'
            return (
              <g key={i} style={{ cursor: 'pointer' }} onMouseEnter={() => setHoveredPoint(i)} onMouseLeave={() => setHoveredPoint(null)}>
                {isHov && <circle cx={p.x} cy={p.y} r={15} fill={col} opacity={0.15} />}
                <circle cx={p.x} cy={p.y} r={isHov ? 9 : (p.isCurrentYear ? 7.5 : 5.5)} fill={col} stroke="#0f172a" strokeWidth="2.5" style={{ transition: 'all .2s' }} />
                <text x={p.x} y={p.y - 14} fill={lblCol} fontSize={p.isCurrentYear ? '12' : '11'} fontWeight={p.isCurrentYear ? '900' : '700'} textAnchor="middle">
                  {p.roe}%
                </text>
                <text x={p.x} y={height - 15} fill={p.isFuture ? '#f59e0b' : 'var(--t2)'} fontSize="11" fontWeight={p.isFuture || p.isCurrentYear ? '900' : '600'} textAnchor="middle">
                  {p.year}
                </text>
                <text x={p.x} y={height - 3} fill="var(--t3)" fontSize="9" textAnchor="middle">({p.label})</text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* 범례 */}
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.25)', padding: '7px 13px', borderRadius: 9, fontSize: '.74rem', color: 'var(--t2)', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
            <span style={{ display: 'inline-block', width: 16, height: 3, background: '#818cf8' }} /> 🟣 실적 ROE (실선)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
            <span style={{ display: 'inline-block', width: 16, height: 3, borderTop: '2px dashed #f59e0b' }} /> ⚡ 예상 ROE (점선)
          </span>
        </div>
        <div>💡 ROE 우상향 = 자본효율 개선 → PBR 프리미엄 정당화 및 밸류업 대장주 요건 충족</div>
      </div>
    </div>
  )
}
