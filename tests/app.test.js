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
const {databaseConfig}=require('../server/config');
const path=require('node:path');
const net=require('node:net');
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
 const env={...process.env,PORT:String(port),HOST:'127.0.0.1',NODE_ENV:'development',APP_ORIGIN:base,
  DB_NAME:database,DB_USER:credentials.user,DB_PASSWORD:credentials.password,ADMIN_PASSWORD:'S3cure-Test-Admin-Password!'};
 let uploadedPath=null,server=null;
 try{
  await execFile(process.execPath,['scripts/setup-db.js'],{cwd:ROOT,env});
  await execFile(process.execPath,['scripts/create-admin.js','--email','owner@example.com'],{cwd:ROOT,env});
  await assert.rejects(execFile(process.execPath,['scripts/create-admin.js','--email','owner@example.com'],{cwd:ROOT,env}),/Admin already exists/);
  server=spawn(process.execPath,['server/index.js'],{cwd:ROOT,env,stdio:'pipe'});
  let errors='';server.stderr.on('data',c=>{errors+=c});
  let ready=false;
  for(let i=0;i<70;i++){
   try{const r=await fetch(base+'/health');if(r.ok){ready=true;break}}catch{}
   await pause(70);
  }
  assert.ok(ready,'Server was not started: '+errors);
  assert.equal((await request(base,'/health')).data.database,'mysql');
  const id=await request(base,'/api/public/content?lang=id');
  const en=await request(base,'/api/public/content?lang=en');
  assert.equal(id.res.status,200);
  assert.match(id.data.content.heroHeading[0],/Saya membangun/);
  assert.equal(id.data.content.fullName,'Nama Lengkap Anda');
  assert.ok(id.data.content.projects.every(p=>p.visibility==='demo'));
  assert.match(en.data.content.heroHeading[0],/I build/);
  assert.equal(en.data.content.fullName,'Your Full Name');
  assert.equal(id.data.content.projects.length,6);
  assert.equal((await request(base,'/admin/api/content')).res.status,401);
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
  const saved=await request(base,'/admin/api/content?lang=en',{method:'PUT',headers,body:JSON.stringify(modified)});
  assert.equal(saved.res.status,200,JSON.stringify(saved.data));
  const updated=await request(base,'/api/public/content?lang=en');
  assert.equal(updated.data.content.heroDescription,'Dynamic bilingual MySQL content 🚀');
  assert.equal((await request(base,'/api/public/content?lang=id')).data.content.heroDescription,id.data.content.heroDescription);
  await execFile(process.execPath,['scripts/setup-db.js'],{cwd:ROOT,env});
  assert.equal((await request(base,'/api/public/content?lang=en')).data.content.heroDescription,modified.heroDescription);
  const [[audit]]=await connection.execute(`SELECT COUNT(*) AS count FROM \`${database}\`.audit_log WHERE operation='content.update'`);
  assert.equal(audit.count,1);
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
  assert.equal((await fetch(base+'/js/app.js')).status,200);
  const logout=await request(base,'/admin/api/logout',{method:'POST',headers,body:'{}'});
  assert.equal(logout.res.status,200);
  assert.equal((await request(base,'/admin/api/content',{headers:{Cookie:sessionCookie}})).res.status,401);
  const rate=await request(base,'/admin/api/login-csrf');
  for(let attempt=0;attempt<9;attempt++){
   const result=await request(base,'/admin/api/login',{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':rate.data.csrf,
    Origin:base,Cookie:cookieFrom(rate.res,'nt_login_csrf')},body:JSON.stringify({email:'blocked@example.com',password:'wrong'})});
   assert.equal(result.res.status,attempt<8?401:429);
  }
 }finally{
  if(server && server.exitCode===null){const exited=once(server,'exit');server.kill('SIGTERM');await exited}
  if(uploadedPath)try{unlinkSync(uploadedPath)}catch{}
  try{await connection.query(`DROP DATABASE IF EXISTS \`${database}\``)}finally{await connection.end()}
 }
});
