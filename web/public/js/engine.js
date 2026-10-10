"use strict";
/* ================= video engine ================= */
const W=1080,H=1920,FPS=30;
const BPM=112,BEAT=60/BPM,BAR=4*BEAT,T_OPEN=2*BAR,T_F0=3*BAR;
const CARD={x:36,y:118,w:1008,h:1700,r:44},MAP={x:66,y:300,w:948,h:610},PAGE2Y=1010;
const PG={x:CARD.x+4,y:CARD.y+22,w:CARD.w-8,h:CARD.h-44};
const cv=$('cv');let ctx=cv.getContext('2d');const mainCtx=ctx;
const posterCv=document.createElement('canvas');posterCv.width=W;posterCv.height=H;const pctx=posterCv.getContext('2d');
const mapCv=document.createElement('canvas');mapCv.width=MAP.w;mapCv.height=MAP.h;const mg=mapCv.getContext('2d');
const maskCv=document.createElement('canvas');maskCv.width=MAP.w;maskCv.height=MAP.h;const mk=maskCv.getContext('2d');
const hatchCv=document.createElement('canvas');hatchCv.width=MAP.w;hatchCv.height=MAP.h;const hg=hatchCv.getContext('2d');
const stampCv=document.createElement('canvas');stampCv.width=520;stampCv.height=280;
let bgLayer=null;
const CJK='"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif';
const F=(w,s,f='OS')=>`${w} ${s}px ${f==='SM'?'"Space Mono",monospace':'"Open Sans"'}, ${CJK}`;
let S=null; // scene state
let LAND=null,ALLC=null,PC={rot:null};
const coverCv=document.createElement('canvas');coverCv.width=W;coverCv.height=H;let coverBuilt=false;
const foilCv=document.createElement('canvas');foilCv.width=W;foilCv.height=H; // gold-foil mask of the cover
const fxCv=document.createElement('canvas');fxCv.width=W;fxCv.height=H;const fxg=fxCv.getContext('2d');
const photoCv=document.createElement('canvas');photoCv.width=270;photoCv.height=330;let photoBuilt=false;
const stampFx=document.createElement('canvas');stampFx.width=520;stampFx.height=280;
const SERIF='"Noto Serif SC","Songti SC","STSong",serif';
function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
function fmt(n){return Math.round(n).toLocaleString('en-US');}
function hm(m){return Math.floor(m/60)+'h '+(m%60)+'m';}

const DEMO_NAME=['林小舟','LIN XIAOZHOU']; // fictional traveller for the demo data
function profile(){
  const nat=$('nat').value||'CN';const nm=NAMES[nat]||['China','中国','CHN'];const typed=($('name').value||'').trim(),demo=SOURCE==='demo'&&!typed;
  const disp=typed||(demo?DEMO_NAME[0]:'TRAVELLER');
  let lat=($('latin').value||'').trim()||(demo?DEMO_NAME[1]:disp);lat=lat.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Z ]/g,'').trim();if(!lat)lat='TRAVELLER';
  return {disp,latin:lat,nat,natEn:nm[0].toUpperCase(),nat3:nm[2]||'XXX',tagEn:($('tagEn').value||'').trim(),tagZh:($('tagZh').value||'').trim(),photo:PHOTO,
    theme:segVal('segTheme','burgundy'),mstyle:segVal('segMusic','groove'),len:+segVal('segLen','24')};
}
function buildScene(){
  const res=buildFlights();
  const useUp=$('optUp').checked,useVoid=$('optVoid').checked;
  let fl=res.all.filter(f=>(useUp||!f.up)&&(useVoid||!f.vd));
  const yF=+$('yFrom').value||0,yT=+$('yTo').value||9999;fl=fl.filter(f=>f.y>=yF&&f.y<=yT);
  const P=profile();
  const scene={P,res,flights:fl.map(f=>({...f})),ok:fl.length>0};
  if(!scene.ok){S=scene;return scene;}
  // projection centred on the traveller's median longitude
  const lons=[];fl.forEach(f=>{lons.push(AP[f.f].lon,AP[f.to].lon);});lons.sort((a,b)=>a-b);const medLon=lons[lons.length>>1];
  scene.rot=-mapCentre(fl,medLon+20);
  scene.proj=d3.geoEquirectangular().rotate([scene.rot,0]).scale(MAP.w/(2*Math.PI)).translate([MAP.w/2,0]).precision(0.3);
  // years & schedule on the BPM grid
  const y0=fl[0].y,y1=fl[fl.length-1].y;const years=[];
  for(let y=y0;y<=y1;y++){const n=fl.filter(f=>f.y===y).length;let b=n===0?0.25:n<4?0.5:Math.min(3,Math.max(1,Math.round(n*0.2/BAR)));years.push({y,n,bars:b});}
  let tot=years.reduce((a,b)=>a+b.bars,0);const MAXB=P.len||24; // 片长: full ≤ 24 bars of years; the short cuts squeeze the years, never the approved opening/ending
  if(tot>MAXB){const k=MAXB/tot;years.forEach(o=>{o.bars=Math.max(o.n?0.5:0.25,Math.round(o.bars*k*2)/2);});}
  if(MAXB<24){tot=years.reduce((a,b)=>a+b.bars,0);while(tot>MAXB){const c=years.filter(o=>o.bars>(o.n?0.5:0.25)).sort((a,b)=>b.bars-a.bars)[0];if(!c)break;c.bars-=c.bars>=1?0.5:0.25;tot=years.reduce((a,b)=>a+b.bars,0);}}
  const G=BEAT/8;let ys=T_F0;scene.years=[];
  for(const o of years){const list=scene.flights.filter(f=>f.y===o.y);const dur=o.bars*BAR;scene.years.push({y:o.y,t:ys,end:ys+dur,n:o.n,bars:o.bars,gap:MAXB<24?o.n<4:o.bars<=0.5, // sparse year; short cuts judge by flight count, not by squeezed length
      dream:list.length>0&&list.every(f=>f.up)});
    const slot=dur/Math.max(1,list.length);
    list.forEach((f,k)=>{f.t0=ys+Math.round(k*slot/G)*G;f.dur=Math.max(0.42,Math.min(1.5,0.3+1.25*Math.pow(f.km/11128,0.55)));if(f.up)f.dur=Math.min(1.1,f.dur+0.3);f.dur=Math.min(f.dur,ys+dur+BAR*0.45-f.t0);f.t1=f.t0+f.dur;});
    ys+=dur;}
  scene.flights.sort((a,b)=>a.t0-b.t0);
  scene.T_FE=ys;scene.T_STAMP=ys+BEAT;scene.T_ZOOM=ys+BAR;scene.T_CARD=ys+3*BAR;scene.T_END=scene.T_CARD+2.5*BAR;
  scene.frames=Math.ceil(scene.T_END*FPS);
  for(const f of scene.flights){f.a=scene.proj([AP[f.f].lon,AP[f.f].lat]);f.b=scene.proj([AP[f.to].lon,AP[f.to].lat]);}
  // countries: home first
  scene.visit={};scene.visit[P.nat]=T_OPEN;scene.order=[P.nat];
  for(const f of scene.flights){for(const [c,tt] of [[f.fc,f.t0],[f.tc,f.t1]]){if(!(c in scene.visit)){scene.visit[c]=tt;scene.order.push(c);}}}
  scene.order.sort((a,b)=>scene.visit[a]-scene.visit[b]);
  // geometry
  if(!LAND){LAND=topojson.merge(TOPO,TOPO.objects.countries.geometries.filter(g=>g.id!=='010'));ALLC=topojson.feature(TOPO,TOPO.objects.countries).features;}
  scene.land=LAND;scene.cgeo={};for(const c of scene.order){const n=NUM[c];scene.cgeo[c]=ALLC.filter(f=>+f.id===n);}
  // projected outlines as Path2D, cached per projection (the per-frame cost is then just fill/stroke)
  if(PC.rot!==scene.rot){const gp=d3.geoPath(scene.proj);const chinaP=CHINA?new Path2D(gp({type:'Feature',geometry:CHINA.cn})||''):null,outside=new Path2D();if(chinaP){outside.rect(-1e4,-1e4,3e4,3e4);outside.addPath(chinaP);}
    PC={rot:scene.rot,gp,chinaP,outside,jdP:CHINA?new Path2D(gp({type:'Feature',geometry:CHINA.jd})||''):null,land:new Path2D(gp(LAND)||''),grat:new Path2D(gp(d3.geoGraticule().extent([[-180,-56],[180,76]]).step([15,15])())||''),c:{}};}
  scene.landP=PC.land;scene.gratP=PC.grat;scene.chinaP=PC.chinaP;scene.outsideCN=PC.outside;scene.jdP=PC.jdP;scene.cpath={};if(PC.chinaP)PC.c.CN=PC.chinaP;
  for(const c of scene.order){if(!(c in PC.c)){const fs=scene.cgeo[c];PC.c[c]=fs.length?new Path2D(fs.map(f=>PC.gp(f)||'').join('')):null;}scene.cpath[c]=PC.c[c];}
  scene.final=stats(scene,1e9);
  // camera
  buildCam(scene);
  scene.stampReady=false;
  S=scene;buildBg();return scene;
}
// The map is a flat world cut at centre ± 180°. A route whose short way crosses that cut would be drawn the long way round
// (SFO → NRT across Europe), so keep the usual centre (median longitude + 20°) when no route crosses it, otherwise move the
// cut into the widest empty stretch: fewest crossings, then the most room around the airports, then closest to the usual centre.
function mapCentre(fl,pref){const wrap=x=>((x%360)+540)%360-180,P=fl.map(f=>[AP[f.f].lon,AP[f.to].lon]);
  const cross=c=>{let n=0;for(const [a,b] of P)if(Math.abs(wrap(a-c)-wrap(b-c))>180)n++;return n;};
  pref=wrap(pref);if(!cross(pref))return pref;
  const room=c=>Math.min(30,...P.flat().map(l=>180-Math.abs(wrap(l-c))));let best=pref,bs=1e9;
  for(let c=-180;c<180;c+=2){const sc=cross(c)*1000-room(c)*10+Math.abs(wrap(c-pref))*0.05;if(sc<bs){bs=sc;best=c;}}
  return best;}
