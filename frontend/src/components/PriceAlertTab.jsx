// PriceAlertTab.jsx — 🔔 보유종목 vs 관심종목 분리 실시간 AI 스마트 알리미 및 텔레그램 대시보드
import React, { useState, useEffect, useMemo } from 'react';
import TelegramSettingsModal from './TelegramSettingsModal.jsx';

const formatNumber = (num) => new Intl.NumberFormat('ko-KR').format(num || 0);

export default function PriceAlertTab({ positions = [] }) {
  const [alerts, setAlerts] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [history, setHistory] = useState([]);
  const [telegramConfig, setTelegramConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingHoldings, setSendingHoldings] = useState(false);
  const [sendingWatchlist, setSendingWatchlist] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'HOLDING' | 'WATCHLIST' | 'HISTORY'

  // 신규/수정 폼 데이터
  const [formData, setFormData] = useState({
    category: 'HOLDING', // 'HOLDING' | 'WATCHLIST'
    stockCode: positions[0]?.code || '0182R0',
    stockName: positions[0]?.name || '1Q K반도체TOP2+',
    buyPrice: positions[0]?.purchasePrice || positions[0]?.price || 15129,
    targetPrice: 17050,
    stopLossPrice: 14500,
    memo: '월가 매물대 돌파 시 1차 분할 익절'
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const [alertsRes, historyRes, configRes, watchlistRes] = await Promise.all([
        fetch('/api/alerts'),
        fetch('/api/alerts/history'),
        fetch('/api/telegram/config'),
        fetch('/api/watchlist').catch(() => ({ json: () => ({ success: false }) }))
      ]);

      const alertsData = await alertsRes.json();
      const historyData = await historyRes.json();
      const configData = await configRes.json();
      const watchlistData = await watchlistRes.json();

      if (alertsData.success) setAlerts(alertsData.alerts || []);
      if (historyData.success) setHistory(historyData.history || []);
      if (configData.success) setTelegramConfig(configData.config);
      if (watchlistData.success) setWatchlist(watchlistData.watchlist || []);
    } catch (err) {
      console.error('알림 데이터 로드 실패:', err);
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => fetchData(true), 20000);
    return () => clearInterval(timer);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(false);
  };

  // 💼 보유종목 즉시 브리핑 텔레그램 발송
  const handleSendHoldingsBriefing = async () => {
    setSendingHoldings(true);
    try {
      const res = await fetch('/api/telegram/send-holdings-briefing', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('✅ 💼 보유종목 실시간 브리핑이 텔레그램으로 전송되었습니다!');
        fetchData(true);
      } else {
        alert(data.error || '발송 실패');
      }
    } catch (e) {
      alert('발송 중 오류가 발생했습니다.');
    } finally {
      setSendingHoldings(false);
    }
  };

  // ⭐ 관심종목 레이더 브리핑 텔레그램 발송
  const handleSendWatchlistBriefing = async () => {
    setSendingWatchlist(true);
    try {
      const res = await fetch('/api/telegram/send-watchlist-briefing', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('✅ ⭐ 관심종목 매수 타점 브리핑이 텔레그램으로 전송되었습니다!');
        fetchData(true);
      } else {
        alert(data.error || '발송 실패');
      }
    } catch (e) {
      alert('발송 중 오류가 발생했습니다.');
    } finally {
      setSendingWatchlist(false);
    }
  };

  // 신규 등록 모달 열기
  const handleOpenCreate = (category = 'HOLDING') => {
    setEditingAlert(null);
    if (category === 'HOLDING') {
      const pos = positions[0];
      const curP = pos?.price || pos?.purchasePrice || 15129;
      setFormData({
        category: 'HOLDING',
        stockCode: pos?.code || '0182R0',
        stockName: pos?.name || '1Q K반도체TOP2+',
        buyPrice: pos?.purchasePrice || curP,
        targetPrice: Math.round(curP * 1.15 / 50) * 50,
        stopLossPrice: Math.round(curP * 0.95 / 50) * 50,
        memo: 'AI 추천 1차 익절 목표가(+15%) 및 손절선(-5%)'
      });
    } else {
      const w = watchlist[0] || { code: '005930', name: '삼성전자' };
      setFormData({
        category: 'WATCHLIST',
        stockCode: w.code,
        stockName: w.name,
        buyPrice: 0,
        targetPrice: 75000,
        stopLossPrice: 70000,
        memo: '관심종목 매수 타점(눌림목 지지선) 진입 감시'
      });
    }
    setShowCreateModal(true);
  };

  // 수정 모달 열기
  const handleOpenEdit = (alert) => {
    setEditingAlert(alert);
    setFormData({
      category: alert.category || 'HOLDING',
      stockCode: alert.stockCode,
      stockName: alert.stockName,
      buyPrice: alert.buyPrice,
      targetPrice: alert.targetPrice,
      stopLossPrice: alert.stopLossPrice,
      memo: alert.memo || ''
    });
    setShowCreateModal(true);
  };

  // 종목 선택 시 자동 세팅
  const handleSelectPredefined = (item, category) => {
    const curP = item.price || item.purchasePrice || 10000;
    if (category === 'HOLDING') {
      setFormData({
        category: 'HOLDING',
        stockCode: item.code,
        stockName: item.name,
        buyPrice: item.purchasePrice || curP,
        targetPrice: Math.round(curP * 1.15 / 50) * 50,
        stopLossPrice: Math.round(curP * 0.95 / 50) * 50,
        memo: `${item.name} 1차 익절 목표가(+15%) 및 손절선 설정`
      });
    } else {
      setFormData({
        category: 'WATCHLIST',
        stockCode: item.code,
        stockName: item.name,
        buyPrice: 0,
        targetPrice: Math.round(curP * 0.96 / 50) * 50, // -4% 눌림목 매수 타점
        stopLossPrice: Math.round(curP * 0.90 / 50) * 50,
        memo: `${item.name} 지지선 눌림목 매수 타점 포착 감시`
      });
    }
  };

  // 활성/비활성 토글
  const handleToggle = async (alert) => {
    try {
      const res = await fetch(`/api/alerts/${alert.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: !alert.isEnabled })
      });
      const data = await res.json();
      if (data.success) {
        setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, isEnabled: !a.isEnabled } : a));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 저장 (생성/수정)
  const handleSaveAlert = async (e) => {
    e.preventDefault();
    try {
      if (editingAlert) {
        const res = await fetch(`/api/alerts/${editingAlert.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const data = await res.json();
        if (data.success) {
          setShowCreateModal(false);
          fetchData();
          showToast('✅ 알림 규칙이 성공적으로 수정되었습니다.');
        }
      } else {
        const res = await fetch('/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const data = await res.json();
        if (data.success) {
          setShowCreateModal(false);
          fetchData();
          showToast('✅ 새 스마트 알림 규칙이 등록되었습니다.');
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 삭제
  const handleDelete = async (id) => {
    if (!window.confirm('이 알림 규칙을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setAlerts(prev => prev.filter(a => a.id !== id));
        showToast('🗑️ 알림 규칙이 삭제되었습니다.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 필터링
  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      const cat = a.category || 'HOLDING';
      if (activeTab === 'HOLDING' && cat !== 'HOLDING') return false;
      if (activeTab === 'WATCHLIST' && cat !== 'WATCHLIST') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (a.stockName || '').toLowerCase().includes(q);
        const matchCode = (a.stockCode || '').toLowerCase().includes(q);
        const matchMemo = (a.memo || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchMemo) return false;
      }
      return true;
    });
  }, [alerts, activeTab, searchQuery]);

  // 통계
  const stats = useMemo(() => {
    const res = { total: alerts.length, holdings: 0, watchlist: 0, targetReached: 0, stopLoss: 0 };
    alerts.forEach(a => {
      const cat = a.category || 'HOLDING';
      if (cat === 'HOLDING') res.holdings++;
      if (cat === 'WATCHLIST') res.watchlist++;
      if (a.isTargetReached) res.targetReached++;
      if (a.isStopLossTriggered) res.stopLoss++;
    });
    return res;
  }, [alerts]);

  const isTelegramConfigured = telegramConfig?.botToken && telegramConfig?.chatId;

  return (
    <div style={{ padding: '10px 0', animation: 'fadeIn 0.3s ease-in-out' }}>
      {/* 토스트 피드백 */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          padding: '14px 20px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1.5px solid #10b981',
          borderRadius: 0,
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

      {/* ─── 상단 메인 배너 ─── */}
      <div style={{
        padding: '22px 26px',
        background: 'var(--bg2)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 0,
        marginBottom: 18,
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span>보유종목 &amp; 관심종목 텔레그램 스마트 알리미</span>
              <span style={{ fontSize: '.75rem', background: 'var(--accent)', color: '#fff', padding: '3px 10px', borderRadius: 0, fontWeight: 700 }}>
                분리 발송 시스템
              </span>
            </div>
            <div style={{ fontSize: '.9rem', color: 'var(--t2)', marginTop: 6, lineHeight: 1.6 }}>
              <strong>💼 내 보유종목(익절/손절)</strong>과 <strong>⭐ 관심종목(매수 타점/눌림목)</strong>을 명확하게 분리하여 실시간 텔레그램 푸시 및 즉시 브리핑을 지원합니다.
            </div>
          </div>

          {/* 메인 액션 버튼 모음 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* 보유종목 텔레그램 브리핑 버튼 */}
            <button
              onClick={handleSendHoldingsBriefing}
              disabled={sendingHoldings || !isTelegramConfigured}
              style={{
                padding: '10px 16px',
                background: '#3b82f6',
                border: 'none',
                borderRadius: 0,
                color: '#fff',
                fontWeight: 700,
                cursor: (sendingHoldings || !isTelegramConfigured) ? 'not-allowed' : 'pointer',
                fontSize: '.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>{sendingHoldings ? '전송 중...' : '보유종목 브리핑 텔레그램 전송'}</span>
            </button>

            {/* 관심종목 텔레그램 브리핑 버튼 */}
            <button
              onClick={handleSendWatchlistBriefing}
              disabled={sendingWatchlist || !isTelegramConfigured}
              style={{
                padding: '10px 16px',
                background: '#eab308',
                border: 'none',
                borderRadius: 0,
                color: '#000',
                fontWeight: 700,
                cursor: (sendingWatchlist || !isTelegramConfigured) ? 'not-allowed' : 'pointer',
                fontSize: '.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>{sendingWatchlist ? '전송 중...' : '관심종목 레이더 텔레그램 전송'}</span>
            </button>

            {/* 텔레그램 설정 버튼 */}
            <button
              onClick={() => setShowTelegramModal(true)}
              style={{
                padding: '10px 14px',
                background: isTelegramConfigured ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                border: `1px solid ${isTelegramConfigured ? '#10b981' : '#eab308'}`,
                borderRadius: 0,
                color: isTelegramConfigured ? '#34d399' : '#fbbf24',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '.85rem'
              }}
            >
              {isTelegramConfigured ? '텔레그램 연동됨' : '텔레그램 연동'}
            </button>

            {/* 신규 알림 등록 */}
            <button
              onClick={() => handleOpenCreate('HOLDING')}
              style={{
                padding: '10px 16px',
                background: 'var(--accent)',
                border: 'none',
                borderRadius: 0,
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '.88rem'
              }}
            >
              새 알림 등록
            </button>
          </div>
        </div>
      </div>

      {/* ─── 4대 요약 KPI 카드 ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { id: 'ALL', label: '전체 등록 알림', count: stats.total, color: '#818cf8', desc: '모든 가격 감시 규칙' },
          { id: 'HOLDING', label: '보유종목 알림', count: stats.holdings, color: '#60a5fa', desc: '목표 익절 & 손절선 관리' },
          { id: 'WATCHLIST', label: '관심종목 알림', count: stats.watchlist, color: '#fbbf24', desc: '신규 매수 타점 & 눌림목 포착' },
          { id: 'TARGET', label: '목표가/진입가 도달', count: stats.targetReached, color: '#34d399', desc: '목표가 달성 종목' },
        ].map(card => {
          const isSelected = activeTab === card.id;
          return (
            <div
              key={card.id}
              onClick={() => setActiveTab(card.id)}
              style={{
                padding: '16px 18px',
                borderRadius: 0,
                background: isSelected ? `${card.color}12` : 'var(--bg2)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderTop: `2px solid ${card.color}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '.84rem', fontWeight: 700, color: card.color }}>{card.label}</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', fontFamily: 'Space Mono' }}>{card.count}개</span>
              </div>
              <div style={{ fontSize: '.74rem', color: 'var(--t2)', marginTop: 4 }}>{card.desc}</div>
              <div style={{ fontSize: '.72rem', color: card.color, fontWeight: 700, marginTop: 8 }}>
                {isSelected ? '필터링 적용 중' : '클릭 시 필터 ➔'}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── 탭 전환 & 검색 바 ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `전체 보기 (${stats.total})` },
            { id: 'HOLDING', label: `보유종목 (${stats.holdings})` },
            { id: 'WATCHLIST', label: `관심종목 (${stats.watchlist})` },
            { id: 'HISTORY', label: `텔레그램 발송 내역 (${history.length}건)` }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '8px 16px',
                borderRadius: 0,
                border: 'none',
                background: activeTab === t.id ? 'var(--accent)' : 'rgba(0,0,0,0.25)',
                color: activeTab === t.id ? '#fff' : 'var(--t3)',
                fontWeight: 700,
                fontSize: '.84rem',
                cursor: 'pointer'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab !== 'HISTORY' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', padding: '8px 14px', borderRadius: 0, border: '1px solid rgba(255,255,255,0.08)' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="종목명, 코드, 전략 메모 검색..."
              style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '.85rem' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer' }}>초기화</button>
            )}
          </div>
        )}
      </div>

      {/* ─── 1. 알림 규칙 카드 목록 뷰 ─── */}
      {activeTab !== 'HISTORY' && (
        <>
          {filteredAlerts.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', borderRadius: 0, border: '1px dashed rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>등록된 알림 규칙이 없습니다.</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 14 }}>
                <button
                  onClick={() => handleOpenCreate('HOLDING')}
                  style={{ padding: '9px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 0, fontWeight: 700, cursor: 'pointer' }}
                >
                  보유종목 알림 등록
                </button>
                <button
                  onClick={() => handleOpenCreate('WATCHLIST')}
                  style={{ padding: '9px 18px', background: '#eab308', color: '#000', border: 'none', borderRadius: 0, fontWeight: 700, cursor: 'pointer' }}
                >
                  관심종목 알림 등록
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
              {filteredAlerts.map(alert => {
                const isHolding = (alert.category || 'HOLDING') === 'HOLDING';
                const curPrice = alert.currentPrice || 0;
                const buyP = alert.buyPrice || 0;
                const targetP = alert.targetPrice || 0;
                const stopP = alert.stopLossPrice || 0;

                // 보유종목 익절 진행률
                const progressToTarget = targetP > buyP && curPrice >= buyP
                  ? Math.min(100, Math.max(0, ((curPrice - buyP) / (targetP - buyP)) * 100))
                  : (curPrice >= targetP ? 100 : 0);

                return (
                  <div
                    key={alert.id}
                    style={{
                      padding: '22px 24px',
                      background: 'var(--bg2)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderTop: `2px solid ${alert.isTargetReached ? '#10b981' : isHolding ? '#3b82f6' : '#fbbf24'}`,
                      borderRadius: 0,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                      opacity: alert.isEnabled ? 1 : 0.6
                    }}
                  >
                    {/* 상단 분류 뱃지 & 헤더 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: '.74rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 0,
                          background: isHolding ? 'rgba(59, 130, 246, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                          color: isHolding ? '#60a5fa' : '#fbbf24',
                          border: `1px solid ${isHolding ? '#3b82f6' : '#f59e0b'}`
                        }}>
                          {isHolding ? '보유종목' : '관심종목'}
                        </span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>{alert.stockName}</span>
                        <span style={{ fontSize: '.78rem', color: 'var(--t3)', fontFamily: 'Space Mono' }}>({alert.stockCode})</span>
                      </div>

                      {/* 활성 토글 */}
                      <button
                        onClick={() => handleToggle(alert)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 0,
                          border: `1px solid ${alert.isEnabled ? '#10b981' : 'rgba(255,255,255,0.2)'}`,
                          background: alert.isEnabled ? 'rgba(16,185,129,0.2)' : 'rgba(0,0,0,0.3)',
                          color: alert.isEnabled ? '#34d399' : 'var(--t3)',
                          fontSize: '.74rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {alert.isEnabled ? '감시 중' : '일시중지'}
                      </button>
                    </div>

                    {/* 실시간 현재가 & 손익률/등락률 */}
                    <div style={{
                      padding: '12px 14px',
                      background: 'rgba(0,0,0,0.35)',
                      borderRadius: 0,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 14
                    }}>
                      <div>
                        <div style={{ fontSize: '.72rem', color: 'var(--t3)' }}>실시간 현재가</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#fff', fontFamily: 'Space Mono' }}>
                          {curPrice > 0 ? `${formatNumber(curPrice)}원` : '조회 중...'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '.72rem', color: 'var(--t3)' }}>
                          {isHolding ? '매입단가 대비 손익' : '당일 등락률'}
                        </div>
                        <div style={{
                          fontSize: '1.05rem',
                          fontWeight: 900,
                          color: (isHolding ? alert.profitRate >= 0 : alert.changeRate >= 0) ? 'var(--up)' : 'var(--dn)',
                          fontFamily: 'Space Mono'
                        }}>
                          {isHolding 
                            ? `${alert.profitRate >= 0 ? '+' : ''}${alert.profitRate}%` 
                            : `${alert.changeRate >= 0 ? '+' : ''}${alert.changeRate}%`}
                        </div>
                      </div>
                    </div>

                    {/* 🎯 목표가 & 🛑 손절가 설정 정보 바 */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                      {/* 목표가/진입가 */}
                      <div style={{
                        padding: '10px 12px',
                        background: alert.isTargetReached ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.08)',
                        borderRadius: 0,
                        border: `1px solid ${alert.isTargetReached ? '#10b981' : 'rgba(16,185,129,0.25)'}`
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.74rem' }}>
                          <span style={{ color: '#34d399', fontWeight: 700 }}>
                            {isHolding ? '1차 익절 목표가' : '목표 매수 진입가'}
                          </span>
                          <span style={{ color: alert.isTargetReached ? '#10b981' : 'var(--t3)', fontWeight: 700 }}>
                            {alert.isTargetReached
                              ? (isHolding ? '달성!' : '진입 적기')
                              : (isHolding ? `+${alert.gapToTargetPct}% 남음` : `-${alert.gapToTargetPct}% 도달`)}
                          </span>
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', marginTop: 3, fontFamily: 'Space Mono' }}>
                          {formatNumber(targetP)}원
                        </div>
                      </div>

                      {/* 손절가 */}
                      <div style={{
                        padding: '10px 12px',
                        background: alert.isStopLossTriggered ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.08)',
                        borderRadius: 0,
                        border: `1px solid ${alert.isStopLossTriggered ? '#ef4444' : 'rgba(239,68,68,0.25)'}`
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.74rem' }}>
                          <span style={{ color: '#f87171', fontWeight: 700 }}>지지 손절선</span>
                          <span style={{ color: alert.isStopLossTriggered ? '#ef4444' : 'var(--t3)', fontWeight: 700 }}>
                            {alert.isStopLossTriggered ? '이탈 경보' : `-${alert.gapToStopLossPct}% 마진`}
                          </span>
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff', marginTop: 3, fontFamily: 'Space Mono' }}>
                          {formatNumber(stopP)}원
                        </div>
                      </div>
                    </div>

                    {/* 보유종목인 경우 진행 게이지 바 */}
                    {isHolding && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.72rem', color: 'var(--t3)', marginBottom: 4 }}>
                          <span>익절 진행률 (매입가 ➔ 목표가)</span>
                          <span style={{ color: '#34d399', fontWeight: 700 }}>{progressToTarget.toFixed(0)}%</span>
                        </div>
                        <div style={{ width: '100%', height: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 0, overflow: 'hidden' }}>
                          <div style={{
                            width: `${progressToTarget}%`,
                            height: '100%',
                            background: alert.isTargetReached ? '#10b981' : 'linear-gradient(90deg, #3b82f6, #10b981)',
                            borderRadius: 0,
                            transition: 'width 0.4s ease'
                          }}/>
                        </div>
                      </div>
                    )}

                    {/* 전략 메모 */}
                    {alert.memo && (
                      <div style={{ fontSize: '.78rem', color: 'var(--t2)', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: 0, marginBottom: 14, lineHeight: 1.4 }}>
                        {alert.memo}
                      </div>
                    )}

                    {/* 액션 버튼 */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                      <button
                        onClick={() => handleOpenEdit(alert)}
                        style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 0, color: 'var(--t2)', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        설정 수정
                      </button>
                      <button
                        onClick={() => handleDelete(alert.id)}
                        style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: 0, color: '#f87171', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer' }}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ─── 2. 텔레그램 발송 히스토리 타임라인 로그 ─── */}
      {activeTab === 'HISTORY' && (
        <div style={{ background: 'var(--bg2)', padding: '22px 26px', borderRadius: 0, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', marginBottom: 16 }}>
            최근 텔레그램 발송 내역 (보유종목 / 관심종목)
          </div>

          {history.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--t3)' }}>
              아직 발송된 텔레그램 알림 내역이 없습니다. (상단의 [보유종목 브리핑] 또는 [관심종목 브리핑] 버튼을 눌러보세요!)
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map((log, i) => {
                const isHolding = (log.category || 'HOLDING') === 'HOLDING';
                return (
                  <div
                    key={log.id || i}
                    style={{
                      padding: '12px 16px',
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: 0,
                      borderLeft: `3px solid ${isHolding ? '#3b82f6' : '#fbbf24'}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: 0,
                          fontSize: '.72rem',
                          fontWeight: 900,
                          background: isHolding ? 'rgba(59,130,246,0.2)' : 'rgba(251,191,36,0.2)',
                          color: isHolding ? '#60a5fa' : '#fbbf24'
                        }}>
                          {isHolding ? '💼 보유종목' : '⭐ 관심종목'}
                        </span>
                        <strong style={{ color: '#fff', fontSize: '.92rem' }}>{log.stockName}</strong>
                        {log.triggerPrice && (
                          <span style={{ fontSize: '.78rem', color: 'var(--t2)' }}>
                            발동가: <strong>{formatNumber(log.triggerPrice)}원</strong>
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: '.74rem', color: 'var(--t3)', fontFamily: 'Space Mono' }}>
                      📅 {new Date(log.timestamp).toLocaleString('ko-KR')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── ✍️ 신규/수정 알림 규칙 팝업 모달 ─── */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(10px)',
            zIndex: 4000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '580px',
              background: 'var(--bg2)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderTop: `2px solid ${formData.category === 'HOLDING' ? '#3b82f6' : '#fbbf24'}`,
              borderRadius: 0,
              padding: '28px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
              animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: 12 }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
                {editingAlert ? '스마트 가격 알림 수정' : '새 스마트 가격 알림 등록'}
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--t3)', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* 분류 선택 탭 */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, category: 'HOLDING' }))}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 0,
                  border: formData.category === 'HOLDING' ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.1)',
                  background: formData.category === 'HOLDING' ? 'rgba(59,130,246,0.2)' : 'rgba(0,0,0,0.3)',
                  color: formData.category === 'HOLDING' ? '#60a5fa' : 'var(--t3)',
                  fontWeight: 700,
                  fontSize: '.85rem',
                  cursor: 'pointer'
                }}
              >
                내 보유종목 (익절/손절)
              </button>

              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, category: 'WATCHLIST' }))}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 0,
                  border: formData.category === 'WATCHLIST' ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.1)',
                  background: formData.category === 'WATCHLIST' ? 'rgba(251,191,36,0.2)' : 'rgba(0,0,0,0.3)',
                  color: formData.category === 'WATCHLIST' ? '#fbbf24' : 'var(--t3)',
                  fontWeight: 700,
                  fontSize: '.85rem',
                  cursor: 'pointer'
                }}
              >
                관심종목 (매수 타점/눌림목)
              </button>
            </div>

            <form onSubmit={handleSaveAlert} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* 종목 빠른 선택 */}
              <div>
                <label style={{ fontSize: '.78rem', color: 'var(--t3)', fontWeight: 800, display: 'block', marginBottom: 4 }}>
                  {formData.category === 'HOLDING' ? '보유종목 빠른 선택' : '관심종목 빠른 선택'}
                </label>
                <select
                  value={formData.stockCode}
                  onChange={e => {
                    const list = formData.category === 'HOLDING' ? positions : watchlist;
                    const found = list.find(x => x.code === e.target.value);
                    if (found) handleSelectPredefined(found, formData.category);
                    else setFormData(prev => ({ ...prev, stockCode: e.target.value }));
                  }}
                  style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: 0, color: '#fff', outline: 'none' }}
                >
                  {(formData.category === 'HOLDING' ? positions : watchlist).map(p => (
                    <option key={p.code} value={p.code}>
                      {p.name} ({p.code}) {p.purchasePrice ? `— 매입가: ${formatNumber(p.purchasePrice)}원` : ''}
                    </option>
                  ))}
                  <option value="CUSTOM">직접 입력</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '.78rem', color: 'var(--t3)', fontWeight: 800, display: 'block', marginBottom: 4 }}>종목명</label>
                  <input
                    type="text"
                    value={formData.stockName}
                    onChange={e => setFormData({ ...formData, stockName: e.target.value })}
                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: 0, color: '#fff', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.78rem', color: 'var(--t3)', fontWeight: 800, display: 'block', marginBottom: 4 }}>종목코드</label>
                  <input
                    type="text"
                    value={formData.stockCode}
                    onChange={e => setFormData({ ...formData, stockCode: e.target.value })}
                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: 0, color: '#fff', outline: 'none' }}
                  />
                </div>
              </div>

              {/* 매입가 (보유종목인 경우만 필수) */}
              {formData.category === 'HOLDING' && (
                <div>
                  <label style={{ fontSize: '.78rem', color: 'var(--t3)', fontWeight: 800, display: 'block', marginBottom: 4 }}>내 매입단가 (원)</label>
                  <input
                    type="number"
                    value={formData.buyPrice}
                    onChange={e => setFormData({ ...formData, buyPrice: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: 0, color: '#fff', outline: 'none' }}
                  />
                </div>
              )}

              {/* 🎯 목표가 & 🛑 손절가 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '.78rem', color: '#34d399', fontWeight: 800, display: 'block', marginBottom: 4 }}>
                    {formData.category === 'HOLDING' ? '🎯 1차 익절 목표가 (원)' : '🎯 목표 매수 진입가 (원)'}
                  </label>
                  <input
                    type="number"
                    value={formData.targetPrice}
                    onChange={e => setFormData({ ...formData, targetPrice: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', borderRadius: 0, color: '#fff', outline: 'none', fontWeight: 800 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.78rem', color: '#f87171', fontWeight: 800, display: 'block', marginBottom: 4 }}>
                    {formData.category === 'HOLDING' ? '🛑 지지 손절가 (원)' : '🛑 지지 저지선 (원)'}
                  </label>
                  <input
                    type="number"
                    value={formData.stopLossPrice}
                    onChange={e => setFormData({ ...formData, stopLossPrice: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: 0, color: '#fff', outline: 'none', fontWeight: 800 }}
                  />
                </div>
              </div>

              {/* 메모 */}
              <div>
                <label style={{ fontSize: '.78rem', color: 'var(--t3)', fontWeight: 800, display: 'block', marginBottom: 4 }}>전략 메모</label>
                <input
                  type="text"
                  value={formData.memo}
                  onChange={e => setFormData({ ...formData, memo: e.target.value })}
                  placeholder="예: 지지선 눌림목 3차 분할 매수 진입"
                  style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: 0, color: '#fff', outline: 'none' }}
                />
              </div>

              {/* 버튼 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{ padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 0, color: 'var(--t2)', cursor: 'pointer', fontWeight: 700 }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 22px', background: '#3b82f6', border: 'none', borderRadius: 0, color: '#fff', fontWeight: 700, cursor: 'pointer' }}
                >
                  {editingAlert ? '알림 수정 저장' : '새 알림 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── 📱 텔레그램 설정 모달 ─── */}
      {showTelegramModal && (
        <TelegramSettingsModal
          onClose={() => setShowTelegramModal(false)}
          onSaved={(cfg) => setTelegramConfig(cfg)}
        />
      )}
    </div>
  );
}
