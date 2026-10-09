"use strict";
/* ================= sharing extras: QR end card, achievements, long poster, cover image ================= */
// printed on the end card and the poster: the https domain the page was opened from (falls back to the Vercel address locally)
const SITE_URL=(()=>{if(typeof location==='undefined')return 'https://sky-passport.vercel.app';const q=new URLSearchParams(location.search).get('site'); // ?site= lets the server renderer (loading from 127.0.0.1) print the public address
  if(q&&/^https:\/\/[\w.-]+$/.test(q))return q;return location.protocol==='https:'&&!/^(localhost|127\.)/.test(location.hostname)?location.origin:'https://sky-passport.vercel.app';})();
const SITE_HOST=SITE_URL.replace(/^https?:\/\//,'');

/* ---------- QR code (qrcode-generator), cached as a crisp canvas ---------- */
let qrCache=null;
function qrCanvas(){if(qrCache)return qrCache;if(typeof qrcode!=='function')return null;
  const q=qrcode(0,'M');q.addData(SITE_URL);q.make();const n=q.getModuleCount(),cell=8,pad=2,c=document.createElement('canvas');c.width=c.height=(n+pad*2)*cell;
  const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.fillStyle='#2a0b12';
  for(let r=0;r<n;r++)for(let k=0;k<n;k++)if(q.isDark(r,k))g.fillRect((k+pad)*cell,(r+pad)*cell,cell,cell);
  return qrCache=c;}
// end-card QR on the closing poster (bottom right, clear of the chip mark); a=fade
function drawQrCard(g,x,y,size,a,label){const q=qrCanvas();if(!q||a<=0)return;g.save();g.globalAlpha=a;
  g.fillStyle='rgba(255,250,240,.96)';rr(g,x-8,y-8,size+16,size+16,12);g.fill();g.imageSmoothingEnabled=false;g.drawImage(q,x,y,size,size);g.imageSmoothingEnabled=true;
  if(label){g.font=F(600,20);g.fillStyle='#e8c38c';g.textAlign='center';g.fillText(label,x+size/2,y+size+38);g.textAlign='left';}g.restore();}

/* ---------- achievements: everything is computed in code from the flights ---------- */
const placeName=c=>AP[c]?(apIndex().zh[c]||AP[c].city):c;
function computeBadges(sc){
  if(!sc||!sc.ok)return [];const flown=sc.flights.filter(f=>!f.vd&&!f.up),L=flown.length?flown:sc.flights.filter(f=>!f.vd);if(!L.length)return [];
  const out=[],home=sc.P.nat,cnt=(arr,key)=>{const m=new Map();for(const x of arr){const k=key(x);m.set(k,(m.get(k)||0)+1);}return [...m.entries()].sort((a,b)=>b[1]-a[1]);};
  const first=L.find(f=>f.fc!==home||f.tc!==home);
  if(first)out.push({i:'🛂',k:'首次出境',v:`${placeName(first.f)} → ${placeName(first.to)}`,d:first.date});
  const lng=L.reduce((a,b)=>b.km>a.km?b:a);out.push({i:'📏',k:'最长单程',v:`${fmt(lng.km)} km`,d:`${placeName(lng.f)} → ${placeName(lng.to)} · ${lng.fn}`});
  const route=cnt(L,f=>[f.f,f.to].sort().join('-'))[0];if(route&&route[1]>1){const [a,b]=route[0].split('-');out.push({i:'🔁',k:'最常飞航线',v:`${placeName(a)} ⇄ ${placeName(b)}`,d:`${route[1]} 次`});}
  const aps=cnt(L.flatMap(f=>[f.f,f.to]),x=>x),base=aps[0][0];out.push({i:'🛫',k:'最常去的机场',v:`${placeName(base)} ${base}`,d:`${aps[0][1]} 次起降`});
  let far=null,fk=0;for(const [c] of aps){const d=hav(AP[base],AP[c]);if(d>fk){fk=d;far=c;}}if(far)out.push({i:'🧭',k:'飞得最远的地方',v:placeName(far),d:`离${placeName(base)} ${fmt(fk)} km`});
  const ys=cnt(L,f=>f.y);if(ys.length>1)out.push({i:'📅',k:'最忙的一年',v:`${ys[0][0]} 年`,d:`${ys[0][1]} 段航班`});
  const red=L.filter(f=>f.hasT&&(+f.t.slice(0,2)>=22||+f.t.slice(0,2)<6)).length;if(red)out.push({i:'🌙',k:'红眼航班',v:`${red} 次`,d:'22:00–06:00 起飞'});
  const km=L.reduce((a,f)=>a+f.km,0),min=L.reduce((a,f)=>a+f.min,0);
  out.push({i:'⏱️',k:'在空中的时间',v:`${(min/1440).toFixed(1)} 天`,d:`${Math.round(min/60)} 小时`});
  const kg=km*0.09;out.push({i:'🌱',k:'碳排放（估算）',v:kg>=1000?`${(kg/1000).toFixed(1)} 吨 CO₂`:`${Math.round(kg)} kg CO₂`,d:`约 ${Math.max(1,Math.round(kg/20))} 棵树一年的吸收量`});
  out.push({i:'🌍',k:'飞行距离',v:`绕地球 ${(km/40075).toFixed(2)} 圈`,d:`地月距离的 ${Math.round(km/384400*100)}%`});
  return out;}
function renderBadges(){const box=$('badges');if(!box)return;box.innerHTML='';const B=computeBadges(S);
  if(!B.length){box.append(el('div',{cls:'badge'},el('div',{cls:'k'},'还没有已完成的航班')));return;}
  for(const b of B)box.append(el('div',{cls:'badge'},el('div',{cls:'k'},`${b.i} ${b.k}`),el('div',{cls:'v'},b.v),el('div',{cls:'d'},b.d)));}

/* ---------- long poster (1080 wide PNG for 朋友圈 / 小红书) ---------- */
// which blocks the long poster shows (remembered per browser); badges can be picked one by one
const POSTER_PARTS=[['name','名字'],['stats','统计数字'],['map','航线地图'],['flags','国旗 / 地区'],['badges','飞行成就'],['years','每年航班'],['qr','二维码']];
const POSTER_KEY='skypassport.poster';
function posterOpts(){let o={};try{o=JSON.parse(localStorage.getItem(POSTER_KEY)||'{}');}catch(e){}const parts={},off=new Set(o.badgesOff||[]);for(const [k] of POSTER_PARTS)parts[k]=o[k]!==false;return {parts,off};}
function savePosterOpts(o){const v={badgesOff:[...o.off]};for(const k in o.parts)v[k]=o.parts[k];try{localStorage.setItem(POSTER_KEY,JSON.stringify(v));}catch(e){}}
function renderPosterChecks(){const box=$('posterChecks');if(!box)return;box.innerHTML='';const o=posterOpts();
  const chk=(label,on,fn)=>{const c=el('input',{type:'checkbox',checked:on});c.addEventListener('change',()=>{fn(c.checked);savePosterOpts(o);renderPosterChecks();refreshPoster();});return el('label',{cls:'check'},c,' '+label);};
  box.append(el('div',{cls:'chkrow'},...POSTER_PARTS.map(([k,l])=>chk(l,o.parts[k],v=>{o.parts[k]=v;}))));
  const B=computeBadges(S);if(o.parts.badges&&B.length)box.append(el('div',{cls:'chkhead'},'显示哪些成就'),el('div',{cls:'chkrow'},...B.map(b=>chk(`${b.i} ${b.k}`,!o.off.has(b.k),v=>{if(v)o.off.delete(b.k);else o.off.add(b.k);}))));}
let lastIsPoster=false;
function refreshPoster(){if(lastIsPoster&&!$('imgOut').hidden)$('btnLong').click();}
async function renderLongPoster(){
  const sc=S;if(!sc||!sc.ok)return null;await Promise.all([ensureFonts(),loadFlags(sc.order)]);
  const {parts,off}=posterOpts(),B=parts.badges?computeBadges(sc).filter(b=>!off.has(b.k)):[],P=sc.P,F0=sc.final,TH=theme(),years=sc.years.filter(y=>y.n>0);
  const showYears=parts.years&&years.length>1,rowsB=Math.ceil(B.length/2);
  // block heights, top to bottom; the canvas is exactly as tall as what was chosen
  const Hd=560,Hn=170,Hs=parts.stats?320:0,Hm=parts.map?450:0,Hf=parts.flags?130:0,Hb=B.length?70+rowsB*150:0,Hy=showYears?300:0,Hq=parts.qr?260:110;
  const Hh=Hd+Hn+Hs+Hm+Hf+Hb+Hy+Hq+20;
  const c=document.createElement('canvas');c.width=W;c.height=Hh;const g=c.getContext('2d');const keep=ctx;ctx=g;
  try{
    const pg=g.createLinearGradient(0,0,W,Hh);pg.addColorStop(0,'#fbf7f6');pg.addColorStop(1,'#f1ecf5');g.fillStyle=pg;g.fillRect(0,0,W,Hh);
    g.save();g.globalCompositeOperation='overlay';g.globalAlpha=0.08;g.fillStyle=g.createPattern(GRAIN[1],'repeat');g.fillRect(0,0,W,Hh);g.restore();
    guilloche(g,W*0.82,Math.min(900,Hh*0.4),260,41,95,'#e6a0b8',0.10,0.7,180);guilloche(g,W*0.15,Hh*0.75,220,29,80,'#b9a2e6',0.09,0.7,180);
    // leather header with the foil emblem and title
    const hd=g.createRadialGradient(W/2,180,40,W/2,300,900);hd.addColorStop(0,TH.c[0]);hd.addColorStop(.6,TH.c[1]);hd.addColorStop(1,TH.c[2]);g.fillStyle=hd;g.fillRect(0,0,W,Hd);
    g.save();g.globalCompositeOperation='soft-light';g.globalAlpha=0.45;g.drawImage(GRAIN[0],0,0,W,Hd);g.restore();
    const gold=goldText(g,60,520);g.save();g.translate(W/2,215);g.strokeStyle=g.fillStyle=gold;emblem(g,0.6,false);g.restore();
    g.textAlign='center';g.fillStyle=gold;g.font=`900 96px ${SERIF}`;spaced(g,'航迹护照',W/2,452,18);g.font='600 26px "Open Sans",sans-serif';spaced(g,'SKY PASSPORT',W/2,500,12);
    g.strokeStyle='rgba(227,189,132,.6)';g.lineWidth=2;rr(g,24,24,W-48,512,26);g.stroke();
    let y=Hd;
    // who and when
    g.fillStyle='#4b1019';const head=parts.name?`${P.disp} · ${yearsLabel(sc,' — ')}`:yearsLabel(sc,' — ');let hs=54;g.font=F(700,hs);while(g.measureText(head).width>960&&hs>28){hs-=2;g.font=F(700,hs);}g.fillText(head,W/2,y+90);
    g.font=F(400,26);g.fillStyle='#8e5a6a';g.fillText(sc.years.length>1?'我的飞行护照 · 一本护照，装下我的天空':'我的年度飞行报告',W/2,y+136);y+=Hn;
    if(parts.stats){const S6=[['航班',String(F0.n),'flights'],['里程',fmt(F0.km),'km'],['飞行时长',String(Math.round(F0.min/60)),'hours'],['国家地区',String(F0.cc),'countries'],['机场',String(F0.ap),'airports'],['航司',String(F0.al),'airlines']];
      S6.forEach(([l,v,u],i)=>{const cx=70+(i%3)*320,cy=y+10+Math.floor(i/3)*150;g.fillStyle='rgba(255,255,255,.75)';rr(g,cx,cy,300,130,18);g.fill();g.strokeStyle='rgba(142,29,56,.15)';g.lineWidth=2;g.stroke();
        g.textAlign='left';g.font=F(400,22);g.fillStyle='#9a2b46';g.fillText(l,cx+22,cy+40);let vs=56;g.font=F(700,vs);while(g.measureText(v).width>200&&vs>30){vs-=2;g.font=F(700,vs);}g.fillStyle='#1d1420';g.fillText(v,cx+22,cy+102);
        g.textAlign='right';g.font=F(400,18,'SM');g.fillStyle='#9a7f8a';g.fillText(u,cx+280,cy+40);g.textAlign='left';});y+=Hs;}
    if(parts.map){const tm=Math.max(sc.T_ZOOM+1.6,sc.T_CARD-0.7),fr=Math.min(sc.cam.length-1,Math.floor(tm*FPS)); // the whole route map, as after the zoom-out
      g.save();g.translate(0,y-MAP.y);drawMap(tm,sc.cam[fr]);g.restore();y+=Hm;}
    if(parts.flags){g.save();g.translate(0,y+40-192);drawFlags(sc.T_END);g.restore();y+=Hf;}
    if(B.length){y+=40;g.textAlign='left';g.font=F(700,34);g.fillStyle='#4b1019';g.fillText('飞行成就',70,y);y+=30;
      B.forEach((b,i)=>{const cx=70+(i%2)*480,cy=y+Math.floor(i/2)*150;g.fillStyle='rgba(255,255,255,.8)';rr(g,cx,cy,460,130,18);g.fill();g.strokeStyle='rgba(185,138,80,.45)';g.lineWidth=2;g.stroke();
        g.font=F(400,22);g.fillStyle='#9a2b46';g.fillText(`${b.i} ${b.k}`,cx+22,cy+38);let vs=34;g.font=F(700,vs);while(g.measureText(b.v).width>416&&vs>20){vs-=2;g.font=F(700,vs);}g.fillStyle='#1d1420';g.fillText(b.v,cx+22,cy+82);
        let ds=20;g.font=F(400,ds);while(g.measureText(b.d).width>416&&ds>13){ds--;g.font=F(400,ds);}g.fillStyle='#8a7480';g.fillText(b.d,cx+22,cy+114);});
      y+=rowsB*150;}
    if(showYears){y+=40;g.textAlign='left';g.font=F(700,34);g.fillStyle='#4b1019';g.fillText('每年的航班',70,y);y+=40;const mx=Math.max(...years.map(v=>v.n)),bw=Math.min(90,(W-160)/years.length-14);
      years.forEach((v,i)=>{const x=80+i*(bw+14),h=Math.max(6,160*v.n/mx);const gr=g.createLinearGradient(0,y+180-h,0,y+180);gr.addColorStop(0,'#c41e37');gr.addColorStop(1,'#e98aa8');g.fillStyle=gr;rr(g,x,y+180-h,bw,h,6);g.fill();
        g.textAlign='center';g.font=F(700,20,'SM');g.fillStyle='#4b1019';g.fillText(String(v.n),x+bw/2,y+170-h);g.font=F(400,18,'SM');g.fillStyle='#8a7480';g.fillText("'"+String(v.y).slice(2),x+bw/2,y+210);g.textAlign='left';});}
    // footer: QR + where to make one (or a slim band when the QR is off)
    const fy=Hh-Hq;g.fillStyle=hd;g.fillRect(0,fy,W,Hq);g.save();g.globalCompositeOperation='soft-light';g.globalAlpha=0.45;g.drawImage(GRAIN[0],0,fy,W,Hq);g.restore();g.textAlign='left';
    if(parts.qr){drawQrCard(g,W-238,fy+44,170,1,null);g.fillStyle=goldText(g,fy+60,fy+200);g.font=F(700,40);g.fillText('扫码生成你的飞行护照',70,fy+105);
      g.font=F(400,26,'SM');g.fillStyle='#e9d8cf';g.fillText(SITE_HOST,70,fy+152);g.font=F(400,20,'SM');g.fillStyle='rgba(233,216,207,.6)';
      if(parts.name)g.fillText(('P<'+P.nat3+P.latin.replace(/ /g,'<')+'<<FLIGHT<LOG').padEnd(40,'<').slice(0,40),70,fy+204);}
    else{g.textAlign='center';g.fillStyle=goldText(g,fy+30,fy+80);g.font=F(600,30);g.fillText('航迹护照 · SKY PASSPORT',W/2,fy+66);}
  }finally{ctx=keep;}
  return c;}

/* ---------- 9:16 cover image = the closing poster with the end card ---------- */
function renderCoverImage(){const sc=S;if(!sc||!sc.ok)return null;const c=document.createElement('canvas');c.width=W;c.height=H;
  renderFrame(Math.max(0,sc.frames-12));c.getContext('2d').drawImage(cv,0,0);drawAt(playT);return c;}

let lastImg=null,lastImgName='';
function showImage(c,name,isPoster){if(!c)return;lastIsPoster=!!isPoster;c.toBlob(b=>{lastImg=b;lastImgName=name;$('imgPrev').src=URL.createObjectURL(b);$('imgOut').hidden=false;},'image/png');}
async function saveImage(){if(!lastImg)return;const file=new File([lastImg],lastImgName,{type:'image/png'});
  if(matchMedia('(pointer:coarse)').matches&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:'航迹护照'});return;}catch(e){if(e&&e.name==='AbortError')return;}}
  saveFile(lastImgName,lastImg);}
const imgBase=()=>`航迹护照_${(S.P.latin||'flight').replace(/\s+/g,'_')}_${yearsLabel(S,'-','')}`;
$('btnLong').addEventListener('click',async()=>{if(!S||!S.ok)return;const b=$('btnLong');b.disabled=true;b.textContent='正在生成…';
  try{showImage(await renderLongPoster(),imgBase()+'_长图.png',true);}finally{b.disabled=false;b.textContent='生成长图海报';}});
$('btnCoverImg').addEventListener('click',async()=>{if(!S||!S.ok)return;await Promise.all([ensureFonts(),loadFlags(S.order)]);showImage(renderCoverImage(),imgBase()+'_封面.png');});
$('btnSaveImg').addEventListener('click',saveImage);
$('posterOpts').addEventListener('toggle',e=>{if(e.target.open)renderPosterChecks();});
