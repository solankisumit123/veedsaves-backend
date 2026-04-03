const path = require('path');
const fs = require('fs');
let ffmpeg;
try {
  ffmpeg = require('fluent-ffmpeg');
} catch(e) { }

class FFmpegService {
    async convertToMp3(oldFile, newFilePath) {
        if (!ffmpeg) throw new Error("fluent-ffmpeg is not installed");
        
        return new Promise((resolve, reject) => {
            ffmpeg(oldFile)
                .toFormat('mp3')
                .on('error', (err) => reject(err))
                .on('end', () => resolve())
                .save(newFilePath);
        });
    }
}

module.exports = new FFmpegService();
