(() => {
 'use strict';
 const root=document.documentElement;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
 if(root.dataset.splash==='off'||root.dataset.motion==='reduced'||reduced.matches||new URLSearchParams(location.search).has('project'))return;
 const started=performance.now(),minimum=700,maximum=3000;
 let active=true,closing=false,mounted=false,readyTimer=null,exitTimer=null,protectedNodes=[],observer=null;
 root.classList.add('splash-active');
 function releaseContent(){for(const node of protectedNodes)node.inert=false;protectedNodes=[]}
 function complete(){
  clearTimeout(readyTimer);clearTimeout(exitTimer);clearTimeout(failsafe);
  observer?.disconnect();
  const splash=document.getElementById('site-splash'),skip=document.getElementById('splash-skip'),restoreFocus=skip&&document.activeElement===skip;
  active=false;root.classList.remove('splash-active','splash-leaving');releaseContent();
  if(splash){splash.hidden=true;splash.setAttribute('aria-hidden','true')}
  if(restoreFocus)document.querySelector('.skip-link')?.focus();
 }
 function dismiss(immediate=false){
  if(!active)return;
  if(immediate){complete();return}
  if(closing)return;
  closing=true;root.classList.add('splash-leaving');releaseContent();exitTimer=setTimeout(complete,260);
 }
 function finish(){
  if(!active||closing)return;
  updateLabels();
  clearTimeout(readyTimer);readyTimer=setTimeout(()=>dismiss(),Math.max(0,minimum-(performance.now()-started)));
 }
 const failsafe=setTimeout(()=>dismiss(true),maximum);
 function updateLabels(){
  const splash=document.getElementById('site-splash');
  const skip=document.getElementById('splash-skip');if(!splash||!skip)return;
  const english=root.lang==='en';
  splash.setAttribute('aria-label',english?'Loading portfolio':'Memuat portofolio');
  document.getElementById('splash-status').textContent=english?'Preparing your portfolio…':'Menyiapkan portofolio…';
  document.getElementById('splash-hint').textContent=english?'My story, work, and experience.':'Cerita, karya, dan pengalaman saya.';
  skip.firstChild.textContent=english?'Skip intro ':'Langsung masuk ';
  try{
   const bootstrap=JSON.parse(document.getElementById('portfolio-bootstrap')?.textContent||'null');
   const content=bootstrap?.content||window.PORTFOLIO_SEED?.[root.lang];
   if(content){document.getElementById('splash-name').textContent=content.fullName;document.getElementById('splash-initials').textContent=Array.from(content.initials||'').slice(0,2).join('')}
  }catch{}
 }
 function bind(){
  if(!active||closing)return;
  const splash=document.getElementById('site-splash'),skip=document.getElementById('splash-skip');
  if(!splash||!skip)return;
  if(getComputedStyle(splash).display!=='grid'){dismiss(true);return}
  if(!mounted){mounted=true;updateLabels();skip.addEventListener('click',()=>dismiss(true))}
  for(const node of document.body.children){if(node===splash||['SCRIPT','STYLE','SVG','DIALOG'].includes(node.tagName)||node.inert)continue;node.inert=true;protectedNodes.push(node)}
 }
 observer=new MutationObserver(bind);observer.observe(root,{childList:true,subtree:true});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
 document.addEventListener('keydown',event=>{if(active&&event.key==='Escape')dismiss(true)});
 reduced.addEventListener('change',event=>{if(event.matches)dismiss(true)});
 window.addEventListener('pagehide',()=>dismiss(true),{once:true});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active&&performance.now()-started>=maximum)dismiss(true)});
 window.PortfolioSplash={finish};
})();
