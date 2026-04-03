const fs = require('fs');
const path = require('path');
const downloaderService = require('../services/downloader.service');
const ffmpegService = require('../services/ffmpeg.service');
const VideoJob = require('../models/VideoJob');

const downloadsDir = path.join(__dirname, '../../downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

const processJob = async (jobId, url, format_id, ext) => {
  try {
    console.log(`[Worker] Started processing Job ${jobId}`);
    await VideoJob.updateJob(jobId, { status: 'processing', progress: 5 });
    
    // Throttle database updates
    let lastProgressUpdate = 0;
    const updateProgress = async (progress) => {
      const now = Date.now();
      if (now - lastProgressUpdate > 2000) { // Update every 2 seconds
        lastProgressUpdate = now;
        await VideoJob.updateJob(jobId, { progress });
      }
    };

    // 1. Download via yt-dlp
    let fileName = await downloaderService.startDownload(url, format_id, ext, downloadsDir, jobId, updateProgress);
    
    // 2. Transcode if requested to mp3
    if (ext === 'mp3' && !fileName.endsWith('.mp3')) {
        await VideoJob.updateJob(jobId, { status: 'transcoding', progress: 95 });
        const oldFile = path.join(downloadsDir, fileName);
        const newFileName = `${jobId}.mp3`;
        const newFilePath = path.join(downloadsDir, newFileName);
        
        await ffmpegService.convertToMp3(oldFile, newFilePath);
        
        fs.unlinkSync(oldFile);
        fileName = newFileName;
    }

    await VideoJob.updateJob(jobId, { status: 'completed', progress: 100, file_path: fileName });
    console.log(`[Worker] Completed Job ${jobId}`);
    return fileName;
  } catch (err) {
    console.error(`[Worker] Failed Job ${jobId}: ${err.message}`);
    await VideoJob.updateJob(jobId, { status: 'failed', error_message: err.message });
    throw err; 
  }
};

module.exports = { processJob };
