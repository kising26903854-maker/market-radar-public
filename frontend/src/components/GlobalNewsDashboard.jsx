// GlobalNewsDashboard.jsx — 국제 정세 및 매크로 뉴스 요약 대시보드
import { useState, useEffect, useCallback } from 'react'

const CATEGORY_CHIPS = [
  { label: '🌍 전체', value: 'ALL' },
  { label: '💱 환율/금리', value: '환율/금리' },
  { label: '📊 해외증시', value: '해외증시' },
  { label: '🛢️ 원자재', value: '원자재' },
  { label: '🚢 무역/통상', value: '무역/통상' },
  { label: '📜 정책/규제', value: '정책/규제' },
  { label: '🌐 글로벌이슈', value: '글로벌이슈' }
]

const CATEGORY_ICONS = {
  '환율/금리': '💱',
  '해외증시': '📊',
  '원자재': '🛢️',
  '무역/통상': '🚢',
  '정책/규제': '📜',
  '글로벌이슈': '🌐'
}

const CATEGORY_COLORS = {
  '환율/금리': { bg: 'rgba(234,179,8,0.15)', color: '#fbbf24', border: 'rgba(234,179,8,0.4)' },
  '해외증시': { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: 'rgba(59,130,246,0.4)' },
  '원자재': { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: 'rgba(245,158,11,0.4)' },
  '무역/통상': { bg: 'rgba(16,185,129,0.15)', color: '#34d399', border: 'rgba(16,185,129,0.4)' },
  '정책/규제': { bg: 'rgba(168,85,247,0.15)', color: '#c084fc', border: 'rgba(168,85,247,0.4)' },
  '글로벌이슈': { bg: 'rgba(99,102,241,0.15)', color: '#818cf8', border: 'rgba(99,102,241,0.4)' }
}

