/**
 * @file macro_news.js
 * @description 네이버 금융 메인 뉴스 및 네이버 뉴스 경제 섹션에서 글로벌 매크로 뉴스를 스크래핑하고 카테고리별로 분류하는 모듈
 */

// 메모리 캐시 설정 (10분 TTL)
let newsCache = {
  data: null,
  timestamp: 0
};
const CACHE_TTL_MS = 10 * 60 * 1000; // 10분 (밀리초)

/**
 * HTML 엔티티 및 특수문자 디코딩 함수
 * @param {string} text - 인코딩된 HTML 문자열
 * @returns {string} 디코딩된 일반 텍스트
 */
function decodeHtmlEntities(text) {
  if (!text) return '';
  return text
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&middot;/gi, '·')
    .replace(/&bull;/gi, '•')
    .replace(/&hellip;/gi, '…')
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&lsquo;|&rsquo;/gi, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .trim();
}

/**
 * 기사 제목을 기반으로 카테고리를 분류하는 함수
 * @param {string} title - 기사 제목
 * @returns {'환율/금리' | '해외증시' | '원자재' | '무역/통상' | '정책/규제' | '글로벌이슈'} 카테고리명
 */
export function classifyCategory(title) {
  if (!title || typeof title !== 'string') {
    return '글로벌이슈';
  }

  // 1. 환율/금리: 환율, 달러, 엔, 위안, 유로, 금리, 연준, Fed, 기준금리, 금통위
  if (/환율|달러|엔|위안|유로|금리|연준|Fed|기준금리|금통위/i.test(title)) {
    return '환율/금리';
  }

  // 2. 해외증시: 나스닥, S&P, 다우, 니케이, 유럽, 월가, 뉴욕
  if (/나스닥|S&P|다우|니케이|유럽|월가|뉴욕/i.test(title)) {
    return '해외증시';
  }

  // 3. 원자재: 유가, 금값, 원유, 구리, 원자재
  if (/유가|금값|원유|구리|원자재/i.test(title)) {
    return '원자재';
  }

  // 4. 무역/통상: 관세, 수출, 수입, 무역, 통상
  if (/관세|수출|수입|무역|통상/i.test(title)) {
    return '무역/통상';
  }

  // 5. 정책/규제: 정책, 규제, 법안, 세금, 부동산
  if (/정책|규제|법안|세금|부동산/i.test(title)) {
    return '정책/규제';
  }

  // 6. 기본값: 글로벌이슈
  return '글로벌이슈';
}

/**
 * 네이버 금융 메인 뉴스 HTML 파싱 (EUC-KR 디코딩된 문자열)
 * @param {string} html - HTML 문자열
 * @returns {Array<object>} 뉴스 목록
 */
function parseFinanceMainNews(html) {
  const newsList = [];
  if (!html) return newsList;

  // 메인 뉴스 리스트 아이템 추출 (<li class="block...">)
  const itemRegex = /<li\s+class="block\d*">([\s\S]*?)<\/li>/gi;
  let match;

  while ((match = itemRegex.exec(html)) !== null) {
    const block = match[1];

    // 제목 및 링크 추출
    const subjectMatch = block.match(/<dd\s+class="articleSubject"[^>]*>[\s\S]*?<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!subjectMatch) continue;

    let url = subjectMatch[1].trim();
    if (url.startsWith('/')) {
      url = `https://finance.naver.com${url}`;
    }

    const rawTitle = subjectMatch[2].replace(/<[^>]+>/g, '').trim();
    const title = decodeHtmlEntities(rawTitle);
    if (!title) continue;

    // 언론사 추출
    const pressMatch = block.match(/<span\s+class="press"[^>]*>([\s\S]*?)<\/span>/i);
    const source = pressMatch ? decodeHtmlEntities(pressMatch[1].replace(/<[^>]+>/g, '')).trim() : '네이버금융';

    // 작성일시 추출
    const dateMatch = block.match(/<span\s+class="wdate"[^>]*>([\s\S]*?)<\/span>/i);
    let date = dateMatch ? decodeHtmlEntities(dateMatch[1].replace(/<[^>]+>/g, '')).trim() : '';
    if (!date) {
      const urlDateMatch = url.match(/date=(\d{4}-\d{2}-\d{2})/);
      date = urlDateMatch ? urlDateMatch[1] : new Date().toISOString().split('T')[0];
    }

    // 기사 요약 추출 (100-150자)
    const summaryMatch = block.match(/<dd\s+class="articleSummary"[^>]*>([\s\S]*?)<\/dd>/i);
    let summary = '';
    if (summaryMatch) {
      let rawSummary = summaryMatch[1];
      const pressIndex = rawSummary.indexOf('<span class="press"');
      if (pressIndex !== -1) {
        rawSummary = rawSummary.substring(0, pressIndex);
      }
      summary = decodeHtmlEntities(rawSummary.replace(/<[^>]+>/g, ''))
        .replace(/\s+/g, ' ')
        .trim();
      if (summary.length > 150) {
        summary = summary.substring(0, 150).trim() + '...';
      }
    }

    const category = classifyCategory(title);

    newsList.push({
      title,
      summary: summary || title,
      source,
      url,
      date,
      category
    });
  }

  return newsList;
}

