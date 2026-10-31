'use strict';
/** Local CMS; production requires an HTTPS reverse proxy and APP_ORIGIN. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {ROOT,UPLOAD_DIR,db,query,initializeDatabase,sha256,hashPassword,verifyPassword,getContent,getPublicContent,getSettings,writeSettings,writeContent,getAdminByEmail,getSession,createSession,endSession,audit} = require('./db');
const {databaseError} = require('./config');
const {validateContent,validateMessage}=require('./validate');
const {validateSettings,themeCSS}=require('./settings');
const {validatePassword}=require('./passwords');
const {secureEqual,clientIP,rateLimit,validHost,validateProduction}=require('./security');
const {sanitizeUpload}=require('./uploads');
const {renderPage,robots,sitemap}=require('./render');
const {translationStatus,previewTranslation,applyTranslation}=require('./translation');
const mfa=require('./mfa');
const {connectionStatus,extractVerificationToken}=require('./search-console');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const PRODUCTION = process.env.NODE_ENV === 'production';
const SESSION_COOKIE = PRODUCTION ? '__Host-nt_session' : 'nt_session';
const LOGIN_CSRF_COOKIE = PRODUCTION ? '__Host-nt_login_csrf' : 'nt_login_csrf';
const MFA_COOKIE=PRODUCTION?'__Host-nt_mfa':'nt_mfa';
const PUBLIC=path.join(ROOT,'public');
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.pdf':'application/pdf','.woff':'font/woff','.woff2':'font/woff2'};

function sendJSON(res,status,payload,headers={}){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});
 res.end(JSON.stringify(payload));
}
function cookies(req){
 const result={};
 for(const chunk of String(req.headers.cookie||'').split(';')){
  const i=chunk.indexOf('=');if(i<0)continue;
  const key=chunk.slice(0,i).trim(),value=chunk.slice(i+1).trim();
  if(key && !Object.hasOwn(result,key))result[key]=value;
 }
 return result;
}
function cookieLine(name,value,maxAge){
 return `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; ${PRODUCTION?'Secure; ':''}${Number.isInteger(maxAge)?`Max-Age=${maxAge}; `:''}`;
}
function sameOrigin(req){
 if(req.headers['sec-fetch-site']==='cross-site')return false;
 const origin=req.headers.origin;
 if(!origin)return true; // CSRF token is mandatory for all state-changing admin APIs.
 const expected=process.env.APP_ORIGIN || `${PRODUCTION?'https':'http'}://${req.headers.host}`;
 try{return new URL(origin).origin === new URL(expected).origin}catch{return false}
}
async function readJSON(req,limit=80_000){
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')){const error=new Error('Content-Type harus application/json.');error.status=415;throw error}
 if(Number(req.headers['content-length'])>limit){const error=new Error('Payload too large');error.status=413;throw error}
 let size=0;const chunks=[];
 for await (const chunk of req){ size+=chunk.length;if(size>limit){const error=new Error('Payload too large');error.status=413;throw error;}chunks.push(chunk); }
 try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw new Error();return value}
 catch{const error=new Error('Malformed JSON');error.status=400;throw error}
}
async function withAdmin(req,res,requireCsrf=false){
 const token=cookies(req)[SESSION_COOKIE];
 const s=await getSession(token);
 if(!s){sendJSON(res,401,{error:'Please sign in'});return null}
 if(s.role!=='admin'){sendJSON(res,403,{error:'Administrator access required'});return null}
 if(requireCsrf && (!sameOrigin(req)||!secureEqual(req.headers['x-csrf-token'],s.csrf_token))){sendJSON(res,403,{error:'Invalid CSRF token or origin'});return null}
 return {session:s,token};
}
const securityHeaders={
 'X-Content-Type-Options':'nosniff',
 'X-Frame-Options':'DENY',
 'Referrer-Policy':'strict-origin-when-cross-origin',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Cross-Origin-Resource-Policy':'same-origin',
 'Cross-Origin-Opener-Policy':'same-origin',
 'X-Permitted-Cross-Domain-Policies':'none',
 'Origin-Agent-Cluster':'?1',
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
};
async function handleStatic(req,res,pathname){
 let requested=pathname;
 if(requested==='/')requested='/index.html';
 if(requested==='/admin'||requested==='/admin/')requested='/admin/index.html';
 if(!/^\/(index\.html|admin\/(index\.html|admin\.js|admin\.css|settings\.js|settings\.css|translation\.js|translation\.css|mfa\.js|mfa\.css|search-console\.js)|(?:css|js|assets)\/[\w./-]+)$/.test(requested))return sendJSON(res,404,{error:'Not found'});
 const target=path.resolve(PUBLIC,'.'+requested);
 if(!target.startsWith(PUBLIC+path.sep))return sendJSON(res,404,{error:'Not found'});
 const ext=path.extname(target).toLowerCase();
 if(!MIME[ext])return sendJSON(res,404,{error:'Not found'});
 try{const real=await fs.promises.realpath(target);if(!real.startsWith(PUBLIC+path.sep))return sendJSON(res,404,{error:'Not found'})}
 catch{return sendJSON(res,404,{error:'Not found'})}
 fs.stat(target,(err,stats)=>{
  if(err||!stats.isFile())return sendJSON(res,404,{error:'Not found'});
  const headers={'Content-Type':MIME[ext],'Content-Length':stats.size,'Cache-Control':pathname.startsWith('/admin')?'no-store':ext==='.html'?'no-cache':'public, max-age=300'};
  if(ext==='.pdf'){
   headers['Content-Disposition']='attachment';headers['Content-Security-Policy']="sandbox; default-src 'none'";headers['X-Robots-Tag']='noindex';
  }
  res.writeHead(200,headers);
  if(req.method==='HEAD')return res.end();
  fs.createReadStream(target).on('error',()=>res.destroy()).pipe(res);
 });
}
async function handler(req,res){
 for(const [key,value] of Object.entries(securityHeaders))res.setHeader(key,value);
 const requestId=crypto.randomUUID();res.setHeader('X-Request-ID',requestId);
 if(!validHost(req,PORT))return sendJSON(res,421,{error:'Host tidak diizinkan'});
 if(PRODUCTION){res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains')}
 let url;
 try{url=new URL(req.url,`http://${req.headers.host||'localhost'}`)}catch{return sendJSON(res,400,{error:'Invalid URL'})}
 let pathname=url.pathname;
 if(pathname.includes('..')||pathname.includes('\\'))return sendJSON(res,404,{error:'Not found'});
 if(pathname.startsWith('/admin')||pathname.startsWith('/api/')||pathname==='/health'){
  res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Cache-Control','no-store');
 }
 try{
  const ip=clientIP(req);
  if(pathname.startsWith('/admin/api/')||pathname.startsWith('/api/'))await rateLimit('api',ip,300,60000);
  if(['GET','HEAD'].includes(req.method)&&['/','/index.html','/robots.txt','/sitemap.xml','/theme.css'].includes(pathname)){
   const settings=await getSettings();
   let output,type;
   if(pathname==='/robots.txt'){output=robots(settings);type='text/plain; charset=utf-8'}
   else if(pathname==='/sitemap.xml'){output=sitemap(settings);type='application/xml; charset=utf-8'}
   else if(pathname==='/theme.css'){output=themeCSS(settings);type='text/css; charset=utf-8'}
   else{
    const lang=url.searchParams.get('lang');const locale=['id','en'].includes(lang)?lang:settings.defaultLocale;
    const page=renderPage(settings,await getPublicContent(locale),locale);
    output=page.html;type='text/html; charset=utf-8';res.setHeader('X-Robots-Tag',page.meta.robots);
   }
   res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','Content-Length':Buffer.byteLength(output)});
   return res.end(req.method==='HEAD'?undefined:output);
  }
  if(req.method==='GET'&&pathname==='/health'){
   await query('SELECT 1');
   return sendJSON(res,200,{ok:true,database:'mysql'});
  }
  if(req.method==='GET'&&pathname==='/api/public/content'){
   const locale=url.searchParams.get('lang')==='en'?'en':'id';
   return sendJSON(res,200,{locale,content:await getPublicContent(locale)});
  }
  if(req.method==='POST'&&pathname==='/api/public/contact'){
   if(!sameOrigin(req))return sendJSON(res,403,{error:'Invalid origin'});
   const body=await readJSON(req,12_000);
   if(body.website)return sendJSON(res,200,{ok:true}); // honeypot; do not reveal whether caught
   const error=validateMessage(body);if(error)return sendJSON(res,422,{error});
   await rateLimit('contact-ip',ip,8,3600000);
   await rateLimit('contact-email',body.email.trim().toLowerCase(),8,3600000);
   await query('INSERT INTO messages(name,email,topic,message,locale) VALUES(?,?,?,?,?)',[body.name.trim(),body.email.trim(),body.topic.trim(),body.message.trim(),body.locale==='en'?'en':'id']);
   return sendJSON(res,201,{ok:true});
  }
  if(req.method==='GET'&&pathname==='/admin/api/login-csrf'){
   const token=crypto.randomBytes(24).toString('base64url');
   return sendJSON(res,200,{csrf:token},{'Set-Cookie':cookieLine(LOGIN_CSRF_COOKIE,token,600)});
  }
  if(req.method==='POST'&&pathname==='/admin/api/login'){
   const expected=cookies(req)[LOGIN_CSRF_COOKIE];
   if(!sameOrigin(req)||!secureEqual(req.headers['x-csrf-token'],expected))return sendJSON(res,403,{error:'Invalid sign-in request'});
   const data=await readJSON(req,5_000);
   const email=String(data.email||'').trim().toLowerCase(),pass=String(data.password||'');
   if(email.length>200||pass.length>1000)return sendJSON(res,400,{error:'Invalid credentials'});
   await rateLimit('login-ip',ip,30,15*60000);
   await rateLimit('login-account',email,8,15*60000);
   const user=await getAdminByEmail(email);
   const valid=await verifyPassword(pass,user?.password_hash);
   if(!valid){
    if(user)await audit(user.id,'login.failed');
    return sendJSON(res,401,{error:'Email or password is incorrect'});
   }
   if(user.role!=='admin')return sendJSON(res,403,{error:'Administrator access required'});
   const upgradedHash=user.password_hash.split('$').length===4?await hashPassword(pass):null;
   // Serialize session/challenge creation with password and MFA changes.
   const loginConnection=await db.getConnection();
   try{
    await loginConnection.beginTransaction();
    const [[current]]=await loginConnection.execute('SELECT password_hash,role FROM admins WHERE id=? FOR UPDATE',[user.id]);
    if(!current||current.role!=='admin'||current.password_hash!==user.password_hash){const error=new Error('Akun berubah selama login. Ulangi dengan password saat ini.');error.status=401;throw error}
    if(upgradedHash)await loginConnection.execute('UPDATE admins SET password_hash=? WHERE id=?',[upgradedHash,user.id]);
    const old=cookies(req)[SESSION_COOKIE];if(old)await loginConnection.execute('DELETE FROM sessions WHERE token_hash=?',[sha256(old)]);
    const oldChallenge=cookies(req)[MFA_COOKIE];if(oldChallenge)await loginConnection.execute('DELETE FROM mfa_challenges WHERE token_hash=?',[sha256(oldChallenge)]);
    const [[factor]]=await loginConnection.execute('SELECT enabled FROM admin_mfa WHERE admin_id=?',[user.id]);
    if(factor?.enabled){
     await rateLimit('mfa-create',String(user.id),10,15*60000,loginConnection);
     const challenge=await mfa.createChallenge(user.id,sha256(`${ip}|${String(req.headers['user-agent']||'').slice(0,300)}`),{connection:loginConnection});
     await loginConnection.commit();
     return sendJSON(res,200,{mfaRequired:true,csrf:challenge.csrf},{'Set-Cookie':[cookieLine(SESSION_COOKIE,'',0),cookieLine(LOGIN_CSRF_COOKIE,'',0),cookieLine(MFA_COOKIE,challenge.token,300)]});
    }
    await loginConnection.execute('DELETE FROM rate_limits WHERE lookup_key=?',[sha256(`login-account|${email}`)]);
    const session=await createSession(user.id,{connection:loginConnection});
    await loginConnection.execute('INSERT INTO audit_log(admin_id,operation,detail) VALUES(?,?,?)',[user.id,'login','']);await loginConnection.commit();
    return sendJSON(res,200,{ok:true,csrf:session.csrf,admin:{email:user.email,name:user.name,role:user.role}},{'Set-Cookie':[
     cookieLine(SESSION_COOKIE,session.token,12*3600),cookieLine(LOGIN_CSRF_COOKIE,'',0),cookieLine(MFA_COOKIE,'',0)]});
   }catch(error){await loginConnection.rollback();throw error}finally{loginConnection.release()}
  }
  if(req.method==='POST'&&pathname==='/admin/api/mfa/verify'){
   if(!sameOrigin(req))return sendJSON(res,403,{error:'Invalid origin'});
   await rateLimit('mfa-ip',ip,20,15*60000);
   const body=await readJSON(req,2000);
   const result=await mfa.completeChallenge(cookies(req)[MFA_COOKIE],req.headers['x-csrf-token'],sha256(`${ip}|${String(req.headers['user-agent']||'').slice(0,300)}`),body.code);
   return sendJSON(res,200,{ok:true,csrf:result.session.csrf,admin:result.admin},{'Set-Cookie':[cookieLine(SESSION_COOKIE,result.session.token,12*3600),cookieLine(MFA_COOKIE,'',0)]});
  }
  if(req.method==='POST'&&pathname==='/admin/api/mfa/cancel-login'){
   if(!sameOrigin(req))return sendJSON(res,403,{error:'Invalid origin'});
   const token=cookies(req)[MFA_COOKIE];
   if(token&&token.length<100){const [challenge]=await query('SELECT csrf_token FROM mfa_challenges WHERE token_hash=?',[sha256(token)]);if(challenge&&!secureEqual(req.headers['x-csrf-token'],challenge.csrf_token))return sendJSON(res,403,{error:'Invalid CSRF token'});await query('DELETE FROM mfa_challenges WHERE token_hash=?',[sha256(token)])}
   return sendJSON(res,200,{ok:true},{'Set-Cookie':cookieLine(MFA_COOKIE,'',0)});
  }
  const mfaAction=pathname.match(/^\/admin\/api\/mfa\/(setup|confirm|disable|recovery-codes|cancel-setup)$/);
  if(req.method==='POST'&&mfaAction){
   const auth=await withAdmin(req,res,true);if(!auth)return;
   await rateLimit('mfa-settings',String(auth.session.admin_id),10,15*60000);
   const body=await readJSON(req,4000),action=mfaAction[1];
   if(action==='setup')return sendJSON(res,200,await mfa.begin(auth.session.admin_id,auth.session.token_hash,body.currentPassword));
   if(action==='cancel-setup'){await query('DELETE FROM mfa_enrollments WHERE admin_id=? AND session_hash=?',[auth.session.admin_id,auth.session.token_hash]);return sendJSON(res,200,{ok:true})}
   const result=action==='confirm'?await mfa.confirm(auth.session.admin_id,auth.session.token_hash,body.currentPassword,body.code):await mfa.change(auth.session.admin_id,body.currentPassword,body.code,action==='disable'?'disable':'recovery');
   return sendJSON(res,200,{ok:true,csrf:result.session.csrf,...(result.recoveryCodes?{recoveryCodes:result.recoveryCodes}:{})},{'Set-Cookie':cookieLine(SESSION_COOKIE,result.session.token,12*3600)});
  }
  if(req.method==='GET'&&pathname==='/admin/api/session'){
   const s=await getSession(cookies(req)[SESSION_COOKIE]);
   return sendJSON(res,200,s?{authenticated:true,csrf:s.csrf,admin:{email:s.email,name:s.name,role:s.role}}:{authenticated:false});
  }
  if(req.method==='POST'&&pathname==='/admin/api/logout'){
   const auth=await withAdmin(req,res,true);if(!auth)return;
   await endSession(auth.token);await audit(auth.session.admin_id,'logout');
   return sendJSON(res,200,{ok:true},{'Set-Cookie':cookieLine(SESSION_COOKIE,'',0)});
  }
  if(req.method==='GET'&&pathname==='/admin/api/settings'){
   const auth=await withAdmin(req,res);if(!auth)return;
   return sendJSON(res,200,{settings:await getSettings()});
  }
  if(req.method==='GET'&&pathname==='/admin/api/search-console'){
   const auth=await withAdmin(req,res);if(!auth)return;
   return sendJSON(res,200,connectionStatus(await getSettings()));
  }
  if(req.method==='POST'&&pathname==='/admin/api/search-console/parse-token'){
   const auth=await withAdmin(req,res,true);if(!auth)return;
   const body=await readJSON(req,2000),token=extractVerificationToken(body.value);
   if(!token)return sendJSON(res,422,{error:'Tempel token atau tag meta google-site-verification yang diberikan Google.'});
   return sendJSON(res,200,{token});
  }
  if(req.method==='GET'&&pathname==='/admin/api/translation/status'){
   const auth=await withAdmin(req,res);if(!auth)return;
   return sendJSON(res,200,translationStatus());
  }
  if(req.method==='POST'&&pathname==='/admin/api/translation/preview'){
   const auth=await withAdmin(req,res,true);if(!auth)return;
   const body=await readJSON(req,2000);
   if(Object.keys(body).some(key=>!['source','target','includeSeo'].includes(key))||typeof body.includeSeo!=='boolean')return sendJSON(res,422,{error:'Format permintaan terjemahan tidak valid.'});
   if(!translationStatus().configured)return sendJSON(res,503,{error:'Layanan terjemahan belum terhubung. Konfigurasikan Google Cloud Translation atau LibreTranslate pada server.'});
   await rateLimit('translation-preview',String(auth.session.admin_id),10,3600000);
   return sendJSON(res,200,await previewTranslation(body.source,body.target,body.includeSeo));
  }
  if(req.method==='POST'&&pathname==='/admin/api/translation/apply'){
   const auth=await withAdmin(req,res,true);if(!auth)return;
   const body=await readJSON(req,500000);
   if(Object.keys(body).some(key=>!['source','target','baseVersion','content','seo','includeSeo'].includes(key)))return sendJSON(res,422,{error:'Format penerapan terjemahan tidak valid.'});
   await applyTranslation(body,auth.session.admin_id);
   return sendJSON(res,200,{ok:true,locale:body.target});
  }
  if(req.method==='PUT'&&pathname==='/admin/api/settings'){
   const auth=await withAdmin(req,res,true);if(!auth)return;
   const settings=await readJSON(req,20000);const error=validateSettings(settings);
   if(error)return sendJSON(res,422,{error});
   await writeSettings(settings,auth.session.admin_id);
   return sendJSON(res,200,{ok:true});
  }
  if(req.method==='GET'&&pathname==='/admin/api/security'){
   const auth=await withAdmin(req,res);if(!auth)return;
   const now=Date.now();
   const sessions=await query('SELECT token_hash,created_at,expires_at,last_seen_at FROM sessions WHERE admin_id=? AND auth_version=? AND expires_at>? AND last_seen_at>? ORDER BY created_at DESC',[auth.session.admin_id,auth.session.auth_version,now,now-30*60000]);
   const logs=await query('SELECT id,operation,detail,created_at FROM audit_log WHERE admin_id=? ORDER BY id DESC LIMIT 100',[auth.session.admin_id]);
   return sendJSON(res,200,{sessions:sessions.map(({token_hash,...session})=>({...session,current:token_hash===auth.session.token_hash})),logs,mfa:await mfa.status(auth.session.admin_id),security:{secureCookies:PRODUCTION,idleMinutes:30,maxSessionHours:12,loginLimit:8,contactLimit:8}});
  }
  if(req.method==='POST'&&pathname==='/admin/api/sessions/revoke-others'){
   const auth=await withAdmin(req,res,true);if(!auth)return;
   await query('DELETE FROM sessions WHERE admin_id=? AND token_hash<>?',[auth.session.admin_id,auth.session.token_hash]);
   await audit(auth.session.admin_id,'sessions.revoke-others');
   return sendJSON(res,200,{ok:true});
  }
  if(req.method==='POST'&&pathname==='/admin/api/password'){
   const auth=await withAdmin(req,res,true);if(!auth)return;
   await rateLimit('password-change',String(auth.session.admin_id),5,15*60000);
   const data=await readJSON(req,4000),error=validatePassword(data.newPassword);
   if(error)return sendJSON(res,422,{error});
   if(typeof data.currentPassword!=='string'||data.currentPassword.length>256)return sendJSON(res,422,{error:'Password saat ini wajib diisi.'});
   const user=await getAdminByEmail(auth.session.email);
   if(!await verifyPassword(data.currentPassword,user.password_hash))return sendJSON(res,403,{error:'Password saat ini tidak sesuai.'});
   if(data.currentPassword===data.newPassword)return sendJSON(res,422,{error:'Password baru harus berbeda dari password saat ini.'});
   const passwordHash=await hashPassword(data.newPassword),connection=await db.getConnection();
   try{
    await connection.beginTransaction();
    const [updated]=await connection.execute('UPDATE admins SET password_hash=? WHERE id=? AND password_hash=?',[passwordHash,user.id,user.password_hash]);
    if(!updated.affectedRows){const error=new Error('Akun sudah berubah. Silakan masuk kembali.');error.status=409;throw error}
    await mfa.verifySensitive(connection,user.id,data.code);
    await connection.execute('UPDATE admin_mfa SET auth_version=auth_version+1 WHERE admin_id=?',[user.id]);
    await connection.execute('DELETE FROM sessions WHERE admin_id=?',[user.id]);
    await connection.execute('DELETE FROM mfa_challenges WHERE admin_id=?',[user.id]);
    await connection.execute('DELETE FROM mfa_enrollments WHERE admin_id=?',[user.id]);
    await connection.execute('INSERT INTO audit_log(admin_id,operation,detail) VALUES(?,?,?)',[user.id,'password.change','Semua sesi dicabut']);
    await connection.commit();
   }catch(error){await connection.rollback();throw error}finally{connection.release()}
   return sendJSON(res,200,{ok:true},{'Set-Cookie':cookieLine(SESSION_COOKIE,'',0)});
  }
  if(req.method==='GET'&&pathname==='/admin/api/content'){
   const auth=await withAdmin(req,res);if(!auth)return;
   const locale=url.searchParams.get('lang')==='en'?'en':'id';
   return sendJSON(res,200,{locale,content:await getContent(locale)});
  }
  if(req.method==='PUT'&&pathname==='/admin/api/content'){
   const auth=await withAdmin(req,res,true);if(!auth)return;
   const locale=url.searchParams.get('lang')==='en'?'en':'id';
   const data=await readJSON(req,400_000);
   const error=validateContent(data);if(error)return sendJSON(res,422,{error});
   await writeContent(locale,data,auth.session.admin_id);
   return sendJSON(res,200,{ok:true,locale});
  }
  if(req.method==='GET'&&pathname==='/admin/api/messages'){
   const auth=await withAdmin(req,res);if(!auth)return;
   const messages=await query('SELECT * FROM messages ORDER BY id DESC LIMIT 250');
   const [{count:unread}]=await query("SELECT count(*) AS count FROM messages WHERE status='unread'");
   return sendJSON(res,200,{messages,unread});
  }
  const msgMatch=pathname.match(/^\/admin\/api\/messages\/(\d+)$/);
  if(msgMatch&&['PATCH','DELETE'].includes(req.method)){
   const auth=await withAdmin(req,res,true);if(!auth)return;
   const id=Number(msgMatch[1]);
   if(req.method==='DELETE'){
    await query('DELETE FROM messages WHERE id=?',[id]);await audit(auth.session.admin_id,'message.delete',String(id));
   }else{
    const data=await readJSON(req,1000);
    if(!['read','unread'].includes(data.status))return sendJSON(res,422,{error:'Invalid message status'});
    await query('UPDATE messages SET status=? WHERE id=?',[data.status,id]);await audit(auth.session.admin_id,'message.status',String(id));
   }
   return sendJSON(res,200,{ok:true});
  }
  if(req.method==='POST'&&pathname==='/admin/api/upload'){
   const auth=await withAdmin(req,res,true);if(!auth)return;
   const body=await readJSON(req,11_000_000);
   await rateLimit('upload',String(auth.session.admin_id),60,3600000);
   const {bytes,extension,type}=await sanitizeUpload(body);
   const filename=crypto.randomUUID()+extension;
   const target=path.join(UPLOAD_DIR,filename);
   const connection=await db.getConnection();
   let written=false;
   try{
    await fs.promises.writeFile(target,bytes,{flag:'wx',mode:0o644});written=true;
    await connection.beginTransaction();
    await connection.execute('INSERT INTO media(filename,original_name,content_type,size_bytes) VALUES(?,?,?,?)',[filename,body.filename,type,bytes.length]);
    await connection.execute('INSERT INTO audit_log(admin_id,operation,detail) VALUES(?,?,?)',[auth.session.admin_id,'media.upload',filename]);
    await connection.commit();
   }catch(error){await connection.rollback();if(written)await fs.promises.unlink(target);throw error}finally{connection.release()}
   return sendJSON(res,201,{ok:true,path:`assets/uploads/${filename}`,filename});
  }
  if(req.method==='GET'&&pathname==='/admin/api/media'){
   const auth=await withAdmin(req,res);if(!auth)return;
   return sendJSON(res,200,{files:await query('SELECT id,filename,original_name,content_type,size_bytes,created_at FROM media ORDER BY id DESC LIMIT 100')});
  }
  if(req.method==='GET'||req.method==='HEAD')return await handleStatic(req,res,pathname);
  return sendJSON(res,404,{error:'Not found'});
 }catch(error){
  const status=error.status||500;
  if(status===500)console.error(`[${new Date().toISOString()}] Request ${requestId}: ${error.code||'SERVER_ERROR'}`);
  if(error.retryAfter)res.setHeader('Retry-After',String(error.retryAfter));
  if(!res.headersSent)sendJSON(res,status,{error:status===500?'Internal server error':error.message});
  else res.end();
 }
}
const server=http.createServer({maxHeaderSize:8192},handler);
async function start(){
 try{
  validateProduction();
  await initializeDatabase();
  await cleanupExpired();
  server.listen(PORT,HOST,()=>console.log(`Personal IT portfolio ready at http://${HOST}:${PORT} (MySQL; admin: /admin)`));
 }catch(error){
  console.error(databaseError(error));
  await db.end();
  process.exitCode=1;
 }
}
async function cleanupExpired(){
 const now=Date.now();
 await query('DELETE FROM rate_limits WHERE expires_at<?',[now]);
 await query('DELETE FROM sessions WHERE expires_at<? OR last_seen_at<?',[now,now-30*60000]);
 await query('DELETE FROM mfa_challenges WHERE expires_at<?',[now]);
 await query('DELETE FROM mfa_enrollments WHERE expires_at<?',[now]);
}
const cleanupTimer=setInterval(()=>cleanupExpired().catch(error=>console.error('Cleanup:',error.code||'DB_ERROR')),5*60000);cleanupTimer.unref();
server.on('error',async error=>{
 console.error(error.code==='EADDRINUSE'?`Port ${PORT} sedang dipakai. Ubah PORT pada .env.`:error.message);
 await db.end();process.exitCode=1;
});
let shuttingDown=false;
function shutdown(){
 if(shuttingDown)return;
 shuttingDown=true;
 clearInterval(cleanupTimer);
 server.close(()=>db.end().catch(error=>{console.error(error.message);process.exitCode=1}));
 const timer=setTimeout(()=>process.exit(1),10000);timer.unref();
 server.closeIdleConnections();
}
process.on('SIGINT',shutdown);
process.on('SIGTERM',shutdown);
if(require.main===module)start();
server.requestTimeout=20_000;
server.headersTimeout=15_000;
server.keepAliveTimeout=5000;
server.maxHeadersCount=50;
server.maxRequestsPerSocket=100;
module.exports={server,start};
