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
async function renderLongPoster(){
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
