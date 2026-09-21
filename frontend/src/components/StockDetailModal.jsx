// StockDetailModal.jsx — 🏛️ 종목 상세 퀀트 분석 & 실시간 차트 모달 팝업
import React, { useState, useEffect, useRef } from 'react'
import StockShortSellingChart from './StockShortSellingChart.jsx'
import EpsTrendChart from './EpsTrendChart.jsx'
import RoeTrendChart from './RoeTrendChart.jsx'
import RevenueIncomeChart from './RevenueIncomeChart.jsx'
import NpsHoldingHistoryChart from './NpsHoldingHistoryChart.jsx'

// 🎨 세련된 현대식 SVG 라인 아이콘 컴포넌트들
const MenuIcon = ({ type, size = 16, color = "currentColor", style = {} }) => {
  const getPath = () => {
    switch (type) {
      case 'nps':
        return <path d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11M20 10v11M8 10v11M12 10v11M16 10v11" />
      case 'trophy':
        return <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34M12 2a7 7 0 0 1 7 7c0 2.25-1.5 4.5-4 5H9c-2.5-.5-4-2.75-4-5a7 7 0 0 1 7-7z" />
      case 'company':
        return (
          <>
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
            <line x1="9" y1="22" x2="9" y2="16" /><line x1="15" y1="22" x2="15" y2="16" />
            <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M12 6h.01M12 10h.01" />
          </>
        )
      case 'short-selling':
        return (
          <>
            <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
            <polyline points="17 18 23 18 23 12" />
          </>
        )
      default:
        return null
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8, ...style }}
    >
      {getPath()}
    </svg>
  )
}

