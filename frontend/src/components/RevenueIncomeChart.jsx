// RevenueIncomeChart.jsx — 📊 매출액 및 영업이익 추이 복합 차트 (연간/분기별 탭 스위치 탑재)
import React, { useState, useEffect } from 'react'

export default function RevenueIncomeChart({ stock }) {
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
      <div style={{ fontSize: '1rem', fontWeight: 700 }}>네이버 증권 실제 매출 및 영업이익 데이터 로딩 중...</div>
    </div>
  )

  if (error || !financials) return (
    <div style={{ background: 'var(--bg2)', borderRadius: 0, padding: '20px 24px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.08)', color: 'var(--t3)', textAlign: 'center' }}>
      <div style={{ fontSize: '.9rem' }}>매출액 및 영업이익 재무데이터를 파싱하지 못했습니다 — {error || '데이터 없음'}</div>
    </div>
  )

  // 탭에 맞는 데이터 묶음 선택 (서버 구버전 대응용 폴백)
  const activeDataset = activeTab === 'annual' 
    ? (financials.annual || { years: financials.years || [], revenue: financials.revenue || [], opincome: financials.opincome || [] })
    : (financials.quarter || { years: [], revenue: [], opincome: [] })

  const { years = [], revenue = [], opincome = [] } = activeDataset
  const currentYear = new Date().getFullYear()

  // 데이터 포인트 구성 (데이터 유효 필터)
  const rawData = years.map((year, i) => {
    const isEst = year.includes('(E)')
    const isCurrentYear = year.includes(String(currentYear)) && !isEst
    return {
      year,
      revenue: revenue[i] ?? null,
      opincome: opincome[i] ?? null,
      isFuture: isEst,
      isCurrentYear,
      label: isEst ? '예상(E)' : '실적'
    }
  }).filter(d => d.revenue !== null && d.opincome !== null)

  if (rawData.length === 0) {
    return (
      <div style={{ background: 'var(--bg2)', borderRadius: 0, padding: '24px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.08)', color: 'var(--t2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: '1.02rem', fontWeight: 800, color: '#fff' }}>{stock?.name} 매출액 &amp; 영업이익 추이</div>
          {/* 탭 컨트롤 스위치 */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', padding: 3, borderRadius: 0 }}>
            <button onClick={() => setActiveTab('annual')} style={{ padding: '6px 14px', background: activeTab === 'annual' ? 'var(--accent)' : 'transparent', border: 'none', borderRadius: 0, color: activeTab === 'annual' ? '#fff' : 'var(--t3)', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' }}>연간</button>
            <button onClick={() => setActiveTab('quarter')} style={{ padding: '6px 14px', background: activeTab === 'quarter' ? 'var(--accent)' : 'transparent', border: 'none', borderRadius: 0, color: activeTab === 'quarter' ? '#fff' : 'var(--t3)', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' }}>분기별</button>
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--t3)', fontSize: '.85rem' }}>
          선택하신 {activeTab === 'annual' ? '연간' : '분기별'} 실적 데이터가 네이버 금융에 제공되지 않습니다.
        </div>
      </div>
    )
  }

  // 조 단위 / 억 단위 변환 유틸
  const formatAmt = (val) => {
    if (val === null || val === undefined) return '-'
    if (Math.abs(val) >= 10000) {
      const jo = (val / 10000).toFixed(1)
      return `${jo}조원`
    }
    return `${Math.round(val).toLocaleString()}억원`
  }

  // Y축 스케일링 설정
  const revValues = rawData.map(d => d.revenue)
  const incValues = rawData.map(d => d.opincome)

  const maxRev = Math.max(...revValues)
  const minRev = Math.min(...revValues)
  const padRev = (maxRev - minRev) * 0.15 || maxRev * 0.1

  const maxInc = Math.max(...incValues)
  const minInc = Math.min(...incValues)
  const padInc = (maxInc - minInc) * 0.15 || maxInc * 0.1

  const width = 740, height = 240
  const pad = { top: 46, right: 75, bottom: 44, left: 75 }

  // 매출액(막대) Y좌표 계산
  const getX = (i) => pad.left + (i / (rawData.length - 1)) * (width - pad.left - pad.right)
  const getYRev = (v) => {
    const bottomLimit = minRev - padRev < 0 ? 0 : minRev - padRev
    const topLimit = maxRev + padRev
    return height - pad.bottom - ((v - bottomLimit) / (topLimit - bottomLimit)) * (height - pad.top - pad.bottom)
  }

  // 영업이익(꺾은선) Y좌표 계산
  const getYInc = (v) => {
    const bottomLimit = minInc - padInc
    const topLimit = maxInc + padInc
    return height - pad.bottom - ((v - bottomLimit) / (topLimit - bottomLimit)) * (height - pad.top - pad.bottom)
  }

  const points = rawData.map((d, i) => ({
    ...d,
    x: getX(i),
    yRev: getYRev(d.revenue),
    yInc: getYInc(d.opincome)
  }))

  // 영업이익 꺾은선 패스
  const solidIncPts = points.filter(p => !p.isFuture)
  const solidIncPath = solidIncPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yInc}`).join(' ')
  
  const dashIncStart = solidIncPts[solidIncPts.length - 1]
  const dashIncPts = dashIncStart ? [dashIncStart, ...points.filter(p => p.isFuture)] : points.filter(p => p.isFuture)
  const dashedIncPath = dashIncPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.yInc}`).join(' ')

  // Y축 가이드라인 및 라벨
  const yTicks = [0.2, 0.5, 0.8]
  const revTicks = yTicks.map(r => {
    const bottom = minRev - padRev < 0 ? 0 : minRev - padRev
    const val = bottom + r * ((maxRev + padRev) - bottom)
    return { y: height - pad.bottom - r * (height - pad.top - pad.bottom), val: formatAmt(val) }
  })

  const incTicks = yTicks.map(r => {
    const val = (minInc - padInc) + r * ((maxInc + padInc) - (minInc - padInc))
    return { y: height - pad.bottom - r * (height - pad.top - pad.bottom), val: formatAmt(val) }
  })

  // 영업이익률 평균 계산
  const marginPctList = rawData.map(d => d.revenue > 0 ? (d.opincome / d.revenue * 100).toFixed(1) : 0)
  const latestMargin = marginPctList[marginPctList.length - 1]

  // 데이터 개수에 따라 막대 넓이 동적 튜닝 (분기 6개일 땐 조금 얇게)
  const barWidth = activeTab === 'annual' ? 36 : 24

  return (
    <div style={{ background: 'var(--bg2)', borderRadius: 0, padding: '20px 24px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            {stock?.name} 매출액 &amp; 영업이익 추이 ({activeTab === 'annual' ? '연간' : '분기별'})
          </div>
          <div style={{ fontSize: '.78rem', color: 'var(--t2)', marginTop: 4 }}>
            매출액은 <strong style={{ color: '#3b82f6' }}>막대(좌축)</strong> · 영업이익은 <strong style={{ color: '#f43f5e' }}>꺾은선(우축)</strong> &nbsp;|&nbsp;
            <span style={{ color: 'var(--t3)' }}>출처: 네이버 증권 재무제표</span>
          </div>
        </div>

        {/* 탭 & 이익률 결합 컨트롤러 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* 전환 탭 */}
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
              연간 실적
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
              분기별 실적
            </button>
          </div>

          {/* 영업이익률 요약 배지 */}
          {latestMargin !== null && (
            <div style={{ padding: '6px 14px', background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.4)', borderRadius: 0, textAlign: 'right' }}>
              <span style={{ fontSize: '.68rem', color: 'var(--t3)', fontWeight: 700, marginRight: 6 }}>{activeTab === 'annual' ? '최신 연도' : '최근 분기'} 이익률</span>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f43f5e' }}>
                {latestMargin}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* SVG 그래프 */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            {/* 매출액 그라데이션 */}
            <linearGradient id="revBarGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="revBarGradEst" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* 그리드 가이드라인 */}
          {revTicks.map((t, i) => (
            <line key={i} x1={pad.left} y1={t.y} x2={width - pad.right} y2={t.y} stroke="rgba(255,255,255,0.05)" strokeDasharray="4,4" />
          ))}

          {/* 매출액 Y축 눈금 (왼쪽 - 파란색) */}
          {revTicks.map((t, i) => (
            <text key={i} x={pad.left - 8} y={t.y + 4} fill="#60a5fa" fontSize={isMobile ? "13.5" : "9.5"} fontWeight="700" textAnchor="end">{t.val}</text>
          ))}

          {/* 영업이익 Y축 눈금 (오른쪽 - 분홍색) */}
          {incTicks.map((t, i) => (
            <text key={i} x={width - pad.right + 8} y={t.y + 4} fill="#f43f5e" fontSize={isMobile ? "13.5" : "9.5"} fontWeight="700" textAnchor="start">{t.val}</text>
          ))}

          {/* 축 레이블 타이틀 */}
          <text x={pad.left - 10} y={pad.top - 15} fill="var(--t3)" fontSize={isMobile ? "12" : "9"} fontWeight="800" textAnchor="end">매출액(원)</text>
          <text x={width - pad.right + 10} y={pad.top - 15} fill="var(--t3)" fontSize={isMobile ? "12" : "9"} fontWeight="800" textAnchor="start">영업이익(원)</text>

          {/* 1. 매출액 막대 그래프 렌더링 */}
          {points.map((p, i) => {
            const barHeight = height - pad.bottom - p.yRev
            const fill = p.isFuture ? 'url(#revBarGradEst)' : 'url(#revBarGrad)'
            const stroke = p.isFuture ? 'rgba(96,165,250,0.4)' : '#3b82f6'
            const strokeDash = p.isFuture ? '4,3' : 'none'
            return (
              <g key={`bar-${i}`}>
                <rect
                  x={p.x - barWidth / 2}
                  y={p.yRev}
                  width={barWidth}
                  height={Math.max(2, barHeight)}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth="1.5"
                  strokeDasharray={strokeDash}
                  rx="4"
                />
                {/* 막대 상단 매출액 텍스트 */}
                <text x={p.x} y={p.yRev - 8} fill="#93c5fd" fontSize={isMobile ? "14" : "10.5"} fontWeight="800" textAnchor="middle">
                  {formatAmt(p.revenue)}
                </text>
              </g>
            )
          })}

          {/* 2. 영업이익 꺾은선 (실선) */}
          {solidIncPts.length > 1 && (
            <path d={solidIncPath} fill="none" stroke="#f43f5e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px rgba(244,63,94,0.6))' }} />
          )}

          {/* 2. 영업이익 꺾은선 (점선 - 미래 전망) */}
          {dashIncPts.length > 1 && (
            <path d={dashedIncPath} fill="none" stroke="#fb7185" strokeWidth="3" strokeDasharray="5,5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px rgba(244,63,94,0.4))' }} />
          )}

          {/* 3. 영업이익 데이터 포인트 써클 */}
          {points.map((p, i) => {
            const isHov = hoveredPoint === i
            const circleCol = '#f43f5e'
            const textCol = '#fca5a5'
            return (
              <g key={`point-${i}`} style={{ cursor: 'pointer' }} onMouseEnter={() => setHoveredPoint(i)} onMouseLeave={() => setHoveredPoint(null)}>
                {/* 호버 시 배경 큰 서클 */}
                {isHov && <circle cx={p.x} cy={p.yInc} r={14} fill={circleCol} opacity={0.2} />}
                
                {/* 메인 데이터 서클 */}
                <circle
                  cx={p.x}
                  cy={p.yInc}
                  r={isHov ? 8.5 : (p.isCurrentYear ? 6.5 : 5.0)}
                  fill={circleCol}
                  stroke="#0f172a"
                  strokeWidth="2.5"
                  style={{ transition: 'all .2s' }}
                />

                {/* 꺾은선 위에 영업이익 금액 텍스트 */}
                <text x={p.x} y={p.yInc - 13} fill={textCol} fontSize={isMobile ? "13.5" : "10"} fontWeight="900" textAnchor="middle" style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.8))' }}>
                  {formatAmt(p.opincome)}
                </text>

                {/* X축 연도 눈금 라벨 */}
                <text x={p.x} y={height - 15} fill={p.isFuture ? '#fb7185' : 'var(--t2)'} fontSize={isMobile ? "14.5" : "11"} fontWeight={p.isFuture || p.isCurrentYear ? '900' : '600'} textAnchor="middle">
                  {p.year}
                </text>
                <text x={p.x} y={height - 3} fill="var(--t3)" fontSize={isMobile ? "12" : "9"} textAnchor="middle">({p.label})</text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* 하단 범례 */}
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.25)', padding: '7px 13px', borderRadius: 0, fontSize: '.74rem', color: 'var(--t2)', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
            <span style={{ display: 'inline-block', width: 14, height: 10, background: 'linear-gradient(to bottom, #3b82f6, #1d4ed8)', borderRadius: 0 }} /> 매출액 (막대)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
            <span style={{ display: 'inline-block', width: 16, height: 3, background: '#f43f5e' }} /> 영업이익 (실선)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
            <span style={{ display: 'inline-block', width: 16, height: 3, borderTop: '2.5px dashed #fb7185' }} /> 예상 영업이익 (점선)
          </span>
        </div>
        <div>매출 &amp; 이익 동반 성장 = 강한 펀더멘탈 우량주</div>
      </div>
    </div>
  )
}