export default function GlobalNewsDashboard() {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  const loadNews = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/global-news')
      const data = await res.json()
      if (data.success) {
        setNews(data.news || [])
        setLastUpdated(data.lastUpdated)
      } else {
        setError(data.error || '뉴스를 불러오지 못했습니다.')
      }
    } catch (e) {
      setError('뉴스 API에 연결할 수 없습니다: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadNews() }, [loadNews])

  // 필터 & 검색
  const filtered = news.filter(item => {
    if (filter !== 'ALL' && item.category !== filter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      if (!(item.title || '').toLowerCase().includes(q) &&
          !(item.summary || '').toLowerCase().includes(q) &&
          !(item.source || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  // 카테고리별 건수
  const categoryCounts = {}
  news.forEach(n => {
    categoryCounts[n.category] = (categoryCounts[n.category] || 0) + 1
  })

  return (
    <div style={{ padding: '10px 0', animation: 'fadeIn 0.4s ease-in-out' }}>

      {/* 헤더 배너 */}
      <div style={{
        padding: '24px 28px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(59,130,246,0.15) 50%, rgba(16,185,129,0.15) 100%)',
        border: '2px solid rgba(99,102,241,0.5)',
        borderRadius: 20,
        marginBottom: 24,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ filter: 'drop-shadow(0 0 10px #6366f1)' }}>🌍 국제 정세 & 매크로 뉴스 대시보드</span>
              <span style={{ fontSize: '.72rem', background: '#6366f1', color: '#fff', padding: '3px 10px', borderRadius: 20, fontWeight: 800 }}>
                ⚡ LIVE
              </span>
            </div>
            <div style={{ fontSize: '.9rem', color: 'var(--t2)', marginTop: 6, lineHeight: 1.5 }}>
              글로벌 증시, 환율, 금리, 원자재 등 <strong style={{ color: 'var(--gold)' }}>한국 주식시장에 영향을 미치는 국제 뉴스</strong>를 실시간으로 모아봅니다.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {lastUpdated && (
              <div style={{ padding: '6px 14px', background: 'rgba(0,0,0,0.4)', borderRadius: 12, border: '1px solid rgba(99,102,241,0.4)', textAlign: 'center' }}>
                <div style={{ fontSize: '.68rem', color: 'var(--t3)', fontWeight: 700 }}>마지막 업데이트</div>
                <div style={{ fontSize: '.8rem', fontWeight: 800, color: '#818cf8', marginTop: 2 }}>{new Date(lastUpdated).toLocaleTimeString('ko-KR')}</div>
              </div>
            )}
            <div style={{ padding: '6px 14px', background: 'rgba(0,0,0,0.4)', borderRadius: 12, border: '1px solid rgba(16,185,129,0.4)', textAlign: 'center' }}>
              <div style={{ fontSize: '.68rem', color: 'var(--t3)', fontWeight: 700 }}>뉴스 수집</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#10b981', marginTop: 2 }}>{news.length}건</div>
            </div>
            <button
              onClick={loadNews}
              disabled={loading}
              style={{ padding: '10px 16px', background: 'var(--accent)', border: 'none', borderRadius: 12, color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: '.85rem' }}
            >
              {loading ? '⏳ 수집 중...' : '🔄 새로고침'}
            </button>
          </div>
        </div>
      </div>

      {/* 검색 바 */}
      <div style={{
        marginBottom: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--bg2)',
        padding: '12px 18px',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <span style={{ fontSize: '1.2rem' }}>🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="뉴스 제목, 키워드, 언론사 검색..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#fff',
            fontSize: '0.95rem',
            fontWeight: 600
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: '1rem' }}
          >
            ✕ 초기화
          </button>
        )}
      </div>

      {/* 카테고리 필터 칩 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {CATEGORY_CHIPS.map((chip, i) => {
          const isActive = filter === chip.value
          const count = chip.value === 'ALL' ? news.length : (categoryCounts[chip.value] || 0)
          return (
            <button
              key={i}
              onClick={() => setFilter(chip.value)}
              style={{
                padding: '8px 14px',
                borderRadius: 12,
                border: isActive ? '1.5px solid rgba(99,102,241,0.6)' : '1px solid rgba(255,255,255,0.12)',
                background: isActive ? 'rgba(99,102,241,0.2)' : 'var(--bg3)',
                color: isActive ? '#a5b4fc' : 'var(--t2)',
                fontWeight: isActive ? 800 : 600,
                fontSize: '.82rem',
                cursor: 'pointer',
                transition: 'all .15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              {chip.label} ({count})
            </button>
          )
        })}
      </div>

      {/* 로딩 */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--t2)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16, animation: 'pulse 1.5s infinite' }}>🌍</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>국제 뉴스를 수집하고 있습니다...</div>
          <div style={{ fontSize: '.85rem', color: 'var(--t3)', marginTop: 6 }}>네이버 금융 뉴스 실시간 분석 중</div>
        </div>
      )}

      {/* 에러 */}
      {error && !loading && (
        <div style={{
          padding: '20px 24px', borderRadius: 14,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)',
          color: '#f87171', fontSize: '.9rem', fontWeight: 700, textAlign: 'center'
        }}>
          ⚠️ {error}
          <div style={{ marginTop: 10 }}>
            <button onClick={loadNews} style={{ padding: '6px 14px', background: '#ef4444', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
              🔄 다시 시도
            </button>
          </div>
        </div>
      )}

      {/* 뉴스 카드 그리드 */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {filtered.map((item, idx) => {
            const catStyle = CATEGORY_COLORS[item.category] || CATEGORY_COLORS['글로벌이슈']
            const icon = CATEGORY_ICONS[item.category] || '🌐'

            return (
              <div
                key={idx}
                style={{
                  padding: '18px 20px',
                  background: 'var(--bg2)',
                  border: `1.5px solid ${catStyle.border}`,
                  borderRadius: 16,
                  cursor: 'pointer',
                  transition: 'transform .15s ease, box-shadow .15s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
                onClick={() => item.url && window.open(item.url, '_blank')}
              >
                {/* 카테고리 + 출처 + 날짜 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{
                    fontSize: '.72rem', fontWeight: 800, padding: '3px 10px',
                    borderRadius: 8, background: catStyle.bg, color: catStyle.color,
                    border: `1px solid ${catStyle.border}`
                  }}>
                    {icon} {item.category}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.source && (
                      <span style={{ fontSize: '.7rem', color: 'var(--t3)', fontWeight: 700 }}>{item.source}</span>
                    )}
                    {item.date && (
                      <span style={{ fontSize: '.68rem', color: 'var(--t3)' }}>{item.date}</span>
                    )}
                  </div>
                </div>

                {/* 제목 */}
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', lineHeight: 1.5, marginBottom: 8 }}>
                  {item.title}
                </div>

                {/* 요약 */}
                {item.summary && (
                  <div style={{ fontSize: '.82rem', color: 'var(--t2)', lineHeight: 1.6 }}>
                    {item.summary}
                  </div>
                )}

                {/* 원문 보기 링크 */}
                {item.url && (
                  <div style={{ marginTop: 10, fontSize: '.75rem', color: '#818cf8', fontWeight: 700 }}>
                    📎 원문 보기 →
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 검색 결과 없음 */}
      {!loading && !error && filtered.length === 0 && news.length > 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--t3)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: '1rem', fontWeight: 700 }}>해당 조건에 맞는 뉴스가 없습니다.</div>
          <div style={{ fontSize: '.85rem', marginTop: 4 }}>다른 카테고리를 선택하거나 검색어를 바꿔보세요.</div>
        </div>
      )}

      {/* 뉴스 없음 */}
      {!loading && !error && news.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--t3)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>📰</div>
          <div style={{ fontSize: '1rem', fontWeight: 700 }}>수집된 뉴스가 없습니다.</div>
          <div style={{ fontSize: '.85rem', marginTop: 4 }}>새로고침 버튼을 눌러 뉴스를 다시 수집해 보세요.</div>
        </div>
      )}
    </div>
  )
}
