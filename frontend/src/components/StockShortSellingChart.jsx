// StockShortSellingChart.jsx — 📉 한국거래소(KRX) 공식 개별종목 공매도(Short Selling) 거래량·거래대금·비중(%) 인터랙티브 듀얼 차트
import React, { useState, useEffect, useMemo } from 'react';

export default function StockShortSellingChart({ stockCode, stockName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('3m'); // '1m' | '3m' | '6m'
  const [hoverIndex, setHoverIndex] = useState(null);
  const [showTable, setShowTable] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!stockCode) return;
    let isMounted = true;
    setLoading(true);

    fetch(`/api/stock-short-selling?code=${stockCode}&period=${period}`)
      .then(res => res.json())
      .then(json => {
        if (isMounted) {
          setData(json);
        }
      })
      .catch(err => {
        console.error('공매도 데이터 로드 오류:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [stockCode, period]);

  const timeline = useMemo(() => data?.timeline || [], [data]);
  const summary = data?.summary || {};

  // ─── SVG 듀얼 차트 좌표 계산 (좌측: 주가 vs 우측: 공매도 비중 %) ───
  const chartWidth = 780;
  const chartHeight = 280;
  const padding = { top: 35, right: 65, bottom: 40, left: 75 };
  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;

  const { priceMin, priceMax, ratioMax, pricePoints, ratioPoints, ratioArea, barItems } = useMemo(() => {
    if (timeline.length === 0) {
      return { priceMin: 0, priceMax: 0, ratioMax: 10, pricePoints: '', ratioPoints: '', ratioArea: '', barItems: [] };
    }

    const prices = timeline.map(t => t.closePrice).filter(p => p > 0);
    const ratios = timeline.map(t => t.shortRatio);
    const shortVols = timeline.map(t => t.shortVolume);

    const pMin = Math.min(...(prices.length ? prices : [1000])) * 0.96;
    const pMax = Math.max(...(prices.length ? prices : [2000])) * 1.04;
    const rMax = Math.max(10, Math.max(...ratios) * 1.18);
    const vMax = Math.max(1, Math.max(...shortVols));

    // 주가 라인 좌표 (Cyan)
    const pPts = timeline.map((t, idx) => {
      const x = padding.left + (idx / (timeline.length - 1 || 1)) * innerW;
      const y = padding.top + innerH - ((t.closePrice - pMin) / (pMax - pMin || 1)) * innerH;
      return { x, y };
    });

    // 공매도 비중 라인 좌표 (Red Glowing)
    const rPts = timeline.map((t, idx) => {
      const x = padding.left + (idx / (timeline.length - 1 || 1)) * innerW;
      const y = padding.top + innerH - ((t.shortRatio) / (rMax || 1)) * innerH;
      return { x, y };
    });

    const pPoints = pPts.map(p => `${p.x},${p.y}`).join(' ');
    const rPoints = rPts.map(p => `${p.x},${p.y}`).join(' ');
    const rArea = `${rPts[0]?.x},${padding.top + innerH} ${rPoints} ${rPts[rPts.length - 1]?.x},${padding.top + innerH}`;

    // 하단 공매도 거래량 바 좌표 (최대 높이 innerH의 35%)
    const barMaxH = innerH * 0.35;
    const barW = Math.max(2, (innerW / timeline.length) * 0.65);
    const bars = timeline.map((t, idx) => {
      const x = padding.left + (idx / (timeline.length - 1 || 1)) * innerW - barW / 2;
      const h = (t.shortVolume / vMax) * barMaxH;
      const y = padding.top + innerH - h;
      return { x, y, width: barW, height: h, isUptick: t.uptickVol > t.uptickExceptVol };
    });

    return {
      priceMin: pMin,
      priceMax: pMax,
      ratioMax: rMax,
      pricePoints: pPoints,
      ratioPoints: rPoints,
      ratioArea: rArea,
      barItems: bars
    };
  }, [timeline, innerW, innerH]);

  const activeItem = hoverIndex !== null && timeline[hoverIndex] ? timeline[hoverIndex] : null;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.85) 100%)',
      borderRadius: 18,
      border: '1.5px solid rgba(239, 68, 68, 0.4)',
      padding: '20px 22px',
      marginBottom: 22,
      boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
      animation: 'fadeIn 0.3s ease'
    }}>
      {/* ─── 1. 헤더 및 컨트롤 바 ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.25rem' }}>📉</span>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#f87171', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>한국거래소(KRX) 공식 공매도(Short Selling) 추이 분석</span>
              <span style={{ fontSize: '.74rem', background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid #ef4444', padding: '2px 8px', borderRadius: 6, fontWeight: 900 }}>
                KRX 공식 공시
              </span>
            </div>
            <div style={{ fontSize: '.78rem', color: 'var(--t3)', marginTop: 2 }}>
              {stockName} ({stockCode}) · 일별 공매도 거래량 & 거래대금 & 공매도 비중(%) 정밀 추적
            </div>
          </div>
        </div>

        {/* 기간 전환 버튼 */}
        <div style={{ display: 'flex', gap: 6, background: 'rgba(0,0,0,0.4)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)' }}>
          {[
            { id: '1m', label: '1개월' },
            { id: '3m', label: '3개월' },
            { id: '6m', label: '6개월' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setPeriod(tab.id)}
              style={{
                padding: '5px 12px',
                borderRadius: 7,
                border: 'none',
                background: period === tab.id ? '#ef4444' : 'transparent',
                color: period === tab.id ? '#fff' : 'var(--t3)',
                fontSize: '.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 2. 공매도 4대 핵심 지표 카드 그리드 ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 18 }}>
        {/* 카드 1: 최근 5일 평균 공매도 비중 */}
        <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '.74rem', color: 'var(--t3)', fontWeight: 800 }}>최근 5일 평균 공매도 비중</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: summary.isDecreasing ? '#34d399' : (summary.avgRecentShortRatio >= 10 ? '#f87171' : '#38bdf8'), marginTop: 4, fontFamily: 'Space Mono' }}>
            {summary.avgRecentShortRatio || 0}%
          </div>
          <div style={{ fontSize: '.72rem', color: 'var(--t2)', marginTop: 2 }}>
            최신 거래일: <strong style={{ color: summary.isDecreasing ? '#34d399' : '#f87171' }}>{summary.latestShortRatio || 0}%</strong>
          </div>
        </div>

        {/* 카드 2: 공매도 과열 진단 배지 및 실시간 추세 */}
        <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '.74rem', color: 'var(--t3)', fontWeight: 800 }}>공매도 추세 및 과열 진단</div>
          <div style={{ fontSize: '.95rem', fontWeight: 900, color: '#fff', marginTop: 6 }}>
            <span style={{
              padding: '3px 9px',
              borderRadius: 6,
              fontSize: '.78rem',
              fontWeight: 900,
              background: summary.overheatStatus === 'OVERHEAT' ? 'rgba(239,68,68,0.25)' : summary.overheatStatus === 'CAUTION' ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)',
              color: summary.overheatStatus === 'OVERHEAT' ? '#f87171' : summary.overheatStatus === 'CAUTION' ? '#fbbf24' : '#34d399',
              border: `1px solid ${summary.overheatStatus === 'OVERHEAT' ? '#ef4444' : summary.overheatStatus === 'CAUTION' ? '#f59e0b' : '#10b981'}`
            }}>
              {summary.overheatLabel || '🟢 안정'}
            </span>
          </div>
          <div style={{ fontSize: '.72rem', color: summary.trendColor || 'var(--t2)', marginTop: 5, fontWeight: 700 }}>
            {summary.trendLabel || '하방 압력 모니터링'}
          </div>
        </div>

        {/* 카드 3: 누적 공매도 거래대금 */}
        <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '.74rem', color: 'var(--t3)', fontWeight: 800 }}>기간 누적 공매도 대금</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--gold)', marginTop: 4, fontFamily: 'Space Mono' }}>
            {(summary.totalShortValueIn100M || 0).toLocaleString()}억원
          </div>
          <div style={{ fontSize: '.72rem', color: 'var(--t2)', marginTop: 2 }}>
            총 {(summary.totalShortVolume || 0).toLocaleString()}주 체결
          </div>
        </div>

        {/* 카드 4: 최고 공매도 집중일 */}
        <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '.74rem', color: 'var(--t3)', fontWeight: 800 }}>최고 공매도 집중일</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f87171', marginTop: 4, fontFamily: 'Space Mono' }}>
            {summary.maxRatioDay || '-'}
          </div>
          <div style={{ fontSize: '.72rem', color: 'var(--t2)', marginTop: 2 }}>
            최대 비중: <strong style={{ color: '#ef4444' }}>{summary.maxRatio || 0}%</strong>
          </div>
        </div>
      </div>

      {/* ─── 3. 진단 브리핑 박스 ─── */}
      {(() => {
        const st = summary.overheatStatus;
        const borderColor =
          st === 'SHRINKING' ? '#10b981' :
          st === 'STABILIZING' ? '#34d399' :
          st === 'OVERHEAT' ? '#ef4444' :
          st === 'CAUTION' ? '#f59e0b' :
          '#94a3b8';
        const icon =
          st === 'SHRINKING' ? '📉' :
          st === 'STABILIZING' ? '📊' :
          st === 'OVERHEAT' ? '🚨' :
          st === 'CAUTION' ? '⚠️' :
          '💡';
        return (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(0,0,0,0.35)',
            borderRadius: 12,
            borderLeft: `4px solid ${borderColor}`,
            marginBottom: 16,
            fontSize: '.85rem',
            color: '#f1f5f9',
            lineHeight: 1.6
          }}>
            {icon} <strong>퀀트 진단:</strong> {summary.overheatDesc || '공매도 비중이 안정적인 범위 내에서 유지되고 있습니다.'}
          </div>
        );
      })()}

      {/* ─── 4. 인터랙티브 SVG 듀얼 차트 (주가 vs 공매도 비중 % + 하단 거래량 바) ─── */}
      <div style={{
        position: 'relative',
        background: '#070a13',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)'
      }}>
        {/* 차트 상단 범례(Legend) 및 Hover HUD */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(15,23,42,0.6)',
          flexWrap: 'wrap',
          gap: 8
        }}>
          {/* 범례 */}
          <div style={{ display: 'flex', gap: 14, fontSize: '.78rem', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#38bdf8', fontWeight: 800 }}>
              <span style={{ width: 10, height: 3, background: '#38bdf8', borderRadius: 2 }} />
              종목 주가 (좌측축, 원)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#f87171', fontWeight: 800 }}>
              <span style={{ width: 10, height: 3, background: '#ef4444', borderRadius: 2 }} />
              공매도 거래 비중 (우측축, %)
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#c084fc', fontWeight: 700 }}>
              <span style={{ width: 6, height: 8, background: 'rgba(192,132,252,0.6)', borderRadius: 1 }} />
              일별 공매도량
            </span>
          </div>

          {/* Hover HUD 텍스트 */}
          <div style={{ fontSize: '.78rem', color: '#fff', fontFamily: 'Space Mono' }}>
            {activeItem ? (
              <span>
                <strong style={{ color: 'var(--gold)' }}>[{activeItem.date}]</strong> 주가: <strong style={{ color: '#38bdf8' }}>{activeItem.closePrice.toLocaleString()}원</strong> · 공매도량: <strong style={{ color: '#c084fc' }}>{activeItem.shortVolume.toLocaleString()}주</strong> · 비중: <strong style={{ color: '#f87171' }}>{activeItem.shortRatio}%</strong>
              </span>
            ) : (
              <span style={{ color: 'var(--t3)' }}>마우스를 올리면 해당 일자의 상세 공매도량이 표시됩니다</span>
            )}
          </div>
        </div>

        {/* 차트 본체 */}
        {loading ? (
          <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--t3)', fontSize: '.9rem' }}>
            ⏳ 한국거래소(KRX) 공매도 시계열 데이터 수집 중...
          </div>
        ) : data && !data.success ? (
          <div style={{ padding: '80px 0 60px', textAlign: 'center', color: '#f87171', fontSize: '.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.8rem' }}>⚠️</span>
            <div style={{ fontWeight: 800 }}>공매도 데이터를 불러오지 못했습니다.</div>
            <div style={{ fontSize: '.85rem', color: '#cbd5e1', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 16px', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.3)' }}>{data.error || '알 수 없는 이유로 거래소 데이터 연결에 실패했습니다.'}</div>
          </div>
        ) : timeline.length === 0 ? (
          <div style={{ padding: '80px 0', textAlign: 'center', color: 'var(--t3)', fontSize: '.9rem' }}>
            해당 기간에 조회된 공매도 내역이 없습니다.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            style={{ width: '100%', height: 280, display: 'block' }}
            onMouseLeave={() => setHoverIndex(null)}
          >
            <defs>
              <linearGradient id="shortRatioGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity="0.38" />
                <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* 배경 가로 눈금선 */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = padding.top + ratio * innerH;
              const pVal = Math.round(priceMax - ratio * (priceMax - priceMin));
              const rVal = (ratioMax - ratio * ratioMax).toFixed(1);
              return (
                <g key={i}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={padding.left + innerW}
                    y2={y}
                    stroke="rgba(255,255,255,0.06)"
                    strokeDasharray={ratio === 0 || ratio === 1 ? 'none' : '3 3'}
                  />
                  {/* 좌측 Y축 라벨 (주가) */}
                  <text
                    x={padding.left - 8}
                    y={y + 4}
                    fill="#38bdf8"
                    fontSize={isMobile ? "13.5" : "9.5"}
                    fontFamily="Space Mono"
                    textAnchor="end"
                    fontWeight="700"
                  >
                    {pVal.toLocaleString()}
                  </text>
                  {/* 우측 Y축 라벨 (공매도 비중 %) */}
                  <text
                    x={padding.left + innerW + 8}
                    y={y + 4}
                    fill="#f87171"
                    fontSize={isMobile ? "13.5" : "9.5"}
                    fontFamily="Space Mono"
                    textAnchor="start"
                    fontWeight="700"
                  >
                    {rVal}%
                  </text>
                </g>
              );
            })}

            {/* 1. 하단 일별 공매도 거래량 바 (Bars) */}
            {barItems.map((b, idx) => (
              <rect
                key={idx}
                x={b.x}
                y={b.y}
                width={b.width}
                height={Math.max(1, b.height)}
                fill={idx === hoverIndex ? '#ef4444' : 'rgba(192, 132, 252, 0.55)'}
                rx={1}
              />
            ))}

            {/* 2. 공매도 비중 영역 (Red Fill) */}
            <polygon
              points={ratioArea}
              fill="url(#shortRatioGrad)"
            />

            {/* 3. 공매도 비중 라인 (Red Line) */}
            <polyline
              fill="none"
              stroke="#ef4444"
              strokeWidth="2.2"
              points={ratioPoints}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="drop-shadow(0 0 6px rgba(239, 68, 68, 0.7))"
            />

            {/* 4. 종목 주가 라인 (Cyan Line) */}
            <polyline
              fill="none"
              stroke="#38bdf8"
              strokeWidth="2.2"
              points={pricePoints}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="drop-shadow(0 0 6px rgba(56, 189, 248, 0.6))"
            />

            {/* X축 날짜 라벨 */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const idx = Math.min(timeline.length - 1, Math.round((timeline.length - 1) * ratio));
              const item = timeline[idx];
              if (!item) return null;
              const x = padding.left + ratio * innerW;
              return (
                <text
                  key={i}
                  x={x}
                  y={padding.top + innerH + 22}
                  fill="var(--t3)"
                  fontSize={isMobile ? "13" : "10"}
                  fontFamily="Space Mono"
                  textAnchor="middle"
                >
                  {item.date.substring(5)}
                </text>
              );
            })}

            {/* 마우스 호버 가이드라인 & 포인트 */}
            {hoverIndex !== null && timeline[hoverIndex] && (() => {
              const item = timeline[hoverIndex];
              const x = padding.left + (hoverIndex / (timeline.length - 1 || 1)) * innerW;
              const yP = padding.top + innerH - ((item.closePrice - priceMin) / (priceMax - priceMin || 1)) * innerH;
              const yR = padding.top + innerH - ((item.shortRatio) / (ratioMax || 1)) * innerH;

              return (
                <g>
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={padding.top + innerH}
                    stroke="#ffffff"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  <circle cx={x} cy={yP} r="4.5" fill="#38bdf8" stroke="#fff" strokeWidth="2" />
                  <circle cx={x} cy={yR} r="4.5" fill="#ef4444" stroke="#fff" strokeWidth="2" />
                </g>
              );
            })()}

            {/* 마우스 인터랙션 감지 바 */}
            {timeline.map((_, idx) => {
              const barWidth = innerW / timeline.length;
              const x = padding.left + idx * barWidth;
              return (
                <rect
                  key={idx}
                  x={x}
                  y={padding.top}
                  width={barWidth}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(idx)}
                  style={{ cursor: 'crosshair' }}
                />
              );
            })}
          </svg>
        )}
      </div>

      {/* ─── 5. 최근 일별 상세 데이터 테이블 토글 ─── */}
      <div style={{ marginTop: 14 }}>
        <button
          onClick={() => setShowTable(!showTable)}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'var(--t2)',
            borderRadius: 8,
            padding: '7px 14px',
            fontSize: '.8rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span>{showTable ? '▲' : '▼'}</span>
          <span>{showTable ? '일별 공매도 세부 내역 접기' : `최근 ${timeline.length}거래일 공매도 세부 내역 테이블 보기`}</span>
        </button>

        {showTable && (
          <div style={{
            marginTop: 10,
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)',
            maxHeight: 280,
            overflowY: 'auto'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '.8rem' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.5)', color: 'var(--t3)', borderBottom: '1px solid rgba(255,255,255,0.08)', position: 'sticky', top: 0, zIndex: 5 }}>
                  <th style={{ padding: '8px 12px' }}>거래일자</th>
                  <th style={{ padding: '8px 12px' }}>종가</th>
                  <th style={{ padding: '8px 12px' }}>공매도 거래량</th>
                  <th style={{ padding: '8px 12px' }}>공매도 거래대금</th>
                  <th style={{ padding: '8px 12px' }}>공매도 비중(%)</th>
                  <th style={{ padding: '8px 12px' }}>업틱룰 예외량</th>
                </tr>
              </thead>
              <tbody>
                {[...timeline].reverse().map((row, idx) => (
                  <tr key={idx} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: idx % 2 === 0 ? 'rgba(0,0,0,0.2)' : 'transparent'
                  }}>
                    <td style={{ padding: '8px 12px', fontFamily: 'Space Mono', color: 'var(--t2)' }}>
                      {row.date}
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'Space Mono', fontWeight: 800, color: '#38bdf8' }}>
                      {row.closePrice.toLocaleString()}원
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'Space Mono', fontWeight: 800, color: '#c084fc' }}>
                      {row.shortVolume.toLocaleString()}주
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'Space Mono', color: 'var(--gold)' }}>
                      {Math.round(row.shortValue / 100000000).toLocaleString()}억원
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'Space Mono', fontWeight: 900, color: row.shortRatio >= 10 ? '#ef4444' : '#f87171' }}>
                      {row.shortRatio}%
                    </td>
                    <td style={{ padding: '8px 12px', fontFamily: 'Space Mono', color: 'var(--t3)' }}>
                      {row.uptickExceptVol.toLocaleString()}주
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
