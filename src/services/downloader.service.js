const fs = require('fs');
const path = require('path');
const youtubedl = require('youtube-dl-exec');
const fetch = require('node-fetch');
let ffmpegPath = '';
try { ffmpegPath = require('ffmpeg-static'); } catch (e) {}

class DownloaderService {
  getHeaders(url) {
    return [
      'accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'accept-language:en-US,en;q=0.9',
      'sec-ch-ua:"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
      'sec-ch-ua-mobile:?0',
      'sec-ch-ua-platform:"Windows"',
      'sec-fetch-dest:document',
      'sec-fetch-mode:navigate',
      'sec-fetch-site:none',
      'sec-fetch-user:?1',
      'upgrade-insecure-requests:1'
    ];
  }

  // Helper to get cookies as string for fetch
  async getCookiesString() {
    try {
      const cookiesPath = path.join(__dirname, '../../cookies.txt');
      if (fs.existsSync(cookiesPath)) {
        const content = fs.readFileSync(cookiesPath, 'utf8');
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
    } catch (e) { console.error('[Cookies] Error reading:', e.message); }
    return '';
  }

  // Method 1: Direct JSON Fetch (Try multiple endpoints)
  async fetchInstagramDirect(url) {
    try {
      const match = url.match(/\/(?:reels?|p|stories)\/([A-Za-z0-9_-]+)/);
      if (!match) return null;
      const shortcode = match[1];
      console.log(`[Downloader] Attempting Method 1 (Direct JSON) for: ${shortcode}`);

      const cookieStr = await this.getCookiesString();
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'X-IG-App-ID': '936619743392459',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.instagram.com/'
      };
      if (cookieStr) headers['Cookie'] = cookieStr;

      // Endpoint A: Info API
      let apiReq = await fetch(`https://www.instagram.com/api/v1/media/${shortcode}/info/`, { headers });
      let json;

      if (apiReq.ok) {
        json = await apiReq.json();
      } else {
        // Endpoint B: Alternative JSON API
        console.log(`[Downloader] Method 1A failed, trying 1B for: ${shortcode}`);
        apiReq = await fetch(`https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`, { headers });
        if (apiReq.ok) json = await apiReq.json();
      }

      const item = json?.items?.[0] || json?.graphql?.shortcode_media;
      if (!item) return null;

      const formats = [];
      const videoVersions = item.video_versions || (item.is_video ? [{ url: item.video_url, width: 1080, height: 1920 }] : null);
      const imageVersions = item.image_versions2?.candidates || [{ url: item.display_url, width: 1080, height: 1080 }];

      if (videoVersions) {
        videoVersions.forEach((v, i) => {
          formats.push({
            format_id: `direct_v_${i}`,
            ext: 'mp4',
            quality: `${v.width}x${v.height} (with Audio)`,
            size: 0,
            format_type: 'video',
            url: v.url,
            has_audio: true,
            resource_content: JSON.stringify({ url, format_id: `direct_v_${i}`, ext: 'mp4', quality: 'Direct' })
          });
        });
      }

      if (imageVersions) {
        imageVersions.forEach((img, i) => {
          formats.push({
            format_id: `direct_img_${i}`,
            ext: 'jpg',
            quality: `${img.width}x${img.height} (Image)`,
            size: 0,
            format_type: 'image',
            url: img.url,
            has_audio: false,
            resource_content: JSON.stringify({ url, format_id: `direct_img_${i}`, ext: 'jpg', quality: 'Direct Image' })
          });
        });
      }

      // Extract Included Song/Music
      const musicInfo = item.clips_metadata?.music_info?.music_asset_info || item.music_metadata?.music_asset_info;
      if (musicInfo && musicInfo.progressive_download_url) {
        formats.push({
          format_id: 'ig_music',
          ext: 'mp3',
          quality: `${musicInfo.title} - ${musicInfo.display_artist} (Song)`,
          size: 0,
          format_type: 'audio',
          url: musicInfo.progressive_download_url,
          has_audio: true,
          resource_content: JSON.stringify({ url, format_id: 'ig_music', ext: 'mp3', quality: 'Song' })
        });
      }

      if (formats.length === 0) return null;

      return {
        title: item.caption?.text || item.edge_media_to_caption?.edges?.[0]?.node?.text || 'Instagram Content',
        duration: item.video_duration || 0,
        cover_url: imageVersions[0]?.url,
        preview_url: videoVersions?.[0]?.url,
        medias: formats,
        type: videoVersions ? "video" : "image",
        url: videoVersions?.[0]?.url || imageVersions[0]?.url,
        thumbnail: imageVersions[0]?.url
      };
    } catch (e) {
      console.error('[Downloader] Method 1 failed:', e.message);
      return null;
    }
  }

