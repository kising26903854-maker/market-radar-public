// NpsTracker.jsx — 🏛️ 대한민국 국민연금(NPS) 실시간 국내주식 포트폴리오 및 DART 지분공시 상세 분석기
import React, { useState, useEffect, useMemo } from 'react';
import NpsPdfReportModal from './NpsPdfReportModal.jsx';

// 포맷팅 유틸리티
const formatNumber = (num) => new Intl.NumberFormat('ko-KR').format(num || 0);

const formatJoEok = (eok) => {
  if (!eok || isNaN(eok)) return '0억 원';
  if (eok >= 10000) {
    const jo = Math.floor(eok / 10000);
    const rem = Math.floor(eok % 10000);
    return `${jo.toLocaleString()}조 ${rem > 0 ? rem.toLocaleString() + '억 ' : ''}원`.trim();
  }
  return `${eok.toLocaleString()}억 원`;
};

const formatPct = (num) => {
  if (num === null || num === undefined) return '-';
  return Number(num).toFixed(2) + '%';
};

// DART 공시일자가 아직 확인되지 않은 경우(null) 지어낸 날짜 대신 표시할 문구
const formatDisclosureDate = (d) => d || '확인중';

// ─── 📑 국민연금 DART 전자공시 상세 리포트 팝업 모달 ───
function NpsDisclosureModal({ item, onClose, onSelectStock, estimatedComparison }) {
  if (!item) return null;

  const isUp = item.diffRatio > 0;
  const isDown = item.diffRatio < 0;
  const isNew = item.status === 'NEW';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          background: 'rgba(24, 30, 48, 0.98)',
          border: '1.8px solid rgba(16, 185, 129, 0.45)',
          borderRadius: '24px',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.85)',
          overflow: 'hidden',
          animation: 'fadeIn 0.25s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 모달 헤더 */}
        <div
          style={{
            padding: '24px 28px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.22) 0%, rgba(59, 130, 246, 0.18) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '2rem', filter: 'drop-shadow(0 0 8px #10b981)' }}>📑</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: '0.74rem', background: '#10b981', color: '#fff', padding: '2px 8px', borderRadius: 8, fontWeight: 900 }}>
                  DART 공식 5% 대량보유공시
                </span>
                <span style={{ fontSize: '0.8rem', color: '#60a5fa', fontWeight: 800 }}>
                  📅 공시접수: {formatDisclosureDate(item.disclosureDate)}
                </span>
                {estimatedComparison && (
                  <span style={{ fontSize: '0.7rem', background: '#f59e0b', color: '#1e1b0f', padding: '2px 8px', borderRadius: 8, fontWeight: 900 }}>
                    ⚠️ 추정치 (실제 DART 공시 아님)
                  </span>
                )}
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{item.stockName}</span>
                <span style={{ fontSize: '.88rem', color: 'var(--t3)', fontWeight: 600 }}>({item.stockCode})</span>
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* 모달 바디 */}
        <div style={{ padding: '24px 28px', maxHeight: '65vh', overflowY: 'auto' }}>
          {/* 지분 변동 요약 배너 */}
          <div style={{
            padding: '16px 20px',
            borderRadius: 16,
            background: isNew
              ? 'linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(5,150,105,0.15) 100%)'
              : isUp
              ? 'linear-gradient(135deg, rgba(239,68,68,0.25) 0%, rgba(185,28,28,0.15) 100%)'
              : 'linear-gradient(135deg, rgba(59,130,246,0.25) 0%, rgba(37,99,235,0.15) 100%)',
            border: `1.5px solid ${isNew ? '#10b981' : isUp ? '#ef4444' : '#3b82f6'}`,
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8
          }}>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--t3)', fontWeight: 800 }}>공시 보고 유형</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fff', marginTop: 2 }}>
                {isNew ? '🆕 5% 이상 대량보유 신규 취득' : isUp ? `📈 지분 확대 (+${Math.abs(item.diffRatio)}%p 순매수)` : isDown ? `📉 지분 축소 (-${Math.abs(item.diffRatio)}%p 순매도)` : '➡️ 지분 유지 보고'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--t3)', fontWeight: 800 }}>실시간 지분 평가액</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--gold)', fontFamily: 'Space Mono' }}>
                {formatJoEok(item.valueEok)}
              </div>
            </div>
          </div>

          {/* 지분 변동 전후 대조 표 */}
          <div style={{
            background: 'rgba(0,0,0,0.35)',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.08)',
            overflow: 'hidden',
            marginBottom: 20
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '.88rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <th style={{ padding: '12px 16px', color: 'var(--t3)', fontWeight: 800 }}>구분</th>
                  <th style={{ padding: '12px 16px', color: 'var(--t2)', fontWeight: 800, textAlign: 'right' }}>직전 보고서</th>
                  <th style={{ padding: '12px 16px', color: '#10b981', fontWeight: 900, textAlign: 'right' }}>이번 보고서</th>
                  <th style={{ padding: '12px 16px', color: 'var(--gold)', fontWeight: 900, textAlign: 'right' }}>증감 변동내역</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: '#fff' }}>보유 주식 수</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--t3)', textAlign: 'right', fontFamily: 'Space Mono' }}>
                    {item.prevShares ? `${formatNumber(item.prevShares)}주` : '-'}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 900, color: '#fff', textAlign: 'right', fontFamily: 'Space Mono' }}>
                    {formatNumber(item.shares)}주
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 900, color: isUp ? 'var(--up)' : isDown ? 'var(--dn)' : 'var(--t2)', textAlign: 'right', fontFamily: 'Space Mono' }}>
                    {isNew ? `+${formatNumber(item.shares)}주 (신규)` : `${item.diffShares > 0 ? '+' : ''}${formatNumber(item.diffShares)}주`}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: '#fff' }}>지분율 (%)</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--t3)', textAlign: 'right', fontFamily: 'Space Mono' }}>
                    {item.prevRatio ? formatPct(item.prevRatio) : '-'}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 900, color: '#10b981', textAlign: 'right', fontFamily: 'Space Mono', fontSize: '1.05rem' }}>
                    {formatPct(item.ratio)}
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 900, color: isUp ? 'var(--up)' : isDown ? 'var(--dn)' : 'var(--t2)', textAlign: 'right', fontFamily: 'Space Mono', fontSize: '1.05rem' }}>
                    {isNew ? `${formatPct(item.ratio)} (신규)` : `${item.diffRatio > 0 ? '+' : ''}${item.diffRatio}%p`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 공시 상세 정보 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '.76rem', color: 'var(--t3)', fontWeight: 800 }}>보고서 명칭</div>
              <div style={{ fontSize: '.9rem', fontWeight: 800, color: '#fff', marginTop: 3 }}>{item.reportName || '주식등의대량보유상황보고서 (일반투자)'}</div>
            </div>
            <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '.76rem', color: 'var(--t3)', fontWeight: 800 }}>보고자 (제출인)</div>
              <div style={{ fontSize: '.9rem', fontWeight: 800, color: '#fff', marginTop: 3 }}>{item.submitter || '국민연금공단 (NPS)'}</div>
            </div>
            <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '.76rem', color: 'var(--t3)', fontWeight: 800 }}>보유 목적</div>
              <div style={{ fontSize: '.9rem', fontWeight: 800, color: '#10b981', marginTop: 3 }}>{item.purpose || '일반투자목적 (배당 수령 및 주주가치 제고)'}</div>
            </div>
            <div style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '.76rem', color: 'var(--t3)', fontWeight: 800 }}>취득 및 매매 방식</div>
              <div style={{ fontSize: '.9rem', fontWeight: 800, color: '#60a5fa', marginTop: 3 }}>{item.acquisitionMethod || '장내 매수 (한국거래소 직접 체결)'}</div>
            </div>
          </div>

          {/* DART 바로가기 및 분석 액션 */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a
              href={`https://dart.fss.or.kr/`}
              target="_blank"
              rel="noreferrer"
              style={{
                flex: 1,
                padding: '12px 18px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 12,
                color: '#fff',
                fontWeight: 800,
                fontSize: '.85rem',
                textAlign: 'center',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <span>🌐</span>
              <span>금융감독원 DART 공식 공시 원문 보기</span>
            </a>

            <button
              onClick={() => {
                onClose();
                if (onSelectStock) onSelectStock({ code: item.stockCode, name: item.stockName });
              }}
              style={{
                flex: 1,
                padding: '12px 18px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: 12,
                color: '#fff',
                fontWeight: 900,
                fontSize: '.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <span>🏛️</span>
              <span>월가 퀀트 &amp; 세력 평단가 분석 보기</span>
            </button>
          </div>
        </div>

        {/* 모달 푸터 */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.78rem',
            color: 'var(--t3)',
          }}
        >
          <span>자본시장법 제147조(주식등의대량보유상황보고서) 연동</span>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NpsTracker({ onSelectStock }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedQuarter, setSelectedQuarter] = useState('2026_Q3');
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'NEW' | 'INCREASE' | 'DECREASE' | 'SOLD'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'value', direction: 'desc' });
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDisclosure, setSelectedDisclosure] = useState(null);
  const [showPdfModal, setShowPdfModal] = useState(false);

  const fetchData = async (quarter = selectedQuarter, isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const url = quarter ? `/api/nps-holdings?quarter=${quarter}` : '/api/nps-holdings';
      const response = await fetch(url);
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result);
        if (result.quarter) setSelectedQuarter(result.quarter);
        setError(null);
      } else {
        throw new Error('국민연금 데이터를 불러오지 못했습니다.');
      }
    } catch (err) {
      console.error(err);
      if (!isSilent) setError(err.message);
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(selectedQuarter);

    // ⚡ 장중 실시간 30초 주기 자동 갱신 (화면 깜빡임 없는 무소음 갱신)
    const timer = setInterval(() => {
      fetchData(selectedQuarter, true);
    }, 30000);

    return () => clearInterval(timer);
  }, [selectedQuarter]);

  const handleQuarterChange = (q) => {
    setSelectedQuarter(q);
    fetchData(q);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData(selectedQuarter, false);
  };

  // 탭별 필터링 데이터
  const displayList = useMemo(() => {
    if (!data) return [];
    let list = [];
    if (activeTab === 'ALL') list = data.holdings || [];
    else if (activeTab === 'NEW') list = data.comparison?.newStocks || [];
    else if (activeTab === 'INCREASE') list = data.comparison?.increased || [];
    else if (activeTab === 'DECREASE') list = data.comparison?.decreased || [];
    else if (activeTab === 'SOLD') list = data.comparison?.soldStocks || [];

    // 검색어 필터링
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(item => 
        (item.stockName && item.stockName.toLowerCase().includes(q)) ||
        (item.stockCode && item.stockCode.includes(q))
      );
    }

    // 정렬
    return [...list].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (aVal === undefined || aVal === null) aVal = 0;
      if (bVal === undefined || bVal === null) bVal = 0;

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, activeTab, searchQuery, sortConfig]);

  const requestSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const SortIcon = ({ column }) => {
    if (sortConfig.key !== column) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>;
    return <span style={{ marginLeft: '4px', color: '#818cf8', fontWeight: 900 }}>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
  };

  if (loading && !data) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--gold)', fontSize: '1.2rem', fontWeight: 800 }}>
        🏛️ 대한민국 국민연금(NPS) 실시간 국내주식 포트폴리오 집계 중...
      </div>
    );
  }

  const summary = data?.summary || {};
  const quarters = data?.quarters || ['2026_Q3', '2026_Q2', '2026_Q1', '2025_Q4'];
  const comparison = data?.comparison || { newStocks: [], increased: [], decreased: [], soldStocks: [] };

  return (
    <div style={{ padding: '10px 0', animation: 'fadeIn 0.3s ease-in-out' }}>
      {/* ─── 상단 메인 헤더 ─── */}
      <div style={{
        padding: '26px 30px',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(59, 130, 246, 0.15) 100%)',
        border: '2px solid rgba(16, 185, 129, 0.5)',
        borderRadius: 22,
        marginBottom: 24,
        boxShadow: '0 10px 36px rgba(0,0,0,0.45)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '1.55rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ filter: 'drop-shadow(0 0 10px #10b981)' }}>🏛️ 국민연금(NPS) 실시간 국내주식 포트폴리오</span>
              <span style={{ fontSize: '.75rem', background: '#10b981', color: '#fff', padding: '3px 10px', borderRadius: 20, fontWeight: 900 }}>
                {data?.quarter?.replace('_', '년 ')}분기 기준
              </span>
              {data?.prevQuarterEstimated && (
                <span
                  style={{ fontSize: '.75rem', background: '#f59e0b', color: '#1e1b0f', padding: '3px 10px', borderRadius: 20, fontWeight: 900 }}
                  title="전분기 데이터가 실제 DART 공시가 아닌 추정치로 생성되어, 아래 증가/감소/신규편입 비교는 참고용입니다."
                >
                  ⚠️ 추정치 기반 비교 (실제 DART 공시 아님)
                </span>
              )}
            </div>
            <div style={{ fontSize: '.9rem', color: 'var(--t2)', marginTop: 6, lineHeight: 1.6 }}>
              금융감독원 DART 공식 <strong>5% 이상 대량보유 지분 공시</strong> 및 분기별 포트폴리오를 전수 추적합니다. (<strong>공시일자 클릭 시 DART 공시 상세 팝업</strong>)
              {data?.prevQuarterEstimated && (
                <><br /><span style={{ color: '#fbbf24', fontWeight: 700 }}>⚠️ 전분기({data?.prevQuarter}) 데이터는 실제 DART 공시가 아닌 추정치입니다. 증감 비교는 참고용으로만 사용하세요.</span></>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* 분기 선택 셀렉터 */}
            <select
              value={selectedQuarter}
              onChange={(e) => handleQuarterChange(e.target.value)}
              style={{
                padding: '10px 16px',
                background: 'rgba(0,0,0,0.5)',
                border: '1.5px solid #10b981',
                borderRadius: 12,
                color: '#fff',
                fontWeight: 800,
                fontSize: '.9rem',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {quarters.map(q => (
                <option key={q} value={q} style={{ background: '#1e293b', color: '#fff' }}>
                  📅 {q.replace('_', '년 ')}분기 {q === quarters[0] ? '(최신)' : ''}
                </option>
              ))}
            </select>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                padding: '10px 16px',
                background: refreshing ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 12,
                color: '#fff',
                fontWeight: 800,
                cursor: refreshing ? 'not-allowed' : 'pointer',
                fontSize: '.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>{refreshing ? '⏳' : '🔄'}</span>
              <span>{refreshing ? '갱신 중...' : '시세 갱신'}</span>
            </button>

            {/* 📥 PDF 리포트 다운로드 버튼 */}
            <button
              onClick={() => setShowPdfModal(true)}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: '1.5px solid rgba(16, 185, 129, 0.6)',
                borderRadius: 12,
                color: '#fff',
                fontWeight: 900,
                cursor: 'pointer',
                fontSize: '.9rem',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'transform 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <span>📥</span>
              <span>PDF 리포트 다운로드</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── 4대 핵심 요약 KPI 카드 그리드 ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14, marginBottom: 24 }}>
        {/* 1. 총 보유 종목 수 */}
        <div style={{
          padding: '20px 22px',
          background: 'rgba(30, 41, 59, 0.75)',
          border: '1.5px solid rgba(59, 130, 246, 0.4)',
          borderRadius: 18,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
        }}>
          <div style={{ fontSize: '.82rem', color: '#60a5fa', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🏛️</span>
            <span>국민연금 총 보유 종목</span>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', marginTop: 6, fontFamily: 'Space Mono' }}>
            {summary.totalStocks || displayList.length}개
          </div>
          <div style={{ fontSize: '.78rem', color: 'var(--t3)', marginTop: 4 }}>
            5% 이상 대량보유 상장사 (평균 지분율 {summary.avgRatio || 8.2}%)
          </div>
        </div>

        {/* 2. 총 지분 평가액 */}
        <div style={{
          padding: '20px 22px',
          background: 'rgba(30, 41, 59, 0.75)',
          border: '1.5px solid rgba(234, 179, 8, 0.5)',
          borderRadius: 18,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
        }}>
          <div style={{ fontSize: '.82rem', color: '#fbbf24', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>💰</span>
            <span>총 지분 실시간 평가액</span>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--gold)', marginTop: 6, fontFamily: 'Space Mono' }}>
            {formatJoEok(summary.totalValueEok)}
          </div>
          <div style={{ fontSize: '.78rem', color: 'var(--t3)', marginTop: 4 }}>
            보유 전 종목 실시간 현재가 기준 합산
          </div>
        </div>

        {/* 3. 신규 편입 종목 */}
        <div style={{
          padding: '20px 22px',
          background: 'rgba(30, 41, 59, 0.75)',
          border: '1.5px solid rgba(16, 185, 129, 0.4)',
          borderRadius: 18,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
        }}>
          <div style={{ fontSize: '.82rem', color: '#34d399', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🆕</span>
            <span>이번 분기 신규 편입</span>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#10b981', marginTop: 6, fontFamily: 'Space Mono' }}>
            {summary.newCount || comparison.newStocks.length}개
          </div>
          <div style={{ fontSize: '.78rem', color: 'var(--t3)', marginTop: 4 }}>
            전분기 대비 5% 이상 신규 취득 종목
          </div>
        </div>

        {/* 4. 지분 순확대 (매수 우위) */}
        <div style={{
          padding: '20px 22px',
          background: 'rgba(30, 41, 59, 0.75)',
          border: '1.5px solid rgba(239, 68, 68, 0.4)',
          borderRadius: 18,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
        }}>
          <div style={{ fontSize: '.82rem', color: '#f87171', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>📈</span>
            <span>지분 확대 (순매수)</span>
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ef4444', marginTop: 6, fontFamily: 'Space Mono' }}>
            {summary.increasedCount || comparison.increased.length}개
          </div>
          <div style={{ fontSize: '.78rem', color: 'var(--t3)', marginTop: 4 }}>
            전분기 대비 지분율 +0.05%p 이상 매수
          </div>
        </div>
      </div>

      {/* ─── 탭 필터 바 및 검색 ─── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 18
      }}>
        {/* 탭 버튼 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `📋 전체 포트폴리오 (${summary.totalStocks || data?.holdings?.length || 0})` },
            { id: 'NEW', label: `🆕 신규편입 (${summary.newCount || comparison.newStocks.length})` },
            { id: 'INCREASE', label: `📈 비중확대 (${summary.increasedCount || comparison.increased.length})` },
            { id: 'DECREASE', label: `📉 비중축소 (${summary.decreasedCount || comparison.decreased.length})` },
            { id: 'SOLD', label: `🔴 완전매도 (${summary.soldCount || comparison.soldStocks.length})` },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '9px 16px',
                borderRadius: 14,
                border: activeTab === t.id ? '1.5px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
                background: activeTab === t.id ? 'linear-gradient(135deg, rgba(16,185,129,0.3) 0%, rgba(5,150,105,0.2) 100%)' : 'rgba(0,0,0,0.3)',
                color: activeTab === t.id ? '#ffffff' : 'var(--t3)',
                fontSize: '.85rem',
                fontWeight: 900,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: activeTab === t.id ? '0 0 14px rgba(16,185,129,0.35)' : 'none'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 정렬 셀렉터 및 실시간 빠른 검색 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <select
            value={`${sortConfig.key}_${sortConfig.direction}`}
            onChange={(e) => {
              const [key, direction] = e.target.value.split('_');
              setSortConfig({ key, direction });
            }}
            style={{
              padding: '10px 14px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              color: '#fff',
              fontSize: '.85rem',
              fontWeight: 800,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="value_desc" style={{ background: '#1e293b' }}>💰 평가금액 상위순</option>
            <option value="ratio_desc" style={{ background: '#1e293b' }}>📊 지분율 상위순</option>
            <option value="diffRatio_desc" style={{ background: '#1e293b' }}>📈 비중 확대순 (내림차순)</option>
            <option value="diffRatio_asc" style={{ background: '#1e293b' }}>📉 비중 축소순 (내림차순)</option>
            <option value="shares_desc" style={{ background: '#1e293b' }}>📦 보유주식 상위순</option>
          </select>
          
          <div style={{ position: 'relative', minWidth: 260 }}>
            <input
              type="text"
              placeholder="🔍 종목명 / 코드 빠른 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12,
                color: '#fff',
                fontSize: '.85rem',
                outline: 'none'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--t3)',
                  cursor: 'pointer',
                  fontSize: '.9rem',
                  fontWeight: 'bold'
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── 메인 포트폴리오 테이블 ─── */}
      <div style={{
        background: 'var(--bg2)',
        borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
        boxShadow: '0 10px 36px rgba(0,0,0,0.35)'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '850px' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.5)', borderBottom: '1.5px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '16px 20px', color: 'var(--t3)', fontWeight: 800, width: '70px', textAlign: 'center' }}>순위</th>
                <th 
                  onClick={() => requestSort('stockName')} 
                  style={{ padding: '16px 20px', color: 'var(--t3)', fontWeight: 800, cursor: 'pointer' }}
                >
                  종목명 / 코드 <SortIcon column="stockName" />
                </th>
                <th 
                  onClick={() => requestSort('ratio')} 
                  style={{ padding: '16px 20px', color: 'var(--t3)', fontWeight: 800, textAlign: 'right', cursor: 'pointer' }}
                >
                  지분율 (%) <SortIcon column="ratio" />
                </th>
                <th 
                  onClick={() => requestSort('shares')} 
                  style={{ padding: '16px 20px', color: 'var(--t3)', fontWeight: 800, textAlign: 'right', cursor: 'pointer' }}
                >
                  보유 주식 수 <SortIcon column="shares" />
                </th>
                <th 
                  onClick={() => requestSort('currentPrice')} 
                  style={{ padding: '16px 20px', color: 'var(--t3)', fontWeight: 800, textAlign: 'right', cursor: 'pointer' }}
                >
                  실시간 현재가 <SortIcon column="currentPrice" />
                </th>
                <th 
                  onClick={() => requestSort('value')} 
                  style={{ padding: '16px 20px', color: 'var(--t3)', fontWeight: 800, textAlign: 'right', cursor: 'pointer' }}
                >
                  지분 평가금액 <SortIcon column="value" />
                </th>
                <th 
                  onClick={() => requestSort('diffRatio')} 
                  style={{ padding: '16px 20px', color: 'var(--t3)', fontWeight: 800, textAlign: 'center', width: '160px', cursor: 'pointer' }}
                >
                  전분기 대비 (공시일) <SortIcon column="diffRatio" />
                </th>
              </tr>
            </thead>
            <tbody>
              {displayList.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--t3)' }}>
                    조회된 국민연금 보유 종목이 없습니다.
                  </td>
                </tr>
              ) : (
                displayList.map((item, idx) => {
                  const isUp = item.dayChange > 0;
                  const isDown = item.dayChange < 0;
                  const priceColor = isUp ? 'var(--up)' : isDown ? 'var(--dn)' : 'var(--t1)';
                  const sign = isUp ? '▲ ' : isDown ? '▼ ' : '';
                  const rank = item.rank || (idx + 1);

                  return (
                    <tr
                      key={item.stockCode}
                      onClick={() => onSelectStock && onSelectStock({ code: item.stockCode, name: item.stockName })}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        cursor: 'pointer',
                        transition: 'background 0.2s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* 순위 */}
                      <td style={{ padding: '16px 20px', textAlign: 'center', fontWeight: 900, color: rank <= 3 ? 'var(--gold)' : 'var(--t3)', fontSize: '1rem' }}>
                        {rank}
                      </td>

                      {/* 종목명 & 코드 */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span>{item.stockName}</span>
                          {item.status === 'NEW' && (
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDisclosure(item);
                              }}
                              style={{
                                fontSize: '.7rem',
                                background: 'rgba(16,185,129,0.2)',
                                color: '#34d399',
                                border: '1px solid rgba(16,185,129,0.4)',
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontWeight: 800,
                                cursor: 'pointer'
                              }}
                              title="클릭 시 DART 공시 상세 리포트 보기"
                            >
                              📅 신규공시: {formatDisclosureDate(item.disclosureDate)}
                            </span>
                          )}
                          <span style={{ fontSize: '.72rem', background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                            상세 분석 🔗
                          </span>
                        </div>
                        <div style={{ fontSize: '.78rem', color: 'var(--t3)', marginTop: 2, fontFamily: 'Space Mono' }}>
                          {item.stockCode}
                        </div>
                      </td>

                      {/* 지분율 */}
                      <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 900, fontSize: '1.05rem', color: '#10b981', fontFamily: 'Space Mono' }}>
                        {formatPct(item.ratio)}
                      </td>

                      {/* 보유 주식 수 */}
                      <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 700, color: 'var(--t2)', fontFamily: 'Space Mono' }}>
                        {formatNumber(item.shares)}주
                      </td>

                      {/* 실시간 현재가 */}
                      <td style={{ padding: '16px 20px', textAlign: 'right', fontFamily: 'Space Mono' }}>
                        <div style={{ fontWeight: 900, color: '#fff', fontSize: '1.02rem' }}>
                          {item.currentPrice > 0 ? `${formatNumber(item.currentPrice)}원` : '-'}
                        </div>
                        {item.currentPrice > 0 && item.dayChange !== 0 && (
                          <div style={{ fontSize: '.75rem', color: priceColor, marginTop: 2, fontWeight: 700 }}>
                            {sign}{formatNumber(Math.abs(item.dayChange))}원 ({item.dayChangePct > 0 ? '+' : ''}{item.dayChangePct}%)
                          </div>
                        )}
                      </td>

                      {/* 지분 평가금액 */}
                      <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 900, color: 'var(--gold)', fontSize: '1.05rem', fontFamily: 'Space Mono' }}>
                        {formatJoEok(item.valueEok)}
                      </td>

                      {/* 전분기 대비 변동 및 공시일 (클릭 시 공시 팝업) */}
                      <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                        {item.status === 'NEW' && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.2)', border: '1px solid #10b981', color: '#10b981', fontWeight: 900, fontSize: '.78rem' }}>
                              🆕 신규 편입
                            </span>
                            <span 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDisclosure(item);
                              }}
                              style={{
                                fontSize: '.72rem',
                                color: '#34d399',
                                fontWeight: 800,
                                background: 'rgba(0,0,0,0.35)',
                                padding: '2px 6px',
                                borderRadius: 4,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                cursor: 'pointer',
                                border: '1px solid rgba(16,185,129,0.3)'
                              }}
                              title="클릭 시 DART 공시 상세 리포트 보기"
                            >
                              <span>📅</span><span>{formatDisclosureDate(item.disclosureDate)} 📑</span>
                            </span>
                          </div>
                        )}
                        {item.status === 'INCREASE' && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.15)', border: '1px solid #ef4444', color: '#ef4444', fontWeight: 900, fontSize: '.85rem' }}>
                              ▲ +{Math.abs(item.diffRatio)}%p
                            </span>
                            {item.disclosureDate && (
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDisclosure(item);
                                }}
                                style={{ fontSize: '.7rem', color: '#818cf8', cursor: 'pointer', textDecoration: 'underline' }}
                                title="클릭 시 DART 공시 상세 보기"
                              >
                                📅 {item.disclosureDate}
                              </span>
                            )}
                          </div>
                        )}
                        {item.status === 'DECREASE' && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.15)', border: '1px solid #3b82f6', color: '#3b82f6', fontWeight: 900, fontSize: '.85rem' }}>
                              ▼ -{Math.abs(item.diffRatio)}%p
                            </span>
                            {item.disclosureDate && (
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDisclosure(item);
                                }}
                                style={{ fontSize: '.7rem', color: '#818cf8', cursor: 'pointer', textDecoration: 'underline' }}
                                title="클릭 시 DART 공시 상세 보기"
                              >
                                📅 {item.disclosureDate}
                              </span>
                            )}
                          </div>
                        )}
                        {item.status === 'SOLD' && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            <span style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(244,63,94,0.2)', border: '1px solid #f43f5e', color: '#f43f5e', fontWeight: 900, fontSize: '.78rem' }}>
                              🔴 완전 매도
                            </span>
                            {item.disclosureDate && (
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDisclosure(item);
                                }}
                                style={{ fontSize: '.7rem', color: '#818cf8', cursor: 'pointer', textDecoration: 'underline' }}
                                title="클릭 시 DART 공시 상세 보기"
                              >
                                📅 {item.disclosureDate}
                              </span>
                            )}
                          </div>
                        )}
                        {item.status === 'SAME' && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <span style={{ color: 'var(--t3)', fontWeight: 800, fontSize: '.85rem' }}>−</span>
                            {item.disclosureDate && (
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDisclosure(item);
                                }}
                                style={{ fontSize: '.68rem', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
                                title="클릭 시 DART 공시 상세 보기"
                              >
                                📅 {item.disclosureDate}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── DART 실시간 5% 이상 대량보유 공시 타임라인 (금융감독원 DART Open API 실시간 조회) ─── */}
      <div style={{ marginTop: 24, padding: '22px 26px', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20 }}>
        <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#fff', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>📑</span>
          <span>최근 DART 국민연금 5% 대량보유 주요 공시 타임라인</span>
        </div>
        {data?.disclosures?.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {data.disclosures.map((d, i) => (
              <a
                key={d.rcpNo || i}
                href={d.dartUrl || 'https://dart.fss.or.kr/'}
                target="_blank"
                rel="noreferrer"
                style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', textDecoration: 'none', display: 'block' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 900, color: '#fff', fontSize: '.95rem' }}>{d.company}{d.stockCode ? ` (${d.stockCode})` : ''}</span>
                  <span style={{ fontSize: '.72rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>{d.type}</span>
                </div>
                <div style={{ fontSize: '.78rem', color: 'var(--t2)', marginTop: 2 }}>
                  {d.report}
                  {/* DART 공시 목록 API는 지분율/주식수를 제공하지 않으므로 지어내지 않고, 원문 확인 안내만 표시 */}
                  <span style={{ color: 'var(--t3)' }}> · 지분율/주식수는 공시 원문 참조</span>
                </div>
                <div style={{ fontSize: '.72rem', color: 'var(--t3)', marginTop: 4 }}>
                  공시일자: {formatDisclosureDate(d.date)}
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--t3)', fontSize: '.85rem' }}>
            최근 조회 기간 내 DART에 접수된 국민연금 관련 5% 대량보유 공시가 없습니다.
          </div>
        )}
      </div>

      {/* ─── 📑 국민연금 DART 상세 공시 팝업 모달 ─── */}
      {selectedDisclosure && (
        <NpsDisclosureModal
          item={selectedDisclosure}
          onClose={() => setSelectedDisclosure(null)}
          onSelectStock={onSelectStock}
          estimatedComparison={!!data?.prevQuarterEstimated}
        />
      )}

      {/* ─── 📑 국민연금 포트폴리오 PDF 리포트 생성 및 인쇄 모달 ─── */}
      {showPdfModal && (
        <NpsPdfReportModal
          data={data}
          selectedQuarter={selectedQuarter}
          onClose={() => setShowPdfModal(false)}
        />
      )}
    </div>
  );
}
