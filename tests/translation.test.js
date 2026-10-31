'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const net=require('node:net');
const {spawn,execFile:execFileCallback}=require('node:child_process');
const {promisify}=require('node:util');
const {once}=require('node:events');
const {randomBytes}=require('node:crypto');
const mysql=require('mysql2/promise');
const {ROOT,databaseConfig}=require('../server/config');
const {buildPlan,providerConfig,translateTexts,translationVersion}=require('../server/translation');
const {startTranslatorFixture}=require('./helpers/translation-fixture.cjs');
const execFile=promisify(execFileCallback),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('Translation plan excludes identities, links, technical identifiers, and publication status',()=>{
 const source=structuredClone(require('../data/seed/id.json'));
 const plan=buildPlan(source,{title:'Judul',description:'Deskripsi',image:'assets/test.png',imageAlt:'Foto'});
 assert.deepEqual(plan.candidate.content,source);
 for(const protectedField of ['fullName','email','initials','brand','location','avatarUrl','cvUrl'])assert.ok(!plan.entries.some(entry=>entry.path.includes(protectedField)));
 for(const protectedField of ['visibility','id','github','link','url','number','year','issuer','tags','items','image','icon','tone','art','category'])assert.ok(!plan.entries.some(entry=>entry.path.includes(protectedField)));
 assert.ok(plan.entries.some(entry=>entry.path.join('.')==='content.projects.0.role'));
 assert.ok(plan.entries.some(entry=>entry.path.join('.')==='seo.title'));
 assert.equal(translationVersion({b:2,a:1},{},null,null),translationVersion({a:1,b:2},{},null,null));
});
test('Provider configuration requires explicit setup and never accepts insecure remote LibreTranslate',()=>{
 assert.equal(providerConfig({}).configured,false);
 assert.equal(providerConfig({TRANSLATION_PROVIDER:'google'}).configured,false);
 assert.equal(providerConfig({TRANSLATION_PROVIDER:'google',GOOGLE_TRANSLATE_API_KEY:'private-key'}).configured,true);
 for(const url of ['http://external.example','https://user:pass@example.com','https://example.com/?key=private','https://example.com/admin'])assert.equal(providerConfig({TRANSLATION_PROVIDER:'libretranslate',LIBRETRANSLATE_URL:url}).configured,false);
 assert.equal(providerConfig({TRANSLATION_PROVIDER:'libretranslate',LIBRETRANSLATE_URL:'http://127.0.0.1:5000'}).configured,true);
});
test('Google adapter batches safely and sends its key only in the request header',async()=>{
 let calls=0;
 const values=Array.from({length:101},(_,index)=>`Text ${index}`);
 const result=await translateTexts(values,'id','en',{config:{configured:true,provider:'google',url:'https://translation.googleapis.com/language/translate/v2',key:'private-key'},fetch:async(url,options)=>{
  calls++;assert.ok(!url.includes('private-key'));assert.equal(options.headers['X-Goog-Api-Key'],'private-key');assert.equal(options.redirect,'error');
  const body=JSON.parse(options.body);assert.ok(body.q.length<=50);assert.equal(body.source,'id');assert.equal(body.target,'en');assert.equal(body.format,'text');
  return new Response(JSON.stringify({data:{translations:body.q.map(text=>({translatedText:`${text} &amp; result`}))}}));
 }});
 assert.equal(calls,3);assert.equal(result.length,101);assert.equal(result[0],'Text 0 & result');
});
test('Missing configuration, invalid language pairs, provider failures and malformed responses are explicit',async()=>{
 await assert.rejects(translateTexts(['Text'],'id','en',{config:{configured:false}}),error=>error.status===503);
 await assert.rejects(translateTexts(['Text'],'id','id'),error=>error.status===422);
 const config={configured:true,provider:'libretranslate',url:'http://127.0.0.1:5000/translate',key:'private-secret'};
 await assert.rejects(translateTexts(['Text'],'id','en',{config,fetch:async()=>new Response('private-secret',{status:403})}),error=>error.status===502&&!error.message.includes('private-secret'));
 await assert.rejects(translateTexts(['Text'],'id','en',{config,fetch:async()=>new Response(JSON.stringify({translatedText:[]}))}),error=>error.status===502);
 await assert.rejects(translateTexts(['Text'],'id','en',{config,fetch:async()=>{throw new Error('http://private-secret')}}),error=>error.status===502&&!error.message.includes('private-secret'));
 await assert.rejects(translateTexts(['x'.repeat(60001)],'id','en',{config}),error=>error.status===422);
});
test('MySQL translation preview/apply uses a mock service, preserves originals, and rejects stale previews',async()=>{
 const fixture=await startTranslatorFixture(),database='portfolio_cms_test_'+randomBytes(8).toString('hex');
 const {database:unused,...connectionOptions}=databaseConfig;
 const credentials={user:process.env.TEST_DB_USER??databaseConfig.user,password:process.env.TEST_DB_PASSWORD??databaseConfig.password};
 const connection=await mysql.createConnection({...connectionOptions,...credentials});
 const port=await new Promise(resolve=>{const server=net.createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port))})});
 const base=`http://127.0.0.1:${port}`,env={...process.env,DB_NAME:database,DB_USER:credentials.user,DB_PASSWORD:credentials.password,HOST:'127.0.0.1',PORT:String(port),APP_ORIGIN:base,NODE_ENV:'development',ADMIN_PASSWORD:'Translation-test-long-password!',TRANSLATION_PROVIDER:'libretranslate',LIBRETRANSLATE_URL:fixture.origin,LIBRETRANSLATE_API_KEY:'fixture-private-key'};
 let server;
 async function request(url,options={}){const response=await fetch(base+url,options);return {status:response.status,data:await response.json(),response}}
 async function stored(locale){const [[row]]=await connection.execute(`SELECT payload FROM \`${database}\`.content WHERE locale=?`,[locale]);return JSON.parse(row.payload)}
 async function settings(){const [[row]]=await connection.execute(`SELECT payload FROM \`${database}\`.site_settings WHERE id=1`);return JSON.parse(row.payload)}
 try{
  await execFile(process.execPath,['scripts/setup-db.js'],{cwd:ROOT,env});
  await execFile(process.execPath,['scripts/create-admin.js','--email','translate@example.com'],{cwd:ROOT,env});
  const source=await stored('id');source.fullName='Private Identity Keep';source.email='private-identity@example.test';source.certifications[0].number='KEEP-NUMBER-321';
  source.testimonials=[{id:'quote-fixture',name:'Private Quote Author',role:'Collaborator',company:'Private Organization',quote:'A quote used only for translation testing.',avatarUrl:'',visibility:'draft',consent:'pending'}];
  await connection.execute(`UPDATE \`${database}\`.content SET payload=? WHERE locale='id'`,[JSON.stringify(source)]);
  const initialSettings=await settings();initialSettings.seo.id={title:'Judul sumber',description:'Deskripsi sumber.',image:'',imageAlt:'Foto profil'};
  await connection.execute(`UPDATE \`${database}\`.site_settings SET payload=? WHERE id=1`,[JSON.stringify(initialSettings)]);
  const originalTarget=await stored('en');
  server=spawn(process.execPath,['server/index.js'],{cwd:ROOT,env,stdio:'pipe'});let errors='';server.stderr.on('data',chunk=>errors+=chunk);
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok){ready=true;break}}catch{}await pause(70)}assert.ok(ready,errors);
  assert.equal((await request('/admin/api/translation/status')).status,401);
  const token=await request('/admin/api/login-csrf');
  const login=await request('/admin/api/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,'X-CSRF-Token':token.data.csrf,Cookie:token.response.headers.getSetCookie()[0].split(';')[0]},body:JSON.stringify({email:'translate@example.com',password:env.ADMIN_PASSWORD})});
  assert.equal(login.status,200);
  const cookie=login.response.headers.getSetCookie().find(value=>value.startsWith('nt_session=')).split(';')[0];
  const headers={'Content-Type':'application/json',Origin:base,Cookie:cookie,'X-CSRF-Token':login.data.csrf};
  const status=await request('/admin/api/translation/status',{headers});assert.equal(status.data.configured,true);assert.ok(!JSON.stringify(status.data).includes('fixture-private-key'));
  assert.equal((await request('/admin/api/translation/preview',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({source:'id',target:'en',includeSeo:true})})).status,403);
  assert.equal((await request('/admin/api/translation/preview',{method:'POST',headers,body:JSON.stringify({source:'fr',target:'en',includeSeo:true})})).status,422);
  assert.equal((await request('/admin/api/translation/preview',{method:'POST',headers,body:JSON.stringify({source:'id',target:'en',includeSeo:true,endpoint:'https://attacker.example'})})).status,422);
  const preview=await request('/admin/api/translation/preview',{method:'POST',headers,body:JSON.stringify({source:'id',target:'en',includeSeo:true})});assert.equal(preview.status,200,JSON.stringify(preview.data));
  assert.deepEqual(await stored('en'),originalTarget);assert.deepEqual(await stored('id'),source);
  assert.equal(preview.data.content.fullName,source.fullName);assert.equal(preview.data.content.email,source.email);assert.equal(preview.data.content.certifications[0].number,source.certifications[0].number);
  assert.ok(preview.data.content.heroDescription.startsWith('[EN] '));assert.ok(preview.data.seo.title.startsWith('[EN] '));
  assert.ok(preview.data.content.faqs[0].answer.startsWith('[EN] '));assert.ok(preview.data.content.testimonials[0].quote.startsWith('[EN] '));assert.equal(preview.data.content.testimonials[0].name,'Private Quote Author');
  const submitted=fixture.state.requests.flatMap(request=>request.q);assert.ok(!submitted.includes(source.fullName));assert.ok(!submitted.includes(source.email));assert.ok(!submitted.includes(source.certifications[0].number));
  const apply={source:'id',target:'en',includeSeo:true,baseVersion:preview.data.baseVersion,content:preview.data.content,seo:preview.data.seo};
  const protectedChange=structuredClone(apply);protectedChange.content.email='changed@example.test';
  assert.equal((await request('/admin/api/translation/apply',{method:'POST',headers,body:JSON.stringify(protectedChange)})).status,422);
  const changedShape=structuredClone(apply);changedShape.content.bio=[];
  assert.equal((await request('/admin/api/translation/apply',{method:'POST',headers,body:JSON.stringify(changedShape)})).status,422);
  const concurrentSettings=await settings();concurrentSettings.appearance.font='serif';
  await connection.execute(`UPDATE \`${database}\`.site_settings SET payload=? WHERE id=1`,[JSON.stringify(concurrentSettings)]);
  apply.content.heroDescription='Reviewed translation entered manually.';
  assert.equal((await request('/admin/api/translation/apply',{method:'POST',headers,body:JSON.stringify(apply)})).status,200);
  assert.equal((await stored('en')).heroDescription,apply.content.heroDescription);assert.deepEqual(await stored('id'),source);assert.equal((await settings()).appearance.font,'serif');
  assert.equal((await settings()).seo.en.title,apply.seo.title);
  const second=await request('/admin/api/translation/preview',{method:'POST',headers,body:JSON.stringify({source:'id',target:'en',includeSeo:false})});
  const changedSource=structuredClone(source);changedSource.heroDescription+=' Changed after preview.';
  await connection.execute(`UPDATE \`${database}\`.content SET payload=? WHERE locale='id'`,[JSON.stringify(changedSource)]);
  const stale={source:'id',target:'en',includeSeo:false,baseVersion:second.data.baseVersion,content:second.data.content,seo:null};
  assert.equal((await request('/admin/api/translation/apply',{method:'POST',headers,body:JSON.stringify(stale)})).status,409);
  fixture.state.fail=true;
  assert.equal((await request('/admin/api/translation/preview',{method:'POST',headers,body:JSON.stringify({source:'en',target:'id',includeSeo:false})})).status,502);
  assert.deepEqual(await stored('id'),changedSource);
  fixture.state.fail=false;
  const reverse=await request('/admin/api/translation/preview',{method:'POST',headers,body:JSON.stringify({source:'en',target:'id',includeSeo:false})});assert.equal(reverse.status,200);assert.ok(reverse.data.content.heroDescription.startsWith('[ID] '));
 }finally{
  if(server&&server.exitCode===null&&server.signalCode===null){const exited=once(server,'exit');server.kill('SIGTERM');await exited}
  try{await connection.query(`DROP DATABASE IF EXISTS \`${database}\``)}finally{await connection.end();await fixture.close()}
 }
});
