(() => {
 'use strict';
 let clearCurrent=()=>{};
 const el=(tag,cls='',text='')=>{const node=document.createElement(tag);node.className=cls;node.textContent=text;return node};
 function field(parent,label,type,autocomplete=''){
  const wrap=el('div','settings-field'),input=el('input'),name=el('label','',label);
  input.id='mfa-'+Math.random().toString(36).slice(2);input.type=type;input.autocomplete=autocomplete;input.required=true;input.maxLength=type==='password'?256:80;name.htmlFor=input.id;wrap.append(name,input);parent.append(wrap);return input;
 }
 function errorBox(parent){const alert=el('p','settings-error');alert.hidden=true;alert.setAttribute('role','alert');parent.append(alert);return alert}
 function button(text,cls='primary'){const node=el('button',cls,text);node.type='submit';return node}
 function render(state,helpers){
  clearCurrent();
  const card=el('section','settings-card mfa-card'),title=el('h2','','Autentikasi dua faktor (MFA)'),badge=el('span','mfa-badge',state.enabled?'Aktif':'Belum aktif');
  if(state.enabled)badge.classList.add('enabled');
  card.append(title,badge,el('p','settings-intro',state.enabled?`Kode autentikator diperlukan saat login. ${state.recoveryCodesRemaining} kode pemulihan belum dipakai.`:'Tambahkan autentikator seperti Google Authenticator, Microsoft Authenticator, atau aplikasi TOTP lainnya.'));
  let codes=[],secretInput=null,qr=null;
  function clear(){codes.fill('');codes=[];if(secretInput)secretInput.value='';if(qr)qr.removeAttribute('src');card.querySelectorAll('.mfa-recovery-list code').forEach(node=>node.textContent='');card.querySelectorAll('input[type=password],input[data-mfa-code]').forEach(input=>input.value='')}
  clearCurrent=clear;
  function showCodes(values){
   clear();codes=[...values];card.replaceChildren(el('h2','','Simpan kode pemulihan'),el('p','settings-intro','MFA sudah aktif. Setiap kode hanya dapat digunakan sekali jika perangkat autentikator tidak tersedia. Kode lama diganti jika Anda membuat ulang daftar ini.'));
   const list=el('div','mfa-recovery-list');for(const value of codes)list.append(el('code','',value));card.append(list);
   const download=button('Unduh kode pemulihan','settings-secondary');download.type='button';
   download.addEventListener('click',()=>{const blob=new Blob(['PERSONAL PORTFOLIO — KODE PEMULIHAN MFA\nSimpan privat. Setiap kode hanya berlaku satu kali.\n\n'+codes.join('\n')+'\n'],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download='portfolio-mfa-recovery-codes.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
   const confirm=el('label','mfa-acknowledgement'),check=el('input');check.type='checkbox';confirm.append(check,el('span','','Saya sudah menyimpan kode pemulihan di tempat yang aman.'));
   const done=button('Selesai','primary');done.type='button';done.disabled=true;check.addEventListener('change',()=>done.disabled=!check.checked);
   done.addEventListener('click',()=>{clear();helpers.refresh()});card.append(download,confirm,done);download.focus();
  }
  if(!state.enabled){
   if(!state.ready){card.append(el('p','settings-error','Kunci enkripsi MFA belum siap. Periksa konfigurasi server sebelum memulai setup.'));return card}
   const form=el('form','mfa-setup-form'),password=field(form,'Password akun untuk MFA','password','current-password'),start=button('Mulai setup MFA'),alert=errorBox(form);form.append(start);card.append(form);
   form.addEventListener('submit',async event=>{
    event.preventDefault();start.disabled=true;alert.hidden=true;
    try{
     const data=await helpers.api('/admin/api/mfa/setup',{method:'POST',body:JSON.stringify({currentPassword:password.value})});password.value='';if(!card.isConnected)return;form.hidden=true;
     const setup=el('form','mfa-enrollment');qr=el('img','mfa-qr');qr.src=data.qr;qr.alt='QR setup autentikator MFA';qr.width=240;qr.height=240;
     setup.append(el('p','settings-intro','Pindai QR dengan aplikasi autentikator, lalu masukkan kode 6 digit. Setup berlaku 10 menit dan belum mengaktifkan MFA sebelum kode dikonfirmasi.'),qr);
     secretInput=field(setup,'Kunci setup manual','text');secretInput.value=data.secret;secretInput.readOnly=true;secretInput.required=false;secretInput.spellcheck=false;
     const current=field(setup,'Konfirmasi password akun','password','current-password'),code=field(setup,'Kode autentikator untuk aktivasi','text','one-time-code');code.inputMode='numeric';code.pattern='[0-9]{6}';code.maxLength=6;code.dataset.mfaCode='true';
     const error=errorBox(setup),enable=button('Aktifkan MFA'),cancel=button('Batalkan setup','settings-secondary');cancel.type='button';
     setup.append(enable,cancel);card.append(setup);code.focus();
     cancel.addEventListener('click',async()=>{cancel.disabled=true;try{await helpers.api('/admin/api/mfa/cancel-setup',{method:'POST',body:'{}'});clear();helpers.refresh()}catch(err){error.textContent=err.message;error.hidden=false;cancel.disabled=false}});
     setup.addEventListener('submit',async event=>{
      event.preventDefault();enable.disabled=true;cancel.disabled=true;error.hidden=true;
      try{const result=await helpers.api('/admin/api/mfa/confirm',{method:'POST',body:JSON.stringify({currentPassword:current.value,code:code.value.trim()})});helpers.onSessionChanged(result.csrf);showCodes(result.recoveryCodes);helpers.notify('MFA aktif. Sesi lain telah dicabut. Simpan kode pemulihan Anda.')}
      catch(err){error.textContent=err.message;error.hidden=false;code.select()}
      finally{enable.disabled=false;cancel.disabled=false}
     });
    }catch(err){alert.textContent=err.message;alert.hidden=false}finally{start.disabled=false}
   });
  }else{
   const form=el('form','mfa-actions-form'),password=field(form,'Password akun untuk perubahan MFA','password','current-password'),code=field(form,'Kode autentikator atau kode pemulihan','text','one-time-code');code.dataset.mfaCode='true';
   form.append(el('small','settings-hint','Kode autentikator hanya dapat dipakai sekali. Jika baru dipakai login, tunggu kode berikutnya atau gunakan kode pemulihan.'));
   const alert=errorBox(form),regenerate=button('Buat ulang kode pemulihan','settings-secondary'),disable=button('Nonaktifkan MFA','settings-secondary mfa-danger');regenerate.dataset.action='recovery-codes';disable.dataset.action='disable';form.append(regenerate,disable);card.append(form);
   form.addEventListener('submit',async event=>{
    event.preventDefault();const action=event.submitter?.dataset.action;if(!['recovery-codes','disable'].includes(action))return;
    regenerate.disabled=true;disable.disabled=true;alert.hidden=true;
    try{
     const result=await helpers.api('/admin/api/mfa/'+action,{method:'POST',body:JSON.stringify({currentPassword:password.value,code:code.value.trim()})});helpers.onSessionChanged(result.csrf);clear();
     if(result.recoveryCodes)showCodes(result.recoveryCodes);else{helpers.notify('MFA dinonaktifkan dan sesi lain dicabut.');helpers.refresh()}
    }catch(err){alert.textContent=err.message;alert.hidden=false;code.select()}finally{regenerate.disabled=false;disable.disabled=false}
   });
  }
  return card;
 }
 function clear(){clearCurrent();clearCurrent=()=>{}}
 window.addEventListener('admin:logout',clear);
 window.AdminMFA={render,clear};
})();
