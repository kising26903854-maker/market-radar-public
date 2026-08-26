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

function saveLiveResults(data) {
  try {
    const dir = path.dirname(LIVE_RESULTS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LIVE_RESULTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('실시간 실적 결과 저장 실패:', e.message);
  }
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
const DETAILED_2026_EVENTS = [
  // ── 1월 2026 ──
  {
    date: '2026-01-08',
    title: '삼성전자 4분기 잠정 실적발표',
    category: 'EARNINGS', country: 'KR', importance: 'HIGH', emoji: '📱', ticker: '005930',
    description: '삼성전자 2025년 4분기 잠정 매출 및 영업이익 공시',
    result: {
      surprise: 'BEAT', surpriseLabel: '🟢 어닝 서프라이즈',
      epsActual: '1,320원', epsConsensus: '1,150원',
      revenueActual: '75.8조 원', revenueConsensus: '73.2조 원',
      growth: '+12.4% YoY',
      guidance: 'AI HBM3E 12단 및 서버용 DDR5 메모리 수요 폭증으로 DS(반도체) 부문 흑자폭 대폭 확대',
      marketReaction: '실적 발표 당일 삼성전자 +3.8% 급등 마감',
      summary: 'D램 및 낸드 판가 상승 지속과 고부가가치 AI 메모리 납품 확대로 시장 기대치를 크게 상회했습니다.'
    }
  },
  {
    date: '2026-01-14',
    title: '미국 12월 소비자물가지수 (CPI)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '📈',
    description: '미국 노동부 12월 CPI 및 근원 CPI 발표',
    result: {
      surprise: 'RELEASED', surpriseLabel: '🟢 물가 안정세 확인',
      actualValue: '2.7% (전년비)', forecastValue: '2.8%', previousValue: '2.9%',
      marketImpact: '예상치 하회로 연준 금리인하 기대감 강화, 나스닥 +1.4% 상승',
      summary: '주거비 및 중고차 가격 둔화로 인플레이션이 목표치 2%대에 안착하는 흐름을 재확인했습니다.'
    }
  },
  {
    date: '2026-01-15',
    title: 'TSMC 4분기 실적발표',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '🏭', ticker: 'TSM',
    description: 'TSMC 2025년 4분기 실적 및 연간 가이던스 공개',
    result: {
      surprise: 'BEAT', surpriseLabel: '🟢 어닝 서프라이즈',
      epsActual: '$2.15', epsConsensus: '$1.98',
      revenueActual: '$26.8B', revenueConsensus: '$25.5B',
      growth: '+38.5% YoY',
      guidance: '3나노 및 2나노 첨단 파운드리 가동률 100% 지속, 연간 CapEx $38B 유지',
      marketReaction: 'TSMC +5.2% 급등 및 글로벌 반도체 섹터 전반 랠리',
      summary: '엔비디아, 애플 등 글로벌 빅테크의 AI 가속기 웨이퍼 주문 폭주로 사상 최대 실적 달성.'
    }
  },
  {
    date: '2026-01-22',
    title: '넷플릭스 (NFLX) 4분기 실적발표',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '🎬', ticker: 'NFLX',
    description: '넷플릭스 4분기 글로벌 구독자 수 및 광고 요금제 실적 공개',
    result: {
      surprise: 'BEAT', surpriseLabel: '🟢 어닝 서프라이즈',
      epsActual: '$4.28', epsConsensus: '$4.10',
      revenueActual: '$10.25B', revenueConsensus: '$10.10B',
      growth: '+14.8% YoY',
      guidance: '광고 티어 가입자 비중 50% 돌파 및 라이브 스포츠 중계 확대로 2026년 연간 두 자릿수 성장 유지',
      marketReaction: '익일 +6.5% 급등 신고가 갱신',
      summary: '오징어게임 시즌2 글로벌 흥행 및 계정 공유 유료화 효과 지속으로 실적 호조.'
    }
  },
  {
    date: '2026-01-23',
    title: 'SK하이닉스 4분기 실적발표',
    category: 'EARNINGS', country: 'KR', importance: 'HIGH', emoji: '💾', ticker: '000660',
    description: 'SK하이닉스 2025년 4분기 확정 실적 및 배당 발표',
    result: {
      surprise: 'BEAT', surpriseLabel: '🟢 역대급 어닝 서프라이즈',
      epsActual: '6,450원', epsConsensus: '5,800원',
      revenueActual: '18.4조 원', revenueConsensus: '17.2조 원',
      growth: '+68.2% YoY (영업이익 6.2조 원)',
      guidance: 'HBM3E 12단 엔비디아 독점 공급 물량 확대 및 2026년 캐파 완판',
      marketReaction: 'SK하이닉스 당일 +5.1% 상승, 20만닉스 안착',
      summary: 'HBM 시장 글로벌 점유율 1위 지위를 확고히 하며 분기 최대 영업이익 기록.'
    }
  },
  {
    date: '2026-01-28',
    title: '미국 연방공개시장위원회 (FOMC) 금리결정',
    category: 'FOMC', country: 'US', importance: 'HIGH', emoji: '🏦',
    description: '미 연준 기준금리 결정 및 파월 의장 기자회견',
    result: {
      surprise: 'DECISION', surpriseLabel: '🏛️ 기준금리 동결 (4.25~4.50%)',
      actualValue: '4.25~4.50%', forecastValue: '4.25~4.50%', previousValue: '4.25~4.50%',
      marketImpact: '파월 의장의 "경제 지표 확인 후 점진적 인하 지속" 발언으로 불확실성 해소',
      summary: '고용 안정과 완만한 물가 둔화를 근거로 만장일치 금리 동결 결정.'
    }
  },
  {
    date: '2026-01-29',
    title: '마이크로소프트 (MSFT) & 구글 (GOOGL) 실적발표',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '💻', ticker: 'MSFT',
    description: '빅테크 AI 클라우드(애저/GCP) 성장률 및 자본지출(CapEx) 공개',
    result: {
      surprise: 'BEAT', surpriseLabel: '🟢 어닝 서프라이즈',
      epsActual: '$3.28 (MSFT) / $2.12 (GOOGL)', epsConsensus: '$3.10 / $2.01',
      revenueActual: '$68.9B / $92.4B', revenueConsensus: '$66.8B / $90.1B',
      growth: 'Azure +33% YoY, Google Cloud +31% YoY',
      guidance: 'AI 인프라 수요 지속에 따라 2026년 분기별 AI 데이터센터 투자 확대',
      marketReaction: '클라우드 AI 가속화 안도감으로 나스닥 종합 +2.1% 상승',
      summary: '생성형 AI의 실질적인 기업 B2B 수익화가 가시화되며 시장 기대 상회.'
    }
  },
  {
    date: '2026-01-30',
    title: '애플 (AAPL) & 메타 (META) 실적발표',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '🍏', ticker: 'AAPL',
    description: '아이폰17 AI 업그레이드 사이클 및 메타 AI 광고 매출 실적',
    result: {
      surprise: 'BEAT', surpriseLabel: '🟢 시장 예상 상회',
      epsActual: '$2.40 (AAPL) / $6.02 (META)', epsConsensus: '$2.35 / $5.75',
      revenueActual: '$124.5B / $46.8B', revenueConsensus: '$123.0B / $45.2B',
      growth: '서비스 부문 사상 최대 & 릴스 AI 광고 단가 상승',
      guidance: 'Apple Intelligence 신흥국 확대 및 Meta Llama 4 기반 차세대 서비스 예고',
      marketReaction: '메타 +4.2%, 애플 +2.5% 상승',
      summary: '하드웨어 교체 주기 도래와 디지털 광고 효율 극대화로 견조한 실적 유지.'
    }
  },

  // ── 2월 2026 ──
  {
    date: '2026-02-06',
    title: '미국 1월 고용보고서 (NFP & 실업률)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '👥',
    description: '미국 1월 비농업 고용자수 변동 및 실업률',
    result: {
      surprise: 'RELEASED', surpriseLabel: '🟢 고용 골디락스 확인',
      actualValue: '비농업 +18.5만 / 실업률 4.1%', forecastValue: '+17.0만 / 4.2%', previousValue: '+21.0만 / 4.1%',
      marketImpact: '노동시장 급랭 없는 완만한 둔화로 골디락스 경기 지속 기대감',
      summary: '임금 상승률(3.8% YoY) 둔화와 견조한 신규 일자리 창출이 조화를 이룸.'
    }
  },
  {
    date: '2026-02-13',
    title: '미국 1월 소비자물가지수 (CPI)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '📈',
    description: '미국 1월 소비자물가 공식 집계',
    result: {
      surprise: 'RELEASED', surpriseLabel: '⚪ 시장 부합',
      actualValue: '2.6% (전년비)', forecastValue: '2.6%', previousValue: '2.7%',
      marketImpact: '물가 둔화세 안정 유지, 증시 보합권 안정',
      summary: '에너지 가격 하락과 서비스 물가 안정으로 물가 상방 압력 완화.'
    }
  },
  {
    date: '2026-02-25',
    title: '엔비디아 (NVDA) 4분기 실적발표',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '👑', ticker: 'NVDA',
    description: '엔비디아 2025 회계연도 4분기 확정 실적 및 블랙웰(Blackwell) 가이던스',
    result: {
      surprise: 'BEAT', surpriseLabel: '🟢 초대형 어닝 서프라이즈',
      epsActual: '$0.88', epsConsensus: '$0.82',
      revenueActual: '$38.2B', revenueConsensus: '$36.5B',
      growth: '+94% YoY (데이터센터 매출 $34.5B)',
      guidance: 'Blackwell Ultra 양산 차질 없음, 차기 분기 매출 $42B 가이던스 제시',
      marketReaction: '실적 발표 후 시간외 +6.8% 급등, 시총 4조 달러 돌파',
      summary: '글로벌 빅테크의 AI 인프라 투자 지속으로 데이터센터 수요 폭발.'
    }
  },
  {
    date: '2026-02-27',
    title: '한국은행 금융통화위원회 금리결정',
    category: 'POLICY', country: 'KR', importance: 'HIGH', emoji: '🏛️',
    description: '한국은행 기준금리 결정 통화정책방향 회의',
    result: {
      surprise: 'DECISION', surpriseLabel: '🏛️ 기준금리 25bp 인하 (2.75% ➔ 2.50%)',
      actualValue: '2.50%', forecastValue: '2.50%', previousValue: '2.75%',
      marketImpact: '국내 유동성 개선 기대감으로 코스피 지수 +1.6% 상승 마감',
      summary: '소비 및 내수 진작을 위해 선제적 금리 인하 단행.'
    }
  },

  // ── 3월 2026 ──
  {
    date: '2026-03-12',
    title: '한국 선물옵션 동시 만기일 (네 마녀의 날)',
    category: 'OPTIONS', country: 'KR', importance: 'HIGH', emoji: '🧙‍♀️',
    description: 'KOSPI200 선물/옵션, 개별주식 선물/옵션 동시 만기',
    result: {
      surprise: 'RELEASED', surpriseLabel: '🟢 무난한 롤오버 통과',
      summary: '외국인 대규모 매수 롤오버 진행으로 장마감 동시호가 급변동 없이 순매수 마감.'
    }
  },
  {
    date: '2026-03-18',
    title: '미국 FOMC 금리결정 & 점도표 공개',
    category: 'FOMC', country: 'US', importance: 'HIGH', emoji: '🏦',
    description: '미 연준 점도표(Dot Plot) 및 2026 경제전망(SEP) 발표',
    result: {
      surprise: 'DECISION', surpriseLabel: '🏛️ 25bp 금리 인하 (4.00~4.25%)',
      actualValue: '4.00~4.25%', forecastValue: '4.00~4.25%', previousValue: '4.25~4.50%',
      marketImpact: '2026년 연내 추가 2회 인하 점도표 제시로 글로벌 랠리',
      summary: '물가 2%대 진입 확신에 따라 완화적 통화정책 사이클 재개.'
    }
  },
  {
    date: '2026-03-20',
    title: '미국 네 마녀의 날 (Quad Witching)',
    category: 'OPTIONS', country: 'US', importance: 'HIGH', emoji: '🧙‍♀️',
    description: '미국 주가지수/개별주식 선물·옵션 4종 동시 만기일',
    result: {
      surprise: 'RELEASED', surpriseLabel: '⚪ 만기 유동성 원활 소화',
      summary: '분기말 포트폴리오 리밸런싱과 맞물려 사상 최대 거래대금 기록.'
    }
  },

  // ── 4월 2026 ──
  {
    date: '2026-04-07',
    title: '삼성전자 1분기 잠정 실적발표',
    category: 'EARNINGS', country: 'KR', importance: 'HIGH', emoji: '📱', ticker: '005930',
    description: '삼성전자 2026년 1분기 잠정 실적 공시',
    result: {
      surprise: 'BEAT', surpriseLabel: '🟢 어닝 서프라이즈',
      epsActual: '1,450원', epsConsensus: '1,280원',
      revenueActual: '79.2조 원', revenueConsensus: '76.5조 원',
      growth: '+15.2% YoY (영업이익 9.4조 원)',
      guidance: 'Galaxy S26 AI 온디바이스 기능 호평 및 HBM3E 12단 공급 본격화',
      marketReaction: '삼성전자 +4.2% 상승 마감',
      summary: 'MX(스마트폰) 플래그십 판매 호조 및 반도체 마진 개선으로 시장 전망치 상회.'
    }
  },
  {
    date: '2026-04-16',
    title: 'TSMC 1분기 실적발표',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '🏭', ticker: 'TSM',
    description: 'TSMC 2026년 1분기 실적 및 AI 칩 파운드리 동향',
    result: {
      surprise: 'BEAT', surpriseLabel: '🟢 어닝 서프라이즈',
      epsActual: '$2.30', epsConsensus: '$2.12',
      revenueActual: '$28.4B', revenueConsensus: '$27.0B',
      growth: '+42.0% YoY',
      summary: '2나노 파일럿 라인 수율 80% 돌파 및 글로벌 빅테크 주문 지속.'
    }
  },
  {
    date: '2026-04-23',
    title: '현대차 & 기아 1분기 실적발표',
    category: 'EARNINGS', country: 'KR', importance: 'HIGH', emoji: '🚗', ticker: '005380',
    description: '현대차/기아 1분기 글로벌 판매량 및 HEV/EV 믹스 실적',
    result: {
      surprise: 'BEAT', surpriseLabel: '🟢 어닝 서프라이즈',
      epsActual: '14,200원 (현대차)', epsConsensus: '12,800원',
      revenueActual: '43.5조 원 (현대차) / 28.2조 원 (기아)', revenueConsensus: '41.8조 원 / 27.0조 원',
      growth: '하이브리드(HEV) 고수익 트림 판매 비중 22% 돌파',
      marketReaction: '현대차 +3.9%, 기아 +4.5% 상승',
      summary: '북미 하이브리드 수요 폭증 및 환율 우호 효과로 사상 최대 1분기 영업이익 경신.'
    }
  },
  {
    date: '2026-04-24',
    title: 'SK하이닉스 1분기 실적발표',
    category: 'EARNINGS', country: 'KR', importance: 'HIGH', emoji: '💾', ticker: '000660',
    description: 'SK하이닉스 1분기 확정 실적 공시',
    result: {
      surprise: 'BEAT', surpriseLabel: '🟢 어닝 서프라이즈',
      epsActual: '7,100원', epsConsensus: '6,300원',
      revenueActual: '19.8조 원', revenueConsensus: '18.5조 원',
      growth: '영업이익 7.1조 원 (영업이익률 35.8%)',
      summary: 'HBM3E 12단 출하 비중 70% 돌파로 메모리 반도체 사상 최고 마진 기록.'
    }
  },

  // ── 5월 2026 ──
  {
    date: '2026-05-06',
    title: '미국 연방공개시장위원회 (FOMC) 금리결정',
    category: 'FOMC', country: 'US', importance: 'HIGH', emoji: '🏦',
    description: '미 연준 5월 통화정책 결정 회의',
    result: {
      surprise: 'DECISION', surpriseLabel: '🏛️ 기준금리 동결 (4.00~4.25%)',
      actualValue: '4.00~4.25%', forecastValue: '4.00~4.25%', previousValue: '4.00~4.25%',
      summary: '물가 궤적 재확인을 위해 잠시 숨고르기 동결 결정.'
    }
  },
  {
    date: '2026-05-20',
    title: '엔비디아 (NVDA) 1분기 실적발표',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '👑', ticker: 'NVDA',
    description: '엔비디아 2026 회계연도 1분기 실적발표',
    result: {
      surprise: 'BEAT', surpriseLabel: '🟢 어닝 서프라이즈',
      epsActual: '$0.95', epsConsensus: '$0.88',
      revenueActual: '$43.5B', revenueConsensus: '$41.2B',
      growth: '+67% YoY',
      guidance: '차기 분기 매출 가이던스 $47B 제시',
      marketReaction: '엔비디아 +5.6% 상승 주도',
      summary: '소버린 AI(국가별 자체 AI 인프라) 주문 가세로 강력한 성장세 유지.'
    }
  },
  {
    date: '2026-05-29',
    title: '한국은행 금융통화위원회 금리결정',
    category: 'POLICY', country: 'KR', importance: 'HIGH', emoji: '🏛️',
    description: '한국은행 상반기 통화정책방향 및 수정 경제전망',
    result: {
      surprise: 'DECISION', surpriseLabel: '🏛️ 기준금리 동결 (2.50%)',
      actualValue: '2.50%', forecastValue: '2.50%', previousValue: '2.50%',
      summary: '부동산 PF 및 가계부채 안정세를 점검하며 동결.'
    }
  },

  // ── 6월 2026 ──
  {
    date: '2026-06-11',
    title: '한국 선물옵션 동시 만기일 (네 마녀의 날)',
    category: 'OPTIONS', country: 'KR', importance: 'HIGH', emoji: '🧙‍♀️',
    description: 'KOSPI200 6월물 선물옵션 동시 만기',
    result: {
      surprise: 'RELEASED', surpriseLabel: '🟢 외국인 순매수 마감',
      summary: '선물 베이시스 콘탱고 유지되며 기관 프로그램 순매수 유입.'
    }
  },
  {
    date: '2026-06-17',
    title: '미국 FOMC 금리결정 & 점도표 공개',
    category: 'FOMC', country: 'US', importance: 'HIGH', emoji: '🏦',
    description: '연준 6월 기준금리 결정 및 중간 경제전망',
    result: {
      surprise: 'DECISION', surpriseLabel: '🏛️ 25bp 추가 인하 (3.75~4.00%)',
      actualValue: '3.75~4.00%', forecastValue: '3.75~4.00%', previousValue: '4.00~4.25%',
      summary: '중립금리 수준으로 점진적 수렴을 위한 25bp 인하 단행.'
    }
  },

  // ── 7월 2026 ──
  {
    date: '2026-07-07',
    title: '삼성전자 2분기 잠정 실적발표',
    category: 'EARNINGS', country: 'KR', importance: 'HIGH', emoji: '📱', ticker: '005930',
    description: '삼성전자 2026년 2분기 잠정 실적 공시',
    result: {
      surprise: 'BEAT', surpriseLabel: '🟢 어닝 서프라이즈',
      epsActual: '1,580원', epsConsensus: '1,420원',
      revenueActual: '82.5조 원', revenueConsensus: '79.8조 원',
      growth: '영업이익 11.2조 원 (2년 만에 10조 클럽 복귀)',
      summary: 'D램 ASP 상승과 파운드리 수율 개선으로 분기 영업이익 11조 돌파.'
    }
  },
  {
    date: '2026-07-23',
    title: 'SK하이닉스 2분기 실적발표',
    category: 'EARNINGS', country: 'KR', importance: 'HIGH', emoji: '💾', ticker: '000660',
    description: 'SK하이닉스 2분기 실적 발표',
    result: {
      surprise: 'BEAT', surpriseLabel: '🟢 역대 최대 실적 경신',
      epsActual: '7,800원', epsConsensus: '6,900원',
      revenueActual: '21.5조 원', revenueConsensus: '20.1조 원',
      growth: '영업이익 8.2조 원 (영업이익률 38.1%)',
      summary: 'HBM4 16단 샘플 공급 및 HBM3E 풀가동으로 사상 최대 실적 달성.'
    }
  },
  {
    date: '2026-07-29',
    title: '미국 연방공개시장위원회 (FOMC) 금리결정',
    category: 'FOMC', country: 'US', importance: 'HIGH', emoji: '🏦',
    description: '미 연준 7월 기준금리 결정 회의',
    result: {
      surprise: 'DECISION', surpriseLabel: '🏛️ 기준금리 동결 (3.75~4.00%)',
      actualValue: '3.75~4.00%', forecastValue: '3.75~4.00%', previousValue: '3.75~4.00%',
      summary: '견조한 2분기 GDP 성장률을 확인하며 금리 동결 유지.'
    }
  },

  // ── 8월 2026 (현재 월) ──
  {
    date: '2026-08-07',
    title: '미국 7월 고용보고서 (NFP)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '👥',
    description: '미국 7월 비농업 고용 및 실업률 공식 발표',
    result: {
      surprise: 'RELEASED', surpriseLabel: '🟢 고용 지표 안정',
      actualValue: '비농업 +16.2만 / 실업률 4.1%', forecastValue: '+15.5만 / 4.2%', previousValue: '+17.9만 / 4.1%',
      summary: '인플레이션을 자극하지 않는 적정 수준의 고용 증가세 지속.'
    }
  },
  {
    date: '2026-08-12',
    title: '미국 7월 소비자물가지수 (CPI)',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '📈',
    description: '미국 노동부 7월 소비자물가 발표',
    result: {
      surprise: 'RELEASED', surpriseLabel: '🟢 2.5% 안착 확인',
      actualValue: '2.5% (전년비)', forecastValue: '2.6%', previousValue: '2.6%',
      summary: '헤드라인 CPI가 2.5%로 둔화되며 9월 추가 금리인하 기대 고조.'
    }
  },
  {
    date: '2026-08-19',
    title: 'FOMC 7월 회의 의사록 공개',
    category: 'FOMC', country: 'US', importance: 'MEDIUM', emoji: '🏛️',
    description: '7월 FOMC 회의록 공개 및 위원별 발언 분석',
    result: {
      surprise: 'RELEASED', surpriseLabel: '⚪ 비둘기파적 기조 확인',
      summary: '다수의 위원이 인플레이션 둔화세 지속 시 9월 금리 인하가 적절하다고 평가.'
    }
  },
  {
    date: '2026-08-27',
    title: '엔비디아 (NVDA) 2분기 실적발표',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '👑', ticker: 'NVDA',
    description: '엔비디아 2027 회계연도 2분기(5~7월) 실적 및 차세대 베라 루빈(Vera Rubin) 가이던스 공개',
    result: {
      surprise: 'BEAT', surpriseLabel: '🟢 어닝 서프라이즈 (실적 폭발)',
      epsActual: '$2.22 (Non-GAAP)', epsConsensus: '$2.10',
      revenueActual: '$96.2B (전년비 +106%)', revenueConsensus: '$92.17B',
      growth: '+106% YoY (13분기 연속 사상 최대 매출)',
      guidance: '3분기 매출 $1,080억 달러(±2%) 및 매출총이익률 74% 제시, 차세대 AI 플랫폼 베라 루빈(Vera Rubin) 양산 돌입',
      marketReaction: '실적 발표 직후 시간외 거래 4%대 급등 랠리 지속',
      summary: '데이터센터 매출 $890억 달러(+117% 폭증)로 글로벌 AI 인프라 수요 폭발을 재입증했습니다. 월가 컨센서스를 대폭 상회하는 역대급 어닝 서프라이즈를 달성했습니다.'
    }
  },
  {
    date: '2026-08-28',
    title: '한국은행 금융통화위원회 금리결정',
    category: 'POLICY', country: 'KR', importance: 'HIGH', emoji: '🏛️',
    description: '한국은행 8월 기준금리 결정 회의',
    result: {
      surprise: 'EXPECTED', surpriseLabel: '🔮 발표 예정 (컨센서스)',
      forecastValue: '2.50% (동결 유력)', previousValue: '2.50%',
      summary: '미 연준 9월 인하 확인 후 추가 인하 타이밍 조율 전망.'
    }
  },
  {
    date: '2026-08-28',
    title: '미국 7월 근원 개인소비지출 (PCE) 물가지수',
    category: 'ECONOMIC', country: 'US', importance: 'HIGH', emoji: '🛒',
    description: '연준이 가장 선호하는 핵심 물가 지표',
    result: {
      surprise: 'EXPECTED', surpriseLabel: '🔮 발표 예정 (컨센서스)',
      forecastValue: '2.4% (전년비)', previousValue: '2.5%',
      summary: '근원 PCE가 2.4% 수준으로 하향 안정화될 경우 9월 25bp 인하 100% 반영.'
    }
  },

  // ── 9월 2026 ──
  {
    date: '2026-09-10',
    title: '한국 선물옵션 동시 만기일 (네 마녀의 날)',
    category: 'OPTIONS', country: 'KR', importance: 'HIGH', emoji: '🧙‍♀️',
    description: 'KOSPI200 9월물 선물옵션 만기일'
  },
  {
    date: '2026-09-16',
    title: '미국 FOMC 금리결정 & 점도표 공개',
    category: 'FOMC', country: 'US', importance: 'HIGH', emoji: '🏦',
    description: '미 연준 9월 기준금리 결정 및 경제전망'
  },
  {
    date: '2026-09-18',
    title: '미국 네 마녀의 날 (Quad Witching)',
    category: 'OPTIONS', country: 'US', importance: 'HIGH', emoji: '🧙‍♀️',
    description: '미국 9월 쿼드러플 위칭데이'
  },

  // ── 10월 2026 ──
  {
    date: '2026-10-08',
    title: '삼성전자 3분기 잠정 실적발표',
    category: 'EARNINGS', country: 'KR', importance: 'HIGH', emoji: '📱', ticker: '005930',
    description: '삼성전자 2026년 3분기 잠정 실적 공시'
  },
  {
    date: '2026-10-15',
    title: 'TSMC 3분기 실적발표',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '🏭', ticker: 'TSM',
    description: 'TSMC 3분기 실적'
  },
  {
    date: '2026-10-16',
    title: '한국은행 금융통화위원회 금리결정',
    category: 'POLICY', country: 'KR', importance: 'HIGH', emoji: '🏛️',
    description: '한국은행 10월 금통위'
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
    description: '미 연준 10월 통화정책 회의'
  },
  {
    date: '2026-10-29',
    title: '빅테크 실적 (애플/아마존/메타/MSFT/알파벳)',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '💻',
    description: '미국 M7 빅테크 3분기 어닝스 위크'
  },

  // ── 11월 2026 ──
  {
    date: '2026-11-19',
    title: '엔비디아 (NVDA) 3분기 실적발표',
    category: 'EARNINGS', country: 'US', importance: 'HIGH', emoji: '👑', ticker: 'NVDA',
    description: '엔비디아 2026 회계연도 3분기 실적발표'
  },
  {
    date: '2026-11-27',
    title: '한국은행 금융통화위원회 금리결정',
    category: 'POLICY', country: 'KR', importance: 'HIGH', emoji: '🏛️',
    description: '한국은행 연간 마지막 금통위'
  },

  // ── 12월 2026 ──
  {
    date: '2026-12-10',
    title: '한국 선물옵션 동시 만기일 (네 마녀의 날)',
    category: 'OPTIONS', country: 'KR', importance: 'HIGH', emoji: '🧙‍♀️',
    description: '한국 12월 선물옵션 동시 만기일'
  },
  {
    date: '2026-12-16',
    title: '미국 FOMC 금리결정 & 연간 최종 점도표',
    category: 'FOMC', country: 'US', importance: 'HIGH', emoji: '🏦',
    description: '미 연준 2026년 최종 통화정책 회의'
  },
  {
    date: '2026-12-18',
    title: '미국 네 마녀의 날 (Quad Witching)',
    category: 'OPTIONS', country: 'US', importance: 'HIGH', emoji: '🧙‍♀️',
    description: '미국 12월 쿼드러플 위칭데이'
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

/**
 * 실적 이벤트 결과 수동/자동 실시간 업데이트
 */
export function updateCalendarEventResult(date, key, resultData) {
  const liveResults = loadLiveResults();
  const storageKey = `${date}_${key}`;
  liveResults[storageKey] = resultData;
  saveLiveResults(liveResults);
  return { success: true, key: storageKey, result: resultData };
}
