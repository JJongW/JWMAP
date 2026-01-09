import SitemapGenerator from 'sitemap-generator';

// 내 웹사이트 주소
const generator = SitemapGenerator('https://odga.vercel.app', {
  stripQuerystring: true, 
  filepath: './public/sitemap.xml', // 여기에 지도를 저장해!
});

// 지도가 완성됐을 때
generator.on('done', () => {
  console.log('지도 완성!');
});

// 지도를 그리다가 문제가 생기면
generator.on('error', (error) => {
  console.error('지도를 못 그렸어요:', error);
});

// 지도 그리기 시작!
generator.start();