function boxPx(sc,b){const p1=sc.proj(b[0]),p2=sc.proj(b[1]);return [Math.min(p1[0],p2[0]),Math.min(p1[1],p2[1]),Math.max(p1[0],p2[0]),Math.max(p1[1],p2[1])];}
function fit(bx,pad=40){const w=Math.max(1,bx[2]-bx[0]),h=Math.max(1,bx[3]-bx[1]);const z=Math.min((MAP.w-2*pad)/w,(MAP.h-2*pad)/h);return {cx:(bx[0]+bx[2])/2,cy:(bx[1]+bx[3])/2,z};}
function buildCam(sc){
  // base view: 10-90 percentile box of the traveller's airports, at least 55x38 degrees
  const pts=[];sc.flights.forEach(f=>{pts.push(f.a,f.b);});
  const xs=pts.map(p=>p[0]).sort((a,b)=>a-b),ys=pts.map(p=>p[1]).sort((a,b)=>a-b);const q=(arr,p)=>arr[Math.min(arr.length-1,Math.floor(p*arr.length))];
  let bx=[q(xs,.08),q(ys,.08),q(xs,.92),q(ys,.92)];const ppd=MAP.w/360;
  const cx=(bx[0]+bx[2])/2,cy=(bx[1]+bx[3])/2;const w=Math.max(bx[2]-bx[0]+16*ppd,55*ppd),h=Math.max(bx[3]-bx[1]+12*ppd,38*ppd);
  const base=[cx-w/2,cy-h/2,cx+w/2,cy+h/2];
  const p1=sc.proj([-sc.rot-179.5,-56]),p2=sc.proj([-sc.rot+179.5,76]);const wv=fit([0,p2[1],MAP.w,p1[1]]);const hh=(p1[1]-p2[1])*wv.z;wv.cy+=(MAP.h/2-hh/2-40)/wv.z;
  let cur=fit(base);sc.cam=[];
  for(let i=0;i<sc.frames;i++){const t=i/FPS;let tgt;
    if(t>=sc.T_ZOOM)tgt=wv;else{let b=base.slice();for(const f of sc.flights){if(f.t0-1.1<t&&f.t1+0.5>t){b=[Math.min(b[0],f.a[0],f.b[0]),Math.min(b[1],f.a[1],f.b[1]),Math.max(b[2],f.a[0],f.b[0]),Math.max(b[3],f.a[1],f.b[1])];}}tgt=fit(b);}
    const k=t>=sc.T_ZOOM?0.06:0.075;cur={cx:lerp(cur.cx,tgt.cx,k),cy:lerp(cur.cy,tgt.cy,k),z:Math.exp(lerp(Math.log(cur.z),Math.log(tgt.z),k))};sc.cam.push(cur);}
}
function stats(sc,t){let n=0,km=0,min=0;const al=new Set(),ap=new Set(),cc=new Set([sc.P.nat]);
  for(const f of sc.flights){if(t<f.t0)break;const u=clamp((t-f.t0)/f.dur);km+=f.km*ease(u);min+=f.min*ease(u);ap.add(f.f);if(u>=1){n++;if(f.al&&f.al!=='--')al.add(f.al);else if(f.fn&&f.fn!=='—')al.add(f.fn.slice(0,2));ap.add(f.to);cc.add(f.fc);cc.add(f.tc);}}
  return {n,km:Math.round(km),min:Math.round(min),al:al.size,ap:ap.size,cc:cc.size};}

/* ---------- deterministic textures & foil ---------- */
function noiseTile(n,seed,amp){const c=document.createElement('canvas');c.width=c.height=n;const g=c.getContext('2d');const im=g.createImageData(n,n),d=im.data,r=rngF(seed);
  for(let i=0;i<n*n;i++){const v=128+(r()+r()+r()-1.5)*amp;d[4*i]=d[4*i+1]=d[4*i+2]=v;d[4*i+3]=255;}g.putImageData(im,0,0);return c;}
const GRAIN=[0,1,2].map(k=>noiseTile(256,101+k,72));let grainPat=null;
// film grain on the final frame: dithers gradients before H.264, seeded by frame index.
// The server render (?render=…, x264 crf 25) skips it: measured identical output (PSNR 40.5 dB, same size) for a third less drawing time.
const GRAIN_ON=!/[?&]render=/.test(location.search);
function grain(i,alpha){if(!GRAIN_ON)return;const g=mainCtx;if(!grainPat)grainPat=GRAIN.map(c=>g.createPattern(c,'repeat'));const p=grainPat[i%3];
  if(p.setTransform)p.setTransform(new DOMMatrix([1,0,0,1,Math.floor(hash(i+1)*256),Math.floor(hash(i+7)*256)]));
  g.save();g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='overlay';g.globalAlpha=alpha;g.fillStyle=p;g.fillRect(0,0,W,H);g.restore();}
function tint(src,col){fxg.setTransform(1,0,0,1,0,0);fxg.globalAlpha=1;fxg.globalCompositeOperation='source-over';fxg.clearRect(0,0,W,H);fxg.drawImage(src,0,0);
  fxg.globalCompositeOperation='source-in';fxg.fillStyle=col;fxg.fillRect(0,0,W,H);fxg.globalCompositeOperation='source-over';return fxCv;}
function spaced(g,txt,x,y,track){const ch=[...txt],ws=ch.map(c=>g.measureText(c).width);let cx=x-(ws.reduce((a,b)=>a+b,0)+track*(ch.length-1))/2;const al=g.textAlign;g.textAlign='left';
  ch.forEach((c,i)=>{g.fillText(c,cx,y);cx+=ws[i]+track;});g.textAlign=al;}
function guilloche(g,cx,cy,R,r,d,col,alpha,lw,n){g.save();g.strokeStyle=col;g.globalAlpha=alpha;g.lineWidth=lw;g.beginPath();for(let i=0;i<=n*10;i++){const th=i/n*Math.PI*2;const x=cx+(R-r)*Math.cos(th)+d*Math.cos((R-r)/r*th);const y=cy+(R-r)*Math.sin(th)-d*Math.sin((R-r)/r*th);i?g.lineTo(x,y):g.moveTo(x,y);}g.stroke();g.restore();}
function laurel(g,R){for(const sd of [-1,1]){g.save();g.scale(sd,1);g.lineWidth=4;g.beginPath();g.arc(0,0,R,Math.PI*0.6,Math.PI*1.2);g.stroke();
    for(let k=0;k<11;k++){const u=k/10,a=Math.PI*(0.62+0.56*u),s=1-0.42*u,px=Math.cos(a)*R,py=Math.sin(a)*R,tg=a+Math.PI/2;
      for(const o of (k===10?[0]:[-1,1])){const d=tg+o*0.55,L=36*s,B=11*s;g.save();g.translate(px+Math.cos(d)*L*0.5,py+Math.sin(d)*L*0.5);g.rotate(d);
        g.beginPath();g.moveTo(-L/2,0);g.quadraticCurveTo(0,-B,L/2,0);g.quadraticCurveTo(0,B,-L/2,0);g.fill();g.restore();}}
    g.restore();}}