export default function StockDetailModal({ stock, onClose, onOpenValueChain }) {
  const [period, setPeriod] = useState('day') // 'minute' | 'day' | 'week' | 'month' | 'year'
  const [chartData, setChartData] = useState([])
  const [analysis, setAnalysis] = useState(null)
  const [smartMoney, setSmartMoney] = useState(null)
  const [companySummary, setCompanySummary] = useState(null)
  const [financials, setFinancials] = useState(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isChartFullscreen, setIsChartFullscreen] = useState(false)
  const chartWheelRef = useRef(null)
  const totalCandlesRef = useRef(0)
  // 🔍 차트 확대/축소 & 좌우 이동 상태 — count: 화면에 보여줄 캔들 개수(null=기본값), offset: 최신 캔들 기준 뒤로 이동한 캔들 수
  const [chartView, setChartView] = useState({ count: null, offset: 0 })

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // ⌨️ ESC 키: 차트 전체화면이 열려있으면 차트만 닫고, 아니면 팝업 전체를 닫음
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return
      if (isChartFullscreen) setIsChartFullscreen(false)
      else onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isChartFullscreen, onClose])

  // 종목/기간이 바뀌면 확대/이동 상태를 기본값(최근 구간 전체 화면 표시)으로 초기화
  useEffect(() => {
    setChartView({ count: null, offset: 0 })
  }, [stock?.code, period])

  // 🖱️ 마우스 휠로 차트 확대/축소(세로 휠), 트랙패드 좌우 스와이프로 과거 흐름 이동(가로 휠)
  const [loading, setLoading] = useState(true)
  const [hoverData, setHoverData] = useState(null)
  const [hoverLiqPoint, setHoverLiqPoint] = useState(null)

  // 🖱️ 마우스 휠로 차트 확대/축소(세로 휠), 트랙패드 좌우 스와이프로 과거 흐름 이동(가로 휠)
  // loading이 끝나고 실제 차트 DOM(ref)이 마운트된 뒤에 리스너를 붙여야 하므로 loading을 의존성에 넣는다.
  useEffect(() => {
    const el = chartWheelRef.current
    if (!el) return
    const MIN_VISIBLE = 20
    const DEFAULT_VISIBLE = 150
    const handleWheel = (e) => {
      const total = totalCandlesRef.current
      if (total <= MIN_VISIBLE) return
      e.preventDefault()
      setChartView(prev => {
        const curCount = prev.count ?? Math.min(total, DEFAULT_VISIBLE)
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          const maxOffset = Math.max(0, total - curCount)
          const nextOffset = Math.min(maxOffset, Math.max(0, prev.offset + Math.round(e.deltaX / 3)))
          return { count: curCount, offset: nextOffset }
        }
        const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15
        const nextCount = Math.max(MIN_VISIBLE, Math.min(total, Math.round(curCount * factor)))
        const nextOffset = Math.min(prev.offset, Math.max(0, total - nextCount))
        return { count: nextCount, offset: nextOffset }
      })
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [loading])

  useEffect(() => {
    if (!stock?.code) return
    let isMounted = true
    setLoading(true)

    async function loadDetail() {
      try {
        const [chartRes, wallstreetRes, smartRes, summaryRes, finRes] = await Promise.all([
          fetch(`/api/chart/${stock.code}?type=${period}${period === 'day' ? '&count=3000' : ''}`).then(r => r.json()).catch(() => null),
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
  const baseWidth = isChartFullscreen ? 1400 : 800
  const height = isChartFullscreen ? 720 : 400
  const padding = { top: 50, right: 125, bottom: 45, left: 15 }

  const candles = (chartData || []).map(d => {
    const o = d.open !== undefined ? Number(d.open) : Number(d.price || d.close)
    const h = d.high !== undefined ? Number(d.high) : Number(d.price || d.close)
    const l = d.low !== undefined ? Number(d.low) : Number(d.price || d.close)
    const c = d.close !== undefined ? Number(d.close) : Number(d.price || d.close)
    const v = Number(d.volume) || 0
    return { ...d, open: o, high: h, low: l, close: c, volume: v }
  })

  const width = baseWidth
  totalCandlesRef.current = candles.length

  // 🔍 마우스 휠 확대/축소·이동 상태를 반영한 "현재 화면에 보이는 구간"만 잘라서 차트에 그린다
  // (예전에는 전체 캔들을 다 그려서 캔버스를 무한정 넓힌 뒤 스크롤로 보게 했는데,
  //  팝업이 열리자마자 아주 넓은 캔버스의 우측 끝으로 스크롤 이동시키는 타이밍이 어긋나면
  //  처음에 차트 절반만 보이는 것처럼 잘려 보이는 문제가 있었다. 고정폭에 "보이는 구간"만
  //  그리는 방식으로 바꿔서 항상 팝업 폭에 꽉 차게 렌더링되도록 했다.)
  const DEFAULT_VISIBLE = 150
  const totalCandleCount = candles.length
  const effectiveVisibleCount = totalCandleCount > 0
    ? Math.max(1, Math.min(chartView.count ?? Math.min(totalCandleCount, DEFAULT_VISIBLE), totalCandleCount))
    : 0
  const clampedOffset = Math.min(chartView.offset, Math.max(0, totalCandleCount - effectiveVisibleCount))
  const viewEndIdx = totalCandleCount - clampedOffset
  const viewStartIdx = Math.max(0, viewEndIdx - effectiveVisibleCount)
  const visibleCandles = candles.slice(viewStartIdx, viewEndIdx)
  const isZoomedOrPanned = totalCandleCount > visibleCandles.length

  const optimalPrice = stock.optimalBuyPrice || analysis?.optimalBuyPrice
  const pocPriceLine = analysis?.vpvr?.pocPrice || smartMoney?.pocPrice || 0

  const allPrices = []
  visibleCandles.forEach(c => {
    if (c.high && !isNaN(c.high) && c.high > 0) allPrices.push(c.high)
    if (c.low && !isNaN(c.low) && c.low > 0) allPrices.push(c.low)
  })

  if (smartMoney?.estimatedCost && smartMoney.estimatedCost > 0) allPrices.push(Number(smartMoney.estimatedCost))
  if (optimalPrice && optimalPrice > 0) allPrices.push(Number(optimalPrice))
  if (pocPriceLine && pocPriceLine > 0) allPrices.push(Number(pocPriceLine))

  const rawMin = allPrices.length ? Math.min(...allPrices) : 100
  const rawMax = allPrices.length ? Math.max(...allPrices) : 200
  const priceMargin = (rawMax - rawMin) * 0.1 || 10
  const minPrice = Math.max(1, rawMin - priceMargin)
  const maxPrice = rawMax + priceMargin
  const maxVolume = Math.max(...visibleCandles.map(c => c.volume), 1)

  const getX = (i) => {
    if (!visibleCandles || visibleCandles.length <= 1) return padding.left
    return padding.left + (i / (visibleCandles.length - 1)) * (width - padding.left - padding.right)
  }

  const getY = (val) => {
    if (val === undefined || val === null || isNaN(val) || maxPrice === minPrice) return height / 2
    return height - padding.bottom - ((val - minPrice) / (maxPrice - minPrice)) * (height - padding.top - padding.bottom)
  }

  // 🎯 월봉 10이평선(10개월 이동평균) — 월봉(month) 탭에서만 계산 (이평선 계산은 화면 밖 과거 데이터도 필요해서 전체 candles 기준으로 값을 구하고, 좌표만 화면에 보이는 구간 기준으로 찍는다)
  const monthlyMA10 = period === 'month'
    ? visibleCandles.map((c, localIdx) => {
        const g = viewStartIdx + localIdx
        if (g < 9) return null
        let sum = 0
        for (let k = g - 9; k <= g; k++) sum += candles[k].close
        return sum / 10
      })
    : []
  const ma10Points = visibleCandles
    .map((c, i) => (monthlyMA10[i] !== null && monthlyMA10[i] !== undefined ? `${getX(i)},${getY(monthlyMA10[i])}` : null))
    .filter(Boolean)
    .join(' ')
  const lastMA10Idx = monthlyMA10.length - 1
  const lastMA10Value = lastMA10Idx >= 0 ? monthlyMA10[lastMA10Idx] : null

  const isUp = visibleCandles.length > 1 ? (visibleCandles[visibleCandles.length - 1].close >= visibleCandles[0].close) : true
  const strokeColor = isUp ? '#ef4444' : '#3b82f6'
  const candleWidth = Math.max(3, Math.min(13, ((width - padding.left - padding.right) / Math.max(1, visibleCandles.length)) * 0.68))

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
      background: '#05070c',
      zIndex: 9999
    }}>
      <div
        className="modal-content"
        style={{
          width: '100vw',
          height: '100vh',
          maxWidth: 'none',
          maxHeight: 'none',
          overflowY: 'auto',
          padding: '26px 30px',
          background: '#0e131f',
          borderRadius: 0,
          border: 'none',
          boxShadow: 'none',
          color: 'var(--t1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ─── 1. 상단 모달 헤더 ─── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 14 }}>
          <div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>{stock.name}</span>
              <span style={{ fontSize: '1rem', color: 'var(--t3)', fontWeight: 600, fontFamily: 'Space Mono' }}>({stock.code})</span>
              {stock.market && (
                <span style={{ fontSize: '.72rem', background: 'rgba(255,255,255,0.08)', color: '#38bdf8', padding: '2px 8px', borderRadius: 0, fontWeight: 700 }}>
                  {stock.market}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', fontFamily: 'Space Mono' }}>
                현재가: {displayCurrentPrice ? Number(displayCurrentPrice).toLocaleString() + '원' : '실시간 시세 동기화 중...'}
              </span>
              {stock.targetPrice && (
                <span style={{ padding: '3px 10px', background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', borderRadius: 0, fontSize: '.8rem', color: '#34d399', fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                  월가 적정목표: {Number(stock.targetPrice).toLocaleString()}원
                </span>
              )}
              <button
                onClick={() => {
                  const el = document.getElementById('short-selling-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                style={{
                  padding: '4px 12px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 0,
                  fontSize: '.82rem',
                  color: 'var(--t2)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <span><MenuIcon type="short-selling" size={14} color="var(--t2)" style={{ marginRight: 4 }} />공매도 추이 분석</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {onOpenValueChain && (
              <button
                onClick={() => onOpenValueChain(stock.code, stock.name)}
                style={{
                  padding: '6px 14px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'var(--t2)',
                  borderRadius: 0,
                  fontSize: '.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                밸류체인 보기
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: '#ffffff',
                border: '1px solid var(--border)',
                borderRadius: 0,
                width: 36,
                height: 36,
                cursor: 'pointer',
                fontWeight: 800,
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
            background: 'var(--bg2)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 0,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: '.95rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <MenuIcon type="company" size={18} color="var(--t2)" style={{ marginRight: 0 }} />
                <span>무엇을 하는 회사인가? (기업 개요 & 핵심 비즈니스)</span>
                {companySummary.wicsSector && (
                  <span style={{ fontSize: '.74rem', background: 'rgba(59,130,246,0.25)', color: '#60a5fa', padding: '2px 8px', borderRadius: 0, fontWeight: 700 }}>
                    WICS: {companySummary.wicsSector}
                  </span>
                )}
                {companySummary.marketCapRank && (
                  <span style={{ fontSize: '.74rem', background: 'rgba(234,179,8,0.25)', color: '#fbbf24', padding: '2px 8px', borderRadius: 0, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>
                    <MenuIcon type="trophy" size={13} color="#fbbf24" style={{ marginRight: 4 }} /> {companySummary.marketCapRank}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '.72rem', color: 'var(--t3)', fontWeight: 700 }}>
                FnGuide 공식 연동
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {companySummary.paragraphs && companySummary.paragraphs.length > 0 ? (
                companySummary.paragraphs.map((p, pIdx) => {
                  const tagTitles = ['[설립 및 기본 개요]', '[주요 사업 부문 및 핵심 제품]', '[최근 주요 연혁]']
                  return (
                    <div key={pIdx} style={{
                      padding: '10px 14px',
                      background: 'rgba(0,0,0,0.25)',
                      borderRadius: 0,
                      borderLeft: `3px solid #60a5fa`,
                      fontSize: '.82rem',
                      lineHeight: 1.6,
                      color: '#e2e8f0'
                    }}>
                      <div style={{ fontWeight: 800, color: '#93c5fd', marginBottom: 3 }}>
                        {tagTitles[pIdx] || `[개요 ${pIdx + 1}]`}
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
        <div style={{
          background: '#0a0d14',
          borderRadius: 0,
          padding: 18,
          marginBottom: 20,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          ...(isChartFullscreen ? {
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 10050, overflowY: 'auto', borderRadius: 0
          } : {})
        }}>
          {/* 차트 상단 컨트롤 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <div style={{ fontWeight: 800, color: '#fff', fontSize: '.95rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>월가 TradingView 스타일 프리미엄 차트 ({stock.name})</span>
            </div>

            {/* 분봉 / 일봉 / 주봉 / 월봉 / 년봉 탭 + 전체화면 토글 */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.25)', padding: 3, borderRadius: 0 }}>
                {[
                  { id: 'minute', label: '분봉' },
                  { id: 'day', label: '일봉' },
                  { id: 'week', label: '주봉' },
                  { id: 'month', label: '월봉' },
                  { id: 'year', label: '년봉' }
                ].map(t => (
                  <button
                    key={t.id}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 0,
                      border: 'none',
                    background: period === t.id ? 'var(--accent)' : 'transparent',
                    color: period === t.id ? '#ffffff' : 'var(--t3)',
                    fontSize: '.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                    onClick={() => setPeriod(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setIsChartFullscreen(v => !v)}
                title={isChartFullscreen ? '전체화면 닫기 (ESC)' : '차트 전체화면으로 보기'}
                style={{
                  padding: '6px 12px',
                  borderRadius: 0,
                  border: 'none',
                  background: isChartFullscreen ? 'var(--accent)' : 'rgba(0,0,0,0.25)',
                  color: isChartFullscreen ? '#fff' : 'var(--t3)',
                  fontSize: '.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <span>{isChartFullscreen ? '⤡' : '⤢'}</span>
                <span>{isChartFullscreen ? '전체화면 닫기' : '차트 전체화면'}</span>
              </button>
            </div>
          </div>

          {/* 3대 핵심 타점 배너 & Hover HUD */}
          <div style={{ display: 'flex', gap: 16, fontSize: '.85rem', color: 'var(--t2)', marginBottom: 14, flexWrap: 'wrap', background: 'rgba(15,23,42,0.95)', padding: '10px 16px', borderRadius: 0, border: '1px solid rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <span style={{ color: 'var(--t3)', marginRight: 5, fontWeight: 700 }}>현재가</span>
                <strong style={{ color: isUp ? '#ef4444' : '#3b82f6', fontFamily: 'Space Mono', fontSize: '1.1rem', fontWeight: 800 }}>{(displayCurrentPrice || 0).toLocaleString()}원</strong>
              </div>
              {smartMoney?.estimatedCost > 0 && (
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 14 }}>
                  <span style={{ color: '#c084fc', marginRight: 5, fontWeight: 700 }}>🟣 세력선 (추정평단)</span>
                  <strong style={{ color: '#ffffff', fontFamily: 'Space Mono', fontSize: '1.05rem', fontWeight: 800 }}>{(smartMoney.estimatedCost || 0).toLocaleString()}원</strong>
                </div>
              )}
              {optimalPrice > 0 && (
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 14 }}>
                  <span style={{ color: '#34d399', marginRight: 5, fontWeight: 700 }}>🟢 월가 적정매입가</span>
                  <strong style={{ color: '#ffffff', fontFamily: 'Space Mono', fontSize: '1.05rem', fontWeight: 800 }}>{(optimalPrice || 0).toLocaleString()}원</strong>
                </div>
              )}
            </div>

            {/* Hover HUD */}
            <div style={{ background: 'rgba(0,0,0,0.6)', padding: '5px 12px', borderRadius: 0, minWidth: 240, border: '1px solid rgba(255,255,255,0.08)' }}>
              {hoverData ? (
                <div style={{ fontSize: '.76rem', color: '#ffffff' }}>
                  <span style={{ color: 'var(--t1)', fontWeight: 700 }}>[{hoverData.date || hoverData.time}]</span>
                  <span style={{ marginLeft: 6 }}>시: <strong>{(hoverData.open || 0).toLocaleString()}</strong></span>
                  <span style={{ marginLeft: 6 }}>종: <strong style={{ color: hoverData.close >= hoverData.open ? '#ef4444' : '#3b82f6' }}>{(hoverData.close || 0).toLocaleString()}</strong></span>
                  <span style={{ marginLeft: 6 }}>거래량: <strong>{(hoverData.volume || 0).toLocaleString()}</strong></span>
                </div>
              ) : (
                <div style={{ color: 'var(--t3)', fontSize: '.76rem', textAlign: 'center' }}>
                  캔들에 마우스를 올리면 상세 시세가 뜹니다
                </div>
              )}
            </div>
          </div>

          {/* SVG 차트 본체 */}
          <div style={{ position: 'relative', width: '100%', overflow: 'hidden', background: '#0a0d14', borderRadius: 0, border: '1px solid rgba(255,255,255,0.08)' }}>
            {!loading && totalCandleCount > 0 && (
              <div style={{ padding: '6px 14px', fontSize: '.72rem', color: 'var(--t3)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {isZoomedOrPanned
                  ? `🔍 최근 ${totalCandleCount.toLocaleString()}봉 중 ${viewStartIdx + 1}~${viewEndIdx}번째 구간 표시 중 · 마우스 휠로 확대·축소, 트랙패드 좌우 스와이프로 과거 흐름을 확인하세요`
                  : '🖱️ 마우스 휠로 차트를 확대할 수 있습니다'}
              </div>
            )}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '70px 0', color: 'var(--t2)', fontSize: '.95rem' }}>
                실시간 캔들스틱 및 세력선 퀀트 계산 중...
              </div>
            ) : candles.length > 0 ? (
              <div ref={chartWheelRef} style={{ width: '100%' }}>
              <svg
                viewBox={`0 0 ${width} ${height}`}
                style={{ width: '100%', height: isChartFullscreen ? 'calc(100vh - 220px)' : 360, display: 'block' }}
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
                      <text x={width - padding.right + 8} y={y + 4} fill="var(--t3)" fontSize={isMobile ? "14" : "10"} fontFamily="Space Mono">
                        {Math.round(p).toLocaleString()}
                      </text>
                    </g>
                  )
                })}

                {/* 📅 차트 하단 X축 (날짜/시간) 가이드라인 및 날짜 표시 */}
                <g key="x-axis-bottom">
                  <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                  {(() => {
                    if (!visibleCandles || visibleCandles.length === 0) return null
                    const count = Math.min(7, visibleCandles.length)
                    const step = Math.floor((visibleCandles.length - 1) / Math.max(1, count - 1))
                    const indices = []
                    for (let i = 0; i <= visibleCandles.length - 1; i += Math.max(1, step)) {
                      if (indices.length < count) indices.push(i)
                    }
                    if (indices[indices.length - 1] !== visibleCandles.length - 1 && visibleCandles.length > 1) {
                      indices[indices.length - 1] = visibleCandles.length - 1
                    }

                    return indices.map((idx, i) => {
                      const c = visibleCandles[idx]
                      if (!c) return null
                      const x = getX(idx)

                      let labelText = ''
                      if (period === 'minute') {
                        const t = c.time || ''
                        labelText = t.length >= 4 ? t.slice(0, 2) + ':' + t.slice(2, 4) : t
                      } else {
                        const d = c.date || ''
                        const cleanD = d.replace(/[^0-9]/g, '')
                        if (period === 'year') {
                          labelText = d
                        } else if (period === 'month' && cleanD.length === 8) {
                          labelText = `${cleanD.slice(2, 4)}.${cleanD.slice(4, 6)}`
                        } else if (cleanD.length === 8) {
                          labelText = `${cleanD.slice(4, 6)}/${cleanD.slice(6, 8)}`
                        } else {
                          labelText = d
                        }
                      }

                      return (
                        <g key={`x-tick-${i}`}>
                          <line x1={x} y1={padding.top} x2={x} y2={height - padding.bottom} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                          <line x1={x} y1={height - padding.bottom} x2={x} y2={height - padding.bottom + 6} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                          <rect x={x - (isMobile ? 38 : 28)} y={height - padding.bottom + 8} width={isMobile ? 76 : 56} height={isMobile ? 24 : 20} rx={4} fill="rgba(30,41,59,0.7)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
                          <text x={x} y={height - padding.bottom + (isMobile ? 24.5 : 21.5)} fill="#e2e8f0" fontSize={isMobile ? "14" : "11"} fontWeight="800" fontFamily="Space Mono" textAnchor="middle">
                            {labelText || (idx + 1)}
                          </text>
                        </g>
                      )
                    })
                  })()}
                </g>

                {/* 캔들스틱 & 하단 거래량 바 */}
                {visibleCandles.map((c, i) => {
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

                {/* 🟡 월봉 10이평선(10개월 이동평균) */}
                {period === 'month' && ma10Points && (
                  <g key="monthly-ma10">
                    <polyline points={ma10Points} fill="none" stroke="#fbbf24" strokeWidth={isChartFullscreen ? 2.6 : 2} opacity="0.95" />
                    {lastMA10Value != null && (() => {
                      const y = getY(lastMA10Value)
                      const x = getX(lastMA10Idx)
                      return (
                        <g>
                          <circle cx={x} cy={y} r="3.5" fill="#fbbf24" stroke="#000" strokeWidth="0.8" />
                          <rect x={width - padding.right + 6} y={y - (isMobile ? 18 : 12)} width={isMobile ? 145 : 100} height={isMobile ? 36 : 24} rx={6} fill="#78350f" stroke="#fbbf24" strokeWidth="1.5" />
                          <text x={width - padding.right + 12} y={y + (isMobile ? 6 : 4)} fill="#fde68a" fontSize={isMobile ? "15" : "11"} fontWeight="900" fontFamily="Space Mono">
                            10선 {Math.round(lastMA10Value).toLocaleString()}
                          </text>
                        </g>
                      )
                    })()}
                  </g>
                )}

                {/* 🟢 1. 월가 적정매입가 레이저 빔 */}
                {optimalPrice > 0 && (() => {
                  const y = getY(optimalPrice)
                  return (
                    <g key="modal-horiz-optimal">
                      <line x1={padding.left} y1={y} x2={width - padding.right + 6} y2={y} stroke="#00ff9d" strokeWidth="3" filter="url(#modal-glow-green)" opacity="0.9" />
                      <line x1={padding.left} y1={y} x2={width - padding.right + 6} y2={y} stroke="#ffffff" strokeWidth="1.2" />
                      <rect x={width - padding.right + 6} y={y - (isMobile ? 18 : 12)} width={isMobile ? 155 : 110} height={isMobile ? 36 : 24} rx={6} fill="#059669" stroke="#00ff9d" strokeWidth="1.5" />
                      <text x={width - padding.right + 12} y={y + (isMobile ? 6 : 4)} fill="#ffffff" fontSize={isMobile ? "15" : "11"} fontWeight="900" fontFamily="Space Mono">
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
                      <rect x={width - padding.right + 6} y={y - (isMobile ? 19 : 13)} width={isMobile ? 155 : 110} height={isMobile ? 38 : 26} rx={6} fill="#7e22ce" stroke="#d8b4fe" strokeWidth="1.5" />
                      <text x={width - padding.right + 12} y={y + (isMobile ? 6.5 : 4.5)} fill="#ffffff" fontSize={isMobile ? "15" : "11"} fontWeight="900" fontFamily="Space Mono">
                        세력 {Number(smartMoney.estimatedCost).toLocaleString()}
                      </text>
                    </g>
                  )
                })()}

                {/* 🧱 3. VPVR POC 바닥선 (최대 매물대 지지선) */}
                {pocPriceLine > 0 && (() => {
                  const y = getY(pocPriceLine)
                  return (
                    <g key="modal-horiz-poc">
                      <line x1={padding.left} y1={y} x2={width - padding.right + 6} y2={y} stroke="#00d2ff" strokeWidth="2.5" strokeDasharray="4 3" opacity="0.8" />
                      <rect x={width - padding.right + 6} y={y - (isMobile ? 18 : 12)} width={isMobile ? 155 : 110} height={isMobile ? 36 : 24} rx={6} fill="#0369a1" stroke="#00d2ff" strokeWidth="1.5" />
                      <text x={width - padding.right + 12} y={y + (isMobile ? 6 : 4)} fill="#ffffff" fontSize={isMobile ? "15" : "11"} fontWeight="900" fontFamily="Space Mono">
                        바닥 {Number(pocPriceLine).toLocaleString()}
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
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>차트 데이터를 불러올 수 없습니다.</div>
            )}
          </div>
        </div>

        {/* 📈 주당순이익 (EPS) 추이 (연간/분기) */}
        <EpsTrendChart stock={stock} />

        {/* 📊 자기자본이익률 (ROE) 추이 (연간/분기) */}
        <RoeTrendChart stock={stock} />

        {/* 📊 매출액 & 영업이익 추이 (연간/분기) */}
        <RevenueIncomeChart stock={stock} />

        {/* 🏛️ 국민연금 보유비중 변동 이력 (DART 대량보유 상황보고서 실공시) */}
        <NpsHoldingHistoryChart stock={stock} />

        {/* ─── 📉 한국거래소(KRX) 공식 개별종목 공매도(Short Selling) 거래량·거래대금·비중(%) 인터랙티브 듀얼 차트 ─── */}
        <div id="short-selling-section">
          <StockShortSellingChart stockCode={stock.code} stockName={stock.name} />
        </div>


        {/* ─── 5. 월가 6대 기관 퀀트 지표 리포트 ─── */}
        {analysis && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 20 }}>
            {/* 1. TWAP */}
            <div style={{ padding: 14, background: 'var(--bg2)', borderRadius: 0, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontWeight: 700, color: 'var(--t2)', marginBottom: 4, fontSize: '.84rem' }}>TWAP (스텔스 매집도)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{analysis.twap?.uniformity || 70}%</div>
              <div style={{ fontSize: '.74rem', color: 'var(--t2)', marginTop: 4 }}>{analysis.twap?.status || '분할 매집 진행'}</div>
            </div>

            {/* 2. OBV */}
            <div style={{ padding: 14, background: 'var(--bg2)', borderRadius: 0, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontWeight: 700, color: 'var(--t2)', marginBottom: 4, fontSize: '.84rem' }}>OBV (자금 유출입)</div>
              <div style={{ fontSize: '.95rem', fontWeight: 800, color: 'var(--up)' }}>{analysis.obv?.trend || '자금 유입'}</div>
              <div style={{ fontSize: '.74rem', color: 'var(--t3)', marginTop: 4 }}>누적: {(analysis.obv?.value || 0).toLocaleString()}</div>
            </div>

            {/* 3. Z-Score */}
            <div style={{ padding: 14, background: 'var(--bg2)', borderRadius: 0, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontWeight: 700, color: 'var(--t2)', marginBottom: 4, fontSize: '.84rem' }}>Z-Score (평균 회귀)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>{analysis.zScore?.value || 0.21}σ</div>
              <div style={{ fontSize: '.74rem', color: 'var(--t2)', marginTop: 4 }}>{analysis.zScore?.status || '정상 평균 균형 구간'}</div>
            </div>

            {/* 4. 체결 델타 */}
            <div style={{ padding: 14, background: 'var(--bg2)', borderRadius: 0, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontWeight: 700, color: 'var(--t2)', marginBottom: 4, fontSize: '.84rem' }}>Order Flow (체결 델타)</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>체결강도 {analysis.orderDelta?.deltaPct || 7.4}%</div>
              <div style={{ fontSize: '.74rem', color: 'var(--t2)', marginTop: 4 }}>{analysis.orderDelta?.status || '주포 매수 체결 우위'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
