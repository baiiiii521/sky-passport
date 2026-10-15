"use strict";
/* ================= data & helpers ================= */
const $=id=>document.getElementById(id);
// segmented controls: the pressed button's data-v is the value
const segVal=(id,d)=>{const e=typeof document!=='undefined'&&$(id),b=e&&e.querySelector('button[aria-pressed="true"]');return b?b.dataset.v:d;};
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2,easeOut=t=>1-Math.pow(1-t,3),easeInOut=u=>u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;
const hash=n=>{const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x);};
// China follows the mainland standard map (china.json: DataV/AutoNavi outline incl. Taiwan and the South China Sea, plus the nine-dash line)
let CHINA=null;
function rewind(g){for(const p of g.type==='Polygon'?[g.coordinates]:g.coordinates)if(d3.geoArea({type:'Polygon',coordinates:p})>2*Math.PI)p.forEach(r=>r.reverse());return g;} // d3 wants clockwise rings
const REGIONS=new Set(['CN','TW','HK','MO']);
let AP={},ZH={},ZHKEYS=[],NUM={},NAMES={},CITY={},APNAME={},TOPO=null;
// airport names normalised for matching: no 'International Airport', 机场, terminals or punctuation
function apNorm(s){return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/国际机场|國際機場|机场|機場|航站楼|\bt\d\b|terminal\s*\d*|international|intl\.?|airport|aeropuerto|aeroport|flughafen/g,' ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();}
const NAME_FIX={HK:['Hong Kong, China','中国香港'],MO:['Macao, China','中国澳门'],TW:['Taiwan, China','中国台湾'],US:['United States','美国'],GB:['United Kingdom','英国'],KR:['South Korea','韩国'],RU:['Russia','俄罗斯']};
// airports.json → lookup tables (kept separate from fetching so tests can feed it directly)
function ingestAirports(a){
  for(const r of a.rows){AP[r[0]]={iata:r[0],lat:r[1],lon:r[2],tz:r[3],iso:r[4],city:r[5],name:r[6]};const c=r[5].toLowerCase();(CITY[c]=CITY[c]||[]).push(r[0]);}
  ZH=a.zh;ZHKEYS=Object.keys(ZH).sort((x,y)=>y.length-x.length);NUM=a.num;NAMES=a.names;
  for(const c in AP){for(const t of [AP[c].name,AP[c].name+' '+AP[c].city]){const n=apNorm(t);if(n&&!(n in APNAME))APNAME[n]=c;}} // "London Heathrow Airport" → LHR
  for(const k in NAME_FIX){if(NAMES[k]){NAMES[k][0]=NAME_FIX[k][0];NAMES[k][1]=NAME_FIX[k][1];}}
}
/* ?v= for data files (index.html is stamped by scripts/stamp.js), and libraries fetched on first use */
const VQ=typeof ASSET_V==='string'?'?v='+ASSET_V:'';
const APP_VERSION='3.3.0'; /* bump on every release; shown in the footer with the scripts' content hash */
/* anonymous usage counts (server/ev.js): the event name only, never flights or names; mainland site only, server renders and promo pages never count */
function track(e){try{if(/[?&](render|site)=/.test(location.search))return;const s=typeof EN==='function'&&EN()?'en':'web',b=JSON.stringify({e,s});if(/(^|\.)nybbq\.art$/.test(location.hostname)||/[?&]ev=1/.test(location.search)){if(!(navigator.sendBeacon&&navigator.sendBeacon('/api/ev',b)))fetch('/api/ev',{method:'POST',body:b,keepalive:true}).catch(()=>{});}else if(window.va)window.va('event',{name:e});}catch(_){}}
const LIBP={};
function loadLib(k,g){if(typeof globalThis[g]!=='undefined')return Promise.resolve();if(!LIBP[k])LIBP[k]=new Promise((res,rej)=>{const s=document.createElement('script');s.src=(typeof LIBS==='object'&&LIBS[k])||{xlsx:'vendor/xlsx.full.min.js',muxer:'vendor/mp4-muxer.js'}[k];s.onload=()=>res();s.onerror=()=>{delete LIBP[k];rej(new Error('could not load '+k));};document.head.appendChild(s);});return LIBP[k];}
async function loadData(){
  const [a,w,cn]=await Promise.all([fetch('airports.json'+VQ).then(r=>r.json()),fetch('world-50m.json'+VQ).then(r=>r.json()),fetch('china.json'+VQ).then(r=>r.json())]);
  CHINA={cn:rewind(cn.cn),jd:rewind(cn.jd)};
  ingestAirports(a);
  TOPO=w;
}
let flagImgs={},flagBmp={};
// flags/XX.svg is fetched the first time a country appears, then rasterised once so every frame draws identical pixels
function flagLoad(iso){if(iso==='TW'||!/^[A-Z]{2}$/.test(iso))return Promise.resolve(null);
  if(!flagImgs[iso])flagImgs[iso]=new Promise(res=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=c.height=96;c.getContext('2d').drawImage(i,0,0,96,96);flagBmp[iso]=c;res(c);invalidate();};i.onerror=()=>{flagBmp[iso]=null;res(null);};i.src='flags/'+iso+'.svg';});
  return flagImgs[iso];}
