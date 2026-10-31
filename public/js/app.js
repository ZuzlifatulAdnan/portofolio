(async () => {
  'use strict';
  let bootstrap=null;
  try{bootstrap=JSON.parse(document.getElementById('portfolio-bootstrap')?.textContent||'null')}catch{}
  const params = new URLSearchParams(location.search);
  const localeFromUrl = params.get('lang');
  let savedLocale = 'id';
  try { savedLocale = localStorage.getItem('personal-portfolio-lang') || 'id'; } catch (_) {}
  const locale = bootstrap?.locale || (['id','en'].includes(localeFromUrl) ? localeFromUrl : (['id','en'].includes(savedLocale) ? savedLocale : 'id'));
  try { localStorage.setItem('personal-portfolio-lang',locale); } catch (_) {}
  document.documentElement.lang = locale;
  const t = key => (window.PORTFOLIO_UI?.[locale]?.[key] ?? window.PORTFOLIO_UI?.id?.[key] ?? key);
  let hasBackend = Boolean(bootstrap);
  let P = bootstrap?.content || window.PORTFOLIO_SEED?.[locale];
  if (!bootstrap && location.protocol !== 'file:') {
    try {
      const response = await fetch(`/api/public/content?lang=${locale}`, { credentials:'same-origin', cache:'no-store' });
      if (response.ok) {
        const payload = await response.json();
        if (payload && payload.content && payload.content.projects) { P = payload.content; hasBackend = true; }
      }
    } catch (_) { /* Static preview: use bundled seed content. */ }
  }
  if (!P) return;
  document.querySelectorAll('[data-i18n]').forEach(el=> { el.textContent=t(el.dataset.i18n); });
  // Only authored, version-controlled UI translations use innerHTML, never admin input.
  document.querySelectorAll('[data-i18n-html]').forEach(el=> { el.innerHTML=t(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el=> { el.placeholder=t(el.dataset.i18nPlaceholder); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el=> { el.setAttribute('aria-label',t(el.dataset.i18nAria)); });
  document.querySelectorAll('[data-lang]').forEach(button => {
    button.setAttribute('aria-pressed',String(button.dataset.lang===locale));
    button.addEventListener('click',() => {
      if (button.dataset.lang===locale) return;
      const next=button.dataset.lang;
      try{localStorage.setItem('personal-portfolio-lang',next)}catch(_){}
      const nextUrl=new URL(location.href);nextUrl.searchParams.set('lang',next);
      location.href=nextUrl.href;
    });
  });
  if(!bootstrap){
   document.querySelector('meta[name="description"]')?.setAttribute('content',t('seoDescription'));
   document.querySelector('meta[property="og:description"]')?.setAttribute('content',t('seoDescription'));
   document.querySelector('meta[property="og:title"]')?.setAttribute('content',`${P.fullName || 'Personal Portfolio'} — ${locale === 'en' ? 'IT Developer Portfolio' : 'Portofolio IT Developer'}`);
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const icon = (name, cls = '') => `<svg class="icon ${esc(cls)}" aria-hidden="true"><use href="#i-${/^[a-z][a-z0-9-]{0,40}$/.test(name)?name:'code'}"></use></svg>`;
  const mediaPath = (path) => typeof path === 'string' && /^(?:assets\/|\.\/?\/)/.test(path) && !path.includes('..') ? path : '';
  const safeExternal = (url) => { try { const u = new URL(url); return ['http:','https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animationsDisabled=document.documentElement.dataset.motion==='reduced';

  // Identity, basic metadata, and personal links.
  // This is an individual's portfolio. Use their full name everywhere, not a company name.
  const brand = String(P.fullName || P.brand || 'Personal Portfolio').trim();
  const words = brand.split(/\s+/).filter(Boolean);
  const first = words[0] || 'My';
  const last = words.length > 1 ? words[words.length - 1] : 'Portfolio';
  document.querySelectorAll('[data-person-name]').forEach(node => {
    node.innerHTML = `${esc(first)}<span>${esc(last)}.</span>`;
    node.closest('a')?.setAttribute('aria-label',`${brand} — ${locale === 'en' ? 'back to home' : 'kembali ke beranda'}`);
  });
  $('#hero-person-name').innerHTML = `${locale === 'en' ? "HELLO, I'M" : 'HALO, SAYA'} <strong>${esc(brand)}</strong> <span class="name-arrow">↗</span>`;
  document.title = bootstrap?.meta?.title || `${brand} — ${locale === 'en' ? 'Personal IT Developer Portfolio' : 'Portofolio Pribadi IT Developer'}`;
  document.querySelector('meta[name="author"]')?.setAttribute('content', brand);
  $('#footer-brand').textContent = brand;
  $('#year').textContent = new Date().getFullYear();
  $('#hero-role').textContent = P.heroRole;
  $('#hero-description').textContent = P.heroDescription;
  $('#hero-title').innerHTML = `${esc(P.heroHeading[0])}<br>${esc(P.heroHeading[1])} <em>${esc(P.heroHeading[2])}</em>`;
  $('#hero-location').textContent = P.location;
  $('#contact-location').textContent = P.location;
  $('#availability-text').textContent = P.availabilityText;
  $('#contact-availability').textContent = P.availabilityText;
  $('#contact-email').href = `mailto:${encodeURIComponent(P.email).replace('%40','@')}`;
  $('#contact-email').innerHTML = `${esc(P.email)} ${icon('arrow-up-right')}`;
  $('#about-bio').innerHTML = P.bio.map(paragraph => `<p>${esc(paragraph)}</p>`).join('');
  $('#about-quote').textContent = P.aboutQuote;
  const cvPath = mediaPath(P.cvUrl);
  if (cvPath) { $('#cv-link').hidden = false; $('#cv-link').href = cvPath; $('#cv-link').setAttribute('download',''); }
  const photoPath = mediaPath(P.avatarUrl);
  if (photoPath) { $('#portrait-frame').innerHTML = `<img src="${esc(photoPath)}" alt="Foto profil ${esc(P.fullName)}" loading="lazy">`; }
  else { $('.about-avatar-placeholder > span').innerHTML = esc(P.initials.slice(0,1)) + `<span>${esc(P.initials.slice(1,2))}</span>`; }
  $('#social-links').innerHTML = (P.socials || []).filter(s => safeExternal(s.url)).map(s => `<a href="${esc(safeExternal(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.label)} ${icon('external')}</a>`).join('');

  // Ticker duplicates the content exactly, enabling a seamless CSS loop.
  const tickerWords = locale==='en' ? ['WEB DEVELOPMENT','MOBILE APPLICATIONS','NETWORK ENGINEERING','IT SUPPORT','SYSTEM INTEGRATION','DIGITAL SOLUTIONS'] : ['PENGEMBANGAN WEB','APLIKASI MOBILE','REKAYASA JARINGAN','DUKUNGAN IT','INTEGRASI SISTEM','SOLUSI DIGITAL'];
  const tickerRun = tickerWords.map(word => `<span class="ticker-item"><span>${word}</span><span class="star">✳</span></span>`).join('');
  $('#ticker-track').innerHTML = `<div class="ticker-run">${tickerRun}</div><div class="ticker-run" aria-hidden="true">${tickerRun}</div>`;

  // Service cards.
  $('#service-grid').innerHTML = P.services.map((s,i) => `<article class="service-card ${esc(s.tone)} reveal" style="transition-delay:${i*75}ms"><div class="service-card-top"><span class="service-icon">${icon(s.icon)}</span><span class="service-number">${esc(s.number)} / 04</span></div><div class="service-content"><div class="service-label">${esc(s.label)}</div><h3>${esc(s.title)}</h3><p>${esc(s.summary)}</p><div class="service-tags">${s.tags.map(window.PortfolioTech.tag).join('')}</div></div></article>`).join('');

  // Portfolio visual concepts. No image here is presented as a real project screenshot.
  function artMarkup(project) {
    const realImage = mediaPath(project.image);
    if (realImage) return `<div class="project-preview" data-art="${esc(project.art)}"><img class="real-project-image" src="${esc(realImage)}" alt="Dokumentasi proyek: ${esc(project.title)}" loading="lazy"></div>`;
    let drawing = '';
    switch (project.art) {
      case 'dashboard':
        drawing = `<div class="mock-browser"><div class="mock-browser-bar"><i></i><i></i><i></i></div><div class="mock-body"><div class="mock-side"><span></span><span></span><span></span><span></span><span></span><span></span></div><div class="mock-main"><div class="mock-heading"></div><div class="mock-stats"><span></span><span></span><span></span></div><div class="mock-chart"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div></div></div>`; break;
      case 'mobile':
        drawing = `<div class="art-mobile">${[true,false].map(secondary => `<div class="phone-frame ${secondary?'secondary':''}"><div class="phone-notch"></div><div class="phone-screen"><div class="screen-head"></div><div class="phone-card"><i></i><i></i></div><div class="phone-rows"><span></span><span></span></div><div class="phone-action"></div></div></div>`).join('')}</div>`; break;
      case 'knowledge':
        drawing = `<div class="art-knowledge"><div class="knowledge-card back"><div class="knowledge-icon">▣</div><div class="knowledge-line"></div><div class="knowledge-line short"></div></div><div class="knowledge-card"><div class="knowledge-icon">✳</div><div class="knowledge-line"></div><div class="knowledge-line short"></div></div></div>`; break;
      case 'api':
        drawing = `<div class="art-api"><svg class="api-lines" viewBox="0 0 600 310" preserveAspectRatio="none" fill="none" stroke-width="1.5"><path d="M125 95 300 155 477 112M129 240 300 155 481 231" stroke-dasharray="7 8" /></svg><div class="api-hub">API</div><div class="api-node">WEB</div><div class="api-node">APP</div><div class="api-node">DATA</div><div class="api-node">AUTH</div></div>`; break;
      case 'network':
        drawing = `<div class="art-network"><svg class="net-lines" viewBox="0 0 600 310" preserveAspectRatio="none" fill="none" stroke-width="1.5"><path d="M148 87 300 157 457 92M148 239 300 157 455 242M148 87 148 239M457 92 455 242" stroke-dasharray="7 8" /></svg><div class="net-node center">CORE</div><div class="net-node n1">WAN</div><div class="net-node n2">FW</div><div class="net-node n3">LAN</div><div class="net-node n4">VPS</div></div>`; break;
      case 'terminal':
        drawing = `<div class="art-terminal"><div class="terminal-window"><div class="terminal-top"><i></i><i></i><i></i></div><div class="terminal-lines"><div><b>➜</b> ~/deploy $ <em>npm run build</em></div><div><span>✓ modules transformed</span></div><div><b>➜</b> ~/deploy $ <em>php artisan optimize</em></div><div><span>✓ cache cleared</span></div><div><b>➜</b> ~/deploy $ <em>systemctl status app</em></div><div><b>● active (running)</b></div></div></div></div>`; break;
      default: drawing = `<div class="api-hub">&lt;/&gt;</div>`;
    }
    return `<div class="project-preview" data-art="${esc(project.art)}"><div class="art"><div class="shine"></div>${drawing}</div><span class="art-photo-label">${esc(t('conceptVisual'))}</span></div>`;
  }

  // Filter and work cards.
  const filterList = [['all',t('filtersAll')],['web',t('filtersWeb')],['mobile',t('filtersMobile')],['network',t('filtersNetwork')],['support',t('filtersSupport')]];
  const filterRoot = $('#project-filters');
  filterRoot.innerHTML = filterList.map(([key,label],idx) => `<button type="button" class="filter-btn" data-filter="${key}" aria-pressed="${idx===0}">${label}</button>`).join('');
  const projectsRoot = $('#projects-grid');
  const visibleProjects=P.projects.filter(p=>['demo','published'].includes(p.visibility));
  projectsRoot.innerHTML = visibleProjects.map((p,i) => `<article class="project-card reveal" data-category="${esc(p.category)}" style="transition-delay:${i%2*80}ms"><div class="project-preview-wrap" style="position:relative">${artMarkup(p)}<span class="project-preview-label">${esc(p.status.toUpperCase())}</span><span class="project-arrow">${icon('arrow-up-right')}</span><button type="button" class="card-open-button" data-open-project="${esc(p.id)}" aria-label="${esc(t('openProject'))} ${esc(p.title)}"></button></div><div class="project-info"><div class="project-meta"><span class="project-type">${esc(p.categoryLabel)}</span><span class="project-index">${esc(p.year)} / ${String(visibleProjects.length).padStart(2,'0')}</span></div><h3>${esc(p.title)}</h3><p class="project-subtitle">${esc(p.subtitle)}</p><div class="project-tag-row">${p.tags.map(window.PortfolioTech.tag).join('')}</div></div></article>`).join('');
  let currentFilter = 'all';
  function setFilter(next) {
    currentFilter = next;
    $$('.filter-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === next)));
    let count = 0;
    $$('.project-card').forEach(card => { const visible = next === 'all' || card.dataset.category === next; card.classList.toggle('project-hidden', !visible); if (visible) count++; });
    $('#project-count').textContent = `${String(count).padStart(2,'0')} ${count===1?t('projectCountSingle'):t('projectCount')}`;
  }
  filterRoot.addEventListener('click', event => { const btn=event.target.closest('[data-filter]'); if (btn) setFilter(btn.dataset.filter); });

  // Case-study detail modal.
  const modal = $('#project-modal');
  let lastFocused = null;
  function openProject(id) {
    const project = visibleProjects.find(p => p.id === id);
    if (!project) return;
    lastFocused = document.activeElement;
    const links = [[t('linkLive'),project.link],[t('linkRepo'),project.github]]
      .filter(([,url]) => safeExternal(url)).map(([label,url]) => `<a class="btn btn-outline" href="${esc(safeExternal(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} ${icon('external')}</a>`).join('');
    $('#modal-content').innerHTML = `
      <span class="modal-eyebrow">${esc(project.categoryLabel)} &nbsp;/&nbsp; ${esc(project.status)}</span>
      <h2 id="modal-title">${esc(project.title)}</h2><p class="modal-subtitle">${esc(project.subtitle)}</p>
      <div class="modal-pills">${project.tags.map(window.PortfolioTech.tag).join('')}<span>${esc(project.role)}</span></div>
      <div class="modal-hero-art">${artMarkup(project)}</div>
      <div class="modal-grid"><div class="modal-section"><h3>${esc(t('modalChallenge'))}</h3><p>${esc(project.challenge)}</p></div><div class="modal-section"><h3>${esc(t('modalApproach'))}</h3><p>${esc(project.solution)}</p></div></div>
      <div class="modal-section" style="margin-top:23px"><h3>${esc(t('modalHighlights'))}</h3><ul class="modal-list">${project.highlights.map(item => `<li>${icon('check')} ${esc(item)}</li>`).join('')}</ul></div>
      <div class="modal-result"><b>${esc(t('modalOutcome'))}</b><p>${esc(project.result)}</p></div>
      ${links ? `<div class="modal-actions">${links}</div>` : `<p class="modal-empty">${esc(t('modalNoLink'))}</p>`}`;
    modal.showModal();
    document.body.classList.add('modal-open');
    $('#modal-close').focus();
    try { const url=new URL(window.location.href); url.searchParams.set('project',id); history.replaceState({},'',url); } catch (_) {}
  }
  function closeProject() {
    if (modal.open) modal.close();
  }
  projectsRoot.addEventListener('click',event => { const button=event.target.closest('[data-open-project]'); if(button) openProject(button.dataset.openProject); });
  $('#modal-close').addEventListener('click', closeProject);
  modal.addEventListener('click', e => { if(e.target===modal) closeProject(); });
  modal.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    if (lastFocused && lastFocused.isConnected) lastFocused.focus();
    try { const url=new URL(window.location.href); url.searchParams.delete('project'); history.replaceState({},'',url); } catch (_) {}
  });
  try { const requestedId = new URLSearchParams(window.location.search).get('project'); if (requestedId) openProject(requestedId); } catch (_) {}

  // Timeline, skills and professional certificates.
  $('#experience-timeline').innerHTML = P.experiences.map((e,i) => `<article class="timeline-item reveal" style="transition-delay:${i*70}ms"><span class="timeline-type">${esc(e.type)}</span><h3>${esc(e.title)}</h3><p>${esc(e.detail)}</p><div class="timeline-points">${e.points.map(p=>`<span>${esc(p)}</span>`).join('')}</div></article>`).join('');
  $('#skills-groups').innerHTML = P.skills.map(s => `<div class="skills-group"><h4>${icon(s.icon)} ${esc(s.title)}</h4><ul>${s.items.map(window.PortfolioTech.skill).join('')}</ul></div>`).join('');
  $('#cert-grid').innerHTML = P.certifications.map((c,i) => {
    const url = safeExternal(c.url);
    const photo = mediaPath(c.image);
    return `<article class="cert-card reveal" style="transition-delay:${i*120}ms"><div class="cert-top"><div class="cert-issuer ${c.issuer==='BNSP'?'':'other'}">${esc(c.issuer)}</div><span class="cert-status">${esc(c.status)}</span></div><h3>${esc(c.name)}</h3><p class="cert-subtitle">${esc(c.subtitle)}</p><div class="cert-foot"><span>${esc(c.year)} · ${esc(c.number)}</span>${url ? `<a class="cert-view" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(t('verifyCert'))} ${icon('external')}</a>` : photo ? `<a class="cert-view" href="${esc(photo)}" target="_blank" rel="noopener noreferrer">${esc(t('viewCert'))} ${icon('external')}</a>` : `<span>${esc(t('uploadProof'))} ↗</span>`}</div><span class="cert-watermark" aria-hidden="true">${esc(c.issuer)}</span></article>`;
  }).join('');
  $('#process-grid').innerHTML = P.steps.map((s,i) => `<div class="process-item reveal" style="transition-delay:${i*90}ms"><div class="process-number">${esc(s.number)} / 05</div><h3>${esc(s.title)}</h3><p>${esc(s.subtitle)}</p></div>`).join('');
  $('#contact .section-num').textContent='09 /';
  $('#testimonials-grid').innerHTML=window.PortfolioSections.testimonials(P.testimonials,window.PORTFOLIO_UI[locale]);
  $('#faq-list').innerHTML=window.PortfolioSections.faqs(P.faqs,window.PORTFOLIO_UI[locale]);

  // Contact: save into the database when the backend is active. Static preview falls back to mailto.
  const contactForm = $('#contact-form');
  contactForm.addEventListener('submit',async event => {
    event.preventDefault();
    if (!contactForm.reportValidity()) return;
    const form = new FormData(contactForm);
    const payload = { name:String(form.get('name')||''), email:String(form.get('email')||''),
      topic:String(form.get('topic')||''), message:String(form.get('message')||''),
      website:String(form.get('website')||''), locale };
    const button=contactForm.querySelector('[type="submit"]');
    if (hasBackend) {
      button.disabled=true;
      try {
        const response=await fetch('/api/public/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),credentials:'same-origin'});
        if(!response.ok) throw new Error('Contact submission failed');
        contactForm.reset();toast(t('contactSuccess'));
      } catch (_) { toast(t('contactError')); }
      finally { button.disabled=false; }
    } else {
      const subject = `[Portfolio] ${payload.topic.slice(0,100)} — ${payload.name.slice(0,80)}`;
      const body = [`Hello ${brand},`,'',`Name: ${payload.name}`,`Email: ${payload.email}`,`Category: ${payload.topic}`,'',payload.message].join('\n');
      location.href = `mailto:${encodeURIComponent(P.email).replace('%40','@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      toast(t('contactFallback'));
    }
  });
  if(!hasBackend) {
    const submitText=contactForm.querySelector('.form-submit [data-i18n]');
    if(submitText) submitText.textContent=t('mailtoContact');
  }
  let toastTimer;
  function toast(message) {
    const element = $('#toast');
    element.textContent = message; element.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(()=>element.classList.remove('show'),4200);
  }

  // Theme toggle — persists preference on the visitor's device.
  $('#theme-toggle').addEventListener('click',()=> {
    const next = document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
    document.documentElement.setAttribute('data-theme',next);
    try{localStorage.setItem('personal-portfolio-theme',next)}catch(_){}
  });

  // Mobile menu with inert hidden links; active anchor closes it.
  const menuToggle=$('#menu-toggle'), menu=$('#mobile-nav');
  function setMenu(open){ menuToggle.setAttribute('aria-expanded',String(open)); menuToggle.setAttribute('aria-label',open?t('menuClose'):t('menuOpen')); menu.classList.toggle('open',open); menu.inert=!open; document.body.classList.toggle('menu-open',open); }
  menuToggle.addEventListener('click',()=>setMenu(menuToggle.getAttribute('aria-expanded')!=='true'));
  menu.addEventListener('click',e=>{if(e.target.closest('a'))setMenu(false)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape' && menuToggle.getAttribute('aria-expanded')==='true'){setMenu(false);menuToggle.focus()}});
  window.matchMedia('(min-width: 901px)').addEventListener('change',e=>{if(e.matches)setMenu(false)});

  // Reveal-on-scroll staggered animations; show instantly when reduced motion is enabled.
  function observeReveals() {
    const elements = $$('.reveal');
    if (animationsDisabled || reduceMotion.matches || !('IntersectionObserver' in window)) { elements.forEach(el => el.classList.add('in-view')); return; }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if(entry.isIntersecting){entry.target.classList.add('in-view');observer.unobserve(entry.target)} });
    },{threshold:.09,rootMargin:'0px 0px -32px 0px'});
    elements.forEach(el=>observer.observe(el));
  }
  observeReveals();

  // Header elevation, scroll line, and active section indicator.
  const header=$('#site-header'),scrollProgress=$('#scroll-progress');
  let scrollScheduled=false;
  function onScroll(){
    if (scrollScheduled) return;
    scrollScheduled=true;
    requestAnimationFrame(()=>{
      const y=window.scrollY;
      header.classList.toggle('scrolled',y>32);
      const available=Math.max(1,document.documentElement.scrollHeight-window.innerHeight);
      scrollProgress.style.transform=`scaleX(${Math.min(1,y/available)})`;
      scrollScheduled=false;
    });
  }
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();
  const watchSections=['home','expertise','work','about','credentials'].map(id=>$('#'+id));
  if ('IntersectionObserver' in window){
    const navObserver=new IntersectionObserver(entries => {
      entries.forEach(entry => { if(entry.isIntersecting) $$('[data-nav]').forEach(link=>link.classList.toggle('active',link.dataset.nav===entry.target.id)); });
    },{rootMargin:'-26% 0px -62% 0px',threshold:0});
    watchSections.forEach(el=>el&&navObserver.observe(el));
  }

  // Pointer spotlight, magnetic buttons and depth effects, only on non-touch devices.
  const finePointer=matchMedia('(hover: hover) and (pointer: fine)').matches;
  if(finePointer && !animationsDisabled && !reduceMotion.matches){
    const glow=$('#cursor-glow');
    let glowX=0,glowY=0,raf=0;
    document.addEventListener('pointermove',e=>{ glowX=e.clientX;glowY=e.clientY;glow.classList.add('visible');if(raf)return;raf=requestAnimationFrame(()=>{glow.style.left=glowX+'px';glow.style.top=glowY+'px';raf=0}) },{passive:true});
    document.addEventListener('pointerleave',()=>glow.classList.remove('visible'));
    const art=$('#hero-art'),editor=$('#editor-card');
    art.addEventListener('pointermove',e=>{ const r=art.getBoundingClientRect(),dx=(e.clientX-r.left)/r.width-.5,dy=(e.clientY-r.top)/r.height-.5;editor.style.transform=`translateX(-50%) rotate(${(-5+dy*4).toFixed(2)}deg) rotateY(${(-7+dx*13).toFixed(2)}deg) rotateX(${(-dy*9).toFixed(2)}deg)` },{passive:true});
    art.addEventListener('pointerleave',()=>editor.style.transform='');
    $$('.magnetic').forEach(btn=>{
      btn.addEventListener('pointermove',e=>{ const r=btn.getBoundingClientRect();btn.style.transform=`translate(${((e.clientX-r.left)/r.width-.5)*7}px,${((e.clientY-r.top)/r.height-.5)*7}px)` },{passive:true});
      btn.addEventListener('pointerleave',()=>btn.style.transform='');
    });
  }

  // Ambient particle network uses canvas and pauses when backgrounded.
  function initParticles() {
    const canvas=$('#particle-canvas');
    const ctx=canvas.getContext('2d',{alpha:true});
    if (!ctx || animationsDisabled || reduceMotion.matches) return;
    let particles=[],width=0,height=0,animationId=0,previous=0;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    function resize(){
      const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;
      canvas.width=Math.max(1,Math.round(width*dpr));canvas.height=Math.max(1,Math.round(height*dpr));
      ctx.setTransform(dpr,0,0,dpr,0,0);
      const n=Math.min(45,Math.max(22,Math.floor(width/35)));
      particles=Array.from({length:n},()=>({x:Math.random()*width,y:Math.random()*height,vx:(Math.random()-.5)*.23,vy:(Math.random()-.5)*.20,r:Math.random()*1.3+.5}));
    }
    function frame(time){
      if(time-previous<32){animationId=requestAnimationFrame(frame);return}previous=time;
      ctx.clearRect(0,0,width,height);
      const accent=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#c9fb74';
      ctx.fillStyle=accent;ctx.strokeStyle=accent;
      particles.forEach((p,i)=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>width)p.vx*=-1;if(p.y<0||p.y>height)p.vy*=-1;ctx.globalAlpha=.22;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
        for(let j=i+1;j<particles.length;j++){const q=particles[j];const dx=p.x-q.x,dy=p.y-q.y,dist=dx*dx+dy*dy;if(dist<13500){ctx.globalAlpha=(1-dist/13500)*.11;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke()}}
      }); ctx.globalAlpha=1;animationId=requestAnimationFrame(frame);
    }
    resize();animationId=requestAnimationFrame(frame);
    let resizeTimer;
    window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(resize,150)},{passive:true});
    document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(animationId);if(!document.hidden)animationId=requestAnimationFrame(frame)});
    reduceMotion.addEventListener('change',e=>{cancelAnimationFrame(animationId);if(!e.matches)animationId=requestAnimationFrame(frame)});
  }
  initParticles();
})().catch(error => console.error('Portfolio initialization failed:', error)).finally(()=>window.PortfolioSplash?.finish());
