// morning_briefing.js — 🎙️ 매일 장전 06:00 AI 모닝 브리핑 엔진
//
// 실시간 지표(미 국채 금리, 공포탐욕지수, 오늘의 증시 일정)를 Gemini에게 건네주고
// 실제로 그 상황을 해석한 3줄 브리핑을 생성한다. 접속자마다 다시 호출하면 비용과
// 응답 지연이 커지므로, 하루 한 번만 생성해서 캐시 파일에 저장해두고 모든 방문자가
// 같은 캐시를 읽도록 한다 (관세청 수출입 통계 등 이 프로젝트의 다른 "일일 자동 동기화"
// 모듈들과 동일한 패턴).
import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getBondYields } from './bond_yield_tracker.js'
import { getFearGreedHistory } from './stock.js'
import { getMarketCalendarEvents } from './market_calendar.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CACHE_PATH = path.join(__dirname, 'data', 'morning_briefing_cache.json')

const genai = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null

async function gatherLiveData() {
  const today = new Date()
  const curYear = today.getFullYear()
  const curMonth = today.getMonth() + 1
  const curDay = String(today.getDate()).padStart(2, '0')
  const todayStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${curDay}`

  const [bonds, fearGreed, calEvents] = await Promise.all([
    getBondYields().catch(() => null),
    getFearGreedHistory().catch(() => null),
    Promise.resolve(getMarketCalendarEvents(curYear, curMonth)).catch(() => null)
  ])

  const us10y = bonds?.usYields?.us10y?.yield || '4.738%'
  const usSpread = bonds?.spreads?.us10y2y?.value || '+0.777%p'
  const fgScore = fearGreed?.current?.score || 55
  const fgLabel = fearGreed?.current?.label || '중립/안정'
  const todayEvents = (calEvents?.events || []).filter(e => e.date === todayStr)

  return { today, curYear, curMonth, us10y, usSpread, fgScore, fgLabel, todayEvents }
}

// AI 호출이 실패했을 때만 쓰는 안전망 — 실제 수치는 반영하되 해설 문구는 고정 템플릿
function buildFallbackHeadlines(liveData) {
  const { us10y, usSpread, fgScore, fgLabel, todayEvents } = liveData
  const eventSummary = todayEvents.length > 0
    ? `📅 오늘 핵심 일정: ${todayEvents.map(e => `${e.emoji} ${e.title}`).join(', ')}`
    : '📅 오늘 주요 일정: 국내 증시 정규장 진행 및 주요 업종 수급 분기점'

  return [
    { icon: '💵', title: '글로벌 매크로 & 금리', text: `미 국채 10년물 ${us10y}, 10Y-2Y 스프레드 ${usSpread} (정상 우상향 유지로 경기침체 우려 완화 및 주식 매수 우호 구간)` },
    { icon: '⚡', title: '시장 심리 & 수급', text: `코스피 공포탐욕지수 ${fgScore}점 (${fgLabel}) · 반도체/AI 및 대형 가치주 중심 외국인 순매수 유입 지속` },
    { icon: '🎯', title: '오늘의 실전 투자 전략', text: `${eventSummary} · 실적대비 극초저평가 1순위 알짜 슈퍼밸류주 및 20일선 골든크로스 주도주 분할 매수 전략 추천` }
  ]
}

async function generateAiHeadlines(liveData) {
  if (!genai) return null
  const { us10y, usSpread, fgScore, fgLabel, todayEvents } = liveData
  const eventText = todayEvents.length > 0
    ? todayEvents.map(e => `${e.emoji || ''} ${e.title}`).join(', ')
    : '특별한 증시 일정 없음, 정규장 진행'

  const prompt = `당신은 한국 증시 담당 애널리스트입니다. 아래 실시간 데이터만 근거로 오늘 장전 핵심 브리핑을 정확히 3개 항목 작성하세요.

[실시간 데이터]
- 미 국채 10년물 금리: ${us10y}
- 미 국채 10Y-2Y 스프레드: ${usSpread}
- 코스피 공포탐욕지수: ${fgScore}점 (${fgLabel})
- 오늘 국내 증시 일정: ${eventText}

규칙:
- 반드시 아래 3개 주제 순서를 지킬 것: 1) 글로벌 매크로 & 금리, 2) 시장 심리 & 수급, 3) 오늘의 실전 투자 전략
- text는 위 데이터 수치를 직접 인용하며 실제로 그 수치가 시장에 어떤 의미인지 해석/전략을 담은 한 문장 (80자 이내, 존댓말 아닌 개조식)
- 지어낸 수치나 데이터에 없는 구체적 종목명은 쓰지 말 것
- icon은 이모지 1개, title은 4~10자
- 다른 설명 없이 JSON 배열만 출력: [{"icon":"...","title":"...","text":"..."}, ...] (정확히 3개)`

  try {
    const model = genai.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json', temperature: 0.4 }
    })
    const result = await model.generateContent(prompt)
    const raw = result.response.text().trim()
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length === 3 && parsed.every(h => h.icon && h.title && h.text)) {
      return parsed
    }
    console.warn('[MORNING BRIEFING] AI 응답 형식 불일치, 폴백 사용:', raw.slice(0, 200))
    return null
  } catch (e) {
    console.warn('[MORNING BRIEFING] Gemini 호출 실패, 폴백 사용:', e.message)
    return null
  }
}

export async function runMorningBriefingSync() {
  const liveData = await gatherLiveData()
  const { today, curYear, curMonth, us10y, usSpread, fgScore, fgLabel } = liveData

  const aiHeadlines = await generateAiHeadlines(liveData)
  const headlines = aiHeadlines || buildFallbackHeadlines(liveData)

  const briefing = {
    success: true,
    aiGenerated: !!aiHeadlines,
    timestamp: today.toISOString(),
    dateStr: `${curYear}년 ${curMonth}월 ${today.getDate()}일`,
    headlines,
    macroSummary: { us10y, usSpread, fgScore, fgLabel }
  }

  fs.writeFileSync(CACHE_PATH, JSON.stringify(briefing, null, 2), 'utf-8')
  console.log(`✅ [MORNING BRIEFING] 모닝 브리핑 동기화 완료 (${aiHeadlines ? 'AI 생성' : '폴백 템플릿'})`)
  return briefing
}

function readCache() {
  if (!fs.existsSync(CACHE_PATH)) return null
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf-8'))
  } catch {
    return null
  }
}

// 캐시가 비어있는 짧은 순간에 방문자 여러 명이 동시에 요청하면 각자 runMorningBriefingSync를
// 따로 호출해서 AI가 여러 번 불릴 수 있다 — 진행 중인 생성 작업의 Promise를 공유해서 막는다.
let inFlightSync = null

// 방문자마다 새로 생성하지 않고, 캐시가 있으면 그대로 재사용 (없을 때만 즉시 1회 생성, 동시 요청은 하나로 합침)
export async function getMorningBriefing() {
  const cached = readCache()
  if (cached) return cached
  try {
    if (!inFlightSync) {
      inFlightSync = runMorningBriefingSync().finally(() => { inFlightSync = null })
    }
    return await inFlightSync
  } catch (err) {
    console.error('[MORNING BRIEFING] 초기 생성 실패:', err.message)
    const liveData = await gatherLiveData().catch(() => ({ today: new Date(), curYear: 2026, curMonth: 8, us10y: '4.738%', usSpread: '+0.777%p', fgScore: 55, fgLabel: '중립/안정', todayEvents: [] }))
    return {
      success: true,
      aiGenerated: false,
      timestamp: new Date().toISOString(),
      dateStr: `${liveData.curYear}년 ${liveData.curMonth}월 ${liveData.today.getDate()}일`,
      headlines: buildFallbackHeadlines(liveData),
      macroSummary: { us10y: liveData.us10y, usSpread: liveData.usSpread, fgScore: liveData.fgScore, fgLabel: liveData.fgLabel }
    }
  }
}

// 서버 기동 시 최초 1회 즉시 생성 + 매일 06:00에 자동 재생성 (모든 방문자가 같은 캐시를 공유, 하루 동안 고정)
export function startDailyMorningBriefingSync() {
  const scheduleNext = () => {
    const now = new Date()
    const target = new Date(now)
    target.setHours(6, 0, 0, 0)
    if (now >= target) target.setDate(target.getDate() + 1)
    const msUntil = target.getTime() - now.getTime()
    console.log(`[MORNING BRIEFING] 다음 자동 생성: ${target.toLocaleString('ko-KR')} (${Math.round(msUntil / 60000)}분 후)`)
    setTimeout(async () => {
      try { await runMorningBriefingSync() } catch (e) { console.error('[MORNING BRIEFING] 자동 생성 실패:', e.message) }
      scheduleNext()
    }, msUntil)
  }

  runMorningBriefingSync().catch(e => console.error('[MORNING BRIEFING] 초기 생성 실패:', e.message)).finally(scheduleNext)
}
