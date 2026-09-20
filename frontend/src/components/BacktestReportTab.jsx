// BacktestReportTab.jsx — 📊 패턴 스캐너 과거 성과 백테스트 리포트
import React, { useState, useEffect } from 'react';

const HORIZON_ORDER = ['1주', '2주', '3주', '4주', '1개월', '2개월', '3개월'];

export default function BacktestReportTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchReport = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch('/api/backtest-report');
      const json = await res.json();
      if (json.success) setData(json);
    } catch (err) {
      console.error('백테스트 리포트 로드 실패:', err);
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReport();
    const interval = setInterval(() => fetchReport(true), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/trigger-backtest', { method: 'POST' });
      showToast('🔄 백테스트가 백그라운드에서 재실행됩니다. 수 분 정도 소요될 수 있습니다.');
    } catch (e) {
      showToast('재실행 요청 중 오류가 발생했습니다.');
    } finally {
      setTimeout(() => fetchReport(false), 3000);
    }
  };

  const scanners = data?.scanners || [];
  const isRunning = data?.running;
  const lastSyncAt = data?.lastSyncAt ? new Date(data.lastSyncAt).toLocaleString('ko-KR') : '-';

  const winRateColor = (wr) => {
    if (wr == null) return 'var(--t3)';
    if (wr >= 60) return '#34d399';
    if (wr >= 50) return '#fbbf24';
    return '#f87171';
  };

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
              <span>패턴 스캐너 백테스트 리포트</span>
              <span style={{
                fontSize: '.75rem', background: 'rgba(129, 140, 248, 0.2)', color: '#a5b4fc',
                border: '1px solid rgba(129, 140, 248, 0.5)', padding: '4px 12px', borderRadius: 0, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: 6
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: isRunning ? '#fbbf24' : '#818cf8', boxShadow: `0 0 10px ${isRunning ? '#fbbf24' : '#818cf8'}`, display: 'inline-block' }} />
                {isRunning ? '백테스트 진행 중...' : `유니버스 ${(data?.universeSize || 0).toLocaleString()}종목 검증 완료`}
              </span>
            </div>
            <div style={{ fontSize: '.92rem', color: 'var(--t2)', marginTop: 8, lineHeight: 1.6 }}>
              쌍바닥·상승초입·에너지응축·골든크로스·월봉10이평선 5개 패턴 스캐너가 <strong>과거에 실제로 신호를 냈을 때</strong> 이후 1~4주(월봉 스캐너는 1~3개월) 수익률이 어땠는지 실제 시세로 검증한 결과입니다.
            </div>
            <div style={{ fontSize: '.76rem', color: 'var(--t3)', marginTop: 6 }}>
              마지막 백테스트: {lastSyncAt} {data?.elapsedSec ? `(${data.elapsedSec}초 소요)` : ''}
            </div>
          </div>

          <button onClick={handleRefresh} disabled={refreshing} style={{
            padding: '9px 14px', background: '#3b82f6', border: 'none',
            borderRadius: 0, color: '#fff', fontWeight: 700, cursor: refreshing ? 'not-allowed' : 'pointer',
            fontSize: '.82rem', display: 'flex', alignItems: 'center', gap: 6
          }}>
            <span>{refreshing ? '⋯' : '↻'}</span>
            <span>{refreshing ? '요청 중...' : '백테스트 재실행'}</span>
          </button>
        </div>

        {/* ─── 방법론 & 주의사항 배너 ─── */}
        <div style={{
          marginTop: 18, padding: '14px 18px', background: 'rgba(0,0,0,0.35)', borderRadius: 0,
          border: '1px solid rgba(234,179,8,0.3)', display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <div style={{ fontSize: '.82rem', color: 'var(--t1)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--gold)' }}>이 리포트는 투자 조언이 아닙니다.</strong> 과거 데이터로 계산한 참고 지표이며, 같은 패턴이라도 미래엔 다른 결과가 나올 수 있습니다.
            {data?.methodology && (
              <div style={{ marginTop: 6, color: 'var(--t3)' }}>
                대상: {data.methodology.universe} · 일봉 스캐너: {data.methodology.dailyHistory} · 월봉 스캐너: {data.methodology.monthlyHistory}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── 2. 스캐너별 백테스트 결과 카드 ─── */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>⏳</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>백테스트 리포트를 불러오는 중...</div>
        </div>
      ) : isRunning || scanners.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', borderRadius: 0 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📡</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#fff' }}>전종목 백테스트가 백그라운드에서 진행 중입니다.</div>
          <div style={{ fontSize: '.85rem', marginTop: 8 }}>약 500종목 × 5개 패턴 × 최대 2년 히스토리를 검사하는 작업이라 수 분 정도 걸립니다. 잠시 후 새로고침 해주세요.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {scanners.map(scanner => {
            const horizonKeys = Object.keys(scanner.horizons || {}).sort((a, b) => HORIZON_ORDER.indexOf(a) - HORIZON_ORDER.indexOf(b));
            return (
              <div key={scanner.id} style={{
                padding: '18px 20px', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>{scanner.name}</span>
                    <span style={{ padding: '2px 10px', borderRadius: 0, fontSize: '.72rem', fontWeight: 700, background: 'rgba(255,255,255,0.08)', color: 'var(--t2)' }}>
                      {scanner.timeframe}
                    </span>
                  </div>
                  <span style={{ fontSize: '.82rem', color: 'var(--t2)', fontWeight: 800 }}>
                    총 신호 <strong style={{ color: '#818cf8' }}>{scanner.totalSignals.toLocaleString()}</strong>건
                  </span>
                </div>

                {scanner.totalSignals === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--t3)', fontSize: '.85rem' }}>
                    검증 기간 동안 이 패턴이 발생한 사례가 없습니다.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: '.74rem', color: 'var(--t3)', fontWeight: 800 }}>구간</th>
                          {horizonKeys.map(h => (
                            <th key={h} style={{ textAlign: 'center', padding: '8px 12px', fontSize: '.74rem', color: 'var(--t3)', fontWeight: 800 }}>{h} 후</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ padding: '8px 12px', fontSize: '.78rem', color: 'var(--t2)', fontWeight: 800 }}>승률</td>
                          {horizonKeys.map(h => {
                            const s = scanner.horizons[h];
                            return (
                              <td key={h} style={{ textAlign: 'center', padding: '8px 12px' }}>
                                {s ? <strong style={{ color: winRateColor(s.winRate), fontFamily: 'Space Mono', fontSize: '1.05rem' }}>{s.winRate}%</strong> : <span style={{ color: 'var(--t3)' }}>-</span>}
                              </td>
                            );
                          })}
                        </tr>
                        <tr>
                          <td style={{ padding: '8px 12px', fontSize: '.78rem', color: 'var(--t2)', fontWeight: 800 }}>평균 수익률</td>
                          {horizonKeys.map(h => {
                            const s = scanner.horizons[h];
                            return (
                              <td key={h} style={{ textAlign: 'center', padding: '8px 12px' }}>
                                {s ? <strong style={{ color: s.avgReturnPct >= 0 ? 'var(--up)' : 'var(--dn)', fontFamily: 'Space Mono' }}>{s.avgReturnPct >= 0 ? '+' : ''}{s.avgReturnPct}%</strong> : <span style={{ color: 'var(--t3)' }}>-</span>}
                              </td>
                            );
                          })}
                        </tr>
                        <tr>
                          <td style={{ padding: '8px 12px', fontSize: '.78rem', color: 'var(--t2)', fontWeight: 800 }}>중앙값</td>
                          {horizonKeys.map(h => {
                            const s = scanner.horizons[h];
                            return (
                              <td key={h} style={{ textAlign: 'center', padding: '8px 12px', fontSize: '.82rem' }}>
                                {s ? <span style={{ color: s.medianReturnPct >= 0 ? 'var(--up)' : 'var(--dn)', fontFamily: 'Space Mono' }}>{s.medianReturnPct >= 0 ? '+' : ''}{s.medianReturnPct}%</span> : <span style={{ color: 'var(--t3)' }}>-</span>}
                              </td>
                            );
                          })}
                        </tr>
                        <tr>
                          <td style={{ padding: '8px 12px', fontSize: '.78rem', color: 'var(--t2)', fontWeight: 800 }}>신호 수</td>
                          {horizonKeys.map(h => {
                            const s = scanner.horizons[h];
                            return (
                              <td key={h} style={{ textAlign: 'center', padding: '8px 12px', fontSize: '.76rem', color: 'var(--t3)' }}>
                                {s ? s.signalCount : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── 3. 방법론 상세 안내 ─── */}
      <div style={{ marginTop: 18, padding: '22px 26px', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0 }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--t1)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>백테스트 방법론</span>
        </div>
        <div style={{ fontSize: '.86rem', color: 'var(--t2)', lineHeight: 1.7 }}>
          • <strong>슬라이딩 윈도우 검증:</strong> 각 종목의 과거 시계열을 며칠 간격으로 훑으면서, 그 시점까지의 데이터만으로 패턴이 발생했는지 판정합니다(미래 데이터를 미리 들여다보지 않음 — look-ahead bias 방지).<br />
          • <strong>신호 후 관찰:</strong> 패턴이 뜬 시점의 종가를 진입가로 삼고, 이후 1~4주(월봉 스캐너는 1~3개월) 뒤 종가와 비교해 수익률을 계산합니다.<br />
          • <strong>중복신호 방지:</strong> 한 번 신호가 뜨면 관찰기간이 끝날 때까지 같은 종목을 재검사하지 않습니다(연속된 유사 신호가 통계를 부풀리는 것을 방지).<br />
          • <strong>한계:</strong> 매매비용(수수료·슬리피지)은 반영하지 않았고, 검증 기간의 시장 상황(상승장/하락장)에 따라 결과가 크게 달라질 수 있습니다.
        </div>
      </div>
    </div>
  );
}
