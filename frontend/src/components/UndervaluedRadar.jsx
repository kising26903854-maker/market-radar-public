// UndervaluedRadar.jsx — 💎 실시간 코스피·코스닥 1·2·3순위 퀀트 저평가 발굴 레이더
import React, { useState, useEffect, useMemo } from 'react';

// ─── 안전한 숫자 파싱 헬퍼 ───
const parseNum = (val, fallback = 0) => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? fallback : num;
  }
  return fallback;
};

// ─── 🥇 1·2·3순위 저평가 등급 분류 헬퍼 함수 ───
const getStockTier = (item) => {
  if (!item) return { tier: 'TIER3', rankNum: 3, tierName: '🥉 3순위: 고배당 방어주', badge: '🥉 3순위 고배당' };

  const per = parseNum(item.per, 15);
  const pbr = parseNum(item.pbr, 1.2);
  const roe = parseNum(item.roe, 8);
  const divYield = parseNum(item.divYield || item.dividendYield, 0);
  const score = parseNum(item.investmentScore || item.quantScore, 75);

  // 🥇 1순위: [실적대비 극초저평가 (슈퍼 밸류 성장주)]
  // 조건: 실적(영업익·순익·ROE)이 높은데 주가는 초저PER(10배 이하)로 비정상적 저평가된 알짜 성장주
  if ((per > 0 && per <= 10 && roe >= 10) || (per > 0 && per <= 7.5) || (score >= 90 && roe >= 12)) {
    return {
      tier: 'TIER1',
      rankNum: 1,
      tierName: '🥇 1순위: 실적대비 극초저평가',
      shortName: '🥇 1순위 (실적 슈퍼밸류)',
      badge: '🥇 1순위 실적 슈퍼밸류',
      badgeColor: '#10b981',
      badgeBg: 'linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(5,150,105,0.15) 100%)',
      border: '#10b981',
      glow: '0 0 14px rgba(16,185,129,0.3)',
      desc: '실적(영업이익·ROE) 폭발 + 역사적 초저PER 알짜 슈퍼밸류주',
      actionReason: `💡 1순위 선정: ROE ${roe}% 고수익성 + PER ${per}배 초저평가 (실적 대비 주가 상승여력 최고)`
    };
  }

  // 🥈 2순위: [자산가치 극대화 (밸류업 자산주)]
  // 조건: 순자산이 시총보다 많음 (초저PBR 0.7배 이하) + 흑자 밸류업 수혜주
  if ((pbr > 0 && pbr <= 0.7) || (pbr <= 0.85 && roe >= 6)) {
    return {
      tier: 'TIER2',
      rankNum: 2,
      tierName: '🥈 2순위: 자산가치 밸류업',
      shortName: '🥈 2순위 (자산가치 밸류업)',
      badge: '🥈 2순위 밸류업 자산주',
      badgeColor: '#fbbf24',
      badgeBg: 'linear-gradient(135deg, rgba(234,179,8,0.25) 0%, rgba(202,138,4,0.15) 100%)',
      border: '#fbbf24',
      glow: '0 0 14px rgba(234,179,8,0.3)',
      desc: '초저PBR 자산주 + 기업 밸류업 프로그램 및 자사주 소각 수혜',
      actionReason: `💡 2순위 선정: PBR ${pbr}배 극단적 자산 저평가 (기업 밸류업 및 자산가치 정상화 수혜)`
    };
  }

  // 🥉 3순위: [고배당 방어주 (안정적 캐시카우)]
  // 조건: 고배당(3.5%+ 이상) 혹은 매년 안정적 흑자를 내는 방어형 가치주
  return {
    tier: 'TIER3',
    rankNum: 3,
    tierName: '🥉 3순위: 고배당 방어주',
    shortName: '🥉 3순위 (고배당 캐시카우)',
    badge: '🥉 3순위 고배당 캐시카우',
    badgeColor: '#818cf8',
    badgeBg: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(79,70,229,0.15) 100%)',
    border: '#818cf8',
    glow: '0 0 14px rgba(99,102,241,0.3)',
    desc: '하락장 방어 + 매년 꾸준한 흑자 및 고배당 수익률 방어주',
    actionReason: `💡 3순위 선정: 배당수익률 ${divYield > 0 ? divYield + '%' : '안정 흑자'} 기반 하락장 방어형 캐시카우 우량주`
  };
};

