// ai_analysis.js — ✨ 뉴스 & 공시 실시간 AI 호재/악재 퀀트 분석 엔진
import { GoogleGenerativeAI } from '@google/generative-ai';
import { fetchArticleBody } from './scraper.js';

let genai = null;
if (process.env.GEMINI_API_KEY) {
  try {
    genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  } catch (e) {
    console.warn('[AI Analysis] Gemini API init warning:', e.message);
  }
}

/**
 * AI 기반 또는 퀀트 키워드 기반 뉴스 호재/악재 종합 분석
 * @param {string} url 기사 URL
 * @param {string} title 기사 제목
 * @param {string} code 종목코드
 */
export async function analyzeNewsAndDisclosure(url, title, code) {
  try {
    // 1. 기사 본문 스크래핑
    let bodyText = await fetchArticleBody(url);
    if (!bodyText || bodyText.length < 20) {
      bodyText = title; // 본문 스크래핑 실패 시 제목 활용
    }

    // 2. Gemini API 호출 시도
    if (genai && process.env.GEMINI_API_KEY) {
      try {
        const model = genai.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `
당신은 대한민국 최고 수준의 여의도 퀀트 주식 전문 수석 애널리스트입니다.
다음은 종목코드 [${code || '국내상장주'}]의 뉴스/공시 내용입니다.

[제목]
${title}

[기사 본문 요약]
${bodyText.slice(0, 1200)}

위 내용을 바탕으로 다음 형식에 맞춰 투자자에게 명확하고 날카로운 분석을 작성해 주세요.
1. 첫 줄: 반드시 **[🟢 호재 (Bullish)]**, **[🔴 악재 (Bearish)]**, 혹은 **[⚪ 중립 (Neutral)]** 중 하나를 명확히 판정해 주세요.
2. 단기 및 중장기 주가 영향 (3문장 이내): 실적 기여도, 수급 파급력, 모멘텀 요인을 핵심만 요약해 주세요.
3. 투자자 핵심 액션 제안 (1문장): 현재 시점에서 매수/관망/비중축소 중 어떤 대응이 유리한지 제시해 주세요.
`;

        const result = await model.generateContent(prompt);
        const text = result?.response?.text();
        if (text && text.trim().length > 10) {
          return text.trim();
        }
      } catch (geminiErr) {
        console.warn('[AI Analysis] Gemini API error, switching to Quant Heuristic engine:', geminiErr.message);
      }
    }

    // 3. Fallback: 고성능 퀀트 규칙 기반 호재/악재 분석 엔진
    return generateHeuristicAnalysis(title, bodyText, code);
  } catch (err) {
    console.error('[AI Analysis Error]:', err.message);
    return generateHeuristicAnalysis(title, '', code);
  }
}

/**
 * 퀀트 키워드 및 금융 데이터 기반 스마트 호재/악재 분석기 (Fallback)
 */
function generateHeuristicAnalysis(title = '', body = '', code = '') {
  const fullText = `${title} ${body}`.toLowerCase();

  const bullishKeywords = [
    '실적 호조', '영업익 급증', '최대 실적', '어닝 서프라이즈', '수주', '계약 체결', '공급 계약',
    '흑자전환', '신제품', '자사주 소각', '배당 확대', '지분 취득', '신고가', '목표가 상향',
    '인수', 'm&a', 'fda 승인', '임상 성공', '특허', '대규모 투자', '호재', '급등', '돌파', '상한가'
  ];

  const bearishKeywords = [
    '적자전환', '영업익 급감', '어닝 쇼크', '계약 해지', '유상증자', '전환사채', 'cb 발행',
    '소송', '횡령', '배임', '감사의견 거절', '상장폐지', '블록딜', '지분 매도', '목표가 하향',
    '리콜', '품질 논란', '악재', '급락', '반대매매', '신용 청산', '하한가', '제재', '과징금'
  ];

  let bullScore = 0;
  let bearScore = 0;

  bullishKeywords.forEach(k => {
    if (fullText.includes(k)) bullScore += (title.includes(k) ? 2 : 1);
  });

  bearishKeywords.forEach(k => {
    if (fullText.includes(k)) bearScore += (title.includes(k) ? 2 : 1);
  });

  if (bullScore > bearScore) {
    return `### **🟢 호재 (Bullish) — 주가 긍정적 모멘텀**\n\n` +
      `* **단기 영향**: 해당 뉴스는 기업의 **매출/수익성 개선 및 시장 신뢰도 상승**에 직접적으로 기여하는 긍정적 모멘텀으로 작용할 가능성이 높습니다.\n` +
      `* **수급 파급력**: 실적 턴어라운드 및 성장성 부각으로 외국인 및 기관의 저가 매수세 유입이 기대되는 구간입니다.\n` +
      `* **💡 투자 전략**: 단기 급등에 따른 추격매수보다는, 20일선 눌림목 지지 확인 후 **분할 매수 관점 접근**을 추천합니다.`;
  } else if (bearScore > bullScore) {
    return `### **🔴 악재 (Bearish) — 단기 변동성 주의**\n\n` +
      `* **단기 영향**: 단기적인 **실적 불확실성이나 수급상 오버행(잠재 매도 물량) 부담**으로 주가 하방 압력이 발생할 수 있습니다.\n` +
      `* **수급 파급력**: 기관 및 외국인의 차익 실현이나 리스크 관리성 매도 물량이 출회될 수 있어 지지선 테스트가 필요합니다.\n` +
      `* **💡 투자 전략**: 무리한 물타기보다는 주가 바닥선(VPVR POC 지지선)이 안착되는지 확인 후 **보수적 관망 대응**을 권장합니다.`;
  } else {
    return `### **⚪ 중립 (Neutral) — 펀더멘털 추이 관망**\n\n` +
      `* **단기 영향**: 통상적인 영업 활동 및 시장 동향 관련 뉴스로, 기업의 본질적 가치나 펀더멘털에 미치는 즉각적인 충격은 제한적입니다.\n` +
      `* **수급 파급력**: 시장 전반의 매크로 분위기와 업종 수급 흐름에 연동되어 완만한 주가 흐름을 보일 것으로 예상됩니다.\n` +
      `* **💡 투자 전략**: 기존 보유 포트폴리오 비중을 유지하며, 향후 분기 실적 발표 및 외인 수급 추이를 확인하며 대응하세요.`;
  }
}
