'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const OTPAuth=require('otpauth');
async function checkSearchConsole(page,base){
 await page.locator('.gsc-status').filter({hasText:'Website masih lokal'}).waitFor();
 await page.getByLabel('Tempel tag verifikasi dari Google (opsional)').fill('<meta name="google-site-verification" content="browser-verification-token">');
 await page.getByRole('button',{name:'Ambil token dari tag',exact:true}).click();
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('input')).some(input=>input.value==='browser-verification-token'));
 assert.equal(await page.getByLabel('Token verifikasi Google Search Console',{exact:true}).inputValue(),'browser-verification-token');
 // The caller saves the SEO form; verification stays an explicit action in Google.
 assert.equal(await page.getByRole('link',{name:'Buka Google Search Console'}).getAttribute('href'),'https://search.google.com/search-console/welcome');
}
async function checkMFA(page,base,password,review){
 const saved=async()=>{await page.getByLabel('Saya sudah menyimpan kode pemulihan di tempat yang aman.').check();await page.getByRole('button',{name:'Selesai',exact:true}).click();await page.locator('.mfa-badge.enabled').waitFor()};
 const login=async()=>{await page.locator('#logout-button-top').click();await page.getByLabel('Alamat email').fill('browser@example.com');await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Masuk ke Dashboard'}).click();await page.locator('#mfa-login-form').waitFor();assert.equal(await page.locator('#admin-layout').isVisible(),false)};
 await page.getByLabel('Password akun untuk MFA',{exact:true}).fill(password);await page.getByRole('button',{name:'Mulai setup MFA',exact:true}).click();
 const secret=await page.getByLabel('Kunci setup manual',{exact:true}).inputValue();assert.ok(secret.length>=32);
 const totp=new OTPAuth.TOTP({secret:OTPAuth.Secret.fromBase32(secret),algorithm:'SHA1',digits:6,period:30});
 await page.getByLabel('Konfirmasi password akun',{exact:true}).fill(password);await page.getByLabel('Kode autentikator untuk aktivasi',{exact:true}).fill(totp.generate());
 await page.getByRole('button',{name:'Aktifkan MFA',exact:true}).click();await page.getByRole('heading',{name:'Simpan kode pemulihan',exact:true}).waitFor();
 const codes=await page.locator('.mfa-recovery-list code').allTextContents();assert.equal(codes.length,10);
 const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Unduh kode pemulihan',exact:true}).click();const download=await downloadEvent;assert.equal(download.suggestedFilename(),'portfolio-mfa-recovery-codes.txt');await download.delete();
 assert.equal(await page.getByRole('button',{name:'Selesai',exact:true}).isDisabled(),true);await saved();
 assert.equal(await page.getByLabel('Kunci setup manual',{exact:true}).count(),0);assert.ok(await page.getByLabel('Kode faktor kedua untuk ganti password',{exact:true}).isVisible());
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('.mfa-card').screenshot({path:path.join(review,'admin-mfa-active-mobile.png')});
 await login();await page.screenshot({path:path.join(review,'admin-mfa-login-mobile.png'),fullPage:true});
 // Enrollment consumed the current time step. Use the next accepted step for login.
 await page.getByLabel('Kode autentikator',{exact:true}).fill(totp.generate({timestamp:Date.now()+30000}));await page.getByRole('button',{name:'Verifikasi & Masuk',exact:true}).click();await page.getByRole('heading',{name:'Keamanan',exact:true}).waitFor();
 await page.getByLabel('Password akun untuk perubahan MFA',{exact:true}).fill(password);await page.getByLabel('Kode autentikator atau kode pemulihan',{exact:true}).fill(codes[0]);
 await page.getByRole('button',{name:'Buat ulang kode pemulihan',exact:true}).click();await page.getByRole('heading',{name:'Simpan kode pemulihan',exact:true}).waitFor();
 const replacement=await page.locator('.mfa-recovery-list code').allTextContents();assert.equal(replacement.length,10);assert.ok(!replacement.includes(codes[0]));await saved();
 await login();await page.getByRole('button',{name:'Gunakan kode pemulihan',exact:true}).click();await page.getByLabel('Kode pemulihan',{exact:true}).fill(replacement[0]);await page.getByRole('button',{name:'Verifikasi & Masuk',exact:true}).click();await page.getByRole('heading',{name:'Keamanan',exact:true}).waitFor();
 await page.getByLabel('Password akun untuk perubahan MFA',{exact:true}).fill(password);await page.getByLabel('Kode autentikator atau kode pemulihan',{exact:true}).fill(replacement[1]);await page.getByRole('button',{name:'Nonaktifkan MFA',exact:true}).click();await page.getByRole('button',{name:'Mulai setup MFA',exact:true}).waitFor();
 assert.equal(await page.getByLabel('Kode faktor kedua untuk ganti password',{exact:true}).count(),0);
 const html=await fetch(base+'/?lang=id').then(response=>response.text());assert.ok(html.includes('name="google-site-verification" content="browser-verification-token"'));
}
module.exports={checkMFA,checkSearchConsole};