const loadFlags=codes=>Promise.all(codes.map(flagLoad));
function flagImg(iso){if(!(iso in flagImgs))flagLoad(iso);return flagBmp[iso]||null;}

/* ---------- airport resolution ---------- */
const manual={}; // raw name -> IATA
function resolveAirport(raw){
  if(raw==null)return null;let s=String(raw).trim();if(!s)return null;
  if(manual[s]&&AP[manual[s]])return manual[s];
  const up=s.toUpperCase();
  if(/^[A-Z]{3}$/.test(up)&&AP[up])return up;
  const m=up.match(/[(（\[]\s*([A-Z]{3})\s*(?:[\/|,]\s*[A-Z]{4})?\s*[)）\]]/);if(m&&AP[m[1]])return m[1]; // (PVG), （PVG）, (PVG/ZSPD) — myFlightradar24
  if(/[a-z]/.test(s)){const codes=(s.match(/\b[A-Z]{3}\b/g)||[]).filter(c=>AP[c]);if(codes.length===1)return codes[0];} // "Shanghai PVG", "PVG - Shanghai Pudong" (mixed case, so the code stands out)
  const z=s.replace(/国际机场|机场|國際機場|機場/g,'');
  for(const k of ZHKEYS){if(z.includes(k))return ZH[k];}
  const c=CITY[s.toLowerCase()];if(c&&c.length)return c[0];
  const n=apNorm(s);if(n&&APNAME[n])return APNAME[n]; // "John F. Kennedy International Airport", "London Heathrow Airport"
  const cn=CITY[n];if(n&&cn&&cn.length===1)return cn[0]; // "Paris" is ambiguous, "Chiang Mai" is not
  return null;
}
/* ---------- time zones ---------- */
const tzf={};
function tzOffsetMin(tz,utcMs){if(!tz)return 0;try{const f=tzf[tz]||(tzf[tz]=new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}));
  const p={};for(const x of f.formatToParts(new Date(utcMs)))p[x.type]=x.value;return (Date.UTC(+p.year,+p.month-1,+p.day,+p.hour%24,+p.minute)-utcMs)/60000;}catch(e){return 0;}}
function localToUtc(tz,y,mo,d,h,mi){const g=Date.UTC(y,mo-1,d,h,mi);const off=tzOffsetMin(tz,g);return g-off*60000;}
function hav(a,b){const R=6371,toR=Math.PI/180;const dl=(b.lat-a.lat)*toR,dn=(b.lon-a.lon)*toR;const x=Math.sin(dl/2)**2+Math.cos(a.lat*toR)*Math.cos(b.lat*toR)*Math.sin(dn/2)**2;return Math.round(2*R*Math.asin(Math.sqrt(x)));}

