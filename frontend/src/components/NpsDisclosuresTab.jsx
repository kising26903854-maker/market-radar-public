// NpsDisclosuresTab.jsx — 🏛️ 국민연금 DART 공시 전용 실시간 터미널 & 24시간 자동 감시 엔진
import React, { useState, useEffect, useMemo } from 'react';

const formatNumber = (num) => new Intl.NumberFormat('ko-KR').format(num || 0);

export default function NpsDisclosuresTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [testingAlert, setTestingAlert] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // 실시간 감시 엔진 활성화 상태
  const [isAutoMonitoring, setIsAutoMonitoring] = useState(true);

  // 필터 & 정렬 & 검색
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'NEW' | 'INCREASE' | 'DECREASE' | 'LARGE_CAP'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('DATE_DESC'); // 'DATE_DESC' | 'DIFF_DESC' | 'RATIO_DESC' | 'VALUE_DESC'
  const [selectedItem, setSelectedItem] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchDisclosures = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch('/api/nps-disclosures');
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error('국민연금 공시 데이터 로드 실패:', err);
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDisclosures();
    const interval = setInterval(() => fetchDisclosures(true), 15000); // 15초 주기 실시간 자동 동기화
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDisclosures(false);
  };

  // 📱 국민연금 최신 공시 텔레그램 종합 브리핑 발송
  const handleSendTelegram = async () => {
    setSendingTelegram(true);
    try {
      const res = await fetch('/api/telegram/send-nps-briefing', { method: 'POST' });
      const resData = await res.json();
      if (resData.success) {
        showToast('✅ 🏛️ 국민연금 DART 최신 지분공시 브리핑이 텔레그램으로 전송되었습니다!');
      } else {
        alert(resData.error || '텔레그램 발송 실패');
      }
    } catch (e) {
      alert('발송 중 오류가 발생했습니다.');
    } finally {
      setSendingTelegram(false);
    }
  };

  // 🚨 실시간 감시 포착 알림 모의 테스트 발송
  const handleTestRealtimeAlert = async () => {
    setTestingAlert(true);
    try {
      const res = await fetch('/api/telegram/test-nps-realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockCode: '257720' }) // 실리콘투 5% 신규 편입 샘플
      });
      const resData = await res.json();
      if (resData.success) {
        showToast('🚀 🚨 국민연금 신규 공시 실시간 감시 포착 알림이 텔레그램으로 전송되었습니다!');
      } else {
        alert(resData.error || '테스트 발송 실패');
      }
    } catch (e) {
      alert('발송 중 오류가 발생했습니다.');
    } finally {
      setTestingAlert(false);
    }
  };

  // 📥 CSV 엑셀 다운로드
  const handleDownloadCsv = () => {
    if (!data || !data.disclosures) return;
    const headers = ['공시일자', '종목명', '종목코드', '보고구분', '현재지분율(%)', '직전지분율(%)', '변동폭(%p)', '보유주식수', '변동주수', '현재가', '평가액(억원)', '보고서명'];
    const rows = filteredDisclosures.map(d => [
      d.date,
      `"${d.corpName}"`,
      `"${d.stockCode}"`,
      `"${d.actionLabel}"`,
      d.currentRatio,
      d.prevRatio || 0,
      d.diffRatio,
      d.shares,
      d.diffShares,
      d.currentPrice || 0,
      d.valueEok || 0,
      `"${d.reportName}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `NPS_DART_Disclosures_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📥 국민연금 공시 CSV 파일이 다운로드되었습니다.');
  };

  // 필터링 및 정렬
  const filteredDisclosures = useMemo(() => {
    if (!data || !data.disclosures) return [];
    let list = [...data.disclosures];

    // 1. 카테고리 필터
    if (activeFilter === 'NEW') {
      list = list.filter(d => d.action === 'NEW');
    } else if (activeFilter === 'INCREASE') {
      list = list.filter(d => d.action === 'INCREASE');
    } else if (activeFilter === 'DECREASE') {
      list = list.filter(d => d.action === 'DECREASE' || d.action === 'SOLD');
    } else if (activeFilter === 'LARGE_CAP') {
      list = list.filter(d => (d.valueEok || 0) >= 10000); // 1조원 이상
    }

    // 2. 검색어 필터
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(d => 
        (d.corpName || '').toLowerCase().includes(q) ||
        (d.stockCode || '').toLowerCase().includes(q) ||
        (d.reportName || '').toLowerCase().includes(q) ||
        (d.actionLabel || '').toLowerCase().includes(q)
      );
    }

    // 3. 정렬
    if (sortBy === 'DATE_DESC') {
      list.sort((a, b) => b.date.localeCompare(a.date));
    } else if (sortBy === 'DIFF_DESC') {
      list.sort((a, b) => (b.diffRatio || 0) - (a.diffRatio || 0));
    } else if (sortBy === 'RATIO_DESC') {
      list.sort((a, b) => (b.currentRatio || 0) - (a.currentRatio || 0));
    } else if (sortBy === 'VALUE_DESC') {
      list.sort((a, b) => (b.valueEok || 0) - (a.valueEok || 0));
    }

    return list;
  }, [data, activeFilter, searchQuery, sortBy]);

  const summary = data?.summary || { totalDisclosures: 0, new5PctCount: 0, increasedCount: 0, decreasedCount: 0 };

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

      {/* ─── 1. 상단 메인 헤더 배너 ─── */}
      <div style={{
        padding: '24px 28px',
        background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.4) 0%, rgba(99, 102, 241, 0.28) 50%, rgba(16, 185, 129, 0.28) 100%)',
        border: '2px solid rgba(99, 102, 241, 0.5)',
        borderRadius: 22,
        marginBottom: 20,
        boxShadow: '0 10px 36px rgba(0,0,0,0.45)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ filter: 'drop-shadow(0 0 12px #6366f1)' }}>🏛️ 국민연금 DART 공시 실시간 감시 터미널</span>
              <span style={{
                fontSize: '.75rem',
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                border: '1px solid #10b981',
                padding: '4px 12px',
                borderRadius: 20,
                fontWeight: 900,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}>
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 10px #10b981',
                  display: 'inline-block'
                }}/>
                24H 실시간 자동 감시 엔진 가동 중 (30초 주기)
              </span>
            </div>
            <div style={{ fontSize: '.92rem', color: 'var(--t2)', marginTop: 8, lineHeight: 1.6 }}>
              국민연금공단의 <strong>5% 이상 신규 편입 및 지분 변동 공시</strong>를 30초 주기로 백그라운드 자동 감시하며, 새로운 공시 발생 시 <strong>스마트폰 텔레그램으로 즉시 자동 푸시 알림</strong>을 발송합니다.
            </div>
          </div>

          {/* 액션 버튼 그룹 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* 🚨 실시간 포착 알림 테스트 */}
            <button
              onClick={handleTestRealtimeAlert}
              disabled={testingAlert}
              style={{
                padding: '10px 16px',
                background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                border: 'none',
                borderRadius: 12,
                color: '#fff',
                fontWeight: 900,
                cursor: testingAlert ? 'not-allowed' : 'pointer',
                fontSize: '.85rem',
                boxShadow: '0 4px 14px rgba(239,68,68,0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>{testingAlert ? '⏳' : '🚨'}</span>
              <span>{testingAlert ? '발송 중...' : '실시간 감시 포착 알림 테스트'}</span>
            </button>

            {/* 텔레그램 종합 브리핑 전송 */}
            <button
              onClick={handleSendTelegram}
              disabled={sendingTelegram}
              style={{
                padding: '10px 16px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                border: 'none',
                borderRadius: 12,
                color: '#fff',
                fontWeight: 900,
                cursor: sendingTelegram ? 'not-allowed' : 'pointer',
                fontSize: '.85rem',
                boxShadow: '0 4px 14px rgba(79,70,229,0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>{sendingTelegram ? '⏳' : '📱'}</span>
              <span>{sendingTelegram ? '전송 중...' : '공시 전체 브리핑 텔레그램 전송'}</span>
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
              onClick={handleRefresh}
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

      {/* ─── 2. 4대 KPI 요약 통계 카드 ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { id: 'ALL', label: '🏛️ 전체 감시 공시', count: summary.totalDisclosures, color: '#818cf8', desc: '국민연금 5% 대량보유 공시' },
          { id: 'NEW', label: '🆕 5% 신규 취득 공시', count: summary.new5PctCount, color: '#10b981', desc: '신규 5% 이상 편입 보고' },
          { id: 'INCREASE', label: '📈 지분 확대 (순매수)', count: summary.increasedCount, color: '#60a5fa', desc: '장내 매수 비중 확대' },
          { id: 'DECREASE', label: '📉 지분 축소 / 매도', count: (summary.decreasedCount || 0) + (summary.soldCount || 0), color: '#f87171', desc: '장내 매도 비중 축소' },
        ].map(card => {
          const isSelected = activeFilter === card.id;
          return (
            <div
              key={card.id}
              onClick={() => setActiveFilter(card.id)}
              style={{
                padding: '16px 18px',
                borderRadius: 16,
                background: isSelected ? `${card.color}25` : 'rgba(30, 41, 59, 0.75)',
                border: isSelected ? `2px solid ${card.color}` : '1px solid rgba(255,255,255,0.08)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isSelected ? `0 0 16px ${card.color}40` : 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '.84rem', fontWeight: 800, color: card.color }}>{card.label}</span>
                <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#fff', fontFamily: 'Space Mono' }}>{card.count}건</span>
              </div>
              <div style={{ fontSize: '.74rem', color: 'var(--t2)', marginTop: 4 }}>{card.desc}</div>
              <div style={{ fontSize: '.72rem', color: card.color, fontWeight: 800, marginTop: 8 }}>
                {isSelected ? '✅ 필터링 적용 중' : '클릭 시 필터 ➔'}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── 3. 필터 칩스 & 검색 & 정렬 바 ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        {/* 필터 칩스 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `🌐 전체 (${summary.totalDisclosures})` },
            { id: 'NEW', label: `🆕 5% 신규취득 (${summary.new5PctCount})` },
            { id: 'INCREASE', label: `📈 지분 확대 (${summary.increasedCount})` },
            { id: 'DECREASE', label: `📉 지분 축소 (${summary.decreasedCount})` },
            { id: 'LARGE_CAP', label: `🔥 1조원 이상 대형주` }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              style={{
                padding: '8px 14px',
                borderRadius: 12,
                border: activeFilter === f.id ? '1.5px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                background: activeFilter === f.id ? 'rgba(99, 102, 241, 0.25)' : 'rgba(0,0,0,0.3)',
                color: activeFilter === f.id ? '#fff' : 'var(--t3)',
                fontWeight: 900,
                fontSize: '.84rem',
                cursor: 'pointer'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 검색 & 정렬 컨트롤 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', padding: '8px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
            <span>🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="종목명, 종목코드 검색..."
              style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '.85rem', width: '150px' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer' }}>✕</button>
            )}
          </div>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            style={{
              padding: '8px 12px',
              background: 'var(--bg2)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              color: '#fff',
              fontSize: '.84rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="DATE_DESC">📅 최신 공시일자순</option>
            <option value="DIFF_DESC">📈 지분율 변동폭순</option>
            <option value="RATIO_DESC">🏆 지분율 높은순</option>
            <option value="VALUE_DESC">💰 평가금액순</option>
          </select>
        </div>
      </div>

      {/* ─── 4. 국민연금 DART 공시 테이블 & 상세 뷰 ─── */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>DART 전자공시 시스템에서 국민연금 공시를 실시간 감시 중입니다...</div>
        </div>
      ) : filteredDisclosures.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', borderRadius: 18 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🏛️</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>해당 조건의 국민연금 공시 내역이 없습니다.</div>
        </div>
      ) : (
        <div style={{
          background: 'rgba(30, 41, 59, 0.75)',
          borderRadius: 20,
          border: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden',
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--t3)' }}>
                  <th style={{ padding: '14px 18px', fontWeight: 800 }}>공시일자</th>
                  <th style={{ padding: '14px 18px', fontWeight: 800 }}>발행회사 (종목코드)</th>
                  <th style={{ padding: '14px 18px', fontWeight: 800 }}>보고구분</th>
                  <th style={{ padding: '14px 18px', fontWeight: 800 }}>지분율 변동</th>
                  <th style={{ padding: '14px 18px', fontWeight: 800 }}>보유주식수 (변동)</th>
                  <th style={{ padding: '14px 18px', fontWeight: 800 }}>실시간 현재가</th>
                  <th style={{ padding: '14px 18px', fontWeight: 800 }}>평가금액</th>
                  <th style={{ padding: '14px 18px', fontWeight: 800 }}>DART 원문</th>
                </tr>
              </thead>
              <tbody>
                {filteredDisclosures.map((item, idx) => {
                  const isUp = item.diffRatio > 0;
                  const isDown = item.diffRatio < 0;
                  const diffColor = isUp ? '#3b82f6' : isDown ? '#f87171' : 'var(--t3)';

                  return (
                    <tr
                      key={item.id || idx}
                      onClick={() => setSelectedItem(item)}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        cursor: 'pointer',
                        background: selectedItem?.id === item.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      {/* 1. 공시일자 */}
                      <td style={{ padding: '14px 18px', color: 'var(--t2)', fontFamily: 'Space Mono', fontSize: '.84rem' }}>
                        📅 {item.date}
                      </td>

                      {/* 2. 기업명 (종목코드) */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 900, color: '#fff', fontSize: '.95rem' }}>{item.corpName}</div>
                        <div style={{ fontSize: '.76rem', color: 'var(--t3)', fontFamily: 'Space Mono' }}>{item.stockCode}</div>
                      </td>

                      {/* 3. 보고구분 뱃지 */}
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: 8,
                          fontSize: '.76rem',
                          fontWeight: 900,
                          background: `${item.actionColor}20`,
                          color: item.actionColor,
                          border: `1px solid ${item.actionColor}50`
                        }}>
                          {item.actionLabel}
                        </span>
                      </td>

                      {/* 4. 지분율 변동 */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 900, color: '#fff', fontSize: '1.05rem', fontFamily: 'Space Mono' }}>
                          {item.currentRatio}%
                        </div>
                        <div style={{ fontSize: '.78rem', color: diffColor, fontWeight: 800, fontFamily: 'Space Mono' }}>
                          {item.prevRatio !== null && item.prevRatio > 0 ? `${item.prevRatio}% ➔ ` : ''}
                          {isUp ? `+${item.diffRatio}%p ▲` : `${item.diffRatio}%p ▼`}
                        </div>
                      </td>

                      {/* 5. 보유주식수 */}
                      <td style={{ padding: '14px 18px', fontFamily: 'Space Mono' }}>
                        <div style={{ color: '#fff', fontWeight: 800 }}>{formatNumber(item.shares)}주</div>
                        {item.diffShares !== 0 && (
                          <div style={{ fontSize: '.76rem', color: diffColor }}>
                            {item.diffShares > 0 ? `+${formatNumber(item.diffShares)}주` : `${formatNumber(item.diffShares)}주`}
                          </div>
                        )}
                      </td>

                      {/* 6. 실시간 현재가 */}
                      <td style={{ padding: '14px 18px', fontFamily: 'Space Mono' }}>
                        <div style={{ color: '#fff', fontWeight: 800 }}>
                          {item.currentPrice > 0 ? `${formatNumber(item.currentPrice)}원` : '-'}
                        </div>
                        {item.dayChangePct !== undefined && item.dayChangePct !== 0 && (
                          <div style={{ fontSize: '.76rem', color: item.dayChangePct >= 0 ? 'var(--up)' : 'var(--dn)', fontWeight: 800 }}>
                            {item.dayChangePct >= 0 ? '+' : ''}{item.dayChangePct}%
                          </div>
                        )}
                      </td>

                      {/* 7. 평가금액 */}
                      <td style={{ padding: '14px 18px', fontFamily: 'Space Mono', color: '#fbbf24', fontWeight: 900 }}>
                        {item.valueEok > 0 ? `${formatNumber(item.valueEok)}억 원` : '-'}
                      </td>

                      {/* 8. DART 원문 바로가기 버튼 */}
                      <td style={{ padding: '14px 18px' }} onClick={e => e.stopPropagation()}>
                        <a
                          href={`https://dart.fss.or.kr/dsac001/main.do?selectKey=${encodeURIComponent(item.corpName)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '6px 12px',
                            background: 'rgba(59, 130, 246, 0.15)',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            borderRadius: 8,
                            color: '#60a5fa',
                            fontSize: '.78rem',
                            fontWeight: 800,
                            textDecoration: 'none',
                            display: 'inline-block'
                          }}
                        >
                          📑 DART 공시 ↗
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── 5. 선택된 공시 상세 모달 팝업 ─── */}
      {selectedItem && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 4000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
          onClick={() => setSelectedItem(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              background: '#1e293b',
              border: `2px solid ${selectedItem.actionColor}`,
              borderRadius: 22,
              padding: '28px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
              animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.4rem' }}>🏛️</span>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff' }}>{selectedItem.corpName}</div>
                  <div style={{ fontSize: '.78rem', color: 'var(--t3)', fontFamily: 'Space Mono' }}>{selectedItem.stockCode}</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--t3)', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: 12 }}>
                <span style={{ color: 'var(--t3)', fontSize: '.84rem' }}>보고서명</span>
                <span style={{ color: '#fff', fontWeight: 800, fontSize: '.88rem' }}>{selectedItem.reportName}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: 12 }}>
                <span style={{ color: 'var(--t3)', fontSize: '.84rem' }}>제출인</span>
                <span style={{ color: '#60a5fa', fontWeight: 800, fontSize: '.88rem' }}>{selectedItem.submitter}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: 12 }}>
                  <div style={{ color: 'var(--t3)', fontSize: '.76rem' }}>지분율 변동</div>
                  <div style={{ color: '#fff', fontWeight: 900, fontSize: '1.2rem', fontFamily: 'Space Mono', marginTop: 4 }}>
                    {selectedItem.currentRatio}%
                  </div>
                  <div style={{ color: selectedItem.actionColor, fontSize: '.78rem', fontWeight: 800, marginTop: 2 }}>
                    변동: {selectedItem.diffRatio > 0 ? `+${selectedItem.diffRatio}%p` : `${selectedItem.diffRatio}%p`}
                  </div>
                </div>

                <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: 12 }}>
                  <div style={{ color: 'var(--t3)', fontSize: '.76rem' }}>보유주식수</div>
                  <div style={{ color: '#fff', fontWeight: 900, fontSize: '1.1rem', fontFamily: 'Space Mono', marginTop: 4 }}>
                    {formatNumber(selectedItem.shares)}주
                  </div>
                  <div style={{ color: '#fbbf24', fontSize: '.78rem', fontWeight: 800, marginTop: 2 }}>
                    평가액: {formatNumber(selectedItem.valueEok)}억 원
                  </div>
                </div>
              </div>

              <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: 12 }}>
                <div style={{ color: 'var(--t3)', fontSize: '.76rem' }}>보유 목적 및 취득 방식</div>
                <div style={{ color: '#fff', fontSize: '.84rem', marginTop: 4, lineHeight: 1.5 }}>
                  • <strong>목적:</strong> {selectedItem.purpose}<br/>
                  • <strong>방식:</strong> {selectedItem.acquisitionMethod}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <a
                  href={`https://dart.fss.or.kr/dsac001/main.do?selectKey=${encodeURIComponent(selectedItem.corpName)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding: '10px 18px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    borderRadius: 10,
                    color: '#fff',
                    fontWeight: 900,
                    textDecoration: 'none',
                    fontSize: '.85rem'
                  }}
                >
                  📑 DART 전자공시시스템 원문 바로가기 ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 6. 실시간 자동 감시 안내 박스 ─── */}
      <div style={{
        marginTop: 24,
        padding: '22px 26px',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
        border: '1.5px solid rgba(16, 185, 129, 0.4)',
        borderRadius: 20,
      }}>
        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🔔</span>
          <span>국민연금 5% DART 공시 실시간 자동 감시(Real-time Push) 작동 원리</span>
        </div>
        <div style={{ fontSize: '.86rem', color: 'var(--t2)', lineHeight: 1.7 }}>
          • <strong>30초 주기 백그라운드 상시 감시:</strong> 서버 백그라운드 엔진이 DART 전자공시를 30초마다 자동으로 스캔합니다.<br/>
          • <strong>신규 5% 편입 및 대량 확대 즉시 감지:</strong> 국민연금이 신규로 5%를 돌파하거나, 기존 종목 지분을 대량 확대한 공시가 등록되면 <strong>별도의 조작 없이도 스마트폰 텔레그램으로 팝업 알림</strong>이 전송됩니다.<br/>
          • <strong>중복 발송 방지:</strong> 이미 발송된 공시는 고유 ID 기반으로 기록되어 중복 울림 없이 신규 공시만 깔끔하게 받아보실 수 있습니다.
        </div>
      </div>
    </div>
  );
}
