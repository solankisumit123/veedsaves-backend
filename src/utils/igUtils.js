const UserAgent = require('user-agents');
const _ = require('lodash');

const getHeaders = (url) => {
  // Use a stable, high-reputation User-Agent for Instagram
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';
  const languages = ['en-US,en;q=0.9', 'en-GB,en;q=0.8', 'en;q=0.7', 'hi-IN,hi;q=0.6'];
  
  return {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': _.sample(languages),
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'Referer': 'https://www.instagram.com/',
  };
};

const getRandomDelay = (min = 1000, max = 3000) => {
  return new Promise(resolve => setTimeout(resolve, _.random(min, max)));
};

module.exports = { getHeaders, getRandomDelay };
