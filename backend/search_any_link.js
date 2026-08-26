import axios from 'axios';
import iconv from 'iconv-lite';

async function test() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://finance.naver.com/'
  };

  try {
    const url = 'https://finance.naver.com/sise/sise_index.naver';
    const res = await axios.get(url, { headers, responseType: 'arraybuffer', timeout: 5000 });
    const html = iconv.decode(res.data, 'euc-kr');
    
    const lines = html.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('.nhn') || line.includes('.naver')) {
        console.log(`${idx + 1}: ${line.trim()}`);
      }
    });
  } catch (e) {
    console.error('Failed:', e.message);
  }
}

test();
