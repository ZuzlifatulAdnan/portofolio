'use strict';
const {decodeHTML}=require('entities');
const {db,query,getContent,getSettings,sha256}=require('./db');
const {normalizeSettings,validateSettings}=require('./settings');
const {validateContent}=require('./validate');

const MAX_CHARACTERS=60000;
const rootFields={brandSuffix:'Bidang IT',heroRole:'Posisi / headline',heroHeading:'Teks hero',heroDescription:'Deskripsi hero',availabilityText:'Ketersediaan',bio:'Biografi',aboutQuote:'Kutipan personal'};
const collectionFields={
 services:{label:'Label',title:'Nama layanan',summary:'Deskripsi'},
 projects:{categoryLabel:'Kategori',title:'Judul',subtitle:'Ringkasan',status:'Keterangan',challenge:'Tantangan',solution:'Solusi',highlights:'Sorotan',result:'Hasil',role:'Kontribusi'},
 experiences:{title:'Posisi',type:'Periode / tipe',detail:'Deskripsi',points:'Tanggung jawab'},
 skills:{title:'Kategori keahlian'},certifications:{name:'Nama sertifikasi',subtitle:'Deskripsi',status:'Keterangan'},steps:{title:'Tahap',subtitle:'Deskripsi'},faqs:{question:'Pertanyaan',answer:'Jawaban'},testimonials:{role:'Peran',quote:'Kutipan'}
};
const collectionLabels={services:'Layanan',projects:'Proyek',experiences:'Pengalaman',skills:'Keahlian',certifications:'Sertifikasi',steps:'Proses kerja',faqs:'FAQ',testimonials:'Testimoni'};
function problem(message,status=422){const error=new Error(message);error.status=status;return error}
function validatePair(source,target){if(!['id','en'].includes(source)||!['id','en'].includes(target)||source===target)throw problem('Pilih arah terjemahan ID → EN atau EN → ID.')}
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));return value}
function shape(value){if(typeof value==='string')return '';if(Array.isArray(value))return value.map(shape);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,value])=>[key,shape(value)]));return value}
function translationVersion(source,target,sourceSeo=null,targetSeo=null){return sha256(JSON.stringify(stable({source,target,sourceSeo,targetSeo})))}
function setPath(object,path,value){let current=object;for(const key of path.slice(0,-1))current=current[key];current[path.at(-1)]=value}
function getPath(object,path){return path.reduce((current,key)=>current[key],object)}
function buildPlan(content,seo=null){
 const candidate={content:structuredClone(content),seo:seo?structuredClone(seo):null},entries=[];
 function add(value,path,label){
  if(Array.isArray(value))value.forEach((text,index)=>entries.push({path:[...path,index],label:`${label} ${index+1}`,source:text}));
  else entries.push({path,label,source:value});
 }
 for(const [key,label]of Object.entries(rootFields))add(content[key],['content',key],`Profil · ${label}`);
 for(const [collection,fields]of Object.entries(collectionFields))content[collection].forEach((item,index)=>{
  for(const [key,label]of Object.entries(fields))add(item[key],['content',collection,index,key],`${collectionLabels[collection]} ${index+1} · ${label}`);
 });
 if(seo)for(const [key,label]of Object.entries({title:'Judul halaman',description:'Deskripsi halaman',imageAlt:'Deskripsi gambar'}))add(seo[key],['seo',key],`SEO · ${label}`);
 return {candidate,entries};
}
function providerConfig(env=process.env){
 const provider=(env.TRANSLATION_PROVIDER||'').trim().toLowerCase();
 if(!provider)return {provider:'',configured:false};
 if(provider==='google')return {provider,configured:Boolean(env.GOOGLE_TRANSLATE_API_KEY?.trim()),key:env.GOOGLE_TRANSLATE_API_KEY?.trim(),url:'https://translation.googleapis.com/language/translate/v2'};
 if(provider==='libretranslate'){
  try{
   const url=new URL(env.LIBRETRANSLATE_URL);
   if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||!(url.protocol==='https:'||(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))))throw new Error();
   return {provider,configured:true,url:new URL('/translate',url).href,key:env.LIBRETRANSLATE_API_KEY||''};
  }catch{return {provider,configured:false}}
 }
 return {provider:'',configured:false};
}
function translationStatus(){const {provider,configured}=providerConfig();return {provider,configured,languages:['id','en'],maxCharacters:MAX_CHARACTERS}}
async function providerJSON(response){
 if(!response.ok){await response.body?.cancel();throw problem(response.status===429?'Kuota layanan terjemahan sedang penuh. Coba lagi nanti.':'Layanan terjemahan menolak permintaan. Periksa konfigurasi dan kuota server.',502)}
 const reader=response.body.getReader();let size=0;const chunks=[];
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1500000)throw problem('Respons terjemahan terlalu besar.',502);chunks.push(Buffer.from(value))}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
 }catch(error){await reader.cancel().catch(()=>{});throw error.status?error:problem('Respons layanan terjemahan tidak valid.',502)}
 finally{reader.releaseLock()}
}
async function translateTexts(texts,source,target,options={}){
 validatePair(source,target);
 const config=options.config||providerConfig(),request=options.fetch||fetch;
 if(!config.configured)throw problem('Layanan terjemahan belum terhubung. Konfigurasikan Google Cloud Translation atau LibreTranslate pada server.',503);
 if(texts.length>1500||texts.reduce((n,text)=>n+text.length,0)>MAX_CHARACTERS)throw problem(`Maksimal ${MAX_CHARACTERS.toLocaleString('id-ID')} karakter per terjemahan.`);
 const signal=options.signal||AbortSignal.timeout(45000),result=[];
 let batch=[],size=0;
 async function send(){
  if(!batch.length)return;
  const body={q:batch,source,target,format:'text'};
  const headers={'Content-Type':'application/json'};
  if(config.provider==='google')headers['X-Goog-Api-Key']=config.key;
  else if(config.key)body.api_key=config.key;
  const response=await request(config.url,{method:'POST',headers,body:JSON.stringify(body),signal,redirect:'error'});
  const payload=await providerJSON(response);
  const values=config.provider==='google'?payload.data?.translations?.map(entry=>typeof entry.translatedText==='string'?decodeHTML(entry.translatedText):null):payload.translatedText;
  if(!Array.isArray(values)||values.length!==batch.length||values.some(text=>typeof text!=='string'||!text.trim()||text.length>15000||/[\u0000-\u0008\u000b\u000e-\u001f]/.test(text)))throw problem('Jumlah atau bentuk hasil terjemahan tidak sesuai. Konten belum diubah.',502);
  result.push(...values);
  if(result.reduce((count,text)=>count+text.length,0)>180000)throw problem('Hasil layanan terjemahan melebihi batas ukuran. Konten belum diubah.',502);
  batch=[];size=0;
 }
 try{
  for(const text of texts){if(batch.length>=50||size+text.length>20000)await send();batch.push(text);size+=text.length}
  await send();return result;
 }catch(error){if(error.status)throw error;throw problem(signal.aborted?'Waktu layanan terjemahan habis. Konten belum diubah.':'Layanan terjemahan tidak dapat dihubungi. Konten belum diubah.',502)}
}
let activePreviews=0;
async function previewTranslation(source,target,includeSeo){
 validatePair(source,target);
 if(!translationStatus().configured)throw problem('Layanan terjemahan belum terhubung. Konfigurasikan layanan pada server.',503);
 if(activePreviews>=2)throw problem('Terjemahan lain sedang diproses. Tunggu sebentar lalu coba lagi.',429);
 activePreviews++;
 try{
  const [content,destination,settings]=await Promise.all([getContent(source),getContent(target),getSettings()]);
  const invalid=validateContent(content);if(invalid)throw problem('Konten sumber belum valid: '+invalid);
  const seo=includeSeo?settings.seo[source]:null;
  const {candidate,entries}=buildPlan(content,seo);
  const texts=[...new Set(entries.map(entry=>entry.source).filter(text=>text.trim()))];
  const translated=await translateTexts(texts,source,target),lookup=new Map(texts.map((text,index)=>[text,translated[index]]));
  const changes=[];
  for(const entry of entries){const value=lookup.get(entry.source)??entry.source;setPath(candidate,entry.path,value);if(entry.source.trim())changes.push({...entry,translation:value})}
  const settingsCandidate=includeSeo?{...settings,seo:{...settings.seo,[target]:candidate.seo}}:settings;
  const warning=validateContent(candidate.content)||validateSettings(settingsCandidate);
  return {source,target,includeSeo,baseVersion:translationVersion(content,destination,seo,includeSeo?settings.seo[target]:null),...candidate,changes,characters:texts.reduce((count,text)=>count+text.length,0),warning:warning?'Periksa dan koreksi sebelum menerapkan: '+warning:''};
 }finally{activePreviews--}
}
async function applyTranslation(data,adminId){
 const {source,target,baseVersion,content,seo}=data;
 validatePair(source,target);
 if(typeof data.includeSeo!=='boolean'||typeof baseVersion!=='string'||!/^[a-f\d]{64}$/.test(baseVersion))throw problem('Pratinjau terjemahan tidak valid. Buat pratinjau baru.');
 const invalid=validateContent(content);if(invalid)throw problem(invalid);
 const connection=await db.getConnection();
 try{
  await connection.beginTransaction();
  const [rows]=await connection.execute('SELECT locale,payload FROM content ORDER BY locale FOR UPDATE');
  const contentByLocale=Object.fromEntries(rows.map(row=>[row.locale,JSON.parse(row.payload)]));
  const [settingRows]=await connection.execute('SELECT payload FROM site_settings WHERE id=1 FOR UPDATE');
  const settings=normalizeSettings(JSON.parse(settingRows[0].payload));
  const sourceSeo=data.includeSeo?settings.seo[source]:null;
  const version=translationVersion(contentByLocale[source],contentByLocale[target],sourceSeo,data.includeSeo?settings.seo[target]:null);
  if(version!==baseVersion)throw problem('Konten sumber atau tujuan sudah berubah. Buat pratinjau baru agar perubahan terbaru tidak tertimpa.',409);
  const {candidate,entries}=buildPlan(contentByLocale[source],sourceSeo);
  const protectedCopy={content:structuredClone(content),seo:data.includeSeo?structuredClone(seo):null};
  if(data.includeSeo){settings.seo[target]=seo;const error=validateSettings(settings);if(error)throw problem(error)}
  if(JSON.stringify(stable(shape(protectedCopy)))!==JSON.stringify(stable(shape(candidate))))throw problem('Struktur koleksi dan paragraf harus tetap sama dengan sumber.');
  for(const entry of entries)setPath(protectedCopy,entry.path,getPath(candidate,entry.path));
  if(JSON.stringify(stable(protectedCopy))!==JSON.stringify(stable(candidate)))throw problem('Data identitas, kode, URL, dan struktur koleksi harus tetap sama dengan sumber.');
  await connection.execute('UPDATE content SET payload=?,updated_at=CURRENT_TIMESTAMP WHERE locale=?',[JSON.stringify(content),target]);
  if(data.includeSeo)await connection.execute('UPDATE site_settings SET payload=?,updated_at=CURRENT_TIMESTAMP WHERE id=1',[JSON.stringify(settings)]);
  await connection.execute('INSERT INTO audit_log(admin_id,operation,detail) VALUES(?,?,?)',[adminId,'translation.apply',`${source}->${target}${data.includeSeo?'; SEO':''}`]);
  await connection.commit();
 }catch(error){await connection.rollback();throw error}finally{connection.release()}
}
module.exports={buildPlan,providerConfig,translationStatus,translateTexts,translationVersion,previewTranslation,applyTranslation};
