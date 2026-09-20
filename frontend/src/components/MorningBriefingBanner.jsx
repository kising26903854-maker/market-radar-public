// MorningBriefingBanner.jsx — 🎙️ 매일 장전 08:35 AI 모닝 브리핑 헤드라인 배너
import React, { useState, useEffect } from 'react';

export default function MorningBriefingBanner() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const loadBriefing = () => {
    fetch('/api/morning-briefing')
      .then(res => res.json())
      .then(json => {
        if (json.success) setData(json);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBriefing();
    const timer = setInterval(loadBriefing, 60000); // 1분마다 자동 갱신
    return () => clearInterval(timer);
  }, []);

  if (!data || !data.headlines) return null;

  return (
    <div style={{
      marginBottom: 20,
      background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
      border: '1.5px solid rgba(234, 179, 8, 0.4)',
      borderRadius: 0,
      padding: '16px 20px',
      boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 상단 바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.3rem' }}>🎙️</span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '.98rem', fontWeight: 900, color: 'var(--gold)', letterSpacing: '-0.2px' }}>
                AI 모닝 장전 브리핑 (30초 핵심 요약)
              </span>
              <span style={{ fontSize: '.7rem', background: 'rgba(234,179,8,0.2)', color: 'var(--gold)', padding: '2px 8px', borderRadius: 0, fontWeight: 800, border: '1px solid rgba(234,179,8,0.4)' }}>
                {data.dateStr || '오늘'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              padding: '6px 12px',
              borderRadius: 0,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'var(--t1)',
              fontSize: '.78rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            {expanded ? '▲ 간략히 접기' : '▼ 3대 전략 상세 펼치기'}
          </button>
          <button
            onClick={loadBriefing}
            style={{
              padding: '6px 10px',
              borderRadius: 0,
              background: 'transparent',
              border: 'none',
              color: 'var(--t3)',
              fontSize: '.82rem',
              cursor: 'pointer'
            }}
            title="브리핑 새로고침"
          >
            🔄
          </button>
        </div>
      </div>

      {/* 헤드라인 3줄 카드 */}
      <div style={{
        marginTop: 12,
        display: 'grid',
        gridTemplateColumns: expanded ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 10
      }}>
        {data.headlines.map((item, idx) => (
          <div key={idx} style={{
            padding: '10px 14px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 0,
            borderLeft: idx === 0 ? '3.5px solid #10b981' : idx === 1 ? '3.5px solid #60a5fa' : '3.5px solid #fbbf24',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8
          }}>
            <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
            <div>
              <span style={{ fontSize: '.76rem', fontWeight: 900, color: idx === 0 ? '#34d399' : idx === 1 ? '#93c5fd' : '#fbbf24', marginRight: 6 }}>
                [{item.title}]
              </span>
              <span style={{ fontSize: '.84rem', color: 'var(--t1)', lineHeight: 1.5, fontWeight: 500 }}>
                {item.text}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
