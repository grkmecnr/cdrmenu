/* Chaîne des Rôtisseurs 2026 · Premium reporting dashboard. Supabase RLS + admin-only RPC. */
(()=>{
  'use strict';
  const ENDPOINT='https://fxwvgbkohymkqppknoxb.supabase.co';
  const PUBLISHABLE='sb_publishable_CLCU0bQKGrqLyy4LiReHEw_gBLrK9jU';
  const FOOD=['Vitello Tonnato','Barbun Marine','Foie Gras','Muşmula Dolması','Istakozlu Ravyoli','Kuzu Tandoori','Limon Sorbe','Dana Minyonet','Bal Kabaklı Crème Brûlée','Petits Fours'];
  const WINE=['Arthur Metz Riesling Alsace Grand Cru Wineck-Schlossberg 2020','O Gran Mein Ribeiro 2019','Marqués de Riscal XR Reserva Rioja 2017','Château Musar 2018 Bekaa Vadisi','Ktima Gerovassiliou Malagousia 2025 Epanomi'];
  const byId=id=>document.getElementById(id);
  const all=(selector)=>[...document.querySelectorAll(selector)];
  const setText=(id,s)=>byId(id).textContent=s;
  const finite=v=>Number.isFinite(Number(v))?Number(v):0;
  const total=r=>['appearance','nose','palate','finish','overall'].reduce((n,k)=>n+finite(r[k]),0);
  const label=r=>r.kind==='food'?(FOOD[r.item_id-1]||'Yemek '+r.item_id):(WINE[r.item_id-1]||'Şarap '+r.item_id);
  const rated=r=>r.kind==='food'?r.food_rating!==null&&r.food_rating!==undefined:total(r)>0;
  const hasNote=r=>Boolean(String(r.note||'').trim());
  const average=(rows,fn)=>rows.length?rows.reduce((a,r)=>a+fn(r),0)/rows.length:null;
  const pretty=v=>v===null?'—':v.toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1});
  const date=s=>s?new Date(s).toLocaleString('tr-TR'):'—';
  const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const kind=r=>r.kind==='food'?'Yemek':'Şarap';
  const msg=(s,cls='')=>{setText('message',s);byId('message').className='status '+cls;};
  const makeCell=(tr,value,cls='')=>{const td=document.createElement('td');td.textContent=String(value??'—');if(cls)td.className=cls;tr.append(td);};
  const addRow=(parent,values)=>{const tr=document.createElement('tr');values.forEach((v,i)=>makeCell(tr,v,i===0?'word':''));parent.append(tr);};
  let api,raw=[],authorized=false,busy=false,subscription=null,poll=null,resetBusy=false;
  let filtered=[];
  function scoped(){
    const period=byId('period').value,t=byId('typeFilter').value,search=byId('search').value.trim().toLocaleLowerCase('tr-TR'),now=Date.now();
    const boundary=period==='today'?new Date().setHours(0,0,0,0):period==='all'?0:now-Number(period)*864e5;
    return raw.filter(r=>(t==='all'||r.kind===t)&&new Date(r.updated_at).getTime()>=boundary&&(!search||(label(r)+' '+(r.note||'')).toLocaleLowerCase('tr-TR').includes(search)));
  }
  const scoreName=r=>r.kind==='food'?(r.food_rating==null?'Yalnızca not':r.food_rating+'/5'):(total(r)?total(r)+'/100':'Yalnızca not');
  function itemRows(kindName,scope=filtered){
    const names=kindName==='food'?FOOD:WINE;
    return names.map((name,i)=>{
      const votes=scope.filter(r=>r.kind===kindName&&r.item_id===i+1&&rated(r));
      return {name,id:i+1,votes,count:votes.length,avg:average(votes,kindName==='food'?r=>finite(r.food_rating):total)};
    });
  }
  function metrics(){
    const evaluated=filtered.filter(r=>rated(r)||hasNote(r));
    const users=new Set(evaluated.map(r=>r.user_id));
    const foods=filtered.filter(r=>r.kind==='food'&&rated(r));
    const wines=filtered.filter(r=>r.kind==='wine'&&rated(r));
    const notes=filtered.filter(hasNote);
    const items=[['Katılımcı',users.size,'Tekil anonim kullanıcı'],['Yemek puanı',foods.length,`10 yemekten ${new Set(foods.map(r=>r.item_id)).size} ürün değerlendirildi`],['Şarap puanı',wines.length,`5 şaraptan ${new Set(wines.map(r=>r.item_id)).size} ürün değerlendirildi`],['Tadım notu',notes.length,'Yazılı değerlendirme']];
    const container=byId('metrics');container.replaceChildren();
    for(const [title,n,desc] of items){const div=document.createElement('div');div.className='metric';const a=document.createElement('span');a.className='lbl';a.textContent=title;const b=document.createElement('strong');b.textContent=n.toLocaleString('tr-TR');const c=document.createElement('span');c.className='desc';c.textContent=desc;div.append(a,b,c);container.append(div);}
    return {users:users.size,foods:foods.length,wines:wines.length,notes:notes.length,rows:evaluated.length};
  }
  function charts(){
    for(const [name,id,scoreMax] of [['food','foodChart',5],['wine','wineChart',100]]){
      const holder=byId(id);holder.replaceChildren();const rows=itemRows(name).filter(r=>r.count);
      if(!rows.length){const n=document.createElement('p');n.className='empty';n.textContent='Henüz puanlanmış ürün bulunmuyor.';holder.append(n);continue;}
      rows.sort((a,b)=>b.avg-a.avg||b.count-a.count);
      for(const item of rows){const box=document.createElement('div');box.className='bar-row';
        const title=document.createElement('div');title.className='bar-title';const labelEl=document.createElement('span');labelEl.textContent=item.name;const score=document.createElement('strong');score.textContent=pretty(item.avg)+' / '+scoreMax;title.append(labelEl,score);
        const bar=document.createElement('div');bar.className='track';bar.setAttribute('role','img');bar.setAttribute('aria-label',`${item.name}, ortalama ${pretty(item.avg)} / ${scoreMax}`);
        const fill=document.createElement('div');fill.className='fill';fill.style.width=Math.min(100,100*item.avg/scoreMax).toFixed(2)+'%';bar.append(fill);
        const meta=document.createElement('div');meta.className='bar-meta';meta.textContent=item.count+' değerlendirme';box.append(title,bar,meta);holder.append(box);
      }
    }
  }
  function tables(){
    byId('foods').replaceChildren();itemRows('food').forEach(x=>addRow(byId('foods'),[x.name,x.count,pretty(x.avg),...[1,2,3,4,5].map(n=>x.votes.filter(v=>Number(v.food_rating)===n).length)]));
    byId('wines').replaceChildren();itemRows('wine').forEach(x=>addRow(byId('wines'),[x.name,x.count,pretty(x.avg),...['appearance','nose','palate','finish','overall'].map(k=>pretty(average(x.votes,r=>finite(r[k]))))]));
    byId('notes').replaceChildren();const notes=filtered.filter(hasNote).sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at));
    if(!notes.length){const p=document.createElement('p');p.className='empty';p.textContent='Seçilen filtrelerde yazılı not bulunmuyor.';byId('notes').append(p);}
    for(const r of notes){const card=document.createElement('article');card.className='note-card';const meta=document.createElement('div');meta.className='subtle';meta.textContent=kind(r)+' · '+label(r)+' · '+date(r.updated_at);const note=document.createElement('p');note.textContent=r.note;card.append(meta,note);byId('notes').append(card);}
    byId('all').replaceChildren();filtered.slice().sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at)).forEach(r=>addRow(byId('all'),[r.user_id.slice(0,8)+'…',kind(r),label(r),scoreName(r),String(r.note||'').slice(0,350),date(r.updated_at)]));
  }
  function extra(){
    const bestFood=itemRows('food').filter(r=>r.count).sort((a,b)=>b.avg-a.avg),bestWine=itemRows('wine').filter(r=>r.count).sort((a,b)=>b.avg-a.avg);
    const container=byId('highlights');container.replaceChildren();
    const lines=[['En yüksek yemek ortalaması',bestFood.length?bestFood[0].name+' · '+pretty(bestFood[0].avg)+'/5':'—'],['En yüksek şarap ortalaması',bestWine.length?bestWine[0].name+' · '+pretty(bestWine[0].avg)+'/100':'—'],['Puanlanmış yemek sayısı',bestFood.length+'/10'],['Puanlanmış şarap sayısı',bestWine.length+'/5']];
    for(const [a,b] of lines){const el=document.createElement('div');el.className='listline';const x=document.createElement('span');x.textContent=a;const y=document.createElement('strong');y.textContent=b;el.append(x,y);container.append(el);}
    const dates=filtered.filter(r=>rated(r)||hasNote(r)).map(r=>r.updated_at).sort();const activity=byId('activity');activity.replaceChildren();
    for(const [a,b] of [['İlk değerlendirme',dates.length?date(dates[0]):'—'],['Son güncelleme',dates.length?date(dates[dates.length-1]):'—'],['Toplam kayıt',filtered.length.toLocaleString('tr-TR')]]){const el=document.createElement('div');el.className='listline';const x=document.createElement('span');x.textContent=a;const y=document.createElement('strong');y.textContent=b;el.append(x,y);activity.append(el);}
    setText('resetCount','Mevcut veritabanı satırı: '+raw.length.toLocaleString('tr-TR'));
  }
  function paint(){filtered=scoped();metrics();charts();tables();extra();setText('lastUpdated','Son kontrol: '+date(new Date())+' · Güncel seçime göre sonuçlar');}
  async function load(){
    if(!authorized||busy)return;
    busy=true;byId('refresh').disabled=true;
    try{let allRows=[],offset=0;
      while(true){const {data,error}=await api.from('chaine_votes').select('user_id,kind,item_id,food_rating,appearance,nose,palate,finish,overall,note,created_at,updated_at').order('updated_at',{ascending:false}).range(offset,offset+999);
        if(error)throw error;allRows.push(...data);if(data.length<1000)break;offset+=1000;
      }
      raw=allRows;paint();msg('Sonuçlar güncellendi.','success');
    }catch(err){msg('Veri alınamadı: '+(err.message||err),'error');}
    finally{busy=false;byId('refresh').disabled=false;}
  }
  function stop(){if(subscription){api.removeChannel(subscription);subscription=null;}if(poll){clearInterval(poll);poll=null;}}
  function start(){stop();subscription=api.channel('chaine-reporting-admin').on('postgres_changes',{event:'*',schema:'public',table:'chaine_votes'},()=>load()).subscribe();poll=setInterval(()=>{if(!document.hidden)load();},20000);}
  function showLogin(){stop();authorized=false;raw=[];filtered=[];byId('dashboard').classList.add('hidden');byId('login').classList.remove('hidden');byId('logout').classList.add('hidden');byId('resetModal').hidden=true;}
  async function showIfAdmin(){const {data:{user},error}=await api.auth.getUser();if(error||!user){showLogin();return;}
    const {data,error:check}=await api.from('chaine_admins').select('user_id').eq('user_id',user.id).maybeSingle();
    if(check||!data){await api.auth.signOut();showLogin();msg('Bu hesap yönetici olarak yetkilendirilmemiş.','error');return;}
    authorized=true;byId('login').classList.add('hidden');byId('dashboard').classList.remove('hidden');byId('logout').classList.remove('hidden');await load();start();}
  function activate(name){all('[data-section]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.section===name)));all('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==name);}
  function download(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3500);}
  const csvCell=v=>'"'+String(v??'').replace(/^[=+@-]/,m=>"'"+m).replace(/"/g,'""')+'"';
  function rawData(scope){return [['Katılımcı UID','Tür','Ürün ID','Ürün','Yemek puanı / 5','Görünüm / 15','Koku / 25','Damak / 25','Bitiş / 15','Genel / 20','Şarap toplam /100','Tadım notu','Oluşturulma','Güncelleme'],...scope.map(r=>[r.user_id,kind(r),r.item_id,label(r),r.food_rating,finite(r.appearance),finite(r.nose),finite(r.palate),finite(r.finish),finite(r.overall),r.kind==='wine'?total(r):'',r.note,date(r.created_at),date(r.updated_at)])];}
  function makeSheets(){const current=filtered,food=itemRows('food'),wine=itemRows('wine'),ratedRows=current.filter(r=>rated(r)),users=new Set(current.filter(r=>rated(r)||hasNote(r)).map(r=>r.user_id));
    return [
      {name:'Özet',rows:[['Chaîne des Rôtisseurs 2026','Analitik değerlendirme raporu'],['Rapor tarihi',date(new Date())],['Tarih filtresi',byId('period').selectedOptions[0].textContent],['Tür filtresi',byId('typeFilter').selectedOptions[0].textContent],['Katılımcı',users.size],['Yemek puanı',ratedRows.filter(r=>r.kind==='food').length],['Şarap puanı',ratedRows.filter(r=>r.kind==='wine').length],['Yazılı not',current.filter(hasNote).length]]},
      {name:'Yemekler',rows:[['Yemek','Oy sayısı','Ortalama / 5','1 yıldız','2 yıldız','3 yıldız','4 yıldız','5 yıldız'],...food.map(x=>[x.name,x.count,x.avg===null?'':Number(x.avg.toFixed(2)),...[1,2,3,4,5].map(n=>x.votes.filter(r=>Number(r.food_rating)===n).length)])]},
      {name:'Şaraplar',rows:[['Şarap','Oy sayısı','Ortalama / 100','Görünüm /15','Koku /25','Damak /25','Bitiş /15','Genel /20'],...wine.map(x=>[x.name,x.count,x.avg===null?'':Number(x.avg.toFixed(2)),...['appearance','nose','palate','finish','overall'].map(k=>{const a=average(x.votes,r=>finite(r[k]));return a===null?'':Number(a.toFixed(2));})])]},
      {name:'Tadım Notları',rows:[['Güncelleme','Tür','Ürün','Not'],...current.filter(hasNote).map(r=>[date(r.updated_at),kind(r),label(r),r.note])]},
      {name:'Ham Kayıtlar',rows:rawData(current)}
    ];
  }
  const stamp=()=>new Date().toISOString().slice(0,10);
  function exportExcel(){if(!authorized)return;try{window.ChaineXlsx.save(makeSheets(),'chaine_2026_rapor_'+stamp()+'.xlsx');msg('Excel raporu indirildi.','success');}catch(err){msg('Excel dosyası üretilemedi: '+err.message,'error');}}
  function exportCSV(){if(!authorized)return;const rows=rawData(filtered);download(new Blob(['\ufeff'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'chaine_2026_kayitlar_'+stamp()+'.csv');msg('CSV raporu indirildi.','success');}
  function exportPDF(){if(!authorized)return;
    // No external PDF library needed: browser's "Save as PDF" creates a vector/text PDF.
    const food=itemRows('food'),wine=itemRows('wine'),notes=filtered.filter(hasNote),users=new Set(filtered.filter(r=>rated(r)||hasNote(r)).map(r=>r.user_id));
    const table=(heads,rows)=>`<table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const pdf=`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Chaîne 2026 Değerlendirme Raporu</title><style>@page{size:A4;margin:15mm 13mm}body{font-family:Arial,sans-serif;color:#211a1b;font-size:10px;line-height:1.5}h1{font-family:Georgia,serif;font-weight:normal;font-size:28px}h2{font-size:16px;border-bottom:1px solid #b49a75;padding-bottom:7px;margin-top:26px}small{color:#756e70}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:9px;margin:12px 0 22px}th{background:#efe7dc}td,th{border:1px solid #d0c5b6;padding:7px 6px;text-align:left;overflow-wrap:anywhere}tr{break-inside:avoid}thead{display:table-header-group}.summary{display:flex;gap:12px;margin:20px 0}.summary span{border:1px solid #d2c8bf;padding:12px;flex:1}.notes article{padding:9px 0;border-bottom:1px solid #d5c9bb;break-inside:avoid}.notes p{white-space:pre-wrap;overflow-wrap:anywhere}.no-print{position:fixed;top:9px;right:9px;background:#231b18;color:white;border:0;padding:10px;cursor:pointer}@media print{.no-print{display:none}}</style></head><body><button class="no-print" onclick="window.print()">Yazdır / PDF kaydet</button><small>CHAÎNE DES RÔTISSEURS · 2026</small><h1>Gastronomi Değerlendirme Raporu</h1><small>Rapor: ${esc(date(new Date()))} · ${esc(byId('period').selectedOptions[0].textContent)} · ${esc(byId('typeFilter').selectedOptions[0].textContent)}</small><div class="summary"><span>Katılımcı<br><b>${users.size}</b></span><span>Yemek puanı<br><b>${filtered.filter(r=>r.kind==='food'&&rated(r)).length}</b></span><span>Şarap puanı<br><b>${filtered.filter(r=>r.kind==='wine'&&rated(r)).length}</b></span><span>Yazılı not<br><b>${notes.length}</b></span></div><h2>Yemekler</h2>${table(['Yemek','Oy sayısı','Ortalama /5'],food.map(x=>[x.name,x.count,pretty(x.avg)]))}<h2>Şaraplar</h2>${table(['Şarap','Oy','Ort. /100','Görünüm','Koku','Damak','Bitiş','Genel'],wine.map(x=>[x.name,x.count,pretty(x.avg),...['appearance','nose','palate','finish','overall'].map(k=>pretty(average(x.votes,r=>finite(r[k]))))]))}<h2>Yazılı tadım notları</h2><div class="notes">${notes.length?notes.map(r=>`<article><strong>${esc(label(r))}</strong> <small>${esc(kind(r))} · ${esc(date(r.updated_at))}</small><p>${esc(r.note)}</p></article>`).join(''):'<p>Not bulunmuyor.</p>'}</div><h2>Ham değerlendirmeler</h2>${table(['Katılımcı','Tür','Ürün','Puan','Tarih'],filtered.filter(r=>rated(r)||hasNote(r)).map(r=>[r.user_id.slice(0,8)+'…',kind(r),label(r),scoreName(r),date(r.updated_at)]))}</body></html>`;
    const w=window.open('','_blank');if(!w){msg('PDF raporu için açılır pencereye izin verin.','error');return;}w.document.open();w.document.write(pdf);w.document.close();w.focus();msg('PDF rapor sayfası açıldı. “Yazdır / PDF kaydet” üzerinden PDF olarak saklayabilirsiniz.','success');
  }
  function openReset(){if(!authorized||busy||resetBusy)return;byId('resetConfirm').value='';byId('resetDo').disabled=true;setText('resetMessage','');byId('resetModal').hidden=false;byId('resetConfirm').focus();}
  function closeReset(){if(resetBusy)return;byId('resetModal').hidden=true;}
  async function resetVotes(){if(!authorized||resetBusy||byId('resetConfirm').value!=='TÜM OYLARI SIFIRLA')return;
    resetBusy=true;byId('resetDo').disabled=true;setText('resetMessage','Yönetici yetkisi doğrulanıyor…');
    try{const {data:{user},error:ue}=await api.auth.getUser();if(ue||!user)throw new Error('Oturum doğrulanamadı. Yeniden giriş yapın.');
      const {data,error}=await api.rpc('chaine_reset_votes',{p_confirmation:'TÜM OYLARI SIFIRLA'});
      if(error)throw error;
      byId('resetModal').hidden=true;msg(`${Number(data.deleted_rows||0)} kayıt silindi. Oylama ekranı artık sıfırdan başlayabilir.`,'success');await load();
    }catch(e){setText('resetMessage','Sıfırlama yapılamadı: '+(e.message||e));msg('Sıfırlama başarısız. Supabase SQL fonksiyonunun kurulu olduğunu kontrol edin.','error');}
    finally{resetBusy=false;byId('resetDo').disabled=byId('resetConfirm').value!=='TÜM OYLARI SIFIRLA';}
  }
  all('[data-section]').forEach(b=>b.addEventListener('click',()=>activate(b.dataset.section)));
  ['period','typeFilter'].forEach(id=>byId(id).addEventListener('change',()=>{if(authorized)paint();}));
  byId('search').addEventListener('input',()=>{if(authorized)paint();});
  byId('clearFilters').addEventListener('click',()=>{byId('period').value='all';byId('typeFilter').value='all';byId('search').value='';if(authorized)paint();});
  byId('loginForm').addEventListener('submit',async event=>{event.preventDefault();byId('loginBtn').disabled=true;msg('Giriş kontrol ediliyor…');
    try{const {error}=await api.auth.signInWithPassword({email:byId('email').value.trim(),password:byId('password').value});if(error)throw error;byId('password').value='';await showIfAdmin();}
    catch(e){msg('Giriş başarısız: '+(e.message||e),'error');}finally{byId('loginBtn').disabled=false;}
  });
  byId('logout').addEventListener('click',async()=>{stop();await api.auth.signOut();showLogin();msg('Çıkış yapıldı.');});
  byId('refresh').addEventListener('click',load);
  byId('excel').addEventListener('click',exportExcel);byId('csv').addEventListener('click',exportCSV);byId('pdf').addEventListener('click',exportPDF);
  byId('resetStart').addEventListener('click',openReset);byId('resetCancel').addEventListener('click',closeReset);
  byId('resetConfirm').addEventListener('input',()=>{byId('resetDo').disabled=byId('resetConfirm').value!=='TÜM OYLARI SIFIRLA';});
  byId('resetDo').addEventListener('click',resetVotes);
  byId('resetModal').addEventListener('click',e=>{if(e.target===byId('resetModal'))closeReset();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!byId('resetModal').hidden)closeReset();});
  if(!window.supabase?.createClient){msg('Supabase bağlantısı yüklenemedi. İnternet bağlantınızı kontrol edin.','error');byId('loginBtn').disabled=true;return;}
  api=window.supabase.createClient(ENDPOINT,PUBLISHABLE,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:'chaine_2026_admin_auth_v1'}});
  showIfAdmin().catch(e=>msg('Panel başlatılamadı: '+(e.message||e),'error'));
})();
