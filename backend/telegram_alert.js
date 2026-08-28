// telegram_alert.js — 🔔 실시간 보유종목/관심종목 분리 알리미 & 텔레그램 봇 푸시 모듈
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { getStockPrice } from './stock.js';
import { getSavedPositions, getSavedWatchlist } from './portfolio_db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const ALERTS_FILE = path.join(DATA_DIR, 'price_alerts.json');
const CONFIG_FILE = path.join(DATA_DIR, 'telegram_config.json');
const HISTORY_FILE = path.join(DATA_DIR, 'alert_history.json');

// 디렉토리 및 파일 무결성 보장
function ensureFiles() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // 1. 텔레그램 설정 초기화
  if (!fs.existsSync(CONFIG_FILE)) {
    const initialConfig = {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: process.env.TELEGRAM_CHAT_ID || '',
      userName: '',
      isEnabled: true,
      notifyHoldings: true,
      notifyWatchlist: true,
      notifyOnTarget: true,
      notifyOnStopLoss: true,
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(initialConfig, null, 2), 'utf8');
  }

  // 2. 알림 규칙 기본 시드 데이터
  if (!fs.existsSync(ALERTS_FILE)) {
    const initialAlerts = [
      // 💼 보유종목 알림
      {
        id: 'alert_0182r0',
        category: 'HOLDING',
        stockCode: '0182R0',
        stockName: '1Q K반도체TOP2+',
        buyPrice: 15129,
        targetPrice: 17050,
        stopLossPrice: 14500,
        isEnabled: true,
        memo: '보유수량 237주 | 월가 POC 매물 공백 17,055원 돌파 시 1차 분할 익절',
        lastTriggeredAt: null,
        createdAt: new Date().toISOString()
      },
      {
        id: 'alert_454910',
        category: 'HOLDING',
        stockCode: '454910',
        stockName: '두산로보틱스',
        buyPrice: 69200,
        targetPrice: 76000,
        stopLossPrice: 63000,
        isEnabled: true,
        memo: '보유수량 2주 | 국민연금 5% 공시 및 로봇 테마 1차 목표가',
        lastTriggeredAt: null,
        createdAt: new Date().toISOString()
      },
      // ⭐ 관심종목 매수 타점 알림
      {
        id: 'alert_005930',
        category: 'WATCHLIST',
        stockCode: '005930',
        stockName: '삼성전자',
        buyPrice: 0,
        targetPrice: 75000,
        stopLossPrice: 70000,
        isEnabled: true,
        memo: '반도체 대장주 지지선(75,000원) 도달 시 1차 분할 매수 타점',
        lastTriggeredAt: null,
        createdAt: new Date().toISOString()
      },
      {
        id: 'alert_000660',
        category: 'WATCHLIST',
        stockCode: '000660',
        stockName: 'SK하이닉스',
        buyPrice: 0,
        targetPrice: 220000,
        stopLossPrice: 200000,
        isEnabled: true,
        memo: 'HBM 공급 확대 지지선 눌림목 매수 감시',
        lastTriggeredAt: null,
        createdAt: new Date().toISOString()
      },
      {
        id: 'alert_090430',
        category: 'WATCHLIST',
        stockCode: '090430',
        stockName: '아모레퍼시픽',
        buyPrice: 0,
        targetPrice: 138000,
        stopLossPrice: 125000,
        isEnabled: true,
        memo: 'COSRX 실적 서프라이즈 눌림목 재매수 타점 감시',
        lastTriggeredAt: null,
        createdAt: new Date().toISOString()
      },
      {
        id: 'alert_348370',
        category: 'WATCHLIST',
        stockCode: '348370',
        stockName: '엔켐',
        buyPrice: 0,
        targetPrice: 180000,
        stopLossPrice: 160000,
        isEnabled: true,
        memo: '2차전지 전해액 미국 공장 가동 모멘텀 감시',
        lastTriggeredAt: null,
        createdAt: new Date().toISOString()
      },
      {
        id: 'alert_000270',
        category: 'WATCHLIST',
        stockCode: '000270',
        stockName: '기아',
        buyPrice: 0,
        targetPrice: 115000,
        stopLossPrice: 105000,
        isEnabled: true,
        memo: '고배당 & 북미 하이브리드 판매 호조 지지선 감시',
        lastTriggeredAt: null,
        createdAt: new Date().toISOString()
      }
    ];
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(initialAlerts, null, 2), 'utf8');
  }

  // 3. 발송 히스토리 로그
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

// 텔레그램 설정 조회
export function getTelegramConfig() {
  ensureFiles();
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const config = JSON.parse(raw);
    if (!config.botToken && process.env.TELEGRAM_BOT_TOKEN) {
      config.botToken = process.env.TELEGRAM_BOT_TOKEN;
    }
    if (!config.chatId && process.env.TELEGRAM_CHAT_ID) {
      config.chatId = process.env.TELEGRAM_CHAT_ID;
    }
    return config;
  } catch (e) {
    console.error('[Telegram] 설정 로드 실패:', e.message);
    return { botToken: '', chatId: '', isEnabled: false };
  }
}