/* ---------- spreadsheet parsing ---------- */
// header synonyms per role. Exact matches first, then whole-word / substring matches; every column serves one role only.
// Covers 航旅纵横, the template, myFlightradar24, Flighty, OpenFlights and hand-made English sheets.
const COLS={date:['日期','出发日期','航班日期','乘机日期','date','flight date','departure date'],
  al:['航空公司','航司','airline','carrier','operator'],
  fn:['航班号','航班','flight','flight no','flight no.','flight number','flight #','flight_no','flightno','flight_number','flight code'],
  from:['出发','出发城市','出发机场','出发地','起飞机场','始发','始发地','from','origin','departure airport','departure','dep airport','from airport','dep'],
  to:['到达','到达城市','到达机场','目的地','到达地','降落机场','to','destination','arrival airport','arrival','arr airport','to airport','arr'],
  dt:['出发时间','起飞时间','计划起飞','dep time','dep_time','departure time','std','gate departure (scheduled)','gate departure','take off (scheduled)','scheduled departure'],
  at:['到达时间','降落时间','计划到达','arr time','arr_time','arrival time','sta','gate arrival (scheduled)','gate arrival','landing (scheduled)','scheduled arrival'],
  km:['里程数','里程','距离','公里','km','kilometers','kilometres','distance (km)','distance_km','distance km'],
  mi:['miles','mi','distance (mi)','distance (miles)','distance_mi','mileage (mi)'],
  dist:['distance'], // unit unknown (OpenFlights writes miles): checked against the great-circle distance per row
  st:['客票状态','状态','票状态','status','ticket status'],
  cx:['canceled','cancelled','is canceled','is cancelled','cancelled?']};
const ROLE_ORDER=['from','to','date','fn','dt','at','al','st','km','mi','dist','cx'];
const hnorm=h=>String(h||'').trim().toLowerCase().replace(/[_\s]+/g,' ');
function findCols(hdr){const map={},used=new Set(),H=hdr.map(hnorm);
  // 1. exact header text
  for(const k of ROLE_ORDER)for(const w of COLS[k].map(hnorm)){const i=H.findIndex((h,j)=>h===w&&!used.has(j));if(i>=0){map[k]=i;used.add(i);break;}} // synonyms in order of preference
  // 2. a synonym inside a longer header: whole words for Latin text ("dep" must not match "dependent", "sta" not "distance"), substring for Chinese
  const inside=(h,w)=>/[㐀-鿿]/.test(w)?h.includes(w):new RegExp('(^|[^a-z])'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'($|[^a-z])').test(h);
  for(const k of ROLE_ORDER){if(map[k]!=null)continue;for(const w of COLS[k].map(hnorm).filter(w=>w.length>1).sort((x,y)=>y.length-x.length)){const i=H.findIndex((h,j)=>h&&!used.has(j)&&inside(h,w));if(i>=0){map[k]=i;used.add(i);break;}}}
  return map;}
let DMY=false,DATE_AMBIG=false; // slash dates: day-first only when the data proves it (a first part > 12)
const MONTHS={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
const okYMD=(y,m,d)=>y>=1950&&y<=2100&&m>=1&&m<=12&&d>=1&&d<=31?[y,m,d]:null;
function parseDate(v){
  if(v==null||v==='')return null;
  if(v instanceof Date&&!isNaN(v))return [v.getFullYear(),v.getMonth()+1,v.getDate()];
  if(typeof v==='number'&&v>20000&&v<80000){const d=XLSX.SSF.parse_date_code(v);return [d.y,d.m,d.d];}
  const s=String(v);let m=s.match(/^\s*((?:19|20)\d{2})(\d{2})(\d{2})\s*$/);if(m)return okYMD(+m[1],+m[2],+m[3]); // 20240501
  m=s.match(/(\d{4})\s*[年\-\/.]\s*(\d{1,2})\s*[月\-\/.]\s*(\d{1,2})/);if(m)return okYMD(+m[1],+m[2],+m[3]);
  m=s.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);if(m)return DMY?okYMD(+m[3],+m[2],+m[1]):okYMD(+m[3],+m[1],+m[2]);
  m=s.match(/\b(\d{1,2})[\s\-\/.]*([A-Za-z]{3,9})\.?[\s\-\/.,]*(\d{4}|\d{2})\b/);if(m&&MONTHS[m[2].toLowerCase().slice(0,3)])return okYMD(m[3].length===2?2000+ +m[3]:+m[3],MONTHS[m[2].toLowerCase().slice(0,3)],+m[1]); // 1 May 2024, 01-May-24
  m=s.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);if(m&&MONTHS[m[1].toLowerCase().slice(0,3)])return okYMD(+m[3],MONTHS[m[1].toLowerCase().slice(0,3)],+m[2]); // May 1, 2024
  return null;}
