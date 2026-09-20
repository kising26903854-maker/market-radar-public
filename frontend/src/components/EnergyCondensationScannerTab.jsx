// EnergyCondensationScannerTab.jsx — 💥 에너지 응축(변동성·거래량 수축) → 거래량 급증 돌파 스캐너
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

export default function EnergyCondensationScannerTab({ onSelectStock }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const [marketFilter, setMarketFilter] = useState('ALL'); // 'ALL' | '코스피' | '코스닥'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'BREAKOUT' | 'WEAK_BREAKOUT' | 'COILING'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('CAP_DESC'); // 'CAP_DESC' | 'SCORE_DESC' | 'VOLUME_DESC' | 'RECENT_DESC'

  // 상단 요약 카드 체크박스 — 체크된 카드가 있으면 해당 조건에 해당하는 종목만 표시 (OR 조건)
  const [cardChecks, setCardChecks] = useState({ KOSPI: false, KOSDAQ: false, BREAKOUT: false, UNIVERSE: false });
  const toggleCard = (key) => setCardChecks(prev => ({ ...prev, [key]: !prev[key] }));

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchStocks = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch('/api/energy-condensation-stocks');
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error('에너지 응축 패턴 종목 로드 실패:', err);
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
      await fetch('/api/trigger-energy-condensation-scan', { method: 'POST' });
      showToast('🔄 에너지 응축 패턴 재스캔이 백그라운드에서 시작되었습니다. 잠시 후 새로고침 해주세요.');
    } catch (e) {
      showToast('재스캔 요청 중 오류가 발생했습니다.');
    } finally {
      setTimeout(() => fetchStocks(false), 3000);
    }
  };

  const handleDownloadCsv = () => {
    if (!data || !data.stocks) return;
    const headers = ['순위', '종목명', '종목코드', '시장', '시가총액(억원)', '현재가', '스코어', '상태', '저항선', '응축구간시작', '응축구간종료', '밴드수축률(%)', '거래량감소율(%)', '오늘거래량배율', '저항선대비(%)', '돌파일'];
    const rows = filteredStocks.map((s, idx) => [
      idx + 1, `"${s.name}"`, `"${s.code}"`, `"${s.market}"`, s.marketCap, s.currentPrice, s.score, `"${s.status}"`,
      s.resistance, s.coilBox.startDate, s.coilBox.endDate, s.rangeContractionPct, s.volumeDryUpPct, s.todayVolumeRatio, s.extensionPct, s.breakoutDate || ''
    ]);
    const csvContent = '﻿' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `EnergyCondensation_Scan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📥 에너지 응축 패턴 종목 CSV 파일이 다운로드되었습니다.');
  };

  const filteredStocks = useMemo(() => {
    if (!data || !data.stocks) return [];
    let list = [...data.stocks];

    if (marketFilter !== 'ALL') list = list.filter(s => s.market === marketFilter);

    if (statusFilter === 'BREAKOUT') list = list.filter(s => !!s.breakoutDate);
    else if (statusFilter === 'WEAK_BREAKOUT') list = list.filter(s => !s.breakoutDate && s.status.includes('돌파'));
    else if (statusFilter === 'COILING') list = list.filter(s => s.status.includes('임박'));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s => (s.name || '').toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q));
    }

    // 상단 요약 카드 체크박스 필터: 체크된 항목이 하나라도 있으면 OR 조건으로 좁힘.
    // "전체 스캔 유니버스"가 체크되면 다른 체크와 무관하게 전체를 보여줌.
    const anyCardChecked = cardChecks.KOSPI || cardChecks.KOSDAQ || cardChecks.BREAKOUT || cardChecks.UNIVERSE;
    if (anyCardChecked && !cardChecks.UNIVERSE) {
      list = list.filter(s =>
        (cardChecks.KOSPI && s.market === '코스피') ||
        (cardChecks.KOSDAQ && s.market === '코스닥') ||
        (cardChecks.BREAKOUT && !!s.breakoutDate)
      );
    }

    if (sortBy === 'CAP_DESC') list.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    else if (sortBy === 'SCORE_DESC') list.sort((a, b) => b.score - a.score);
    else if (sortBy === 'VOLUME_DESC') list.sort((a, b) => b.todayVolumeRatio - a.todayVolumeRatio);
    else if (sortBy === 'RECENT_DESC') list.sort((a, b) => (b.breakoutDate || b.coilBox.endDate).localeCompare(a.breakoutDate || a.coilBox.endDate));

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
          background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 0,
          color: '#fff', fontWeight: 800, fontSize: '.9rem', zIndex: 5000,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)', animation: 'slideUp 0.3s ease-out'
        }}>
          {toastMessage}
        </div>
      )}

      {/* ─── 1. 상단 메인 헤더 배너 ─── */}
      <div style={{
        padding: '22px 26px',
        background: 'var(--bg2)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0, marginBottom: 18,
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span>에너지 응축 → 거래량 돌파 스캐너</span>
              <span style={{
                fontSize: '.75rem', background: 'rgba(255,255,255,0.06)', color: 'var(--t2)',
                border: '1px solid rgba(255,255,255,0.15)', padding: '4px 12px', borderRadius: 0, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: 6
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: isScanning ? '#fbbf24' : '#34d399', display: 'inline-block' }} />
                {isScanning ? '최초 전종목 스캔 진행 중...' : `코스피+코스닥 ${totalScanned.toLocaleString()}종목 스캔 완료`}
              </span>
            </div>
            <div style={{ fontSize: '.86rem', color: 'var(--t3)', marginTop: 6, lineHeight: 1.6 }}>
              코스피·코스닥 <strong>시가총액 상위 종목</strong>을 대상으로, 최근 15거래일 변동폭·거래량이 직전 30거래일 대비 <strong>충분히 수축(에너지 응축)</strong>된 뒤 <strong>거래량 급증과 함께 저항선을 돌파</strong>했거나 돌파 직전인 종목을 발굴합니다. 방향을 예측하기보다 "곧 터진다"를 포착하고, 거래량 동반 돌파를 진입 신호로 삼는 방식입니다.
            </div>
            <div style={{ fontSize: '.76rem', color: 'var(--t3)', marginTop: 6 }}>
              마지막 스캔: {lastSyncAt}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={handleDownloadCsv} style={{
              padding: '9px 14px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 0, color: 'var(--t2)', fontWeight: 700, cursor: 'pointer', fontSize: '.82rem'
            }}>
              CSV
            </button>
            <button onClick={handleRefresh} disabled={refreshing} style={{
              padding: '9px 16px', background: 'var(--accent)', border: 'none',
              borderRadius: 0, color: '#fff', fontWeight: 700, cursor: refreshing ? 'not-allowed' : 'pointer',
              fontSize: '.82rem'
            }}>
              {refreshing ? '스캔 요청 중...' : '전종목 재스캔'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── 2. 시장별 요약 카드 (체크박스로 필터링 가능) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        <label style={{ cursor: 'pointer', padding: '18px 20px', borderRadius: 0, background: cardChecks.KOSPI ? 'rgba(129,140,248,0.12)' : 'var(--bg2)', border: cardChecks.KOSPI ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--t2)' }}>코스피 응축 발굴 종목</span>
            <input type="checkbox" checked={cardChecks.KOSPI} onChange={() => toggleCard('KOSPI')} style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fff', marginTop: 8, fontFamily: 'Space Mono' }}>
            {kospiCount} <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--t3)' }}>종목</span>
          </div>
        </label>
        <label style={{ cursor: 'pointer', padding: '18px 20px', borderRadius: 0, background: cardChecks.KOSDAQ ? 'rgba(129,140,248,0.12)' : 'var(--bg2)', border: cardChecks.KOSDAQ ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--t2)' }}>코스닥 응축 발굴 종목</span>
            <input type="checkbox" checked={cardChecks.KOSDAQ} onChange={() => toggleCard('KOSDAQ')} style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fff', marginTop: 8, fontFamily: 'Space Mono' }}>
            {kosdaqCount} <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--t3)' }}>종목</span>
          </div>
        </label>
        <label style={{ cursor: 'pointer', padding: '18px 20px', borderRadius: 0, background: cardChecks.BREAKOUT ? 'rgba(129,140,248,0.12)' : 'var(--bg2)', border: cardChecks.BREAKOUT ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--t2)' }}>거래량 돌파 신호 종목</span>
            <input type="checkbox" checked={cardChecks.BREAKOUT} onChange={() => toggleCard('BREAKOUT')} style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fff', marginTop: 8, fontFamily: 'Space Mono' }}>
            {(data?.stocks || []).filter(s => !!s.breakoutDate).length} <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--t3)' }}>종목</span>
          </div>
        </label>
        <label style={{ cursor: 'pointer', padding: '18px 20px', borderRadius: 0, background: cardChecks.UNIVERSE ? 'rgba(129,140,248,0.12)' : 'var(--bg2)', border: cardChecks.UNIVERSE ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--t2)' }}>전체 스캔 유니버스</span>
            <input type="checkbox" checked={cardChecks.UNIVERSE} onChange={() => toggleCard('UNIVERSE')} style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fff', marginTop: 8, fontFamily: 'Space Mono' }}>
            {totalScanned.toLocaleString()} <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--t3)' }}>종목</span>
          </div>
        </label>
      </div>
      {(cardChecks.KOSPI || cardChecks.KOSDAQ || cardChecks.BREAKOUT || cardChecks.UNIVERSE) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, marginTop: -8 }}>
          <span style={{ fontSize: '.78rem', color: 'var(--t3)' }}>체크된 카드 조건으로 {filteredStocks.length}개 종목만 표시 중</span>
          <button onClick={() => setCardChecks({ KOSPI: false, KOSDAQ: false, BREAKOUT: false, UNIVERSE: false })} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 0, color: 'var(--t2)', fontSize: '.74rem', fontWeight: 700, cursor: 'pointer' }}>
            체크 초기화
          </button>
        </div>
      )}

      {/* ─── 3. 필터 & 검색 & 정렬 바 ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.25)', padding: 3, borderRadius: 0, flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `전체 (${data?.stocks?.length || 0})` },
            { id: '코스피', label: `코스피 (${kospiCount})` },
            { id: '코스닥', label: `코스닥 (${kosdaqCount})` },
          ].map(f => (
            <button key={f.id} onClick={() => setMarketFilter(f.id)} style={{
              padding: '6px 14px', borderRadius: 0, border: 'none',
              background: marketFilter === f.id ? 'var(--accent)' : 'transparent',
              color: marketFilter === f.id ? '#fff' : 'var(--t3)', fontWeight: 700, fontSize: '.8rem', cursor: 'pointer'
            }}>
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.25)', padding: 3, borderRadius: 0, flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: '전체 상태' },
            { id: 'BREAKOUT', label: '거래량 돌파 신호' },
            { id: 'WEAK_BREAKOUT', label: '거래량 미동반 돌파' },
            { id: 'COILING', label: '응축 지속(임박)' },
          ].map(f => (
            <button key={f.id} onClick={() => setStatusFilter(f.id)} style={{
              padding: '6px 14px', borderRadius: 0, border: 'none',
              background: statusFilter === f.id ? 'var(--accent)' : 'transparent',
              color: statusFilter === f.id ? '#fff' : 'var(--t3)', fontWeight: 700, fontSize: '.8rem', cursor: 'pointer'
            }}>
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', padding: '8px 14px', borderRadius: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="종목명, 코드 검색..."
              style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '.85rem', width: '140px' }} />
            {searchQuery && <button onClick={() => setSearchQuery('')} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer' }}>✕</button>}
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
            padding: '8px 12px', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 0,
            color: '#fff', fontSize: '.84rem', outline: 'none', cursor: 'pointer'
          }}>
            <option value="CAP_DESC">시가총액 큰순</option>
            <option value="SCORE_DESC">패턴 스코어 높은순</option>
            <option value="VOLUME_DESC">오늘 거래량 배율 높은순</option>
            <option value="RECENT_DESC">최신 돌파순</option>
          </select>
        </div>
      </div>

      {/* ─── 4. 종목 카드 그리드 ─── */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>에너지 응축 패턴 데이터를 불러오는 중...</div>
        </div>
      ) : isScanning ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>코스피+코스닥 전종목 최초 스캔이 백그라운드에서 진행 중입니다.</div>
          <div style={{ fontSize: '.85rem', marginTop: 8 }}>수 분 정도 소요될 수 있습니다. 잠시 후 새로고침 해주세요.</div>
        </div>
      ) : filteredStocks.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>해당 조건의 에너지 응축 패턴 종목이 없습니다.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 16, marginBottom: 24 }}>
          {filteredStocks.map((stock, idx) => {
            const statusColor = stock.breakoutDate ? '#fbbf24' : stock.status.includes('돌파') ? '#60a5fa' : '#94a3b8';
            const isUp = stock.changePct >= 0;
            const marketColor = stock.market === '코스피' ? '#3b82f6' : '#a78bfa';

            return (
              <div key={stock.code} className="card"
                onClick={() => onSelectStock && onSelectStock({ ...stock, current_price: stock.currentPrice, type: stock.market })}
                style={{
                  padding: 20, background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 0, cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 8px', background: idx < 3 ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.08)', color: idx < 3 ? '#fbbf24' : 'var(--t3)', borderRadius: 0, fontWeight: 700, fontSize: '.75rem' }}>
                        #{idx + 1}
                      </span>
                      <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>{stock.name}</span>
                      <span style={{ fontSize: '.78rem', color: 'var(--t3)', fontFamily: 'Space Mono' }}>{stock.code}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 0, fontSize: '.7rem', fontWeight: 700, background: 'rgba(255,255,255,0.06)', color: 'var(--t2)' }}>
                        {stock.market}
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: 0, fontSize: '.7rem', fontWeight: 700, background: 'rgba(255,255,255,0.06)', color: 'var(--t2)' }}>
                        스코어 {stock.score}점
                      </span>
                      <span style={{ padding: '2px 8px', borderRadius: 0, fontSize: '.7rem', fontWeight: 700, background: 'rgba(255,255,255,0.06)', color: 'var(--t2)' }}>
                        시총 {formatMarketCap(stock.marketCap)}
                      </span>
                    </div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 0, fontSize: '.74rem', fontWeight: 700, background: `${statusColor}20`, color: statusColor, border: `1px solid ${statusColor}50`, whiteSpace: 'nowrap' }}>
                    {stock.status}
                  </span>
                </div>

                {/* 에너지 응축 패턴 상세 박스 */}
                <div style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: 0, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', marginBottom: 8 }}>
                    <div>
                      <div style={{ color: 'var(--t3)' }}>응축구간 ({stock.coilBox.startDate.slice(5)}~{stock.coilBox.endDate.slice(5)})</div>
                      <div style={{ fontWeight: 900, color: '#fff', fontFamily: 'Space Mono' }}>{formatNumber(stock.coilBox.low)} ~ {formatNumber(stock.coilBox.high)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--t3)' }}>저항선</div>
                      <div style={{ fontWeight: 900, color: '#f59e0b', fontFamily: 'Space Mono' }}>{formatNumber(stock.resistance)}원</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: '.72rem', color: 'var(--t2)', flexWrap: 'wrap' }}>
                    <span>밴드 수축 <strong style={{ color: '#34d399' }}>{stock.rangeContractionPct}%</strong></span>
                    <span>거래량 감소 <strong style={{ color: '#34d399' }}>{stock.volumeDryUpPct}%</strong></span>
                    <span>오늘 거래량 <strong style={{ color: stock.todayVolumeRatio >= 1.8 ? '#fbbf24' : '#fff' }}>{stock.todayVolumeRatio}배</strong></span>
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
                    style={{ padding: '6px 12px', background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.4)', borderRadius: 0, color: 'var(--accent)', fontSize: '.76rem', fontWeight: 700, cursor: 'pointer' }}>
                    차트 상세보기 ➔
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── 5. 판정 기준 가이드 ─── */}
      <div style={{ padding: '22px 26px', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0 }}>
        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>에너지 응축 → 거래량 돌파 패턴 판정 기준</span>
        </div>
        <div style={{ fontSize: '.86rem', color: 'var(--t2)', lineHeight: 1.7 }}>
          • <strong>변동성 수축 확인:</strong> 최근 15거래일 고점-저점 밴드폭이 14% 이내이면서, 직전 30거래일 밴드폭의 <strong>60% 이하</strong>로 좁아진 종목만 대상으로 합니다.<br />
          • <strong>거래량 마름 확인:</strong> 최근 15거래일 평균 거래량이 직전 30거래일 평균 대비 <strong>20% 이상 감소</strong>했는지 함께 확인합니다.<br />
          • <strong>저항선 돌파 신호:</strong> 응축구간 고점(저항선)을 종가로 넘고, 그날 거래량이 응축구간 평균 거래량의 <strong>1.8배 이상</strong>이면 "💥 거래량 돌파 신호"로 표시합니다.<br />
          • <strong>상태 뱃지:</strong> 거래량 동반 돌파는 💥, 거래량 없이 가격만 넘은 경우 ⚡, 아직 저항선 아래(90~100%)면 🔒 응축 지속으로 구분합니다. 저항선 대비 12% 넘게 오른 경우는 "이미 늦은 신호"로 간주해 제외합니다.
        </div>
      </div>
    </div>
  );
}