// cover emblem: globe + orbit + plane inside a laurel, drawn at the origin with the current stroke/fill style
function emblem(g,s,gap=true,planeOn=true){g.save();g.scale(s,s);g.lineCap='round';g.lineJoin='round';const R=150;
  g.lineWidth=6;g.beginPath();g.arc(0,0,R,0,7);g.stroke();g.lineWidth=3.4;
  for(const k of [0.36,0.74]){g.beginPath();g.ellipse(0,0,R*k,R,0,0,7);g.stroke();}g.beginPath();g.moveTo(0,-R);g.lineTo(0,R);g.stroke();
  for(const la of [-0.62,-0.3,0,0.3,0.62]){const y=R*Math.sin(la),hw=R*Math.cos(la);g.beginPath();g.ellipse(0,y,hw,hw*0.16,0,0,Math.PI);g.stroke();}
  g.save();g.rotate(-0.34);g.lineWidth=5;g.beginPath();g.ellipse(0,0,R*1.32,R*0.34,0,0,Math.PI);g.stroke();
  g.save();g.beginPath();g.rect(-500,-500,1000,1000);g.arc(0,0,R+10,0,7);g.clip('evenodd');g.beginPath();g.ellipse(0,0,R*1.32,R*0.34,0,Math.PI,2*Math.PI);g.stroke();g.restore();
  const ph=1.85*Math.PI,px=R*1.32*Math.cos(ph),py=R*0.34*Math.sin(ph),ang=Math.atan2(R*0.34*Math.cos(ph),-R*1.32*Math.sin(ph));
  if(planeOn){if(gap){const op=g.globalCompositeOperation;g.globalCompositeOperation='destination-out';plane(g,px,py,ang,3.4,'#000');g.globalCompositeOperation=op;}plane(g,px,py,ang,2.7,g.fillStyle);}g.restore();
  laurel(g,R*1.5);
  g.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?7:17;g.lineTo(Math.cos(a)*r,-R*1.74+Math.sin(a)*r);}g.closePath();g.fill();
  g.restore();}

/* ---------- static background ---------- */
function buildBg(){
  bgLayer=bgLayer||document.createElement('canvas');bgLayer.width=W;bgLayer.height=H;const g=bgLayer.getContext('2d');
  const og=g.createLinearGradient(0,0,0,H);og.addColorStop(0,'#ece8ec');og.addColorStop(1,'#e2dde3');g.fillStyle=og;g.fillRect(0,0,W,H);
  g.save();g.shadowColor='rgba(60,10,20,.35)';g.shadowBlur=40;g.shadowOffsetY=14;rr(g,CARD.x,CARD.y,CARD.w,CARD.h,CARD.r);g.fillStyle=theme().card;g.fill();g.restore();
  g.save();rr(g,CARD.x,CARD.y,CARD.w,CARD.h,CARD.r);g.clip();g.globalCompositeOperation='soft-light';g.globalAlpha=0.55;g.drawImage(GRAIN[0],CARD.x,CARD.y,CARD.w,CARD.h);g.restore();
  const P=PG;g.save();rr(g,P.x,P.y,P.w,P.h,36);g.clip();
  const pg=g.createLinearGradient(P.x,P.y,P.x+P.w,P.y+P.h);pg.addColorStop(0,'#fbf7f6');pg.addColorStop(.5,'#f6f1f6');pg.addColorStop(1,'#f3eef6');g.fillStyle=pg;g.fillRect(P.x,P.y,P.w,P.h);
  // paper tooth + fibres (seeded)
  g.globalCompositeOperation='overlay';g.globalAlpha=0.08;g.fillStyle=g.createPattern(GRAIN[1],'repeat');g.fillRect(P.x,P.y,P.w,P.h);g.globalCompositeOperation='source-over';g.globalAlpha=1;
  g.lineCap='round';g.lineWidth=0.7;for(let i=0;i<1600;i++){const x=P.x+hash(i*3.1+0.5)*P.w,y=P.y+hash(i*7.7+0.3)*P.h,l=5+16*hash(i+11.2),a=hash(i+21.7)*Math.PI;
    g.strokeStyle=`hsla(${310+40*hash(i+31.1)},35%,${50+20*hash(i+41.3)}%,${0.05+0.07*hash(i+51.9)})`;g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+Math.cos(a)*l*0.5+3,y+Math.sin(a)*l*0.5,x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke();}
  for(let y=P.y;y<P.y+P.h;y+=7){g.beginPath();for(let x=P.x;x<=P.x+P.w;x+=6){const yy=y+3*Math.sin(x/38+y/90)+2*Math.sin(x/11+y/30);x===P.x?g.moveTo(x,yy):g.lineTo(x,yy);}const hue=y<PAGE2Y?300:340;g.strokeStyle=`hsla(${hue+(y%60)},60%,70%,.10)`;g.lineWidth=0.8;g.stroke();}
  guilloche(g,P.x+P.w*0.80,P.y+170,170,37,60,'#e6a0b8',0.10,0.7,180);guilloche(g,P.x+P.w*0.62,PAGE2Y+330,300,41,110,'#b9a2e6',0.09,0.7,200);guilloche(g,P.x+90,PAGE2Y+600,190,29,80,'#9fd3e0',0.10,0.7,200);
  g.save();g.translate(W/2+150,PAGE2Y+440);g.strokeStyle=g.fillStyle='rgba(120,60,120,.045)';emblem(g,1.25,false);g.restore(); // watermark
  const sg=g.createRadialGradient(P.x+P.w-70,P.y+150,0,P.x+P.w-70,P.y+150,120);sg.addColorStop(0,'rgba(255,214,214,.55)');sg.addColorStop(1,'rgba(255,214,214,0)');g.fillStyle=sg;g.fillRect(P.x,P.y,P.w,400);
  g.setLineDash([6,8]);g.strokeStyle='rgba(120,90,120,.35)';g.lineWidth=1.5;g.beginPath();g.moveTo(P.x+20,PAGE2Y);g.lineTo(P.x+P.w-20,PAGE2Y);g.stroke();g.setLineDash([]);
  const fold=g.createLinearGradient(0,PAGE2Y-26,0,PAGE2Y+26);fold.addColorStop(0,'rgba(90,40,80,0)');fold.addColorStop(.5,'rgba(90,40,80,.07)');fold.addColorStop(1,'rgba(90,40,80,0)');g.fillStyle=fold;g.fillRect(P.x,PAGE2Y-26,P.w,52);
  const yrs=S&&S.ok?`${S.years[0].y}-${S.years[S.years.length-1].y}`:'';const nm=S?S.P.latin.replace(/ /g,'·'):'';
  g.save();g.translate(P.x+P.w-26,PAGE2Y+70);g.rotate(Math.PI/2);g.font=F(400,13,'SM');g.fillStyle='rgba(110,80,110,.35)';g.fillText(`${nm}·FLIGHT·LOG·${yrs}·`.repeat(4),0,0);g.restore();
  g.font=F(400,20,'SM');g.fillStyle='rgba(120,100,140,.5)';g.textAlign='center';g.fillText(`@ ${S?S.P.latin:''}  ·  SKY  PASSPORT`,W/2,MAP.y+MAP.h+28);g.textAlign='left';
  g.restore();
  g.font=F(600,26);g.fillStyle='#3a1f2a';g.textAlign='center';g.fillText('航 迹 护 照   ·   F L I G H T   L O G',W/2,78);g.textAlign='left';
}

