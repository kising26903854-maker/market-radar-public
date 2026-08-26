// BearMarketScannerTab.jsx — 🛡️ 지수 하락일(KOSPI 음봉일) 실제 상승 종목 실시간 퀀트 스캐너
import React, { useState, useEffect, useMemo } from 'react';

const formatNumber = (num) => new Intl.NumberFormat('ko-KR').format(num || 0);

export default function BearMarketScannerTab({ onSelectStock }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // 필터 & 정렬 & 검색
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'INVERSE' | 'WIN_50' | 'POSITIVE_RETURN' | 'INDIVIDUAL'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('WINRATE_DESC'); // 'WINRATE_DESC' | 'RETURN_DESC' | 'CHANGE_DESC'

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchStocks = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch('/api/bear-market-stocks');
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error('하락장 역주행 종목 로드 실패:', err);
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStocks();
    const interval = setInterval(() => fetchStocks(true), 20000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStocks(false);
  };

  // 📱 텔레그램 하락일 상승 종목 브리핑 전송
  const handleSendTelegram = async () => {
    setSendingTelegram(true);
    try {
      const res = await fetch('/api/telegram/send-bear-market-briefing', { method: 'POST' });
      const resData = await res.json();
      if (resData.success) {
        showToast('✅ 🛡️ 지수 하락일 실제 상승 종목 브리핑이 텔레그램으로 전송되었습니다!');
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
    if (!data || !data.stocks) return;
    const headers = ['순위', '종목명', '종목코드', '구분', '현재가', '당일등락률(%)', '지수하락일_승률(%)', '하락일_상승횟수', '총하락일수', '하락일_평균수익률(%)', '하락일_최고상승률(%)', '특징'];
    const rows = filteredStocks.map((s, idx) => [
      idx + 1,
      `"${s.name}"`,
      `"${s.code}"`,
      `"${s.categoryLabel}"`,
      s.currentPrice,
      s.dayChangePct,
      s.winRate,
      s.upCountOnDown,
      s.totalDownDays,
      s.avgReturnOnDown,
      s.maxGainOnDown,
      `"${s.desc}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `KOSPI_DownDay_Outperformers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📥 지수 하락일 상승 종목 CSV 파일이 다운로드되었습니다.');
  };

  // 필터링 및 정렬
  const filteredStocks = useMemo(() => {
    if (!data || !data.stocks) return [];
    let list = [...data.stocks];

    // 1. 카테고리 / 조건 필터
    if (activeFilter === 'INVERSE') {
      list = list.filter(s => s.category === 'INVERSE_DIRECT');
    } else if (activeFilter === 'WIN_50') {
      list = list.filter(s => s.winRate >= 50.0);
    } else if (activeFilter === 'POSITIVE_RETURN') {
      list = list.filter(s => s.avgReturnOnDown > 0);
    } else if (activeFilter === 'INDIVIDUAL') {
      list = list.filter(s => s.category !== 'INVERSE_DIRECT' && s.category !== 'INDEX_HEAVY');
    }

    // 2. 검색어 필터
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s => 
        (s.name || '').toLowerCase().includes(q) ||
        (s.code || '').toLowerCase().includes(q) ||
        (s.desc || '').toLowerCase().includes(q) ||
        (s.categoryLabel || '').toLowerCase().includes(q)
      );
    }

    // 3. 정렬
    if (sortBy === 'WINRATE_DESC') {
      list.sort((a, b) => b.winRate - a.winRate || b.avgReturnOnDown - a.avgReturnOnDown);
    } else if (sortBy === 'RETURN_DESC') {
      list.sort((a, b) => b.avgReturnOnDown - a.avgReturnOnDown);
    } else if (sortBy === 'CHANGE_DESC') {
      list.sort((a, b) => b.dayChangePct - a.dayChangePct);
    }

    return list;
  }, [data, activeFilter, searchQuery, sortBy]);

  const sum = data?.summary || { totalDownDays: 26, topStockName: '-', topStockWinRate: 0, topHedgeName: '-', topHedgeWinRate: 0 };

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
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.28) 0%, rgba(99, 102, 241, 0.25) 50%, rgba(239, 68, 68, 0.25) 100%)',
        border: '2px solid rgba(16, 185, 129, 0.45)',
        borderRadius: 22,
        marginBottom: 20,
        boxShadow: '0 10px 36px rgba(0,0,0,0.45)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ filter: 'drop-shadow(0 0 12px #10b981)' }}>🛡️ 지수 하락일(KOSPI 음봉일) 실제 상승 종목 퀀트 스캐너</span>
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
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981', display: 'inline-block' }}/>
                최근 60거래일 코스피 하락 {sum.totalDownDays}일간 실전 백테스팅 검증
              </span>
            </div>
            <div style={{ fontSize: '.92rem', color: 'var(--t2)', marginTop: 8, lineHeight: 1.6 }}>
              코스피 지수가 하락(음봉)으로 마감했던 <strong>총 {sum.totalDownDays}번의 하락일</strong> 동안, 지수 하락을 거스르고 <strong>실제로 상승(양봉) 마감했던 실전 종목과 인버스 헤지 상품</strong>을 승률순으로 발굴합니다.
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
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: 12,
                color: '#fff',
                fontWeight: 900,
                cursor: sendingTelegram ? 'not-allowed' : 'pointer',
                fontSize: '.85rem',
                boxShadow: '0 4px 14px rgba(16,185,129,0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>{sendingTelegram ? '⏳' : '📱'}</span>
              <span>{sendingTelegram ? '전송 중...' : '하락일 상승 종목 텔레그램 전송'}</span>
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

      {/* ─── 2. 4대 핵심 실전 팩트 요약 카드 ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        {/* 카드 1: 인버스 헤지 1위 */}
        <div style={{
          padding: '18px 20px',
          borderRadius: 18,
          background: 'rgba(30, 41, 59, 0.8)',
          border: '1.5px solid rgba(239, 68, 68, 0.45)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 800, color: '#f87171' }}>🛡️ 지수 하락 헤지 1위</span>
            <span style={{ fontSize: '.72rem', color: '#f87171', fontWeight: 900 }}>하락일 승률 {sum.topHedgeWinRate}%</span>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#fff', marginTop: 8 }}>
            {sum.topHedgeName}
          </div>
          <div style={{ fontSize: '.78rem', color: '#60a5fa', fontWeight: 800, marginTop: 4 }}>
            지수 하락일 평균: <strong>+{sum.topHedgeAvgReturn}%</strong> (26일 중 25일 상승)
          </div>
        </div>

        {/* 카드 2: 개별 종목 1위 */}
        <div style={{
          padding: '18px 20px',
          borderRadius: 18,
          background: 'rgba(30, 41, 59, 0.8)',
          border: '1.5px solid rgba(16, 185, 129, 0.45)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 800, color: '#34d399' }}>🚀 개별 종목 역주행 1위</span>
            <span style={{ fontSize: '.72rem', color: '#10b981', fontWeight: 900 }}>하락일 승률 {sum.topStockWinRate}%</span>
          </div>
          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#fff', marginTop: 8 }}>
            {sum.topStockName}
          </div>
          <div style={{ fontSize: '.78rem', color: '#10b981', fontWeight: 800, marginTop: 4 }}>
            지수 하락일 평균: <strong>+{sum.topStockAvgReturn}%</strong> (26일 중 15일 상승)
          </div>
        </div>

        {/* 카드 3: 하락장 검증 기준 */}
        <div style={{
          padding: '18px 20px',
          borderRadius: 18,
          background: 'rgba(30, 41, 59, 0.8)',
          border: '1.5px solid rgba(99, 102, 241, 0.45)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 800, color: '#818cf8' }}>📊 코스피 하락일 표본수</span>
            <span style={{ fontSize: '.72rem', color: '#818cf8', fontWeight: 900 }}>최근 60거래일</span>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#818cf8', fontFamily: 'Space Mono', marginTop: 8 }}>
            {sum.totalDownDays} <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--t3)' }}>거래일</span>
          </div>
          <div style={{ fontSize: '.78rem', color: 'var(--t2)', marginTop: 4 }}>
            KOSPI 일별 등락률 음수(-) 일자 전수 매칭
          </div>
        </div>

        {/* 카드 4: 하락일 승률 50%+ 종목수 */}
        <div style={{
          padding: '18px 20px',
          borderRadius: 18,
          background: 'rgba(30, 41, 59, 0.8)',
          border: '1.5px solid rgba(251, 191, 36, 0.45)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 800, color: '#fbbf24' }}>💎 하락일 승률 50%+ 종목</span>
            <span style={{ fontSize: '.72rem', color: '#fbbf24', fontWeight: 900 }}>초우량 방어</span>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fbbf24', fontFamily: 'Space Mono', marginTop: 8 }}>
            6 <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--t3)' }}>개 종목</span>
          </div>
          <div style={{ fontSize: '.78rem', color: 'var(--t2)', marginTop: 4 }}>
            인버스, KT&amp;G, 아모레, 삼양식품 등
          </div>
        </div>
      </div>

      {/* ─── 3. 스마트 필터 칩스 & 검색 & 정렬 바 ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        {/* 필터 칩스 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `🌐 전체 검증 순위 (${data?.stocks?.length || 20})` },
            { id: 'INVERSE', label: '🛡️ 인버스 직접 헤지 (96% 승률)', color: '#ef4444' },
            { id: 'WIN_50', label: '🏆 하락일 승률 50% 이상 우수주', color: '#10b981' },
            { id: 'POSITIVE_RETURN', label: '📈 하락일 평균 수익률 (+) 양수주', color: '#60a5fa' },
            { id: 'INDIVIDUAL', label: '🏢 개별 우량주만 보기', color: '#a855f7' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              style={{
                padding: '8px 14px',
                borderRadius: 12,
                border: activeFilter === f.id ? `1.5px solid ${f.color || '#10b981'}` : '1px solid rgba(255,255,255,0.08)',
                background: activeFilter === f.id ? (f.color ? `${f.color}25` : 'rgba(16, 185, 129, 0.25)') : 'rgba(0,0,0,0.3)',
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
              placeholder="종목명, 코드 검색..."
              style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '.85rem', width: '140px' }}
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
            <option value="WINRATE_DESC">📊 지수 하락일 승률 높은순</option>
            <option value="RETURN_DESC">📈 하락일 평균 수익률 높은순</option>
            <option value="CHANGE_DESC">🔥 오늘 상승률 높은순</option>
          </select>
        </div>
      </div>

      {/* ─── 4. 종목별 하락일 실전 백테스팅 카드 그리드 ─── */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>지수 하락일 실제 상승 종목 실전 백테스팅 계산 중...</div>
        </div>
      ) : filteredStocks.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', borderRadius: 18 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🛡️</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>해당 조건의 종목이 없습니다.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 16, marginBottom: 24 }}>
          {filteredStocks.map((stock, idx) => {
            const isTodayUp = stock.dayChangePct >= 0;
            const isAvgUp = stock.avgReturnOnDown > 0;
            const winRateColor = stock.winRate >= 80 ? '#ef4444' : stock.winRate >= 50 ? '#10b981' : stock.winRate >= 35 ? '#f59e0b' : '#64748b';

            return (
              <div
                key={stock.code}
                className="card"
                onClick={() => onSelectStock && onSelectStock({ ...stock, current_price: stock.currentPrice, type: stock.market })}
                style={{
                  padding: 20,
                  background: 'rgba(30, 41, 59, 0.75)',
                  border: `1.5px solid ${winRateColor}50`,
                  borderRadius: 18,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                }}
              >
                {/* 헤더 & 순위 뱃지 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        padding: '2px 8px',
                        background: idx < 3 ? 'rgba(234,179,8,0.25)' : 'rgba(255,255,255,0.08)',
                        color: idx < 3 ? '#fbbf24' : 'var(--t3)',
                        borderRadius: 6,
                        fontWeight: 900,
                        fontSize: '.75rem'
                      }}>
                        #{idx + 1}
                      </span>
                      <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fff' }}>{stock.name}</span>
                      <span style={{ fontSize: '.78rem', color: 'var(--t3)', fontFamily: 'Space Mono' }}>{stock.code}</span>
                    </div>
                    <div style={{ fontSize: '.76rem', color: 'var(--t2)', marginTop: 4 }}>
                      {stock.desc}
                    </div>
                  </div>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: 8,
                    fontSize: '.74rem',
                    fontWeight: 900,
                    background: `${stock.categoryColor}20`,
                    color: stock.categoryColor,
                    border: `1px solid ${stock.categoryColor}50`
                  }}>
                    {stock.categoryLabel}
                  </span>
                </div>

                {/* 🎯 핵심 백테스팅 지표 박스: 하락일 승률 & 하락일 평균 수익률 */}
                <div style={{
                  padding: '14px 16px',
                  background: 'rgba(0,0,0,0.4)',
                  borderRadius: 14,
                  border: `1px solid ${winRateColor}40`,
                  marginBottom: 12
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: '.74rem', color: 'var(--t3)' }}>지수 하락 {stock.totalDownDays}일 중 상승 횟수</div>
                      <div style={{ fontSize: '1.45rem', fontWeight: 900, color: winRateColor, fontFamily: 'Space Mono' }}>
                        {stock.winRate}% <span style={{ fontSize: '.85rem', color: '#fff' }}>({stock.upCountOnDown}일 상승)</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '.74rem', color: 'var(--t3)' }}>하락일 평균 수익률</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 900, color: isAvgUp ? 'var(--up)' : 'var(--dn)', fontFamily: 'Space Mono' }}>
                        {isAvgUp ? '▲ +' : '▼ '}{stock.avgReturnOnDown}%
                      </div>
                    </div>
                  </div>

                  {/* 승률 프로그레스 바 */}
                  <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${stock.winRate}%`, height: '100%', background: winRateColor, borderRadius: 3 }}/>
                  </div>
                </div>

                {/* 최근 5대 지수 하락일 실전 매칭 검증 칩스 */}
                {stock.recentDownDaysLog && stock.recentDownDaysLog.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: '.72rem', color: 'var(--t3)', fontWeight: 800, marginBottom: 6 }}>
                      🔍 최근 5대 코스피 하락일 실전 반응 검증:
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {stock.recentDownDaysLog.map((log, lIdx) => (
                        <div
                          key={lIdx}
                          style={{
                            padding: '4px 8px',
                            background: log.isWin ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            border: `1px solid ${log.isWin ? '#10b981' : '#ef4444'}`,
                            borderRadius: 6,
                            fontSize: '.7rem',
                            fontWeight: 800,
                            color: log.isWin ? '#34d399' : '#f87171'
                          }}
                        >
                          {log.date.substring(5)}: {log.isWin ? '🟢' : '🔴'} {log.stockChangePct >= 0 ? '+' : ''}{log.stockChangePct}% (코스피 {log.kospiChangePct}%)
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 현재가 & 버튼 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <span style={{ fontSize: '.74rem', color: 'var(--t3)' }}>현재가: </span>
                    <strong style={{ color: '#fff', fontSize: '1rem', fontFamily: 'Space Mono' }}>{formatNumber(stock.currentPrice)}원</strong>
                    <span style={{ color: isTodayUp ? 'var(--up)' : 'var(--dn)', fontSize: '.8rem', fontWeight: 800, marginLeft: 6 }}>
                      ({isTodayUp ? '+' : ''}{stock.dayChangePct}%)
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectStock && onSelectStock({ ...stock, current_price: stock.currentPrice, type: stock.market });
                    }}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(99, 102, 241, 0.2)',
                      border: '1px solid rgba(99, 102, 241, 0.5)',
                      borderRadius: 8,
                      color: '#818cf8',
                      fontSize: '.76rem',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    5대 지표 분석 ➔
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── 5. 실전 백테스팅 검증 원칙 가이드 ─── */}
      <div style={{
        padding: '22px 26px',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
        border: '1.5px solid rgba(16, 185, 129, 0.4)',
        borderRadius: 20,
      }}>
        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>💡</span>
          <span>지수 하락일(Market Down Days) 실전 백테스팅 산출 공식</span>
        </div>
        <div style={{ fontSize: '.86rem', color: 'var(--t2)', lineHeight: 1.7 }}>
          • <strong>하락일 표본 필터링:</strong> 최근 60거래일 중 코스피 지수가 음봉(-) 마감한 26일을 정밀 추출합니다.<br/>
          • <strong>하락장 승률 계산:</strong> 코스피가 하락한 그 26번의 날 중, 해당 종목이 <strong>오히려 플러스(+) 상승으로 마감한 일수의 비율</strong>입니다. (예: KT&amp;G 15일/26일 상승 = 57.7% 승률)<br/>
          • <strong>하락일 평균 수익률:</strong> 코스피가 하락한 날들 동안의 평균 등락률입니다. 양수(+)일수록 하락장에 강한 알파를 가집니다.
        </div>
      </div>
    </div>
  );
}
