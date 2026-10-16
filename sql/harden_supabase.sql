-- PENTING: jalankan setelah backup dan verifikasi struktur tabel.
-- Script ini mengasumsikan tabel public.teams memiliki kolom:
-- slot (integer, unik), team_name, whatsapp, representative,
-- player1_id, player2_id, player3_id, player4_id.
-- Uji di project staging terlebih dahulu. Kebijakan SELECT publik membuat data tim
-- (termasuk WhatsApp/Player ID) terlihat publik; idealnya pindahkan data sensitif
-- ke tabel privat dan buat view publik dengan kolom yang aman saja.

begin;

alter table public.teams enable row level security;
alter table public.teams force row level security;

-- Hapus kebijakan lama untuk role anon/authenticated agar tak ada policy permisif
-- yang secara tak sengaja memperluas akses. Tinjau juga policy lain yang sudah ada.
do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'teams'
      and roles && array['anon','authenticated']::name[]
  loop
    execute format('drop policy if exists %I on public.teams', p.policyname);
  end loop;
end $$;

-- CAUTION: policy SELECT ini membuat semua kolom yang dapat di-SELECT oleh role
-- anon terbaca publik, termasuk nomor WhatsApp dan player ID. Ini hanya cocok
-- untuk mempertahankan kompatibilitas dengan UI lama, bukan privasi produksi.
-- Untuk production, jangan jalankan grant/policy SELECT di bawah untuk tabel ini.
-- Sebagai gantinya, pindahkan detail kontak/ID ke tabel privat dan expose view
-- aman (misalnya hanya slot, team_name, status) untuk halaman publik; ubah aplikasi
-- agar SELECT dari view itu, lalu kirim pendaftaran via Edge Function/backend.
create policy "public can read team slots"
  on public.teams for select
  to anon, authenticated
  using (slot between 1 and 64);

-- Public boleh mengubah record HANYA jika slot belum terdaftar dan nilai slot valid.
-- Validasi input panjang/format dilakukan juga di sisi client, tetapi constraint DB
-- adalah pertahanan yang otoritatif. Hak kolom harus dibatasi lewat GRANT kolom.
create policy "public can register an empty team slot"
  on public.teams for update
  to anon, authenticated
  using (slot between 1 and 64 and team_name is null)
  with check (
    slot between 1 and 64
    and nullif(trim(team_name), '') is not null
    and length(team_name) <= 80
    and nullif(trim(whatsapp), '') is not null
    and length(whatsapp) <= 25
    and nullif(trim(representative), '') is not null
    and length(representative) <= 80
    and nullif(trim(player1_id), '') is not null and length(player1_id) <= 30
    and nullif(trim(player2_id), '') is not null and length(player2_id) <= 30
    and nullif(trim(player3_id), '') is not null and length(player3_id) <= 30
    and nullif(trim(player4_id), '') is not null and length(player4_id) <= 30
  );

-- Cabut hak tulis tabel secara menyeluruh dan berikan UPDATE hanya pada kolom
-- formulir; kolom id/slot/timestamp atau kolom admin tidak bisa dimodifikasi publik.
revoke insert, delete, truncate, references, trigger on table public.teams from anon, authenticated;
revoke update on table public.teams from anon, authenticated;
grant select (slot, team_name, whatsapp, representative, player1_id, player2_id, player3_id, player4_id)
  on table public.teams to anon, authenticated;
grant update (team_name, whatsapp, representative, player1_id, player2_id, player3_id, player4_id)
  on table public.teams to anon, authenticated;

-- Constraint validasi input dapat ditambahkan setelah audit data existing.
-- Contoh (jalankan satu per satu setelah memeriksa data lama):
-- alter table public.teams add constraint teams_team_name_length
--   check (team_name is null or length(trim(team_name)) between 1 and 80) not valid;
-- alter table public.teams add constraint teams_slot_range
--   check (slot between 1 and 64) not valid;
-- create unique index if not exists teams_slot_unique_idx on public.teams(slot);

commit;
