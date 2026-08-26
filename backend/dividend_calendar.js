// dividend_calendar.js — 💵 내 보유 종목 배당 캘린더 및 세후 배당금 시뮬레이터
import { getPortfolioPrices } from './stock.js';

export async function getDividendCalendar() {
  try {
    // 1. 현재 사용자 보유 포트폴리오 로드
    const portData = await getPortfolioPrices();
    const positions = portData.positions || [
      { code: '0182R0', name: '1Q K반도체TOP2+', shares: 291, buy_price: 15129, current_price: 15420 },
      { code: '090430', name: '아모레퍼시픽', shares: 17, buy_price: 122853, current_price: 135000 }
    ];

    // 종목별 연간 주당 배당금 및 지급월 매핑 데이터베이스
    const dividendDb = {
      '0182R0': { name: '1Q K반도체TOP2+', dps: 380, divYield: 2.5, payMonths: [4, 7, 10, 1] }, // 분기배당 ETF
      '090430': { name: '아모레퍼시픽', dps: 1100, divYield: 1.0, payMonths: [4] }, // 4월 결산배당
      '005930': { name: '삼성전자', dps: 1444, divYield: 2.1, payMonths: [5, 8, 11, 4] }, // 분기배당
      '005380': { name: '현대차', dps: 11400, divYield: 4.8, payMonths: [4, 8] }, // 반기배당
      '000270': { name: '기아', dps: 5600, divYield: 5.2, payMonths: [4] },
      '013520': { name: '화승코퍼레이션', dps: 120, divYield: 4.9, payMonths: [4] },
      '010770': { name: '평화홀딩스', dps: 150, divYield: 4.1, payMonths: [4] },
      '086790': { name: '하나금융지주', dps: 3400, divYield: 5.8, payMonths: [5, 8, 11, 4] },
      '105560': { name: 'KB금융', dps: 3060, divYield: 4.2, payMonths: [5, 8, 11, 4] },
    };

    // 보유 종목 기준 배당금 계산
    let totalAnnualGross = 0;
    const portfolioDividendList = positions.map(pos => {
      const info = dividendDb[pos.code] || { dps: Math.round((pos.current_price || pos.buy_price) * 0.025), divYield: 2.5, payMonths: [4] };
      const shares = pos.shares || 1;
      const annualGross = info.dps * shares;
      const annualNet = Math.round(annualGross * (1 - 0.154)); // 15.4% 배당소득세 차감
      totalAnnualGross += annualGross;

      return {
        code: pos.code,
        name: pos.name,
        shares,
        currentPrice: pos.current_price || pos.buy_price,
        dps: info.dps,
        divYield: info.divYield,
        annualGross,
        annualNet,
        payMonths: info.payMonths
      };
    });

    const totalAnnualNet = Math.round(totalAnnualGross * (1 - 0.154));
    const monthlyAverageNet = Math.round(totalAnnualNet / 12);

    // 1월~12월 월별 배당금 캘린더 일정표 구성
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const monthlySchedule = months.map(m => {
      const itemsInMonth = [];
      let monthTotalNet = 0;

      portfolioDividendList.forEach(item => {
        if (item.payMonths.includes(m)) {
          const installmentNet = Math.round(item.annualNet / item.payMonths.length);
          monthTotalNet += installmentNet;
          itemsInMonth.push({
            name: item.name,
            code: item.code,
            dps: Math.round(item.dps / item.payMonths.length),
            payoutNet: installmentNet
          });
        }
      });

      return {
        month: m,
        monthName: `${m}월`,
        hasDividend: itemsInMonth.length > 0,
        totalPayoutNet: monthTotalNet,
        items: itemsInMonth
      };
    });

    // 국내 대표 고배당 가치주 추천 TOP 5
    const highDividendPicks = [
      { code: '000270', name: '기아', currentPrice: 114500, dps: 5600, yield: '5.2%', pbr: '0.82배', per: '4.8배', reason: '역대 최대 실적 + 연 5%대 안정 고배당' },
      { code: '086790', name: '하나금융지주', currentPrice: 62500, dps: 3400, yield: '5.8%', pbr: '0.45배', per: '4.5배', reason: '분기 균등배당 + 자사주 3천억 소각 밸류업' },
      { code: '005380', name: '현대차', currentPrice: 262000, dps: 11400, yield: '4.8%', pbr: '0.68배', per: '5.5배', reason: '중간/결산 분할 고배당 + 인도법인 상장 모멘텀' },
      { code: '013520', name: '화승코퍼레이션', currentPrice: 2450, dps: 120, yield: '4.9%', pbr: '0.36배', per: '1.57배', reason: '초저PBR 극단적 저평가 + 4.9% 고배당 안전마진' },
    ];

    return {
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        totalAnnualGross,
        totalAnnualNet,
        monthlyAverageNet,
        dividendTaxRate: '15.4%',
        taxDeducted: totalAnnualGross - totalAnnualNet
      },
      portfolioList: portfolioDividendList,
      monthlySchedule,
      highDividendPicks
    };
  } catch (err) {
    console.error('[Dividend Calendar] Error:', err);
    return { success: false, error: err.message };
  }
}
