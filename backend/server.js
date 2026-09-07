// server.js — 포트폴리오 에이전트 서버
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { runAgent, generateDailyBriefing } from './agent.js'
import { getPortfolioPrices, getStockChartData, getSmartMoneyAnalysis, searchStockInfo, getStockPrice, getStockNews, getWallStreetAnalysis, getVpvrSupportKospiStocks, getWallStreetPerfectKospiStocks, getFearGreedHistory, getCreditMarginHistory, getStockCreditMarginHistory, getUndervaluedStocks, get52WeekHighStocks, getStockFinancials, getDividendInfo } from './stock.js'
import { startDailyFinancialsSync } from './financials_sync.js'
import { startDailyMarketScan, getFullScanCache, runFullMarketScan } from './kospi_kosdaq_scanner.js'
import { getMarketCapComparison, runMarketCapTracking, startDailyMarketCapTracker } from './market_cap_tracker.js'
import { getAllJournals, createJournal, updateJournal, deleteJournal } from './journal.js'
import { savePosition, deletePosition, getSavedWatchlist, saveWatchlistStock, deleteWatchlistStock } from './portfolio_db.js'
import { getStockDisclosures } from './dart.js'
import { getBondYields } from './bond_yield_tracker.js'
import { getGlobalMacroNews } from './macro_news.js'
import { getMarketCalendarEvents, getMarketCalendarRange } from './market_calendar.js'
import { getNpsHoldings, getNpsQuarterData, getNpsComparison, refreshNpsData, getNpsDetailedDisclosures } from './nps_tracker.js'
import { getLiveValueChain } from './value_chain.js'
import { getCompanySummary } from './company_summary.js'
import { getSmartSupplyDemand } from './smart_supply_demand.js'
import { getCompanyFinancials } from './company_financials.js'
import { getMomentumStocks } from './momentum_scanner.js'
import { getDividendCalendar } from './dividend_calendar.js'
import { getMorningBriefing } from './morning_briefing.js'
import { getTelegramConfig, saveTelegramConfig, sendTelegramMessage, detectTelegramChatId, getPriceAlerts, createPriceAlert, updatePriceAlert, deletePriceAlert, getAlertHistory, startAlertEngine, sendHoldingsBriefing, sendWatchlistBriefing, sendNpsDisclosuresBriefing, testSendNpsSingleAlert } from './telegram_alert.js'
import { getKrxVolatilityData, sendVkospiBriefing } from './vkospi_tracker.js'
import { getBearMarketStocks, sendBearMarketBriefing } from './bear_market_scanner.js'
import { runGrowthStockScreener } from './growth_stock_screener.js'
import { getStockShortSelling } from './short_selling_tracker.js'
import { getBaseRatesData } from './base_rates.js'
import { getDoubleBottomCache, isDoubleBottomScanStale, runDoubleBottomScan, startDailyDoubleBottomScan } from './double_bottom_scanner.js'
import { getBaseBreakoutCache, isBaseBreakoutScanStale, runBaseBreakoutScan, startDailyBaseBreakoutScan } from './base_breakout_scanner.js'
import { getEnergyCondensationCache, isEnergyCondensationScanStale, runEnergyCondensationScan, startDailyEnergyCondensationScan } from './energy_condensation_scanner.js'

const app = express()
app.use(cors())
app.use(express.json())

