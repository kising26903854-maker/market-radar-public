// NpsHoldingHistoryChart.jsx — 📈 국민연금공단 보유비중 변동 이력 (DART 대량보유 상황보고서 실공시 기반) + 일봉 가격 컨텍스트
// 5%룰 특성상 매일/매분기 데이터가 아니라 "1%p 이상 변동 또는 보유목적 변경 시점"의 계단형 이력이다.
// 같은 기간의 일봉(종가) 캔들을 함께 그려서 보유비중 변동 시점의 주가 흐름을 같이 볼 수 있게 한다.
import React, { useState, useEffect } from 'react'

export default function NpsHoldingHistoryChart({ stock }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [candles, setCandles] = useState([])
  const [priceLoading, setPriceLoading] = useState(false)
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
    setCandles([])
    fetch(`/api/nps-holding-history/${code}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setData(d)
        else setError(d.error || '데이터를 불러올 수 없습니다.')
      })
      .catch(() => setError('네트워크 오류'))
      .finally(() => setLoading(false))
  }, [code])

  // 국민연금 이력이 확인되면, 그 최초 공시일 ~ 오늘까지를 커버할 만큼의 일봉을 함께 조회한다.
  useEffect(() => {
    if (!code || !data?.success || !data.history || data.history.length === 0) return
    const firstDate = new Date(data.history[0].date).getTime()
    const spanDays = Math.max(1, (Date.now() - firstDate) / 86400000)
    const estTradingDays = Math.ceil(spanDays * (5 / 7)) + 20
    const pages = Math.min(25, Math.max(2, Math.ceil(estTradingDays / 60) + 1))

    setPriceLoading(true)
    fetch(`/api/daily-price/${code}?pages=${pages}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setCandles(d.series || [])
      })
      .catch(() => {})
      .finally(() => setPriceLoading(false))
  }, [code, data])

  if (loading) return (
    <div style={{ background: 'var(--bg2)', borderRadius: 0, padding: '28px 24px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', color: 'var(--t3)' }}>
      <div style={{ fontSize: '1rem', fontWeight: 700 }}>DART 대량보유 공시 원문 조회 중...</div>
    </div>
  )

  if (error) return (
    <div style={{ background: 'var(--bg2)', borderRadius: 0, padding: '20px 24px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.08)', color: 'var(--t3)', textAlign: 'center' }}>
      <div style={{ fontSize: '.9rem' }}>국민연금 보유이력을 조회하지 못했습니다 — {error}</div>
    </div>
  )

  const history = data?.history || []

  const header = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
      <div>
        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
          {stock?.name} 국민연금 보유비중 변동 이력 {candles.length > 0 && <span style={{ fontSize: '.72rem', color: 'var(--t3)', fontWeight: 700 }}>+ 일봉</span>}
          {data?.isNew && (
            <span style={{ fontSize: '.68rem', padding: '2px 8px', borderRadius: 0, background: '#ef4444', color: '#fff', fontWeight: 800, animation: 'pulse 1.6s ease-in-out infinite' }}>
              🆕 NEW
            </span>
          )}
        </div>
        <div style={{ fontSize: '.78rem', color: 'var(--t2)', marginTop: 4 }}>
          출처: <span style={{ color: 'var(--t3)' }}>DART 대량보유상황보고서(majorstock.json) 실공시 원문{candles.length > 0 ? ' · 네이버 증권 일봉' : ''}</span>
        </div>
      </div>
    </div>
  )

  if (history.length === 0) {
    return (
      <div style={{ background: 'var(--bg2)', borderRadius: 0, padding: '20px 24px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.08)', color: 'var(--t2)' }}>
        {header}
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--t3)', fontSize: '.85rem' }}>
          DART에 공시된 국민연금 대량보유(5%+) 변동 이력이 없습니다.<br />
          <span style={{ fontSize: '.76rem' }}>국민연금이 5% 미만을 보유했거나, 최근 1%p 이상 지분 변동·보유목적 변경이 없어 신규 공시가 발생하지 않은 종목일 수 있습니다.</span>
        </div>
      </div>
    )
  }

  const parsed = history.map(h => ({ ...h, t: new Date(h.date).getTime() }))
  const today = Date.now()

  const width = 740, height = candles.length > 0 ? 300 : 220
  const pad = { top: 42, right: 58, bottom: 50, left: 62 }

  const sortedCandles = [...candles].sort((a, b) => a.date.localeCompare(b.date))
  const candleTimes = sortedCandles.map(c => new Date(c.date).getTime())

  const minT = Math.min(parsed[0].t, ...(candleTimes.length ? [candleTimes[0]] : []))
  const maxT = Math.max(today, parsed[parsed.length - 1].t)
  const spanT = (maxT - minT) || 1

  const getX = (t) => pad.left + ((t - minT) / spanT) * (width - pad.left - pad.right)

  const ratios = parsed.map(h => h.ratio)
  const minR = Math.min(...ratios)
  const maxR = Math.max(...ratios)
  const padR = (maxR - minR) * 0.35 || 1.5
  const getYRatio = (v) => height - pad.bottom - ((v - (minR - padR)) / ((maxR + padR) - (minR - padR))) * (height - pad.top - pad.bottom)

  // 일봉 가격축 (왼쪽) — 캔들이 있을 때만 사용
  const hasCandles = sortedCandles.length > 0
  let getYPrice = () => height - pad.bottom
  let priceTicks = []
  if (hasCandles) {
    const highs = sortedCandles.map(c => c.high)
    const lows = sortedCandles.map(c => c.low)
    const minP = Math.min(...lows)
    const maxP = Math.max(...highs)
    const padP = (maxP - minP) * 0.12 || maxP * 0.05 || 1
    getYPrice = (v) => height - pad.bottom - ((v - (minP - padP)) / ((maxP + padP) - (minP - padP))) * (height - pad.top - pad.bottom)
    priceTicks = [0.2, 0.5, 0.8].map(r => {
      const val = (minP - padP) + r * ((maxP + padP) - (minP - padP))
      return { y: height - pad.bottom - r * (height - pad.top - pad.bottom), val: Math.round(val) }
    })
  }

  const candlePlot = sortedCandles.map(c => ({
    ...c,
    x: getX(new Date(c.date).getTime()),
    yOpen: getYPrice(c.open),
    yClose: getYPrice(c.close),
    yHigh: getYPrice(c.high),
    yLow: getYPrice(c.low)
  }))
  const candleWidth = hasCandles ? Math.max(1, Math.min(6, ((width - pad.left - pad.right) / candlePlot.length) * 0.62)) : 0

  const points = parsed.map(h => ({ ...h, x: getX(h.t), y: getYRatio(h.ratio) }))

  // 계단형(step-after) 경로: 각 공시 시점에서 다음 공시 시점까지 동일 비중 유지
  let stepPath = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    stepPath += ` L ${points[i].x} ${points[i - 1].y} L ${points[i].x} ${points[i].y}`
  }
  const xToday = getX(today)
  const lastPt = points[points.length - 1]
  const hasTodayExtension = xToday > lastPt.x + 1

  const ratioTicks = [0.2, 0.5, 0.8].map(r => {
    const val = (minR - padR) + r * ((maxR + padR) - (minR - padR))
    return { y: height - pad.bottom - r * (height - pad.top - pad.bottom), val: val.toFixed(1) }
  })

  const fmtDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-')
    return `${y.slice(2)}.${m}.${d}`
  }

  const latest = points[points.length - 1]

  return (
    <div style={{ background: 'var(--bg2)', borderRadius: 0, padding: '20px 24px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
      {header}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ padding: '5px 12px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: 0 }}>
          <span style={{ fontSize: '.68rem', color: 'var(--t3)', fontWeight: 700, marginRight: 6 }}>최근 공시 비중</span>
          <span style={{ fontSize: '.9rem', fontWeight: 800, color: '#34d399' }}>{latest.ratio}%</span>
        </div>
        <div style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 0 }}>
          <span style={{ fontSize: '.68rem', color: 'var(--t3)', fontWeight: 700, marginRight: 6 }}>공시 건수</span>
          <span style={{ fontSize: '.9rem', fontWeight: 800, color: 'var(--t1)' }}>{points.length}건</span>
        </div>
        {priceLoading && (
          <div style={{ padding: '5px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 0 }}>
            <span style={{ fontSize: '.72rem', color: 'var(--t3)' }}>일봉 불러오는 중...</span>
          </div>
        )}
      </div>

      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <linearGradient id="npsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* 비중(%) 그리드 — 오른쪽 축 */}
          {ratioTicks.map((t, i) => (
            <g key={`r${i}`}>
              <line x1={pad.left} y1={t.y} x2={width - pad.right} y2={t.y} stroke="rgba(255,255,255,0.06)" strokeDasharray="4,4" />
              <text x={width - pad.right + 6} y={t.y + 4} fill="#6ee7b7" fontSize={isMobile ? "13.5" : "10"} textAnchor="start">{t.val}%</text>
            </g>
          ))}

          {/* 가격 축 — 왼쪽 (캔들이 있을 때만) */}
          {hasCandles && priceTicks.map((t, i) => (
            <text key={`p${i}`} x={pad.left - 6} y={t.y + 4} fill="var(--t3)" fontSize={isMobile ? "13.5" : "10"} textAnchor="end">{t.val.toLocaleString()}</text>
          ))}

          {/* 일봉 캔들 (가격 컨텍스트) */}
          {hasCandles && candlePlot.map((c, i) => {
            const isBull = c.close >= c.open
            const color = isBull ? '#f87171' : '#60a5fa'
            return (
              <g key={`c${i}`}>
                <line x1={c.x} y1={c.yHigh} x2={c.x} y2={c.yLow} stroke={color} strokeWidth="1" opacity="0.85" />
                <rect x={c.x - candleWidth / 2} y={Math.min(c.yOpen, c.yClose)} width={candleWidth} height={Math.max(1, Math.abs(c.yClose - c.yOpen))} fill={color} opacity="0.9" />
              </g>
            )
          })}

          {/* 계단형 면적 (비중) */}
          <path d={`${stepPath}${hasTodayExtension ? ` L ${xToday} ${lastPt.y}` : ''} L ${hasTodayExtension ? xToday : lastPt.x} ${height - pad.bottom} L ${points[0].x} ${height - pad.bottom} Z`} fill="url(#npsGrad)" />

          {/* 계단형 실선 (비중) */}
          <path d={stepPath} fill="none" stroke="#34d399" strokeWidth="3.5" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px rgba(52,211,153,0.55))' }} />

          {/* 마지막 공시 이후 ~ 현재까지: 변동 공시가 없었다는 뜻의 점선 연장 */}
          {hasTodayExtension && (
            <line x1={lastPt.x} y1={lastPt.y} x2={xToday} y2={lastPt.y} stroke="#34d399" strokeWidth="2.5" strokeDasharray="6,6" opacity="0.55" />
          )}

          {points.map((p, i) => {
            const isHov = hoveredPoint === i
            const isUp = p.ratioChange === null || p.ratioChange >= 0
            return (
              <g key={i} style={{ cursor: 'pointer' }} onMouseEnter={() => setHoveredPoint(i)} onMouseLeave={() => setHoveredPoint(null)}>
                {isHov && <circle cx={p.x} cy={p.y} r={16} fill="#34d399" opacity={0.18} />}
                <circle cx={p.x} cy={p.y} r={isHov ? 9 : 6} fill={isUp ? '#34d399' : '#ef4444'} stroke="#0f172a" strokeWidth="2.5" style={{ transition: 'all .2s' }} />
                <text x={p.x} y={p.y - 16} fill="#6ee7b7" fontSize={isMobile ? '15' : '11.5'} fontWeight="900" textAnchor="middle">{p.ratio}%</text>
                <text x={p.x} y={height - 24} fill="var(--t2)" fontSize={isMobile ? '13.5' : '10'} fontWeight="700" textAnchor="middle">{fmtDate(p.date)}</text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* 범례 */}
      {hasCandles && (
        <div style={{ marginTop: 4, display: 'flex', gap: 14, alignItems: 'center', fontSize: '.72rem', color: 'var(--t2)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, background: '#f87171', borderRadius: 0 }} /> 일봉 상승
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, background: '#60a5fa', borderRadius: 0 }} /> 일봉 하락
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700 }}>
            <span style={{ display: 'inline-block', width: 16, height: 3, background: '#34d399' }} /> 국민연금 보유비중(%, 우측축)
          </span>
        </div>
      )}

      {/* 호버 상세 정보 */}
      {hoveredPoint !== null && points[hoveredPoint] && (
        <div style={{ marginTop: 8, padding: '10px 14px', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 0, fontSize: '.78rem', color: 'var(--t1)' }}>
          <strong style={{ color: '#34d399' }}>{fmtDate(points[hoveredPoint].date)}</strong>
          {' — '}비중 <strong>{points[hoveredPoint].ratio}%</strong>
          {points[hoveredPoint].ratioChange !== null && (
            <span style={{ color: points[hoveredPoint].ratioChange >= 0 ? '#34d399' : '#ef4444' }}>
              {' '}({points[hoveredPoint].ratioChange >= 0 ? '+' : ''}{points[hoveredPoint].ratioChange}%p)
            </span>
          )}
          {points[hoveredPoint].reason && <span style={{ color: 'var(--t2)' }}> · {points[hoveredPoint].reason}</span>}
        </div>
      )}

      <div style={{ marginTop: 10, background: 'rgba(0,0,0,0.25)', padding: '7px 13px', borderRadius: 0, fontSize: '.72rem', color: 'var(--t3)' }}>
        {data.note}
      </div>
    </div>
  )
}