// 텔레그램 설정 저장
export function saveTelegramConfig(newConfig) {
  ensureFiles();
  const current = getTelegramConfig();
  const updated = {
    ...current,
    ...newConfig,
    lastUpdated: new Date().toISOString()
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

// 텔레그램 getUpdates를 통해 사용자의 Chat ID 자동 감지
export async function detectTelegramChatId(token = null) {
  const config = getTelegramConfig();
  const botToken = (token || config.botToken)?.trim();
  if (!botToken) {
    return { success: false, error: '봇 토큰이 등록되지 않았습니다.' };
  }

  try {
    const res = await axios.get(`https://api.telegram.org/bot${botToken}/getUpdates`, { timeout: 6000 });
    const updates = res.data?.result || [];
    if (updates.length === 0) {
      return {
        success: false,
        error: '봇 채팅방에서 아직 메시지를 보내지 않으셨습니다. 텔레그램에서 @kising0529Bot 에게 /start 또는 아무 메시지를 보낸 후 다시 눌러주세요!'
      };
    }

    const lastUpdate = updates[updates.length - 1];
    const msg = lastUpdate.message || lastUpdate.edited_message || lastUpdate.channel_post || lastUpdate.my_chat_member;
    const chatId = msg?.chat?.id;
    const fromName = msg?.from?.first_name || msg?.chat?.first_name || msg?.chat?.title || '사용자';

    if (chatId) {
      saveTelegramConfig({ chatId: String(chatId), userName: fromName });
      return { success: true, chatId: String(chatId), fromName };
    } else {
      return { success: false, error: 'Chat ID를 찾을 수 없습니다.' };
    }
  } catch (err) {
    return { success: false, error: err.response?.data?.description || err.message };
  }
}

// 텔레그램 메시지 발송 함수
export async function sendTelegramMessage(text, parseMode = 'HTML') {
  const config = getTelegramConfig();
  const botToken = config.botToken?.trim();
  const chatId = config.chatId?.trim();

  if (!botToken || !chatId) {
    return { success: false, error: '텔레그램 봇 토큰(Bot Token) 또는 Chat ID가 설정되지 않았습니다.' };
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await axios.post(url, {
      chat_id: chatId,
      text: text,
      parse_mode: parseMode,
      disable_web_page_preview: true
    }, { timeout: 6000 });

    if (res.data?.ok) {
      return { success: true, messageId: res.data.result?.message_id };
    } else {
      return { success: false, error: res.data?.description || '발송 응답 오류' };
    }
  } catch (err) {
    const errMsg = err.response?.data?.description || err.message;
    console.error('[Telegram] 메시지 발송 실패:', errMsg);
    return { success: false, error: errMsg };
  }
}

// 알림 히스토리 기록
function logAlertHistory(item) {
  ensureFiles();
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    const logs = JSON.parse(raw);
    logs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      ...item
    });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(logs.slice(0, 200), null, 2), 'utf8');
  } catch (e) {
    console.error('[Alert] 로그 기록 실패:', e.message);
  }
}

