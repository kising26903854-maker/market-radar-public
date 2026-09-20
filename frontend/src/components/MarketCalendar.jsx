// MarketCalendar.jsx — 📅 글로벌 증시 일정 달력 & 상세 결과 분석 팝업 모달
import React, { useState, useEffect, useCallback, useMemo } from 'react';

const CATEGORY_COLORS = {
  FOMC: '#ef4444',
  EARNINGS: '#10b981',
  ECONOMIC: '#3b82f6',
  POLICY: '#a855f7',
  OPTIONS: '#eab308',
  HOLIDAY: '#6b7280',
};

const CATEGORY_LABELS = {
  ALL: '전체',
  EARNINGS: '실적발표',
  FOMC: 'FOMC',
  ECONOMIC: '경제지표',
  POLICY: '정책/금통위',
  OPTIONS: '옵션만기',
  HOLIDAY: '휴장일',
};

const COUNTRY_FLAGS = {
  ALL: '🌐',
  KR: '🇰🇷',
  US: '🇺🇸',
};

const DAYS_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토'];

// ─── 📊 이벤트 상세 결과 리포트 팝업 모달 컴포넌트 ───
function EventDetailModal({ event, onClose }) {
  if (!event) return null;

  const res = event.result || {};
  const isConcluded = event.isConcluded;

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
          background: 'var(--bg2)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 0,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
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
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '2rem' }}>{event.emoji}</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: '0.74rem', background: CATEGORY_COLORS[event.category] || '#6366f1', color: '#fff', padding: '2px 8px', borderRadius: 0, fontWeight: 700 }}>
                  {CATEGORY_LABELS[event.category] || event.category}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--t3)', fontWeight: 700 }}>
                  {COUNTRY_FLAGS[event.country]} {event.date}
                </span>
                {isConcluded ? (
                  <span style={{ fontSize: '0.7rem', background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid #10b981', padding: '1px 6px', borderRadius: 0, fontWeight: 700 }}>
                    결과 집계 완료
                  </span>
                ) : (
                  <span style={{ fontSize: '0.7rem', background: 'rgba(234,179,8,0.2)', color: '#fbbf24', border: '1px solid #eab308', padding: '1px 6px', borderRadius: 0, fontWeight: 700 }}>
                    발표 예정
                  </span>
                )}
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                {event.title}
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
          {/* 어닝 서프라이즈 / 결과 판정 배너 */}
          {res.surpriseLabel && (
            <div style={{
              padding: '16px 20px',
              borderRadius: 0,
              background: res.surprise === 'BEAT'
                ? 'rgba(16,185,129,0.12)'
                : res.surprise === 'MISS'
                ? 'rgba(239,68,68,0.12)'
                : 'rgba(99,102,241,0.12)',
              border: `1px solid ${res.surprise === 'BEAT' ? '#10b981' : res.surprise === 'MISS' ? '#ef4444' : '#818cf8'}`,
              marginBottom: 18,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8
            }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase' }}>공식 판정 결과</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginTop: 2 }}>
                  {res.surpriseLabel}
                </div>
              </div>
              {res.growth && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--t3)', fontWeight: 700 }}>전년 대비 성장률</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981', fontFamily: 'Space Mono' }}>
                    {res.growth}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 실적 비교 표 (EPS & 매출액) */}
          {(res.epsActual || res.revenueActual || res.actualValue) && (
            <div style={{
              background: 'rgba(0,0,0,0.35)',
              borderRadius: 0,
              border: '1px solid rgba(255,255,255,0.06)',
              overflow: 'hidden',
              marginBottom: 18
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '.88rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ padding: '12px 16px', color: 'var(--t3)', fontWeight: 700 }}>구분 항목</th>
                    <th style={{ padding: '12px 16px', color: 'var(--t2)', fontWeight: 700, textAlign: 'right' }}>실제 발표치 (Actual)</th>
                    <th style={{ padding: '12px 16px', color: 'var(--t3)', fontWeight: 700, textAlign: 'right' }}>시장 예상치 (Consensus)</th>
                  </tr>
                </thead>
                <tbody>
                  {res.epsActual && (
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#fff' }}>주당순이익 (EPS)</td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#fff', textAlign: 'right', fontFamily: 'Space Mono', fontSize: '1rem' }}>
                        {res.epsActual}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--t2)', textAlign: 'right', fontFamily: 'Space Mono' }}>
                        {res.epsConsensus || '-'}
                      </td>
                    </tr>
                  )}
                  {res.revenueActual && (
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#fff' }}>매출액 (Revenue)</td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#fff', textAlign: 'right', fontFamily: 'Space Mono', fontSize: '1rem' }}>
                        {res.revenueActual}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--t2)', textAlign: 'right', fontFamily: 'Space Mono' }}>
                        {res.revenueConsensus || '-'}
                      </td>
                    </tr>
                  )}
                  {res.actualValue && (
                    <tr>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: '#fff' }}>지표 결과치</td>
                      <td style={{ padding: '12px 16px', fontWeight: 800, color: '#fff', textAlign: 'right', fontFamily: 'Space Mono', fontSize: '1rem' }}>
                        {res.actualValue}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--t2)', textAlign: 'right', fontFamily: 'Space Mono' }}>
                        {res.forecastValue || '-'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* 차기 가이던스 & 주요 코멘트 */}
          {res.guidance && (
            <div style={{
              padding: '14px 18px',
              background: 'var(--bg2)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 0,
              marginBottom: 14
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--t2)', fontWeight: 700, marginBottom: 4 }}>
                가이던스 및 경영진 핵심 코멘트
              </div>
              <div style={{ fontSize: '0.88rem', color: 'var(--t2)', lineHeight: 1.5 }}>
                {res.guidance}
              </div>
            </div>
          )}

          {/* 주가 및 시장 영향 반응 */}
          {(res.marketReaction || res.marketImpact) && (
            <div style={{
              padding: '14px 18px',
              background: 'var(--bg2)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 0,
              marginBottom: 14
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--t2)', fontWeight: 700, marginBottom: 4 }}>
                발표 직후 주가 및 시장 반응
              </div>
              <div style={{ fontSize: '0.88rem', color: 'var(--t2)', lineHeight: 1.5 }}>
                {res.marketReaction || res.marketImpact}
              </div>
            </div>
          )}

          {/* 전문가 퀀트 총평 요약 */}
          {(res.summary || event.description) && (
            <div style={{
              padding: '16px 18px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 0
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--t3)', fontWeight: 700, marginBottom: 4 }}>
                퀀트 종합 총평 & 일정 분석
              </div>
              <div style={{ fontSize: '0.88rem', color: 'var(--t1)', lineHeight: 1.6 }}>
                {res.summary || event.description}
              </div>
            </div>
          )}
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
          <span>글로벌 공시 및 금융당국 공식 캘린더 연동</span>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 0,
              color: '#fff',
              fontWeight: 700,
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

export default function MarketCalendar() {
  const today = new Date();
  
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [countryFilter, setCountryFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedEventModal, setSelectedEventModal] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const fetchEvents = useCallback(async (y, m) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/market-calendar?year=${y}&month=${m}`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Failed to fetch calendar events', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(year, month);
  }, [year, month, fetchEvents]);

  const changeMonth = (delta) => {
    setCurrentDate(new Date(year, currentDate.getMonth() + delta, 1));
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    );
  };

  const getDaysInMonth = (y, m) => new Date(y, m, 0).getDate();
  const getFirstDayOfMonth = (y, m) => new Date(y, m - 1, 1).getDay();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const prevMonthDays = getDaysInMonth(year, month - 1);
  const daysInPrevMonthToShow = firstDay;
  const daysInNextMonthToShow = 42 - (daysInMonth + firstDay);

  const calendarDays = useMemo(() => {
    const days = [];
    // Previous month trailing days
    for (let i = daysInPrevMonthToShow - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = month === 1 ? 12 : month - 1;
      const y = month === 1 ? year - 1 : year;
      days.push({
        day: d,
        month: m,
        year: y,
        isCurrentMonth: false,
        dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      });
    }
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        month: month,
        year: year,
        isCurrentMonth: true,
        dateStr: `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      });
    }
    // Next month leading days
    for (let i = 1; i <= daysInNextMonthToShow; i++) {
      const m = month === 12 ? 1 : month + 1;
      const y = month === 12 ? year + 1 : year;
      days.push({
        day: i,
        month: m,
        year: y,
        isCurrentMonth: false,
        dateStr: `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`
      });
    }
    return days;
  }, [year, month, daysInMonth, firstDay, prevMonthDays, daysInPrevMonthToShow, daysInNextMonthToShow]);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const countryMatch = countryFilter === 'ALL' || e.country === countryFilter || e.country === 'GLOBAL';
      const categoryMatch = categoryFilter === 'ALL' || e.category === categoryFilter;
      return countryMatch && categoryMatch;
    });
  }, [events, countryFilter, categoryFilter]);

  const getEventsForDate = useCallback((dateStr) => {
    return filteredEvents.filter(e => e.date === dateStr);
  }, [filteredEvents]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return getEventsForDate(selectedDate);
  }, [selectedDate, getEventsForDate]);

  const isToday = (y, m, d) => {
    return y === today.getFullYear() && m === today.getMonth() + 1 && d === today.getDate();
  };

  return (
    <div style={{ padding: '10px 0', animation: 'fadeIn 0.3s ease-in-out' }}>
      {/* ─── 상단 메인 헤더 ─── */}
      <div style={{
        padding: '22px 26px',
        background: 'var(--bg2)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 0,
        marginBottom: 20,
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        <div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>글로벌 증시 핵심 일정 & 실적 캘린더</span>
          </div>
          <div style={{ fontSize: '.9rem', color: 'var(--t2)', marginTop: 6 }}>
            미국 M7 빅테크 & 한국 대표 대형주 실적발표 · FOMC 금리결정 · CPI 물가지수 · <strong>종료 이벤트 결과 리포트 팝업</strong>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => changeMonth(-1)}
            style={{
              padding: '8px 14px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 0,
              color: 'var(--t2)',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            ◀ 이전달
          </button>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--gold)', minWidth: 130, textAlign: 'center', fontFamily: 'Space Mono' }}>
            {year}년 {month}월
          </div>
          <button
            onClick={() => changeMonth(1)}
            style={{
              padding: '8px 14px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 0,
              color: 'var(--t2)',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            다음달 ▶
          </button>
          <button
            onClick={goToToday}
            style={{
              padding: '8px 14px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 0,
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            오늘
          </button>
          <button
            onClick={() => fetchEvents(year, month)}
            disabled={loading}
            title="오늘 발표된 실적 결과 및 최신 어닝 서프라이즈 데이터를 실시간으로 동기화합니다."
            style={{
              padding: '8px 14px',
              background: '#3b82f6',
              border: 'none',
              borderRadius: 0,
              color: '#fff',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span>{loading ? '동기화 중...' : '실적 실시간 동기화'}</span>
          </button>
        </div>
      </div>

      {/* ─── 필터 칩 ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {/* 국가 필터 */}
        <div style={{ display: 'flex', gap: 8 }}>
          {Object.entries(COUNTRY_FLAGS).map(([key, emoji]) => (
            <button
              key={key}
              onClick={() => setCountryFilter(key)}
              style={{
                padding: '7px 14px',
                borderRadius: 0,
                border: 'none',
                background: countryFilter === key ? 'var(--accent)' : 'rgba(0,0,0,0.3)',
                color: countryFilter === key ? '#fff' : 'var(--t3)',
                fontSize: '.85rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {emoji} {key === 'ALL' ? '전체' : key === 'KR' ? '한국' : '미국'}
            </button>
          ))}
        </div>

        {/* 카테고리 필터 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setCategoryFilter(key)}
              style={{
                padding: '7px 12px',
                borderRadius: 0,
                border: categoryFilter === key ? `1px solid ${CATEGORY_COLORS[key] || '#818cf8'}` : '1px solid rgba(255,255,255,0.08)',
                background: categoryFilter === key ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.3)',
                color: categoryFilter === key ? '#fff' : 'var(--t3)',
                fontSize: '.8rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── 달력 그리드 ─── */}
      <div style={{
        background: 'var(--bg2)',
        borderRadius: 0,
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        marginBottom: 20
      }}>
        {/* 요일 헤더 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {DAYS_OF_WEEK.map((day, idx) => (
            <div
              key={day}
              style={{
                padding: '12px 0',
                textAlign: 'center',
                fontWeight: 800,
                fontSize: '.85rem',
                color: idx === 0 ? '#ef4444' : idx === 6 ? '#3b82f6' : 'var(--t3)'
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 날짜 셀 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {calendarDays.map((d, i) => {
            const idx = i % 7;
            const todayFlag = isToday(d.year, d.month, d.day);
            const isSelected = selectedDate === d.dateStr;
            const dayEvents = getEventsForDate(d.dateStr);

            return (
              <div
                key={`${d.dateStr}-${i}`}
                onClick={() => setSelectedDate(d.dateStr)}
                style={{
                  minHeight: 105,
                  padding: '8px 10px',
                  background: isSelected
                    ? 'rgba(129,140,248,0.15)'
                    : todayFlag
                    ? 'rgba(129,140,248,0.1)'
                    : d.isCurrentMonth
                    ? 'transparent'
                    : 'rgba(0,0,0,0.25)',
                  borderRight: idx !== 6 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  opacity: d.isCurrentMonth ? 1 : 0.45
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = todayFlag ? 'rgba(129,140,248,0.1)' : (d.isCurrentMonth ? 'transparent' : 'rgba(0,0,0,0.25)'); }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 4
                }}>
                  <span style={{
                    fontSize: '.85rem',
                    fontWeight: todayFlag ? 800 : 700,
                    color: todayFlag ? '#fff' : idx === 0 ? '#ef4444' : idx === 6 ? '#3b82f6' : 'var(--t1)',
                    background: todayFlag ? 'var(--accent)' : 'transparent',
                    padding: todayFlag ? '2px 6px' : 0,
                    borderRadius: 0
                  }}>
                    {d.day}
                  </span>
                  {dayEvents.length > 0 && (
                    <span style={{ fontSize: '.7rem', color: 'var(--t3)', fontWeight: 700 }}>
                      {dayEvents.length}개
                    </span>
                  )}
                </div>

                {/* 이벤트 목록 축약 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {dayEvents.slice(0, 3).map((evt, eIdx) => (
                    <div
                      key={eIdx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEventModal(evt);
                      }}
                      style={{
                        padding: '2px 6px',
                        borderRadius: 0,
                        background: `${CATEGORY_COLORS[evt.category] || '#6366f1'}22`,
                        borderLeft: `3px solid ${CATEGORY_COLORS[evt.category] || '#6366f1'}`,
                        fontSize: '.68rem',
                        fontWeight: 700,
                        color: '#fff',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3
                      }}
                      title={`${evt.title} (클릭 시 상세 결과)`}
                    >
                      <span>{evt.emoji}</span>
                      <span>{evt.title}</span>
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div style={{ fontSize: '.65rem', color: 'var(--t3)', textAlign: 'right', fontWeight: 700 }}>
                      +{dayEvents.length - 3}개 더보기
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 선택된 날짜 상세 일정 패널 ─── */}
      <div style={{
        padding: '22px 26px',
        background: 'var(--bg2)',
        borderRadius: 0,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
      }}>
        {selectedDate ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{selectedDate.split('-')[0]}년 {selectedDate.split('-')[1]}월 {selectedDate.split('-')[2]}일 일정</span>
                <span style={{ fontSize: '.8rem', color: 'var(--t2)', fontWeight: 700 }}>({selectedDayEvents.length}개 일정)</span>
              </div>
              <div style={{ fontSize: '.8rem', color: 'var(--t3)' }}>
                일정 카드를 클릭하시면 <strong>상세 결과 리포트 팝업</strong>이 열립니다.
              </div>
            </div>

            {selectedDayEvents.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--t3)', fontSize: '.9rem' }}>
                선택하신 날짜에 예정된 중요 증시 일정이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
                {selectedDayEvents.map((evt, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedEventModal(evt)}
                    style={{
                      padding: '18px 20px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 0,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.borderColor = 'var(--accent)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '1.2rem' }}>{evt.emoji}</span>
                        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>{evt.title}</span>
                      </div>
                      <span style={{
                        fontSize: '.72rem',
                        background: CATEGORY_COLORS[evt.category] || '#6366f1',
                        color: '#fff',
                        padding: '2px 8px',
                        borderRadius: 0,
                        fontWeight: 700
                      }}>
                        {CATEGORY_LABELS[evt.category] || evt.category}
                      </span>
                    </div>

                    <div style={{ fontSize: '.84rem', color: 'var(--t2)', lineHeight: 1.5, marginBottom: 12 }}>
                      {evt.description}
                    </div>

                    {/* 결과 뱃지 & 액션 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 10 }}>
                      <span style={{ fontSize: '.75rem', color: 'var(--t3)' }}>
                        {COUNTRY_FLAGS[evt.country]} {evt.country === 'KR' ? '대한민국' : '미국/글로벌'}
                      </span>
                      <span style={{
                        fontSize: '.78rem',
                        fontWeight: 700,
                        color: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        <span>상세 결과 리포트 보기</span>
                        <span>➔</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--t3)', fontSize: '.95rem', fontWeight: 700 }}>
            달력에서 날짜를 클릭하시면 해당 일자의 주요 실적 및 경제지표 상세 일정을 확인하실 수 있습니다.
          </div>
        )}
      </div>

      {/* ─── 이벤트 상세 결과 모달 ─── */}
      {selectedEventModal && (
        <EventDetailModal
          event={selectedEventModal}
          onClose={() => setSelectedEventModal(null)}
        />
      )}
    </div>
  );
}
