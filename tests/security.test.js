'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const sharp=require('sharp');
const {PDFDocument}=require('pdf-lib');
const {secureEqual}=require('../server/security');
const {defaults,validateSettings,themeCSS}=require('../server/settings');
const {hashPassword,verifyPassword,validatePassword}=require('../server/passwords');
const {sanitizeUpload}=require('../server/uploads');
const {validateContent}=require('../server/validate');

test('Token comparison handles Unicode and mismatched byte lengths safely',()=>{
 assert.equal(secureEqual('abc','abc'),true);
 assert.equal(secureEqual('é'.repeat(43),'x'.repeat(43)),false);
 assert.equal(secureEqual(undefined,'x'),false);
 assert.equal(secureEqual('x'.repeat(301),'x'.repeat(301)),false);
});
test('Content rejects SVG attribute injection and arbitrary service classes',()=>{
 const content=structuredClone(require('../data/seed/id.json'));
 assert.equal(validateContent(content),null);
 content.skills[0].icon='code"><image href="https://attacker.example/"/>';
 assert.match(validateContent(content),/Ikon/);
 content.skills[0].icon='code';content.services[0].tone='other-class';
 assert.match(validateContent(content),/Warna kartu/);
});
test('Settings reject CSS injection, unsafe domains, low contrast, and unknown fields',()=>{
 assert.equal(validateSettings(structuredClone(defaults)),null);
 const css=structuredClone(defaults);css.appearance.accentDark='#fff;}</style><script>alert(1)</script>';
 assert.match(validateSettings(css),/Warna/);
 const contrast=structuredClone(defaults);contrast.appearance.accentDark='#0a0e12';assert.match(validateSettings(contrast),/Kontras/);
 for(const url of ['javascript:alert(1)','https://user:pass@example.com','https://example.com/path','https://example.com/?x=1']){
  const settings=structuredClone(defaults);settings.siteUrl=url;assert.ok(validateSettings(settings));
 }
 const index=structuredClone(defaults);index.indexing=true;assert.ok(validateSettings(index));
 assert.ok(validateSettings({...structuredClone(defaults),customScript:'alert(1)'}));
 assert.match(themeCSS(defaults),/--accent:#c9fb74/);
});
test('Passwords use asynchronous scrypt and retain legacy password compatibility',async()=>{
 const password='A-long-unique-phrase-for-local-testing!';
 const hash=await hashPassword(password);assert.match(hash,/^scrypt\$32768\$3\$/);
 assert.equal(await verifyPassword(password,hash),true);assert.equal(await verifyPassword('wrong',hash),false);
 const salt=crypto.randomBytes(16).toString('hex');
 const old=crypto.scryptSync(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('hex');
 assert.equal(await verifyPassword(password,`scrypt$16384$${salt}$${old}`),true);
 assert.ok(validatePassword('short'));assert.ok(validatePassword('a'.repeat(30)));assert.equal(validatePassword(password),null);
});
test('Images are decoded and re-encoded; executable and forged files are rejected',async()=>{
 const image=await sharp({create:{width:8,height:8,channels:3,background:'#c9fb74'}}).png().withMetadata().toBuffer();
 const cleaned=await sanitizeUpload({filename:'photo.png',mime:'image/png',base64:image.toString('base64')});
 const metadata=await sharp(cleaned.bytes).metadata();assert.equal(metadata.width,8);assert.equal(metadata.icc,undefined);
 await assert.rejects(sanitizeUpload({filename:'payload.php',mime:'image/png',base64:image.toString('base64')}));
 await assert.rejects(sanitizeUpload({filename:'fake.png',mime:'image/png',base64:Buffer.from('\x89PNG\r\n\x1a\n<script>alert(1)</script>').toString('base64')}));
 await assert.rejects(sanitizeUpload({filename:'vector.svg',mime:'image/svg+xml',base64:Buffer.from('<svg onload="alert(1)"></svg>').toString('base64')}));
 await assert.rejects(sanitizeUpload({filename:'large-invalid.png',mime:'image/png',base64:Buffer.alloc(1000000,255).toString('base64')}),error=>error.status===422);
});
test('PDF validation rejects encrypted/corrupt files and JavaScript actions',async()=>{
 const safe=await PDFDocument.create();safe.addPage();
 const clean=await sanitizeUpload({filename:'cv.pdf',mime:'application/pdf',base64:Buffer.from(await safe.save()).toString('base64')});
 assert.equal((await PDFDocument.load(clean.bytes)).getPageCount(),1);
 const active=await PDFDocument.create();active.addPage();active.addJavaScript('script','app.alert("test")');
 await assert.rejects(sanitizeUpload({filename:'active.pdf',mime:'application/pdf',base64:Buffer.from(await active.save()).toString('base64')}));
 await assert.rejects(sanitizeUpload({filename:'fake.pdf',mime:'application/pdf',base64:Buffer.from('%PDF-1.7 not a document %%EOF').toString('base64')}));
});