// 알림 히스토리 조회
export function getAlertHistory() {
  ensureFiles();
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

// 알림 규칙 목록 조회 (실시간 시세 & 도달율 계산 결합)
export async function getPriceAlerts(categoryFilter = null) {
  ensureFiles();
  try {
    const raw = fs.readFileSync(ALERTS_FILE, 'utf8');
    let alerts = JSON.parse(raw);

    if (categoryFilter) {
      alerts = alerts.filter(a => a.category === categoryFilter);
    }

    const enriched = await Promise.all(
      alerts.map(async (alert) => {
        let currentPrice = 0;
        let changeRate = 0;
        try {
          const stock = await getStockPrice(alert.stockCode);
          if (stock && stock.price) {
            currentPrice = stock.price;
            changeRate = stock.changeRate || 0;
          }
        } catch (e) {}

        const isHolding = (alert.category || 'HOLDING') === 'HOLDING';

        // 목표가/진입가까지 남은 % (Gap to Target)
        let gapToTargetPct = 0;
        let isTargetReached = false;
        if (alert.targetPrice > 0 && currentPrice > 0) {
          if (isHolding) {
            gapToTargetPct = parseFloat((((alert.targetPrice - currentPrice) / currentPrice) * 100).toFixed(2));
            isTargetReached = currentPrice >= alert.targetPrice;
          } else {
            // 관심종목: 현재가가 목표 진입가 이하로 내려오면 매수 타점 도달!
            gapToTargetPct = parseFloat((((currentPrice - alert.targetPrice) / currentPrice) * 100).toFixed(2));
            isTargetReached = currentPrice <= alert.targetPrice;
          }
        }

        // 손절선/지지선까지 남은 %
        let gapToStopLossPct = 0;
        let isStopLossTriggered = false;
        if (alert.stopLossPrice > 0 && currentPrice > 0) {
          gapToStopLossPct = parseFloat((((currentPrice - alert.stopLossPrice) / currentPrice) * 100).toFixed(2));
          isStopLossTriggered = currentPrice <= alert.stopLossPrice;
        }

        // 보유단가 대비 수익률
        let profitRate = 0;
        if (alert.buyPrice > 0 && currentPrice > 0) {
          profitRate = parseFloat((((currentPrice - alert.buyPrice) / alert.buyPrice) * 100).toFixed(2));
        }

        return {
          ...alert,
          category: alert.category || 'HOLDING',
          currentPrice,
          changeRate,
          profitRate,
          gapToTargetPct,
          gapToStopLossPct,
          isTargetReached,
          isStopLossTriggered
        };
      })
    );

    return enriched;
  } catch (e) {
    console.error('[Alert] 목록 조회 실패:', e.message);
    return [];
  }
}

// 알림 규칙 추가
export function createPriceAlert(data) {
  ensureFiles();
  const raw = fs.readFileSync(ALERTS_FILE, 'utf8');
  const alerts = JSON.parse(raw);

  const newAlert = {
    id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    category: data.category || 'HOLDING',
    stockCode: data.stockCode,
    stockName: data.stockName,
    buyPrice: Number(data.buyPrice) || 0,
    targetPrice: Number(data.targetPrice) || 0,
    stopLossPrice: Number(data.stopLossPrice) || 0,
    isEnabled: data.isEnabled !== false,
    memo: data.memo || '',
    lastTriggeredAt: null,
    createdAt: new Date().toISOString()
  };

  alerts.push(newAlert);
  fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2), 'utf8');
  return newAlert;
}

// 알림 규칙 수정
export function updatePriceAlert(id, data) {
  ensureFiles();
  const raw = fs.readFileSync(ALERTS_FILE, 'utf8');
  let alerts = JSON.parse(raw);

  const idx = alerts.findIndex(a => a.id === id);
  if (idx === -1) return null;

  alerts[idx] = {
    ...alerts[idx],
    ...data,
    category: data.category || alerts[idx].category || 'HOLDING',
    buyPrice: data.buyPrice !== undefined ? Number(data.buyPrice) : alerts[idx].buyPrice,
    targetPrice: data.targetPrice !== undefined ? Number(data.targetPrice) : alerts[idx].targetPrice,
    stopLossPrice: data.stopLossPrice !== undefined ? Number(data.stopLossPrice) : alerts[idx].stopLossPrice,
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2), 'utf8');
  return alerts[idx];
}

// 알림 규칙 삭제
export function deletePriceAlert(id) {
  ensureFiles();
  const raw = fs.readFileSync(ALERTS_FILE, 'utf8');
  let alerts = JSON.parse(raw);

  const filtered = alerts.filter(a => a.id !== id);
  if (filtered.length === alerts.length) return false;

  fs.writeFileSync(ALERTS_FILE, JSON.stringify(filtered, null, 2), 'utf8');
  return true;
}

