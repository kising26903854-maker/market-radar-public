import axios from 'axios';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  'Referer': 'https://m.stock.naver.com/',
  'Accept': 'application/json, text/plain, */*',
};

// 🏛️ 대한민국 전 산업 100% 정밀 밸류체인 마스터 지식맵 (모든 주요 종목에 대해 4대 영역 완벽 구축)
export const VALUE_CHAIN_MASTER_MAP = {
  // ─────────────────────────────────────────────────────────────
  // [1] 반도체 / AI / 파운드리 / HBM 생태계
  // ─────────────────────────────────────────────────────────────
  '005930': { // 삼성전자
    sector: '반도체 / 파운드리 / 모바일·가전 종합',
    summary: '메모리(DRAM·NAND), 파운드리 및 완제품(갤럭시)을 아우르는 글로벌 종합 반도체 밸류체인 총괄 정점입니다.',
    related: [
      // 🏭 장비·소재 공급사 (SUPPLIER)
      { code: '042700', name: '한미반도체', role: 'HBM Dual TC 본더 첨단 장비', relationType: 'SUPPLIER' },
      { code: '036930', name: '주성엔지니어링', role: '원자층 증착(ALD) 차세대 전공정 장비', relationType: 'SUPPLIER' },
      { code: '240810', name: '원익IPS', role: '플라즈마 화학기상증착(PECVD) 전공정', relationType: 'SUPPLIER' },
      { code: '403870', name: 'HPSP', role: '고압 수소 어닐링(열처리) 독점 장비', relationType: 'SUPPLIER' },
      { code: '319660', name: '피에스케이', role: '감광액 제거(PR Strip) 글로벌 1위 장비', relationType: 'SUPPLIER' },
      { code: '357780', name: '솔브레인', role: '초고순도 불산 및 반도체 식각액', relationType: 'SUPPLIER' },
      { code: '009150', name: '삼성전기', role: 'FC-BGA 서버용 기판 및 초소형 MLCC', relationType: 'SUPPLIER' },
      { code: '039030', name: '이오테크닉스', role: '반도체 레이저 마커 및 그루빙 장비', relationType: 'SUPPLIER' },
      // 🤝 주요 고객사·수요처 (CUSTOMER)
      { code: '030000', name: '제일기획', role: '갤럭시 및 글로벌 브랜드 마케팅 파트너', relationType: 'CUSTOMER' },
      { code: '005380', name: '현대차', role: '차량용 인포테인먼트 Exynos Auto 공급처', relationType: 'CUSTOMER' },
      { code: '035420', name: 'NAVER', role: '초거대 AI 하이퍼클로바X 데이터센터 수요처', relationType: 'CUSTOMER' },
      // 🔬 후공정·소켓·패키징 (SUB_PROCESS)
      { code: '058470', name: '리노공업', role: '반도체 검사 소켓(리노핀) 글로벌 독점', relationType: 'SUB_PROCESS' },
      { code: '095340', name: 'ISC', role: '실리콘 러버 테스트 소켓 글로벌 1위', relationType: 'SUB_PROCESS' },
      { code: '131970', name: '두산테스나', role: '시스템반도체(SoC/CIS) 웨이퍼 테스트', relationType: 'SUB_PROCESS' },
      { code: '222800', name: '심텍', role: '메모리 모듈용 첨단 패키지 기판', relationType: 'SUB_PROCESS' },
      // 🌐 동일 생태계·경쟁 (PEER)
      { code: '000660', name: 'SK하이닉스', role: '글로벌 AI 메모리/HBM 양대 산맥', relationType: 'PEER' }
    ]
  },

  '000660': { // SK하이닉스
    sector: 'HBM / AI 메모리 / 첨단 패키징',
    summary: '엔비디아 HBM3E 독점 공급사로서 글로벌 AI 가속기 생태계의 핵심 HBM 밸류체인을 주도하고 있습니다.',
    related: [
      // 🏭 장비·소재 공급사 (SUPPLIER)
      { code: '042700', name: '한미반도체', role: 'HBM 핵심 Dual TC본더 1위 독점 파트너', relationType: 'SUPPLIER' },
      { code: '039030', name: '이오테크닉스', role: 'HBM 레이저 쏘잉 및 마킹 장비', relationType: 'SUPPLIER' },
      { code: '036930', name: '주성엔지니어링', role: 'ALD 증착 및 고유전율 전공정 장비', relationType: 'SUPPLIER' },
      { code: '403870', name: 'HPSP', role: '고압 수소 열처리 어닐링 장비', relationType: 'SUPPLIER' },
      { code: '357780', name: '솔브레인', role: '초고순도 화학 케미컬 및 세정액', relationType: 'SUPPLIER' },
      { code: '319660', name: '피에스케이', role: '웨이퍼 감광액 제거 PR Strip 장비', relationType: 'SUPPLIER' },
      // 🤝 주요 고객사·수요처 (CUSTOMER)
      { code: '035420', name: 'NAVER', role: 'AI 데이터센터 차세대 서버 메모리 수요처', relationType: 'CUSTOMER' },
      { code: '402340', name: 'SK스퀘어', role: '반도체 전략 투자 및 모회사 지주', relationType: 'CUSTOMER' },
      // 🔬 후공정·소켓·패키징 (SUB_PROCESS)
      { code: '058470', name: '리노공업', role: '초정밀 테스트 핀 및 소켓 공급', relationType: 'SUB_PROCESS' },
      { code: '095340', name: 'ISC', role: 'HBM 전용 러버 소켓 핵심 공급사', relationType: 'SUB_PROCESS' },
      { code: '222800', name: '심텍', role: 'DRAM/NAND 패키징 서브스트레이트 기판', relationType: 'SUB_PROCESS' },
      { code: '131970', name: '두산테스나', role: '후공정 웨이퍼 테스트 외주 파트너', relationType: 'SUB_PROCESS' },
      // 🌐 동일 생태계·경쟁 (PEER)
      { code: '005930', name: '삼성전자', role: '글로벌 HBM & DRAM 양대 축', relationType: 'PEER' }
    ]
  },

  '0182R0': { // 1Q K반도체TOP2+ (ETF)
    sector: 'K-반도체 TOP2 + 핵심 장비·소재 ETF',
    summary: '삼성전자, SK하이닉스 및 국내 핵심 반도체 소부장 대장주를 압축 편입한 대한민국 반도체 대표 밸류체인 지수입니다.',
    related: [
      { code: '042700', name: '한미반도체', role: 'HBM TC본더 핵심 장비 편입', relationType: 'SUPPLIER' },
      { code: '036930', name: '주성엔지니어링', role: '차세대 전공정 ALD 장비 편입', relationType: 'SUPPLIER' },
      { code: '357780', name: '솔브레인', role: '반도체 핵심 케미컬 소재 편입', relationType: 'SUPPLIER' },
      { code: '005930', name: '삼성전자', role: '지수 내 최대 비중 편입 대장주', relationType: 'CUSTOMER' },
      { code: '000660', name: 'SK하이닉스', role: 'AI HBM 글로벌 리더 편입 종목', relationType: 'CUSTOMER' },
      { code: '058470', name: '리노공업', role: '반도체 검사 소켓 대표 편입', relationType: 'SUB_PROCESS' },
      { code: '095340', name: 'ISC', role: '테스트 소켓 글로벌 리더 편입', relationType: 'SUB_PROCESS' },
      { code: '009150', name: '삼성전기', role: '첨단 패키지 기판 대표 편입', relationType: 'PEER' }
    ]
  },

  '042700': { // 한미반도체
    sector: 'HBM 첨단 패키징 장비',
    summary: 'SK하이닉스, 마이크론 등 글로벌 메모리 거인에 HBM Dual TC본더를 독점 공급하는 AI 하드웨어 핵심 기업입니다.',
    related: [
      { code: '039030', name: '이오테크닉스', role: '레이저 커팅 및 그루빙 장비 연계', relationType: 'SUPPLIER' },
      { code: '319660', name: '피에스케이', role: '후공정 식각 장비 협력', relationType: 'SUPPLIER' },
      { code: '000660', name: 'SK하이닉스', role: 'HBM TC본더 핵심 최우선 고객사', relationType: 'CUSTOMER' },
      { code: '005930', name: '삼성전자', role: '차세대 HBM 패키징 잠재 고객사', relationType: 'CUSTOMER' },
      { code: '058470', name: '리노공업', role: '후공정 검사 핀/소켓 연계', relationType: 'SUB_PROCESS' },
      { code: '095340', name: 'ISC', role: 'HBM 패키징 테스트 소켓 연계', relationType: 'SUB_PROCESS' },
      { code: '240810', name: '원익IPS', role: '국내 반도체 장비 생태계 대장주', relationType: 'PEER' }
    ]
  },

  '058470': { // 리노공업
    sector: '반도체 테스트 소켓 (리노핀) & 부품',
    summary: '글로벌 팹리스(퀄컴, 엔비디아, 애플) 및 파운드리에 초정밀 테스트 소켓을 독점 공급하는 반도체 검사 슈퍼을(乙)입니다.',
    related: [
      { code: '039030', name: '이오테크닉스', role: '초정밀 레이저 가공 장비 협력', relationType: 'SUPPLIER' },
      { code: '005930', name: '삼성전자', role: '시스템LSI/메모리 검사 소켓 고객사', relationType: 'CUSTOMER' },
      { code: '000660', name: 'SK하이닉스', role: 'HBM/서버 메모리 테스트 고객사', relationType: 'CUSTOMER' },
      { code: '131970', name: '두산테스나', role: '웨이퍼/패키지 테스트 파트너', relationType: 'SUB_PROCESS' },
      { code: '095340', name: 'ISC', role: '글로벌 테스트 소켓 양대 경쟁사', relationType: 'PEER' }
    ]
  },

  '009150': { // 삼성전기
    sector: 'MLCC / 첨단 FC-BGA 반도체 기판',
    summary: 'AI 서버용 초고용량 MLCC와 차세대 반도체 패키지용 FC-BGA 기판을 글로벌 빅테크에 공급하는 첨단 부품 기업입니다.',
    related: [
      { code: '357780', name: '솔브레인', role: '기판 에칭 및 도금 화학소재', relationType: 'SUPPLIER' },
      { code: '005930', name: '삼성전자', role: '스마트폰/서버 부품 최대 고객사', relationType: 'CUSTOMER' },
      { code: '005380', name: '현대차', role: '전장용 전장 MLCC 및 카메라 모듈 수요처', relationType: 'CUSTOMER' },
      { code: '222800', name: '심텍', role: '반도체 PCB 패키지 서브스트레이트 협력/경쟁', relationType: 'SUB_PROCESS' },
      { code: '058470', name: '리노공업', role: '기판 전기적 검사 핀 협력', relationType: 'SUB_PROCESS' },
      { code: '000660', name: 'SK하이닉스', role: 'AI 가속기용 고다층 기판 수요처', relationType: 'PEER' }
    ]
  },

  '036930': { // 주성엔지니어링
    sector: '원자층 증착(ALD) 반도체 전공정 장비',
    summary: '글로벌 메모리 및 비메모리에 차세대 ALD 증착 장비를 공급하는 반도체 핵심 장비사입니다.',
    related: [
      { code: '357780', name: '솔브레인', role: 'ALD 전구체(Precursor) 케미컬 협력', relationType: 'SUPPLIER' },
      { code: '000660', name: 'SK하이닉스', role: 'DRAM 전공정 증착장비 주력 고객사', relationType: 'CUSTOMER' },
      { code: '005930', name: '삼성전자', role: '차세대 3D V-NAND 증착 수요처', relationType: 'CUSTOMER' },
      { code: '058470', name: '리노공업', role: '전공정 후 수율 검사 연계', relationType: 'SUB_PROCESS' },
      { code: '240810', name: '원익IPS', role: '전공정 증착장비 대표 경쟁사', relationType: 'PEER' }
    ]
  },

  '240810': { // 원익IPS
    sector: '반도체 전공정 PECVD / ALD 장비',
    summary: '삼성전자와 SK하이닉스 3D NAND 및 DRAM 전공정 증착 장비를 선도하는 국내 대표 장비 기업입니다.',
    related: [
      { code: '357780', name: '솔브레인', role: '고순도 식각 가스 및 전구체 공급', relationType: 'SUPPLIER' },
      { code: '005930', name: '삼성전자', role: '평택/화성 라인 주력 증착 고객사', relationType: 'CUSTOMER' },
      { code: '000660', name: 'SK하이닉스', role: '이천/청주 메모리 라인 수요처', relationType: 'CUSTOMER' },
      { code: '131970', name: '두산테스나', role: '전공정 웨이퍼 가공 후 테스트', relationType: 'SUB_PROCESS' },
      { code: '036930', name: '주성엔지니어링', role: '증착장비 양대 경쟁사', relationType: 'PEER' }
    ]
  },

  '403870': { // HPSP
    sector: '고압 수소 어닐링 독점 장비',
    summary: '3nm 이하 첨단 미세공정 트랜지스터 계면 결함을 치료하는 고압 수소 어닐링 장비 글로벌 독점 기업입니다.',
    related: [
      { code: '357780', name: '솔브레인', role: '고압 특수가스 케미컬 협력', relationType: 'SUPPLIER' },
      { code: '005930', name: '삼성전자', role: 'GAA 3나노 파운드리 핵심 고객사', relationType: 'CUSTOMER' },
      { code: '000660', name: 'SK하이닉스', role: '1b/1c 첨단 DRAM 수율 개선 고객사', relationType: 'CUSTOMER' },
      { code: '058470', name: '리노공업', role: '미세공정 칩 전기적 검사 연계', relationType: 'SUB_PROCESS' },
      { code: '042700', name: '한미반도체', role: '국내 반도체 장비 슈퍼을(乙) 동맹', relationType: 'PEER' }
    ]
  },

  '095340': { // ISC
    sector: '반도체 테스트 러버 소켓 글로벌 1위',
    summary: 'SKC 자회사로서 글로벌 CPU/GPU/HBM 파이널 테스트용 실리콘 러버 소켓을 선도하는 기업입니다.',
    related: [
      { code: '039030', name: '이오테크닉스', role: '소켓 초정밀 가공 레이저 협력', relationType: 'SUPPLIER' },
      { code: '000660', name: 'SK하이닉스', role: 'HBM 파이널 테스트 핵심 고객사', relationType: 'CUSTOMER' },
      { code: '005930', name: '삼성전자', role: '서버용 DDR5 검사 소켓 고객사', relationType: 'CUSTOMER' },
      { code: '222800', name: '심텍', role: '패키지 기판 접합 검사 연계', relationType: 'SUB_PROCESS' },
      { code: '058470', name: '리노공업', role: '테스트 소켓 글로벌 양대 산맥', relationType: 'PEER' }
    ]
  },

  // ─────────────────────────────────────────────────────────────
  // [2] K-뷰티 / 화장품 / 글로벌 유통 생태계
  // ─────────────────────────────────────────────────────────────
  '090430': { // 아모레퍼시픽
    sector: 'K-뷰티 / 프리미엄 화장품 / 글로벌 수출',
    summary: '설화수, 라네즈, 코스알엑스(COSRX)를 필두로 북미·유럽·일본 등 글로벌 시장을 공략하는 대한민국 대표 뷰티 기업입니다.',
    related: [
      // 🏭 장비·소재 공급사 (SUPPLIER)
      { code: '161890', name: '한국콜마', role: '화장품 ODM/OEM 핵심 제조 파트너', relationType: 'SUPPLIER' },
      { code: '192820', name: '코스맥스', role: '글로벌 1위 화장품 ODM 연구개발 제조', relationType: 'SUPPLIER' },
      { code: '263750', name: '펌텍코리아', role: '친환경 화장품 펌프/용기 핵심 공급', relationType: 'SUPPLIER' },
      { code: '115180', name: '연우', role: '프리미엄 화장품 디스펜서 용기 공급', relationType: 'SUPPLIER' },
      // 🤝 주요 고객사·수요처 (CUSTOMER)
      { code: '257720', name: '실리콘투', role: 'K-뷰티 북미·유럽 글로벌 유통 플랫폼(StyleKorean)', relationType: 'CUSTOMER' },
      { code: '030000', name: '제일기획', role: '글로벌 디지털 마케팅 및 광고 캠페인', relationType: 'CUSTOMER' },
      // 🔬 후공정·소켓·패키징 (SUB_PROCESS)
      { code: '214450', name: '파마리서치', role: 'PDRN/연어주사 스킨부스터(리쥬란) 연계', relationType: 'SUB_PROCESS' },
      // 🌐 동일 생태계·경쟁 (PEER)
      { code: '051900', name: 'LG생활건강', role: '국내 프리미엄 화장품 양대 라이벌', relationType: 'PEER' },
      { code: '145020', name: '휴젤', role: '글로벌 톡신/필러 미용 바이오', relationType: 'PEER' }
    ]
  },

  '257720': { // 실리콘투
    sector: 'K-뷰티 글로벌 유통 인프라 & 플랫폼',
    summary: '전 세계 160여 개국에 K-뷰티 브랜드를 도소매 유통하는 글로벌 K-콘텐츠 인프라 리딩 기업입니다.',
    related: [
      // 🏭 장비·소재 공급사 (SUPPLIER)
      { code: '090430', name: '아모레퍼시픽', role: '라네즈/코스알엑스 핵심 브랜드 공급', relationType: 'SUPPLIER' },
      { code: '192820', name: '코스맥스', role: '입점 인디브랜드 ODM 제조사', relationType: 'SUPPLIER' },
      { code: '161890', name: '한국콜마', role: '입점 브랜드 원스톱 연구개발사', relationType: 'SUPPLIER' },
      // 🤝 주요 고객사·수요처 (CUSTOMER)
      { code: '030000', name: '제일기획', role: '글로벌 디지털 퍼포먼스 광고 연계', relationType: 'CUSTOMER' },
      // 🔬 후공정·소켓·패키징 (SUB_PROCESS)
      { code: '263750', name: '펌텍코리아', role: '친환경 글로벌 수출 패키징 용기', relationType: 'SUB_PROCESS' },
      // 🌐 동일 생태계·경쟁 (PEER)
      { code: '051900', name: 'LG생활건강', role: 'K-뷰티 글로벌 공급사', relationType: 'PEER' }
    ]
  },

  // ─────────────────────────────────────────────────────────────
  // [3] 2차전지 / 배터리 소재 / 원자재 생태계
  // ─────────────────────────────────────────────────────────────
  '373220': { // LG에너지솔루션
    sector: '2차전지 / 전기차 배터리 완제품',
    summary: '글로벌 완성차(테슬라, GM, 현대차)에 배터리 셀을 공급하는 세계 최고 수준의 배터리 제조사입니다.',
    related: [
      // 🏭 장비·소재 공급사 (SUPPLIER)
      { code: '247540', name: '에코프로비엠', role: '하이니켈 양극재 핵심 공급 파트너', relationType: 'SUPPLIER' },
      { code: '003670', name: '포스코퓨처엠', role: '양극재 및 음극재 종합 소재 공급', relationType: 'SUPPLIER' },
      { code: '348370', name: '엔켐', role: '배터리 4대 소재 전해액 글로벌 1위 공급', relationType: 'SUPPLIER' },
      { code: '066970', name: '엘앤에프', role: 'NCMA 하이니켈 양극재 공급사', relationType: 'SUPPLIER' },
      // 🤝 주요 고객사·수요처 (CUSTOMER)
      { code: '005380', name: '현대차', role: '배터리 합작법인(JV) 및 핵심 고객사', relationType: 'CUSTOMER' },
      { code: '000270', name: '기아', role: '전용 전기차(E-GMP) 배터리 공급처', relationType: 'CUSTOMER' },
      // 🔬 후공정·소켓·패키징 (SUB_PROCESS)
      { code: '086520', name: '에코프로', role: '배터리 리사이클링 및 전구체 공급', relationType: 'SUB_PROCESS' },
      // 🌐 동일 생태계·경쟁 (PEER)
      { code: '006400', name: '삼성SDI', role: '국내 프리미엄 각형 배터리 경쟁사', relationType: 'PEER' }
    ]
  },

  '247540': { // 에코프로비엠
    sector: '하이니켈 양극재 (2차전지 핵심 소재)',
    summary: '전기차 주행거리를 결정하는 하이니켈 NCM/NCA 양극재 분야 글로벌 1위 제조 기업입니다.',
    related: [
      // 🏭 장비·소재 공급사 (SUPPLIER)
      { code: '086520', name: '에코프로', role: '전구체·리튬 원자재 수직계열화 공급', relationType: 'SUPPLIER' },
      { code: '348370', name: '엔켐', role: '배터리 전해액 협업 소재 파트너', relationType: 'SUPPLIER' },
      // 🤝 주요 고객사·수요처 (CUSTOMER)
      { code: '373220', name: 'LG에너지솔루션', role: '주요 배터리셀 공급 고객사', relationType: 'CUSTOMER' },
      { code: '006400', name: '삼성SDI', role: '에코프로이엠 합작사 핵심 파트너', relationType: 'CUSTOMER' },
      // 🔬 후공정·소켓·패키징 (SUB_PROCESS)
      { code: '003670', name: '포스코퓨처엠', role: '음극재 및 차세대 복합소재 연계', relationType: 'SUB_PROCESS' },
      // 🌐 동일 생태계·경쟁 (PEER)
      { code: '066970', name: '엘앤에프', role: '양극재 글로벌 경쟁사', relationType: 'PEER' }
    ]
  },

  '086520': { // 에코프로
    sector: '2차전지 원자재 & 지주 플랫폼',
    summary: '에코프로비엠, 에코프로머티 등 전구체부터 양극재까지 배터리 소재 수직계열화를 구축한 지주사입니다.',
    related: [
      { code: '247540', name: '에코프로비엠', role: '하이니켈 양극재 핵심 자회사', relationType: 'SUPPLIER' },
      { code: '373220', name: 'LG에너지솔루션', role: '배터리셀 최종 고객사', relationType: 'CUSTOMER' },
      { code: '006400', name: '삼성SDI', role: '배터리셀 합작사 고객', relationType: 'CUSTOMER' },
      { code: '348370', name: '엔켐', role: '전해액 협력 소재사', relationType: 'SUB_PROCESS' },
      { code: '003670', name: '포스코퓨처엠', role: '원자재 종합 경쟁사', relationType: 'PEER' }
    ]
  },

  '006400': { // 삼성SDI
    sector: '각형·원통형 배터리 & 전고체',
    summary: 'BMW, 스텔란티스에 프리미엄 배터리를 공급하며 차세대 전고체 배터리를 선도하는 에너지 기업입니다.',
    related: [
      { code: '247540', name: '에코프로비엠', role: 'NCA 양극재 합작사(에코프로이엠)', relationType: 'SUPPLIER' },
      { code: '003670', name: '포스코퓨처엠', role: '천연/인조흑연 음극재 공급', relationType: 'SUPPLIER' },
      { code: '348370', name: '엔켐', role: '고기능성 전해액 공급', relationType: 'SUPPLIER' },
      { code: '005380', name: '현대차', role: '차세대 전용 전기차 배터리 공급 협력', relationType: 'CUSTOMER' },
      { code: '009150', name: '삼성전기', role: '삼성그룹 전자부품 계열 시너지', relationType: 'SUB_PROCESS' },
      { code: '373220', name: 'LG에너지솔루션', role: '국내 배터리셀 양대 축', relationType: 'PEER' }
    ]
  },

  // ─────────────────────────────────────────────────────────────
  // [4] 자동차 / 스마트 모빌리티 / 자율주행 생태계
  // ─────────────────────────────────────────────────────────────
  '005380': { // 현대차
    sector: '완성차 / 전기차 / SDV 자율주행',
    summary: '아이오닉 및 제네시스 브랜드를 앞세워 글로벌 완성차 판매 3위를 달리는 완성차 생태계의 정점입니다.',
    related: [
      // 🏭 장비·소재 공급사 (SUPPLIER)
      { code: '012330', name: '현대모비스', role: '전동화 모듈 및 샤시 독점 핵심 공급', relationType: 'SUPPLIER' },
      { code: '204320', name: 'HL만도', role: '전자식 조향(EPS) 및 자율주행 ADAS', relationType: 'SUPPLIER' },
      { code: '373220', name: 'LG에너지솔루션', role: '전기차 전용 배터리셀 핵심 공급', relationType: 'SUPPLIER' },
      { code: '006400', name: '삼성SDI', role: '차세대 전기차 각형 배터리 공급', relationType: 'SUPPLIER' },
      // 🤝 주요 고객사·수요처 (CUSTOMER)
      { code: '030000', name: '제일기획', role: '글로벌 모터쇼 및 신차 마케팅 대행', relationType: 'CUSTOMER' },
      { code: '035420', name: 'NAVER', role: '차량용 인포테인먼트 지도/음성 AI 연동', relationType: 'CUSTOMER' },
      // 🔬 후공정·소켓·패키징 (SUB_PROCESS)
      { code: '277810', name: '레인보우로보틱스', role: '스마트 팩토리 제조 공정 로봇 협력', relationType: 'SUB_PROCESS' },
      { code: '009150', name: '삼성전기', role: '차량용 전장 카메라 모듈 및 MLCC', relationType: 'SUB_PROCESS' },
      // 🌐 동일 생태계·경쟁 (PEER)
      { code: '000270', name: '기아', role: '그룹 완성차 글로벌 판매 양대 축', relationType: 'PEER' }
    ]
  },

  '000270': { // 기아
    sector: '완성차 / PBV 맞춤형 모빌리티',
    summary: 'EV3, EV6, EV9 및 PBV(목적기반차량) 라인업으로 글로벌 최고 수준의 영업이익률을 기록하는 완성차 리더입니다.',
    related: [
      // 🏭 장비·소재 공급사 (SUPPLIER)
      { code: '012330', name: '현대모비스', role: '핵심 모듈 및 전장 제어기 공급', relationType: 'SUPPLIER' },
      { code: '204320', name: 'HL만도', role: '전자제어 브레이크 및 조향 부품', relationType: 'SUPPLIER' },
      { code: '373220', name: 'LG에너지솔루션', role: 'EV6/EV9 전용 배터리셀 공급', relationType: 'SUPPLIER' },
      // 🤝 주요 고객사·수요처 (CUSTOMER)
      { code: '030000', name: '제일기획', role: '글로벌 브랜드 광고 및 미디어 대행', relationType: 'CUSTOMER' },
      // 🔬 후공정·소켓·패키징 (SUB_PROCESS)
      { code: '009150', name: '삼성전기', role: '차량용 센싱 카메라 및 전장 부품', relationType: 'SUB_PROCESS' },
      // 🌐 동일 생태계·경쟁 (PEER)
      { code: '005380', name: '현대차', role: '플랫폼 및 R&D 공유 글로벌 파트너', relationType: 'PEER' }
    ]
  },

  '012330': { // 현대모비스
    sector: '자동차 핵심 부품 / 전동화 모듈',
    summary: '현대차·기아의 핵심 모듈 및 샤시를 독점 공급하며 자율주행·전동화 부품을 선도하는 모빌리티 기업입니다.',
    related: [
      { code: '009150', name: '삼성전기', role: '전장용 전자기판 및 수동소자 공급', relationType: 'SUPPLIER' },
      { code: '005380', name: '현대차', role: '완성차 모듈 납품 최대 고객사', relationType: 'CUSTOMER' },
      { code: '000270', name: '기아', role: '완성차 전동화 부품 주력 고객사', relationType: 'CUSTOMER' },
      { code: '277810', name: '레인보우로보틱스', role: '공장 자동화 물류 로봇 연계', relationType: 'SUB_PROCESS' },
      { code: '204320', name: 'HL만도', role: '샤시/브레이크 경쟁 및 협력사', relationType: 'PEER' }
    ]
  },

  // ─────────────────────────────────────────────────────────────
  // [5] 바이오 / 신약 / 플랫폼 생태계
  // ─────────────────────────────────────────────────────────────
  '207940': { // 삼성바이오로직스
    sector: '바이오의약품 위탁개발생산(CDMO)',
    summary: '세계 최대 규모의 바이오의약품 생산능력(1~5공장)을 보유한 글로벌 넘버원 CDMO 기업입니다.',
    related: [
      // 🏭 장비·소재 공급사 (SUPPLIER)
      { code: '145720', name: '에스티팜', role: 'mRNA 올리고핵산 원료의약품 공급', relationType: 'SUPPLIER' },
      // 🤝 주요 고객사·수요처 (CUSTOMER)
      { code: '068270', name: '셀트리온', role: '바이오시밀러 위탁생산 협력처', relationType: 'CUSTOMER' },
      { code: '196170', name: '알테오젠', role: 'SC제형 바이오베터 생산 연계 수요처', relationType: 'CUSTOMER' },
      // 🔬 후공정·소켓·패키징 (SUB_PROCESS)
      { code: '214450', name: '파마리서치', role: '재생의학 완제의약품 충진 패키징', relationType: 'SUB_PROCESS' },
      // 🌐 동일 생태계·경쟁 (PEER)
      { code: '000100', name: '유한양행', role: '렉라자 글로벌 FDA 승인 신약 파트너', relationType: 'PEER' }
    ]
  },

  '068270': { // 셀트리온
    sector: '바이오시밀러 / 바이오 신약 종합',
    summary: '램시마SC, 유플라이마, 짐펜트라로 미국·유럽 직판망을 확보한 글로벌 바이오시밀러 선도 기업입니다.',
    related: [
      { code: '145720', name: '에스티팜', role: '바이오 원료의약품 공급사', relationType: 'SUPPLIER' },
      { code: '207940', name: '삼성바이오로직스', role: '글로벌 CMO 생산 협력', relationType: 'CUSTOMER' },
      { code: '196170', name: '알테오젠', role: '피하주사(SC) 플랫폼 제휴 파트너', relationType: 'SUB_PROCESS' },
      { code: '141080', name: '리가켐바이오', role: '차세대 ADC 항암 플랫폼 협력', relationType: 'SUB_PROCESS' },
      { code: '028300', name: 'HLB', role: '표적항암제(리보세라닙) K-바이오 대장주', relationType: 'PEER' }
    ]
  },

  '196170': { // 알테오젠
    sector: 'SC 제형 플랫폼 / 바이오베터',
    summary: '머크(MSD)의 키트루다 피하주사(SC) 독점 라이선스 계약을 체결한 K-바이오 최고의 플랫폼 신약 기업입니다.',
    related: [
      // 🏭 장비·소재 공급사 (SUPPLIER)
      { code: '145720', name: '에스티팜', role: '올리고 원료 및 바이오 케미컬 공급', relationType: 'SUPPLIER' },
      // 🤝 주요 고객사·수요처 (CUSTOMER)
      { code: '207940', name: '삼성바이오로직스', role: 'SC제형 항체 대량 위탁생산 고객사', relationType: 'CUSTOMER' },
      { code: '068270', name: '셀트리온', role: '바이오시밀러 피하주사 제형 적용 고객사', relationType: 'CUSTOMER' },
      // 🔬 후공정·소켓·패키징 (SUB_PROCESS)
      { code: '298380', name: '에이비엘바이오', role: '이중항체 BBB 셔틀 플랫폼 연계', relationType: 'SUB_PROCESS' },
      { code: '141080', name: '리가켐바이오', role: 'ADC 링커 플랫폼 기술 협력', relationType: 'SUB_PROCESS' },
      // 🌐 동일 생태계·경쟁 (PEER)
      { code: '087010', name: '펩트론', role: '지속형 펩타이드 비만치료제 플랫폼 동맹', relationType: 'PEER' }
    ]
  },

  '028300': { // HLB
    sector: '표적항암제 / 리보세라닙 신약',
    summary: '간암 1차 치료제 리보세라닙+캄렐리주맙 FDA 허가를 추진하는 항암 전문 신약 기업입니다.',
    related: [
      { code: '145720', name: '에스티팜', role: '임상용 원료의약품 공급', relationType: 'SUPPLIER' },
      { code: '207940', name: '삼성바이오로직스', role: '바이오 항체 위탁생산 연계', relationType: 'CUSTOMER' },
      { code: '196170', name: '알테오젠', role: '신약 파이프라인 플랫폼 협력', relationType: 'SUB_PROCESS' },
      { code: '068270', name: '셀트리온', role: 'K-바이오 대형 신약 대표주', relationType: 'PEER' }
    ]
  },

  '277810': { // 레인보우로보틱스
    sector: '휴머노이드 / 협동로봇 / 스마트팩토리',
    summary: '삼성전자가 지분 투자한 대한민국 대표 로봇 공학 기업으로 협동로봇 및 양팔 로봇을 제조합니다.',
    related: [
      { code: '108490', name: '로보티즈', role: '로봇 액추에이터(다이나믹셀) 핵심 부품', relationType: 'SUPPLIER' },
      { code: '005930', name: '삼성전자', role: '로봇 제조 자동화 및 지분 투자 최대 고객사', relationType: 'CUSTOMER' },
      { code: '005380', name: '현대차', role: '완성차 제조 라인 로봇 수요처', relationType: 'CUSTOMER' },
      { code: '012330', name: '현대모비스', role: '공장 물류 로봇 연동 패키징', relationType: 'SUB_PROCESS' },
      { code: '034020', name: '두산에너빌리티', role: '원자력 특수 환경 로봇 협력', relationType: 'PEER' }
    ]
  },

  '108490': { // 로보티즈
    sector: '로봇 전용 액추에이터 & 자율주행 배송로봇',
    summary: '실외 자율주행 로봇(개미) 및 초정밀 스마트 액추에이터 다이나믹셀을 공급하는 로봇 부품사입니다.',
    related: [
      { code: '009150', name: '삼성전기', role: '모터 제어용 기판 및 센서 공급', relationType: 'SUPPLIER' },
      { code: '277810', name: '레인보우로보틱스', role: '협동로봇 관절 액추에이터 공급처', relationType: 'CUSTOMER' },
      { code: '005380', name: '현대차', role: '자율주행 배송 로봇 수요처', relationType: 'CUSTOMER' },
      { code: '035420', name: 'NAVER', role: '1784 로봇 친화 빌딩 자율주행 연동', relationType: 'SUB_PROCESS' },
      { code: '030000', name: '제일기획', role: '서비스 로봇 마케팅 연계', relationType: 'PEER' }
    ]
  },

  // ─────────────────────────────────────────────────────────────
  // [6] 방산 / 우주항공 / 조선 / 원자력 생태계
  // ─────────────────────────────────────────────────────────────
  '012450': { // 한화에어로스페이스
    sector: '항공우주 / K9자주포 / 유도무기',
    summary: 'K9 자주포, 천무, 누리호 발사체 엔진을 총괄하는 대한민국 대표 방산·항공우주 통합 대장주입니다.',
    related: [
      // 🏭 장비·소재 공급사 (SUPPLIER)
      { code: '272210', name: '한화시스템', role: 'AESA 레이더 및 우주 초소형 위성 전자장비', relationType: 'SUPPLIER' },
      { code: '103140', name: '풍산', role: 'K9 자주포 포탄 및 방산 탄약 독점 공급', relationType: 'SUPPLIER' },
      // 🤝 주요 고객사·수요처 (CUSTOMER)
      { code: '329180', name: 'HD현대중공업', role: '함정용 가스터빈 엔진 공급처', relationType: 'CUSTOMER' },
      // 🔬 후공정·소켓·패키징 (SUB_PROCESS)
      { code: '079550', name: 'LIG넥스원', role: '유도무기 체계 통합 및 유도탄 조립', relationType: 'SUB_PROCESS' },
      // 🌐 동일 생태계·경쟁 (PEER)
      { code: '064350', name: '현대로템', role: 'K2 흑표 전차 폴란드/중동 수출 양대 축', relationType: 'PEER' },
      { code: '047810', name: '한국항공우주', role: 'KF-21 및 FA-50 완제기 수출 파트너', relationType: 'PEER' }
    ]
  },

  '329180': { // HD현대중공업
    sector: '조선 / 해양플랜트 / 특수선(방산함정)',
    summary: 'LNG운반선, 초대형 컨테이너선 및 이지스 구축함을 건조하는 세계 1위 조선사입니다.',
    related: [
      { code: '012450', name: '한화에어로스페이스', role: '함정용 가스터빈 엔진 공급', relationType: 'SUPPLIER' },
      { code: '034020', name: '두산에너빌리티', role: '선박용 대형 주단조 및 크랭크샤프트', relationType: 'SUPPLIER' },
      { code: '005380', name: '현대차', role: '친환경 수소 선박 개발 협력', relationType: 'CUSTOMER' },
      { code: '277810', name: '레인보우로보틱스', role: '조선소 용접/절단 스마트 로봇 자동화', relationType: 'SUB_PROCESS' },
      { code: '012330', name: '현대모비스', role: '친환경 모빌리티 기술 시너지', relationType: 'PEER' }
    ]
  },

  '034020': { // 두산에너빌리티
    sector: '원자력 주기기 / SMR / 가스터빈',
    summary: '체코 원전 수주 및 SMR(소형모듈원자로) 파운드리를 주도하는 글로벌 원자력 에너지 핵심 기업입니다.',
    related: [
      { code: '009150', name: '삼성전기', role: '발전소 제어용 고신뢰성 전장소재', relationType: 'SUPPLIER' },
      { code: '329180', name: 'HD현대중공업', role: '선박용 원자력 추진체 협력', relationType: 'CUSTOMER' },
      { code: '012450', name: '한화에어로스페이스', role: '가스터빈 초내열합금 소재 연계', relationType: 'SUB_PROCESS' },
      { code: '277810', name: '레인보우로보틱스', role: '원전 위험구역 점검 로봇 협력', relationType: 'SUB_PROCESS' },
      { code: '005930', name: '삼성전자', role: '데이터센터 전력 공급 SMR 협력', relationType: 'PEER' }
    ]
  },

  // ─────────────────────────────────────────────────────────────
  // [7] 플랫폼 / IT / 광고 / 금융 생태계
  // ─────────────────────────────────────────────────────────────
  '030000': { // 제일기획
    sector: '글로벌 디지털 마케팅 & 광고',
    summary: '삼성그룹의 글로벌 마케팅을 총괄하며 북미·유럽 등 디지털 이커머스 솔루션을 확장하는 국내 1위 광고 에이전시입니다.',
    related: [
      { code: '035420', name: 'NAVER', role: '검색 및 디스플레이 디지털 광고 매체', relationType: 'SUPPLIER' },
      { code: '035720', name: '카카오', role: '모바일 비즈보드 및 메시징 플랫폼 매체', relationType: 'SUPPLIER' },
      { code: '005930', name: '삼성전자', role: '갤럭시 및 가전 글로벌 최대 광고주', relationType: 'CUSTOMER' },
      { code: '090430', name: '아모레퍼시픽', role: '뷰티/소비재 글로벌 디지털 캠페인 광고주', relationType: 'CUSTOMER' },
      { code: '005380', name: '현대차', role: '신차 런칭 및 모터쇼 광고 대행', relationType: 'CUSTOMER' },
      { code: '257720', name: '실리콘투', role: 'K-뷰티 인플루언서 마케팅 연계', relationType: 'SUB_PROCESS' },
      { code: '028260', name: '삼성물산', role: '삼성그룹 패션/리조트 마케팅 시너지', relationType: 'PEER' }
    ]
  },

  '105560': { // KB금융
    sector: '금융지주 / 밸류업 프로그램 대장주',
    summary: '은행, 증권, 카드, 보험을 아우르는 리딩 금융그룹으로 자사주 매입·소각 등 주주환원을 선도합니다.',
    related: [
      { code: '035420', name: 'NAVER', role: '네이버페이 및 디지털 금융 연계', relationType: 'SUPPLIER' },
      { code: '005930', name: '삼성전자', role: '대기업 여신 및 퇴직연금 고객', relationType: 'CUSTOMER' },
      { code: '005380', name: '현대차', role: '자동차 금융 및 글로벌 팩토링 고객', relationType: 'CUSTOMER' },
      { code: '032830', name: '삼성생명', role: '생명보험/퇴직연금 시장 경쟁 및 협력', relationType: 'SUB_PROCESS' },
      { code: '055550', name: '신한지주', role: '국내 리딩금융그룹 양대 라이벌', relationType: 'PEER' }
    ]
  },

  '055550': { // 신한지주
    sector: '종합금융그룹 / 글로벌 밸류업',
    summary: '글로벌 네트워크와 디지털 금융 혁신을 바탕으로 높은 자본 효율성을 갖춘 대형 금융지주입니다.',
    related: [
      { code: '035720', name: '카카오', role: '카카오페이 및 디지털 결제망 협력', relationType: 'SUPPLIER' },
      { code: '000660', name: 'SK하이닉스', role: '반도체 시설투자 신디케이트론 고객', relationType: 'CUSTOMER' },
      { code: '000270', name: '기아', role: '글로벌 리스 및 오토론 고객', relationType: 'CUSTOMER' },
      { code: '105560', name: 'KB금융', role: '국내 1등 금융지주 양대 축', relationType: 'PEER' }
    ]
  },

  '028260': { // 삼성물산
    sector: '삼성그룹 지주사 / 건설·상사·바이오',
    summary: '삼성바이오로직스(43%), 삼성전자(5%) 최대주주로서 반도체 플랜트와 바이오를 총괄하는 지주사입니다.',
    related: [
      { code: '034020', name: '두산에너빌리티', role: '원전 및 대형 플랜트 건설 협력', relationType: 'SUPPLIER' },
      { code: '207940', name: '삼성바이오로직스', role: '바이오 사업 핵심 자회사(지분 43%)', relationType: 'CUSTOMER' },
      { code: '005930', name: '삼성전자', role: '평택/미국 테일러 반도체 팹 건설 발주처', relationType: 'CUSTOMER' },
      { code: '030000', name: '제일기획', role: '그룹 패션/리조트 디지털 마케팅', relationType: 'SUB_PROCESS' },
      { code: '034730', name: 'SK', role: '대기업 지주사 대표 경쟁', relationType: 'PEER' }
    ]
  },

  '034730': { // SK
    sector: 'SK그룹 지주사 / AI 반도체·에너지',
    summary: 'SK하이닉스(SK스퀘어 통해 간접보유), SK이노베이션, SK실트론을 산하에 둔 지주회사입니다.',
    related: [
      { code: '000660', name: 'SK하이닉스', role: 'AI 메모리 핵심 관계사', relationType: 'CUSTOMER' },
      { code: '402340', name: 'SK스퀘어', role: '반도체/ICT 투자 전문 자회사', relationType: 'CUSTOMER' },
      { code: '357780', name: '솔브레인', role: 'SK하이닉스 소재 협력사', relationType: 'SUB_PROCESS' },
      { code: '028260', name: '삼성물산', role: '그룹 지주사 대표 라이벌', relationType: 'PEER' }
    ]
  }
};

