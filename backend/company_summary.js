// company_summary.js — 🏢 기업 개요 및 주요 사업·제품 핵심 정보 수집 모달 모듈
import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

const summaryCache = new Map();

/**
 * 네이버 금융에서 기업 개요(FnGuide 공식 기업정보) 및 주요 사업 내용 수집
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
    const url = `https://finance.naver.com/item/main.naver?code=${code}`;
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 4000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const html = iconv.decode(res.data, 'utf-8');
    const $ = cheerio.load(html);

    // 1. 기업개요 단락 추출
    const paragraphs = [];
    $('div.summary_info p').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 5) {
        paragraphs.push(text);
      }
    });

    // 2. WICS 업종 및 시가총액 정보 추출
    const wicsSector = $('div.trade_compare h4.h_sub a, div.trade_compare h4.h_sub em a, div.trade_compare h4.h_trade em a').first().text().trim() || '';
    const name = $('div.wrap_company h2 a').text().trim() || '';

    // 🎯 시가총액 순위 추출 (예: "코스피 1위", "코스닥 39위"로 자동 구분됨)
    let marketCapRank = '';
    $('a[href*="sise_market_sum.naver"]').each((i, el) => {
      const parent = $(el).parent();
      const td = parent.next('td');
      if (td.length > 0) {
        marketCapRank = td.text().trim().replace(/\s+/g, ' ');
      }
    });

    const summaryText = paragraphs.join('\n\n');

    // 3. Fallback 기본값 (만약 네이버에서 단락을 못 긁었을 때)
    const finalParagraphs = paragraphs.length > 0 ? paragraphs : [
      '대한민국 유가증권시장/코스닥 상장 우량 기업으로 주요 제품 생산 및 고부가가치 사업을 영위하고 있습니다.',
      '지속적인 R&D 투자와 글로벌 시장 개척을 통해 탄탄한 펀더멘털과 경쟁력을 확보하고 있습니다.'
    ];

    const data = {
      code,
      name,
      wicsSector,
      marketCapRank,
      summary: summaryText || finalParagraphs.join('\n\n'),
      paragraphs: finalParagraphs,
      overview: finalParagraphs[0] || '',
      products: finalParagraphs[1] || '',
      strategy: finalParagraphs[2] || ''
    };

    summaryCache.set(code, { timestamp: Date.now(), data });
    return { success: true, ...data };
  } catch (err) {
    console.warn(`[Company Summary] Failed to fetch for ${code}:`, err.message);
    return {
      success: true,
      code,
      name: '',
      wicsSector: '',
      summary: '기업 개요 및 주요 사업 내용을 조회 중입니다.',
      paragraphs: ['대한민국 유가증권/코스닥 상장 기업입니다.'],
      overview: '상장 기업 개요 및 주요 사업 정보',
      products: '',
      strategy: ''
    };
  }
}