// ─── 💼 1. 실제 보유종목 실시간 텔레그램 브리핑 전송 ───
export async function sendHoldingsBriefing() {
  const config = getTelegramConfig();
  const positions = getSavedPositions(); // 1Q K반도체TOP2+, 두산로보틱스 등 실제 DB 보유종목
  const alerts = await getPriceAlerts('HOLDING');
  const alertMap = new Map(alerts.map(a => [a.stockCode, a]));

  const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const userName = config.userName || '대표';

  if (positions.length === 0) {
    return { success: false, error: '등록된 보유종목이 없습니다.' };
  }

  let totalBuyAmt = 0;
  let totalEvalAmt = 0;

  const enrichedPositions = await Promise.all(
    positions.map(async (pos) => {
      let currentPrice = 0;
      let changeRate = 0;
      try {
        const stock = await getStockPrice(pos.code);
        if (stock && stock.price) {
          currentPrice = stock.price;
          changeRate = stock.changeRate || 0;
        }
      } catch (e) {}

      const shares = Number(pos.shares) || 0;
      const buyPrice = Number(pos.buy_price) || 0;
      const buyAmt = buyPrice * shares;
      const evalAmt = currentPrice > 0 ? currentPrice * shares : buyAmt;
      const profitAmt = evalAmt - buyAmt;
      const profitRate = buyPrice > 0 && currentPrice > 0 
        ? (((currentPrice - buyPrice) / buyPrice) * 100).toFixed(2)
        : '0.00';

      totalBuyAmt += buyAmt;
      totalEvalAmt += evalAmt;

      const alertRule = alertMap.get(pos.code) || {};
      const targetP = alertRule.targetPrice || Math.round((currentPrice || buyPrice) * 1.15 / 50) * 50;
      const stopP = alertRule.stopLossPrice || Math.round((currentPrice || buyPrice) * 0.95 / 50) * 50;
      const gapToTarget = currentPrice > 0 ? (((targetP - currentPrice) / currentPrice) * 100).toFixed(1) : '15.0';

      return {
        ...pos,
        currentPrice,
        changeRate,
        shares,
        buyPrice,
        buyAmt,
        evalAmt,
        profitAmt,
        profitRate,
        targetPrice: targetP,
        stopLossPrice: stopP,
        gapToTarget,
        memo: alertRule.memo || pos.note || ''
      };
    })
  );

  const totalProfitAmt = totalEvalAmt - totalBuyAmt;
  const totalProfitRate = totalBuyAmt > 0 ? ((totalProfitAmt / totalBuyAmt) * 100).toFixed(2) : '0.00';
  const totalSign = totalProfitAmt >= 0 ? '+' : '';

  let text = `💼 <b>[내 보유종목 실시간 포트폴리오 브리핑]</b>\n━━━━━━━━━━━━━━━━━\n👤 <b>${userName}</b>님의 보유 계좌 현황:\n`;
  text += `• <b>총 매입금액:</b> ${totalBuyAmt.toLocaleString()}원\n`;
  text += `• <b>총 평가금액:</b> <b>${totalEvalAmt.toLocaleString()}원</b>\n`;
  text += `• <b>총 평가손익:</b> <b>${totalSign}${totalProfitAmt.toLocaleString()}원 (${totalSign}${totalProfitRate}%)</b>\n━━━━━━━━━━━━━━━━━\n\n`;

  enrichedPositions.forEach((item, idx) => {
    const profitSign = Number(item.profitRate) >= 0 ? '+' : '';
    const profitColor = Number(item.profitRate) >= 0 ? '🔴' : '🔵';
    const isTargetReached = item.currentPrice >= item.targetPrice;
    const isStopLoss = item.currentPrice <= item.stopLossPrice;

    text += `${idx + 1}. <b>${item.name}</b> (<code>${item.code}</code>) × <b>${item.shares}주</b>\n`;
    text += `  • 현재가: <b>${item.currentPrice?.toLocaleString()}원</b> (매입단가: ${item.buyPrice?.toLocaleString()}원)\n`;
    text += `  • 평가손익: ${profitColor} <b>${profitSign}${item.profitAmt?.toLocaleString()}원 (${profitSign}${item.profitRate}%)</b>\n`;
    
    if (isTargetReached) {
      text += `  • 🎯 <b>1차 목표가 달성! (${item.targetPrice?.toLocaleString()}원 🚀)</b>\n`;
    } else {
      text += `  • 🎯 1차 목표가: <b>${item.targetPrice?.toLocaleString()}원</b> (+${item.gapToTarget}% 남음)\n`;
    }

    if (isStopLoss) {
      text += `  • 🛑 <b>손절선 이탈 경보! (${item.stopLossPrice?.toLocaleString()}원 ⚠️)</b>\n`;
    } else if (item.stopLossPrice > 0) {
      text += `  • 🛑 지지 손절선: <b>${item.stopLossPrice?.toLocaleString()}원</b>\n`;
    }

    if (item.memo) {
      text += `  • 💡 <i>${item.memo}</i>\n`;
    }
    text += `\n`;
  });

  text += `━━━━━━━━━━━━━━━━━\n💡 <i>월가 퀀트: 장중 목표가 도달 또는 지지선 이탈 시 텔레그램으로 자동 알림됩니다.</i>\n⏰ <i>${nowStr}</i>`;

  const res = await sendTelegramMessage(text);
  if (res.success) {
    logAlertHistory({
      category: 'HOLDING',
      type: 'BRIEFING',
      stockName: '보유종목 전체 브리핑',
      sentTelegram: true,
      message: text
    });
  }
  return res;
}

