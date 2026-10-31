'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cheerio=require('cheerio');
const tech=require('../public/js/technology');
const catalog=require('../public/js/tech-catalog');
const sections=require('../public/js/portfolio-sections');
const {validateContent}=require('../server/validate');
const ui=require('../data/seed/ui.json').id;
test('Technology logos resolve compound labels and use local, safe assets',()=>{
 assert.deepEqual(tech.brands('PHP / Laravel'),['php','laravel']);
 assert.deepEqual(tech.brands('HTML / CSS'),['html','css']);
 assert.deepEqual(tech.brands('Git & GitHub'),['git','github']);
 assert.deepEqual(tech.brands('Linux / Ubuntu'),['linux','ubuntu']);
 assert.deepEqual(tech.brands('Testing'),[]);
 const $=cheerio.load(tech.skill('\"><img src=x onerror=alert(1)>'));
 assert.equal($('img,script').length,0);assert.ok($('.tech-label').text().includes('<img'));
 for(const slug of Object.keys(catalog)){
  const svg=fs.readFileSync(path.join(__dirname,'../public/assets/tech',slug+'.svg'),'utf8');
  assert.match(svg,/<path d="/);assert.ok(!/script|https?:\/\/(?!www\.w3\.org)|onload|foreignObject/i.test(svg));
 }
});
test('Only published FAQs and permitted published testimonials are rendered',()=>{
 const faqs=[{id:'draft',question:'PRIVATE_FAQ_DRAFT',answer:'Private answer',visibility:'draft'},{id:'visible',question:'A public question?',answer:'<script>alert(1)</script>',visibility:'published'}];
 const rendered=sections.faqs(faqs,ui),$=cheerio.load(rendered);
 assert.equal($('details summary').length,1);assert.equal($('script').length,0);assert.ok(!rendered.includes('PRIVATE_FAQ_DRAFT'));
 const testimonials=[{id:'visible',name:'Penguji Lokal',role:'Pengujian',company:'Fixture',quote:'Kutipan untuk pengujian pada data terpisah.',avatarUrl:'',consent:'granted',visibility:'published'},{id:'pending',name:'PRIVATE_PENDING_NAME',quote:'Not approved for publication.',consent:'pending',visibility:'published'}];
 const html=sections.testimonials(testimonials,ui);assert.ok(html.includes('Penguji Lokal'));assert.ok(!html.includes('PRIVATE_PENDING_NAME'));
 assert.match(sections.testimonials([],ui),/Belum ada testimoni/);
});
test('Publication requires complete FAQs and testimonial permission',()=>{
 const content=structuredClone(require('../data/seed/id.json'));
 content.testimonials=[{id:'local-test',name:'Penguji Lokal',role:'',company:'',quote:'Kutipan pengujian terpisah.',avatarUrl:'',visibility:'published',consent:'pending'}];
 assert.match(validateContent(content),/izin publikasi/);
 content.testimonials[0].consent='granted';assert.equal(validateContent(content),null);
 content.faqs[0].answer='';assert.match(validateContent(content),/Lengkapi pertanyaan/);
});