/* ---------- map ---------- */
function camT(g,c){g.setTransform(c.z,0,0,c.z,MAP.w/2-c.cx*c.z,MAP.h/2-c.cy*c.z);}
function toScr(p,c){return [MAP.w/2+(p[0]-c.cx)*c.z,MAP.h/2+(p[1]-c.cy)*c.z];}
function ctrl(a,b){const dx=b[0]-a[0],dy=b[1]-a[1];const L=Math.hypot(dx,dy)||1;let nx=-dy/L,ny=dx/L;if(ny>0){nx=-nx;ny=-ny;}return [(a[0]+b[0])/2+nx*L*.18,(a[1]+b[1])/2+ny*L*.18];}
function qpt(a,c,b,u){const m=1-u;return [m*m*a[0]+2*m*u*c[0]+u*u*b[0],m*m*a[1]+2*m*u*c[1]+u*u*b[1]];}
function qtan(a,c,b,u){return [2*(1-u)*(c[0]-a[0])+2*u*(b[0]-c[0]),2*(1-u)*(c[1]-a[1])+2*u*(b[1]-c[1])];}
function strokeQ(g,a,c,b,u){const n=Math.max(8,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/6));g.beginPath();g.moveTo(a[0],a[1]);for(let i=1;i<=n;i++){const p=qpt(a,c,b,u*i/n);g.lineTo(p[0],p[1]);}g.stroke();}
const PLANE=new Path2D('M11 0L7 -1.6L1 -1.6L-4 -9L-6.5 -9L-3 -1.6L-8 -1.6L-10.5 -4.5L-12 -4.5L-10.5 0L-12 4.5L-10.5 4.5L-8 1.6L-3 1.6L-6.5 9L-4 9L1 1.6L7 1.6Z');
function plane(g,x,y,ang,s,col,outline){g.save();g.translate(x,y);g.rotate(ang);g.scale(s,s);if(outline){g.lineJoin='round';g.lineWidth=outline/s;g.strokeStyle='rgba(255,255,255,.95)';g.stroke(PLANE);}g.fillStyle=col;g.fill(PLANE);g.restore();}
function punchAt(t){let s=0;const ev=[T_OPEN,...S.years.map(y=>y.t),S.T_ZOOM];for(const e of ev){const u=(t-e)/0.667;if(u>=0&&u<1)s=Math.max(s,0.03*(1-easeOut(u)));}return 1+s;}
function drawMap(t,cam){
  const sc=S;hg.setTransform(1,0,0,1,0,0);hg.globalCompositeOperation='source-over';hg.clearRect(0,0,MAP.w,MAP.h);
  const x0=toScr([0,0],cam)[0],x1=toScr([MAP.w,0],cam)[0];const gr=hg.createLinearGradient(x0,0,x1,0);
  gr.addColorStop(0,'#c58be0');gr.addColorStop(.18,'#b98fe6');gr.addColorStop(.30,'#d685c6');gr.addColorStop(.42,'#ea8fb0');gr.addColorStop(.55,'#e98aa8');gr.addColorStop(.68,'#8fb4ef');gr.addColorStop(.85,'#7fc6e8');gr.addColorStop(1,'#78d8c2');hg.fillStyle=gr;
  const rev=clamp((t-T_OPEN)/BAR);let ri=0;for(let y=0;y<MAP.h;y+=4.6,ri++){const w=MAP.w*clamp(rev*1.8-hash(ri)*0.8);if(w>0)hg.fillRect(0,y,w,1.25);}
  mk.setTransform(1,0,0,1,0,0);mk.clearRect(0,0,MAP.w,MAP.h);camT(mk,cam);mk.fillStyle='#000';mk.fill(sc.landP);if(sc.chinaP)mk.fill(sc.chinaP);mk.setTransform(1,0,0,1,0,0);
  hg.globalCompositeOperation='destination-in';hg.drawImage(maskCv,0,0);hg.globalCompositeOperation='source-over';
  mg.setTransform(1,0,0,1,0,0);mg.clearRect(0,0,MAP.w,MAP.h);
  const ga=clamp(rev*1.4);if(ga>0){camT(mg,cam);mg.lineWidth=1/cam.z;mg.strokeStyle=`rgba(120,80,150,${0.13*ga})`;mg.stroke(sc.gratP);mg.setTransform(1,0,0,1,0,0);} // graticule: parallax depth when the camera moves
  mg.drawImage(hatchCv,0,0);
  camT(mg,cam);
  for(const k of sc.order){const v=t-sc.visit[k],a=clamp(v/0.6),p=sc.cpath[k];if(a<=0||!p)continue;const fl=clamp(v/0.12)*Math.exp(-Math.max(0,v-0.12)/0.45); // first-visit flash
    const clip=sc.outsideCN&&!REGIONS.has(k);if(clip){mg.save();mg.clip(sc.outsideCN,'evenodd');} // other countries never paint inside China's standard outline
    mg.fillStyle=`rgba(150,30,70,${0.16*a+0.2*fl})`;mg.fill(p);mg.lineWidth=(1.1+1.4*fl)/cam.z;mg.strokeStyle=`rgba(140,30,70,${0.45*a+0.3*fl})`;mg.stroke(p);if(clip)mg.restore();}
  if(sc.jdP){const ja=clamp(rev*1.4);if(ja>0){mg.fillStyle=`rgba(140,30,70,${0.6*ja})`;mg.fill(sc.jdP);mg.lineWidth=0.7/cam.z;mg.strokeStyle=`rgba(140,30,70,${0.6*ja})`;mg.stroke(sc.jdP);}} // nine-dash line, always shown
  mg.setTransform(1,0,0,1,0,0);drawRoutes(mg,t,cam);
  const fe=60;mg.globalCompositeOperation='destination-out';
  for(const [x,y,w,h,gx0,gy0,gx1,gy1] of [[0,0,fe,MAP.h,0,0,fe,0],[MAP.w-fe,0,fe,MAP.h,MAP.w,0,MAP.w-fe,0],[0,0,MAP.w,fe,0,0,0,fe],[0,MAP.h-fe,MAP.w,fe,0,MAP.h,0,MAP.h-fe]]){const g1=mg.createLinearGradient(gx0,gy0,gx1,gy1);g1.addColorStop(0,'#000');g1.addColorStop(1,'rgba(0,0,0,0)');mg.fillStyle=g1;mg.fillRect(x,y,w,h);}
  mg.globalCompositeOperation='source-over';
  const p=punchAt(t);ctx.save();ctx.translate(MAP.x+MAP.w/2,MAP.y+MAP.h/2);ctx.scale(p,p);ctx.drawImage(mapCv,-MAP.w/2,-MAP.h/2);ctx.restore();
}
function drawRoutes(g,t,cam){
  const sc=S,outro=clamp((t-sc.T_ZOOM)/1.5);const seen=new Set(),lead=sc.flights[curIdx(t)];g.lineCap='round';g.lineJoin='round';
  for(const f of sc.flights){if(t<f.t0)break;const a=toScr(f.a,cam),b=toScr(f.b,cam),c=ctrl(a,b);const u=clamp((t-f.t0)/f.dur),ue=ease(u),active=u<1,age=t-f.t1;
    const col=f.up?'rgba(30,110,200,':f.vd?'rgba(120,100,115,':'rgba(205,30,55,';g.setLineDash(f.up||f.vd?[7,6]:[]);
    if(active){const p=qpt(a,c,b,ue),tg=qtan(a,c,b,ue),ang=Math.atan2(tg[1],tg[0]),alt=Math.sin(Math.PI*u);
      g.lineWidth=10;g.strokeStyle=col+'0.10)';strokeQ(g,a,c,b,ue); // soft halo
      const lg=g.createLinearGradient(a[0],a[1],p[0]+0.01,p[1]);lg.addColorStop(0,col+'0.35)');lg.addColorStop(1,col+'1)');g.lineWidth=3.4;g.strokeStyle=lg;strokeQ(g,a,c,b,ue);g.setLineDash([]);
      const ld=f===lead,ps=ld?1.5+0.18*alt:1.15+0.08*alt;g.save();if(!ld)g.globalAlpha=0.7;
      plane(g,p[0]+5*alt,p[1]+8*alt,ang,ps,`rgba(70,20,40,${0.08+0.14*alt})`); // ground shadow drifts away at cruise altitude
      plane(g,p[0],p[1],ang,ps,f.up?'#1e6ec8':f.vd?'#7a6a74':'#c41e37',ld?2.4:1.8);g.restore();}
    else{const fr=clamp(1-age/1.2);g.lineWidth=1.5+1.6*fr;g.strokeStyle=col+(0.42+0.5*fr+0.2*outro)+')';strokeQ(g,a,c,b,1);}
    g.setLineDash([]);seen.add(f.f);if(!active)seen.add(f.to);}
  if(t>sc.T_ZOOM){const tz=t-sc.T_ZOOM,al=clamp(tz/0.6);let k=0;for(const f of sc.flights){k++;if(f.up)continue;const a=toScr(f.a,cam),b=toScr(f.b,cam),c=ctrl(a,b);const u0=(tz*0.55+hash(k))%1;
    for(let j=6;j>=0;j--){const u=u0-j*0.02;if(u<0)continue;const p=qpt(a,c,b,u),aa=al*Math.sin(Math.PI*u)*(1-j*0.13);
      if(!j){g.beginPath();g.arc(p[0],p[1],10,0,7);g.fillStyle=`rgba(230,40,80,${0.3*aa})`;g.fill();}
      g.beginPath();g.arc(p[0],p[1],j?3.2-j*0.35:3.9,0,7);g.fillStyle=`rgba(255,240,244,${aa})`;g.fill();}}}
  for(const code of seen){const p=toScr(sc.proj([AP[code].lon,AP[code].lat]),cam);g.beginPath();g.arc(p[0],p[1],3.6,0,7);g.fillStyle='#fff';g.fill();g.lineWidth=2;g.strokeStyle='#b0173a';g.stroke();}
  for(const f of sc.flights){const d=t-f.t0;if(d>=0&&d<0.5){const p=toScr(f.a,cam);g.beginPath();g.arc(p[0],p[1],5+16*easeOut(d/0.5),0,7);g.lineWidth=1.6;g.strokeStyle=`rgba(200,30,60,${0.5*(1-d/0.5)})`;g.stroke();}
    const a=t-f.t1;if(a>0&&a<0.7){const p=toScr(f.b,cam);g.beginPath();g.arc(p[0],p[1],6+26*easeOut(a/0.7),0,7);g.lineWidth=2;g.strokeStyle=`rgba(200,30,60,${0.8*(1-a/0.7)})`;g.stroke();}}
  // destination code beside the arriving plane, only when the flight stays on screen long enough to read
  if(t<=sc.T_FE){const ci=curIdx(t);if(ci>=0){const f=sc.flights[ci],nx=sc.flights[ci+1],end=Math.min(nx?nx.t0:1e9,f.t1+0.6);if(end-f.t0>=0.5){const al=Math.min(clamp((t-f.t0-0.05)/0.15),clamp((end-t)/0.15));
    if(al>0){const p=toScr(f.b,cam);g.save();g.globalAlpha=al;g.font=F(700,20,'SM');g.lineJoin='round';g.lineWidth=6;g.strokeStyle='rgba(251,247,249,.92)';g.strokeText(f.to,p[0]+10,p[1]-10);g.fillStyle='#6a1832';g.fillText(f.to,p[0]+10,p[1]-10);g.restore();}}}}
}
/* ---------- page UI ---------- */
function curIdx(t){let k=-1;const fl=S.flights;for(let i=0;i<fl.length;i++){if(fl[i].t0<=t)k=i;else break;}return k;}
function yearIdx(t){let k=-1;for(let i=0;i<S.years.length;i++)if(S.years[i].t<=t)k=i;return k;}
function drawFlags(t){
  const sc=S;const shown=sc.order.filter(c=>sc.visit[c]<=t+1e-4);const N=sc.order.length;
  const rows=N<=9?1:N<=20?2:3;const per=Math.ceil(N/rows);const step=Math.min(50,860/per),R=Math.min(21,step*0.44),rowH=Math.min(50,96/rows+8);
  shown.forEach((c,i)=>{const a=easeOut(clamp((t-sc.visit[c])/0.45));const s=0.4+0.6*a+0.25*Math.sin(Math.PI*a);
    const row=Math.floor(i/per),j=i-row*per,cnt=Math.min(per,N-row*per);const x=W/2+(j-(cnt-1)/2)*step,y=192+row*rowH-(rows-1)*6;
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);const sh=ctx.createRadialGradient(0,2,R,0,2,R+11);sh.addColorStop(0,'rgba(0,0,0,.2)');sh.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=sh;ctx.beginPath();ctx.arc(0,2,R+11,0,7);ctx.fill(); // gradient shadow: shadowBlur is not pixel-stable on the GPU
    ctx.beginPath();ctx.arc(0,0,R+3,0,7);ctx.fillStyle='#fff';ctx.fill();
    ctx.beginPath();ctx.arc(0,0,R,0,7);ctx.clip();const im=flagImg(c);if(im)ctx.drawImage(im,-R,-R,2*R,2*R);else if(c==='TW'){ctx.fillStyle='#efe4ea';ctx.fillRect(-R,-R,2*R,2*R);ctx.fillStyle='#8e1d38';ctx.font=F(700,R*0.62);ctx.textAlign='center';ctx.fillText('台湾',0,R*0.23);ctx.textAlign='left';} // neutral marker, no flag
    else{ctx.fillStyle='#c9b7c4';ctx.fillRect(-R,-R,2*R,2*R);ctx.fillStyle='#4b1019';ctx.font=F(700,R*0.8,'SM');ctx.textAlign='center';ctx.fillText(c,0,R*0.3);}
    const hl=ctx.createRadialGradient(-R*0.38,-R*0.5,0,-R*0.38,-R*0.5,R*1.15);hl.addColorStop(0,'rgba(255,255,255,.42)');hl.addColorStop(.55,'rgba(255,255,255,.06)');hl.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=hl;ctx.fillRect(-R,-R,2*R,2*R);ctx.lineWidth=2;ctx.strokeStyle='rgba(0,0,0,.10)';ctx.beginPath();ctx.arc(0,0,R-1,0,7);ctx.stroke();ctx.restore();});
}
function label(x,y,l,v,vs=27){ctx.font=F(400,19);ctx.fillStyle='#9a2b46';ctx.fillText(l,x,y);ctx.font=F(600,vs);ctx.fillStyle='#1d1420';ctx.fillText(v,x,y+vs+6);}
function fitText(txt,maxW,size,weight=600,fam='OS'){let s=size;ctx.font=F(weight,s,fam);while(ctx.measureText(txt).width>maxW&&s>12){s-=1;ctx.font=F(weight,s,fam);}return s;}
// placeholder portrait: line-engraved silhouette, the way passport security print renders a photo
function buildPhotoPh(){const g=photoCv.getContext('2d'),pw=270,ph=330,cx=pw/2;g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.clearRect(0,0,pw,ph);
  const bgr=g.createLinearGradient(0,0,pw,ph);bgr.addColorStop(0,'#f3dde6');bgr.addColorStop(1,'#dcd0f0');g.fillStyle=bgr;g.fillRect(0,0,pw,ph);
  guilloche(g,cx,ph*0.42,128,23,52,'#8e1d38',0.16,1,120);
  const sil=new Path2D();sil.ellipse(cx,ph*0.40,pw*0.20,ph*0.205,0,0,Math.PI*2);
  sil.moveTo(-2,ph+2);sil.lineTo(-2,ph*0.88);sil.bezierCurveTo(pw*0.06,ph*0.76,cx-pw*0.27,ph*0.71,cx-pw*0.11,ph*0.645);sil.lineTo(cx-pw*0.10,ph*0.55);sil.lineTo(cx+pw*0.10,ph*0.55);
  sil.lineTo(cx+pw*0.11,ph*0.645);sil.bezierCurveTo(cx+pw*0.27,ph*0.71,pw*0.94,ph*0.76,pw+2,ph*0.88);sil.lineTo(pw+2,ph+2);sil.closePath();
  g.save();g.clip(sil);g.fillStyle='rgba(244,228,237,.9)';g.fillRect(0,0,pw,ph);g.strokeStyle='#7d1832';g.lineCap='round';
  for(let y=3;y<ph;y+=4.6){for(let x=0;x<pw;x+=9){const hx=(x+4.5-cx)/(pw*0.2),hy=(y-ph*0.36)/(ph*0.2),head=y<ph*0.62?Math.max(0,1-Math.hypot(hx+0.35,hy+0.3)*0.8):0;
    const s=clamp(0.22+0.55*(x/pw)+0.25*(y/ph)-0.6*head);g.lineWidth=0.4+1.9*s;g.globalAlpha=0.5+0.35*s;g.beginPath();g.moveTo(x,y+0.6*Math.sin(x*0.07+y*0.02));g.lineTo(x+9,y+0.6*Math.sin((x+9)*0.07+y*0.02));g.stroke();}}
  g.restore();g.globalAlpha=0.55;g.lineWidth=2;g.strokeStyle='#8e1d38';g.stroke(sil);g.globalAlpha=1;photoBuilt=true;}
