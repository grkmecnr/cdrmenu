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
  const DRAFT_KEY = 'chaine_2026_notes_v5';
  const MAX_TOTAL_NOTE_CHARS = 50000; // Total across all 10 food and 5 wine notes.
  const buttons = [...document.querySelectorAll('[data-chaine-submit]')];
  const status = document.getElementById('chaine-submit-status');
  const eveningStatus = document.getElementById('chaine-evening-submit-status');
  const toast = document.getElementById('chaine-submit-toast');
  if (!buttons.length || !status) return;

  let pending = false, client, toastTimer;
  // A stale tab must never overwrite another tab's local draft or submit its old snapshot.
  const readDraft = () => {try{return localStorage.getItem(DRAFT_KEY);}catch{return null;}};
  let lastOwnDraft = readDraft(), staleTab = false;
  const staleMessage = 'Bu menü başka bir sekmede değiştirildi. Önce bu sekmeyi yenileyin; eski sekmeden gönderim yapmayın.';
  const notesIndicator = document.createElement('p');
  notesIndicator.id = 'chaine-note-capacity';
  notesIndicator.setAttribute('role','status');
  notesIndicator.style.cssText = 'font-size:12px;line-height:1.5;margin:8px 0;color:inherit;';
  status.insertAdjacentElement('afterend',notesIndicator);
  const charCount = value => Array.from(String(value ?? '')).length;
  function totalNoteChars() {
    const state = journal();
    return ['food','wine'].reduce((sum,kind) => sum +
      Object.values(state[kind]).reduce((n,entry) => n + charCount(entry?.note),0),0);
  }
  function refreshNoteIndicator() {
    try {
      const used = totalNoteChars();
      notesIndicator.textContent = `Tadım notları: ${used.toLocaleString('tr-TR')} / ${MAX_TOTAL_NOTE_CHARS.toLocaleString('tr-TR')} karakter (toplam).`;
      notesIndicator.style.color = used > MAX_TOTAL_NOTE_CHARS ? '#b91c1c' : 'inherit';
      return used;
    } catch { notesIndicator.textContent = ''; return 0; }
  }
  function ensureFreshTab() {
    if (staleTab || readDraft() !== lastOwnDraft) {
      staleTab = true;
      throw new Error(staleMessage);
    }
  }
  function blockStaleTab() {
    staleTab = true;
    for (const b of buttons) b.disabled = true;
    tell(staleMessage,'error',true);
  }
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
    if (charCount(value) > MAX_TOTAL_NOTE_CHARS) throw new Error('Tek bir not 50.000 karakteri aşamaz.');
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
    if (totalNoteChars() > MAX_TOTAL_NOTE_CHARS) {
      throw new Error('Toplam tadım notu sınırı 50.000 karakter. Notlarınızı kısaltın; puanlarınız korunur.');
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
    refreshNoteIndicator();
    try {
      ensureFreshTab();
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
      for(const b of buttons) b.disabled = true;
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
      ensureFreshTab();
      // Validate the entire guest draft before any authentication or database write.
      const prepared = buildRows('local');
      const api = getClient();
      const userId = await ensureGuest(api);
      ensureFreshTab();
      const rows = prepared.map(r => ({...r,user_id:userId}));
      const snapshot = JSON.stringify(prepared.map(({user_id,...rest}) => rest));
      const prev = receipt();
      if (!rows.length && !prev?.hadRows) throw new Error('Göndermek için en az bir değerlendirme veya not ekleyin.');
      // Current server state is needed to remove scores cleared since an earlier submission.
      ensureFreshTab();
      const found = await api.from('chaine_votes').select('kind,item_id').eq('user_id',userId);
      if (found.error) throw found.error;
      const activeKeys = new Set(rows.map(r => `${r.kind}:${r.item_id}`));
      const stale = (found.data || []).filter(r => !activeKeys.has(`${r.kind}:${r.item_id}`));
      // A second tab may have edited the draft while the server query was in flight.
      ensureFreshTab();
      // First save active evaluations; never delete old values before new values succeed.
      if (rows.length) {
        const written = await api.from('chaine_votes').upsert(rows,{onConflict:'user_id,kind,item_id'});
        if (written.error) throw written.error;
      }
      for (const kind of ['food','wine']) {
        ensureFreshTab();
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
      if (staleTab || totalNoteChars() > MAX_TOTAL_NOTE_CHARS) markChanged();
    }
  }
  for (const b of buttons) b.addEventListener('click',submit);
  const isJournalInput = target => Boolean(target?.matches?.('[data-sync],[data-note-field],[data-slider],[data-star],.score-buttons button') ||
    target?.closest?.('[data-star],.journal-card .score-buttons button'));
  // Capture-phase protection runs before the old HTML's input/star handlers can persist a stale copy.
  for (const kind of ['input','click']) {
    document.addEventListener(kind,e=>{
      if (!isJournalInput(e.target)) return;
      if (staleTab || readDraft() !== lastOwnDraft) {
        if (e.cancelable) e.preventDefault();
        e.stopImmediatePropagation();
        blockStaleTab();
      }
    },true);
  }
  // The original HTML writes its local draft on the target itself; update our revision only afterwards.
  document.addEventListener('input',e=>{
    if (!isJournalInput(e.target)) return;
    lastOwnDraft = readDraft();
    queueMicrotask(markChanged);
  });
  document.addEventListener('click',e=>{
    if (!isJournalInput(e.target)) return;
    lastOwnDraft = readDraft();
    queueMicrotask(markChanged);
  });
  window.addEventListener('storage',e=>{
    if (e.key === DRAFT_KEY && e.newValue !== lastOwnDraft) blockStaleTab();
  });
  window.addEventListener('online',()=>{
    if (!pending) markChanged();
  });
  markChanged();
})();
