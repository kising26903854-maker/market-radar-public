// TelegramSettingsModal.jsx — 📱 텔레그램 봇 연동 & 실시간 알림 설정 모달
import React, { useState, useEffect } from 'react';

export default function TelegramSettingsModal({ onClose, onSaved }) {
  const [config, setConfig] = useState({
    botToken: '8323711372:AAHOQzJ689B6jS_rB7OLfGCsbk_H6-yOMME',
    chatId: '',
    isEnabled: true,
    notifyOnTarget: true,
    notifyOnStopLoss: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success, message, error }

  useEffect(() => {
    fetch('/api/telegram/config')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.config) {
          setConfig(prev => ({
            ...prev,
            ...data.config,
            botToken: data.config.botToken || '8323711372:AAHOQzJ689B6jS_rB7OLfGCsbk_H6-yOMME'
          }));
        }
      })
      .catch(err => console.error('텔레그램 설정 로드 실패:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/telegram/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success) {
        if (onSaved) onSaved(data.config);
        onClose();
      } else {
        alert(data.error || '저장 실패');
      }
    } catch (err) {
      alert('설정 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // Chat ID 자동 감지
  const handleAutoDetect = async () => {
    setDetecting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/telegram/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: config.botToken.trim() })
      });
      const data = await res.json();
      if (data.success && data.chatId) {
        setConfig(prev => ({ ...prev, chatId: data.chatId }));
        setTestResult({
          success: true,
          message: `🎉 Chat ID (${data.chatId}, ${data.fromName}님)를 성공적으로 자동 감지했습니다!`
        });
      } else {
        setTestResult({
          success: false,
          error: data.error || 'Chat ID를 찾을 수 없습니다. 텔레그램에서 @kising0529Bot 채팅방에 들어간 뒤 /start를 눌러주세요!'
        });
      }
    } catch (err) {
      setTestResult({ success: false, error: '서버 연결 실패' });
    } finally {
      setDetecting(false);
    }
  };

  const handleTestSend = async () => {
    if (!config.botToken.trim() || !config.chatId.trim()) {
      alert('봇 토큰(Bot Token)과 챗 ID(Chat ID)를 먼저 입력해주세요.');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: config.botToken.trim(),
          chatId: config.chatId.trim()
        })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ success: false, error: '서버 연결 실패' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(10px)',
        zIndex: 4500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '600px',
          maxHeight: '92vh',
          overflowY: 'auto',
          background: '#1e293b',
          border: '2px solid rgba(59, 130, 246, 0.5)',
          borderRadius: 22,
          padding: '28px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.6rem' }}>📱</span>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>텔레그램 봇 실시간 알림 연동</div>
              <div style={{ fontSize: '.78rem', color: 'var(--t2)' }}>목표가 도달 &amp; 손절선 이탈 시 텔레그램으로 즉시 푸시 발송</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--t3)', fontSize: '1.4rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* 봇 상태 안내 카드 */}
        <div style={{
          padding: '14px 16px',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(16, 185, 129, 0.12) 100%)',
          borderRadius: 14,
          border: '1.5px solid rgba(59, 130, 246, 0.4)',
          marginBottom: 18,
          fontSize: '.84rem',
          lineHeight: 1.55
        }}>
          <div style={{ fontWeight: 900, color: '#60a5fa', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🤖</span>
            <span>연결된 텔레그램 봇: <strong style={{ color: '#fff' }}>shin_bot</strong> (<code>@kising0529Bot</code>)</span>
          </div>
          <div style={{ color: '#cbd5e1', fontSize: '.8rem' }}>
            텔레그램 앱에서 <strong>
              <a
                href="https://t.me/kising0529Bot"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#34d399', textDecoration: 'underline' }}
              >
                👉 @kising0529Bot 채팅방 바로가기
              </a>
            </strong>를 누르고 <strong>[시작]</strong> 또는 <strong>/start</strong>를 한 번 보내주신 후 아래 <strong>[🔍 내 Chat ID 자동 감지]</strong> 버튼을 누르시면 1초 만에 완성됩니다!
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 봇 토큰 입력 */}
          <div>
            <label style={{ fontSize: '.82rem', color: 'var(--t1)', fontWeight: 800, display: 'block', marginBottom: 6 }}>
              🔑 텔레그램 봇 토큰 (Bot Token) <span style={{ color: '#10b981' }}>[등록 완료 ✅]</span>
            </label>
            <input
              type="text"
              value={config.botToken}
              onChange={e => setConfig({ ...config, botToken: e.target.value })}
              placeholder="예: 8323711372:AAHOQzJ689B6jS_rB7OLfGCsbk_H6-yOMME"
              style={{
                width: '100%',
                padding: '11px 14px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: 10,
                color: '#fff',
                fontFamily: 'Space Mono, monospace',
                fontSize: '.82rem',
                outline: 'none'
              }}
            />
          </div>

          {/* 챗 ID 입력 + 자동 감지 버튼 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: '.82rem', color: 'var(--t1)', fontWeight: 800 }}>
                👤 내 텔레그램 Chat ID <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <button
                type="button"
                onClick={handleAutoDetect}
                disabled={detecting}
                style={{
                  padding: '4px 10px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: '.75rem',
                  fontWeight: 900,
                  cursor: detecting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(16,185,129,0.3)'
                }}
              >
                {detecting ? '⏳ 감지 중...' : '🔍 내 Chat ID 자동 감지'}
              </button>
            </div>
            <input
              type="text"
              value={config.chatId}
              onChange={e => setConfig({ ...config, chatId: e.target.value })}
              placeholder="예: 123456789 (또는 위 [자동 감지] 버튼 클릭)"
              style={{
                width: '100%',
                padding: '11px 14px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 10,
                color: '#fff',
                fontFamily: 'Space Mono, monospace',
                fontSize: '.85rem',
                outline: 'none'
              }}
            />
          </div>

          {/* 알림 옵션 체크박스 */}
          <div style={{
            padding: '12px 16px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            <div style={{ fontSize: '.8rem', color: 'var(--t3)', fontWeight: 800, marginBottom: 2 }}>알림 발송 조건 설정</div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.84rem', color: '#fff', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.isEnabled}
                onChange={e => setConfig({ ...config, isEnabled: e.target.checked })}
              />
              <span>🔔 텔레그램 실시간 알림 전체 활성화</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.84rem', color: '#34d399', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.notifyOnTarget}
                onChange={e => setConfig({ ...config, notifyOnTarget: e.target.checked })}
              />
              <span>🎯 목표가 도달 시 축하 및 분할익절 알림 발송</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.84rem', color: '#f87171', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.notifyOnStopLoss}
                onChange={e => setConfig({ ...config, notifyOnStopLoss: e.target.checked })}
              />
              <span>🛑 손절선 이탈 시 리스크 방어 경보 발송</span>
            </label>
          </div>

          {/* 테스트 발송 결과 피드백 */}
          {testResult && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 10,
              fontSize: '.82rem',
              fontWeight: 800,
              background: testResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${testResult.success ? '#10b981' : '#ef4444'}`,
              color: testResult.success ? '#34d399' : '#f87171',
              lineHeight: 1.45
            }}>
              {testResult.success ? testResult.message : '❌ ' + testResult.error}
            </div>
          )}

          {/* 하단 액션 버튼 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexWrap: 'wrap', gap: 10 }}>
            <button
              type="button"
              onClick={handleTestSend}
              disabled={testing}
              style={{
                padding: '10px 16px',
                background: testing ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.2)',
                border: '1px solid #3b82f6',
                borderRadius: 10,
                color: '#60a5fa',
                fontWeight: 900,
                fontSize: '.85rem',
                cursor: testing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>{testing ? '⏳' : '🚀'}</span>
              <span>{testing ? '발송 중...' : '텔레그램 테스트 메시지 발송'}</span>
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, color: '#fff', cursor: 'pointer', fontWeight: 800 }}
              >
                닫기
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '10px 22px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  border: 'none',
                  borderRadius: 10,
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: '.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(59,130,246,0.4)'
                }}
              >
                {saving ? '저장 중...' : '💾 설정 저장'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
