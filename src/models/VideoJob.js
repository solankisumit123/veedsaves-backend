const supabase = require('../config/db');
const generateId = require('../utils/generateId');

class VideoJob {
  static async createJob({ url, format_id, ext, quality }) {
    if (!supabase) throw new Error("Database not configured.");
    const jobId = generateId();
    
    const { data: job, error } = await supabase
      .from('video_jobs')
      .insert([{
        job_id: jobId,
        url: url,
        format_id: format_id,
        ext: ext,
        status: 'queued',
        progress: 0
      }])
      .select()
      .single();

    if (error) {
      // Fallback schema mapping
      if (error.code === 'PGRST204' || error.message.includes('column')) {
         const { data: jobFallback, err2 } = await supabase.from('video_jobs').insert([{ jobId: jobId, url, format: ext, quality, status: 'queued', progress: 0 }]).select().single();
         if (err2) throw err2;
         return { ...jobFallback, job_id: jobFallback.jobId }
      }
      throw error;
    }
    return job; // returns the job record
  }

  static async getJob(jobId) {
    if (!supabase) throw new Error("Database not configured.");
    
    let { data, error } = await supabase
      .from('video_jobs')
      .select('*')
      .eq('job_id', jobId)
      .single();
    
    if (error && error.code === 'PGRST116') {
      const fallbackQuery = await supabase.from('video_jobs').select('*').eq('jobId', jobId).single();
      data = fallbackQuery.data;
      error = fallbackQuery.error;
    }

    if (error) throw error;
    return data;
  }

  static async updateJob(jobId, updates) {
    if (!supabase) return; 
    
    let { error } = await supabase
      .from('video_jobs')
      .update(updates)
      .eq('job_id', jobId);
      
    if (error && error.message.includes('column')) {
       const mappedUpdates = {
         status: updates.status,
         progress: updates.progress,
         filePath: updates.file_path,
         errorMessage: updates.error_message
       };
       await supabase.from('video_jobs').update(mappedUpdates).eq('jobId', jobId);
    }
  }
}

module.exports = VideoJob;