// ─── ⭐ 2. 실제 관심종목 텔레그램 레이더 브리핑 전송 ───
export async function sendWatchlistBriefing() {
  const config = getTelegramConfig();
  const watchlist = getSavedWatchlist(); // 삼성전자, SK하이닉스, 카카오, 기아, 엔켐, 아모레퍼시픽 등
  const alerts = await getPriceAlerts('WATCHLIST');
  const alertMap = new Map(alerts.map(a => [a.stockCode, a]));

  const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const userName = config.userName || '대표';

  if (watchlist.length === 0) {
    return { success: false, error: '등록된 관심종목이 없습니다.' };
  }

  const enrichedWatchlist = await Promise.all(
    watchlist.map(async (item) => {
      let currentPrice = 0;
      let changeRate = 0;
      try {
        const stock = await getStockPrice(item.code);
        if (stock && stock.price) {
          currentPrice = stock.price;
          changeRate = stock.changeRate || 0;
        }
      } catch (e) {}

      const alertRule = alertMap.get(item.code) || {};
      const targetEntry = alertRule.targetPrice || Math.round(currentPrice * 0.96 / 50) * 50;
      const isEntryReached = currentPrice > 0 && currentPrice <= targetEntry;
      const gapToEntry = currentPrice > 0 ? (((currentPrice - targetEntry) / currentPrice) * 100).toFixed(1) : '4.0';

      return {
        ...item,
        currentPrice,
        changeRate,
        targetEntry,
        isEntryReached,
        gapToEntry,
        memo: alertRule.memo || item.note || ''
      };
    })
  );

  let text = `⭐ <b>[관심종목 매수 타점 레이더 브리핑]</b>\n━━━━━━━━━━━━━━━━━\n📡 <b>${userName}</b>님의 관심종목 실시간 시세 & 진입 타점:\n\n`;

  enrichedWatchlist.forEach((item, idx) => {
    const changeSign = item.changeRate >= 0 ? '+' : '';
    const changeColor = item.changeRate >= 0 ? '🔺' : '🔻';

    text += `${idx + 1}. <b>${item.name}</b> (<code>${item.code}</code>)\n`;
    text += `  • 현재가: <b>${item.currentPrice?.toLocaleString()}원</b> (${changeColor} ${changeSign}${item.changeRate}%)\n`;
    
    if (item.isEntryReached) {
      text += `  • 🚀 <b>매수 진입 적기! (목표가 ${item.targetEntry?.toLocaleString()}원 이하 도달 ✨)</b>\n`;
    } else {
      text += `  • 🎯 목표 매수 진입가: <b>${item.targetEntry?.toLocaleString()}원</b> (현재가 대비 -${item.gapToEntry}%)\n`;
    }

    if (item.memo) {
      text += `  • 💡 <i>${item.memo}</i>\n`;
    }
    text += `\n`;
  });

  text += `━━━━━━━━━━━━━━━━━\n💡 <i>월가 퀀트 켈리 공식: 관심종목이 목표 진입가에 도달하면 3회 분할 매수를 추천합니다.</i>\n⏰ <i>${nowStr}</i>`;

  const res = await sendTelegramMessage(text);
  if (res.success) {
    logAlertHistory({
      category: 'WATCHLIST',
      type: 'BRIEFING',
      stockName: '관심종목 전체 브리핑',
      sentTelegram: true,
      message: text
    });
  }
  return res;
}

// ─── 🏛️ 3. 국민연금 DART 최신 공시 텔레그램 종합 브리핑 전송 ───
export async function sendNpsDisclosuresBriefing() {
  const config = getTelegramConfig();
  const { getNpsDetailedDisclosures } = await import('./nps_tracker.js');
  const npsData = await getNpsDetailedDisclosures();

  const nowStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const userName = config.userName || '대표';

  const disclosures = npsData.disclosures || [];
  if (disclosures.length === 0) {
    return { success: false, error: '조회된 국민연금 공시가 없습니다.' };
  }

  const newStocks = disclosures.filter(d => d.action === 'NEW').slice(0, 5);
  const increasedStocks = disclosures.filter(d => d.action === 'INCREASE').slice(0, 5);
  const decreasedStocks = disclosures.filter(d => d.action === 'DECREASE' || d.action === 'SOLD').slice(0, 3);

  let text = `🏛️ <b>[국민연금(NPS) DART 최신 지분공시 브리핑]</b>\n━━━━━━━━━━━━━━━━━\n👤 <b>${userName}</b>님, 국민연금공단 5% 대량보유 최신 변동 현황입니다:\n\n`;

  // 1. 5% 신규 취득 종목
  if (newStocks.length > 0) {
    text += `<b>🆕 5% 신규 편입 / 신규 취득 종목:</b>\n`;
    newStocks.forEach((item, idx) => {
      text += ` ${idx + 1}. <b>${item.corpName}</b> (<code>${item.stockCode}</code>) — <b>${item.currentRatio}%</b> (신규 진입 ✨)\n`;
      text += `    • 보유주수: ${item.shares?.toLocaleString()}주 | 평가액: <b>${item.valueEok?.toLocaleString()}억원</b>\n`;
    });
    text += `\n`;
  }

  // 2. 비중 확대 종목 (장내매수)
  if (increasedStocks.length > 0) {
    text += `<b>📈 지분 대량 확대 (장내 순매수) TOP:</b>\n`;
    increasedStocks.forEach((item, idx) => {
      text += ` ${idx + 1}. <b>${item.corpName}</b>: <b>${item.currentRatio}%</b> (🔺 +${item.diffRatio}%p 확대)\n`;
      text += `    • 현재가: ${item.currentPrice?.toLocaleString()}원 | 평가액: ${item.valueEok?.toLocaleString()}억원\n`;
    });
    text += `\n`;
  }

  // 3. 비중 축소 종목 (장내매도)
  if (decreasedStocks.length > 0) {
    text += `<b>📉 지분 축소 / 매도 종목:</b>\n`;
    decreasedStocks.forEach((item, idx) => {
      text += ` • <b>${item.corpName}</b>: ${item.currentRatio}% (${item.diffRatio}%p)\n`;
    });
    text += `\n`;
  }

  text += `━━━━━━━━━━━━━━━━━\n💡 <i>월가 기관 수급 분석: 국민연금의 5% 신규 편입 및 지분 확대 종목은 중장기 우상향 확률이 매우 높습니다.</i>\n⏰ <i>${nowStr}</i>`;

  const res = await sendTelegramMessage(text);
  if (res.success) {
    logAlertHistory({
      category: 'NPS_DISCLOSURE',
      type: 'BRIEFING',
      stockName: '국민연금 DART 최신공시 브리핑',
      sentTelegram: true,
      message: text
    });
  }
  return res;
}