// optically variable rosette laminated over the photo corner; its rainbow turns with time
function ovd(g,x,y,r,t){const ga=g.globalAlpha;let st='rgba(180,140,255,1)';if(g.createConicGradient){st=g.createConicGradient(t*0.9,x,y);['#ff6fae','#ffcf5c','#7ff0c2','#6fb3ff','#c08bff','#ff6fae'].forEach((c,i)=>st.addColorStop(i/5,c));}
  g.save();g.globalAlpha=0.14*ga;g.fillStyle=st;g.beginPath();g.arc(x,y,r,0,7);g.fill();g.restore();guilloche(g,x,y,r,r*0.21,r*0.47,st,0.55*ga,1.2,70);}
function drawPhoto(px,py,pw,ph,t){
  ctx.save();rr(ctx,px,py,pw,ph,10);ctx.clip();const P=S.P;
  if(P.photo){const im=P.photo;const r=pw/ph,ir=im.width/im.height;let sw,sh,sx,sy;if(ir>r){sh=im.height;sw=sh*r;sx=(im.width-sw)/2;sy=0;}else{sw=im.width;sh=sw/r;sx=0;sy=(im.height-sh)*0.35;}ctx.drawImage(im,sx,sy,sw,sh,px,py,pw,ph);}
  else{if(!photoBuilt)buildPhotoPh();ctx.drawImage(photoCv,px,py,pw,ph);}
  const ga=ctx.globalAlpha;ctx.globalAlpha=0.10*ga;for(let y=py;y<py+ph;y+=6){ctx.fillStyle='#b77ad8';ctx.fillRect(px,y,pw,1);}ctx.globalAlpha=ga;
  ovd(ctx,px+pw-34,py+ph-40,62,t);
  ctx.restore();
}
function drawInfo(t,st){
  const sc=S,P=sc.P,top=PAGE2Y+66;const rv=clamp((t-T_OPEN-0.15)/BAR);const grp=i=>{ctx.globalAlpha=easeOut(clamp((rv-i*0.085)/0.3));};
  grp(0);ctx.font=F(600,28);ctx.fillStyle='#8e1d38';ctx.fillText('FLIGHT  LOG',92,top);ctx.font=F(400,20);ctx.fillText('航迹护照',92,top+30);
  const nsz=fitText(P.natEn,330,40);ctx.font=F(600,nsz);ctx.textAlign='center';ctx.fillText(P.natEn,600,top+4);ctx.textAlign='left';
  grp(1);ctx.save();ctx.translate(880,top-30);rr(ctx,0,0,64,40,8);ctx.fillStyle='#2b1b24';ctx.fill();ctx.beginPath();ctx.arc(32,20,11,0,7);ctx.lineWidth=4;ctx.strokeStyle='#f3eef3';ctx.stroke();ctx.fillStyle='#f3eef3';ctx.fillRect(4,18,14,4);ctx.fillRect(46,18,14,4);ctx.restore();
  grp(2);const px=92,py=top+62,pw=270,ph=330;drawPhoto(px,py,pw,ph,t);
  ctx.strokeStyle='#8e1d38';ctx.lineWidth=4;const L=26,e=8;[[px-e,py-e,1,1],[px+pw+e,py-e,-1,1],[px-e,py+ph+e,1,-1],[px+pw+e,py+ph+e,-1,-1]].forEach(([x,y,sx,sy])=>{ctx.beginPath();ctx.moveTo(x+sx*L,y);ctx.lineTo(x,y);ctx.lineTo(x,y+sy*L);ctx.stroke();});
  const fx=410,fy=top+64;const pno=(P.latin.replace(/ /g,'').slice(0,3)+String(sc.final.n).padStart(3,'0')+String(sc.years[sc.years.length-1].y).slice(2)).toUpperCase();
  grp(3);label(fx,fy,'Type / 类型','P');label(fx+170,fy,'Code / 国家码',P.nat3);label(fx+350,fy,'Passport No. / 号码',pno);
  grp(4);ctx.font=F(400,19);ctx.fillStyle='#9a2b46';ctx.fillText('Name / 姓名',fx,fy+92);const ns=fitText(P.disp,300,30);ctx.font=F(600,ns);ctx.fillStyle='#1d1420';ctx.fillText(P.disp,fx,fy+92+36);
  grp(5);label(fx,fy+184,'Date of issue / 签发',ISSUE);
  const cx=830,cy=top+262;const pz=1+0.12*Math.max(0,1-Math.abs(t-sc.T_STAMP-0.12)/0.35)*(t>sc.T_STAMP?1:0);ctx.save();ctx.translate(cx,cy-40);ctx.scale(pz,pz);ctx.translate(-cx,-(cy-40));
  const big=String(st.n);ctx.font=F(600,big.length>3?92:112);ctx.fillStyle='#1d1420';ctx.textAlign='center';ctx.fillText(big,cx,cy);ctx.font=F(400,28);ctx.fillText('flights · 航班',cx,cy+42);ctx.textAlign='left';ctx.restore();
  grp(6);label(fx+350,fy+276,'Authority / 签发机关','SKY PASSPORT');
  grp(7);const r1=top+430,r2=top+525,cols=[92,420,740];ctx.strokeStyle='rgba(142,29,56,.18)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(92,r1-34);ctx.lineTo(W-100,r1-34);ctx.stroke();
  label(cols[0],r1,'Distance / 里程',fmt(st.km)+' km',30);label(cols[1],r1,'Flight time / 飞行时长',hm(st.min),30);label(cols[2],r1,'Around Earth / 绕地球',(st.km/40075).toFixed(2)+' ×',30);
  label(cols[0],r2,'Countries & regions / 国家地区',String(st.cc),30);label(cols[1],r2,'Airports / 机场',String(st.ap),30);label(cols[2],r2,'Airlines / 航司',String(st.al),30);
  ctx.globalAlpha=1;ctx.font=F(400,28,'SM');ctx.fillStyle='#2a2230';const nc=Math.floor(clamp((rv-0.35)/0.6)*88);
  const m1=('P<'+P.nat3+P.latin.replace(/ /g,'<')+'<<FLIGHT<LOG').padEnd(44,'<').slice(0,44);const m2=(pno+'<4'+P.nat3+ISSUE6+'<'+String(st.n).padStart(3,'0')+'<'+ISSUE6).padEnd(44,'<').slice(0,44);
  ctx.fillText(m1.slice(0,Math.min(44,nc)),86,PG.y+PG.h-96);if(nc>44)ctx.fillText(m2.slice(0,nc-44),86,PG.y+PG.h-52);
}
function drawTicker(t){
  const sc=S;if(t<T_F0-0.3||t>sc.T_ZOOM+0.3)return;const fade=Math.min(clamp((t-T_F0+0.3)/0.3),1-clamp((t-sc.T_ZOOM)/0.3));
  ctx.save();ctx.globalAlpha=fade;const k=Math.max(0,yearIdx(t));const Y=sc.years[k];const prev=k>0?sc.years[k-1].y:Y.y;const u=easeOut(clamp((t-Y.t)/0.28));
  const x=MAP.x+18,yb=MAP.y+MAP.h-58,lh=50;ctx.save();ctx.beginPath();ctx.rect(x-4,yb-47,260,48);ctx.clip();ctx.font=F(700,64,'SM');ctx.fillStyle='rgba(120,30,70,.88)';
  const sN=String(Y.y),sO=String(prev);const cw=ctx.measureText('0').width;for(let d=0;d<4;d++){const cx=x+d*cw;if(sN[d]===sO[d]||k===0)ctx.fillText(sN[d],cx,yb);else{ctx.fillText(sO[d],cx,yb-u*lh);ctx.fillText(sN[d],cx,yb+(1-u)*lh);}}ctx.restore();
  const i=curIdx(t),bx=MAP.x+22,by=MAP.y+MAP.h-16;
  if(t<=sc.T_FE+0.2){if(Y.n===0||(i>=0&&sc.flights[i].y!==Y.y)){ctx.font=F(400,26,'SM');ctx.fillStyle='rgba(60,30,50,.9)';ctx.fillText('NO FLIGHTS · 无航班',bx,by);}
    else if(i>=0){const f=sc.flights[i],pf=i>0&&sc.flights[i-1].y===f.y?sc.flights[i-1]:null,r=pf?easeOut(clamp((t-f.t0)/0.12)):1,lab=g=>`${g.fn}  ${g.f} → ${g.to}`;
      ctx.save();ctx.beginPath();ctx.rect(bx-6,by-31,720,39);ctx.clip();ctx.font=F(700,30,'SM');ctx.fillStyle='rgba(60,30,50,.92)'; // departure-board roll
      if(r<1){ctx.globalAlpha=fade*(1-r);ctx.fillText(lab(pf),bx,by-32*r);}ctx.globalAlpha=fade*r;ctx.fillText(lab(f),bx,by+32*(1-r));ctx.restore();ctx.globalAlpha=fade;
      const tag=f.vd?['VOID · 退票/作废','#7a6a74']:f.up?['UPCOMING · 待出行','#1e6ec8']:null;if(tag){ctx.font=F(700,20,'SM');ctx.save();ctx.translate(MAP.x+235,MAP.y+MAP.h-104);ctx.rotate(-0.12);ctx.strokeStyle=tag[1];ctx.lineWidth=3;rr(ctx,-8,-26,250,38,6);ctx.stroke();ctx.fillStyle=tag[1];ctx.fillText(tag[0],4,0);ctx.restore();}}}
  ctx.restore();
}
function drawTimeline(t){
  const sc=S;ctx.save();ctx.globalAlpha=easeOut(clamp((t-T_OPEN-0.4)/0.6));const x0=MAP.x+40,x1=MAP.x+MAP.w-40,y=MAP.y+MAP.h+70;
  const yA=sc.years[0].y,yB=sc.years[sc.years.length-1].y+1;const S0=Date.UTC(yA,0,1),E0=Date.UTC(yB,0,1);
  ctx.strokeStyle='rgba(120,90,120,.3)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke();
  const i=curIdx(t);let yp=0;if(i>=0){const d=sc.flights[i].date.split('-');yp=clamp((Date.UTC(+d[0],+d[1]-1,+d[2])-S0)/(E0-S0));}
  const g=ctx.createLinearGradient(x0,0,x1,0);g.addColorStop(0,'#78d8c2');g.addColorStop(.5,'#b98fe6');g.addColorStop(1,'#c41e37');ctx.strokeStyle=g;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(lerp(x0,x1,yp),y);ctx.stroke();
  ctx.beginPath();ctx.arc(lerp(x0,x1,yp),y,6,0,7);ctx.fillStyle='#c41e37';ctx.fill();
  const span=yB-yA,stepY=span>14?Math.ceil(span/12):1;ctx.font=F(400,17,'SM');ctx.textAlign='center';ctx.fillStyle='rgba(80,50,80,.6)';
  for(let yy=yA;yy<yB;yy+=stepY){const xx=lerp(x0,x1,(Date.UTC(yy,0,1)-S0)/(E0-S0));ctx.fillText("'"+String(yy).slice(2),xx+20,y+21);}
  ctx.textAlign='left';ctx.restore();
}
function drawSheen(t){if(t<T_F0)return;const per=4*BAR,ph=((t-T_F0-2*BEAT)%per+per)%per;const u=ph/1.0;if(u>1)return;
  ctx.save();rr(ctx,PG.x,PG.y,PG.w,PG.h,36);ctx.clip();ctx.globalCompositeOperation='soft-light';const cx=lerp(-500,W+500,ease(u));const g=ctx.createLinearGradient(cx-260,0,cx+260,260);
  g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.3,'rgba(120,230,255,.55)');g.addColorStop(.5,'rgba(255,170,240,.75)');g.addColorStop(.7,'rgba(255,240,150,.55)');g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g;ctx.setTransform(1,0,-0.6,1,0,0);ctx.fillRect(-1000,0,W+3000,H);ctx.restore();}
