(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PortfolioSections=factory()})(globalThis,function(){
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const visibleFAQs=items=>(Array.isArray(items)?items:[]).filter(item=>item.visibility==='published'&&typeof item.question==='string'&&item.question.trim()&&typeof item.answer==='string'&&item.answer.trim());
 const visibleTestimonials=items=>(Array.isArray(items)?items:[]).filter(item=>item.visibility==='published'&&item.consent==='granted'&&typeof item.name==='string'&&item.name.trim()&&typeof item.quote==='string'&&item.quote.trim());
 function faqs(items,ui){
  const visible=visibleFAQs(items);
  return visible.length?visible.map((item,index)=>`<details class="faq-item" name="portfolio-faq" id="faq-${esc(item.id)}"><summary><span class="faq-number" aria-hidden="true">${String(index+1).padStart(2,'0')}</span><span class="faq-question">${esc(item.question)}</span><span class="faq-toggle" aria-hidden="true">+</span></summary><div class="faq-answer"><p>${esc(item.answer)}</p></div></details>`).join(''):`<p class="community-empty">${esc(ui.faqEmpty)}</p>`;
 }
 function testimonials(items,ui){
  const visible=visibleTestimonials(items);
  if(!visible.length)return `<div class="testimonials-empty"><span class="testimonial-empty-mark" aria-hidden="true">“</span><div><h3>${esc(ui.testimonialsEmptyTitle)}</h3><p>${esc(ui.testimonialsEmpty)}</p></div><a class="btn btn-outline" href="#work">${esc(ui.testimonialsCTA)} <span aria-hidden="true">↗</span></a></div>`;
  return visible.map(item=>{
   const initials=item.name.trim().split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]).join('').toUpperCase();
   const avatar=typeof item.avatarUrl==='string'&&/^assets\/(?!.*(?:\.\.|\/\/))[\w./-]+\.(?:png|jpe?g|webp)$/i.test(item.avatarUrl)?`<img src="/${esc(item.avatarUrl)}" alt="" width="48" height="48" loading="lazy">`:`<span>${esc(initials)}</span>`;
   return `<figure class="testimonial-card"><span class="testimonial-quote-mark" aria-hidden="true">“</span><blockquote><p>${esc(item.quote)}</p></blockquote><figcaption><span class="testimonial-avatar" aria-hidden="true">${avatar}</span><span class="testimonial-person"><cite>${esc(item.name)}</cite><span>${[item.role,item.company].filter(Boolean).map(esc).join(' · ')}</span></span></figcaption></figure>`;
  }).join('');
 }
 return {faqs,testimonials,visibleFAQs,visibleTestimonials};
});
