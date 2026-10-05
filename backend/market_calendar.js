/**
 * market_calendar.js — 📅 글로벌 증시 일정 달력 & 상세 결과 분석 데이터베이스
 * 미국 빅테크 실적, 한국 대형주 실적, FOMC, 금통위, 물가/고용지표, 만기일 전수 관리
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadOutlookStore, outlookKey } from './calendar_outlook.js';
import { ruleEventsForYear, loadAutoStore } from './calendar_auto.js';

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
    description: '삼성전자 2026년 3분기 잠정 실적 공시',
    outlook: {
      forecast: '영업이익 약 105.2조원 (전년 동기 대비 +764.7%)',
      previous: '2026년 2분기 매출 171조원 · 영업이익 89.4조원',
      source: '에프앤가이드 컨센서스 (파이낸셜뉴스 10/4 보도, 1개월 전 기준 추정치)'
    }
  },
  {
    date: '2026-10-14',
    title: '미국 9월 소비자물가지수 (CPI)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '📈',
    description: '미국 9월 소비자물가 공식 집계 (BLS 공식 일정)',
    outlook: {
      forecast: '시장 예상치는 발표 1주 전쯤 형성되어 아직 집계 전',
      previous: '8월 CPI 전년 대비 +3.4%',
      source: '언론 보도 (글로벌이코노믹 9/12)'
    }
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
    date: '2026-11-17',
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
  { date: '2026-02-16', title: '설날 연휴', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-02-17', title: '설날', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-02-18', title: '설날 연휴', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-03-01', title: '삼일절 (일요일)', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '일요일이라 3/2(월)이 대체공휴일로 휴장' },
  { date: '2026-03-02', title: '삼일절 대체공휴일', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-05-01', title: '근로자의날', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-04-03', title: 'Good Friday', category: 'HOLIDAY', country: 'US', importance: 'MEDIUM', emoji: '🏖️', description: '미국 증시 휴장일 (부활절)' },
  { date: '2026-05-05', title: '어린이날', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-05-24', title: '부처님오신날 (일요일)', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '일요일이라 5/25(월)이 대체공휴일로 휴장' },
  { date: '2026-05-25', title: '부처님오신날 대체공휴일', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-05-25', title: 'Memorial Day', category: 'HOLIDAY', country: 'US', importance: 'MEDIUM', emoji: '🏖️', description: '미국 증시 휴장일 (메모리얼데이)' },
  { date: '2026-06-03', title: '전국동시지방선거', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🗳️', description: '한국 증시 휴장일' },
  { date: '2026-06-06', title: '현충일', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-06-19', title: 'Juneteenth', category: 'HOLIDAY', country: 'US', importance: 'MEDIUM', emoji: '🏖️', description: '미국 증시 휴장일' },
  { date: '2026-07-03', title: 'Independence Day (observed)', category: 'HOLIDAY', country: 'US', importance: 'MEDIUM', emoji: '🏖️', description: '7/4가 토요일이라 7/3(금) 미국 증시 휴장 (독립기념일)' },
  { date: '2026-08-15', title: '광복절 (토요일)', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '토요일이라 8/17(월)이 대체공휴일로 휴장' },
  { date: '2026-08-17', title: '광복절 대체공휴일', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-09-07', title: 'Labor Day', category: 'HOLIDAY', country: 'US', importance: 'MEDIUM', emoji: '🏖️', description: '미국 증시 휴장일 (노동절)' },
  { date: '2026-09-24', title: '추석 연휴', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-09-25', title: '추석', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-10-03', title: '개천절 (토요일)', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '토요일이라 10/5(월)이 대체공휴일로 휴장' },
  { date: '2026-10-05', title: '개천절 대체공휴일', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-10-09', title: '한글날', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 휴장일' },
  { date: '2026-11-26', title: 'Thanksgiving Day', category: 'HOLIDAY', country: 'US', importance: 'MEDIUM', emoji: '🦃', description: '미국 증시 휴장일 (추수감사절)' },
  { date: '2026-12-25', title: '크리스마스', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🎄', description: '한국 증시 휴장일' },
  { date: '2026-12-25', title: 'Christmas Day', category: 'HOLIDAY', country: 'US', importance: 'MEDIUM', emoji: '🎄', description: '미국 증시 휴장일' },
  { date: '2026-12-31', title: '연말 휴장', category: 'HOLIDAY', country: 'KR', importance: 'MEDIUM', emoji: '🇰🇷', description: '한국 증시 연말 휴장일 (폐장일)' }
];

// ── 2026년 4분기(10~12월) 추가 일정 ──
// 출처: 미국 노동통계국(BLS)·경제분석국(BEA)·인구조사국(Census) 공식 발표일정, 연준 FOMC 공식 캘린더,
// 한국은행 금통위 일정. 옵션만기(미국 3번째 금요일/한국 2번째 목요일), ISM, 관세청 수출입 현황은 통상 규칙,
// 실적발표 중 "예상"은 회사 공식 확정 전 추정일이다.
const e = (date, title, category, country, importance, emoji, description, extra = {}) =>
  ({ date, title, category, country, importance, emoji, description, ...extra });

const Q4_ADDITIONAL_EVENTS = [
  // 10월
  e('2026-10-06', '미국 8월 무역수지', 'ECONOMIC', 'US', 'MEDIUM', '🚢', '미국 8월 상품·서비스 무역수지 (BEA 공식 일정)'),
  e('2026-10-07', 'FOMC 9월 회의 의사록 공개', 'FOMC', 'US', 'HIGH', '📝', '9/15~16 FOMC 회의 의사록 (Fed 공식 일정)'),
  e('2026-10-08', '한국 10월 옵션 만기일', 'OPTIONS', 'KR', 'MEDIUM', '🧙', '코스피200 옵션 월간 만기일 (매월 둘째 목요일)'),
  e('2026-10-12', '관세청 10월 1~10일 수출입 현황', 'ECONOMIC', 'KR', 'MEDIUM', '🚢', '11일이 일요일이라 다음 영업일 발표 예정 (관세청 통상 11일 발표)'),
  e('2026-10-13', 'JP모건 3분기 실적발표', 'EARNINGS', 'US', 'HIGH', '🏦', '미국 대형 은행 어닝시즌 개막 (장 시작 전 발표)', { ticker: 'JPM' }),
  e('2026-10-14', '미국 9월 소매판매', 'ECONOMIC', 'US', 'HIGH', '🛍️', '미국 9월 소매·외식업 매출 속보치 (Census 공식 일정)'),
  e('2026-10-15', '미국 9월 생산자물가지수 (PPI)', 'ECONOMIC', 'US', 'MEDIUM', '🏭', '미국 9월 PPI (BLS 공식 일정)'),
  e('2026-10-16', '미국 10월 옵션 만기일', 'OPTIONS', 'US', 'MEDIUM', '🧙', '미국 월간 옵션 만기일 (매월 셋째 금요일)'),
  e('2026-10-16', '미국 9월 수출입물가지수', 'ECONOMIC', 'US', 'LOW', '📦', '미국 9월 수출입 물가 (BLS 공식 일정)'),
  e('2026-10-20', '넷플릭스 3분기 실적발표', 'EARNINGS', 'US', 'HIGH', '🎬', '장 마감 후 발표', { ticker: 'NFLX' }),
  e('2026-10-20', '미국 9월 신규주택착공', 'ECONOMIC', 'US', 'MEDIUM', '🏗️', '미국 9월 주택착공·건축허가 (Census 공식 일정)'),
  e('2026-10-21', '테슬라 3분기 실적발표', 'EARNINGS', 'US', 'HIGH', '🚗', '장 마감 후 발표 (동부 17:30, 테슬라 공시)', { ticker: 'TSLA' }),
  e('2026-10-21', '관세청 10월 1~20일 수출입 현황', 'ECONOMIC', 'KR', 'MEDIUM', '🚢', '10월 1~20일 수출입 잠정치 (관세청 통상 21일 발표)'),
  e('2026-10-27', '미국 9월 내구재 주문 · 신규주택판매', 'ECONOMIC', 'US', 'MEDIUM', '🏠', 'Census 공식 일정'),
  e('2026-10-28', '마이크로소프트·메타 3분기 실적발표 (예상)', 'EARNINGS', 'US', 'HIGH', '💻', '회사 공식 확정 전 예상일 — IR 공지 확인 필요', { tickers: ['MSFT', 'META'] }),
  e('2026-10-29', '미국 3분기 GDP 속보치', 'ECONOMIC', 'US', 'HIGH', '📊', '미국 2026년 3분기 GDP 1차 추정 (BEA 공식 일정)'),
  e('2026-10-29', '애플·아마존 실적발표 (예상)', 'EARNINGS', 'US', 'HIGH', '🍎', '회사 공식 확정 전 예상일 — IR 공지 확인 필요', { tickers: ['AAPL', 'AMZN'] }),
  e('2026-10-30', '미국 3분기 고용비용지수 (ECI)', 'ECONOMIC', 'US', 'MEDIUM', '👷', 'BLS 공식 일정'),
  // 11월
  e('2026-11-01', '산업통상부 10월 수출입동향', 'ECONOMIC', 'KR', 'HIGH', '🚢', '10월 한국 수출입 확정치 (매월 1일 발표, 일요일이어도 발표)'),
  e('2026-11-02', '미국 10월 ISM 제조업 PMI', 'ECONOMIC', 'US', 'MEDIUM', '🏭', '매월 첫 영업일 발표'),
  e('2026-11-03', '미국 중간선거', 'POLICY', 'US', 'HIGH', '🗳️', '2026 미국 중간선거 (상·하원 의회 구도 변화)'),
  e('2026-11-03', '미국 9월 구인·이직 (JOLTS)', 'ECONOMIC', 'US', 'MEDIUM', '👥', 'BLS 공식 일정'),
  e('2026-11-04', '미국 9월 무역수지', 'ECONOMIC', 'US', 'MEDIUM', '🚢', 'BEA 공식 일정'),
  e('2026-11-04', '미국 10월 ISM 서비스업 PMI', 'ECONOMIC', 'US', 'MEDIUM', '🛎️', '매월 셋째 영업일 발표'),
  e('2026-11-10', '한국은행 10월 금통위 의사록 공개', 'POLICY', 'KR', 'MEDIUM', '📝', '회의일로부터 2주 경과 후 첫 화요일 공개 (한국은행 공시 규칙)'),
  e('2026-11-11', '관세청 11월 1~10일 수출입 현황', 'ECONOMIC', 'KR', 'MEDIUM', '🚢', '11월 1~10일 수출입 잠정치'),
  e('2026-11-12', '한국 11월 옵션 만기일', 'OPTIONS', 'KR', 'MEDIUM', '🧙', '코스피200 옵션 월간 만기일 (매월 둘째 목요일)'),
  e('2026-11-13', '미국 10월 생산자물가지수 (PPI)', 'ECONOMIC', 'US', 'MEDIUM', '🏭', 'BLS 공식 일정'),
  e('2026-11-17', '미국 10월 소매판매', 'ECONOMIC', 'US', 'HIGH', '🛍️', 'Census 공식 일정'),
  e('2026-11-17', '미국 10월 수출입물가지수', 'ECONOMIC', 'US', 'LOW', '📦', 'BLS 공식 일정'),
  e('2026-11-18', '미국 10월 신규주택착공', 'ECONOMIC', 'US', 'MEDIUM', '🏗️', 'Census 공식 일정'),
  e('2026-11-19', '대학수학능력시험 (증시 1시간 늦게 개장)', 'POLICY', 'KR', 'MEDIUM', '📚', '수능일에는 한국 증시 개장·종료가 1시간 늦춰짐 (10:00~16:30)'),
  e('2026-11-20', '미국 11월 옵션 만기일', 'OPTIONS', 'US', 'MEDIUM', '🧙', '미국 월간 옵션 만기일 (매월 셋째 금요일)'),
  e('2026-11-23', '관세청 11월 1~20일 수출입 현황', 'ECONOMIC', 'KR', 'MEDIUM', '🚢', '21일이 토요일이라 다음 영업일 발표 예정'),
  e('2026-11-25', '미국 3분기 GDP 2차 추정 · 기업이익', 'ECONOMIC', 'US', 'MEDIUM', '📊', 'BEA 공식 일정'),
  e('2026-11-25', '미국 10월 내구재 주문 · 신규주택판매', 'ECONOMIC', 'US', 'LOW', '🏠', 'Census 공식 일정'),
  e('2026-11-27', '미국 추수감사절 다음날 조기폐장', 'HOLIDAY', 'US', 'MEDIUM', '🛍️', '미국 증시 오후 1시(동부) 조기 마감 — 한국 시간 11/28(토) 03:00'),
  e('2026-11-27', 'MSCI 11월 반기 리뷰 반영 (예상)', 'POLICY', 'KR', 'MEDIUM', '🌏', '외국인 패시브 자금 리밸런싱 — 정확한 반영일은 MSCI 공지 확인 필요'),
  // 12월
  e('2026-12-01', '산업통상부 11월 수출입동향', 'ECONOMIC', 'KR', 'HIGH', '🚢', '11월 한국 수출입 확정치 (매월 1일 발표)'),
  e('2026-12-01', '미국 11월 ISM 제조업 PMI', 'ECONOMIC', 'US', 'MEDIUM', '🏭', '매월 첫 영업일 발표'),
  e('2026-12-03', '미국 ISM 서비스업 PMI', 'ECONOMIC', 'US', 'MEDIUM', '🛎️', '매월 셋째 영업일 발표'),
  e('2026-12-08', '미국 10월 무역수지', 'ECONOMIC', 'US', 'MEDIUM', '🚢', 'BEA 공식 일정'),
  e('2026-12-10', '코스피200 정기변경 반영', 'POLICY', 'KR', 'MEDIUM', '🔄', '통상 6·12월 선물옵션 동시만기일 장마감 시점 반영 — 한국거래소 공지 확인 필요'),
  e('2026-12-11', '관세청 12월 1~10일 수출입 현황', 'ECONOMIC', 'KR', 'MEDIUM', '🚢', '12월 1~10일 수출입 잠정치'),
  e('2026-12-15', '미국 11월 생산자물가지수 (PPI)', 'ECONOMIC', 'US', 'MEDIUM', '🏭', 'BLS 공식 일정'),
  e('2026-12-15', '한국은행 11월 금통위 의사록 공개', 'POLICY', 'KR', 'MEDIUM', '📝', '회의일로부터 2주 경과 후 첫 화요일 공개 (한국은행 공시 규칙)'),
  e('2026-12-16', '미국 11월 소매판매', 'ECONOMIC', 'US', 'HIGH', '🛍️', 'Census 공식 일정'),
  e('2026-12-17', '미국 11월 수출입물가지수', 'ECONOMIC', 'US', 'LOW', '📦', 'BLS 공식 일정'),
  e('2026-12-21', '관세청 12월 1~20일 수출입 현황', 'ECONOMIC', 'KR', 'MEDIUM', '🚢', '12월 1~20일 수출입 잠정치'),
  e('2026-12-23', '미국 3분기 GDP 3차 추정', 'ECONOMIC', 'US', 'MEDIUM', '📊', 'BEA 공식 일정'),
  e('2026-12-24', '미국 크리스마스 이브 조기폐장', 'HOLIDAY', 'US', 'MEDIUM', '🎄', '미국 증시 오후 1시(동부) 조기 마감'),
  e('2026-12-30', '한국 증시 폐장일 (올해 마지막 거래일)', 'HOLIDAY', 'KR', 'MEDIUM', '🔔', '12/31은 휴장이라 12/30(수)이 마지막 거래일'),

  // ── 한국 경제지표·통화 (한국은행 통계 공표일정 / 통계청 공표일정) ──
  e('2026-10-08', '한국 8월 국제수지 (잠정)', 'ECONOMIC', 'KR', 'MEDIUM', '💱', '한국은행 통계 공표일정'),
  e('2026-10-27', '한국 3분기 GDP 속보', 'ECONOMIC', 'KR', 'HIGH', '📊', '한국은행 2026년 3분기 실질 GDP 속보치 (한국은행 통계 공표일정)'),
  e('2026-10-29', '한국 9월 금융기관 가중평균금리', 'ECONOMIC', 'KR', 'LOW', '🏦', '한국은행 통계 공표일정'),
  e('2026-11-03', '한국 10월 소비자물가동향', 'ECONOMIC', 'KR', 'HIGH', '📈', '통계청(국가데이터처) 공표일정 기준 — 변경될 수 있음'),
  e('2026-11-05', '한국 9월 국제수지 (잠정)', 'ECONOMIC', 'KR', 'MEDIUM', '💱', '한국은행 통계 공표일정'),
  e('2026-11-11', '한국 10월 고용동향', 'ECONOMIC', 'KR', 'MEDIUM', '👥', '통계청(국가데이터처) 공표일정 검색 결과 기준 — 변경될 수 있음'),
  e('2026-11-13', '한국 9월 통화 및 유동성', 'ECONOMIC', 'KR', 'LOW', '💵', '한국은행 통계 공표일정'),
  e('2026-11-20', '한국 10월 생산자물가지수 (잠정)', 'ECONOMIC', 'KR', 'MEDIUM', '🏭', '한국은행 통계 공표일정'),
  e('2026-11-16', '3분기 분기보고서 제출 마감', 'EARNINGS', 'KR', 'MEDIUM', '📑', '상장사 3분기 분기보고서 법정 제출 기한 (분기 종료 후 45일) — 기업별 실적발표는 10월 말~11월 중순에 개별 공지'),
  e('2026-11-30', '한국 10월 산업활동동향', 'ECONOMIC', 'KR', 'MEDIUM', '🏭', '통계청(국가데이터처) 공표일정 검색 결과 기준 — 변경될 수 있음'),
  e('2026-12-02', '한국 11월 소비자물가동향', 'ECONOMIC', 'KR', 'HIGH', '📈', '통계청(국가데이터처) 공표일정 검색 결과 기준 — 변경될 수 있음'),
  e('2026-12-08', '한국 10월 국제수지 (잠정)', 'ECONOMIC', 'KR', 'MEDIUM', '💱', '한국은행 통계 공표일정'),
  e('2026-12-15', '한국 10월 통화 및 유동성 · 11월 수출입물가지수', 'ECONOMIC', 'KR', 'LOW', '💵', '한국은행 통계 공표일정'),
  e('2026-12-16', '한국 11월 고용동향', 'ECONOMIC', 'KR', 'MEDIUM', '👥', '통계청(국가데이터처) 공표일정 검색 결과 기준 — 변경될 수 있음'),
  e('2026-12-30', '한국 11월 산업활동동향', 'ECONOMIC', 'KR', 'MEDIUM', '🏭', '통계청(국가데이터처) 공표일정 검색 결과 기준 — 변경될 수 있음'),
];

// 정밀 이벤트와 휴일 합산
ALL_EVENTS.push(...DETAILED_2026_EVENTS, ...Q4_ADDITIONAL_EVENTS, ...HOLIDAYS);

// ─────────────────────────────────────────────────────────────
// 2. 2026년 직접 입력분 + 규칙 계산 + 공식 사이트 자동 수집을 합쳐서 내려준다 (어느 해든 동작)
//    · ruleEventsForYear: 옵션만기·휴장일·ISM·수출입·선거 등 규칙으로 정해지는 일정 (연도만 있으면 계산)
//    · loadAutoStore: 연준·BLS·BEA·한국은행·Nasdaq 실적을 매일 자동 수집한 일정 (새 연도 일정이 공개되면 자동 반영)
//    같은 날짜·같은 종류(kind)는 직접 입력분 > 자동 수집 > 규칙 순으로 하나만 남긴다.
// ─────────────────────────────────────────────────────────────
const KIND_RULES = [
  [/FOMC.*의사록/, 'FOMC_MINUTES'], [/금통위.*의사록/, 'BOK_MINUTES'],
  [/FOMC|연방공개시장위원회/, 'FOMC'], [/금통위|금융통화위원회/, 'BOK'],
  [/고용보고서/, 'NFP'], [/소비자물가/, 'CPI'], [/생산자물가/, 'PPI'], [/구인·이직|JOLTS/, 'JOLTS'], [/수출입물가/, 'IMPORT_PRICE'],
  [/고용비용|ECI/, 'ECI'], [/PCE/, 'PCE'], [/무역수지/, 'TRADE'],
  [/GDP.*속보/, 'GDP_ADV'], [/GDP.*2차/, 'GDP_2'], [/GDP.*3차/, 'GDP_3'],
  [/ISM 제조업/, 'ISM_MFG'], [/ISM 서비스/, 'ISM_SVC'],
  [/관세청.*1~10일/, 'CUSTOMS_10'], [/관세청.*1~20일/, 'CUSTOMS_20'], [/산업통상부.*수출입동향/, 'TRADE_MONTHLY'],
  [/정기변경/, 'KOSPI200'], [/옵션 만기|선물옵션|네 마녀|Quad/, 'OPT'],
  [/분기보고서|사업보고서|반기보고서/, 'REPORT_DEADLINE'], [/수능|수학능력/, 'CSAT'], [/중간선거|대통령 선거/, 'ELECTION'],
  [/조기폐장/, 'EARLY'], [/폐장일 \(올해/, 'LAST_DAY'],
];
// 일정의 "종류" 식별자 — 직접 입력분은 제목으로 추정하고, 자동·규칙 일정은 명시된 kind에 국가 접두어를 붙여 맞춘다
function kindOf(evt) {
  if (evt.kind) return /^(US|KR)_/.test(evt.kind) ? evt.kind : `${evt.country}_${evt.kind}`;
  if (evt.category === 'HOLIDAY' && !/조기폐장|폐장일 \(올해/.test(evt.title)) return `${evt.country}_HOLIDAY`;
  if (evt.category === 'EARNINGS' && evt.country === 'US' && evt.ticker) return `US_EARN_${evt.ticker}`;
  const hit = KIND_RULES.find(([re]) => re.test(evt.title));
  return hit ? `${evt.country}_${hit[1]}` : `T:${evt.title}`;
}

let mergedCache = { at: 0, list: [] };
export function invalidateCalendarCache() { mergedCache = { at: 0, list: [] }; }
export function getAllCalendarEvents() {
  if (Date.now() - mergedCache.at < 30000) return mergedCache.list;
  const seen = new Set();
  const out = [];
  const push = (evt, kind) => {
    const key = `${evt.date}|${evt.country}|${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(evt);
  };
  const auto = loadAutoStore().events || [];
  const autoEarnTickers = auto.filter(a => a.category === 'EARNINGS' && a.ticker);

  const within10 = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000) <= 10;
  // 1) 직접 입력분 — "(예상)"으로 적어둔 실적일은 같은 종목의 자동 수집 일정이 있으면 그쪽을 따른다
  const confirmedEarnings = []; // 확인된 날짜로 직접 입력한 미국 실적 (자동 수집분이 덮어쓰지 못하게)
  for (const evt of ALL_EVENTS) {
    if (evt.category === 'EARNINGS' && evt.country === 'US') {
      const ts = evt.tickers || (evt.ticker ? [evt.ticker] : []);
      const estimated = /\(예상\)/.test(evt.title);
      if (estimated && ts.length > 0 && ts.every(t => autoEarnTickers.some(a => a.ticker === t && within10(a.date, evt.date)))) continue;
      if (!estimated) ts.forEach(t => confirmedEarnings.push({ ticker: t, date: evt.date }));
    }
    push(evt, kindOf(evt));
  }
  // 2) 공식 사이트 자동 수집분 (직접 확인해 입력한 실적일과 겹치는 같은 종목은 건너뜀)
  for (const evt of auto) {
    if (evt.category === 'EARNINGS' && evt.ticker && confirmedEarnings.some(c => c.ticker === evt.ticker && within10(c.date, evt.date))) continue;
    push(evt, kindOf(evt));
  }
  // 3) 규칙 계산분 (넉넉히 전후 연도까지)
  const thisYear = new Date().getFullYear();
  for (let y = thisYear - 1; y <= thisYear + 8; y++) for (const evt of ruleEventsForYear(y)) push(evt, kindOf(evt));

  mergedCache = { at: Date.now(), list: out };
  return out;
}

function getKstTodayStr() {
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const kst = new Date(utc + (9 * 3600000));
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;
}

// 일정 종류별 "이게 뭐고 왜 중요한지" 일반 설명 (수치 없는 해설만 — 예상치/이전치는 outlook 필드로 별도 표기).
// 위에서부터 먼저 맞는 규칙을 사용한다.
const WHY_RULES = [
  [/FOMC.*의사록/, '연준 위원들이 지난 회의에서 금리·물가·고용을 어떻게 논의했는지 담은 기록입니다. 금리 인상/인하 시점에 대한 힌트를 줘서 발표 직후 금리와 증시가 움직일 수 있습니다.'],
  [/FOMC|금리결정.*연준|연방공개시장/, '미국 기준금리를 정하는 회의입니다. 금리 결정과 함께 나오는 성명서·기자회견 톤이 글로벌 증시, 환율, 국채금리에 가장 큰 영향을 줍니다.'],
  [/금통위.*의사록/, '한국은행 금통위원들의 금리 논의 내용입니다. 위원별 인상·인하 의견 분포를 보고 다음 금리 방향을 가늠합니다.'],
  [/금통위|금융통화위원회/, '한국은행이 기준금리를 정하는 회의입니다. 기준금리는 은행 대출금리와 원/달러 환율, 코스피 밸류에이션에 영향을 줍니다.'],
  [/고용보고서|NFP/, '미국 비농업 일자리 증가와 실업률로, 연준의 금리 판단에 가장 민감하게 반영되는 지표입니다. 예상보다 강하면 금리 인상 우려, 약하면 경기 둔화 우려가 커집니다.'],
  [/소비자물가|CPI/, '소비자가 체감하는 물가 상승률입니다. 근원 CPI(식품·에너지 제외)가 특히 중요하고, 예상보다 높으면 금리 인상 압력으로 받아들여져 증시에 부담이 됩니다.'],
  [/PCE/, '연준이 가장 선호하는 물가 지표입니다. CPI보다 소비 구조 변화를 반영하며 근원 PCE가 연준 물가 목표(2%)와 비교됩니다.'],
  [/생산자물가|PPI/, '기업이 받는 가격(도매물가)입니다. 소비자물가에 앞서 움직이는 경향이 있어 향후 CPI 방향을 미리 보는 용도로 씁니다.'],
  [/수출입물가/, '수출입 제품 가격 변동입니다. 환율과 원자재 가격이 물가에 전달되는 정도를 보여줍니다.'],
  [/소매판매/, '미국 소비 지출의 강도를 보여줍니다. 미국 GDP의 약 70%가 소비라서 경기 판단의 핵심 지표입니다.'],
  [/GDP/, '한 나라 경제의 분기 성장률입니다. 속보치 → 2차 → 3차 추정 순으로 수정되며, 속보치가 시장에 가장 큰 영향을 줍니다.'],
  [/ISM/, '구매관리자(PMI) 설문 기반 경기 선행지표입니다. 50을 넘으면 경기 확장, 밑돌면 위축으로 해석합니다.'],
  [/JOLTS|구인/, '미국 기업의 빈 일자리 수와 이직 규모입니다. 노동시장 열기를 보여줘서 연준의 고용 판단에 참고됩니다.'],
  [/고용비용|ECI/, '기업이 부담하는 인건비 변화입니다. 임금발(發) 물가 압력을 가늠하는 지표입니다.'],
  [/신규주택|주택착공|주택판매|내구재/, '주택·제조업 경기를 보여주는 지표입니다. 금리 수준에 민감해서 금리 영향이 실물경제에 얼마나 퍼졌는지 확인하는 용도입니다.'],
  [/무역수지|국제수지/, '수출입과 해외 거래 규모의 균형입니다. 한국은 경상수지와 반도체 수출 흐름이 원화와 증시에 중요합니다.'],
  [/수출입 현황|수출입동향/, '반도체·자동차 등 품목별 수출 증감을 가장 빨리 볼 수 있는 한국 경기 선행지표입니다. 코스피 대형주 실적 기대에 직접 연결됩니다.'],
  [/옵션 만기|네 마녀|Quad/, '파생상품 만기일에는 차익거래 청산 물량으로 장 막판 변동성이 커질 수 있습니다. 분기(3·6·9·12월) 동시만기일이 특히 큽니다.'],
  [/실적발표|잠정 실적|어닝/, '시장 예상치(컨센서스) 대비 실적이 얼마나 나왔는지가 주가를 좌우합니다. 실적 자체보다 예상 대비 서프라이즈/쇼크와 향후 가이던스가 더 중요합니다.'],
  [/중간선거/, '미국 의회(상·하원) 구도가 바뀌면 재정·무역·규제 정책 방향이 달라질 수 있어 선거 전후로 시장 변동성이 커지는 경향이 있습니다.'],
  [/MSCI|코스피200 정기변경/, '지수에 편입·편출되는 종목에 패시브 자금이 장 마감 시점에 몰려서 해당 종목 종가와 거래량이 크게 움직일 수 있습니다.'],
  [/수능|수학능력/, '수능일에는 출근 시간대 혼잡을 피하려고 한국 증시 개장·마감이 1시간 늦춰집니다.'],
  [/조기폐장/, '미국 증시가 오후 1시(동부 기준)에 일찍 마감해 거래량이 평소보다 크게 줄어듭니다.'],
  [/휴장|공휴일|연휴|폐장일|개천절|한글날|설날|추석|광복절|삼일절|어린이날|근로자의날|성탄|크리스마스|Thanksgiving|Christmas|선거/, '이 날은 증시가 열리지 않거나 거래 시간이 달라집니다. 휴장 전후로는 거래량이 줄고 결제·옵션 만기 일정도 함께 조정됩니다.'],
  [/분기보고서/, '상장사가 분기 재무제표를 공시해야 하는 법정 마감일입니다. 이 시점까지 대부분 기업의 3분기 확정 실적이 나옵니다.'],
  [/물가동향|고용동향|산업활동동향|통화 및 유동성|금리/, '한국 경기·물가·유동성 흐름을 확인하는 통계입니다. 한국은행의 금리 판단과 원화·증시 방향성에 참고됩니다.'],
];

function explainEvent(evt) {
  const text = `${evt.title} ${evt.category}`;
  const rule = WHY_RULES.find(([re]) => re.test(text));
  return rule ? rule[1] : null;
}

/**
 * 특정 연도와 월의 시장 이벤트를 조회합니다.
 * 실시간 라이브 결과 저장소(market_calendar_live_results.json)와 자동 병합하여 최신 실적을 반영합니다.
 */
