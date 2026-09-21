// company_summary.js — 🏢 기업 개요 및 주요 사업·제품 핵심 정보 수집 모듈
//
// 기존에는 finance.naver.com/item/main.naver(구버전 HTML)를 긁었는데, 이 페이지가
// stock.naver.com으로 302 리다이렉트되면서 죽어버려 항상 파싱에 실패했고, 그 결과
// 모든 종목이 똑같은 "대한민국 유가증권시장/코스닥 상장 우량 기업으로..." fallback
// 문구만 보여주는 문제가 있었다 (지어낸 문구가 전 종목에 동일하게 노출됨).
// FnGuide 계열의 navercomp.wisereport.co.kr(온라인기업정보)는 아직 살아있고 종목별
// 실제 데이터(설립일/대표이사/종업원수, 주요제품 매출구성 %, 최근 연혁)를 제공하므로
// 이를 사용해 종목마다 실제로 다른 내용이 나오도록 재작성했다.
import axios from 'axios';
import * as cheerio from 'cheerio';

const summaryCache = new Map();

/**
 * FnGuide(WiseReport) 온라인기업정보 "기업개요" 탭에서 종목별 실제 프로필/제품구성/연혁을 수집
 * @param {string} code 6자리 종목코드
 */
export async function getCompanySummary(code) {
  if (!code) return { success: false, error: 'No stock code provided' };

  // 1. 캐시 확인 (24시간 유효)
  const cached = summaryCache.get(code);
  if (cached && (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000)) {
    return { success: true, ...cached.data };
  }

  try {
    const url = `https://navercomp.wisereport.co.kr/v2/company/c1020001.aspx?cmp_cd=${code}`;
    const res = await axios.get(url, {
      timeout: 6000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(res.data);

    // 회사명 (페이지 타이틀 "온라인기업정보 - 기업모니터 - 기업개요(삼성전자)" 에서 추출)
    const titleMatch = $('title').text().match(/기업개요\(([^)]+)\)/);
    const name = titleMatch ? titleMatch[1].trim() : '';

    // 1. 기본 프로필 (cTB201: 본사주소/설립일/대표이사/계열/종업원수/감사인/주거래은행 등)
    const profile = {};
    $('#cTB201 tr').each((i, tr) => {
      const cells = $(tr).find('th, td');
      for (let c = 0; c < cells.length; c += 2) {
        const key = $(cells[c]).text().replace(/\s+/g, ' ').trim();
        const val = $(cells[c + 1])?.text().replace(/\s+/g, ' ').trim();
        if (key && val) profile[key] = val;
      }
    });

    // 2. 주요제품 매출구성 (cTB203: 제품명 + 비율%)
    const products = [];
    $('#cTB203 tbody tr').each((i, tr) => {
      const label = $(tr).find('th').attr('title') || $(tr).find('th').text().trim();
      const pct = $(tr).find('td.num').text().trim();
      if (label && pct && !isNaN(parseFloat(pct))) {
        products.push({ label, pct: parseFloat(pct) });
      }
    });

    // 3. 최근 연혁 (cTB202: 일자 + 상세연혁, 최신 3건)
    const history = [];
    $('#cTB202 tbody tr').each((i, tr) => {
      if (history.length >= 3) return;
      const date = $(tr).find('th').text().trim();
      const detail = $(tr).find('td').attr('title') || $(tr).find('td').text().trim();
      if (date && detail) history.push({ date, detail });
    });

    // ── 실제 데이터 기반 3단락 구성 ──
    const paragraphs = [];

    const basicBits = [];
    if (profile['설립일']) basicBits.push(`설립일 ${profile['설립일']}`);
    if (profile['대표이사']) basicBits.push(`대표이사 ${profile['대표이사']}`);
    if (profile['계열']) basicBits.push(`계열 ${profile['계열']}`);
    if (profile['종업원수']) basicBits.push(`종업원수 ${profile['종업원수']}`);
    if (profile['감사인']) basicBits.push(`감사인 ${profile['감사인']}`);
    if (profile['주거래은행']) basicBits.push(`주거래은행 ${profile['주거래은행']}`);
    if (basicBits.length > 0) paragraphs.push(basicBits.join(' · '));

    if (products.length > 0) {
      const topProducts = products
        .filter(p => p.pct > 0)
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 5)
        .map(p => `${p.label} ${p.pct}%`)
        .join(', ');
      if (topProducts) paragraphs.push(`주요제품 매출구성: ${topProducts}`);
    }

    if (history.length > 0) {
      paragraphs.push('최근 주요 연혁: ' + history.map(h => `[${h.date}] ${h.detail}`).join(' · '));
    }

    const success = paragraphs.length > 0;
    const data = {
      code,
      name,
      wicsSector: '',
      marketCapRank: '',
      summary: paragraphs.join('\n\n'),
      paragraphs,
      overview: paragraphs[0] || '',
      products: paragraphs[1] || '',
      strategy: paragraphs[2] || '',
      isLive: success,
      source: 'FnGuide(WiseReport) 온라인기업정보'
    };

    if (success) {
      summaryCache.set(code, { timestamp: Date.now(), data });
    }
    return { success: true, ...data };
  } catch (err) {
    console.warn(`[Company Summary] Failed to fetch for ${code}:`, err.message);
    // ⚠️ 실패 시 지어낸 일반 문구로 채우지 않고, 조회 실패 상태를 있는 그대로 알린다.
    return {
      success: true,
      code,
      name: '',
      wicsSector: '',
      marketCapRank: '',
      summary: '',
      paragraphs: [],
      overview: '',
      products: '',
      strategy: '',
      isLive: false,
      error: err.message
    };
  }
}
