/* CHAÎNE 2026 — Supabase anonymous vote submission
 * Only communicates with public.chaine_votes under the database's RLS policies.
 * Existing menu and on-device journal remain untouched.
 */
(() => {
  'use strict';
  const URL = 'https://fxwvgbkohymkqppknoxb.supabase.co';
  const KEY = 'sb_publishable_CLCU0bQKGrqLyy4LiReHEw_gBLrK9jU';
  const STORAGE = 'chaine_2026_submission_receipt_v1';
  const button = document.getElementById('chaine-submit-votes');
  const status = document.getElementById('chaine-submit-status');
  if (!button || !status) return;

  let pending = false;
  let client;
  function tell(message, state = '') {
    status.textContent = message;
    status.dataset.state = state;
  }
  function journal() {
    if (typeof journalData === 'undefined' || !journalData || !journalData.food || !journalData.wine) {
      throw new Error('Tadım defteri verileri bulunamadı.');
    }
    return journalData;
  }
  const integer = (n, max) => {
    const v = Number(n || 0);
    if (!Number.isInteger(v) || v < 0 || v > max) throw new Error('Geçersiz puan değeri.');
    return v;
  };
  const note = (n) => {
    const value = String(n == null ? '' : n);
    if (value.length > 2000) throw new Error('Bir tadım notu 2000 karakterden uzun olamaz.');
    return value;
  };
  function buildRows(userId) {
    const state = journal();
    const rows = [];
    // All 15 slots are submitted. A cleared score is represented by null/0,
    // ensuring an older submitted score cannot linger on the server.
    for (let id = 1; id <= 10; id++) {
      const e = state.food[id] || {};
      const rating = integer(e.rating, 5);
      rows.push({user_id:userId, kind:'food', item_id:id,
        food_rating:rating === 0 ? null : rating,
        appearance:0, nose:0, palate:0, finish:0, overall:0, note:note(e.note)});
    }
    for (let id = 1; id <= 5; id++) {
      const e = state.wine[id] || {};
      rows.push({user_id:userId, kind:'wine', item_id:id, food_rating:null,
        appearance:integer(e['görünüm'],15), nose:integer(e['burun'],25),
        palate:integer(e['damak'],25), finish:integer(e['bitiş'],15),
        overall:integer(e['genel'],20), note:note(e.note)});
    }
    return rows;
  }
  function fingerprint() {
    // This fingerprint reflects the entire current set of votes/notes.
    return JSON.stringify(buildRows('local').map(({user_id, ...r})=>r));
  }
  function activeCount(rows) {
    return rows.filter(r => r.note.trim() || (r.kind === 'food' ? r.food_rating !== null :
      (r.appearance + r.nose + r.palate + r.finish + r.overall) > 0)).length;
  }
  function receipt() {
    try {return JSON.parse(localStorage.getItem(STORAGE) || 'null');} catch {return null;}
  }
  function markChanged() {
    if (pending) return;
    try {
      const count = activeCount(buildRows('local'));
      button.disabled = count === 0;
      const previous = receipt();
      if (count === 0) {
        tell('Henüz gönderilecek bir değerlendirme yok.');
      } else if (previous && previous.fingerprint === fingerprint()) {
        tell('Bu değerlendirmeler daha önce gönderildi. Değiştirirsen tekrar gönderebilirsin.', 'success');
      } else {
        tell(`${count} değerlendirme/not bu cihazda kayıtlı. Henüz organizatöre gönderilmedi.`, 'pending');
      }
    } catch(e) {
      button.disabled = false;
      tell(e.message || 'Değerlendirmeler kontrol edilemiyor.', 'error');
    }
  }
  async function getClient() {
    if (!window.supabase?.createClient) throw new Error('Supabase kütüphanesi yüklenemedi. İnternet bağlantını kontrol et.');
    if (!client) client = window.supabase.createClient(URL, KEY, {
      auth: {persistSession:true, autoRefreshToken:true, detectSessionInUrl:false}
    });
    return client;
  }
  async function submit() {
    if (pending) return;
    pending = true; button.disabled = true;
    tell('Değerlendirmeler sunucuya gönderiliyor…');
    try {
      const api = await getClient();
      let {data:{session},error:sessionError} = await api.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) {
        const {data,error} = await api.auth.signInAnonymously();
        if (error) throw error;
        session = data.session;
      }
      if (!session?.user?.id) throw new Error('Anonim oturum oluşturulamadı.');
      const rows = buildRows(session.user.id);
      const count = activeCount(rows);
      if (!count) throw new Error('Göndermek için en az bir puan veya not ekle.');
      const snapshot = fingerprint();
      const {error} = await api.from('chaine_votes').upsert(rows, {
        onConflict:'user_id,kind,item_id'
      });
      if (error) throw error;
      try {localStorage.setItem(STORAGE, JSON.stringify({fingerprint:snapshot,user_id:session.user.id, sent_at:new Date().toISOString()}));} catch {}
      if (snapshot !== fingerprint()) {
        tell('Gönderildi; gönderim sırasında yeni değişiklikler yaptın. Bunları da göndermek için tekrar tıkla.', 'pending');
      } else {
        tell(`${count} değerlendirme/not başarıyla gönderildi. Sonradan değiştirip yeniden gönderebilirsin.`, 'success');
      }
    } catch(e) {
      const detail = e?.message || String(e);
      tell('Gönderim tamamlanamadı. Notların cihazında duruyor. Tekrar dene. (' + detail + ')', 'error');
    } finally {
      pending = false;
      button.disabled = false;
      // Do not hide server acknowledgment immediately. Update on next user edit.
    }
  }
  button.addEventListener('click', submit);
  // Existing menu uses localStorage/persist(), and may rebuild form elements.
  // Event delegation tracks changes from both the journal and individual course drawers.
  document.addEventListener('input', e => {
    if (e.target.matches('[data-sync], [data-note-field], [data-slider]'))
      queueMicrotask(markChanged);
  });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-star], .journal-card .score-buttons button'))
      queueMicrotask(markChanged);
  });
  window.addEventListener('storage', (e) => { if (e.key === 'chaine_2026_notes_v5') markChanged(); });
  window.addEventListener('online', () => {
    if (!pending) tell('İnternet bağlantısı geri geldi. Değerlendirmelerini gönderebilirsin.');
  });
  markChanged();
})();
