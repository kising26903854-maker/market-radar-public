// TradeStatsTab.jsx — 🚢 관세청 10일 단위 수출입 잠정치 통계 (품목별/국가별 비중, 전월·전분기·작년동기 비교)
import React, { useState, useEffect, useCallback } from 'react'

const PALETTE = ['#60a5fa', '#f87171', '#34d399', '#fbbf24', '#c084fc', '#38bdf8', '#f472b6', '#a78bfa', '#fb923c', '#4ade80']

function toEok(thousandUsd) {
  return (thousandUsd || 0) / 100000 // 천 달러 -> 억 달러
}

function fmtEok(thousandUsd) {
  return toEok(thousandUsd).toLocaleString('ko-KR', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + '억 달러'
}

function fmtPeriodLabel(item) {
  if (!item) return '-'
  const y = item.month.slice(0, 4)
  const m = parseInt(item.month.slice(4, 6), 10)
  return `${y}년 ${m}월 ${item.periodRange}일`
}

function PctBadge({ label, pct }) {
  if (pct === null || pct === undefined) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', color: 'var(--t3)' }}>
        <span>{label}</span><span>데이터 없음</span>
      </div>
    )
  }
  const up = pct >= 0
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.78rem' }}>
      <span style={{ color: 'var(--t3)', fontWeight: 700 }}>{label}</span>
      <span style={{ color: up ? '#ef4444' : '#3b82f6', fontWeight: 800, fontFamily: 'Space Mono' }}>
        {up ? '▲' : '▼'} {Math.abs(pct)}%
      </span>
    </div>
  )
}

