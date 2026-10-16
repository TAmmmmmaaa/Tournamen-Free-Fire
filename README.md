# Turnamen Free Fire — hasil refactor

Versi ini memisahkan tampilan, gaya, konfigurasi, dan logika aplikasi agar mudah dirawat.

## Struktur

```text
index.html
assets/
  css/style.css
  js/config.js
  js/app.js
sql/
  harden_supabase.sql
```

## Cara menjalankan

1. Buka `assets/js/config.js` dan pastikan URL serta publishable/anon key sesuai project Supabase.
2. Jalankan lewat server lokal (misalnya ekstensi Live Server) atau hosting statis; jangan membuka file HTML langsung jika browser membatasi request jaringan.
3. Pastikan tabel `public.teams` dan nama kolom cocok dengan kode.
4. Uji semua operasi dengan project Supabase staging sebelum production.

## Penting: database dan privasi

- Publishable/anon key memang dapat terlihat di browser; RLS dan grants yang benar adalah batas keamanan. Jangan pernah memasukkan `service_role` key atau password database ke HTML/JS.
- Script `sql/harden_supabase.sql` adalah titik awal, **bukan sesuatu yang aman dijalankan tanpa review**. Backup database lebih dulu, tinjau policy lama, uji di staging, dan sesuaikan dengan struktur tabel nyata.
- Versi awal menampilkan WhatsApp dan Player ID pada halaman publik. Itu berarti data tersebut bisa dibaca siapa saja yang dapat membuka website. Untuk production, pindahkan detail kontak/ID pemain ke tabel privat dan buat view publik yang hanya berisi `slot`, `team_name`, dan status pendaftaran. Form pendaftaran yang aman untuk skala publik sebaiknya melalui backend/Edge Function dengan rate limiting, validasi server-side, dan proteksi spam; jangan memberi browser hak SELECT atas informasi pribadi.
- Public browser clients tidak boleh mendapat `service_role` key. Jangan menaruh informasi admin atau secrets di repository.
- Perubahan hanya berlaku pada salinan ini sampai Anda mengunggahnya ke repository.
