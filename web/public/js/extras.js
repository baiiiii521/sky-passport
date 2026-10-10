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
const placeName=c=>AP[c]?(EN()?AP[c].city:(apIndex().zh[c]||AP[c].city)):c;
const ctryName=iso=>NAMES[iso]?(EN()?NAMES[iso][0]:NAMES[iso][1]):iso;
/* continents by ISO country code */
const CONT=(()=>{const m={},T={AF:'DZ AO BJ BW BF BI CV CM CF TD KM CD CG CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW',
  AS:'AF AM AZ BH BD BT BN KH CN CY GE HK IN ID IR IQ IL JP JO KZ KW KG LA LB MO MY MV MN MM NP KP OM PK PS PH QA SA SG KR LK SY TW TJ TH TL TR TM AE UZ VN YE',
  EU:'AL AD AT BY BE BA BG HR CZ DK EE FO FI FR DE GI GR GG HU IS IE IM IT JE XK LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SJ SE CH UA GB VA AX',
  NA:'AI AG AW BS BB BZ BM BQ VG CA KY CR CU CW DM DO SV GL GD GP GT HT HN JM MQ MX MS NI PA PR BL KN LC MF PM VC SX TT TC US VI UM',
  SA:'AR BO BR CL CO EC FK GF GY PY PE SR UY VE',OC:'AS AU CK FJ PF GU KI MH FM NR NC NZ NU NF MP PW PG PN WS SB TK TO TV VU WF'};
  for(const k in T)for(const c of T[k].split(' '))m[c]=k;return m;})();
const CONT_N={AS:['亚洲','Asia'],EU:['欧洲','Europe'],NA:['北美洲','North America'],SA:['南美洲','South America'],AF:['非洲','Africa'],OC:['大洋洲','Oceania']};
/* airline names for the most common IATA prefixes; anything else shows its code (or the sheet's airline column) */
const AIRLINES=(()=>{const m={};for(const r of `MU 东方航空 China Eastern|CA 中国国航 Air China|CZ 南方航空 China Southern|HU 海南航空 Hainan Airlines|FM 上海航空 Shanghai Airlines|HO 吉祥航空 Juneyao Air|3U 四川航空 Sichuan Airlines|ZH 深圳航空 Shenzhen Airlines|MF 厦门航空 Xiamen Air|SC 山东航空 Shandong Airlines|9C 春秋航空 Spring Airlines|KN 中国联航 China United|GS 天津航空 Tianjin Airlines|8L 祥鹏航空 Lucky Air|JD 首都航空 Capital Airlines|PN 西部航空 West Air|EU 成都航空 Chengdu Airlines|G5 华夏航空 China Express|TV 西藏航空 Tibet Airlines|BK 奥凯航空 Okay Airways|CX 国泰航空 Cathay Pacific|HX 香港航空 Hong Kong Airlines|UO 香港快运 HK Express|NX 澳门航空 Air Macau|CI 中华航空 China Airlines|BR 长荣航空 EVA Air|JX 星宇航空 Starlux|IT 台湾虎航 Tigerair Taiwan|JL 日本航空 Japan Airlines|NH 全日空 ANA|MM 乐桃航空 Peach|GK 捷星日本 Jetstar Japan|KE 大韩航空 Korean Air|OZ 韩亚航空 Asiana|7C 济州航空 Jeju Air|LJ 真航空 Jin Air|BX 釜山航空 Air Busan|SQ 新加坡航空 Singapore Airlines|TR 酷航 Scoot|TG 泰国国际航空 Thai Airways|FD 泰国亚航 Thai AirAsia|AK 亚洲航空 AirAsia|D7 全亚洲航空 AirAsia X|MH 马来西亚航空 Malaysia Airlines|GA 印尼鹰航 Garuda Indonesia|VN 越南航空 Vietnam Airlines|VJ 越捷航空 VietJet|PR 菲律宾航空 Philippine Airlines|EK 阿联酋航空 Emirates|QR 卡塔尔航空 Qatar Airways|EY 阿提哈德航空 Etihad|TK 土耳其航空 Turkish Airlines|SV 沙特航空 Saudia|LH 汉莎航空 Lufthansa|AF 法国航空 Air France|KL 荷兰皇家航空 KLM|BA 英国航空 British Airways|VS 维珍航空 Virgin Atlantic|LX 瑞士航空 SWISS|OS 奥地利航空 Austrian|AY 芬兰航空 Finnair|SK 北欧航空 SAS|IB 西班牙国家航空 Iberia|AZ 意大利航空 ITA Airways|EI 爱尔兰航空 Aer Lingus|SU 俄罗斯航空 Aeroflot|FR 瑞安航空 Ryanair|U2 易捷航空 easyJet|AA 美国航空 American Airlines|UA 美国联合航空 United|DL 达美航空 Delta|WN 西南航空 Southwest|B6 捷蓝航空 JetBlue|AS 阿拉斯加航空 Alaska Airlines|AC 加拿大航空 Air Canada|AM 墨西哥航空 Aeroméxico|LA 南美航空 LATAM|QF 澳洲航空 Qantas|JQ 捷星航空 Jetstar|VA 维珍澳洲 Virgin Australia|NZ 新西兰航空 Air New Zealand|ET 埃塞俄比亚航空 Ethiopian|MS 埃及航空 EgyptAir|AI 印度航空 Air India|6E 靛蓝航空 IndiGo|UL 斯里兰卡航空 SriLankan|KC 阿斯塔纳航空 Air Astana|OM 蒙古航空 MIAT|HY 乌兹别克斯坦航空 Uzbekistan Airways`.split('|')){const [c,zh,...en]=r.split(' ');m[c]=[zh,en.join(' ')];}return m;})();
const TIERS=[[0,'青铜','Bronze','初次登机','First boarding'],[10000,'白银','Silver','云层常客','Cloud regular'],[50000,'黄金','Gold','航线收藏家','Route collector'],[150000,'白金','Platinum','环球旅人','Globetrotter'],[400000,'钻石','Diamond','天空居民','Sky resident']];
const BADGE_CATS=[['all','全部','All'],['dist','里程','Distance'],['place','足迹','Places'],['time','时光','Time'],['air','航线','Airlines']];
/* picked for the long poster until the user changes the selection */
const BADGE_DEFAULT=['tier','dist','longest','first','stamps','continents','base','route','busy','air'];
/* every achievement, unlocked ones first in each group; locked ones say how to get them and may carry progress (prog 0–1).
   id: stable key (the poster selection is remembered by it); cat: group; rar: base / silver / gold / legend (card finish) */
