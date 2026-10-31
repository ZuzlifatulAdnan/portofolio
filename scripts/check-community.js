'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
async function checkCommunity(context,page,base,review){
 const publicPage=await context.newPage();
 const requests=[];publicPage.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url())});
 async function saveContent(){
  const response=page.waitForResponse(response=>response.url().includes('/admin/api/content?lang=id')&&response.request().method()==='PUT');
  await page.getByRole('button',{name:'Simpan Perubahan',exact:false}).click();
  const result=await response;assert.equal(result.status(),200,await result.text());
 }
 try{
  await publicPage.goto(base+'/?lang=id');
  assert.ok(await publicPage.locator('#skills-groups .tech-logo').count()>10);
  assert.ok((await publicPage.locator('#skills-groups .tech-logo[data-brand=mysql]').first().evaluate(element=>getComputedStyle(element).maskImage)).includes('mysql.svg'));
  const initialFAQ=await publicPage.locator('#faq-list details').count();assert.equal(initialFAQ,4);
  const firstSummary=publicPage.locator('#faq-list summary').first();await firstSummary.focus();await publicPage.keyboard.press('Enter');
  assert.equal(await publicPage.locator('#faq-list details').first().getAttribute('open'),'');
  await publicPage.keyboard.press('Enter');assert.equal(await publicPage.locator('#faq-list details').first().getAttribute('open'),null);
  assert.equal(await publicPage.locator('#testimonials-grid .testimonial-card').count(),0);
  assert.equal(await publicPage.locator('#testimonials-grid .testimonials-empty').isVisible(),true);
  await publicPage.locator('.skills-panel').screenshot({path:path.join(review,'technology-logos-desktop.png')});
  await publicPage.locator('#testimonials').screenshot({path:path.join(review,'testimonials-empty-desktop.png')});
  await page.getByRole('button',{name:'FAQ',exact:true}).click();await page.locator('#add-button').click();
  await page.getByLabel('Pertanyaan',{exact:true}).fill('Pertanyaan dari pengujian browser?');
  await page.getByLabel('Jawaban',{exact:true}).fill('Jawaban ini merupakan data uji pada database terpisah.');
  await page.getByLabel('Status publikasi',{exact:true}).selectOption('published');await saveContent();
  await page.locator('#add-button').click();await page.getByLabel('Pertanyaan',{exact:true}).fill('PRIVATE_FAQ_BROWSER');await page.getByLabel('Jawaban',{exact:true}).fill('This draft must stay private.');await saveContent();
  await page.getByRole('button',{name:'Testimoni',exact:true}).click();await page.locator('#add-button').click();
  await page.getByLabel('Nama pemberi testimoni',{exact:true}).fill('Penguji Lokal (data uji)');
  await page.getByLabel('Peran / jabatan',{exact:true}).fill('Pengujian UI');
  await page.getByLabel('Organisasi (opsional)',{exact:true}).fill('Database terpisah');
  await page.getByLabel('Kutipan asli yang diizinkan',{exact:true}).fill('Ini data pengujian pada database terpisah, bukan testimoni pelanggan.');
  await page.getByLabel('Izin publikasi dari pemberi testimoni',{exact:true}).selectOption('granted');
  await page.getByLabel('Status publikasi',{exact:true}).selectOption('published');await saveContent();
  await page.locator('#add-button').click();await page.getByLabel('Nama pemberi testimoni',{exact:true}).fill('PRIVATE_TESTIMONIAL_BROWSER');await page.getByLabel('Kutipan asli yang diizinkan',{exact:true}).fill('This draft quotation must stay private.');await saveContent();
  await publicPage.reload();assert.equal(await publicPage.locator('#faq-list details').count(),initialFAQ+1);
  assert.equal(await publicPage.locator('#testimonials-grid .testimonial-card').count(),1);
  assert.equal(await publicPage.locator('#testimonials-grid cite').textContent(),'Penguji Lokal (data uji)');
  assert.ok(!(await publicPage.content()).includes('PRIVATE_FAQ_BROWSER'));assert.ok(!(await publicPage.content()).includes('PRIVATE_TESTIMONIAL_BROWSER'));
  await publicPage.locator('#faq-list summary').first().click();
  await publicPage.locator('#faq').screenshot({path:path.join(review,'faq-desktop.png')});
  await publicPage.locator('#testimonials').screenshot({path:path.join(review,'testimonials-test-data-desktop.png')});
  await publicPage.setViewportSize({width:375,height:812});
  await publicPage.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const layout=await publicPage.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(element=>{const rect=element.getBoundingClientRect();return rect.width>0&&rect.right>innerWidth+1}).slice(-20).map(element=>({tag:element.tagName,cls:element.className,width:element.getBoundingClientRect().width,right:element.getBoundingClientRect().right}))}));
  assert.ok(layout.scroll<=layout.width,JSON.stringify(layout));
  await publicPage.locator('#faq').screenshot({path:path.join(review,'faq-mobile.png')});
  await publicPage.locator('#testimonials').screenshot({path:path.join(review,'testimonials-test-data-mobile.png')});
  assert.ok(requests.every(url=>new URL(url).origin===base),'Technology logos must load from local assets.');
  await page.locator('#item-list').getByRole('button',{name:'Penguji Lokal (data uji)',exact:false}).click();
  await page.getByLabel('Izin publikasi dari pemberi testimoni',{exact:true}).selectOption('pending');
  assert.equal(await page.getByLabel('Status publikasi',{exact:true}).inputValue(),'draft');await saveContent();
  await publicPage.reload();assert.equal(await publicPage.locator('#testimonials-grid .testimonial-card').count(),0);
  await page.getByLabel('Izin publikasi dari pemberi testimoni',{exact:true}).selectOption('granted');
  assert.equal(await page.getByLabel('Status publikasi',{exact:true}).inputValue(),'draft');
  await page.getByLabel('Status publikasi',{exact:true}).selectOption('published');await saveContent();
  await page.getByRole('button',{name:'SEO & Mesin Pencari',exact:true}).click();
  console.log('Community checks passed: local logos, FAQ keyboard controls, admin publishing, private drafts, testimonial consent, and mobile layout.');
 }finally{await publicPage.close()}
}
module.exports={checkCommunity};