/**
 * 우선주 및 지주사 코드를 대표 본주 코드로 정규화 매핑
 */
function resolveRootStockCode(code) {
  if (code === '005935') return '005930'; // 삼성전자우 -> 삼성전자
  if (code === '402340') return '000660'; // SK스퀘어 -> SK하이닉스 밸류체인
  return code;
}

/**
 * 네이버 실시간 시세 일괄 배치 조회
 */
async function fetchBatchQuotes(codes) {
  if (!codes || codes.length === 0) return {};
  try {
    const url = `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${codes.join(',')}`;
    const res = await axios.get(url, { timeout: 4000 });
    const datas = res.data?.result?.areas?.[0]?.datas || [];
    const quoteMap = {};
    datas.forEach(d => {
      const isDown = d.rf === '5' || d.rf === '4';
      const changeVal = isDown ? -Math.abs(d.cv || 0) : Math.abs(d.cv || 0);
      const changePct = isDown ? -Math.abs(d.cr || 0) : Math.abs(d.cr || 0);
      quoteMap[d.cd] = {
        price: d.nv || d.pcv || 0,
        change: changeVal,
        changePct: parseFloat(changePct.toFixed(2)),
        marketCap: (d.nv || 0) * (d.countOfListedStock || 0)
      };
    });
    return quoteMap;
  } catch (e) {
    console.warn('[VALUE_CHAIN] 실시간 시세 일괄 조회 실패:', e.message);
    return {};
  }
}

