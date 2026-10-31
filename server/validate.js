'use strict';
const rootKeys=['brand','brandSuffix','fullName','initials','heroRole','heroHeading','heroDescription','email','location','availabilityText','bio','aboutQuote','cvUrl','avatarUrl','socials','services','projects','experiences','skills','certifications','steps','faqs','testimonials'];
const collections=['socials','services','projects','experiences','skills','certifications','steps','faqs','testimonials'];
const pathFields=new Set(['avatarUrl','cvUrl','image']);
const urlFields=new Set(['url','link','github']);
const schemas={socials:['label','url'],services:['number','icon','label','title','summary','tags[]','tone'],projects:['id','category','categoryLabel','title','subtitle','status','year','art','image','tags[]','challenge','solution','highlights[]','result','role','link','github','visibility'],experiences:['title','type','detail','points[]'],skills:['title','icon','items[]'],certifications:['issuer','name','subtitle','year','number','status','image','url'],steps:['number','title','subtitle'],faqs:['id','question','answer','visibility'],testimonials:['id','name','role','company','quote','avatarUrl','visibility','consent']};
function validateContent(obj){
 if(!obj||typeof obj!=='object'||Array.isArray(obj))return 'Content must be an object.';
 for(const key of rootKeys)if(!(key in obj))return `Missing root field: ${key}`;
 if(Object.keys(obj).some(k=>!rootKeys.includes(k)))return 'Unknown content field.';
 for(const key of rootKeys.filter(k=>!collections.includes(k)&&!['bio','heroHeading'].includes(k)))if(typeof obj[key]!=='string')return `${key}: text required.`;
 for(const key of collections)if(!Array.isArray(obj[key])||obj[key].length>60)return `Invalid array: ${key}`;
 if(!Array.isArray(obj.bio)||obj.bio.length>12||!Array.isArray(obj.heroHeading)||obj.heroHeading.length!==3)return 'Invalid biography or heading.';
 if([...obj.bio,...obj.heroHeading].some(v=>typeof v!=='string'))return 'Biography and heading must contain text.';
 if(!obj.fullName.trim()||obj.fullName.length>150)return 'Nama lengkap wajib diisi (maksimal 150 karakter).';
 if(obj.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(obj.email))return 'Email kontak tidak valid.';
 for(const [collection,fields]of Object.entries(schemas))for(const item of obj[collection]){
  if(!item||typeof item!=='object'||Array.isArray(item))return `${collection}: invalid item.`;
  const allowed=fields.map(k=>k.replace('[]',''));
  if(Object.keys(item).some(k=>!allowed.includes(k)))return `${collection}: unknown field.`;
  for(const field of fields){
   const key=field.replace('[]','');
   if(field.endsWith('[]')?(!Array.isArray(item[key])||item[key].some(v=>typeof v!=='string')):typeof item[key]!=='string')return `${collection}.${key}: invalid type.`;
  }
 }
 for(const p of obj.projects)if(!['draft','demo','published'].includes(p.visibility)||!['web','mobile','network','support'].includes(p.category)||!/^[-\w]{1,100}$/.test(p.id))return 'Status, kategori, atau ID proyek tidak valid.';
 if(new Set(obj.projects.map(p=>p.id)).size!==obj.projects.length)return 'ID proyek harus unik.';
 for(const item of [...obj.services,...obj.skills])if(!['code','phone','network','headset','server','workflow'].includes(item.icon))return 'Ikon tidak dikenali. Pilih ikon yang tersedia.';
 for(const item of obj.services)if(!['lime','violet','cyan','orange'].includes(item.tone))return 'Warna kartu layanan tidak dikenali.';
 for(const collection of ['faqs','testimonials']){
  if(new Set(obj[collection].map(item=>item.id)).size!==obj[collection].length)return 'ID FAQ/testimoni harus unik.';
  for(const item of obj[collection])if(!/^[-\w]{1,100}$/.test(item.id)||!['draft','published'].includes(item.visibility))return 'ID atau status publikasi FAQ/testimoni tidak valid.';
 }
 for(const faq of obj.faqs){
  if(faq.question.length>180||faq.answer.length>4000)return 'Pertanyaan FAQ maksimal 180 karakter dan jawaban maksimal 4.000 karakter.';
  if(faq.visibility==='published'&&(faq.question.trim().length<5||faq.answer.trim().length<10))return 'Lengkapi pertanyaan dan jawaban sebelum memublikasikan FAQ.';
 }
 for(const testimonial of obj.testimonials){
  if(testimonial.name.length>100||testimonial.role.length>120||testimonial.company.length>120||testimonial.quote.length>2000)return 'Nama/peran/organisasi testimoni terlalu panjang atau kutipan melebihi 2.000 karakter.';
  if(!['pending','granted'].includes(testimonial.consent))return 'Status izin publikasi testimoni tidak valid.';
  if(testimonial.visibility==='published'&&(testimonial.consent!=='granted'||!testimonial.name.trim()||testimonial.quote.trim().length<10))return 'Testimoni hanya dapat dipublikasikan setelah nama, kutipan, dan izin publikasi dilengkapi.';
  if(testimonial.avatarUrl&&!/\.(?:png|jpe?g|webp)$/i.test(testimonial.avatarUrl))return 'Foto testimoni harus PNG/JPG/WebP.';
 }
 const encoded=JSON.stringify(obj);
 if(encoded.length>250_000)return 'Content exceeds 250KB limit.';
 let fields=0;
 function check(value,key='',depth=0){
  if(depth>10)return 'Content is too deeply nested.';
  fields++;if(fields>4000)return 'Too many fields.';
  if(typeof value==='string'){
   if(value.length>7000)return `${key}: text too long.`;
   if(/[\u0000-\u0008\u000b\u000e-\u001f]/.test(value))return `${key}: invalid control characters.`;
   if(pathFields.has(key)&&value && (!/^assets\/[a-zA-Z0-9_./-]{1,190}$/.test(value)||value.includes('..')||value.includes('//')))return `${key}: only local assets/ paths allowed.`;
   if(urlFields.has(key)&&value){try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return `${key}: only http(s) URLs without credentials allowed.`}catch{return `${key}: invalid URL.`}}
   return null;
  }
  if(Array.isArray(value)){
   if(value.length>150)return `${key}: too many items.`;
   for(const item of value){const error=check(item,key,depth+1);if(error)return error}
   return null;
  }
  if(value && typeof value==='object'){
   for(const [k,v] of Object.entries(value)){
    if(['__proto__','constructor','prototype'].includes(k))return 'Forbidden property name.';
    const error=check(v,k,depth+1);if(error)return error;
   }
   return null;
  }
  return `Unsupported value for ${key}.`;
 }
 return check(obj);
}
function validateMessage(message){
 const x=message;
 if(!x||typeof x!=='object')return 'Invalid message';
 if(typeof x.name!=='string'||x.name.trim().length<2||x.name.length>100)return 'Name must be 2–100 characters';
 if(typeof x.email!=='string'||x.email.length>200||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email))return 'Invalid email';
 if(typeof x.topic!=='string'||x.topic.length<2||x.topic.length>150)return 'Invalid topic';
 if(typeof x.message!=='string'||x.message.trim().length<10||x.message.length>3000)return 'Message must be 10–3000 characters';
 return null;
}
module.exports={validateContent,validateMessage};
