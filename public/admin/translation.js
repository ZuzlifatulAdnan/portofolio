(() => {
 'use strict';
 const $=selector=>document.querySelector(selector);
 const tools=$('#translation-tools'),dialog=$('#translation-dialog'),button=$('#translation-preview-button'),status=$('#translation-status');
 let context=null,locale='id',capability=null,pending=null,busy=false,version=0,previewEdited=false,returnFocus=null;
 const make=(tag,className,text)=>{const node=document.createElement(tag);node.className=className;node.textContent=text;return node};
 function refresh(){
  const target=locale==='id'?'en':'id',dirty=context?.isDirty();
  button.textContent=busy?'Menyiapkan terjemahan…':`Terjemahkan ${locale.toUpperCase()} → ${target.toUpperCase()}`;
  button.disabled=busy||!capability?.configured||Boolean(dirty);
  $('#translation-include-seo').disabled=busy;
  status.textContent=busy?'Teks sedang diproses layanan terjemahan. Konten belum diubah.':!capability?'Memeriksa konfigurasi layanan…':!capability.configured?'Belum aktif: hubungkan layanan terjemahan melalui konfigurasi server.':dirty?'Simpan perubahan konten dan SEO sebelum membuat terjemahan.':`${capability.provider==='google'?'Google Cloud Translation':'LibreTranslate'} · hasil perlu ditinjau sebelum diterapkan.`;
 }
 async function update(currentLocale,helpers){
  context=helpers;locale=currentLocale;const requestVersion=++version;refresh();
  if(capability)return;
  try{const result=await helpers.api('/admin/api/translation/status');if(requestVersion!==version)return;capability=result;refresh()}
  catch(error){if(requestVersion!==version)return;status.textContent='Status layanan tidak dapat dimuat: '+error.message;button.disabled=true}
 }
 function setValue(object,path,value){
  if(!Array.isArray(path)||path.length>7||path.some(key=>['__proto__','constructor','prototype'].includes(key)))throw new Error('Field pratinjau tidak valid.');
  let node=object;for(const key of path.slice(0,-1))node=node[key];node[path.at(-1)]=value;
 }
 function renderPreview(data){
  pending=data;previewEdited=false;$('#translation-confirm').checked=false;$('#translation-apply').disabled=true;
  $('#translation-title').textContent=`Pratinjau ${data.source.toUpperCase()} → ${data.target.toUpperCase()}`;
  $('#translation-confirm-label').textContent=`Saya memahami seluruh konten ${data.target.toUpperCase()}${data.includeSeo?' dan SEO-nya':''} akan diganti. Konten ${data.source.toUpperCase()} tetap disimpan.`;
  const warning=$('#translation-warning');warning.textContent=data.warning;warning.hidden=!data.warning;
  $('#translation-error').hidden=true;const changes=$('#translation-changes');changes.replaceChildren();
  for(const change of data.changes){
   const row=make('section','translation-row',''),heading=make('h3','',change.label),columns=make('div','translation-comparison','');
   const source=make('div','translation-source','');source.append(make('small','translation-language',data.source.toUpperCase()),make('p','',change.source));
   const translated=make('div','translation-result',''),label=make('label','translation-language',`${data.target.toUpperCase()} · dapat dikoreksi`),input=document.createElement('textarea');
   input.id=`translation-field-${changes.children.length}`;label.htmlFor=input.id;input.setAttribute('aria-label','Hasil terjemahan '+change.label);input.value=change.translation;input.rows=change.translation.length>160?4:2;input.maxLength=change.path[0]==='seo'?({title:70,description:320,imageAlt:160}[change.path[1]]||7000):7000;
   input.addEventListener('input',()=>{setValue(pending,change.path,input.value);previewEdited=true});
   translated.append(label,input);columns.append(source,translated);row.append(heading,columns);changes.append(row);
  }
  returnFocus=document.activeElement;dialog.showModal();$('#translation-close').focus();
 }
 button.addEventListener('click',async()=>{
  if(!context||busy||!capability?.configured)return;
  if(context.isDirty()){context.notify('Simpan perubahan sumber sebelum menerjemahkan.',true);return}
  const requestVersion=version,helpers=context,source=locale,target=source==='id'?'en':'id';busy=true;refresh();
  try{
   const data=await helpers.api('/admin/api/translation/preview',{method:'POST',body:JSON.stringify({source,target,includeSeo:$('#translation-include-seo').checked})});
   if(requestVersion!==version)return;
   if(context.isDirty()){context.notify('Konten di editor berubah saat terjemahan diproses. Simpan lalu buat pratinjau baru.',true);return}
   renderPreview(data);
  }catch(error){if(requestVersion===version)helpers.notify(error.message,true)}finally{busy=false;refresh()}
 });
 function close(){if(busy)return;if(previewEdited&&!confirm('Koreksi terjemahan belum diterapkan. Buang pratinjau ini?'))return;dialog.close()}
 $('#translation-close').addEventListener('click',close);$('#translation-cancel').addEventListener('click',close);
 dialog.addEventListener('cancel',event=>{event.preventDefault();close()});
 dialog.addEventListener('close',()=>{pending=null;previewEdited=false;returnFocus?.focus()});
 $('#translation-confirm').addEventListener('change',event=>{$('#translation-apply').disabled=!event.target.checked||busy});
 $('#translation-apply').addEventListener('click',async()=>{
  if(!pending||busy||!$('#translation-confirm').checked)return;
  const helpers=context,data=pending,apply=$('#translation-apply');busy=true;apply.disabled=true;apply.textContent='Menyimpan terjemahan…';$('#translation-error').hidden=true;refresh();
  try{
   await helpers.api('/admin/api/translation/apply',{method:'POST',body:JSON.stringify({source:data.source,target:data.target,includeSeo:data.includeSeo,baseVersion:data.baseVersion,content:data.content,seo:data.seo})});
   previewEdited=false;dialog.close();await helpers.onApplied(data.target);helpers.notify(`Terjemahan ${data.target.toUpperCase()} tersimpan. Anda dapat menyempurnakannya di editor.`);
  }catch(error){const alert=$('#translation-error');alert.textContent=error.message;alert.hidden=false;alert.scrollIntoView({block:'nearest'})}
  finally{busy=false;apply.textContent='Terapkan Terjemahan';apply.disabled=!$('#translation-confirm').checked;refresh()}
 });
 window.addEventListener('admin:logout',()=>{version++;context=null;capability=null;pending=null;busy=false;previewEdited=false;if(dialog.open)dialog.close()});
 window.addEventListener('beforeunload',event=>{if(previewEdited){event.preventDefault();event.returnValue=''}});
 window.AdminTranslation={update,refresh};
})();
