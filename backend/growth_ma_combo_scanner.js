// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🚀🎯 growth_ma_combo_scanner.js
// "4대 재무 퀀트 발굴기"의 강력 후보군(4개 조건 중 2개 이상 만족)을 1차 필터로 삼고,
// 그 종목들에만 "2·5·6 기법"(이평선 역배열→골든크로스 초입) 패턴을 2차로 적용하는
// 콤보 스캐너. 전 종목이 아니라 이미 재무로 걸러진 소규모 풀만 스캔하므로 훨씬 빠르다.
// - 매일 09:40 자동 갱신 + 캐시 저장 (재무 발굴기·전종목 256기법 스캐너보다 늦게 실행)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { runGrowthStockScreener } from './growth_stock_screener.js'
import { fetchDailySeries } from './double_bottom_scanner.js'
import { detectMaReversalPattern, isExcludedStock } from './ma_reversal_scanner.js'
import { getRealAssetGrowthRate } from './dart_asset_growth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_PATH = path.join(__dirname, 'data', 'growth_ma_combo_cache.json')

const PATTERN_SETS = [
  { key: 'short', label: '단기 (5·20·60일선)', trigger: 5, mid: 20, outer: 60, historyPages: 2 },   // 120거래일
  { key: 'long', label: '중장기 (5·112·224일선)', trigger: 5, mid: 112, outer: 224, historyPages: 6 }, // 360거래일
]

const MIN_MATCHED_CONDITIONS = 2 // 4대 재무 조건 중 이 개수 이상 만족한 종목만 1차 후보군으로 채택

let scanInFlight = null

export function runGrowthMaComboScan() {
  if (scanInFlight) {
    console.log('[GROWTH+MA COMBO] 이미 스캔이 진행 중이라 요청을 건너뜁니다.')
    return scanInFlight
  }
  scanInFlight = executeCombo().finally(() => { scanInFlight = null })
  return scanInFlight
}