function allBadges(sc){
  if(!sc||!sc.ok)return [];const flown=sc.flights.filter(f=>!f.vd&&!f.up),LF=flown.length?flown:sc.flights.filter(f=>!f.vd);if(!LF.length)return [];
  const out=[],home=sc.P.nat,n=LF.length,cnt=(arr,key)=>{const m=new Map();for(const x of arr){const k=key(x);if(k==null)continue;m.set(k,(m.get(k)||0)+1);}return [...m.entries()].sort((a,b)=>b[1]-a[1]);};
  const add=(id,cat,rar,i,k,v,d,x)=>out.push(Object.assign({id,cat,rar,i,k,v,d},x||{}));
  const lock=(id,cat,rar,i,k,d,prog)=>out.push({id,cat,rar,i,k,v:L('未解锁','Locked'),d,lock:true,prog});
  const rt=f=>`${placeName(f.f)} → ${placeName(f.to)}`,pct=(a,b)=>Math.round(a/b*100),A2=f=>AP[f.f]&&AP[f.to];
  const km=LF.reduce((a,f)=>a+f.km,0),min=LF.reduce((a,f)=>a+f.min,0),byDate=[...LF].sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:(a.t<b.t?-1:1));
  /* distance */
  let ti=0;TIERS.forEach((t,j)=>{if(km>=t[0])ti=j;});const T=TIERS[ti],NX=TIERS[ti+1];
  add('tier','dist',['base','silver','gold','legend','legend'][ti],'🏅',L('飞行等级','Flyer level'),L(`${T[1]} · ${T[3]}`,`${T[2]} · ${T[4]}`),NX?L(`距「${NX[1]}」还差 ${fmt(NX[0]-km)} km`,`${fmt(NX[0]-km)} km to ${NX[2]}`):L('已是最高等级','top level reached'),{prog:NX?(km-T[0])/(NX[0]-T[0]):1});
  add('dist','dist',km>=40075?'gold':'silver','🌍',L('飞行距离','Distance flown'),L(`绕地球 ${(km/40075).toFixed(2)} 圈`,`${(km/40075).toFixed(2)}× around the Earth`),L(`共 ${fmt(km)} km · 地月距离的 ${pct(km,384400)}%`,`${fmt(km)} km · ${pct(km,384400)}% of the way to the Moon`));
  const lng=LF.reduce((a,b)=>b.km>a.km?b:a);add('longest','dist','silver','📏',L('最长单程','Longest flight'),`${fmt(lng.km)} km`,`${rt(lng)} · ${lng.fn}`);
  if(n>1){const sh=LF.reduce((a,b)=>b.km<a.km?b:a);add('shortest','dist','base','🪶',L('最短的一程','Shortest hop'),`${fmt(sh.km)} km`,`${rt(sh)} · ${sh.fn}`);}
  add('air','dist','base','⏱️',L('在空中的时间','Time in the air'),L(`${(min/1440).toFixed(1)} 天`,`${(min/1440).toFixed(1)} days`),L(`${fmt(min/60)} 小时 · 平均每段 ${(min/60/n).toFixed(1)} 小时`,`${fmt(min/60)} hours · ${(min/60/n).toFixed(1)} h per flight`));
  add('walk','dist','base','🚶',L('换成走路','On foot instead'),L(`要走 ${fmt(km/5/24)} 天`,`${fmt(km/5/24)} days of walking`),L('不吃不睡，每小时 5 公里','non-stop, at 5 km/h'));
  const kg=km*0.09;add('co2','dist','base','🌱',L('碳排放（估算）','CO₂ (estimate)'),kg>=1000?L(`${(kg/1000).toFixed(1)} 吨 CO₂`,`${(kg/1000).toFixed(1)} t CO₂`):`${Math.round(kg)} kg CO₂`,L(`约 ${Math.max(1,Math.round(kg/20))} 棵树一年的吸收量`,`what ${Math.max(1,Math.round(kg/20))} trees absorb in a year`));
  if(km>=384400)add('moon','dist','legend','🌕',L('登月里程','Moonshot'),L(`${(km/384400).toFixed(2)} 个地月距离`,`${(km/384400).toFixed(2)}× Earth to Moon`),L('飞过的路已经超过地球到月球','you have flown farther than the Moon'));
  else lock('moon','dist','legend','🌕',L('登月里程','Moonshot'),L(`累计飞满 384,400 km 解锁 · 已完成 ${pct(km,384400)}%`,`fly 384,400 km in total · ${pct(km,384400)}% done`),km/384400);
  /* places */
  const first=byDate.find(f=>f.fc!==home||f.tc!==home);
  if(first)add('first','place','gold','🛂',L('首次出境','First flight abroad'),rt(first),first.date);else lock('first','place','gold','🛂',L('首次出境','First flight abroad'),L('第一次飞出国境时解锁','unlocks with your first flight abroad'));
  const cs=[...new Set(byDate.flatMap(f=>[f.fc,f.tc]))].filter(Boolean);
  add('stamps','place',cs.length>=10?'gold':cs.length>=4?'silver':'base','🗺️',L('护照集章','Passport stamps'),L(`${cs.length} 个国家和地区`,`${cs.length} countries & regions`),cs.slice(0,4).map(ctryName).join(' · ')+(cs.length>4?' …':''));
  const ct=[...new Set(cs.map(c=>CONT[c]).filter(Boolean))];
  if(ct.length>=2)add('continents','place',ct.length>=6?'legend':ct.length>=4?'gold':'silver','🧭',L('踏足大洲','Continents'),L(`${ct.length} 大洲`,`${ct.length} continents`),ct.map(c=>L(...CONT_N[c])).join(' · '),{prog:ct.length/6});
  else lock('continents','place','silver','🧭',L('踏足大洲','Continents'),L('飞到第二个大洲解锁','unlocks on a second continent'),ct.length/6);
  const aps=cnt(LF.flatMap(f=>[f.f,f.to]),x=>x),base=aps[0][0];
  add('base','place','silver','🛫',L('大本营','Home base'),`${placeName(base)} ${base}`,L(`${aps[0][1]} 次起降`,`${aps[0][1]} take-offs and landings`));
  add('airports','place',aps.length>=30?'gold':aps.length>=10?'silver':'base','🛬',L('机场收藏','Airports collected'),L(`${aps.length} 座机场`,`${aps.length} airports`),aps.slice(0,6).map(a=>a[0]).join(' · ')+(aps.length>6?' …':''));
  const cm=new Map();for(const [c] of aps){const k=AP[c]?AP[c].city:c;if(!cm.has(k))cm.set(k,placeName(c));}const cities=[...cm.values()]; /* one per city: Pudong and Hongqiao are both Shanghai */add('cities','place','base','🏙️',L('城市足迹','Cities'),L(`${cities.length} 座城市`,`${cities.length} cities`),cities.slice(0,4).join(' · ')+(cities.length>4?' …':''));
  let far=null,fk=0;for(const [c] of aps){if(!AP[c]||!AP[base])continue;const d=hav(AP[base],AP[c]);if(d>fk){fk=d;far=c;}}
  if(far)add('far','place','silver','🔭',L('飞得最远的地方','Farthest place'),placeName(far),L(`离${placeName(base)} ${fmt(fk)} km`,`${fmt(fk)} km from ${placeName(base)}`));
  const pts=aps.map(a=>a[0]).filter(c=>AP[c]),latT=v=>L(`${v>=0?'北':'南'}纬 ${Math.abs(v).toFixed(1)}°`,`${Math.abs(v).toFixed(1)}° ${v>=0?'N':'S'}`);
  if(pts.length>1){const no=pts.reduce((a,b)=>AP[b].lat>AP[a].lat?b:a),so=pts.reduce((a,b)=>AP[b].lat<AP[a].lat?b:a);
    add('north','place','base','❄️',L('最北到过','Northernmost'),placeName(no),latT(AP[no].lat));add('south','place','base','🌴',L('最南到过','Southernmost'),placeName(so),latT(AP[so].lat));}
  const eq=LF.find(f=>A2(f)&&AP[f.f].lat*AP[f.to].lat<0);
  if(eq)add('equator','place','gold','🌐',L('跨越赤道','Across the equator'),rt(eq),L('南北半球都留下了航迹','your trails cover both hemispheres'));else lock('equator','place','gold','🌐',L('跨越赤道','Across the equator'),L('飞一次跨赤道的航班解锁','cross the equator to unlock'));
  let pol=null,pl=0;for(const f of LF){if(f.km<4000||!A2(f))continue;const ip=d3.geoInterpolate([AP[f.f].lon,AP[f.f].lat],[AP[f.to].lon,AP[f.to].lat]);for(let i=1;i<24;i++){const y=ip(i/24)[1];if(Math.abs(y)>Math.abs(pl)){pl=y;pol=f;}}}
  if(pol&&Math.abs(pl)>=66.56)add('polar','place','legend','🧊',L('飞越极圈','Polar route'),rt(pol),L(`航线最高到${latT(pl)}`,`the route peaks at ${latT(pl)}`));else lock('polar','place','legend','🧊',L('飞越极圈','Polar route'),L('飞一条越过北极圈的航线解锁（如北京—纽约）','fly over the Arctic Circle (e.g. Beijing–New York)'));
  const dl=LF.find(f=>A2(f)&&Math.abs(AP[f.f].lon-AP[f.to].lon)>180);
  if(dl)add('dateline','place','gold','📆',L('跨越日期变更线','Across the date line'),rt(dl),L('飞过国际日期变更线，日历跳了一天','over the 180th meridian, the calendar jumped a day'));else lock('dateline','place','gold','📆',L('跨越日期变更线','Across the date line'),L('飞一次跨太平洋的航班解锁','cross the Pacific to unlock'));
  /* time */
  const ys=cnt(LF,f=>f.y);if(ys.length>1){const tie=ys.filter(y=>y[1]===ys[0][1]).map(y=>y[0]).sort();add('busy','time','silver','📅',L('最忙的一年','Busiest year'),tie.length>1?L(`${tie[0]}–${tie[tie.length-1]} 年`,`${tie[0]}–${tie[tie.length-1]}`):L(`${ys[0][0]} 年`,String(ys[0][0])),tie.length>1?L(`${tie.length} 年并列，每年 ${ys[0][1]} 段`,`${tie.length} years tied, ${ys[0][1]} flights each`):L(`${ys[0][1]} 段航班`,`${ys[0][1]} flights`));}
  const mo=cnt(LF,f=>f.date.slice(0,7))[0];if(mo&&mo[1]>1){const [yy,mm]=mo[0].split('-');add('month','time','base','🗓️',L('最忙的一个月','Busiest month'),L(`${yy} 年 ${+mm} 月`,new Date(Date.UTC(+yy,+mm-1,15)).toLocaleString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'})),L(`${mo[1]} 段航班`,`${mo[1]} flights`));}
  const dd=cnt(LF,f=>f.date)[0];
  if(dd&&dd[1]>1){const day=byDate.filter(f=>f.date===dd[0]);add('multi','time','silver','⚡',L('一天飞了几段','Most flights in a day'),L(`${dd[1]} 段`,`${dd[1]} flights`),`${dd[0]} · ${[day[0].f,...day.map(f=>f.to)].join(' → ')}`);}
  else lock('multi','time','silver','⚡',L('一天飞了几段','Most flights in a day'),L('一天内飞两段（含转机）解锁','fly twice in one day (connections count)'));
  if(n>1){let g=0,ga=null,gb=null;for(let i=1;i<byDate.length;i++){const a=Date.parse(byDate[i-1].date),b=Date.parse(byDate[i].date),d=Math.round((b-a)/864e5);if(d>g){g=d;ga=byDate[i-1].date;gb=byDate[i].date;}}
    if(g>=30)add('gap','time','base','🏝️',L('最长的地面时光','Longest time on the ground'),L(`${fmt(g)} 天`,`${fmt(g)} days`),`${ga} → ${gb}`);}
  const f0=byDate[0],f1=byDate[byDate.length-1],span=f1.y-f0.y+1;add('since','time',span>=10?'gold':span>=5?'silver':'base','⌛',L('飞行年轮','Years in the sky'),L(`${span} 年`,span>1?`${span} years`:'1 year'),L(`最早一段 ${f0.date} · ${rt(f0)}`,`first on record ${f0.date} · ${rt(f0)}`));
  if(LF.some(f=>f.hasT)){const hr=f=>f.hasT?+f.t.slice(0,2):-1,red=LF.filter(f=>hr(f)>=22||(hr(f)>=0&&hr(f)<5)).length,early=LF.filter(f=>hr(f)>=5&&hr(f)<8).length;
    if(red)add('red','time','silver','🌙',L('红眼航班','Red-eyes'),L(`${red} 次`,String(red)),L('22:00–05:00 起飞','departing 22:00–05:00'));else lock('red','time','silver','🌙',L('红眼航班','Red-eyes'),L('坐一次深夜起飞的航班解锁','take a late-night flight to unlock'));
    if(early)add('early','time','silver','🌅',L('早起的鸟','Early bird'),L(`${early} 次`,String(early)),L('05:00–08:00 起飞','departing 05:00–08:00'));else lock('early','time','silver','🌅',L('早起的鸟','Early bird'),L('坐一次清晨 5–8 点起飞的航班解锁','take a 5–8 am flight to unlock'));}
  const wd=cnt(LF,f=>new Date(f.date+'T12:00:00Z').getUTCDay())[0],WD=[['周日','Sunday'],['周一','Monday'],['周二','Tuesday'],['周三','Wednesday'],['周四','Thursday'],['周五','Friday'],['周六','Saturday']];
  if(n>2)add('weekday','time','base','🔖',L('最爱星期几出发','Favourite day to fly'),L(...WD[wd[0]]),L(`${wd[1]} 段 · 占 ${pct(wd[1],n)}%`,`${wd[1]} flights · ${pct(wd[1],n)}%`));
  const SEA=[['春天','Spring','🌸'],['夏天','Summer','☀️'],['秋天','Autumn','🍂'],['冬天','Winter','⛄']],se=cnt(LF,f=>Math.floor((+f.date.slice(5,7)%12)/3))[0];
  if(n>2){const s=SEA[(se[0]+3)%4];add('season','time','base',s[2],L('最爱的季节','Favourite season'),L(s[0],s[1]),L(`${se[1]} 段 · 占 ${pct(se[1],n)}%`,`${se[1]} flights · ${pct(se[1],n)}%`));}
  const ny=byDate.find(f=>/-(12-31|01-01)$/.test(f.date));
  if(ny)add('newyear','time','legend','🎆',L('云上跨年','New Year in the air'),rt(ny),ny.date);else lock('newyear','time','legend','🎆',L('云上跨年','New Year in the air'),L('在 12 月 31 日或 1 月 1 日飞一次解锁','fly on 31 Dec or 1 Jan to unlock'));
  if(n>=100)add('century','time','gold','💯',L('百次起飞','100 take-offs'),L(`${n} 次`,String(n)),L('名副其实的空中常客','a true frequent flyer'));else lock('century','time','gold','💯',L('百次起飞','100 take-offs'),L(`再飞 ${100-n} 次解锁`,`${100-n} more flights to unlock`),n/100);
  /* airlines and routes */
  const route=cnt(LF,f=>[f.f,f.to].sort().join('-'))[0];if(route&&route[1]>1){const [a,b]=route[0].split('-');add('route','air','silver','🔁',L('最常飞航线','Most-flown route'),`${placeName(a)} ⇄ ${placeName(b)}`,L(`${route[1]} 次`,`${route[1]} times`));}
  const alName=f=>{const m=/^([A-Z0-9]{2})\d/.exec(f.fn);const c=m&&!/^\d\d$/.test(m[1])?m[1]:null;return c||(f.al?String(f.al).trim():null);},ac=cnt(LF,alName),aN=c=>AIRLINES[c]?L(...AIRLINES[c]):c;
  if(ac.length)add('airlines','air',ac.length>=10?'gold':ac.length>=4?'silver':'base','✈️',L('坐过的航司','Airlines flown'),L(`${ac.length} 家`,`${ac.length} airline${ac.length>1?'s':''}`),L(`最常坐：${aN(ac[0][0])} · ${ac[0][1]} 次`,`most often: ${aN(ac[0][0])} · ${ac[0][1]}×`));
  const fno=cnt(LF.filter(f=>f.fn&&f.fn!=='—'),f=>f.fn)[0];if(fno&&fno[1]>1){const f=LF.find(x=>x.fn===fno[0]);add('fno','air','base','🎫',L('最常坐的航班号','Favourite flight number'),fno[0],L(`坐了 ${fno[1]} 次 · ${rt(f)}`,`${fno[1]}× · ${rt(f)}`));}
  const ni=LF.filter(f=>f.fc!==home||f.tc!==home).length;if(ni&&ni<n)add('intl','air','base','🧳',L('国际 / 国内','International vs domestic'),L(`国际 ${pct(ni,n)}%`,`${pct(ni,n)}% international`),L(`国际 ${ni} 段 · 国内 ${n-ni} 段`,`${ni} international · ${n-ni} domestic`));
  let tzm=0,tzf=null;for(const f of LF){if(!A2(f))continue;const t=Date.parse(f.date+'T12:00:00Z');if(!(t>0))continue;try{const d=Math.abs(tzOffsetMin(AP[f.f].tz,t)-tzOffsetMin(AP[f.to].tz,t))/60;if(d>tzm){tzm=d;tzf=f;}}catch(e){}}
  if(tzf&&tzm>=1)add('tz','air',tzm>=8?'gold':'silver','🕰️',L('最大时差','Biggest time shift'),L(`${+tzm.toFixed(1)} 小时`,`${+tzm.toFixed(1)} hours`),rt(tzf));
  return out;}
const computeBadges=sc=>allBadges(sc).filter(b=>!b.lock);
/* achievements gallery: medals you tap to pick what the long poster shows */
let ACH_CAT='all';
function renderBadges(){const box=$('badges');if(!box)return;box.innerHTML='';const all=allBadges(S),o=posterOpts(),got=all.filter(b=>!b.lock);
  const cats=$('achCats');if(cats){cats.innerHTML='';for(const [c,zh,en] of BADGE_CATS){const k=all.filter(b=>c==='all'||b.cat===c),g=k.filter(b=>!b.lock).length;
    cats.append(el('button',{type:'button','aria-pressed':String(ACH_CAT===c),on:{click:()=>{ACH_CAT=c;renderBadges();}}},L(zh,en),el('small',{},` ${g}/${k.length}`)));}}
  achSummary(all,o);
  if(!all.length){box.append(el('div',{cls:'medal locked'},el('span',{cls:'mt'},el('span',{cls:'mk'},L('还没有已完成的航班','No completed flights yet')))));return;}
  const list=all.filter(b=>ACH_CAT==='all'||b.cat===ACH_CAT).sort((a,b)=>(a.lock?1:0)-(b.lock?1:0));
  const RAR={legend:L('传奇','LEGEND'),gold:L('金','GOLD'),silver:L('银','SILVER'),base:''};
  list.forEach((b,i)=>{const on=!b.lock&&badgeOn(o,b);
    const m=el('button',{type:'button',cls:`medal r-${b.rar}${b.lock?' locked':''}`,'aria-pressed':String(on)},
      el('span',{cls:'emb','aria-hidden':'true'},el('span',{cls:'ico'},b.lock?'🔒':b.i)),
      el('span',{cls:'mt'},el('span',{cls:'mk'},b.lock?`${b.i} ${b.k}`:b.k),el('span',{cls:'mv'},b.v),el('span',{cls:'md'},b.d)),
      b.prog!=null&&b.prog<1?el('span',{cls:'mp','aria-hidden':'true'},el('i',{})):null,
      RAR[b.rar]&&!b.lock?el('span',{cls:'rar'},RAR[b.rar]):null,el('span',{cls:'tick','aria-hidden':'true'},'✓'));
    m.style.setProperty('--i',i);if(b.prog!=null)m.style.setProperty('--p',Math.max(0.02,Math.min(1,b.prog)));
    if(b.lock){m.setAttribute('aria-disabled','true');m.title=L('未解锁','Locked');}else m.title=L('点一下：加入 / 移出长图','Tap to add to / remove from the long poster');
    m.addEventListener('click',()=>{if(b.lock)return;const q=posterOpts();if(!q.sel)q.sel=new Set(got.filter(x=>badgeOn(q,x)).map(x=>x.id));
      if(q.sel.has(b.id))q.sel.delete(b.id);else q.sel.add(b.id);savePosterOpts(q);m.setAttribute('aria-pressed',String(q.sel.has(b.id)));achSummary(all,q);refreshPoster();});
    box.append(m);});
  }
function achSummary(all,o){const s=$('achSum');if(!s)return;const got=all.filter(b=>!b.lock),sel=got.filter(b=>badgeOn(o,b));
  s.textContent=L(`已解锁 ${got.length} / ${all.length} · 已选 ${sel.length} 项印在长图上`,`${got.length} / ${all.length} unlocked · ${sel.length} picked for the long poster`);
  const bar=$('achBar');if(bar)bar.style.width=(all.length?got.length/all.length*100:0).toFixed(1)+'%';}
function achPick(mode){const o=posterOpts(),got=computeBadges(S);o.sel=mode==='all'?new Set(got.map(b=>b.id)):mode==='none'?new Set():null;
  if(mode==='rec'){try{const v=JSON.parse(localStorage.getItem(POSTER_KEY)||'{}');delete v.badgesOn;delete v.badgesOff;localStorage.setItem(POSTER_KEY,JSON.stringify(v));}catch(e){}}else savePosterOpts(o);
  renderBadges();refreshPoster();}

/* ---------- long poster (1080 wide PNG for 朋友圈 / 小红书) ---------- */
// which blocks the long poster shows (remembered per browser); badges can be picked one by one
const POSTER_PARTS=[['name','名字','Name'],['stats','统计数字','Numbers'],['map','航线地图','Route map'],['flags','国旗 / 地区','Flags'],['badges','飞行成就','Achievements'],['years','每年航班','Flights per year'],['qr','二维码','QR code']];
const POSTER_KEY='skypassport.poster';
function posterOpts(){let o={};try{o=JSON.parse(localStorage.getItem(POSTER_KEY)||'{}');}catch(e){}const parts={};for(const [k] of POSTER_PARTS)parts[k]=o[k]!==false;
  /* sel = the achievements the user picked (ids); null = not chosen yet, use BADGE_DEFAULT. Saves before v3.1 listed hidden badges instead. */
  let sel=Array.isArray(o.badgesOn)?new Set(o.badgesOn):null;if(!sel&&Array.isArray(o.badgesOff)&&o.badgesOff.length)sel=new Set(BADGE_DEFAULT.filter(id=>!o.badgesOff.includes(id)));
  return {parts,sel};}
const badgeOn=(o,b)=>o.sel?o.sel.has(b.id):BADGE_DEFAULT.includes(b.id);
function savePosterOpts(o){const v={};for(const k in o.parts)v[k]=o.parts[k];if(o.sel)v.badgesOn=[...o.sel];try{localStorage.setItem(POSTER_KEY,JSON.stringify(v));}catch(e){}}
function renderPosterChecks(){const box=$('posterChecks');if(!box)return;box.innerHTML='';const o=posterOpts();
  const chk=(label,on,fn)=>{const c=el('input',{type:'checkbox',checked:on});c.addEventListener('change',()=>{fn(c.checked);savePosterOpts(o);renderPosterChecks();refreshPoster();});return el('label',{cls:'check'},c,' '+label);};
  box.append(el('div',{cls:'chkrow'},...POSTER_PARTS.map(([k,zh,en])=>chk(L(zh,en),o.parts[k],v=>{o.parts[k]=v;}))));
  if(o.parts.badges)box.append(el('div',{cls:'chkhead'},L('具体印哪些成就，在下方「飞行成就」里点选。','Pick which achievements to print in “Flight achievements” below.')));}
let lastIsPoster=false;
function refreshPoster(){if(lastIsPoster&&!$('imgOut').hidden)$('btnLong').click();}
async function renderLongPosterClassic(){
  const sc=S;if(!sc||!sc.ok)return null;await Promise.all([ensureFonts(),loadFlags(sc.order)]);
  const PO=posterOpts(),{parts}=PO,B=parts.badges?computeBadges(sc).filter(b=>badgeOn(PO,b)):[],P=sc.P,F0=sc.final,TH=theme(),years=sc.years.filter(y=>y.n>0);
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
    g.textAlign='center';g.fillStyle=gold;if(EN()){g.font=`900 84px ${SERIF}`;spaced(g,'SKY PASSPORT',W/2,452,6);g.font=F(600,26);spaced(g,'航迹护照',W/2,500,12);}else{g.font=`900 96px ${SERIF}`;spaced(g,'航迹护照',W/2,452,18);g.font='600 26px "Open Sans",sans-serif';spaced(g,'SKY PASSPORT',W/2,500,12);}
    g.strokeStyle='rgba(227,189,132,.6)';g.lineWidth=2;rr(g,24,24,W-48,512,26);g.stroke();
    let y=Hd;
    // who and when
    g.fillStyle='#4b1019';const head=parts.name?`${P.disp} · ${yearsLabel(sc,' — ')}`:yearsLabel(sc,' — ');let hs=54;g.font=F(700,hs);while(g.measureText(head).width>960&&hs>28){hs-=2;g.font=F(700,hs);}g.fillText(head,W/2,y+90);
    g.font=F(400,26);g.fillStyle='#8e5a6a';g.fillText(sc.years.length>1?L('我的飞行护照 · 一本护照，装下我的天空','My flight passport · every flight, one passport'):L('我的年度飞行报告','My year in flights'),W/2,y+136);y+=Hn;
    if(parts.stats){const S6=EN()?[['Flights',String(F0.n),''],['Distance',fmt(F0.km),'km'],['In the air',String(Math.round(F0.min/60)),'hours'],['Countries',String(F0.cc),'& regions'],['Airports',String(F0.ap),''],['Airlines',String(F0.al),'']]
        :[['航班',String(F0.n),'flights'],['里程',fmt(F0.km),'km'],['飞行时长',String(Math.round(F0.min/60)),'hours'],['国家地区',String(F0.cc),'countries'],['机场',String(F0.ap),'airports'],['航司',String(F0.al),'airlines']];
      S6.forEach(([l,v,u],i)=>{const cx=70+(i%3)*320,cy=y+10+Math.floor(i/3)*150;g.fillStyle='rgba(255,255,255,.75)';rr(g,cx,cy,300,130,18);g.fill();g.strokeStyle='rgba(142,29,56,.15)';g.lineWidth=2;g.stroke();
        g.textAlign='left';g.font=F(400,22);g.fillStyle='#9a2b46';g.fillText(l,cx+22,cy+40);let vs=56;g.font=F(700,vs);while(g.measureText(v).width>200&&vs>30){vs-=2;g.font=F(700,vs);}g.fillStyle='#1d1420';g.fillText(v,cx+22,cy+102);
        g.textAlign='right';g.font=F(400,18,'SM');g.fillStyle='#9a7f8a';g.fillText(u,cx+280,cy+40);g.textAlign='left';});y+=Hs;}
    if(parts.map){const tm=Math.max(sc.T_ZOOM+1.6,sc.T_CARD-0.7),fr=Math.min(sc.cam.length-1,Math.floor(tm*FPS)); // the whole route map, as after the zoom-out
      g.save();g.translate(0,y-MAP.y);drawMap(tm,sc.cam[fr]);g.restore();y+=Hm;}
    if(parts.flags){g.save();g.translate(0,y+40-192);drawFlags(sc.T_END);g.restore();y+=Hf;}
    if(B.length){y+=40;g.textAlign='left';g.font=F(700,34);g.fillStyle='#4b1019';g.fillText(L('飞行成就','Achievements'),70,y);y+=30;
      B.forEach((b,i)=>{const cx=70+(i%2)*480,cy=y+Math.floor(i/2)*150;g.fillStyle='rgba(255,255,255,.8)';rr(g,cx,cy,460,130,18);g.fill();g.strokeStyle='rgba(185,138,80,.45)';g.lineWidth=2;g.stroke();
        g.font=F(400,22);g.fillStyle='#9a2b46';g.fillText(`${b.i} ${b.k}`,cx+22,cy+38);let vs=34;g.font=F(700,vs);while(g.measureText(b.v).width>416&&vs>20){vs-=2;g.font=F(700,vs);}g.fillStyle='#1d1420';g.fillText(b.v,cx+22,cy+82);
        let ds=20;g.font=F(400,ds);while(g.measureText(b.d).width>416&&ds>13){ds--;g.font=F(400,ds);}g.fillStyle='#8a7480';g.fillText(b.d,cx+22,cy+114);});
      y+=rowsB*150;}
    if(showYears){y+=40;g.textAlign='left';g.font=F(700,34);g.fillStyle='#4b1019';g.fillText(L('每年的航班','Flights per year'),70,y);y+=40;const mx=Math.max(...years.map(v=>v.n)),bw=Math.min(90,(W-160)/years.length-14);
      years.forEach((v,i)=>{const x=80+i*(bw+14),h=Math.max(6,160*v.n/mx);const gr=g.createLinearGradient(0,y+180-h,0,y+180);gr.addColorStop(0,'#c41e37');gr.addColorStop(1,'#e98aa8');g.fillStyle=gr;rr(g,x,y+180-h,bw,h,6);g.fill();
        g.textAlign='center';g.font=F(700,20,'SM');g.fillStyle='#4b1019';g.fillText(String(v.n),x+bw/2,y+170-h);g.font=F(400,18,'SM');g.fillStyle='#8a7480';g.fillText("'"+String(v.y).slice(2),x+bw/2,y+210);g.textAlign='left';});}
    // footer: QR + where to make one (or a slim band when the QR is off)
    const fy=Hh-Hq;g.fillStyle=hd;g.fillRect(0,fy,W,Hq);g.save();g.globalCompositeOperation='soft-light';g.globalAlpha=0.45;g.drawImage(GRAIN[0],0,fy,W,Hq);g.restore();g.textAlign='left';
    if(parts.qr){drawQrCard(g,W-238,fy+44,170,1,null);g.fillStyle=goldText(g,fy+60,fy+200);g.font=F(700,40);g.fillText(L('扫码生成你的飞行护照','Scan to make your own'),70,fy+105);
      g.font=F(400,26,'SM');g.fillStyle='#e9d8cf';g.fillText(SITE_HOST,70,fy+152);g.font=F(400,20,'SM');g.fillStyle='rgba(233,216,207,.6)';
      if(parts.name)g.fillText(('P<'+P.nat3+P.latin.replace(/ /g,'<')+'<<FLIGHT<LOG').padEnd(40,'<').slice(0,40),70,fy+204);}
    else{g.textAlign='center';g.fillStyle=goldText(g,fy+30,fy+80);g.font=F(600,30);g.fillText('航迹护照 · SKY PASSPORT',W/2,fy+66);}
  }finally{ctx=keep;}
  return c;}

/* ---------- long poster 「夜航」 (v3.1 default): the site's flight-deck look — globe cover, boarding pass, split-flap numbers,
   a dark route map (same China rules as the film: standard outline, others clipped out of it, nine-dash line), stamps, medals, timeline ---------- */
const NP={ac:'#5eeaff',ac2:'#ff4f9a',ac3:'#a78bfa',gold:'#e9c58e',ink:'#eaf4ff',mut:'#8fa6c2',line:'rgba(94,234,255,.18)'};
const EMOJI=s=>`${s}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
async function loadGlyphs(str){if(!document.fonts||!str)return;const t=[...new Set(str)].join('');try{await Promise.all([400,700,800].map(w=>document.fonts.load(`${w} 40px "Noto Sans SC"`,t)));}catch(e){}}
function trkW(g,txt,sp){let w=0;for(const ch of txt)w+=g.measureText(ch).width+sp;return w-sp;}
function trk(g,txt,x,y,sp,align){const w=trkW(g,txt,sp),a=g.textAlign;let cx=align==='right'?x-w:align==='center'?x-w/2:x;g.textAlign='left';for(const ch of txt){g.fillText(ch,cx,y);cx+=g.measureText(ch).width+sp;}g.textAlign=a;return w;}
function fitFont(g,txt,w,size,min,mk){let s=size;g.font=mk(s);while(g.measureText(txt).width>w&&s>min){s-=1;g.font=mk(s);}return s;}
function npHead(g,y,code,title,right){g.textAlign='left';g.font=F(700,19,'SM');g.fillStyle=NP.ac;const cw=trk(g,code,60,y,3);
  if(title){g.font=F(800,30);g.fillStyle=NP.ink;g.fillText(title,60+cw+20,y+3);}
  if(right){g.font=F(400,19,'SM');g.fillStyle=NP.mut;g.textAlign='right';g.fillText(right,W-60,y);g.textAlign='left';}
  g.fillStyle=NP.line;g.fillRect(60,y+22,W-120,1);for(let x=60;x<=W-60;x+=48)g.fillRect(x,y+17,1,6);
  const lg=g.createLinearGradient(60,0,200,0);lg.addColorStop(0,NP.ac);lg.addColorStop(1,'rgba(94,234,255,0)');g.fillStyle=lg;g.fillRect(60,y+20,140,3);}
function npPanel(g,x,y,w,h,r,stroke){const gr=g.createLinearGradient(x,y,x,y+h);gr.addColorStop(0,'rgba(16,34,72,.92)');gr.addColorStop(1,'rgba(6,14,34,.96)');rr(g,x,y,w,h,r);g.fillStyle=gr;g.fill();g.lineWidth=1.5;g.strokeStyle=stroke||'rgba(94,234,255,.22)';g.stroke();}
function npCorners(g,x,y,w,h,s,col){g.strokeStyle=col||NP.ac;g.lineWidth=3;g.beginPath();
  for(const [px,py,dx,dy] of [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]]){g.moveTo(px,py+dy*s);g.lineTo(px,py);g.lineTo(px+dx*s,py);}g.stroke();}
/* split-flap digits: one dark cell per digit with the hinge line; separators sit between cells */
function npFlap(g,x,y,txt,size,col){const cw=size*0.74,ch=size*1.28,gap=size*0.08;let cx=x;g.textAlign='center';g.font=F(700,size,'SM');
  for(const c of txt){if(/[\d A-Z]/.test(c)){rr(g,cx,y,cw,ch,size*0.12);const gr=g.createLinearGradient(0,y,0,y+ch);gr.addColorStop(0,'#16305c');gr.addColorStop(0.5,'#11244a');gr.addColorStop(0.5,'#0b1a38');gr.addColorStop(1,'#0a1630');g.fillStyle=gr;g.fill();
      g.strokeStyle='rgba(94,234,255,.18)';g.lineWidth=1.2;g.stroke();g.fillStyle=col||'#fff6e2';g.fillText(c,cx+cw/2,y+ch*0.73);g.fillStyle='rgba(0,0,0,.55)';g.fillRect(cx,y+ch/2-1,cw,2);cx+=cw+gap;}
    else{g.fillStyle=col||'#fff6e2';g.fillText(c,cx+size*0.16,y+ch*0.73);cx+=size*0.34+gap;}}g.textAlign='left';return cx-x;}
const flapW=(txt,size)=>{let w=0;for(const c of txt)w+=(/[\d A-Z]/.test(c)?size*0.74:size*0.34)+size*0.08;return w;};
function medalFill(g,cx,cy,r,rar){let gr;if(rar==='legend'&&g.createConicGradient){gr=g.createConicGradient(-1,cx,cy);['#ff4f9a','#ffc56b','#6ff7c8','#5eeaff','#a78bfa','#ff4f9a'].forEach((c,i)=>gr.addColorStop(i/5,c));}
  else{const C={base:['#2a6a95','#0f2b4c','#2a6a95'],silver:['#f2f6fb','#8e9db2','#dfe6ef'],gold:['#ffe9b5','#c58b3a','#f9d78f'],legend:['#ff4f9a','#ffc56b','#5eeaff']}[rar]||['#2a6a95','#0f2b4c','#2a6a95'];gr=g.createLinearGradient(cx-r,cy-r,cx+r,cy+r);gr.addColorStop(0,C[0]);gr.addColorStop(0.55,C[1]);gr.addColorStop(1,C[2]);}
  g.beginPath();g.arc(cx,cy,r+6,0,7);g.fillStyle='rgba(0,0,0,.4)';g.fill();g.beginPath();g.arc(cx,cy,r,0,7);g.fillStyle=gr;g.fill();
  const hl=g.createRadialGradient(cx-r*0.35,cy-r*0.45,1,cx-r*0.35,cy-r*0.45,r*0.9);hl.addColorStop(0,'rgba(255,255,255,.55)');hl.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=hl;g.fill();
  g.lineWidth=2;g.strokeStyle='rgba(255,255,255,.25)';g.stroke();g.setLineDash([3,4]);g.beginPath();g.arc(cx,cy,r+11,0,7);g.strokeStyle='rgba(255,255,255,.18)';g.lineWidth=1.2;g.stroke();g.setLineDash([]);}
async function renderLongPosterNight(){
  const sc=S;if(!sc||!sc.ok)return null;
  const PO=posterOpts(),{parts}=PO,B=parts.badges?computeBadges(sc).filter(b=>badgeOn(PO,b)):[],P=sc.P,F0=sc.final,years=sc.years.filter(y=>y.n>0),showYears=parts.years&&years.length>1;
  const flown=sc.flights.filter(f=>!f.vd&&!f.up),LF=flown.length?flown:sc.flights.filter(f=>!f.vd);
  /* the boarding pass flies from the home base (most take-offs and landings) to the farthest airport from it */
  const apc=new Map();for(const f of LF)for(const a of [f.f,f.to])apc.set(a,(apc.get(a)||0)+1);const fromC=[...apc].sort((a,b)=>b[1]-a[1])[0][0];let toC=fromC,fk=-1;for(const [a] of apc){if(!AP[a]||!AP[fromC])continue;const d=hav(AP[fromC],AP[a]);if(d>fk){fk=d;toC=a;}}
  const km=F0.km;let ti=0;TIERS.forEach((t,j)=>{if(km>=t[0])ti=j;});const T=TIERS[ti];
  const ccs=sc.order.filter(c=>sc.visit[c]<1e9),rowsF=Math.ceil(ccs.length/10),rowsB=Math.ceil(B.length/2);
  await Promise.all([ensureFonts(),loadFlags(sc.order),loadGlyphs(B.map(b=>b.k+b.v+b.d).join('')+placeName(fromC)+placeName(toC)+T[1]+T[3])]);
  /* block heights, top to bottom */
  const MW=960,MH=Math.round(MW*MAP.h/MAP.w),GAP=56;
  const H={cover:1180,pass:290,stats:parts.stats?58+336:0,map:parts.map?MH+122:0,flags:parts.flags&&ccs.length?58+rowsF*118:0,badges:B.length?40+rowsB*172:0,years:showYears?358:0,foot:parts.qr?360:170};
  const Hh=Object.values(H).reduce((a,b)=>a+b,0)+GAP*(Object.entries(H).filter(([k,v])=>v&&k!=='cover'&&k!=='foot'&&k!=='pass').length+1);
  const c=document.createElement('canvas');c.width=W;c.height=Hh;const g=c.getContext('2d');const keep=ctx;ctx=g;
  const seed=[...(P.latin||'SKY')+yearsLabel(sc,'-')].reduce((a,ch)=>(a*31+ch.charCodeAt(0))>>>0,7),rnd=rngF(seed);
  try{
    /* background: night sky, glows and stars */
    const bg=g.createLinearGradient(0,0,0,Hh);bg.addColorStop(0,'#030716');bg.addColorStop(0.25,'#071431');bg.addColorStop(0.6,'#050d24');bg.addColorStop(1,'#02040b');g.fillStyle=bg;g.fillRect(0,0,W,Hh);
    for(const [x,y,r,col] of [[W*0.85,120,760,'rgba(56,90,210,.30)'],[W*0.05,700,620,'rgba(255,79,154,.10)'],[W*0.9,Hh*0.55,700,'rgba(167,139,250,.10)'],[W*0.2,Hh*0.8,700,'rgba(94,234,255,.06)']]){const rg=g.createRadialGradient(x,y,0,x,y,r);rg.addColorStop(0,col);rg.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=rg;g.fillRect(0,0,W,Hh);}
    for(let i=0;i<Math.round(Hh/5);i++){const x=rnd()*W,y=rnd()*Hh,s=rnd();g.fillStyle=`rgba(${s<0.18?'255,214,170':'200,236,255'},${(0.2+rnd()*0.7).toFixed(2)})`;g.fillRect(x,y,s>0.93?2.2:1.2,s>0.93?2.2:1.2);}
    /* ===== cover ===== */
    g.textAlign='left';g.font=F(700,19,'SM');g.fillStyle=NP.ac;trk(g,'SKY PASSPORT // FLIGHT LOG',60,70,4);
    const serial=`NO. SP-${String(sc.years[sc.years.length-1].y)}-${(seed%65536).toString(16).toUpperCase().padStart(4,'0')}`;g.font=F(700,19,'SM');g.fillStyle=NP.gold;trk(g,serial,W-60,70,3,'right');
    g.font=`900 46px ${SERIF}`;g.fillStyle=goldText(g,90,140);if(EN())trk(g,'SKY PASSPORT',60,136,6);else trk(g,'航迹护照',60,136,14);
    g.font=F(400,18,'SM');g.fillStyle=NP.mut;g.textAlign='right';g.fillText(L('VALID · 一生有效','VALID · FOR LIFE'),W-60,132);g.textAlign='left';
    g.fillStyle=NP.line;g.fillRect(60,162,W-120,1);for(let x=60;x<=W-60;x+=24)g.fillRect(x,x%120===60?154:158,1,x%120===60?9:5);
    /* globe with HUD rings */
    const gx=W/2,gy=560,GR=318;const halo=g.createRadialGradient(gx,gy+GR*0.9,10,gx,gy+GR*0.9,GR*1.6);halo.addColorStop(0,'rgba(94,234,255,.16)');halo.addColorStop(1,'rgba(94,234,255,0)');g.fillStyle=halo;g.fillRect(0,0,W,1500);
    g.save();g.translate(gx,gy);g.strokeStyle='rgba(94,234,255,.25)';g.lineWidth=1.4;g.setLineDash([5,7]);g.beginPath();g.arc(0,0,GR*1.24,0,7);g.stroke();g.setLineDash([]);
    g.strokeStyle='rgba(94,234,255,.6)';g.lineWidth=2.4;g.beginPath();g.arc(0,0,GR*1.16,-2.5,-1.2);g.stroke();g.strokeStyle='rgba(94,234,255,.22)';g.beginPath();g.arc(0,0,GR*1.16,0.6,1.6);g.stroke();
    for(let a=0;a<360;a+=6){const r0=GR*1.09,r1=GR*(a%30===0?1.135:1.115),t=a*Math.PI/180;g.strokeStyle=a%30===0?'rgba(94,234,255,.55)':'rgba(94,234,255,.22)';g.lineWidth=a%30===0?2:1;g.beginPath();g.moveTo(Math.cos(t)*r0,Math.sin(t)*r0);g.lineTo(Math.cos(t)*r1,Math.sin(t)*r1);g.stroke();}
    const pa=-1.2;g.fillStyle=NP.ac2;g.beginPath();g.arc(Math.cos(pa)*GR*1.24,Math.sin(pa)*GR*1.24,7,0,7);g.fill();g.fillStyle='rgba(255,79,154,.25)';g.beginPath();g.arc(Math.cos(pa)*GR*1.24,Math.sin(pa)*GR*1.24,16,0,7);g.fill();g.restore();
    let routes=0;if(typeof HOME!=='undefined')routes=HOME.paintGlobe(g,gx,gy,GR,GR/240);
    g.font=F(700,18,'SM');g.fillStyle=NP.ac;g.fillText(L('● 实时航迹','● LIVE ROUTES'),60,236);const rn=String(routes||new Set(LF.map(f=>[f.f,f.to].sort().join())).size);g.font=F(700,30,'SM');g.fillStyle=NP.ink;g.fillText(rn,60,272);const rw=g.measureText(rn).width;g.font=F(400,18);g.fillStyle=NP.mut;g.fillText(L('条航线','routes'),60+rw+12,272);
    g.textAlign='right';g.font=F(700,18,'SM');g.fillStyle=NP.ac;g.fillText('ORBIT · 01',W-60,236);g.font=F(700,24,'SM');g.fillStyle=NP.ink;g.fillText(`${fmt(km)} KM`,W-60,270);g.textAlign='left';
    /* name and years */
    let y=gy+GR+170;const nm=parts.name?P.disp:L('我的飞行护照','MY FLIGHT PASSPORT');g.textAlign='center';
    fitFont(g,nm,940,92,40,s=>F(800,s));const ng=g.createLinearGradient(0,y-80,0,y);ng.addColorStop(0,'#ffffff');ng.addColorStop(1,'#bfeeff');g.fillStyle=ng;g.fillText(nm,W/2,y);
    g.font=F(700,34,'SM');g.fillStyle=goldText(g,y+20,y+60);trk(g,`${yearsLabel(sc,' — ')}  ·  FLIGHT LOG`,W/2,y+62,2,'center');
    g.font=F(400,26);g.fillStyle=NP.mut;g.fillText(sc.years.length>1?L('一本护照，装下我的天空','Every flight, one passport'):L('我的年度飞行报告','My year in flights'),W/2,y+106);g.textAlign='left';
    y=H.cover;
    /* ===== boarding pass ===== */
    {const x=60,w=W-120,h=250,yy=y+20,px=x+w-250;npPanel(g,x,yy,w,h,26,'rgba(94,234,255,.35)');
      g.fillStyle=bg;for(const cy of [yy,yy+h]){g.beginPath();g.arc(px,cy,20,0,7);g.fill();}g.strokeStyle='rgba(94,234,255,.35)';g.lineWidth=1.5;for(const [cy,a0,a1] of [[yy,0,Math.PI],[yy+h,Math.PI,2*Math.PI]]){g.beginPath();g.arc(px,cy,20,a0,a1);g.stroke();}
      g.setLineDash([6,8]);g.strokeStyle='rgba(94,234,255,.4)';g.beginPath();g.moveTo(px,yy+26);g.lineTo(px,yy+h-26);g.stroke();g.setLineDash([]);
      g.font=F(700,17,'SM');g.fillStyle=NP.ac;trk(g,L('BOARDING PASS · 登机牌','BOARDING PASS'),x+32,yy+42,3);
      const fc=fromC,tc=toC;g.font=F(400,14,'SM');g.fillStyle=NP.mut;g.fillText(L('大本营 · HOME','HOME BASE'),x+32,yy+62);g.font=F(700,84,'SM');g.fillStyle='#fff6e2';g.fillText(fc,x+30,yy+128);const fw=g.measureText(fc).width;
      g.fillStyle=NP.ac;g.save();g.translate(x+30+fw+70,yy+100);plane(g,0,0,0,2.1,NP.ac,0);g.restore();g.strokeStyle='rgba(94,234,255,.4)';g.setLineDash([3,6]);g.beginPath();g.moveTo(x+30+fw+16,yy+100);g.lineTo(x+30+fw+42,yy+100);g.moveTo(x+30+fw+100,yy+100);g.lineTo(x+30+fw+124,yy+100);g.stroke();g.setLineDash([]);
      g.font=F(700,84,'SM');g.fillStyle='#fff6e2';g.fillText(tc,x+30+fw+140,yy+128);g.font=F(400,14,'SM');g.fillStyle=NP.mut;g.fillText(L(`最远 · ${fmt(Math.max(0,fk))} KM`,`FARTHEST · ${fmt(Math.max(0,fk))} KM`),x+32+fw+140,yy+62);
      g.font=F(400,19);g.fillStyle=NP.mut;g.fillText(placeName(fc),x+32,yy+160);g.fillText(placeName(tc),x+30+fw+142,yy+160);
      const fields=[[L('旅客','PASSENGER'),parts.name?(P.latin||P.disp):'— — —'],[L('年份','DATES'),yearsLabel(sc,'–')],[L('航班','FLIGHTS'),String(F0.n)]];let fx=x+32;
      for(const [k,v] of fields){g.font=F(400,15,'SM');g.fillStyle=NP.ac;g.fillText(k,fx,yy+200);const vs=fitFont(g,v,200,24,14,s=>F(700,s,'SM'));g.fillStyle=NP.ink;g.fillText(v,fx,yy+230);fx+=Math.max(150,g.measureText(v).width+40);}
      g.font=F(400,15,'SM');g.fillStyle=NP.ac;g.fillText(L('等级 · CLASS','CLASS'),px+34,yy+42);g.font=F(800,40);g.fillStyle=goldText(g,yy+60,yy+100);g.fillText(L(T[1],T[2].toUpperCase()),px+34,yy+94);g.font=F(400,18);g.fillStyle=NP.mut;fitFont(g,L(T[3],T[4]),190,18,12,s=>F(400,s));g.fillText(L(T[3],T[4]),px+34,yy+124);
      let bx=px+34;const r2=rngF(seed+7);g.fillStyle='rgba(234,244,255,.85)';while(bx<x+w-30){const bw=1+Math.floor(r2()*4);g.fillRect(bx,yy+150,bw,66);bx+=bw+1+Math.floor(r2()*3);}
      g.font=F(400,13,'SM');g.fillStyle=NP.mut;g.fillText(serial.replace('NO. ',''),px+34,yy+234);y+=H.pass;}
    /* ===== numbers: split-flap board ===== */
    if(parts.stats){y+=GAP;npHead(g,y,'FLIGHT DATA',EN()?'':'飞行数据');y+=58;
      const S6=[[L('航班','FLIGHTS'),String(F0.n),'FLT'],[L('里程','DISTANCE'),fmt(F0.km),'KM'],[L('空中时间','AIRBORNE'),fmt(F0.min/60),'HRS'],[L('国家地区','COUNTRIES'),String(F0.cc),'CTRY'],[L('机场','AIRPORTS'),String(F0.ap),'APT'],[L('航司','AIRLINES'),String(F0.al),'AIRL']];
      S6.forEach(([l,v,u],i)=>{const tw=(W-120-40)/3,cx=60+(i%3)*(tw+20),cy=y+Math.floor(i/3)*168;npPanel(g,cx,cy,tw,150,18);
        g.font=F(400,20);g.fillStyle=NP.mut;g.fillText(l,cx+22,cy+38);g.textAlign='right';g.font=F(700,15,'SM');g.fillStyle=NP.ac;g.fillText(u,cx+tw-20,cy+36);g.textAlign='left';
        let fs=50;while(flapW(v,fs)>tw-40&&fs>24)fs-=2;npFlap(g,cx+20,cy+58,v,fs);});
      y+=2*168;}
    /* ===== route map ===== */
    if(parts.map){y+=GAP;npHead(g,y,'ROUTE MAP',EN()?'':'航线图',L(`${new Set(LF.map(f=>[f.f,f.to].sort().join())).size} 条航线`,`${new Set(LF.map(f=>[f.f,f.to].sort().join())).size} ROUTES`));y+=58;
      const tm=Math.max(sc.T_ZOOM+1.6,sc.T_CARD-0.7),cam=sc.cam[Math.min(sc.cam.length-1,Math.floor(tm*FPS))],k=MW/MAP.w;
      const mc=document.createElement('canvas');mc.width=MW;mc.height=MH;const m=mc.getContext('2d'),T2=()=>m.setTransform(cam.z*k,0,0,cam.z*k,k*(MAP.w/2-cam.cx*cam.z),k*(MAP.h/2-cam.cy*cam.z)),lw=v=>v/(cam.z*k);
      m.fillStyle='#040b1e';m.fillRect(0,0,MW,MH);T2();m.lineWidth=lw(1);m.strokeStyle='rgba(94,234,255,.07)';m.stroke(sc.gratP);
      m.fillStyle='#0b1a3a';m.fill(sc.landP);if(sc.chinaP)m.fill(sc.chinaP);
      const dp=document.createElement('canvas');dp.width=dp.height=7;const dg=dp.getContext('2d');dg.fillStyle='rgba(94,234,255,.26)';dg.fillRect(2.5,2.5,1.6,1.6);const pat=m.createPattern(dp,'repeat');
      for(const pth of [sc.landP,sc.chinaP]){if(!pth)continue;m.save();T2();m.clip(pth);m.setTransform(1,0,0,1,0,0);m.fillStyle=pat;m.fillRect(0,0,MW,MH);m.restore();}
      T2();m.lineWidth=lw(1);m.strokeStyle='rgba(94,234,255,.16)';m.stroke(sc.landP);
      for(const kc of sc.order){const p=sc.cpath[kc];if(!p)continue;const clip=sc.outsideCN&&!REGIONS.has(kc);if(clip){m.save();m.clip(sc.outsideCN,'evenodd');}
        m.fillStyle='rgba(94,234,255,.17)';m.fill(p);m.lineWidth=lw(1.3);m.strokeStyle='rgba(94,234,255,.6)';m.stroke(p);if(clip)m.restore();}
      if(sc.jdP){m.fillStyle='rgba(94,234,255,.7)';m.fill(sc.jdP);m.lineWidth=lw(0.8);m.strokeStyle='rgba(94,234,255,.7)';m.stroke(sc.jdP);} /* nine-dash line, always shown */
      m.setTransform(1,0,0,1,0,0);m.lineCap='round';const S2=p=>{const q=toScr(p,cam);return [q[0]*k,q[1]*k];};const rts=new Map(),aps=new Map();
      for(const f of sc.flights){if(f.vd)continue;const key=[f.f,f.to].sort().join()+(f.up?'u':'');const r=rts.get(key);if(r)r.n++;else rts.set(key,{f,n:1});for(const a of [f.f,f.to])aps.set(a,(aps.get(a)||0)+1);}
      m.globalCompositeOperation='lighter';
      for(const {f,n} of rts.values()){const a=S2(f.a),b=S2(f.b),cc=ctrl(a,b);if(f.up){m.setLineDash([8,8]);m.lineWidth=2;m.strokeStyle='rgba(94,234,255,.75)';strokeQ(m,a,cc,b,1);m.setLineDash([]);continue;}
        m.lineWidth=9+Math.min(6,n);m.strokeStyle='rgba(255,79,154,.08)';strokeQ(m,a,cc,b,1);const lg=m.createLinearGradient(a[0],a[1],b[0]+0.01,b[1]);lg.addColorStop(0,'rgba(255,214,150,.95)');lg.addColorStop(1,'rgba(255,79,154,.95)');m.lineWidth=1.6+Math.min(2.4,n*0.35);m.strokeStyle=lg;strokeQ(m,a,cc,b,1);
        const hp=qpt(a,cc,b,0.62);m.fillStyle='rgba(255,246,220,.95)';m.beginPath();m.arc(hp[0],hp[1],2.4,0,7);m.fill();}
      for(const [code,n] of aps){if(!AP[code])continue;const p=S2(sc.proj([AP[code].lon,AP[code].lat])),r=6+Math.min(8,Math.sqrt(n)*2);const rg=m.createRadialGradient(p[0],p[1],0,p[0],p[1],r*2);rg.addColorStop(0,'rgba(111,247,200,.55)');rg.addColorStop(1,'rgba(111,247,200,0)');m.fillStyle=rg;m.beginPath();m.arc(p[0],p[1],r*2,0,7);m.fill();m.fillStyle='#eafff7';m.beginPath();m.arc(p[0],p[1],3,0,7);m.fill();}
      m.globalCompositeOperation='source-over';m.font=F(700,15,'SM');m.lineJoin='round';
      for(const [code] of [...aps].sort((a,b)=>b[1]-a[1]).slice(0,8)){if(!AP[code])continue;const p=S2(sc.proj([AP[code].lon,AP[code].lat]));if(p[0]<20||p[0]>MW-60||p[1]<24||p[1]>MH-10)continue;m.lineWidth=5;m.strokeStyle='rgba(4,11,30,.9)';m.strokeText(code,p[0]+9,p[1]-9);m.fillStyle=NP.ac;m.fillText(code,p[0]+9,p[1]-9);}
      m.globalCompositeOperation='destination-out';const fe=46;for(const [x0,y0,w0,h0,a0,b0,a1,b1] of [[0,0,fe,MH,0,0,fe,0],[MW-fe,0,fe,MH,MW,0,MW-fe,0],[0,0,MW,fe,0,0,0,fe],[0,MH-fe,MW,fe,0,MH,0,MH-fe]]){const g1=m.createLinearGradient(a0,b0,a1,b1);g1.addColorStop(0,'#000');g1.addColorStop(1,'rgba(0,0,0,0)');m.fillStyle=g1;m.fillRect(x0,y0,w0,h0);}
      npPanel(g,60,y,MW,MH,22);g.save();rr(g,60,y,MW,MH,22);g.clip();g.drawImage(mc,60,y);g.restore();npCorners(g,72,y+12,MW-24,MH-24,26,'rgba(94,234,255,.7)');
      g.font=F(400,15,'SM');g.fillStyle=NP.mut;g.fillText(`${L('投影','PROJ')} · ${P.nat3||''} · ${fmt(km)} KM`,90,y+MH-26);
      y+=MH+22;g.font=F(400,18);let lx=60;for(const [col,dash,txt] of [['#ffb08a',false,L('已飞','Flown')],[NP.ac,true,L('待出行','Upcoming')],['#6ff7c8',null,L('机场','Airport')]]){
        if(dash===null){g.fillStyle=col;g.beginPath();g.arc(lx+8,y+20,6,0,7);g.fill();}else{g.strokeStyle=col;g.lineWidth=3;g.setLineDash(dash?[6,5]:[]);g.beginPath();g.moveTo(lx,y+20);g.lineTo(lx+34,y+20);g.stroke();g.setLineDash([]);}
        g.fillStyle=NP.mut;g.fillText(txt,lx+(dash===null?24:44),y+27);lx+=g.measureText(txt).width+(dash===null?60:80);}
      y+=42;}
    /* ===== stamps: flags ===== */
    if(H.flags){y+=GAP;npHead(g,y,'STAMPS',EN()?'':'去过的国家和地区',L(`${ccs.length} 个`,`${ccs.length}`));y+=70;
      ccs.forEach((cc,i)=>{const row=Math.floor(i/10),j=i%10,cnt=Math.min(10,ccs.length-row*10),fx=W/2+(j-(cnt-1)/2)*92,fy=y+row*118+36,R=32;
        g.beginPath();g.arc(fx,fy,R+7,0,7);g.strokeStyle='rgba(94,234,255,.35)';g.lineWidth=1.5;g.stroke();g.save();g.beginPath();g.arc(fx,fy,R,0,7);g.clip();const im=flagImg(cc);
        if(im)g.drawImage(im,fx-R,fy-R,2*R,2*R);else{g.fillStyle='#16305c';g.fillRect(fx-R,fy-R,2*R,2*R);g.fillStyle=NP.ink;g.font=F(700,cc==='TW'?17:18);g.textAlign='center';g.fillText(cc==='TW'?L('台湾','Taiwan'):cc,fx,fy+6);g.textAlign='left';} /* Taiwan: neutral marker, no flag */
        const gl=g.createLinearGradient(fx,fy-R,fx,fy+R);gl.addColorStop(0,'rgba(255,255,255,.28)');gl.addColorStop(0.5,'rgba(255,255,255,0)');g.fillStyle=gl;g.fillRect(fx-R,fy-R,2*R,2*R);g.restore();
        g.font=F(700,14,'SM');g.fillStyle=NP.mut;g.textAlign='center';g.fillText(NAMES[cc]?NAMES[cc][2]:cc,fx,fy+R+28);g.textAlign='left';});
      y+=rowsF*118-12;}
    /* ===== medals ===== */
    if(B.length){y+=GAP;npHead(g,y,'ACHIEVEMENTS',EN()?'':'飞行成就',L(`${B.length} 枚勋章`,`${B.length} MEDALS`));y+=58;
      const RAR={legend:L('传奇','LEGEND'),gold:L('金','GOLD'),silver:L('银','SILVER')};
      B.forEach((b,i)=>{const cw=(W-120-20)/2,cx=60+(i%2)*(cw+20),cy=y+Math.floor(i/2)*172,ch=154;
        npPanel(g,cx,cy,cw,ch,20,b.rar==='gold'?'rgba(233,197,142,.45)':b.rar==='legend'?'rgba(255,150,200,.55)':'rgba(94,234,255,.22)');
        if(b.rar==='legend'&&g.createConicGradient){const cg=g.createConicGradient(0,cx+cw/2,cy+ch/2);['#ff4f9a','#ffc56b','#6ff7c8','#5eeaff','#a78bfa','#ff4f9a'].forEach((c2,q)=>cg.addColorStop(q/5,c2));rr(g,cx,cy,cw,ch,20);g.lineWidth=2.5;g.strokeStyle=cg;g.stroke();}
        medalFill(g,cx+68,cy+ch/2,42,b.rar);g.font=EMOJI(38);g.textAlign='center';g.fillStyle='#fff';g.fillText(b.i,cx+68,cy+ch/2+14);g.textAlign='left';
        const tx=cx+134,tw=cw-150;g.font=F(400,19);g.fillStyle=NP.mut;g.fillText(b.k,tx,cy+48);
        fitFont(g,b.v,tw,32,18,s=>F(800,s));g.fillStyle=NP.ink;g.fillText(b.v,tx,cy+90);fitFont(g,b.d,tw,18,12,s=>F(400,s));g.fillStyle=NP.mut;g.fillText(b.d,tx,cy+124);
        if(RAR[b.rar]){g.font=F(700,13,'SM');const tw2=g.measureText(RAR[b.rar]).width+16;rr(g,cx+cw-tw2-16,cy+14,tw2,24,6);g.fillStyle=b.rar==='gold'?NP.gold:b.rar==='silver'?'#cfd8e4':'#ff9cc3';g.fill();g.fillStyle='#02040b';g.fillText(RAR[b.rar],cx+cw-tw2-8,cy+31);}});
      y+=rowsB*172-18;}
    /* ===== timeline ===== */
    if(showYears){y+=GAP;npHead(g,y,'TIMELINE',EN()?'':'每年的航班');y+=58;npPanel(g,60,y,W-120,300,22);
      const mx=Math.max(...years.map(v=>v.n)),n=years.length,bw=Math.min(72,(W-200)/n-14),x0=W/2-(n*(bw+14)-14)/2,base=y+236,hmax=170;
      g.strokeStyle='rgba(94,234,255,.08)';g.lineWidth=1;for(let q=1;q<=4;q++){g.setLineDash([4,6]);g.beginPath();g.moveTo(90,base-hmax*q/4);g.lineTo(W-90,base-hmax*q/4);g.stroke();}g.setLineDash([]);g.fillStyle='rgba(94,234,255,.35)';g.fillRect(90,base,W-180,1.5);
      years.forEach((v,i)=>{const x=x0+i*(bw+14),h=Math.max(6,hmax*v.n/mx),top=v.n===mx;g.globalCompositeOperation='lighter';g.fillStyle=top?'rgba(233,197,142,.12)':'rgba(94,234,255,.10)';rr(g,x-6,base-h-6,bw+12,h+6,8);g.fill();g.globalCompositeOperation='source-over';
        const gr=g.createLinearGradient(0,base-h,0,base);if(top){gr.addColorStop(0,'#ffe3a3');gr.addColorStop(1,'#c58b3a');}else{gr.addColorStop(0,NP.ac);gr.addColorStop(1,'rgba(167,139,250,.75)');}g.fillStyle=gr;rr(g,x,base-h,bw,h,6);g.fill();g.fillStyle='rgba(255,255,255,.6)';g.fillRect(x+3,base-h+2,bw-6,2);
        g.textAlign='center';g.font=F(700,20,'SM');g.fillStyle=top?NP.gold:NP.ink;g.fillText(String(v.n),x+bw/2,base-h-14);g.font=F(400,17,'SM');g.fillStyle=NP.mut;g.fillText("'"+String(v.y).slice(2),x+bw/2,base+30);g.textAlign='left';});
      y+=300;}
    /* ===== footer: QR, address, machine-readable zone ===== */
    const fy=Hh-H.foot;g.fillStyle='rgba(2,4,11,.6)';g.fillRect(0,fy,W,H.foot);const tl=g.createLinearGradient(0,0,W,0);tl.addColorStop(0,'rgba(255,79,154,0)');tl.addColorStop(0.3,NP.ac2);tl.addColorStop(0.7,NP.ac);tl.addColorStop(1,'rgba(94,234,255,0)');g.fillStyle=tl;g.fillRect(0,fy,W,2);
    g.strokeStyle='rgba(94,234,255,.05)';g.lineWidth=1;for(let x=0;x<=W;x+=40){g.beginPath();g.moveTo(x,fy);g.lineTo(x,Hh);g.stroke();}for(let yy=fy;yy<=Hh;yy+=40){g.beginPath();g.moveTo(0,yy);g.lineTo(W,yy);g.stroke();}
    const mrz1=('P<'+(P.nat3||'XXX')+(parts.name?(P.latin||'TRAVELLER'):'TRAVELLER').toUpperCase().replace(/[^A-Z]+/g,'<')+'<<FLIGHT<LOG').padEnd(44,'<').slice(0,44);
    const mrz2=(serial.replace(/[^A-Z0-9]/g,'')+'<'+yearsLabel(sc,'').replace(/[^0-9]/g,'')+'<'+String(F0.n)+'<'+String(F0.km)).padEnd(44,'<').slice(0,44);
    if(parts.qr){const qs=196,qx=W-60-qs-16,qy=fy+56;rr(g,qx-14,qy-14,qs+28,qs+28,18);g.fillStyle='#fff';g.fill();g.lineWidth=2;g.strokeStyle='rgba(94,234,255,.8)';g.stroke();npCorners(g,qx-26,qy-26,qs+52,qs+52,22);drawQrCard(g,qx,qy,qs,1,null);
      g.font=F(800,40);g.fillStyle=goldText(g,fy+70,fy+120);g.fillText(L('扫码生成你的飞行护照','Scan to make your own'),60,fy+112);g.font=F(700,26,'SM');g.fillStyle=NP.ink;g.fillText(SITE_HOST,60,fy+160);
      g.font=F(400,19);g.fillStyle=NP.mut;g.fillText(L('免费 · 在浏览器里完成 · 表格不上传','Free · made in your browser · nothing uploaded'),60,fy+198);
      g.font=F(400,17,'SM');g.fillStyle='rgba(94,234,255,.45)';g.fillText(mrz1,60,fy+266);g.fillText(mrz2,60,fy+294);}
    else{g.textAlign='center';g.font=F(700,24,'SM');g.fillStyle=goldText(g,fy+50,fy+90);trk(g,'SKY PASSPORT · 航迹护照',W/2,fy+78,4,'center');g.font=F(400,16,'SM');g.fillStyle='rgba(94,234,255,.45)';g.fillText(mrz1,W/2,fy+124);g.textAlign='left';}
  }finally{ctx=keep;}
  return c;}
async function renderLongPoster(){return posterStyle()==='classic'?renderLongPosterClassic():renderLongPosterNight();}
/* which look the long poster uses: 夜航 (new, default) or the classic passport; remembered per browser */
const POSTER_STYLE_KEY='skypassport.posterStyle';
function posterStyle(){try{return localStorage.getItem(POSTER_STYLE_KEY)==='classic'?'classic':'night';}catch(e){return 'night';}}
function syncPosterStyle(){const v=posterStyle();document.querySelectorAll('#segPoster button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===v)));}
document.querySelectorAll('#segPoster button').forEach(b=>b.addEventListener('click',()=>{try{localStorage.setItem(POSTER_STYLE_KEY,b.dataset.v);}catch(e){}syncPosterStyle();refreshPoster();}));syncPosterStyle();

/* ---------- 9:16 cover image = the closing poster with the end card ---------- */
function renderCoverImage(){const sc=S;if(!sc||!sc.ok)return null;const c=document.createElement('canvas');c.width=W;c.height=H;
  renderFrame(Math.max(0,sc.frames-12));c.getContext('2d').drawImage(cv,0,0);drawAt(playT);return c;}

let lastImg=null,lastImgName='';
function showImage(c,name,isPoster){if(!c)return;lastIsPoster=!!isPoster;c.toBlob(b=>{lastImg=b;lastImgName=name;$('imgPrev').src=URL.createObjectURL(b);$('imgOut').hidden=false;},'image/png');}
async function saveImage(){if(!lastImg)return;const file=new File([lastImg],lastImgName,{type:'image/png'});
  if(matchMedia('(pointer:coarse)').matches&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:L('航迹护照','Sky Passport')});return;}catch(e){if(e&&e.name==='AbortError')return;}}
  saveFile(lastImgName,lastImg);}
const imgBase=()=>`${L('航迹护照','sky-passport')}_${(S.P.latin||'flight').replace(/\s+/g,'_')}_${yearsLabel(S,'-','')}`;
$('btnLong').addEventListener('click',async()=>{if(!S||!S.ok)return;const b=$('btnLong');b.disabled=true;b.textContent=L('正在生成…','Making…');
  try{showImage(await renderLongPoster(),imgBase()+L('_长图.png','_poster.png'),true);}finally{b.disabled=false;b.textContent=L('生成长图海报','Make a long poster');}});
$('btnCoverImg').addEventListener('click',async()=>{if(!S||!S.ok)return;await Promise.all([ensureFonts(),loadFlags(S.order)]);showImage(renderCoverImage(),imgBase()+L('_封面.png','_cover.png'));});
$('btnSaveImg').addEventListener('click',saveImage);
$('posterOpts').addEventListener('toggle',e=>{if(e.target.open)renderPosterChecks();});
$('achRec').addEventListener('click',()=>achPick('rec'));$('achAll').addEventListener('click',()=>achPick('all'));$('achNone').addEventListener('click',()=>achPick('none'));
