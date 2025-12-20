// supabase.js
const SUPABASE_URL = "https://berlnlzntgfrgylqugdk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_qt55KxqxupDWi_RdO0Nm6g_A3n5V1yt";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// helpers
async function sbUser() {
  const { data } = await supabase.auth.getUser();
  return data.user || null;
}