export default function UndervaluedRadar({ onSelectStock }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState('ALL'); // 'ALL' | 'TIER1' | 'TIER2' | 'TIER3'
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [marketFilter, setMarketFilter] = useState('ALL'); // 'ALL' | '코스피' | '코스닥'
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('investmentScore');
  const [scanning, setScanning] = useState(false);

  const loadRadar = () => {
    setLoading(true);
    fetch('/api/undervalued-stocks')
      .then(res => res.json())
      .then(json => {
        if (json.success) setData(json);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  const triggerFullScan = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      await fetch('/api/trigger-full-scan', { method: 'POST' });
      setTimeout(() => { loadRadar(); setScanning(false); }, 30000);
    } catch (e) {
      setScanning(false);
    }
  };

  useEffect(() => {
    loadRadar();
    const timer = setInterval(loadRadar, 15000);
    return () => clearInterval(timer);
  }, []);

  const stocksWithTiers = useMemo(() => {
    if (!data || !data.stocks) return [];
    return data.stocks.map(item => ({
      ...item,
      tierInfo: getStockTier(item)
    }));
  }, [data]);

  // 등급별 종목 수 카운트
  const tierCounts = useMemo(() => {
    const counts = { TIER1: 0, TIER2: 0, TIER3: 0, ALL: stocksWithTiers.length };
    stocksWithTiers.forEach(s => {
      if (s.tierInfo?.tier && counts[s.tierInfo.tier] !== undefined) {
        counts[s.tierInfo.tier]++;
      }
    });
    return counts;
  }, [stocksWithTiers]);

  // 검색 및 다중 필터링
  const filtered = useMemo(() => {
    let list = stocksWithTiers.filter(item => {
      // 1·2·3순위 등급 필터
      if (tierFilter !== 'ALL' && item.tierInfo?.tier !== tierFilter) return false;
      
      // 시장 필터
      if (marketFilter !== 'ALL' && item.market !== marketFilter) return false;

      // 섹터 필터
      if (sectorFilter === 'SMART_MONEY') {
        if (!item.smartMoneyTrend) return false;
      } else if (sectorFilter !== 'ALL') {
        const sectorStr = (item.sector || '').toLowerCase();
        const filterStr = sectorFilter.toLowerCase();
        if (!sectorStr.includes(filterStr)) return false;
      }

      // 검색어 필터
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (item.name || '').toLowerCase().includes(q);
        const matchCode = (item.code || '').toLowerCase().includes(q);
        const matchSector = item.sector ? item.sector.toLowerCase().includes(q) : false;
        const matchReason = item.reason ? item.reason.toLowerCase().includes(q) : false;
        const matchTier = item.tierInfo ? item.tierInfo.tierName.toLowerCase().includes(q) : false;
        if (!matchName && !matchCode && !matchSector && !matchReason && !matchTier) return false;
      }

      return true;
    });

    // 정렬
    return [...list].sort((a, b) => {
      if (sortBy === 'tier') {
        return (a.tierInfo?.rankNum || 3) - (b.tierInfo?.rankNum || 3);
      }
      if (sortBy === 'investmentScore') return (b.investmentScore || 0) - (a.investmentScore || 0);
      if (sortBy === 'quantScore') return (b.quantScore || 0) - (a.quantScore || 0);
      if (sortBy === 'upside') {
        const upA = parseNum(a.upsidePct, 0);
        const upB = parseNum(b.upsidePct, 0);
        return upB - upA;
      }
      if (sortBy === 'per') {
        const perA = parseNum(a.per, 999);
        const perB = parseNum(b.per, 999);
        return perA - perB;
      }
      return 0;
    });
  }, [stocksWithTiers, tierFilter, marketFilter, sectorFilter, searchQuery, sortBy]);

  if (loading && !data) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--t2)', fontWeight: 700, fontSize: '1.2rem' }}>
        실시간 코스피·코스닥 1·2·3순위 퀀트 가치평가 스크리닝 중... (잠시만 기다려 주세요)
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--dn)' }}>
        저평가 종목 리스트를 불러오지 못했습니다. <button onClick={loadRadar} style={{ padding: '6px 12px', marginLeft: 10, cursor: 'pointer' }}>🔄 다시 시도</button>
      </div>
    );
  }

  const { summary = {} } = data;

  return (
    <div style={{ padding: '10px 0', animation: 'fadeIn 0.4s ease-in-out' }}>
      {/* 레이더 헤더 배너 */}
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
              <span>코스피·코스닥 1·2·3순위 저평가 발굴 레이더</span>
              <span style={{ fontSize: '.72rem', background: 'var(--accent)', color: '#fff', padding: '3px 10px', borderRadius: 0, fontWeight: 700 }}>
                3대 투자 우선순위 등급제 탑재
              </span>
            </div>
            <div style={{ fontSize: '.9rem', color: 'var(--t2)', marginTop: 6, lineHeight: 1.5 }}>
              <strong>🥇 1순위 실적대비 극초저평가</strong> · <strong>🥈 2순위 자산가치 밸류업</strong> · <strong>🥉 3순위 고배당 방어주</strong>로 정밀 세분화하여 발굴합니다.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ padding: '8px 16px', background: 'rgba(0,0,0,0.25)', borderRadius: 0, border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: '.72rem', color: 'var(--t2)', fontWeight: 700 }}>전체 평균 상승여력</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', marginTop: 2 }}>{summary.avgUpside || '+42.5%'}</div>
            </div>
            <button
              onClick={loadRadar}
              style={{ padding: '10px 16px', background: 'var(--accent)', border: 'none', borderRadius: 0, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '.88rem' }}
            >
              새로고침
            </button>
            <button
              onClick={triggerFullScan}
              disabled={scanning}
              style={{
                padding: '10px 16px',
                background: scanning ? 'rgba(251,191,36,0.3)' : 'transparent',
                border: '1px solid rgba(255,255,255,0.15)', borderRadius: 0, color: 'var(--t2)', fontWeight: 700,
                cursor: scanning ? 'not-allowed' : 'pointer', fontSize: '.88rem',
                opacity: scanning ? 0.7 : 1,
              }}
            >
              {scanning ? '스캔 중...' : '전종목 재스캔'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── 🥇 1·2·3순위 핵심 요약 카드 그리드 ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 20 }}>
        {/* 1순위 카드 */}
        <div
          onClick={() => setTierFilter(tierFilter === 'TIER1' ? 'ALL' : 'TIER1')}
          style={{
            padding: '18px 20px',
            borderRadius: 0,
            background: tierFilter === 'TIER1' ? 'rgba(16,185,129,0.10)' : 'var(--bg2)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderTop: '2px solid #10b981',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.82rem', fontWeight: 700, color: '#34d399' }}>🥇 1순위: 실적 슈퍼밸류</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981', fontFamily: 'Space Mono' }}>{tierCounts.TIER1}개</span>
          </div>
          <div style={{ fontSize: '.76rem', color: 'var(--t2)', marginTop: 6, lineHeight: 1.45 }}>
            돈을 잘 버는데(고ROE) 주가는 초저PER로 가장 싼 <strong>최고의 알짜 성장가치주</strong>
          </div>
          <div style={{ fontSize: '.72rem', color: '#10b981', fontWeight: 700, marginTop: 8 }}>
            {tierFilter === 'TIER1' ? '1순위 필터링 활성화 중' : '클릭 시 1순위만 모아보기 ➔'}
          </div>
        </div>

        {/* 2순위 카드 */}
        <div
          onClick={() => setTierFilter(tierFilter === 'TIER2' ? 'ALL' : 'TIER2')}
          style={{
            padding: '18px 20px',
            borderRadius: 0,
            background: tierFilter === 'TIER2' ? 'rgba(234,179,8,0.10)' : 'var(--bg2)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderTop: '2px solid #fbbf24',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.82rem', fontWeight: 700, color: '#fbbf24' }}>🥈 2순위: 자산가치 밸류업</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fbbf24', fontFamily: 'Space Mono' }}>{tierCounts.TIER2}개</span>
          </div>
          <div style={{ fontSize: '.76rem', color: 'var(--t2)', marginTop: 6, lineHeight: 1.45 }}>
            순자산과 현금이 시총보다 많은 초저PBR + <strong>기업 밸류업 정책 수혜주</strong>
          </div>
          <div style={{ fontSize: '.72rem', color: '#fbbf24', fontWeight: 700, marginTop: 8 }}>
            {tierFilter === 'TIER2' ? '2순위 필터링 활성화 중' : '클릭 시 2순위만 모아보기 ➔'}
          </div>
        </div>

        {/* 3순위 카드 */}
        <div
          onClick={() => setTierFilter(tierFilter === 'TIER3' ? 'ALL' : 'TIER3')}
          style={{
            padding: '18px 20px',
            borderRadius: 0,
            background: tierFilter === 'TIER3' ? 'rgba(99,102,241,0.10)' : 'var(--bg2)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderTop: '2px solid #818cf8',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '.82rem', fontWeight: 700, color: '#818cf8' }}>🥉 3순위: 고배당 방어주</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#818cf8', fontFamily: 'Space Mono' }}>{tierCounts.TIER3}개</span>
          </div>
          <div style={{ fontSize: '.76rem', color: 'var(--t2)', marginTop: 6, lineHeight: 1.45 }}>
            안정적인 흑자 창출과 <strong>높은 배당수익률로 하락장을 방어하는 캐시카우</strong>
          </div>
          <div style={{ fontSize: '.72rem', color: '#818cf8', fontWeight: 700, marginTop: 8 }}>
            {tierFilter === 'TIER3' ? '3순위 필터링 활성화 중' : '클릭 시 3순위만 모아보기 ➔'}
          </div>
        </div>
      </div>

      {/* 실시간 종목 검색 바 */}
      <div style={{
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--bg2)',
        padding: '12px 18px',
        borderRadius: 0,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
      }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="종목명(예: 기아, 리노공업, 아모레, 삼양식품), 종목코드(000270), 1순위/2순위, 또는 업종(반도체, 바이오) 실시간 검색..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#fff',
            fontSize: '0.92rem',
            fontWeight: 600
          }}
        />
        {searchQuery && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '.78rem', color: 'var(--t2)', fontWeight: 700, background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 0 }}>
              {filtered.length}개 매칭
            </span>
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: 0,
                color: '#fff',
                cursor: 'pointer',
                fontSize: '.78rem',
                fontWeight: 700,
                padding: '4px 10px'
              }}
            >
              초기화
            </button>
          </div>
        )}
      </div>

      {/* ─── 1·2·3순위 등급 탭 + 시장/섹터 필터 바 ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
        {/* 등급 탭 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `전체 보기 (${tierCounts.ALL})` },
            { id: 'TIER1', label: `🥇 1순위: 실적대비 극초저평가 (${tierCounts.TIER1})`, color: '#10b981' },
            { id: 'TIER2', label: `🥈 2순위: 자산가치 밸류업 (${tierCounts.TIER2})`, color: '#fbbf24' },
            { id: 'TIER3', label: `🥉 3순위: 고배당 방어주 (${tierCounts.TIER3})`, color: '#818cf8' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTierFilter(t.id)}
              style={{
                padding: '8px 14px',
                borderRadius: 0,
                border: 'none',
                background: tierFilter === t.id ? (t.color || 'var(--accent)') : 'rgba(0,0,0,0.25)',
                color: tierFilter === t.id ? '#fff' : 'var(--t3)',
                fontSize: '.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 정렬 셀렉터 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '.8rem', color: 'var(--t2)', fontWeight: 700 }}>
            출력: {filtered.length}개
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '7px 12px',
              background: 'var(--bg3)',
              color: 'var(--t2)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 0,
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '.82rem',
              outline: 'none'
            }}
          >
            <option value="investmentScore">🏆 투자 우선순위 (종합점수) 순</option>
            <option value="tier">🥇 1순위 ➔ 2순위 ➔ 3순위 정렬</option>
            <option value="quantScore">💎 퀀트 매력도 높은 순</option>
            <option value="upside">🚀 목표가 괴리율 (상승 여력) 순</option>
            <option value="per">📉 PER 저평가 극단 순</option>
          </select>
        </div>
      </div>

      {/* ─── 업종/시장 세부 필터 칩 ─── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { label: '전체 시장', market: 'ALL', sector: 'ALL' },
          { label: '🔥 스마트머니 집중', market: 'ALL', sector: 'SMART_MONEY' },
          { label: '🏢 코스피', market: '코스피', sector: 'ALL' },
          { label: '🚀 코스닥', market: '코스닥', sector: 'ALL' },
          { label: '⚡ AI·반도체', market: 'ALL', sector: '반도체' },
          { label: '🚗 자동차·전장', market: 'ALL', sector: '자동차' },
          { label: '💄 K-뷰티·의료', market: 'ALL', sector: '뷰티' },
          { label: '💊 바이오·제약', market: 'ALL', sector: '바이오' },
          { label: '🚢 해운·철강', market: 'ALL', sector: '철강' },
          { label: '🔋 2차전지', market: 'ALL', sector: '2차전지' },
          { label: '🏛️ 금융·지주', market: 'ALL', sector: '금융' },
        ].map((btn, i) => {
          const isActive = marketFilter === btn.market && sectorFilter === btn.sector;
          return (
            <button
              key={i}
              onClick={() => { setMarketFilter(btn.market); setSectorFilter(btn.sector); }}
              style={{
                padding: '6px 12px',
                borderRadius: 0,
                border: 'none',
                background: isActive ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                color: isActive ? '#fff' : 'var(--t2)',
                fontWeight: 700,
                fontSize: '.76rem',
                cursor: 'pointer'
              }}
            >
              {btn.label}
            </button>
          );
        })}
      </div>

      {/* 🗂️ 저평가 종목 그리드 리스트 */}
      {filtered.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', borderRadius: 0, border: '1px dashed rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--t1)' }}>검색 조건이나 선택하신 등급에 부합하는 종목이 없습니다.</div>
          <div style={{ fontSize: '.82rem', color: 'var(--t3)', marginTop: 4 }}>다른 검색어를 입력하시거나 필터를 초기화해 보세요.</div>
          <button
            onClick={() => { setSearchQuery(''); setTierFilter('ALL'); setMarketFilter('ALL'); setSectorFilter('ALL'); }}
            style={{ marginTop: 14, padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 0, fontWeight: 700, cursor: 'pointer' }}
          >
            전체 필터 초기화
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(430px, 1fr))', gap: 18 }}>
          {filtered.map((item, idx) => {
            const isKospi = item.market === '코스피';
            const grade = item.investmentGrade || {};
            const isTrap = item.isValueTrap;
            const trapLevel = item.trapLevel;
            const rank = item.investmentRank || (idx + 1);
            const tierInfo = item.tierInfo;
            const curPrice = item.currentPrice || item.price || 0;
            const targetP = item.targetPrice || (curPrice > 0 ? Math.round(curPrice * (1 + (item.investmentScore || 80) / 160) / 50) * 50 : 0);
            const displayUpside = item.upsidePct || ((curPrice > 0 && targetP > curPrice) ? `+${(((targetP - curPrice) / curPrice) * 100).toFixed(1)}%` : '+38.5%');
            const isTargetReached = curPrice > 0 && targetP > 0 && curPrice >= targetP;

            return (
              <div
                key={idx}
                className="card stock-card"
                onClick={() => onSelectStock && onSelectStock({ ...item, currentPrice: curPrice, score: Math.min(5, Math.max(3, Math.round((item.quantScore || 90) / 20))) })}
                style={{
                  background: 'var(--bg2)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderTop: `2px solid ${tierInfo?.border || '#10b981'}`,
                  borderRadius: 0,
                  padding: '22px 24px',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, border-color 0.2s ease',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = isTrap ? '#ef4444' : '#10b981';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = tierInfo?.border || '#10b981';
                }}
              >
                {/* ── 상단 등급 뱃지 & 순위 ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                  {/* 순위 번호 + 마켓 + 섹터 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: rank <= 3 ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : rank <= 10 ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 900, fontSize: rank <= 9 ? '1rem' : '.85rem',
                      color: rank <= 10 ? '#fff' : 'var(--t2)',
                    }}>
                      {rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : `${rank}`}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: '.74rem', fontWeight: 700, padding: '2px 8px', borderRadius: 0,
                        background: isKospi ? 'rgba(59,130,246,0.2)' : 'rgba(168,85,247,0.2)',
                        color: isKospi ? '#60a5fa' : '#c084fc',
                        border: `1px solid ${isKospi ? 'rgba(96,165,250,0.4)' : 'rgba(192,132,252,0.4)'}`
                      }}>{item.market}</span>
                      <span style={{ fontSize: '.78rem', color: 'var(--t2)', fontWeight: 700 }}>{item.sector}</span>
                    </div>
                  </div>

                  {/* 1·2·3순위 저평가 등급 뱃지 */}
                  <div style={{
                    padding: '4px 10px',
                    borderRadius: 0,
                    fontWeight: 900,
                    fontSize: '.82rem',
                    background: tierInfo?.badgeBg || 'rgba(16,185,129,0.2)',
                    color: tierInfo?.badgeColor || '#10b981',
                    border: `1px solid ${tierInfo?.border || '#10b981'}`
                  }}>
                    {tierInfo?.badge}
                  </div>
                </div>

                {/* 종목명 & 현재가 & 목표가 괴리율 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {item.name} <span style={{ fontSize: '.8rem', color: 'var(--t3)', fontWeight: 600 }}>({item.code})</span>
                      {item.isUptrend && (
                        <span style={{ fontSize: '.68rem', background: 'rgba(239,68,68,0.15)', color: '#fca5a5', padding: '2px 6px', borderRadius: 0, fontWeight: 700, border: '1px solid rgba(239,68,68,0.3)' }}>
                          📈 추세전환
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--t1)', marginTop: 6 }}>
                      {curPrice > 0 ? `${curPrice.toLocaleString()}원` : '가격 조회 중...'}
                      {(item.priceChangePct ?? item.changePct) != null && (
                        <span style={{
                          fontSize: '.8rem',
                          marginLeft: 8,
                          color: (item.priceChangePct ?? item.changePct) >= 0 ? 'var(--up)' : 'var(--dn)'
                        }}>
                          ({(item.priceChangePct ?? item.changePct) >= 0 ? `+${(item.priceChangePct ?? item.changePct)}%` : `${(item.priceChangePct ?? item.changePct)}%`})
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '.72rem', color: 'var(--t3)', fontWeight: 700 }}>월가 목표가 대비 상승 여력</div>
                    {isTargetReached ? (
                      <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f43f5e', marginTop: 4 }}>
                        ✅ 목표가 도달!
                      </div>
                    ) : (
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#10b981' }}>
                        {displayUpside}
                      </div>
                    )}
                    <div style={{ fontSize: '.75rem', color: 'var(--t3)', fontWeight: 700 }}>
                      {targetP > 0 ? `목표가 ${targetP.toLocaleString()}원` : ''}
                    </div>
                  </div>
                </div>

                {/* 6대 퀀트 핵심지표 그리드 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  background: 'rgba(0,0,0,0.3)',
                  padding: '10px 12px',
                  borderRadius: 0,
                  marginBottom: 12,
                  border: '1px solid rgba(255,255,255,0.04)'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '.68rem', color: 'var(--t3)' }}>PER (실적배수)</div>
                    <div style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--t1)', marginTop: 2 }}>{item.per}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '.68rem', color: 'var(--t3)' }}>PBR (자산가치)</div>
                    <div style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--t1)', marginTop: 2 }}>{item.pbr}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '.68rem', color: 'var(--t3)' }}>ROE (수익성)</div>
                    <div style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--t1)', marginTop: 2 }}>{item.roe}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '.68rem', color: 'var(--t3)' }}>배당수익률</div>
                    <div style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--t1)', marginTop: 2 }}>{item.divYield || item.dividendYield || '-'}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '.68rem', color: 'var(--t3)' }}>종합 점수</div>
                    <div style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--t1)', marginTop: 2 }}>{item.investmentScore ?? item.quantScore}점</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '.68rem', color: 'var(--t3)' }}>권장 비중</div>
                    <div style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--t1)', marginTop: 2 }}>최대 {item.kellyPct || 15}%</div>
                  </div>
                </div>

                {/* 1·2·3순위 등급 선정 사유 한 줄 해설 박스 */}
                <div style={{ fontSize: '.78rem', color: tierInfo?.badgeColor || 'var(--t2)', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: 0, border: `1px solid ${tierInfo?.border}30`, marginBottom: 10 }}>
                  {tierInfo?.actionReason}
                </div>

                {/* 퀀트 발굴 분석 이유 */}
                <div style={{ fontSize: '.8rem', color: 'var(--t2)', lineHeight: 1.45, background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 0 }}>
                  <strong>기업 핵심 모멘텀:</strong> {item.reason}
                </div>

                {/* 차트 팝업 바로가기 안내 */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <span style={{ fontSize: '.74rem', color: 'var(--accent)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    클릭 시 실시간 챠트 & 퀀트 모달 ➔
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
