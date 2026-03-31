import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('🚨 SUPER CRITICAL ERROR: Supabase Environment Variables are missing! If you are on Vercel, please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Vercel project settings.')
}

// We provide fallback dummy strings so the app doesn't crash to a full black screen immediately, 
// allowing you to at least see the site and read the console error!
export const supabase = createClient(
  supabaseUrl || 'https://missing-url.supabase.co', 
  supabaseKey || 'missing-key'
)
