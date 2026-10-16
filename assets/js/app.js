(() => {
  'use strict';

  const config = window.TOURNAMENT_CONFIG;
  const TOTAL = Number(config?.totalSlots) || 64;
  const COLUMNS = 'slot,team_name,whatsapp,representative,player1_id,player2_id,player3_id,player4_id';
  const $ = (id) => document.getElementById(id);
  let db = null;
  let teams = [];
  let busy = false;
  let previousFocus = null;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
  const isFilled = (team) => Boolean(String(team?.team_name ?? '').trim());

  function setStatus(message, error = false) {
    $('status').textContent = message;
    $('status').dataset.error = String(error);
  }

  function displayError(message) {
    $('formError').textContent = message;
    $('formError').hidden = false;
  }

  function clearFormError() {
    $('formError').textContent = '';
    $('formError').hidden = true;
  }

  function render() {
    const filled = teams.filter(isFilled).length;
    $('total').textContent = String(TOTAL);
    $('filled').textContent = String(filled);
    $('empty').textContent = String(TOTAL - filled);
    $('count').textContent = String(teams.length);

    $('grid').innerHTML = teams.map((team) => {
      const filledTeam = isFilled(team);
      const slot = Number(team.slot);
      const body = filledTeam
        ? `<div class="team-name">${esc(team.team_name)}</div>
           <div class="details">
             <div>Perwakilan: ${esc(team.representative || '-')}</div>
             <div>WhatsApp: ${esc(team.whatsapp || '-')}</div>
             <div>P1: ${esc(team.player1_id || '-')}</div>
             <div>P2: ${esc(team.player2_id || '-')}</div>
             <div>P3: ${esc(team.player3_id || '-')}</div>
             <div>P4: ${esc(team.player4_id || '-')}</div>
           </div>`
        : '<div class="empty-text">Slot ini masih tersedia.</div>';
      const action = filledTeam ? '' : `<div class="slot-foot"><button class="primary" type="button" data-slot="${slot}">Isi Slot</button></div>`;
      return `<article class="slot ${filledTeam ? 'filled' : ''}">
        <div class="slot-head"><span class="slot-num">TEAM ${slot}</span>
          <span class="pill ${filledTeam ? 'filled-pill' : 'empty-pill'}">${filledTeam ? 'TERISI' : 'KOSONG'}</span>
        </div><div class="slot-body">${body}</div>${action}</article>`;
    }).join('');
  }

  async function load() {
    $('refresh').disabled = true;
    setStatus('Memuat data dari Supabase…');
    try {
      const { data, error } = await db.from(config.tableName)
        .select(COLUMNS)
        .gte('slot', 1)
        .lte('slot', TOTAL)
        .order('slot', { ascending: true });
      if (error) throw error;
      const bySlot = new Map((data || []).map((row) => [Number(row.slot), row]));
      teams = Array.from({ length: TOTAL }, (_, i) => bySlot.get(i + 1) || ({
        slot: i + 1, team_name: null, whatsapp: null, representative: null,
        player1_id: null, player2_id: null, player3_id: null, player4_id: null
      }));
      render();
      setStatus(`Data berhasil dimuat • ${new Date().toLocaleTimeString('id-ID')}`);
    } catch (error) {
      console.error('Gagal memuat tim:', error);
      setStatus('Gagal memuat data. Periksa koneksi, tabel, dan RLS Supabase.', true);
      $('grid').innerHTML = '<div class="load-error" style="grid-column:1/-1;padding:18px;border:1px solid #63343a;border-radius:12px">Data belum bisa ditampilkan. Tekan Muat Ulang Data untuk mencoba lagi.</div>';
    } finally {
      $('refresh').disabled = false;
    }
  }

  function openModal(slotNumber) {
    const team = teams.find((item) => Number(item.slot) === slotNumber);
    if (!team || isFilled(team)) {
      window.alert('Slot sudah terisi atau data belum diperbarui. Muat ulang data.');
      void load();
      return;
    }
    previousFocus = document.activeElement;
    $('form').reset();
    clearFormError();
    $('slot').value = String(slotNumber);
    $('modalTitle').textContent = `Daftar Tim ${slotNumber}`;
    $('backdrop').hidden = false;
    $('teamName').focus();
  }

  function closeModal() {
    if (busy) return;
    $('backdrop').hidden = true;
    clearFormError();
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  }

  function validPayload() {
    const payload = {
      team_name: $('teamName').value.trim(),
      whatsapp: $('whatsapp').value.trim(),
      representative: $('rep').value.trim(),
      player1_id: $('p1').value.trim(),
      player2_id: $('p2').value.trim(),
      player3_id: $('p3').value.trim(),
      player4_id: $('p4').value.trim()
    };
    for (const [field, value] of Object.entries(payload)) {
      if (!value) throw new Error('Semua kolom wajib diisi.');
      if (value.length > ({ team_name: 80, whatsapp: 25, representative: 80,
        player1_id: 30, player2_id: 30, player3_id: 30, player4_id: 30 })[field]) {
        throw new Error('Ada data yang melebihi batas karakter.');
      }
      if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) {
        throw new Error('Data berisi karakter yang tidak diperbolehkan.');
      }
    }
    if (!/^[+\d][\d\s().-]{5,23}$/.test(payload.whatsapp)) {
      throw new Error('Format nomor WhatsApp tidak valid.');
    }
    for (const id of [payload.player1_id, payload.player2_id, payload.player3_id, payload.player4_id]) {
      if (!/^[\w-]{1,30}$/.test(id)) throw new Error('Format Player ID tidak valid.');
    }
    return payload;
  }

  async function submitRegistration(event) {
    event.preventDefault();
    if (busy) return;
    clearFormError();

    let slotNumber;
    let payload;
    try {
      slotNumber = Number($('slot').value);
      if (!Number.isInteger(slotNumber) || slotNumber < 1 || slotNumber > TOTAL) {
        throw new Error('Nomor slot tidak valid. Silakan pilih slot kembali.');
      }
      payload = validPayload();
    } catch (error) {
      displayError(error.message || 'Data tidak valid.');
      return;
    }

    if (!window.confirm(`Kirim pendaftaran Tim ${slotNumber}? Pastikan data sudah benar.`)) return;
    busy = true;
    $('submit').disabled = true;
    $('cancel').disabled = true;
    $('submit').textContent = 'Mengirim…';

    try {
      // Optimistic guard: update hanya jika slot masih kosong. RLS tetap wajib di database.
      const { data, error } = await db.from(config.tableName)
        .update(payload)
        .eq('slot', slotNumber)
        .is('team_name', null)
        .select('slot');
      if (error) throw error;
      if (!Array.isArray(data) || data.length !== 1) {
        displayError('Slot sudah diisi atau akses ditolak. Data tidak diubah. Silakan pilih slot lain.');
        await load();
        return;
      }
      $('backdrop').hidden = true;
      window.alert(`Pendaftaran berhasil! Tim ${slotNumber} sudah terdaftar.`);
      await load();
    } catch (error) {
      console.error('Pendaftaran gagal:', error);
      displayError('Pendaftaran gagal. Slot mungkin sudah dipakai atau kebijakan akses database menolak permintaan.');
    } finally {
      busy = false;
      $('submit').disabled = false;
      $('cancel').disabled = false;
      $('submit').textContent = 'Kirim Pendaftaran';
    }
  }

  function exportCsv() {
    if (!teams.length) {
      window.alert('Data belum dimuat.');
      return;
    }
    const columns = ['slot', 'team_name', 'whatsapp', 'representative', 'player1_id', 'player2_id', 'player3_id', 'player4_id'];
    const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [columns.join(','), ...teams.map((team) => columns.map((column) => csvCell(team[column])).join(','))];
    const blob = new Blob(['\uFEFF', rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'data-turnamen-free-fire-64-team.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function init() {
    if (!config || !config.supabaseUrl || !config.supabasePublishableKey) {
      setStatus('Konfigurasi Supabase belum lengkap. Periksa assets/js/config.js.', true);
      return;
    }
    if (!window.supabase?.createClient) {
      setStatus('Library Supabase gagal dimuat. Periksa koneksi internet atau CDN.', true);
      return;
    }
    db = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    $('grid').addEventListener('click', (event) => {
      const button = event.target.closest('[data-slot]');
      if (button) openModal(Number(button.dataset.slot));
    });
    $('refresh').addEventListener('click', () => void load());
    $('print').addEventListener('click', () => window.print());
    $('csv').addEventListener('click', exportCsv);
    $('cancel').addEventListener('click', closeModal);
    $('backdrop').addEventListener('click', (event) => {
      if (event.target === $('backdrop')) closeModal();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !$('backdrop').hidden) closeModal();
    });
    $('form').addEventListener('submit', submitRegistration);
    void load();
  }

  document.addEventListener('DOMContentLoaded', init, { once: true });
})();
