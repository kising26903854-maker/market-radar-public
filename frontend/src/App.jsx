// App.jsx — 📊 KRX 퀀트 마켓 레이더 (대중 공개용 웹 서비스)
import React, { useState, useEffect, useCallback } from 'react'
import StockDetailModal from './components/StockDetailModal.jsx'
import UndervaluedRadar from './components/UndervaluedRadar.jsx'
import MarketCapRanking from './components/MarketCapRanking.jsx'
import ValueChainModal from './components/ValueChainModal.jsx'
import GlobalNewsDashboard from './components/GlobalNewsDashboard.jsx'
import MarketCalendar from './components/MarketCalendar.jsx'
import NpsTracker from './components/NpsTracker.jsx'
import NpsNewDisclosuresTab from './components/NpsNewDisclosuresTab.jsx'
import BondYieldTracker from './components/BondYieldTracker.jsx'
import MorningBriefingBanner from './components/MorningBriefingBanner.jsx'
import SmartSupplyDemand from './components/SmartSupplyDemand.jsx'
import MomentumScanner from './components/MomentumScanner.jsx'
import VkospiTrackerTab from './components/VkospiTrackerTab.jsx'
import BearMarketScannerTab from './components/BearMarketScannerTab.jsx'
import GrowthStockScreener from './components/GrowthStockScreener.jsx'
import BaseRateChart from './components/BaseRateChart.jsx'
import DoubleBottomScannerTab from './components/DoubleBottomScannerTab.jsx'
import BaseBreakoutScannerTab from './components/BaseBreakoutScannerTab.jsx'
import EnergyCondensationScannerTab from './components/EnergyCondensationScannerTab.jsx'
import MonthlyMA10ScannerTab from './components/MonthlyMA10ScannerTab.jsx'
import BacktestReportTab from './components/BacktestReportTab.jsx'
import AiPredictionTab from './components/AiPredictionTab.jsx'
import TradeStatsTab from './components/TradeStatsTab.jsx'
import MaReversalScannerTab from './components/MaReversalScannerTab.jsx'

