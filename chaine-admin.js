/* Chaîne 2026 — authenticated admin dashboard, RLS enforced by Supabase. */
(() => {
  'use strict';
  const URL='https://fxwvgbkohymkqppknoxb.supabase.co';
  const KEY='sb_publishable_CLCU0bQKGrqLyy4LiReHEw_gBLrK9jU';
  const FOOD=['Vitello Tonnato','Barbun Marine','Foie Gras','Muşmula Dolması','Istakozlu Ravyoli','Kuzu Tandoori','Limon Sorbe','Dana Minyonet','Bal Kabaklı Crème Brûlée','Petits Fours'];
  const WINE=['Arthur Metz Riesling Alsace Grand Cru Wineck-Schlossberg 2020','O Gran Mein Ribeiro 2019','Marqués de Riscal XR Reserva Rioja 2017','Château Musar 2018 Bekaa Vadisi','Ktima Gerovassiliou Malagousia 2025 Epanomi'];
  const $=id=>document.getElementById(id);
  const msg=(s,cls='muted')=>{ $('message').textContent=s;$('message').className=cls;};
  let api, rows=[], subscription=null, refreshTimer=null, authorized=false, busy=false;
  const num=(v)=>Number.isFinite(Number(v))?Number(v):0;
  const avg=(list,fn)=>list.length?(list.reduce((n,r)=>n+fn(r),0)/list.length).toFixed(1):'—';
  const active=(r)=>r.kind==='food'?r.food_rating!==null:(num(r.appearance)+num(r.nose)+num(r.palate)+num(r.finish)+num(r.overall))>0;
  const total=(r)=>num(r.appearance)+num(r.nose)+num(r.palate)+num(r.finish)+num(r.overall);
  const label=(r)=>r.kind==='food'? (FOOD[r.item_id-1]||'Bilinmeyen yemek'):(WINE[r.item_id-1]||'Bilinmeyen şarap');
  const date=(value)=>value?new Date(value).toLocaleString('tr-TR'):'—';
  const append=(target,values)=>{const tr=document.createElement('tr');values.forEach(v=>{const td=document.createElement('td');td.textContent=String(v);tr.appendChild(td);});target.appendChild(tr);};
  function paint() {
    const rated=rows.filter(active), withNotes=rows.filter(r=>String(r.note||'').trim());
    const users=new Set(rows.filter(r=>active(r)||String(r.note||'').trim()).map(r=>r.user_id));
    const f=rated.filter(r=>r.kind==='food');const w=rated.filter(r=>r.kind==='wine');
    const items=[['Katılımcı',users.size],['Yemek oyu',f.length],['Şarap oyu',w.length],['Yazılı not',withNotes.length]];
    $('metrics').replaceChildren();items.forEach(([title,value])=>{const el=document.createElement('div');el.className='metric';const a=document.createElement('strong');a.textContent=String(value);const b=document.createElement('span');b.textContent=title;el.append(a,b);$('metrics').appendChild(el);});
    $('foods').replaceChildren();FOOD.forEach((name,i)=>{const list=f.filter(r=>r.item_id===i+1);append($('foods'),[name,list.length,avg(list,r=>num(r.food_rating))]);});
    $('wines').replaceChildren();WINE.forEach((name,i)=>{const list=w.filter(r=>r.item_id===i+1);append($('wines'),[name,list.length,avg(list,total),...['appearance','nose','palate','finish','overall'].map(k=>avg(list,r=>num(r[k])))]);});
    $('notes').replaceChildren();withNotes.sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at)).forEach(r=>append($('notes'),[date(r.updated_at),r.kind==='food'?'Yemek':'Şarap',label(r),r.note]));
    $('all').replaceChildren();rated.slice().sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at)).forEach(r=>append($('all'),[r.user_id.slice(0,8)+'…',r.kind==='food'?'Yemek':'Şarap',label(r),r.kind==='food'?r.food_rating+'/5':total(r)+'/100',date(r.updated_at)]));
    $('lastUpdated').textContent='Son yenileme: '+date(new Date());
  }
  async function load() {
    if(!authorized||busy)return;
    busy=true;$('refresh').disabled=true;
    try {
      // Page through 1000-row windows; never silently truncate an event's votes.
      let result=[],offset=0;
      while(true){
        const {data,error}=await api.from('chaine_votes').select('user_id,kind,item_id,food_rating,appearance,nose,palate,finish,overall,note,created_at,updated_at').order('updated_at',{ascending:false}).range(offset,offset+999);
        if(error)throw error;
        result.push(...data);
        if(data.length<1000)break;
        offset+=1000;
      }
      rows=result;paint();msg('Sonuçlar güncellendi.','success');
    }catch(e){msg('Sonuçlar alınamadı: '+(e.message||e),'error');}
    finally{busy=false;$('refresh').disabled=false;}
  }
  function clearSubscription(){if(subscription){api.removeChannel(subscription);subscription=null;}if(refreshTimer){clearInterval(refreshTimer);refreshTimer=null;}}
  function subscribe(){
    clearSubscription();
    subscription=api.channel('chaine-admin-votes').on('postgres_changes',{event:'*',schema:'public',table:'chaine_votes'},()=>load()).subscribe();
    // Realtime may be unavailable due to plan/network; polling guarantees refresh.
    refreshTimer=setInterval(()=>{if(!document.hidden)load();},20000);
  }
  async function showIfAdmin(){
    const {data:{user},error}=await api.auth.getUser();
    if(error||!user){showLogin();return;}
    const {data,error:check}=await api.from('chaine_admins').select('user_id').eq('user_id',user.id).maybeSingle();
    if(check||!data){await api.auth.signOut();showLogin();msg('Bu hesap yönetici olarak yetkilendirilmemiş.','error');return;}
    authorized=true;$('login').classList.add('hidden');$('dashboard').classList.remove('hidden');$('logout').classList.remove('hidden');await load();subscribe();
  }
  function showLogin(){authorized=false;clearSubscription();rows=[];$('dashboard').classList.add('hidden');$('login').classList.remove('hidden');$('logout').classList.add('hidden');}
  // URL is also used as a constant for the Supabase endpoint above; save URL constructor separately.
  const BrowserURL=window.URL;
  function exportCSV(){
    const headers=['user_id','kind','item_id','urun_adi','food_rating','appearance','nose','palate','finish','overall','wine_total','note','created_at','updated_at'];
    const cell=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
    const values=[headers,...rows.map(r=>[r.user_id,r.kind,r.item_id,label(r),r.food_rating,r.appearance,r.nose,r.palate,r.finish,r.overall,r.kind==='wine'?total(r):'',r.note,r.created_at,r.updated_at])];
    const blob=new Blob(['\ufeff'+values.map(r=>r.map(cell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8;'});
    const tmp=BrowserURL.createObjectURL(blob),a=document.createElement('a');a.href=tmp;a.download='chaine_oylar_'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>BrowserURL.revokeObjectURL(tmp),1000);
  }
  $('loginForm').addEventListener('submit',async e=>{
    e.preventDefault();$('loginBtn').disabled=true;msg('Giriş kontrol ediliyor…');
    const {error}=await api.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
    $('loginBtn').disabled=false;
    if(error){msg('Giriş başarısız: '+error.message,'error');return;}
    $('password').value='';await showIfAdmin();
  });
  $('refresh').addEventListener('click',load);$('csv').addEventListener('click',exportCSV);
  $('logout').addEventListener('click',async()=>{clearSubscription();await api.auth.signOut();showLogin();msg('Çıkış yapıldı.');});
  if(!window.supabase?.createClient){msg('Supabase kütüphanesi yüklenemedi. Bağlantını kontrol et.','error');$('loginBtn').disabled=true;return;}
  api=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  showIfAdmin().catch(e=>msg('Başlatılamadı: '+(e.message||e),'error'));
})();
