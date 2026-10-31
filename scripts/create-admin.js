'use strict';
const { db, query, initializeDatabase, hashPassword } = require('../server/db');
const {databaseError} = require('../server/config');
const args=process.argv.slice(2);
const index=args.indexOf('--email');
const email=(index>=0?args[index+1]||'':'').trim().toLowerCase();
if(email.length>200||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
 console.error('Usage: npm run create-admin -- --email your@email.com');
 process.exit(1);
}
function promptHidden(label){
 return new Promise((resolve,reject)=>{
  if(!process.stdin.isTTY){reject(new Error('Interactive terminal required or set ADMIN_PASSWORD in environment'));return}
  process.stdout.write(label);
  process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
  let result='';
  const cb=key=>{
   if(key==='\r'||key==='\n'){process.stdin.setRawMode(false);process.stdin.pause();process.stdin.off('data',cb);process.stdout.write('\n');resolve(result);return}
   if(key==='\u0003'){process.stdin.setRawMode(false);process.stdin.off('data',cb);process.stdout.write('\n');reject(new Error('Cancelled'));return}
   if(key==='\u007f'||key==='\b'){result=result.slice(0,-1);return}
   if(key.length===1)result+=key;
  };
  process.stdin.on('data',cb);
 });
}
(async()=>{
 await initializeDatabase();
 const password=process.env.ADMIN_PASSWORD||await promptHidden('Admin password (hidden; at least 12 characters): ');
 if(password.length<12||password.length>256)throw new Error('Password must contain 12–256 characters');
 const [existing]=await query('SELECT id FROM admins WHERE email=?',[email]);
 if(existing){throw new Error('Admin already exists; password was not changed.')} // Prevent accidental resets.
 await query('INSERT INTO admins(email,password_hash,name,role) VALUES(?,?,?,?)',[email,hashPassword(password),'Administrator','admin']);
 console.log(`Admin created: ${email}. Sign in at /admin. No default password was stored.`);
})().catch(err=>{console.error(databaseError(err));process.exitCode=1}).finally(()=>db.end());
