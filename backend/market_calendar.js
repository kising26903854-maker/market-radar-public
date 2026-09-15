/**
 * market_calendar.js — 📅 글로벌 증시 일정 달력 & 상세 결과 분석 데이터베이스
 * 미국 빅테크 실적, 한국 대형주 실적, FOMC, 금통위, 물가/고용지표, 만기일 전수 관리
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIVE_RESULTS_FILE = path.join(__dirname, 'data', 'market_calendar_live_results.json');

function loadLiveResults() {
  try {
    if (fs.existsSync(LIVE_RESULTS_FILE)) {
      return JSON.parse(fs.readFileSync(LIVE_RESULTS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('실시간 실적 결과 캐시 로드 실패:', e.message);
  }
  return {};
}

// 주어진 연도와 월의 첫 번째 금요일 (YYYY-MM-DD)
function getFirstFriday(year, month) {
  const date = new Date(year, month - 1, 1);
  while (date.getDay() !== 5) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().split('T')[0];
}

// 주어진 연도와 월의 두 번째 목요일 (한국 옵션만기일)
function getSecondThursday(year, month) {
  const date = new Date(year, month - 1, 1);
  let count = 0;
  while (count < 2) {
    if (date.getDay() === 4) {
      count++;
      if (count === 2) break;
    }
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().split('T')[0];
}

// 주어진 연도와 월의 세 번째 금요일 (미국 쿼드러플 위칭데이)
function getThirdFriday(year, month) {
  const date = new Date(year, month - 1, 1);
  let count = 0;
  while (count < 3) {
    if (date.getDay() === 5) {
      count++;
      if (count === 3) break;
    }
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().split('T')[0];
}

function formatDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const ALL_EVENTS = [];

// ─────────────────────────────────────────────────────────────
// 1. 2026년 정밀 개별 기업 실적 & 매크로 데이터베이스 (Detailed 2026 Dataset)
// ─────────────────────────────────────────────────────────────
// ⚠️ FOMC/BOK 금통위/CPI/고용보고서(NFP)/PCE 날짜는 연준(federalreserve.gov), 한국은행(bok.or.kr),
// 미 노동부(bls.gov), 미 상무부(bea.gov)가 사전 공표한 공식 일정을 웹 검색으로 직접 확인해 반영했다
// (2026-09-15 기준). 개별 기업 실적발표일은 최근 몇 분기간 관행적으로 반복되는 공시 패턴을 따른
// 예상 일정이며, 확정 공시일과 며칠 차이가 날 수 있다.
const DETAILED_2026_EVENTS = [
  // ── 1월 2026 ──
  {
    date: '2026-01-08',
    title: '삼성전자 4분기 잠정 실적발표',
    category: 'EARNINGS', country: 'KR', importance: 'HIGH', emoji: '📱', ticker: '005930',
    description: '삼성전자 2025년 4분기 잠정 매출 및 영업이익 공시'
  },
  {
    date: '2026-01-09',
    title: '미국 12월 고용보고서 (NFP & 실업률)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '👥',
    description: '미국 12월 비농업 고용자수 변동 및 실업률 (BLS 공식 일정)'
  },
  {
    date: '2026-01-13',
    title: '미국 12월 소비자물가지수 (CPI)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '📈',
    description: '미국 노동부 12월 CPI 및 근원 CPI 발표 (BLS 공식 일정)'
  },
  {
    date: '2026-01-15',
    title: 'TSMC 4분기 실적발표',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '🏭', ticker: 'TSM',
    description: 'TSMC 2025년 4분기 실적 및 연간 가이던스 공개'
  },
  {
    date: '2026-01-15',
    title: '한국은행 금융통화위원회 금리결정',
    category: 'POLICY', country: 'KR', importance: 'HIGH', emoji: '🏛️',
    description: '2026년 첫 통화정책방향 결정회의 (한국은행 공식 일정)'
  },
  {
    date: '2026-01-22',
    title: '넷플릭스 (NFLX) 4분기 실적발표',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '🎬', ticker: 'NFLX',
    description: '넷플릭스 4분기 글로벌 구독자 수 및 광고 요금제 실적 공개'
  },
  {
    date: '2026-01-23',
    title: 'SK하이닉스 4분기 실적발표',
    category: 'EARNINGS', country: 'KR', importance: 'HIGH', emoji: '💾', ticker: '000660',
    description: 'SK하이닉스 2025년 4분기 확정 실적 및 배당 발표'
  },
  {
    date: '2026-01-28',
    title: '미국 연방공개시장위원회 (FOMC) 금리결정',
    category: 'FOMC', country: 'US', importance: 'HIGH', emoji: '🏦',
    description: '미 연준 1/27~28 회의 기준금리 결정 및 파월 의장 기자회견 (Fed 공식 일정)'
  },
  {
    date: '2026-01-29',
    title: '마이크로소프트 (MSFT) & 구글 (GOOGL) 실적발표',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '💻', ticker: 'MSFT',
    description: '빅테크 AI 클라우드(애저/GCP) 성장률 및 자본지출(CapEx) 공개'
  },
  {
    date: '2026-01-30',
    title: '애플 (AAPL) & 메타 (META) 실적발표',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '🍏', ticker: 'AAPL',
    description: '아이폰17 AI 업그레이드 사이클 및 메타 AI 광고 매출 실적'
  },

  // ── 2월 2026 ──
  {
    date: '2026-02-11',
    title: '미국 1월 고용보고서 (NFP & 실업률)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '👥',
    description: '미국 1월 비농업 고용자수 변동 및 실업률 (BLS 공식 일정)'
  },
  {
    date: '2026-02-13',
    title: '미국 1월 소비자물가지수 (CPI)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '📈',
    description: '미국 1월 소비자물가 공식 집계 (BLS 공식 일정)'
  },
  {
    date: '2026-02-25',
    title: '엔비디아 (NVDA) 4분기 실적발표',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '👑', ticker: 'NVDA',
    description: '엔비디아 2025 회계연도 4분기 확정 실적 및 블랙웰(Blackwell) 가이던스'
  },
  {
    date: '2026-02-26',
    title: '한국은행 금융통화위원회 금리결정',
    category: 'POLICY', country: 'KR', importance: 'HIGH', emoji: '🏛️',
    description: '한국은행 기준금리 결정 통화정책방향 회의 (한국은행 공식 일정)'
  },

  // ── 3월 2026 ──
  {
    date: '2026-03-06',
    title: '미국 2월 고용보고서 (NFP & 실업률)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '👥',
    description: '미국 2월 비농업 고용자수 변동 및 실업률 (BLS 공식 일정)'
  },
  {
    date: '2026-03-11',
    title: '미국 2월 소비자물가지수 (CPI)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '📈',
    description: '미국 2월 소비자물가 공식 집계 (BLS 공식 일정)'
  },
  {
    date: '2026-03-12',
    title: '한국 선물옵션 동시 만기일 (네 마녀의 날)',
    category: 'OPTIONS', country: 'KR', importance: 'HIGH', emoji: '🧙‍♀️',
    description: 'KOSPI200 선물/옵션, 개별주식 선물/옵션 동시 만기'
  },
  {
    date: '2026-03-18',
    title: '미국 FOMC 금리결정 & 점도표 공개',
    category: 'FOMC', country: 'US', importance: 'HIGH', emoji: '🏦',
    description: '미 연준 3/17~18 회의, 점도표(Dot Plot) 및 2026 경제전망(SEP) 발표 (Fed 공식 일정)'
  },
  {
    date: '2026-03-20',
    title: '미국 네 마녀의 날 (Quad Witching)',
    category: 'OPTIONS', country: 'US', importance: 'HIGH', emoji: '🧙‍♀️',
    description: '미국 주가지수/개별주식 선물·옵션 4종 동시 만기일'
  },

  // ── 4월 2026 ──
  {
    date: '2026-04-03',
    title: '미국 3월 고용보고서 (NFP & 실업률)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '👥',
    description: '미국 3월 비농업 고용자수 변동 및 실업률 (BLS 공식 일정)'
  },
  {
    date: '2026-04-07',
    title: '삼성전자 1분기 잠정 실적발표',
    category: 'EARNINGS', country: 'KR', importance: 'HIGH', emoji: '📱', ticker: '005930',
    description: '삼성전자 2026년 1분기 잠정 실적 공시'
  },
  {
    date: '2026-04-10',
    title: '미국 3월 소비자물가지수 (CPI)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '📈',
    description: '미국 3월 소비자물가 공식 집계 (BLS 공식 일정)'
  },
  {
    date: '2026-04-10',
    title: '한국은행 금융통화위원회 금리결정',
    category: 'POLICY', country: 'KR', importance: 'HIGH', emoji: '🏛️',
    description: '한국은행 4월 통화정책방향 결정회의 (한국은행 공식 일정)'
  },
  {
    date: '2026-04-16',
    title: 'TSMC 1분기 실적발표',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '🏭', ticker: 'TSM',
    description: 'TSMC 2026년 1분기 실적 및 AI 칩 파운드리 동향'
  },
  {
    date: '2026-04-23',
    title: '현대차 & 기아 1분기 실적발표',
    category: 'EARNINGS', country: 'KR', importance: 'HIGH', emoji: '🚗', ticker: '005380',
    description: '현대차/기아 1분기 글로벌 판매량 및 HEV/EV 믹스 실적'
  },
  {
    date: '2026-04-24',
    title: 'SK하이닉스 1분기 실적발표',
    category: 'EARNINGS', country: 'KR', importance: 'HIGH', emoji: '💾', ticker: '000660',
    description: 'SK하이닉스 1분기 확정 실적 공시'
  },
  {
    date: '2026-04-29',
    title: '미국 연방공개시장위원회 (FOMC) 금리결정',
    category: 'FOMC', country: 'US', importance: 'HIGH', emoji: '🏦',
    description: '미 연준 4/28~29 회의 기준금리 결정 (Fed 공식 일정)'
  },

  // ── 5월 2026 ──
  {
    date: '2026-05-08',
    title: '미국 4월 고용보고서 (NFP & 실업률)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '👥',
    description: '미국 4월 비농업 고용자수 변동 및 실업률 (BLS 공식 일정)'
  },
  {
    date: '2026-05-12',
    title: '미국 4월 소비자물가지수 (CPI)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '📈',
    description: '미국 4월 소비자물가 공식 집계 (BLS 공식 일정)'
  },
  {
    date: '2026-05-20',
    title: '엔비디아 (NVDA) 1분기 실적발표',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '👑', ticker: 'NVDA',
    description: '엔비디아 2026 회계연도 1분기 실적발표'
  },
  {
    date: '2026-05-28',
    title: '한국은행 금융통화위원회 금리결정',
    category: 'POLICY', country: 'KR', importance: 'HIGH', emoji: '🏛️',
    description: '한국은행 상반기 통화정책방향 및 수정 경제전망 (한국은행 공식 일정)'
  },

  // ── 6월 2026 ──
  {
    date: '2026-06-05',
    title: '미국 5월 고용보고서 (NFP & 실업률)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '👥',
    description: '미국 5월 비농업 고용자수 변동 및 실업률 (BLS 공식 일정)'
  },
  {
    date: '2026-06-10',
    title: '미국 5월 소비자물가지수 (CPI)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '📈',
    description: '미국 5월 소비자물가 공식 집계 (BLS 공식 일정)'
  },
  {
    date: '2026-06-11',
    title: '한국 선물옵션 동시 만기일 (네 마녀의 날)',
    category: 'OPTIONS', country: 'KR', importance: 'HIGH', emoji: '🧙‍♀️',
    description: 'KOSPI200 6월물 선물옵션 동시 만기'
  },
  {
    date: '2026-06-17',
    title: '미국 FOMC 금리결정 & 점도표 공개',
    category: 'FOMC', country: 'US', importance: 'HIGH', emoji: '🏦',
    description: '연준 6/16~17 회의 기준금리 결정 및 중간 경제전망 (Fed 공식 일정)'
  },

  // ── 7월 2026 ──
  {
    date: '2026-07-02',
    title: '미국 6월 고용보고서 (NFP & 실업률)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '👥',
    description: '미국 6월 비농업 고용자수 변동 및 실업률 (BLS 공식 일정)'
  },
  {
    date: '2026-07-07',
    title: '삼성전자 2분기 잠정 실적발표',
    category: 'EARNINGS', country: 'KR', importance: 'HIGH', emoji: '📱', ticker: '005930',
    description: '삼성전자 2026년 2분기 잠정 실적 공시'
  },
  {
    date: '2026-07-14',
    title: '미국 6월 소비자물가지수 (CPI)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '📈',
    description: '미국 6월 소비자물가 공식 집계 (BLS 공식 일정)'
  },
  {
    date: '2026-07-16',
    title: '한국은행 금융통화위원회 금리결정',
    category: 'POLICY', country: 'KR', importance: 'HIGH', emoji: '🏛️',
    description: '한국은행 7월 통화정책방향 결정회의 (한국은행 공식 일정)'
  },
  {
    date: '2026-07-16',
    title: 'TSMC 2분기 실적발표',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '🏭', ticker: 'TSM',
    description: 'TSMC 2026년 2분기 실적 및 AI 칩 파운드리 동향'
  },
  {
    date: '2026-07-23',
    title: 'SK하이닉스 2분기 실적발표',
    category: 'EARNINGS', country: 'KR', importance: 'HIGH', emoji: '💾', ticker: '000660',
    description: 'SK하이닉스 2분기 실적 발표'
  },
  {
    date: '2026-07-29',
    title: '미국 연방공개시장위원회 (FOMC) 금리결정',
    category: 'FOMC', country: 'US', importance: 'HIGH', emoji: '🏦',
    description: '미 연준 7/28~29 회의 기준금리 결정 (Fed 공식 일정)'
  },

  // ── 8월 2026 ──
  {
    date: '2026-08-07',
    title: '미국 7월 고용보고서 (NFP)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '👥',
    description: '미국 7월 비농업 고용 및 실업률 공식 발표 (BLS 공식 일정)'
  },
  {
    date: '2026-08-12',
    title: '미국 7월 소비자물가지수 (CPI)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '📈',
    description: '미국 노동부 7월 소비자물가 발표 (BLS 공식 일정)'
  },
  {
    date: '2026-08-19',
    title: 'FOMC 7월 회의 의사록 공개',
    category: 'FOMC', country: 'US', importance: 'MEDIUM', emoji: '🏛️',
    description: '7월 FOMC 회의록 공개 및 위원별 발언 분석'
  },
  {
    date: '2026-08-27',
    title: '엔비디아 (NVDA) 2분기 실적발표',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '👑', ticker: 'NVDA',
    description: '엔비디아 2027 회계연도 2분기(5~7월) 실적 및 차세대 베라 루빈(Vera Rubin) 가이던스 공개'
  },
  {
    date: '2026-08-27',
    title: '한국은행 금융통화위원회 금리결정',
    category: 'POLICY', country: 'KR', importance: 'HIGH', emoji: '🏛️',
    description: '한국은행 8월 기준금리 결정 회의 (한국은행 공식 일정)'
  },
  {
    date: '2026-08-28',
    title: '미국 7월 근원 개인소비지출 (PCE) 물가지수',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '🛒',
    description: '연준이 가장 선호하는 핵심 물가 지표'
  },

  // ── 9월 2026 (현재 월) ──
  {
    date: '2026-09-04',
    title: '미국 8월 고용보고서 (NFP & 실업률)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '👥',
    description: '미국 8월 비농업 고용자수 변동 및 실업률 (BLS 공식 일정)'
  },
  {
    date: '2026-09-10',
    title: '한국 선물옵션 동시 만기일 (네 마녀의 날)',
    category: 'OPTIONS', country: 'KR', importance: 'HIGH', emoji: '🧙‍♀️',
    description: 'KOSPI200 9월물 선물옵션 만기일'
  },
  {
    date: '2026-09-11',
    title: '미국 8월 소비자물가지수 (CPI)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '📈',
    description: '미국 8월 소비자물가 공식 집계 (BLS 공식 일정)'
  },
  {
    date: '2026-09-16',
    title: '미국 FOMC 금리결정 & 점도표 공개',
    category: 'FOMC', country: 'US', importance: 'HIGH', emoji: '🏦',
    description: '미 연준 9/15~16 회의 기준금리 결정 및 경제전망 (Fed 공식 일정)'
  },
  {
    date: '2026-09-18',
    title: '미국 네 마녀의 날 (Quad Witching)',
    category: 'OPTIONS', country: 'US', importance: 'HIGH', emoji: '🧙‍♀️',
    description: '미국 9월 쿼드러플 위칭데이'
  },
  {
    date: '2026-09-30',
    title: '미국 8월 근원 개인소비지출 (PCE) 물가지수',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '🛒',
    description: '연준이 가장 선호하는 핵심 물가 지표 (BEA 공식 일정)'
  },

  // ── 10월 2026 ──
  {
    date: '2026-10-02',
    title: '미국 9월 고용보고서 (NFP & 실업률)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '👥',
    description: '미국 9월 비농업 고용자수 변동 및 실업률 (BLS 공식 일정)'
  },
  {
    date: '2026-10-08',
    title: '삼성전자 3분기 잠정 실적발표',
    category: 'EARNINGS', country: 'KR', importance: 'HIGH', emoji: '📱', ticker: '005930',
    description: '삼성전자 2026년 3분기 잠정 실적 공시'
  },
  {
    date: '2026-10-14',
    title: '미국 9월 소비자물가지수 (CPI)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '📈',
    description: '미국 9월 소비자물가 공식 집계 (BLS 공식 일정)'
  },
  {
    date: '2026-10-15',
    title: 'TSMC 3분기 실적발표',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '🏭', ticker: 'TSM',
    description: 'TSMC 3분기 실적'
  },
  {
    date: '2026-10-22',
    title: '한국은행 금융통화위원회 금리결정',
    category: 'POLICY', country: 'KR', importance: 'HIGH', emoji: '🏛️',
    description: '한국은행 10월 금통위 (한국은행 공식 일정)'
  },
  {
    date: '2026-10-22',
    title: 'SK하이닉스 3분기 실적발표',
    category: 'EARNINGS', country: 'KR', importance: 'HIGH', emoji: '💾', ticker: '000660',
    description: 'SK하이닉스 3분기 실적'
  },
  {
    date: '2026-10-28',
    title: '미국 연방공개시장위원회 (FOMC) 금리결정',
    category: 'FOMC', country: 'US', importance: 'HIGH', emoji: '🏦',
    description: '미 연준 10/27~28 회의 통화정책 결정 (Fed 공식 일정)'
  },
  {
    date: '2026-10-29',
    title: '빅테크 실적 (애플/아마존/메타/MSFT/알파벳)',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '💻',
    description: '미국 M7 빅테크 3분기 어닝스 위크'
  },
  {
    date: '2026-10-29',
    title: '미국 9월 근원 개인소비지출 (PCE) 물가지수',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '🛒',
    description: '연준이 가장 선호하는 핵심 물가 지표 (BEA 공식 일정)'
  },

  // ── 11월 2026 ──
  {
    date: '2026-11-06',
    title: '미국 10월 고용보고서 (NFP & 실업률)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '👥',
    description: '미국 10월 비농업 고용자수 변동 및 실업률 (BLS 공식 일정)'
  },
  {
    date: '2026-11-10',
    title: '미국 10월 소비자물가지수 (CPI)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '📈',
    description: '미국 10월 소비자물가 공식 집계 (BLS 공식 일정)'
  },
  {
    date: '2026-11-19',
    title: '엔비디아 (NVDA) 3분기 실적발표',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '👑', ticker: 'NVDA',
    description: '엔비디아 2026 회계연도 3분기 실적발표'
  },
  {
    date: '2026-11-25',
    title: '미국 10월 근원 개인소비지출 (PCE) 물가지수',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '🛒',
    description: '연준이 가장 선호하는 핵심 물가 지표 (BEA 공식 일정)'
  },
  {
    date: '2026-11-26',
    title: '한국은행 금융통화위원회 금리결정',
    category: 'POLICY', country: 'KR', importance: 'HIGH', emoji: '🏛️',
    description: '한국은행 연간 마지막 금통위 (한국은행 공식 일정)'
  },

  // ── 12월 2026 ──
  {
    date: '2026-12-04',
    title: '미국 11월 고용보고서 (NFP & 실업률)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '👥',
    description: '미국 11월 비농업 고용자수 변동 및 실업률 (BLS 공식 일정)'
  },
  {
    date: '2026-12-09',
    title: '미국 FOMC 금리결정 & 연간 최종 점도표',
    category: 'FOMC', country: 'US', importance: 'HIGH', emoji: '🏦',
    description: '미 연준 12/8~9 회의, 2026년 최종 통화정책 결정 (Fed 공식 일정)'
  },
  {
    date: '2026-12-10',
    title: '미국 11월 소비자물가지수 (CPI)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '📈',
    description: '미국 11월 소비자물가 공식 집계 (BLS 공식 일정)'
  },
  {
    date: '2026-12-10',
    title: '한국 선물옵션 동시 만기일 (네 마녀의 날)',
    category: 'OPTIONS', country: 'KR', importance: 'HIGH', emoji: '🧙‍♀️',
    description: '한국 12월 선물옵션 동시 만기일'
  },
  {
    date: '2026-12-18',
    title: '미국 네 마녀의 날 (Quad Witching)',
    category: 'OPTIONS', country: 'US', importance: 'HIGH', emoji: '🧙‍♀️',
    description: '미국 12월 쿼드러플 위칭데이'
  },
  {
    date: '2026-12-23',
    title: '미국 11월 근원 개인소비지출 (PCE) 물가지수',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '🛒',
    description: '연준이 가장 선호하는 핵심 물가 지표 (BEA 공식 일정)'
  }
];

// 휴일 데이터베이스
const HOLIDAYS = [
  { date: '2026-01-01', title: '신정 (New Year)', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-01-01', title: "New Year's Day", category: 'HOLIDAY', country: 'US', importance: 'MEDIUM', emoji: '🏖️', description: '미국 증시 휴장일' },
  { date: '2026-01-19', title: 'Martin Luther King Jr. Day', category: 'HOLIDAY', country: 'US', importance: 'MEDIUM', emoji: '🏖️', description: '미국 증시 휴장일' },
  { date: '2026-02-16', title: "Presidents' Day", category: 'HOLIDAY', country: 'US', importance: 'MEDIUM', emoji: '🏖️', description: '미국 증시 휴장일' },
  { date: '2026-02-17', title: '설날 연휴', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-02-18', title: '설날', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-02-19', title: '설날 연휴', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-03-01', title: '삼일절', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-04-03', title: 'Good Friday', category: 'HOLIDAY', country: 'US', importance: 'MEDIUM', emoji: '🏖️', description: '미국 증시 휴장일 (부활절)' },
  { date: '2026-05-05', title: '어린이날', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-05-24', title: '부처님오신날', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-05-25', title: 'Memorial Day', category: 'HOLIDAY', country: 'US', importance: 'MEDIUM', emoji: '🏖️', description: '미국 증시 휴장일 (메모리얼데이)' },
  { date: '2026-06-06', title: '현충일', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-06-19', title: 'Juneteenth', category: 'HOLIDAY', country: 'US', importance: 'MEDIUM', emoji: '🏖️', description: '미국 증시 휴장일' },
  { date: '2026-07-04', title: 'Independence Day', category: 'HOLIDAY', country: 'US', importance: 'MEDIUM', emoji: '🏖️', description: '미국 증시 휴장일 (독립기념일)' },
  { date: '2026-08-15', title: '광복절', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-09-07', title: 'Labor Day', category: 'HOLIDAY', country: 'US', importance: 'MEDIUM', emoji: '🏖️', description: '미국 증시 휴장일 (노동절)' },
  { date: '2026-09-24', title: '추석 연휴', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-09-25', title: '추석', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-10-03', title: '개천절', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-10-09', title: '한글날', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-11-26', title: 'Thanksgiving Day', category: 'HOLIDAY', country: 'US', importance: 'MEDIUM', emoji: '🦃', description: '미국 증시 휴장일 (추수감사절)' },
  { date: '2026-12-25', title: '크리스마스', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🎄', description: '한국 증시 휴장일' },
  { date: '2026-12-25', title: 'Christmas Day', category: 'HOLIDAY', country: 'US', importance: 'MEDIUM', emoji: '🎄', description: '미국 증시 휴장일' }
];

// 정밀 이벤트와 휴일 합산
ALL_EVENTS.push(...DETAILED_2026_EVENTS, ...HOLIDAYS);

// ─────────────────────────────────────────────────────────────
// 2. 2025년 및 2027년 스크롤 지원용 보조 생성기
// ─────────────────────────────────────────────────────────────
for (const y of [2025, 2027]) {
  for (let m = 1; m <= 12; m++) {
    // 고용보고서
    ALL_EVENTS.push({
      date: getFirstFriday(y, m),
      title: '미국 고용보고서 (NFP)',
      category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '👥',
      description: '미국 노동부 비농업 고용지표 발표'
    });
    // CPI
    ALL_EVENTS.push({
      date: formatDate(y, m, 13),
      title: '미국 소비자물가지수 (CPI)',
      category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '📈',
      description: '미국 소비자물가지수 발표'
    });
    // 한국 옵션만기
    if ([3, 6, 9, 12].includes(m)) {
      ALL_EVENTS.push({
        date: getSecondThursday(y, m),
        title: '한국 선물옵션 동시 만기일',
        category: 'OPTIONS', country: 'KR', importance: 'HIGH', emoji: '🧙‍♀️',
        description: '쿼드러플 위칭데이'
      });
      ALL_EVENTS.push({
        date: getThirdFriday(y, m),
        title: '미국 네 마녀의 날 (Quad Witching)',
        category: 'OPTIONS', country: 'US', importance: 'HIGH', emoji: '🧙‍♀️',
        description: '미국 4종 선물옵션 동시 만기일'
      });
    }
  }
}

function getKstTodayStr() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const kst = new Date(utc + (9 * 3600000));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;
}

/**
 * 특정 연도와 월의 시장 이벤트를 조회합니다.
 * 실시간 라이브 결과 저장소(market_calendar_live_results.json)와 자동 병합하여 최신 실적을 반영합니다.
 */