  // Method 2: GraphQL Scraping (HTML Parsing)
  async fetchInstagramGraphQL(url) {
    try {
      console.log(`[Downloader] Attempting Method 2 (GraphQL Scraping) for: ${url}`);
      const cookieStr = await this.getCookiesString();
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      };
      if (cookieStr) headers['Cookie'] = cookieStr;

      const response = await fetch(url, { headers });

      if (!response.ok) return null;
      const html = await response.text();

      // Look for JSON in various script tags
      const jsonMatch = html.match(/<script[^>]*>window\._sharedData\s*=\s*({.*?});<\/script>/) || 
                        html.match(/<script[^>]*>window\.__additionalDataLoaded\([^,]*,\s*({.*?})\);<\/script>/) ||
                        html.match(/<script type="application\/json" data-dire-normalized="true">({.*?})<\/script>/);
      
      if (!jsonMatch) return null;
      const data = JSON.parse(jsonMatch[1]);
      const media = data.entry_data?.PostPage?.[0]?.graphql?.shortcode_media || data.graphql?.shortcode_media || data.items?.[0];
      if (!media) return null;

      const formats = [];
      const videoUrl = media.video_url || media.video_versions?.[0]?.url;
      const displayUrl = media.display_url || media.image_versions2?.candidates?.[0]?.url;

      if (videoUrl) {
        formats.push({
          format_id: 'graphql_video',
          ext: 'mp4',
          quality: 'Original Video (with Audio)',
          size: 0,
          format_type: 'video',
          url: videoUrl,
          has_audio: true,
          resource_content: JSON.stringify({ url, format_id: 'graphql_video', ext: 'mp4', quality: 'GraphQL' })
        });
      }

      if (displayUrl) {
        formats.push({
          format_id: 'graphql_image',
          ext: 'jpg',
          quality: 'High Res Image',
          size: 0,
          format_type: 'image',
          url: displayUrl,
          has_audio: false,
          resource_content: JSON.stringify({ url, format_id: 'graphql_image', ext: 'jpg', quality: 'GraphQL Image' })
        });
      }

      return {
        title: media.edge_media_to_caption?.edges?.[0]?.node?.text || media.caption?.text || 'Instagram Content',
        duration: media.video_duration || 0,
        cover_url: displayUrl,
        preview_url: videoUrl || null,
        medias: formats,
        type: videoUrl ? "video" : "image",
        url: videoUrl || displayUrl,
        thumbnail: displayUrl
      };
    } catch (e) {
      console.error('[Downloader] Method 2 failed:', e.message);
      return null;
    }
  }

  async parseMetadata(url) {
    const isInstagram = url.includes('instagram.com');

    // TRY METHOD 1 (Direct JSON Fetch)
    if (isInstagram) {
      const directData = await this.fetchInstagramDirect(url);
      if (directData) return directData;

      // TRY METHOD 2 (GraphQL Scraping)
      const gqlData = await this.fetchInstagramGraphQL(url);
      if (gqlData) return gqlData;
    }

    try {
      console.log(`[Downloader] Fetching metadata for: ${url}`);
      const isTwitter = url.includes('twitter.com') || url.includes('x.com');
      const isInstagram = url.includes('instagram.com');
      
      const dlOptions = {
        dumpSingleJson: true,
        noCheckCertificate: true,
        noWarnings: true,
        preferFreeFormats: true,
        noPlaylist: true,
        rmCacheDir: true,
        socketTimeout: 30,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        extractorArgs: 'youtube:player-client=ios',
        referer: isInstagram ? 'https://www.instagram.com/' : (isTwitter ? 'https://x.com/' : 'https://www.google.com/'),
        addHeader: isInstagram ? [
          'accept: */*',
          'accept-language: en-US,en;q=0.9',
          'origin: https://www.instagram.com',
          'referer: https://www.instagram.com/',
          'sec-fetch-dest: empty',
          'sec-fetch-mode: cors',
          'sec-fetch-site: same-origin',
          'x-ig-app-id: 936619743392459'
        ] : [
          'referer: https://www.youtube.com/',
          'origin: https://www.youtube.com/'
        ]
      };

      // Check for cookies.txt in the backend root
      const cookiesPath = path.join(__dirname, '../../cookies.txt');
      console.log(`[Downloader] Checking for cookies at: ${cookiesPath}`);
      if (fs.existsSync(cookiesPath)) {
        const stats = fs.statSync(cookiesPath);
        console.log(`[Downloader] Cookies file found! Size: ${stats.size} bytes`);
        dlOptions.cookies = cookiesPath;
      } else {
        console.warn(`[Downloader] Cookies file NOT FOUND at: ${cookiesPath}`);
      }

      // Instagram specific logic
      if (isInstagram) {
        // DO NOT set format here - let yt-dlp decide
        dlOptions.ignoreErrors = true;
        // Simplify headers for Instagram to avoid bot detection
        dlOptions.addHeader = [
          'accept: */*',
          'accept-language: en-US,en;q=0.9',
          'origin: https://www.instagram.com',
          'referer: https://www.instagram.com/'
        ];
      }

      let output;
      try {
        console.log(`[Downloader] Attempting yt-dlp for: ${url}`);
        output = await youtubedl(url, dlOptions);
      } catch (err) {
        console.warn(`[Downloader] First attempt failed: ${err.message}`);
        
        // Fallback 1: Minimal options + generic extractor
        try {
          console.log(`[Downloader] Retrying with force-generic-extractor...`);
          output = await youtubedl(url, {
            dumpSingleJson: true,
            noCheckCertificate: true,
            cookies: dlOptions.cookies,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            forceGenericExtractor: true,
            noWarnings: true,
            rmCacheDir: true
          });
        } catch (retryErr) {
          console.warn(`[Downloader] Generic extractor failed: ${retryErr.message}`);
          
          // Fallback 2: Absolute minimal options
          try {
            console.log(`[Downloader] Retrying with minimal options...`);
            output = await youtubedl(url, {
              dumpSingleJson: true,
              noCheckCertificate: true,
              cookies: dlOptions.cookies,
              userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              noWarnings: true,
              rmCacheDir: true
            });
          } catch (finalErr) {
            console.error(`[Downloader] All attempts failed: ${finalErr.message}`);
            throw err; // Throw original error
          }
        }
      }

      if (!output) {
        throw new Error('yt-dlp returned empty output');
      }

      // If it's a string, it's probably an error or raw output
      if (typeof output === 'string') {
        try {
          output = JSON.parse(output);
        } catch (e) {
           console.error('[Downloader] Error or JSON Parse Error:', output.substring(0, 500));
           throw new Error(output.split('\n')[0] || 'Failed to parse video metadata');
        }
      }

      const formats = [];
      
      // Step 4: Extract Video URL, Image URL, Thumbnail
      const processEntry = (entry) => {
        // 1. Check for standard formats
        if (entry.formats && entry.formats.length > 0) {
          entry.formats.forEach(f => {
            if (f.ext !== 'mhtml' && f.url && !f.url.includes('.m3u8')) {
              const hasAudio = f.acodec !== 'none' && f.acodec !== undefined;
              const hasVideo = f.vcodec !== 'none' && f.vcodec !== undefined;
              
              let qualityLabel = f.format_note || f.resolution || (f.height ? `${f.height}p` : 'Audio');
              if (hasVideo) {
                qualityLabel += " (with Audio)";
              }

              formats.push({
                format_id: f.format_id,
                ext: f.ext,
                quality: qualityLabel,
                size: f.filesize || f.filesize_approx || 0,
                format_type: hasVideo ? 'video' : 'audio',
                url: f.url,
                has_audio: hasAudio,
                resource_content: JSON.stringify({ url: entry.webpage_url || url, format_id: f.format_id, ext: f.ext, quality: qualityLabel })
              });
            }
          });
        }
        
        // 2. Fallback: If no video formats, use the direct URL if it's an image post
        if (formats.length === 0 && entry.url && entry.url.match(/\.(jpg|jpeg|png|webp|mp4)/)) {
           formats.push({
              format_id: 'original',
              ext: entry.ext || (entry.url.includes('.mp4') ? 'mp4' : 'jpg'),
              quality: 'Original Quality',
              size: 0,
              format_type: entry.url.includes('.mp4') ? 'video' : 'image',
              url: entry.url,
              has_audio: entry.url.includes('.mp4'),
              resource_content: JSON.stringify({ url: entry.webpage_url || url, format_id: 'original', ext: entry.ext || 'jpg', quality: 'Original' })
           });
        }

        // 4. GraphQL / Display URL fallback
        if (formats.length === 0 && entry.display_url) {
           formats.push({
              format_id: 'display',
              ext: 'jpg',
              quality: 'High Res Image',
              size: 0,
              format_type: 'image',
              url: entry.display_url,
              has_audio: false,
              resource_content: JSON.stringify({ url: entry.webpage_url || url, format_id: 'display', ext: 'jpg', quality: 'High Res' })
           });
        }

        // 3. Carousel/Thumbnails fallback
        if (formats.length === 0 && entry.thumbnails && entry.thumbnails.length > 0) {
           const bestThumb = entry.thumbnails[entry.thumbnails.length - 1];
           formats.push({
              format_id: 'thumbnail',
              ext: 'jpg',
              quality: 'High Res Image',
              size: 0,
              format_type: 'image',
              url: bestThumb.url,
              has_audio: false,
              resource_content: JSON.stringify({ url: entry.webpage_url || url, format_id: 'thumbnail', ext: 'jpg', quality: 'High Res' })
           });
        }
      };

      if (output.formats || output.url || output.thumbnails) {
        processEntry(output);
      } 
      
      if (output.entries) {
        output.entries.forEach(processEntry);
      }

      // Sort: First by combined formats (video+audio), then by size
      formats.sort((a, b) => {
        if (a.has_audio !== b.has_audio) return b.has_audio ? 1 : -1;
        return b.size - a.size;
      });

      // Find a suitable preview URL: Priority 1: Combined format (Video+Audio), Priority 2: Video only
      const previewFormat = formats.find(f => f.format_type === 'video' && f.has_audio) || formats.find(f => f.format_type === 'video');

      const thumbnail = output.thumbnail || (output.thumbnails && output.thumbnails.length > 0 ? output.thumbnails[output.thumbnails.length - 1].url : (output.entries && output.entries[0] && output.entries[0].thumbnail ? output.entries[0].thumbnail : null));

      // Step 5: Return response in the required structure
      return {
        title: output.title || (output.entries && output.entries[0] && output.entries[0].title ? output.entries[0].title : 'Instagram Content'),
        duration: output.duration || (output.entries && output.entries[0] && output.entries[0].duration ? output.entries[0].duration : 0),
        cover_url: thumbnail,
        preview_url: previewFormat ? previewFormat.url : null,
        medias: formats,
        // Custom fields for Step 5 compliance
        type: previewFormat ? "video" : "image",
        url: previewFormat ? (previewFormat.has_audio ? previewFormat.url : previewFormat.url) : thumbnail, // Just keep the logic clean
        thumbnail: thumbnail
      };
    } catch (err) {
      console.error(`[Downloader] Error parsing ${url}:`, err.message);
      throw err;
    }
  }

  async startDownload(url, format_id, ext, downloadsDir, jobId, onProgress) {
    const filename = `${jobId}.${ext}`;
    const outPath = path.join(downloadsDir, filename);
    const isTwitter = url.includes('twitter.com') || url.includes('x.com');
    const isInstagram = url.includes('instagram.com');

    // If it's an audio format or specifically requested as mp3, don't try to merge with video
    // Otherwise, for video formats, try to merge with best audio
    let formatArg;
    if (ext === 'mp3' || format_id.includes('audio') || format_id === 'bestaudio') {
      formatArg = format_id === 'best' ? 'bestaudio/best' : format_id;
    } else {
      formatArg = format_id === 'best' 
        ? 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' 
        : `${format_id}+bestaudio/best`;
    }

    console.log(`[Downloader] Starting download to ${outPath} with format: ${formatArg}`);
    
    const dlOptions = {
      format: formatArg,
      output: outPath,
      mergeOutputFormat: 'mp4', // Force merge to mp4 for audio compatibility
      noWarnings: true,
      concurrentFragments: 10,
      noPlaylist: true,
      noCheckCertificate: true,
      addHeader: this.getHeaders(url),
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      extractorArgs: 'youtube:player-client=ios',
      referer: isTwitter ? 'https://x.com/' : (isInstagram ? 'https://www.instagram.com/' : 'https://www.google.com/'),
      rmCacheDir: true,
      hlsUseMpegts: true,
      preferFreeFormats: true,
      geoBypass: true
    };

    // Check for cookies.txt in the backend root for downloads too
    const cookiesPath = path.join(__dirname, '../../cookies.txt');
    if (fs.existsSync(cookiesPath)) {
      const stats = fs.statSync(cookiesPath);
      console.log(`[Downloader Download] Using cookies file (${stats.size} bytes)`);
      dlOptions.cookies = cookiesPath;
    } else {
      console.warn(`[Downloader Download] Cookies file NOT FOUND at: ${cookiesPath}`);
    }
    
    if (ffmpegPath) {
      console.log(`[Downloader] Using FFmpeg for merging: ${ffmpegPath}`);
      // For Windows, pointing to the executable is fine, but sometimes directory is safer
      dlOptions.ffmpegLocation = ffmpegPath;
    }

    // Use exec to handle progress
    return new Promise((resolve, reject) => {
      const subprocess = youtubedl.exec(url, dlOptions);

      subprocess.stdout.on('data', (data) => {
        const line = data.toString();
        // Regex to match [download]  10.5% of 10.00MiB at  1.50MiB/s ETA 00:06
        const match = line.match(/\[download\]\s+(\d+\.\d+)%/);
        if (match && onProgress) {
          onProgress(parseFloat(match[1]));
        }
      });

      subprocess.stderr.on('data', (data) => {
        console.warn(`[Downloader Progress Warn] ${data.toString()}`);
      });

      subprocess.on('close', (code) => {
        if (code === 0) {
          // Check if the file exists with the expected name, or if it was merged to .mp4
          if (fs.existsSync(outPath)) {
            resolve(filename);
          } else {
            // Check for potential merged filename if ext was webm/mkv/etc
            const mp4Path = outPath.replace(/\.[^/.]+$/, ".mp4");
            if (fs.existsSync(mp4Path)) {
              resolve(`${jobId}.mp4`);
            } else {
              // Final fallback: find any file starting with jobId in downloadsDir
              try {
                const files = fs.readdirSync(downloadsDir);
                const found = files.find(f => f.startsWith(jobId));
                if (found) {
                  resolve(found);
                } else {
                  resolve(filename); // Last resort fallback
                }
              } catch (e) {
                resolve(filename);
              }
            }
          }
        }
        else reject(new Error(`yt-dlp exited with code ${code}`));
      });

      subprocess.on('error', (err) => {
        reject(err);
      });
    });
  }
}

module.exports = new DownloaderService();