function buildStamp(){const g=stampCv.getContext('2d');g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.globalAlpha=1;g.clearRect(0,0,520,280);g.translate(260,140);
  const col='#c0162f';g.strokeStyle=col;g.fillStyle=col;g.textAlign='center';
  const big=S.final.n+' FLIGHTS',sub=`${S.P.latin.slice(0,14)} · ${yearsLabel(S,' — ','')}`;
  const draw=()=>{g.lineWidth=6;rr(g,-210,-92,420,184,18);g.stroke();g.lineWidth=2.5;rr(g,-196,-78,392,156,12);g.stroke();
    let fs=64;g.font=F(700,fs);while(g.measureText(big).width>370&&fs>30){fs-=2;g.font=F(700,fs);}g.fillText(big,0,22);
    let ss=24;g.font=F(700,ss,'SM');while(g.measureText(sub).width>370&&ss>12){ss--;g.font=F(700,ss,'SM');}g.fillText(sub,0,60);g.font=F(600,20);g.fillText('已 飞 行 · TRAVELLED',0,-44);};
  g.globalAlpha=0.2;g.save();g.translate(5,-3);draw();g.restore();g.globalAlpha=1;draw(); // faint double strike
  for(let i=0;i<18;i++){const a=hash(i+700)*Math.PI*2,r=1.03+0.09*hash(i+720);g.beginPath();g.arc(Math.cos(a)*214*r,Math.sin(a)*96*r,0.8+2.6*Math.pow(hash(i+740),2),0,7);g.fill();} // splatter
  g.globalCompositeOperation='destination-out';
  for(let i=0;i<900;i++){const x=(hash(i)-0.5)*440,y=(hash(i+5000)-0.5)*200,r=0.4+Math.pow(hash(i+9000),3)*2.6;g.globalAlpha=0.35+0.65*hash(i+300);g.beginPath();g.arc(x,y,r,0,7);g.fill();}
  const f=stampFx.getContext('2d');f.setTransform(1,0,0,1,0,0);f.globalCompositeOperation='source-over';f.clearRect(0,0,520,280);f.globalAlpha=0.5;f.filter='blur(1.6px)';f.drawImage(stampCv,0,0);f.filter='none';f.globalAlpha=1;f.drawImage(stampCv,0,0); // ink bleed
  S.stampReady=true;}
