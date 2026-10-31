'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');

async function checkSplash(browser,base,review){
 async function heldPage(viewport,locale){
  const context=await browser.newContext({viewport,reducedMotion:'no-preference'}),page=await context.newPage();
  let release,requested;
  const held=new Promise(resolve=>release=resolve),seen=new Promise(resolve=>requested=resolve);
  await page.route('**/js/app.js*',async route=>{requested();await held;await route.continue()});
  await page.goto(`${base}/?lang=${locale}`,{waitUntil:'commit'});await seen;
  await page.locator('#site-splash').waitFor({state:'visible'});
  assert.equal(await page.locator('#main').getAttribute('inert'),'');
  return {context,page,release};
 }
 const desktop=await heldPage({width:1440,height:900},'id');
 try{
  const name=JSON.parse(await desktop.page.locator('#portfolio-bootstrap').textContent()).content.fullName;
  assert.equal(await desktop.page.locator('#splash-name').textContent(),name);
  await desktop.page.screenshot({path:path.join(review,'splash-desktop.png')});
  desktop.release();await desktop.page.locator('#site-splash').waitFor({state:'hidden',timeout:4000});
  assert.equal(await desktop.page.locator('#main').getAttribute('inert'),null);
  assert.equal(await desktop.page.locator('#hero-title').isVisible(),true);
 }finally{desktop.release();await desktop.context.close()}
 const mobile=await heldPage({width:375,height:812},'en');
 try{
  await mobile.page.screenshot({path:path.join(review,'splash-mobile.png')});
  assert.ok(await mobile.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mobile.page.getByRole('button',{name:'Skip intro',exact:false}).click();
  assert.equal(await mobile.page.locator('#site-splash').isVisible(),false);
  assert.equal(await mobile.page.locator('#main').getAttribute('inert'),null);
  mobile.release();await mobile.page.waitForLoadState('load');
 }finally{mobile.release();await mobile.context.close()}
 const fallbackContext=await browser.newContext({reducedMotion:'no-preference'}),fallback=await fallbackContext.newPage();
 try{
  await fallback.route('**/js/app.js*',route=>route.abort());
  await fallback.goto(base+'/?lang=id');
  await fallback.locator('#site-splash').waitFor({state:'hidden',timeout:4500});
  assert.equal(await fallback.locator('#main').getAttribute('inert'),null);
  assert.equal(await fallback.locator('#hero-title').isVisible(),true);
 }finally{await fallbackContext.close()}
 const reducedContext=await browser.newContext({reducedMotion:'reduce'}),reduced=await reducedContext.newPage();
 try{
  await reduced.goto(base+'/?lang=id');assert.equal(await reduced.locator('#site-splash').isVisible(),false);
  assert.equal(await reduced.locator('#main').getAttribute('inert'),null);
 }finally{await reducedContext.close()}
 console.log('Splash checks passed: desktop/mobile, profile identity, early skip during script loading, readiness, missing-script fallback, and reduced motion.');
}
module.exports={checkSplash};
