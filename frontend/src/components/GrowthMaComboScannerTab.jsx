// GrowthMaComboScannerTab.jsx — 🚀🎯 "4대 재무 퀀트" 강력 후보군 + "256 기법" 콤보 스캐너 (단기/중장기)
import React, { useState, useEffect, useMemo } from 'react';

const formatNumber = (num) => new Intl.NumberFormat('ko-KR').format(num || 0);
const pct = (v) => (v === null || v === undefined ? '-' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);

export default function GrowthMaComboScannerTab({ onSelectStock }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const [termType, setTermType] = useState('short'); // 'short' | 'long'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('SCORE_DESC'); // 'SCORE_DESC' | 'GROWTH_DESC' | 'FRESH_DESC'

  // 상단 요약 카드 체크박스 — 체크된 카드가 있으면 해당 조건에 해당하는 종목만 표시 (OR 조건)
  const [cardChecks, setCardChecks] = useState({ KOSPI: false, KOSDAQ: false, ACCUM: false, PERFECT4: false });
  const toggleCard = (key) => setCardChecks(prev => ({ ...prev, [key]: !prev[key] }));

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchStocks = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch('/api/growth-ma-combo-stocks');
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error('4대 퀀트+256 기법 콤보 스캐너 로드 실패:', err);
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
      await fetch('/api/trigger-growth-ma-combo-scan', { method: 'POST' });
      showToast('🔄 콤보 재스캔이 백그라운드에서 시작되었습니다. 잠시 후 새로고침 해주세요.');
    } catch (e) {
      showToast('재스캔 요청 중 오류가 발생했습니다.');
    } finally {
      setTimeout(() => fetchStocks(false), 3000);
    }
  };

  const rawList = termType === 'short' ? (data?.short || []) : (data?.long || []);

  const filteredStocks = useMemo(() => {
    let list = [...rawList];

    const anyCardChecked = cardChecks.KOSPI || cardChecks.KOSDAQ || cardChecks.ACCUM || cardChecks.PERFECT4;
    if (anyCardChecked) {
      list = list.filter(s =>
        (cardChecks.KOSPI && s.market === '코스피') ||
        (cardChecks.KOSDAQ && s.market === '코스닥') ||
        (cardChecks.ACCUM && s.hasAccumulationBar) ||
        (cardChecks.PERFECT4 && s.matchedCount >= 4)
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s => (s.name || '').toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q));
    }
    if (sortBy === 'SCORE_DESC') list.sort((a, b) => b.score - a.score);
    else if (sortBy === 'GROWTH_DESC') list.sort((a, b) => (b.growthScore || 0) - (a.growthScore || 0));
    else if (sortBy === 'FRESH_DESC') list.sort((a, b) => a.daysSinceCross - b.daysSinceCross);
    return list;
  }, [rawList, cardChecks, searchQuery, sortBy]);

  const kospiCount = rawList.filter(s => s.market === '코스피').length;
  const kosdaqCount = rawList.filter(s => s.market === '코스닥').length;
  const accumCount = rawList.filter(s => s.hasAccumulationBar).length;
  const perfect4Count = rawList.filter(s => s.matchedCount >= 4).length;
  const totalCandidates = data?.totalCandidates || 0;
  const lastSyncAt = data?.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString('ko-KR') : '스캔 대기 중';
  const growthScanAt = data?.growthScanTimestamp ? new Date(data.growthScanTimestamp).toLocaleString('ko-KR') : '-';
  const isScanning = data?.scanning;

  const activeSet = termType === 'short'
    ? { trigger: 5, mid: 20, outer: 60 }
    : { trigger: 5, mid: 112, outer: 224 };

  return (
    <div style={{ padding: '10px 0', animation: 'fadeIn 0.3s ease-in-out' }}>
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '14px 20px',
          background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 0,
          color: '#fff', fontWeight: 800, fontSize: '.9rem', zIndex: 5000,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
        }}>
          {toastMessage}
        </div>
      )}

      {/* ─── 헤더 배너 ─── */}
      <div style={{ padding: '22px 26px', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0, marginBottom: 18, boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span>🚀🎯 재무 퀀트 후보군 + "256 기법" 콤보 스캐너</span>
              <span style={{ fontSize: '.75rem', background: 'rgba(255,255,255,0.06)', color: 'var(--t2)', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 12px', borderRadius: 0, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: isScanning ? '#fbbf24' : '#10b981', display: 'inline-block' }} />
                {isScanning ? '스캔 진행 중...' : `1차 후보 ${totalCandidates.toLocaleString()}종목 스캔 완료`}
              </span>
            </div>
            <div style={{ fontSize: '.86rem', color: 'var(--t3)', marginTop: 6, lineHeight: 1.6 }}>
              <strong>"4대 재무 퀀트 발굴기"</strong>(자산·영업이익·매출 증가율 TOP80, 부채비율 120%↓)에서 <strong>4개 조건 중 2개 이상 만족한 강력 후보군</strong>만 1차로 추리고, 그 종목들에만 <strong>"256 기법"</strong>(역배열→5일선이 {activeSet.mid}일선 골든크로스, 아직 {activeSet.outer}일선 돌파 전 초입 구간)을 2차로 적용해서 재무+기술적 타이밍이 둘 다 맞는 종목만 찾습니다.
            </div>
            <div style={{ fontSize: '.76rem', color: 'var(--t3)', marginTop: 6 }}>
              콤보 스캔: {lastSyncAt} · 1차(재무) 스캔 기준: {growthScanAt}
            </div>
          </div>
          <button onClick={handleRefresh} disabled={refreshing} style={{ padding: '9px 16px', background: 'var(--accent)', border: 'none', borderRadius: 0, color: '#fff', fontWeight: 700, cursor: refreshing ? 'not-allowed' : 'pointer', fontSize: '.82rem' }}>
            {refreshing ? '스캔 요청 중...' : '콤보 재스캔'}
          </button>
        </div>
      </div>

      {/* ─── 단기/중장기 토글 ─── */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.25)', padding: 3, borderRadius: 0, marginBottom: 18, width: 'fit-content' }}>
        <button onClick={() => setTermType('short')} style={{ padding: '8px 18px', borderRadius: 0, border: 'none', background: termType === 'short' ? 'var(--accent)' : 'transparent', color: termType === 'short' ? '#fff' : 'var(--t3)', fontWeight: 700, fontSize: '.85rem', cursor: 'pointer' }}>
          단기 (5·20·60일선) {data?.short ? `${data.short.length}` : ''}
        </button>
        <button onClick={() => setTermType('long')} style={{ padding: '8px 18px', borderRadius: 0, border: 'none', background: termType === 'long' ? 'var(--accent)' : 'transparent', color: termType === 'long' ? '#fff' : 'var(--t3)', fontWeight: 700, fontSize: '.85rem', cursor: 'pointer' }}>
          중장기 (5·112·224일선) {data?.long ? `${data.long.length}` : ''}
        </button>
      </div>

      {/* ─── 요약 카드 (체크박스로 필터링 가능) ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 8 }}>
        <label style={{ cursor: 'pointer', padding: '18px 20px', background: cardChecks.KOSPI ? 'rgba(129,140,248,0.12)' : 'var(--bg2)', border: cardChecks.KOSPI ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--t2)' }}>코스피 발굴</span>
            <input type="checkbox" checked={cardChecks.KOSPI} onChange={() => toggleCard('KOSPI')} style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fff', marginTop: 8, fontFamily: 'Space Mono' }}>
            {kospiCount.toLocaleString()} <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--t3)' }}>종목</span>
          </div>
        </label>
        <label style={{ cursor: 'pointer', padding: '18px 20px', background: cardChecks.KOSDAQ ? 'rgba(129,140,248,0.12)' : 'var(--bg2)', border: cardChecks.KOSDAQ ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--t2)' }}>코스닥 발굴</span>
            <input type="checkbox" checked={cardChecks.KOSDAQ} onChange={() => toggleCard('KOSDAQ')} style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fff', marginTop: 8, fontFamily: 'Space Mono' }}>
            {kosdaqCount.toLocaleString()} <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--t3)' }}>종목</span>
          </div>
        </label>
        <label style={{ cursor: 'pointer', padding: '18px 20px', background: cardChecks.ACCUM ? 'rgba(245,158,11,0.12)' : 'var(--bg2)', border: cardChecks.ACCUM ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--t2)' }}>🕵️ 매집봉 동반</span>
            <input type="checkbox" checked={cardChecks.ACCUM} onChange={() => toggleCard('ACCUM')} style={{ width: 18, height: 18, accentColor: '#f59e0b', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#f59e0b', marginTop: 8, fontFamily: 'Space Mono' }}>
            {accumCount.toLocaleString()} <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--t3)' }}>종목</span>
          </div>
        </label>
        <label style={{ cursor: 'pointer', padding: '18px 20px', background: cardChecks.PERFECT4 ? 'rgba(52,211,153,0.12)' : 'var(--bg2)', border: cardChecks.PERFECT4 ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'block' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--t2)' }}>💎 재무 4/4 올킬</span>
            <input type="checkbox" checked={cardChecks.PERFECT4} onChange={() => toggleCard('PERFECT4')} style={{ width: 18, height: 18, accentColor: '#34d399', cursor: 'pointer' }} />
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#34d399', marginTop: 8, fontFamily: 'Space Mono' }}>
            {perfect4Count.toLocaleString()} <span style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--t3)' }}>종목</span>
          </div>
        </label>
      </div>
      {(cardChecks.KOSPI || cardChecks.KOSDAQ || cardChecks.ACCUM || cardChecks.PERFECT4) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: '.78rem', color: 'var(--t3)' }}>체크된 카드 조건으로 {filteredStocks.length}개 종목만 표시 중</span>
          <button onClick={() => setCardChecks({ KOSPI: false, KOSDAQ: false, ACCUM: false, PERFECT4: false })} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 0, color: 'var(--t2)', fontSize: '.74rem', fontWeight: 700, cursor: 'pointer' }}>
            체크 초기화
          </button>
        </div>
      )}

      {/* ─── 검색 & 정렬 바 ─── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', padding: '8px 14px', borderRadius: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="종목명, 코드 검색..." style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '.85rem', width: '140px' }} />
            {searchQuery && <button onClick={() => setSearchQuery('')} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer' }}>✕</button>}
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 0, color: '#fff', fontSize: '.84rem', outline: 'none', cursor: 'pointer' }}>
            <option value="SCORE_DESC">패턴 스코어 높은순</option>
            <option value="GROWTH_DESC">재무 성장 점수 높은순</option>
            <option value="FRESH_DESC">교차 최신순</option>
          </select>
        </div>
      </div>

      {/* ─── 종목 카드 그리드 ─── */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>스캔 데이터를 불러오는 중...</div>
        </div>
      ) : isScanning ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>콤보 스캔이 백그라운드에서 진행 중입니다.</div>
          <div style={{ fontSize: '.85rem', marginTop: 8 }}>잠시 후 새로고침 해주세요.</div>
        </div>
      ) : filteredStocks.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>해당 조건의 종목이 없습니다.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16, marginBottom: 24 }}>
          {filteredStocks.map((stock, idx) => (
            <div key={stock.code} className="card"
              onClick={() => onSelectStock && onSelectStock({ ...stock, current_price: stock.currentPrice, type: stock.market })}
              style={{ padding: 20, background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 8px', background: idx < 3 ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.08)', color: idx < 3 ? '#fbbf24' : 'var(--t3)', borderRadius: 0, fontWeight: 700, fontSize: '.75rem' }}>#{idx + 1}</span>
                    <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>{stock.name}</span>
                    <span style={{ fontSize: '.78rem', color: 'var(--t3)', fontFamily: 'Space Mono' }}>{stock.code}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 0, fontSize: '.7rem', fontWeight: 700, background: 'rgba(255,255,255,0.06)', color: 'var(--t2)' }}>{stock.market}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 0, fontSize: '.7rem', fontWeight: 700, background: 'rgba(255,255,255,0.06)', color: 'var(--t2)' }}>패턴 {stock.score}점</span>
                    <span style={{ padding: '2px 8px', borderRadius: 0, fontSize: '.7rem', fontWeight: 700, background: stock.matchedCount >= 4 ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)', color: stock.matchedCount >= 4 ? '#34d399' : 'var(--t2)' }}>재무 {stock.matchedCount}/4</span>
                  </div>
                </div>
                {stock.hasAccumulationBar && (
                  <span style={{ padding: '4px 10px', borderRadius: 0, fontSize: '.74rem', fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.5)', whiteSpace: 'nowrap' }}>
                    🕵️ 매집봉 포착
                  </span>
                )}
              </div>

              {/* 1차: 재무 성장 지표 */}
              <div style={{ padding: '10px 14px', background: 'rgba(52,211,153,0.06)', borderRadius: 0, border: '1px solid rgba(52,211,153,0.2)', marginBottom: 8 }}>
                <div style={{ fontSize: '.7rem', color: '#34d399', fontWeight: 700, marginBottom: 4 }}>1차: 재무 퀀트 ({(stock.matchTags || []).join(' · ')})</div>
                <div style={{ display: 'flex', gap: 10, fontSize: '.74rem', color: 'var(--t2)', flexWrap: 'wrap' }}>
                  <span>매출 <strong style={{ color: '#fff' }}>{pct(stock.revenueGrowthRate)}</strong></span>
                  <span>영업이익 <strong style={{ color: '#fff' }}>{pct(stock.opProfitGrowthRate)}</strong></span>
                  <span>자산 <strong style={{ color: '#fff' }}>{pct(stock.assetGrowthRate)}</strong></span>
                  <span>부채비율 <strong style={{ color: '#fff' }}>{stock.debtRatio?.toFixed(0)}%</strong></span>
                </div>
              </div>

              {/* 2차: 256 기법 이평선 정보 */}
              <div style={{ padding: '14px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: 0, border: '1px solid rgba(255,255,255,0.06)', marginBottom: 12 }}>
                <div style={{ fontSize: '.7rem', color: 'var(--t3)', fontWeight: 700, marginBottom: 6 }}>2차: "256 기법"</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', marginBottom: 8 }}>
                  <div>
                    <div style={{ color: 'var(--t3)' }}>{stock.trigger}일선</div>
                    <div style={{ fontWeight: 900, color: '#fff', fontFamily: 'Space Mono' }}>{formatNumber(stock.triggerMa)}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: 'var(--t3)' }}>{stock.mid}일선</div>
                    <div style={{ fontWeight: 900, color: '#fff', fontFamily: 'Space Mono' }}>{formatNumber(stock.midMa)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--t3)' }}>{stock.outer}일선(목표)</div>
                    <div style={{ fontWeight: 900, color: '#34d399', fontFamily: 'Space Mono' }}>{formatNumber(stock.outerMa)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: '.72rem', color: 'var(--t2)', flexWrap: 'wrap' }}>
                  <span>교차 시점 <strong style={{ color: '#fff' }}>{stock.crossDate}</strong></span>
                  <span>{stock.outer}일선까지 <strong style={{ color: '#34d399' }}>+{stock.outerGapPct}%</strong></span>
                  {stock.hasAccumulationBar && <span>매집봉 <strong style={{ color: '#f59e0b' }}>{stock.accumulationBar?.volumeRatio}배 거래량</strong></span>}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <span style={{ fontSize: '.74rem', color: 'var(--t3)' }}>현재가: </span>
                  <strong style={{ color: '#fff', fontSize: '1rem', fontFamily: 'Space Mono' }}>{formatNumber(stock.currentPrice)}원</strong>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onSelectStock && onSelectStock({ ...stock, current_price: stock.currentPrice, type: stock.market }); }}
                  style={{ padding: '6px 12px', background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.4)', borderRadius: 0, color: 'var(--accent)', fontSize: '.76rem', fontWeight: 700, cursor: 'pointer' }}>
                  차트 상세보기 ➔
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── 판정 기준 가이드 ─── */}
      <div style={{ padding: '22px 26px', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0 }}>
        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', marginBottom: 12 }}>콤보 스캐너 판정 기준</div>
        <div style={{ fontSize: '.86rem', color: 'var(--t2)', lineHeight: 1.7 }}>
          • <strong>1차 필터 (재무):</strong> "4대 재무 퀀트 발굴기"의 4개 조건(자산·영업이익·매출 증가율 TOP80, 부채비율 120%↓) 중 <strong>2개 이상</strong> 만족한 종목만 후보로 채택합니다.<br />
          • <strong>2차 필터 (기술적 타이밍):</strong> 그 후보군에만 "256 기법"(사전 역배열 확인 → {activeSet.trigger}일선이 {activeSet.mid}일선 최근 5거래일 내 상향 돌파 → 아직 {activeSet.outer}일선 돌파 전 초입 구간)을 적용합니다.<br />
          • <strong>매집봉 가산점:</strong> 구간 내 20일 평균 대비 거래량 1.5배 이상 + 양봉인 "매집봉"이 있으면 가산점을 줍니다.<br />
          • 전 종목 스캔보다 후보군이 훨씬 적어(재무로 이미 걸러짐) 스캔이 더 빠르고, 재무 우량 + 기술적 매수 타이밍이 동시에 맞는 종목만 걸러냅니다.
        </div>
      </div>
    </div>
  );
}
