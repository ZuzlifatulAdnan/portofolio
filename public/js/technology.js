(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./tech-catalog'));else root.PortfolioTech=factory(root.PORTFOLIO_TECH_CATALOG)})(globalThis,function(catalog){
 'use strict';
 const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 const rules=[['php',/\bphp\b/i],['laravel',/\blaravel\b/i],['javascript',/\bjavascript\b|\bvanilla\s?js\b/i],['typescript',/\btypescript\b/i],['html',/\bhtml5?\b/i],['css',/^(?:css3?|html\s*\/\s*css)$/i],['tailwind',/\btailwind\b/i],['mysql',/\bmysql\b/i],['android',/\bandroid\b/i],['mikrotik',/\bmikrotik\b|\brouteros\b/i],['linux',/\blinux\b/i],['ubuntu',/\bubuntu\b/i],['nginx',/\bnginx\b/i],['apache',/\bapache\b/i],['git',/\bgit\b/i],['github',/\bgithub\b/i],['react',/\breact(?:\.js|\s?native)?\b/i],['nodejs',/\bnode(?:\.js|js)?\b/i],['docker',/\bdocker\b/i],['python',/\bpython\b/i],['postgresql',/\bpostgres(?:ql)?\b/i],['figma',/\bfigma\b/i],['bootstrap',/\bbootstrap\b/i],['flutter',/\bflutter\b/i],['vue',/\bvue(?:\.js|js)?\b/i]];
 rules.push(['moodle',/\bmoodle\b/i]);
 function brands(label){return rules.filter(([,pattern])=>pattern.test(String(label))).map(([slug])=>slug).filter(slug=>catalog?.[slug]).slice(0,2)}
 function fallback(label){if(/network|routing|dns|firewall|nat|jaringan/i.test(label))return 'network';if(/mobile|responsive|android/i.test(label))return 'phone';if(/server|vps|deploy|linux/i.test(label))return 'server';if(/workflow|documentation|analysis|support|testing|debug/i.test(label))return 'workflow';return 'code'}
 function logos(label){
  const matches=brands(label);
  return `<span class="tech-logos" aria-hidden="true">${matches.length?matches.map(slug=>`<span class="tech-logo" data-brand="${slug}" style="--tech-mask:url('/assets/tech/${slug}.svg');--tech-brand:#${catalog[slug].hex}"></span>`).join(''):`<svg class="icon tech-generic"><use href="#i-${fallback(label)}"></use></svg>`}</span>`;
 }
 function tag(label){return `<span class="tech-tag">${logos(label)}<span class="tech-label">${esc(label)}</span></span>`}
 function skill(label){return `<li class="tech-skill">${logos(label)}<span class="tech-label">${esc(label)}</span></li>`}
 return {brands,logos,tag,skill};
});
