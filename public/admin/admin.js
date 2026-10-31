(() => {
 'use strict';
 const $=(selector,root=document)=>root.querySelector(selector);
 const $$=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
 const defs={
  profile:{name:'Profil Pribadi',icon:'◈',description:'Identitas personal: nama lengkap, headline, tentang saya, foto profil, dan CV.',fields:[
   ['brand','Nama Pendek / Alias (opsional)'],['brandSuffix','Tagline Bidang IT'],['fullName','Nama Lengkap Pemilik Portofolio'],['initials','Inisial Foto Placeholder'],['heroRole','Posisi / Headline'],
   ['heroHeading','Teks Hero (3 baris)','lines'],['heroDescription','Deskripsi Hero','long'],['email','Email Kontak'],['location','Lokasi'],['availabilityText','Status Ketersediaan'],
   ['bio','Biografi (paragraf terpisah baris kosong)','paragraphs'],['aboutQuote','Kutipan Personal','long'],['avatarUrl','Foto Profil','file'],['cvUrl','CV (PDF)','file']
  ]},
  socials:{name:'Media Sosial',icon:'◎',description:'Tautan GitHub, LinkedIn, Instagram, dan platform lain.',fields:[['label','Nama Platform'],['url','URL Profil','url']]},
  services:{name:'Layanan & Keahlian',icon:'◇',description:'Bidang keahlian utama: web, mobile, network, dan IT support.',fields:[['number','Nomor'],['icon','Ikon (code / phone / network / headset)','icon'],['label','Label Kategori'],['title','Nama Layanan'],['summary','Deskripsi Layanan','long'],['tags','Kata Kunci (satu per baris)','lines'],['tone','Warna Kartu (lime / violet / cyan / orange)']]},
  projects:{name:'Proyek Portofolio',icon:'▣',description:'Kelola proyek yang Anda kerjakan sendiri, kontribusi pribadi, screenshot, tautan demo, dan hasil terverifikasi.',fields:[['id','ID / Slug Proyek'],['visibility','Status Tampil (draft / demo / published)','visibility'],['category','Kategori (web/mobile/network/support)','category'],['categoryLabel','Label Kategori'],['title','Judul Proyek'],['subtitle','Ringkasan Proyek','long'],['status','Status / Keterangan'],['year','Nomor atau Tahun'],['art','Ilustrasi (dashboard/mobile/knowledge/api/network/terminal)'],['image','Screenshot Proyek','file'],['tags','Teknologi / Tags (satu per baris)','lines'],['challenge','Tantangan','long'],['solution','Solusi','long'],['highlights','Sorotan Pekerjaan (satu per baris)','lines'],['result','Hasil / Capaian Terverifikasi','long'],['role','Kontribusi Anda'],['link','URL Live Demo','url'],['github','URL Repository','url']]},
  experiences:{name:'Pengalaman',icon:'▤',description:'Pengalaman kerja dan riwayat pelaksanaan proyek; isi informasi yang benar-benar terverifikasi.',fields:[['title','Posisi / Nama Pengalaman'],['type','Periode / Tipe Pengalaman'],['detail','Deskripsi / Organisasi','long'],['points','Pencapaian / Tugas (satu per baris)','lines']]},
  skills:{name:'Teknologi & Tools',icon:'⌘',description:'Daftar kemampuan teknis, bahasa pemrograman, framework, dan tools.',fields:[['title','Kategori Keahlian'],['icon','Ikon'],['items','Teknologi (satu per baris)','lines']]},
  certifications:{name:'Sertifikasi',icon:'✳',description:'Tambahkan sertifikasi BNSP/pribadi yang benar-benar dimiliki dengan lembaga penerbit, tanggal, dan tautan bukti.',fields:[['issuer','Lembaga Penerbit (BNSP / lainnya)'],['name','Nama Sertifikasi / Skema'],['subtitle','Deskripsi Kompetensi','long'],['year','Tahun / Masa Berlaku'],['number','Nomor Sertifikat (jangan tampilkan data sensitif)'],['status','Status'],['image','Dokumen Sertifikat (PDF atau Gambar)','file'],['url','URL Verifikasi Resmi','url']]},
  steps:{name:'Proses Kerja',icon:'↗',description:'Jelaskan pendekatan kerja profesional dari analisis hingga pemeliharaan.',fields:[['number','Nomor'],['title','Tahap'],['subtitle','Deskripsi Tahap','long']]},
  faqs:{name:'FAQ',icon:'?',description:'Kelola pertanyaan dan jawaban untuk pengunjung. Hanya FAQ published yang tampil di website.',fields:[['id','ID FAQ'],['visibility','Status publikasi','publication'],['question','Pertanyaan'],['answer','Jawaban','long']]},
  testimonials:{name:'Testimoni',icon:'❞',description:'Tambahkan kutipan asli dari kolaborator. Publikasikan setelah mendapat izin dari pemberi testimoni.',fields:[['id','ID testimoni'],['visibility','Status publikasi','publication'],['consent','Izin publikasi dari pemberi testimoni','consent'],['name','Nama pemberi testimoni'],['role','Peran / jabatan'],['company','Organisasi (opsional)'],['quote','Kutipan asli yang diizinkan','long'],['avatarUrl','Foto pemberi testimoni (opsional)','file']]},
  messages:{name:'Pesan Masuk',icon:'✉',description:'Pesan yang dikirim melalui formulir publik.'},
  media:{name:'Media Library',icon:'▥',description:'Foto, bukti proyek, sertifikat, dan CV.'},
  seo:{name:'SEO & Mesin Pencari',icon:'⌕',description:'Atur judul, deskripsi, pratinjau sosial, dan indeks website dalam dua bahasa.'},
  appearance:{name:'Warna & Tampilan',icon:'◐',description:'Sesuaikan identitas visual untuk tema gelap dan terang.'},
  security:{name:'Keamanan',icon:'◇',description:'Kelola password, sesi aktif, dan riwayat aktivitas akun Anda.'}
 };
 const collectionKeys=new Set(['socials','services','projects','experiences','skills','certifications','steps','faqs','testimonials']);
 let csrf='',currentLocale='id',activeSection='profile',selectedIndex=0,content=null,dirty=false,selectFileInput=null,toastTimer=null;
 async function api(url,options={}){
  const response=await fetch(url,{credentials:'same-origin',...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...(options.method&&options.method!=='GET'?{'X-CSRF-Token':csrf}:{}),...(options.headers||{})}});
  let data;try{data=await response.json()}catch{data={error:'Unexpected server response'}}
  if(response.status===401&&!url.endsWith('/login')&&!url.includes('/mfa/verify')&&!url.includes('/mfa/cancel-login')){csrf='';content=null;showLogin('Sesi Anda telah berakhir. Silakan masuk kembali.')}
  if(!response.ok){const error=new Error(data.error||`HTTP ${response.status}`);error.status=response.status;throw error}
  return data;
 }
 function notify(message,error=false){const el=$('#toast');el.textContent=message;el.style.background=error?'#ffa19b':'';el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.classList.remove('show');el.style.background=''},3600)}
 function updateDirty(value=true){dirty=value;const el=$('#unsaved-label');el.textContent=value?'● Ada perubahan belum disimpan':'✓ Semua perubahan tersimpan';el.classList.toggle('dirty',value);window.AdminTranslation?.refresh()}
 function showLogin(message=''){ $('#login-layout').hidden=false;$('#admin-layout').hidden=true;$('#login-form').hidden=false;$('#mfa-login-form').hidden=true;$('#login-mfa-code').value='';$('#login-alert').hidden=!message;$('#login-alert').textContent=message;dirty=false;window.dispatchEvent(new Event('admin:logout')); }
 async function showDashboard(admin){$('#login-layout').hidden=true;$('#admin-layout').hidden=false;$('#admin-name').textContent=admin.name;$('#admin-email').textContent=admin.email;renderMenu();await loadContent()}
 async function init(){
  try{const s=await api('/admin/api/session');if(s.authenticated){csrf=s.csrf;await showDashboard(s.admin)}else showLogin()}
  catch(e){showLogin();$('#login-alert').hidden=false;$('#login-alert').textContent='Gagal terhubung ke server CMS: '+e.message}
 }
 $('#login-form').addEventListener('submit',async e=>{
  e.preventDefault();const button=$('#login-submit');button.disabled=true;$('#login-alert').hidden=true;
  try{
   const token=await api('/admin/api/login-csrf');
   const data=await api('/admin/api/login',{method:'POST',headers:{'X-CSRF-Token':token.csrf},body:JSON.stringify({email:$('#login-email').value,password:$('#login-password').value})});
   csrf=data.csrf;$('#login-password').value='';
   if(data.mfaRequired){$('#login-form').hidden=true;$('#mfa-login-form').hidden=false;$('#mfa-login-alert').hidden=true;setRecoveryMode(false);$('#login-mfa-code').focus();return}
   await showDashboard(data.admin);notify('Berhasil masuk ke dashboard');
  }catch(err){$('#login-alert').hidden=false;$('#login-alert').textContent=err.message}
  finally{button.disabled=false}
 });
 let recoveryMode=false;
 function setRecoveryMode(value){
  recoveryMode=value;const input=$('#login-mfa-code');input.value='';input.inputMode=value?'text':'numeric';input.maxLength=value?40:6;input.autocomplete=value?'off':'one-time-code';
  if(value)input.removeAttribute('pattern');else input.pattern='[0-9]{6}';
  $('#login-mfa-label').textContent=value?'Kode pemulihan':'Kode autentikator';$('#mfa-use-recovery').textContent=value?'Gunakan kode autentikator':'Gunakan kode pemulihan';
  $('#mfa-login-help').textContent=value?'Masukkan satu kode pemulihan yang belum pernah dipakai. Setelah berhasil, kode tersebut tidak dapat digunakan lagi.':'Masukkan kode 6 digit dari aplikasi autentikator. Password saja belum membuka dashboard.';
 }
 $('#mfa-use-recovery').addEventListener('click',()=>{setRecoveryMode(!recoveryMode);$('#login-mfa-code').focus()});
 $('#mfa-back-login').addEventListener('click',async()=>{try{await api('/admin/api/mfa/cancel-login',{method:'POST',body:'{}'})}catch(error){notify(error.message,true)}finally{csrf='';showLogin();$('#login-password').focus()}});
 $('#mfa-login-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=$('#mfa-login-submit');button.disabled=true;$('#mfa-login-alert').hidden=true;
  try{const data=await api('/admin/api/mfa/verify',{method:'POST',body:JSON.stringify({code:$('#login-mfa-code').value.trim()})});csrf=data.csrf;$('#login-mfa-code').value='';await showDashboard(data.admin);notify('Berhasil masuk dengan MFA')}
  catch(error){if(error.status===401){csrf='';showLogin(error.message)}else{$('#mfa-login-alert').textContent=error.message;$('#mfa-login-alert').hidden=false;$('#login-mfa-code').select()}}
  finally{button.disabled=false}
 });
 async function logOut(){
  if((dirty||window.AdminSettings?.dirty()) && !confirm('Ada perubahan yang belum disimpan. Yakin ingin keluar?'))return;
  try{await api('/admin/api/logout',{method:'POST',body:JSON.stringify({})});csrf='';content=null;showLogin();notify('Anda telah keluar')}
  catch(e){notify(e.message,true)}
 }
 $('#logout-button').addEventListener('click',logOut);
 $('#logout-button-top').addEventListener('click',logOut);
 function renderMenu(){
  $('#sidebar-nav').replaceChildren();
  for(const [key,d] of Object.entries(defs)){
   if(key==='seo'){const label=document.createElement('div');label.className='sidebar-heading nav-settings-heading';label.textContent='PENGATURAN WEBSITE';$('#sidebar-nav').append(label)}
   const b=document.createElement('button');b.type='button';b.className=key===activeSection?'active':'';
   if(['seo','appearance','security'].includes(key))b.classList.add('settings-nav');
   if(key===activeSection)b.setAttribute('aria-current','page');
   const icon=document.createElement('span');icon.className='nav-icon';icon.textContent=d.icon;icon.setAttribute('aria-hidden','true');
   const name=document.createElement('span');name.textContent=d.name;b.append(icon,name);
   b.addEventListener('click',()=>{
    if(window.AdminSettings?.dirty()&&!confirm('Pengaturan belum disimpan. Buang perubahan dan pindah menu?'))return;
    activeSection=key;selectedIndex=0;renderMenu();renderSection();
   });
   $('#sidebar-nav').append(b);
  }
 }
 async function loadContent(){
  const response=await api(`/admin/api/content?lang=${currentLocale}`);content=response.content;updateDirty(false);
  $$('[data-locale]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.locale===currentLocale)));
  $('.preview-link').href=`/?lang=${currentLocale}`;
  renderSection();
 }
 async function switchLocale(to){
  if(to===currentLocale)return;
  if(window.AdminSettings?.dirty()&&!confirm('Pengaturan belum disimpan. Buang perubahan dan beralih bahasa?'))return;
  if(dirty&&!confirm('Perubahan saat ini belum disimpan. Beralih bahasa akan membuang perubahan tersebut. Lanjutkan?'))return;
  currentLocale=to;selectedIndex=0;await loadContent();
 }
 $$('[data-locale]').forEach(b=>b.addEventListener('click',()=>switchLocale(b.dataset.locale).catch(e=>notify(e.message,true))));
 function renderSection(){
  const def=defs[activeSection];$('#breadcrumb').textContent=def.name;$('#page-title').textContent=def.name;$('#page-description').textContent=def.description;
  const settingsSection=['seo','appearance','security'].includes(activeSection);
  const special=['messages','media','seo','appearance','security'].includes(activeSection);
  $('#editor-view').hidden=special;$('#messages-view').hidden=activeSection!=='messages';$('#media-view').hidden=activeSection!=='media';
  $('#content-notice').hidden=special;
  $('#settings-view').hidden=!settingsSection;
  $('.page-hero-right').hidden=['appearance','security'].includes(activeSection);
  const translationVisible=!['appearance','security','messages','media'].includes(activeSection);
  $('#translation-tools').hidden=!translationVisible;
  if(translationVisible)window.AdminTranslation?.update(currentLocale,{api,notify,isDirty:()=>dirty||Boolean(window.AdminSettings?.dirty()),onApplied:target=>switchLocale(target)});
  if(settingsSection){
   window.AdminSettings?.open(activeSection,currentLocale,{api,notify,onSessionChanged:value=>{csrf=value},onPasswordChanged:()=>{csrf='';content=null;showLogin();notify('Password berhasil diganti. Semua sesi telah keluar. Silakan masuk kembali.')}});
   return;
  }
  window.AdminSettings?.close();
  if(activeSection==='messages'){loadMessages();return}
  if(activeSection==='media'){loadMedia();return}
  const arr=collectionKeys.has(activeSection)?content[activeSection]:null;
  $('#item-panel').hidden=!arr;
  $('#editor-view').classList.toggle('single-editor',!arr);
  if(!arr){$('#editor-view').style.gridTemplateColumns='1fr'}else{$('#editor-view').style.gridTemplateColumns=''}
  $('#reorder-buttons').hidden=!arr;
  $('#add-button').hidden=!arr;
  if(arr){selectedIndex=Math.min(Math.max(0,selectedIndex),Math.max(0,arr.length-1));renderItemList(arr)}
  renderFields();
 }
 function labelOf(item,index){return item?.question||item?.title||item?.name||item?.label||item?.issuer||`Item ${index+1}`}
 function renderItemList(arr){
  const root=$('#item-list');root.replaceChildren();
  if(!arr.length){const p=document.createElement('p');p.className='empty-state';p.textContent='Belum ada item. Klik + Tambah.';root.append(p);return}
  arr.forEach((item,index)=>{
   const b=document.createElement('button');b.type='button';b.className=index===selectedIndex?'active':'';
   const num=document.createElement('span');num.className='item-number';num.textContent=String(index+1).padStart(2,'0');
   const name=document.createElement('span');name.className='item-title';name.textContent=labelOf(item,index);
   b.append(num,name);b.addEventListener('click',()=>{selectedIndex=index;renderSection()});root.append(b);
  });
 }
 function toFormValue(value,kind){if(Array.isArray(value))return kind==='paragraphs'?value.join('\n\n'):value.join('\n');return String(value??'')}
 function fromFormValue(value,kind){if(kind==='lines')return value.split('\n').map(s=>s.trim()).filter(Boolean);if(kind==='paragraphs')return value.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);return value}
 function makeField(row,record){
  const [key,label,kind='text']=row;
  const container=document.createElement('div');container.className='field';if(['long','lines','paragraphs','file'].includes(kind))container.classList.add('wide');
  const lbl=document.createElement('label');lbl.textContent=label;
  let input;
  if(['long','lines','paragraphs'].includes(kind)){
   input=document.createElement('textarea');input.rows=kind==='paragraphs'?6:kind==='long'?4:5;
  }else if(['category','icon','visibility','publication','consent'].includes(kind)){
   input=document.createElement('select');
   const options=kind==='category'?['web','mobile','network','support']:kind==='visibility'?['draft','demo','published']:kind==='publication'?['draft','published']:kind==='consent'?['pending','granted']:['code','phone','network','headset','server','workflow'];
   const current=String(record[key]??'');if(current&&!options.includes(current))options.unshift(current);
   options.forEach(value=>{const opt=document.createElement('option');opt.value=value;opt.textContent=kind==='consent'?({pending:'Belum ada izin',granted:'Izin publikasi diterima'}[value]||value):value;input.append(opt)});
  }else{
   input=document.createElement('input');input.type=kind==='url'?'url':'text';
  }
  input.id=`field-${key}`;lbl.htmlFor=input.id;input.value=toFormValue(record[key],kind);
  if(kind==='url')input.placeholder='https://example.com';
  input.addEventListener('input',()=>{
   record[key]=fromFormValue(input.value,kind);updateDirty();
   if(activeSection==='testimonials'&&key==='consent'&&record.consent==='pending'&&record.visibility==='published'){
    record.visibility='draft';$('#field-visibility').value='draft';notify('Testimoni diubah ke draft. Simpan untuk menyembunyikannya dari website.');
   }
   if(['name','title','label'].includes(key)&&collectionKeys.has(activeSection))renderItemList(content[activeSection]);
  });
  container.append(lbl);
  if(kind==='file'){
   const wrap=document.createElement('div');wrap.className='file-field';wrap.append(input);
   const button=document.createElement('button');button.className='file-upload-btn';button.type='button';button.textContent='↑ Unggah';
   button.addEventListener('click',()=>{selectFileInput=input;const pick=$('#file-picker');pick.accept=key==='cvUrl'?'application/pdf':activeSection==='certifications'&&key==='image'?'image/png,image/jpeg,image/webp,application/pdf':'image/png,image/jpeg,image/webp';pick.click()});
   wrap.append(button);container.append(wrap);
  }else container.append(input);
  if(kind==='lines'||kind==='paragraphs'){
   const hint=document.createElement('small');hint.textContent=kind==='paragraphs'?'Pisahkan paragraf menggunakan satu baris kosong.':activeSection==='skills'&&key==='items'?'Tulis satu teknologi per baris. Logo dikenali otomatis dari nama; istilah umum memakai ikon kategori.':'Tulis satu item pada setiap baris.';container.append(hint)
  }
  if(kind==='file'){
   const hint=document.createElement('small');hint.textContent='Gunakan berkas PNG/JPG/WebP atau PDF (maksimal 7 MB). Tautan terisi otomatis setelah unggah.';container.append(hint)
  }
  return container;
 }
 function renderFields(){
  const def=defs[activeSection];const items=collectionKeys.has(activeSection)?content[activeSection]:null;
  const record=items?items[selectedIndex]:content;
  const root=$('#form-fields');root.replaceChildren();
  $('#editor-title').textContent=items?(record?labelOf(record,selectedIndex):'Belum ada konten'):'Identitas Profesional';
  if(!record)return;
  for(const field of def.fields)root.append(makeField(field,record));
 }
 function addItem(){
  const fieldList=defs[activeSection].fields;
  const item={};
  fieldList.forEach(([key,_,kind])=>{item[key]=['lines','paragraphs'].includes(kind)?[]:''});
  if(activeSection==='projects')Object.assign(item,{id:`project-${Date.now()}`,category:'web',art:'dashboard',visibility:'draft',status:currentLocale==='en'?'Draft — verify before publishing':'Draft — verifikasi sebelum publikasi'});
  if(activeSection==='services')Object.assign(item,{number:String(content.services.length+1).padStart(2,'0'),icon:'code',tone:'lime'});
  if(activeSection==='skills')item.icon='code';
  if(activeSection==='steps')item.number=String(content.steps.length+1).padStart(2,'0');
  if(['faqs','testimonials'].includes(activeSection))Object.assign(item,{id:`${activeSection}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,visibility:'draft'});
  if(activeSection==='testimonials')item.consent='pending';
  content[activeSection].push(item);selectedIndex=content[activeSection].length-1;updateDirty();renderSection();
  $('#form-fields input, #form-fields textarea')?.focus();
 }
 $('#add-button').addEventListener('click',addItem);
 function reorder(change){const arr=content[activeSection];if(!arr)return;const next=selectedIndex+change;if(next<0||next>=arr.length)return;[arr[selectedIndex],arr[next]]=[arr[next],arr[selectedIndex]];selectedIndex=next;updateDirty();renderSection()}
 $('#move-up').addEventListener('click',()=>reorder(-1));$('#move-down').addEventListener('click',()=>reorder(1));
 $('#delete-item').addEventListener('click',()=>{const arr=content[activeSection];if(!arr||!arr.length)return;if(!confirm('Hapus item ini dari bahasa '+currentLocale.toUpperCase()+'?'))return;arr.splice(selectedIndex,1);selectedIndex=Math.max(0,selectedIndex-1);updateDirty();renderSection()});
 $('#content-form').addEventListener('submit',async e=>{
  e.preventDefault();
  if(!content)return;
  const button=$('#save-button');button.disabled=true;
  try{await api(`/admin/api/content?lang=${currentLocale}`,{method:'PUT',body:JSON.stringify(content)});updateDirty(false);notify('Konten '+currentLocale.toUpperCase()+' berhasil disimpan ke database')}
  catch(err){notify('Gagal menyimpan: '+err.message,true)}finally{button.disabled=false}
 });
 $('#file-picker').addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  if(file.size>7_000_000){notify('Ukuran file melebihi 7 MB',true);e.target.value='';return}
  try{
   const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('Tidak dapat membaca berkas'));reader.readAsDataURL(file)});
   const result=await api('/admin/api/upload',{method:'POST',body:JSON.stringify({filename:file.name,mime:file.type,base64})});
   if(selectFileInput){selectFileInput.value=result.path;selectFileInput.dispatchEvent(new Event('input',{bubbles:true}));selectFileInput=null}
   notify('Media berhasil diunggah: '+file.name);
   if(activeSection==='media')loadMedia();
  }catch(err){notify('Gagal unggah: '+err.message,true)}finally{e.target.value=''}
 });
 async function loadMessages(){
  const root=$('#message-list');root.textContent='Memuat pesan…';
  try{
   const data=await api('/admin/api/messages');root.replaceChildren();$('#unread-count').textContent=`(${data.unread} belum dibaca)`;
   if(!data.messages.length){root.textContent='Belum ada pesan masuk.';return}
   data.messages.forEach(m=>{
    const card=document.createElement('article');card.className='message-card';
    const top=document.createElement('div');top.className='message-top';
    const heading=document.createElement('strong');heading.textContent=`${m.name} · ${m.topic}`;if(m.status==='unread'){const dot=document.createElement('i');dot.className='unread-dot';heading.append(dot)}
    const time=document.createElement('time');time.textContent=m.created_at;top.append(heading,time);card.append(top);
    const from=document.createElement('div');from.className='message-from';from.textContent=`${m.email} · ${m.locale.toUpperCase()}`;card.append(from);
    const paragraph=document.createElement('p');paragraph.textContent=m.message;card.append(paragraph);
    const actions=document.createElement('div');actions.className='message-actions';
    const toggle=document.createElement('button');toggle.type='button';toggle.textContent=m.status==='read'?'Tandai belum dibaca':'Tandai sudah dibaca';toggle.addEventListener('click',async()=>{try{await api(`/admin/api/messages/${m.id}`,{method:'PATCH',body:JSON.stringify({status:m.status==='read'?'unread':'read'})});loadMessages()}catch(e){notify(e.message,true)}});actions.append(toggle);
    const deleteButton=document.createElement('button');deleteButton.type='button';deleteButton.className='delete';deleteButton.textContent='Hapus';deleteButton.addEventListener('click',async()=>{if(!confirm('Hapus pesan ini secara permanen?'))return;try{await api(`/admin/api/messages/${m.id}`,{method:'DELETE',body:JSON.stringify({})});loadMessages()}catch(e){notify(e.message,true)}});actions.append(deleteButton);
    card.append(actions);root.append(card);
   });
  }catch(e){root.textContent='Tidak dapat memuat pesan: '+e.message}
 }
 $('#refresh-messages').addEventListener('click',loadMessages);
 async function loadMedia(){
  const root=$('#media-list');root.textContent='Memuat media…';
  try{
   const data=await api('/admin/api/media');root.replaceChildren();
   if(!data.files.length){root.textContent='Belum ada media yang diunggah.';return}
   data.files.forEach(f=>{
    const card=document.createElement('div');card.className='media-card';
    const info=document.createElement('div');const title=document.createElement('strong');title.textContent=f.original_name;const sub=document.createElement('small');sub.textContent=`assets/uploads/${f.filename} · ${(f.size_bytes/1024).toFixed(0)} KB`;info.append(title,sub);card.append(info);
    const copy=document.createElement('button');copy.type='button';copy.textContent='Salin Path';copy.addEventListener('click',async()=>{const value=`assets/uploads/${f.filename}`;try{await navigator.clipboard.writeText(value);notify('Path media disalin')}catch{prompt('Salin path berkas:',value)}});card.append(copy);
    root.append(card);
   });
  }catch(err){root.textContent='Tidak dapat memuat media: '+err.message}
 }
 $('#upload-media').addEventListener('click',()=>{selectFileInput=null;$('#file-picker').accept='image/png,image/jpeg,image/webp,application/pdf';$('#file-picker').click()});
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
 window.addEventListener('admin:logout',()=>window.AdminSettings?.close());
 init();
})();
