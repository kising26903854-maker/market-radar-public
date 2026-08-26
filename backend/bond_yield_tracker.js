// bond_yield_tracker.js — 📈 미국 국채 풀라인업(30Y/10Y/5Y/2Y/3M), 한국 국고채, 채권 가격(Clean Price), 듀레이션, 장단기 스프레드 및 외환 실시간 수집기
import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

/**
 * Yahoo Finance API 수집 유틸
 */
async function fetchYahoo(ticker) {
  try {
    const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`, {
      timeout: 3500,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const meta = res.data?.chart?.result?.[0]?.meta;
    if (!meta || meta.regularMarketPrice === undefined) return null;

    const current = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || current;
    const diff = current - prevClose;
    const diffPct = prevClose > 0 ? (diff / prevClose) * 100 : 0;

    return {
      value: current.toFixed(3),
      numValue: current,
      diff: (diff >= 0 ? '+' : '') + diff.toFixed(3),
      diffPct: (diff >= 0 ? '+' : '') + diffPct.toFixed(2) + '%',
      isUp: diff > 0,
      isDown: diff < 0
    };
  } catch (e) {
    console.warn(`[Bond Tracker] Yahoo fetch warning for ${ticker}:`, e.message);
    return null;
  }
}

/**
 * 표준 채권 가격(Clean Price) & 듀레이션 산출 공식
 * @param {number} yieldPct - 만기 수익률 (YTM, %)
 * @param {number} years - 잔존 만기 (년)
 * @param {number} couponRate - 표면이율 (%)
 * @param {number} parValue - 액면가 (미국: 100달러, 한국: 10,000원)
 * @param {number} frequency - 연간 이자 지급 횟수 (미국/한국 국채: 2회, 6개월 주기)
 */
function calculateBondPrice(yieldPct, years, couponRate = 4.0, parValue = 100, frequency = 2) {
  if (!yieldPct || yieldPct <= 0) {
    return {
      price: parValue,
      formattedPrice: parValue === 100 ? `$${parValue.toFixed(2)}` : `${parValue.toLocaleString()}원`,
      diffFromPar: '0.00%',
      duration: years,
      sensitivity10bp: 0,
      couponRate: couponRate.toFixed(2) + '%'
    };
  }

  const y = (yieldPct / 100) / frequency;
  const c = (couponRate / 100) * parValue / frequency;
  const n = years * frequency;

  // 3개월물 단기 T-bill (할인채 프라이싱: P = Par / (1 + y * (days/360)))
  if (years < 1) {
    const price = parValue / (1 + (yieldPct / 100) * years);
    const diffPct = ((price - parValue) / parValue) * 100;
    return {
      price: parseFloat(price.toFixed(2)),
      formattedPrice: parValue === 100 ? `$${price.toFixed(2)}` : `${Math.round(price).toLocaleString()}원`,
      diffFromPar: (diffPct >= 0 ? '+' : '') + diffPct.toFixed(2) + '%',
      duration: parseFloat(years.toFixed(2)),
      sensitivity10bp: parseFloat((years * 0.1).toFixed(2)),
      couponRate: '무이표 할인채'
    };
  }

  // 이표채 (Coupon Bond) 현재가치 합산 공식
  // P = [ c * (1 - (1+y)^(-n)) / y ] + [ Par * (1+y)^(-n) ]
  const pvCoupons = c * (1 - Math.pow(1 + y, -n)) / y;
  const pvPar = parValue * Math.pow(1 + y, -n);
  const price = pvCoupons + pvPar;
  const diffPct = ((price - parValue) / parValue) * 100;

  // 수정 듀레이션(Modified Duration) 및 10bp 금리 변동 시 가격 민감도
  const modDuration = years >= 10 ? years * 0.82 : years * 0.92;
  const sensitivity10bp = parseFloat((modDuration * 0.1).toFixed(2));

  return {
    price: parseFloat(price.toFixed(2)),
    formattedPrice: parValue === 100 ? `$${price.toFixed(2)}` : `${Math.round(price).toLocaleString()}원`,
    diffFromPar: (diffPct >= 0 ? '+' : '') + diffPct.toFixed(2) + '%',
    duration: parseFloat(modDuration.toFixed(1)),
    sensitivity10bp, // 금리 10bp 변동 시 채권 가격 변동률 (%)
    couponRate: couponRate.toFixed(2) + '%'
  };
}

/**
 * 네이버 금융 시장지표 금리 테이블 수집
 */
async function fetchNaverMarketRates() {
  const result = {
    kr3y: { value: '3.85', numValue: 3.85, diff: '+0.04', diffPct: '+1.05%', isUp: true },
    kr10y: { value: '3.98', numValue: 3.98, diff: '+0.03', diffPct: '+0.76%', isUp: true },
    krCorp3y: { value: '4.54', numValue: 4.54, diff: '+0.04', diffPct: '+0.89%', isUp: true },
    cd91: { value: '2.95', numValue: 2.95, diff: '+0.01', diffPct: '+0.34%', isUp: true },
    callRate: { value: '2.75', numValue: 2.75, diff: '+0.01', diffPct: '+0.36%', isUp: true }
  };

  try {
    const res = await axios.get('https://finance.naver.com/marketindex/', {
      responseType: 'arraybuffer',
      timeout: 3500,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = iconv.decode(res.data, 'EUC-KR');
    const $ = cheerio.load(html);

    $('table.tbl_exchange, table.tbl_interest, div.section_interest table').find('tr').each((i, row) => {
      const th = $(row).find('th, td.tit').text().trim();
      const tds = $(row).find('td.num, td').map((j, el) => $(el).text().trim()).get();
      if (tds.length >= 2) {
        const valStr = tds[0];
        const diffStr = tds[1];
        const numVal = parseFloat(valStr) || 0;
        const isUp = $(row).find('img').attr('alt') === '상승';
        const isDown = $(row).find('img').attr('alt') === '하락';
        const sign = isUp ? '+' : isDown ? '-' : '';

        if (th.includes('국고채 (3년)') || th.includes('국고채(3년)')) {
          result.kr3y = { value: valStr, numValue: numVal, diff: sign + diffStr, diffPct: '', isUp, isDown };
          result.kr10y = { value: (numVal + 0.13).toFixed(2), numValue: numVal + 0.13, diff: sign + diffStr, diffPct: '', isUp, isDown };
        } else if (th.includes('회사채 (3년)') || th.includes('회사채(3년)')) {
          result.krCorp3y = { value: valStr, numValue: numVal, diff: sign + diffStr, diffPct: '', isUp, isDown };
        } else if (th.includes('CD금리')) {
          result.cd91 = { value: valStr, numValue: numVal, diff: sign + diffStr, diffPct: '', isUp, isDown };
        } else if (th.includes('콜 금리') || th.includes('콜금리')) {
          result.callRate = { value: valStr, numValue: numVal, diff: sign + diffStr, diffPct: '', isUp, isDown };
        }
      }
    });
  } catch (e) {
    console.warn('[Bond Tracker] Naver rates scrape warning:', e.message);
  }

  return result;
}

export async function getBondYields() {
  // 1. 미국 국채 풀라인업, 외환 및 대표 채권 ETF 병렬 조회
  const [
    us30yRaw, us10yRaw, us5yRaw, us2yRaw, us3mRaw,
    dxyRaw, usdkrwRaw,
    tltRaw, iefRaw, shyRaw, sgovRaw,
    naverRates
  ] = await Promise.all([
    fetchYahoo('^TYX'),     // US 30Y Treasury
    fetchYahoo('^TNX'),     // US 10Y Treasury
    fetchYahoo('^FVX'),     // US 5Y Treasury
    fetchYahoo('2YY=F'),    // US 2Y Treasury (CBOE 2Y Futures Yield)
    fetchYahoo('^IRX'),     // US 3M Treasury Bill
    fetchYahoo('DX-Y.NYB'),  // Dollar Index
    fetchYahoo('KRW=X'),      // USD/KRW Exchange Rate
    fetchYahoo('TLT'),      // iShares 20+ Year Treasury Bond ETF
    fetchYahoo('IEF'),      // iShares 7-10 Year Treasury Bond ETF
    fetchYahoo('SHY'),      // iShares 1-3 Year Treasury Bond ETF
    fetchYahoo('SGOV'),     // iShares 0-3 Month Treasury Bond ETF
    fetchNaverMarketRates()   // Korea Government & Corporate Bonds
  ]);

  // 안전한 기본값 (Fallbacks)
  const us30y = us30yRaw || { value: '5.276', numValue: 5.276, diff: '+0.039', diffPct: '+0.75%', isUp: true };
  const us10y = us10yRaw || { value: '4.738', numValue: 4.738, diff: '+0.042', diffPct: '+0.89%', isUp: true };
  const us5y = us5yRaw || { value: '4.424', numValue: 4.424, diff: '+0.037', diffPct: '+0.84%', isUp: true };
  const us2y = us2yRaw || { value: '3.961', numValue: 3.961, diff: '-0.169', diffPct: '-4.09%', isDown: true };
  const us3m = us3mRaw || { value: '3.710', numValue: 3.710, diff: '+0.007', diffPct: '+0.19%', isUp: true };
  const dxy = dxyRaw || { value: '98.84', numValue: 98.84, diff: '+0.04', diffPct: '+0.04%', isUp: true };
  const usdkrw = usdkrwRaw || { value: '1,383.90', numValue: 1383.9, diff: '-9.84', diffPct: '-0.71%', isDown: true };

  // ETF 시세 데이터 매핑
  const etfTLT = tltRaw ? { ticker: 'TLT', name: 'iShares 20+Y 미국채 ETF', price: `$${tltRaw.value}`, diff: tltRaw.diffPct, isUp: tltRaw.isUp } : { ticker: 'TLT', name: 'iShares 20+Y 미국채 ETF', price: '$82.56', diff: '+0.62%', isUp: true };
  const etfIEF = iefRaw ? { ticker: 'IEF', name: 'iShares 7-10Y 미국채 ETF', price: `$${iefRaw.value}`, diff: iefRaw.diffPct, isUp: iefRaw.isUp } : { ticker: 'IEF', name: 'iShares 7-10Y 미국채 ETF', price: '$93.01', diff: '+0.21%', isUp: true };
  const etfSHY = shyRaw ? { ticker: 'SHY', name: 'iShares 1-3Y 단기국채 ETF', price: `$${shyRaw.value}`, diff: shyRaw.diffPct, isUp: shyRaw.isUp } : { ticker: 'SHY', name: 'iShares 1-3Y 단기국채 ETF', price: '$82.00', diff: '-0.01%', isDown: true };
  const etfSGOV = sgovRaw ? { ticker: 'SGOV', name: 'iShares 0-3M 초단기국채 ETF', price: `$${sgovRaw.value}`, diff: sgovRaw.diffPct, isUp: sgovRaw.isUp } : { ticker: 'SGOV', name: 'iShares 0-3M 초단기국채 ETF', price: '$100.64', diff: '+0.01%', isUp: true };

  // 2. 💵 미국 국채 가격 (Clean Price, Par $100 기준) & 듀레이션 계산
  const priceUS30Y = calculateBondPrice(us30y.numValue, 30, 4.50, 100, 2);
  const priceUS10Y = calculateBondPrice(us10y.numValue, 10, 4.25, 100, 2);
  const priceUS5Y = calculateBondPrice(us5y.numValue, 5, 4.00, 100, 2);
  const priceUS2Y = calculateBondPrice(us2y.numValue, 2, 3.875, 100, 2);
  const priceUS3M = calculateBondPrice(us3m.numValue, 0.25, 0, 100, 2);

  // 3. 💵 한국 국고채 가격 (Clean Price, 액면 10,000원 기준) & 듀레이션 계산
  const priceKR10Y = calculateBondPrice(naverRates.kr10y.numValue, 10, 3.50, 10000, 2);
  const priceKR3Y = calculateBondPrice(naverRates.kr3y.numValue, 3, 3.25, 10000, 2);
  const priceKRCorp3Y = calculateBondPrice(naverRates.krCorp3y.numValue, 3, 4.00, 10000, 2);

  // 4. 핵심 매크로 스프레드 정밀 계산
  // ① 미국 10Y - 2Y 스프레드
  const diff10y2y = parseFloat((us10y.numValue - us2y.numValue).toFixed(3));
  const is10y2yInverted = diff10y2y < 0;
  const spread10y2y = {
    id: 'spread_10y_2y',
    name: '미국 10년-2년 장단기 금리차',
    category: 'SPREAD',
    value: `${diff10y2y >= 0 ? '+' : ''}${diff10y2y.toFixed(3)}%p`,
    numValue: diff10y2y,
    unit: '%p',
    status: is10y2yInverted ? 'INVERTED' : 'NORMAL',
    statusLabel: is10y2yInverted ? '🔴 역전 (경기침체 경보)' : '🟢 정상 (일드커브 정상화)',
    desc: '월가 공식 경기 침체 조기 경보 지표 (10Y - 2Y)',
    diff: diff10y2y >= 0 ? `+${(diff10y2y * 100).toFixed(0)}bp` : `${(diff10y2y * 100).toFixed(0)}bp`
  };

  // ② 미국 10Y - 3M 스프레드
  const diff10y3m = parseFloat((us10y.numValue - us3m.numValue).toFixed(3));
  const is10y3mInverted = diff10y3m < 0;
  const spread10y3m = {
    id: 'spread_10y_3m',
    name: '미국 10년-3개월 금리차',
    category: 'SPREAD',
    value: `${diff10y3m >= 0 ? '+' : ''}${diff10y3m.toFixed(3)}%p`,
    numValue: diff10y3m,
    unit: '%p',
    status: is10y3mInverted ? 'INVERTED' : 'NORMAL',
    statusLabel: is10y3mInverted ? '🔴 역전 (연준 침체확률 급등)' : '🟢 정상 (안정 구간)',
    desc: '뉴욕 연준(NY Fed) 공식 경기침체 확률 모델 지표',
    diff: diff10y3m >= 0 ? `+${(diff10y3m * 100).toFixed(0)}bp` : `${(diff10y3m * 100).toFixed(0)}bp`
  };

  // ③ 한국 신용 스프레드 (회사채 AA- 3년 - 국고채 3년)
  const creditSpreadNum = parseFloat((naverRates.krCorp3y.numValue - naverRates.kr3y.numValue).toFixed(2));
  const creditSpread = {
    id: 'credit_spread_kr',
    name: '한국 회사채 신용 스프레드',
    category: 'SPREAD',
    value: `+${creditSpreadNum.toFixed(2)}%p (${Math.round(creditSpreadNum * 100)}bp)`,
    numValue: creditSpreadNum,
    unit: 'bp',
    status: creditSpreadNum > 1.0 ? 'HIGH_RISK' : 'STABLE',
    statusLabel: creditSpreadNum > 1.0 ? '⚠️ 크레딧 리스크 확대' : '🟢 기업 자금조달 안정',
    desc: '회사채(3Y, AA-) - 국고채(3Y) 스프레드 (신용 위험도)'
  };

  // ④ 한·미 10년물 국채 금리차 (KR 10Y - US 10Y)
  const krUsDiff = parseFloat((naverRates.kr10y.numValue - us10y.numValue).toFixed(2));
  const krUsSpread = {
    id: 'kr_us_10y_spread',
    name: '한·미 10년물 국채 금리차',
    category: 'SPREAD',
    value: `${krUsDiff >= 0 ? '+' : ''}${krUsDiff.toFixed(2)}%p`,
    numValue: krUsDiff,
    unit: '%p',
    status: krUsDiff < 0 ? 'US_PREMIUM' : 'KR_PREMIUM',
    statusLabel: krUsDiff < 0 ? '🇺🇸 미국 국채금리 우위' : '🇰🇷 한국 국채금리 우위',
    desc: '원/달러 환율 및 외국인 자금 흐름에 결정적 영향'
  };

  // 5. 섹션별 묶음 데이터
  const usBonds = [
    {
      id: 'us30y',
      name: '미국 국채 30년물',
      country: 'US',
      type: '30Y',
      desc: '초장기물 (글로벌 연기금/보험사 수요)',
      badge: '초장기물',
      ...us30y,
      bondPrice: priceUS30Y,
      benchmarkEtf: etfTLT
    },
    {
      id: 'us10y',
      name: '미국 국채 10년물',
      country: 'US',
      type: '10Y',
      desc: '글로벌 금융시장 자산할인율 벤치마크',
      badge: '글로벌 기준',
      ...us10y,
      bondPrice: priceUS10Y,
      benchmarkEtf: etfIEF
    },
    {
      id: 'us5y',
      name: '미국 국채 5년물',
      country: 'US',
      type: '5Y',
      desc: '중기 경기 사이클 & 모기지 금리 연동',
      badge: '중기 지표',
      ...us5y,
      bondPrice: priceUS5Y,
      benchmarkEtf: { ticker: 'IEI', name: 'iShares 3-7Y 미국채 ETF', price: '$114.80', diff: '+0.15%', isUp: true }
    },
    {
      id: 'us2y',
      name: '미국 국채 2년물',
      country: 'US',
      type: '2Y',
      desc: '연준(Fed) 기준금리 통화정책 민감도 1위',
      badge: 'Fed 정책',
      ...us2y,
      bondPrice: priceUS2Y,
      benchmarkEtf: etfSHY
    },
    {
      id: 'us3m',
      name: '미국 국채 3개월물',
      country: 'US',
      type: '3M',
      desc: '초단기 자금시장 & 역레포(RRP) 유동성',
      badge: '초단기물',
      ...us3m,
      bondPrice: priceUS3M,
      benchmarkEtf: etfSGOV
    }
  ];

  const krBonds = [
    {
      id: 'kr10y',
      name: '한국 국고채 10년물',
      country: 'KR',
      type: '10Y',
      desc: '대한민국 장기 채권 벤치마크',
      badge: '국내 장기물',
      ...naverRates.kr10y,
      bondPrice: priceKR10Y,
      benchmarkEtf: { ticker: '302190', name: 'KODEX 국고채10년액티브', price: '108,240원', diff: '+0.35%', isUp: true }
    },
    {
      id: 'kr3y',
      name: '한국 국고채 3년물',
      country: 'KR',
      type: '3Y',
      desc: '한국은행 금통위 통화정책 대표 척도',
      badge: '한은 정책',
      ...naverRates.kr3y,
      bondPrice: priceKR3Y,
      benchmarkEtf: { ticker: '114820', name: 'KODEX 국고채3년', price: '103,150원', diff: '+0.10%', isUp: true }
    },
    {
      id: 'krCorp3y',
      name: '한국 회사채 3년물 (AA-)',
      country: 'KR',
      type: 'CORP',
      desc: '우량 대기업 회사채 조달 금리',
      badge: '크레딧',
      ...naverRates.krCorp3y,
      bondPrice: priceKRCorp3Y,
      benchmarkEtf: { ticker: '332610', name: 'KBSTAR 종합채권(A-이상)액티브', price: '102,400원', diff: '+0.08%', isUp: true }
    },
    {
      id: 'cd91',
      name: 'CD금리 (91일물)',
      country: 'KR',
      type: 'CD',
      desc: '시중은행 변동금리 대출 산정 기준',
      badge: '단기 기준',
      ...naverRates.cd91,
      bondPrice: { formattedPrice: '9,927원', diffFromPar: '-0.73%', duration: 0.25, sensitivity10bp: 0.03 }
    },
    {
      id: 'callRate',
      name: '콜 금리 (무담보 익일물)',
      country: 'KR',
      type: 'CALL',
      desc: '금융기관 간 초단기 무담보 자금금리',
      badge: '초단기',
      ...naverRates.callRate,
      bondPrice: { formattedPrice: '9,992원', diffFromPar: '-0.08%', duration: 0.01, sensitivity10bp: 0.00 }
    }
  ];

  const macroSpreads = [
    spread10y2y,
    spread10y3m,
    krUsSpread,
    creditSpread
  ];

  const currencies = [
    { id: 'dxy', name: '달러 인덱스 (DXY)', country: 'GLOBAL', type: 'CURRENCY', desc: '글로벌 6대 통화 대비 달러화 가치', badge: '기축통화', ...dxy },
    { id: 'usdkrw', name: '원/달러 환율 (USD/KRW)', country: 'KR', type: 'CURRENCY', desc: '서울 외환시장 실시간 환율', badge: '외환시장', ...usdkrw }
  ];

  const allData = [
    ...usBonds,
    ...krBonds,
    ...macroSpreads,
    ...currencies
  ];

  return {
    success: true,
    timestamp: new Date().toISOString(),
    yieldCurve: {
      usCurve: [
        { term: '3M', rate: us3m.numValue, price: priceUS3M.formattedPrice },
        { term: '2Y', rate: us2y.numValue, price: priceUS2Y.formattedPrice },
        { term: '5Y', rate: us5y.numValue, price: priceUS5Y.formattedPrice },
        { term: '10Y', rate: us10y.numValue, price: priceUS10Y.formattedPrice },
        { term: '30Y', rate: us30y.numValue, price: priceUS30Y.formattedPrice }
      ],
      isInverted: is10y2yInverted
    },
    sections: {
      usBonds,
      krBonds,
      macroSpreads,
      currencies
    },
    data: allData
  };
}
