(() => {
 'use strict';
 let activeRefresh=null;
 const el=(tag,cls='',text='')=>{const node=document.createElement(tag);node.className=cls;node.textContent=text;return node};
 function render({api,notify,onToken}){
  const card=el('section','settings-card gsc-card');card.append(el('h2','','Google Search Console'),el('p','settings-intro','Siapkan verifikasi kepemilikan dan sitemap. Tag verifikasi dipasang pada HTML oleh server, sehingga dapat dibaca tanpa JavaScript.'));
  const status=el('p','gsc-status');status.setAttribute('role','status');status.textContent='Memeriksa pengaturan tersimpan…';card.append(status);
  const checks=el('ul','gsc-checks'),links=el('div','gsc-links'),property=el('code','gsc-code');card.append(checks,property,links);
  const steps=el('ol','gsc-steps');for(const text of ['Tambahkan properti URL-prefix di akun Google Anda dengan URL HTTPS yang sama seperti URL utama website.','Pilih verifikasi Tag HTML. Salin nilai content ke kolom token di atas, atau tempel tag lengkap di bawah. Simpan pengaturan.','Setelah website dapat diakses publik, klik Verifikasi di Google Search Console.','Masukkan sitemap.xml pada menu Sitemaps di Google Search Console.'])steps.append(el('li','',text));card.append(steps);
  const label=el('label','gsc-import-label','Tempel tag verifikasi dari Google (opsional)'),input=el('input','gsc-import-input');input.type='text';input.id='gsc-tag-import';input.maxLength=600;input.placeholder='<meta name="google-site-verification" content="…">';label.htmlFor=input.id;
  const importButton=el('button','settings-secondary','Ambil token dari tag');importButton.type='button';const alert=el('p','settings-error');alert.hidden=true;alert.setAttribute('role','alert');card.append(label,input,importButton,alert);
  importButton.addEventListener('click',async()=>{importButton.disabled=true;alert.hidden=true;try{const result=await api('/admin/api/search-console/parse-token',{method:'POST',body:JSON.stringify({value:input.value})});if(!card.isConnected)return;onToken(result.token);input.value='';notify('Token disiapkan. Klik Simpan Pengaturan untuk memasangnya.')}catch(error){alert.textContent=error.message;alert.hidden=false}finally{importButton.disabled=false}});
  const domain=el('details','gsc-domain'),summary=el('summary','','Menggunakan properti Domain?');domain.append(summary,el('p','settings-hint','Properti Domain diverifikasi melalui DNS, bukan tag HTML. Tambahkan record TXT yang diberikan Google di pengelola DNS domain. Verifikasi DNS dapat disiapkan sebelum website dipublikasikan.'));card.append(domain,el('p','settings-hint','Status di sini menjelaskan konfigurasi aplikasi. Kepemilikan Google, pengiriman sitemap, dan hasil indeks tidak diperiksa atau diklaim otomatis.'));
  async function refresh(){
   try{
    const data=await api('/admin/api/search-console');if(!card.isConnected)return;
    status.textContent=data.message;checks.replaceChildren();
    for(const text of [data.publicUrlConfigured?'URL HTTPS publik sudah diisi':'URL publik belum tersedia',data.htmlTagInstalled?'Tag HTML verifikasi sudah terpasang pada aplikasi':'Token verifikasi belum tersimpan',data.indexingEnabled?'Indeks mesin pencari diaktifkan':'Indeks mesin pencari dinonaktifkan'])checks.append(el('li','',text));
    property.textContent=data.propertyUrl||'URL-prefix: isi URL utama website terlebih dahulu';links.replaceChildren();
    for(const [text,url]of [['Buka Google Search Console ↗',data.consoleUrl],['Panduan verifikasi resmi ↗',data.ownershipHelp],['Periksa sitemap lokal ↗','/sitemap.xml']]){const link=el('a','settings-resource',text);link.href=url;link.target='_blank';link.rel='noopener noreferrer';links.append(link)}
    if(data.sitemapUrl){const line=el('code','gsc-code',data.sitemapUrl);links.append(line)}
   }catch(error){if(card.isConnected)status.textContent='Status tidak dapat dimuat: '+error.message}
  }
  activeRefresh=refresh;queueMicrotask(refresh);return card;
 }
 window.AdminSearchConsole={render,refresh:()=>activeRefresh?.(),clear:()=>{activeRefresh=null}};
})();
