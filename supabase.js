const SUPABASE_URL = "https://berlnlzntgfrgylqugdk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qt55KxqxupDWi_RdO0Nm6g_A3n5V1yt";

window.supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
