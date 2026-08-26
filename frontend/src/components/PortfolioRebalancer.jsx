// PortfolioRebalancer.jsx — 포트폴리오 리밸런싱 AI 자동 가이드
import { useState, useMemo } from 'react'

export default function PortfolioRebalancer({ portfolioData }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const rebalanceAnalysis = useMemo(() => {
    if (!portfolioData?.positions || portfolioData.positions.length === 0) return null

    const positions = portfolioData.positions
    const totalValue = positions.reduce((sum, p) => sum + (p.current_value || 0), 0)
    if (totalValue === 0) return null

    // 각 종목의 현재 비중과 켈리 추천 비중 비교
    const items = positions.map(p => {
      const currentWeight = ((p.current_value || 0) / totalValue * 100).toFixed(1)
      
      // 켈리 추천 비중 산출 (퀀트 점수 기반)
      const score = p.quantScore || 70
      const halfKelly = Math.max(5, Math.min(25, (score - 50) / 100 * 50))
      const targetWeight = parseFloat(halfKelly.toFixed(1))

      const diff = parseFloat(currentWeight) - targetWeight
      const diffAbs = Math.abs(diff)

      let action = 'HOLD' // SELL, BUY, HOLD
      let actionLabel = '✅ 유지'
      let actionColor = '#94a3b8'
      let actionShares = 0
      let actionAmount = 0

      if (diff > 3) {
        // 비중 초과 → 일부 매도 권장
        action = 'SELL'
        const excessAmount = (diff / 100) * totalValue
        actionShares = Math.max(1, Math.round(excessAmount / (p.current_price || 1)))
        actionAmount = actionShares * (p.current_price || 0)
        actionLabel = `🔴 ${actionShares}주 매도 (비중 축소)`
        actionColor = '#ef4444'
      } else if (diff < -3) {
        // 비중 부족 → 추가 매수 권장
        action = 'BUY'
        const shortAmount = (Math.abs(diff) / 100) * totalValue
        actionShares = Math.max(1, Math.round(shortAmount / (p.current_price || 1)))
        actionAmount = actionShares * (p.current_price || 0)
        actionLabel = `🟢 ${actionShares}주 매수 (비중 확대)`
        actionColor = '#10b981'
      }

      return {
        name: p.name,
        code: p.code,
        currentPrice: p.current_price || 0,
        currentWeight: parseFloat(currentWeight),
        targetWeight,
        diff: parseFloat(diff.toFixed(1)),
        diffAbs: parseFloat(diffAbs.toFixed(1)),
        action,
        actionLabel,
        actionColor,
        actionShares,
        actionAmount,
        pnlPct: parseFloat(p.pnl_pct || 0),
        quantScore: p.quantScore
      }
    })

    // 리밸런싱 필요 여부 판단
    const needsRebalance = items.some(i => i.action !== 'HOLD')
    const sellItems = items.filter(i => i.action === 'SELL')
    const buyItems = items.filter(i => i.action === 'BUY')
    const holdItems = items.filter(i => i.action === 'HOLD')

    // 포트폴리오 건강도 점수 (비중 편차가 작을수록 높음)
    const avgDeviation = items.reduce((s, i) => s + i.diffAbs, 0) / items.length
    const healthScore = Math.max(0, Math.round(100 - avgDeviation * 5))
    
    let healthGrade, healthColor, healthBg
    if (healthScore >= 85) {
      healthGrade = 'A+ (매우 건강)'
      healthColor = '#10b981'
      healthBg = 'rgba(16,185,129,0.15)'
    } else if (healthScore >= 70) {
      healthGrade = 'B (양호)'
      healthColor = '#3b82f6'
      healthBg = 'rgba(59,130,246,0.15)'
    } else if (healthScore >= 50) {
      healthGrade = 'C (주의)'
      healthColor = '#f59e0b'
      healthBg = 'rgba(245,158,11,0.15)'
    } else {
      healthGrade = 'D (리밸런싱 필요)'
      healthColor = '#ef4444'
      healthBg = 'rgba(239,68,68,0.15)'
    }

    return {
      items,
      totalValue,
      needsRebalance,
      sellItems,
      buyItems,
      holdItems,
      healthScore,
      healthGrade,
      healthColor,
      healthBg
    }
  }, [portfolioData])

  if (!rebalanceAnalysis) return null

  const { items, totalValue, needsRebalance, sellItems, buyItems, holdItems, healthScore, healthGrade, healthColor, healthBg } = rebalanceAnalysis

  return (
    <div style={{
      marginTop: 28, marginBottom: 8,
      background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(16,185,129,0.08) 50%, rgba(234,179,8,0.08) 100%)',
      border: '1.5px solid rgba(99,102,241,0.4)',
      borderRadius: 20, padding: '22px 26px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)'
    }}>
      {/* 헤더 */}
      <div 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '1.5rem', filter: 'drop-shadow(0 0 8px rgba(99,102,241,0.5))' }}>🔄</span>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fff' }}>
              AI 포트폴리오 리밸런싱 가이드
            </div>
            <div style={{ fontSize: '.78rem', color: 'var(--t3)', marginTop: 2 }}>
              켈리 공식 기반 최적 비중 조절 · 총 자산 {totalValue.toLocaleString()}원
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* 건강도 뱃지 */}
          <div style={{
            padding: '6px 14px', borderRadius: 12, fontWeight: 900, fontSize: '.85rem',
            background: healthBg, color: healthColor,
            border: `1.5px solid ${healthColor}40`,
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '.65rem', fontWeight: 700, color: 'var(--t3)', marginBottom: 2 }}>포트폴리오 건강도</div>
            {healthScore}점 · {healthGrade}
          </div>

          {/* 리밸런싱 필요 여부 */}
          {needsRebalance ? (
            <span style={{
              padding: '5px 12px', borderRadius: 10, fontWeight: 800, fontSize: '.8rem',
              background: 'rgba(245,158,11,0.15)', color: '#fbbf24',
              border: '1px solid rgba(245,158,11,0.4)',
              animation: 'pulse 2s infinite'
            }}>⚠️ 리밸런싱 추천</span>
          ) : (
            <span style={{
              padding: '5px 12px', borderRadius: 10, fontWeight: 800, fontSize: '.8rem',
              background: 'rgba(16,185,129,0.15)', color: '#10b981',
              border: '1px solid rgba(16,185,129,0.4)'
            }}>✅ 균형 양호</span>
          )}

          <span style={{ color: 'var(--t3)', fontSize: '1.2rem', transition: 'transform .2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
        </div>
      </div>

      {/* 펼쳐지는 상세 패널 */}
      {isExpanded && (
        <div style={{ marginTop: 20, animation: 'fadeIn 0.3s ease-in-out' }}>

          {/* 비중 비교 바 차트 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '.85rem', fontWeight: 800, color: 'var(--t2)', marginBottom: 12 }}>📊 현재 비중 vs 목표 비중 (켈리 공식)</div>
            {items.map((item, idx) => (
              <div key={idx} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '.9rem', fontWeight: 800, color: '#fff' }}>{item.name}</span>
                    <span style={{ fontSize: '.7rem', color: 'var(--t3)', fontWeight: 600 }}>({item.code})</span>
                    {item.quantScore && (
                      <span style={{ fontSize: '.65rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 6px', borderRadius: 6, fontWeight: 800, border: '1px solid rgba(16,185,129,0.3)' }}>
                        종합 {item.quantScore}점
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '.85rem', fontWeight: 900, color: item.actionColor }}>{item.actionLabel}</span>
                </div>

                {/* 이중 바 */}
                <div style={{ position: 'relative', height: 22, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.05)' }}>
                  {/* 현재 비중 바 */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, height: '50%',
                    width: `${Math.min(100, item.currentWeight * 2)}%`,
                    background: item.pnlPct >= 0
                      ? 'linear-gradient(90deg, rgba(16,185,129,0.6), rgba(16,185,129,0.3))'
                      : 'linear-gradient(90deg, rgba(239,68,68,0.6), rgba(239,68,68,0.3))',
                    borderRadius: '6px 6px 0 0',
                    transition: 'width 0.5s ease'
                  }} />
                  {/* 목표 비중 바 */}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, height: '50%',
                    width: `${Math.min(100, item.targetWeight * 2)}%`,
                    background: 'linear-gradient(90deg, rgba(99,102,241,0.6), rgba(99,102,241,0.3))',
                    borderRadius: '0 0 6px 6px',
                    transition: 'width 0.5s ease'
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: '.7rem', color: 'var(--t3)' }}>
                  <span>현재 {item.currentWeight}%</span>
                  <span style={{ color: '#818cf8' }}>목표 {item.targetWeight}%</span>
                  <span style={{ color: item.diff > 0 ? '#ef4444' : item.diff < 0 ? '#10b981' : '#94a3b8' }}>
                    차이 {item.diff > 0 ? '+' : ''}{item.diff}%p
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* 액션 플랜 요약 */}
          {needsRebalance && (
            <div style={{
              padding: '16px 20px', borderRadius: 14,
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ fontSize: '.9rem', fontWeight: 900, color: '#fff', marginBottom: 12 }}>📋 리밸런싱 액션 플랜</div>

              {sellItems.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: '.78rem', color: '#ef4444', fontWeight: 800, marginBottom: 6 }}>🔴 비중 축소 (매도 추천)</div>
                  {sellItems.map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', background: 'rgba(239,68,68,0.08)',
                      borderRadius: 8, marginBottom: 4, border: '1px solid rgba(239,68,68,0.2)'
                    }}>
                      <span style={{ color: '#fca5a5', fontWeight: 700, fontSize: '.85rem' }}>
                        {item.name} — <strong>{item.actionShares}주 매도</strong>
                      </span>
                      <span style={{ color: 'var(--t3)', fontSize: '.78rem' }}>
                        약 {item.actionAmount.toLocaleString()}원 현금화
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {buyItems.length > 0 && (
                <div>
                  <div style={{ fontSize: '.78rem', color: '#10b981', fontWeight: 800, marginBottom: 6 }}>🟢 비중 확대 (매수 추천)</div>
                  {buyItems.map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', background: 'rgba(16,185,129,0.08)',
                      borderRadius: 8, marginBottom: 4, border: '1px solid rgba(16,185,129,0.2)'
                    }}>
                      <span style={{ color: '#6ee7b7', fontWeight: 700, fontSize: '.85rem' }}>
                        {item.name} — <strong>{item.actionShares}주 추가 매수</strong>
                      </span>
                      <span style={{ color: 'var(--t3)', fontSize: '.78rem' }}>
                        약 {item.actionAmount.toLocaleString()}원 필요
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 12, fontSize: '.72rem', color: 'var(--t3)', fontStyle: 'italic', lineHeight: 1.5 }}>
                💡 위 리밸런싱 가이드는 켈리 공식(Half-Kelly) 기반의 안전 비중을 기준으로 산출되었습니다. 
                실제 매매 결정 시에는 시장 상황, 세금, 수수료 등을 종합적으로 고려하세요.
              </div>
            </div>
          )}

          {!needsRebalance && (
            <div style={{
              padding: '16px 20px', borderRadius: 14,
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.3)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎯</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#10b981' }}>포트폴리오 비중이 균형 잡혀 있습니다!</div>
              <div style={{ fontSize: '.8rem', color: 'var(--t3)', marginTop: 4 }}>현재 비중과 켈리 공식 추천 비중의 차이가 ±3%p 이내로 안정적입니다.</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
