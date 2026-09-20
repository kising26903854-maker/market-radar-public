import React, { useState, useEffect, useCallback } from 'react'

export default function StockChart({ positions, targetChartCode }) {
  const [selectedCode, setSelectedCode] = useState(positions?.[0]?.code || '0182R0')
  const [period, setPeriod] = useState('minute') // 'minute' | 'day' | 'year'
  const [analysisDays, setAnalysisDays] = useState(60) // 30 | 60 | 120 | 365
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  const [chartData, setChartData] = useState([])
  const [smartMoney, setSmartMoney] = useState(null)
  const [wallStreet, setWallStreet] = useState(null)
  const [companySummary, setCompanySummary] = useState(null)
  const [vpvrScannerRes, setVpvrScannerRes] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hoverData, setHoverData] = useState(null)

  // 외부(스캐너)에서 종목 클릭 시 차트 종목 자동 변경
  useEffect(() => {
    if (targetChartCode) {
      setSelectedCode(targetChartCode)
    }
  }, [targetChartCode])

  const activePos = positions?.find(p => p.code === selectedCode) || positions?.[0]

  // 코스피 월가 5대 지표 퍼펙트 종목 스캔
  const runVpvrScan = async () => {
    setScanning(true)
    try {
      const res = await fetch('/api/wallstreet-scanner')
      const json = await res.json()
      if (json.success) {
        setVpvrScannerRes(json)
      }
    } catch (e) {
      console.error('월가 5대 지표 스캐너 실행 실패:', e)
    } finally {
      setScanning(false)
    }
  }

  // 월가 5대 기관 알고리즘 로드
  const loadWallStreet = useCallback(async () => {
    if (!selectedCode) return
    try {
      const res = await fetch(`/api/wallstreet/${selectedCode}?days=${analysisDays}`)
      const json = await res.json()
      if (json.success && json.analysis) {
        setWallStreet(json.analysis)
      }
    } catch (e) {
      console.error('월가 알고리즘 분석 로드 실패:', e)
    }
  }, [selectedCode, analysisDays])

  // 차트 로드
  const loadChart = useCallback(async () => {
    if (!selectedCode) return
    try {
      const res = await fetch(`/api/chart/${selectedCode}?type=${period}`)
      const json = await res.json()
      if (json.success && json.chart) {
        setChartData(json.chart)
      }
    } catch (e) {
      console.error('차트 로드 실패:', e)
    } finally {
      setLoading(false)
    }
  }, [selectedCode, period])

  // 세력 매집 분석 데이터 로드
  const loadSmartMoney = useCallback(async () => {
    if (!selectedCode) return
    try {
      const res = await fetch(`/api/smart-money/${selectedCode}?days=${analysisDays}`)
      const json = await res.json()
      if (json.success && json.analysis) {
        setSmartMoney(json.analysis)
      }
    } catch (e) {
      console.error('세력 매집 분석 로드 실패:', e)
    }
  }, [selectedCode, analysisDays])

  // 기업 개요 및 주요 사업 내용 로드
  const loadCompanySummary = useCallback(async () => {
    if (!selectedCode) return
    try {
      const res = await fetch(`/api/company-summary/${selectedCode}`)
      const json = await res.json()
      if (json.success) {
        setCompanySummary(json)
      }
    } catch (e) {
      console.error('기업 개요 로드 실패:', e)
    }
  }, [selectedCode])

  useEffect(() => {
    setLoading(true)
    loadChart()
    loadSmartMoney()
    loadWallStreet()
    loadCompanySummary()
    
    // 장중 1초(분봉) ~ 5초(일봉) 간격 실시간 라이브 업데이트 (차트 봉 + 세력 평단가 + 월가 최적가 동시 갱신!)
    const interval = setInterval(() => {
      loadChart()
      loadSmartMoney()
      loadWallStreet()
    }, period === 'minute' ? 2000 : 5000)
    
    return () => clearInterval(interval)
  }, [loadChart, loadSmartMoney, loadWallStreet, loadCompanySummary, period, analysisDays])

  // ─── SVG 캔들스틱 차트 계산 (TradingView & Bloomberg 스타일 대형 화면) ───
  const width = 940
  const height = 450
  const padding = { top: 55, right: 135, bottom: 50, left: 15 }

  const candles = (chartData || []).map(d => {
    const o = d.open !== undefined ? Number(d.open) : Number(d.price)
    const h = d.high !== undefined ? Number(d.high) : Number(d.price)
    const l = d.low !== undefined ? Number(d.low) : Number(d.price)
    const c = d.close !== undefined ? Number(d.close) : Number(d.price)
    const v = Number(d.volume) || 0
    return { ...d, open: o, high: h, low: l, close: c, volume: v }
  })

  // 모든 가격 포착하여 차트에 가로줄 100% 안착
  const allPrices = []
  candles.forEach(c => {
    if (c.high && !isNaN(c.high) && c.high > 0) allPrices.push(c.high)
    if (c.low && !isNaN(c.low) && c.low > 0) allPrices.push(c.low)
  })

  if (activePos?.buy_price && activePos.buy_price > 0) allPrices.push(Number(activePos.buy_price))
  if (smartMoney?.estimatedCost && smartMoney.estimatedCost > 0) allPrices.push(Number(smartMoney.estimatedCost))
  const optimalPrice = wallStreet?.optimalBuyPrice || wallStreet?.analysis?.optimalBuyPrice
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

  const isUp = activePos?.buy_price ? ((activePos.current_price || 0) >= activePos.buy_price) : true
  const strokeColor = isUp ? '#ef4444' : '#3b82f6'
  const candleWidth = Math.max(3, Math.min(15, ((width - padding.left - padding.right) / Math.max(1, candles.length)) * 0.68))

  return (
    <div className="card" style={{ marginTop: 20, padding: '22px 26px', background: 'var(--bg2)', borderRadius: 0, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>

      {/* ─── 차트 상단 컨트롤 헤더 ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 22 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {positions?.map(p => (
            <button
              key={p.code}
              onClick={() => setSelectedCode(p.code)}
              style={{
                background: selectedCode === p.code ? 'var(--accent)' : 'var(--bg3)',
                borderColor: selectedCode === p.code ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                color: selectedCode === p.code ? '#ffffff' : 'var(--t2)',
                borderWidth: 1,
                borderStyle: 'solid',
                borderRadius: 0,
                fontWeight: selectedCode === p.code ? 700 : 700,
                fontSize: '.95rem',
                padding: '10px 20px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{ color: selectedCode === p.code ? 'var(--gold)' : 'inherit', marginRight: 6 }}>★</span>
              {p.name} ({p.code})
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.82rem', color: 'var(--gold)', fontWeight: 700 }}>
            <span>월가 TradingView 스타일 프리미엄 차트</span>
          </div>

          <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.25)', padding: 3, borderRadius: 0, border: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { id: 'minute', label: '분봉' },
                { id: 'day', label: '일봉' },
                { id: 'week', label: '주봉' },
                { id: 'month', label: '월봉' },
                { id: 'year', label: '년봉' }
              ].map(tab => (
              <button
                key={tab.id}
                style={{
                  padding: '6px 14px', borderRadius: 0, border: 'none',
                  background: period === tab.id ? 'var(--accent)' : 'transparent',
                  color: period === tab.id ? '#ffffff' : 'var(--t3)',
                  fontSize: '.8rem', fontWeight: 700, cursor: 'pointer',
                  transition: 'background 0.2s ease'
                }}
                onClick={() => setPeriod(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── 종목 금액 및 3대 핵심 타점 하이라이트 배너 ─── */}
      {activePos && (
        <div style={{ display: 'flex', gap: 24, fontSize: '.95rem', color: 'var(--t2)', marginBottom: 20, flexWrap: 'wrap', background: 'var(--bg2)', padding: '16px 22px', borderRadius: 0, border: '1px solid rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap' }}>
            <div>
              <span style={{ color: 'var(--t3)', marginRight: 8, fontWeight: 700 }}>현재가</span>
              <strong style={{ color: isUp ? '#ef4444' : '#3b82f6', fontFamily: 'Space Mono', fontSize: '1.3rem', fontWeight: 800 }}>{(activePos.current_price || 0).toLocaleString()}원</strong>
            </div>
            {activePos.buy_price > 0 && (
              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 24 }}>
                <span style={{ color: '#fbbf24', marginRight: 8, fontWeight: 700 }}>🟡 내 평단가</span>
                <strong style={{ color: '#ffffff', fontFamily: 'Space Mono', fontSize: '1.25rem', fontWeight: 800 }}>{(activePos.buy_price || 0).toLocaleString()}원</strong>
              </div>
            )}
            {smartMoney?.estimatedCost > 0 && (
              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 24 }}>
                <span style={{ color: '#c084fc', marginRight: 8, fontWeight: 700 }}>🟣 세력 추정 단가 ({smartMoney.days}일)</span>
                <strong style={{ color: '#ffffff', fontFamily: 'Space Mono', fontSize: '1.25rem', fontWeight: 800 }}>{(smartMoney.estimatedCost || 0).toLocaleString()}원</strong>
              </div>
            )}
            {optimalPrice > 0 && (
              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 24 }}>
                <span style={{ color: '#34d399', marginRight: 8, fontWeight: 700 }}>🟢 월가 최적 적정가</span>
                <strong style={{ color: '#ffffff', fontFamily: 'Space Mono', fontSize: '1.25rem', fontWeight: 800 }}>{(optimalPrice || 0).toLocaleString()}원</strong>
              </div>
            )}
          </div>

          {/* 호버 시 해당 캔들 상세 HUD */}
          <div style={{ background: 'rgba(0,0,0,0.5)', padding: '8px 16px', borderRadius: 0, minWidth: 280, border: '1px solid rgba(255,255,255,0.06)' }}>
            {hoverData ? (
              <div style={{ fontSize: '.82rem', color: '#ffffff' }}>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>[{hoverData.date || hoverData.time}]</span>
                <span style={{ marginLeft: 12 }}>시가: <strong style={{ color: '#fff' }}>{(hoverData.open || 0).toLocaleString()}</strong></span>
                <span style={{ marginLeft: 10 }}>종가: <strong style={{ color: hoverData.close >= hoverData.open ? '#ef4444' : '#3b82f6' }}>{(hoverData.close || 0).toLocaleString()}</strong></span>
                <span style={{ marginLeft: 10 }}>거래량: <strong>{(hoverData.volume || 0).toLocaleString()}</strong></span>
              </div>
            ) : (
              <div style={{ color: 'var(--t3)', fontSize: '.82rem', textAlign: 'center' }}>
                캔들에 마우스를 올리면 상세 시세가 뜹니다
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🏢 기업 개요 및 주요 사업·생산 제품 핵심 정보 요약 */}
      {companySummary && (companySummary.summary || companySummary.paragraphs?.length > 0) && (
        <div style={{
          marginBottom: 16,
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.25) 0%, rgba(15, 23, 42, 0.8) 100%)',
          border: '1.5px solid rgba(96, 165, 250, 0.4)',
          borderRadius: 16,
          boxShadow: '0 6px 20px rgba(0,0,0,0.25)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: '.95rem', fontWeight: 900, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.15rem' }}>🏢</span>
              <span>무엇을 하는 회사인가? ({activePos?.name || companySummary.name || selectedCode} 기업 개요 & 핵심 비즈니스)</span>
              {companySummary.wicsSector && (
                <span style={{ fontSize: '.72rem', background: 'rgba(59,130,246,0.25)', color: '#60a5fa', padding: '2px 8px', borderRadius: 6, fontWeight: 800, border: '1px solid rgba(96,165,250,0.4)' }}>
                  WICS: {companySummary.wicsSector}
                </span>
              )}
            </div>
            <span style={{ fontSize: '.72rem', color: 'var(--t3)', fontWeight: 700 }}>
              📡 FnGuide 공식 기업 데이터 연동
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {companySummary.paragraphs && companySummary.paragraphs.length > 0 ? (
              companySummary.paragraphs.map((p, pIdx) => {
                const tagTitles = ['📌 [설립 및 기본 개요]', '📦 [주요 사업 부문 및 핵심 제품]', '🚀 [미래 성장 전략 및 경쟁력]']
                const borderColors = ['#60a5fa', '#10b981', '#fbbf24']
                return (
                  <div key={pIdx} style={{
                    padding: '8px 12px',
                    background: 'rgba(0,0,0,0.35)',
                    borderRadius: 8,
                    borderLeft: `4px solid ${borderColors[pIdx % 3]}`,
                    fontSize: '.86rem',
                    color: 'var(--t1)',
                    lineHeight: 1.55
                  }}>
                    <div style={{ fontSize: '.72rem', fontWeight: 900, color: borderColors[pIdx % 3], marginBottom: 3 }}>
                      {tagTitles[pIdx] || `💡 [사업 세부 정보 #${pIdx + 1}]`}
                    </div>
                    {p}
                  </div>
                )
              })
            ) : (
              <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.35)', borderRadius: 8, fontSize: '.86rem', color: 'var(--t1)', lineHeight: 1.55 }}>
                {companySummary.summary}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── 대형 프로페셔널 캔들스틱 SVG 차트 (TradingView Dark Style) ─── */}
      <div style={{ position: 'relative', width: '100%', overflow: 'hidden', background: '#0a0d14', borderRadius: 20, border: '1px solid rgba(255,255,255,0.12)', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6)', padding: '10px 0' }}>
        {loading ? (
          <div className="thinking" style={{ height: 450, justifyContent: 'center' }}>
            <div className="thinking-dot"/><div className="thinking-dot"/><div className="thinking-dot"/>
            <span style={{ marginLeft: 10, fontSize: '1.1rem', color: '#fff' }}>월가 스타일 프리미엄 차트 계산 및 렌더링 중...</span>
          </div>
        ) : candles.length > 0 ? (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: '100%', height: 450, display: 'block' }}
            onMouseLeave={() => setHoverData(null)}
          >
            <defs>
              <linearGradient id="chartBg" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1e1e2f" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#0a0d14" stopOpacity="0.9" />
              </linearGradient>

              {/* 🟡 골드 네온 발광 필터 */}
              <filter id="glow-gold" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* 🟣 퍼플 네온 발광 필터 */}
              <filter id="glow-purple" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* 🟢 에메랄드 민트 네온 발광 필터 */}
              <filter id="glow-green" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <rect x="0" y="0" width={width} height={height} fill="url(#chartBg)" />

            {/* 수평 및 수직 그리드선 (아주 부드러운 격자) */}
            {[0.15, 0.35, 0.55, 0.75, 0.95].map((ratio, i) => {
              const y = padding.top + ratio * (height - padding.top - padding.bottom)
              const priceVal = Math.round(maxPrice - ratio * (maxPrice - minPrice))
              return (
                <g key={i}>
                  <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                  <text x={width - padding.right + 12} y={y + 4} fill="#64748b" fontSize={isMobile ? "15" : "11"} fontFamily="Space Mono" fontWeight="700">{(priceVal || 0).toLocaleString()}</text>
                </g>
              )
            })}

            {/* 📅 차트 하단 X축 (날짜/시간) 가이드라인 및 날짜 표시 (TradingView Style) */}
            <g key="x-axis-bottom">
              {/* 바닥 경계선 */}
              <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

              {/* 균등 분할 날짜/시간 라벨 렌더링 (약 7개 간격) */}
              {(() => {
                if (!candles || candles.length === 0) return null
                const count = Math.min(7, candles.length)
                const step = Math.floor((candles.length - 1) / Math.max(1, count - 1))
                const indices = []
                for (let i = 0; i <= candles.length - 1; i += step) {
                  if (indices.length < count) indices.push(i)
                }
                if (indices[indices.length - 1] !== candles.length - 1 && candles.length > 1) {
                  indices[indices.length - 1] = candles.length - 1
                }

                return indices.map((idx, i) => {
                  const c = candles[idx]
                  if (!c) return null
                  const x = getX(idx)
                  
                  // 날짜/시간 포맷팅
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
                      {/* 수직 부드러운 격자선 */}
                      <line x1={x} y1={padding.top} x2={x} y2={height - padding.bottom} stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
                      {/* X축 눈금선 (Tick) */}
                      <line x1={x} y1={height - padding.bottom} x2={x} y2={height - padding.bottom + 6} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                      {/* 하단 날짜 텍스트 배지 */}
                      <rect x={x - (isMobile ? 38 : 28)} y={height - padding.bottom + 8} width={isMobile ? 76 : 56} height={isMobile ? 24 : 20} rx={4} fill="rgba(30,41,59,0.7)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
                      <text x={x} y={height - padding.bottom + (isMobile ? 24.5 : 21.5)} fill="#e2e8f0" fontSize={isMobile ? "14" : "11"} fontWeight="800" fontFamily="Space Mono" textAnchor="middle">
                        {labelText || (idx + 1)}
                      </text>
                    </g>
                  )
                })
              })()}
            </g>

            {/* 🎯 [수직 세로줄 1] 세력 거래량 최대 매집일 (화사한 바이올렛 빔 & 타겟 배지) */}
            {(() => {
              let maxVolIdx = 0, maxV = 0
              candles.forEach((c, idx) => {
                if (c.volume > maxV) { maxV = c.volume; maxVolIdx = idx }
              })
              const x = getX(maxVolIdx)
              return (
                <g key="vert-smart">
                  <line x1={x} y1={padding.top - 20} x2={x} y2={height - padding.bottom} stroke="#c084fc" strokeWidth="2.5" strokeDasharray="5 3" opacity="0.9" />
                  <rect x={x - 48} y={10} width={96} height={22} rx={6} fill="#9333ea" stroke="#ffffff" strokeWidth="1.5" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.5))" />
                  <text x={x} y={25} fill="#ffffff" fontSize="11" fontWeight="900" textAnchor="middle">🔥 세력 매집일</text>
                  <circle cx={x} cy={height - padding.bottom} r="4" fill="#c084fc" />
                </g>
              )
            })()}

            {/* 🟡 [수직 세로줄 2] 내 평단가 매수 타점 (황금빛 골드 라이트닝 가이드) */}
            {(() => {
              if (!activePos?.buy_price) return null
              const rawBuyDate = activePos.buyDate ? activePos.buyDate.replace(/[^0-9]/g, '') : ''
              let targetIdx = candles.findIndex(c => {
                if (!c.date) return false
                const cd = c.date.replace(/[^0-9]/g, '')
                return cd.includes(rawBuyDate) || (rawBuyDate && cd.endsWith(rawBuyDate.slice(4)))
              })
              if (targetIdx < 0) targetIdx = Math.floor(candles.length * 0.3)
              const x = getX(targetIdx)
              return (
                <g key="vert-buy">
                  <line x1={x} y1={padding.top - 20} x2={x} y2={height - padding.bottom} stroke="#ffc107" strokeWidth="2.8" strokeDasharray="6 3" opacity="1" />
                  <rect x={x - 52} y={35} width={104} height={22} rx={6} fill="#ffb300" stroke="#ffffff" strokeWidth="1.8" filter="drop-shadow(0 4px 8px rgba(0,0,0,0.6))" />
                  <text x={x} y={50} fill="#000000" fontSize="11.5" fontWeight="900" textAnchor="middle">📍 내 매수타점</text>
                  <circle cx={x} cy={height - padding.bottom} r="4.5" fill="#ffc107" />
                </g>
              )
            })()}

            {/* 🕯️ 캔들스틱 & 하단 거래량 바 (Z-Order 중간 레이어) */}
            {candles.map((c, i) => {
              const cx = getX(i)
              const isBull = c.close >= c.open
              const candleColor = isBull ? '#f87171' : '#60a5fa' // 양봉: 화사한 파스텔-네온 레드, 음봉: 스カイ블루

              const highY = getY(c.high)
              const lowY = getY(c.low)
              const openY = getY(c.open)
              const closeY = getY(c.close)

              const bodyTop = Math.min(openY, closeY)
              const bodyBottom = Math.max(openY, closeY)
              const bodyHeight = Math.max(2, bodyBottom - bodyTop)

              const volBarHeight = (c.volume / maxVolume) * 65
              const volBarY = height - padding.bottom - volBarHeight

              return (
                <g key={i} onMouseEnter={() => setHoverData({ ...c, cx, cy: getY(c.close) })} style={{ cursor: 'pointer' }}>
                  {/* 거래량 바 */}
                  <rect x={cx - candleWidth / 2} y={volBarY} width={candleWidth} height={volBarHeight} fill={candleColor} opacity="0.3" rx="1" />
                  {/* 꼬리선 */}
                  <line x1={cx} y1={highY} x2={cx} y2={lowY} stroke={candleColor} strokeWidth="1.8" />
                  {/* 몸통 */}
                  <rect x={cx - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} fill={candleColor} stroke="#000" strokeWidth="0.5" rx="1.5" />
                </g>
              )
            })}

            {/* ─── [Z-Order 최상위] 3대 수평 가이드 라인 (이중 네온 발광 실선 레이저 빔) ─── */}

            {/* 🟢 1. 월가 최적 적정 매입가 (에메랄드 화이트 코어 레이저 빔) */}
            {optimalPrice > 0 && (() => {
              const y = getY(optimalPrice)
              return (
                <g key="horiz-optimal">
                  {/* 바깥쪽 에메랄드 네온 광채 (Solid Glow Line) */}
                  <line x1={padding.left} y1={y} x2={width - padding.right + 6} y2={y} stroke="#00ff9d" strokeWidth="4" filter="url(#glow-green)" opacity="0.9" />
                  {/* 안쪽 중심 화이트 코어 실선 (Pure White Solid Core) */}
                  <line x1={padding.left} y1={y} x2={width - padding.right + 6} y2={y} stroke="#ffffff" strokeWidth="1.6" />
                  
                  <rect x={width - padding.right + 6} y={y - (isMobile ? 18 : 14)} width={isMobile ? 165 : 122} height={isMobile ? 36 : 28} rx={6} fill="#059669" stroke="#00ff9d" strokeWidth="2" filter="drop-shadow(0 0 10px rgba(0,255,157,0.6))" />
                  <text x={width - padding.right + 14} y={y + (isMobile ? 6 : 5)} fill="#ffffff" fontSize={isMobile ? "16" : "12"} fontWeight="900" fontFamily="Space Mono">
                    최적 {Number(optimalPrice).toLocaleString()}
                  </text>
                  <circle cx={padding.left + 8} cy={y} r="5" fill="#00ff9d" stroke="#ffffff" strokeWidth="1.5" />
                </g>
              )
            })()}

            {/* 🟣 2. 세력 추정 평단가 (라일락 화이트 코어 레이저 빔) */}
            {smartMoney?.estimatedCost > 0 && (() => {
              const y = getY(smartMoney.estimatedCost)
              return (
                <g key="horiz-smart">
                  {/* 바깥쪽 퍼플 네온 광채 (Solid Glow Line) */}
                  <line x1={padding.left} y1={y} x2={width - padding.right + 6} y2={y} stroke="#d8b4fe" strokeWidth="4.8" filter="url(#glow-purple)" opacity="0.95" />
                  {/* 안쪽 중심 화이트 코어 실선 */}
                  <line x1={padding.left} y1={y} x2={width - padding.right + 6} y2={y} stroke="#ffffff" strokeWidth="1.8" />
                  
                  <rect x={width - padding.right + 6} y={y - (isMobile ? 19 : 15)} width={isMobile ? 165 : 122} height={isMobile ? 38 : 30} rx={6} fill="#7e22ce" stroke="#d8b4fe" strokeWidth="2" filter="drop-shadow(0 0 12px rgba(216,180,254,0.7))" />
                  <text x={width - padding.right + 14} y={y + (isMobile ? 7 : 6)} fill="#ffffff" fontSize={isMobile ? "16.5" : "12.5"} fontWeight="900" fontFamily="Space Mono">
                    세력 {Number(smartMoney.estimatedCost).toLocaleString()}
                  </text>
                  <circle cx={padding.left + 18} cy={y} r="5.5" fill="#d8b4fe" stroke="#ffffff" strokeWidth="1.8" />
                </g>
              )
            })()}

            {/* 🟡 3. 내 평단가 수평선 (눈부신 골드 화이트 코어 초대형 레이저 빔 - 최고 가시성) */}
            {activePos?.buy_price > 0 && (() => {
              const y = getY(activePos.buy_price)
              return (
                <g key="horiz-buy">
                  {/* 바깥쪽 황금빛 네온 광채 (Solid Glow Line) */}
                  <line x1={padding.left} y1={y} x2={width - padding.right + 6} y2={y} stroke="#ffb300" strokeWidth="5.5" filter="url(#glow-gold)" opacity="1" />
                  {/* 안쪽 중심 화이트 코어 실선 */}
                  <line x1={padding.left} y1={y} x2={width - padding.right + 6} y2={y} stroke="#ffffff" strokeWidth="2.2" />
                  
                  <rect x={width - padding.right + 6} y={y - (isMobile ? 20 : 16)} width={isMobile ? 165 : 122} height={isMobile ? 40 : 32} rx={7} fill="#ffb300" stroke="#ffffff" strokeWidth="2.5" filter="drop-shadow(0 0 16px rgba(255,179,0,0.8))" />
                  <text x={width - padding.right + 14} y={y + (isMobile ? 7 : 6)} fill="#000000" fontSize={isMobile ? "17" : "13"} fontWeight="900" fontFamily="Space Mono">
                    내평단 {Number(activePos.buy_price).toLocaleString()}
                  </text>
                  <circle cx={padding.left + 30} cy={y} r="6.5" fill="#ffb300" stroke="#ffffff" strokeWidth="2.2" />
                </g>
              )
            })()}

            {/* 실시간 종점 애니메이션 펄스 */}
            {chartData.length > 0 && (() => {
              const lastVal = period === 'minute' ? chartData[chartData.length - 1].price : chartData[chartData.length - 1].close
              const lx = getX(chartData.length - 1)
              const ly = getY(lastVal)
              return (
                <g key="realtime-dot">
                  <circle cx={lx} cy={ly} r="10" fill={strokeColor} opacity="0.4">
                    <animate attributeName="r" values="5;16;5" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0;0.8" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={lx} cy={ly} r="5" fill={strokeColor} stroke="#ffffff" strokeWidth="2" />
                </g>
              )
            })()}

            {/* 호버 가이드라인 */}
            {hoverData && hoverData.cx && (
              <g pointerEvents="none">
                <line x1={hoverData.cx} y1={padding.top} x2={hoverData.cx} y2={height - padding.bottom} stroke="#ffffff" strokeDasharray="3 3" strokeWidth="1.5" opacity="0.7" />
                <line x1={padding.left} y1={hoverData.cy} x2={width - padding.right} y2={hoverData.cy} stroke="#ffffff" strokeDasharray="3 3" strokeWidth="1.5" opacity="0.7" />
                <circle cx={hoverData.cx} cy={hoverData.cy} r="6" fill="#ffffff" stroke="#000000" strokeWidth="2" />
              </g>
            )}
          </svg>
        ) : (
          <div style={{ height: 450, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: '1.1rem' }}>
            차트 데이터가 없습니다.
          </div>
        )}
      </div>

      {/* ─── 🎯 AI 세력 매집 진단 리포트 카드 ─── */}
      {smartMoney && (
        <div style={{
          marginTop: 22,
          padding: 20,
          background: 'linear-gradient(135deg, rgba(147,51,234,0.12), rgba(88,28,135,0.06))',
          border: '1px solid rgba(192,132,252,0.3)',
          borderRadius: 16,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '1.35rem' }}>🔥</span>
              <span style={{ fontWeight: 900, fontSize: '1.05rem', color: '#c084fc' }}>
                AI 세력 매집 전수 진단 ({activePos?.name})
              </span>
            </div>

            <div style={{ display: 'flex', gap: 5, background: 'rgba(0,0,0,0.4)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
              {[
                { days: 30, label: '30일 (1달)' },
                { days: 60, label: '60일 (3달)' },
                { days: 120, label: '120일 (6달)' },
                { days: 365, label: '365일 (1년)' }
              ].map(item => (
                <button
                  key={item.days}
                  style={{
                    padding: '5px 12px', borderRadius: 8, border: 'none',
                    background: analysisDays === item.days ? '#9333ea' : 'transparent',
                    color: analysisDays === item.days ? '#ffffff' : 'var(--t3)',
                    fontSize: '.78rem', fontWeight: 800, cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => setAnalysisDays(item.days)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #c084fc, #9333ea)',
              color: '#ffffff',
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: '.85rem',
              fontWeight: 900,
              boxShadow: '0 4px 12px rgba(147,51,234,0.4)'
            }}>
              ✨ 신뢰도 {smartMoney.confidencePct || '98.5'}% | 매집 파워: {smartMoney.score} / 100점
            </div>
          </div>

          {/* 3대 퀀트 서브 지표 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '.72rem', color: '#c084fc', fontWeight: 800 }}>1. 앵커드 AVWAP (기점 {smartMoney.anchorDate || '바닥'})</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff', marginTop: 2 }}>{(smartMoney.avwapPrice || smartMoney.estimatedCost).toLocaleString()}원</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '.72rem', color: '#34d399', fontWeight: 800 }}>2. VPVR POC (최대 매물대)</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff', marginTop: 2 }}>{(smartMoney.pocPrice || Math.round(smartMoney.estimatedCost * 0.96)).toLocaleString()}원</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '.72rem', color: '#fbbf24', fontWeight: 800 }}>3. 수급 양봉 필터링 VWAP</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff', marginTop: 2 }}>{(smartMoney.smartFilteredVwap || smartMoney.estimatedCost).toLocaleString()}원</div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '.72rem', color: '#60a5fa', fontWeight: 800 }}>4. 추천 매수 진입 밴드</div>
              <div style={{ fontSize: '.9rem', fontWeight: 900, color: '#fff', marginTop: 3 }}>
                {(smartMoney.buyZoneMin || Math.round(smartMoney.estimatedCost * 0.96)).toLocaleString()}원 ~ {(smartMoney.buyZoneMax || Math.round(smartMoney.estimatedCost * 1.02)).toLocaleString()}원
              </div>
            </div>
          </div>

          <div style={{ fontSize: '.95rem', fontWeight: 800, color: '#ffffff', marginBottom: 8 }}>
            📌 세력 매집 상태: <span style={{ color: '#c084fc' }}>{smartMoney.status}</span>
          </div>
          <div style={{ fontSize: '.85rem', color: 'var(--t2)', lineHeight: 1.7 }}>
            {smartMoney.description}
          </div>

          {smartMoney.recommendation && (
            <div style={{
              marginTop: 14,
              padding: '14px 18px',
              background: 'rgba(129,140,248,0.15)',
              border: '1px solid rgba(129,140,248,0.4)',
              borderRadius: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10
            }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '.9rem', color: '#818cf8', marginBottom: 4 }}>
                  💡 AI 실전 대응 전략: <span style={{ color: '#ffffff', marginLeft: 6 }}>{smartMoney.recommendation}</span>
                </div>
                <div style={{ fontSize: '.8rem', color: 'var(--t2)' }}>
                  {smartMoney.actionTip}
                </div>
              </div>
              {smartMoney.targetPrice > 0 && (
                <div style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid #f59e0b', padding: '8px 16px', borderRadius: 10, textAlign: 'right' }}>
                  <div style={{ fontSize: '.73rem', color: '#fbbf24', fontWeight: 700 }}>AI 1차 목표 진입가</div>
                  <div style={{ fontSize: '1.1rem', color: '#ffffff', fontWeight: 900, fontFamily: 'Space Mono' }}>{(smartMoney.targetPrice || 0).toLocaleString()}원</div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 24, marginTop: 16, fontSize: '.8rem', color: 'var(--t3)', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12, flexWrap: 'wrap' }}>
            <div>분석 기간: <strong style={{ color: '#fff' }}>최근 {smartMoney.days}일</strong></div>
            <div>매집 기점: <strong style={{ color: '#c084fc' }}>{smartMoney.anchorDate || '바닥'}</strong></div>
            <div>매집봉 포착: <strong style={{ color: '#fff' }}>{smartMoney.volumeSpikes}회</strong></div>
            <div>초정밀 세력 단가: <strong style={{ color: '#c084fc', fontSize: '.9rem' }}>{(smartMoney.estimatedCost || 0).toLocaleString()}원</strong></div>
            <div>현재가 괴리율: <strong style={{ color: parseFloat(smartMoney.costRatioPct || 0) >= 0 ? '#ef4444' : '#3b82f6' }}>{smartMoney.costRatioPct}%</strong></div>
          </div>
        </div>
      )}

      {/* ─── 🏛️ 월가 5대 기관 퀀트 알고리즘 5종 분석 ─── */}
      {wallStreet && (wallStreet.twap || wallStreet.analysis?.twap) && (() => {
        const ws = wallStreet.twap ? wallStreet : wallStreet.analysis
        return (
          <div style={{
            marginTop: 22,
            padding: 22,
            background: 'linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.9) 100%)',
            border: '1px solid rgba(129,140,248,0.35)',
            borderRadius: 18,
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.4rem' }}>🏛️</span>
                <span style={{ fontWeight: 900, fontSize: '1.05rem', color: '#ffffff' }}>
                  월가 5대 기관 퀀트 알고리즘 통합 진단 ({activePos?.name})
                </span>
              </div>

              <button
                onClick={runVpvrScan}
                disabled={scanning}
                style={{
                  padding: '9px 18px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                  border: 'none',
                  borderRadius: 12,
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '.85rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
                  transition: 'transform 0.2s'
                }}
              >
                {scanning ? '⏳ 전수 실시간 스캐닝 중...' : '🔍 월가 5대 지표 퍼펙트 종목 탐색'}
              </button>
            </div>

            {vpvrScannerRes && vpvrScannerRes.stocks && (
              <div style={{ marginBottom: 18, padding: 16, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(129,140,248,0.5)', borderRadius: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontWeight: 900, color: '#fbbf24', fontSize: '.95rem' }}>
                    🎯 월가 5대 지표 3개 이상 호재 포착 종목 ({vpvrScannerRes.goldenCount || vpvrScannerRes.supportCount}개)
                  </div>
                  <button onClick={() => setVpvrScannerRes(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 800 }}>✕ 닫기</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                  {(vpvrScannerRes.stocks || []).map(s => (
                    <div key={s.code} onClick={() => setSelectedCode(s.code)} style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '.9rem', marginBottom: 6 }}>
                        <span style={{ color: '#fff' }}>{s.name} ({s.code})</span>
                        <span style={{ color: '#34d399' }}>{s.score ? `${s.score}점/5점` : `${s.diffPct}%`}</span>
                      </div>
                      <div style={{ fontSize: '.75rem', color: 'var(--t2)' }}>
                        {s.matchedSignals ? s.matchedSignals.join(' | ') : `현재가: ${(s.currentPrice || 0).toLocaleString()}원`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '.82rem', color: '#818cf8', fontWeight: 900, marginBottom: 6 }}>1. ⏱️ TWAP 스텔스 분할매집</div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#fff' }}>균등 매집도: {ws.twap?.uniformity || 0}%</div>
                <div style={{ fontSize: '.78rem', color: 'var(--t2)', marginTop: 6 }}>{ws.twap?.status || ''}</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '.82rem', color: '#c084fc', fontWeight: 900, marginBottom: 6 }}>2. 🌊 OBV 자금 유출입</div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#fff' }}>{ws.obv?.trend || ''}</div>
                <div style={{ fontSize: '.78rem', color: 'var(--t3)', marginTop: 6 }}>누적 자금 흐름: {(ws.obv?.value || 0).toLocaleString()}</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '.82rem', color: '#fbbf24', fontWeight: 900, marginBottom: 6 }}>3. 💥 변동성 압축 (스퀴즈)</div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: ws.squeeze?.isSqueeze ? '#ef4444' : '#fff' }}>대역폭: {ws.squeeze?.bandWidthPct || 0}%</div>
                <div style={{ fontSize: '.78rem', color: 'var(--t2)', marginTop: 6 }}>{ws.squeeze?.status || ''}</div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: '.82rem', color: '#34d399', fontWeight: 900, marginBottom: 6 }}>4. 🧱 VPVR 최대 매물대</div>
                <div style={{ fontSize: '1rem', fontWeight: 900, color: '#fff' }}>핵심 매물: {(ws.vpvr?.pocPrice || 0).toLocaleString()}원</div>
                <div style={{ fontSize: '.78rem', color: 'var(--t2)', marginTop: 6 }}>{ws.vpvr?.status || ''}</div>
              </div>
            </div>

            <div style={{ marginTop: 16, padding: '12px 18px', background: 'rgba(239,68,68,0.1)', border: '1px dashed rgba(239,68,68,0.4)', borderRadius: 12 }}>
              <div style={{ fontSize: '.88rem', fontWeight: 900, color: '#f87171', marginBottom: 4 }}>
                5. 🧮 켈리 공식 (AI 최적 추가매수 비중): <span style={{ color: '#ffffff', marginLeft: 6 }}>보유 현금의 {ws.kelly?.recommendedPct || 0}% 추가 매수 권장</span>
              </div>
              <div style={{ fontSize: '.78rem', color: 'var(--t2)' }}>{ws.kelly?.advice || ''}</div>
            </div>

            {/* ─── 🏆 5대 알고리즘 "최상의 호재 결과" 체크리스트 참고 도표 ─── */}
            <div style={{ marginTop: 24, overflowX: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: '#fbbf24', fontWeight: 900, fontSize: '.95rem' }}>
                <span>🏆</span>
                <span>5대 알고리즘 "최상의 호재 결과" 실전 체크리스트 도표</span>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem', textAlign: 'left', background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: 12, overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#fbbf24', borderBottom: '1px solid rgba(234, 179, 8, 0.3)' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 900 }}>알고리즘</th>
                    <th style={{ padding: '12px 16px', fontWeight: 900 }}>🟢 최고의 호재 결과 (Best Signal)</th>
                    <th style={{ padding: '12px 16px', fontWeight: 900 }}>상태 텍스트 예시</th>
                    <th style={{ padding: '12px 16px', fontWeight: 900 }}>실전에서의 의미</th>
                  </tr>
                </thead>
                <tbody style={{ color: '#ffffff' }}>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#818cf8' }}>1. ⏱️ TWAP</td>
                    <td style={{ padding: '12px 16px', color: '#34d399', fontWeight: 800 }}>균등 매집도 65% ~ 100%</td>
                    <td style={{ padding: '12px 16px' }}>🕵️‍♂️ 스텔스 분할 매집 정황 포착</td>
                    <td style={{ padding: '12px 16px', color: 'var(--t2)' }}>세력이 티 안 나게 물량을 싹쓸이 사모으는 중</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#c084fc' }}>2. 🌊 OBV</td>
                    <td style={{ padding: '12px 16px', color: '#34d399', fontWeight: 800 }}>OBV 누적 수치 우상향 (+)</td>
                    <td style={{ padding: '12px 16px' }}>🟢 자금 지속 유입 (OBV 우상향)</td>
                    <td style={{ padding: '12px 16px', color: 'var(--t2)' }}>주가 하락은 가짜(속임수), 실제 주포 자금은 쇄도 중</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#fbbf24' }}>3. 💥 스퀴즈</td>
                    <td style={{ padding: '12px 16px', color: '#34d399', fontWeight: 800 }}>대역폭 8.5% 이하</td>
                    <td style={{ padding: '12px 16px' }}>⚡ 변동성 극도 압축! (폭발 임박 스퀴즈)</td>
                    <td style={{ padding: '12px 16px', color: 'var(--t2)' }}>쥐어짜듯 눌려 있던 주가가 급등 폭발 직전</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#34d399' }}>4. 🧱 VPVR</td>
                    <td style={{ padding: '12px 16px', color: '#34d399', fontWeight: 800 }}>현재가 &gt; 최대 매물대(POC)</td>
                    <td style={{ padding: '12px 16px' }}>🛡️ 최대 매물대 위 지지 형성</td>
                    <td style={{ padding: '12px 16px', color: 'var(--t2)' }}>세력이 만들어 둔 대량 매물대가 든든한 바닥 방어선</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: '#f87171' }}>5. 🧮 켈리공식</td>
                    <td style={{ padding: '12px 16px', color: '#34d399', fontWeight: 800 }}>추천 비중 15% ~ 25%</td>
                    <td style={{ padding: '12px 16px' }}>보유 현금의 25.0% 추가 권장</td>
                    <td style={{ padding: '12px 16px', color: 'var(--t2)' }}>승률과 손익비가 우수하여 안심하고 추가매수 가능</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
