const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

axios.get('https://finance.naver.com/sise/sise_index.naver', {responseType:'arraybuffer'})
  .then(res => {
    const html = iconv.decode(res.data, 'EUC-KR');
    const $ = cheerio.load(html);
    $('a').each((i, el) => {
      if ($(el).text().includes('VKOSPI') || $(el).text().includes('변동성')) {
        console.log($(el).attr('href'), $(el).text());
      }
    });
  })
  .catch(console.error);
