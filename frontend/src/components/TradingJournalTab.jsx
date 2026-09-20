// TradingJournalTab.jsx — 📔 나의 실시간 투자일지 (Trading Journal DB)
import React, { useState, useEffect, useMemo } from 'react';

const formatNumber = (num) => new Intl.NumberFormat('ko-KR').format(num || 0);

export default function TradingJournalTab({ positions = [] }) {
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'BUY' | 'SELL' | 'HOLD' | 'MEMO'
  const [stockFilter, setStockFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingJournal, setEditingJournal] = useState(null);

  // 일지 작성/수정 폼 상태
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    stockCode: positions[0]?.code || '0182R0',
    stockName: positions[0]?.name || '1Q K반도체TOP2+',
    type: 'BUY',
    price: positions[0]?.price || 0,
    quantity: 10,
    title: '',
    content: '',
    emotion: '🔥 확신',
    tags: '월가5대지표, 세력매집'
  });

  const fetchJournals = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/journals');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setJournals(json.data);
      }
    } catch (err) {
      console.error('투자일지 로드 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournals();
  }, []);

  // 종목 선택 시 자동 종목명/코드 매핑
  const handleStockSelect = (code) => {
    const pos = positions.find(p => p.code === code);
    if (pos) {
      setFormData(prev => ({
        ...prev,
        stockCode: pos.code,
        stockName: pos.name,
        price: pos.price || pos.purchasePrice || prev.price
      }));
    } else {
      setFormData(prev => ({ ...prev, stockCode: code }));
    }
  };

  // 신규 작성 모달 열기
  const handleOpenCreateModal = () => {
    setEditingJournal(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      stockCode: positions[0]?.code || '0182R0',
      stockName: positions[0]?.name || '1Q K반도체TOP2+',
      type: 'BUY',
      price: positions[0]?.price || positions[0]?.purchasePrice || 15000,
      quantity: 10,
      title: '',
      content: '',
      emotion: '🔥 확신',
      tags: '월가5대지표, 세력매집'
    });
    setShowModal(true);
  };

  // 수정 모달 열기
  const handleOpenEditModal = (journal) => {
    setEditingJournal(journal);
    setFormData({
      date: journal.date || new Date().toISOString().split('T')[0],
      stockCode: journal.stockCode || '',
      stockName: journal.stockName || '',
      type: journal.type || 'BUY',
      price: journal.price || 0,
      quantity: journal.quantity || 0,
      title: journal.title || '',
      content: journal.content || '',
      emotion: journal.emotion || '🔥 확신',
      tags: Array.isArray(journal.tags) ? journal.tags.join(', ') : (journal.tags || '')
    });
    setShowModal(true);
  };

  // 저장 (신규 또는 수정)
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('일지 제목을 입력해주세요.');
      return;
    }

    const payload = {
      ...formData,
      price: Number(formData.price) || 0,
      quantity: Number(formData.quantity) || 0,
      tags: typeof formData.tags === 'string'
        ? formData.tags.split(',').map(t => t.trim()).filter(Boolean)
        : formData.tags
    };

    try {
      if (editingJournal) {
        // 수정
        const res = await fetch(`/api/journals/${editingJournal.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
          setShowModal(false);
          fetchJournals();
        }
      } else {
        // 신규
        const res = await fetch('/api/journals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
          setShowModal(false);
          fetchJournals();
        }
      }
    } catch (err) {
      console.error('일지 저장 실패:', err);
      alert('일지 저장에 실패했습니다.');
    }
  };

  // 삭제
  const handleDelete = async (id) => {
    if (!window.confirm('정말 이 투자일지를 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/journals/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setJournals(prev => prev.filter(j => j.id !== id));
      }
    } catch (err) {
      console.error('일지 삭제 실패:', err);
    }
  };

  // 필터링 및 검색 연산
  const filteredJournals = useMemo(() => {
    return journals.filter(item => {
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
      if (stockFilter !== 'ALL' && item.stockCode !== stockFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchContent = (item.content || '').toLowerCase().includes(q);
        const matchStock = (item.stockName || '').toLowerCase().includes(q);
        const matchCode = (item.stockCode || '').toLowerCase().includes(q);
        const matchTags = Array.isArray(item.tags) && item.tags.some(t => t.toLowerCase().includes(q));
        if (!matchTitle && !matchContent && !matchStock && !matchCode && !matchTags) return false;
      }
      return true;
    });
  }, [journals, typeFilter, stockFilter, searchQuery]);

  // 통계 계산
  const stats = useMemo(() => {
    const res = { ALL: journals.length, BUY: 0, SELL: 0, HOLD: 0, MEMO: 0, totalInvested: 0 };
    journals.forEach(j => {
      if (res[j.type] !== undefined) res[j.type]++;
      if (j.type === 'BUY') res.totalInvested += (j.totalAmount || (j.price * j.quantity) || 0);
    });
    return res;
  }, [journals]);

  return (
    <div style={{ padding: '10px 0', animation: 'fadeIn 0.3s ease-in-out' }}>
      {/* ─── 상단 메인 헤더 ─── */}
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
              <span>나의 실시간 투자 매매일지</span>
              <span style={{ fontSize: '.72rem', background: 'var(--gold)', color: '#000', padding: '3px 10px', borderRadius: 0, fontWeight: 700 }}>
                로컬 영구 DB 연동
              </span>
            </div>
            <div style={{ fontSize: '.9rem', color: 'var(--t2)', marginTop: 6, lineHeight: 1.5 }}>
              매매 복기, 세력 평단가 분석 메모, 매수/매도 이유 및 심리 상태를 영구 기록하고 추적합니다.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleOpenCreateModal}
              style={{
                padding: '10px 20px',
                background: 'var(--gold)',
                border: 'none',
                borderRadius: 0,
                color: '#000',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>새 투자일지 작성하기</span>
            </button>

            <button
              onClick={fetchJournals}
              style={{
                padding: '10px 16px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 0,
                color: 'var(--t2)',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '.88rem'
              }}
            >
              새로고침
            </button>
          </div>
        </div>
      </div>

      {/* ─── 4대 매매 유형 요약 카드 ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { id: 'ALL', label: '전체 일지', count: stats.ALL, color: '#818cf8', desc: '총 누적 투자 기록' },
          { id: 'BUY', label: '매수(BUY) 기록', count: stats.BUY, color: '#ef4444', desc: '분할 매수 및 진입 일지' },
          { id: 'SELL', label: '매도(SELL) 기록', count: stats.SELL, color: '#3b82f6', desc: '익절 및 손절 매도 일지' },
          { id: 'HOLD', label: '관망/전략 메모', count: stats.HOLD + stats.MEMO, color: '#eab308', desc: '홀딩 전술 및 퀀트 복기' },
        ].map(card => {
          const isSelected = typeFilter === card.id;
          return (
            <div
              key={card.id}
              onClick={() => setTypeFilter(card.id)}
              style={{
                padding: '16px 18px',
                borderRadius: 0,
                background: isSelected ? `${card.color}12` : 'var(--bg2)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderTop: `2px solid ${card.color}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '.84rem', fontWeight: 700, color: card.color }}>{card.label}</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff', fontFamily: 'Space Mono' }}>{card.count}건</span>
              </div>
              <div style={{ fontSize: '.74rem', color: 'var(--t2)', marginTop: 4 }}>{card.desc}</div>
              <div style={{ fontSize: '.72rem', color: card.color, fontWeight: 700, marginTop: 8 }}>
                {isSelected ? '필터링 적용 중' : '클릭 시 필터 ➔'}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── 실시간 검색창 ─── */}
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
          placeholder="일지 제목, 본문 복기 내용, 종목명(아모레퍼시픽, 반도체), 태그(#세력매집) 실시간 검색..."
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
              {filteredJournals.length}개 매칭
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

      {/* ─── 종목별 빠른 필터 칩 ─── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <button
          onClick={() => setStockFilter('ALL')}
          style={{
            padding: '6px 14px',
            borderRadius: 0,
            border: 'none',
            background: stockFilter === 'ALL' ? 'var(--accent)' : 'rgba(0,0,0,0.25)',
            color: stockFilter === 'ALL' ? '#fff' : 'var(--t3)',
            fontWeight: 700,
            fontSize: '.8rem',
            cursor: 'pointer'
          }}
        >
          전체 종목
        </button>

        {positions.map(p => {
          const isSelected = stockFilter === p.code;
          return (
            <button
              key={p.code}
              onClick={() => setStockFilter(p.code)}
              style={{
                padding: '6px 14px',
                borderRadius: 0,
                border: 'none',
                background: isSelected ? 'var(--accent)' : 'rgba(0,0,0,0.25)',
                color: isSelected ? '#fff' : 'var(--t2)',
                fontWeight: 700,
                fontSize: '.8rem',
                cursor: 'pointer'
              }}
            >
              {p.name} ({p.code})
            </button>
          );
        })}
      </div>

      {/* ─── 일지 목록 카드 그리드 ─── */}
      {loading ? (
        <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--t2)', fontSize: '1.1rem', fontWeight: 700 }}>
          나의 투자일지 DB 불러오는 중...
        </div>
      ) : filteredJournals.length === 0 ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--t3)', background: 'var(--bg2)', borderRadius: 0, border: '1px dashed rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--t1)' }}>작성된 투자일지가 없거나 검색 조건과 일치하지 않습니다.</div>
          <div style={{ fontSize: '.82rem', color: 'var(--t3)', marginTop: 4 }}>새로운 매매 복기나 전략 일지를 작성해보세요!</div>
          <button
            onClick={handleOpenCreateModal}
            style={{ marginTop: 14, padding: '10px 20px', background: 'var(--gold)', color: '#000', border: 'none', borderRadius: 0, fontWeight: 700, cursor: 'pointer' }}
          >
            첫 투자일지 작성하기
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filteredJournals.map(j => {
            const isBuy = j.type === 'BUY';
            const isSell = j.type === 'SELL';
            const badgeColor = isBuy ? '#ef4444' : isSell ? '#3b82f6' : '#eab308';
            const badgeLabel = isBuy ? '🔴 매수(BUY)' : isSell ? '🔵 매도(SELL)' : j.type === 'HOLD' ? '🟡 관망(HOLD)' : '📝 전략메모';

            return (
              <div
                key={j.id}
                style={{
                  padding: '20px 24px',
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: 0,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  transition: 'border-color 0.15s ease'
                }}
              >
                {/* 상단 메타 바 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '4px 10px',
                      background: `${badgeColor}20`,
                      border: `1px solid ${badgeColor}60`,
                      borderRadius: 0,
                      color: badgeColor,
                      fontSize: '.78rem',
                      fontWeight: 700
                    }}>
                      {badgeLabel}
                    </span>

                    <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff' }}>
                      {j.stockName}
                    </span>
                    <span style={{ fontSize: '.8rem', color: 'var(--t3)', fontFamily: 'Space Mono' }}>
                      ({j.stockCode})
                    </span>

                    {j.emotion && (
                      <span style={{ fontSize: '.78rem', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 0, color: 'var(--t2)' }}>
                        심리: {j.emotion}
                      </span>
                    )}

                    <span style={{ fontSize: '.76rem', color: 'var(--t3)', marginLeft: 4 }}>
                      {j.date}
                    </span>
                  </div>

                  {/* 액션 버튼 */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handleOpenEditModal(j)}
                      style={{
                        padding: '5px 10px',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 0,
                        color: 'var(--t2)',
                        fontSize: '.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(j.id)}
                      style={{
                        padding: '5px 10px',
                        background: 'rgba(239,68,68,0.15)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 0,
                        color: '#f87171',
                        fontSize: '.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      삭제
                    </button>
                  </div>
                </div>

                {/* 매매 수치 바 */}
                {(j.price > 0 || j.quantity > 0) && (
                  <div style={{
                    padding: '8px 14px',
                    background: 'rgba(0,0,0,0.35)',
                    borderRadius: 0,
                    display: 'flex',
                    gap: 16,
                    flexWrap: 'wrap',
                    fontSize: '.82rem',
                    marginBottom: 12,
                    fontFamily: 'Space Mono'
                  }}>
                    <div><span style={{ color: 'var(--t3)' }}>단가:</span> <strong style={{ color: '#fff' }}>{formatNumber(j.price)}원</strong></div>
                    <div><span style={{ color: 'var(--t3)' }}>수량:</span> <strong style={{ color: '#fff' }}>{formatNumber(j.quantity)}주</strong></div>
                    <div><span style={{ color: 'var(--t3)' }}>총액:</span> <strong style={{ color: 'var(--gold)' }}>{formatNumber(j.totalAmount || (j.price * j.quantity))}원</strong></div>
                  </div>
                )}

                {/* 일지 제목 */}
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginBottom: 8, lineHeight: 1.4 }}>
                  {j.title}
                </div>

                {/* 일지 본문 */}
                <div style={{ fontSize: '.88rem', color: 'var(--t2)', lineHeight: 1.65, whiteSpace: 'pre-line', marginBottom: 12 }}>
                  {j.content}
                </div>

                {/* 태그 리스트 */}
                {Array.isArray(j.tags) && j.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {j.tags.map((t, idx) => (
                      <span key={idx} style={{ fontSize: '.72rem', background: 'rgba(129,140,248,0.12)', color: '#818cf8', padding: '2px 8px', borderRadius: 0, fontWeight: 700 }}>
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── ✍️ 일지 작성 및 수정 팝업 모달 ─── */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(8px)',
            zIndex: 4000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '650px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#1e293b',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 0,
              padding: '28px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
              animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{editingJournal ? '투자일지 수정하기' : '새 투자일지 작성하기'}</span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--t3)', fontSize: '1.4rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* 날짜 & 매매구분 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '.78rem', color: 'var(--t3)', fontWeight: 800, display: 'block', marginBottom: 4 }}>매매 일자</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: 0, color: '#fff', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '.78rem', color: 'var(--t3)', fontWeight: 800, display: 'block', marginBottom: 4 }}>매매 구분</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: 0, color: '#fff', outline: 'none' }}
                  >
                    <option value="BUY">🔴 매수 (BUY)</option>
                    <option value="SELL">🔵 매도 (SELL)</option>
                    <option value="HOLD">🟡 관망/홀딩 (HOLD)</option>
                    <option value="MEMO">📝 전략 메모 (MEMO)</option>
                  </select>
                </div>
              </div>

              {/* 대상 종목 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '.78rem', color: 'var(--t3)', fontWeight: 800, display: 'block', marginBottom: 4 }}>보유종목 빠른 선택</label>
                  <select
                    value={formData.stockCode}
                    onChange={e => handleStockSelect(e.target.value)}
                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: 0, color: '#fff', outline: 'none' }}
                  >
                    {positions.map(p => (
                      <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
                    ))}
                    <option value="OTHER">직접 입력</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '.78rem', color: 'var(--t3)', fontWeight: 800, display: 'block', marginBottom: 4 }}>종목명</label>
                  <input
                    type="text"
                    value={formData.stockName}
                    onChange={e => setFormData({ ...formData, stockName: e.target.value })}
                    placeholder="종목명"
                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: 0, color: '#fff', outline: 'none' }}
                  />
                </div>
              </div>

              {/* 매매 단가 & 수량 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '.78rem', color: 'var(--t3)', fontWeight: 800, display: 'block', marginBottom: 4 }}>체결 단가 (원)</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: 0, color: '#fff', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '.78rem', color: 'var(--t3)', fontWeight: 800, display: 'block', marginBottom: 4 }}>체결 수량 (주)</label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={e => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: 0, color: '#fff', outline: 'none' }}
                  />
                </div>
              </div>

              {/* 심리 상태 & 태그 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '.78rem', color: 'var(--t3)', fontWeight: 800, display: 'block', marginBottom: 4 }}>투자 심리 상태</label>
                  <select
                    value={formData.emotion}
                    onChange={e => setFormData({ ...formData, emotion: e.target.value })}
                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: 0, color: '#fff', outline: 'none' }}
                  >
                    <option value="🔥 확신">🔥 확신 (시그널 일치)</option>
                    <option value="🟢 침착">🟢 침착 (원칙 준수)</option>
                    <option value="⚡ 신중">⚡ 신중 (분할 진입)</option>
                    <option value="🧊 냉정">🧊 냉정 (기계적 손익절)</option>
                    <option value="⚠️ 경계">⚠️ 경계 (변동성 주의)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '.78rem', color: 'var(--t3)', fontWeight: 800, display: 'block', marginBottom: 4 }}>태그 (쉼표로 구분)</label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={e => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="예: 월가5대지표, 세력매집, 턴어라운드"
                    style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: 0, color: '#fff', outline: 'none' }}
                  />
                </div>
              </div>

              {/* 일지 제목 */}
              <div>
                <label style={{ fontSize: '.78rem', color: 'var(--t3)', fontWeight: 800, display: 'block', marginBottom: 4 }}>일지 제목</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="예: 1Q K반도체 세력 매집 바닥선 확인 후 1차 분할 매수 진입"
                  style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: 0, color: '#fff', outline: 'none', fontWeight: 700 }}
                />
              </div>

              {/* 일지 상세 복기 내용 */}
              <div>
                <label style={{ fontSize: '.78rem', color: 'var(--t3)', fontWeight: 800, display: 'block', marginBottom: 4 }}>상세 매매 근거 및 복기 노트</label>
                <textarea
                  rows={6}
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  placeholder="매수한 이유, 목표가, 손절선, 월가 5대 지표 및 수급 현황 등을 상세히 기록하세요..."
                  style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', borderRadius: 0, color: '#fff', outline: 'none', lineHeight: 1.6, resize: 'vertical' }}
                />
              </div>

              {/* 하단 버튼 */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '10px 18px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 0, color: '#fff', cursor: 'pointer', fontWeight: 700 }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 24px', background: 'var(--gold)', border: 'none', borderRadius: 0, color: '#000', fontWeight: 700, cursor: 'pointer' }}
                >
                  {editingJournal ? '일지 수정 저장' : '새 일지 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
