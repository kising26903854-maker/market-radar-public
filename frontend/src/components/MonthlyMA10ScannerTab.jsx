// MonthlyMA10ScannerTab.jsx — 🎯 월봉 10이평선 지지 + 2개월 연속 상승 스캐너
import React, { useState, useEffect, useMemo } from 'react';

const formatNumber = (num) => new Intl.NumberFormat('ko-KR').format(num || 0);

// marketCap은 억원 단위로 전달됨 (예: 12345 -> "1조 2,345억")
const formatMarketCap = (eok) => {
  if (!eok) return '-';
  if (eok >= 10000) {
    const jo = Math.floor(eok / 10000);
    const rem = Math.round(eok % 10000);
    return `${jo.toLocaleString()}조${rem > 0 ? ' ' + rem.toLocaleString() + '억' : ''}`;
  }
  return `${Math.round(eok).toLocaleString()}억`;
};

const formatMonthDate = (yyyymmdd) => {
  if (!yyyymmdd || yyyymmdd.length < 6) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}.${yyyymmdd.slice(4, 6)}`;
};

export default function MonthlyMA10ScannerTab({ onSelectStock }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const [marketFilter, setMarketFilter] = useState('ALL'); // 'ALL' | '코스피' | '코스닥'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'TIGHT' | 'RISING' | 'STRONG'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('CAP_DESC'); // 'CAP_DESC' | 'SCORE_DESC' | 'STREAK_DESC' | 'GAIN_DESC'

  // 상단 요약 카드 체크박스 — 체크된 카드가 있으면 해당 조건에 해당하는 종목만 표시 (OR 조건)
  const [cardChecks, setCardChecks] = useState({ KOSPI: false, KOSDAQ: false, TIGHT: false, UNIVERSE: false });
  const toggleCard = (key) => setCardChecks(prev => ({ ...prev, [key]: !prev[key] }));

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchStocks = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch('/api/monthly-ma10-stocks');
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error('월봉 10이평선 지지 종목 로드 실패:', err);
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStocks();
    const interval = setInterval(() => fetchStocks(true), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/trigger-monthly-ma10-scan', { method: 'POST' });
      showToast('🔄 월봉 10이평선 지지 패턴 재스캔이 백그라운드에서 시작되었습니다. 잠시 후 새로고침 해주세요.');
    } catch (e) {
      showToast('재스캔 요청 중 오류가 발생했습니다.');
    } finally {
      setTimeout(() => fetchStocks(false), 3000);
    }
  };

  const handleDownloadCsv = () => {
    if (!data || !data.stocks) return;
    const headers = ['순위', '종목명', '종목코드', '시장', '시가총액(억원)', '현재가', '스코어', '상태', '10이평선', '이평선대비(%)', '연속지지개월', '평균여유폭(%)', '2개월상승률(%)'];
    const rows = filteredStocks.map((s, idx) => [
      idx + 1, `"${s.name}"`, `"${s.code}"`, `"${s.market}"`, s.marketCap, s.currentPrice, s.score, `"${s.status}"`,
      s.ma10, s.marginPct, s.supportStreakMonths, s.avgMarginPct, s.twoMonthGainPct
    ]);
    const csvContent = '﻿' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `MonthlyMA10_Scan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📥 월봉 10이평선 지지 종목 CSV 파일이 다운로드되었습니다.');
  };

  const filteredStocks = useMemo(() => {
    if (!data || !data.stocks) return [];
    let list = [...data.stocks];

    if (marketFilter !== 'ALL') list = list.filter(s => s.market === marketFilter);

    if (statusFilter === 'TIGHT') list = list.filter(s => s.status.includes('밀착'));
    else if (statusFilter === 'RISING') list = list.filter(s => s.status.includes('지지 상승'));
    else if (statusFilter === 'STRONG') list = list.filter(s => s.status.includes('강한 상승'));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s => (s.name || '').toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q));
    }

    // 상단 요약 카드 체크박스 필터: 체크된 항목이 하나라도 있으면 OR 조건으로 좁힘.
    // "전체 스캔 유니버스"가 체크되면 다른 체크와 무관하게 전체를 보여줌.
    const anyCardChecked = cardChecks.KOSPI || cardChecks.KOSDAQ || cardChecks.TIGHT || cardChecks.UNIVERSE;
    if (anyCardChecked && !cardChecks.UNIVERSE) {
      list = list.filter(s =>
        (cardChecks.KOSPI && s.market === '코스피') ||
        (cardChecks.KOSDAQ && s.market === '코스닥') ||
        (cardChecks.TIGHT && s.status.includes('밀착'))
      );
    }

    if (sortBy === 'CAP_DESC') list.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    else if (sortBy === 'SCORE_DESC') list.sort((a, b) => b.score - a.score);
    else if (sortBy === 'STREAK_DESC') list.sort((a, b) => b.supportStreakMonths - a.supportStreakMonths);
    else if (sortBy === 'GAIN_DESC') list.sort((a, b) => b.twoMonthGainPct - a.twoMonthGainPct);

    return list;
  }, [data, marketFilter, statusFilter, searchQuery, sortBy, cardChecks]);

  const kospiCount = data?.kospiCount || 0;
  const kosdaqCount = data?.kosdaqCount || 0;
  const totalScanned = data?.totalScanned || 0;
  const lastSyncAt = data?.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString('ko-KR') : '스캔 대기 중';
  const isScanning = data?.scanning;

  return (
    <div style={{ padding: '10px 0', animation: 'fadeIn 0.3s ease-in-out' }}>
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '14px 20px',
          background: 'rgba(15, 23, 42, 0.95)', border: '1.5px solid #10b981', borderRadius: 14,
          color: '#fff', fontWeight: 800, fontSize: '.9rem', zIndex: 5000,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)', animation: 'slideUp 0.3s ease-out'
        }}>
          {toastMessage}
        </div>
      )}

      {/* ─── 1. 상단 메인 헤더 배너 ─── */}
      <div style={{
        padding: '24px 28px',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25) 0%, rgba(59, 130, 246, 0.2) 50%, rgba(99, 102, 241, 0.2) 100%)',
        border: '2px solid rgba(16, 185, 129, 0.45)', borderRadius: 22, marginBottom: 20,
        boxShadow: '0 10px 36px rgba(0,0,0,0.45)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ filter: 'drop-shadow(0 0 12px #10b981)' }}>🎯 월봉 10이평선 지지 + 상승초입 스캐너</span>
              <span style={{
                fontSize: '.75rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399',
                border: '1px solid #10b981', padding: '4px 12px', borderRadius: 20, fontWeight: 900,
                display: 'inline-flex', alignItems: 'center', gap: 6
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: isScanning ? '#fbbf24' : '#10b981', boxShadow: `0 0 10px ${isScanning ? '#fbbf24' : '#10b981'}`, display: 'inline-block' }} />
                {isScanning ? '최초 전종목 스캔 진행 중...' : `코스피+코스닥 ${totalScanned.toLocaleString()}종목 스캔 완료`}
              </span>
            </div>
            <div style={{ fontSize: '.92rem', color: 'var(--t2)', marginTop: 8, lineHeight: 1.6 }}>
              코스피·코스닥 <strong>시가총액 상위 종목</strong>을 대상으로, 최근 24개월 월봉 종가가 <strong>10개월 이동평균선을 최근 4개월 이상 깨지 않고 지지</strong>하면서, <strong>최근 2개월 연속 전월 대비 상승</strong> 중인 종목을 발굴합니다. 국내 개인투자자들이 널리 쓰는 "10개월선 추세추종" 원칙 기반입니다.
            </div>
            <div style={{ fontSize: '.76rem', color: 'var(--t3)', marginTop: 6 }}>
              마지막 스캔: {lastSyncAt}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={handleDownloadCsv} style={{
              padding: '10px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 12, color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: '.85rem'
            }}>
              📥 CSV
            </button>
            <button onClick={handleRefresh} disabled={refreshing} style={{
              padding: '10px 16px', background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)', border: 'none',
              borderRadius: 12, color: '#fff', fontWeight: 900, cursor: refreshing ? 'not-allowed' : 'pointer',
              fontSize: '.85rem', boxShadow: '0 4px 14px rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', gap: 6
            }}>
              <span>{refreshing ? '⏳' : '🔄'}</span>
              <span>{refreshing ? '스캔 요청 중...' : '전종목 재스캔'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── 2. 시장별 요약 카드 (체크박스로 필터링 가능) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        <label style={{ cursor: 'pointer', padding: '18px 20px', borderRadius: 18, background: cardChecks.KOSPI ? 'rgba(59, 130, 246, 0.18)' : 'rgba(30, 41, 59, 0.8)', border: `1.5px solid ${cardChecks.KOSPI ? '#60a5fa' : 'rgba(59, 130, 246, 0.45)'}`, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 800, color: '#60a5fa' }}>🔵 코스피 발굴 종목</span>
            <input type="checkbox" checked={cardChecks.KOSPI} onChange={() => toggleCard('KOSPI')} style={{ width: 18, height: 18, accentColor: '#60a5fa', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fff', marginTop: 8, fontFamily: 'Space Mono' }}>
            {kospiCount} <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--t3)' }}>종목</span>
          </div>
        </label>
        <label style={{ cursor: 'pointer', padding: '18px 20px', borderRadius: 18, background: cardChecks.KOSDAQ ? 'rgba(167, 139, 250, 0.18)' : 'rgba(30, 41, 59, 0.8)', border: `1.5px solid ${cardChecks.KOSDAQ ? '#a78bfa' : 'rgba(167, 139, 250, 0.45)'}`, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 800, color: '#a78bfa' }}>🟣 코스닥 발굴 종목</span>
            <input type="checkbox" checked={cardChecks.KOSDAQ} onChange={() => toggleCard('KOSDAQ')} style={{ width: 18, height: 18, accentColor: '#a78bfa', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fff', marginTop: 8, fontFamily: 'Space Mono' }}>
            {kosdaqCount} <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--t3)' }}>종목</span>
          </div>
        </label>
        <label style={{ cursor: 'pointer', padding: '18px 20px', borderRadius: 18, background: cardChecks.TIGHT ? 'rgba(16, 185, 129, 0.18)' : 'rgba(30, 41, 59, 0.8)', border: `1.5px solid ${cardChecks.TIGHT ? '#34d399' : 'rgba(16, 185, 129, 0.45)'}`, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 800, color: '#34d399' }}>🎯 10선 밀착 지지 종목</span>
            <input type="checkbox" checked={cardChecks.TIGHT} onChange={() => toggleCard('TIGHT')} style={{ width: 18, height: 18, accentColor: '#34d399', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fff', marginTop: 8, fontFamily: 'Space Mono' }}>
            {(data?.stocks || []).filter(s => s.status.includes('밀착')).length} <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--t3)' }}>종목</span>
          </div>
        </label>
        <label style={{ cursor: 'pointer', padding: '18px 20px', borderRadius: 18, background: cardChecks.UNIVERSE ? 'rgba(251, 191, 36, 0.18)' : 'rgba(30, 41, 59, 0.8)', border: `1.5px solid ${cardChecks.UNIVERSE ? '#fbbf24' : 'rgba(251, 191, 36, 0.45)'}`, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 800, color: '#fbbf24' }}>📡 전체 스캔 유니버스</span>
            <input type="checkbox" checked={cardChecks.UNIVERSE} onChange={() => toggleCard('UNIVERSE')} style={{ width: 18, height: 18, accentColor: '#fbbf24', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fbbf24', marginTop: 8, fontFamily: 'Space Mono' }}>
            {totalScanned.toLocaleString()} <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--t3)' }}>종목</span>
          </div>
        </label>
      </div>
      {(cardChecks.KOSPI || cardChecks.KOSDAQ || cardChecks.TIGHT || cardChecks.UNIVERSE) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, marginTop: -8 }}>
          <span style={{ fontSize: '.78rem', color: 'var(--t3)' }}>체크된 카드 조건으로 {filteredStocks.length}개 종목만 표시 중</span>
          <button onClick={() => setCardChecks({ KOSPI: false, KOSDAQ: false, TIGHT: false, UNIVERSE: false })} style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, color: 'var(--t2)', fontSize: '.74rem', fontWeight: 800, cursor: 'pointer' }}>
            체크 초기화
          </button>
        </div>
      )}

      {/* ─── 3. 필터 & 검색 & 정렬 바 ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `🌐 전체 (${data?.stocks?.length || 0})`, color: '#10b981' },
            { id: '코스피', label: `🔵 코스피 (${kospiCount})`, color: '#3b82f6' },
            { id: '코스닥', label: `🟣 코스닥 (${kosdaqCount})`, color: '#a78bfa' },
          ].map(f => (
            <button key={f.id} onClick={() => setMarketFilter(f.id)} style={{
              padding: '8px 14px', borderRadius: 12,
              border: marketFilter === f.id ? `1.5px solid ${f.color}` : '1px solid rgba(255,255,255,0.08)',
              background: marketFilter === f.id ? `${f.color}25` : 'rgba(0,0,0,0.3)',
              color: marketFilter === f.id ? '#fff' : 'var(--t3)', fontWeight: 900, fontSize: '.84rem', cursor: 'pointer'
            }}>
              {f.label}
            </button>
          ))}
          <span style={{ width: 1, background: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
          {[
            { id: 'ALL', label: '전체 상태' },
            { id: 'TIGHT', label: '🎯 10선 밀착 지지', color: '#34d399' },
            { id: 'RISING', label: '📈 10선 지지 상승', color: '#60a5fa' },
            { id: 'STRONG', label: '🚀 10선 위 강한 상승', color: '#fbbf24' },
          ].map(f => (
            <button key={f.id} onClick={() => setStatusFilter(f.id)} style={{
              padding: '8px 14px', borderRadius: 12,
              border: statusFilter === f.id ? `1.5px solid ${f.color || '#10b981'}` : '1px solid rgba(255,255,255,0.08)',
              background: statusFilter === f.id ? `${f.color || '#10b981'}25` : 'rgba(0,0,0,0.3)',
              color: statusFilter === f.id ? '#fff' : 'var(--t3)', fontWeight: 900, fontSize: '.84rem', cursor: 'pointer'
            }}>
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', padding: '8px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
            <span>🔍</span>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="종목명, 코드 검색..."
              style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '.85rem', width: '140px' }} />
            {searchQuery && <button onClick={() => setSearchQuery('')} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer' }}>✕</button>}
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
            padding: '8px 12px', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
            color: '#fff', fontSize: '.84rem', outline: 'none', cursor: 'pointer'
          }}>
            <option value="CAP_DESC">💰 시가총액 큰순</option>
            <option value="SCORE_DESC">🏆 패턴 스코어 높은순</option>
            <option value="STREAK_DESC">🛡️ 지지 개월수 긴순</option>
            <option value="GAIN_DESC">📈 2개월 상승률 높은순</option>
          </select>
        </div>
      </div>

      {/* ─── 4. 종목 카드 그리드 ─── */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>월봉 10이평선 지지 데이터를 불러오는 중...</div>
        </div>
      ) : isScanning ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', borderRadius: 18 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📡</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>코스피+코스닥 전종목 최초 스캔이 백그라운드에서 진행 중입니다.</div>
          <div style={{ fontSize: '.85rem', marginTop: 8 }}>잠시 후 새로고침 해주세요.</div>
        </div>
      ) : filteredStocks.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', borderRadius: 18 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>해당 조건의 월봉 10이평선 지지 종목이 없습니다.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 16, marginBottom: 24 }}>
          {filteredStocks.map((stock, idx) => {
            const statusColor = stock.status.includes('밀착') ? '#34d399' : stock.status.includes('강한') ? '#fbbf24' : '#60a5fa';
            const isUp = stock.changePct >= 0;
            const marketColor = stock.market === '코스피' ? '#3b82f6' : '#a78bfa';

            return (
              <div key={stock.code} className="card"
                onClick={() => onSelectStock && onSelectStock({ ...stock, current_price: stock.currentPrice, type: stock.market })}
                style={{
                  padding: 20, background: 'rgba(30, 41, 59, 0.75)', border: `1.5px solid ${statusColor}50`,
                  borderRadius: 18, cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 8px', background: idx < 3 ? 'rgba(234,179,8,0.25)' : 'rgba(255,255,255,0.08)', color: idx < 3 ? '#fbbf24' : 'var(--t3)', borderRadius: 6, fontWeight: 900, fontSize: '.75rem' }}>
                        #{idx + 1}
                      </span>
                      <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fff' }}>{stock.name}</span>
                      <span style={{ fontSize: '.78rem', color: 'var(--t3)', fontFamily: 'Space Mono' }}>{stock.code}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '.7rem', fontWeight: 900, background: `${marketColor}20`, color: marketColor, border: `1px solid ${marketColor}50` }}>
                        {stock.market}
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '.7rem', fontWeight: 900, background: 'rgba(255,255,255,0.06)', color: 'var(--t2)' }}>
                        스코어 {stock.score}점
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: '.7rem', fontWeight: 900, background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
                        시총 {formatMarketCap(stock.marketCap)}
                      </span>
                    </div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: '.74rem', fontWeight: 900, background: `${statusColor}20`, color: statusColor, border: `1px solid ${statusColor}50`, whiteSpace: 'nowrap' }}>
                    {stock.status}
                  </span>
                </div>

                {/* 월봉 10이평선 지지 상세 박스 */}
                <div style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.4)', borderRadius: 14, border: `1px solid ${statusColor}40`, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', marginBottom: 8 }}>
                    <div>
                      <div style={{ color: 'var(--t3)' }}>10개월 이평선</div>
                      <div style={{ fontWeight: 900, color: '#fff', fontFamily: 'Space Mono' }}>{formatNumber(stock.ma10)}원</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'var(--t3)' }}>이평선 대비</div>
                      <div style={{ fontWeight: 900, color: '#34d399', fontFamily: 'Space Mono' }}>+{stock.marginPct}%</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--t3)' }}>연속 지지</div>
                      <div style={{ fontWeight: 900, color: '#fff', fontFamily: 'Space Mono' }}>{stock.supportStreakMonths}개월</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: '.72rem', color: 'var(--t2)', flexWrap: 'wrap' }}>
                    <span>📈 2개월 상승률 <strong style={{ color: '#34d399' }}>+{stock.twoMonthGainPct}%</strong></span>
                    <span>📊 평균 여유폭 <strong style={{ color: '#fff' }}>{stock.avgMarginPct}%</strong></span>
                    <span>🗓 기준월 <strong style={{ color: '#fff' }}>{formatMonthDate(stock.currentDate)}</strong></span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <span style={{ fontSize: '.74rem', color: 'var(--t3)' }}>현재가: </span>
                    <strong style={{ color: '#fff', fontSize: '1rem', fontFamily: 'Space Mono' }}>{formatNumber(stock.currentPrice)}원</strong>
                    <span style={{ color: isUp ? 'var(--up)' : 'var(--dn)', fontSize: '.8rem', fontWeight: 800, marginLeft: 6 }}>
                      ({isUp ? '+' : ''}{stock.changePct}%)
                    </span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onSelectStock && onSelectStock({ ...stock, current_price: stock.currentPrice, type: stock.market }); }}
                    style={{ padding: '6px 12px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.5)', borderRadius: 8, color: '#818cf8', fontSize: '.76rem', fontWeight: 800, cursor: 'pointer' }}>
                    차트 상세보기 ➔
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── 5. 판정 기준 가이드 ─── */}
      <div style={{ padding: '22px 26px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)', border: '1.5px solid rgba(16, 185, 129, 0.4)', borderRadius: 20 }}>
        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>💡</span>
          <span>월봉 10이평선 지지 + 상승초입 판정 기준</span>
        </div>
        <div style={{ fontSize: '.86rem', color: 'var(--t2)', lineHeight: 1.7 }}>
          • <strong>지지 확인:</strong> 최근 달부터 거슬러 올라가며 월봉 종가가 10개월 이동평균선의 98% 이상을 유지한 <strong>연속 개월수가 4개월 이상</strong>인 종목만 대상으로 합니다(중간에 한 번이라도 깨지면 그 시점에서 연속 기록이 끊깁니다).<br />
          • <strong>상승초입 확인:</strong> 최근 2개월이 연속으로 전월 대비 상승(이번달 &gt; 지난달 &gt; 지지난달)했고, 2개월 누적 상승률이 <strong>3% 이상</strong>이어야 합니다.<br />
          • <strong>상태 뱃지:</strong> 현재가가 10이평선 대비 +5% 이내면 🎯 밀착 지지, +5~15%면 📈 지지 상승, +15% 초과면 🚀 강한 상승으로 구분합니다.<br />
          • 국내에서 널리 쓰이는 "월봉 10개월선 매매법"(10개월선 위에서는 보유, 이탈 시 매도)의 발굴판 버전입니다.
        </div>
      </div>
    </div>
  );
}
