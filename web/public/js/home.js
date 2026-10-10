"use strict";
/* ================= home: the living front page =================
   A dot-matrix globe that flies the current flights, a split-flap stats board, a departures ticker,
   scroll reveals, the chapter scroll-spy, pointer light on cards and a scrambled headline.
   Loads last; everything lives in HOME so no page global is shadowed. Nothing here touches the film. */
const HOME=(()=>{
  const RM=matchMedia('(prefers-reduced-motion:reduce)').matches,FINE=matchMedia('(pointer:fine)').matches,R2=Math.PI/180;
  const q=s=>document.querySelector(s);

  /* ---------- split-flap numbers ---------- */
  function flap(node,txt){if(!node||node.dataset.v===txt)return;node.dataset.v=txt;node.setAttribute('aria-label',txt);node.innerHTML='';
    const cells=[...txt].map(c=>{const s=document.createElement('span');s.className=/\d/.test(c)?'fl':'fl sep';s.textContent=c;s.setAttribute('aria-hidden','true');node.append(s);return s;});
    if(RM)return;const t0=performance.now(),stops=cells.map((_,i)=>t0+260+i*85);
    const tick=()=>{if(node.dataset.v!==txt)return;const now=performance.now();let busy=false;
      cells.forEach((s,i)=>{if(s.classList.contains('sep')||s.dataset.done)return;const c=txt[i];if(now>=stops[i]){s.textContent=c;s.dataset.done=1;s.classList.add('set');}else{busy=true;s.textContent=String(Math.random()*10|0);}});
      if(busy)setTimeout(tick,45);};tick();}

  /* ---------- headline decode: glyph noise that settles left to right ---------- */
  const NOISE='▓▒░█<>/\\#*+=01ΛΣΞ';
  function scramble(root){if(!root||RM)return;const nodes=[];const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(w.nextNode())if(w.currentNode.nodeValue.trim())nodes.push(w.currentNode);
    const fin=nodes.map(n=>n.nodeValue),total=fin.reduce((a,s)=>a+s.length,0),t0=performance.now(),dur=700+total*28,id=(root._sid=(root._sid||0)+1);
    const step=now=>{if(root._sid!==id)return;const k=Math.min(1,(now-t0)/dur);let pos=0;
      nodes.forEach((n,j)=>{const f=fin[j];let s='';for(let i=0;i<f.length;i++){const at=(pos+i)/total;s+=(at<k*1.15-0.15||/\s/.test(f[i]))?f[i]:(at<k*1.15?NOISE[(Math.random()*NOISE.length)|0]:f[i].replace(/\S/,' '));}n.nodeValue=s;pos+=f.length;});
      if(k<1)requestAnimationFrame(step);else nodes.forEach((n,j)=>n.nodeValue=fin[j]);};requestAnimationFrame(step);}

  /* ---------- globe ---------- */
  const G={cv:null,g:null,dpr:1,size:0,dots:null,arcs:[],ports:[],yaw:0,tilt:0.35,vy:0,vt:0,drag:null,idle:0,live:false,raf:0,last:0,key:'',hud:0};
  function buildDots(){if(G.dots||!TOPO)return;const W0=720,H0=360,c=document.createElement('canvas');c.width=W0;c.height=H0;const g=c.getContext('2d');
    const pr=d3.geoEquirectangular().fitSize([W0,H0],{type:'Sphere'}),pa=d3.geoPath(pr,g);g.fillStyle='#fff';
    g.beginPath();pa(topojson.feature(TOPO,TOPO.objects.land));g.fill();if(typeof CHINA!=='undefined'&&CHINA&&CHINA.cn){g.beginPath();pa(CHINA.cn);g.fill();}
    const px=g.getImageData(0,0,W0,H0).data,out=[],st=1.55;
    for(let la=-82;la<=84;la+=st){const n=Math.max(1,Math.round(360/st*Math.cos(la*R2)));for(let i=0;i<n;i++){const lo=-180+i*360/n,x=Math.min(W0-1,Math.round((lo+180)/360*W0)),y=Math.min(H0-1,Math.round((90-la)/180*H0));
      if(px[(y*W0+x)*4]>127){const cl=Math.cos(la*R2);out.push(cl*Math.sin(lo*R2),Math.sin(la*R2),cl*Math.cos(lo*R2));}}}
    G.dots=new Float32Array(out);}
  const vec=(lo,la,r)=>{const cl=Math.cos(la*R2);return [r*cl*Math.sin(lo*R2),r*Math.sin(la*R2),r*cl*Math.cos(lo*R2)];};
  function buildArcs(){if(!S||!S.ok)return;const fl=S.flights.filter(f=>!f.vd&&AP[f.f]&&AP[f.to]),key=fl.map(f=>f.f+f.to).join();if(key===G.key)return;G.key=key;
    const seen=new Map(),ports=new Map();for(const f of fl){const k=[f.f,f.to].sort().join('-');if(!seen.has(k))seen.set(k,f);ports.set(f.f,(ports.get(f.f)||0)+1);ports.set(f.to,(ports.get(f.to)||0)+1);}
    const routes=[...seen.values()].slice(-140);
    G.arcs=routes.map((f,j)=>{const a=AP[f.f],b=AP[f.to],ip=d3.geoInterpolate([a.lon,a.lat],[b.lon,b.lat]),d=hav(a,b),h=Math.min(0.22,0.02+d/40000*0.55),N=Math.max(12,Math.min(64,Math.round(d/150))),pts=[];
      for(let i=0;i<=N;i++){const t=i/N,p=ip(t);pts.push(vec(p[0],p[1],1+h*Math.sin(Math.PI*t)));}return {pts,up:!!f.up,ph:(j*0.37)%1,sp:0.22+0.5*Math.min(1,700/Math.max(d,200))};});
    G.ports=[...ports.entries()].map(([c,n])=>({p:vec(AP[c].lon,AP[c].lat,1),n,c}));
    /* face the traveller's world: the mean of their airports */
    let sx=0,sy=0,sz=0;for(const p of G.ports){sx+=p.p[0]*p.n;sy+=p.p[1]*p.n;sz+=p.p[2]*p.n;}const m=Math.hypot(sx,sy,sz);
    if(m>0){const lo=Math.atan2(sx,sz),la=Math.asin(sy/m);G.yaw=G.yaw0=-lo;G.tilt=G.tilt0=Math.max(-0.7,Math.min(0.7,la));}
    const r=q('#gRoutes');if(r)r.textContent=String(G.arcs.length);}
  function resize(){const box=G.cv.parentElement,s=Math.round(box.clientWidth);if(!s)return;G.dpr=Math.min(2,window.devicePixelRatio||1);G.size=s;G.cv.width=G.cv.height=Math.round(s*G.dpr);G.cv.style.width=G.cv.style.height=s+'px';draw(performance.now());}
  function draw(now){const g=G.g,W=G.cv.width;if(!g||!W)return;g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,W,W);paint(g,W/2,W/2,W*0.39,G.dpr,G.yaw,G.tilt,now);
    if(now-G.hud>120){G.hud=now;const lo=((-G.yaw/R2+540)%360)-180,la=G.tilt/R2,el=q('#gPos');if(el)el.textContent=`${Math.abs(la).toFixed(1)}°${la>=0?'N':'S'}  ${Math.abs(lo).toFixed(1)}°${lo>=0?'E':'W'}`;}}
  /* the globe itself, on any 2D context: the page canvas, or the long poster */
  function paint(g,cx,cy,R,dpr,yaw,tilt,now){
    const cyw=Math.cos(yaw),syw=Math.sin(yaw),ct=Math.cos(tilt),st=Math.sin(tilt);
    const P=(x,y,z)=>{const x1=x*cyw+z*syw,z1=-x*syw+z*cyw,y2=y*ct-z1*st,z2=y*st+z1*ct;return [cx+R*x1,cy-R*y2,z2];};
    /* atmosphere and ocean */
    let gr=g.createRadialGradient(cx,cy,R*0.9,cx,cy,R*1.32);gr.addColorStop(0,'rgba(94,234,255,.22)');gr.addColorStop(0.35,'rgba(94,234,255,.07)');gr.addColorStop(1,'rgba(94,234,255,0)');g.fillStyle=gr;g.beginPath();g.arc(cx,cy,R*1.32,0,7);g.fill();
    gr=g.createRadialGradient(cx-R*0.35,cy-R*0.4,R*0.1,cx,cy,R);gr.addColorStop(0,'#10285a');gr.addColorStop(0.7,'#06132e');gr.addColorStop(1,'#030a1c');g.fillStyle=gr;g.beginPath();g.arc(cx,cy,R,0,7);g.fill();
    g.strokeStyle='rgba(94,234,255,.35)';g.lineWidth=1.2*dpr;g.stroke();
    /* land dots in four brightness bands (one fillStyle each) */
    if(G.dots){const D=G.dots,bands=[[],[],[],[]],sz=1.7*dpr;for(let i=0;i<D.length;i+=3){const p=P(D[i],D[i+1],D[i+2]);if(p[2]<=0.02)continue;bands[Math.min(3,(p[2]*4)|0)].push(p);}
      const col=['rgba(94,234,255,.16)','rgba(94,234,255,.3)','rgba(120,238,255,.48)','rgba(160,244,255,.7)'];bands.forEach((b,k)=>{g.fillStyle=col[k];for(const p of b)g.fillRect(p[0]-sz/2,p[1]-sz/2,sz,sz);});}
    /* routes: a faint trail, then a comet running along it */
    g.globalCompositeOperation='lighter';const t=now/1000;
    for(const a of G.arcs){const pp=a.pts.map(v=>P(v[0],v[1],v[2]));g.lineWidth=1.1*dpr;g.strokeStyle=a.up?'rgba(255,79,154,.30)':'rgba(233,197,142,.32)';g.beginPath();let on=false;
      for(const p of pp){if(p[2]>-0.05){on?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]);on=true;}else on=false;}g.stroke();
      const head=RM?0.999:((t*a.sp+a.ph)%1.6)/1.2;if(head>1)continue;const hi=head*(pp.length-1),L0=Math.max(0,Math.floor(hi)-9);
      for(let i=L0;i<Math.floor(hi);i++){const p=pp[i],n=pp[i+1];if(p[2]<-0.05||n[2]<-0.05)continue;const al=(i-L0+1)/(hi-L0);g.strokeStyle=a.up?`rgba(255,120,180,${al*0.9})`:`rgba(255,226,170,${al*0.95})`;g.lineWidth=(1+al*1.8)*dpr;g.beginPath();g.moveTo(p[0],p[1]);g.lineTo(n[0],n[1]);g.stroke();}
      const hp=pp[Math.min(pp.length-1,Math.round(hi))];if(hp&&hp[2]>-0.05){g.fillStyle='rgba(255,246,220,.95)';g.beginPath();g.arc(hp[0],hp[1],2.2*dpr,0,7);g.fill();}}
    /* airports: dot + slow pulse */
    for(const o of G.ports){const p=P(o.p[0],o.p[1],o.p[2]);if(p[2]<=0)continue;const r0=(1.6+Math.min(3,Math.sqrt(o.n)*0.6))*dpr;g.fillStyle='rgba(111,247,200,.9)';g.beginPath();g.arc(p[0],p[1],r0,0,7);g.fill();
      if(!RM){const k=((t*0.6+o.n*0.13)%1);g.strokeStyle=`rgba(111,247,200,${(1-k)*0.6})`;g.lineWidth=1*dpr;g.beginPath();g.arc(p[0],p[1],r0+k*14*dpr,0,7);g.stroke();}}
    g.globalCompositeOperation='source-over';
    /* terminator-like sheen on the limb */
    gr=g.createRadialGradient(cx+R*0.45,cy+R*0.5,R*0.2,cx,cy,R*1.05);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,.35)');g.fillStyle=gr;g.beginPath();g.arc(cx,cy,R,0,7);g.fill();}
  function loop(now){G.raf=0;if(!G.live)return;const dt=Math.min(0.05,(now-(G.last||now))/1000);G.last=now;
    if(!G.drag){if(now>G.idle)G.vy+=(0.09-G.vy)*0.02;else G.vy*=0.95;G.yaw+=G.vy*dt*(RM?0:1);G.vt*=0.92;G.tilt=Math.max(-1.1,Math.min(1.1,G.tilt+G.vt*dt));}
    draw(now);G.raf=requestAnimationFrame(loop);}
  function setLive(v){if(RM){G.live=false;if(v)draw(performance.now());return;}G.live=v&&!document.hidden;if(G.live&&!G.raf){G.last=0;G.raf=requestAnimationFrame(loop);}}
  function initGlobe(){G.cv=q('#globe');if(!G.cv)return;G.g=G.cv.getContext('2d');new ResizeObserver(resize).observe(G.cv.parentElement);
    new IntersectionObserver(es=>setLive(es[0].isIntersecting),{threshold:0.05}).observe(G.cv);document.addEventListener('visibilitychange',()=>setLive(!document.hidden&&G.cv.getBoundingClientRect().bottom>0));
    G.cv.addEventListener('pointerdown',e=>{G.drag={x:e.clientX,y:e.clientY,t:performance.now()};G.cv.setPointerCapture(e.pointerId);G.cv.classList.add('grab');});
    G.cv.addEventListener('pointermove',e=>{if(!G.drag)return;const dx=e.clientX-G.drag.x,dy=e.clientY-G.drag.y,now=performance.now(),k=2.4/G.size;G.yaw+=dx*k;G.tilt=Math.max(-1.1,Math.min(1.1,G.tilt+dy*k));
      const dt=Math.max(0.008,(now-G.drag.t)/1000);G.vy=dx*k/dt*0.5;G.vt=dy*k/dt*0.5;G.drag={x:e.clientX,y:e.clientY,t:now};if(!G.live)draw(now);});
    const up=()=>{if(!G.drag)return;G.drag=null;G.idle=performance.now()+1800;G.cv.classList.remove('grab');};G.cv.addEventListener('pointerup',up);G.cv.addEventListener('pointercancel',up);}

  /* ---------- departures ticker ---------- */
  function ticker(){const tr=q('#ticker');if(!tr||!S||!S.ok)return;const fl=S.flights.slice(-36).reverse();if(!fl.length){tr.innerHTML='';return;}
    const st=f=>f.vd?['cx',L('已取消','CANCELLED')]:f.up?['up',L('计划','SCHEDULED')]:['ok',L('已到达','LANDED')];
    const row=fl.map(f=>{const [c,t]=st(f);return `<span class="tk"><b>${esc(f.fn)}</b>${esc(f.f)}<i>✈</i>${esc(f.to)}<em class="${c}">${t}</em><small>${fmt(f.km)} KM</small></span>`;}).join('');
    tr.innerHTML=row+row;tr.style.setProperty('--dur',Math.max(30,fl.length*4.5)+'s');}
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  /* ---------- reveal, scroll-spy, progress, pointer light ---------- */
  function initMotion(){
    const io=new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}},{threshold:0.08,rootMargin:'0px 0px -6% 0px'});
    document.querySelectorAll('.rv').forEach(n=>io.observe(n));
    const secs=['s1','stepCheck','s2','s3','s4'].map(id=>document.getElementById(id)).filter(Boolean);
    const spy=new IntersectionObserver(es=>{for(const e of es){if(!e.isIntersecting)continue;const id=e.target.id;
      document.querySelectorAll('[data-sec]').forEach(a=>a.classList.toggle('on',a.dataset.sec===id));secs.forEach(s=>s.classList.toggle('cur',s===e.target));}},{rootMargin:'-42% 0px -52% 0px'});
    secs.forEach(s=>spy.observe(s));
    const bar=q('#fbar');let pend=false;const prog=()=>{pend=false;const h=document.documentElement,max=h.scrollHeight-h.clientHeight;if(bar)bar.style.setProperty('--p',max>0?Math.min(1,h.scrollTop/max):0);};
    addEventListener('scroll',()=>{if(!pend){pend=true;requestAnimationFrame(prog);}},{passive:true});prog();
    if(FINE&&!RM){let tgt=null,ev=null,raf=0;const apply=()=>{raf=0;if(!tgt||!ev)return;const r=tgt.getBoundingClientRect(),x=ev.clientX-r.left,y=ev.clientY-r.top;tgt.style.setProperty('--mx',x+'px');tgt.style.setProperty('--my',y+'px');
        if(tgt.classList.contains('medal')||tgt.classList.contains('card')){tgt.style.setProperty('--ry',((x/r.width-0.5)*10).toFixed(2)+'deg');tgt.style.setProperty('--rx',((0.5-y/r.height)*10).toFixed(2)+'deg');}};
      document.addEventListener('pointermove',e=>{const t=e.target.closest&&e.target.closest('.step,.medal,.card,.board');if(tgt&&t!==tgt){tgt.style.removeProperty('--rx');tgt.style.removeProperty('--ry');}tgt=t;ev=e;if(!raf)raf=requestAnimationFrame(apply);},{passive:true});}
    /* stars: three layers of box-shadow dots, made once */
    const sk=q('.stars');if(sk){const lay=(n,s)=>{let o=[];for(let i=0;i<n;i++)o.push(`${(Math.random()*2400)|0}px ${(Math.random()*1800)|0}px 0 ${s}px rgba(${Math.random()<.2?'255,214,170':'200,236,255'},${(0.3+Math.random()*0.7).toFixed(2)})`);return o.join(',');};
      sk.innerHTML='<i></i><i></i><i></i>';const [a,b,c]=sk.children;a.style.boxShadow=lay(160,0);b.style.boxShadow=lay(70,0.5);c.style.boxShadow=lay(24,1);}}

  /* ---------- public ---------- */
  function update(){buildDots();buildArcs();ticker();if(G.g&&!G.live)draw(performance.now());}
  function relang(){scramble(q('#heroH'));update();}
  function init(){initGlobe();initMotion();scramble(q('#heroH'));update();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  /* a still of the globe facing the traveller's routes, comets frozen mid-flight (fixed clock, so the same input gives the same picture) */
  function paintGlobe(g,cx,cy,R,scale){update();paint(g,cx,cy,R,scale||1,G.yaw0||0,G.tilt0==null?0.35:G.tilt0,2600);return G.arcs.length;}
  return {flap,update,relang,scramble,paintGlobe};
})();
