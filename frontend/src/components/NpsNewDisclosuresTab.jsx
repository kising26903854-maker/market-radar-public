// NpsNewDisclosuresTab.jsx — 🌅 오늘 새벽 01:00 배치에서 감지된 국민연금 신규 대량보유 공시만 모아보는 아침 브리핑 메뉴
import React, { useState, useEffect } from 'react';

const fmtDateTime = (ts) => {
  if (!ts) return '-';
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function NpsNewDisclosuresTab({ onSelectStock }) {
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchUpdates = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const res = await fetch('/api/nps-today-new');
      const json = await res.json();
      if (json.success) setUpdates(json.updates || []);
    } catch (err) {
      console.error('오늘의 국민연금 신규 공시 로드 실패:', err);
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUpdates();
    const interval = setInterval(() => fetchUpdates(true), 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/trigger-nps-holding-batch', { method: 'POST' });
      showToast('🔄 국민연금 신규 공시 스캔이 백그라운드에서 시작되었습니다. 잠시 후 새로고침 해주세요.');
    } catch (e) {
      showToast('재스캔 요청 중 오류가 발생했습니다.');
    } finally {
      setTimeout(() => fetchUpdates(false), 5000);
    }
  };

  return (
    <div style={{ padding: '10px 0', animation: 'fadeIn 0.3s ease-in-out' }}>
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, padding: '14px 20px',
          background: 'rgba(15, 23, 42, 0.95)', border: '1.5px solid #34d399', borderRadius: 0,
          color: '#fff', fontWeight: 800, fontSize: '.9rem', zIndex: 5000,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)', animation: 'slideUp 0.3s ease-out'
        }}>
          {toastMessage}
        </div>
      )}

      {/* ─── 헤더 배너 ─── */}
      <div style={{
        padding: '22px 26px',
        background: 'var(--bg2)',
        borderTop: '2px solid #34d399',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0, marginBottom: 18,
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span>국민연금 신규 공시 (오늘)</span>
              <span style={{
                fontSize: '.72rem', color: 'var(--t2)', fontWeight: 700
              }}>
                오늘 새벽 01:00 배치 기준
              </span>
            </div>
            <div style={{ fontSize: '.86rem', color: 'var(--t3)', marginTop: 6, lineHeight: 1.6 }}>
              DART 대량보유상황보고서(majorstock.json) 원문 기준으로, 오늘 새벽 배치에서 처음 감지된 국민연금공단 지분 변동 공시만 보여줍니다.
              종목 팝업에서도 3일간 NEW 배지로 확인할 수 있지만, 이 화면은 "오늘 아침 새로 뜬 것"만 골라서 보여줍니다.
            </div>
          </div>

          <button onClick={handleRefresh} disabled={refreshing} style={{
            padding: '9px 14px', background: '#10b981', border: 'none',
            borderRadius: 0, color: '#0f172a', fontWeight: 700, cursor: refreshing ? 'not-allowed' : 'pointer',
            fontSize: '.82rem'
          }}>
            {refreshing ? '스캔 요청 중...' : '지금 다시 스캔'}
          </button>
        </div>
      </div>

      {/* ─── 목록 ─── */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--t2)' }}>오늘의 국민연금 신규 공시를 불러오는 중...</div>
        </div>
      ) : updates.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 0 }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--t2)' }}>오늘 새벽 배치에서 감지된 국민연금 신규 공시가 없습니다.</div>
          <div style={{ fontSize: '.85rem', marginTop: 8 }}>매일 새벽 01:00에 자동으로 다시 확인합니다.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 24 }}>
          {updates.map((u) => {
            const isUp = u.ratioChange === null || u.ratioChange >= 0;
            return (
              <div key={u.stockCode} className="card"
                onClick={() => onSelectStock && onSelectStock({ code: u.stockCode, name: u.corpName })}
                style={{
                  padding: 20, background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 0, cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>{u.corpName}</span>
                      <span style={{ fontSize: '.78rem', color: 'var(--t3)', fontFamily: 'Space Mono' }}>{u.stockCode}</span>
                    </div>
                    <div style={{ fontSize: '.72rem', color: 'var(--t3)', marginTop: 4 }}>감지: {fmtDateTime(u.seenAt)}</div>
                  </div>
                  <span style={{ padding: '3px 9px', borderRadius: 0, fontSize: '.68rem', fontWeight: 900, background: '#ef4444', color: '#fff', animation: 'pulse 1.6s ease-in-out infinite' }}>
                    NEW
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 14px', background: 'rgba(0,0,0,0.25)', borderRadius: 0 }}>
                  <span style={{ fontSize: '1.6rem', fontWeight: 900, fontFamily: 'Space Mono', color: '#34d399' }}>{u.ratio}%</span>
                  {u.ratioChange !== null && (
                    <span style={{ fontSize: '.9rem', fontWeight: 900, color: isUp ? '#34d399' : '#ef4444' }}>
                      {isUp ? '+' : ''}{u.ratioChange}%p
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '.78rem', color: 'var(--t2)', marginTop: 10 }}>
                  📅 공시일: {u.date} · {u.reason}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
