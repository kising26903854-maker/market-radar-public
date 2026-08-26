// NpsPdfReportModal.jsx — 🏛️ 국민연금(NPS) 포트폴리오 전문 PDF 보고서 생성 및 인쇄/다운로드 모달
import React from 'react';

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

export default function NpsPdfReportModal({ data, selectedQuarter, onClose }) {
  if (!data) return null;

  const holdings = data.holdings || [];
  const summary = data.summary || {};
  const comparison = data.comparison || { newStocks: [], increased: [], decreased: [], soldStocks: [] };
  const disclosures = data.items || [];
  const quarterText = (selectedQuarter || data.quarter || '').replace('_', '년 ') + '분기';
  const printDate = new Date().toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // 🖨️ 브라우저 네이티브 고해상도 PDF 인쇄/저장
  const handlePrint = () => {
    const printContent = document.getElementById('nps-pdf-report-content');
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>국민연금(NPS)_국내주식_포트폴리오_분석리포트_${selectedQuarter}</title>
          <meta charset="utf-8" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=Space+Mono:wght@700&display=swap');
            @page {
              size: A4 portrait;
              margin: 12mm 12mm 15mm 12mm;
            }
            body {
              font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: #111827;
              background: #fff;
              margin: 0;
              padding: 0;
              font-size: 11pt;
              line-height: 1.5;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header-box {
              border-bottom: 2.5px solid #059669;
              padding-bottom: 14px;
              margin-bottom: 18px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .title {
              font-size: 20pt;
              font-weight: 900;
              color: #065f46;
              letter-spacing: -0.5px;
              margin: 0 0 6px 0;
            }
            .subtitle {
              font-size: 10pt;
              color: #4b5563;
              margin: 0;
            }
            .meta-box {
              text-align: right;
              font-size: 9pt;
              color: #6b7280;
              line-height: 1.4;
            }
            .section-title {
              font-size: 12.5pt;
              font-weight: 900;
              color: #065f46;
              border-left: 4px solid #059669;
              padding-left: 8px;
              margin: 20px 0 10px 0;
              page-break-after: avoid;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-bottom: 18px;
            }
            .summary-card {
              border: 1px solid #d1d5db;
              border-radius: 8px;
              padding: 10px 12px;
              background: #f9fafb;
              text-align: center;
            }
            .summary-label {
              font-size: 8.5pt;
              color: #4b5563;
              font-weight: 700;
            }
            .summary-val {
              font-size: 13pt;
              font-weight: 900;
              color: #059669;
              margin-top: 3px;
              font-family: 'Space Mono', monospace;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 18px;
              font-size: 9pt;
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            th {
              background: #f0fdf4;
              color: #065f46;
              border-top: 1.5px solid #059669;
              border-bottom: 1.5px solid #059669;
              padding: 6px 8px;
              font-weight: 800;
              text-align: left;
            }
            td {
              border-bottom: 1px solid #e5e7eb;
              padding: 6px 8px;
              color: #1f2937;
            }
            .num-cell {
              text-align: right;
              font-family: 'Space Mono', monospace;
              font-weight: 700;
            }
            .badge-new { background: #dcfce7; color: #166534; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 7.5pt; }
            .badge-inc { background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 7.5pt; }
            .badge-dec { background: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 7.5pt; }
            .badge-sold { background: #f3f4f6; color: #4b5563; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 7.5pt; }
            .footer-note {
              margin-top: 24px;
              border-top: 1px solid #e5e7eb;
              padding-top: 10px;
              font-size: 8pt;
              color: #9ca3af;
              text-align: center;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // 📑 CSV 원본 엑셀 데이터 즉시 다운로드
  const handleExportCsv = () => {
    const headers = ['순위', '종목명', '종목코드', '보유주수(주)', '평가금액(억원)', '지분율(%)', '변동상태'];
    const rows = holdings.map((h, i) => [
      i + 1,
      `"${h.stockName}"`,
      `"${h.stockCode}"`,
      h.shares || 0,
      h.value || 0,
      h.ratio || 0,
      `"${h.status === 'NEW' ? '신규편입' : h.status === 'INCREASE' ? '비중확대' : h.status === 'DECREASE' ? '비중축소' : '유지'}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `국민연금_포트폴리오_${selectedQuarter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        zIndex: 3500,
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
          maxWidth: '920px',
          maxHeight: '92vh',
          background: '#1e293b',
          border: '2px solid rgba(16, 185, 129, 0.5)',
          borderRadius: 22,
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 상단 툴바 */}
        <div style={{
          padding: '16px 24px',
          background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.25) 0%, rgba(59, 130, 246, 0.2) 100%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.6rem' }}>📑</span>
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#fff' }}>
                국민연금(NPS) 포트폴리오 PDF 리포트 출력 및 다운로드
              </div>
              <div style={{ fontSize: '.78rem', color: 'var(--t2)' }}>
                {quarterText} 기준 DART 5% 대량보유 포트폴리오 전수 분석 보고서
              </div>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handlePrint}
              style={{
                padding: '9px 18px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                fontWeight: 900,
                fontSize: '.88rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(16,185,129,0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>🖨️</span>
              <span>PDF로 저장 / 인쇄하기</span>
            </button>

            <button
              onClick={handleExportCsv}
              style={{
                padding: '9px 14px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10,
                color: 'var(--t1)',
                fontWeight: 800,
                fontSize: '.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>📊</span>
              <span>CSV 엑셀</span>
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--t3)',
                fontSize: '1.4rem',
                cursor: 'pointer',
                marginLeft: 6
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* 보고서 본문 미리보기 (A4 용지 뷰) */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          background: 'rgba(15, 23, 42, 0.6)'
        }}>
          <div
            id="nps-pdf-report-content"
            style={{
              background: '#fff',
              color: '#111827',
              padding: '36px 40px',
              borderRadius: 8,
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
              margin: '0 auto',
              maxWidth: '800px',
              fontSize: '10pt',
              lineHeight: 1.5,
              fontFamily: "'Noto Sans KR', sans-serif"
            }}
          >
            {/* 1. 리포트 메인 헤더 */}
            <div className="header-box" style={{ borderBottom: '2.5px solid #059669', paddingBottom: 14, marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <h1 className="title" style={{ fontSize: '19pt', fontWeight: 900, color: '#065f46', margin: '0 0 6px 0', letterSpacing: '-0.5px' }}>
                  🏛️ 국민연금(NPS) 국내주식 5% 이상 보유 포트폴리오 리포트
                </h1>
                <p className="subtitle" style={{ fontSize: '9.5pt', color: '#4b5563', margin: 0 }}>
                  금융감독원 전자공시시스템(DART) 대량보유상황보고서 기반 분석
                </p>
              </div>
              <div className="meta-box" style={{ textAlign: 'right', fontSize: '8.5pt', color: '#6b7280', lineHeight: 1.4 }}>
                <div><strong>기준 분기:</strong> {quarterText}</div>
                <div><strong>출력 일시:</strong> {printDate}</div>
                <div><strong>조사 기관:</strong> 국민연금 기금운용본부 / DART</div>
              </div>
            </div>

            {/* 2. 총괄 요약 지표 */}
            <div className="section-title" style={{ fontSize: '11.5pt', fontWeight: 900, color: '#065f46', borderLeft: '4px solid #059669', paddingLeft: 8, margin: '14px 0 8px 0' }}>
              1. 포트폴리오 총괄 개요
            </div>
            <div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              <div className="summary-card" style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', background: '#f9fafb', textAlign: 'center' }}>
                <div className="summary-label" style={{ fontSize: '8pt', color: '#4b5563', fontWeight: 700 }}>총 보유 종목 수</div>
                <div className="summary-val" style={{ fontSize: '13pt', fontWeight: 900, color: '#059669', marginTop: 2 }}>{holdings.length}개 종목</div>
              </div>
              <div className="summary-card" style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', background: '#f9fafb', textAlign: 'center' }}>
                <div className="summary-label" style={{ fontSize: '8pt', color: '#4b5563', fontWeight: 700 }}>총 보유 평가금액</div>
                <div className="summary-val" style={{ fontSize: '12pt', fontWeight: 900, color: '#059669', marginTop: 2 }}>{formatJoEok(summary.totalValueEok)}</div>
              </div>
              <div className="summary-card" style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', background: '#f9fafb', textAlign: 'center' }}>
                <div className="summary-label" style={{ fontSize: '8pt', color: '#4b5563', fontWeight: 700 }}>평균 보유 지분율</div>
                <div className="summary-val" style={{ fontSize: '13pt', fontWeight: 900, color: '#059669', marginTop: 2 }}>{formatPct(summary.avgRatio)}</div>
              </div>
              <div className="summary-card" style={{ border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', background: '#f9fafb', textAlign: 'center' }}>
                <div className="summary-label" style={{ fontSize: '8pt', color: '#4b5563', fontWeight: 700 }}>신규 편입 / 매도</div>
                <div className="summary-val" style={{ fontSize: '11pt', fontWeight: 900, color: '#1f2937', marginTop: 2 }}>
                  <span style={{ color: '#059669' }}>+{comparison.newStocks?.length || 0}</span> / <span style={{ color: '#dc2626' }}>-{comparison.soldStocks?.length || 0}</span>
                </div>
              </div>
            </div>

            {/* 3. 분기별 핵심 변동 종목 하이라이트 */}
            <div className="section-title" style={{ fontSize: '11.5pt', fontWeight: 900, color: '#065f46', borderLeft: '4px solid #059669', paddingLeft: 8, margin: '14px 0 8px 0' }}>
              2. 주요 변동 종목 (신규 편입 &amp; 비중 변동 TOP)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: '8.5pt' }}>
              <thead>
                <tr style={{ background: '#f0fdf4', borderTop: '1.5px solid #059669', borderBottom: '1.5px solid #059669' }}>
                  <th style={{ padding: '5px 6px' }}>구분</th>
                  <th style={{ padding: '5px 6px' }}>종목명</th>
                  <th style={{ padding: '5px 6px' }}>종목코드</th>
                  <th style={{ padding: '5px 6px', textAlign: 'right' }}>보유 지분율</th>
                  <th style={{ padding: '5px 6px', textAlign: 'right' }}>전분기 대비 변동</th>
                  <th style={{ padding: '5px 6px', textAlign: 'right' }}>보유 주수</th>
                </tr>
              </thead>
              <tbody>
                {/* 신규 편입 */}
                {(comparison.newStocks || []).slice(0, 5).map((s, idx) => (
                  <tr key={`new-${idx}`} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '5px 6px' }}><span className="badge-new" style={{ background: '#dcfce7', color: '#166534', padding: '2px 5px', borderRadius: 4, fontWeight: 800, fontSize: '7.5pt' }}>🆕 신규편입</span></td>
                    <td style={{ padding: '5px 6px', fontWeight: 700 }}>{s.stockName}</td>
                    <td style={{ padding: '5px 6px', color: '#6b7280' }}>{s.stockCode}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 800 }}>{formatPct(s.ratio)}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: '#16a34a', fontWeight: 800 }}>신규 (+{formatPct(s.ratio)})</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'Space Mono' }}>{formatNumber(s.shares)}주</td>
                  </tr>
                ))}
                {/* 비중 확대 */}
                {(comparison.increased || []).slice(0, 5).map((s, idx) => (
                  <tr key={`inc-${idx}`} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '5px 6px' }}><span className="badge-inc" style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 5px', borderRadius: 4, fontWeight: 800, fontSize: '7.5pt' }}>📈 비중확대</span></td>
                    <td style={{ padding: '5px 6px', fontWeight: 700 }}>{s.stockName}</td>
                    <td style={{ padding: '5px 6px', color: '#6b7280' }}>{s.stockCode}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 800 }}>{formatPct(s.ratio)}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: '#dc2626', fontWeight: 800 }}>+{formatPct(s.diffRatio)}p</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'Space Mono' }}>{formatNumber(s.shares)}주</td>
                  </tr>
                ))}
                {/* 비중 축소 */}
                {(comparison.decreased || []).slice(0, 4).map((s, idx) => (
                  <tr key={`dec-${idx}`} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '5px 6px' }}><span className="badge-dec" style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 5px', borderRadius: 4, fontWeight: 800, fontSize: '7.5pt' }}>📉 비중축소</span></td>
                    <td style={{ padding: '5px 6px', fontWeight: 700 }}>{s.stockName}</td>
                    <td style={{ padding: '5px 6px', color: '#6b7280' }}>{s.stockCode}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 800 }}>{formatPct(s.ratio)}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', color: '#2563eb', fontWeight: 800 }}>{formatPct(s.diffRatio)}p</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'Space Mono' }}>{formatNumber(s.shares)}주</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 4. 전체 보유 포트폴리오 명세표 (상위 50 종목) */}
            <div className="section-title" style={{ fontSize: '11.5pt', fontWeight: 900, color: '#065f46', borderLeft: '4px solid #059669', paddingLeft: 8, margin: '18px 0 8px 0' }}>
              3. 보유 종목 상세 명세표 (평가금액 상위 순)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: '8.5pt' }}>
              <thead>
                <tr style={{ background: '#f0fdf4', borderTop: '1.5px solid #059669', borderBottom: '1.5px solid #059669' }}>
                  <th style={{ padding: '5px 6px', width: 35 }}>순위</th>
                  <th style={{ padding: '5px 6px' }}>종목명</th>
                  <th style={{ padding: '5px 6px' }}>코드</th>
                  <th style={{ padding: '5px 6px', textAlign: 'right' }}>보유 지분율</th>
                  <th style={{ padding: '5px 6px', textAlign: 'right' }}>보유 주수</th>
                  <th style={{ padding: '5px 6px', textAlign: 'right' }}>평가금액</th>
                  <th style={{ padding: '5px 6px', textAlign: 'center' }}>변동 구분</th>
                </tr>
              </thead>
              <tbody>
                {holdings.slice(0, 45).map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '5px 6px', color: '#6b7280', fontWeight: 700 }}>{idx + 1}</td>
                    <td style={{ padding: '5px 6px', fontWeight: 700 }}>{item.stockName}</td>
                    <td style={{ padding: '5px 6px', color: '#6b7280' }}>{item.stockCode}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 800 }}>{formatPct(item.ratio)}</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontFamily: 'Space Mono' }}>{formatNumber(item.shares)}주</td>
                    <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 800, color: '#065f46', fontFamily: 'Space Mono' }}>
                      {formatJoEok(item.value)}
                    </td>
                    <td style={{ padding: '5px 6px', textAlign: 'center' }}>
                      {item.status === 'NEW' && <span className="badge-new" style={{ background: '#dcfce7', color: '#166534', padding: '1px 4px', borderRadius: 4, fontWeight: 800, fontSize: '7pt' }}>신규</span>}
                      {item.status === 'INCREASE' && <span className="badge-inc" style={{ background: '#fee2e2', color: '#991b1b', padding: '1px 4px', borderRadius: 4, fontWeight: 800, fontSize: '7pt' }}>확대</span>}
                      {item.status === 'DECREASE' && <span className="badge-dec" style={{ background: '#dbeafe', color: '#1e40af', padding: '1px 4px', borderRadius: 4, fontWeight: 800, fontSize: '7pt' }}>축소</span>}
                      {(!item.status || item.status === 'HOLD' || item.status === 'SAME') && <span style={{ color: '#9ca3af', fontSize: '7.5pt' }}>유지</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 5. 하단 출처 및 면책 공지 */}
            <div className="footer-note" style={{ marginTop: 20, borderTop: '1px solid #e5e7eb', paddingTop: 10, fontSize: '8pt', color: '#9ca3af', textAlign: 'center' }}>
              본 보고서는 금융감독원 전자공시시스템(DART)의 5% 대량보유 공시 데이터를 기반으로 산출된 참고용 리포트입니다. 투자 판단의 최종 책임은 투자자 본인에게 있습니다.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
