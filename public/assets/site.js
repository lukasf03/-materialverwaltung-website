/* Gemeinsames Script der Produkt-Website – theme, nav, reveal, topo, form.
   Alles defensiv: fehlt ein Element auf einer Seite, wird es übersprungen. */
(function(){
  var root=document.documentElement, reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* theme toggle */
  var tg=document.getElementById('theme');
  tg&&tg.addEventListener('click',function(){
    var cur=root.getAttribute('data-theme');
    if(!cur)cur=matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';
    var next=cur==='dark'?'light':'dark';
    root.setAttribute('data-theme',next);
    try{localStorage.setItem('theme',next);}catch(e){}
    redraw();
  });

  /* nav shadow */
  var nav=document.getElementById('nav');
  nav&&addEventListener('scroll',function(){nav.classList.toggle('scrolled',scrollY>8)},{passive:true});

  /* mobile menu */
  var burger=document.getElementById('nav-toggle'), links=document.getElementById('nav-links');
  burger&&links&&burger.addEventListener('click',function(){links.classList.toggle('open');});
  links&&links.addEventListener('click',function(e){if(e.target.tagName==='A')links.classList.remove('open');});

  /* reveal */
  if(!reduce&&'IntersectionObserver'in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}})},{threshold:.1,rootMargin:'0px 0px -6% 0px'});
    document.querySelectorAll('.rise').forEach(function(el){io.observe(el);});
  }else{document.querySelectorAll('.rise').forEach(function(el){el.classList.add('in');});}

  /* topographic contours */
  var canvases=[];
  function contour(cv,peaksFn){
    if(!cv)return;var ctx=cv.getContext('2d'),dpr=Math.min(devicePixelRatio||1,2),W,H,peaks,phase=0,raf=0;
    function css(n){return getComputedStyle(root).getPropertyValue(n);}
    function size(){var r=cv.getBoundingClientRect();W=r.width;H=r.height;cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);peaks=peaksFn(W,H);}
    function frame(){ctx.clearRect(0,0,W,H);var c1=css('--contour'),c2=css('--contour-2');
      for(var p=0;p<peaks.length;p++){var pk=peaks[p];
        for(var r=0;r<pk.rings;r++){ctx.beginPath();var base=pk.r0+r*pk.gap,amp=pk.amp*(0.5+r/pk.rings);
          for(var a=0;a<=64;a++){var ang=a/64*Math.PI*2;var rad=base+Math.sin(ang*pk.freq+pk.seed+phase*pk.drift)*amp+Math.cos(ang*2.3-pk.seed)*amp*0.4;var x=pk.x+Math.cos(ang)*rad,y=pk.y+Math.sin(ang)*rad*0.82;a?ctx.lineTo(x,y):ctx.moveTo(x,y);}
          ctx.closePath();ctx.strokeStyle=(r%4===0)?c2:c1;ctx.lineWidth=(r%4===0)?1.4:1;ctx.stroke();}}}
    function loop(){phase+=0.0016;frame();raf=requestAnimationFrame(loop);}
    cv._draw=function(){size();frame();};size();
    if(reduce)frame();else loop();
    addEventListener('resize',function(){size();if(reduce)frame();});
    canvases.push(cv);
  }
  function redraw(){canvases.forEach(function(cv){cv._draw&&cv._draw();});}
  contour(document.getElementById('topo'),function(W,H){return[{x:W*0.72,y:H*0.42,r0:16,gap:15,rings:22,amp:16,freq:3,seed:1.1,drift:1.0},{x:W*0.18,y:H*0.8,r0:12,gap:17,rings:16,amp:20,freq:2,seed:3.4,drift:-0.8}];});
  document.querySelectorAll('.topo-mini').forEach(function(cv){contour(cv,function(W,H){return[{x:W*0.85,y:H*0.5,r0:14,gap:16,rings:18,amp:18,freq:3,seed:2.2,drift:0.9}];});});

  /* Anfrage-Formular (nur wenn vorhanden) */
  var form=document.getElementById('anfrage-form'),msg=document.getElementById('form-msg');
  if(form){
    document.querySelectorAll('[data-paket]').forEach(function(a){a.addEventListener('click',function(){var sel=document.getElementById('f-paket');if(!sel)return;for(var i=0;i<sel.options.length;i++)if(sel.options[i].text===a.dataset.paket)sel.value=sel.options[i].value||sel.options[i].text;});});
    form.addEventListener('submit',async function(e){
      e.preventDefault();msg.className='form-msg';
      var data=Object.fromEntries(new FormData(form).entries());
      if(!data.name||!data.email){msg.className='form-msg err';msg.textContent='Bitte Name und E-Mail-Adresse ausfüllen.';return;}
      var btn=form.querySelector('button[type=submit]');btn.disabled=true;var lbl=btn.textContent;btn.textContent='Wird gesendet …';
      try{
        var res=await fetch('/api/anfrage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
        var body=await res.json().catch(function(){return{};});
        if(!res.ok)throw new Error(body.error||'Senden fehlgeschlagen.');
        form.reset();msg.className='form-msg ok';msg.textContent='Danke für eure Anfrage! Wir melden uns zeitnah per E-Mail.';
      }catch(err){msg.className='form-msg err';msg.textContent=err.message||'Senden fehlgeschlagen. Bitte später erneut versuchen.';}
      finally{btn.disabled=false;btn.textContent=lbl;}
    });
  }

  /* Lightbox: alle Screenshots per Klick groß anzeigen */
  var shots=document.querySelectorAll('.shot img,.gal img,.shotfull img');
  if(shots.length){
    var lb=document.createElement('div');
    lb.className='lb';lb.setAttribute('role','dialog');lb.setAttribute('aria-modal','true');lb.setAttribute('aria-label','Screenshot vergrößert');
    lb.innerHTML='<button class="lb-close" type="button" aria-label="Schließen"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button><figure><img alt=""><figcaption></figcaption></figure>';
    document.body.appendChild(lb);
    var big=lb.querySelector('img'),cap=lb.querySelector('figcaption'),closeBtn=lb.querySelector('.lb-close'),lastFocus=null;
    function lbOpen(im){lastFocus=document.activeElement;big.src=im.currentSrc||im.src;big.alt=im.alt||'';
      if(im.alt){cap.textContent=im.alt;cap.hidden=false;}else{cap.textContent='';cap.hidden=true;}
      lb.classList.add('open');document.body.classList.add('lb-lock');closeBtn.focus();}
    function lbClose(){lb.classList.remove('open');document.body.classList.remove('lb-lock');big.removeAttribute('src');
      if(lastFocus&&lastFocus.focus)lastFocus.focus();}
    shots.forEach(function(im){
      im.setAttribute('role','button');im.setAttribute('tabindex','0');
      if(!im.getAttribute('title'))im.setAttribute('title','Zum Vergrößern klicken');
      im.addEventListener('click',function(){lbOpen(im);});
      im.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();lbOpen(im);}});
    });
    lb.addEventListener('click',function(e){if(e.target===lb||e.target===big||(e.target.closest&&e.target.closest('.lb-close')))lbClose();});
    addEventListener('keydown',function(e){if(e.key==='Escape'&&lb.classList.contains('open'))lbClose();});
  }
})();
