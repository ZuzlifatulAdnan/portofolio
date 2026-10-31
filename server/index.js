'use strict';
/** Local CMS; production requires an HTTPS reverse proxy and APP_ORIGIN. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {ROOT,UPLOAD_DIR,db,query,initializeDatabase,sha256,verifyPassword,getContent,writeContent,getAdminByEmail,getSession,createSession,endSession,audit} = require('./db');
const {databaseError} = require('./config');
const {validateContent,validateMessage}=require('./validate');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const PRODUCTION = process.env.NODE_ENV === 'production';
const SESSION_COOKIE = PRODUCTION ? '__Host-nt_session' : 'nt_session';
const LOGIN_CSRF_COOKIE = PRODUCTION ? '__Host-nt_login_csrf' : 'nt_login_csrf';
const PUBLIC=path.join(ROOT,'public');
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.ico':'image/x-icon','.pdf':'application/pdf','.woff':'font/woff','.woff2':'font/woff2'};
const recentContacts=new Map();

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
function secureEqual(a,b){
 if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length||a.length>300)return false;
 return crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
}
function sameOrigin(req){
 const origin=req.headers.origin;
 if(!origin)return true; // CSRF token is mandatory for all state-changing admin APIs.
 const expected=process.env.APP_ORIGIN || `${PRODUCTION?'https':'http'}://${req.headers.host}`;
 try{return new URL(origin).origin === new URL(expected).origin}catch{return false}
}
async function readJSON(req,limit=80_000){
 let size=0;const chunks=[];
 for await (const chunk of req){ size+=chunk.length;if(size>limit){const error=new Error('Payload too large');error.status=413;throw error;}chunks.push(chunk); }
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}
 catch{const error=new Error('Malformed JSON');error.status=400;throw error}
}
async function withAdmin(req,res,requireCsrf=false){
 const token=cookies(req)[SESSION_COOKIE];
 const s=await getSession(token);
 if(!s){sendJSON(res,401,{error:'Please sign in'});return null}
 if(requireCsrf && (!sameOrigin(req)||!secureEqual(req.headers['x-csrf-token'],s.csrf_token))){sendJSON(res,403,{error:'Invalid CSRF token or origin'});return null}
 return {session:s,token};
}
function detectUpload(buf,mime){
 if(mime==='image/png'&&buf.length>8&&buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return '.png';
 if(mime==='image/jpeg'&&buf.length>4&&buf[0]===255&&buf[1]===216&&buf[buf.length-2]===255&&buf[buf.length-1]===217)return '.jpg';
 if(mime==='image/webp'&&buf.length>12&&buf.toString('ascii',0,4)==='RIFF'&&buf.toString('ascii',8,12)==='WEBP')return '.webp';
 if(mime==='application/pdf'&&buf.length>10&&buf.toString('ascii',0,5)==='%PDF-')return '.pdf';
 return null;
}
const securityHeaders={
 'X-Content-Type-Options':'nosniff',
 'X-Frame-Options':'DENY',
 'Referrer-Policy':'strict-origin-when-cross-origin',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
};
function handleStatic(req,res,pathname){
 let requested=pathname;
 if(requested==='/')requested='/index.html';
 if(requested==='/admin'||requested==='/admin/')requested='/admin/index.html';
 if(!/^\/(index\.html|admin\/(index\.html|admin\.js|admin\.css)|(?:css|js|assets)\/[\w./-]+)$/.test(requested))return sendJSON(res,404,{error:'Not found'});
 const target=path.resolve(PUBLIC,'.'+requested);
 if(!target.startsWith(PUBLIC+path.sep))return sendJSON(res,404,{error:'Not found'});
 const ext=path.extname(target).toLowerCase();
 if(!MIME[ext])return sendJSON(res,404,{error:'Not found'});
 fs.stat(target,(err,stats)=>{
  if(err||!stats.isFile())return sendJSON(res,404,{error:'Not found'});
  const headers={'Content-Type':MIME[ext], 'Cache-Control':ext==='.html'?'no-cache':'public, max-age=300'};
  if(ext==='.pdf')headers['Content-Disposition']='attachment';
  res.writeHead(200,headers);
  fs.createReadStream(target).on('error',()=>res.destroy()).pipe(res);
 });
}
async function handler(req,res){
 for(const [key,value] of Object.entries(securityHeaders))res.setHeader(key,value);
 if(PRODUCTION){res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains')}
 let url;
 try{url=new URL(req.url,`http://${req.headers.host||'localhost'}`)}catch{return sendJSON(res,400,{error:'Invalid URL'})}
 let pathname=url.pathname;
 if(pathname.includes('..')||pathname.includes('\\'))return sendJSON(res,404,{error:'Not found'});
 try{
  if(req.method==='GET'&&pathname==='/health'){
   await query('SELECT 1');
   return sendJSON(res,200,{ok:true,database:'mysql'});
  }
  if(req.method==='GET'&&pathname==='/api/public/content'){
   const locale=url.searchParams.get('lang')==='en'?'en':'id';
   return sendJSON(res,200,{locale,content:await getContent(locale)});
  }
  if(req.method==='POST'&&pathname==='/api/public/contact'){
   if(!sameOrigin(req))return sendJSON(res,403,{error:'Invalid origin'});
   const body=await readJSON(req,12_000);
   if(body.website)return sendJSON(res,200,{ok:true}); // honeypot; do not reveal whether caught
   const error=validateMessage(body);if(error)return sendJSON(res,422,{error});
   const ip=String(req.socket.remoteAddress||'unknown');
   const bucket=recentContacts.get(ip)||{count:0,start:Date.now()};
   if(Date.now()-bucket.start>3600000){bucket.start=Date.now();bucket.count=0}
   if(bucket.count>=8)return sendJSON(res,429,{error:'Too many messages. Try again later.'});
   bucket.count++;recentContacts.set(ip,bucket);
   if(recentContacts.size>5000)recentContacts.clear();
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
   const key=sha256(`${req.socket.remoteAddress}|${email}`), now=Date.now();
   const [attempt]=await query('SELECT * FROM login_attempts WHERE lookup_key=?',[key]);
   if(attempt && attempt.blocked_until>now)return sendJSON(res,429,{error:'Too many attempts. Please try later.'});
   const user=await getAdminByEmail(email);
   const valid=user&&verifyPassword(pass,user.password_hash);
   if(!valid){
    const tries=attempt&&now-attempt.first_at<15*60*1000?attempt.tries+1:1;
    const first=attempt&&now-attempt.first_at<15*60*1000?attempt.first_at:now;
    const blocked=tries>=8?now+15*60*1000:0;
    await query('INSERT INTO login_attempts(lookup_key,tries,first_at,blocked_until) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE tries=?,first_at=?,blocked_until=?',[key,tries,first,blocked,tries,first,blocked]);
    return sendJSON(res,401,{error:'Email or password is incorrect'});
   }
   await query('DELETE FROM login_attempts WHERE lookup_key=?',[key]);
   const old=cookies(req)[SESSION_COOKIE];if(old)await endSession(old);
   const session=await createSession(user.id);await audit(user.id,'login');
   return sendJSON(res,200,{ok:true,csrf:session.csrf,admin:{email:user.email,name:user.name,role:user.role}},{'Set-Cookie':[
    cookieLine(SESSION_COOKIE,session.token,12*3600),cookieLine(LOGIN_CSRF_COOKIE,'',0)]});
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
   const name=String(body.filename||'');const type=String(body.mime||'');const base64=String(body.base64||'');
   if(!name||name.length>255||base64.length>10_000_000||!/^[-A-Za-z0-9+/=]+$/.test(base64))return sendJSON(res,422,{error:'Invalid file'});
   const bytes=Buffer.from(base64,'base64');
   if(bytes.length===0||bytes.length>7_000_000)return sendJSON(res,413,{error:'File exceeds 7MB limit'});
   const extension=detectUpload(bytes,type);
   if(!extension)return sendJSON(res,422,{error:'Only valid JPG, PNG, WebP or PDF files are allowed'});
   if(extension!=='.pdf'&&bytes.length>5_000_000)return sendJSON(res,413,{error:'Images must be under 5MB'});
   const filename=crypto.randomUUID()+extension;
   fs.writeFileSync(path.join(UPLOAD_DIR,filename),bytes,{flag:'wx',mode:0o644});
   const original=name.replace(/[\r\n]/g,' ').slice(0,255);
   await query('INSERT INTO media(filename,original_name,content_type,size_bytes) VALUES(?,?,?,?)',[filename,original,type,bytes.length]);
   await audit(auth.session.admin_id,'media.upload',filename);
   return sendJSON(res,201,{ok:true,path:`assets/uploads/${filename}`,filename});
  }
  if(req.method==='GET'&&pathname==='/admin/api/media'){
   const auth=await withAdmin(req,res);if(!auth)return;
   return sendJSON(res,200,{files:await query('SELECT id,filename,original_name,content_type,size_bytes,created_at FROM media ORDER BY id DESC LIMIT 100')});
  }
  if(req.method==='GET'||req.method==='HEAD')return handleStatic(req,res,pathname);
  return sendJSON(res,404,{error:'Not found'});
 }catch(error){
  const status=error.status||500;
  if(status===500)console.error(`[${new Date().toISOString()}] Server error`,error);
  if(!res.headersSent)sendJSON(res,status,{error:status===500?'Internal server error':error.message});
  else res.end();
 }
}
const server=http.createServer(handler);
async function start(){
 try{
  await initializeDatabase();
  server.listen(PORT,HOST,()=>console.log(`Personal IT portfolio ready at http://${HOST}:${PORT} (MySQL; admin: /admin)`));
 }catch(error){
  console.error(databaseError(error));
  await db.end();
  process.exitCode=1;
 }
}
server.on('error',async error=>{
 console.error(error.code==='EADDRINUSE'?`Port ${PORT} sedang dipakai. Ubah PORT pada .env.`:error.message);
 await db.end();process.exitCode=1;
});
let shuttingDown=false;
function shutdown(){
 if(shuttingDown)return;
 shuttingDown=true;
 server.close(()=>db.end().catch(error=>{console.error(error.message);process.exitCode=1}));
 const timer=setTimeout(()=>process.exit(1),10000);timer.unref();
 server.closeIdleConnections();
}
process.on('SIGINT',shutdown);
process.on('SIGTERM',shutdown);
if(require.main===module)start();
server.requestTimeout=20_000;
server.headersTimeout=15_000;
module.exports={server,start};
