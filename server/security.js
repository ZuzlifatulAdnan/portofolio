'use strict';
const crypto=require('node:crypto');
const net=require('node:net');
const {query,sha256}=require('./db');
const {databaseConfig}=require('./config');
function secureEqual(a,b){
 if(typeof a!=='string'||typeof b!=='string'||a.length>300||b.length>300)return false;
 const x=Buffer.from(a),y=Buffer.from(b);
 return x.length===y.length&&crypto.timingSafeEqual(x,y);
}
function clientIP(req){
 const direct=req.socket.remoteAddress||'unknown';
 if(process.env.TRUST_PROXY==='loopback'&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(direct)){
  const forwarded=String(req.headers['x-forwarded-for']||'').split(',').at(-1).trim();
  if(net.isIP(forwarded))return forwarded;
 }
 return direct;
}
async function rateLimit(scope,identifier,limit,windowMs,connection=null){
 const run=connection?async(sql,params)=>(await connection.execute(sql,params))[0]:query;
 const key=sha256(`${scope}|${identifier}`),now=Date.now();
 await run(`INSERT INTO rate_limits(lookup_key,hits,expires_at) VALUES(?,1,?)
 ON DUPLICATE KEY UPDATE hits=IF(expires_at<=?,1,hits+1),expires_at=IF(expires_at<=?,?,expires_at)`,[key,now+windowMs,now,now,now+windowMs]);
 const [row]=await run('SELECT hits,expires_at FROM rate_limits WHERE lookup_key=?',[key]);
 if(row.hits>limit){const error=new Error('Terlalu banyak permintaan. Tunggu lalu coba kembali.');error.status=429;error.retryAfter=Math.max(1,Math.ceil((row.expires_at-now)/1000));throw error}
}
function validHost(req,port){
 const allowed=new Set([`127.0.0.1:${port}`,`localhost:${port}`,`[::1]:${port}`]);
 if(process.env.APP_ORIGIN){try{allowed.add(new URL(process.env.APP_ORIGIN).host)}catch{return false}}
 return allowed.has(String(req.headers.host||'').toLowerCase());
}
function validateProduction(){
 if(process.env.NODE_ENV!=='production')return;
 let origin;try{origin=new URL(process.env.APP_ORIGIN)}catch{throw new Error('Produksi memerlukan APP_ORIGIN berupa origin HTTPS.')}
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new Error('APP_ORIGIN produksi harus origin HTTPS tanpa path atau kredensial.');
 if(databaseConfig.user==='root'||!databaseConfig.password)throw new Error('Produksi memerlukan akun MySQL khusus dengan password, bukan root.');
 const mfaKey=process.env.MFA_ENCRYPTION_KEY||'';
 if(!mfaKey||Buffer.from(mfaKey,'base64').length!==32||Buffer.from(mfaKey,'base64').toString('base64')!==mfaKey)throw new Error('Produksi memerlukan MFA_ENCRYPTION_KEY (32 byte base64) yang tersimpan permanen.');
}
module.exports={secureEqual,clientIP,rateLimit,validHost,validateProduction};