/**
 * 네이버 뉴스 경제 섹션 HTML 파싱 (UTF-8 문자열)
 * @param {string} html - HTML 문자열
 * @returns {Array<object>} 뉴스 목록
 */
function parseSection101News(html) {
  const newsList = [];
  if (!html) return newsList;

  // 헤드라인 및 주요 뉴스 아이템 추출 (sa_item, ss_item)
  const itemRegex = /<li\s+class="(?:sa_item|ss_item)[^"]*">([\s\S]*?)<\/li>/gi;
  let match;

  while ((match = itemRegex.exec(html)) !== null) {
    const block = match[1];

    let url = '';
    let rawTitle = '';

    // 제목 및 링크 매칭 (sa_text_strong, ss_text_headline 등)
    const strongMatch = block.match(/<a\s+[^>]*href="([^"]+)"[^>]*>[\s\S]*?<strong\s+class="sa_text_strong">([\s\S]*?)<\/strong>/i)
      || block.match(/<a\s+href="([^"]+)"[^>]*class="[^"]*ss_text_headline[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
      || block.match(/<a\s+[^>]*class="[^"]*ss_text_headline[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);

    if (strongMatch) {
      url = strongMatch[1].trim();
      rawTitle = strongMatch[2].replace(/<[^>]+>/g, '').trim();
    } else {
      const genericMatch = block.match(/<a\s+[^>]*href="([^"]+)"[^>]*class="[^"]*sa_text_title[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
      if (genericMatch) {
        url = genericMatch[1].trim();
        rawTitle = genericMatch[2].replace(/<[^>]+>/g, '').trim();
      }
    }

    if (!url || !rawTitle) continue;

    url = decodeHtmlEntities(url);
    if (url.startsWith('/')) {
      url = `https://news.naver.com${url}`;
    }

    const title = decodeHtmlEntities(rawTitle);
    if (!title) continue;

    // 기사 요약문 추출 (100-150자)
    const ledeMatch = block.match(/<div\s+class="(?:sa_text_lede|ss_text_lede)"[^>]*>([\s\S]*?)<\/div>/i);
    let summary = '';
    if (ledeMatch) {
      summary = decodeHtmlEntities(ledeMatch[1].replace(/<[^>]+>/g, ''))
        .replace(/\s+/g, ' ')
        .trim();
      if (summary.length > 150) {
        summary = summary.substring(0, 150).trim() + '...';
      }
    }

    // 언론사 추출
    const pressMatch = block.match(/<div\s+class="(?:sa_text_press|ss_text_press)"[^>]*>([\s\S]*?)<\/div>/i);
    const source = pressMatch ? decodeHtmlEntities(pressMatch[1].replace(/<[^>]+>/g, '')).trim() : '네이버뉴스';

    // 날짜 추출: 이미지 썸네일 경로 또는 클러스터 파라미터에서 추출 시도
    let date = '';
    const imgDateMatch = block.match(/\/image\/origin\/\d+\/(\d{4})\/(\d{2})\/(\d{2})\//i);
    if (imgDateMatch) {
      date = `${imgDateMatch[1]}-${imgDateMatch[2]}-${imgDateMatch[3]}`;
    } else {
      const clusterDateMatch = block.match(/c_(\d{4})(\d{2})(\d{2})/i);
      if (clusterDateMatch) {
        date = `${clusterDateMatch[1]}-${clusterDateMatch[2]}-${clusterDateMatch[3]}`;
      } else {
        date = new Date().toISOString().split('T')[0];
      }
    }

    const category = classifyCategory(title);

    newsList.push({
      title,
      summary: summary || title,
      source,
      url,
      date,
      category
    });
  }

  return newsList;
}

