// YeokmaegongpaTab.jsx — 🧱 "역매공파" 후보 스캐너 (역배열 하락 → 매집 → 공구리 → 112일선 추세 전환)
import React, { useState, useEffect, useMemo } from 'react';

const formatNumber = (num) => new Intl.NumberFormat('ko-KR').format(num || 0);

const formatEok = (eok) => {
  if (!eok) return '-';
  if (eok >= 10000) {
    const jo = Math.floor(eok / 10000);
    const rem = Math.round(eok % 10000);
    return `${jo.toLocaleString()}조${rem > 0 ? ' ' + rem.toLocaleString() + '억' : ''}`;
  }
  return `${Math.round(eok).toLocaleString()}억`;
};

const COND_META = [
  { key: 'A', label: '장기 하락', color: '#a78bfa', desc: '448>224>112일선 역배열, 고점 대비 -30%↓' },
  { key: 'B', label: '매집/수급', color: '#f59e0b', desc: '거래량 3배↑ 양봉 + 5%↑ 장대양봉' },
  { key: 'C', label: '공구리', color: '#38bdf8', desc: '변동폭 축소, 저점 이탈 없음' },
  { key: 'D', label: '추세 전환', color: '#34d399', desc: '112일선 위 +10% 이내, 단기선 상승' },
];
const ALL_ON = { A: true, B: true, C: true, D: true };
const ALL_OFF = { A: false, B: false, C: false, D: false };