// why a date did not parse — drives the guidance text
function dateProblem(v){const s=String(v==null?'':v).trim();if(!s)return'empty';if(/^\d{1,2}\s*月\s*\d{1,2}|^\d{1,2}[\/.-]\d{1,2}$/.test(s))return'no_year';if(/open/i.test(s))return'open';return'bad';}
function parseTime(v){if(v==null)return null;if(typeof v==='number'&&v<1){const m=Math.round(v*1440);return [Math.floor(m/60),m%60];}
  if(v instanceof Date&&!isNaN(v))return v.getHours()||v.getMinutes()?[v.getHours(),v.getMinutes()]:null;
  const m=String(v).match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp])?\.?\s*[Mm]?\.?/);if(!m)return null;let h=+m[1];const ap=(m[3]||'').toLowerCase(); // 8:30 PM, 20:30, 2024-01-05T11:05
  if(ap==='p'&&h<12)h+=12;else if(ap==='a'&&h===12)h=0;return h<24&&+m[2]<60?[h,+m[2]]:null;}
const colName=i=>{let s='';for(i++;i>0;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s;};
const cellText=v=>v instanceof Date&&!isNaN(v)?`${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`:String(v==null?'':v).replace(/\s+/g,' ').trim();
let SHEETS=[]; // raw sheets of the last upload, kept for AI column mapping
function readSheet(aoa,sn,hi,map){
  const rows=[],cols={};for(const k in map)if(map[k]!=null)cols[k]=colName(map[k]);
  const sheetUp=/待出行|未出行|upcoming/i.test(sn),sheetVoid=/无效|退票|作废|void|refund|cancel/i.test(sn);
  for(let i=hi+1;i<aoa.length;i++){const r=aoa[i]||[];const g=k=>map[k]!=null?r[map[k]]:'';
    if(!String(g('from')).trim()&&!String(g('to')).trim())continue;
    const al=String(g('al')||'').trim();let fn=String(g('fn')||'').trim(),st=String(g('st')||'').trim();
    if(/^\d{1,4}[A-Z]?$/.test(fn)&&/^[A-Z0-9]{2,3}$/.test(al))fn=al+fn; // Flighty: airline UAL + flight 857
    if(map.cx!=null&&/^(true|yes|y|1|x|是|已取消|canceled|cancelled)$/i.test(String(g('cx')).trim()))st=st?st+' cancelled':'cancelled';
    let dt=g('dt');if(map.dt==null&&typeof g('date')==='string'&&/\d{1,2}:\d{2}/.test(g('date')))dt=g('date'); // OpenFlights: "2019-06-01 08:00:00"
    const km=map.km!=null?g('km'):map.mi!=null&&parseFloat(String(g('mi')).replace(/[^\d.]/g,''))>0?String(parseFloat(String(g('mi')).replace(/[^\d.]/g,''))*1.609344):'';
    rows.push({rawDate:g('date'),al,fn,from:String(g('from')).trim(),to:String(g('to')).trim(),dt,at:g('at'),km,dist:map.dist!=null?g('dist'):'',
      st,sheetUp,sheetVoid,src:{sheet:sn,row:i+1,cols}});}
  return rows;}
function readWorkbook(wb){
  const rows=[];SHEETS=[];
  for(const sn of wb.SheetNames){
    const aoa=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,raw:true,defval:''});if(!aoa.length)continue;SHEETS.push({name:sn,aoa});
    let hi=-1,map=null;for(let i=0;i<Math.min(8,aoa.length);i++){const m=findCols(aoa[i]);if(m.from!=null&&m.to!=null){hi=i;map=m;break;}}
    if(hi<0)continue;rows.push(...readSheet(aoa,sn,hi,map));
  }
  detectDateOrder(rows);return rows;}
