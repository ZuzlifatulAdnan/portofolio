'use strict';
const mysql = require('mysql2/promise');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const {ROOT,databaseConfig} = require('./config');
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
 for (const locale of ['id','en']) {
  const seed = fs.readFileSync(path.join(ROOT,'data','seed',`${locale}.json`),'utf8');
  await query('INSERT INTO content(locale,payload) VALUES(?,?) ON DUPLICATE KEY UPDATE locale=content.locale',[locale,seed]);
 }
}
const sha256=text=>crypto.createHash('sha256').update(text).digest('hex');
const hashPassword=(password)=>{
 const salt=crypto.randomBytes(16).toString('hex');
 const hash=crypto.scryptSync(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('hex');
 return `scrypt$16384$${salt}$${hash}`;
};
const verifyPassword=(password, stored)=>{
 try{
  const [algo,n,salt,hash]=stored.split('$');
  if(algo!=='scrypt'||Number(n)!==16384||!/^[a-f\d]{32}$/.test(salt)||!/^[a-f\d]{128}$/.test(hash))return false;
  const calculated=crypto.scryptSync(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024});
  return crypto.timingSafeEqual(Buffer.from(hash,'hex'),calculated);
 }catch {return false}
};
async function getContent(locale){
 const [row]=await query('SELECT payload FROM content WHERE locale=?',[locale]);
 return row?JSON.parse(row.payload):null;
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
 const [row]=await query(`SELECT s.*, a.email, a.name, a.role FROM sessions s
 JOIN admins a ON a.id=s.admin_id WHERE s.token_hash=? AND s.expires_at>?`,[sha256(token),Date.now()]);
 return row||null;
}
async function createSession(adminId){
 const token=crypto.randomBytes(32).toString('base64url');
 const csrf=crypto.randomBytes(32).toString('base64url');
 const now=Date.now();
 await query('INSERT INTO sessions(token_hash,admin_id,csrf_token,created_at,expires_at) VALUES(?,?,?,?,?)',
  [sha256(token),adminId,csrf,now,now+12*3600*1000]);
 return {token,csrf};
}
async function endSession(token){if(token)await query('DELETE FROM sessions WHERE token_hash=?',[sha256(token)])}
async function audit(adminId,operation,detail=''){
 await query('INSERT INTO audit_log(admin_id,operation,detail) VALUES(?,?,?)',[adminId,operation,String(detail).slice(0,300)]);
}
module.exports={ROOT,UPLOAD_DIR,db,query,initializeDatabase,sha256,hashPassword,verifyPassword,getContent,writeContent,getAdminByEmail,getSession,createSession,endSession,audit};
