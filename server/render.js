'use strict';
const fs=require('node:fs');
const path=require('node:path');
const cheerio=require('cheerio');
const tech=require('../public/js/technology');
const sections=require('../public/js/portfolio-sections');
const {ROOT}=require('./config');
const template=fs.readFileSync(path.join(ROOT,'public/index.html'),'utf8');
const dictionaries=JSON.parse(fs.readFileSync(path.join(ROOT,'data/seed/ui.json'),'utf8'));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json=value=>JSON.stringify(value).replace(/[<>&\u2028\u2029]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
const external=value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:''}catch{return ''}};
function siteOrigin(settings){return (settings.siteUrl||process.env.APP_ORIGIN||`http://127.0.0.1:${process.env.PORT||3000}`).replace(/\/$/,'')}
function metadata(settings,content,locale){
 const seo=settings.seo[locale];
 const origin=siteOrigin(settings);
 return {
  title:seo.title||`${content.fullName} — ${locale==='en'?'IT Developer Portfolio':'Portofolio IT Developer'}`,
  description:seo.description||content.heroDescription.slice(0,160),
  canonical:`${origin}/?lang=${locale}`,
  image:seo.image?`${origin}/${seo.image}`:'',imageAlt:seo.imageAlt||content.fullName,
  robots:settings.indexing?'index,follow,max-image-preview:large':'noindex,nofollow'
 };
}
function renderPage(settings,content,locale){
 const $=cheerio.load(template),ui=dictionaries[locale],meta=metadata(settings,content,locale),origin=siteOrigin(settings);
 const a=settings.appearance;
 $('html').attr({lang:locale,'data-theme':a.defaultTheme==='system'?'dark':a.defaultTheme,'data-default-theme':a.defaultTheme,'data-motion':a.animations?'full':'reduced','data-splash':a.splash?'on':'off'});
 $('#splash-name').text(content.fullName);$('#splash-initials').text(Array.from(content.initials||'').slice(0,2).join(''));
 $('#site-splash').attr('aria-label',locale==='en'?'Loading portfolio':'Memuat portofolio');
 $('#splash-status').text(locale==='en'?'Preparing your portfolio…':'Menyiapkan portofolio…');
 $('#splash-hint').text(locale==='en'?'My story, work, and experience.':'Cerita, karya, dan pengalaman saya.');
 $('#splash-skip').html(`${locale==='en'?'Skip intro':'Langsung masuk'} <span aria-hidden="true">↗</span>`);
 $('[data-i18n]').each((_,el)=>$(el).text(ui[$(el).attr('data-i18n')]||''));
 $('[data-i18n-html]').each((_,el)=>$(el).html(ui[$(el).attr('data-i18n-html')]||''));
 for(const [attribute,target]of [['data-i18n-placeholder','placeholder'],['data-i18n-aria','aria-label']])$(`[${attribute}]`).each((_,el)=>$(el).attr(target,ui[$(el).attr(attribute)]||''));
 $('title').text(meta.title);
 $('meta[name="description"],meta[name="author"],meta[property^="og:"],link[rel="canonical"],link[rel="alternate"]').remove();
 const addMeta=(name,value,property=false)=>{if(value)$('head').append($('<meta>').attr({[property?'property':'name']:name,content:value}))};
 addMeta('description',meta.description);addMeta('author',content.fullName);addMeta('robots',meta.robots);
 for(const [key,value]of Object.entries({type:'website',title:meta.title,description:meta.description,url:meta.canonical,locale:locale==='id'?'id_ID':'en_US',image:meta.image,'image:alt':meta.imageAlt}))addMeta('og:'+key,value,true);
 addMeta('twitter:card',meta.image?'summary_large_image':'summary');addMeta('twitter:title',meta.title);addMeta('twitter:description',meta.description);addMeta('twitter:image',meta.image);
 addMeta('google-site-verification',settings.googleVerification);
 $('head').append($('<link>').attr({rel:'canonical',href:meta.canonical}));
 for(const lang of ['id','en','x-default'])$('head').append($('<link>').attr({rel:'alternate',hreflang:lang,href:`${origin}/?lang=${lang==='x-default'?settings.defaultLocale:lang}`}));
 $('head').append($('<link>').attr({rel:'stylesheet',href:'/theme.css'}));
 const person={'@context':'https://schema.org','@type':'Person',name:content.fullName,jobTitle:content.heroRole,description:meta.description,url:meta.canonical,sameAs:content.socials.map(s=>external(s.url)).filter(Boolean)};
 if(content.avatarUrl)person.image=`${origin}/${content.avatarUrl}`;
 $('head').append(`<script type="application/ld+json">${json(person)}</script>`);
 $('head').append(`<script id="portfolio-bootstrap" type="application/json">${json({locale,content,meta})}</script>`);
 const parts=content.fullName.trim().split(/\s+/);
 $('[data-person-name]').html(`${esc(parts[0])}<span>${esc(parts.length>1?parts.at(-1):'Portfolio')}.</span>`);
 $('#hero-person-name').html(`${locale==='en'?"HELLO, I'M":'HALO, SAYA'} <strong>${esc(content.fullName)}</strong>`);
 $('#hero-title').html(`${esc(content.heroHeading[0])}<br>${esc(content.heroHeading[1])} <em>${esc(content.heroHeading[2])}</em>`);
 for(const [selector,value]of Object.entries({'#hero-role':content.heroRole,'#hero-description':content.heroDescription,'#hero-location':content.location,'#contact-location':content.location,'#availability-text':content.availabilityText,'#contact-availability':content.availabilityText,'#footer-brand':content.fullName,'#about-quote':content.aboutQuote,'#year':String(new Date().getFullYear())}))$(selector).text(value);
 $('#contact-email').text(content.email).attr('href','mailto:'+encodeURIComponent(content.email));
 $('#about-bio').html(content.bio.map(p=>`<p>${esc(p)}</p>`).join(''));
 if(content.avatarUrl)$('#portrait-frame').html(`<img src="/${esc(content.avatarUrl)}" alt="${esc(content.fullName)}" loading="lazy" width="420" height="520">`);
 if(content.cvUrl)$('#cv-link').removeAttr('hidden').attr('href','/'+content.cvUrl);
 $('#service-grid').html(content.services.map(s=>`<article class="service-card ${esc(s.tone)}"><div class="service-content"><span class="service-label">${esc(s.label)}</span><h3>${esc(s.title)}</h3><p>${esc(s.summary)}</p><div class="service-tags">${s.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div></div></article>`).join(''));
 $('#projects-grid').html(content.projects.map(p=>`<article class="project-card" data-category="${esc(p.category)}">${p.image?`<img src="/${esc(p.image)}" alt="${esc(p.title)}" loading="lazy" width="640" height="360">`:''}<div class="project-info"><span class="project-type">${esc(p.categoryLabel)} · ${esc(p.status)}</span><h3>${esc(p.title)}</h3><p class="project-subtitle">${esc(p.subtitle)}</p><div class="project-tag-row">${p.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div><details><summary>${esc(ui.openProject||'Detail')}</summary><p>${esc(p.challenge)}</p><p>${esc(p.solution)}</p><p>${esc(p.result)}</p><p>${esc(p.role)}</p>${[['Demo',p.link],['Repository',p.github]].filter(([,url])=>external(url)).map(([label,url])=>`<a href="${esc(external(url))}" rel="noopener noreferrer">${label}</a>`).join(' ')}</details></div></article>`).join(''));
 $('#project-count').text(`${content.projects.length} ${ui.projectCount}`);
 $('#experience-timeline').html(content.experiences.map(e=>`<article class="timeline-item"><span class="timeline-type">${esc(e.type)}</span><h3>${esc(e.title)}</h3><p>${esc(e.detail)}</p><div class="timeline-points">${e.points.map(p=>`<span>${esc(p)}</span>`).join('')}</div></article>`).join(''));
 $('#skills-groups').html(content.skills.map(s=>`<div class="skills-group"><h4>${esc(s.title)}</h4><ul>${s.items.map(tech.skill).join('')}</ul></div>`).join(''));
 $('#cert-grid').html(content.certifications.map(c=>`<article class="cert-card"><div class="cert-top"><span class="cert-issuer">${esc(c.issuer)}</span><span class="cert-status">${esc(c.status)}</span></div><h3>${esc(c.name)}</h3><p class="cert-subtitle">${esc(c.subtitle)}</p><div class="cert-foot"><span>${esc(c.year)} · ${esc(c.number)}</span></div></article>`).join(''));
 $('#process-grid').html(content.steps.map(s=>`<div class="process-item"><span class="process-number">${esc(s.number)}</span><h3>${esc(s.title)}</h3><p>${esc(s.subtitle)}</p></div>`).join(''));
 $('#testimonials-grid').html(sections.testimonials(content.testimonials,ui));
 $('#faq-list').html(sections.faqs(content.faqs,ui));
 $('#contact .section-num').text('09 /');
 $('.reveal').addClass('in-view');
 $('[data-lang]').each((_,el)=>$(el).attr('aria-pressed',String($(el).attr('data-lang')===locale)));
 return {html:$.html(),meta};
}
function robots(settings){return settings.indexing?`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /health\nSitemap: ${siteOrigin(settings)}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n'}
function sitemap(settings){
 const origin=esc(siteOrigin(settings));
 const urls=settings.indexing?['id','en'].map(locale=>`<url><loc>${origin}/?lang=${locale}</loc>${['id','en'].map(lang=>`<xhtml:link rel="alternate" hreflang="${lang}" href="${origin}/?lang=${lang}"/>`).join('')}<xhtml:link rel="alternate" hreflang="x-default" href="${origin}/?lang=${settings.defaultLocale}"/></url>`).join(''):'';
 return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`;
}
module.exports={renderPage,robots,sitemap,metadata};
