'use strict';
const defaults={
 siteUrl:'',indexing:false,defaultLocale:'id',googleVerification:'',
 seo:{id:{title:'',description:'',image:'',imageAlt:''},en:{title:'',description:'',image:'',imageAlt:''}},
 appearance:{accentDark:'#c9fb74',accentLight:'#4a752b',secondaryDark:'#8f87fe',secondaryLight:'#6a5dc4',defaultTheme:'dark',font:'system',corners:'rounded',animations:true,splash:true}
};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const localImage=value=>typeof value==='string'&&(value===''||/^assets\/(?!.*(?:\.\.|\/\/))[a-zA-Z0-9_./-]+\.(?:png|jpg|jpeg|webp)$/i.test(value));
function normalizeSettings(value={}){
 return {...structuredClone(defaults),...value,seo:{id:{...defaults.seo.id,...value.seo?.id},en:{...defaults.seo.en,...value.seo?.en}},appearance:{...defaults.appearance,...value.appearance}};
}
function luminance(hex){
 const channels=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
 return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
function validateSettings(value){
 if(!plain(value)||Object.keys(value).some(key=>!Object.hasOwn(defaults,key)))return 'Format pengaturan tidak valid.';
 if(typeof value.siteUrl!=='string'||value.siteUrl.length>200||value.siteUrl!==value.siteUrl.trim())return 'URL website tidak valid atau mengandung spasi di awal/akhir.';
 if(value.siteUrl){
  try{
   const url=new URL(value.siteUrl);
   if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||!(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))))throw new Error();
  }catch{return 'Gunakan origin HTTPS, misalnya https://namaanda.id, tanpa path atau parameter.'}
 }
 if(typeof value.indexing!=='boolean'||!['id','en'].includes(value.defaultLocale))return 'Pengaturan bahasa atau indeks tidak valid.';
 if(value.indexing&&(!value.siteUrl||new URL(value.siteUrl).protocol!=='https:'))return 'Isi domain HTTPS sebelum mengaktifkan indeks mesin pencari.';
 if(typeof value.googleVerification!=='string'||value.googleVerification.length>200||(value.googleVerification&&!/^[\w-]+$/.test(value.googleVerification)))return 'Token Google Search Console tidak valid.';
 if(!plain(value.seo)||Object.keys(value.seo).some(k=>!['id','en'].includes(k)))return 'Pengaturan SEO tidak valid.';
 for(const locale of ['id','en']){
  const seo=value.seo[locale];
  if(!plain(seo)||Object.keys(seo).some(k=>!['title','description','image','imageAlt'].includes(k)))return 'Field SEO tidak dikenali.';
  for(const [key,max] of [['title',70],['description',320],['imageAlt',160]]){
   if(typeof seo[key]!=='string'||seo[key].length>max||/[\u0000-\u001f]/.test(seo[key]))return `${locale.toUpperCase()}: ${key} maksimal ${max} karakter, tanpa baris baru.`;
  }
  if(!localImage(seo.image))return 'Gambar sosial harus berupa path gambar PNG/JPG/WebP di assets/.';
 }
 const a=value.appearance;
 if(!plain(a)||Object.keys(a).some(k=>!Object.hasOwn(defaults.appearance,k)))return 'Pengaturan tampilan tidak valid.';
 for(const color of ['accentDark','accentLight','secondaryDark','secondaryLight'])if(typeof a[color]!=='string'||!/^#[a-f\d]{6}$/i.test(a[color]))return 'Warna harus memakai format heksadesimal #RRGGBB.';
 if(contrast(a.accentDark,'#0a0e12')<4.5||contrast(a.accentLight,'#f5f7f1')<4.5)return 'Kontras warna aksen terlalu rendah. Pilih warna terang untuk tema gelap dan warna gelap untuk tema terang (minimal 4.5:1).';
 if(contrast(a.secondaryDark,'#0a0e12')<3||contrast(a.secondaryLight,'#f5f7f1')<3)return 'Kontras warna sekunder minimal 3:1 terhadap latar tema.';
 if(!['dark','light','system'].includes(a.defaultTheme)||!['system','serif','mono'].includes(a.font)||!['rounded','compact'].includes(a.corners)||typeof a.animations!=='boolean'||typeof a.splash!=='boolean')return 'Pilihan tema, font, sudut, animasi, atau splash tidak valid.';
 return null;
}
function themeCSS(settings){
 const a=settings.appearance;
 const rgb=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16)).join(',');
 const ink=hex=>contrast(hex,'#14200b')>=contrast(hex,'#ffffff')?'#14200b':'#ffffff';
 const font={system:"Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",serif:"Georgia,'Times New Roman',serif",mono:"ui-monospace,Consolas,monospace"}[a.font];
 return `:root{--sans:${font}}html[data-theme='dark']{--accent:${a.accentDark};--accent-rgb:${rgb(a.accentDark)};--accent-ink:${ink(a.accentDark)};--a2:${a.secondaryDark}}html[data-theme='light']{--accent:${a.accentLight};--accent-rgb:${rgb(a.accentLight)};--accent-ink:${ink(a.accentLight)};--a2:${a.secondaryLight}}${a.corners==='compact'?'.service-card,.project-card,.cert-card,.contact-form-panel,.btn{border-radius:6px}':''}${!a.animations?'html{scroll-behavior:auto}*,*::before,*::after{animation:none!important;transition:none!important}.reveal{opacity:1!important;transform:none!important}':''}`;
}
module.exports={defaults,normalizeSettings,validateSettings,themeCSS,localImage,contrast};