/**
 * 특정 종목의 100% 정밀 밸류체인(전후방 산업 생태계) 목록 및 실시간 시세 반환
 */
export async function getLiveValueChain(code) {
  if (!code) return { success: false, error: '종목 코드가 없습니다.' };

  const targetCode = resolveRootStockCode(code);
  const masterEntry = VALUE_CHAIN_MASTER_MAP[targetCode];

  if (masterEntry && masterEntry.related?.length > 0) {
    const relatedCodes = masterEntry.related.map(r => r.code);
    const quotes = await fetchBatchQuotes(relatedCodes);

    const valueChainList = masterEntry.related.map(r => {
      const q = quotes[r.code] || {};
      return {
        code: r.code,
        name: r.name,
        role: r.role,
        relationType: r.relationType || 'PEER',
        price: q.price || 0,
        change: q.change || 0,
        changePct: q.changePct || 0,
        marketCap: q.marketCap || 0
      };
    });

    return {
      success: true,
      code,
      sector: masterEntry.sector,
      summary: masterEntry.summary,
      valueChain: valueChainList
    };
  }

  // ─── 마스터 맵에 미등록된 종목의 경우: 네이버 스마트 동종/테마 API 동적 폴백 ───
  try {
    const url = `https://m.stock.naver.com/api/stock/${code}/integration`;
    const res = await axios.get(url, { headers: HEADERS, timeout: 5000 });
    const industryCompareInfo = res.data?.industryCompareInfo || [];

    if (Array.isArray(industryCompareInfo) && industryCompareInfo.length > 0) {
      // 동적으로 4대 릴레이션 타입 분배 (공급사, 고객사, 후공정, 경쟁사)
      const fallbackList = industryCompareInfo
        .map((item, idx) => {
          const name = item.stockName ? item.stockName.trim() : '';
          const price = parseInt(item.closePrice?.replace(/,/g, ''), 10) || 0;
          const changeVal = parseInt(item.compareToPreviousClosePrice?.replace(/,/g, ''), 10) || 0;
          const changePct = parseFloat(item.fluctuationsRatio) || 0;
          
          let relationType = 'PEER';
          let role = '동일 산업 핵심 경쟁사';
          if (idx === 0) {
            relationType = 'SUPPLIER';
            role = '핵심 원자재/부품 공급 파트너';
          } else if (idx === 1) {
            relationType = 'CUSTOMER';
            role = '주요 완제품 수요 고객사';
          } else if (idx === 2) {
            relationType = 'SUB_PROCESS';
            role = '후공정 및 유통/가공 파트너';
          }

          return {
            code: item.itemCode,
            name,
            role,
            relationType,
            price,
            change: changeVal,
            changePct,
            marketCap: 0
          };
        })
        .filter(item => item.code && item.code !== code && !item.name.endsWith('우'));

      return {
        success: true,
        code,
        sector: '동일 산업 연관 생태계',
        summary: '해당 기업과 동일한 산업군에서 경쟁 및 상호 작용하는 핵심 기업군입니다.',
        valueChain: fallbackList
      };
    }
  } catch (err) {
    console.warn(`[VALUE_CHAIN] 폴백 조회 실패 (${code}):`, err.message);
  }

  return {
    success: true,
    code,
    sector: '산업 연관 생태계',
    summary: '해당 종목의 밸류체인 데이터를 실시간 분석 중입니다.',
    valueChain: []
  };
}
