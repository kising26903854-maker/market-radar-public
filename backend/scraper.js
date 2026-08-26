// scraper.js — 네이버 뉴스 및 시세 크롤링 유틸
import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

/**
 * 네이버 뉴스 및 증권 기사 본문 스크래핑
 * @param {string} url 기사 원문 URL
 */
export async function fetchArticleBody(url) {
  if (!url) return '';
  try {
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    let html = iconv.decode(res.data, 'utf-8');
    if (html.includes('charset="EUC-KR"') || html.includes('charset=euc-kr') || html.includes('charset="euc-kr"')) {
      html = iconv.decode(res.data, 'EUC-KR');
    }
    const $ = cheerio.load(html);

    // 주요 뉴스 본문 선택자
    let body = $('#dic_area, #articeBody, #newsct_article, #newsEndContents, div.article_body, div.articleCont').text().trim();

    if (!body || body.length < 20) {
      body = $('article p, div.article_txt, p').map((i, el) => $(el).text().trim()).get().join(' ');
    }

    return body.replace(/\s+/g, ' ').slice(0, 2500);
  } catch (e) {
    console.warn(`[fetchArticleBody] Failed to fetch article body from ${url}:`, e.message);
    return '';
  }
}

/**
 * 시가총액 순위 크롤링 (코스피/코스닥)
 * @param {number} sosok 0: 코스피, 1: 코스닥
 */
export async function fetchRanking(sosok = 0) {
  try {
    const url = `https://finance.naver.com/sise/sise_market_sum.naver?sosok=${sosok}`;
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 5000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = iconv.decode(res.data, 'EUC-KR');
    const $ = cheerio.load(html);

    const ranking = [];
    $('table.type_2 tbody tr').each((i, el) => {
      const tdList = $(el).find('td');
      if (tdList.length >= 10 && ranking.length < 20) {
        const aTag = tdList.eq(1).find('a');
        if (!aTag.length) return;

        const name = aTag.text().trim();
        const href = aTag.attr('href') || '';
        const code = href.split('code=')[1];
        const capText = tdList.eq(6).text().replace(/,/g, '').trim(); // 시가총액 (억)
        const diffText = tdList.eq(3).text().replace(/,/g, '').trim();
        const icon = tdList.eq(3).find('img').attr('alt') === '하락' ? -1 : 1;

        if (code && name) {
          ranking.push({
            code,
            name,
            marketCap: parseInt(capText, 10) * 100000000,
            diff: (parseInt(diffText, 10) || 0) * icon
          });
        }
      }
    });
    return ranking;
  } catch (e) {
    console.error('Failed to fetch ranking', e.message);
    return [];
  }
}