function inkStamp(t){const sc=S;if(t<sc.T_STAMP)return;if(!sc.stampReady)buildStamp();const u=clamp((t-sc.T_STAMP)/0.16);const s=lerp(2.6,1,u*u);const X=W/2+215,Y=MAP.y+MAP.h-105;
  if(u<1){ctx.save();ctx.translate(X+18*(1-u),Y+26*(1-u));ctx.rotate(-0.14);ctx.scale(s*0.82,s*0.82);const sg=ctx.createRadialGradient(0,0,20,0,0,240);sg.addColorStop(0,`rgba(60,10,25,${0.28*u})`);sg.addColorStop(1,'rgba(60,10,25,0)');
    ctx.fillStyle=sg;ctx.beginPath();ctx.ellipse(0,0,240,120,0,0,7);ctx.fill();ctx.restore();} // the stamp's shadow closes in before contact
  ctx.save();ctx.globalAlpha=0.88*clamp(u*1.6);ctx.translate(X,Y);ctx.rotate(-0.14);ctx.scale(s*0.82,s*0.82);ctx.globalCompositeOperation='multiply';ctx.drawImage(stampFx,-260,-140);ctx.restore();}
/* ---------- passport cover (poster): leather + gold foil ---------- */
// passport cover colours (leather gradient stops + the page-card edge); the foil stays gold
const THEMES={burgundy:{c:['#6b1a2a','#4a0f1c','#1f050c'],card:'#4b1019'},navy:{c:['#2a3f63','#18284a','#070c18'],card:'#17264a'},
  green:{c:['#2b5a45','#173a2b','#06140d'],card:'#173c2d'},black:{c:['#3a3a3f','#1d1d21','#060607'],card:'#1d1d21'}};
const theme=()=>THEMES[(S&&S.P&&S.P.theme)||'burgundy']||THEMES.burgundy;let coverTheme='';
function buildCover(){coverTheme=(S&&S.P&&S.P.theme)||'burgundy';const TH=theme();
  const g=coverCv.getContext('2d'),m=foilCv.getContext('2d');g.setTransform(1,0,0,1,0,0);m.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';
  const bg=g.createRadialGradient(W/2,H*0.36,60,W/2,H*0.5,1300);bg.addColorStop(0,TH.c[0]);bg.addColorStop(.5,TH.c[1]);bg.addColorStop(1,TH.c[2]);g.fillStyle=bg;g.fillRect(0,0,W,H);
  g.save();g.imageSmoothingEnabled=true;g.globalCompositeOperation='soft-light';g.globalAlpha=0.5;g.drawImage(noiseTile(216,37,95),0,0,W,H);g.globalAlpha=0.28;g.drawImage(noiseTile(540,41,80),0,0,W,H);g.restore(); // pebble grain
  const vg=g.createRadialGradient(W/2,H*0.45,H*0.25,W/2,H*0.5,H*0.78);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.5)');g.fillStyle=vg;g.fillRect(0,0,W,H);
  m.clearRect(0,0,W,H);m.fillStyle=m.strokeStyle='#fff';m.textAlign='center';m.textBaseline='alphabetic';
  m.lineWidth=3;rr(m,44,44,W-88,H-88,34);m.stroke();m.lineWidth=1.4;rr(m,60,60,W-120,H-120,24);m.stroke();
  for(const [x,y] of [[96,96],[W-96,96],[96,H-96],[W-96,H-96]])guilloche(m,x,y,28,7,12,'#fff',1,1.2,60);
  m.save();m.translate(W/2,600);emblem(m,1,false,false);m.restore();
  m.font='600 26px "Open Sans",sans-serif';spaced(m,'FLIGHT  LOG',W/2,262,10);
  m.font=`900 132px ${SERIF}`;spaced(m,'航迹护照',W/2,1012,26);
  m.font='600 34px "Open Sans",sans-serif';spaced(m,'SKY PASSPORT',W/2,1080,15);
  m.lineWidth=2;m.beginPath();m.moveTo(W/2-200,1134);m.lineTo(W/2-26,1134);m.moveTo(W/2+26,1134);m.lineTo(W/2+200,1134);m.stroke();m.save();m.translate(W/2,1134);m.rotate(Math.PI/4);m.fillRect(-8,-8,16,16);m.restore();
  m.save();m.translate(W/2,1668);m.lineWidth=4.5;rr(m,-56,-34,112,68,12);m.stroke();m.beginPath();m.arc(0,0,17,0,7);m.stroke();m.fillRect(-48,-2.5,24,5);m.fillRect(24,-2.5,24,5);m.restore(); // chip mark
  // debossed into the leather: soft shadow below, faint rim light above
  g.save();g.filter='blur(2.5px)';g.globalAlpha=0.75;g.drawImage(tint(foilCv,'#10030a'),2,4);g.filter='none';g.globalAlpha=0.3;g.drawImage(tint(foilCv,'#ffb9a6'),-1,-1.5);g.restore();
  tint(foilCv,'#fff');fxg.globalCompositeOperation='source-in';const fg=fxg.createLinearGradient(0,150,W*0.35,H*0.95);
  [[0,'#f8e6b8'],[.18,'#d7a85f'],[.33,'#fbe7b5'],[.5,'#b98a4c'],[.66,'#f1d394'],[.82,'#a8773a'],[1,'#ecc782']].forEach(([o,c])=>fg.addColorStop(o,c));fxg.fillStyle=fg;fxg.fillRect(0,0,W,H);
  fxg.globalCompositeOperation='overlay';fxg.globalAlpha=0.3;fxg.fillStyle=fxg.createPattern(GRAIN[2],'repeat');fxg.fillRect(0,0,W,H);fxg.globalAlpha=1;
  fxg.globalCompositeOperation='destination-in';fxg.drawImage(foilCv,0,0);fxg.globalCompositeOperation='source-over';g.drawImage(fxCv,0,0);
  coverBuilt=true;}
function coverPlane(t){const R=150,rot=-0.34,ph=1.85*Math.PI+t*0.55,ex=R*1.32*Math.cos(ph),ey=R*0.34*Math.sin(ph);const x=W/2+ex*Math.cos(rot)-ey*Math.sin(rot),y=600+ex*Math.sin(rot)+ey*Math.cos(rot);
  if(Math.sin(ph)<0&&Math.hypot(x-W/2,y-600)<R+14)return; // far side of the orbit: behind the globe
  const ang=rot+Math.atan2(R*0.34*Math.cos(ph),-R*1.32*Math.sin(ph)),s=2.7*(0.9+0.1*Math.sin(ph));plane(ctx,x,y,ang,s*1.3,'rgba(34,6,13,.7)');plane(ctx,x,y,ang,s,goldText(ctx,y-30,y+30));}