function detectDateOrder(rows){let a=0,b=0,n=0;for(const r of rows){const m=String(r.rawDate).match(/^\s*(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);if(m){n++;if(+m[1]>12)a++;if(+m[2]>12)b++;}}
  DMY=a>0&&b===0;DATE_AMBIG=n>0&&!a&&!b;}

/* ---------- normalise rows -> flights ---------- */
let RAW=[],SOURCE='demo',RESET_YEARS=true;
// fixes the user accepted (by hand or from the AI check): status text → flown/upcoming/void; rows dropped or confirmed as flights
let STFIX={},EXCL=new Set(),KEEP=new Set();
const ST_VOID=/作废|退票|换开|已退|取消|void|refund|cancel|no.?show/i,ST_UP=/未使用|待出行|未出行|待使用|已出票|upcoming|unused|booked/i,ST_DONE=/已使用|已完成|已乘|已出行|已结束|已飞|已登机|used|flown|complete|boarded/i;
const TRAIN=/^[GDCKTZSYL]\d{1,4}$/i,STATION=/站$|站[\s(（]|railway|station|高铁|动车|火车|铁路/i;
const rkey=r=>r.src?r.src.sheet+'#'+r.src.row:'';
function rowStatus(r){if(r.st===undefined)return r.vd?'void':r.up?'upcoming':'flown';const s=r.st;if(STFIX[s])return STFIX[s];
  if(r.sheetVoid||ST_VOID.test(s))return'void';if(r.sheetUp||ST_UP.test(s))return'upcoming';return'flown';}
function buildFlights(){
  const out=[],unres=new Map(),seen=new Set();let skipped=0;
  const diag={refs:new Map(),noDate:[],sameAp:[],missingAp:[],dup:0,unknownSt:new Map(),suspect:[],excluded:0};
  const today=new Date();const tY=today.getFullYear(),tM=today.getMonth()+1,tD=today.getDate();
  RAW.forEach((r,ri)=>{
    const k=rkey(r);if(k&&EXCL.has(k)){diag.excluded++;return;}
    const s=r.st;if(s&&!STFIX[s]&&!ST_VOID.test(s)&&!ST_UP.test(s)&&!ST_DONE.test(s)){if(!diag.unknownSt.has(s))diag.unknownSt.set(s,[]);diag.unknownSt.get(s).push(r);}
    if(k&&!KEEP.has(k)&&(TRAIN.test(r.fn||'')||STATION.test(r.from)||STATION.test(r.to)||/铁路|rail/i.test(r.al||'')))diag.suspect.push(r);
    const d=parseDate(r.rawDate);if(!d){skipped++;diag.noDate.push(r);return;}
    if(!r.from||!r.to){diag.missingAp.push(r);return;}
    const fa=resolveAirport(r.from),ta=resolveAirport(r.to);
    const note=(name,role,other)=>{unres.set(name,(unres.get(name)||0)+1);let e=diag.refs.get(name);if(!e)diag.refs.set(name,e={roles:new Set(),rows:[]});e.roles.add(role);if(e.rows.length<6)e.rows.push({r,other,d});};
    if(!fa)note(r.from,'from',r.to);if(!ta)note(r.to,'to',r.from);
    if(!fa||!ta)return;if(fa===ta){diag.sameAp.push(r);return;}
    const A=AP[fa],B=AP[ta];
    const gc=hav(A,B);let km=parseFloat(String(r.km).replace(/[^\d.]/g,''));
    if(!(km>0)&&r.dist){const v=parseFloat(String(r.dist).replace(/[^\d.]/g,'')),q=v/gc;if(q>0.55&&q<0.72)km=v*1.609344;else if(q>0.85&&q<1.3)km=v;} // a bare "distance" column: miles or km, whichever fits the route
    if(!(km>0)||km>gc*2.5+300)km=gc; // missing, or not a distance for this route
    const tm=parseTime(r.dt)||[12,0];const est=km/780*60+35;
    let min=Math.round(est);const at=parseTime(r.at);
    if(parseTime(r.dt)&&at){const dep=localToUtc(A.tz,d[0],d[1],d[2],tm[0],tm[1]);const arr0=localToUtc(B.tz,d[0],d[1],d[2],at[0],at[1]);
      const c=[-1,0,1,2].map(k=>Math.round((arr0+k*864e5-dep)/60000)).filter(x=>x>0);if(c.length)min=c.reduce((p,q)=>Math.abs(q-est)<Math.abs(p-est)?q:p);}
    const future=(d[0]*10000+d[1]*100+d[2])>(tY*10000+tM*100+tD),st=rowStatus(r);
    const f={y:d[0],date:ymd(d),t:`${String(tm[0]).padStart(2,'0')}:${String(tm[1]).padStart(2,'0')}`,
      fn:(r.fn||'').toUpperCase().replace(/\s+/g,'')||'—',al:r.al||'',f:fa,to:ta,fc:A.iso,tc:B.iso,km:Math.round(km),min,hasT:!!parseTime(r.dt),vd:st==='void'?1:0,up:st!=='void'&&(st==='upcoming'||future)?1:0};
    const key=[f.date,f.fn,f.f,f.to,f.vd?ri:''].join('|');if(!f.vd&&seen.has(key)){diag.dup++;return;}seen.add(key);out.push(f);
  });
  out.sort((a,b)=>(a.date+a.t).localeCompare(b.date+b.t));
  return {all:out,unres,skipped,diag};}
const ymd=d=>`${d[0]}-${String(d[1]).padStart(2,'0')}-${String(d[2]).padStart(2,'0')}`;

/* ---------- demo traveller (fictional) ---------- */
function demoRows(){
  const R=[['SHA','CTU'],['CTU','SHA'],['PVG','NRT'],['NRT','PVG'],['SHA','PEK'],['PEK','SHA'],['PVG','BKK'],['BKK','CNX'],['CNX','BKK'],['BKK','PVG'],['SHA','SZX'],['SZX','SHA'],
    ['PVG','SIN'],['SIN','DPS'],['DPS','SIN'],['SIN','PVG'],['PVG','ICN'],['ICN','PVG'],['SHA','XMN'],['XMN','SHA'],['PVG','LAX'],['LAX','SFO'],['SFO','PVG'],['SHA','KMG'],['KMG','LJG'],['LJG','SHA'],
    ['PVG','HKG'],['HKG','PVG'],['PVG','CDG'],['CDG','FCO'],['FCO','PVG'],['SHA','CAN'],['CAN','SHA'],['PVG','KIX'],['KIX','PVG'],['PVG','SGN'],['SGN','HAN'],['HAN','PVG'],['SHA','XIY'],['XIY','SHA'],
    ['PVG','CTS'],['CTS','PVG'],['PVG','SYD'],['SYD','MEL'],['MEL','PVG'],['SHA','TAO'],['TAO','SHA'],['PVG','DXB'],['DXB','PVG'],['SHA','HAK'],['HAK','SHA']];
  const rows=[];let y=2018,m=3;
  R.forEach((p,i)=>{m+= (i%2?0:2)+ (i%5===0?1:0);while(m>12){m-=12;y++;}const intl=!AP[p[0]]||!AP[p[1]]||AP[p[0]].iso!=='CN'||AP[p[1]].iso!=='CN'; // international legs carry 3-digit numbers, like real ones
    rows.push({rawDate:`${y}-${m}-${4+(i%4)*6}`, /* a return never dated before its outbound */al:'',fn:['MU','CA','CZ','FM','HO'][i%5]+(intl?101+(i*137)%880:5000+i*37),from:p[0],to:p[1],dt:'',at:'',km:'',up:y>=2027,vd:0});});
  return rows;}
function rngF(seed){let a=seed>>>0;return ()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
