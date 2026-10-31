'use strict';
const rootKeys=['brand','brandSuffix','fullName','initials','heroRole','heroHeading','heroDescription','email','location','availabilityText','bio','aboutQuote','cvUrl','avatarUrl','socials','services','projects','experiences','skills','certifications','steps'];
const collections=['socials','services','projects','experiences','skills','certifications','steps'];
const pathFields=new Set(['avatarUrl','cvUrl','image']);
const urlFields=new Set(['url','link','github']);
function validateContent(obj){
 if(!obj||typeof obj!=='object'||Array.isArray(obj))return 'Content must be an object.';
 for(const key of rootKeys)if(!(key in obj))return `Missing root field: ${key}`;
 for(const key of collections)if(!Array.isArray(obj[key])||obj[key].length>60)return `Invalid array: ${key}`;
 if(!Array.isArray(obj.bio)||obj.bio.length>12||!Array.isArray(obj.heroHeading)||obj.heroHeading.length!==3)return 'Invalid biography or heading.';
 const encoded=JSON.stringify(obj);
 if(encoded.length>250_000)return 'Content exceeds 250KB limit.';
 let fields=0;
 function check(value,key='',depth=0){
  if(depth>10)return 'Content is too deeply nested.';
  fields++;if(fields>4000)return 'Too many fields.';
  if(typeof value==='string'){
   if(value.length>7000)return `${key}: text too long.`;
   if(/[\u0000-\u0008\u000b\u000e-\u001f]/.test(value))return `${key}: invalid control characters.`;
   if(pathFields.has(key)&&value && (!/^assets\/[a-zA-Z0-9_./-]{1,190}$/.test(value)||value.includes('..')||value.includes('//')))return `${key}: only local assets/ paths allowed.`;
   if(urlFields.has(key)&&value){try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol))return `${key}: only http(s) URLs allowed.`}catch{return `${key}: invalid URL.`}}
   return null;
  }
  if(Array.isArray(value)){
   if(value.length>150)return `${key}: too many items.`;
   for(const item of value){const error=check(item,key,depth+1);if(error)return error}
   return null;
  }
  if(value && typeof value==='object'){
   for(const [k,v] of Object.entries(value)){
    if(['__proto__','constructor','prototype'].includes(k))return 'Forbidden property name.';
    const error=check(v,k,depth+1);if(error)return error;
   }
   return null;
  }
  return `Unsupported value for ${key}.`;
 }
 return check(obj);
}
function validateMessage(message){
 const x=message;
 if(!x||typeof x!=='object')return 'Invalid message';
 if(typeof x.name!=='string'||x.name.trim().length<2||x.name.length>100)return 'Name must be 2–100 characters';
 if(typeof x.email!=='string'||x.email.length>200||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email))return 'Invalid email';
 if(typeof x.topic!=='string'||x.topic.length<2||x.topic.length>150)return 'Invalid topic';
 if(typeof x.message!=='string'||x.message.trim().length<10||x.message.length>3000)return 'Message must be 10–3000 characters';
 return null;
}
module.exports={validateContent,validateMessage};