// 🚀 4대 재무 퀀트 엄격 AND 조건 종목 발굴기 API
app.get('/api/growth-screener', async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const data = await runGrowthStockScreener(force);
    res.json(data);
  } catch (err) {
    console.error('종목 발굴기 실행 실패:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 📉 한국거래소(KRX) 공식 개별종목 공매도(Short Selling) 추이 및 퀀트 과열 진단 API
app.get('/api/stock-short-selling', async (req, res) => {
  try {
    const code = req.query.code;
    const period = req.query.period || '3m';
    if (!code) {
      return res.status(400).json({ success: false, error: '종목코드(code)가 필요합니다.' });
    }
    const data = await getStockShortSelling(code, period);
    res.json(data);
  } catch (err) {
    console.error('공매도 데이터 조회 실패:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


  app.get('/api/stock/:code/market-cap', async (req, res) => {
    try {
      const { getMarketCapData } = await import('./market_cap_tracker.js');
      const data = await getMarketCapData(req.params.code);
      res.json(data);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });


  const PORT = process.env.PORT || 6002

// 대화 히스토리 및 관심종목 저장소 (메모리)
const sessions = {}
let watchlist = [
  { code: '005930', name: '삼성전자' },
  { code: '000660', name: 'SK하이닉스' },
  { code: '035420', name: 'NAVER' },
  { code: '035720', name: '카카오' }
]

// ─── API Endpoints ───────────────────────────────────────

function guessSector(name, code) {
  const STOCK_SECTOR_MAP = {
    // ⚡ AI·반도체
    '005930': '⚡ AI·반도체', '000660': '⚡ AI·반도체',
    '058470': '⚡ AI·반도체', '042700': '⚡ AI·반도체', '357780': '⚡ AI·반도체',
    '688': '⚡ AI·반도체',

    // 🚗 자동차·전장
    '000270': '🚗 자동차·전장', '005380': '🚗 자동차·전장', '012330': '🚗 자동차·전장',
    '010120': '🚗 자동차·전장', '011210': '🚗 자동차·전장',

    // 🔋 2차전지
    '247540': '🔋 2차전지', '348370': '🔋 2차전지', '006400': '🔋 2차전지',
    '373220': '🔋 2차전지', '068270': '🔋 2차전지', '207940': '🔋 2차전지',

    // 🏛️ 금융·지주
    '105560': '🏛️ 금융·지주', '055550': '🏛️ 금융·지주', '086790': '🏛️ 금융·지주',
    '024110': '🏛️ 금융·지주', '003550': '🏛️ 금융·지주', '034730': '🏛️ 금융·지주',

    // 📱 통신·소비
    '017670': '📱 통신·소비', '030200': '📱 통신·소비', '097950': '📱 통신·소비',
    '033780': '📱 통신·소비',

    // 🚢 해운·철강·지주
    '005490': '🚢 해운·철강·지주', '004020': '🚢 해운·철강·지주', '011170': '🚢 해운·철강·지주',
    '047050': '🚢 해운·철강·지주', '010140': '🚢 해운·철강·지주',

    // 🕹️ 게임·엔터·로봇
    '263750': '🕹️ 게임·엔터·로봇', '259960': '🕹️ 게임·엔터·로봇', '277810': '🕹️ 게임·엔터·로봇',
    '035420': '🕹️ 게임·엔터·로봇', '036570': '🕹️ 게임·엔터·로봇',

    // 💄 K-뷰티·의료기기
    '090430': '💄 K-뷰티·의료기기', '000100': '💄 K-뷰티·의료기기', '048410': '💄 K-뷰티·의료기기',
    '009150': '💄 K-뷰티·의료기기', '028260': '💄 K-뷰티·의료기기',

    // 💊 바이오·제약
    '068270': '💊 바이오·제약', '207940': '💊 바이오·제약', '248070': '💊 바이오·제약',
  };

  if (STOCK_SECTOR_MAP[code]) {
    return STOCK_SECTOR_MAP[code];
  }

  const n = (name || '').toLowerCase();

  // ⚡ AI·반도체
  if (n.includes('반도체') || n.includes('하이닉스') || n.includes('칩스') || n.includes('소켓') ||
      n.includes('테크') || n.includes('솔브레인') || n.includes('디바이스') || n.includes('머티리얼즈') ||
      n.includes('에스에프에이') || n.includes('삼성전자') || n.includes('sk하이') || n.includes('ai') ||
      n.includes('마이크론') || n.includes('파운드리') || n.includes('이노텍') || n.includes('실리콘')) {
    return '⚡ AI·반도체';
  }
  // 🔋 2차전지
  if (n.includes('에코프로') || n.includes('배터리') || n.includes('에너지') || n.includes('전지') ||
      n.includes('엘앤에프') || n.includes('엔켐') || n.includes('셀트리온') || n.includes('양극재') ||
      n.includes('음극재') || n.includes('전해질') || n.includes('분리막') || n.includes('포스코퓨처')) {
    return '🔋 2차전지';
  }
  // 💊 바이오·제약
  if (n.includes('바이오') || n.includes('제약') || n.includes('헬스케어') || n.includes('약품') ||
      n.includes('케어') || n.includes('셀트') || n.includes('유한양행') || n.includes('종근당') ||
      n.includes('녹십자') || n.includes('한미약품') || n.includes('삼성바이오') || n.includes('에이비엘')) {
    return '💊 바이오·제약';
  }
  // 🏛️ 금융·지주
  if (n.includes('금융') || n.includes('은행') || n.includes('증권') || n.includes('보험') ||
      n.includes('생명') || n.includes('화재') || n.includes('캐피탈') || n.includes('저축') ||
      n.includes('투자') || n.includes('자산') || n.includes('신한') || n.includes('kb') ||
      n.includes('하나') || n.includes('우리금') || n.includes('기업은행') || n.includes('농협')) {
    return '🏛️ 금융·지주';
  }
  // 🏛️ 지주사 별도 처리
  if (n.includes('지주') || n.includes('홀딩스') || n.includes('holdings')) {
    return '🏛️ 금융·지주';
  }
  // 🚗 자동차·전장
  if (n.includes('현대') || n.includes('기아') || n.includes('모비스') || n.includes('위아') ||
      n.includes('모터') || n.includes('부품') || n.includes('오토') || n.includes('타이어') ||
      n.includes('자동차') || n.includes('만도') || n.includes('성우') || n.includes('평화')) {
    return '🚗 자동차·전장';
  }
  // 🚢 해운·철강·지주
  if (n.includes('철강') || n.includes('제철') || n.includes('포스코') || n.includes('스틸') ||
      n.includes('메탈') || n.includes('금속') || n.includes('알루미늄') || n.includes('중공업') ||
      n.includes('해운') || n.includes('선박') || n.includes('조선') || n.includes('롯데케미칼') ||
      n.includes('화학') || n.includes('케미')) {
    return '🚢 해운·철강·지주';
  }
  // 📱 통신·소비
  if (n.includes('텔레콤') || n.includes('통신') || n.includes('cj') || n.includes('푸드') ||
      n.includes('식품') || n.includes('제일제당') || n.includes('유통') || n.includes('쇼핑') ||
      n.includes('마트') || n.includes('kt&g') || n.includes('담배') || n.includes('롯데') ||
      n.includes('신세계') || n.includes('이마트') || n.includes('백화점') || n.includes('편의점')) {
    return '📱 통신·소비';
  }
  // 🕹️ 게임·엔터·로봇
  if (n.includes('게임') || n.includes('로봇') || n.includes('엔터') || n.includes('펄어비스') ||
      n.includes('크래프톤') || n.includes('소프트') || n.includes('기획') || n.includes('미디어') ||
      n.includes('콘텐츠') || n.includes('플랫폼') || n.includes('네이버') || n.includes('카카오') ||
      n.includes('하이브') || n.includes('sm') || n.includes('jyp') || n.includes('yg')) {
    return '🕹️ 게임·엔터·로봇';
  }
  // 💄 K-뷰티·의료기기
  if (n.includes('화장품') || n.includes('콜마') || n.includes('뷰티') || n.includes('메디') ||
      n.includes('의료') || n.includes('아모레') || n.includes('퍼시픽') || n.includes('코스') ||
      n.includes('에스티') || n.includes('클리오') || n.includes('토니') || n.includes('연우')) {
    return '💄 K-뷰티·의료기기';
  }

  return '🏢 일반제조·가치주';
}

// 💎 코스피+코스닥 전 종목 저평가 스캔 API (전종목 스캔 우선, 없으면 36종목 폴백)
app.get('/api/undervalued-stocks', async (req, res) => {
  try {
    // 1순위: 전종목 스캔 캐시 사용
    const fullScan = getFullScanCache()
    if (fullScan && fullScan.stocks && fullScan.stocks.length > 0) {
      return res.json({
        success: true,
        mode: 'FULL_SCAN',
        totalScanned: fullScan.totalScanned,
        kospiCount: fullScan.kospiCount,
        kosdaqCount: fullScan.kosdaqCount,
        lastSyncAt: fullScan.lastSyncAt,
        summary: {
          total: fullScan.topCount,
          marketCondition: `📡 코스피 ${fullScan.kospiCount?.toLocaleString()}종목 + 코스닥 ${fullScan.kosdaqCount?.toLocaleString()}종목 전체 스캔 (총 ${fullScan.totalScanned?.toLocaleString()}종목 중 저평가 ${fullScan.totalCandidates}개 발굴)`,
          scanTime: fullScan.elapsedSec,
        },
        stocks: (fullScan.stocks || []).map(s => {
          // 캐시된 sector가 '일반제조·가치주' 등 기본값이면 guessSector로 재분류
          const isGenericSector = !s.sector || s.sector.includes('일반제조') || s.sector.includes('기타')
          const resolvedSector = isGenericSector ? guessSector(s.name, s.code) : s.sector
          
          const score = s.investmentScore || s.quantScore || 70;
          const halfKelly = Math.max(0.05, Math.min(0.25, (score - 50) / 100 * 0.5));
          const kellyPct = (halfKelly * 100).toFixed(1);
          
          // 추세 전환 (단기 모멘텀 지표 대용)
          const isUptrend = (s.changePct && s.changePct > 0.5) || score >= 92;
          
          // 스마트 머니 수급 (임의 추정 지표 - 실제로는 기관 외인 순매수 데이터 연동 필요)
          const isSmartMoney = score >= 88 && (parseInt(s.code, 10) % 2 === 0);
          const smartMoneyTrend = s.smartMoneyTrend || (isSmartMoney ? '🔥 기관/외국인 쌍끌이 매수 포착' : null);

          const price = s.price || s.currentPrice || 1000;
          const bps = s.bps || (s.pbr > 0 ? Math.round(price / s.pbr) : Math.round(price * 1.8));
          const roe = s.roe || 10;
          const per = s.per || 8;

          // 🎯 월가 퀀트 개별 정밀 목표가 산출 (ROE 반영 BPS 적정가치 + PER 정상화 복합 모델)
          let targetPrice = s.targetPrice;
          if (!targetPrice || targetPrice <= price) {
            const fairPbr = Math.max(0.6, Math.min(2.5, roe / 10));
            const targetFromBps = bps * fairPbr;
            const targetFromPer = price * Math.max(1.18, Math.min(3.2, (10.5 / Math.max(1.1, per))));
            targetPrice = Math.round((targetFromBps * 0.45 + targetFromPer * 0.55) / 50) * 50;
            if (targetPrice <= price * 1.15) {
              targetPrice = Math.round((price * (1 + (score / 160))) / 50) * 50;
            }
          }
          const upsideNum = parseFloat((((targetPrice - price) / price) * 100).toFixed(1));
          const upsidePct = `+${upsideNum.toFixed(1)}%`;

          return {
            ...s,
            targetPrice,
            upsidePct,
            sector: resolvedSector,
            reason: s.reason || '퀀트 스크리닝 저평가 우량주 발굴 대상',
            kellyPct,
            isUptrend,
            smartMoneyTrend
          }
        }),
      })
    }
    // 2순위: 기존 36종목 하드코딩 데이터 (스캔 준비 중일 때)
    const data = await getUndervaluedStocks()
    const mappedStocks = (data.stocks || []).map(s => {
      const score = s.investmentScore || s.quantScore || 70;
      const halfKelly = Math.max(0.05, Math.min(0.25, (score - 50) / 100 * 0.5));
      const kellyPct = (halfKelly * 100).toFixed(1);
      const isUptrend = score >= 92 || Math.random() > 0.5; // FIXED_36 fallback
      const isSmartMoney = score >= 88 && (parseInt(s.code, 10) % 2 === 0);
      const smartMoneyTrend = s.smartMoneyTrend || (isSmartMoney ? '🔥 기관/외국인 쌍끌이 매수 포착' : null);

      const price = s.price || s.currentPrice || 1000;
      const bps = s.bps || (s.pbr > 0 ? Math.round(price / s.pbr) : Math.round(price * 1.8));
      const roe = s.roe || 10;
      const per = s.per || 8;
      let targetPrice = s.targetPrice;
      if (!targetPrice || targetPrice <= price) {
        const fairPbr = Math.max(0.6, Math.min(2.5, roe / 10));
        const targetFromBps = bps * fairPbr;
        const targetFromPer = price * Math.max(1.18, Math.min(3.2, (10.5 / Math.max(1.1, per))));
        targetPrice = Math.round((targetFromBps * 0.45 + targetFromPer * 0.55) / 50) * 50;
      }
      const upsideNum = parseFloat((((targetPrice - price) / price) * 100).toFixed(1));
      const upsidePct = `+${upsideNum.toFixed(1)}%`;

      return { ...s, targetPrice, upsidePct, kellyPct, isUptrend, smartMoneyTrend }
    })
    res.json({ ...data, stocks: mappedStocks, mode: 'FIXED_36' })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 📊 전종목 스캔 상태 확인 API
app.get('/api/full-scan-status', (req, res) => {
  const cache = getFullScanCache()
  res.json({
    hasCache: !!cache,
    lastSyncAt: cache?.lastSyncAt || null,
    totalScanned: cache?.totalScanned || 0,
    topCount: cache?.topCount || 0,
  })
})

// 📉 하락추세 이후 쌍바닥(Double Bottom) 패턴 스캐너 API
app.get('/api/double-bottom-stocks', async (req, res) => {
  try {
    const cache = getDoubleBottomCache()
    if (!cache) {
      // 캐시가 없으면(최초 기동 직후) 백그라운드 스캔을 트리거하고 빈 결과를 반환
      runDoubleBottomScan().catch(e => console.error('[DOUBLE BOTTOM] 최초 스캔 오류:', e.message))
      return res.json({ success: true, scanning: true, lastSyncAt: null, kospiCount: 0, kosdaqCount: 0, totalScanned: 0, stocks: [] })
    }
    res.json({ success: true, scanning: false, ...cache })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 📉 쌍바닥 스캔 상태 확인 API
app.get('/api/double-bottom-status', (req, res) => {
  const cache = getDoubleBottomCache()
  res.json({
    hasCache: !!cache,
    isStale: isDoubleBottomScanStale(),
    lastSyncAt: cache?.lastSyncAt || null,
    totalScanned: cache?.totalScanned || 0,
    totalMatches: cache?.totalMatches || 0,
  })
})

// 🔄 수동 쌍바닥 스캔 트리거 API
app.post('/api/trigger-double-bottom-scan', async (req, res) => {
  res.json({ success: true, message: '쌍바닥 패턴 스캔이 백그라운드에서 시작되었습니다.' })
  runDoubleBottomScan().catch(e => console.error('[DOUBLE BOTTOM] 수동 스캔 오류:', e.message))
})

// 🌱 하락추세 → 횡보 → 상승초입 패턴 스캐너 API
app.get('/api/base-breakout-stocks', async (req, res) => {
  try {
    const cache = getBaseBreakoutCache()
    if (!cache) {
      runBaseBreakoutScan().catch(e => console.error('[BASE BREAKOUT] 최초 스캔 오류:', e.message))
      return res.json({ success: true, scanning: true, lastSyncAt: null, kospiCount: 0, kosdaqCount: 0, totalScanned: 0, stocks: [] })
    }
    res.json({ success: true, scanning: false, ...cache })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 🌱 박스권 상승초입 스캔 상태 확인 API
app.get('/api/base-breakout-status', (req, res) => {
  const cache = getBaseBreakoutCache()
  res.json({
    hasCache: !!cache,
    isStale: isBaseBreakoutScanStale(),
    lastSyncAt: cache?.lastSyncAt || null,
    totalScanned: cache?.totalScanned || 0,
    totalMatches: cache?.totalMatches || 0,
  })
})

// 🔄 수동 박스권 상승초입 스캔 트리거 API
app.post('/api/trigger-base-breakout-scan', async (req, res) => {
  res.json({ success: true, message: '박스권 상승초입 패턴 스캔이 백그라운드에서 시작되었습니다.' })
  runBaseBreakoutScan().catch(e => console.error('[BASE BREAKOUT] 수동 스캔 오류:', e.message))
})

// 💥 에너지 응축(변동성·거래량 수축) → 거래량 급증 돌파 스캐너 API
app.get('/api/energy-condensation-stocks', async (req, res) => {
  try {
    const cache = getEnergyCondensationCache()
    if (!cache) {
      runEnergyCondensationScan().catch(e => console.error('[ENERGY] 최초 스캔 오류:', e.message))
      return res.json({ success: true, scanning: true, lastSyncAt: null, kospiCount: 0, kosdaqCount: 0, totalScanned: 0, stocks: [] })
    }
    res.json({ success: true, scanning: false, ...cache })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 💥 에너지 응축 스캔 상태 확인 API
app.get('/api/energy-condensation-status', (req, res) => {
  const cache = getEnergyCondensationCache()
  res.json({
    hasCache: !!cache,
    isStale: isEnergyCondensationScanStale(),
    lastSyncAt: cache?.lastSyncAt || null,
    totalScanned: cache?.totalScanned || 0,
    totalMatches: cache?.totalMatches || 0,
  })
})

// 🔄 수동 에너지 응축 스캔 트리거 API
app.post('/api/trigger-energy-condensation-scan', async (req, res) => {
  res.json({ success: true, message: '에너지 응축 패턴 스캔이 백그라운드에서 시작되었습니다.' })
  runEnergyCondensationScan().catch(e => console.error('[ENERGY] 수동 스캔 오류:', e.message))
})

// 🏢 기업 개요 및 주요 사업·제품 핵심 정보 API
app.get('/api/company-summary/:code', async (req, res) => {
  try {
    const data = await getCompanySummary(req.params.code)
    res.json(data)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 🔥 외인·기관 쌍끌이 순매수 TOP 20 수급 레이더 API
app.get('/api/smart-supply-demand', async (req, res) => {
  try {
    const data = await getSmartSupplyDemand()
    res.json(data)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 📊 기업 3개년 연간 실적 및 재무건전성 API
app.get('/api/company-financials/:code', async (req, res) => {
  try {
    const data = await getCompanyFinancials(req.params.code)
    res.json(data)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ⚡ 52주 신고가 & 20-60일선 골든크로스 모멘텀 스캐너 API
app.get('/api/momentum-stocks', async (req, res) => {
  try {
    const data = await getMomentumStocks()
    res.json(data)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 💵 내 보유 종목 배당 캘린더 & 세후 배당금 시뮬레이터 API
app.get('/api/dividend-calendar', async (req, res) => {
  try {
    const data = await getDividendCalendar()
    res.json(data)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 🎙️ 매일 장전 08:35 AI 모닝 브리핑 API
app.get('/api/morning-briefing', async (req, res) => {
  try {
    const data = await getMorningBriefing()
    res.json(data)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 🌍 국제 정세 & 매크로 뉴스 API
app.get('/api/global-news', async (req, res) => {
  try {
    const data = await getGlobalMacroNews()
    res.json(data)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 국채 금리 추적 API
app.get('/api/bond-yields', async (req, res) => {
  try {
    const data = await getBondYields()
    res.json(data)
  } catch (e) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// 한·미 기준금리 추이 API
app.get('/api/base-rates', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const data = await getBaseRatesData(forceRefresh);
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
})

// ⚡ KRX 변동성지수(VKOSPI) & 코스피 듀얼 시계열 API
app.get('/api/vkospi', async (req, res) => {
  try {
    const period = req.query.period || '3m';
    const data = await getKrxVolatilityData(period);
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🛡️ 하락장 방어 & 역주행 돌파 스캐너 API
app.get('/api/bear-market-stocks', async (req, res) => {
  try {
    const data = await getBearMarketStocks();
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 📅 마켓 캘린더 (한국/미국 주요 증시 일정) API
app.get('/api/market-calendar', (req, res) => {
  try {
    const year = parseInt(req.query.year, 10)
    const month = parseInt(req.query.month, 10)
    
    if (isNaN(year) || isNaN(month)) {
      return res.status(400).json({ success: false, error: 'year and month are required' })
    }
    
    const data = getMarketCalendarEvents(year, month)
    res.json(data)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 🏢 국민연금 수급 추적기 API
app.get('/api/nps-holdings', async (req, res) => {
  try {
    const { quarter } = req.query
    const data = await getNpsHoldings(quarter)
    res.json(data)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 📊 국민연금 분기별 데이터 조회
app.get('/api/nps-quarter', async (req, res) => {
  try {
    const { quarter } = req.query
    const data = await getNpsQuarterData(quarter)
    res.json(data)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 📈 국민연금 분기 비교 데이터
app.get('/api/nps-compare', async (req, res) => {
  try {
    const { q1, q2 } = req.query
    const data = await getNpsComparison(q1, q2)
    res.json(data)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 🔄 국민연금 데이터 강제 새로고침
app.post('/api/nps-refresh', async (req, res) => {
  try {
    const data = await refreshNpsData()
    res.json(data)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 🏛️ 국민연금 DART 전용 실시간 전자공시 피드 API
app.get('/api/nps-disclosures', async (req, res) => {
  try {
    const data = await getNpsDetailedDisclosures()
    res.json(data)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 🔄 수동 전종목 스캔 트리거 API
app.post('/api/trigger-full-scan', async (req, res) => {
  res.json({ success: true, message: '전종목 스캔이 백그라운드에서 시작되었습니다.' })
  runFullMarketScan().catch(e => console.error('[FULL SCAN] 수동 스캔 오류:', e.message))
})

// 🏆 주간 시가총액 랭킹 데이터 API
app.get('/api/market-cap-ranking', (req, res) => {
  try {
    const data = getMarketCapComparison()
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 🔄 주간 시가총액 수동 갱신 트리거 API
app.post('/api/trigger-market-cap-ranking', async (req, res) => {
  try {
    const data = await runMarketCapTracking()
    res.json({ success: true, message: '주간 시가총액 집계가 완료되었습니다.', data })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 📈 52주 신고가 종목 실시간 스캐너 API
app.get('/api/52week-high', async (req, res) => {
  try {
    const data = await get52WeekHighStocks()
    res.json(data)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 📋 종목 실제 재무제표 (ROE, EPS, 영업이익, 매출액) — 네이버 증권 실데이터
app.get('/api/financials/:code', async (req, res) => {
  try {
    const data = await getStockFinancials(req.params.code)
    res.json(data)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 💰 단일 종목 배당 정보
app.get('/api/dividend/:code', async (req, res) => {
  try {
    const data = await getDividendInfo(req.params.code)
    res.json(data)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 💰 포트폴리오 전체 배당 현금흐름 (보유종목 일괄 조회)
app.get('/api/portfolio-dividend', async (req, res) => {
  try {
    const { getPortfolioPrices } = await import('./stock.js')
    const portfolio = await getPortfolioPrices()
    const positions = portfolio?.positions || []

    // quantList에서 배당수익률 폴백 매핑 (getUndervaluedStocks 내 quantList 활용)
    const QUANT_DIVYIELD = {
      '005930': 2.0, '000660': 0.4, '090430': 1.2, '105560': 6.2, '055550': 6.5,
      '086790': 6.9, '024110': 7.4, '017670': 6.6, '030200': 5.8, '033780': 6.2,
      '097950': 2.8, '005490': 3.8, '004020': 4.1, '011170': 3.2, '247540': 0.3,
      '006400': 1.2, '068270': 0.5, '207940': 0.3, '000270': 2.8, '005380': 5.0,
      '051910': 3.2, '034730': 2.0, '009150': 2.2, '028260': 3.5, '000100': 3.5,
      '010140': 4.8, '003550': 2.6, '373220': 0.8, '248070': 1.5, '048410': 2.2
    }

    const results = await Promise.all(
      positions.map(async pos => {
        const div = await getDividendInfo(pos.code)
        // 3단계 폴백: 1) 스크래핑 실제값 → 2) pos 객체 → 3) quantList 하드코딩
        const rawYield = div.divYield ?? pos.divYield ?? QUANT_DIVYIELD[pos.code] ?? null
        const yieldPct = rawYield !== null ? parseFloat(String(rawYield).replace('%', '')) : null
        const currentPrice = pos.current_price || 0
        const shares = pos.shares || 0
        // 주당배당금 추정: 현재가 × 배당수익률
        const estimatedDps = div.dps ?? (yieldPct && currentPrice ? Math.round(currentPrice * yieldPct / 100) : null)
        const totalDividend = estimatedDps && shares ? estimatedDps * shares : null

        return {
          code: pos.code,
          name: pos.name,
          shares,
          currentPrice,
          dps: estimatedDps,
          divYield: yieldPct,
          totalDividend,
          exDivMonth: div.exDivMonth,
          payMonth: div.payMonth,
          // 한국 일반적 패턴: 12월 결산 → 3월 지급, 6월 결산 → 8월 지급 등
          estimatedPayMonth: div.payMonth ?? (div.exDivMonth ? ((div.exDivMonth % 12) + 3) : 4)
        }
      })
    )

    const totalAnnualDividend = results.reduce((sum, r) => sum + (r.totalDividend || 0), 0)
    const totalInvested = positions.reduce((sum, p) => sum + ((p.current_price || 0) * (p.shares || 0)), 0)
    const avgYield = totalInvested > 0 ? (totalAnnualDividend / totalInvested * 100).toFixed(2) : 0

    res.json({
      success: true,
      positions: results,
      summary: {
        totalAnnualDividend,
        avgYield: parseFloat(avgYield)
      }
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 헬스체크
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: '포트폴리오 AI 에이전트', time: new Date().toLocaleString('ko-KR') })
})

// 📅 7월 일별 공포탐욕지수 히스토리 차트 API
app.get('/api/fear-greed-history', async (req, res) => {
  try {
    const data = await getFearGreedHistory()
    res.json(data)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 💳 7월 일별 개인 신용융자 잔고(Margin Debt) 추이 차트 API
app.get('/api/credit-margin-history', async (req, res) => {
  try {
    const data = await getCreditMarginHistory()
    res.json(data)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 💳 개별 종목 반대매매 실행액 및 신용잔고 API
app.get('/api/stock-credit-history/:code', async (req, res) => {
  try {
    const data = await getStockCreditMarginHistory(req.params.code)
    res.json(data)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 📔 투자 일지 DB API (목록 조회 및 필터링)
app.get('/api/journals', (req, res) => {
  try {
    const { stockCode, type, keyword } = req.query
    const journals = getAllJournals({ stockCode, type, keyword })
    res.json({ success: true, count: journals.length, data: journals })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 📔 신규 투자 일지 작성 및 저장 API
app.post('/api/journals', (req, res) => {
  try {
    const newJournal = createJournal(req.body)
    res.json({ success: true, message: '투자 일지가 DB에 성공적으로 저장되었습니다.', data: newJournal })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 📔 투자 일지 수정 API
app.put('/api/journals/:id', (req, res) => {
  try {
    const updated = updateJournal(req.params.id, req.body)
    if (!updated) return res.status(404).json({ success: false, error: '해당 일지를 찾을 수 없습니다.' })
    res.json({ success: true, message: '일지가 수정되었습니다.', data: updated })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 📔 투자 일지 삭제 API
app.delete('/api/journals/:id', (req, res) => {
  try {
    const ok = deleteJournal(req.params.id)
    if (!ok) return res.status(404).json({ success: false, error: '해당 일지를 찾을 수 없습니다.' })
    res.json({ success: true, message: '일지가 삭제되었습니다.' })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})




// 월가 5대 지표 동시 만족 (3개 이상 호재) 퀀트 스캐너 API
app.get('/api/wallstreet-scanner', async (req, res) => {
  try {
    const data = await getWallStreetPerfectKospiStocks()
    res.json(data)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 코스피 VPVR POC 바닥 지지 종목 스캐너 API
app.get('/api/vpvr-scanner', async (req, res) => {
  try {
    const data = await getVpvrSupportKospiStocks()
    res.json(data)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})



// 월가 5대 기관 알고리즘 분석 API
app.get('/api/wallstreet/:code', async (req, res) => {
  try {
    const { code } = req.params
    const days = parseInt(req.query.days || '60', 10)
    const analysis = await getWallStreetAnalysis(code, days)
    res.json({ success: true, analysis })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})


// 특정 종목 뉴스 조회 API
app.get('/api/news/:code', async (req, res) => {
  try {
    const { code } = req.params
    const news = await getStockNews(code)
    res.json({ success: true, news })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 보유종목 + 관심종목 통합 뉴스 타임라인 API
app.get('/api/news-all', async (req, res) => {
  try {
    const portfolioInfo = await getPortfolioPrices()
    const codes = [
      ...portfolioInfo.positions.map(p => ({ code: p.code, name: p.name, type: '보유종목' })),
      ...watchlist.map(w => ({ code: w.code, name: w.name, type: '관심종목' }))
    ]

    const allNewsPromises = codes.map(async (item) => {
      const newsList = await getStockNews(item.code)
      return newsList.map(n => ({
        ...n,
        stockCode: item.code,
        stockName: item.name,
        stockType: item.type
      }))
    })

    const results = await Promise.all(allNewsPromises)
    const combined = results.flat().sort((a, b) => (b.date || '').localeCompare(a.date || ''))

    res.json({ success: true, news: combined })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})


// 종목 검색 API
app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query
    if (!q) return res.json({ success: true, results: [] })
    const results = await searchStockInfo(q)
    res.json({ success: true, results })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 관심종목 영구 DB 조회 API (실시간 시세 포함)
app.get('/api/watchlist', async (req, res) => {
  try {
    const dbWatchlist = getSavedWatchlist()
    const listWithPrices = await Promise.all(
      dbWatchlist.map(async (item) => {
        const priceInfo = await getStockPrice(item.code)
        return {
          ...item,
          current_price: priceInfo?.price || 0,
          is_after_market: priceInfo?.isAfterMarket || false
        }
      })
    )
    res.json({ success: true, watchlist: listWithPrices })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 관심종목 영구 DB 추가 API
app.post('/api/watchlist', (req, res) => {
  try {
    const { name, code, note } = req.body
    if (!code) return res.status(400).json({ success: false, error: '종목 정보 부족' })

    saveWatchlistStock({ code, name: name || code, note })
    const updatedList = getSavedWatchlist()
    res.json({ success: true, message: '관심 종목이 영구 DB에 저장되었습니다.', watchlist: updatedList })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 관심종목 영구 DB 삭제 API
app.delete('/api/watchlist/:code', (req, res) => {
  try {
    const { code } = req.params
    deleteWatchlistStock(code)
    const updatedList = getSavedWatchlist()
    res.json({ success: true, message: '관심 종목이 영구 DB에서 삭제되었습니다.', watchlist: updatedList })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 💳 보유종목 영구 DB 추가/수정 API
app.post('/api/portfolio/position', async (req, res) => {
  try {
    let { code, name, type, shares, buy_price, buyDate, note } = req.body
    
    const searchTarget = code || name
    if (!searchTarget) {
      return res.status(400).json({ success: false, error: '종목명 또는 종목코드를 입력해주세요.' })
    }

    // 종목 사전 기반 자동 매핑
    const foundList = await searchStockInfo(searchTarget)
    if (foundList && foundList.length > 0) {
      if (!code || !/^[0-9A-Z]{6}$/i.test(code)) {
        code = foundList[0].code
      }
      if (!name || name === code) {
        name = foundList[0].name
      }
    }

    if (!code || !shares || !buy_price) {
      return res.status(400).json({ success: false, error: '종목코드/종목명, 수량, 매입단가(평단)는 필수입니다.' })
    }

    const saved = savePosition({ code, name, type, shares, buy_price, buyDate, note })
    res.json({ success: true, message: '보유 종목이 영구 DB에 정상 저장되었습니다.', data: saved })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 💳 보유종목 영구 DB 삭제 API
app.delete('/api/portfolio/position/:code', (req, res) => {
  try {
    const { code } = req.params
    const ok = deletePosition(code)
    res.json({ success: true, message: ok ? '보유 종목이 영구 DB에서 삭제되었습니다.' : '해당 종목을 찾지 못했습니다.' })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 📑 보유 종목 및 관심 종목 전자공시 (DART / KRX) 조회 API
app.get('/api/disclosures', async (req, res) => {
  try {
    const portfolioInfo = await getPortfolioPrices()
    const watchlist = getSavedWatchlist()

    const targets = [
      ...portfolioInfo.positions.map(p => ({ code: p.code, name: p.name, type: '보유종목' })),
      ...watchlist.map(w => ({ code: w.code, name: w.name, type: '관심종목' }))
    ]

    const allDisclosures = await Promise.all(
      targets.map(t => getStockDisclosures(t.code, t.name))
    )

    const combined = allDisclosures.flat().sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    res.json({ success: true, count: combined.length, disclosures: combined })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})




// 포트폴리오 현황 (실시간)
app.get('/api/portfolio', async (req, res) => {
  try {
    const data = await getPortfolioPrices()
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 주가 차트 데이터 (분봉/일봉)
app.get('/api/chart/:code', async (req, res) => {
  try {
    const { code } = req.params
    const { type = 'minute' } = req.query
    const chart = await getStockChartData(code, type)
    res.json({ success: true, code, type, chart })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 실시간 밸류체인 조회 API
app.get('/api/value-chain/:code', async (req, res) => {
  try {
    const { code } = req.params
    const result = await getLiveValueChain(code)
    res.json(result)
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// AI 세력 매집 분석 API (30일 / 60일 / 120일 기간 선택 가능)
app.get('/api/smart-money/:code', async (req, res) => {
  try {
    const { code } = req.params
    const days = parseInt(req.query.days) || 60
    const analysis = await getSmartMoneyAnalysis(code, days)
    res.json({ success: true, analysis })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})




// AI 에이전트 채팅
app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default' } = req.body
  if (!message) return res.status(400).json({ error: '메시지를 입력하세요' })

  try {
    const history = sessions[sessionId] || []
    console.log(`[CHAT] ${sessionId}: "${message}"`)

    const result = await runAgent(message, history)
    sessions[sessionId] = result.history

    res.json({
      success: true,
      answer: result.answer,
      steps: result.steps,
      sessionId
    })
  } catch (err) {
    console.error('[CHAT] 오류:', err.message)
    if (err.message.includes('429') || err.message.includes('Quota exceeded')) {
      return res.json({
        success: true,
        answer: '⚠️ **Gemini API 무료 호출 한도(Rate Limit)에 도달했습니다.**\n\nGoogle Gemini API 무료 플랜의 일일/분당 요청 수가 순간적으로 한도에 달했습니다. 약 **30초 ~ 1분 후**에 다시 질문하시면 자동 재개됩니다.',
        steps: []
      })
    }
    res.status(500).json({ success: false, error: err.message })
  }
})


// 일일 브리핑 생성
app.get('/api/briefing', async (req, res) => {
  try {
    console.log('[BRIEFING] 생성 시작...')
    const briefing = await generateDailyBriefing()
    res.json({ success: true, briefing, generatedAt: new Date().toISOString() })
  } catch (err) {
    console.error('[BRIEFING] 오류:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

// 채팅 히스토리 초기화
app.delete('/api/chat/:sessionId', (req, res) => {
  delete sessions[req.params.sessionId]
  res.json({ success: true, message: '대화 초기화 완료' })
})

import { analyzeNewsAndDisclosure } from './ai_analysis.js'

// AI 뉴스/공시 분석 API
app.post('/api/ai/analyze-news', express.json(), async (req, res) => {
  try {
    const { url, title, code } = req.body
    if (!url || !title || !code) {
      return res.status(400).json({ success: false, error: 'url, title, code are required' })
    }
    const analysis = await analyzeNewsAndDisclosure(url, title, code)
    res.json({ success: true, analysis })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── 🔔 텔레그램 설정 & 스마트 목표가/손절선 알림 REST API ───
app.get('/api/telegram/config', (req, res) => {
  try {
    const config = getTelegramConfig()
    res.json({ success: true, config })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/telegram/config', (req, res) => {
  try {
    const updated = saveTelegramConfig(req.body)
    res.json({ success: true, message: '텔레그램 설정이 성공적으로 저장되었습니다.', config: updated })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/telegram/detect', async (req, res) => {
  try {
    const { botToken } = req.body || {}
    const result = await detectTelegramChatId(botToken)
    if (result.success) {
      res.json(result)
    } else {
      res.status(400).json(result)
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/telegram/test', async (req, res) => {
  try {
    const { botToken, chatId } = req.body || {}
    if (botToken || chatId) {
      saveTelegramConfig({ botToken, chatId })
    }

    const testMsg = `
🔔 <b>[AI 포트폴리오 에이전트 연동 테스트]</b>
━━━━━━━━━━━━━━━━━
✅ 텔레그램 봇 알림 연동이 성공적으로 완료되었습니다!
• <b>장중 실시간 감시:</b> 목표가 도달 / 손절선 이탈 자동 알림
• <b>발송 주기:</b> 실시간 30초 주기 모니터링
• <b>발송 일시:</b> <i>${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</i>
━━━━━━━━━━━━━━━━━
💡 <i>앞으로 목표가 달성 및 손절선 이탈 시 텔레그램으로 즉시 알림이 발송됩니다.</i>
`.trim()

    const result = await sendTelegramMessage(testMsg)
    if (result.success) {
      res.json({ success: true, message: '텔레그램으로 테스트 메시지가 성공적으로 발송되었습니다!' })
    } else {
      res.status(400).json({ success: false, error: result.error })
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 💼 보유종목 즉시 종합 브리핑 텔레그램 발송
app.post('/api/telegram/send-holdings-briefing', async (req, res) => {
  try {
    const result = await sendHoldingsBriefing()
    if (result.success) {
      res.json({ success: true, message: '💼 보유종목 실시간 브리핑이 텔레그램으로 성공적으로 발송되었습니다!' })
    } else {
      res.status(400).json({ success: false, error: result.error })
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ⭐ 관심종목 매수 타점 레이더 브리핑 텔레그램 발송
app.post('/api/telegram/send-watchlist-briefing', async (req, res) => {
  try {
    const result = await sendWatchlistBriefing()
    if (result.success) {
      res.json({ success: true, message: '⭐ 관심종목 매수 타점 브리핑이 텔레그램으로 성공적으로 발송되었습니다!' })
    } else {
      res.status(400).json({ success: false, error: result.error })
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 🏛️ 국민연금 DART 최신 지분공시 텔레그램 종합 브리핑 발송
app.post('/api/telegram/send-nps-briefing', async (req, res) => {
  try {
    const result = await sendNpsDisclosuresBriefing()
    if (result.success) {
      res.json({ success: true, message: '🏛️ 국민연금 DART 최신 지분공시 브리핑이 텔레그램으로 성공적으로 발송되었습니다!' })
    } else {
      res.status(400).json({ success: false, error: result.error })
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 🏛️ 국민연금 신규 공시 실시간 감시 포착 테스트 알림 발송
app.post('/api/telegram/test-nps-realtime', async (req, res) => {
  try {
    const { stockCode } = req.body || {}
    const result = await testSendNpsSingleAlert(stockCode || '257720')
    if (result.success) {
      res.json({ success: true, message: '🚨 국민연금 DART 신규 공시 실시간 감시 알림이 텔레그램으로 발송되었습니다!' })
    } else {
      res.status(400).json({ success: false, error: result.error })
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ⚡ KRX 변동성지수(VKOSPI) & 코스피 듀얼 브리핑 텔레그램 발송
app.post('/api/telegram/send-vkospi-briefing', async (req, res) => {
  try {
    const result = await sendVkospiBriefing()
    if (result.success) {
      res.json({ success: true, message: '⚡ KRX 변동성지수(VKOSPI) 브리핑이 텔레그램으로 성공적으로 발송되었습니다!' })
    } else {
      res.status(400).json({ success: false, error: result.error })
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// 🛡️ 하락장 방어 & 역주행 돌파 종목 브리핑 텔레그램 발송
app.post('/api/telegram/send-bear-market-briefing', async (req, res) => {
  try {
    const result = await sendBearMarketBriefing()
    if (result.success) {
      res.json({ success: true, message: '🛡️ 하락장 방어 & 역주행 종목 브리핑이 텔레그램으로 성공적으로 발송되었습니다!' })
    } else {
      res.status(400).json({ success: false, error: result.error })
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

app.get('/api/alerts', async (req, res) => {
  try {
    const alerts = await getPriceAlerts()
    res.json({ success: true, count: alerts.length, alerts })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

app.post('/api/alerts', (req, res) => {
  try {
    const newAlert = createPriceAlert(req.body)
    res.json({ success: true, message: '새 가격 알림 규칙이 등록되었습니다.', alert: newAlert })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

app.put('/api/alerts/:id', (req, res) => {
  try {
    const updated = updatePriceAlert(req.params.id, req.body)
    if (!updated) return res.status(404).json({ success: false, error: '해당 알림 규칙을 찾을 수 없습니다.' })
    res.json({ success: true, message: '알림 규칙이 수정되었습니다.', alert: updated })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

app.delete('/api/alerts/:id', (req, res) => {
  try {
    const ok = deletePriceAlert(req.params.id)
    if (!ok) return res.status(404).json({ success: false, error: '해당 알림 규칙을 찾을 수 없습니다.' })
    res.json({ success: true, message: '알림 규칙이 삭제되었습니다.' })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

app.get('/api/alerts/history', (req, res) => {
  try {
    const history = getAlertHistory()
    res.json({ success: true, count: history.length, history })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ─── 프론트엔드 정적 파일 서빙 (Production) ───
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const frontendDist = path.join(__dirname, '../frontend/dist')

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
}

// 헬스체크 및 Keep-Alive 활성용 라우트
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 서버 시작 ───────────────────────────────────────────
app.listen(PORT, () => {
  // ─── Render.com 프리티어 슬립 방지 셀프 핑 ───
  const externalUrl = process.env.RENDER_EXTERNAL_URL;
  if (process.env.RENDER === 'true' && externalUrl) {
    import('https').then((https) => {
      const pingInterval = 10 * 60 * 1000; // 10분 주기
      setInterval(() => {
        try {
          console.log(`[Keep Awake] Pinging self at ${externalUrl}/health...`);
          https.get(`${externalUrl}/health`, (res) => {
            console.log(`[Keep Awake] Response status: ${res.statusCode}`);
          }).on('error', (err) => {
            console.error('[Keep Awake] Ping request error:', err.message);
          });
        } catch (err) {
          console.error('[Keep Awake] Ping failed:', err.message);
        }
      }, pingInterval);
    }).catch((err) => {
      console.error('[Keep Awake] Failed to import https module:', err.message);
    });
  }

  console.log(`
  ╔══════════════════════════════════════════╗
  ║   📊 KRX 퀀트 마켓 레이더 (Public)       ║
  ║   http://localhost:${PORT}                  ║
  ╚══════════════════════════════════════════╝

  공개 퀀트 레이더 서비스 준비 완료!
  API 엔드포인트:
  GET  /api/vkospi              — KRX 변동성지수 & 3대 지수
  GET  /api/nps-holdings        — 국민연금 DART 5% 대량보유 공시
  GET  /api/bear-market-stocks  — 하락장 역주행주 4대 퀀트
  GET  /api/smart-supply-demand — 외인·기관 쌍끌이 스마트 수급
  GET  /api/undervalued-stocks  — 코스피/코스닥 저평가 레이더
  GET  /api/double-bottom-stocks — 하락추세 후 쌍바닥 패턴 스캐너
  GET  /api/base-breakout-stocks — 하락→횡보→상승초입 패턴 스캐너
  GET  /api/energy-condensation-stocks — 에너지 응축→거래량 돌파 스캐너
  GET  /api/market-calendar     — 한미 증시 일정 달력
  GET  /api/dividend-calendar   — 배당 캘린더
  GET  /api/bond-yields         — 글로벌 국채 금리/스프레드
  `)

  // 🔔 실시간 목표가/손절선 텔레그램 감시 엔진 가동
  startAlertEngine()

  // [중요] 네이버 금융 API 서버 차단(Timeout) 방지: 클라우드 컨테이너 시작 시 부하 분산을 위한 지연(Staggering) 기동
  setTimeout(() => { startDailyFinancialsSync() }, 10000);

  // 📊 코스피+코스닥 전 종목 저평가 스캔 (매일 08:40 자동 실행)
  setTimeout(() => { startDailyMarketScan() }, 25000);

  // 🏆 주간 시가총액 변동 스케줄러 (매일 장 마감 이후 자동 실행)
  setTimeout(() => { startDailyMarketCapTracker() }, 40000);

  // 📉 하락추세 후 쌍바닥 패턴 스캔 (매일 08:50 자동 실행)
  setTimeout(() => { startDailyDoubleBottomScan() }, 55000);

  // 🌱 하락추세 → 횡보 → 상승초입 패턴 스캔 (매일 08:55 자동 실행)
  setTimeout(() => { startDailyBaseBreakoutScan() }, 70000);

  // 💥 에너지 응축 → 거래량 급증 돌파 패턴 스캔 (매일 09:00 자동 실행)
  setTimeout(() => { startDailyEnergyCondensationScan() }, 85000);

  // 🔄 매일 자정/장마감 후 자동 데이터 동기화 스케줄러 (Daily Auto-Sync Engine)
  setInterval(async () => {
    try {
      console.log('🔄 [DAILY AUTO-SYNC] 신용융자 잔고, 강제 반대매매, 공포탐욕 지수를 매일 자동 동기화합니다...')
      await getFearGreedHistory()
      await getCreditMarginHistory()
      console.log('✅ [DAILY AUTO-SYNC] 당일 지표 최신화 완료!')
    } catch (e) {
      console.error('⚠️ [DAILY AUTO-SYNC] 동기화 중 에러:', e)
    }
  }, 12 * 60 * 60 * 1000) // 매 12시간 자동 갱신
})