function SummaryCard({ title, colorAccent, latest, mom, qoq, yoy }) {
  return (
    <div style={{ flex: '1 1 240px', minWidth: 240, background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderTop: `2px solid ${colorAccent}`, padding: '16px 18px' }}>
      <div style={{ fontSize: '.78rem', color: 'var(--t3)', fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', fontFamily: 'Space Mono', marginBottom: 2 }}>
        {latest ? fmtEok(latest.total) : '-'}
      </div>
      <div style={{ fontSize: '.72rem', color: 'var(--t3)', marginBottom: 12 }}>{fmtPeriodLabel(latest)} 기준</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <PctBadge label="전월 동기간 대비" pct={mom?.pct} />
        <PctBadge label="전분기 동기간 대비" pct={qoq?.pct} />
        <PctBadge label="작년 동기간 대비" pct={yoy?.pct} />
      </div>
    </div>
  )
}

function BarList({ items, total }) {
  const sorted = [...items].sort((a, b) => b.amount - a.amount)
  const maxAmount = Math.max(...sorted.map(i => i.amount), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sorted.map((it, i) => {
        const widthPct = Math.max(2, (it.amount / maxAmount) * 100)
        const sharePct = total ? ((it.amount / total) * 100).toFixed(1) : '0.0'
        return (
          <div key={it.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.8rem', marginBottom: 3 }}>
              <span style={{ color: 'var(--t1)', fontWeight: 700 }}>{it.label}</span>
              <span style={{ color: 'var(--t2)', fontFamily: 'Space Mono' }}>{fmtEok(it.amount)} <span style={{ color: 'var(--t3)' }}>({sharePct}%)</span></span>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', height: 8 }}>
              <div style={{ width: `${widthPct}%`, height: '100%', background: PALETTE[i % PALETTE.length] }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DonutChart({ items, total, size = 180 }) {
  const sorted = [...items].sort((a, b) => b.amount - a.amount)
  const r = size / 2 - 14
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  let offset = 0
  const sumTop = sorted.reduce((acc, it) => acc + it.amount, 0)
  const etc = Math.max(0, (total || sumTop) - sumTop)
  const segments = [...sorted.map((it, i) => ({ label: it.label, value: it.amount, color: PALETTE[i % PALETTE.length] }))]
  if (etc > 0) segments.push({ label: '기타', value: etc, color: 'rgba(255,255,255,0.12)' })
  const denom = total || sumTop || 1

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {segments.map((seg, i) => {
          const frac = seg.value / denom
          const dash = frac * circumference
          const el = (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={20}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
            />
          )
          offset += dash
          return el
        })}
      </g>
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="900" fontFamily="Space Mono">
        {((sumTop / denom) * 100).toFixed(0)}%
      </text>
      <text x={cx} y={cy + 13} textAnchor="middle" fill="var(--t3)" fontSize="9.5" fontWeight="700">
        상위 10개 비중
      </text>
    </svg>
  )
}

// 관세청 발표 자체가 "1일~10일/1일~20일/1일~월말"처럼 항상 월초부터의 누적치라,
// 구간을 그대로 늘어놓으면 매달 오르다 뚝 떨어지는 톱니 모양이 되어 월별 실제
// 금액을 한눈에 비교하기 어렵다. 그래서 달마다 가장 마지막(=가장 많이 누적된)
// 구간 하나만 뽑아 "그 달의 수출입 금액"으로 보여준다 — 월말 자료가 아직 안
// 나온 이번 달은 잠정치임을 별도로 표시한다.
function buildMonthlyBars(trend) {
  if (!trend || trend.length === 0) return []
  const byMonth = new Map()
  trend.forEach(t => {
    const prev = byMonth.get(t.month)
    if (!prev || t.total > prev.total) byMonth.set(t.month, t)
  })
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))
}

function MonthlyBarChart({ trend, selectedMonth, onSelectMonth }) {
  const bars = buildMonthlyBars(trend)
  if (bars.length < 2) return null

  const width = 760, height = 180, padding = { top: 20, right: 14, bottom: 30, left: 50 }
  const maxV = Math.max(...bars.map(b => b.total), 1)
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom
  const gap = 10
  const barW = Math.max(8, (plotW - gap * (bars.length - 1)) / bars.length)
  const getY = (v) => height - padding.bottom - (v / maxV) * plotH

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 0.5, 1].map((r, i) => {
        const y = padding.top + (1 - r) * plotH
        return (
          <g key={i}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
            <text x={padding.left - 6} y={y + 3} textAnchor="end" fill="var(--t3)" fontSize="9" fontFamily="Space Mono">{toEok(maxV * r).toFixed(0)}</text>
          </g>
        )
      })}
      {bars.map((b, i) => {
        const x = padding.left + i * (barW + gap)
        const y = getY(b.total)
        const barH = height - padding.bottom - y
        const isLatestPartial = i === bars.length - 1 && !b.periodRange.startsWith('01~3') && b.periodRange !== '01~28' && b.periodRange !== '01~29'
        const isSelected = b.month === selectedMonth
        const m = parseInt(b.month.slice(4, 6), 10)
        const yr = b.month.slice(2, 4)
        return (
          <g key={b.month} onClick={() => onSelectMonth && onSelectMonth(b.month)} style={{ cursor: onSelectMonth ? 'pointer' : 'default' }}>
            <rect x={x - 2} y={padding.top - 6} width={barW + 4} height={plotH + 6} fill={isSelected ? 'rgba(56,189,248,0.08)' : 'transparent'} />
            <rect
              x={x} y={y} width={barW} height={Math.max(1, barH)}
              fill={isLatestPartial ? 'rgba(56,189,248,0.35)' : (isSelected ? '#7dd3fc' : '#38bdf8')}
              stroke={isSelected ? '#fff' : (isLatestPartial ? '#38bdf8' : 'none')}
              strokeWidth={isSelected || isLatestPartial ? 1.5 : 0}
              strokeDasharray={isLatestPartial && !isSelected ? '4 3' : '0'}
            />
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" fill="#fff" fontSize="9.5" fontWeight="700" fontFamily="Space Mono">
              {toEok(b.total).toFixed(0)}
            </text>
            <text x={x + barW / 2} y={height - padding.bottom + 14} textAnchor="middle" fill={isSelected ? '#7dd3fc' : 'var(--t3)'} fontSize="9.5" fontWeight={isSelected ? '800' : '400'} fontFamily="Space Mono">
              {yr}.{m}{isLatestPartial ? '*' : ''}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

const REFRESH_MS = 5 * 60 * 1000 // 5분마다 백엔드 캐시 자동 재조회

export default function TradeStatsTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [flowType, setFlowType] = useState('export') // 'export' | 'import'
  const [breakdownType, setBreakdownType] = useState('item') // 'item' | 'country'
  const [selectedMonth, setSelectedMonth] = useState(null) // "YYYYMM" — 월별 상세보기에서 선택된 달 (null=최신 달)

  const load = useCallback(async (isInitial) => {
    if (isInitial) setLoading(true)
    try {
      const res = await fetch('/api/trade-stats')
      const json = await res.json()
      if (json.success) {
        setData(json)
        setError(null)
      } else {
        setError(json.error || '데이터를 불러올 수 없습니다.')
      }
    } catch (e) {
      setError('서버 연결 실패')
    } finally {
      if (isInitial) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(true)
    const interval = setInterval(() => load(false), REFRESH_MS)
    return () => clearInterval(interval)
  }, [load])

  if (loading) {
    return (
      <div style={{ background: 'var(--bg2)', borderRadius: 0, padding: '60px 24px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', color: 'var(--t3)' }}>
        관세청 10일 단위 수출입 잠정치 통계 로딩 중...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ background: 'var(--bg2)', borderRadius: 0, padding: '30px 24px', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--t2)', textAlign: 'center' }}>
        데이터를 불러오지 못했습니다 — {error || '알 수 없는 오류'}
      </div>
    )
  }

  const exportSummary = data.exportItem
  const importSummary = data.importItem
  const balance = (exportSummary?.latest?.total || 0) - (importSummary?.latest?.total || 0)
  const balancePrevMonth = exportSummary?.mom && importSummary?.mom
    ? exportSummary.mom.total - importSummary.mom.total
    : null

  const activeItemData = flowType === 'export' ? data.exportItem : data.importItem
  const activeCountryData = flowType === 'export' ? data.exportCountry : data.importCountry
  const activeBreakdown = breakdownType === 'item' ? activeItemData : activeCountryData

  const monthlyBars = buildMonthlyBars(activeBreakdown?.trend)
  const selectedIdx = monthlyBars.findIndex(b => b.month === selectedMonth)
  const selectedBar = selectedIdx >= 0 ? monthlyBars[selectedIdx] : monthlyBars[monthlyBars.length - 1]
  // 선택한 달이 아직 월말 통계가 안 나온 진행중인 달(예: 01~20)이면, 전달의 "완료된 전체 달"과
  // 비교하는 건 왜곡(진행중 vs 한 달 전체)이라 전달의 같은 구간(같은 01~20 등)을 찾아 비교한다.
  const prevSamePeriod = (() => {
    if (!selectedBar || !activeBreakdown?.trend) return null
    const y = parseInt(selectedBar.month.slice(0, 4), 10)
    const m = parseInt(selectedBar.month.slice(4, 6), 10)
    const prevDate = new Date(y, m - 2, 1)
    const prevMonth = `${prevDate.getFullYear()}${String(prevDate.getMonth() + 1).padStart(2, '0')}`
    const rangeType = selectedBar.periodRange.startsWith('01~1') ? '01~1' : (selectedBar.periodRange.startsWith('01~2') ? '01~2' : '01~3')
    return activeBreakdown.trend.find(t => t.month === prevMonth && t.periodRange.startsWith(rangeType)) || null
  })()
  const monthOverMonthPct = (selectedBar && prevSamePeriod && prevSamePeriod.total)
    ? Math.round(((selectedBar.total - prevSamePeriod.total) / prevSamePeriod.total) * 1000) / 10
    : null

  const updatedAtStr = data.updatedAt ? new Date(data.updatedAt).toLocaleString('ko-KR') : '-'

  return (
    <div>
      {/* ─── 헤더 배너 ─── */}
      <div style={{ background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderTop: '2px solid #38bdf8', padding: '16px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', marginBottom: 4 }}>🚢 수출입 동향 — 관세청 10일 단위 잠정치</div>
          <div style={{ fontSize: '.78rem', color: 'var(--t3)', lineHeight: 1.5 }}>
            공표 주기: 1~10일 통계는 11일, 1~20일 통계는 21일, 1~월말 통계는 익월 1일에 발표 · 기준: 수출입 신고 수리일 · 데이터: 공공데이터포털(관세청)
          </div>
        </div>
        <div style={{ fontSize: '.72rem', color: 'var(--t3)', textAlign: 'right' }}>
          최근 갱신: {updatedAtStr}<br />5분마다 자동 갱신
        </div>
      </div>

      {/* ─── 요약 카드 3종 ─── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 24 }}>
        <SummaryCard title="총수출" colorAccent="#ef4444" latest={exportSummary?.latest} mom={exportSummary?.mom} qoq={exportSummary?.qoq} yoy={exportSummary?.yoy} />
        <SummaryCard title="총수입" colorAccent="#3b82f6" latest={importSummary?.latest} mom={importSummary?.mom} qoq={importSummary?.qoq} yoy={importSummary?.yoy} />
        <div style={{ flex: '1 1 240px', minWidth: 240, background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderTop: `2px solid ${balance >= 0 ? '#34d399' : '#f59e0b'}`, padding: '16px 18px' }}>
          <div style={{ fontSize: '.78rem', color: 'var(--t3)', fontWeight: 700, marginBottom: 4 }}>무역수지 (수출 − 수입)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: balance >= 0 ? '#34d399' : '#f87171', fontFamily: 'Space Mono', marginBottom: 2 }}>
            {balance >= 0 ? '+' : ''}{fmtEok(balance)}
          </div>
          <div style={{ fontSize: '.72rem', color: 'var(--t3)', marginBottom: 12 }}>{fmtPeriodLabel(exportSummary?.latest)} 기준</div>
          <div style={{ fontSize: '.78rem', color: 'var(--t3)', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {balancePrevMonth === null ? '전월 비교 데이터 없음' : (
              <>전월 동기간: <strong style={{ color: balancePrevMonth >= 0 ? '#34d399' : '#f87171' }}>{balancePrevMonth >= 0 ? '+' : ''}{fmtEok(balancePrevMonth)}</strong></>
            )}
          </div>
        </div>
      </div>

      {/* ─── 월별 추이 + 상세보기 ─── */}
      <div style={{ background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 4 }}>
          <div style={{ fontSize: '.95rem', fontWeight: 800, color: '#fff' }}>
            {flowType === 'export' ? '수출' : '수입'} 월별 금액 추이 (억 달러)
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', padding: 3 }}>
              <button onClick={() => setFlowType('export')} style={{ padding: '6px 14px', background: flowType === 'export' ? 'var(--accent)' : 'transparent', border: 'none', borderRadius: 0, color: flowType === 'export' ? '#fff' : 'var(--t3)', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' }}>수출</button>
              <button onClick={() => setFlowType('import')} style={{ padding: '6px 14px', background: flowType === 'import' ? 'var(--accent)' : 'transparent', border: 'none', borderRadius: 0, color: flowType === 'import' ? '#fff' : 'var(--t3)', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' }}>수입</button>
            </div>
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', padding: 3 }}>
              <button onClick={() => setBreakdownType('item')} style={{ padding: '6px 14px', background: breakdownType === 'item' ? 'var(--accent)' : 'transparent', border: 'none', borderRadius: 0, color: breakdownType === 'item' ? '#fff' : 'var(--t3)', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' }}>품목별</button>
              <button onClick={() => setBreakdownType('country')} style={{ padding: '6px 14px', background: breakdownType === 'country' ? 'var(--accent)' : 'transparent', border: 'none', borderRadius: 0, color: breakdownType === 'country' ? '#fff' : 'var(--t3)', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' }}>국가별</button>
            </div>
          </div>
        </div>
        <div style={{ fontSize: '.74rem', color: 'var(--t3)', marginBottom: 14 }}>
          월별로 가장 최신 잠정치(월말 완료분은 월말 기준) · <span style={{ color: '#38bdf8' }}>*</span> 표시된 달은 아직 월말 통계가 나오지 않은 진행중인 달 · <strong style={{ color: 'var(--t2)' }}>막대를 클릭하면 그 달의 {breakdownType === 'item' ? '품목별' : '국가별'} 상세통계를 볼 수 있습니다</strong>
        </div>
        <MonthlyBarChart trend={activeBreakdown?.trend} selectedMonth={selectedBar?.month} onSelectMonth={setSelectedMonth} />

        {selectedBar && (
          <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              <div style={{ fontSize: '.9rem', fontWeight: 800, color: '#7dd3fc' }}>
                📌 {selectedBar.month.slice(0, 4)}년 {parseInt(selectedBar.month.slice(4, 6), 10)}월 ({selectedBar.periodRange}일 기준) {flowType === 'export' ? '수출' : '수입'} {breakdownType === 'item' ? '품목별' : '국가별'} 상세
              </div>
              <div style={{ fontSize: '.78rem', color: 'var(--t3)' }}>
                총액 <strong style={{ color: '#fff', fontFamily: 'Space Mono' }}>{fmtEok(selectedBar.total)}</strong>
                {monthOverMonthPct !== null && (
                  <span style={{ marginLeft: 10, color: monthOverMonthPct >= 0 ? '#ef4444' : '#3b82f6', fontWeight: 800 }}>
                    (전월 동기간 대비 {monthOverMonthPct >= 0 ? '▲' : '▼'} {Math.abs(monthOverMonthPct)}%)
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              <div style={{ flex: '2 1 380px', minWidth: 320 }}>
                <BarList items={selectedBar.breakdown} total={selectedBar.total} />
              </div>
              <div style={{ flex: '1 1 200px', minWidth: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DonutChart items={selectedBar.breakdown} total={selectedBar.total} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
