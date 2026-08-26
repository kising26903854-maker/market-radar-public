import axios from 'axios';

async function test() {
  try {
    const res = await axios.get('https://finance.naver.com/robots.txt');
    console.log(res.data);
  } catch (e) {
    console.error('Failed:', e.message);
  }
}

test();
