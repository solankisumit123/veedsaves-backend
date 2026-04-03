const axios = require('axios');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { getHeaders, getRandomDelay } = require('../utils/igUtils');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

class InstagramProService {
  constructor() {
    this.cookiesPath = path.join(__dirname, '../../cookies.txt');
  }

  async getCookies() {
    try {
      if (fs.existsSync(this.cookiesPath)) {
        const content = fs.readFileSync(this.cookiesPath, 'utf8');
        return content.split('\n')
          .filter(line => line && !line.startsWith('#'))
          .map(line => {
            const parts = line.split('\t');
            if (parts.length >= 7) return `${parts[5]}=${parts[6]}`;
            return null;
          })
          .filter(Boolean)
          .join('; ');
      }
    } catch (e) {
      console.error('[IG-Pro] Cookie read error:', e.message);
    }
    return '';
  }

  // METHOD 1: AUTHENTIC REQUEST (SESSION-BASED SCRAPING)
  async method1SessionScraping(url) {
    try {
      console.log('[IG-Pro] Trying Method 1: Session Scraping');
      const cookies = await this.getCookies();
      const headers = { ...getHeaders(url), Cookie: cookies };

      const { data: html } = await axios.get(url, { headers, timeout: 10000 });

      // Extract JSON from script tags
      const jsonMatch = html.match(/<script[^>]*>window\._sharedData\s*=\s*({.*?});<\/script>/) ||
                        html.match(/<script[^>]*>window\.__additionalDataLoaded\([^,]*,\s*({.*?})\);<\/script>/);

      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[1]);
        const media = jsonData.entry_data?.PostPage?.[0]?.graphql?.shortcode_media || jsonData.graphql?.shortcode_media;
        if (media) {
          return {
            status: 'success',
            method: 'session_scraping',
            type: media.is_video ? 'video' : 'image',
            url: media.video_url || media.display_url,
            thumbnail: media.display_url,
            title: media.edge_media_to_caption?.edges?.[0]?.node?.text || 'Instagram Post'
          };
        }
      }
      return null;
    } catch (e) {
      console.warn('[IG-Pro] Method 1 failed:', e.message);
      return null;
    }
  }

  // METHOD 2: EMBED DATA EXTRACTION
  async method2EmbedExtraction(url) {
    try {
      console.log('[IG-Pro] Trying Method 2: Embed Extraction');
      const embedUrl = `https://www.instagram.com/oembed/?url=${encodeURIComponent(url)}`;
      const { data } = await axios.get(embedUrl, { timeout: 5000 });

      if (data && data.thumbnail_url) {
        // Embed usually only gives thumbnail, but it validates the post exists
        return {
          status: 'partial',
          method: 'embed_extraction',
          type: 'image',
          url: data.thumbnail_url,
          thumbnail: data.thumbnail_url,
          author: data.author_name
        };
      }
      return null;
    } catch (e) {
      console.warn('[IG-Pro] Method 2 failed:', e.message);
      return null;
    }
  }

  // METHOD 3: HEADLESS BROWSER SCRAPING (PUPPETEER)
  async method3PuppeteerScraping(url) {
    let browser;
    try {
      console.log('[IG-Pro] Trying Method 3: Puppeteer Scraping (Heaviest)');
      browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setUserAgent(getHeaders(url)['User-Agent']);
      
      // Set cookies in puppeteer if available
      if (fs.existsSync(this.cookiesPath)) {
        const content = fs.readFileSync(this.cookiesPath, 'utf8');
        const cookies = content.split('\n')
          .filter(line => line && !line.startsWith('#'))
          .map(line => {
            const parts = line.split('\t');
            if (parts.length >= 7) {
              return {
                name: parts[5],
                value: parts[6],
                domain: parts[0].startsWith('.') ? parts[0] : `.${parts[0]}`,
                path: parts[2],
                secure: parts[3] === 'TRUE',
                httpOnly: line.includes('#HttpOnly_')
              };
            }
            return null;
          }).filter(Boolean);
        await page.setCookie(...cookies);
      }

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await getRandomDelay(1000, 2000);

      const mediaData = await page.evaluate(() => {
        const video = document.querySelector('video');
        if (video) return { type: 'video', url: video.src };
        
        const img = document.querySelector('article img[srcset], article img[src]');
        if (img) return { type: 'image', url: img.src };
        
        return null;
      });

      if (mediaData && mediaData.url) {
        return {
          status: 'success',
          method: 'puppeteer',
          type: mediaData.type,
          url: mediaData.url,
          thumbnail: mediaData.url // In case of video, this might need more work
        };
      }
      return null;
    } catch (e) {
      console.error('[IG-Pro] Method 3 failed:', e.message);
      return null;
    } finally {
      if (browser) await browser.close();
    }
  }

  async download(url) {
    // 1. Validation
    const igRegex = /\/(?:p|reels?|tv)\/([A-Za-z0-9_-]+)/;
    if (!igRegex.test(url)) {
      throw new Error('Invalid or unsupported Instagram URL. Only Posts, Reels, and TV are supported.');
    }

    // 2. Try Method 1
    let result = await this.method1SessionScraping(url);
    if (result && result.status === 'success') return result;

    // 3. Try Method 2 (Partial)
    const partial = await this.method2EmbedExtraction(url);
    
    // 4. Try Method 3 (Final Fallback)
    result = await this.method3PuppeteerScraping(url);
    if (result) return result;

    if (partial) return { ...partial, status: 'success', message: 'Extracted via Embed (May be thumbnail only)' };

    throw new Error('Failed to extract media from this Instagram post. It might be private or restricted.');
  }
}

module.exports = new InstagramProService();