/**
 * 글로벌 매크로/경제 뉴스를 스크래핑하여 반환하는 비동기 함수
 * 10분간 메모리 캐시를 유지합니다.
 * @param {boolean} [forceRefresh=false] - 캐시 강제 갱신 여부
 * @returns {Promise<{success: boolean, news?: Array<object>, lastUpdated?: string, totalCount?: number, error?: string}>}
 */
export async function getGlobalMacroNews(forceRefresh = false) {
  const now = Date.now();

  // 캐시 유효성 검사 (10분 이내 요청 시 캐시 데이터 반환)
  if (!forceRefresh && newsCache.data && (now - newsCache.timestamp < CACHE_TTL_MS)) {
    return newsCache.data;
  }

  try {
    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
    };

    // 네이버 금융 메인 뉴스 (EUC-KR) 및 네이버 뉴스 경제 섹션 (UTF-8) 병렬 요청
    const [financeResult, economyResult] = await Promise.allSettled([
      fetch('https://finance.naver.com/news/mainnews.naver', {
        headers: fetchHeaders,
        signal: AbortSignal.timeout(10000)
      }).then(async (res) => {
        if (!res.ok) {
          throw new Error(`네이버 금융 뉴스 응답 오류: HTTP ${res.status}`);
        }
        const buffer = await res.arrayBuffer();
        const html = new TextDecoder('euc-kr').decode(buffer);
        return parseFinanceMainNews(html);
      }),
      fetch('https://news.naver.com/section/101', {
        headers: fetchHeaders,
        signal: AbortSignal.timeout(10000)
      }).then(async (res) => {
        if (!res.ok) {
          throw new Error(`네이버 경제 뉴스 응답 오류: HTTP ${res.status}`);
        }
        const html = await res.text();
        return parseSection101News(html);
      })
    ]);

    const allNews = [];

    if (financeResult.status === 'fulfilled' && Array.isArray(financeResult.value)) {
      allNews.push(...financeResult.value);
    } else if (financeResult.status === 'rejected') {
      console.warn('네이버 금융 메인 뉴스 스크래핑 실패:', financeResult.reason?.message);
    }

    if (economyResult.status === 'fulfilled' && Array.isArray(economyResult.value)) {
      allNews.push(...economyResult.value);
    } else if (economyResult.status === 'rejected') {
      console.warn('네이버 경제 섹션 뉴스 스크래핑 실패:', economyResult.reason?.message);
    }

    // 두 요청 모두 실패하고 가져온 뉴스가 없는 경우
    if (allNews.length === 0 && financeResult.status === 'rejected' && economyResult.status === 'rejected') {
      const errorMsg = `네이버 뉴스 수집 실패 (금융: ${financeResult.reason?.message}, 경제: ${economyResult.reason?.message})`;
      // 기존 캐시가 있다면 폴백으로 반환
      if (newsCache.data) {
        return newsCache.data;
      }
      return {
        success: false,
        error: errorMsg
      };
    }

    // 중복 기사 제거 (URL 및 정규화된 제목 기준)
    const seenUrls = new Set();
    const seenTitles = new Set();
    const uniqueNews = [];

    for (const item of allNews) {
      const normTitle = item.title.replace(/\s+/g, ' ').trim();
      if (seenUrls.has(item.url) || seenTitles.has(normTitle)) {
        continue;
      }
      seenUrls.add(item.url);
      seenTitles.add(normTitle);
      uniqueNews.push(item);
    }

    const response = {
      success: true,
      news: uniqueNews,
      lastUpdated: new Date().toISOString(),
      totalCount: uniqueNews.length
    };

    // 캐시 저장
    newsCache = {
      data: response,
      timestamp: now
    };

    return response;
  } catch (error) {
    // 예외 발생 시 기존 캐시가 있으면 반환, 없으면 에러 객체 반환
    if (newsCache.data) {
      return newsCache.data;
    }
    return {
      success: false,
      error: error.message || '글로벌 매크로 뉴스를 수집하는 중 예외가 발생했습니다.'
    };
  }
}

export default getGlobalMacroNews;
