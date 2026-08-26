// portfolio_db.js — 보유 종목 및 관심 종목 영구 보관 DB 모듈 (Persistent Local File DB)
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, 'data')
const PORTFOLIO_FILE = path.join(DATA_DIR, 'portfolio_positions.json')
const WATCHLIST_FILE = path.join(DATA_DIR, 'watchlist_stocks.json')

// DB 디렉토리 및 초기 파일 자동 생성
function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  // 1. 보유 종목 영구 DB 초기화
  if (!fs.existsSync(PORTFOLIO_FILE)) {
    const defaultPositions = [
      {
        code: '0182R0',
        name: '1Q K반도체TOP2+',
        type: 'ETF',
        shares: 291,
        buy_price: 15129,
        buyDate: '2026-07-15',
        note: '세력 바닥선 지지 매수'
      },
      {
        code: '090430',
        name: '아모레퍼시픽',
        type: '주식',
        shares: 17,
        buy_price: 122853,
        buyDate: '2026-07-20',
        note: '턴어라운드 수급 매수'
      },
      {
        code: '030000',
        name: '제일기획',
        type: '주식',
        shares: 1,
        buy_price: 19170,
        buyDate: '2026-07-28',
        note: '배당 및 안정 수급 매수'
      }
    ]
    fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(defaultPositions, null, 2), 'utf-8')
  }

  // 2. 관심 종목 영구 DB 초기화
  if (!fs.existsSync(WATCHLIST_FILE)) {
    const defaultWatchlist = [
      { code: '005930', name: '삼성전자', note: '반도체 대장주 턴어라운드 감시' },
      { code: '000660', name: 'SK하이닉스', note: 'HBM 수급 및 매물대 감시' },
      { code: '035720', name: '카카오', note: '플랫폼 지지선 감시' }
    ]
    fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(defaultWatchlist, null, 2), 'utf-8')
  }
}

// ─── 보유 종목 DB CRUD ────────────────────────────────────────

// 보유 종목 전체 조회
export function getSavedPositions() {
  ensureDb()
  try {
    const raw = fs.readFileSync(PORTFOLIO_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    console.error('[DB] 보유 종목 읽기 실패:', e.message)
    return []
  }
}

// 보유 종목 추가 또는 업데이트
export function savePosition(position) {
  ensureDb()
  const positions = getSavedPositions()
  const idx = positions.findIndex(p => p.code === position.code)

  const newPos = {
    code: position.code,
    name: position.name || position.code,
    type: position.type || '주식',
    shares: Number(position.shares) || 0,
    buy_price: Number(position.buy_price) || 0,
    buyDate: position.buyDate || new Date().toISOString().split('T')[0],
    note: position.note || ''
  }

  if (idx >= 0) {
    positions[idx] = { ...positions[idx], ...newPos }
  } else {
    positions.push(newPos)
  }

  fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(positions, null, 2), 'utf-8')
  return newPos
}

// 보유 종목 삭제
export function deletePosition(code) {
  ensureDb()
  let positions = getSavedPositions()
  const initLen = positions.length
  positions = positions.filter(p => p.code !== code)

  if (positions.length < initLen) {
    fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(positions, null, 2), 'utf-8')
    return true
  }
  return false
}


// ─── 관심 종목 DB CRUD ────────────────────────────────────────

// 관심 종목 전체 조회
export function getSavedWatchlist() {
  ensureDb()
  try {
    const raw = fs.readFileSync(WATCHLIST_FILE, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    console.error('[DB] 관심 종목 읽기 실패:', e.message)
    return []
  }
}

// 관심 종목 추가
export function saveWatchlistStock(item) {
  ensureDb()
  const list = getSavedWatchlist()
  const idx = list.findIndex(w => w.code === item.code)

  const newItem = {
    code: item.code,
    name: item.name || item.code,
    note: item.note || '',
    addedAt: new Date().toISOString()
  }

  if (idx >= 0) {
    list[idx] = { ...list[idx], ...newItem }
  } else {
    list.push(newItem)
  }

  fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(list, null, 2), 'utf-8')
  return newItem
}

// 관심 종목 삭제
export function deleteWatchlistStock(code) {
  ensureDb()
  let list = getSavedWatchlist()
  const initLen = list.length
  list = list.filter(w => w.code !== code)

  if (list.length < initLen) {
    fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(list, null, 2), 'utf-8')
    return true
  }
  return false
}