export default function YeokmaegongpaTab({ onSelectStock }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('PASSED_DESC');
  // 체크된 조건을 "모두" 만족하는 종목만 표시 (기본: 원문 검색식대로 A~D 전부 체크)
  const [checks, setChecks] = useState(ALL_ON);
  const toggleCheck = (k) => setChecks(prev => ({ ...prev, [k]: !prev[k] }));

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchStocks = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch('/api/yeokmaegongpa');
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error('역매공파 로드 실패:', err);
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStocks();
    const interval = setInterval(() => fetchStocks(true), 120000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/trigger-yeokmaegongpa-scan', { method: 'POST' });
      showToast('🔄 전 종목 재스캔이 시작되었습니다 (몇 분 걸릴 수 있어요). 잠시 후 새로고침 해주세요.');
    } catch (e) {
      showToast('재스캔 요청 중 오류가 발생했습니다.');
    } finally {
      setTimeout(() => fetchStocks(false), 3000);
    }
  };

  const rawList = data?.matched || [];
  const funnel = data?.funnel;
  const isScanning = data?.scanning;
  const lastSyncAt = data?.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString('ko-KR') : '스캔 대기 중';

  const filteredList = useMemo(() => {
    const activeKeys = Object.keys(checks).filter(k => checks[k]);
    let list = rawList.filter(s => activeKeys.every(k => s.flags?.[k]));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(s => (s.name || '').toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q));
    }
    if (sortBy === 'DROP_DESC') list.sort((a, b) => (b.dropPct || 0) - (a.dropPct || 0));
    else if (sortBy === 'CAP_DESC') list.sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
    else list.sort((a, b) => (b.passed - a.passed) || ((b.dropPct || 0) - (a.dropPct || 0)));
    return list;
  }, [rawList, checks, searchQuery, sortBy]);
  const checkedCount = Object.values(checks).filter(Boolean).length;

  const chip = { padding: '2px 8px', borderRadius: 0, fontSize: '.7rem', fontWeight: 700, background: 'rgba(255,255,255,0.06)', color: 'var(--t2)' };

  return (
    <div style={{ padding: '10px 0', animation: 'fadeIn 0.3s ease-in-out' }}>
      {toastMessage && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '14px 20px', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontWeight: 800, fontSize: '.9rem', zIndex: 5000, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          {toastMessage}
        </div>
      )}

      {/* ─── 헤더 배너 ─── */}
      <div style={{ padding: '22px 26px', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 18, boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span>🧱 역매공파</span>
              <span style={{ fontSize: '.75rem', background: 'rgba(255,255,255,0.06)', color: 'var(--t2)', border: '1px solid rgba(255,255,255,0.15)', padding: '4px 12px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: isScanning ? '#fbbf24' : '#10b981', display: 'inline-block' }} />
                {isScanning ? '최초 스캔 진행 중...' : `${(funnel?.scanned || 0).toLocaleString()}종목 스캔 완료`}
              </span>
            </div>
            <div style={{ fontSize: '.86rem', color: 'var(--t3)', marginTop: 6, lineHeight: 1.6 }}>
              <strong>역</strong>(448·224·112일선 역배열 장기 하락) → <strong>매</strong>(거래량 급증 매집) → <strong>공</strong>(공구리: 변동폭 축소 바닥다지기) → <strong>파</strong>(112일선 돌파·안착) 순서로 진행 중인 종목을 찾습니다. 아래 조건별 체크박스로 켜고 끌 수 있어요.
            </div>
            <div style={{ fontSize: '.76rem', color: 'var(--t3)', marginTop: 6 }}>마지막 스캔: {lastSyncAt} (매일 장 마감 후 16:00 자동 갱신)</div>
          </div>
          <button onClick={handleRefresh} disabled={refreshing} style={{ padding: '9px 16px', background: 'var(--accent)', border: 'none', color: '#fff', fontWeight: 700, cursor: refreshing ? 'not-allowed' : 'pointer', fontSize: '.82rem' }}>
            {refreshing ? '스캔 요청 중...' : '전종목 재스캔'}
          </button>
        </div>
      </div>

      {/* ─── 조건별 체크박스 (체크한 조건을 모두 만족하는 종목만 표시) ─── */}
      {funnel && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 8 }}>
            {COND_META.map(c => {
              const on = checks[c.key];
              return (
                <label key={c.key} style={{ cursor: 'pointer', padding: '16px 18px', display: 'block', background: on ? 'rgba(129,140,248,0.12)' : 'var(--bg2)', border: on ? `1px solid ${c.color}` : '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '.82rem', fontWeight: 800, color: on ? '#fff' : 'var(--t2)' }}>{c.key} {c.label}</span>
                    <input type="checkbox" checked={on} onChange={() => toggleCheck(c.key)} style={{ width: 18, height: 18, accentColor: c.color, cursor: 'pointer' }} />
                  </div>
                  <div style={{ fontSize: '.7rem', color: 'var(--t3)', marginTop: 4, lineHeight: 1.4 }}>{c.desc}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: c.color, marginTop: 8, fontFamily: 'Space Mono' }}>
                    {(funnel[c.key] || 0).toLocaleString()} <span style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--t3)' }}>종목 통과</span>
                  </div>
                </label>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '.8rem', color: 'var(--t2)' }}>
              체크한 {checkedCount}개 조건을 <strong style={{ color: '#fff' }}>모두</strong> 만족하는 종목: <strong style={{ color: '#f472b6' }}>{filteredList.length.toLocaleString()}개</strong>
            </span>
            <button onClick={() => setChecks(ALL_ON)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--t2)', fontSize: '.74rem', fontWeight: 700, cursor: 'pointer' }}>전체 체크</button>
            <button onClick={() => setChecks(ALL_OFF)} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--t2)', fontSize: '.74rem', fontWeight: 700, cursor: 'pointer' }}>전체 해제</button>
          </div>
        </>
      )}

      {/* ─── 검색 & 정렬 ─── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', padding: '8px 14px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="종목명, 코드 검색..." style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '.85rem', width: '140px' }} />
          {searchQuery && <button onClick={() => setSearchQuery('')} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer' }}>✕</button>}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '.84rem', outline: 'none', cursor: 'pointer' }}>
          <option value="PASSED_DESC">충족 조건 많은순</option>
          <option value="DROP_DESC">고점 대비 하락폭 큰순</option>
          <option value="CAP_DESC">시가총액 큰순</option>
        </select>
      </div>

      {/* ─── 종목 카드 ─── */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#fff', fontWeight: 700 }}>스캔 데이터를 불러오는 중...</div>
      ) : isScanning ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>전 종목 최초 스캔이 백그라운드에서 진행 중입니다.</div>
          <div style={{ fontSize: '.85rem', marginTop: 8 }}>일봉 540일치를 보는 조건이라 몇 분 걸릴 수 있어요. 잠시 후 새로고침 해주세요.</div>
        </div>
      ) : filteredList.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>체크한 조건을 모두 만족하는 종목이 없습니다.</div>
          <div style={{ fontSize: '.85rem', marginTop: 8 }}>위 체크박스에서 조건을 하나씩 해제해보면 어느 조건에서 걸러지는지 확인할 수 있어요.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 16, marginBottom: 24 }}>
          {filteredList.map((s, idx) => {
            const isUp = s.changePct >= 0;
            return (
              <div key={s.code} className="card"
                onClick={() => onSelectStock && onSelectStock({ ...s, current_price: s.price, type: s.market })}
                style={{ padding: 20, background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 8px', background: idx < 3 ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.08)', color: idx < 3 ? '#fbbf24' : 'var(--t3)', fontWeight: 700, fontSize: '.75rem' }}>#{idx + 1}</span>
                      <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>{s.name}</span>
                      <span style={{ fontSize: '.78rem', color: 'var(--t3)', fontFamily: 'Space Mono' }}>{s.code}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={chip}>{s.market}</span>
                      <span style={chip}>시총 {formatEok(s.marketCap)}</span>
                      {s.flags?.A && <span style={chip}>고점 대비 -{s.dropPct}%</span>}
                    </div>
                  </div>
                  <span style={{ padding: '4px 10px', fontSize: '.78rem', fontWeight: 800, background: s.passed === 4 ? 'rgba(244,114,182,0.15)' : 'rgba(255,255,255,0.06)', color: s.passed === 4 ? '#f472b6' : 'var(--t2)', border: s.passed === 4 ? '1px solid rgba(244,114,182,0.5)' : '1px solid rgba(255,255,255,0.15)', whiteSpace: 'nowrap' }}>
                    {s.passed}/4 충족
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                  {COND_META.map(c => (
                    <span key={c.key} style={{ padding: '2px 8px', fontSize: '.7rem', fontWeight: 800, background: s.flags?.[c.key] ? `${c.color}22` : 'rgba(255,255,255,0.03)', color: s.flags?.[c.key] ? c.color : 'var(--t3)', border: `1px solid ${s.flags?.[c.key] ? c.color + '66' : 'rgba(255,255,255,0.08)'}` }}>
                      {s.flags?.[c.key] ? '✓' : '✗'} {c.key} {c.label}
                    </span>
                  ))}
                </div>

                <div style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 10, fontSize: '.76rem', color: 'var(--t2)', lineHeight: 1.7 }}>
                  {s.flags?.A && <div><strong style={{ color: '#a78bfa' }}>역</strong> 224일선 {formatNumber(s.ma224)} &lt; 448일선 {formatNumber(s.ma448)} (112일선 아래 역배열)</div>}
                  {s.flags?.B && <div><strong style={{ color: '#f59e0b' }}>매</strong> 매집봉 {s.spike.date} (거래량 {s.spike.ratio}배) · 강한 양봉 {s.strong.date} (+{s.strong.pct}%) · 최근 20일 거래량 직전 대비 {s.volRatio}배</div>}
                  {s.flags?.C && <div><strong style={{ color: '#38bdf8' }}>공</strong> 바닥 구간 변동폭이 직전 대비 {Math.round(s.shrinkRatio * 100)}% 수준으로 축소, 저점 이탈 없음</div>}
                  {s.flags?.D && <div><strong style={{ color: '#34d399' }}>파</strong> 112일선({formatNumber(s.ma112)}) 위 +{s.gap112}% · 직전 20일 고점까지 {s.highGap}%</div>}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <span style={{ fontSize: '.74rem', color: 'var(--t3)' }}>현재가: </span>
                    <strong style={{ color: '#fff', fontSize: '1rem', fontFamily: 'Space Mono' }}>{formatNumber(s.price)}원</strong>
                    <span style={{ color: isUp ? 'var(--up)' : 'var(--dn)', fontSize: '.8rem', fontWeight: 800, marginLeft: 6 }}>({isUp ? '+' : ''}{s.changePct}%)</span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onSelectStock && onSelectStock({ ...s, current_price: s.price, type: s.market }); }}
                    style={{ padding: '6px 12px', background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.4)', color: 'var(--accent)', fontSize: '.76rem', fontWeight: 700, cursor: 'pointer' }}>
                    차트 상세보기 ➔
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── 조건 기준 가이드 ─── */}
      <div style={{ padding: '22px 26px', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', marginBottom: 12 }}>"역매공파" 판정 기준</div>
        <div style={{ fontSize: '.86rem', color: 'var(--t2)', lineHeight: 1.7 }}>
          원문 검색식에 "일정 수준 이상" 같은 모호한 표현이 많아서, 아래 수치는 이 앱에서 임의로 정한 기준입니다.<br />
          • <strong>A 장기 하락:</strong> 448일선 &gt; 224일선 &gt; 112일선, 최근 252거래일 고점 대비 30% 이상 하락<br />
          • <strong>B 매집/수급 (최근 20거래일):</strong> 20일 내 평균 대비 거래량 3배↑ 양봉(매집봉) + 몸통 5%↑ 강한 양봉 + 최근 20일 평균거래량이 직전 60일 평균의 1.5배↑<br />
          • <strong>C 공구리:</strong> 10~30거래일 전 구간의 일평균 변동폭이 그 이전 30일의 80% 이하 + 이후 저점 이탈 없음 + 거래량은 그 구간에서 줄었다가 최근 10일에 다시 증가<br />
          • <strong>D 추세 전환:</strong> 종가가 112일선 위 ~ +10% 이내, 5일선 &gt; 20일선 &amp; 20일선 상승, 종가가 직전 20일 고점의 3% 이내<br />
          • 원문의 E(손익비 2:1 이상) 조건은 제외했습니다.<br />
          • 스캔 대상: 코스피+코스닥 시총 300억 이상 (ETF/ETN·관리종목·거래정지 제외). A는 일봉 448일 이상 상장된 종목만 판정할 수 있어요.<br />
          • ⚠️ 검색식 후보일 뿐 매수 추천이 아닙니다. 투자 판단과 책임은 본인에게 있습니다.
        </div>
      </div>
    </div>
  );
}
