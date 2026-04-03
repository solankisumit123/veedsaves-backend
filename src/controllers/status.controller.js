const VideoJob = require('../models/VideoJob');

class StatusController {

  async getStatus(req, res) {
    try {
      const job = await VideoJob.getJob(req.params.id);
      if (!job) return res.status(404).json({ status: 0, msg: "Job not found" });

      res.json({
        status: 1,
        data: {
          status: job.status,
          progress: job.progress,
          error_message: job.errorMessage || job.error_message,
          file_path: job.filePath || job.file_path
        }
      });
    } catch (err) {
      res.status(500).json({ status: 0, msg: err.message });
    }
  }

  async getResult(req, res) {
    try {
      const job = await VideoJob.getJob(req.params.id);
      if (!job) return res.status(404).json({ status: 0, msg: "Job not found" });

      const finalFilePath = job.filePath || job.file_path;
      if (job.status === 'completed' && finalFilePath) {
        const host = req.protocol + '://' + req.get('host');
        res.json({
          status: 1,
          download_link: `${host}/downloads/${finalFilePath}`
        });
      } else {
        res.status(400).json({ status: 0, msg: `Job not ready. Status: ${job.status}` });
      }
    } catch (err) {
      res.status(500).json({ status: 0, msg: err.message });
    }
  }

}

module.exports = new StatusController();
