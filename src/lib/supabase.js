import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!supabaseConfigured) {
  console.warn("[NIRA] Supabase credentials not configured — running in demo mode.");
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder",
  {
    auth: {
      autoRefreshToken: supabaseConfigured,
      persistSession: supabaseConfigured,
      detectSessionInUrl: supabaseConfigured,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
);
