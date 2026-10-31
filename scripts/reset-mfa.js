'use strict';
// Server-only recovery. Requires control of the server AND the account password.
const {db,initializeDatabase,verifyPassword}=require('../server/db');
const {databaseError}=require('../server/config');
const args=process.argv.slice(2),index=args.indexOf('--email');
const email=(index>=0?args[index+1]||'':'').trim().toLowerCase();
if(!args.includes('--confirm')||email.length>200||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
 console.error('Usage: npm run mfa:reset -- --email your@email.com --confirm');process.exit(1);
}
function passwordPrompt(){
 return new Promise((resolve,reject)=>{
  if(!process.stdin.isTTY)return reject(new Error('Interactive terminal required, or set MFA_RESET_PASSWORD temporarily.'));
  process.stdout.write('Current account password (hidden): ');process.stdin.setRawMode(true);process.stdin.setEncoding('utf8');process.stdin.resume();let password='';
  function done(error){process.stdin.setRawMode(false);process.stdin.pause();process.stdin.off('data',onData);process.stdout.write('\n');error?reject(error):resolve(password)}
  function onData(chunk){for(const char of chunk){if(char==='\u0003')return done(new Error('Cancelled'));if(char==='\r'||char==='\n')return done();if(char==='\u007f'||char==='\b')password=password.slice(0,-1);else if(char>=' '&&password.length<256)password+=char}}
  process.stdin.on('data',onData);
 });
}
(async()=>{
 const password=process.env.MFA_RESET_PASSWORD||await passwordPrompt();
 await initializeDatabase();const connection=await db.getConnection();
 try{
  await connection.beginTransaction();
  const [[admin]]=await connection.execute('SELECT id,password_hash,role FROM admins WHERE email=? FOR UPDATE',[email]);
  if(!admin||admin.role!=='admin'||!await verifyPassword(password,admin.password_hash))throw new Error('Account password is incorrect; MFA was not changed.');
  await connection.execute('UPDATE admin_mfa SET enabled=0,secret_ciphertext=NULL,last_step=-1,auth_version=auth_version+1,updated_at=CURRENT_TIMESTAMP WHERE admin_id=?',[admin.id]);
  for(const table of ['mfa_recovery_codes','mfa_challenges','mfa_enrollments','sessions'])await connection.execute(`DELETE FROM ${table} WHERE admin_id=?`,[admin.id]);
  await connection.execute('INSERT INTO audit_log(admin_id,operation,detail) VALUES(?,?,?)',[admin.id,'mfa.server-reset','Pemulihan dari terminal server; seluruh sesi dicabut']);
  await connection.commit();console.log('MFA reset completed. All sessions and recovery codes revoked. Sign in and enroll a new authenticator.');
 }catch(error){await connection.rollback();throw error}finally{connection.release()}
})().catch(error=>{console.error(databaseError(error));process.exitCode=1}).finally(()=>db.end());
