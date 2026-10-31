'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const OTPAuth=require('otpauth');
const QRCode=require('qrcode');
const {ROOT,db,query,sha256,verifyPassword,createSession}=require('./db');
const {secureEqual,rateLimit}=require('./security');
const keyFile=path.join(ROOT,'storage','mfa.key');
function problem(message,status=403){const error=new Error(message);error.status=status;return error}
function encryptionKey(allowCreate=false){
 const configured=process.env.MFA_ENCRYPTION_KEY;
 if(configured){const key=Buffer.from(configured,'base64');if(key.length!==32||key.toString('base64')!==configured)throw problem('MFA_ENCRYPTION_KEY harus berupa 32 byte dalam base64.',503);return key}
 if(process.env.NODE_ENV==='production')throw problem('Produksi memerlukan MFA_ENCRYPTION_KEY pada konfigurasi server.',503);
 if(!fs.existsSync(keyFile)&&allowCreate){fs.mkdirSync(path.dirname(keyFile),{recursive:true,mode:0o700});try{fs.writeFileSync(keyFile,crypto.randomBytes(32),{flag:'wx',mode:0o600})}catch(error){if(error.code!=='EEXIST')throw error}}
 if(!fs.existsSync(keyFile))throw problem('Kunci enkripsi MFA tidak tersedia. Gunakan kode pemulihan atau pulihkan kunci server.',503);
 const key=fs.readFileSync(keyFile);if(key.length!==32)throw problem('Kunci enkripsi MFA tidak valid.',503);return key;
}
function seal(secret,key=encryptionKey()){
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from('portfolio-mfa:v1'));
 const encrypted=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),encrypted.toString('base64')].join('.');
}
function unseal(value,key=encryptionKey()){
 try{const [version,iv,tag,data]=value.split('.');if(version!=='v1')throw new Error();const cipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64'));cipher.setAAD(Buffer.from('portfolio-mfa:v1'));cipher.setAuthTag(Buffer.from(tag,'base64'));return Buffer.concat([cipher.update(Buffer.from(data,'base64')),cipher.final()]).toString('utf8')}
 catch{throw problem('Secret MFA tidak dapat dibuka. Pulihkan kunci server atau gunakan kode pemulihan.',503)}
}
function authenticator(secret,label='Administrator'){return new OTPAuth.TOTP({issuer:'Personal Portfolio',label,algorithm:'SHA1',digits:6,period:30,secret:OTPAuth.Secret.fromBase32(secret)})}
function validStep(secret,code,now=Date.now()){
 if(typeof code!=='string'||!/^\d{6}$/.test(code))return null;
 const delta=authenticator(secret).validate({token:code,window:1,timestamp:now});return delta===null?null:Math.floor(now/30000)+delta;
}
function recoveryHash(code){const normalized=String(code||'').replace(/[\s-]/g,'').toUpperCase();return /^[A-F\d]{24}$/.test(normalized)?sha256(normalized):null}
function recoveryCodes(){return Array.from({length:10},()=>crypto.randomBytes(12).toString('hex').toUpperCase().match(/.{4}/g).join('-'))}
async function state(adminId){const [row]=await query('SELECT * FROM admin_mfa WHERE admin_id=?',[adminId]);return row||{admin_id:adminId,enabled:0,auth_version:0,last_step:-1}}
async function status(adminId){
 const current=await state(adminId),[{count}]=await query('SELECT COUNT(*) AS count FROM mfa_recovery_codes WHERE admin_id=? AND used_at IS NULL',[adminId]);
 let ready=false;
 try{encryptionKey();ready=true}catch{if(!process.env.MFA_ENCRYPTION_KEY&&process.env.NODE_ENV!=='production'&&!fs.existsSync(keyFile)){const [{count:enabled}]=await query('SELECT COUNT(*) AS count FROM admin_mfa WHERE enabled=1');ready=enabled===0}}
 return {enabled:Boolean(current.enabled),recoveryCodesRemaining:count,ready};
}
async function requirePassword(adminId,password){
 if(typeof password!=='string'||password.length>256)throw problem('Masukkan password saat ini.');
 const [user]=await query('SELECT id,email,name,role,password_hash FROM admins WHERE id=?',[adminId]);
 if(!user||!await verifyPassword(password,user.password_hash))throw problem('Password saat ini tidak sesuai.');return user;
}
async function lockedAccount(connection,adminId){
 const [[user]]=await connection.execute('SELECT id,email,name,role,password_hash FROM admins WHERE id=? FOR UPDATE',[adminId]);
 if(!user||user.role!=='admin')throw problem('Akun administrator tidak tersedia.',401);
 await connection.execute('INSERT INTO admin_mfa(admin_id) VALUES(?) ON DUPLICATE KEY UPDATE admin_id=admin_mfa.admin_id',[adminId]);
 const [[current]]=await connection.execute('SELECT * FROM admin_mfa WHERE admin_id=? FOR UPDATE',[adminId]);return {user,current};
}
async function begin(adminId,sessionHash,password){
 const user=await requirePassword(adminId,password),current=await state(adminId);
 if(current.enabled)throw problem('MFA sudah aktif. Nonaktifkan dengan faktor kedua sebelum mengganti perangkat.',409);
 if(!(await status(adminId)).ready)throw problem('Kunci MFA belum siap. Periksa konfigurasi server atau pulihkan kunci yang lama.',503);
 const secret=new OTPAuth.Secret({size:20}).base32,uri=authenticator(secret,user.email).toString(),ciphertext=seal(secret,encryptionKey(true)),expiresAt=Date.now()+10*60000;
 await query(`INSERT INTO mfa_enrollments(admin_id,secret_ciphertext,session_hash,password_fingerprint,expires_at) VALUES(?,?,?,?,?)
 ON DUPLICATE KEY UPDATE secret_ciphertext=?,session_hash=?,password_fingerprint=?,expires_at=?`,[adminId,ciphertext,sessionHash,sha256(user.password_hash),expiresAt,ciphertext,sessionHash,sha256(user.password_hash),expiresAt]);
 return {secret,uri,qr:await QRCode.toDataURL(uri,{width:240,margin:2,errorCorrectionLevel:'M'}),expiresAt};
}
async function replaceRecovery(connection,adminId,codes){
 await connection.execute('DELETE FROM mfa_recovery_codes WHERE admin_id=?',[adminId]);
 for(const code of codes)await connection.execute('INSERT INTO mfa_recovery_codes(admin_id,code_hash) VALUES(?,?)',[adminId,recoveryHash(code)]);
}
async function rotate(connection,adminId,verified){
 await connection.execute('DELETE FROM sessions WHERE admin_id=?',[adminId]);
 await connection.execute('DELETE FROM mfa_challenges WHERE admin_id=?',[adminId]);
 return createSession(adminId,{mfaVerified:verified,connection});
}
async function confirm(adminId,sessionHash,password,code){
 const verified=await requirePassword(adminId,password),connection=await db.getConnection(),codes=recoveryCodes();
 try{
  await connection.beginTransaction();const {user,current}=await lockedAccount(connection,adminId);
  const [[pending]]=await connection.execute('SELECT * FROM mfa_enrollments WHERE admin_id=? FOR UPDATE',[adminId]);
  if(current.enabled||!pending||pending.expires_at<=Date.now()||pending.session_hash!==sessionHash||pending.password_fingerprint!==sha256(user.password_hash)||user.password_hash!==verified.password_hash)throw problem('Setup MFA kedaluwarsa atau akun berubah. Mulai setup lagi.',409);
  const step=validStep(unseal(pending.secret_ciphertext),code);
  if(step===null)throw problem('Kode autentikator tidak sesuai. Periksa kode 6 digit dan waktu perangkat.');
  await connection.execute('UPDATE admin_mfa SET enabled=1,secret_ciphertext=?,last_step=?,auth_version=auth_version+1,updated_at=CURRENT_TIMESTAMP WHERE admin_id=?',[pending.secret_ciphertext,step,adminId]);
  await replaceRecovery(connection,adminId,codes);await connection.execute('DELETE FROM mfa_enrollments WHERE admin_id=?',[adminId]);
  const session=await rotate(connection,adminId,true);
  await connection.execute('INSERT INTO audit_log(admin_id,operation,detail) VALUES(?,?,?)',[adminId,'mfa.enable','Sesi lain dicabut']);
  await connection.commit();return {session,recoveryCodes:codes};
 }catch(error){await connection.rollback();throw error}finally{connection.release()}
}
async function consumeFactor(connection,current,code){
 if(typeof code!=='string'||code.length>80)return false;
 const hash=recoveryHash(code);
 if(hash){const [updated]=await connection.execute('UPDATE mfa_recovery_codes SET used_at=? WHERE admin_id=? AND code_hash=? AND used_at IS NULL',[Date.now(),current.admin_id,hash]);if(updated.affectedRows){await connection.execute('INSERT INTO audit_log(admin_id,operation,detail) VALUES(?,?,?)',[current.admin_id,'mfa.recovery-used','Kode pemulihan sekali pakai']);return true}return false}
 const step=validStep(unseal(current.secret_ciphertext),code.trim());
 if(step===null||step<=current.last_step)return false;
 await connection.execute('UPDATE admin_mfa SET last_step=? WHERE admin_id=?',[step,current.admin_id]);return true;
}
async function change(adminId,password,code,operation){
 const verified=await requirePassword(adminId,password),connection=await db.getConnection();
 try{
  await connection.beginTransaction();const {user,current}=await lockedAccount(connection,adminId);
  if(!current.enabled||user.password_hash!==verified.password_hash)throw problem('Status akun berubah. Masuk kembali atau muat ulang pengaturan.',409);
  if(!await consumeFactor(connection,current,code))throw problem('Kode tidak valid atau sudah dipakai. Tunggu kode berikutnya atau gunakan kode pemulihan.');
  let codes;
  if(operation==='disable'){
   await connection.execute('UPDATE admin_mfa SET enabled=0,secret_ciphertext=NULL,last_step=-1,auth_version=auth_version+1,updated_at=CURRENT_TIMESTAMP WHERE admin_id=?',[adminId]);
   await connection.execute('DELETE FROM mfa_recovery_codes WHERE admin_id=?',[adminId]);
  }else{
   codes=recoveryCodes();await replaceRecovery(connection,adminId,codes);await connection.execute('UPDATE admin_mfa SET auth_version=auth_version+1,updated_at=CURRENT_TIMESTAMP WHERE admin_id=?',[adminId]);
  }
  await connection.execute('DELETE FROM mfa_enrollments WHERE admin_id=?',[adminId]);
  const session=await rotate(connection,adminId,operation!=='disable');
  await connection.execute('INSERT INTO audit_log(admin_id,operation,detail) VALUES(?,?,?)',[adminId,operation==='disable'?'mfa.disable':'mfa.recovery-regenerate','Sesi lain dicabut']);
  await connection.commit();return {session,...(codes?{recoveryCodes:codes}:{})};
 }catch(error){await connection.rollback();throw error}finally{connection.release()}
}
async function verifySensitive(connection,adminId,code){
 const [[current]]=await connection.execute('SELECT * FROM admin_mfa WHERE admin_id=? FOR UPDATE',[adminId]);
 if(current?.enabled&&!await consumeFactor(connection,current,code))throw problem('Verifikasi faktor kedua diperlukan. Gunakan kode autentikator berikutnya atau kode pemulihan.');
}
async function createChallenge(adminId,clientHash,{connection=db}={}){
 const [[current]]=await connection.execute('SELECT enabled,auth_version FROM admin_mfa WHERE admin_id=?',[adminId]);if(!current?.enabled)throw problem('Status MFA berubah. Ulangi login.',409);
 const token=crypto.randomBytes(32).toString('base64url'),csrf=crypto.randomBytes(32).toString('base64url');
 await connection.execute('INSERT INTO mfa_challenges(token_hash,admin_id,csrf_token,client_hash,auth_version,expires_at) VALUES(?,?,?,?,?,?)',[sha256(token),adminId,csrf,clientHash,current.auth_version,Date.now()+5*60000]);
 return {token,csrf};
}
async function completeChallenge(token,csrf,clientHash,code){
 if(typeof token!=='string'||token.length>100)throw problem('Sesi verifikasi berakhir. Ulangi login.',401);
 const [hint]=await query('SELECT admin_id FROM mfa_challenges WHERE token_hash=?',[sha256(token)]);
 if(!hint)throw problem('Sesi verifikasi berakhir. Ulangi login.',401);
 await rateLimit('mfa-account',String(hint.admin_id),10,15*60000);await rateLimit('mfa-challenge',sha256(token),5,5*60000);
 const connection=await db.getConnection();
 try{
  await connection.beginTransaction();const {user,current}=await lockedAccount(connection,hint.admin_id);
  const [[challenge]]=await connection.execute('SELECT * FROM mfa_challenges WHERE token_hash=? FOR UPDATE',[sha256(token)]);
  if(!challenge||challenge.expires_at<=Date.now()||challenge.tries>=5||!current.enabled||challenge.auth_version!==current.auth_version||challenge.client_hash!==clientHash)throw problem('Sesi verifikasi berakhir. Ulangi login.',401);
  if(!secureEqual(challenge.csrf_token,csrf))throw problem('Token verifikasi tidak valid.');
  if(!await consumeFactor(connection,current,code)){
   await connection.execute('UPDATE mfa_challenges SET tries=tries+1 WHERE token_hash=?',[sha256(token)]);
   await connection.execute('INSERT INTO audit_log(admin_id,operation,detail) VALUES(?,?,?)',[user.id,'mfa.failed','Kode kedua ditolak']);await connection.commit();
   throw problem('Kode tidak valid atau sudah dipakai. Gunakan kode berikutnya atau kode pemulihan.');
  }
  await connection.execute('DELETE FROM mfa_challenges WHERE token_hash=?',[sha256(token)]);
  await connection.execute('DELETE FROM rate_limits WHERE lookup_key=?',[sha256(`login-account|${user.email}`)]);
  const session=await createSession(user.id,{mfaVerified:true,connection});
  await connection.execute('INSERT INTO audit_log(admin_id,operation,detail) VALUES(?,?,?)',[user.id,'login','MFA terverifikasi']);
  await connection.commit();return {session,admin:{email:user.email,name:user.name,role:user.role}};
 }catch(error){await connection.rollback();throw error}finally{connection.release()}
}
module.exports={status,state,begin,confirm,change,createChallenge,completeChallenge,verifySensitive,validStep,recoveryHash,seal,unseal,encryptionKey};
