// StockDetailModal.jsx — 🏛️ 종목 상세 퀀트 분석 & 실시간 차트 모달 팝업
import React, { useState, useEffect } from 'react'
import StockShortSellingChart from './StockShortSellingChart.jsx'

export default function StockDetailModal({ stock, onClose, onOpenValueChain }) {
  const [period, setPeriod] = useState('day') // 'minute' | 'day' | 'week' | 'month' | 'year'
  const [chartData, setChartData] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [smartMoney, setSmartMoney] = useState(null)
  const [companySummary, setCompanySummary] = useState(null)
  const [financials, setFinancials] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hoverData, setHoverData] = useState(null)
  const [hoverLiqPoint, setHoverLiqPoint] = useState(null)

  useEffect(() => {
    if (!stock?.code) return
    let isMounted = true
    setLoading(true)

    async function loadDetail() {
      try {
        const [chartRes, wallstreetRes, smartRes, summaryRes, finRes] = await Promise.all([
          fetch(`/api/chart/${stock.code}?type=${period}`).then(r => r.json()).catch(() => null),
          fetch(`/api/wallstreet/${stock.code}?days=60`).then(r => r.json()).catch(() => null),
          fetch(`/api/smart-money/${stock.code}?days=60`).then(r => r.json()).catch(() => null),
          fetch(`/api/company-summary/${stock.code}`).then(r => r.json()).catch(() => null),
          fetch(`/api/company-financials/${stock.code}`).then(r => r.json()).catch(() => null)
        ])

        if (isMounted) {
          if (chartRes?.success && Array.isArray(chartRes.chart)) {
            setChartData(chartRes.chart)
          }
          if (wallstreetRes?.success && wallstreetRes.analysis) {
            setAnalysis(wallstreetRes.analysis)
          }
          if (smartRes?.success && smartRes.analysis) {
            setSmartMoney(smartRes.analysis)
          }
          if (summaryRes?.success) {
            setCompanySummary(summaryRes)
          }
          if (finRes?.success && finRes.annual) {
            setFinancials(finRes)
          }
        }
      } catch (e) {
        console.error('팝업 데이터 로드 오류:', e)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadDetail()
    const interval = setInterval(loadDetail, period === 'minute' ? 3000 : 6000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [stock?.code, period])

  if (!stock) return null

  const cardPrice = (typeof stock.currentPrice === 'number' && stock.currentPrice > 0) ? stock.currentPrice : (typeof stock.currentPrice === 'string' ? parseFloat(stock.currentPrice.replace(/[^0-9.-]/g, '')) : null)
  const analysisPrice = (typeof analysis?.currentPrice === 'number' && analysis.currentPrice > 0) ? analysis.currentPrice : null
  const lastCandleClose = (chartData.length > 0 && chartData[chartData.length - 1].close > 0) ? chartData[chartData.length - 1].close : null
  const displayCurrentPrice = cardPrice || analysisPrice || stock.current_price || stock.buy_price || lastCandleClose || 0

  // ─── SVG 캔들스틱 차트 계산 ───
  const width = 800
  const height = 400
  const padding = { top: 50, right: 125, bottom: 45, left: 15 }

  const candles = (chartData || []).map(d => {
    const o = d.open !== undefined ? Number(d.open) : Number(d.price || d.close)
    const h = d.high !== undefined ? Number(d.high) : Number(d.price || d.close)
    const l = d.low !== undefined ? Number(d.low) : Number(d.price || d.close)
    const c = d.close !== undefined ? Number(d.close) : Number(d.price || d.close)
    const v = Number(d.volume) || 0
    return { ...d, open: o, high: h, low: l, close: c, volume: v }
  })

  const optimalPrice = stock.optimalBuyPrice || analysis?.optimalBuyPrice

  const allPrices = []
  candles.forEach(c => {
    if (c.high && !isNaN(c.high) && c.high > 0) allPrices.push(c.high)
    if (c.low && !isNaN(c.low) && c.low > 0) allPrices.push(c.low)
  })

  if (smartMoney?.estimatedCost && smartMoney.estimatedCost > 0) allPrices.push(Number(smartMoney.estimatedCost))
  if (optimalPrice && optimalPrice > 0) allPrices.push(Number(optimalPrice))

  const rawMin = allPrices.length ? Math.min(...allPrices) : 100
  const rawMax = allPrices.length ? Math.max(...allPrices) : 200
  const priceMargin = (rawMax - rawMin) * 0.1 || 10
  const minPrice = Math.max(1, rawMin - priceMargin)
  const maxPrice = rawMax + priceMargin
  const maxVolume = Math.max(...candles.map(c => c.volume), 1)

  const getX = (i) => {
    if (!candles || candles.length <= 1) return padding.left
    return padding.left + (i / (candles.length - 1)) * (width - padding.left - padding.right)
  }

  const getY = (val) => {
    if (val === undefined || val === null || isNaN(val) || maxPrice === minPrice) return height / 2
    return height - padding.bottom - ((val - minPrice) / (maxPrice - minPrice)) * (height - padding.top - padding.bottom)
  }

  const isUp = candles.length > 1 ? (candles[candles.length - 1].close >= candles[0].close) : true
  const strokeColor = isUp ? '#ef4444' : '#3b82f6'
  const candleWidth = Math.max(3, Math.min(13, ((width - padding.left - padding.right) / Math.max(1, candles.length)) * 0.68))

  // 🕵️‍♂️ 세력 매집봉 (Accumulation Bars) 퀀트 탐지
  const avgVol = candles.length > 0 ? (candles.reduce((acc, c) => acc + c.volume, 0) / candles.length) : 1
  const accumulationBars = candles.filter(c => c.volume >= avgVol * 1.5 && c.close >= c.open * 0.995).map(c => {
    const volRatio = Math.round((c.volume / (avgVol || 1)) * 100)
    const priceChangePct = (((c.close - c.open) / (c.open || 1)) * 100).toFixed(1)
    
    let signal = '🕵️‍♂️ 1차 바닥 매집봉'
    let signalColor = '#f59e0b'
    if (volRatio >= 260) {
      signal = '🔥 세력 물량 잠금 대량 매집봉'
      signalColor = '#ef4444'
    } else if (c.close > c.open && parseFloat(priceChangePct) >= 2.0) {
      signal = '🚀 돌파 강세 매집봉'
      signalColor = '#10b981'
    }

    return {
      date: c.date || c.time || '매집일',
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      volRatio,
      priceChangePct,
      signal,
      signalColor
    }
  }).reverse()

  return (
    <div className="modal-overlay" onClick={onClose} style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.82)',
      backdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }}>
      <div
        className="modal-content"
        style={{
          maxWidth: 900,
          width: '94%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '26px 30px',
          background: '#0e131f',
          borderRadius: 20,
          border: '1.5px solid rgba(245, 158, 11, 0.7)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.9)',
          color: 'var(--t1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ─── 1. 상단 모달 헤더 ─── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
          <div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>🏛️ {stock.name}</span>
              <span style={{ fontSize: '1rem', color: 'var(--t3)', fontWeight: 600, fontFamily: 'Space Mono' }}>({stock.code})</span>
              {stock.market && (
                <span style={{ fontSize: '.72rem', background: 'rgba(255,255,255,0.08)', color: '#38bdf8', padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>
                  {stock.market}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#ffffff', fontFamily: 'Space Mono' }}>
                현재가: {displayCurrentPrice ? Number(displayCurrentPrice).toLocaleString() + '원' : '실시간 시세 동기화 중...'}
              </span>
              {stock.targetPrice && (
                <span style={{ padding: '3px 10px', background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', borderRadius: 14, fontSize: '.8rem', color: '#34d399', fontWeight: 800 }}>
                  🎯 월가 적정목표: {Number(stock.targetPrice).toLocaleString()}원
                </span>
              )}
              <button
                onClick={() => {
                  const el = document.getElementById('short-selling-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                style={{
                  padding: '4px 12px',
                  background: 'rgba(239,68,68,0.2)',
                  border: '1px solid #ef4444',
                  borderRadius: 20,
                  fontSize: '.82rem',
                  color: '#f87171',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <span>📉 공매도 추이 분석</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {onOpenValueChain && (
              <button
                onClick={() => onOpenValueChain(stock.code, stock.name)}
                style={{
                  padding: '6px 14px',
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(168,85,247,0.25) 100%)',
                  border: '1px solid #818cf8',
                  color: '#c084fc',
                  borderRadius: 10,
                  fontSize: '.8rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                🔗 밸류체인 보기
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: '#ffffff',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                width: 36,
                height: 36,
                cursor: 'pointer',
                fontWeight: 900,
                fontSize: '1.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
              }}
              title="닫기"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ─── 2. 기업 개요 (FnGuide 공식 데이터) ─── */}
        {companySummary && (companySummary.summary || companySummary.paragraphs?.length > 0) && (
          <div style={{
            marginBottom: 20,
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.25) 0%, rgba(15, 23, 42, 0.8) 100%)',
            border: '1.5px solid rgba(96, 165, 250, 0.4)',
            borderRadius: 16,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: '.95rem', fontWeight: 900, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🏢</span>
                <span>무엇을 하는 회사인가? (기업 개요 & 핵심 비즈니스)</span>
                {companySummary.wicsSector && (
                  <span style={{ fontSize: '.74rem', background: 'rgba(59,130,246,0.25)', color: '#60a5fa', padding: '2px 8px', borderRadius: 6, fontWeight: 800 }}>
                    WICS: {companySummary.wicsSector}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '.72rem', color: 'var(--t3)', fontWeight: 700 }}>
                📡 FnGuide 공식 연동
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {companySummary.paragraphs && companySummary.paragraphs.length > 0 ? (
                companySummary.paragraphs.map((p, pIdx) => {
                  const tagTitles = ['📌 [설립 및 기본 개요]', '📦 [주요 사업 부문 및 핵심 제품]', '🚀 [미래 성장 전략 및 경쟁력]']
                  return (
                    <div key={pIdx} style={{
                      padding: '10px 14px',
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: 10,
                      borderLeft: `4px solid #60a5fa`,
                      fontSize: '.82rem',
                      lineHeight: 1.6,
                      color: '#e2e8f0'
                    }}>
                      <div style={{ fontWeight: 900, color: '#93c5fd', marginBottom: 3 }}>
                        {tagTitles[pIdx] || `📌 [개요 ${pIdx + 1}]`}
                      </div>
                      {p}
                    </div>
                  )
                })
              ) : (
                <div style={{ fontSize: '.84rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                  {companySummary.summary}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── 3. 실시간 주가 차트 (TradingView 스타일 SVG) ─── */}
        <div style={{ background: '#0a0d14', borderRadius: 18, padding: 18, marginBottom: 20, border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 12px 36px rgba(0,0,0,0.5)' }}>
          {/* 차트 상단 컨트롤 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <div style={{ fontWeight: 900, color: 'var(--gold)', fontSize: '.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📈</span>
              <span>월가 TradingView 스타일 프리미엄 차트 ({stock.name})</span>
            </div>

            {/* 분봉 / 일봉 / 주봉 / 월봉 / 년봉 탭 */}
            <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.5)', padding: 3, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
              {[
                { id: 'minute', label: '⚡ 분봉' },
                { id: 'day', label: '📅 일봉' },
                { id: 'week', label: '주봉' },
                { id: 'month', label: '월봉' },
                { id: 'year', label: '📆 년봉' }
              ].map(t => (
                <button
                  key={t.id}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 7,
                    border: 'none',
                    background: period === t.id ? 'var(--accent)' : 'transparent',
                    color: period === t.id ? '#ffffff' : 'var(--t3)',
                    fontSize: '.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => setPeriod(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3대 핵심 타점 배너 & Hover HUD */}
          <div style={{ display: 'flex', gap: 16, fontSize: '.85rem', color: 'var(--t2)', marginBottom: 14, flexWrap: 'wrap', background: 'rgba(15,23,42,0.95)', padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <span style={{ color: 'var(--t3)', marginRight: 5, fontWeight: 700 }}>현재가</span>
                <strong style={{ color: isUp ? '#ef4444' : '#3b82f6', fontFamily: 'Space Mono', fontSize: '1.1rem', fontWeight: 900 }}>{(displayCurrentPrice || 0).toLocaleString()}원</strong>
              </div>
              {smartMoney?.estimatedCost > 0 && (
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 14 }}>
                  <span style={{ color: '#c084fc', marginRight: 5, fontWeight: 800 }}>🟣 세력선 (추정평단)</span>
                  <strong style={{ color: '#ffffff', fontFamily: 'Space Mono', fontSize: '1.05rem', fontWeight: 900 }}>{(smartMoney.estimatedCost || 0).toLocaleString()}원</strong>
                </div>
              )}
              {optimalPrice > 0 && (
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 14 }}>
                  <span style={{ color: '#34d399', marginRight: 5, fontWeight: 800 }}>🟢 월가 적정매입가</span>
                  <strong style={{ color: '#ffffff', fontFamily: 'Space Mono', fontSize: '1.05rem', fontWeight: 900 }}>{(optimalPrice || 0).toLocaleString()}원</strong>
                </div>
              )}
            </div>

            {/* Hover HUD */}
            <div style={{ background: 'rgba(0,0,0,0.6)', padding: '5px 12px', borderRadius: 8, minWidth: 240, border: '1px solid rgba(255,255,255,0.08)' }}>
              {hoverData ? (
                <div style={{ fontSize: '.76rem', color: '#ffffff' }}>
                  <span style={{ color: 'var(--gold)', fontWeight: 800 }}>[{hoverData.date || hoverData.time}]</span>
                  <span style={{ marginLeft: 6 }}>시: <strong>{(hoverData.open || 0).toLocaleString()}</strong></span>
                  <span style={{ marginLeft: 6 }}>종: <strong style={{ color: hoverData.close >= hoverData.open ? '#ef4444' : '#3b82f6' }}>{(hoverData.close || 0).toLocaleString()}</strong></span>
                  <span style={{ marginLeft: 6 }}>거래량: <strong>{(hoverData.volume || 0).toLocaleString()}</strong></span>
                </div>
              ) : (
                <div style={{ color: 'var(--t3)', fontSize: '.76rem', textAlign: 'center' }}>
                  🕯️ 캔들에 마우스를 올리면 상세 시세가 뜹니다
                </div>
              )}
            </div>
          </div>

          {/* SVG 차트 본체 */}
          <div style={{ position: 'relative', width: '100%', overflow: 'hidden', background: '#0a0d14', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '70px 0', color: 'var(--gold)', fontSize: '.95rem' }}>
                ⏳ 실시간 캔들스틱 및 세력선 퀀트 계산 중...
              </div>
            ) : candles.length > 0 ? (
              <svg
                viewBox={`0 0 ${width} ${height}`}
                style={{ width: '100%', height: 360, display: 'block' }}
                onMouseLeave={() => setHoverData(null)}
              >
                <defs>
                  <filter id="modal-glow-green" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <filter id="modal-glow-purple" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* 수평 가격 그리드 라인 */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                  const p = minPrice + (maxPrice - minPrice) * ratio
                  const y = getY(p)
                  return (
                    <g key={idx}>
                      <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                      <text x={width - padding.right + 8} y={y + 4} fill="var(--t3)" fontSize="10" fontFamily="Space Mono">
                        {Math.round(p).toLocaleString()}
                      </text>
                    </g>
                  )
                })}

                {/* 캔들스틱 & 하단 거래량 바 */}
                {candles.map((c, i) => {
                  const cx = getX(i)
                  const isBull = c.close >= c.open
                  const candleColor = isBull ? '#f87171' : '#60a5fa'

                  const highY = getY(c.high)
                  const lowY = getY(c.low)
                  const openY = getY(c.open)
                  const closeY = getY(c.close)

                  const bodyTop = Math.min(openY, closeY)
                  const bodyBottom = Math.max(openY, closeY)
                  const bodyHeight = Math.max(2, bodyBottom - bodyTop)

                  const volBarHeight = (c.volume / maxVolume) * 50
                  const volBarY = height - padding.bottom - volBarHeight

                  return (
                    <g key={i} onMouseEnter={() => setHoverData({ ...c, cx, cy: getY(c.close) })} style={{ cursor: 'pointer' }}>
                      <rect x={cx - candleWidth / 2} y={volBarY} width={candleWidth} height={volBarHeight} fill={candleColor} opacity="0.25" rx="1" />
                      <line x1={cx} y1={highY} x2={cx} y2={lowY} stroke={candleColor} strokeWidth="1.5" />
                      <rect x={cx - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} fill={candleColor} stroke="#000" strokeWidth="0.5" rx="1" />
                    </g>
                  )
                })}

                {/* 🟢 1. 월가 적정매입가 레이저 빔 */}
                {optimalPrice > 0 && (() => {
                  const y = getY(optimalPrice)
                  return (
                    <g key="modal-horiz-optimal">
                      <line x1={padding.left} y1={y} x2={width - padding.right + 6} y2={y} stroke="#00ff9d" strokeWidth="3" filter="url(#modal-glow-green)" opacity="0.9" />
                      <line x1={padding.left} y1={y} x2={width - padding.right + 6} y2={y} stroke="#ffffff" strokeWidth="1.2" />
                      <rect x={width - padding.right + 6} y={y - 12} width={110} height={24} rx={6} fill="#059669" stroke="#00ff9d" strokeWidth="1.5" />
                      <text x={width - padding.right + 12} y={y + 4} fill="#ffffff" fontSize="11" fontWeight="900" fontFamily="Space Mono">
                        적정 {Number(optimalPrice).toLocaleString()}
                      </text>
                    </g>
                  )
                })()}

                {/* 🟣 2. 세력선 (추정평단) 레이저 빔 */}
                {smartMoney?.estimatedCost > 0 && (() => {
                  const y = getY(smartMoney.estimatedCost)
                  return (
                    <g key="modal-horiz-smart">
                      <line x1={padding.left} y1={y} x2={width - padding.right + 6} y2={y} stroke="#d8b4fe" strokeWidth="3.5" filter="url(#modal-glow-purple)" opacity="0.95" />
                      <line x1={padding.left} y1={y} x2={width - padding.right + 6} y2={y} stroke="#ffffff" strokeWidth="1.4" />
                      <rect x={width - padding.right + 6} y={y - 13} width={110} height={26} rx={6} fill="#7e22ce" stroke="#d8b4fe" strokeWidth="1.5" />
                      <text x={width - padding.right + 12} y={y + 4.5} fill="#ffffff" fontSize="11" fontWeight="900" fontFamily="Space Mono">
                        세력 {Number(smartMoney.estimatedCost).toLocaleString()}
                      </text>
                    </g>
                  )
                })()}

                {/* 호버 가이드라인 */}
                {hoverData && hoverData.cx && (
                  <g pointerEvents="none">
                    <line x1={hoverData.cx} y1={padding.top} x2={hoverData.cx} y2={height - padding.bottom} stroke="#ffffff" strokeDasharray="3 3" strokeWidth="1.2" opacity="0.6" />
                    <line x1={padding.left} y1={hoverData.cy} x2={width - padding.right} y2={hoverData.cy} stroke="#ffffff" strokeDasharray="3 3" strokeWidth="1.2" opacity="0.6" />
                    <circle cx={hoverData.cx} cy={hoverData.cy} r="4.5" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
                  </g>
                )}
              </svg>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>차트 데이터를 불러올 수 없습니다.</div>
            )}
          </div>
        </div>

        {/* ─── 📉 한국거래소(KRX) 공식 개별종목 공매도(Short Selling) 거래량·거래대금·비중(%) 인터랙티브 듀얼 차트 ─── */}
        <div id="short-selling-section">
          <StockShortSellingChart stockCode={stock.code} stockName={stock.name} />
        </div>

        {/* ─── 4. 🕵️‍♂️ 세력 매집봉 포착 일자 타임라인 표 ─── */}
        <div style={{ background: 'var(--bg3)', borderRadius: 16, padding: 18, marginBottom: 20, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontWeight: 900, color: 'var(--gold)', fontSize: '.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>🕵️‍♂️ [월가 퀀트] 세력 매집봉 (Smart Money Accumulation Bar) 포착 일자 표</span>
            </div>
            <div style={{ fontSize: '.74rem', color: 'var(--t3)' }}>
              평균 거래량 대비 150% 이상 터진 주포/세력의 매집 캔들 타임라인
            </div>
          </div>

          {accumulationBars.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--t3)', fontSize: '.84rem' }}>
              최근 60일간 뚜렷한 세력 대량 매집봉이 탐지되지 않았습니다.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', color: 'var(--t2)' }}>
                    <th style={{ padding: '9px 12px' }}>📅 매집봉 날짜</th>
                    <th style={{ padding: '9px 12px' }}>💰 종가 / 고가</th>
                    <th style={{ padding: '9px 12px' }}>📊 당일 거래량 / 폭발률</th>
                    <th style={{ padding: '9px 12px' }}>📈 당일 등락률</th>
                    <th style={{ padding: '9px 12px' }}>🏷️ 세력 매집 진단</th>
                  </tr>
                </thead>
                <tbody>
                  {accumulationBars.map((bar, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px dashed rgba(255,255,255,0.08)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--t1)' }}>{bar.date}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--t1)' }}>
                        {Number(bar.close).toLocaleString()}원 <span style={{ fontSize: '.72rem', color: 'var(--t3)' }}>(고 {Number(bar.high).toLocaleString()})</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: bar.volRatio >= 250 ? '#ef4444' : 'var(--gold)' }}>
                        {Number(bar.volume).toLocaleString()}주 <span style={{ fontSize: '.72rem', padding: '1px 6px', background: `${bar.signalColor}22`, borderRadius: 4 }}>🔥 +{bar.volRatio}% 폭발</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: parseFloat(bar.priceChangePct) >= 0 ? '#ef4444' : '#3b82f6' }}>
                        {parseFloat(bar.priceChangePct) >= 0 ? `+${bar.priceChangePct}%` : `${bar.priceChangePct}%`}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: '.74rem', padding: '3px 8px', background: `${bar.signalColor}22`, border: `1px solid ${bar.signalColor}`, borderRadius: 6, color: bar.signalColor, fontWeight: 900 }}>
                          {bar.signal}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ─── 5. 월가 6대 기관 퀀트 지표 리포트 ─── */}
        {analysis && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 20 }}>
            {/* 1. TWAP */}
            <div style={{ padding: 14, background: 'var(--bg3)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 800, color: 'var(--accent)', marginBottom: 4, fontSize: '.84rem' }}>⏱️ TWAP (스텔스 매집도)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{analysis.twap?.uniformity || 70}%</div>
              <div style={{ fontSize: '.74rem', color: 'var(--t2)', marginTop: 4 }}>{analysis.twap?.status || '분할 매집 진행'}</div>
            </div>

            {/* 2. OBV */}
            <div style={{ padding: 14, background: 'var(--bg3)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 800, color: 'var(--accent2)', marginBottom: 4, fontSize: '.84rem' }}>🌊 OBV (자금 유출입)</div>
              <div style={{ fontSize: '.95rem', fontWeight: 900, color: 'var(--up)' }}>{analysis.obv?.trend || '자금 유입'}</div>
              <div style={{ fontSize: '.74rem', color: 'var(--t3)', marginTop: 4 }}>누적: {(analysis.obv?.value || 0).toLocaleString()}</div>
            </div>

            {/* 3. Z-Score */}
            <div style={{ padding: 14, background: 'rgba(99,102,241,0.12)', borderRadius: 12, border: '1px solid rgba(99,102,241,0.4)' }}>
              <div style={{ fontWeight: 800, color: '#818cf8', marginBottom: 4, fontSize: '.84rem' }}>🌌 Z-Score (평균 회귀)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>{analysis.zScore?.value || 0.21}σ</div>
              <div style={{ fontSize: '.74rem', color: 'var(--t2)', marginTop: 4 }}>{analysis.zScore?.status || '정상 평균 균형 구간'}</div>
            </div>

            {/* 4. 체결 델타 */}
            <div style={{ padding: 14, background: 'rgba(239,68,68,0.12)', borderRadius: 12, border: '1px solid rgba(239,68,68,0.4)' }}>
              <div style={{ fontWeight: 800, color: '#ef4444', marginBottom: 4, fontSize: '.84rem' }}>🩸 Order Flow (체결 델타)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>체결강도 {analysis.orderDelta?.deltaPct || 7.4}%</div>
              <div style={{ fontSize: '.74rem', color: 'var(--t2)', marginTop: 4 }}>{analysis.orderDelta?.status || '주포 매수 체결 우위'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
