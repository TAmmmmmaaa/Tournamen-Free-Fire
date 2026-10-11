/*
 * Konfigurasi publik Supabase.
 * URL + publishable/anon key memang dapat dilihat browser. Keamanan harus ditegakkan
 * dengan RLS/policies di Supabase, bukan dengan menyamarkan key.
 * JANGAN masukkan service_role key, password DB, atau secret server di file ini.
 */
window.TOURNAMENT_CONFIG = Object.freeze({
  supabaseUrl: 'https://gnejjmllyvacskpbrkgw.supabase.co',
  supabasePublishableKey: 'sb_publishable_FnzJNYm7TtnA61CI_uvDnQ_aqQefTdR',
  tableName: 'teams',
  totalSlots: 64
});
