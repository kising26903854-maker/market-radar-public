// DividendCalendar.jsx — 💵 내 보유 종목 배당 캘린더 및 세후 배당금 시뮬레이터
import React, { useState, useEffect } from 'react';

export default function DividendCalendar({ onSelectStock }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    fetch('/api/dividend-calendar')
      .then(res => res.json())
      .then(json => {
        if (json.success) setData(json);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading && !data) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--t2)', fontWeight: 700, fontSize: '1.2rem' }}>
        내 보유 종목 배당금 일정 및 시뮬레이션 계산 중...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--dn)' }}>
        배당 데이터를 불러오지 못했습니다. <button onClick={loadData} style={{ padding: '6px 12px', marginLeft: 10, borderRadius: 0 }}>다시 시도</button>
      </div>
    );
  }

  const { summary = {}, portfolioList = [], monthlySchedule = [], highDividendPicks = [] } = data;

  return (
    <div style={{ padding: '10px 0', animation: 'fadeIn 0.4s ease' }}>
      {/* 🌟 상단 헤더 배너 */}
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
              <span>내 보유 종목 연간 배당 캘린더 & 세후 배당금 시뮬레이터</span>
              <span style={{ fontSize: '.74rem', background: 'var(--accent)', color: '#fff', padding: '3px 10px', borderRadius: 0, fontWeight: 700 }}>
                세후 15.4% 원천징수 실지급액 기준
              </span>
            </div>
            <div style={{ fontSize: '.9rem', color: 'var(--t2)', marginTop: 6, lineHeight: 1.5 }}>
              보유 주식의 분기/결산 배당금 입금 일정표와 <strong>연간 총 세후 예상 수령액</strong>을 실시간 계산합니다.
            </div>
          </div>

          <button
            onClick={loadData}
            style={{ padding: '10px 16px', background: 'var(--accent)', border: 'none', borderRadius: 0, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '.88rem' }}
          >
            새로고침
          </button>
        </div>
      </div>

      {/* ─── 4대 배당 요약 통계 카드 ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 24 }}>
        <div style={{ padding: '18px 20px', background: 'var(--bg2)', borderRadius: 0, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '.75rem', color: '#34d399', fontWeight: 700 }}>연간 총 예상 배당금 (세전)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: 4, fontFamily: 'Space Mono' }}>
            {(summary.totalAnnualGross || 0).toLocaleString()}원
          </div>
        </div>

        <div style={{ padding: '18px 20px', background: 'var(--bg2)', borderRadius: 0, borderTop: '2px solid #10b981', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '.75rem', color: 'var(--gold)', fontWeight: 700 }}>실제 통장 입금액 (세후)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', marginTop: 4, fontFamily: 'Space Mono' }}>
            {(summary.totalAnnualNet || 0).toLocaleString()}원
          </div>
        </div>

        <div style={{ padding: '18px 20px', background: 'var(--bg2)', borderRadius: 0, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '.75rem', color: '#60a5fa', fontWeight: 700 }}>월평균 현금흐름 (세후)</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#60a5fa', marginTop: 4, fontFamily: 'Space Mono' }}>
            {(summary.monthlyAverageNet || 0).toLocaleString()}원/월
          </div>
        </div>

        <div style={{ padding: '18px 20px', background: 'var(--bg2)', borderRadius: 0, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '.75rem', color: 'var(--t3)', fontWeight: 700 }}>배당소득세 (15.4%) 차감액</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--t2)', marginTop: 4, fontFamily: 'Space Mono' }}>
            -{(summary.taxDeducted || 0).toLocaleString()}원
          </div>
        </div>
      </div>

      {/* ─── 1월~12월 월별 배당금 캘린더 그리드 ─── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>2026년 월별 배당금 입금 캘린더</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {monthlySchedule.map(m => (
            <div
              key={m.month}
              style={{
                padding: '16px',
                borderRadius: 0,
                background: m.hasDividend ? 'var(--bg2)' : 'rgba(0,0,0,0.2)',
                border: m.hasDividend ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.05)',
                boxShadow: 'none'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '.9rem', fontWeight: 800, color: m.hasDividend ? '#34d399' : 'var(--t3)' }}>
                  {m.monthName}
                </span>
                {m.hasDividend && (
                  <span style={{ fontSize: '.68rem', background: 'rgba(16,185,129,0.2)', color: '#10b981', padding: '2px 6px', borderRadius: 0, fontWeight: 700 }}>
                    입금 예정
                  </span>
                )}
              </div>

              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: m.hasDividend ? '#fff' : 'var(--t3)', fontFamily: 'Space Mono', marginBottom: 6 }}>
                {m.totalPayoutNet > 0 ? `${m.totalPayoutNet.toLocaleString()}원` : '-'}
              </div>

              {m.items.length > 0 && (
                <div style={{ fontSize: '.72rem', color: 'var(--t2)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
                  {m.items.map((it, itIdx) => (
                    <div key={itIdx} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                      <span>{it.name}</span>
                      <span style={{ color: '#10b981', fontWeight: 700 }}>{it.payoutNet.toLocaleString()}원</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ─── 내 보유 종목별 배당 상세 테이블 ─── */}
      <div style={{ background: 'var(--bg2)', borderRadius: 0, border: '1px solid var(--border)', padding: '20px', marginBottom: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>내 계좌 보유 종목별 배당 현황</span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '.86rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--t3)', fontSize: '.76rem' }}>
              <th style={{ padding: '10px 12px' }}>종목명</th>
              <th style={{ padding: '10px 12px' }}>보유수량</th>
              <th style={{ padding: '10px 12px' }}>주당 배당금(DPS)</th>
              <th style={{ padding: '10px 12px' }}>배당수익률</th>
              <th style={{ padding: '10px 12px' }}>지급 주기</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>연간 세후 수령액</th>
            </tr>
          </thead>
          <tbody>
            {portfolioList.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '12px', fontWeight: 800, color: '#fff' }}>
                  {item.name} <span style={{ fontSize: '.75rem', color: 'var(--t3)' }}>({item.code})</span>
                </td>
                <td style={{ padding: '12px', color: 'var(--t1)' }}>{item.shares}주</td>
                <td style={{ padding: '12px', color: 'var(--gold)', fontWeight: 700 }}>{item.dps.toLocaleString()}원</td>
                <td style={{ padding: '12px', color: '#10b981', fontWeight: 700 }}>{item.divYield}%</td>
                <td style={{ padding: '12px', color: 'var(--t2)' }}>
                  {item.payMonths.map(m => `${m}월`).join(', ')}
                </td>
                <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: '#10b981', fontFamily: 'Space Mono' }}>
                  {item.annualNet.toLocaleString()}원
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── 국내 대표 고배당 가치주 추천 TOP 4 ─── */}
      <div>
        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--gold)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>포트폴리오 배당 수익률 강화 추천 (연 4.8%~5.8% 고배당 가치주)</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {highDividendPicks.map((pick, idx) => (
            <div
              key={idx}
              className="card stock-card"
              onClick={() => onSelectStock && onSelectStock(pick)}
              style={{
                background: 'var(--bg2)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 0,
                padding: '18px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>{pick.name}</span>
                <span style={{ fontSize: '.78rem', background: 'rgba(234,179,8,0.2)', color: 'var(--gold)', padding: '3px 8px', borderRadius: 0, fontWeight: 700 }}>
                  배당률 {pick.yield}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem', color: 'var(--t2)', marginBottom: 8 }}>
                <span>현재가: <strong>{pick.currentPrice.toLocaleString()}원</strong></span>
                <span>주당 배당금: <strong>{pick.dps.toLocaleString()}원</strong></span>
              </div>

              <div style={{ fontSize: '.78rem', color: 'var(--t3)', background: 'rgba(0,0,0,0.25)', padding: '8px 10px', borderRadius: 0 }}>
                {pick.reason}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