export function getMarketCalendarEvents(year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const filteredEvents = ALL_EVENTS.filter(event => event.date.startsWith(prefix))
                                   .sort((a, b) => a.date.localeCompare(b.date));

  const todayStr = getKstTodayStr();
  const liveResults = loadLiveResults();

  const enrichedEvents = filteredEvents.map((evt, idx) => {
    const key = `${evt.date}_${evt.ticker || evt.title}`;
    const dynamicResult = liveResults[key] || (evt.ticker && liveResults[evt.ticker]) || null;
    const mergedResult = dynamicResult ? { ...evt.result, ...dynamicResult } : evt.result;
    const isConcluded = (mergedResult?.surprise && mergedResult?.surprise !== 'EXPECTED') || (evt.date < todayStr);

    return {
      ...evt,
      id: `evt-${evt.date}-${idx}`,
      result: mergedResult,
      isConcluded
    };
  });

  return {
    success: true,
    events: enrichedEvents,
    year: Number(year),
    month: Number(month),
    totalCount: enrichedEvents.length,
    today: todayStr,
    lastSynced: new Date().toISOString()
  };
}

/**
 * 특정 기간 내의 시장 이벤트를 조회합니다.
 */
export function getMarketCalendarRange(startYear, startMonth, endYear, endMonth) {
  const startStr = formatDate(startYear, startMonth, 1);
  const endStr = formatDate(endYear, endMonth, 31);

  const filteredEvents = ALL_EVENTS.filter(event => event.date >= startStr && event.date <= endStr)
                                   .sort((a, b) => a.date.localeCompare(b.date));

  const todayStr = getKstTodayStr();
  const liveResults = loadLiveResults();

  const enrichedEvents = filteredEvents.map((evt, idx) => {
    const key = `${evt.date}_${evt.ticker || evt.title}`;
    const dynamicResult = liveResults[key] || (evt.ticker && liveResults[evt.ticker]) || null;
    const mergedResult = dynamicResult ? { ...evt.result, ...dynamicResult } : evt.result;
    const isConcluded = (mergedResult?.surprise && mergedResult?.surprise !== 'EXPECTED') || (evt.date < todayStr);

    return {
      ...evt,
      id: `evt-${evt.date}-${idx}`,
      result: mergedResult,
      isConcluded
    };
  });

  return {
    success: true,
    events: enrichedEvents,
    startDate: startStr,
    endDate: endStr,
    today: todayStr
  };
}
