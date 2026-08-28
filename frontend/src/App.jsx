// App.jsx — 📊 KRX 퀀트 마켓 레이더 (대중 공개용 웹 서비스)
import React, { useState, useEffect, useCallback } from 'react'
import StockDetailModal from './components/StockDetailModal.jsx'
import UndervaluedRadar from './components/UndervaluedRadar.jsx'
import MarketCapRanking from './components/MarketCapRanking.jsx'
import ValueChainModal from './components/ValueChainModal.jsx'
import GlobalNewsDashboard from './components/GlobalNewsDashboard.jsx'
import MarketCalendar from './components/MarketCalendar.jsx'
import NpsTracker from './components/NpsTracker.jsx'
import BondYieldTracker from './components/BondYieldTracker.jsx'
import MorningBriefingBanner from './components/MorningBriefingBanner.jsx'
import SmartSupplyDemand from './components/SmartSupplyDemand.jsx'
import MomentumScanner from './components/MomentumScanner.jsx'
import VkospiTrackerTab from './components/VkospiTrackerTab.jsx'
import BearMarketScannerTab from './components/BearMarketScannerTab.jsx'
import GrowthStockScreener from './components/GrowthStockScreener.jsx'

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

        <div className="nav-section-label" style={{ marginTop: 8 }}>⚡ 핵심 증시 레이더</div>
        <div className="tab-nav">
          <button className={`tab-btn ${tab === 'vkospi' ? 'active' : ''}`} onClick={() => { setTab('vkospi'); setIsMenuOpen(false); }}>
            ⚡ KRX 변동성지수 &amp; 3대 지수
          </button>
          <button className={`tab-btn ${tab === 'nps-tracker' ? 'active' : ''}`} onClick={() => { setTab('nps-tracker'); setIsMenuOpen(false); }}>
            🏛️ 국민연금 DART 5% 공시
          </button>
          <button className={`tab-btn ${tab === 'bear-market' ? 'active' : ''}`} onClick={() => { setTab('bear-market'); setIsMenuOpen(false); }}>
            🛡️ 하락장 역주행주 스캐너
          </button>
          <button className={`tab-btn ${tab === 'growth-screener' ? 'active' : ''}`} onClick={() => { setTab('growth-screener'); setIsMenuOpen(false); }}>
            🔍 종목 발굴기 (4대 퀀트)
          </button>
          <button className={`tab-btn ${tab === 'smart-supply' ? 'active' : ''}`} onClick={() => { setTab('smart-supply'); setIsMenuOpen(false); }}>
            🔥 외인·기관 쌍끌이 수급
          </button>
          <button className={`tab-btn ${tab === 'undervalued' ? 'active' : ''}`} onClick={() => { setTab('undervalued'); setIsMenuOpen(false); }}>
            💎 슈퍼밸류 극초저평가
          </button>
          <button className={`tab-btn ${tab === 'momentum' ? 'active' : ''}`} onClick={() => { setTab('momentum'); setIsMenuOpen(false); }}>
            🚀 52주 신고가 &amp; 골든크로스
          </button>
          <button className={`tab-btn ${tab === 'market-calendar' ? 'active' : ''}`} onClick={() => { setTab('market-calendar'); setIsMenuOpen(false); }}>
            📅 한·미 증시 일정 달력
          </button>
          <button className={`tab-btn ${tab === 'bond-yields' ? 'active' : ''}`} onClick={() => { setTab('bond-yields'); setIsMenuOpen(false); }}>
            📈 글로벌 국채금리 &amp; 매크로
          </button>
          <button className={`tab-btn ${tab === 'global-news' ? 'active' : ''}`} onClick={() => { setTab('global-news'); setIsMenuOpen(false); }}>
            🌍 국제정세/매크로 뉴스
          </button>
          <button className={`tab-btn ${tab === 'market_cap' ? 'active' : ''}`} onClick={() => { setTab('market_cap'); setIsMenuOpen(false); }}>
            🏆 코스피·코스닥 시총 랭킹
          </button>
        </div>

        {/* 실시간 종목 검색창 */}
        <div style={{ marginTop: 'auto', padding: '12px 0 0 0', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '.78rem', fontWeight: 800, color: 'var(--gold)', marginBottom: 6 }}>🔍 종목 퀀트 &amp; 차트 검색</div>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="종목명 또는 코드 입력..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg3)',
                color: '#fff',
                fontSize: '.85rem'
              }}
            />
            {searchResults.length > 0 && (
              <div style={{
                position: 'absolute',
                bottom: 45,
                left: 0,
                right: 0,
                background: 'rgba(15, 23, 42, 0.98)',
                border: '1px solid var(--border)',
                borderRadius: 8,
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

        {/* 탭 7: 📅 한·미 증시 일정 달력 */}
        {tab === 'market-calendar' && <MarketCalendar />}

        {/* 탭 8: 📈 글로벌 국채금리 & 매크로 */}
        {tab === 'bond-yields' && <BondYieldTracker />}

        {/* 탭 10: 🌍 국제정세/매크로 뉴스 */}
        {tab === 'global-news' && <GlobalNewsDashboard />}

        {/* 탭 11: 🏆 코스피·코스닥 시가총액 랭킹 */}
        {tab === 'market_cap' && <MarketCapRanking onSelectStock={handleOpenStockChart} onOpenValueChain={handleOpenValueChain} />}
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
