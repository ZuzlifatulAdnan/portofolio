'use strict';
const net=require('node:net');
function publicOrigin(value){
 try{const url=new URL(value);return url.protocol==='https:'&&!net.isIP(url.hostname)&&url.hostname.includes('.')&&!['localhost'].includes(url.hostname)&&!/(?:^|\.)(?:localhost|local|test|invalid|example)$/.test(url.hostname)?url.origin:null}catch{return null}
}
function connectionStatus(settings){
 const origin=publicOrigin(settings.siteUrl),domain=origin?new URL(origin).hostname:'';
 const property=origin?origin+'/':'';
 return {publicUrlConfigured:Boolean(origin),siteUrl:settings.siteUrl||'',htmlTagInstalled:Boolean(settings.googleVerification),indexingEnabled:settings.indexing,googleVerificationStatus:'not-checked',
  propertyUrl:property,domainProperty:domain?'sc-domain:'+domain:'',sitemapUrl:origin?origin+'/sitemap.xml':'',
  consoleUrl:property?'https://search.google.com/search-console?resource_id='+encodeURIComponent(property):'https://search.google.com/search-console/welcome',
  domainConsoleUrl:domain?'https://search.google.com/search-console?resource_id='+encodeURIComponent('sc-domain:'+domain):'https://search.google.com/search-console/welcome',
  ownershipHelp:'https://support.google.com/webmasters/answer/9008080',
  message:origin?'Pengaturan website siap diperiksa di Google. Status kepemilikan belum diverifikasi oleh aplikasi.':'Website masih lokal atau URL publik belum diisi. Siapkan domain HTTPS sebelum verifikasi URL-prefix dan pengiriman sitemap.'};
}
function extractVerificationToken(value){
 if(typeof value!=='string')return null;
 const input=value.trim();if(/^[\w-]{1,200}$/.test(input))return input;
 const match=input.match(/^<meta\s+name=["']google-site-verification["']\s+content=["']([\w-]{1,200})["']\s*\/?\s*>$/i);
 return match?match[1]:null;
}
module.exports={connectionStatus,extractVerificationToken};
