const fs = require('fs');
let c = fs.readFileSync('market_cap_tracker.js', 'utf8');

if (!c.includes('import * as cheerio')) {
  c = "import * as cheerio from 'cheerio';\nimport iconv from 'iconv-lite';\n" + c;
}

const scraperCode = `
export async function getMarketCapComparison() {
  const file = path.join(__dirname, 'data', 'ranking_cache.json');
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  return { 
    kospi: { current: [], out: [] }, 
    kosdaq: { current: [], out: [] }, 
    day: '오늘', 
    date: new Date().toISOString() 
  }; 
}

export async function runMarketCapTracking() {
  const kospiCurrent = await fetchRanking(0);
  const kosdaqCurrent = await fetchRanking(1);
  
  const data = {
    kospi: { current: kospiCurrent, out: [] },
    kosdaq: { current: kosdaqCurrent, out: [] },
    day: '오늘',
    date: new Date().toISOString()
  };
  
  fs.writeFileSync(path.join(__dirname, 'data', 'ranking_cache.json'), JSON.stringify(data, null, 2));
  return data;
}

export async function fetchRanking(sosok) {
  try {
    const url = \`https://finance.naver.com/sise/sise_market_sum.naver?sosok=\${sosok}\`;
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    const html = iconv.decode(res.data, 'euc-kr');
    const $ = cheerio.load(html);
    
    const ranking = [];
    $('table.type_2 tbody tr').each((i, el) => {
      const tdList = $(el).find('td');
      if (tdList.length >= 10 && ranking.length < 20) {
        const no = tdList.eq(0).text().trim();
        const aTag = tdList.eq(1).find('a');
        if (!aTag.length) return;
        
        const name = aTag.text().trim();
        const href = aTag.attr('href');
        const code = href.split('code=')[1];
        const capText = tdList.eq(6).text().replace(/,/g, '').trim(); 
        const diffText = tdList.eq(3).text().replace(/,/g, '').trim();
        const icon = tdList.eq(3).find('img').attr('alt') === '하락' ? -1 : 1;
        
        ranking.push({
          code,
          name,
          marketCap: parseInt(capText) * 100000000,
          diff: (parseInt(diffText) || 0) * icon
        });
      }
    });
    return ranking;
  } catch (e) {
    console.error('Failed to fetch ranking', e);
    return [];
  }
}
`;

// Remove the old mock exports
c = c.replace(/export function getMarketCapComparison[\s\S]*?(?=export async function runMarketCapTracking)/, '');
c = c.replace(/export async function runMarketCapTracking[\s\S]*?(?=export function startDailyMarketCapTracker)/, '');
c = c.replace(/export function startDailyMarketCapTracker\(\) \{\}/, scraperCode + '\nexport function startDailyMarketCapTracker() {}');

fs.writeFileSync('market_cap_tracker.js', c);
