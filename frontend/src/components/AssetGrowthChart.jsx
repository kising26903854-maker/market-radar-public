// AssetGrowthChart.jsx — 📊 DART 공식 재무제표(재무상태표) 실제 자산총계 3개년 추이 & 증가율
import React, { useState, useEffect } from 'react'

export default function AssetGrowthChart({ stock }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hoveredPoint, setHoveredPoint] = useState(null)
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
    fetch(`/api/asset-growth/${code}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setData(res)
        else setError(res.error || '자산총계 데이터를 불러올 수 없습니다.')
      })
      .catch(() => setError('네트워크 오류'))
      .finally(() => setLoading(false))
  }, [code])

  if (loading) return (
    <div style={{ background: 'var(--bg2)', borderRadius: 0, padding: '28px 24px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', color: 'var(--t3)' }}>
      <div style={{ fontSize: '1rem', fontWeight: 700 }}>DART 공식 재무제표에서 자산총계 데이터 로딩 중...</div>
    </div>
  )

  if (error || !data || !data.history || data.history.length === 0) return (
    <div style={{ background: 'var(--bg2)', borderRadius: 0, padding: '20px 24px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.08)', color: 'var(--t3)', textAlign: 'center' }}>
      <div style={{ fontSize: '.9rem' }}>자산총계 재무데이터를 찾지 못했습니다 — {error || '데이터 없음'}</div>
    </div>
  )

  const { history, overallGrowthRate, corpName, fsDiv } = data

  // 조 단위 / 억 단위 변환 (DART 원본은 "원" 단위)
  const formatWon = (val) => {
    if (val === null || val === undefined) return '-'
    const abs = Math.abs(val)
    if (abs >= 1e12) return `${(val / 1e12).toFixed(1)}조원`
    if (abs >= 1e8) return `${(val / 1e8).toFixed(0)}억원`
    return `${Math.round(val).toLocaleString()}원`
  }

  const width = 740, height = 240
  const pad = { top: 46, right: 30, bottom: 44, left: 30 }

  const amounts = history.map(d => d.totalAssets)
  const maxAmt = Math.max(...amounts)
  const minAmt = Math.min(0, ...amounts)
  const padAmt = (maxAmt - minAmt) * 0.15 || maxAmt * 0.1

  const getX = (i) => history.length > 1 ? pad.left + (i / (history.length - 1)) * (width - pad.left - pad.right) : (pad.left + width - pad.right) / 2
  const getY = (v) => {
    const bottomLimit = minAmt - padAmt < 0 ? 0 : minAmt - padAmt
    const topLimit = maxAmt + padAmt
    return height - pad.bottom - ((v - bottomLimit) / (topLimit - bottomLimit)) * (height - pad.top - pad.bottom)
  }

  const points = history.map((d, i) => ({ ...d, x: getX(i), y: getY(d.totalAssets) }))
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = points.length > 1
    ? `${linePath} L ${points[points.length - 1].x} ${height - pad.bottom} L ${points[0].x} ${height - pad.bottom} Z`
    : ''

  const latest = history[history.length - 1]
  const latestGrowth = latest?.growthRate

  let growthLevel, growthColor
  if (overallGrowthRate === null || overallGrowthRate === undefined) { growthLevel = '데이터 부족'; growthColor = 'var(--t3)' }
  else if (overallGrowthRate >= 30) { growthLevel = '🔥 초고성장'; growthColor = '#ef4444' }
  else if (overallGrowthRate >= 10) { growthLevel = '🚀 고성장'; growthColor = '#f59e0b' }
  else if (overallGrowthRate >= 0) { growthLevel = '🟢 완만한 성장'; growthColor = '#34d399' }
  else { growthLevel = '🔴 자산 감소'; growthColor = '#3b82f6' }

  return (
    <div style={{ background: 'var(--bg2)', borderRadius: 0, padding: '20px 24px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            {stock?.name} 자산총계 추이 & 증가율
          </div>
          <div style={{ fontSize: '.78rem', color: 'var(--t2)', marginTop: 4 }}>
            <span style={{ color: '#38bdf8' }}>선 = 자산총계(재무상태표)</span> · 점 옆 숫자는 전년 대비 증가율 &nbsp;|&nbsp;
            <span style={{ color: 'var(--t3)' }}>출처: DART 공식 정기보고서 ({fsDiv || '재무제표'})</span>
          </div>
        </div>

        <div style={{ padding: '6px 14px', background: 'rgba(56,189,248,0.12)', border: `1px solid ${growthColor}66`, borderRadius: 0, textAlign: 'right' }}>
          <span style={{ fontSize: '.68rem', color: 'var(--t3)', fontWeight: 700, marginRight: 6 }}>최근 {history.length}개년 누적 증가율</span>
          <span style={{ fontSize: '.95rem', fontWeight: 800, color: growthColor }}>
            {overallGrowthRate === null || overallGrowthRate === undefined ? '-' : `${overallGrowthRate >= 0 ? '+' : ''}${overallGrowthRate.toFixed(1)}%`}
          </span>
          <span style={{ marginLeft: 8, fontSize: '.72rem', color: growthColor, fontWeight: 700 }}>{growthLevel}</span>
        </div>
      </div>

      {/* SVG 그래프 */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <linearGradient id="assetAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* 0 기준선 */}
          <line x1={pad.left} y1={getY(0)} x2={width - pad.right} y2={getY(0)} stroke="rgba(255,255,255,0.12)" />

          {/* 면적 채우기 */}
          {points.length > 1 && <path d={areaPath} fill="url(#assetAreaGrad)" />}

          {/* 자산총계 추이선 */}
          {points.length > 1 && (
            <path d={linePath} fill="none" stroke="#38bdf8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px rgba(56,189,248,0.55))' }} />
          )}

          {/* 데이터 포인트 & 라벨 */}
          {points.map((p, i) => {
            const isHov = hoveredPoint === i
            return (
              <g key={i} style={{ cursor: 'pointer' }} onMouseEnter={() => setHoveredPoint(i)} onMouseLeave={() => setHoveredPoint(null)}>
                {isHov && <circle cx={p.x} cy={p.y} r={15} fill="#38bdf8" opacity={0.15} />}
                <circle cx={p.x} cy={p.y} r={isHov ? 8.5 : 6} fill="#38bdf8" stroke="#0f172a" strokeWidth="2.5" style={{ transition: 'all .2s' }} />

                {/* 자산총계 값 라벨 */}
                <text x={p.x} y={p.y - 30} fill="#7dd3fc" fontSize={isMobile ? "14" : "11"} fontWeight="800" textAnchor="middle">
                  {formatWon(p.totalAssets)}
                </text>
                {/* 전년 대비 증가율 배지 */}
                {p.growthRate !== null && (
                  <text x={p.x} y={p.y - 14} fill={p.growthRate >= 0 ? '#34d399' : '#f87171'} fontSize={isMobile ? "13" : "10.5"} fontWeight="800" textAnchor="middle">
                    {p.growthRate >= 0 ? '+' : ''}{p.growthRate.toFixed(1)}%
                  </text>
                )}
                {/* 연도 라벨 */}
                <text x={p.x} y={height - 15} fill="var(--t2)" fontSize={isMobile ? "14.5" : "11"} fontWeight="700" textAnchor="middle">
                  {p.period}
                </text>
                <text x={p.x} y={height - 3} fill="var(--t3)" fontSize={isMobile ? "12" : "9"} textAnchor="middle">({p.fiscalTerm})</text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* 범례 */}
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.25)', padding: '7px 13px', borderRadius: 0, fontSize: '.74rem', color: 'var(--t2)', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
            <span style={{ display: 'inline-block', width: 16, height: 3, background: '#38bdf8' }} /> 자산총계(연도별)
          </span>
          <span>추정치가 아닌 {corpName || stock?.name}의 실제 DART 공시 재무상태표 원본 수치입니다.</span>
        </div>
        <div>자산 우상향 = 외형 성장 지속 → 재무 퀀트 "자산증가율 TOP" 조건의 근거 지표</div>
      </div>
    </div>
  )
}