export function getMarketCalendarEvents(year, month) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  const filteredEvents = getAllCalendarEvents().filter(event => event.date.startsWith(prefix))
                                   .sort((a, b) => a.date.localeCompare(b.date));

  const todayStr = getKstTodayStr();
  const liveResults = loadLiveResults();
  const outlookStore = loadOutlookStore();

  const enrichedEvents = filteredEvents.map((evt, idx) => {
    const key = `${evt.date}_${evt.ticker || evt.title}`;
    const dynamicResult = liveResults[key] || (evt.ticker && liveResults[evt.ticker]) || null;
    const mergedResult = dynamicResult ? { ...evt.result, ...dynamicResult } : evt.result;
    const isConcluded = (mergedResult?.surprise && mergedResult?.surprise !== 'EXPECTED') || (evt.date < todayStr);

    return {
      ...evt,
      id: `evt-${evt.date}-${idx}`,
      why: evt.why || explainEvent(evt),
      outlook: outlookStore[outlookKey(evt)] || evt.outlook,
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

  const filteredEvents = getAllCalendarEvents().filter(event => event.date >= startStr && event.date <= endStr)
                                   .sort((a, b) => a.date.localeCompare(b.date));

  const todayStr = getKstTodayStr();
  const liveResults = loadLiveResults();
  const outlookStore = loadOutlookStore();

  const enrichedEvents = filteredEvents.map((evt, idx) => {
    const key = `${evt.date}_${evt.ticker || evt.title}`;
    const dynamicResult = liveResults[key] || (evt.ticker && liveResults[evt.ticker]) || null;
    const mergedResult = dynamicResult ? { ...evt.result, ...dynamicResult } : evt.result;
    const isConcluded = (mergedResult?.surprise && mergedResult?.surprise !== 'EXPECTED') || (evt.date < todayStr);

    return {
      ...evt,
      id: `evt-${evt.date}-${idx}`,
      why: evt.why || explainEvent(evt),
      outlook: outlookStore[outlookKey(evt)] || evt.outlook,
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