async function executeCombo() {
  console.log('\n[GROWTH+MA COMBO] 4대 퀀트 강력 후보군(조건 2개↑) 대상 "256 기법" 2차 스캔 시작...')
  const startTime = Date.now()

  const growthData = await runGrowthStockScreener(false) // 2시간 캐시 있으면 그대로 재사용
  const universe = (growthData.allStocks || []).filter(s => s.matchedCount >= MIN_MATCHED_CONDITIONS)
  console.log(`[GROWTH+MA COMBO] 1차 필터(재무 조건 ${MIN_MATCHED_CONDITIONS}개 이상) 통과: ${universe.length}종목`)

  const resultsBySet = { short: [], long: [] }
  const maxPages = Math.max(...PATTERN_SETS.map(s => s.historyPages))
  let excludedCount = 0

  const batchSize = 8
  for (let i = 0; i < universe.length; i += batchSize) {
    const batch = universe.slice(i, i + batchSize)
    await Promise.all(batch.map(async (s) => {
      if (await isExcludedStock(s.code)) { excludedCount++; return } // 거래정지/관리종목 제외

      const [series, realAssetGrowthRate] = await Promise.all([
        fetchDailySeries(s.code, maxPages),
        getRealAssetGrowthRate(s.code), // DART 재무상태표 실제 자산총계 기준 정확한 증가율 (실패 시 null → 추정치로 폴백)
      ])
      if (!series || series.length === 0) return

      for (const set of PATTERN_SETS) {
        const pattern = detectMaReversalPattern(series, set)
        if (!pattern) continue
        resultsBySet[set.key].push({
          code: s.code,
          name: s.name,
          // growth_stock_screener.js는 market을 영문(KOSPI/KOSDAQ)으로 담아두는데, 이 앱의
          // 다른 스캐너/차트는 전부 한글(코스피/코스닥) 표기를 쓰므로 여기서 맞춰준다.
          market: s.market === 'KOSPI' ? '코스피' : (s.market === 'KOSDAQ' ? '코스닥' : s.market),
          // 1차(재무) 필터 정보
          matchedCount: s.matchedCount,
          matchTags: s.matchTags,
          revenueGrowthRate: s.revenueGrowthRate,
          opProfitGrowthRate: s.opProfitGrowthRate,
          assetGrowthRate: s.assetGrowthRate, // BPS 기반 추정치(전체 스크리닝 랭킹에 쓰인 값, 그대로 보존)
          realAssetGrowthRate, // DART 실제 자산총계 기준 검증 수치 (null이면 DART 조회 실패 → 프론트에서 추정치로 폴백 표시)
          debtRatio: s.debtRatio,
          growthScore: s.growthScore,
          // 2차(기술적) 패턴 정보
          catalyst: `${set.trigger}일선이 ${set.mid}일선을 상향 돌파 (${pattern.crossDate}), ${set.outer}일선 돌파 직전`,
          ...pattern,
        })
      }
    }))

    if (i + batchSize < universe.length) await new Promise(r => setTimeout(r, 150))
    process.stdout.write(`\r[GROWTH+MA COMBO] 진행: ${Math.min(i + batchSize, universe.length)}/${universe.length}종목 (단기 ${resultsBySet.short.length} / 중장기 ${resultsBySet.long.length}, 거래정지·관리종목 제외 ${excludedCount})`)
  }
  console.log('')

  PATTERN_SETS.forEach(set => resultsBySet[set.key].sort((a, b) => b.score - a.score))
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  const cache = {
    lastSyncAt: new Date().toISOString(),
    elapsedSec: parseFloat(elapsed),
    minMatchedConditions: MIN_MATCHED_CONDITIONS,
    totalCandidates: universe.length,
    excludedCount, // 거래정지/관리종목(투자주의환기 포함)으로 제외된 종목 수
    growthScanTimestamp: growthData.timestamp || null,
    short: resultsBySet.short,
    long: resultsBySet.long,
  }

  const dir = path.dirname(CACHE_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8')

  console.log(`[GROWTH+MA COMBO] ✅ 완료! ${elapsed}초 소요. 1차 후보 ${universe.length}종목 중 거래정지·관리종목 ${excludedCount}종목 제외, 단기 ${resultsBySet.short.length} / 중장기 ${resultsBySet.long.length}종목 최종 발굴 → ${CACHE_PATH}`)
  return cache
}

export function getGrowthMaComboCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'))
  } catch {
    return null
  }
}

export function isGrowthMaComboStale() {
  const cache = getGrowthMaComboCache()
  if (!cache?.lastSyncAt) return true
  return (Date.now() - new Date(cache.lastSyncAt).getTime()) > 20 * 60 * 60 * 1000
}

// 서버 기동 시(캐시 없거나 20시간 이상 오래됐을 때만) 즉시 1회 + 매일 09:40 자동 재스캔
// (재무 발굴기 08:40대, 전종목 256기법 스캐너 09:25보다 늦게 돌려서 최신 결과를 재사용)
export function startDailyGrowthMaComboScan() {
  const scheduleNext = () => {
    const now = new Date()
    const target = new Date(now)
    target.setHours(9, 40, 0, 0)
    if (now >= target) target.setDate(target.getDate() + 1)
    const msUntil = target.getTime() - now.getTime()
    console.log(`[GROWTH+MA COMBO] 다음 자동 스캔: ${target.toLocaleString('ko-KR')} (${Math.round(msUntil / 60000)}분 후)`)
    setTimeout(async () => {
      try { await runGrowthMaComboScan() } catch (e) { console.error('[GROWTH+MA COMBO] 자동 스캔 실패:', e.message) }
      scheduleNext()
    }, msUntil)
  }

  if (isGrowthMaComboStale()) {
    runGrowthMaComboScan().then(() => scheduleNext()).catch(e => {
      console.error('[GROWTH+MA COMBO] 초기 스캔 실패:', e.message)
      scheduleNext()
    })
  } else {
    console.log('[GROWTH+MA COMBO] 캐시 유효. 다음 예약 시간으로 스케줄합니다.')
    scheduleNext()
  }
}
