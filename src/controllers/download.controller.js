const downloaderService = require('../services/downloader.service');
const instagramProService = require('../services/instagramPro.service');
const VideoJob = require('../models/VideoJob');
const { getQueue } = require('../queue/queue');
const fetch = require('node-fetch');

class DownloadController {
    
  async parseVideo(req, res) {
    const { link } = req.body;
    if (!link) return res.status(400).json({ status: 0, msg: "Missing link parameter" });

    try {
      // ── SPECIAL CASE: Instagram Pro Flow ──
      if (link.includes('instagram.com')) {
        try {
          const igData = await instagramProService.download(link);
          return res.json({ 
            status: 1, 
            data: {
              title: igData.title || 'Instagram Media',
              cover_url: igData.thumbnail,
              preview_url: igData.url,
              medias: igData.medias || [{
                format_id: 'original',
                ext: igData.type === 'video' ? 'mp4' : 'jpg',
                quality: 'Original Quality (Pro)',
                size: 0,
                format_type: igData.type,
                url: igData.url,
                has_audio: igData.type === 'video',
                resource_content: JSON.stringify({ url: link, format_id: 'original', ext: igData.type === 'video' ? 'mp4' : 'jpg' })
              }],
              method_used: igData.method
            }
          });
        } catch (igErr) {
          console.warn('[Controller IG-Pro Fallback to yt-dlp]', igErr.message);
          // Fallback to standard yt-dlp if Pro method fails
        }
      }

      const data = await downloaderService.parseMetadata(link);
      res.json({ status: 1, data: data });
    } catch (err) {
      console.error('[Controller error /parse]', err);
      // Send the actual error message from yt-dlp if it exists
      let errorMsg = err.message || "Failed to parse video. Check URL.";
      
      // Hinglish translations for common yt-dlp errors
      if (errorMsg.includes("You need to log in to access this content") || errorMsg.includes("Sign in to confirm you") || errorMsg.includes("login")) {
        errorMsg = "YouTube ya Instagram ne request block kar di hai. Ho sakta hai cookies expire ho gayi hon ya login session khatam ho gaya ho. Kripya naye cookies add karein.";
      } else if (errorMsg.includes("Private video")) {
        errorMsg = "Yeh video private hai. Isay download nahi kiya ja sakta.";
      } else if (errorMsg.includes("Video unavailable")) {
        errorMsg = "Yeh video available nahi hai ya delete ho chuka hai.";
      } else if (errorMsg.includes("Unsupported URL")) {
        errorMsg = "Yeh URL support nahi karta. Kripya sahi link check karein.";
      }
      
      res.status(500).json({ 
        status: 0, 
        msg: errorMsg,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  }

  async startDownload(req, res) {
    try {
      let payload = req.body;
      if (req.body.request) payload = JSON.parse(req.body.request);
      
      if (!payload.url || !payload.format_id) {
         return res.status(400).json({ status: 0, msg: "Missing url or format_id parameter" });
      }

      const ext = payload.ext || 'mp4';
      
      const jobRecord = await VideoJob.createJob({
        url: payload.url,
        format_id: payload.format_id,
        ext: ext,
        quality: payload.quality || 'Auto'
      });

      const finalJobId = jobRecord.job_id || jobRecord.jobId;

      await getQueue().add({
        jobId: finalJobId,
        url: payload.url,
        format_id: payload.format_id,
        ext: ext
      });

      res.json({ status: 1, jobId: finalJobId, msg: "Download queued successfully." });
    } catch (err) {
      console.error('[Controller error /download]', err);
      res.status(500).json({ status: 0, msg: err.message });
    }
  }

  async proxyImage(req, res) {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).send('No URL');
    
    try {
      const fetchRes = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
          'Referer': new URL(imageUrl).origin
        },
        timeout: 5000 // Set a timeout
      });
      
      if (!fetchRes.ok) throw new Error(`Proxy failed with status ${fetchRes.status}`);
      
      const contentType = fetchRes.headers.get('content-type');
      if (contentType) res.setHeader('Content-Type', contentType);
      
      // Use pipe and handle stream errors
      fetchRes.body.pipe(res).on('error', (err) => {
        console.error('[Proxy Stream Error]', err);
        if (!res.headersSent) {
          res.redirect('https://placehold.co/640x360/12141D/FFE000?text=veedsaves');
        }
      });
    } catch (err) {
      console.error('[Proxy Error]', err.message);
      if (!res.headersSent) {
        res.redirect('https://placehold.co/640x360/12141D/FFE000?text=veedsaves');
      }
    }
  }
}

module.exports = new DownloadController();
