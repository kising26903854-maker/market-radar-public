import axios from 'axios';
import iconv from 'iconv-lite';

async function test() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://finance.naver.com/'
  };

  try {
    const url = 'https://finance.naver.com/sise/';
    const res = await axios.get(url, { headers, responseType: 'arraybuffer', timeout: 5000 });
    const html = iconv.decode(res.data, 'euc-kr');
    
    // search for all links
    const regex = /href="([^"]+)"[^>]*>([^<]+)</g;
    let match;
    const links = new Set();
    while ((match = regex.exec(html)) !== null) {
      const link = match[1];
      const text = match[2].trim();
      links.add(`${text} => ${link}`);
    }
    console.log('All links on /sise/:');
    Array.from(links).sort().forEach(l => console.log(l));
  } catch (e) {
    console.error('Failed:', e.message);
  }
}

test();
