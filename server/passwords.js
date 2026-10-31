'use strict';
const crypto=require('node:crypto');
const scrypt=require('node:util').promisify(crypto.scrypt);
const DUMMY_HASH='scrypt$32768$3$00000000000000000000000000000000$'+'0'.repeat(128);
async function hashPassword(password){
 const salt=crypto.randomBytes(16).toString('hex');
 const hash=await scrypt(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024});
 return `scrypt$32768$3$${salt}$${hash.toString('hex')}`;
}
async function verifyPassword(password,stored){
 try{
  const parts=String(stored||DUMMY_HASH).split('$');
  const [algorithm,n]=parts;
  const legacy=parts.length===4;
  const p=legacy?1:Number(parts[2]),salt=parts[legacy?2:3],hash=parts[legacy?3:4];
  if(algorithm!=='scrypt'||!([16384,32768].includes(Number(n)))||![1,3].includes(p)||!/^[a-f\d]{32}$/.test(salt)||!/^[a-f\d]{128}$/.test(hash))return false;
  const calculated=await scrypt(password,salt,64,{N:Number(n),r:8,p,maxmem:64*1024*1024});
  return crypto.timingSafeEqual(Buffer.from(hash,'hex'),calculated);
 }catch{return false}
}
function validatePassword(password){
 if(typeof password!=='string'||password.length<15||password.length>256)return 'Password harus 15–256 karakter. Gunakan frasa panjang yang unik.';
 if(new Set(password).size<6)return 'Gunakan password dengan karakter yang lebih beragam.';
 return null;
}
module.exports={hashPassword,verifyPassword,validatePassword};
