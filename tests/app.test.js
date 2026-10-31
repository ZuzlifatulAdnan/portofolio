'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {unlinkSync}=require('node:fs');
const {once}=require('node:events');
const {randomBytes}=require('node:crypto');
const {promisify}=require('node:util');
const execFile=promisify(require('node:child_process').execFile);
const mysql=require('mysql2/promise');
const cheerio=require('cheerio');
const {databaseConfig}=require('../server/config');
const path=require('node:path');
const net=require('node:net');
const http=require('node:http');
const ROOT=path.resolve(__dirname,'..');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){return new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port))})})}
async function request(base,url,options={}){const res=await fetch(base+url,options);let data;try{data=await res.json()}catch{data=null}return{res,data}}
const cookieFrom=(res,name)=>{
 const cookies=res.headers.getSetCookie?.()||[res.headers.get('set-cookie')];
 const entry=cookies.find(line=>line&&line.startsWith(name+'='));
 if(!entry)throw new Error(`Missing cookie ${name}: ${cookies.join(' | ')}`);
 return entry.split(';')[0];
};
test('MySQL: two languages, secure admin login, content editing, media and inbox',async()=>{
 const database='portfolio_cms_test_'+randomBytes(8).toString('hex');
 const {database:unused,...connectionOptions}=databaseConfig;
 const credentials={
  user:process.env.TEST_DB_USER ?? databaseConfig.user,
  password:process.env.TEST_DB_PASSWORD ?? databaseConfig.password
 };
 const connection=await mysql.createConnection({...connectionOptions,...credentials});
 const port=await freePort(),base=`http://127.0.0.1:${port}`;
 const env={...process.env,TRANSLATION_PROVIDER:'',PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'development',APP_ORIGIN:base,
  DB_NAME:database,DB_USER:credentials.user,DB_PASSWORD:credentials.password,ADMIN_PASSWORD:'S3cure-Test-Admin-Password!'};
 let uploadedPath=null,server=null;
 async function launchServer(){
  server=spawn(process.execPath,['server/index.js'],{cwd:ROOT,env,stdio:'pipe'});
  let errors='';server.stderr.on('data',c=>{errors+=c});
  let ready=false;
  for(let i=0;i<70;i++){
   try{const r=await fetch(base+'/health');if(r.ok){ready=true;break}}catch{}
   await pause(70);
  }
  assert.ok(ready,'Server was not started: '+errors);
 }
 async function stopServer(){
  const current=server;server=null;
  if(current && current.exitCode===null && current.signalCode===null){
   const exited=once(current,'exit');current.kill('SIGTERM');await exited;
  }
 }
 try{
  await execFile(process.execPath,['scripts/setup-db.js'],{cwd:ROOT,env});
  await connection.execute(`UPDATE \`${database}\`.content SET payload=JSON_REMOVE(JSON_SET(payload,'$.heroDescription',?), '$.faqs', '$.testimonials') WHERE locale='id'`,['Existing content preserved during upgrade.']);
  await execFile(process.execPath,['scripts/setup-db.js'],{cwd:ROOT,env});
  await execFile(process.execPath,['scripts/create-admin.js','--email','owner@example.com'],{cwd:ROOT,env});
  await assert.rejects(execFile(process.execPath,['scripts/create-admin.js','--email','owner@example.com'],{cwd:ROOT,env}),/Admin already exists/);
  await launchServer();
  assert.equal((await request(base,'/health')).data.database,'mysql');
  const id=await request(base,'/api/public/content?lang=id');
  const en=await request(base,'/api/public/content?lang=en');
  assert.equal(id.res.status,200);
  assert.match(id.data.content.heroHeading[0],/Saya membangun/);
  assert.equal(id.data.content.fullName,'Nama Lengkap Anda');
  assert.equal(id.data.content.heroDescription,'Existing content preserved during upgrade.');
  assert.equal(id.data.content.faqs.length,4);assert.deepEqual(id.data.content.testimonials,[]);
  assert.ok(id.data.content.projects.every(p=>p.visibility==='demo'));
  assert.match(en.data.content.heroHeading[0],/I build/);
  assert.equal(en.data.content.fullName,'Your Full Name');
  assert.equal(id.data.content.projects.length,6);
  assert.equal((await request(base,'/admin/api/content')).res.status,401);
  assert.equal((await request(base,'/admin/api/settings')).res.status,401);
  assert.equal((await request(base,'/admin/api/security')).res.status,401);
  assert.equal((await request(base,'/admin/api/translation/status')).res.status,401);
  const badHostStatus=await new Promise((resolve,reject)=>http.get(base+'/health',{headers:{Host:'attacker.example'}},res=>{res.resume();resolve(res.statusCode)}).on('error',reject));
  assert.equal(badHostStatus,421);
  assert.equal((await request(base,'/api/public/contact',{method:'POST',headers:{'Content-Type':'text/plain',Origin:base},body:'{}'})).res.status,415);
  assert.equal((await request(base,'/api/public/contact',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:'null'})).res.status,400);
  assert.equal((await request(base,'/api/public/contact',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://attacker.example'},body:'{}'})).res.status,403);
  assert.match(await fetch(base+'/robots.txt').then(r=>r.text()),/Disallow: \//);
  const token=await request(base,'/admin/api/login-csrf');
  const csrfCookie=cookieFrom(token.res,'nt_login_csrf');
  const wrong=await request(base,'/admin/api/login',{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':token.data.csrf,Origin:base,Cookie:csrfCookie},body:JSON.stringify({email:'owner@example.com',password:'wrong'})});
  assert.equal(wrong.res.status,401);
  const logged=await request(base,'/admin/api/login',{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':token.data.csrf,Origin:base,Cookie:csrfCookie},body:JSON.stringify({email:'owner@example.com',password:'S3cure-Test-Admin-Password!'})});
  assert.equal(logged.res.status,200,JSON.stringify(logged.data));
  const sessionCookie=cookieFrom(logged.res,'nt_session');
  const session=await request(base,'/admin/api/session',{headers:{Cookie:sessionCookie}});
  assert.equal(session.data.authenticated,true);
  const content=await request(base,'/admin/api/content?lang=en',{headers:{Cookie:sessionCookie}});
  assert.equal(content.res.status,200);
  const modified=content.data.content;modified.heroDescription='Dynamic bilingual MySQL content 🚀';
  const noCsrf=await request(base,'/admin/api/content?lang=en',{method:'PUT',headers:{Cookie:sessionCookie,'Content-Type':'application/json'},body:JSON.stringify(modified)});
  assert.equal(noCsrf.res.status,403);
  const headers={Cookie:sessionCookie,'x-csrf-token':logged.data.csrf,'Content-Type':'application/json',Origin:base};
  const translation=await request(base,'/admin/api/translation/status',{headers});assert.equal(translation.data.configured,false);
  assert.equal((await request(base,'/admin/api/translation/preview',{method:'POST',headers,body:JSON.stringify({source:'id',target:'en',includeSeo:true})})).res.status,503);
  const saved=await request(base,'/admin/api/content?lang=en',{method:'PUT',headers,body:JSON.stringify(modified)});
  assert.equal(saved.res.status,200,JSON.stringify(saved.data));
  const updated=await request(base,'/api/public/content?lang=en');
  assert.equal(updated.data.content.heroDescription,'Dynamic bilingual MySQL content 🚀');
  assert.equal((await request(base,'/api/public/content?lang=id')).data.content.heroDescription,id.data.content.heroDescription);
  await execFile(process.execPath,['scripts/setup-db.js'],{cwd:ROOT,env});
  assert.equal((await request(base,'/api/public/content?lang=en')).data.content.heroDescription,modified.heroDescription);
  const [[audit]]=await connection.execute(`SELECT COUNT(*) AS count FROM \`${database}\`.audit_log WHERE operation='content.update'`);
  assert.equal(audit.count,1);
  const community=structuredClone(id.data.content);
  community.faqs.push({id:'private-faq',question:'PRIVATE_FAQ_DRAFT',answer:'This is not public.',visibility:'draft'});
  community.faqs.push({id:'api-faq',question:'Pertanyaan dari tes API?',answer:'Jawaban publik untuk pengujian fitur FAQ.',visibility:'published'});
  community.testimonials=[{id:'private-quote',name:'PRIVATE_TESTIMONIAL_NAME',role:'',company:'',quote:'PRIVATE_TESTIMONIAL_QUOTE',avatarUrl:'',visibility:'draft',consent:'pending'},{id:'public-quote',name:'Penguji Lokal',role:'Pengujian',company:'Fixture',quote:'Kutipan pengujian pada database yang terpisah.',avatarUrl:'',visibility:'published',consent:'pending'}];
  assert.equal((await request(base,'/admin/api/content?lang=id',{method:'PUT',headers,body:JSON.stringify(community)})).res.status,422);
  community.testimonials[1].consent='granted';
  assert.equal((await request(base,'/admin/api/content?lang=id',{method:'PUT',headers,body:JSON.stringify(community)})).res.status,200);
  const publicCommunity=await request(base,'/api/public/content?lang=id');
  assert.equal(publicCommunity.data.content.faqs.length,5);assert.equal(publicCommunity.data.content.testimonials.length,1);
  assert.ok(!JSON.stringify(publicCommunity.data).includes('PRIVATE_FAQ_DRAFT'));assert.ok(!JSON.stringify(publicCommunity.data).includes('PRIVATE_TESTIMONIAL_'));
  const communityHTML=await fetch(base+'/?lang=id').then(response=>response.text());
  assert.ok(!communityHTML.includes('PRIVATE_TESTIMONIAL_'));assert.ok(!communityHTML.includes('PRIVATE_FAQ_DRAFT'));
  const communityDOM=cheerio.load(communityHTML);assert.equal(communityDOM('#faq-list details').length,5);assert.equal(communityDOM('#testimonials-grid cite').text(),'Penguji Lokal');assert.ok(communityDOM('#skills-groups .tech-logo[data-brand=mysql]').length>0);
  for(const route of ['/assets/tech/mysql.svg','/js/technology.js','/js/portfolio-sections.js','/css/community.css'])assert.equal((await fetch(base+route)).status,200);
  const settingResult=await request(base,'/admin/api/settings',{headers:{Cookie:sessionCookie}});
  const settings=settingResult.data.settings;
  settings.siteUrl='https://portfolio.example.com';settings.indexing=true;
  settings.seo.id.title='Profil </title><script>alert(1)</script>';
  settings.seo.id.description='Pengaturan SEO dari database untuk website portofolio profesional.';
  settings.appearance.accentDark='#67e8f9';
  assert.equal((await request(base,'/admin/api/settings',{method:'PUT',headers:{Cookie:sessionCookie,'Content-Type':'application/json'},body:JSON.stringify(settings)})).res.status,403);
  assert.equal((await request(base,'/admin/api/settings',{method:'PUT',headers,body:JSON.stringify({...settings,appearance:{...settings.appearance,accentDark:'#0a0e12'}})})).res.status,422);
  assert.equal((await request(base,'/admin/api/settings',{method:'PUT',headers,body:JSON.stringify(settings)})).res.status,200);
  modified.projects[0].visibility='draft';modified.projects[0].title='PRIVATE_DRAFT_NEVER_PUBLIC';
  assert.equal((await request(base,'/admin/api/content?lang=en',{method:'PUT',headers,body:JSON.stringify(modified)})).res.status,200);
  const draftContent=await request(base,'/api/public/content?lang=en');
  assert.equal(draftContent.data.content.projects.length,5);
  assert.ok(!JSON.stringify(draftContent.data).includes('PRIVATE_DRAFT_NEVER_PUBLIC'));
  const html=await fetch(base+'/?lang=id').then(r=>r.text()),$=cheerio.load(html);
  assert.equal($('title').text(),settings.seo.id.title);
  assert.equal($('meta[name=description]').attr('content'),settings.seo.id.description);
  assert.equal($('link[rel=canonical]').attr('href'),'https://portfolio.example.com/?lang=id');
  assert.equal($('link[hreflang=en]').length,1);assert.equal($('script[type="application/ld+json"]').length,1);
  assert.equal($('#service-grid article').length,4);assert.ok($('#about-bio p').length>0);
  assert.equal($('script').filter((_,node)=>$(node).text()==='alert(1)').length,0);
  assert.equal(JSON.parse($('#portfolio-bootstrap').text()).meta.title,settings.seo.id.title);
  assert.ok(!await fetch(base+'/?lang=en').then(r=>r.text()).then(text=>text.includes('PRIVATE_DRAFT_NEVER_PUBLIC')));
  assert.match(await fetch(base+'/theme.css').then(r=>r.text()),/--accent:#67e8f9/);
  assert.match(await fetch(base+'/sitemap.xml').then(r=>r.text()),/https:\/\/portfolio.example.com\/\?lang=en/);
  assert.match(await fetch(base+'/robots.txt').then(r=>r.text()),/Disallow: \/admin/);
  const upload=await request(base,'/admin/api/upload',{method:'POST',headers,body:JSON.stringify({filename:'test.png',mime:'image/png',base64:Buffer.from('not-png').toString('base64')})});
  assert.equal(upload.res.status,422);
  const goodUpload=await request(base,'/admin/api/upload',{method:'POST',headers,body:JSON.stringify({filename:'proof.png',mime:'image/png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGMQMYoCAAD+AKEbpQVkAAAAAElFTkSuQmCC'})});
  assert.equal(goodUpload.res.status,201,JSON.stringify(goodUpload.data));
  assert.ok(goodUpload.data.path.startsWith('assets/uploads/'));
  uploadedPath=path.join(ROOT,'public',goodUpload.data.path);
  const uploadedResponse=await fetch(base+'/'+goodUpload.data.path);
  assert.equal(uploadedResponse.status,200);
  assert.match(uploadedResponse.headers.get('content-type'),/image\/png/);
  const media=await request(base,'/admin/api/media',{headers:{Cookie:sessionCookie}});
  assert.equal(media.data.files.length,1);
  assert.equal(media.data.files[0].filename,goodUpload.data.filename);
  const contact=await request(base,'/api/public/contact',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({name:'Example User',email:'test@example.com',topic:'Web Development',message:'Saya ingin membangun sebuah aplikasi portofolio baru untuk usaha saya.',locale:'id',website:''})});
  assert.equal(contact.res.status,201);
  await stopServer();
  await launchServer();
  assert.equal((await request(base,'/admin/api/settings',{headers:{Cookie:sessionCookie}})).data.settings.seo.id.title,settings.seo.id.title);
  assert.equal((await request(base,'/admin/api/session',{headers:{Cookie:sessionCookie}})).data.authenticated,true);
  assert.equal((await request(base,'/api/public/content?lang=en')).data.content.heroDescription,modified.heroDescription);
  assert.equal((await request(base,'/admin/api/media',{headers:{Cookie:sessionCookie}})).data.files.length,1);
  const messages=await request(base,'/admin/api/messages',{headers:{Cookie:sessionCookie}});
  assert.equal(messages.data.messages.length,1);
  assert.equal(messages.data.unread,1);
  const messageId=messages.data.messages[0].id;
  const marked=await request(base,`/admin/api/messages/${messageId}`,{method:'PATCH',headers,body:JSON.stringify({status:'read'})});
  assert.equal(marked.res.status,200);
  const after=await request(base,'/admin/api/messages',{headers:{Cookie:sessionCookie}});
  assert.equal(after.data.unread,0);
  const deleted=await request(base,`/admin/api/messages/${messageId}`,{method:'DELETE',headers});
  assert.equal(deleted.res.status,200);
  assert.equal((await request(base,'/admin/api/messages',{headers:{Cookie:sessionCookie}})).data.messages.length,0);
  for(const privatePath of ['/.env','/server/schema.sql','/storage/AKSES_LOKAL.txt']){
   assert.equal((await request(base,privatePath)).res.status,404);
  }
  assert.equal((await fetch(base+'/admin')).status,200);
  assert.match((await fetch(base+'/admin')).headers.get('x-robots-tag'),/noindex/);
  assert.equal((await fetch(base+'/admin/settings.js')).status,200);
  assert.equal((await fetch(base+'/admin/settings.css')).status,200);
  const head=await fetch(base+'/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal((await fetch(base+'/js/app.js')).status,200);
  const logout=await request(base,'/admin/api/logout',{method:'POST',headers,body:'{}'});
  assert.equal(logout.res.status,200);
  assert.equal((await request(base,'/admin/api/content',{headers:{Cookie:sessionCookie}})).res.status,401);
  async function login(password){
   const token=await request(base,'/admin/api/login-csrf');
   const response=await request(base,'/admin/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,'x-csrf-token':token.data.csrf,Cookie:cookieFrom(token.res,'nt_login_csrf')},body:JSON.stringify({email:'owner@example.com',password})});
   return {...response,cookie:response.res.ok?cookieFrom(response.res,'nt_session'):''};
  }
  const first=await login(env.ADMIN_PASSWORD),other=await login(env.ADMIN_PASSWORD);
  const secureHeaders={Cookie:first.cookie,Origin:base,'x-csrf-token':first.data.csrf,'Content-Type':'application/json'};
  const security=await request(base,'/admin/api/security',{headers:{Cookie:first.cookie}});
  assert.equal(security.data.sessions.length,2);assert.ok(!JSON.stringify(security.data.sessions).includes('token_hash'));
  assert.equal((await request(base,'/admin/api/sessions/revoke-others',{method:'POST',headers:secureHeaders})).res.status,200);
  assert.equal((await request(base,'/admin/api/content',{headers:{Cookie:other.cookie}})).res.status,401);
  assert.equal((await request(base,'/admin/api/password',{method:'POST',headers:secureHeaders,body:JSON.stringify({currentPassword:'wrong',newPassword:'Another-unique-password-for-testing!'})})).res.status,403);
  const newPassword='Another-unique-password-for-testing!';
  assert.equal((await request(base,'/admin/api/password',{method:'POST',headers:secureHeaders,body:JSON.stringify({currentPassword:env.ADMIN_PASSWORD,newPassword})})).res.status,200);
  assert.equal((await request(base,'/admin/api/content',{headers:{Cookie:first.cookie}})).res.status,401);
  assert.equal((await login(env.ADMIN_PASSWORD)).res.status,401);
  const changed=await login(newPassword);assert.equal(changed.res.status,200);
  await connection.execute(`UPDATE \`${database}\`.sessions SET last_seen_at=?`,[Date.now()-31*60000]);
  assert.equal((await request(base,'/admin/api/content',{headers:{Cookie:changed.cookie}})).res.status,401);
  const rate=await request(base,'/admin/api/login-csrf');
  for(let attempt=0;attempt<9;attempt++){
   if(attempt===8){await stopServer();await launchServer()}
   const result=await request(base,'/admin/api/login',{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':rate.data.csrf,
    Origin:base,Cookie:cookieFrom(rate.res,'nt_login_csrf')},body:JSON.stringify({email:'blocked@example.com',password:'wrong'})});
   assert.equal(result.res.status,attempt<8?401:429);
   if(attempt===8)assert.ok(Number(result.res.headers.get('retry-after'))>0);
  }
  const message={name:'Local Test',email:'test@example.com',topic:'Web Development',message:'Pesan pengujian batas pengiriman lokal.'};
  for(let i=0;i<7;i++)assert.equal((await request(base,'/api/public/contact',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(message)})).res.status,201);
  await stopServer();await launchServer();
  const limited=await request(base,'/api/public/contact',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,'X-Forwarded-For':'203.0.113.10'},body:JSON.stringify(message)});
  assert.equal(limited.res.status,429);
 }finally{
  await stopServer();
  if(uploadedPath)try{unlinkSync(uploadedPath)}catch{}
  try{await connection.query(`DROP DATABASE IF EXISTS \`${database}\``)}finally{await connection.end()}
 }
});
