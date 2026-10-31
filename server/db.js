'use strict';
const mysql = require('mysql2/promise');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const {ROOT,databaseConfig} = require('./config');
const {hashPassword,verifyPassword}=require('./passwords');
const {defaults,normalizeSettings}=require('./settings');
const {visibleFAQs,visibleTestimonials}=require('../public/js/portfolio-sections');
const UPLOAD_DIR = path.join(ROOT, 'public', 'assets', 'uploads');
const db = mysql.createPool({...databaseConfig,waitForConnections:true,connectionLimit:5,queueLimit:50});

async function query(sql,params=[]) {
 const [result] = await db.execute(sql,params);
 return result;
}
async function initializeDatabase() {
 fs.mkdirSync(UPLOAD_DIR,{recursive:true});
 const schema = fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8');
 for (const statement of schema.split(';').map(s=>s.trim()).filter(Boolean)) await db.query(statement);
 const columns=await query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sessions' AND COLUMN_NAME='last_seen_at'");
 if(!columns.length){
  await db.query('ALTER TABLE sessions ADD COLUMN last_seen_at BIGINT UNSIGNED NOT NULL DEFAULT 0');
  await query('UPDATE sessions SET last_seen_at=created_at WHERE last_seen_at=0');
 }
 const authColumns=await query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sessions' AND COLUMN_NAME IN ('auth_version','mfa_verified')");
 const present=new Set(authColumns.map(row=>row.COLUMN_NAME));
 if(!present.has('auth_version'))await db.query('ALTER TABLE sessions ADD COLUMN auth_version INT UNSIGNED NOT NULL DEFAULT 0');
 if(!present.has('mfa_verified'))await db.query('ALTER TABLE sessions ADD COLUMN mfa_verified TINYINT UNSIGNED NOT NULL DEFAULT 0');
 await query('INSERT INTO site_settings(id,payload) VALUES(1,?) ON DUPLICATE KEY UPDATE id=site_settings.id',[JSON.stringify(defaults)]);
 for (const locale of ['id','en']) {
  const seed = fs.readFileSync(path.join(ROOT,'data','seed',`${locale}.json`),'utf8');
  await query('INSERT INTO content(locale,payload) VALUES(?,?) ON DUPLICATE KEY UPDATE locale=content.locale',[locale,seed]);
  const initial=JSON.parse(seed);
  for(const field of ['faqs','testimonials']){
   await query(`UPDATE content SET payload=JSON_SET(payload,'$.${field}',JSON_EXTRACT(?,'$')) WHERE locale=? AND JSON_CONTAINS_PATH(payload,'one','$.${field}')=0`,[JSON.stringify(initial[field]),locale]);
  }
 }
}
const sha256=text=>crypto.createHash('sha256').update(text).digest('hex');
async function getContent(locale){
 const [row]=await query('SELECT payload FROM content WHERE locale=?',[locale]);
 return row?JSON.parse(row.payload):null;
}
async function getPublicContent(locale){
 const content=await getContent(locale);
 if(!content)return null;
 return {...content,projects:content.projects.filter(project=>['demo','published'].includes(project.visibility)),faqs:visibleFAQs(content.faqs),testimonials:visibleTestimonials(content.testimonials)};
}
async function getSettings(){
 const [row]=await query('SELECT payload FROM site_settings WHERE id=1');
 return normalizeSettings(row?JSON.parse(row.payload):{});
}
async function writeSettings(settings,adminId){
 const connection=await db.getConnection();
 try{
  await connection.beginTransaction();
  await connection.execute('UPDATE site_settings SET payload=?,updated_at=CURRENT_TIMESTAMP WHERE id=1',[JSON.stringify(settings)]);
  await connection.execute('INSERT INTO audit_log(admin_id,operation,detail) VALUES(?,?,?)',[adminId,'settings.update','SEO / tampilan']);
  await connection.commit();
 }catch(error){await connection.rollback();throw error}finally{connection.release()}
}
async function writeContent(locale,data,adminId){
 const connection=await db.getConnection();
 try{
  await connection.beginTransaction();
  await connection.execute('UPDATE content SET payload=?,updated_at=CURRENT_TIMESTAMP WHERE locale=?',[JSON.stringify(data),locale]);
  await connection.execute('INSERT INTO audit_log(admin_id,operation,detail) VALUES(?,?,?)',[adminId,'content.update',locale]);
  await connection.commit();
 }catch(err){await connection.rollback();throw err}
 finally{connection.release()}
}
async function getAdminByEmail(email){
 const [row]=await query('SELECT * FROM admins WHERE email=?',[email.toLowerCase()]);
 return row;
}
async function getSession(token){
 if(!token||token.length>200)return null;
 const [row]=await query(`SELECT s.*, a.email, a.name, a.role, COALESCE(m.enabled,0) AS mfa_enabled FROM sessions s
 JOIN admins a ON a.id=s.admin_id LEFT JOIN admin_mfa m ON m.admin_id=a.id
 WHERE s.token_hash=? AND s.expires_at>? AND s.last_seen_at>?
 AND s.auth_version=COALESCE(m.auth_version,0) AND (COALESCE(m.enabled,0)=0 OR s.mfa_verified=1)`,[sha256(token),Date.now(),Date.now()-30*60*1000]);
 if(row&&Date.now()-row.last_seen_at>60000)await query('UPDATE sessions SET last_seen_at=? WHERE token_hash=?',[Date.now(),row.token_hash]);
 return row||null;
}
async function createSession(adminId,{mfaVerified=false,connection=db}={}){
 const token=crypto.randomBytes(32).toString('base64url');
 const csrf=crypto.randomBytes(32).toString('base64url');
 const now=Date.now();
 const [[mfa]]=await connection.execute('SELECT enabled,auth_version FROM admin_mfa WHERE admin_id=?',[adminId]);
 if(mfa?.enabled&&!mfaVerified){const error=new Error('Verifikasi MFA diperlukan.');error.status=403;throw error}
 await connection.execute('INSERT INTO sessions(token_hash,admin_id,csrf_token,created_at,expires_at,last_seen_at,auth_version,mfa_verified) VALUES(?,?,?,?,?,?,?,?)',
  [sha256(token),adminId,csrf,now,now+12*3600*1000,now,mfa?.auth_version||0,mfaVerified?1:0]);
 return {token,csrf};
}
async function endSession(token){if(token)await query('DELETE FROM sessions WHERE token_hash=?',[sha256(token)])}
async function audit(adminId,operation,detail=''){
 await query('INSERT INTO audit_log(admin_id,operation,detail) VALUES(?,?,?)',[adminId,operation,String(detail).slice(0,300)]);
}
module.exports={ROOT,UPLOAD_DIR,db,query,initializeDatabase,sha256,hashPassword,verifyPassword,getContent,getPublicContent,getSettings,writeSettings,writeContent,getAdminByEmail,getSession,createSession,endSession,audit};