// 🎨 세련된 현대식 SVG 라인 아이콘 컴포넌트들
const MenuIcon = ({ type, size = 16, color = "currentColor", style = {} }) => {
  const getPath = () => {
    switch (type) {
      case 'dashboard':
        return <path d="M18 20V10M12 20V4M6 20v-6" />
      case 'accumulation':
        return (
          <>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </>
        )
      case 'watchlist':
        return <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      case 'news':
        return <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm4 5h8M8 13h8M8 17h5" />
      case 'briefing':
        return (
          <>
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </>
        )
      case 'chat':
        return <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      case 'wallstreet':
      case 'base-rates':
      case 'nps-tracker':
      case 'nps-disclosures':
      case 'nps':
        return <path d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11M20 10v11M8 10v11M12 10v11M16 10v11" />
      case 'journal':
        return <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5v-15z" />
      case 'disclosures':
        return <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8M16 17H8M10 9H8" />
      case 'alerts':
        return <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0" />
      case 'dividend':
        return (
          <>
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </>
        )
      case 'undervalued':
        return <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
      case 'growth-screener':
        return (
          <>
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </>
        )
      case 'market_cap':
        return <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34M12 2a7 7 0 0 1 7 7c0 2.25-1.5 4.5-4 5H9c-2.5-.5-4-2.75-4-5a7 7 0 0 1 7-7z" />
      case 'trade-stats':
        return (
          <>
            <path d="M2 12h20M12 2c2.5 2.7 4 6.3 4 10s-1.5 7.3-4 10c-2.5-2.7-4-6.3-4-10s1.5-7.3 4-10z" />
            <path d="M4 7l3 3-3 3M20 17l-3-3 3-3" />
          </>
        )
      case 'high52w':
        return <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      case 'global-news':
        return (
          <>
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </>
        )
      case 'market-calendar':
        return (
          <>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </>
        )
      case 'bond-yields':
        return <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      case 'vkospi':
        return <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      case 'smart-supply':
        return <path d="M12 2c0 0-4 4.5-4 8.5C8 12.8 9.8 14 12 14s4-1.2 4-3.5C16 6.5 12 2 12 2z" />
      case 'company':
        return (
          <>
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
            <line x1="9" y1="22" x2="9" y2="16" /><line x1="15" y1="22" x2="15" y2="16" />
            <path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M12 6h.01M12 10h.01" />
          </>
        )
      case 'trophy':
        return <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34M12 2a7 7 0 0 1 7 7c0 2.25-1.5 4.5-4 5H9c-2.5-.5-4-2.75-4-5a7 7 0 0 1 7-7z" />
      case 'radar':
        return (
          <>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /><path d="M2 12h20" />
          </>
        )
      case 'short-selling':
        return (
          <>
            <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
            <polyline points="17 18 23 18 23 12" />
          </>
        )
      case 'check-circle':
        return (
          <>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </>
        )
      case 'alert-triangle':
        return (
          <>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </>
        )
      case 'refresh':
        return (
          <>
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </>
        )
      case 'lightbulb':
        return <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A7 7 0 0 0 6 8c0 1 .5 2.2 1.5 3.1.7.8 1.3 1.5 1.5 2.5M9 18h6M10 22h4" />
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

export default function App() {
  const [tab, setTab] = useState('vkospi') // 기본 랜딩 탭: ⚡ KRX 변동성지수 & 3대 지수 레이더
  const [selectedStock, setSelectedStock] = useState(null)
  const [showValueChainModal, setShowValueChainModal] = useState(false)
  const [valueChainCode, setValueChainCode] = useState(null)
  const [valueChainName, setValueChainName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [marketIndices, setMarketIndices] = useState(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // 실시간 3대 시장 지수 요약 로드
  const fetchMarketSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/vkospi?period=1m')
      const json = await res.json()
      if (json.success) {
        setMarketIndices(json)
      }
    } catch (e) {
      console.warn('시장 지표 로드 에러:', e.message)
    }
  }, [])

  useEffect(() => {
    fetchMarketSummary()
    const interval = setInterval(fetchMarketSummary, 10000)
    return () => clearInterval(interval)
  }, [fetchMarketSummary])

  // 종목 실시간 검색
  const handleSearch = async (query) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      const json = await res.json()
      if (json.success) {
        setSearchResults(json.results || [])
      }
    } catch (e) {
      console.error('검색 실패:', e)
    } finally {
      setSearchLoading(false)
    }
  }

  const handleOpenStockChart = (stock) => {
    setSelectedStock(stock)
  }

  const handleOpenValueChain = (code, name) => {
    setSelectedStock(null)
    setValueChainCode(code)
    setValueChainName(name)
    setShowValueChainModal(true)
  }

  const curKospi = marketIndices?.kospi?.currentPrice || 6742.74
  const curKosdaq = marketIndices?.kosdaq?.currentPrice || 827.15
  const curVkospi = marketIndices?.current?.vkospi || 56.29
  const marketStatus = marketIndices?.current?.marketStatus || '장중 실시간'

  return (
    <div className="app">
      {/* ─── 1. 상단 글로벌 네비게이션 헤더 ─── */}
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="hamburger-btn" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            ☰
          </button>
          <div className="header-logo" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }} onClick={() => setTab('vkospi')}>
            {/* 💎 미래지향적 핀테크 퀀트 레이더 3D 글로우 SVG 엠블럼 */}
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.25) 0%, rgba(99, 102, 241, 0.35) 100%)',
              border: '1.5px solid rgba(56, 189, 248, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 18px rgba(56, 189, 248, 0.35)',
              position: 'relative',
              flexShrink: 0
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="logoGrad" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#38bdf8" />
                    <stop offset="0.5" stopColor="#818cf8" />
                    <stop offset="1" stopColor="#c084fc" />
                  </linearGradient>
                </defs>
                {/* 퀀트 상승 레이더 펄스 곡선 */}
                <path d="M3 17L8 11.5L13 15.5L21 5.5" stroke="url(#logoGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15.5 5.5H21V11" stroke="url(#logoGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="21" cy="5.5" r="2.8" fill="#38bdf8" />
                <circle cx="8" cy="11.5" r="1.8" fill="#818cf8" />
                <circle cx="13" cy="15.5" r="1.8" fill="#818cf8" />
                <circle cx="3" cy="17" r="1.8" fill="#38bdf8" />
              </svg>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span className="logo-title" style={{ fontSize: '1.22rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.4px', fontFamily: "'Noto Sans KR', sans-serif" }}>
                  KRX <span style={{
                    background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #c084fc 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: 900
                  }}>퀀트 마켓 레이더</span>
                </span>
                <span style={{
                  fontSize: '.66rem',
                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.25) 0%, rgba(99, 102, 241, 0.25) 100%)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.6)',
                  padding: '2px 7px',
                  borderRadius: 6,
                  fontWeight: 900,
                  letterSpacing: '0.5px'
                }}>
                  LIVE
                </span>
              </div>
              <span className="logo-subtitle" style={{ fontSize: '.68rem', color: 'var(--t3)', letterSpacing: '0.4px', fontFamily: 'Space Mono', marginTop: -2 }}>
                QUANTITATIVE MARKET RADAR
              </span>
            </div>
          </div>
        </div>

        {/* ⚖️ 상단 중앙 투자 책임 고지 배너 (PC 전용 데스크탑 헤더 중앙 배치) */}
        <div className="header-notice hide-on-mobile" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '7px 20px',
          background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.18) 0%, rgba(239, 68, 68, 0.12) 100%)',
          border: '1.5px solid rgba(234, 179, 8, 0.45)',
          borderRadius: 24,
          fontSize: '.85rem',
          fontWeight: 700,
          color: '#f8fafc',
          lineHeight: 1.4,
          maxWidth: '640px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          letterSpacing: '-0.2px'
        }}>
          <span style={{ fontSize: '1.1rem' }}>⚖️</span>
          <span>
            <strong style={{ color: '#fbbf24', fontWeight: 900, marginRight: 4 }}>[투자 유의사항]</strong>
            본 서비스의 퀀트 지표는 시장 분석 참고용이며 매수·매도를 권유하지 않습니다. 모든 투자의 최종 판단과 결과에 대한 책임은 <strong style={{ color: '#fbbf24', fontWeight: 900, textDecoration: 'underline' }}>투자자 본인</strong>에게 있습니다.
          </span>
        </div>

        {/* 상단 3대 지수 실시간 미니 티커 바 */}
        <div className="header-status" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--t3)', fontSize: '.8rem' }}>코스피:</span>
            <strong style={{ color: '#38bdf8', fontSize: '.88rem' }}>{Number(curKospi).toLocaleString()} pt</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--t3)', fontSize: '.8rem' }}>코스닥:</span>
            <strong style={{ color: '#34d399', fontSize: '.88rem' }}>{Number(curKosdaq).toLocaleString()} pt</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--t3)', fontSize: '.8rem' }}>VKOSPI:</span>
            <strong style={{ color: '#f87171', fontSize: '.88rem' }}>{curVkospi} POINT</strong>
          </div>
          <span style={{
            fontSize: '.72rem',
            background: 'rgba(16, 185, 129, 0.2)',
            color: '#34d399',
            border: '1px solid #10b981',
            padding: '2px 8px',
            borderRadius: 12,
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
            {marketStatus}
          </span>
        </div>
      </header>

      {/* ─── 2. 좌측 네비게이션 사이드바 (280px 좌측 고정 레이아웃) ─── */}
      {isMenuOpen && <div className="sidebar-overlay" onClick={() => setIsMenuOpen(false)} />}
      <aside className={`sidebar ${isMenuOpen ? 'sidebar-open' : ''}`}>
        {/* 공포탐욕지수 & 시장 개요 미니 위젯 */}
        <div style={{
          padding: '12px 14px',
          background: 'linear-gradient(135deg, rgba(239,68,68,0.18) 0%, rgba(99,102,241,0.18) 100%)',
          border: '1.5px solid rgba(239,68,68,0.5)',
          borderRadius: 14,
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: '.78rem', fontWeight: 900, color: '#f87171' }}>⚡ KRX 실시간 변동성</span>
            <span style={{ fontSize: '.85rem', fontWeight: 900, color: '#38bdf8', fontFamily: 'Space Mono' }}>{curVkospi} pt</span>
          </div>
          <div style={{ fontSize: '.74rem', color: 'var(--t2)', lineHeight: 1.4 }}>
            코스피 역상관 퀀트 레이더 가동 중
          </div>
        </div>

        {/* 실시간 종목 검색창 */}
        <div style={{ marginTop: 10, padding: '0 0 12px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '.78rem', fontWeight: 800, color: 'var(--gold)', marginBottom: 6 }}>🔍 종목 검색</div>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="종목명 또는 코드 입력..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 0,
                border: '1.5px solid rgba(255,255,255,0.3)',
                background: 'var(--bg3)',
                color: '#fff',
                fontSize: '.85rem'
              }}
            />
            {searchResults.length > 0 && (
              <div style={{
                position: 'absolute',
                top: 45,
                left: 0,
                right: 0,
                background: 'rgba(15, 23, 42, 0.98)',
                border: '1px solid var(--border)',
                borderRadius: 0,
                zIndex: 2000,
                maxHeight: 220,
                overflowY: 'auto',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
              }}>
                {searchResults.map(s => (
                  <div
                    key={s.code}
                    onClick={() => {
                      handleOpenStockChart(s)
                      setSearchResults([])
                      setSearchQuery('')
                    }}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '.8rem'
                    }}
                  >
                    <span style={{ color: '#fff', fontWeight: 800 }}>{s.name}</span>
                    <span style={{ color: 'var(--t3)', fontFamily: 'Space Mono' }}>{s.code}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="nav-section-label" style={{ marginTop: 8 }}>⚡ 핵심 증시 레이더</div>
        <div className="tab-nav">
          <button className={`tab-btn ${tab === 'vkospi' ? 'active' : ''}`} onClick={() => { setTab('vkospi'); setIsMenuOpen(false); }}>
            <MenuIcon type="vkospi" color={tab === 'vkospi' ? '#fff' : '#f87171'} />
            KRX 변동성지수 &amp; 3대 지수
          </button>
          <button className={`tab-btn ${tab === 'nps-tracker' ? 'active' : ''}`} onClick={() => { setTab('nps-tracker'); setIsMenuOpen(false); }}>
            <MenuIcon type="nps-tracker" color={tab === 'nps-tracker' ? '#fff' : '#34d399'} />
            국민연금 DART 5% 공시
          </button>
          <button className={`tab-btn ${tab === 'nps-new' ? 'active' : ''}`} onClick={() => { setTab('nps-new'); setIsMenuOpen(false); }}>
            <MenuIcon type="nps-tracker" color={tab === 'nps-new' ? '#fff' : '#fbbf24'} />
            🌅 국민연금 신규 공시
          </button>
          <button className={`tab-btn ${tab === 'bear-market' ? 'active' : ''}`} onClick={() => { setTab('bear-market'); setIsMenuOpen(false); }}>
            <MenuIcon type="undervalued" color={tab === 'bear-market' ? '#fff' : '#34d399'} />
            하락장 역주행주 스캐너
          </button>
          <button className={`tab-btn ${tab === 'growth-screener' ? 'active' : ''}`} onClick={() => { setTab('growth-screener'); setIsMenuOpen(false); }}>
            <MenuIcon type="growth-screener" color={tab === 'growth-screener' ? '#fff' : '#f472b6'} />
            종목 발굴기 (4대 퀀트)
          </button>
          <button className={`tab-btn ${tab === 'smart-supply' ? 'active' : ''}`} onClick={() => { setTab('smart-supply'); setIsMenuOpen(false); }}>
            <MenuIcon type="smart-supply" color={tab === 'smart-supply' ? '#fff' : '#c084fc'} />
            외인·기관 쌍끌이 수급
          </button>
          <button className={`tab-btn ${tab === 'undervalued' ? 'active' : ''}`} onClick={() => { setTab('undervalued'); setIsMenuOpen(false); }}>
            <MenuIcon type="undervalued" color={tab === 'undervalued' ? '#fff' : '#10b981'} />
            슈퍼밸류 극초저평가
          </button>
          <button className={`tab-btn ${tab === 'momentum' ? 'active' : ''}`} onClick={() => { setTab('momentum'); setIsMenuOpen(false); }}>
            <MenuIcon type="high52w" color={tab === 'momentum' ? '#fff' : '#fbbf24'} />
            52주 신고가 &amp; 골든크로스
          </button>
          <button className={`tab-btn ${tab === 'double-bottom' ? 'active' : ''}`} onClick={() => { setTab('double-bottom'); setIsMenuOpen(false); }}>
            <MenuIcon type="accumulation" color={tab === 'double-bottom' ? '#fff' : '#60a5fa'} />
            하락추세 후 쌍바닥 패턴
          </button>
          <button className={`tab-btn ${tab === 'base-breakout' ? 'active' : ''}`} onClick={() => { setTab('base-breakout'); setIsMenuOpen(false); }}>
            <MenuIcon type="high52w" color={tab === 'base-breakout' ? '#fff' : '#34d399'} />
            하락→횡보→상승초입 스캐너
          </button>
          <button className={`tab-btn ${tab === 'energy-condensation' ? 'active' : ''}`} onClick={() => { setTab('energy-condensation'); setIsMenuOpen(false); }}>
            <MenuIcon type="accumulation" color={tab === 'energy-condensation' ? '#fff' : '#f59e0b'} />
            에너지 응축 돌파 스캐너
          </button>
          <button className={`tab-btn ${tab === 'monthly-ma10' ? 'active' : ''}`} onClick={() => { setTab('monthly-ma10'); setIsMenuOpen(false); }}>
            <MenuIcon type="high52w" color={tab === 'monthly-ma10' ? '#fff' : '#10b981'} />
            월봉 10이평선 지지 스캐너
          </button>
          <button className={`tab-btn ${tab === 'ma-reversal' ? 'active' : ''}`} onClick={() => { setTab('ma-reversal'); setIsMenuOpen(false); }}>
            <MenuIcon type="accumulation" color={tab === 'ma-reversal' ? '#fff' : '#f59e0b'} />
            "256 기법" 전종목 스캐너
          </button>
          <button className={`tab-btn ${tab === 'backtest-report' ? 'active' : ''}`} onClick={() => { setTab('backtest-report'); setIsMenuOpen(false); }}>
            <MenuIcon type="accumulation" color={tab === 'backtest-report' ? '#fff' : '#818cf8'} />
            패턴 스캐너 백테스트
          </button>
          <button className={`tab-btn ${tab === 'ai-prediction' ? 'active' : ''}`} onClick={() => { setTab('ai-prediction'); setIsMenuOpen(false); }}>
            <MenuIcon type="accumulation" color={tab === 'ai-prediction' ? '#fff' : '#c084fc'} />
            AI 상승확률 예측
          </button>
          <button className={`tab-btn ${tab === 'market-calendar' ? 'active' : ''}`} onClick={() => { setTab('market-calendar'); setIsMenuOpen(false); }}>
            <MenuIcon type="market-calendar" color={tab === 'market-calendar' ? '#fff' : '#f472b6'} />
            한·미 증시 일정 달력
          </button>
          <button className={`tab-btn ${tab === 'bond-yields' ? 'active' : ''}`} onClick={() => { setTab('bond-yields'); setIsMenuOpen(false); }}>
            <MenuIcon type="bond-yields" color={tab === 'bond-yields' ? '#fff' : '#f87171'} />
            글로벌 국채금리 &amp; 매크로
          </button>
          <button className={`tab-btn ${tab === 'global-news' ? 'active' : ''}`} onClick={() => { setTab('global-news'); setIsMenuOpen(false); }}>
            <MenuIcon type="global-news" color={tab === 'global-news' ? '#fff' : '#818cf8'} />
            국제정세/매크로 뉴스
          </button>
          <button className={`tab-btn ${tab === 'base-rates' ? 'active' : ''}`} onClick={() => { setTab('base-rates'); setIsMenuOpen(false); }}>
            <MenuIcon type="base-rates" color={tab === 'base-rates' ? '#fff' : '#3b82f6'} />
            한·미 기준금리 추이
          </button>
          <button className={`tab-btn ${tab === 'market_cap' ? 'active' : ''}`} onClick={() => { setTab('market_cap'); setIsMenuOpen(false); }}>
            <MenuIcon type="market_cap" color={tab === 'market_cap' ? '#fff' : '#3b82f6'} />
            코스피·코스닥 시총 랭킹
          </button>
          <button className={`tab-btn ${tab === 'trade-stats' ? 'active' : ''}`} onClick={() => { setTab('trade-stats'); setIsMenuOpen(false); }}>
            <MenuIcon type="trade-stats" color={tab === 'trade-stats' ? '#fff' : '#38bdf8'} />
            수출입 동향 (10일 잠정치)
          </button>
        </div>
      </aside>

      {/* ─── 3. 우측 메인 콘텐츠 영역 ─── */}
      <main className="main-content">
        {/* 📱 모바일 전용 상단 슬림 투자 유의사항 배너 */}
        <div className="mobile-notice-banner show-on-mobile" style={{
          padding: '8px 14px',
          marginBottom: '14px',
          background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.12) 0%, rgba(239, 68, 68, 0.08) 100%)',
          border: '1px solid rgba(234, 179, 8, 0.35)',
          borderRadius: 10,
          fontSize: '.76rem',
          color: '#cbd5e1',
          lineHeight: 1.45
        }}>
          ⚖️ <strong style={{ color: '#fbbf24' }}>[투자 유의사항]</strong> 본 퀀트 지표는 시장 분석 참고용이며 모든 투자의 최종 판단과 책임은 <strong>투자자 본인</strong>에게 있습니다.
        </div>

        {/* 상단 모닝 브리핑 배너 */}
        <MorningBriefingBanner />

        {/* 탭 1: ⚡ KRX 변동성지수 & 3대 지수 레이더 */}
        {tab === 'vkospi' && <VkospiTrackerTab onSelectStock={handleOpenStockChart} />}

        {/* 탭 2: 🏛️ 국민연금 DART 5% 대량보유 공시 추적기 */}
        {tab === 'nps-tracker' && <NpsTracker onSelectStock={handleOpenStockChart} onOpenValueChain={handleOpenValueChain} />}
        {tab === 'nps-new' && <NpsNewDisclosuresTab onSelectStock={handleOpenStockChart} />}

        {/* 탭 3: 🛡️ 하락장 역주행주 스캐너 */}
        {tab === 'bear-market' && <BearMarketScannerTab onSelectStock={handleOpenStockChart} onOpenValueChain={handleOpenValueChain} />}

        {/* 탭 3.5: 🔍 4대 재무 퀀트 엄격 AND 조건 종목 발굴기 */}
        {tab === 'growth-screener' && <GrowthStockScreener onSelectStock={handleOpenStockChart} onOpenValueChain={handleOpenValueChain} />}

        {/* 탭 4: 🔥 외인·기관 쌍끌이 스마트 수급 */}
        {tab === 'smart-supply' && <SmartSupplyDemand onSelectStock={handleOpenStockChart} onOpenValueChain={handleOpenValueChain} />}

        {/* 탭 5: 💎 슈퍼밸류 극초저평가 발굴 레이더 */}
        {tab === 'undervalued' && <UndervaluedRadar onSelectStock={handleOpenStockChart} onOpenValueChain={handleOpenValueChain} />}

        {/* 탭 6: 🚀 52주 신고가 & 골든크로스 모멘텀 */}
        {tab === 'momentum' && <MomentumScanner onSelectStock={handleOpenStockChart} onOpenValueChain={handleOpenValueChain} />}
        {tab === 'double-bottom' && <DoubleBottomScannerTab onSelectStock={handleOpenStockChart} />}
        {tab === 'base-breakout' && <BaseBreakoutScannerTab onSelectStock={handleOpenStockChart} />}
        {tab === 'energy-condensation' && <EnergyCondensationScannerTab onSelectStock={handleOpenStockChart} />}
        {tab === 'monthly-ma10' && <MonthlyMA10ScannerTab onSelectStock={handleOpenStockChart} />}
        {tab === 'ma-reversal' && <MaReversalScannerTab onSelectStock={handleOpenStockChart} />}
        {tab === 'backtest-report' && <BacktestReportTab />}
        {tab === 'ai-prediction' && <AiPredictionTab onSelectStock={handleOpenStockChart} />}

        {/* 탭 7: 📅 한·미 증시 일정 달력 */}
        {tab === 'market-calendar' && <MarketCalendar />}

        {/* 탭 8: 📈 글로벌 국채금리 & 매크로 */}
        {tab === 'bond-yields' && <BondYieldTracker />}

        {/* 탭 10: 🌍 국제정세/매크로 뉴스 */}
        {tab === 'global-news' && <GlobalNewsDashboard />}

        {/* 탭 10.5: 🏛️ 한·미 기준금리 추이 분석 */}
        {tab === 'base-rates' && <BaseRateChart />}

        {/* 탭 11: 🏆 코스피·코스닥 시가총액 랭킹 */}
        {tab === 'market_cap' && <MarketCapRanking onSelectStock={handleOpenStockChart} onOpenValueChain={handleOpenValueChain} />}

        {/* 탭 11: 🚢 수출입 동향 (관세청 10일 단위 잠정치) */}
        {tab === 'trade-stats' && <TradeStatsTab />}
      </main>

      {/* ─── 4. 종목 상세 퀀트 분석 & 차트 모달 팝업 ─── */}
      {selectedStock && (
        <StockDetailModal
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
          onOpenValueChain={handleOpenValueChain}
        />
      )}

      {/* ─── 5. 밸류체인 모달 ─── */}
      {showValueChainModal && (
        <ValueChainModal
          stock={{ code: valueChainCode, name: valueChainName }}
          stockCode={valueChainCode}
          stockName={valueChainName}
          onClose={() => setShowValueChainModal(false)}
          onSelectStock={(targetStock) => {
            setShowValueChainModal(false)
            setSelectedStock(targetStock)
          }}
        />
      )}
    </div>
  )
}
