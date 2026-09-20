// DoubleBottomScannerTab.jsx — 📉 하락추세 이후 쌍바닥(Double Bottom) 패턴 스캐너
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

export default function DoubleBottomScannerTab({ onSelectStock }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const [marketFilter, setMarketFilter] = useState('ALL'); // 'ALL' | '코스피' | '코스닥'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'BREAKOUT' | 'REBOUNDING' | 'FORMING'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('CAP_DESC'); // 'CAP_DESC' | 'SCORE_DESC' | 'DECLINE_DESC' | 'RECENT_DESC'

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
      const res = await fetch('/api/double-bottom-stocks');
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error('쌍바닥 패턴 종목 로드 실패:', err);
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
      await fetch('/api/trigger-double-bottom-scan', { method: 'POST' });
      showToast('🔄 쌍바닥 패턴 재스캔이 백그라운드에서 시작되었습니다. 잠시 후 새로고침 해주세요.');
    } catch (e) {
      showToast('재스캔 요청 중 오류가 발생했습니다.');
    } finally {
      setTimeout(() => fetchStocks(false), 3000);
    }
  };

  const handleDownloadCsv = () => {
    if (!data || !data.stocks) return;
    const headers = ['순위', '종목명', '종목코드', '시장', '시가총액(억원)', '현재가', '스코어', '상태', '1차저점일', '1차저점가', '2차저점일', '2차저점가', '넥라인가', '하락률(%)', '저점오차(%)', '반등폭(%)'];
    const rows = filteredStocks.map((s, idx) => [
      idx + 1, `"${s.name}"`, `"${s.code}"`, `"${s.market}"`, s.marketCap, s.currentPrice, s.score, `"${s.status}"`,
      s.bottom1.date, s.bottom1.price, s.bottom2.date, s.bottom2.price, s.neckline.price,
      s.declinePct, s.priceDiffPct, s.reboundPct
    ]);
    const csvContent = '﻿' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `DoubleBottom_Scan_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📥 쌍바닥 패턴 종목 CSV 파일이 다운로드되었습니다.');
  };

  const filteredStocks = useMemo(() => {
    if (!data || !data.stocks) return [];
    let list = [...data.stocks];

    if (marketFilter !== 'ALL') list = list.filter(s => s.market === marketFilter);

    if (statusFilter === 'BREAKOUT') list = list.filter(s => s.status.includes('돌파'));
    else if (statusFilter === 'REBOUNDING') list = list.filter(s => s.status.includes('반등중'));
    else if (statusFilter === 'FORMING') list = list.filter(s => s.status.includes('형성중'));

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
        (cardChecks.BREAKOUT && s.status.includes('돌파'))
      );
    }

    if (sortBy === 'CAP_DESC') list.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    else if (sortBy === 'SCORE_DESC') list.sort((a, b) => b.score - a.score);
    else if (sortBy === 'DECLINE_DESC') list.sort((a, b) => b.declinePct - a.declinePct);
    else if (sortBy === 'RECENT_DESC') list.sort((a, b) => b.bottom2.date.localeCompare(a.bottom2.date));

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
              <span>하락추세 후 쌍바닥(Double Bottom) 패턴 스캐너</span>
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
              코스피·코스닥 <strong>시가총액 상위 종목</strong>을 대상으로, 최근 120거래일 하락추세(고점 대비 -12% 이상) 이후 저점 오차 4.5% 이내의 <strong>두 번의 스윙 저점(쌍바닥)</strong>이 형성되고 넥라인 대비 5% 이상 반등한 종목을 코스피/코스닥으로 구분해 발굴합니다.
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
            <span style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--t2)' }}>코스피 쌍바닥 발굴 종목</span>
            <input type="checkbox" checked={cardChecks.KOSPI} onChange={() => toggleCard('KOSPI')} style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fff', marginTop: 8, fontFamily: 'Space Mono' }}>
            {kospiCount} <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--t3)' }}>종목</span>
          </div>
        </label>
        <label style={{ cursor: 'pointer', padding: '18px 20px', borderRadius: 0, background: cardChecks.KOSDAQ ? 'rgba(129,140,248,0.12)' : 'var(--bg2)', border: cardChecks.KOSDAQ ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--t2)' }}>코스닥 쌍바닥 발굴 종목</span>
            <input type="checkbox" checked={cardChecks.KOSDAQ} onChange={() => toggleCard('KOSDAQ')} style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fff', marginTop: 8, fontFamily: 'Space Mono' }}>
            {kosdaqCount} <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--t3)' }}>종목</span>
          </div>
        </label>
        <label style={{ cursor: 'pointer', padding: '18px 20px', borderRadius: 0, background: cardChecks.BREAKOUT ? 'rgba(129,140,248,0.12)' : 'var(--bg2)', border: cardChecks.BREAKOUT ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--t2)' }}>넥라인 돌파 종목</span>
            <input type="checkbox" checked={cardChecks.BREAKOUT} onChange={() => toggleCard('BREAKOUT')} style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fff', marginTop: 8, fontFamily: 'Space Mono' }}>
            {(data?.stocks || []).filter(s => s.status.includes('돌파')).length} <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--t3)' }}>종목</span>
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
            { id: 'BREAKOUT', label: '넥라인 돌파' },
            { id: 'REBOUNDING', label: '우측바닥 반등중' },
            { id: 'FORMING', label: '패턴 형성중' },
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
            <option value="DECLINE_DESC">하락추세 강한순</option>
            <option value="RECENT_DESC">2차 저점 최신순</option>
          </select>
        </div>
      </div>

      {/* ─── 4. 종목 카드 그리드 ─── */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>쌍바닥 패턴 데이터를 불러오는 중...</div>
        </div>
      ) : isScanning ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>코스피+코스닥 전종목 최초 스캔이 백그라운드에서 진행 중입니다.</div>
          <div style={{ fontSize: '.85rem', marginTop: 8 }}>수 분 정도 소요될 수 있습니다. 잠시 후 새로고침 해주세요.</div>
        </div>
      ) : filteredStocks.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>해당 조건의 쌍바닥 패턴 종목이 없습니다.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 16, marginBottom: 24 }}>
          {filteredStocks.map((stock, idx) => {
            const statusColor = stock.status.includes('돌파') ? '#34d399' : stock.status.includes('반등중') ? '#fbbf24' : '#94a3b8';
            const isUp = stock.changePct >= 0;
            const marketColor = stock.market === '코스피' ? '#3b82f6' : '#a78bfa';

            return (
              <div key={stock.code}
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
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
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

                {/* 쌍바닥 패턴 상세 박스 */}
                <div style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: 0, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', marginBottom: 8 }}>
                    <div>
                      <div style={{ color: 'var(--t3)' }}>1차 저점 ({stock.bottom1.date.slice(5)})</div>
                      <div style={{ fontWeight: 900, color: '#fff', fontFamily: 'Space Mono' }}>{formatNumber(stock.bottom1.price)}원</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'var(--t3)' }}>넥라인</div>
                      <div style={{ fontWeight: 900, color: '#60a5fa', fontFamily: 'Space Mono' }}>{formatNumber(stock.neckline.price)}원</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--t3)' }}>2차 저점 ({stock.bottom2.date.slice(5)})</div>
                      <div style={{ fontWeight: 900, color: '#fff', fontFamily: 'Space Mono' }}>{formatNumber(stock.bottom2.price)}원</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: '.72rem', color: 'var(--t2)', flexWrap: 'wrap' }}>
                    <span>하락추세 <strong style={{ color: '#f87171' }}>-{stock.declinePct}%</strong></span>
                    <span>저점 오차 <strong style={{ color: '#fff' }}>{stock.priceDiffPct}%</strong></span>
                    <span>넥라인 반등 <strong style={{ color: '#34d399' }}>+{stock.reboundPct}%</strong></span>
                    <span>저점 간격 <strong style={{ color: '#fff' }}>{stock.gapDays}일</strong></span>
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
          <span>쌍바닥(Double Bottom) 패턴 판정 기준</span>
        </div>
        <div style={{ fontSize: '.86rem', color: 'var(--t2)', lineHeight: 1.7 }}>
          • <strong>하락추세 확인:</strong> 1차 저점 진입 전 40거래일 내 고점 대비 <strong>12% 이상</strong> 하락한 종목만 대상으로 합니다.<br />
          • <strong>스윙 저점 탐지:</strong> 좌우 4거래일보다 낮은 저가를 로컬 저점(Swing Low)으로 인식하고, 8~55거래일 간격의 두 저점 쌍을 탐색합니다.<br />
          • <strong>쌍바닥 조건:</strong> 두 저점의 가격 차이가 <strong>4.5% 이내</strong>이고, 두 저점 사이 반등 고점(넥라인)이 저점 평균 대비 <strong>5% 이상</strong> 높아야 합니다.<br />
          • <strong>상태 뱃지:</strong> 현재가가 넥라인을 넘으면 🚀 돌파, 저점 대비 2% 이상 반등 중이면 ⚡ 반등중, 그 외에는 🔍 형성중으로 표시합니다.
        </div>
      </div>
    </div>
  );
}
