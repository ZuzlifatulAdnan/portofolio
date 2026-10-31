'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const envPath=path.join(root,'.env');
if(!fs.existsSync(envPath))fs.copyFileSync(path.join(root,'.env.example'),envPath,fs.constants.COPYFILE_EXCL);
const {databaseConfig,databaseError}=require('../server/config');
const {db,query,hashPassword}=require('../server/db');
const {setupDatabase}=require('./setup-db');

(async()=>{
 const localHosts=['localhost','127.0.0.1','::1'];
 if(process.env.NODE_ENV==='production'||!localHosts.includes(databaseConfig.host)||!localHosts.includes(process.env.HOST||'127.0.0.1')){
  throw new Error('setup:local hanya untuk pengembangan dengan server dan MySQL di localhost. Gunakan db:setup dan create-admin untuk lingkungan lain.');
 }
 await setupDatabase();
 const [{count}]=await query('SELECT COUNT(*) AS count FROM admins');
 if(count>0){
  console.log('Akun admin sudah tersedia; kredensial yang ada dipertahankan.');
  return;
 }
 const email='admin@localhost.test';
 const password=crypto.randomBytes(20).toString('base64url');
 const folder=path.join(root,'storage');
 const accessFile=path.join(folder,'AKSES_LOKAL.txt');
 const port=process.env.PORT||'3000';
 const origin=`http://127.0.0.1:${port}`;
 fs.mkdirSync(folder,{recursive:true,mode:0o700});
 fs.writeFileSync(accessFile,[
  'AKSES PORTOFOLIO LOKAL',
  `Website: ${origin}/`,
  `Admin: ${origin}/admin`,
  `Email: ${email}`,
  `Password: ${password}`,
  '',
  `Database: ${databaseConfig.database} (MySQL lokal)`,
  'Konfigurasi koneksi database: .env',
  'Akun ini dibuat khusus untuk pengembangan lokal.',
  'Jalankan MySQL di Laragon, lalu npm start untuk menyalakan website.',
  'File ini privat dan diabaikan oleh Git. Jangan salin ke folder public.',
  ''
 ].join('\n'),{flag:'wx',mode:0o600});
 try{
  await query('INSERT INTO admins(email,password_hash,name,role) VALUES(?,?,?,?)',[email,await hashPassword(password),'Administrator Lokal','admin']);
 }catch(error){fs.unlinkSync(accessFile);throw error}
 console.log('Admin lokal dibuat dengan password acak. Buka storage/AKSES_LOKAL.txt untuk melihat akses login.');
})().catch(error=>{
 console.error(databaseError(error));
 process.exitCode=1;
}).finally(()=>db.end());
