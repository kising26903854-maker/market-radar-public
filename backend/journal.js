// journal.js — 투자 일지 지속성 DB 관리 모듈 (Persistent Local File DB)
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, 'data')
const DB_FILE = path.join(DATA_DIR, 'trading_journals.json')

// DB 디렉토리 및 파일 초기화
function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
  if (!fs.existsSync(DB_FILE)) {
    const initialSeed = [
      {
        id: 'j_seed_1',
        date: '2026-07-29',
        stockCode: '0182R0',
        stockName: '1Q K반도체TOP2+',
        type: 'BUY', // BUY, SELL, HOLD, MEMO
        price: 15129,
        quantity: 291,
        totalAmount: 4402539,
        title: '1Q K반도체TOP2+ 세력 매집 바닥선 1차 매수 진입',
        content: '15,100원~15,300원 POC 세력 매물 지지선 확인 후 291주 분할 매수 완료.\n7/15 148억 반대매매 대폭발로 개미 빚투 물량이 청산되었으며, 17,055원까지 매물 공백 0% 구간 존재 확인. 1차 익절 16,200원(30%), 2차 잭팟 17,055원(50%) 설정.',
        emotion: '🔥 확신',
        tags: ['매물공백', '월가5대지표', '개미털기완료'],
        createdAt: new Date().toISOString()
      },
      {
        id: 'j_seed_2',
        date: '2026-07-29',
        stockCode: '090430',
        stockName: '아모레퍼시픽',
        type: 'BUY',
        price: 122853,
        quantity: 17,
        totalAmount: 2088501,
        title: '아모레퍼시픽 턴어라운드 수급 매수',
        content: '중국 소비 반등 및 퀀트 수급 지표 턴어라운드 확인. 17주 홀딩 전술 유지.',
        emotion: '🟢 침착',
        tags: ['소비재', '수급개선'],
        createdAt: new Date().toISOString()
      }
    ]
    fs.writeFileSync(DB_FILE, JSON.stringify(initialSeed, null, 2), 'utf-8')
  }
}

// 전체 일지 읽기
export function getAllJournals(filter = {}) {
  ensureDb()
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8')
    let journals = JSON.parse(raw)

    // 필터링 (종목코드, 타입, 검색어)
    if (filter.stockCode) {
      journals = journals.filter(j => j.stockCode === filter.stockCode)
    }
    if (filter.type) {
      journals = journals.filter(j => j.type === filter.type)
    }
    if (filter.keyword) {
      const kw = filter.keyword.toLowerCase()
      journals = journals.filter(j =>
        (j.title && j.title.toLowerCase().includes(kw)) ||
        (j.content && j.content.toLowerCase().includes(kw)) ||
        (j.stockName && j.stockName.toLowerCase().includes(kw))
      )
    }

    // 날짜 역순 정렬 (최신순)
    journals.sort((a, b) => new Date(b.date + ' ' + (b.createdAt || '')) - new Date(a.date + ' ' + (a.createdAt || '')))
    return journals
  } catch (e) {
    console.error('[DB] 일지 읽기 실패:', e.message)
    return []
  }
}

// 신규 일지 저장
export function createJournal(data) {
  ensureDb()
  const journals = getAllJournals()
  const newJournal = {
    id: `j_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    date: data.date || new Date().toISOString().split('T')[0],
    stockCode: data.stockCode || '0182R0',
    stockName: data.stockName || '종목',
    type: data.type || 'BUY',
    price: Number(data.price) || 0,
    quantity: Number(data.quantity) || 0,
    totalAmount: (Number(data.price) || 0) * (Number(data.quantity) || 0),
    title: data.title || '투자 일지',
    content: data.content || '',
    emotion: data.emotion || '🟢 침착',
    tags: Array.isArray(data.tags) ? data.tags : (data.tags ? data.tags.split(',').map(t => t.trim()) : []),
    createdAt: new Date().toISOString()
  }

  journals.unshift(newJournal)
  fs.writeFileSync(DB_FILE, JSON.stringify(journals, null, 2), 'utf-8')
  return newJournal
}

// 일지 수정
export function updateJournal(id, updateData) {
  ensureDb()
  const journals = getAllJournals()
  const idx = journals.findIndex(j => j.id === id)
  if (idx === -1) return null

  journals[idx] = {
    ...journals[idx],
    ...updateData,
    totalAmount: (Number(updateData.price ?? journals[idx].price) || 0) * (Number(updateData.quantity ?? journals[idx].quantity) || 0),
    updatedAt: new Date().toISOString()
  }

  fs.writeFileSync(DB_FILE, JSON.stringify(journals, null, 2), 'utf-8')
  return journals[idx]
}

// 일지 삭제
export function deleteJournal(id) {
  ensureDb()
  let journals = getAllJournals()
  const initialLength = journals.length
  journals = journals.filter(j => j.id !== id)

  if (journals.length < initialLength) {
    fs.writeFileSync(DB_FILE, JSON.stringify(journals, null, 2), 'utf-8')
    return true
  }
  return false
}
