// AiPredictionTab.jsx — 🤖 AI 상승확률 예측 모델 (로지스틱 회귀)
import React, { useState, useEffect } from 'react';

const formatNumber = (num) => new Intl.NumberFormat('ko-KR').format(num || 0);

const formatMarketCap = (eok) => {
  if (!eok) return '-';
  if (eok >= 10000) {
    const jo = Math.floor(eok / 10000);
    const rem = Math.round(eok % 10000);
    return `${jo.toLocaleString()}조${rem > 0 ? ' ' + rem.toLocaleString() + '억' : ''}`;
  }
  return `${Math.round(eok).toLocaleString()}억`;
};

export default function AiPredictionTab({ onSelectStock }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [marketFilter, setMarketFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch('/api/ai-prediction');
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error('AI 예측 모델 로드 실패:', err);
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/trigger-ai-training', { method: 'POST' });
      showToast('🔄 AI 모델 재학습이 백그라운드에서 시작됩니다. 수 분 정도 소요될 수 있습니다.');
    } catch (e) {
      showToast('재학습 요청 중 오류가 발생했습니다.');
    } finally {
      setTimeout(() => fetchData(false), 3000);
    }
  };

  const isTraining = data?.training;
  const stocks = data?.stocks || [];
  const testEval = data?.evaluation?.test;
  const trainEval = data?.evaluation?.train;
  const lastSyncAt = data?.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString('ko-KR') : '-';

  const filteredStocks = stocks.filter(s => {
    if (marketFilter !== 'ALL' && s.market !== marketFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      if (!(s.name || '').toLowerCase().includes(q) && !(s.code || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const edgeOverBaseline = testEval ? (testEval.precision - testEval.baselinePositiveRatePct) : null;

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
              <span>AI 상승확률 예측 모델</span>
              <span style={{
                fontSize: '.75rem', background: 'rgba(192, 132, 252, 0.2)', color: '#d8b4fe',
                border: '1px solid rgba(192, 132, 252, 0.5)', padding: '4px 12px', borderRadius: 0, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: 6
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: isTraining ? '#fbbf24' : '#c084fc', boxShadow: `0 0 10px ${isTraining ? '#fbbf24' : '#c084fc'}`, display: 'inline-block' }} />
                {isTraining ? '모델 학습 중...' : `유니버스 ${(data?.universeSize || 0).toLocaleString()}종목 스코어링 완료`}
              </span>
            </div>
            <div style={{ fontSize: '.92rem', color: 'var(--t2)', marginTop: 8, lineHeight: 1.6 }}>
              모멘텀·RSI·이평선 괴리·거래량·변동성 9개 기술적 피처로 <strong>실제 과거 데이터에서 경사하강법으로 학습한 로지스틱 회귀 모델</strong>입니다. "2주 후 +3% 이상 상승" 확률을 종목별로 계산해 순위를 매깁니다.
            </div>
            <div style={{ fontSize: '.76rem', color: 'var(--t3)', marginTop: 6 }}>
              마지막 학습: {lastSyncAt} {data?.elapsedSec ? `(${data.elapsedSec}초 소요)` : ''}
            </div>
          </div>

          <button onClick={handleRefresh} disabled={refreshing} style={{
            padding: '9px 14px', background: '#3b82f6', border: 'none',
            borderRadius: 0, color: '#fff', fontWeight: 700, cursor: refreshing ? 'not-allowed' : 'pointer',
            fontSize: '.82rem', display: 'flex', alignItems: 'center', gap: 6
          }}>
            <span>{refreshing ? '⋯' : '↻'}</span>
            <span>{refreshing ? '요청 중...' : '모델 재학습'}</span>
          </button>
        </div>

        {/* ─── 검증 성능 배너 — 반드시 "검증(test)" 수치를 앞세운다, train 수치는 항상 부풀려짐 ─── */}
        {testEval && (
          <div style={{
            marginTop: 18, padding: '16px 20px', background: 'rgba(0,0,0,0.4)', borderRadius: 0,
            border: '1px solid rgba(234,179,8,0.35)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: '1.1rem' }}>⚠️</span>
              <span style={{ fontWeight: 700, color: 'var(--gold)', fontSize: '.92rem' }}>실전 신뢰도 (검증 구간 — 모델이 학습에 쓰지 않은 &apos;미래&apos; 데이터로 평가)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <div>
                <div style={{ fontSize: '.72rem', color: 'var(--t3)' }}>정확도 (Accuracy)</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', fontFamily: 'Space Mono' }}>{testEval.accuracy}%</div>
              </div>
              <div>
                <div style={{ fontSize: '.72rem', color: 'var(--t3)' }}>정밀도 (예측 적중률)</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fff', fontFamily: 'Space Mono' }}>{testEval.precision}%</div>
              </div>
              <div>
                <div style={{ fontSize: '.72rem', color: 'var(--t3)' }}>무작위 기준선</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--t2)', fontFamily: 'Space Mono' }}>{testEval.baselinePositiveRatePct}%</div>
              </div>
              <div>
                <div style={{ fontSize: '.72rem', color: 'var(--t3)' }}>기준선 대비 우위</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: edgeOverBaseline >= 5 ? '#34d399' : edgeOverBaseline >= 0 ? '#fbbf24' : '#f87171', fontFamily: 'Space Mono' }}>
                  {edgeOverBaseline >= 0 ? '+' : ''}{edgeOverBaseline?.toFixed(1)}%p
                </div>
              </div>
            </div>
            <div style={{ fontSize: '.78rem', color: 'var(--t2)', marginTop: 10, lineHeight: 1.5 }}>
              <strong style={{ color: '#fff' }}>정밀도({testEval.precision}%)가 무작위 기준선({testEval.baselinePositiveRatePct}%)보다 크게 높지 않다면, 이 모델은 &apos;동전 던지기&apos;보다 아주 조금 나은 수준입니다.</strong> 훈련 세트 정확도({trainEval?.accuracy}%)가 더 높게 나오는 건 정상이지만(과최적화 경향), 실전에서 중요한 건 이 검증 수치입니다.
            </div>
          </div>
        )}
      </div>

      {/* ─── 2. 필터 & 검색 바 ─── */}
      {!isTraining && stocks.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.25)', padding: 3, borderRadius: 0, flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: `전체 (${stocks.length})` },
              { id: '코스피', label: `코스피 (${stocks.filter(s => s.market === '코스피').length})` },
              { id: '코스닥', label: `코스닥 (${stocks.filter(s => s.market === '코스닥').length})` },
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', padding: '8px 14px', borderRadius: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="종목명, 코드 검색..."
              style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '.85rem', width: '140px' }} />
            {searchQuery && <button onClick={() => setSearchQuery('')} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer' }}>✕</button>}
          </div>
        </div>
      )}

      {/* ─── 3. 종목 리스트 ─── */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>AI 예측 데이터를 불러오는 중...</div>
        </div>
      ) : isTraining || stocks.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', borderRadius: 0 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🤖</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>AI 모델이 백그라운드에서 학습 중입니다.</div>
          <div style={{ fontSize: '.85rem', marginTop: 8 }}>약 500종목의 2년치 데이터로 학습하는 작업이라 수십 초~수 분 소요됩니다. 잠시 후 새로고침 해주세요.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          {filteredStocks.map((stock, idx) => {
            const isUp = stock.changePct >= 0;
            const marketColor = stock.market === '코스피' ? '#3b82f6' : '#a78bfa';
            const probColor = stock.upProbabilityPct >= 60 ? '#34d399' : stock.upProbabilityPct >= 50 ? '#fbbf24' : '#94a3b8';
            return (
              <div key={stock.code} className="card"
                onClick={() => onSelectStock && onSelectStock({ ...stock, current_price: stock.price, type: stock.market })}
                style={{
                  padding: 18, background: 'var(--bg2)', border: `1px solid ${probColor}50`,
                  borderRadius: 0, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ padding: '2px 8px', background: idx < 3 ? 'rgba(234,179,8,0.25)' : 'rgba(255,255,255,0.08)', color: idx < 3 ? '#fbbf24' : 'var(--t3)', borderRadius: 0, fontWeight: 700, fontSize: '.75rem' }}>#{idx + 1}</span>
                      <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>{stock.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                      <span style={{ fontSize: '.7rem', color: 'var(--t3)', fontFamily: 'Space Mono' }}>{stock.code}</span>
                      <span style={{ padding: '1px 6px', borderRadius: 0, fontSize: '.68rem', fontWeight: 700, background: `${marketColor}20`, color: marketColor }}>{stock.market}</span>
                      <span style={{ fontSize: '.68rem', color: '#fbbf24' }}>시총 {formatMarketCap(stock.marketCap)}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '.68rem', color: 'var(--t3)' }}>AI 상승확률</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: probColor, fontFamily: 'Space Mono' }}>{stock.upProbabilityPct}%</div>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <strong style={{ color: '#fff', fontFamily: 'Space Mono' }}>{formatNumber(stock.price)}원</strong>
                    <span style={{ color: isUp ? 'var(--up)' : 'var(--dn)', fontSize: '.78rem', fontWeight: 800, marginLeft: 6 }}>({isUp ? '+' : ''}{stock.changePct}%)</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── 4. 모델 설명 ─── */}
      <div style={{ marginTop: 18, padding: '22px 26px', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0 }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--t1)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>모델 설명</span>
        </div>
        <div style={{ fontSize: '.86rem', color: 'var(--t2)', lineHeight: 1.7 }}>
          • <strong>피처(입력값) 9개:</strong> 5/10/20일 모멘텀, 거래량 배율, RSI(14), 20/60일 이평선 괴리율, 20일 신고가 대비 거리, 20일 변동성.<br />
          • <strong>라벨(정답):</strong> {data?.modelInfo?.labelDefinition || '10거래일(약 2주) 후 +3% 이상 상승 여부'}.<br />
          • <strong>학습 방식:</strong> 로지스틱 회귀를 경사하강법으로 직접 학습(외부 API·사전학습 모델 아님). 시간순으로 앞 80%는 훈련, 뒤 20%는 검증에만 사용해 미래 데이터 누수를 차단했습니다.<br />
          • <strong>한계:</strong> 가격·거래량만으로 학습했기 때문에 뉴스·실적·수급 등 차트 밖 정보는 전혀 반영하지 못합니다. 위 검증 정밀도가 기준선과 큰 차이가 없다면, 실전에서 이 순위를 그대로 따라 매매하는 것은 권장하지 않습니다.
        </div>
      </div>
    </div>
  );
}
