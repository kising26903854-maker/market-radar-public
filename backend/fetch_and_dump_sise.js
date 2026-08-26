import axios from 'axios';
import iconv from 'iconv-lite';

async function test() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://finance.naver.com/'
  };

  try {
    const url = 'https://finance.naver.com/sise/sise_index.naver';
    console.log(`Fetching: ${url}`);
    const res = await axios.get(url, { headers, responseType: 'arraybuffer', timeout: 5000 });
    const html = iconv.decode(res.data, 'euc-kr');
    console.log(`Length: ${html.length}`);
    const lines = html.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('52') || line.includes('신고') || line.includes('high') || line.includes('low')) {
        console.log(`${idx + 1}: ${line.trim()}`);
      }
    });
  } catch (e) {
    console.error('Failed:', e.message);
  }
}

test();
