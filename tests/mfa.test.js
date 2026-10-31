'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const net=require('node:net');
const {spawn,execFile:execFileCallback}=require('node:child_process');
const {once}=require('node:events');
const execFile=require('node:util').promisify(execFileCallback);
const mysql=require('mysql2/promise');
const OTPAuth=require('otpauth');
const {ROOT,databaseConfig}=require('../server/config');
const {seal,unseal,validStep,recoveryHash}=require('../server/mfa');
const {connectionStatus,extractVerificationToken}=require('../server/search-console');
const token=(secret,offset=0)=>new OTPAuth.TOTP({secret:OTPAuth.Secret.fromBase32(secret),algorithm:'SHA1',digits:6,period:30}).generate({timestamp:Date.now()+offset});
function wrongToken(secret){const valid=new Set([-30000,0,30000].map(offset=>token(secret,offset)));return Array.from({length:10},(_,i)=>String(i).padStart(6,'0')).find(value=>!valid.has(value))}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('TOTP uses the RFC test vector and authenticated encryption rejects tampering',()=>{
 const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
 assert.equal(validStep(secret,'287082',59000),1);assert.equal(validStep(secret,'wrong',59000),null);
 const key=crypto.randomBytes(32),encrypted=seal(secret,key);assert.ok(!encrypted.includes(secret));assert.equal(unseal(encrypted,key),secret);
 assert.throws(()=>unseal(encrypted,crypto.randomBytes(32)),error=>error.status===503);
 const parts=encrypted.split('.');parts[2]=Buffer.alloc(16).toString('base64');assert.throws(()=>unseal(parts.join('.'),key));
 assert.equal(recoveryHash('ABCD-EF01-2345-6789-ABCD-EF01'),recoveryHash('abcdef0123456789abcdef01'));assert.equal(recoveryHash('short'),null);
});
test('Search Console distinguishes local configuration from Google ownership verification',()=>{
 const local=connectionStatus({siteUrl:'',googleVerification:'',indexing:false});assert.equal(local.publicUrlConfigured,false);assert.equal(local.googleVerificationStatus,'not-checked');
 const configured=connectionStatus({siteUrl:'https://portfolio.example.com',googleVerification:'public-token',indexing:true});
 assert.equal(configured.htmlTagInstalled,true);assert.equal(configured.googleVerificationStatus,'not-checked');assert.equal(configured.sitemapUrl,'https://portfolio.example.com/sitemap.xml');assert.equal(configured.domainProperty,'sc-domain:portfolio.example.com');
 assert.equal(connectionStatus({siteUrl:'https://127.0.0.1',googleVerification:'',indexing:false}).publicUrlConfigured,false);
 assert.equal(extractVerificationToken('<meta name="google-site-verification" content="abc_DEF-123" />'),'abc_DEF-123');
 assert.equal(extractVerificationToken('<meta name="google-site-verification" content="abc" onload="alert(1)">'),null);
});
test('MFA enrollment, login, single-use recovery, session revocation and factor changes work transactionally',async()=>{
 const database='portfolio_cms_test_'+crypto.randomBytes(8).toString('hex'),key=crypto.randomBytes(32);
 const {database:unused,...options}=databaseConfig;
 const credentials={user:process.env.TEST_DB_USER??options.user,password:process.env.TEST_DB_PASSWORD??options.password};
 const connection=await mysql.createConnection({...options,...credentials});
 const port=await new Promise(resolve=>{const socket=net.createServer();socket.listen(0,'127.0.0.1',()=>{const port=socket.address().port;socket.close(()=>resolve(port))})});
 const base=`http://127.0.0.1:${port}`,password='MFA-test-unique-long-password!',nextPassword='MFA-next-unique-long-password!';
 const env={...process.env,DB_NAME:database,DB_USER:credentials.user,DB_PASSWORD:credentials.password,HOST:'127.0.0.1',PORT:String(port),APP_ORIGIN:base,NODE_ENV:'development',ADMIN_PASSWORD:password,MFA_ENCRYPTION_KEY:key.toString('base64')};
 let server;
 async function request(url,{body,headers={},method='GET'}={}){const response=await fetch(base+url,{method,signal:AbortSignal.timeout(15000),headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});return {response,status:response.status,data:await response.json()}}
 function cookie(result,name){return result.response.headers.getSetCookie().find(value=>value.startsWith(name+'=')).split(';')[0]}
 function auth(result){return {Cookie:cookie(result,'nt_session'),Origin:base,'X-CSRF-Token':result.data.csrf}}
 async function login(pass=password,email='mfa@example.test'){
  const csrf=await request('/admin/api/login-csrf');return request('/admin/api/login',{method:'POST',headers:{Cookie:cookie(csrf,'nt_login_csrf'),Origin:base,'X-CSRF-Token':csrf.data.csrf},body:{email,password:pass}});
 }
 async function factor(challenge,code,custom={}){return request('/admin/api/mfa/verify',{method:'POST',headers:{Cookie:cookie(challenge,'nt_mfa'),Origin:base,'X-CSRF-Token':challenge.data.csrf,...custom},body:{code}})}
 try{
  await execFile(process.execPath,['scripts/setup-db.js'],{cwd:ROOT,env});await execFile(process.execPath,['scripts/create-admin.js','--email','mfa@example.test'],{cwd:ROOT,env});
  server=spawn(process.execPath,['server/index.js'],{cwd:ROOT,env,stdio:'pipe'});let errors='';server.stderr.on('data',value=>errors+=value);
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base+'/health')).ok){ready=true;break}}catch{}await pause(70)}assert.ok(ready,errors);
  const owner=await login(),other=await login();assert.equal(owner.status,200);let headers=auth(owner);
  assert.equal((await request('/admin/api/mfa/setup',{method:'POST',headers:{Cookie:headers.Cookie},body:{currentPassword:password}})).status,403);
  assert.equal((await request('/admin/api/mfa/setup',{method:'POST',headers,body:{currentPassword:'wrong'}})).status,403);
  const setup=await request('/admin/api/mfa/setup',{method:'POST',headers,body:{currentPassword:password}});assert.equal(setup.status,200);assert.match(setup.data.qr,/^data:image\/png;base64,/);
  const secret=setup.data.secret;
  const [[pending]]=await connection.execute(`SELECT secret_ciphertext FROM \`${database}\`.mfa_enrollments`);assert.ok(!pending.secret_ciphertext.includes(secret));assert.equal(unseal(pending.secret_ciphertext,key),secret);
  assert.equal((await request('/admin/api/security',{headers})).data.mfa.enabled,false);
  assert.equal((await request('/admin/api/mfa/confirm',{method:'POST',headers,body:{currentPassword:password,code:wrongToken(secret)}})).status,403);
  await connection.query(`UPDATE \`${database}\`.mfa_enrollments SET expires_at=1`);
  assert.equal((await request('/admin/api/mfa/confirm',{method:'POST',headers,body:{currentPassword:password,code:token(secret)}})).status,409);
  const fresh=await request('/admin/api/mfa/setup',{method:'POST',headers,body:{currentPassword:password}}),activeSecret=fresh.data.secret;
  const usedEnrollmentCode=token(activeSecret);
  const enabled=await request('/admin/api/mfa/confirm',{method:'POST',headers,body:{currentPassword:password,code:usedEnrollmentCode}});assert.equal(enabled.status,200,JSON.stringify(enabled.data));headers=auth(enabled);
  const codes=enabled.data.recoveryCodes;assert.equal(codes.length,10);assert.equal(new Set(codes).size,10);
  assert.equal((await request('/admin/api/content',{headers:auth(owner)})).status,401);assert.equal((await request('/admin/api/content',{headers:auth(other)})).status,401);
  const security=await request('/admin/api/security',{headers});assert.equal(security.data.mfa.enabled,true);assert.equal(security.data.mfa.recoveryCodesRemaining,10);assert.equal(security.data.sessions.length,1);assert.ok(!JSON.stringify(security.data).includes(activeSecret));assert.ok(!JSON.stringify(security.data).includes(codes[0]));
  const challenge=await login();assert.equal(challenge.data.mfaRequired,true);assert.equal(challenge.data.admin,undefined);
  assert.equal((await request('/admin/api/session',{headers:{Cookie:cookie(challenge,'nt_mfa')}})).data.authenticated,false);
  assert.equal((await request('/admin/api/content',{headers:{Cookie:cookie(challenge,'nt_mfa')}})).status,401);
  assert.equal((await factor(challenge,usedEnrollmentCode)).status,403);
  const totpLogin=await factor(challenge,token(activeSecret,30000));assert.equal(totpLogin.status,200);
  const parallelA=await login(),parallelB=await login();
  const parallel=await Promise.all([factor(parallelA,codes[0]),factor(parallelB,codes[0])]);assert.deepEqual(parallel.map(result=>result.status).sort(),[200,403]);
  const remainingChallenge=parallel[0].status===403?parallelA:parallelB;
  assert.equal((await factor(remainingChallenge,codes[1])).status,200);
  assert.equal((await request('/admin/api/password',{method:'POST',headers,body:{currentPassword:password,newPassword:nextPassword}})).status,403);
  const changedPassword=await request('/admin/api/password',{method:'POST',headers,body:{currentPassword:password,newPassword:nextPassword,code:codes[2]}});assert.equal(changedPassword.status,200);
  assert.equal((await request('/admin/api/content',{headers:auth(totpLogin)})).status,401);
  assert.equal((await login(password)).status,401);
  const afterPassword=await login(nextPassword),recovered=await factor(afterPassword,codes[3]);assert.equal(recovered.status,200);headers=auth(recovered);
  const regenerated=await request('/admin/api/mfa/recovery-codes',{method:'POST',headers,body:{currentPassword:nextPassword,code:codes[4]}});assert.equal(regenerated.status,200);headers=auth(regenerated);
  assert.equal((await request('/admin/api/content',{headers:auth(recovered)})).status,401);
  const afterRegenerate=await login(nextPassword);assert.equal((await factor(afterRegenerate,codes[5])).status,403);
  assert.equal((await factor(afterRegenerate,regenerated.data.recoveryCodes[0])).status,200);
  assert.equal((await request('/admin/api/mfa/disable',{method:'POST',headers,body:{currentPassword:nextPassword,code:'wrong'}})).status,403);
  const disabled=await request('/admin/api/mfa/disable',{method:'POST',headers,body:{currentPassword:nextPassword,code:regenerated.data.recoveryCodes[1]}});assert.equal(disabled.status,200);headers=auth(disabled);
  const off=await request('/admin/api/security',{headers});assert.equal(off.data.mfa.enabled,false);assert.equal(off.data.mfa.recoveryCodesRemaining,0);
  assert.equal((await login(nextPassword)).data.mfaRequired,undefined);
  await execFile(process.execPath,['scripts/create-admin.js','--email','limited@example.test'],{cwd:ROOT,env});
  const secondSecret=new OTPAuth.Secret({size:20}).base32;
  await connection.execute(`INSERT INTO \`${database}\`.admin_mfa(admin_id,enabled,secret_ciphertext) SELECT id,1,? FROM \`${database}\`.admins WHERE email=?`,[seal(secondSecret,key),'limited@example.test']);
  // More simultaneous logins than a single free pool connection: issuance must not deadlock.
  const burst=await Promise.all(Array.from({length:6},()=>login(password,'limited@example.test')));for(const result of burst){assert.equal(result.status,200);assert.equal(result.data.mfaRequired,true)}
  const limited=burst[0];
  for(let i=0;i<5;i++)assert.equal((await factor(limited,wrongToken(secondSecret))).status,403);
  const blocked=await factor(limited,token(secondSecret));assert.equal(blocked.status,429);assert.ok(Number(blocked.response.headers.get('retry-after'))>0);
  await assert.rejects(execFile(process.execPath,['scripts/reset-mfa.js','--email','limited@example.test','--confirm'],{cwd:ROOT,env:{...env,MFA_RESET_PASSWORD:'incorrect-password'}}));
  const [[stillEnabled]]=await connection.query(`SELECT enabled FROM \`${database}\`.admin_mfa m JOIN \`${database}\`.admins a ON a.id=m.admin_id WHERE a.email=?`,['limited@example.test']);assert.equal(stillEnabled.enabled,1);
  await execFile(process.execPath,['scripts/reset-mfa.js','--email','limited@example.test','--confirm'],{cwd:ROOT,env:{...env,MFA_RESET_PASSWORD:password}});
  const [[reset]]=await connection.query(`SELECT enabled,secret_ciphertext FROM \`${database}\`.admin_mfa m JOIN \`${database}\`.admins a ON a.id=m.admin_id WHERE a.email=?`,['limited@example.test']);assert.equal(reset.enabled,0);assert.equal(reset.secret_ciphertext,null);
  assert.equal((await login(password,'limited@example.test')).data.mfaRequired,undefined);
 }finally{
  if(server&&server.exitCode===null&&server.signalCode===null){const exited=once(server,'exit');server.kill('SIGTERM');await exited}
  try{await connection.query(`DROP DATABASE IF EXISTS \`${database}\``)}finally{await connection.end()}
 }
});
