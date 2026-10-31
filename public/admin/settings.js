(() => {
 'use strict';
 const root=document.getElementById('settings-view');
 let draft=null,changed=false,helpers=null,currentSection='',currentLocale='id',version=0;
 const el=(tag,className='',text='')=>{const node=document.createElement(tag);node.className=className;node.textContent=text;return node};
 const inputId=()=>`setting-${Math.random().toString(36).slice(2)}`;
 const showError=(element,message)=>{element.textContent=message;element.hidden=!message};
 function markChanged(){
  changed=true;
  root.querySelector('.settings-save-status')?.replaceChildren(document.createTextNode('Ada pengaturan belum disimpan'));
  window.AdminTranslation?.refresh();
 }
 function card(title,description){const node=el('section','settings-card');node.append(el('h2','',title));if(description)node.append(el('p','settings-intro',description));return node}
 function field(label,type,value,onChange,options={}){
  const wrap=el('div','settings-field'),input=el(type==='textarea'?'textarea':type==='select'?'select':'input');
  if(input.tagName==='INPUT')input.type=type;
  input.id=inputId();
  const lbl=el('label','',label);lbl.htmlFor=input.id;
  if(type==='select')for(const [key,text]of options.options||[]){const option=el('option','',text);option.value=key;input.append(option)}
  if(type==='checkbox')input.checked=value;else input.value=value;
  if(options.max)input.maxLength=options.max;
  if(options.min)input.minLength=options.min;
  if(options.required)input.required=true;
  if(options.autocomplete)input.autocomplete=options.autocomplete;
  if(options.placeholder)input.placeholder=options.placeholder;
  if(type==='textarea')input.rows=4;
  if(type==='checkbox'){wrap.classList.add('settings-checkbox');wrap.append(input,lbl)}else wrap.append(lbl,input);
  if(options.hint){const hint=el('small','settings-hint',options.hint);hint.id=input.id+'-hint';input.setAttribute('aria-describedby',hint.id);wrap.append(hint)}
  input.addEventListener(type==='select'||type==='checkbox'?'change':'input',()=>onChange(type==='checkbox'?input.checked:input.value));
  return {wrap,input};
 }
 function appendField(parent,label,type,value,onChange,options){const item=field(label,type,value,onChange,options);parent.append(item.wrap);return item.input}
 function saveFooter(form){
  const footer=el('div','settings-savebar'),status=el('span','settings-save-status','Semua pengaturan tersimpan');
  status.setAttribute('role','status');
  const button=el('button','primary settings-save','Simpan Pengaturan');button.type='submit';footer.append(status,button);
  const alert=el('p','settings-error');alert.setAttribute('role','alert');alert.hidden=true;
  form.append(alert,footer);
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(!form.reportValidity())return;
   const saveVersion=version;
   button.disabled=true;button.textContent='Menyimpan…';showError(alert,'');
   try{
    await helpers.api('/admin/api/settings',{method:'PUT',body:JSON.stringify(draft)});
    if(saveVersion!==version)return;
    changed=false;window.AdminTranslation?.refresh();window.AdminSearchConsole?.refresh();status.textContent='Pengaturan berhasil disimpan';helpers.notify('Pengaturan tersimpan dan diterapkan ke website.');
   }catch(error){showError(alert,error.message);helpers.notify(error.message,true)}
   finally{button.disabled=false;button.textContent='Simpan Pengaturan'}
  });
 }
 function renderSEO(){
  const form=el('form','settings-form'),grid=el('div','settings-columns'),main=el('div','settings-main'),aside=el('aside','settings-aside');
  const general=card('Domain & pencarian','Pengaturan ini berlaku untuk kedua bahasa. Indeks dinonaktifkan selama pengembangan lokal.');
  appendField(general,'URL utama website','url',draft.siteUrl,value=>{draft.siteUrl=value;markChanged();updatePreview()},{placeholder:'https://namaanda.id',hint:'Isi origin domain tanpa path. Biarkan kosong selama pengembangan lokal.'});
  appendField(general,'Izinkan mesin pencari mengindeks website','checkbox',draft.indexing,value=>{draft.indexing=value;markChanged()},{hint:'Aktifkan setelah domain HTTPS dan konten asli sudah siap.'});
  appendField(general,'Bahasa utama website','select',draft.defaultLocale,value=>{draft.defaultLocale=value;markChanged()},{options:[['id','Bahasa Indonesia'],['en','English']]});
  const verificationInput=appendField(general,'Token verifikasi Google Search Console','text',draft.googleVerification,value=>{draft.googleVerification=value;markChanged()},{max:200,hint:'Masukkan nilai content dari tag verifikasi. Untuk tag lengkap, gunakan alat Google Search Console di bawah.'});
  const searchConsole=window.AdminSearchConsole.render({api:helpers.api,notify:helpers.notify,onToken:token=>{draft.googleVerification=token;verificationInput.value=token;markChanged()}});
  const local=card(`Metadata ${currentLocale.toUpperCase()}`,'Judul dan deskripsi ini tersedia langsung di HTML, termasuk untuk mesin pencari dan tautan yang dibagikan.');
  const seo=draft.seo[currentLocale];
  const title=appendField(local,'Judul halaman','text',seo.title,value=>{seo.title=value;markChanged();updatePreview()},{max:70,hint:'Disarankan sekitar 50–60 karakter. Kosongkan untuk memakai nama profil.'});
  const description=appendField(local,'Deskripsi halaman','textarea',seo.description,value=>{seo.description=value;markChanged();updatePreview()},{max:320,hint:'Disarankan sekitar 140–160 karakter. Mesin pencari dapat menulis cuplikan sendiri.'});
  const counts=el('small','settings-hint');local.append(counts);
  const imageInput=appendField(local,'Gambar saat tautan dibagikan','text',seo.image,value=>{seo.image=value;markChanged();updatePreview()},{max:200,placeholder:'assets/uploads/nama-gambar.webp',hint:'Gunakan PNG/JPG/WebP. Ukuran 1200 × 630 cocok untuk pratinjau sosial.'});
  const upload=el('button','settings-secondary','Unggah gambar sosial');upload.type='button';
  const picker=el('input');picker.type='file';picker.accept='image/png,image/jpeg,image/webp';picker.hidden=true;upload.addEventListener('click',()=>picker.click());
  picker.addEventListener('change',async()=>{
   const file=picker.files?.[0];if(!file)return;
   if(file.size>5000000){helpers.notify('Gambar maksimal 5 MB.',true);picker.value='';return}
   upload.disabled=true;upload.textContent='Memeriksa & mengunggah…';
   try{
    const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(new Error('Berkas tidak dapat dibaca.'));reader.readAsDataURL(file)});
    const result=await helpers.api('/admin/api/upload',{method:'POST',body:JSON.stringify({filename:file.name,mime:file.type,base64})});
    seo.image=result.path;imageInput.value=result.path;markChanged();updatePreview();helpers.notify('Gambar diunggah. Simpan pengaturan untuk menerapkannya.');
   }catch(error){helpers.notify(error.message,true)}finally{upload.disabled=false;upload.textContent='Unggah gambar sosial';picker.value=''}
  });
  local.append(upload,picker);
  appendField(local,'Deskripsi gambar sosial','text',seo.imageAlt,value=>{seo.imageAlt=value;markChanged();updatePreview()},{max:160,hint:'Jelaskan isi gambar untuk pembaca layar.'});
  const preview=card('Pratinjau pencarian','Tampilan ilustrasi; cuplikan akhir ditentukan oleh mesin pencari.');
  const previewURL=el('p','seo-url'),previewTitle=el('h3','seo-title'),previewDescription=el('p','seo-description'),previewImage=el('img','seo-image');previewImage.hidden=true;
  preview.append(previewURL,previewTitle,previewDescription,previewImage);
  const resources=card('Pemeriksaan teknis','Sitemap dan robots.txt dibuat otomatis dari pengaturan yang Anda simpan.');
  for(const [text,url]of [['Lihat robots.txt ↗','/robots.txt'],['Lihat sitemap.xml ↗','/sitemap.xml'],['Lihat website ↗',`/?lang=${currentLocale}`]]){const link=el('a','settings-resource',text);link.href=url;link.target='_blank';link.rel='noopener noreferrer';resources.append(link)}
  function updatePreview(){
   previewURL.textContent=`${draft.siteUrl||'https://namaanda.id'}/?lang=${currentLocale}`;
   previewTitle.textContent=seo.title||'Nama Anda — IT Developer Portfolio';previewDescription.textContent=seo.description||'Deskripsi akan mengikuti deskripsi hero pada profil Anda.';
   counts.textContent=`Judul ${title.value.length}/70 · Deskripsi ${description.value.length}/320 karakter`;
   const valid=/^assets\/(?!.*(?:\.\.|\/\/))[\w./-]+\.(?:png|jpe?g|webp)$/i.test(seo.image);
   previewImage.hidden=!valid;if(valid){previewImage.src='/'+seo.image;previewImage.alt=seo.imageAlt||'Pratinjau gambar sosial'}else previewImage.removeAttribute('src');
  }
  updatePreview();main.append(general,searchConsole,local);aside.append(preview,resources);grid.append(main,aside);form.append(grid);saveFooter(form);root.append(form);
 }
 function renderAppearance(){
  const a=draft.appearance,form=el('form','settings-form'),grid=el('div','settings-columns'),main=el('div','settings-main'),aside=el('aside','settings-aside');
  const palette=card('Palet warna','Pilih palet awal, lalu sesuaikan warna untuk tema gelap dan terang. Kontras warna diperiksa saat disimpan.');
  const presets={Lime:['#c9fb74','#4a752b','#8f87fe','#6a5dc4'],Ocean:['#67e8f9','#0e6875','#c4b5fd','#6d28d9'],Blue:['#93c5fd','#1d4ed8','#f9a8d4','#9d174d'],Amber:['#fcd34d','#92400e','#8f87fe','#6a5dc4']};
  const presetRow=el('div','palette-presets'),inputs={};
  for(const [name,colors]of Object.entries(presets)){
   const button=el('button','palette-preset',name);button.type='button';const swatch=el('span','palette-dot');swatch.style.backgroundColor=colors[0];swatch.setAttribute('aria-hidden','true');button.prepend(swatch);
   button.addEventListener('click',()=>{['accentDark','accentLight','secondaryDark','secondaryLight'].forEach((key,index)=>{a[key]=colors[index];inputs[key].color.value=colors[index];inputs[key].text.value=colors[index]});markChanged();updatePreview()});presetRow.append(button);
  }
  palette.append(presetRow);
  for(const [key,label]of [['accentDark','Aksen · tema gelap'],['accentLight','Aksen · tema terang'],['secondaryDark','Sekunder · tema gelap'],['secondaryLight','Sekunder · tema terang']]){
   const item=field(label,'color',a[key],value=>{a[key]=value;inputs[key].text.value=value;markChanged();updatePreview()});
   const text=el('input','color-hex');text.type='text';text.value=a[key];text.maxLength=7;text.pattern='#[0-9a-fA-F]{6}';text.required=true;text.setAttribute('aria-label',`Nilai heksadesimal ${label}`);
   text.addEventListener('input',()=>{a[key]=text.value;if(/^#[a-f\d]{6}$/i.test(text.value))item.input.value=text.value;markChanged();updatePreview()});
   const controls=el('div','color-controls');item.input.remove();controls.append(item.input,text);item.wrap.append(controls);palette.append(item.wrap);inputs[key]={color:item.input,text};
  }
  const preferences=card('Tema & detail','Tema pilihan pengunjung tetap diingat oleh browser mereka.');
  appendField(preferences,'Tema awal pengunjung baru','select',a.defaultTheme,value=>{a.defaultTheme=value;markChanged()},{options:[['dark','Gelap'],['light','Terang'],['system','Ikuti perangkat']]});
  appendField(preferences,'Gaya font','select',a.font,value=>{a.font=value;markChanged();updatePreview()},{options:[['system','Sans serif · modern'],['serif','Serif · editorial'],['mono','Monospace · teknis']]});
  appendField(preferences,'Sudut kartu dan tombol','select',a.corners,value=>{a.corners=value;markChanged();updatePreview()},{options:[['rounded','Membulat'],['compact','Sedikit membulat']]});
  appendField(preferences,'Aktifkan animasi website','checkbox',a.animations,value=>{a.animations=value;markChanged()},{hint:'Preferensi reduced motion dari perangkat tetap dihormati.'});
  appendField(preferences,'Tampilkan splash loading','checkbox',a.splash,value=>{a.splash=value;markChanged()},{hint:'Intro singkat mengikuti nama profil dan warna website. Dilewati jika animasi nonaktif atau perangkat meminta reduced motion.'});
  const preview=card('Pratinjau warna','Perubahan di bawah belum diterapkan sebelum disimpan.');
  const cards={};
  for(const mode of ['dark','light']){
   const sample=el('div','theme-sample '+mode),label=el('span','theme-sample-label',mode==='dark'?'TEMA GELAP':'TEMA TERANG'),heading=el('h3','','Nama Anda.'),copy=el('p','','Membangun pengalaman digital yang berarti.'),button=el('span','theme-sample-button','Lihat karya ↗');
   sample.append(label,heading,copy,button);preview.append(sample);cards[mode]={sample,heading,button};
  }
  function updatePreview(){
   for(const mode of ['dark','light']){
    const accent=a[mode==='dark'?'accentDark':'accentLight'],secondary=a[mode==='dark'?'secondaryDark':'secondaryLight'],parts=cards[mode];
    if(/^#[a-f\d]{6}$/i.test(accent)){
     parts.heading.style.color=accent;parts.button.style.backgroundColor=accent;
     const channels=accent.slice(1).match(/../g).map(v=>parseInt(v,16));parts.button.style.color=channels[0]*.299+channels[1]*.587+channels[2]*.114>145?'#14200b':'#ffffff';
    }
    if(/^#[a-f\d]{6}$/i.test(secondary))parts.sample.style.borderColor=secondary;
    parts.sample.style.fontFamily={system:'system-ui,sans-serif',serif:'Georgia,serif',mono:'ui-monospace,monospace'}[a.font];
    parts.sample.style.borderRadius=a.corners==='compact'?'6px':'18px';
   }
  }
  updatePreview();main.append(palette,preferences);aside.append(preview);grid.append(main,aside);form.append(grid);saveFooter(form);root.append(form);
 }
 function renderSecurity(data){
  const summary=el('div','security-summary');
  for(const [label,value]of [['Sesi aktif',String(data.sessions.length)],['Keluar saat tidak aktif',`${data.security.idleMinutes} menit`],['Batas login per akun',`${data.security.loginLimit} / 15 menit`]]){const item=el('div','security-stat');item.append(el('strong','',value),el('span','',label));summary.append(item)}
  root.append(summary);
  const columns=el('div','settings-columns'),main=el('div','settings-main'),aside=el('aside','settings-aside');
  const passwordCard=card('Ganti password','Gunakan frasa unik minimal 15 karakter. Setelah berhasil, seluruh sesi akan keluar dan Anda perlu masuk kembali.');
  const form=el('form','password-form');
  const current=appendField(form,'Password saat ini','password','',()=>{},{required:true,max:256,autocomplete:'current-password'});
  const next=appendField(form,'Password baru','password','',()=>{},{required:true,min:15,max:256,autocomplete:'new-password'});
  const confirmation=appendField(form,'Ulangi password baru','password','',()=>{},{required:true,min:15,max:256,autocomplete:'new-password'});
  const secondFactor=data.mfa?.enabled?appendField(form,'Kode faktor kedua untuk ganti password','text','',()=>{},{required:true,max:80,autocomplete:'one-time-code',hint:'Kode autentikator yang belum dipakai atau satu kode pemulihan.'}):null;
  const alert=el('p','settings-error');alert.setAttribute('role','alert');alert.hidden=true;
  const submit=el('button','primary','Ganti Password & Keluar');submit.type='submit';form.append(alert,submit);passwordCard.append(form);
  form.addEventListener('submit',async event=>{
   event.preventDefault();showError(alert,'');if(next.value!==confirmation.value){showError(alert,'Konfirmasi password belum sama.');confirmation.focus();return}
   submit.disabled=true;submit.textContent='Mengganti password…';
   try{await helpers.api('/admin/api/password',{method:'POST',body:JSON.stringify({currentPassword:current.value,newPassword:next.value,...(secondFactor?{code:secondFactor.value.trim()}:{})})});form.reset();helpers.onPasswordChanged()}
   catch(error){showError(alert,error.message)}finally{submit.disabled=false;submit.textContent='Ganti Password & Keluar'}
  });
  const sessions=card('Sesi masuk','Sesi memiliki batas 12 jam dan otomatis berakhir setelah 30 menit tidak aktif.');
  for(const session of data.sessions){const row=el('div','session-row');row.append(el('strong','',session.current?'Sesi ini':'Sesi lain'),el('small','',`Masuk ${new Date(session.created_at).toLocaleString('id-ID')} · Aktif ${new Date(session.last_seen_at).toLocaleString('id-ID')}`));sessions.append(row)}
  const revoke=el('button','settings-secondary','Keluar dari semua sesi lain');revoke.type='button';revoke.disabled=data.sessions.length<=1;
  revoke.addEventListener('click',async()=>{revoke.disabled=true;try{await helpers.api('/admin/api/sessions/revoke-others',{method:'POST'});helpers.notify('Sesi lain telah dicabut.');await open('security',currentLocale,helpers)}catch(error){helpers.notify(error.message,true);revoke.disabled=false}});sessions.append(revoke);
  const info=card('Perlindungan aktif','Proteksi dijalankan otomatis oleh aplikasi.');
  const list=el('ul','security-controls');for(const text of ['CSRF & pemeriksaan origin','Pembatasan login dan pesan tersimpan di MySQL','Password scrypt & cookie HttpOnly','Pemeriksaan gambar dan PDF','Proyek draft disembunyikan dari publik'])list.append(el('li','',text));info.append(list);
  info.append(el('p','settings-hint',data.security.secureCookies?'Cookie Secure aktif pada HTTPS.':'Mode HTTP lokal. Cookie Secure diaktifkan saat memakai mode produksi dan HTTPS.'));
  main.append(window.AdminMFA.render(data.mfa,{api:helpers.api,notify:helpers.notify,onSessionChanged:helpers.onSessionChanged,refresh:()=>open('security',currentLocale,helpers)}),passwordCard,sessions);aside.append(info);columns.append(main,aside);root.append(columns);
  const audit=card('Riwayat aktivitas','100 aktivitas terbaru pada akun ini.');
  if(!data.logs.length)audit.append(el('p','settings-hint','Belum ada aktivitas.'));
  for(const entry of data.logs){const row=el('div','audit-row');row.append(el('time','',entry.created_at),el('strong','',entry.operation),el('span','',entry.detail||'—'));audit.append(row)}root.append(audit);
 }
 async function open(section,locale,apiHelpers){
  window.AdminMFA?.clear();window.AdminSearchConsole?.clear();
  const requestVersion=++version;currentSection=section;currentLocale=locale;helpers=apiHelpers;changed=false;root.replaceChildren(el('p','settings-loading','Memuat pengaturan…'));
  window.AdminTranslation?.refresh();
  try{
   if(section==='security'){
    const data=await helpers.api('/admin/api/security');if(requestVersion!==version)return;root.replaceChildren();renderSecurity(data);
   }else{
    const data=await helpers.api('/admin/api/settings');if(requestVersion!==version)return;draft=structuredClone(data.settings);root.replaceChildren();section==='seo'?renderSEO():renderAppearance();
   }
  }catch(error){if(requestVersion!==version)return;root.replaceChildren(el('p','settings-error',error.message));const retry=el('button','settings-secondary','Coba lagi');retry.type='button';retry.addEventListener('click',()=>open(section,locale,apiHelpers));root.append(retry)}
 }
 function close(){window.AdminMFA?.clear();window.AdminSearchConsole?.clear();version++;changed=false;draft=null;currentSection='';root.replaceChildren();window.AdminTranslation?.refresh()}
 window.addEventListener('beforeunload',event=>{if(changed){event.preventDefault();event.returnValue=''}});
 window.AdminSettings={open,close,dirty:()=>changed};
})();