// ─── 🚀 백그라운드 실시간 가격 모니터링 & 텔레그램 자동 발송 엔진 ───
const cooldownMap = new Map();

export async function checkAndSendAlerts() {
  try {
    const config = getTelegramConfig();
    if (!config.isEnabled || (!config.botToken && !config.chatId)) return;

    const raw = fs.readFileSync(ALERTS_FILE, 'utf8');
    const alerts = JSON.parse(raw);
    const now = Date.now();
    const COOLDOWN_MS = 30 * 60 * 1000; // 30분 쿨다운

    for (const alert of alerts) {
      if (!alert.isEnabled) continue;

      const isHolding = (alert.category || 'HOLDING') === 'HOLDING';
      if (isHolding && config.notifyHoldings === false) continue;
      if (!isHolding && config.notifyWatchlist === false) continue;

      let currentPrice = 0;
      let changeRate = 0;
      try {
        const stock = await getStockPrice(alert.stockCode);
        if (stock && stock.price) {
          currentPrice = stock.price;
          changeRate = stock.changeRate || 0;
        }
      } catch (e) {
        continue;
      }

      if (currentPrice <= 0) continue;

      const profitRate = alert.buyPrice > 0 
        ? (((currentPrice - alert.buyPrice) / alert.buyPrice) * 100).toFixed(2)
        : '0.00';

      const timeStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

      // A. 💼 보유종목 알림
      if (isHolding) {
        if (alert.targetPrice > 0 && currentPrice >= alert.targetPrice && config.notifyOnTarget !== false) {
          const key = `${alert.id}_TARGET`;
          const lastSent = cooldownMap.get(key) || 0;

          if (now - lastSent > COOLDOWN_MS) {
            cooldownMap.set(key, now);

            const message = `
🎯 <b>[💼 보유종목 익절 목표가 달성!] ${alert.stockName}</b>
━━━━━━━━━━━━━━━━━
• <b>종목명:</b> ${alert.stockName} (<code>${alert.stockCode}</code>)
• <b>현재가:</b> <b>${currentPrice.toLocaleString()}원</b> (${changeRate >= 0 ? '+' : ''}${changeRate}%)
• <b>목표가:</b> ${alert.targetPrice.toLocaleString()}원 (달성 완료 🚀)
• <b>매입단가:</b> ${alert.buyPrice.toLocaleString()}원 (수익률: <b>${profitRate >= 0 ? '+' : ''}${profitRate}%</b>)
• <b>메모:</b> ${alert.memo || '설정된 1차 목표가에 도달했습니다.'}
━━━━━━━━━━━━━━━━━
💡 <i>월가 퀀트 전략: 1차 목표가 도달 시 보유 물량의 30~50%를 분할 익절하여 수익을 확정 짓는 것이 유리합니다.</i>
⏰ <i>${timeStr}</i>
`.trim();

            const result = await sendTelegramMessage(message);
            logAlertHistory({
              category: 'HOLDING',
              alertId: alert.id,
              stockCode: alert.stockCode,
              stockName: alert.stockName,
              type: 'TARGET',
              triggerPrice: currentPrice,
              targetPrice: alert.targetPrice,
              profitRate,
              sentTelegram: result.success,
              message
            });
          }
        }

        if (alert.stopLossPrice > 0 && currentPrice <= alert.stopLossPrice && config.notifyOnStopLoss !== false) {
          const key = `${alert.id}_STOPLOSS`;
          const lastSent = cooldownMap.get(key) || 0;

          if (now - lastSent > COOLDOWN_MS) {
            cooldownMap.set(key, now);

            const message = `
🛑 <b>[💼 보유종목 손절선 이탈 경보!] ${alert.stockName}</b>
━━━━━━━━━━━━━━━━━
• <b>종목명:</b> ${alert.stockName} (<code>${alert.stockCode}</code>)
• <b>현재가:</b> <b>${currentPrice.toLocaleString()}원</b> (${changeRate >= 0 ? '+' : ''}${changeRate}%)
• <b>손절선:</b> ${alert.stopLossPrice.toLocaleString()}원 (지지선 이탈 ⚠️)
• <b>매입단가:</b> ${alert.buyPrice.toLocaleString()}원 (손익률: <b>${profitRate}%</b>)
• <b>메모:</b> ${alert.memo || '지지선 손절가에 도달했습니다.'}
━━━━━━━━━━━━━━━━━
💡 <i>월가 리스크 관리: 원칙에 따른 손절 또는 비중 축소로 추가 하락 리스크를 방어하세요.</i>
⏰ <i>${timeStr}</i>
`.trim();

            const result = await sendTelegramMessage(message);
            logAlertHistory({
              category: 'HOLDING',
              alertId: alert.id,
              stockCode: alert.stockCode,
              stockName: alert.stockName,
              type: 'STOPLOSS',
              triggerPrice: currentPrice,
              stopLossPrice: alert.stopLossPrice,
              profitRate,
              sentTelegram: result.success,
              message
            });
          }
        }
      }

      // B. ⭐ 관심종목 알림
      else {
        if (alert.targetPrice > 0 && currentPrice <= alert.targetPrice) {
          const key = `${alert.id}_WATCH_BUY`;
          const lastSent = cooldownMap.get(key) || 0;

          if (now - lastSent > COOLDOWN_MS) {
            cooldownMap.set(key, now);

            const message = `
🚀 <b>[⭐ 관심종목 매수 타점 도달!] ${alert.stockName}</b>
━━━━━━━━━━━━━━━━━
• <b>종목명:</b> ${alert.stockName} (<code>${alert.stockCode}</code>)
• <b>현재가:</b> <b>${currentPrice.toLocaleString()}원</b> (${changeRate >= 0 ? '+' : ''}${changeRate}%)
• <b>목표 진입가:</b> <b>${alert.targetPrice.toLocaleString()}원 이하</b> (매수 적기 포착 ✨)
• <b>메모:</b> ${alert.memo || '설정된 매수 진입 가격대에 진입했습니다.'}
━━━━━━━━━━━━━━━━━
💡 <i>월가 퀀트 켈리 공식: 한 번에 몰빵하지 않고 총 자산의 2~3% 한도 내에서 3회 분할 매수하는 것이 안전합니다.</i>
⏰ <i>${timeStr}</i>
`.trim();

            const result = await sendTelegramMessage(message);
            logAlertHistory({
              category: 'WATCHLIST',
              alertId: alert.id,
              stockCode: alert.stockCode,
              stockName: alert.stockName,
              type: 'WATCHLIST_BUY',
              triggerPrice: currentPrice,
              targetPrice: alert.targetPrice,
              sentTelegram: result.success,
              message
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('[Alert Engine Error]:', err.message);
  }
}

// ─── 🏛️ 국민연금 DART 신규 공시 실시간 감시 & 자동 발송 ───
const SEEN_NPS_FILE = path.join(DATA_DIR, 'nps_seen_disclosures.json');

function getSeenNpsDisclosures() {
  ensureFiles();
  try {
    if (!fs.existsSync(SEEN_NPS_FILE)) return [];
    return JSON.parse(fs.readFileSync(SEEN_NPS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveSeenNpsDisclosure(id) {
  ensureFiles();
  const list = getSeenNpsDisclosures();
  if (!list.includes(id)) {
    list.push(id);
    fs.writeFileSync(SEEN_NPS_FILE, JSON.stringify(list.slice(-500), null, 2), 'utf8');
  }
}

export async function checkNpsDisclosuresAndAlert() {
  try {
    const config = getTelegramConfig();
    if (!config.isEnabled || (!config.botToken && !config.chatId)) return;
    if (config.notifyNpsDisclosures === false) return;

    const { getNpsDetailedDisclosures } = await import('./nps_tracker.js');
    const npsData = await getNpsDetailedDisclosures();
    const disclosures = npsData.disclosures || [];
    const seenList = getSeenNpsDisclosures();
    const timeStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

    for (const item of disclosures) {
      if (seenList.includes(item.id)) continue;

      if (item.action === 'NEW' || (item.action === 'INCREASE' && item.diffRatio >= 0.2) || (item.valueEok >= 10000 && item.action === 'INCREASE')) {
        saveSeenNpsDisclosure(item.id);

        const isNew = item.action === 'NEW';
        const titleIcon = isNew ? '🆕' : '📈';
        const titleText = isNew 
          ? `[🏛️ 국민연금 DART 5% 신규 편입 공시 실시간 포착!]`
          : `[🏛️ 국민연금 DART 지분 대량 확대 공시 실시간 포착!]`;

        const message = `
${titleIcon} <b>${titleText}</b>
━━━━━━━━━━━━━━━━━
• <b>종목명:</b> <b>${item.corpName}</b> (<code>${item.stockCode}</code>)
• <b>보고구분:</b> <b>${item.actionLabel}</b>
• <b>현재 지분율:</b> <b>${item.currentRatio}%</b> (${item.prevRatio !== null && item.prevRatio > 0 ? `${item.prevRatio}% ➔ ` : ''}${item.diffRatio > 0 ? `+${item.diffRatio}%p ▲` : `${item.diffRatio}%p`})
• <b>보유주식수:</b> ${item.shares?.toLocaleString()}주 (변동: ${item.diffShares > 0 ? `+${item.diffShares.toLocaleString()}주` : `${item.diffShares.toLocaleString()}주`})
• <b>평가금액:</b> <b>${item.valueEok?.toLocaleString()}억 원</b> (현재가: ${item.currentPrice?.toLocaleString()}원)
• <b>취득목적:</b> ${item.purpose}
━━━━━━━━━━━━━━━━━
💡 <i>월가 퀀트 인사이트: 국민연금의 5% 신규 편입 및 지분 확대는 기관 수급 유입 및 중장기 밸류에이션 바닥 확인의 강력한 시그널입니다.</i>
⏰ <i>${timeStr}</i>
`.trim();

        const result = await sendTelegramMessage(message);
        logAlertHistory({
          category: 'NPS_DISCLOSURE',
          alertId: item.id,
          stockCode: item.stockCode,
          stockName: item.corpName,
          type: isNew ? 'NPS_NEW' : 'NPS_INCREASE',
          sentTelegram: result.success,
          message
        });

        console.log(`[Alert Engine] 🏛️ 국민연금 신규 공시 텔레그램 발송 완료: ${item.corpName} (${item.actionLabel})`);
      }
    }
  } catch (err) {
    console.error('[NPS Alert Engine Error]:', err.message);
  }
}

// 🏛️ 실시간 감시 테스트용 즉시 발송 함수
export async function testSendNpsSingleAlert(sampleStockCode = '257720') {
  const { getNpsDetailedDisclosures } = await import('./nps_tracker.js');
  const npsData = await getNpsDetailedDisclosures();
  const item = (npsData.disclosures || []).find(d => d.stockCode === sampleStockCode) || npsData.disclosures[0];

  if (!item) return { success: false, error: '공시 데이터 없음' };

  const timeStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const message = `
🚨 <b>[🏛️ 국민연금 DART 5% 신규 편입 공시 실시간 감시 포착 테스트]</b>
━━━━━━━━━━━━━━━━━
• <b>종목명:</b> <b>${item.corpName}</b> (<code>${item.stockCode}</code>)
• <b>보고구분:</b> <b>${item.actionLabel}</b>
• <b>현재 지분율:</b> <b>${item.currentRatio}%</b> (${item.prevRatio !== null && item.prevRatio > 0 ? `${item.prevRatio}% ➔ ` : ''}${item.diffRatio > 0 ? `+${item.diffRatio}%p ▲` : `${item.diffRatio}%p`})
• <b>보유주식수:</b> ${item.shares?.toLocaleString()}주 (변동: ${item.diffShares > 0 ? `+${item.diffShares.toLocaleString()}주` : `${item.diffShares.toLocaleString()}주`})
• <b>평가금액:</b> <b>${item.valueEok?.toLocaleString()}억 원</b> (현재가: ${item.currentPrice?.toLocaleString()}원)
• <b>취득목적:</b> ${item.purpose}
━━━━━━━━━━━━━━━━━
💡 <i>월가 퀀트 인사이트: 24시간 실시간 감시 엔진이 가동 중이며, 국민연금의 신규 5% 편입 및 지분 변동 공시 발생 즉시 텔레그램으로 자동 발송됩니다.</i>
⏰ <i>${timeStr}</i>
`.trim();

  const result = await sendTelegramMessage(message);
  if (result.success) {
    logAlertHistory({
      category: 'NPS_DISCLOSURE',
      alertId: `test_${item.id}`,
      stockCode: item.stockCode,
      stockName: item.corpName,
      type: 'NPS_REALTIME_TEST',
      sentTelegram: true,
      message
    });
  }
  return result;
}

// ⏰ 30초 주기 백그라운드 모니터링 엔진 시작
let alertInterval = null;
export function startAlertEngine() {
  if (alertInterval) clearInterval(alertInterval);
  ensureFiles();
  setTimeout(() => {
    checkAndSendAlerts();
    checkNpsDisclosuresAndAlert();
  }, 10000);

  alertInterval = setInterval(() => {
    checkAndSendAlerts();
    checkNpsDisclosuresAndAlert();
  }, 30000);
  console.log('[Alert Engine] 🔔 [보유종목 + 관심종목 + 국민연금 5% DART 공시] 3대 실시간 텔레그램 감시 엔진 가동 중 (30초 주기)');
}
