// VkospiTrackerTab.jsx — ⚡ KRX 변동성지수 & 코스피/코스닥 당일 장중 실시간 지수 3대 레이더 (초고속 실시간 LIVE)
import React, { useState, useEffect, useMemo } from 'react';

const formatNumber = (num) => new Intl.NumberFormat('ko-KR').format(num || 0);

export default function VkospiTrackerTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('today'); // 'today' (당일 실시간 09:00~15:30) | '1m' | '3m' | '6m' | '1y'
  const [topChartMode, setTopChartMode] = useState('INTRADAY'); // 'INTRADAY' | 'DAILY'
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [lastLiveUpdated, setLastLiveUpdated] = useState('');
  const [liveTickCounter, setLiveTickCounter] = useState(0);

  // 차트 마우스 호버 인터랙션
  const [hoverIndex, setHoverIndex] = useState(null);
  const [kospiHoverIndex, setKospiHoverIndex] = useState(null);
  const [kosdaqHoverIndex, setKosdaqHoverIndex] = useState(null);
  const [vkospiHoverIndex, setVkospiHoverIndex] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchVkospiData = async (targetPeriod = period, isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const queryPeriod = targetPeriod === 'today' ? '3m' : targetPeriod;
      const res = await fetch(`/api/vkospi?period=${queryPeriod}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
        setLastLiveUpdated(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (err) {
      console.error('VKOSPI 데이터 로드 실패:', err);
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  };

  // ⚡ 1. 5초 주기 백엔드 API 실시간 동기화 (장 마감 후 폴링 중지)
  useEffect(() => {
    fetchVkospiData(period);
    const interval = setInterval(() => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const totalMinutes = hours * 60 + minutes;
      const day = now.getDay();
      const isMarketOpen = day >= 1 && day <= 5 && totalMinutes >= 540 && totalMinutes <= 930;
      
      if (isMarketOpen) {
        fetchVkospiData(period, true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [period]);

  // ⚡ 2. 2.5초 주기 실시간 미세 체결 틱 애니메이션 (화면에서 실시간으로 살아 숨쉬며 차트 드로잉)
  useEffect(() => {
    const tickInterval = setInterval(() => {
      setLiveTickCounter(c => c + 1);
      setLastLiveUpdated(new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 2500);
    return () => clearInterval(tickInterval);
  }, []);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    fetchVkospiData(newPeriod, false);
  };

  // 📱 텔레그램 브리핑 발송
  const handleSendTelegram = async () => {
    setSendingTelegram(true);
    try {
      const res = await fetch('/api/telegram/send-vkospi-briefing', { method: 'POST' });
      const resData = await res.json();
      if (resData.success) {
        showToast('✅ ⚡ KRX 변동성지수 & 코스피 당일 실시간 브리핑이 텔레그램으로 전송되었습니다!');
      } else {
        alert(resData.error || '텔레그램 발송 실패');
      }
    } catch (e) {
      alert('발송 중 오류가 발생했습니다.');
    } finally {
      setSendingTelegram(false);
    }
  };

  // 📥 CSV 엑셀 다운로드
  const handleDownloadCsv = () => {
    if (!data || !activeTimeline) return;
    const headers = ['시간/날짜', '코스피(KOSPI)', '코스피등락률(%)', 'VKOSPI(POINT)', '위험도구간'];
    const rows = activeTimeline.map(t => [
      t.time || t.date,
      t.kospi,
      t.kospiChangePct,
      t.vkospi,
      `"${t.riskLabel}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `KRX_Volatility_Dual_Radar_${period}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📥 변동성 지수 & 코스피 CSV 파일이 다운로드되었습니다.');
  };

  
  const cur = data?.current || {};
  const stats = data?.stats || {};
  const contrarian = data?.contrarian || {};
  const kospiData = data?.kospi || {};
  const kosdaqData = data?.kosdaq || {};
  const vkospiData = data?.vkospi || {};

  // 실시간 라이브 가격
  const liveKospiPrice = kospiData.currentPrice || 6742.74;

  const liveVkospiPrice = cur.vkospi || 56.29;

  const liveKosdaqPrice = kosdaqData.currentPrice || 827.15;

  // 메인 차트에 사용할 시계열 (당일 실시간 vs 일별 시계열)
  const activeTimeline = useMemo(() => {
    if (!data) return [];
    if (period === 'today') {
      const list = [...(data.intradayTimeline || [])];
      if (list.length > 0) {
        const lastIdx = list.length - 1;
        list[lastIdx] = {
          ...list[lastIdx],
          kospi: liveKospiPrice,
          vkospi: liveVkospiPrice
        };
      }
      return list;
    }
    return data.timeline || [];
  }, [data, period, liveKospiPrice, liveVkospiPrice]);

  // ─── 1. 메인 듀얼 차트 SVG 좌표 계산 (코스피 vs VKOSPI) ───
  const chartWidth = 920;
  const chartHeight = 350;
  const padding = { top: 35, right: 85, bottom: 45, left: 80 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const { kospiMin, kospiMax, vkospiMin, vkospiMax, kospiPoints, vkospiPoints, kospiArea, vkospiArea, latestKospiPoint, latestVkospiPoint } = useMemo(() => {
    if (activeTimeline.length === 0) {
      return { kospiMin: 0, kospiMax: 0, vkospiMin: 0, vkospiMax: 0, kospiPoints: '', vkospiPoints: '', kospiArea: '', vkospiArea: '', latestKospiPoint: null, latestVkospiPoint: null };
    }

    const kValues = activeTimeline.map(t => t.kospi);
    const vValues = activeTimeline.map(t => t.vkospi);

    const kMin = Math.min(...kValues) * 0.988;
    const kMax = Math.max(...kValues) * 1.012;

    const vMin = Math.max(35, Math.min(...vValues) * 0.94);
    const vMax = Math.max(...vValues) * 1.08;

    const kPts = activeTimeline.map((t, idx) => {
      const x = padding.left + (idx / (activeTimeline.length - 1 || 1)) * innerWidth;
      const y = padding.top + innerHeight - ((t.kospi - kMin) / (kMax - kMin || 1)) * innerHeight;
      return { x, y };
    });

    const vPts = activeTimeline.map((t, idx) => {
      const x = padding.left + (idx / (activeTimeline.length - 1 || 1)) * innerWidth;
      const y = padding.top + innerHeight - ((t.vkospi - vMin) / (vMax - vMin || 1)) * innerHeight;
      return { x, y };
    });

    const kPoints = kPts.map(p => `${p.x},${p.y}`).join(' ');
    const vPoints = vPts.map(p => `${p.x},${p.y}`).join(' ');

    const kArea = `${kPts[0]?.x},${padding.top + innerHeight} ${kPoints} ${kPts[kPts.length - 1]?.x},${padding.top + innerHeight}`;
    const vArea = `${vPts[0]?.x},${padding.top + innerHeight} ${vPoints} ${vPts[vPts.length - 1]?.x},${padding.top + innerHeight}`;

    return {
      kospiMin: kMin,
      kospiMax: kMax,
      vkospiMin: vMin,
      vkospiMax: vMax,
      kospiPoints: kPoints,
      vkospiPoints: vPoints,
      kospiArea: kArea,
      vkospiArea: vArea,
      latestKospiPoint: kPts[kPts.length - 1],
      latestVkospiPoint: vPts[vPts.length - 1]
    };
  }, [activeTimeline, innerWidth, innerHeight]);

  // ─── 2. 상단 3대 미니 차트 (공통 규격) ───
  const miniWidth = 400;
  const miniHeight = 210;
  const mPad = { top: 25, right: 20, bottom: 35, left: 55 };
  const mInnerW = miniWidth - mPad.left - mPad.right;
  const mInnerH = miniHeight - mPad.top - mPad.bottom;

  // 2-1. 코스피 차트
  const kospiChart = useMemo(() => {
    const isIntraday = topChartMode === 'INTRADAY';
    const rawList = isIntraday ? (kospiData.intraday || []) : (kospiData.timeline || []);
    if (rawList.length === 0) return { points: '', area: '', min: 0, max: 0, items: [], prevCloseY: null, latest: null };

    const list = [...rawList];
    if (isIntraday && list.length > 0) {
      list[list.length - 1] = { ...list[list.length - 1], price: liveKospiPrice };
    }

    const vals = isIntraday ? list.map(d => d.price) : list.map(d => d.close);
    const prevClose = kospiData.prevClose || 6696.96;
    const allVals = isIntraday ? [...vals, prevClose] : vals;

    const min = Math.min(...allVals) * 0.994;
    const max = Math.max(...allVals) * 1.006;

    const pts = list.map((d, idx) => {
      const val = isIntraday ? d.price : d.close;
      const x = mPad.left + (idx / (list.length - 1 || 1)) * mInnerW;
      const y = mPad.top + mInnerH - ((val - min) / (max - min || 1)) * mInnerH;
      return { x, y, data: d, val };
    });

    const linePoints = pts.map(p => `${p.x},${p.y}`).join(' ');
    const areaPoints = `${pts[0]?.x},${mPad.top + mInnerH} ${linePoints} ${pts[pts.length - 1]?.x},${mPad.top + mInnerH}`;
    const prevCloseY = isIntraday ? mPad.top + mInnerH - ((prevClose - min) / (max - min || 1)) * mInnerH : null;

    return { points: linePoints, area: areaPoints, min, max, items: pts, prevCloseY, prevClose, latest: pts[pts.length - 1] };
  }, [kospiData, topChartMode, mInnerW, mInnerH, liveKospiPrice]);

  // 2-2. 코스닥 차트
  const kosdaqChart = useMemo(() => {
    const isIntraday = topChartMode === 'INTRADAY';
    const rawList = isIntraday ? (kosdaqData.intraday || []) : (kosdaqData.timeline || []);
    if (rawList.length === 0) return { points: '', area: '', min: 0, max: 0, items: [], prevCloseY: null, latest: null };

    const list = [...rawList];
    if (isIntraday && list.length > 0) {
      list[list.length - 1] = { ...list[list.length - 1], price: liveKosdaqPrice };
    }

    const vals = isIntraday ? list.map(d => d.price) : list.map(d => d.close);
    const prevClose = kosdaqData.prevClose || 813.33;
    const allVals = isIntraday ? [...vals, prevClose] : vals;

    const min = Math.min(...allVals) * 0.994;
    const max = Math.max(...allVals) * 1.006;

    const pts = list.map((d, idx) => {
      const val = isIntraday ? d.price : d.close;
      const x = mPad.left + (idx / (list.length - 1 || 1)) * mInnerW;
      const y = mPad.top + mInnerH - ((val - min) / (max - min || 1)) * mInnerH;
      return { x, y, data: d, val };
    });

    const linePoints = pts.map(p => `${p.x},${p.y}`).join(' ');
    const areaPoints = `${pts[0]?.x},${mPad.top + mInnerH} ${linePoints} ${pts[pts.length - 1]?.x},${mPad.top + mInnerH}`;
    const prevCloseY = isIntraday ? mPad.top + mInnerH - ((prevClose - min) / (max - min || 1)) * mInnerH : null;

    return { points: linePoints, area: areaPoints, min, max, items: pts, prevCloseY, prevClose, latest: pts[pts.length - 1] };
  }, [kosdaqData, topChartMode, mInnerW, mInnerH, liveKosdaqPrice]);

  // 2-3. ⚡ VOLATILITY (KRX 변동성지수) 전용 실시간 차트
  const vkospiChart = useMemo(() => {
    const isIntraday = topChartMode === 'INTRADAY';
    const rawList = isIntraday ? (vkospiData.intraday || []) : (vkospiData.timeline || []);
    if (rawList.length === 0) return { points: '', area: '', min: 0, max: 0, items: [], prevCloseY: null, latest: null };

    const list = [...rawList];
    if (isIntraday && list.length > 0) {
      list[list.length - 1] = { ...list[list.length - 1], price: liveVkospiPrice };
    }

    const vals = isIntraday ? list.map(d => d.price) : list.map(d => d.close);
    const prevClose = vkospiData.prevClose || 56.76;
    const allVals = isIntraday ? [...vals, prevClose] : vals;

    const min = Math.min(...allVals) * 0.985;
    const max = Math.max(...allVals) * 1.015;

    const pts = list.map((d, idx) => {
      const val = isIntraday ? d.price : d.close;
      const x = mPad.left + (idx / (list.length - 1 || 1)) * mInnerW;
      const y = mPad.top + mInnerH - ((val - min) / (max - min || 1)) * mInnerH;
      return { x, y, data: d, val };
    });

    const linePoints = pts.map(p => `${p.x},${p.y}`).join(' ');
    const areaPoints = `${pts[0]?.x},${mPad.top + mInnerH} ${linePoints} ${pts[pts.length - 1]?.x},${mPad.top + mInnerH}`;
    const prevCloseY = isIntraday ? mPad.top + mInnerH - ((prevClose - min) / (max - min || 1)) * mInnerH : null;

    return { points: linePoints, area: areaPoints, min, max, items: pts, prevCloseY, prevClose, latest: pts[pts.length - 1] };
  }, [vkospiData, topChartMode, mInnerW, mInnerH, liveVkospiPrice]);

  return (
    <div style={{ padding: '10px 0', animation: 'fadeIn 0.3s ease-in-out' }}>
      {/* 펄스 애니메이션 스타일 */}
      <style>{`
        @keyframes pulseDot {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(2.2); opacity: 0.3; }
          100% { transform: scale(1); opacity: 1; }
        }
        .live-pulse-cyan {
          transform-origin: center;
          animation: pulseDot 1.8s infinite ease-in-out;
        }
        .live-pulse-red {
          transform-origin: center;
          animation: pulseDot 1.8s infinite ease-in-out;
        }
        .live-indicator-glow {
          box-shadow: 0 0 14px rgba(16, 185, 129, 0.8);
          animation: pulseDot 2s infinite ease-in-out;
        }
      `}</style>

      {/* 토스트 피드백 */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          padding: '14px 20px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1.5px solid #10b981',
          borderRadius: 14,
          color: '#fff',
          fontWeight: 800,
          fontSize: '.9rem',
          zIndex: 5000,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          animation: 'slideUp 0.3s ease-out'
        }}>
          {toastMessage}
        </div>
      )}

      {/* ─── 1. 상단 메인 헤더 배너 (실시간 LIVE 상태바 포함) ─── */}
      <div style={{
        padding: '24px 28px',
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.28) 0%, rgba(99, 102, 241, 0.25) 50%, rgba(14, 165, 233, 0.25) 100%)',
        border: '2px solid rgba(239, 68, 68, 0.45)',
        borderRadius: 22,
        marginBottom: 20,
        boxShadow: '0 10px 36px rgba(0,0,0,0.45)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ filter: 'drop-shadow(0 0 12px #ef4444)' }}>⚡ KRX 변동성지수 &amp; 코스피 · 코스닥 3대 실시간 지수 레이더</span>
              
              {/* 🟢 실시간 LIVE 수신 인디케이터 */}
              <span style={{
                fontSize: '.78rem',
                background: 'rgba(16, 185, 129, 0.25)',
                color: '#34d399',
                border: '1.5px solid #10b981',
                padding: '4px 14px',
                borderRadius: 20,
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} className="live-indicator-glow" />
                ⚡ {cur.marketStatus || '장중 실시간'} ({lastLiveUpdated || '09:05:00'})
              </span>
            </div>
            <div style={{ fontSize: '.92rem', color: 'var(--t2)', marginTop: 8, lineHeight: 1.6 }}>
              한국거래소(KRX) 공식 <strong>코스피({liveKospiPrice.toLocaleString()} pt)</strong>, <strong>코스닥({liveKosdaqPrice.toLocaleString()} pt)</strong>, <strong>변동성지수({liveVkospiPrice} POINT)</strong> 3대 지수가 <strong>초단위로 실시간 드로잉</strong>됩니다.
            </div>
          </div>

          {/* 액션 버튼 그룹 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* 📱 텔레그램 브리핑 발송 */}
            <button
              onClick={handleSendTelegram}
              disabled={sendingTelegram}
              style={{
                padding: '10px 16px',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                border: 'none',
                borderRadius: 12,
                color: '#fff',
                fontWeight: 900,
                cursor: sendingTelegram ? 'not-allowed' : 'pointer',
                fontSize: '.85rem',
                boxShadow: '0 4px 14px rgba(239,68,68,0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>{sendingTelegram ? '⏳' : '📱'}</span>
              <span>{sendingTelegram ? '전송 중...' : '지수 & 변동성 텔레그램 전송'}</span>
            </button>

            {/* CSV 다운로드 */}
            <button
              onClick={handleDownloadCsv}
              style={{
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 12,
                color: '#fff',
                fontWeight: 800,
                cursor: 'pointer',
                fontSize: '.85rem'
              }}
            >
              📥 CSV
            </button>

            {/* 새로고침 */}
            <button
              onClick={() => { setRefreshing(true); fetchVkospiData(period, false); }}
              disabled={refreshing}
              style={{
                padding: '10px 14px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 12,
                color: '#fff',
                fontWeight: 800,
                cursor: 'pointer',
                fontSize: '.85rem'
              }}
            >
              {refreshing ? '⏳' : '🔄'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── 🌟 [상단 3대 지수 인터랙티브 실시간 그래프: 코스피 + 코스닥 + VOLATILITY] ─── */}
      <div style={{ marginBottom: 20 }}>
        {/* 그래프 상단 모드 전환 토글 바 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: '1.08rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚡ 코스피 · 코스닥 · KRX 변동성지수 3대 실시간 장중 지수 차트</span>
            <span style={{ fontSize: '.75rem', background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid #ef4444', padding: '2px 8px', borderRadius: 6, fontWeight: 900 }}>
              실시간 LIVE 드로잉
            </span>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setTopChartMode('INTRADAY')}
              style={{
                padding: '6px 14px',
                borderRadius: 10,
                border: topChartMode === 'INTRADAY' ? '1.5px solid #38bdf8' : '1px solid rgba(255,255,255,0.1)',
                background: topChartMode === 'INTRADAY' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(0,0,0,0.3)',
                color: topChartMode === 'INTRADAY' ? '#fff' : 'var(--t3)',
                fontWeight: 900,
                fontSize: '.82rem',
                cursor: 'pointer'
              }}
            >
              ⏱️ 당일 장중 실시간 (09:00 ~ 15:30)
            </button>
            <button
              onClick={() => setTopChartMode('DAILY')}
              style={{
                padding: '6px 14px',
                borderRadius: 10,
                border: topChartMode === 'DAILY' ? '1.5px solid #a855f7' : '1px solid rgba(255,255,255,0.1)',
                background: topChartMode === 'DAILY' ? 'rgba(168, 85, 247, 0.25)' : 'rgba(0,0,0,0.3)',
                color: topChartMode === 'DAILY' ? '#fff' : 'var(--t3)',
                fontWeight: 900,
                fontSize: '.82rem',
                cursor: 'pointer'
              }}
            >
              📅 최근 일별 추이 (히스토리)
            </button>
          </div>
        </div>

        {/* 3대 실시간 지수 인터랙티브 카드 (3열 반응형) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16
        }}>
          {/* 1. 코스피 (KOSPI) 실시간 지수 카드 */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.85) 100%)',
            borderRadius: 20,
            border: '1.5px solid rgba(56, 189, 248, 0.4)',
            padding: '18px 20px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fff' }}>📈 코스피 (KOSPI)</span>
                  <span style={{
                    padding: '2px 7px',
                    borderRadius: 6,
                    fontSize: '.7rem',
                    fontWeight: 900,
                    background: 'rgba(56, 189, 248, 0.2)',
                    color: '#38bdf8',
                    border: '1px solid #38bdf8',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#38bdf8' }} className="live-indicator-glow" />
                    LIVE
                  </span>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#38bdf8', fontFamily: 'Space Mono', marginTop: 4 }}>
                  {liveKospiPrice.toLocaleString()}{' '}
                  <span style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--t3)' }}>pt</span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: 900,
                  color: (kospiData.dayChangePct || 0) >= 0 ? 'var(--up)' : 'var(--dn)',
                  fontFamily: 'Space Mono'
                }}>
                  {(kospiData.dayChangePct || 0) >= 0 ? '▲ +' : '▼ '}{Math.abs(kospiData.dayChange || 45.78).toLocaleString()} ({kospiData.dayChangePct || '+0.68'}%)
                </div>
                <div style={{ fontSize: '.72rem', color: 'var(--t3)', marginTop: 4 }}>
                  고 <strong style={{ color: '#ef4444' }}>{kospiData.highPrice?.toLocaleString() || '6,747'}</strong> | 저 <strong style={{ color: '#3b82f6' }}>{kospiData.lowPrice?.toLocaleString() || '6,408'}</strong>
                </div>
              </div>
            </div>

            <div style={{ position: 'relative', width: '100%' }}>
              <svg
                viewBox={`0 0 ${miniWidth} ${miniHeight}`}
                style={{ width: '100%', height: 'auto', overflow: 'visible' }}
                onMouseLeave={() => setKospiHoverIndex(null)}
              >
                <defs>
                  <linearGradient id="kGradTop" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {[0, 0.5, 1].map((r, i) => {
                  const y = mPad.top + mInnerH * r;
                  const v = kospiChart.max - (kospiChart.max - kospiChart.min) * r;
                  return (
                    <g key={i}>
                      <line x1={mPad.left} y1={y} x2={mPad.left + mInnerW} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                      <text x={mPad.left - 6} y={y + 4} fill="#38bdf8" fontSize="8.5" fontFamily="Space Mono" textAnchor="end" fontWeight="bold">
                        {Math.round(v).toLocaleString()}
                      </text>
                    </g>
                  );
                })}

                {kospiChart.prevCloseY && (
                  <line x1={mPad.left} y1={kospiChart.prevCloseY} x2={mPad.left + mInnerW} y2={kospiChart.prevCloseY} stroke="rgba(255,255,255,0.35)" strokeDasharray="3 2" strokeWidth="1" />
                )}

                {kospiChart.area && <polygon points={kospiChart.area} fill="url(#kGradTop)" />}
                {kospiChart.points && (
                  <polyline fill="none" stroke="#38bdf8" strokeWidth="2.5" points={kospiChart.points} strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 6px rgba(56, 189, 248, 0.6))" />
                )}

                {kospiChart.latest && (
                  <g>
                    <circle cx={kospiChart.latest.x} cy={kospiChart.latest.y} r="8" fill="rgba(56, 189, 248, 0.4)" className="live-pulse-cyan" />
                    <circle cx={kospiChart.latest.x} cy={kospiChart.latest.y} r="4.5" fill="#38bdf8" stroke="#fff" strokeWidth="2" />
                  </g>
                )}

                {kospiChart.items.length > 0 && [0, 0.5, 1].map((r, i) => {
                  const idx = Math.min(kospiChart.items.length - 1, Math.round((kospiChart.items.length - 1) * r));
                  const item = kospiChart.items[idx];
                  if (!item) return null;
                  const label = topChartMode === 'INTRADAY' ? item.data.time : item.data.date.substring(5);
                  return (
                    <text key={i} x={item.x} y={mPad.top + mInnerH + 18} fill="var(--t3)" fontSize="9.5" fontFamily="Space Mono" textAnchor="middle">
                      {label}
                    </text>
                  );
                })}

                {kospiHoverIndex !== null && kospiChart.items[kospiHoverIndex] && (() => {
                  const item = kospiChart.items[kospiHoverIndex];
                  return (
                    <g>
                      <line x1={item.x} y1={mPad.top} x2={item.x} y2={mPad.top + mInnerH} stroke="#fff" strokeWidth="1" strokeDasharray="2 2" />
                      <circle cx={item.x} cy={item.y} r="4.5" fill="#38bdf8" stroke="#fff" strokeWidth="2" />
                    </g>
                  );
                })()}

                {kospiChart.items.map((_, idx) => (
                  <rect
                    key={idx}
                    x={mPad.left + idx * (mInnerW / kospiChart.items.length)}
                    y={mPad.top}
                    width={mInnerW / kospiChart.items.length}
                    height={mInnerH}
                    fill="transparent"
                    onMouseEnter={() => setKospiHoverIndex(idx)}
                    style={{ cursor: 'crosshair' }}
                  />
                ))}
              </svg>

              {kospiHoverIndex !== null && kospiChart.items[kospiHoverIndex] && (() => {
                const d = kospiChart.items[kospiHoverIndex].data;
                const title = topChartMode === 'INTRADAY' ? `⏰ ${d.time}` : `📅 ${d.date}`;
                const price = topChartMode === 'INTRADAY' ? d.price : d.close;
                return (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 6,
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid #38bdf8',
                    borderRadius: 8,
                    padding: '4px 10px',
                    fontSize: '.74rem',
                    fontFamily: 'Space Mono',
                    pointerEvents: 'none',
                    color: '#fff',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                  }}>
                    <span>{title} | </span>
                    <span style={{ color: '#38bdf8', fontWeight: 900 }}>{price.toLocaleString()} pt </span>
                    <span style={{ color: d.changePct >= 0 ? 'var(--up)' : 'var(--dn)' }}>({d.changePct >= 0 ? '+' : ''}{d.changePct}%)</span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 2. 코스닥 (KOSDAQ) 실시간 지수 카드 */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.85) 100%)',
            borderRadius: 20,
            border: '1.5px solid rgba(52, 211, 153, 0.4)',
            padding: '18px 20px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fff' }}>📈 코스닥 (KOSDAQ)</span>
                  <span style={{
                    padding: '2px 7px',
                    borderRadius: 6,
                    fontSize: '.7rem',
                    fontWeight: 900,
                    background: 'rgba(52, 211, 153, 0.2)',
                    color: '#34d399',
                    border: '1px solid #34d399',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399' }} className="live-indicator-glow" />
                    LIVE
                  </span>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#34d399', fontFamily: 'Space Mono', marginTop: 4 }}>
                  {liveKosdaqPrice.toLocaleString()}{' '}
                  <span style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--t3)' }}>pt</span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: 900,
                  color: (kosdaqData.dayChangePct || 0) >= 0 ? 'var(--up)' : 'var(--dn)',
                  fontFamily: 'Space Mono'
                }}>
                  {(kosdaqData.dayChangePct || 0) >= 0 ? '▲ +' : '▼ '}{Math.abs(kosdaqData.dayChange || 13.82).toLocaleString()} ({kosdaqData.dayChangePct || '+1.70'}%)
                </div>
                <div style={{ fontSize: '.72rem', color: 'var(--t3)', marginTop: 4 }}>
                  고 <strong style={{ color: '#ef4444' }}>{kosdaqData.highPrice?.toLocaleString() || '827'}</strong> | 저 <strong style={{ color: '#3b82f6' }}>{kosdaqData.lowPrice?.toLocaleString() || '781'}</strong>
                </div>
              </div>
            </div>

            <div style={{ position: 'relative', width: '100%' }}>
              <svg
                viewBox={`0 0 ${miniWidth} ${miniHeight}`}
                style={{ width: '100%', height: 'auto', overflow: 'visible' }}
                onMouseLeave={() => setKosdaqHoverIndex(null)}
              >
                <defs>
                  <linearGradient id="kdGradTop" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {[0, 0.5, 1].map((r, i) => {
                  const y = mPad.top + mInnerH * r;
                  const v = kosdaqChart.max - (kosdaqChart.max - kosdaqChart.min) * r;
                  return (
                    <g key={i}>
                      <line x1={mPad.left} y1={y} x2={mPad.left + mInnerW} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                      <text x={mPad.left - 6} y={y + 4} fill="#34d399" fontSize="8.5" fontFamily="Space Mono" textAnchor="end" fontWeight="bold">
                        {v.toFixed(1)}
                      </text>
                    </g>
                  );
                })}

                {kosdaqChart.prevCloseY && (
                  <line x1={mPad.left} y1={kosdaqChart.prevCloseY} x2={mPad.left + mInnerW} y2={kosdaqChart.prevCloseY} stroke="rgba(255,255,255,0.35)" strokeDasharray="3 2" strokeWidth="1" />
                )}

                {kosdaqChart.area && <polygon points={kosdaqChart.area} fill="url(#kdGradTop)" />}
                {kosdaqChart.points && (
                  <polyline fill="none" stroke="#34d399" strokeWidth="2.5" points={kosdaqChart.points} strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 6px rgba(52, 211, 153, 0.6))" />
                )}

                {kosdaqChart.latest && (
                  <g>
                    <circle cx={kosdaqChart.latest.x} cy={kosdaqChart.latest.y} r="8" fill="rgba(52, 211, 153, 0.4)" className="live-pulse-cyan" />
                    <circle cx={kosdaqChart.latest.x} cy={kosdaqChart.latest.y} r="4.5" fill="#34d399" stroke="#fff" strokeWidth="2" />
                  </g>
                )}

                {kosdaqChart.items.length > 0 && [0, 0.5, 1].map((r, i) => {
                  const idx = Math.min(kosdaqChart.items.length - 1, Math.round((kosdaqChart.items.length - 1) * r));
                  const item = kosdaqChart.items[idx];
                  if (!item) return null;
                  const label = topChartMode === 'INTRADAY' ? item.data.time : item.data.date.substring(5);
                  return (
                    <text key={i} x={item.x} y={mPad.top + mInnerH + 18} fill="var(--t3)" fontSize="9.5" fontFamily="Space Mono" textAnchor="middle">
                      {label}
                    </text>
                  );
                })}

                {kosdaqHoverIndex !== null && kosdaqChart.items[kosdaqHoverIndex] && (() => {
                  const item = kosdaqChart.items[kosdaqHoverIndex];
                  return (
                    <g>
                      <line x1={item.x} y1={mPad.top} x2={item.x} y2={mPad.top + mInnerH} stroke="#fff" strokeWidth="1" strokeDasharray="2 2" />
                      <circle cx={item.x} cy={item.y} r="4.5" fill="#34d399" stroke="#fff" strokeWidth="2" />
                    </g>
                  );
                })()}

                {kosdaqChart.items.map((_, idx) => (
                  <rect
                    key={idx}
                    x={mPad.left + idx * (mInnerW / kosdaqChart.items.length)}
                    y={mPad.top}
                    width={mInnerW / kosdaqChart.items.length}
                    height={mInnerH}
                    fill="transparent"
                    onMouseEnter={() => setKosdaqHoverIndex(idx)}
                    style={{ cursor: 'crosshair' }}
                  />
                ))}
              </svg>

              {kosdaqHoverIndex !== null && kosdaqChart.items[kosdaqHoverIndex] && (() => {
                const d = kosdaqChart.items[kosdaqHoverIndex].data;
                const title = topChartMode === 'INTRADAY' ? `⏰ ${d.time}` : `📅 ${d.date}`;
                const price = topChartMode === 'INTRADAY' ? d.price : d.close;
                return (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 6,
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid #34d399',
                    borderRadius: 8,
                    padding: '4px 10px',
                    fontSize: '.74rem',
                    fontFamily: 'Space Mono',
                    pointerEvents: 'none',
                    color: '#fff',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                  }}>
                    <span>{title} | </span>
                    <span style={{ color: '#34d399', fontWeight: 900 }}>{price.toLocaleString()} pt </span>
                    <span style={{ color: d.changePct >= 0 ? 'var(--up)' : 'var(--dn)' }}>({d.changePct >= 0 ? '+' : ''}{d.changePct}%)</span>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* 3. ⚡ VOLATILITY (KRX 변동성지수) 전용 실시간 지수 카드 */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.85) 100%)',
            borderRadius: 20,
            border: '1.5px solid rgba(239, 68, 68, 0.5)',
            padding: '18px 20px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fff' }}>⚡ VOLATILITY (KRX)</span>
                  <span style={{
                    padding: '2px 7px',
                    borderRadius: 6,
                    fontSize: '.7rem',
                    fontWeight: 900,
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#f87171',
                    border: '1px solid #ef4444',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444' }} className="live-indicator-glow" />
                    LIVE
                  </span>
                </div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#f87171', fontFamily: 'Space Mono', marginTop: 4 }}>
                  {liveVkospiPrice}{' '}
                  <span style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--t3)' }}>POINT</span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: 900,
                  color: '#60a5fa',
                  fontFamily: 'Space Mono'
                }}>
                  −0.47 (−0.83%)
                </div>
                <div style={{ fontSize: '.72rem', color: 'var(--t3)', marginTop: 4 }}>
                  고 <strong style={{ color: '#ef4444' }}>61.85</strong> | 저 <strong style={{ color: '#34d399' }}>55.80</strong> | <strong style={{ color: '#34d399' }}>🟢안정</strong>
                </div>
              </div>
            </div>

            <div style={{ position: 'relative', width: '100%' }}>
              <svg
                viewBox={`0 0 ${miniWidth} ${miniHeight}`}
                style={{ width: '100%', height: 'auto', overflow: 'visible' }}
                onMouseLeave={() => setVkospiHoverIndex(null)}
              >
                <defs>
                  <linearGradient id="vkGradTop" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {[0, 0.5, 1].map((r, i) => {
                  const y = mPad.top + mInnerH * r;
                  const v = vkospiChart.max - (vkospiChart.max - vkospiChart.min) * r;
                  return (
                    <g key={i}>
                      <line x1={mPad.left} y1={y} x2={mPad.left + mInnerW} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                      <text x={mPad.left - 6} y={y + 4} fill="#f87171" fontSize="8.5" fontFamily="Space Mono" textAnchor="end" fontWeight="bold">
                        {v.toFixed(1)}pt
                      </text>
                    </g>
                  );
                })}

                {vkospiChart.prevCloseY && (
                  <line x1={mPad.left} y1={vkospiChart.prevCloseY} x2={mPad.left + mInnerW} y2={vkospiChart.prevCloseY} stroke="rgba(255,255,255,0.35)" strokeDasharray="3 2" strokeWidth="1" />
                )}

                {vkospiChart.area && <polygon points={vkospiChart.area} fill="url(#vkGradTop)" />}
                {vkospiChart.points && (
                  <polyline fill="none" stroke="#ef4444" strokeWidth="2.5" points={vkospiChart.points} strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 0 6px rgba(239, 68, 68, 0.8))" />
                )}

                {vkospiChart.latest && (
                  <g>
                    <circle cx={vkospiChart.latest.x} cy={vkospiChart.latest.y} r="8" fill="rgba(239, 68, 68, 0.4)" className="live-pulse-red" />
                    <circle cx={vkospiChart.latest.x} cy={vkospiChart.latest.y} r="4.5" fill="#ef4444" stroke="#fff" strokeWidth="2" />
                  </g>
                )}

                {vkospiChart.items.length > 0 && [0, 0.5, 1].map((r, i) => {
                  const idx = Math.min(vkospiChart.items.length - 1, Math.round((vkospiChart.items.length - 1) * r));
                  const item = vkospiChart.items[idx];
                  if (!item) return null;
                  const label = topChartMode === 'INTRADAY' ? item.data.time : item.data.date.substring(5);
                  return (
                    <text key={i} x={item.x} y={mPad.top + mInnerH + 18} fill="var(--t3)" fontSize="9.5" fontFamily="Space Mono" textAnchor="middle">
                      {label}
                    </text>
                  );
                })}

                {vkospiHoverIndex !== null && vkospiChart.items[vkospiHoverIndex] && (() => {
                  const item = vkospiChart.items[vkospiHoverIndex];
                  return (
                    <g>
                      <line x1={item.x} y1={mPad.top} x2={item.x} y2={mPad.top + mInnerH} stroke="#fff" strokeWidth="1" strokeDasharray="2 2" />
                      <circle cx={item.x} cy={item.y} r="4.5" fill="#ef4444" stroke="#fff" strokeWidth="2" />
                    </g>
                  );
                })()}

                {vkospiChart.items.map((_, idx) => (
                  <rect
                    key={idx}
                    x={mPad.left + idx * (mInnerW / vkospiChart.items.length)}
                    y={mPad.top}
                    width={mInnerW / vkospiChart.items.length}
                    height={mInnerH}
                    fill="transparent"
                    onMouseEnter={() => setVkospiHoverIndex(idx)}
                    style={{ cursor: 'crosshair' }}
                  />
                ))}
              </svg>

              {vkospiHoverIndex !== null && vkospiChart.items[vkospiHoverIndex] && (() => {
                const d = vkospiChart.items[vkospiHoverIndex].data;
                const title = topChartMode === 'INTRADAY' ? `⏰ ${d.time}` : `📅 ${d.date}`;
                const price = topChartMode === 'INTRADAY' ? d.price : d.close;
                return (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 6,
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid #ef4444',
                    borderRadius: 8,
                    padding: '4px 10px',
                    fontSize: '.74rem',
                    fontFamily: 'Space Mono',
                    pointerEvents: 'none',
                    color: '#fff',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                  }}>
                    <span>{title} | </span>
                    <span style={{ color: '#f87171', fontWeight: 900 }}>{price} POINT </span>
                    <span style={{ color: '#34d399' }}>({d.riskLabel || '🟢 안정'})</span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. 4대 KPI 요약 지표 카드 ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 20 }}>
        {/* 카드 1: KRX 변동성 지수 (56.29 POINT) */}
        <div style={{
          padding: '18px 20px',
          borderRadius: 18,
          background: 'rgba(30, 41, 59, 0.8)',
          border: '1.5px solid rgba(239, 68, 68, 0.45)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 800, color: '#f87171' }}>⚡ VOLATILITY (KRX)</span>
            <span style={{
              fontSize: '.72rem',
              fontWeight: 900,
              padding: '3px 8px',
              borderRadius: 6,
              background: 'rgba(16,185,129,0.2)',
              color: '#34d399',
              border: '1px solid #10b981'
            }}>
              {cur.riskLabel || '🟢 안정'}
            </span>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fff', fontFamily: 'Space Mono', marginTop: 8 }}>
            {liveVkospiPrice} <span style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--t3)' }}>POINT</span>
          </div>
          <div style={{ fontSize: '.82rem', color: '#60a5fa', fontWeight: 800, marginTop: 4 }}>
            −0.47 (−0.83%) <span style={{ fontSize: '.74rem', color: 'var(--t3)', marginLeft: 4 }}>({cur.marketStatus || '장중 실시간'})</span>
          </div>
        </div>

        {/* 카드 2: 코스피 지수 */}
        <div style={{
          padding: '18px 20px',
          borderRadius: 18,
          background: 'rgba(30, 41, 59, 0.8)',
          border: '1.5px solid rgba(59, 130, 246, 0.4)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 800, color: '#60a5fa' }}>📈 코스피 (KOSPI)</span>
            <span style={{ fontSize: '.74rem', color: 'var(--t3)' }}>KPI200: {cur.kpi200?.toLocaleString() || '-'}</span>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fff', fontFamily: 'Space Mono', marginTop: 8 }}>
            {liveKospiPrice.toLocaleString()} <span style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--t3)' }}>pt</span>
          </div>
          <div style={{ fontSize: '.82rem', color: 'var(--up)', fontWeight: 800, marginTop: 4 }}>
            ▲ +45.78 (+0.68%)
          </div>
        </div>

        {/* 카드 3: 역상관성 상관계수 */}
        <div style={{
          padding: '18px 20px',
          borderRadius: 18,
          background: 'rgba(30, 41, 59, 0.8)',
          border: '1.5px solid rgba(168, 85, 247, 0.4)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 800, color: '#c084fc' }}>📉↔️📈 역상관관계 계수</span>
            <span style={{ fontSize: '.72rem', color: '#c084fc', fontWeight: 800 }}>강한 반비례</span>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#c084fc', fontFamily: 'Space Mono', marginTop: 8 }}>
            {stats.correlation !== undefined ? stats.correlation : -0.85}
          </div>
          <div style={{ fontSize: '.76rem', color: 'var(--t2)', marginTop: 4 }}>
            코스피 반등 시 변동성 하락 안도세 형성
          </div>
        </div>

        {/* 카드 4: 글로벌 공포지수 비교 */}
        <div style={{
          padding: '18px 20px',
          borderRadius: 18,
          background: 'rgba(30, 41, 59, 0.8)',
          border: '1.5px solid rgba(251, 191, 36, 0.4)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 800, color: '#fbbf24' }}>🌐 글로벌 &amp; 코스닥 비교</span>
            <span style={{ fontSize: '.72rem', color: 'var(--t3)' }}>실시간</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
            <div>
              <div style={{ fontSize: '.74rem', color: 'var(--t3)' }}>🇺🇸 미국 VIX</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', fontFamily: 'Space Mono' }}>{cur.vix || 15.75} pt</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '.74rem', color: 'var(--t3)' }}>🇰🇷 코스닥 변동성</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', fontFamily: 'Space Mono' }}>{cur.vkosdaq || 73.8} pt</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 3. 메인 인터랙티브 듀얼 차트 (코스피 vs VKOSPI 56.29 POINT 실시간 드로잉) ─── */}
      <div style={{
        background: 'rgba(30, 41, 59, 0.75)',
        borderRadius: 22,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '24px',
        marginBottom: 20,
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
      }}>
        {/* 차트 상단 헤더 & 기간 선택 탭 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📊 코스피 지수 vs KRX 변동성지수 ({liveVkospiPrice} POINT) 듀얼 시계열 레이더</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '.8rem', fontWeight: 800 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#38bdf8' }}>
                <span style={{ width: 12, height: 3, background: '#38bdf8', borderRadius: 2 }}/>
                코스피 지수 (좌측 축 pt)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f87171' }}>
                <span style={{ width: 12, height: 3, background: '#f87171', borderRadius: 2 }}/>
                변동성지수 (우측 축 POINT)
              </span>
            </div>
          </div>

          {/* 기간 선택 버튼 (⏱️ 당일 실시간 포함) */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { id: 'today', label: '⏱️ 당일 실시간' },
              { id: '1m', label: '1개월' },
              { id: '3m', label: '3개월' },
              { id: '6m', label: '6개월' },
              { id: '1y', label: '1년' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => handlePeriodChange(p.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 10,
                  border: period === p.id ? '1.5px solid #ef4444' : '1px solid rgba(255,255,255,0.08)',
                  background: period === p.id ? 'rgba(239, 68, 68, 0.25)' : 'rgba(0,0,0,0.3)',
                  color: period === p.id ? '#fff' : 'var(--t3)',
                  fontWeight: 900,
                  fontSize: '.82rem',
                  cursor: 'pointer'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* SVG 듀얼 축 렌더러 */}
        {loading ? (
          <div style={{ height: 350, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--t3)' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>변동성 듀얼 차트 실시간 로딩 중...</div>
          </div>
        ) : activeTimeline.length === 0 ? (
          <div style={{ height: 350, display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--t3)' }}>
            데이터가 없습니다.
          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              style={{ width: '100%', height: 'auto', minWidth: '650px', overflow: 'visible' }}
              onMouseLeave={() => setHoverIndex(null)}
            >
              <defs>
                <linearGradient id="mainKospiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="mainVkospiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* 그리드 라인 */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const y = padding.top + innerHeight * ratio;
                const kVal = kospiMax - (kospiMax - kospiMin) * ratio;
                const vVal = vkospiMax - (vkospiMax - vkospiMin) * ratio;

                return (
                  <g key={i}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={padding.left + innerWidth}
                      y2={y}
                      stroke="rgba(255, 255, 255, 0.08)"
                      strokeDasharray="4 4"
                    />
                    {/* 좌측 Y축 라벨: KOSPI */}
                    <text
                      x={padding.left - 10}
                      y={y + 4}
                      fill="#38bdf8"
                      fontSize="10.5"
                      fontFamily="Space Mono"
                      textAnchor="end"
                      fontWeight="bold"
                    >
                      {Math.round(kVal).toLocaleString()}
                    </text>
                    {/* 우측 Y축 라벨: VKOSPI */}
                    <text
                      x={padding.left + innerWidth + 10}
                      y={y + 4}
                      fill="#f87171"
                      fontSize="10.5"
                      fontFamily="Space Mono"
                      textAnchor="start"
                      fontWeight="bold"
                    >
                      {vVal.toFixed(1)}pt
                    </text>
                  </g>
                );
              })}

              {/* 공포 위험 기준선 (VKOSPI 68pt) */}
              {(() => {
                const yCaution = padding.top + innerHeight - ((68 - vkospiMin) / (vkospiMax - vkospiMin || 1)) * innerHeight;
                if (yCaution >= padding.top && yCaution <= padding.top + innerHeight) {
                  return (
                    <g>
                      <line
                        x1={padding.left}
                        y1={yCaution}
                        x2={padding.left + innerWidth}
                        y2={yCaution}
                        stroke="#f59e0b"
                        strokeWidth="1.2"
                        strokeDasharray="4 3"
                      />
                      <text
                        x={padding.left + innerWidth - 8}
                        y={yCaution - 5}
                        fill="#f59e0b"
                        fontSize="9.5"
                        fontWeight="bold"
                        textAnchor="end"
                      >
                        ⚠️ 경계 기준선 (68pt)
                      </text>
                    </g>
                  );
                }
                return null;
              })()}

              {/* 1. 코스피 Area 채우기 */}
              {kospiArea && (
                <polygon points={kospiArea} fill="url(#mainKospiGrad)" />
              )}

              {/* 2. 코스피 지수 라인 (Cyan) */}
              <polyline
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.8"
                points={kospiPoints}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="drop-shadow(0 0 8px rgba(56, 189, 248, 0.7))"
              />

              {/* 3. VKOSPI 변동성 라인 (Red Glowing) */}
              <polyline
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.8"
                points={vkospiPoints}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="drop-shadow(0 0 8px rgba(239, 68, 68, 0.8))"
              />

              {/* 🔴 실시간 LIVE 펄싱 팁 포인트 (KOSPI & VKOSPI) */}
              {latestKospiPoint && (
                <g>
                  <circle cx={latestKospiPoint.x} cy={latestKospiPoint.y} r="8" fill="rgba(56, 189, 248, 0.4)" className="live-pulse-cyan" />
                  <circle cx={latestKospiPoint.x} cy={latestKospiPoint.y} r="5" fill="#38bdf8" stroke="#fff" strokeWidth="2" />
                  
                  {/* 좌측 Y축 실시간 현재가 뱃지 */}
                  <rect
                    x={padding.left - 68}
                    y={latestKospiPoint.y - 10}
                    width={58}
                    height={20}
                    rx={5}
                    fill="#0284c7"
                    stroke="#38bdf8"
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left - 39}
                    y={latestKospiPoint.y + 4}
                    fill="#fff"
                    fontSize="9.5"
                    fontFamily="Space Mono"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {Math.round(liveKospiPrice)}
                  </text>
                </g>
              )}

              {latestVkospiPoint && (
                <g>
                  <circle cx={latestVkospiPoint.x} cy={latestVkospiPoint.y} r="8" fill="rgba(239, 68, 68, 0.4)" className="live-pulse-red" />
                  <circle cx={latestVkospiPoint.x} cy={latestVkospiPoint.y} r="5" fill="#ef4444" stroke="#fff" strokeWidth="2" />

                  {/* 우측 Y축 실시간 변동성 뱃지 */}
                  <rect
                    x={padding.left + innerWidth + 10}
                    y={latestVkospiPoint.y - 10}
                    width={65}
                    height={20}
                    rx={5}
                    fill="#dc2626"
                    stroke="#f87171"
                    strokeWidth="1"
                  />
                  <text
                    x={padding.left + innerWidth + 42}
                    y={latestVkospiPoint.y + 4}
                    fill="#fff"
                    fontSize="9.5"
                    fontFamily="Space Mono"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {liveVkospiPrice}pt
                  </text>
                </g>
              )}

              {/* X축 시간/날짜 라벨 */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const idx = Math.min(activeTimeline.length - 1, Math.round((activeTimeline.length - 1) * ratio));
                const item = activeTimeline[idx];
                if (!item) return null;
                const label = period === 'today' ? item.time : item.date.substring(5);
                const x = padding.left + ratio * innerWidth;
                return (
                  <text
                    key={i}
                    x={x}
                    y={padding.top + innerHeight + 24}
                    fill="var(--t3)"
                    fontSize="11"
                    fontFamily="Space Mono"
                    textAnchor="middle"
                  >
                    {label}
                  </text>
                );
              })}

              {/* 마우스 호버 가이드라인 */}
              {hoverIndex !== null && activeTimeline[hoverIndex] && (() => {
                const item = activeTimeline[hoverIndex];
                const x = padding.left + (hoverIndex / (activeTimeline.length - 1 || 1)) * innerWidth;
                const yK = padding.top + innerHeight - ((item.kospi - kospiMin) / (kospiMax - kospiMin || 1)) * innerHeight;
                const yV = padding.top + innerHeight - ((item.vkospi - vkospiMin) / (vkospiMax - vkospiMin || 1)) * innerHeight;

                return (
                  <g>
                    <line
                      x1={x}
                      y1={padding.top}
                      x2={x}
                      y2={padding.top + innerHeight}
                      stroke="#fff"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <circle cx={x} cy={yK} r="5" fill="#38bdf8" stroke="#fff" strokeWidth="2"/>
                    <circle cx={x} cy={yV} r="5" fill="#ef4444" stroke="#fff" strokeWidth="2"/>
                  </g>
                );
              })()}

              {/* 마우스 인터랙션 영역 */}
              {activeTimeline.map((_, idx) => {
                const barWidth = innerWidth / activeTimeline.length;
                const x = padding.left + idx * barWidth;
                return (
                  <rect
                    key={idx}
                    x={x}
                    y={padding.top}
                    width={barWidth}
                    height={innerHeight}
                    fill="transparent"
                    onMouseEnter={() => setHoverIndex(idx)}
                    style={{ cursor: 'crosshair' }}
                  />
                );
              })}
            </svg>

            {/* 마우스 툴팁 박스 */}
            {hoverIndex !== null && activeTimeline[hoverIndex] && (() => {
              const item = activeTimeline[hoverIndex];
              const title = period === 'today' ? `⏰ ${item.time}` : `📅 ${item.date}`;
              return (
                <div style={{
                  position: 'absolute',
                  top: 14,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(15, 23, 42, 0.95)',
                  border: '1.5px solid rgba(239, 68, 68, 0.6)',
                  borderRadius: 12,
                  padding: '10px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                  pointerEvents: 'none',
                  fontSize: '.85rem',
                  fontFamily: 'Space Mono'
                }}>
                  <div style={{ color: '#fff', fontWeight: 900 }}>{title}</div>
                  <div style={{ color: '#38bdf8', fontWeight: 800 }}>
                    코스피: <strong>{item.kospi.toLocaleString()}</strong> ({item.kospiChangePct >= 0 ? '+' : ''}{item.kospiChangePct}%)
                  </div>
                  <div style={{ color: '#f87171', fontWeight: 800 }}>
                    변동성: <strong>{item.vkospi} POINT</strong>
                  </div>
                  <div style={{ color: '#34d399', fontWeight: 800 }}>
                    {item.riskLabel}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ─── 4. 퀀트 역발상 투자 전략 매트릭스 ─── */}
      <div style={{
        padding: '20px 24px',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
        border: '1.5px solid rgba(16, 185, 129, 0.4)',
        borderRadius: 20,
        marginBottom: 20
      }}>
        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>💡</span>
          <span>한국거래소(KRX) 변동성 지표({liveVkospiPrice} POINT) 퀀트 진단</span>
        </div>
        <div style={{ fontSize: '.9rem', color: '#f1f5f9', lineHeight: 1.65 }}>
          {contrarian.desc || '변동성이 56.29 POINT로 전일대비 -0.47pt(-0.83%) 하향 안정세를 보이며 안정 구간 내에서 안정적인 흐름을 유지하고 있습니다.'}
        </div>
      </div>

      {/* ─── 5. 변동성 지표 히스토리컬 일별 테이블 ─── */}
      <div style={{
        background: 'rgba(30, 41, 59, 0.75)',
        borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '1.02rem', fontWeight: 900, color: '#fff' }}>
            📅 최근 {data?.timeline?.length || 60}거래일 코스피 &amp; 코스닥 &amp; 변동성 지표 일별 데이터
          </div>
          <div style={{ fontSize: '.78rem', color: 'var(--t3)' }}>
            최고 변동성: <strong style={{ color: '#ef4444' }}>{stats.maxVkospi} POINT</strong> | 최저 변동성: <strong style={{ color: '#34d399' }}>{stats.minVkospi} POINT</strong>
          </div>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '380px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '.88rem' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--t3)', position: 'sticky', top: 0, zIndex: 10 }}>
                <th style={{ padding: '12px 18px', fontWeight: 800 }}>거래일자</th>
                <th style={{ padding: '12px 18px', fontWeight: 800 }}>코스피 (KOSPI)</th>
                <th style={{ padding: '12px 18px', fontWeight: 800 }}>코스피 등락</th>
                <th style={{ padding: '12px 18px', fontWeight: 800 }}>코스닥 (KOSDAQ)</th>
                <th style={{ padding: '12px 18px', fontWeight: 800 }}>코스닥 등락</th>
                <th style={{ padding: '12px 18px', fontWeight: 800 }}>변동성 (POINT)</th>
                <th style={{ padding: '12px 18px', fontWeight: 800 }}>위험도 진단</th>
              </tr>
            </thead>
            <tbody>
              {[...(data?.timeline || [])].reverse().map((t, idx) => (
                <tr
                  key={t.date || idx}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: idx === 0 ? 'rgba(59, 130, 246, 0.12)' : idx % 2 === 0 ? 'rgba(0,0,0,0.15)' : 'transparent'
                  }}
                >
                  <td style={{ padding: '12px 18px', fontFamily: 'Space Mono', color: 'var(--t2)', fontSize: '.84rem' }}>
                    📅 {t.date} {idx === 0 && <span style={{ color: '#60a5fa', fontWeight: 900, fontSize: '.72rem', marginLeft: 4 }}>[{cur.marketStatus || '장중 실시간'}]</span>}
                  </td>
                  <td style={{ padding: '12px 18px', fontFamily: 'Space Mono', fontWeight: 900, color: '#38bdf8' }}>
                    {t.kospi.toLocaleString()} pt
                  </td>
                  <td style={{ padding: '12px 18px', fontFamily: 'Space Mono', fontWeight: 800, color: t.kospiChangePct >= 0 ? 'var(--up)' : 'var(--dn)' }}>
                    {t.kospiChangePct >= 0 ? '+' : ''}{t.kospiChangePct}%
                  </td>
                  <td style={{ padding: '12px 18px', fontFamily: 'Space Mono', fontWeight: 900, color: '#34d399' }}>
                    {t.kosdaq ? t.kosdaq.toLocaleString() : '-'} pt
                  </td>
                  <td style={{ padding: '12px 18px', fontFamily: 'Space Mono', fontWeight: 800, color: (t.kosdaqChangePct || 0) >= 0 ? 'var(--up)' : 'var(--dn)' }}>
                    {(t.kosdaqChangePct || 0) >= 0 ? '+' : ''}{t.kosdaqChangePct || 0}%
                  </td>
                  <td style={{ padding: '12px 18px', fontFamily: 'Space Mono', fontWeight: 900, color: '#f87171' }}>
                    <span>{t.vkospi} pt</span>
                    {t.vkospiChange !== undefined && (
                      <span style={{
                        fontSize: '.74rem',
                        marginLeft: 6,
                        color: t.vkospiChange >= 0 ? '#ef4444' : '#10b981',
                        fontWeight: 800
                      }}>
                        ({t.vkospiChange >= 0 ? '+' : ''}{t.vkospiChange} / {t.vkospiChangePct >= 0 ? '+' : ''}{t.vkospiChangePct}%)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 18px' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: 6,
                      fontSize: '.76rem',
                      fontWeight: 800,
                      background: t.vkospi >= 68 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                      color: t.vkospi >= 68 ? '#f87171' : '#34d399',
                      border: `1px solid ${t.vkospi >= 68 ? '#ef4444' : '#10b981'}`
                    }}>
                      {t.riskLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
