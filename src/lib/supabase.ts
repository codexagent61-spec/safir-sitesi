import { createClient } from '@supabase/supabase-js'

// Supabase "publishable" anahtarı istemcide kullanılmak üzere tasarlanmıştır;
// veri erişimi tamamen Row Level Security (RLS) politikalarıyla korunur.
export const SUPABASE_URL = 'https://erlmkdaqnmyanajxacwg.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_FQ2zpFhXzh2SoLVfomsHFQ_6doDsSRP'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
