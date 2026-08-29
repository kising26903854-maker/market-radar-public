import React, { useState, useEffect, useMemo } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts'

export default function BaseRateChart() {
  const [rawData, setRawData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [period, setPeriod] = useState('all') // 'all' | '2000s' | '2020s' | '2y'
  const [isMobile, setIsMobile] = useState(false)

  // 화면 너비 감지 (반응형 폰트 조절용)
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // API 데이터 호출
  useEffect(() => {
    setLoading(true)
    fetch('/api/base-rates')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
        return res.json()
      })
      .then(res => {
        if (res.success) {
          setRawData(res.data)
        } else {
          setError(res.error || '데이터 로드 실패')
        }
      })
      .catch(err => {
        console.error("기준금리 로드 에러:", err)
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  // 기간 필터 적용
  const chartData = useMemo(() => {
    if (!rawData || rawData.length === 0) return []
    const sorted = [...rawData].sort((a, b) => a.date.localeCompare(b.date))
    switch (period) {
      case '2y':
        return sorted.slice(-24) // 최근 24개월
      case '2020s':
        return sorted.filter(d => d.date >= '2020-01-01')
      case '2000s':
        return sorted.filter(d => d.date >= '2000-01-01')
      case 'all':
      default:
        return sorted // 1970년부터 전체
    }
  }, [rawData, period])

  // 현재 최신 요약 데이터 추출
  const summary = useMemo(() => {
    if (!rawData || rawData.length === 0) return null
    const latest = rawData[rawData.length - 1]
    const gapStatus = latest.gap < 0 ? '역전 (미국 우위)' : '정상 (한국 우위)'
    const gapColor = latest.gap < 0 ? '#ef4444' : '#10b981'
    return {
      date: latest.date,
      krRate: latest.krRate,
      usRate: latest.usRate,
      gap: latest.gap,
      gapStatus,
      gapColor
    }
  }, [rawData])

  // 커스텀 툴팁
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1.5px solid var(--border)',
          padding: '12px 14px',
          borderRadius: 12,
          fontSize: '.85rem',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          color: 'var(--t1)'
        }}>
          <div style={{ fontWeight: 900, marginBottom: 8, color: 'var(--gold)' }}>📅 {label}</div>
          {payload.map((item, index) => (
            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, margin: '4px 0' }}>
              <span style={{ color: item.color || '#fff', fontWeight: 700 }}>
                {item.name === 'krRate' ? '🇰🇷 한국 기준금리' : item.name === 'usRate' ? '🇺🇸 미국 기준금리' : '📊 한미 금리차'}
              </span>
              <span style={{ fontFamily: 'Space Mono', fontWeight: 900 }}>
                {item.value.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  if (loading) return (
    <div style={{ background: 'var(--bg2)', padding: 30, borderRadius: 16, border: '1px solid var(--border)', textAlign: 'center', color: 'var(--t3)' }}>
      <div style={{ display: 'inline-block', width: 40, height: 40, border: '3.5px solid rgba(251,191,36,0.15)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 12 }} />
      <div style={{ fontSize: '1rem', fontWeight: 700 }}>한·미 기준금리 역사적 시계열 로딩 중...</div>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (error || !summary) return (
    <div style={{ background: 'var(--bg2)', padding: 30, borderRadius: 16, border: '1px solid var(--border)', textAlign: 'center', color: 'var(--t3)' }}>
      <div style={{ fontSize: '1.2rem', color: '#ef4444', marginBottom: 8 }}>⚠️ 오류 발생</div>
      <div>금리 데이터를 불러오지 못했습니다: {error || '데이터 없음'}</div>
    </div>
  )

  return (
    <div style={{ animation: 'fadeIn .3s ease' }}>
      {/* ─── 헤더 타이틀 & 필터 ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--t1)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            🏛️ 한·미 기준금리 역사적 추이 (1970 ~ 2026)
          </h2>
          <p style={{ fontSize: '.8rem', color: 'var(--t2)', margin: '4px 0 0 0' }}>
            미국 연방기금금리(FRED) 및 한국은행 기준금리 공시 데이터를 월별 매핑하여 갱신합니다.
          </p>
        </div>

        {/* 기간 필터 토글 */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: 3, borderRadius: 10, border: '1px solid var(--border)' }}>
          {[
            { id: 'all', label: '전체 (1970~)' },
            { id: '2000s', label: '2000년대~' },
            { id: '2020s', label: '2020년대~' },
            { id: '2y', label: '최근 2년' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              style={{
                padding: '6px 14px',
                background: period === p.id ? 'var(--accent)' : 'transparent',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: '.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'background .15s'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 요약 카드 섹션 ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {/* 한국 카드 */}
        <div style={{ background: 'var(--bg2)', padding: '16px 20px', borderRadius: 14, border: '1.5px solid rgba(16,185,129,0.35)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '.76rem', color: 'var(--t2)', fontWeight: 800 }}>🇰🇷 대한민국 기준금리</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
            <span style={{ fontSize: '1.9rem', fontWeight: 900, fontFamily: 'Space Mono', color: '#10b981' }}>{summary.krRate.toFixed(2)}%</span>
            <span style={{ fontSize: '.72rem', color: 'var(--t3)' }}>최근변동: 2026.08.27 인상</span>
          </div>
        </div>

        {/* 미국 카드 */}
        <div style={{ background: 'var(--bg2)', padding: '16px 20px', borderRadius: 14, border: '1.5px solid rgba(239,68,68,0.35)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '.76rem', color: 'var(--t2)', fontWeight: 800 }}>🇺🇸 미국 기준금리 (중앙값)</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
            <span style={{ fontSize: '1.9rem', fontWeight: 900, fontFamily: 'Space Mono', color: '#ef4444' }}>{summary.usRate.toFixed(2)}%</span>
            <span style={{ fontSize: '.72rem', color: 'var(--t3)' }}>타겟 밴드: 3.50% ~ 3.75%</span>
          </div>
        </div>

        {/* 격차/역전폭 카드 */}
        <div style={{ background: 'var(--bg2)', padding: '16px 20px', borderRadius: 14, border: `1.5px solid ${summary.gap < 0 ? 'rgba(244,63,94,0.35)' : 'rgba(59,130,246,0.35)'}`, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '.76rem', color: 'var(--t2)', fontWeight: 800 }}>📊 한·미 기준금리 격차 (역전폭)</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
            <span style={{ fontSize: '1.9rem', fontWeight: 900, fontFamily: 'Space Mono', color: summary.gapColor }}>{summary.gap >= 0 ? '+' : ''}{summary.gap.toFixed(2)}%p</span>
            <span style={{ fontSize: '.78rem', color: summary.gapColor, fontWeight: 900 }}>{summary.gapStatus}</span>
          </div>
        </div>
      </div>

      {/* ─── 차트 1: 한미 기준금리 라인 차트 ─── */}
      <div style={{ background: 'var(--bg2)', padding: '22px 24px', borderRadius: 16, border: '1px solid var(--border)', marginBottom: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--t1)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
          📈 한·미 기준금리 시계열 비교
        </h3>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                stroke="var(--t3)"
                fontSize={isMobile ? 11 : 12.5}
                fontWeight="700"
                tickFormatter={(val) => {
                  const parts = val.split('-');
                  return period === 'all' ? parts[0] : `${parts[0]}.${parts[1]}`;
                }}
              />
              <YAxis
                stroke="var(--t3)"
                fontSize={isMobile ? 11 : 12.5}
                fontWeight="700"
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '.8rem', fontWeight: 700 }} />
              <Line
                name="krRate"
                type="monotone"
                dataKey="krRate"
                stroke="#10b981"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6 }}
                style={{ filter: 'drop-shadow(0 0 4px rgba(16,185,129,0.3))' }}
              />
              <Line
                name="usRate"
                type="monotone"
                dataKey="usRate"
                stroke="#ef4444"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6 }}
                style={{ filter: 'drop-shadow(0 0 4px rgba(239,68,68,0.3))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ─── 차트 2: 금리차 Area 차트 ─── */}
      <div style={{ background: 'var(--bg2)', padding: '22px 24px', borderRadius: 16, border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--t1)', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
          📉 한·미 기준금리 스프레드 (한국 금리 - 미국 금리)
        </h3>
        <div style={{ width: '100%', height: 180 }}>
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gapGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                stroke="var(--t3)"
                fontSize={isMobile ? 11 : 12.5}
                fontWeight="700"
                tickFormatter={(val) => {
                  const parts = val.split('-');
                  return period === 'all' ? parts[0] : `${parts[0]}.${parts[1]}`;
                }}
              />
              <YAxis
                stroke="var(--t3)"
                fontSize={isMobile ? 11 : 12.5}
                fontWeight="700"
                tickFormatter={(val) => `${val}%p`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                name="gap"
                type="monotone"
                dataKey="gap"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#gapGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{ marginTop: 12, fontSize: '.74rem', color: 'var(--t3)', lineHeight: 1.5 }}>
          💡 **설명**: 한미 금리차가 **음수(-)** 영역으로 내려갈수록 미국의 금리가 한국보다 더 높은 **'금리 역전 현상'**이 강함을 의미합니다. 금리 역전 폭이 과도하게 커질 경우 외국인 자본 유출 압력과 원화 약세(환율 상승) 요인으로 작용합니다.
        </div>
      </div>
    </div>
  )
}
