(() => {
 const root=document.documentElement;
 let preference=root.dataset.defaultTheme||root.dataset.theme||'dark';
 try{const saved=localStorage.getItem('personal-portfolio-theme');if(['dark','light'].includes(saved))preference=saved}catch{}
 if(preference==='system')preference=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';
 root.dataset.theme=preference;
})();