// "2018 — 2023", or "2026 年度" when the film covers a single year
function yearsLabel(sc,sep,annual=L(' 年度','')){const a=sc.years[0].y,b=sc.years[sc.years.length-1].y;return a===b?a+annual:a+sep+b;}
function goldText(g,y0,y1){const gr=g.createLinearGradient(0,y0,0,y1);gr.addColorStop(0,'#fbe9c2');gr.addColorStop(.55,'#e2b670');gr.addColorStop(1,'#f6dca6');return gr;}
function drawPoster(t,T0){
  const sc=S,P=sc.P,F0=sc.final;if(!coverBuilt||coverTheme!==(P.theme||'burgundy'))buildCover();const lt=Math.max(0,t-T0);
  ctx.save();const pz=1+0.035*ease(clamp(lt/(T0===0?2.6*BAR:sc.T_END-T0))); // slow push-in; on the closing poster it runs to the last framectx.translate(W/2,H*0.42);ctx.scale(pz,pz);ctx.translate(-W/2,-H*0.42);
  ctx.drawImage(coverCv,0,0);coverPlane(t);
  // a band of light slides across the foil only: once on opening, once when the cover shuts
  const gu=(lt-(T0===0?0.9:sc.T_CARD+0.25-T0))/1.3;
  if(gu>0&&gu<1){const s=lerp(-700,W*0.8+H*0.6+700,easeInOut(gu));fxg.setTransform(1,0,0,1,0,0);fxg.globalAlpha=1;fxg.globalCompositeOperation='source-over';fxg.clearRect(0,0,W,H);
    const lg=fxg.createLinearGradient((s-190)*0.8,(s-190)*0.6,(s+190)*0.8,(s+190)*0.6);lg.addColorStop(0,'rgba(255,248,230,0)');lg.addColorStop(.5,'rgba(255,248,230,.95)');lg.addColorStop(1,'rgba(255,248,230,0)');
    fxg.fillStyle=lg;fxg.fillRect(0,0,W,H);fxg.globalCompositeOperation='destination-in';fxg.drawImage(foilCv,0,0);fxg.globalCompositeOperation='source-over';
    ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=0.9;ctx.drawImage(fxCv,0,0);ctx.restore();}
  ctx.textAlign='center';const k2=0.72+0.28*easeOut(clamp(lt/1.0));ctx.globalAlpha=k2;ctx.translate(0,10*(1-easeOut(clamp(lt/1.0))));
  const head=`${P.disp} · ${yearsLabel(sc,' — ')}`;const hs=fitText(head,900,52);ctx.font=F(600,hs);ctx.fillStyle=goldText(ctx,1176,1226);ctx.fillText(head,W/2,1218);
  ctx.font=F(400,30);ctx.fillStyle='#ecdccb';ctx.fillText(`${F0.n} flights  ·  ${fmt(F0.km)} km  ·  ${Math.round(F0.min/60)} hours in the sky`,W/2,1282);
  ctx.fillText(`${F0.cc} countries & regions  ·  ${F0.ap} airports  ·  ${F0.al} airlines`,W/2,1328);
  ctx.font=F(400,28);ctx.fillStyle='#d2b8ad';ctx.fillText(`${F0.n} 次航班 · ${(F0.km/10000).toFixed(1)} 万公里 · 绕地球 ${(F0.km/40075).toFixed(2)} 圈`,W/2,1386);
  const k3=easeOut(clamp((lt-1.8)/1.0));ctx.globalAlpha=k3;
  if(P.tagEn){const s=fitText(P.tagEn,900,30,400,'SM');ctx.font=F(400,s,'SM');ctx.fillStyle='#e8c38c';ctx.fillText(P.tagEn,W/2,1488);}
  if(P.tagZh){ctx.font=F(400,28);ctx.fillStyle='#d2b8ad';ctx.fillText(P.tagZh,W/2,1536);}
  if(T0===0){ctx.globalAlpha=k3*0.55;ctx.font=F(400,22,'SM');ctx.fillStyle='#c9ab92';ctx.fillText(('P<'+P.nat3+P.latin.replace(/ /g,'<')+'<<FLIGHT<LOG').padEnd(40,'<').slice(0,40),W/2,1792);}
  else{ctx.globalAlpha=k3*0.8;ctx.font=F(400,24,'SM');ctx.fillStyle='#e8c38c';ctx.fillText(SITE_HOST,W/2,1792);ctx.textAlign='left';drawQrCard(ctx,868,1590,132,k3,L('扫码生成你的护照','Scan to make yours'));ctx.textAlign='center';} // end card: where to make one
  ctx.globalAlpha=1;ctx.textAlign='left';ctx.setTransform(1,0,0,1,0,0);
  // dust drifting in the light (continuous, seeded — no per-frame reshuffle)
  ctx.globalCompositeOperation='screen';for(let i=0;i<42;i++){const sp=10+20*hash(i+90),x=hash(i)*W+38*Math.sin(t*0.37+i*1.7),y=((hash(i+50)*(H+200)-t*sp)%(H+200)+H+200)%(H+200)-100;
    ctx.fillStyle=`rgba(255,226,186,${(0.08+0.2*hash(i+170))*(0.6+0.4*Math.sin(t*1.3+i))})`;ctx.beginPath();ctx.arc(x,y,1.1+2.2*hash(i+130),0,7);ctx.fill();}
  ctx.restore();
  const k=easeOut(clamp(lt/1.1));if(k<1){ctx.fillStyle=`rgba(10,2,5,${0.3*(1-k)})`;ctx.fillRect(0,0,W,H);}
}
function drawPassport(t,cam){const sc=S;let sx=0,sy=0;const sh=t-sc.T_STAMP-0.16;if(sh>=0&&sh<0.3){const amp=14*(1-sh/0.3);sx=amp*Math.sin(sh*95);sy=amp*Math.cos(sh*77);}
  ctx.save();ctx.translate(sx,sy);ctx.drawImage(bgLayer,0,0);drawFlags(t);drawMap(t,cam);drawTicker(t);drawTimeline(t);drawInfo(t,stats(sc,t));drawSheen(t);inkStamp(t);ctx.restore();}
function cover(t,T0,u){ctx=pctx;pctx.setTransform(1,0,0,1,0,0);drawPoster(t,T0);ctx=mainCtx;const th=u*Math.PI/2,c=Math.cos(th),sn=Math.sin(th);if(c<0.01)return;const SW=12;
  for(let x=0;x<W;x+=SW){const k=x/W;const sy=1-0.16*sn*k;const h=H*sy;ctx.drawImage(posterCv,x,0,SW,H,x*c,(H-h)/2,SW*c+0.6,h);}
  const face=()=>{ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(W*c,H*0.08*sn);ctx.lineTo(W*c,H-H*0.08*sn);ctx.lineTo(0,H);ctx.closePath();};
  ctx.save();ctx.globalAlpha=0.5*u;ctx.fillStyle='#000';face();ctx.fill();ctx.restore();
  const sp=Math.sin(Math.PI*u)*0.28;if(sp>0.01){ctx.save();ctx.globalCompositeOperation='screen';const gx=ctx.createLinearGradient(0,0,W*c,0);gx.addColorStop(0,'rgba(255,214,190,0)');gx.addColorStop(0.7,`rgba(255,214,190,${sp})`);gx.addColorStop(1,'rgba(255,214,190,0)');ctx.fillStyle=gx;face();ctx.fill();ctx.restore();}
  const ew=10*sn;if(ew>0.5){ctx.fillStyle=theme().c[2];ctx.fillRect(W*c,H*0.08*sn,ew,H-H*0.16*sn);ctx.fillStyle='rgba(227,189,132,.5)';ctx.fillRect(W*c+ew*0.5,H*0.08*sn,1.2,H-H*0.16*sn);} // cover thickness
  ctx.save();const g=ctx.createLinearGradient(W*c+ew,0,W*c+ew+160,0);g.addColorStop(0,`rgba(20,0,8,${0.45*(1-u)})`);g.addColorStop(1,'rgba(20,0,8,0)');ctx.fillStyle=g;ctx.fillRect(W*c+ew,0,160,H);ctx.restore();}
const SWG=0.8,O0=T_OPEN-0.3; // cover swing: opening starts at O0, closing at T_CARD-0.55
function renderFrame(i){
  const sc=S;ctx=mainCtx;ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  if(!sc||!sc.ok){drawEmpty();return;}
  const t=i/FPS,cam=sc.cam[Math.min(i,sc.cam.length-1)];const o1=O0+SWG,c0=sc.T_CARD-0.55,c1=c0+SWG,TC=sc.T_CARD-3;
  if(t<O0||t>=c1){ctx=pctx;pctx.setTransform(1,0,0,1,0,0);drawPoster(t,t<O0?0:TC);ctx=mainCtx;ctx.drawImage(posterCv,0,0);grain(i,0.05);return;}
  drawPassport(t,cam);if(t<o1)cover(t,0,easeInOut(clamp((t-O0)/SWG)));if(t>=c0)cover(t,TC,1-easeInOut(clamp((t-c0)/SWG)));grain(i,t<o1||t>=c0?0.045:0.03);
}
function drawEmpty(){ctx.fillStyle='#1a060b';ctx.fillRect(0,0,W,H);ctx.fillStyle='#e3bd84';ctx.textAlign='center';ctx.font=F(600,44);ctx.fillText(L('还没有可用的航段','No flights to show yet'),W/2,H/2-20);ctx.font=F(400,30);ctx.fillStyle='#c3a99f';ctx.fillText(L('上传记录，或补全未识别的机场','Upload your log, or fix the unknown airports'),W/2,H/2+40);ctx.textAlign='left';}
