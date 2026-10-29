/* CHAÎNE 2026 — Supabase anonymous voting | Rev 01
 * Only submitted scores and nonblank notes are persisted.
 * Removed/cleared votes are deleted for this user, subject to RLS.
 * All three send buttons share the same submit() function.
 */
(() => {
  'use strict';
  const URL = 'https://fxwvgbkohymkqppknoxb.supabase.co';
  const KEY = 'sb_publishable_CLCU0bQKGrqLyy4LiReHEw_gBLrK9jU';
  const STORAGE = 'chaine_2026_submission_receipt_v2';
  const buttons = [...document.querySelectorAll('[data-chaine-submit]')];
  const status = document.getElementById('chaine-submit-status');
  const eveningStatus = document.getElementById('chaine-evening-submit-status');
  const toast = document.getElementById('chaine-submit-toast');
  if (!buttons.length || !status) return;

  let pending = false, client, toastTimer;
  function tell(message, state = '', popup = false) {
    status.textContent = message;
    status.dataset.state = state;
    if (eveningStatus) eveningStatus.textContent = message;
    if (toast && popup) {
      toast.textContent = message;
      toast.dataset.state = state;
      toast.hidden = false;
      clearTimeout(toastTimer);
      if (state !== 'pending') toastTimer = setTimeout(() => {toast.hidden = true;}, 6500);
    }
  }
  function journal() {
    if (typeof journalData === 'undefined' || !journalData?.food || !journalData?.wine) {
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
  const isActive = r => Boolean(r.note.trim() || (r.kind === 'food'
    ? r.food_rating !== null
    : r.appearance + r.nose + r.palate + r.finish + r.overall > 0));

  function buildRows(userId) {
    const state = journal();
    const rows = [];
    for (let id = 1; id <= 10; id++) {
      const e = state.food[id] || {};
      const rating = integer(e.rating, 5);
      const r = {user_id:userId,kind:'food',item_id:id,
        food_rating:rating === 0 ? null : rating,
        appearance:0,nose:0,palate:0,finish:0,overall:0,note:note(e.note)};
      if (isActive(r)) rows.push(r);
    }
    for (let id = 1; id <= 5; id++) {
      const e = state.wine[id] || {};
      const r = {user_id:userId,kind:'wine',item_id:id,food_rating:null,
        appearance:integer(e['görünüm'],15),nose:integer(e['burun'],25),
        palate:integer(e['damak'],25),finish:integer(e['bitiş'],15),
        overall:integer(e['genel'],20),note:note(e.note)};
      if (isActive(r)) rows.push(r);
    }
    return rows;
  }
  const fingerprint = () => JSON.stringify(buildRows('local').map(({user_id,...rest})=>rest));
  function receipt() {
    try {
      const current = JSON.parse(localStorage.getItem(STORAGE)||'null');
      if (current) return current;
      // Compatibility with the previously published test build. Its receipt
      // contains all fifteen items, including inactive ones.
      const legacy = JSON.parse(localStorage.getItem('chaine_2026_submission_receipt_v1')||'null');
      if (!legacy?.fingerprint) return null;
      const sentRows = JSON.parse(legacy.fingerprint);
      return {fingerprint:JSON.stringify(sentRows.filter(isActive)),
        hadRows:sentRows.some(isActive),user_id:legacy.user_id};
    } catch {return null;}
  }
  function markChanged() {
    if (pending) return;
    try {
      const rows = buildRows('local');
      const previous = receipt();
      const dirty = !previous || previous.fingerprint !== fingerprint();
      // If the user cleared every rating, permit submission to erase previously sent rows.
      const canClear = rows.length === 0 && previous?.hadRows === true && dirty;
      for (const b of buttons) b.disabled = rows.length === 0 && !canClear;
      if (!rows.length && !canClear) {
        tell('Henüz paylaşılacak bir değerlendirmeniz bulunmuyor.');
      } else if (!dirty) {
        tell('Görüşleriniz bizimle paylaşıldı. Dilerseniz güncelleyebilirsiniz.','success');
      } else if (canClear) {
        tell('Önceki değerlendirmenizi kaldırmak için değişiklikleri paylaşın.','pending');
      } else {
        tell(`${rows.length} değerlendirme paylaşılmaya hazır.`,'pending');
      }
    } catch(e) {
      for(const b of buttons) b.disabled = false;
      tell(e.message || 'Değerlendirmeler kontrol edilemiyor.','error');
    }
  }
  function getClient() {
    if (!window.supabase?.createClient) throw new Error('Supabase kütüphanesi yüklenemedi. İnternet bağlantınızı kontrol edin.');
    if (!client) client = window.supabase.createClient(URL,KEY,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
    });
    return client;
  }
  async function ensureGuest(api) {
    const result = await api.auth.getSession();
    if (result.error) throw result.error;
    let session = result.data.session;
    // Prevent an old administrator session (stored under the legacy default key)
    // from ever being used as a visitor vote identity.
    if (session && session.user?.is_anonymous === false) {
      const signedOut = await api.auth.signOut();
      if (signedOut.error) throw signedOut.error;
      session = null;
    }
    if (!session) {
      const result = await api.auth.signInAnonymously();
      if (result.error) throw result.error;
      session = result.data.session;
    }
    if (!session?.user?.id) throw new Error('Anonim oturum oluşturulamadı.');
    return session.user.id;
  }
  async function submit() {
    if (pending) return;
    pending = true;
    for (const b of buttons) b.disabled = true;
    tell('Değerlendirmeleriniz paylaşılıyor…','pending',true);
    try {
      const api = getClient();
      const userId = await ensureGuest(api);
      const rows = buildRows(userId);
      const snapshot = fingerprint();
      const prev = receipt();
      if (!rows.length && !prev?.hadRows) throw new Error('Göndermek için en az bir değerlendirme veya not ekleyin.');
      // Current server state is needed to remove scores cleared since an earlier submission.
      const found = await api.from('chaine_votes').select('kind,item_id').eq('user_id',userId);
      if (found.error) throw found.error;
      const activeKeys = new Set(rows.map(r => `${r.kind}:${r.item_id}`));
      const stale = (found.data || []).filter(r => !activeKeys.has(`${r.kind}:${r.item_id}`));
      // First save active evaluations; never delete old values before new values succeed.
      if (rows.length) {
        const written = await api.from('chaine_votes').upsert(rows,{onConflict:'user_id,kind,item_id'});
        if (written.error) throw written.error;
      }
      for (const kind of ['food','wine']) {
        const ids = stale.filter(r => r.kind === kind).map(r=>r.item_id);
        if (!ids.length) continue;
        const deleted = await api.from('chaine_votes').delete()
          .eq('user_id',userId).eq('kind',kind).in('item_id',ids);
        if (deleted.error) throw deleted.error;
      }
      try {
        localStorage.setItem(STORAGE,JSON.stringify({fingerprint:snapshot,hadRows:rows.length>0,user_id:userId,sent_at:new Date().toISOString()}));
      } catch {}
      if (snapshot !== fingerprint()) {
        tell('Paylaşım tamamlandı. Yeni değişikliklerinizi de paylaşabilirsiniz.','pending',true);
      } else if (!rows.length) {
        tell('Daha önce paylaştığınız değerlendirmeler kaldırıldı.','success',true);
      } else {
        tell(`Teşekkür ederiz. ${rows.length} değerlendirmeniz bizimle paylaşıldı.`,'success',true);
      }
    } catch(e) {
      const message = e?.message || String(e);
      tell('Paylaşım tamamlanamadı. Notlarınız korunuyor; lütfen yeniden deneyin. ('+message+')','error',true);
    } finally {
      pending = false;
      // Preserve the acknowledgement but avoid a pointless empty submission.
      let maySend = true;
      try {maySend = buildRows('local').length > 0 || Boolean(receipt()?.hadRows);} catch {}
      for (const b of buttons) b.disabled = !maySend;
    }
  }
  for (const b of buttons) b.addEventListener('click',submit);
  document.addEventListener('input',e=>{
    if(e.target.matches('[data-sync],[data-note-field],[data-slider]')) queueMicrotask(markChanged);
  });
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-star],.journal-card .score-buttons button')) queueMicrotask(markChanged);
  });
  window.addEventListener('storage',e=>{
    if(e.key==='chaine_2026_notes_v5') markChanged();
  });
  window.addEventListener('online',()=>{
    if(!pending) tell('Bağlantı yeniden kuruldu. Değerlendirmelerinizi paylaşabilirsiniz.','pending');
  });
  markChanged();
})();
