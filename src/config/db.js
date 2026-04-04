require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://eibwpyegppboogdveoen.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_lrsMIDIg7rIp7LYl3MKRqw_OjZ1REma';

const supabase = createClient(supabaseUrl, supabaseKey);

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.warn("⚠️ [DB] Using fallback Supabase credentials. Make sure to set them in Environment Variables on Cloud.");
}

module.exports = supabase;
