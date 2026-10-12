"use strict";
/* ================= UI wiring ================= */
const today=new Date();const MON=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const ISSUE=`${String(today.getDate()).padStart(2,'0')} ${MON[today.getMonth()]} ${today.getFullYear()}`;
const ISSUE6=`${String(today.getFullYear()).slice(2)}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
let PHOTO=null,playing=false,playT=0,lastTs=0,audioCtx=null,audioSrc=null,AUDIO=null,AUDIO_KEY='',dirty=true,exporting=false,cancelExport=false;
function setStatus(m,err){const s=$('status');s.textContent=m;s.classList.toggle('err',!!err);}
function invalidate(){dirty=true;if(!playing&&S&&S.ok)drawAt(playT);}
function drawAt(t){if(!S)return;renderFrame(Math.min(S.frames-1,Math.max(0,Math.floor(t*FPS))));const T=S.ok?S.T_END:0;$('time').textContent=`${mmss(t)} / ${mmss(T)}`;$('scrub').value=T?Math.round(t/T*1000):0;}
const mmss=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
let rebuildTimer=null;
function rebuild(){clearTimeout(rebuildTimer);rebuildTimer=setTimeout(()=>{stopPlay();buildScene();renderSummary();$('result').hidden=true;$('saveBar').hidden=true;$('imgOut').hidden=true;drawAt(S.ok?Math.min(playT,S.T_END):0);if(S.ok&&playT===0)drawAt(S.T_END*0.62);
    ensureFonts().then(()=>{if(!playing&&!exporting)invalidate();});scheduleAudio();},120);}
// every glyph the canvas draws must be loaded before frame 0, or the font swaps mid-video
let CJK_ALL=null; // collected once from our own scripts (fetch hits the HTTP cache)
async function cjkGlyphs(){if(CJK_ALL!==null)return CJK_ALL;let t='';try{t=(await Promise.all([...document.querySelectorAll('script[src^="js/"]')].map(e=>fetch(e.src).then(r=>r.text())))).join('');}catch(e){}
  return CJK_ALL=[...new Set(t.match(/[\u2E80-\u9FFF\uFF00-\uFFEF]/g)||[])].join('');}
/* the font stylesheet loads without blocking the page: wait until its rules exist before asking for glyphs */
const FONT_CSS=new Promise(res=>{const l=document.getElementById('fontcss'),t0=Date.now(),chk=()=>{let ok=!l;try{ok=ok||!!(l.rel==='stylesheet'&&l.sheet);}catch(e){ok=true;}if(ok||Date.now()-t0>12000)res();else setTimeout(chk,30);};chk();});
async function ensureFonts(){await FONT_CSS;const P=S&&S.P;const txt=(await cjkGlyphs())+(P?[P.disp,P.tagZh,P.tagEn,P.latin].join(''):'');
  try{await Promise.all(['400 30px "Open Sans"','600 30px "Open Sans"','700 30px "Open Sans"','400 30px "Space Mono"','700 30px "Space Mono"','400 30px "Noto Sans SC"','700 30px "Noto Sans SC"','900 30px "Noto Serif SC"'].map(f=>document.fonts.load(f,txt)));}catch(e){}}
document.fonts&&document.fonts.addEventListener&&document.fonts.addEventListener('loadingdone',()=>{coverBuilt=false;photoBuilt=false;if(S&&S.ok){S.stampReady=false;buildBg();}if(!playing&&!exporting)invalidate();});
function renderSummary(){
  const r=S.res,c=$('chips');c.innerHTML='';const add=(txt,cls)=>{const s=document.createElement('span');s.className='chip '+(cls||'');s.textContent=txt;c.appendChild(s);};
  if(SOURCE==='demo')add(L('示例数据 · 虚构旅客','Sample · fictional traveller'),'demo');
  const all=r.all;add(L(`${all.length} 段航班`,`${all.length} flights`));if(all.length)add(`${all[0].y} – ${all[all.length-1].y}`);
  const nu=all.filter(f=>f.up).length,nv=all.filter(f=>f.vd).length;if(nu)add(L(`待出行 ${nu}`,`${nu} upcoming`));if(nv)add(L(`退票/作废 ${nv}`,`${nv} cancelled / void`));
  if(S.ok)add(L(`动画 ${S.flights.length} 段 · ${mmss(S.T_END)}`,`film: ${S.flights.length} flights · ${mmss(S.T_END)}`),'ok');if(r.unres.size)add(L(`未识别地名 ${r.unres.size}`,`${r.unres.size} unknown places`),'warn');if(r.skipped)add(L(`无日期已跳过 ${r.skipped}`,`${r.skipped} without a date, skipped`),'warn');
  $('optVoid').parentElement.hidden=!nv;$('optUp').parentElement.hidden=!nu;
  // years
  const ys=[...new Set(all.map(f=>f.y))].sort();const keepF=RESET_YEARS?'':$('yFrom').value,keepT=RESET_YEARS?'':$('yTo').value;const wasReset=RESET_YEARS;RESET_YEARS=false;
  for(const [id,keep,def] of [['yFrom',keepF,ys[0]],['yTo',keepT,ys[ys.length-1]]]){const sel=$(id);sel.innerHTML='';ys.forEach(y=>{const o=document.createElement('option');o.value=y;o.textContent=y;sel.appendChild(o);});sel.value=ys.includes(+keep)?keep:def;}
  if(wasReset&&S.ok===false&&ys.length){rebuild();}
  renderYearQuick(ys);if(typeof renderBadges==='function'){renderBadges();if($('posterOpts').open)renderPosterChecks();}
  renderCheck();heroStats();
}
/* ================= table check: code finds the problems, Jev makes the judgment calls ================= */
const AI_HIGH=0.85,AI_MID=0.5; // ≥ HIGH: offered for one-click apply; MID–HIGH: shown as the leaning; below: alternatives only
let AIR={ap:{},st:{},row:{},cols:null,model:''},AI_BUSY=false,AI_OFF=false; // AI_OFF: the server has no AI (e.g. the mainland deployment) // answers keyed by content, so they survive rebuilds
const top1=a=>a&&a.top&&a.top[0]?a.top[0][1]:0,pct=p=>Math.round(p*100)+'%';
function resetFixes(){STFIX={};EXCL=new Set();KEEP=new Set();AIR={ap:{},st:{},row:{},cols:null,model:''};}
// candidate airports for a name the dictionary missed: n-gram overlap against Chinese keywords, city and airport names
let APIDX=null;
function grams(s){const t=s.replace(/\s+/g,' '),g=new Set();if(/[㐀-鿿]/.test(t)){const c=[...t.replace(/\s/g,'')];c.forEach((x,i)=>{g.add(x);if(i)g.add(c[i-1]+x);});}else{const p=' '+t+' ';for(let i=0;i+3<=p.length;i++)g.add(p.slice(i,i+3));}return g;}
function apIndex(){if(APIDX)return APIDX;const zh={},items=[];
  for(const k of ZHKEYS){const c=ZH[k];if(!AP[c])continue;if(!zh[c]||k.length>zh[c].length)zh[c]=k;items.push({c,t:k,g:grams(k),ini:''});}
  for(const c in AP){const a=AP[c];[a.city,a.name].forEach((t,k)=>{const n=apNorm(t||''),w=n.split(' ');if(n)items.push({c,t:n,g:grams(n),ini:!k&&w.length>1?w.map(x=>x[0]).join(''):''});});} // initials only for multi-word city names
  return APIDX={zh,items};}
function apCandidates(text,max=12){const q=apNorm(text);if(!q)return[];const qg=grams(q),best={},short=/^[a-z]{2,3}$/.test(q);
  for(const it of apIndex().items){let inter=0;for(const x of qg)if(it.g.has(x))inter++;let s=inter?2*inter/(qg.size+it.g.size):0;
    if(it.t===q)s+=1;else if(q.length>=2&&it.t.length>=2&&(it.t.includes(q)||q.includes(it.t)))s+=0.35;
    if(short&&it.ini===q)s+=1.6; // LA → Los Angeles, HK → Hong Kong
    if(s>0.15&&(!best[it.c]||s>best[it.c]))best[it.c]=s;}
  return Object.entries(best).sort((a,b)=>b[1]-a[1]).slice(0,max).map(e=>e[0]);}
function apDesc(c){const a=AP[c],zh=apIndex().zh[c],cn=NAMES[a.iso]?NAMES[a.iso][0]:a.iso;return `${a.name}${zh?' · '+zh:''} · ${a.city}, ${cn} (${c})`;}
const apShort=c=>`${apIndex().zh[c]||AP[c].city} ${c}`;
const fillCount=s=>s.aoa.slice(0,60).reduce((n,r)=>n+(r||[]).filter(v=>cellText(v)!=='').length,0);
const needColumns=()=>SOURCE==='file'&&SHEETS.length>0&&(!RAW.length||RAW.every(r=>cellText(r.rawDate)===''));
const colIndex=s=>[...s].reduce((n,ch)=>n*26+ch.charCodeAt(0)-64,0)-1;
function columnsPayload(){const sh=RAW.length&&RAW[0].src?SHEETS.find(s=>s.name===RAW[0].src.sheet):SHEETS.slice().sort((a,b)=>fillCount(b)-fillCount(a))[0];if(!sh)return null;
  const A=sh.aoa,nc=Math.min(30,Math.max(0,...A.slice(0,40).map(r=>(r||[]).length))),columns=[];
  for(let c=0;c<nc;c++){const v=A.slice(0,12).map(r=>cellText((r||[])[c])).filter(Boolean).slice(0,8);if(v.length)columns.push({col:colName(c),values:v});}
  return {sheet:sh.name,rows:A.slice(0,8).map(r=>(r||[]).slice(0,nc).map(cellText)),columns};}
// only what needs a judgment leaves the browser: unknown names with their row hints, unknown statuses, suspicious rows, and (if needed) the first rows
function aiPayload(){const d=S.res.diag,p={airports:[],statuses:[],rows:[]},idx={a:{},s:{},r:{}};
  [...d.refs.entries()].filter(([n])=>!manual[n]&&!AIR.ap[n]).slice(0,40).forEach(([name,e],k)=>{const cand=apCandidates(name);if(!cand.length){AIR.ap[name]={nocand:true};return;}
    idx.a['a'+k]=name;p.airports.push({id:'a'+k,text:name,role:e.roles.size>1?'both':[...e.roles][0],context:e.rows.slice(0,3).map(x=>({fn:x.r.fn,date:ymd(x.d),other:x.other})),candidates:cand.map(code=>({code,desc:apDesc(code)}))});});
  [...d.unknownSt.keys()].filter(s=>!AIR.st[s]).slice(0,20).forEach((s,k)=>{idx.s['s'+k]=s;p.statuses.push({id:'s'+k,text:s});});
  d.suspect.filter(r=>!AIR.row[rkey(r)]).slice(0,20).forEach((r,k)=>{idx.r['r'+k]=rkey(r);const dd=parseDate(r.rawDate);p.rows.push({id:'r'+k,fn:r.fn,from:r.from,to:r.to,date:dd?ymd(dd):cellText(r.rawDate),al:r.al});});
  if(needColumns()&&!AIR.cols){const c=columnsPayload();if(c){p.columns=c;idx.colSheet=c.sheet;}}
  return {p,idx};}
function aiPending(){if(!S||!S.res)return 0;const d=S.res.diag;return [...d.refs.keys()].filter(n=>!manual[n]&&!AIR.ap[n]).length+[...d.unknownSt.keys()].filter(s=>!AIR.st[s]).length+d.suspect.filter(r=>!AIR.row[rkey(r)]).length+(needColumns()&&!AIR.cols?1:0);}
let AI_PROBED=false; // one probe per page: does this server offer the AI check?
function aiMsg(m,err){const s=$('aiStatus');s.textContent=m;s.classList.toggle('err',!!err);}
async function runAI(){if(AI_BUSY||!S)return;const {p,idx}=aiPayload();
  if(!p.airports.length&&!p.statuses.length&&!p.rows.length&&!p.columns){aiMsg(L('没有需要 AI 判断的内容。','Nothing needs an AI judgment.'));renderCheck();return;}
  AI_BUSY=true;$('btnAI').disabled=true;aiMsg(L('正在请 Jev 判断…','Asking Jev…'));
  try{const r=await fetch('/api/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});
    if(!r.ok){const j=await r.json().catch(()=>({}));if(j.error==='disabled'||j.status===451){AI_OFF=true;aiMsg(L('当前站点没有 AI 检查（服务商不支持该地区）。下面已给出本地建议，也可以手动填写。','The AI check is not available on this site. Local suggestions are shown below, or fill the codes in by hand.'));return;}throw new Error(r.status===404||r.status===405?L('当前环境没有 AI 服务，请在线上网站使用','no AI service here — use the live site'):r.status===429?L('请求太频繁，请稍等几分钟再试','too many requests, try again in a few minutes'):j.error==='not_configured'?L('服务器还没配置 API key','the server has no API key yet'):L('AI 服务暂时不可用（','AI service unavailable (')+r.status+L('）',')'));}
    const j=await r.json(),A=j.answers||{};AIR.model=j.model||'';
    for(const [id,name] of Object.entries(idx.a))if(A['ap_'+id])AIR.ap[name]=A['ap_'+id];
    for(const [id,s] of Object.entries(idx.s))if(A['st_'+id])AIR.st[s]=A['st_'+id];
    for(const [id,k] of Object.entries(idx.r))if(A['row_'+id])AIR.row[k]=A['row_'+id];
    if(idx.colSheet&&A.header_row){AIR.cols={sheet:idx.colSheet,header:A.header_row,roles:{}};for(const k of ['date','from','to','fn','al','dt','at','st','km'])if(A['col_'+k])AIR.cols.roles[k]=A['col_'+k];}
    for(const [k,a] of Object.entries(AIR.row))if(a.choice==='flight'&&top1(a)>=AI_HIGH)KEEP.add(k); // confirmed flights stop being flagged
    aiMsg(L(`Jev 已给出建议（${AIR.model}）。高把握的可以一键采用，其余请逐条确认。`,`Jev has answered (${AIR.model}). Confident fixes can be applied in one click; please confirm the rest one by one.`));
  }catch(e){aiMsg(L('AI 检查失败：','AI check failed: ')+(e.message||e),true);}
  finally{AI_BUSY=false;rebuild();}}
// one column per role, assigned in order of importance (an airline guess must not take the flight-number column)
function colsMap(c){const map={},used=new Set();for(const k of ['date','from','to','fn','dt','at','st','km','al']){const a=c.roles[k];if(a&&a.choice!=='none'&&top1(a)>=AI_MID&&!used.has(a.choice)){map[k]=a.choice;used.add(a.choice);}}return map;}
function applyCols(){const c=AIR.cols;if(!c)return;const sh=SHEETS.find(s=>s.name===c.sheet);if(!sh)return;const map={};
  for(const [k,v] of Object.entries(colsMap(c)))map[k]=colIndex(v);
  if(map.from==null||map.to==null){aiMsg(L('Jev 没能确定「出发」「到达」是哪一列，请按模板改表头后重新上传。','Jev could not tell which columns are “from” and “to”. Rename the headers like the template and upload again.'),true);return;}
  const hi=c.header.choice!=='none'?+c.header.choice.slice(1)-1:-1;
  RAW=RAW.filter(r=>!r.src||r.src.sheet!==sh.name).concat(readSheet(sh.aoa,sh.name,hi,map));detectDateOrder(RAW);c.applied=true;
  RESET_YEARS=true;$('yFrom').innerHTML='';$('yTo').innerHTML='';aiMsg(L(`已按 Jev 认出的结构重新读取「${sh.name}」。`,`Re-read “${sh.name}” with the structure Jev found.`));rebuild();}
function highFixes(){if(!S||!S.res)return [];const d=S.res.diag,out=[];
  for(const name of d.refs.keys()){const a=AIR.ap[name];if(a&&a.choice&&a.choice!=='none'&&AP[a.choice]&&top1(a)>=AI_HIGH&&!manual[name])out.push(()=>{manual[name]=a.choice;});}
  for(const s of d.unknownSt.keys()){const a=AIR.st[s];if(a&&a.choice&&a.choice!=='unclear'&&top1(a)>=AI_HIGH)out.push(()=>{STFIX[s]=a.choice;});}
  for(const r of d.suspect){const k=rkey(r),a=AIR.row[k];if(a&&a.choice!=='flight'&&top1(a)>=AI_HIGH)out.push(()=>{EXCL.add(k);});}
  if(AIR.cols&&!AIR.cols.applied&&needColumns())out.push(applyCols);
  return out;}
function applyAll(){const f=highFixes();f.forEach(fn=>fn());aiMsg(f.length?L(`已采用 ${f.length} 条高把握建议。`,`Applied ${f.length} confident fixes.`):L('没有可以一键采用的建议，请逐条确认。','No fix is confident enough for one click; please confirm them one by one.'));rebuild();}
function fixedCsv(){const q=v=>{const s=String(v==null?'':v);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;},tt=v=>{const t=parseTime(v);return t?`${String(t[0]).padStart(2,'0')}:${String(t[1]).padStart(2,'0')}`:cellText(v);};
  const out=[L('日期,航班号,航空公司,出发,到达,出发时间,到达时间,里程数,状态','Date,Flight,Airline,From,To,Departure time,Arrival time,Distance km,Status')];
  for(const r of RAW){const k=rkey(r);if(k&&EXCL.has(k))continue;const d=parseDate(r.rawDate);
    out.push([d?ymd(d):cellText(r.rawDate),r.fn,r.al,resolveAirport(r.from)||r.from,resolveAirport(r.to)||r.to,tt(r.dt),tt(r.at),cellText(r.km),(EN()?{flown:'flown',upcoming:'upcoming',void:'cancelled'}:{flown:'已使用',upcoming:'未使用',void:'已退票'})[rowStatus(r)]].map(q).join(','));}
  return '﻿'+out.join('\n');}
function el(t,a,...kids){const e=document.createElement(t);for(const k in a||{}){const v=a[k];if(k==='on')for(const ev in v)e.addEventListener(ev,v[ev]);else if(k==='cls')e.className=v;else if(k in e)e[k]=v;else e.setAttribute(k,v);}
  for(const c of kids.flat())if(c!=null&&c!==false)e.append(c.nodeType?c:String(c));return e;}
const where=(rows,role)=>{const by={};for(const r of rows){if(!r.src)continue;(by[r.src.sheet]=by[r.src.sheet]||[]).push(r.src.row);}
  return Object.entries(by).map(([s,l])=>{const u=[...new Set(l)];return EN()?`${SHEETS.length>1?`“${s}” `:''}row ${u.slice(0,6).join(', ')}${u.length>6?' …':''}`:`${SHEETS.length>1?`「${s}」`:''}第 ${u.slice(0,6).join('、')}${u.length>6?' 等':''} 行`;}).join(L('；','; '))+(role&&rows[0]&&rows[0].src&&rows[0].src.cols[role]?L(` · ${rows[0].src.cols[role]} 列`,` · column ${rows[0].src.cols[role]}`):'');};
// the check panel's headline when nothing can be animated although no row is broken: say which filter emptied the film
function filteredOutMsg(){const a=S&&S.res?S.res.all:[];if(!a.length)return L('⛔ 还没有可用的航段：看下面的提示，或者手动添加航班。','⛔ No usable flights yet: see the notes below, or add flights by hand.');
  const v=a.filter(f=>f.vd).length,u=a.filter(f=>f.up&&!f.vd).length;
  if(v===a.length)return L(`⛔ ${v} 段都是退票 / 作废：在上面「更多」里勾选「计入退票 / 作废」才能放进动画。`,`⛔ All ${v} flights are cancelled or void: tick “Include cancelled / void tickets” under “More” above to use them.`);
  if(v+u===a.length)return L('⛔ 剩下的都是待出行航班：在上面「更多」里勾选「计入待出行航班」。','⛔ Only upcoming flights are left: tick “Include upcoming flights” under “More” above.');
  return L('⛔ 选中的年份里没有航班：换一个年份范围。','⛔ No flights in the chosen years: pick another range.');}
function renderCheck(){
  const sec=$('stepCheck'),box=$('issues'),head=$('checkHead');box.innerHTML='';
  if(SOURCE!=='file'){sec.hidden=true;return;}sec.hidden=false;
  const d=S.res.diag,ok=S.ok;let bad=0,warn=0;
  const issue=(sev,title,guide,items)=>{if(sev==='bad')bad++;else if(sev==='warn')warn++;
    box.append(el('div',{cls:'issue'},el('h3',{},el('span',{cls:'sev '+sev},(EN()?{bad:'must fix',warn:'worth fixing',info:'note'}:{bad:'必须修改',warn:'建议修改',info:'提示'})[sev]),title),guide?el('p',{},guide):null,items||[]));};
  const btn=(txt,fn,on)=>el('button',{type:'button',cls:'sm'+(on?' on':''),on:{click:fn}},txt);
  const lean=(a,label,extra)=>{if(!a)return null;const p=top1(a);return el('div',{cls:'sug'},p>=AI_HIGH?L('✨ Jev：','✨ Jev: '):p>=AI_MID?L('Jev 倾向（请确认）：','Jev leans to (please confirm): '):L('Jev 把握不大，最像：','Jev is unsure; closest: '),el('b',{},label(a.choice)),` · ${pct(p)}`,extra||'');};
  // 1. table structure
  if(needColumns()){const c=AIR.cols,items=[];
    if(c){const R=EN()?{date:'date',fn:'flight',from:'from',to:'to',al:'airline',dt:'departure time',at:'arrival time',st:'status',km:'distance'}:{date:'日期',fn:'航班号',from:'出发',to:'到达',al:'航司',dt:'出发时间',at:'到达时间',st:'状态',km:'里程'};
      const parts=Object.entries(colsMap(c)).map(([k,v])=>L(`${R[k]}=${v} 列`,`${R[k]} = column ${v}`));
      items.push(el('div',{cls:'item'},el('div',{cls:'sug'},L('✨ Jev 认出的结构：','✨ Structure found by Jev: '),el('b',{},EN()?`${c.header.choice==='none'?'no header row':'header on row '+c.header.choice.slice(1)}; ${parts.join(', ')||'no columns recognised'}`:`${c.header.choice==='none'?'没有标题行':'标题在第 '+c.header.choice.slice(1)+' 行'}；${parts.join('，')||'没认出列'}`)),
        el('div',{cls:'acts'},btn(L('按这个结构读取','Read it this way'),applyCols))));}
    issue('bad',RAW.length?L('没找到「日期」这一列','No “date” column found'):L('没认出表格结构','Table structure not recognised'),
      (RAW.length?L('每一行都没有日期，动画里一段也排不出来。','No row has a date, so nothing can be placed in the film. '):L('表头里没找到「出发」「到达」「日期」这些列。','The header has no “from”, “to” or “date” columns. '))+L('修改方法：把表头改成 日期、航班号、出发、到达（可以下载 CSV 模板对照），或点「AI 检查」让 Jev 认出每一列。','To fix: rename the headers to Date, Flight, From, To (see the CSV template), or tap “AI check” and let Jev read the columns.'),items);}
  // 2. airport names the dictionary does not know
  if(d.refs.size){const items=[];let lost=0;
    [...d.refs.entries()].sort((a,b)=>b[1].rows.length-a[1].rows.length).forEach(([name,e],i)=>{lost+=S.res.unres.get(name)||0;const a=AIR.ap[name];
      const inp=el('input',{type:'text',cls:'code',id:'un'+i,maxLength:3,placeholder:'IATA',value:manual[name]||''}),st=el('span',{cls:'st'},L('未识别','unknown'));
      inp.addEventListener('input',()=>{const v=inp.value.toUpperCase().trim();if(AP[v]){st.textContent=AP[v].city||v;st.classList.add('ok');}else{st.textContent=v.length===3?L('没有这个代码','no such code'):L('未识别','unknown');st.classList.remove('ok');}});
      inp.addEventListener('change',()=>{const v=inp.value.toUpperCase().trim();if(AP[v]){manual[name]=v;rebuild();}});
      const picks=a&&a.top?a.top.filter(([c,p])=>c!=='none'&&AP[c]&&p>=0.08).map(([c,p])=>btn(`${apShort(c)} · ${pct(p)}`,()=>{manual[name]=c;rebuild();})):[];
      let sug=null;
      if(a&&a.nocand)sug=el('div',{cls:'sug'},L('词典里没有相近的机场名：请在表格里改成机场三字码，或在右边直接填写。','No close airport name in the dictionary: put the airport code in the sheet, or type it on the right.'));
      else if(a&&a.choice==='none')sug=el('div',{cls:'sug'},L(`Jev 判断这不像一个能确定的机场（${pct(top1(a))}）。请在表格里改正，或者删掉这一行。`,`Jev thinks this is not a definite airport (${pct(top1(a))}). Correct it in the sheet, or remove the row.`));
      else if(a)sug=lean(a,c=>apShort(c)+' · '+AP[c].name);
      else{const loc=apCandidates(name,3);if(loc.length){sug=el('div',{cls:'sug'},L('可能是（本地匹配）：','Could be (local match): '));picks.push(...loc.map(c=>btn(apShort(c),()=>{manual[name]=c;rebuild();})));}}
      items.push(el('div',{cls:'item'},el('div',{},el('label',{htmlFor:'un'+i},L(`「${name}」`,`“${name}”`)),el('span',{cls:'where'},'  '+where(e.rows.map(x=>x.r),e.roles.has('from')?'from':'to'))),
        sug,el('div',{cls:'acts'},inp,st,a&&a.choice&&a.choice!=='none'&&top1(a)>=AI_MID&&AP[a.choice]?btn(L('采用 ','Use ')+a.choice,()=>{manual[name]=a.choice;rebuild();}):null,...picks.slice(top1(a)>=AI_MID?1:0,4))));});
    issue('bad',L(`${d.refs.size} 个地名没认出来，${lost} 处航班会缺失`,`${d.refs.size} place names not recognised — ${lost} flights would be missing`),L('在右边填机场三字码（例如曼谷素万那普 BKK），或点「AI 检查」让 Jev 给建议。想一劳永逸：把表格里这些单元格改成三字码，或下载修正后的表格。','Type the airport code on the right (e.g. BKK for Bangkok Suvarnabhumi), or tap “AI check” for suggestions. For good: put codes in those cells, or download the corrected sheet.'),items);}
  // 3. dates
  if(d.noDate.length&&!needColumns()){const why=EN()?{empty:'no date (usually a refund or an open ticket)',no_year:'no year, e.g. “May 1”',open:'open ticket without a date',bad:'format not recognised'}:{empty:'没有日期（多半是退票或 OPEN 票）',no_year:'缺少年份，例如「5月1日」',open:'OPEN 票没有日期',bad:'格式认不出'},by={};
    d.noDate.forEach(r=>{const k=dateProblem(r.rawDate);(by[k]=by[k]||[]).push(r);});
    issue('warn',L(`${d.noDate.length} 行日期读不出来，已跳过`,`${d.noDate.length} rows without a readable date, skipped`),L('要放进动画，就把日期改成 2024-05-01 这种格式；退票、OPEN 票不需要的话可以不管。也可以在下面「逐条查看」里直接补日期。','To include them, write dates like 2024-05-01, or add a date in “All rows” below. Refunds and open tickets can be ignored.'),
      Object.entries(by).map(([k,rows])=>el('div',{cls:'item'},el('div',{},why[k],el('span',{cls:'where'},'  '+where(rows,'date'))),
        el('div',{cls:'sug'},rows.slice(0,3).map(r=>L(`「${cellText(r.rawDate)||'空'}」${r.fn||''} ${r.from}→${r.to}`,`“${cellText(r.rawDate)||'empty'}” ${r.fn||''} ${r.from}→${r.to}`)).join(L('；','; '))))));}
  if(DATE_AMBIG)issue('info',L(`日期像 03/04/2024 这样，目前按「${DMY?'日/月/年':'月/日/年'}」读取`,`Dates look like 03/04/2024 and are read as ${DMY?'day/month/year':'month/day/year'}`),L('如果你的表格是另一种写法，点下面切换。','If your sheet means the other order, switch below.'),
    [el('div',{cls:'item'},el('div',{cls:'acts'},btn(DMY?L('改成 月/日/年','Read as month/day/year'):L('改成 日/月/年','Read as day/month/year'),()=>{DMY=!DMY;rebuild();})))]);
  // 4. statuses
  if(d.unknownSt.size){const SL=EN()?{flown:'flown',upcoming:'upcoming',void:'cancelled / void',unclear:'unclear'}:{flown:'已乘坐',upcoming:'待出行',void:'退票 / 作废',unclear:'看不出来'};
    issue('warn',L(`${d.unknownSt.size} 种状态看不懂，暂时按「已乘坐」处理`,`${d.unknownSt.size} unknown statuses, treated as “flown” for now`),L('选一下每种状态的意思；也可以点「AI 检查」让 Jev 判断。','Pick what each status means, or tap “AI check” and let Jev decide.'),
      [...d.unknownSt.entries()].map(([s,rows])=>el('div',{cls:'item'},el('div',{},L(`「${s}」× ${rows.length}`,`“${s}” × ${rows.length}`),el('span',{cls:'where'},'  '+where(rows,'st'))),lean(AIR.st[s],c=>SL[c]),
        el('div',{cls:'acts'},...['flown','upcoming','void'].map(v=>btn(SL[v],()=>{STFIX[s]=v;rebuild();},STFIX[s]===v))))));}
  // 5. rows that look like trains or notes
  if(d.suspect.length){const RL=EN()?{flight:'a flight',train:'a train',other:'not a trip'}:{flight:'航班',train:'火车 / 高铁',other:'不是行程记录'};
    issue('warn',L(`${d.suspect.length} 行看起来不像航班`,`${d.suspect.length} rows don't look like flights`),L('火车、汇总行混进来会被当成航班画在地图上。确认后排除，或者从表格里删掉这些行。','Trains or summary rows would be drawn as flights. Exclude them here, or delete them from the sheet.'),
      d.suspect.map(r=>{const k=rkey(r);return el('div',{cls:'item'},el('div',{},`${r.fn||'—'}  ${r.from} → ${r.to}`,el('span',{cls:'where'},'  '+where([r]))),lean(AIR.row[k],c=>RL[c]),
        el('div',{cls:'acts'},btn(L('排除这一行','Exclude this row'),()=>{EXCL.add(k);rebuild();}),btn(L('是航班，保留','It is a flight, keep it'),()=>{KEEP.add(k);rebuild();})));}));}
  // 6. silent skips, for the record
  if(d.sameAp.length)issue('info',L(`${d.sameAp.length} 行出发和到达是同一个机场，已跳过`,`${d.sameAp.length} rows start and end at the same airport, skipped`),where(d.sameAp,'from'));
  if(d.missingAp.length)issue('info',L(`${d.missingAp.length} 行缺出发地或到达地，已跳过`,`${d.missingAp.length} rows miss the origin or destination, skipped`),where(d.missingAp,'from'));
  if(d.dup)issue('info',L(`${d.dup} 段重复记录已合并`,`${d.dup} duplicates merged`),L('同一天、同航班号、同航线的记录只算一次。','The same day, flight number and route counts once.'));
  if(d.excluded)issue('info',L(`已排除 ${d.excluded} 行`,`${d.excluded} rows excluded`),null,[el('div',{cls:'item'},el('div',{cls:'acts'},btn(L('全部恢复','Restore all'),()=>{EXCL.clear();rebuild();})))]);
  // every row, editable: drop a segment, or give an OPEN / refunded ticket a date
  if(RAW.length){const det=el('details',{cls:'seglist'},el('summary',{},L(`逐条查看 / 删改航段（${RAW.length} 行）`,`All rows — exclude or add a date (${RAW.length})`)));
    const fill=()=>{if(det.dataset.built)return;det.dataset.built=1;det.append(segTable());};det.addEventListener('toggle',()=>{SEG_OPEN=det.open;if(det.open)fill();});
    if(SEG_OPEN){det.open=true;fill();}box.append(det);}
  head.className='check-head '+(!ok||(bad&&needColumns())?'bad':bad||warn?'warn':'ok');
  head.textContent=!ok?(bad?L('⛔ 还不能生成视频：先处理下面「必须修改」的问题。','⛔ Not ready yet: fix the “must fix” items below first.'):filteredOutMsg()):bad?L('⚠️ 可以生成，但有航班会缺失，建议先按下面的提示修改。','⚠️ Ready, but some flights would be missing — fixing the items below is recommended.'):warn?L('⚠️ 可以生成，有几处建议确认一下。','⚠️ Ready; a few items are worth a look.'):L('✅ 表格没有问题，可以直接生成视频。','✅ The sheet looks good — go ahead and make the film.');
  if(!AI_PROBED){AI_PROBED=true;fetch('/api/check',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).then(r=>r.status===503?r.json():null).then(j=>{if(j&&(j.error==='disabled'||j.error==='not_configured')){AI_OFF=true;renderCheck();}}).catch(()=>{});}
  $('btnAI').hidden=AI_OFF;$('aiNote').hidden=AI_OFF;
  const n=aiPending(),hf=highFixes().length;$('btnAI').disabled=AI_BUSY||!n;$('btnAI').textContent=n?L(`AI 检查（Jev · ${n} 项）`,`AI check (Jev · ${n})`):L('AI 检查（Jev）','AI check (Jev)');
  $('btnApplyAll').hidden=!hf;$('btnApplyAll').textContent=L(`采用全部高把握建议（${hf}）`,`Apply all confident fixes (${hf})`);$('btnToMake').hidden=!ok;$('btnFixedCsv').disabled=!RAW.length;
}
// file input
async function loadFile(file){
  try{setStatus(L(`正在读取 ${file.name} …`,`Reading ${file.name} …`));const buf=await file.arrayBuffer();await loadLib('xlsx','XLSX');let wb;
    if(/\.csv$|\.txt$/i.test(file.name)){let txt=new TextDecoder('utf-8').decode(buf);if(txt.includes(String.fromCharCode(0xFFFD)))txt=new TextDecoder('gb18030').decode(buf);wb=XLSX.read(txt,{type:'string',raw:true});}
    else wb=XLSX.read(buf,{type:'array',cellDates:true});
    const rows=readWorkbook(wb);if(!rows.length&&!SHEETS.length){setStatus(L('文件里没有内容。','The file is empty.'),true);return;}
    resetFixes();aiMsg('');RAW=rows;SOURCE='file';natForUser();playT=0;RESET_YEARS=true;$('yFrom').innerHTML='';$('yTo').innerHTML='';
    setStatus(rows.length?L(`已读取 ${rows.length} 行记录，检查结果见「检查表格」。`,`Read ${rows.length} rows — see “Check the spreadsheet”.`):L('没认出表格结构，见「检查表格」。','Table structure not recognised — see “Check the spreadsheet”.'),!rows.length);rebuild();
  }catch(e){console.error(e);setStatus(L('文件读取失败：','Could not read the file: ')+(e.message||e)+L('。可以另存为 .xlsx 或 CSV 再试。','. Try saving it as .xlsx or CSV.'),true);}
}
const drop=$('drop');
drop.addEventListener('click',()=>$('file').click());drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file').click();}});
$('file').addEventListener('change',e=>{const f=e.target.files[0];if(f)loadFile(f);e.target.value='';});
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over');}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over');}));
drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)loadFile(f);});
$('btnDemo').addEventListener('click',()=>{resetFixes();aiMsg('');RAW=demoRows();SOURCE='demo';if(!NAT_TOUCHED)$('nat').value='CN';playT=0;RESET_YEARS=true;$('yFrom').innerHTML='';$('yTo').innerHTML='';if(!$('name').value)$('name').value='';setStatus(L('已换回示例数据。','Back to the sample data.'));rebuild();});
$('btnAI').addEventListener('click',runAI);$('btnApplyAll').addEventListener('click',applyAll);
$('btnFixedCsv').addEventListener('click',()=>saveFile(L('航迹手帐_修正版.csv','sky-passport-corrected.csv'),new Blob([fixedCsv()],{type:'text/csv'})));
$('btnToMake').addEventListener('click',()=>HOME.go('studio','s3'));
$('btnTpl').addEventListener('click',async()=>{
  const csv=EN()?'﻿Date,Flight,Airline,From,To,Departure time,Arrival time,Distance km,Status\n2024-05-01,BA117,British Airways,London Heathrow,JFK,11:30,14:20,,flown\n2024-05-09,DL405,Delta,JFK,LHR,20:30,08:45,,flown\n2027-02-24,NH212,ANA,LHR,Tokyo Haneda,19:15,15:50,,upcoming\n'
    :'﻿日期,航班号,航空公司,出发,到达,出发时间,到达时间,里程数,状态\n2024-05-01,MU5101,东方航空,上海虹桥,北京首都,08:00,10:15,,已使用\n2024-05-06,CA1519,中国国航,PEK,SHA,19:00,21:10,,已使用\n2027-02-24,NH924,全日空,广州白云,东京羽田,15:05,20:00,,未使用\n';
  await saveFile(L('航迹手帐_模板.csv','sky-passport-template.csv'),new Blob([csv],{type:'text/csv'}));});
['optUp','optVoid','yFrom','yTo','nat'].forEach(id=>$(id).addEventListener('change',rebuild));
['name','latin','tagEn','tagZh'].forEach(id=>$(id).addEventListener('input',rebuild));
$('btnPhoto').addEventListener('click',()=>$('photo').click());
$('photo').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const url=URL.createObjectURL(f);const im=new Image();im.onload=()=>{PHOTO=im;$('thumb').src=url;$('btnPhotoClear').hidden=false;rebuild();};im.src=url;e.target.value='';});
$('btnPhotoClear').addEventListener('click',()=>{PHOTO=null;$('thumb').removeAttribute('src');$('btnPhotoClear').hidden=true;rebuild();});
// preview playback
function audioKey(){return [SFXB?'sfx':'',S.T_END,S.P.nat,S.P.mstyle,S.order.join(','),S.years.map(y=>y.bars+(y.dream?'d':'')+(y.gap?'g':'')).join(','),S.flights.map(f=>f.t0.toFixed(3)+':'+f.km+(f.up?'u':'')+(f.vd?'v':'')).join(',')].join('|');}
// the score is synthesised off the main thread (a Worker built from the same functions), so the page never freezes
let synthW=null,synthSeq=0,AUDIO_PENDING=null;
// the recorded sound effects (sfx/film.mp3): decoded once at 48 kHz, cut into {name:{d:samples,s:peak offset}}.
// MP3 decoders add different priming delays, so the sprite carries a one-sample marker at 0.1 s to measure ours.
let SFXB=null,sfxP=null,SFXF=false; // SFXF: the sprite failed once; keep going without effects
function loadSfx(){if(SFXB)return Promise.resolve(SFXB);if(sfxP)return sfxP;
  sfxP=fetch('sfx/film.mp3'+VQ).then(r=>{if(!r.ok)throw new Error('sfx '+r.status);return r.arrayBuffer();})
    .then(buf=>new OfflineAudioContext(1,48000,48000).decodeAudioData(buf)).then(ab=>{const x=ab.getChannelData(0);let k=0;for(let i=1;i<9600;i++)if(Math.abs(x[i])>Math.abs(x[k]))k=i;const off=k-4800,B={};
      for(const [nm,[st,len,sy]] of Object.entries(SFX_MAP))B[nm]={d:x.slice(st+off,st+off+len),s:sy};SFXB=B;return B;})
    .catch(e=>{console.warn('sound effects unavailable',e);SFXF=true;sfxP=null;return null;});
  return sfxP;}
function synthInWorker(sc){
  if(synthW===null){try{const fns=[rngF,bqC,bq,lufs,glue,limiter,reverbInto,pingInto,filmCues,synth].map(f=>f.toString()).join('\n');
      const src=`"use strict";const hash=${hash},clamp=${clamp};const BAR=${BAR},BEAT=${BEAT},T_OPEN=${T_OPEN},T_F0=${T_F0},O0=${O0},SWG=${SWG};\n${fns}\nonmessage=e=>{const A=synth(e.data.sc,48000);postMessage({id:e.data.id,A},[A.L.buffer,A.R.buffer]);};`;
      synthW=new Worker(URL.createObjectURL(new Blob([src],{type:'text/javascript'})));}catch(e){synthW=false;}}
  if(!synthW)return Promise.resolve(synth(sc,48000));
  const id=++synthSeq,lite={T_END:sc.T_END,T_FE:sc.T_FE,T_STAMP:sc.T_STAMP,T_ZOOM:sc.T_ZOOM,T_CARD:sc.T_CARD,years:sc.years.map(y=>({t:y.t,end:y.end,bars:y.bars,dream:y.dream,gap:y.gap})),
    flights:sc.flights.map(f=>({t0:f.t0,dur:f.dur,km:f.km,up:f.up,vd:f.vd})),order:sc.order,visit:sc.visit,P:{nat:sc.P.nat},style:sc.P.mstyle,sfx:sc.sfx,cues:sc.cues};
  return new Promise((res,rej)=>{const on=e=>{if(e.data.id!==id)return;synthW.removeEventListener('message',on);res(e.data.A);};synthW.addEventListener('message',on);
    synthW.addEventListener('error',e=>{synthW.removeEventListener('message',on);synthW=false;rej(e);},{once:true});synthW.postMessage({id,sc:lite});});}
function ensureAudio(){if(!S||!S.ok)return Promise.resolve(null);if(!SFXB&&!SFXF)return loadSfx().then(()=>ensureAudio());S.sfx=SFXB;const key=audioKey();if(AUDIO&&AUDIO_KEY===key)return Promise.resolve(AUDIO);
  if(AUDIO_PENDING&&AUDIO_PENDING.key===key)return AUDIO_PENDING.p;const sc=S;
  const p=synthInWorker(sc).catch(()=>synth(sc,48000)).then(A=>{if(AUDIO_PENDING&&AUDIO_PENDING.key===key)AUDIO_PENDING=null;AUDIO=A;AUDIO_KEY=key;return A;});AUDIO_PENDING={key,p};return p;}
let audioTimer=null;function scheduleAudio(){clearTimeout(audioTimer);audioTimer=setTimeout(()=>{if(!playing&&!exporting&&S&&S.ok)ensureAudio();},800);}
function stopPlay(){playing=false;$('btnPlay').textContent=L('▶ 播放','▶ Play');$('btnPlay').setAttribute('aria-label',L('播放预览','Play the preview'));if(audioSrc){try{audioSrc.stop();}catch(e){}audioSrc=null;}}
let starting=false;
$('btnPlay').addEventListener('click',async()=>{if(!S||!S.ok||exporting||starting)return;if(playing){stopPlay();return;}
  if(playT>=S.T_END-0.05)playT=0;starting=true;
  try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)({sampleRate:48000});audioCtx.resume();}catch(e){} // unlock audio inside the click
  if(!(AUDIO&&AUDIO_KEY===audioKey()))$('btnPlay').textContent=L('… 合成配乐','… scoring');const A=await ensureAudio();starting=false;if(!A||!S||!S.ok)return;
  try{const buf=audioCtx.createBuffer(2,A.L.length,A.SR);buf.copyToChannel(A.L,0);buf.copyToChannel(A.R,1);
    audioSrc=audioCtx.createBufferSource();audioSrc.buffer=buf;audioSrc.connect(audioCtx.destination);audioSrc.start(0,playT);audioCtx.resume();}catch(e){console.warn(e);}
  playing=true;$('btnPlay').textContent=L('❚❚ 暂停','❚❚ Pause');$('btnPlay').setAttribute('aria-label',L('暂停预览','Pause the preview'));const startT=playT,t0=performance.now(),a0=audioCtx?audioCtx.currentTime:0;
  const loop=()=>{if(!playing)return;playT=audioCtx&&audioSrc?startT+(audioCtx.currentTime-a0):startT+(performance.now()-t0)/1000;if(playT>=S.T_END){playT=S.T_END;drawAt(playT);stopPlay();return;}drawAt(playT);requestAnimationFrame(loop);};requestAnimationFrame(loop);});
$('scrub').addEventListener('input',e=>{if(!S||!S.ok)return;stopPlay();playT=e.target.value/1000*S.T_END;drawAt(playT);});

/* ================= P1 conveniences: segmented controls, export guide, quick years, row editor ================= */
const PREF_KEY='skypassport.prefs';
function initSegs(){let pref={};try{pref=JSON.parse(localStorage.getItem(PREF_KEY)||'{}');}catch(e){}
  for(const [id,def] of [['segTheme','burgundy'],['segMusic','groove'],['segLen','24']]){const box=$(id),want=pref[id]||def;
    const set=v=>{for(const b of box.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.v===v));};
    set([...box.querySelectorAll('button')].some(b=>b.dataset.v===want)?want:def);
    box.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;set(b.dataset.v);pref[id]=b.dataset.v;try{localStorage.setItem(PREF_KEY,JSON.stringify(pref));}catch(e){}rebuild();});}}
// how to get the spreadsheet out of 航旅纵横 (menu names differ between app versions — keep this list in sync with the app)
const GUIDE_EN=[['In Flighty, myFlightradar24, OpenFlights or App in the Air, look for “Export” in the settings or your flight list and choose CSV','Menu names differ between apps and versions; any export with date, from and to columns works.'],
  ['Save the file to your phone or computer, then tap the dashed box above to upload it','Columns, airport names (codes or English names) and date formats are recognised automatically.'],
  ['No app history? Download the CSV template and fill it in, or add a few flights by hand below','Chinese exports from 航旅纵横 work as they are, too.']];
const GUIDE=[['打开「航旅纵横」App，进入「我的」，找到全部行程 / 飞行记录','不同版本的叫法可能是「行程」「飞行足迹」或「出行记录」。'],
  ['点「导出」（常在右上角「···」里），选 Excel，发送到自己的邮箱','导出目前需要航旅纵横 Pro 会员。没有会员也没关系：用下面的「上传行程截图」或「手动添加航班」。'],
  ['在电脑或手机上下载邮件附件，回到这里点上方虚线框上传','其他 App 导出的表格、自己整理的 Excel 也可以；什么都没有就点「下载 CSV 模板」手填。']];
function initGuide(){const ol=$('guideSteps');ol.innerHTML='';for(const [t,d] of (EN()?GUIDE_EN:GUIDE))ol.append(el('li',{},t,el('small',{},d)));}
function renderYearQuick(ys){const box=$('yearQuick');box.innerHTML='';if(ys.length<2){box.hidden=true;return;}box.hidden=false;
  const yNow=new Date().getFullYear(),flown=S.res.all.filter(f=>!f.up&&!f.vd).map(f=>f.y),last=ys.includes(yNow)&&flown.includes(yNow)?yNow:(flown.length?Math.max(...flown):ys[ys.length-1]);
  const opts=[[L('全部年份','All years'),ys[0],ys[ys.length-1]],[L(`${last} 年度`,`${last} only`),last,last]];if(ys.length>3)opts.push([L('最近 3 年','Last 3 years'),ys[ys.length-3],ys[ys.length-1]]);
  const f=+$('yFrom').value,t=+$('yTo').value;
  for(const [lab,a,b] of opts){const bt=el('button',{type:'button','aria-pressed':String(f===+a&&t===+b)},lab);bt.addEventListener('click',()=>{$('yFrom').value=a;$('yTo').value=b;playT=0;rebuild();});box.append(bt);}}
let SEG_OPEN=false;
function segTable(){const wrap=el('div',{cls:'segtable'}),SL=EN()?{flown:'flown',upcoming:'upcoming',void:'cancelled'}:{flown:'已乘坐',upcoming:'待出行',void:'退票'};
  RAW.slice(0,600).forEach(r=>{const k=rkey(r);if(!k)return;const d=parseDate(r.rawDate),on=!EXCL.has(k);
    const cb=el('input',{type:'checkbox',checked:on,title:on?L('取消勾选 = 不放进动画','Untick to leave it out of the film'):L('勾选 = 放回动画','Tick to put it back')});cb.addEventListener('change',()=>{if(cb.checked)EXCL.delete(k);else EXCL.add(k);rebuild();});
    let date;if(d)date=el('span',{cls:'dt'},ymd(d));else{date=el('input',{type:'date',cls:'dt',title:L('补上日期后这段会放进动画','Add a date to include this flight')});date.addEventListener('change',()=>{if(date.value){r.rawDate=date.value;rebuild();}});}
    const fa=resolveAirport(r.from),ta=resolveAirport(r.to);
    wrap.append(el('label',{cls:'segrow'+(on?'':' off')},cb,date,el('span',{cls:'fn'},r.fn||'—'),el('span',{cls:'rt'},`${fa||r.from} → ${ta||r.to}`),el('span',{cls:'st'},SL[rowStatus(r)]),el('span',{cls:'where'},'#'+r.src.row)));});
  if(RAW.length>600)wrap.append(el('div',{cls:'where'},L('只显示前 600 行','Showing the first 600 rows')));return wrap;}
/* ---------- add flights by hand: date + two airports (code, English or Chinese name) ---------- */
let QA_N=0;
function qaUpdate(){const fv=$('qaFrom').value.trim(),tv=$('qaTo').value.trim(),fa=fv&&resolveAirport(fv),ta=tv&&resolveAirport(tv),h=$('qaHint'),nm=c=>`${c} ${placeName(c)}`;
  h.className='qahint';h.textContent=(fv||tv)?[fv?(fa?nm(fa):L(`「${fv}」没认出`,`“${fv}” not found`)):'…',tv?(ta?nm(ta):L(`「${tv}」没认出`,`“${tv}” not found`)):'…'].join(' → '):'';if(fa&&ta)h.classList.add('ok');else if((fv&&!fa)||(tv&&!ta))h.classList.add('err');}
function qaAdd(){const d=$('qaDate').value,fa=resolveAirport($('qaFrom').value),ta=resolveAirport($('qaTo').value),h=$('qaHint');
  const bad=m=>{h.className='qahint err';h.textContent=m;};
  if(!d)return bad(L('先选日期','Pick a date first'));if(!fa||!ta)return bad(L('出发和到达都要能认出（三字码最稳）','Both airports must be recognised (codes are the safest)'));if(fa===ta)return bad(L('出发和到达是同一个机场','From and to are the same airport'));
  if(SOURCE!=='file'){resetFixes();aiMsg('');RAW=[];SHEETS=[];SOURCE='file';natForUser();} // the sample makes way for the user's own flights
  const fn=$('qaFn').value.toUpperCase().replace(/\s+/g,'');QA_N++;
  RAW.push({rawDate:d,al:'',fn,from:fa,to:ta,dt:'',at:'',km:'',st:'',sheetUp:false,sheetVoid:false,src:{sheet:L('手动添加','Added by hand'),row:QA_N,cols:{}}});
  playT=0;RESET_YEARS=true;$('yFrom').innerHTML='';$('yTo').innerHTML='';
  h.className='qahint ok';h.textContent=L(`已添加 ${fa} → ${ta}（共 ${RAW.length} 段）`,`Added ${fa} → ${ta} (${RAW.length} in total)`);
  $('qaFrom').value=$('qaTo').value='';$('qaFn').value='';$('qaFrom').value=ta;$('qaFrom').focus();rebuild();} // the next leg usually starts where this one ended
['qaFrom','qaTo'].forEach(id=>$(id).addEventListener('input',qaUpdate));$('btnQaAdd').addEventListener('click',qaAdd);
['qaFrom','qaTo','qaFn'].forEach(id=>$(id).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();qaAdd();}}));
/* ---------- flights from screenshots (mainland site: POST /api/shots, Tencent Cloud OCR; the server returns the flights it found) ---------- */
const SHOTS_ON=/(^|\.)nybbq\.art$/.test(location.hostname)||/[?&]shots=1/.test(location.search);let SHOT_N=0,SHOT_BUSY=false;
/* a phone screenshot is sent as a JPEG 760 px wide (about 80 KB): text that size still reads reliably, and the upload survives a slow line */
function shotData(file){return new Promise((res,rej)=>{const u=URL.createObjectURL(file),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);let k=Math.min(1,760/im.naturalWidth);if(im.naturalHeight*k>9000)k=9000/im.naturalHeight;
  const c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.naturalWidth*k));c.height=Math.max(1,Math.round(im.naturalHeight*k));const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',0.62).split(',')[1]);};
  im.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('image'));};im.src=u;});}
async function shotsAdd(files){if(SHOT_BUSY||!files.length)return;SHOT_BUSY=true;const h=$('shotHint'),ul=$('shotList'),say=(m,c)=>{h.className='qahint'+(c?' '+c:'');h.textContent=m;};$('btnShots').disabled=true;
  let added=0,dup=0,need=0,fail='';const key=r=>[r.rawDate,r.fn,r.from,r.to].join('|');
  try{for(let i=0;i<files.length;i++){say(`正在识别第 ${i+1} / ${files.length} 张…`);let j=null;
      try{const body=JSON.stringify({image:await shotData(files[i])}),post=()=>fetch('/api/shots',{method:'POST',headers:{'Content-Type':'application/json'},body});let r;try{r=await post();}catch(e){say(`第 ${i+1} 张上传较慢，正在重试…`);r=await post();} /* one retry: a dropped upload is usually a slow line, not a bad picture */
        j=await r.json().catch(()=>null);
        if(!r.ok){fail=r.status===429?'这一小时识别的张数太多了，请稍后再试':r.status===503?'截图识别暂时不可用，请先用手动添加':r.status===400?'有图片读不出来，请换一张清晰的截图':'识别服务出错了，请稍后再试';if(r.status!==400)break;continue;}}
      catch(e){fail=e&&e.message==='image'?'有文件不是图片，已跳过':'上传没成功（网络较慢或不通），请换个网络再试，或先手动添加';if(!(e&&e.message==='image'))break;continue;}
      const fl=(j&&j.flights)||[];if(!fl.length){ul.append(el('li',{},el('span',{class:'g'},`第 ${i+1} 张：没找到航班，请确认截图里有日期、航班号和起降地`)));continue;}
      if(SOURCE!=='file'){resetFixes();aiMsg('');RAW=[];SHEETS=[];SOURCE='file';natForUser();} /* the sample makes way for the user's own flights */
      const have=new Set(RAW.map(key));SHOT_N++;
      fl.forEach((f,k)=>{const row={rawDate:f.date||'',al:f.al||'',fn:f.fn||'',from:f.from||'',to:f.to||'',dt:f.dt||'',at:f.at||'',km:'',st:'',sheetUp:false,sheetVoid:false,src:{sheet:`截图 ${SHOT_N}`,row:k+1,cols:{}}};
        if(have.has(key(row))){dup++;return;}have.add(key(row));RAW.push(row);added++;
        const fa=row.from&&resolveAirport(row.from),ta=row.to&&resolveAirport(row.to),bad=!row.rawDate||!fa||!ta;if(bad)need++;
        ul.append(el('li',{},el('span',{class:'d'},row.rawDate||(f.md?`??-${f.md}`:'日期?')),el('span',{},`${row.fn} ${row.from||'?'} → ${row.to||'?'}`),bad?el('span',{class:'w'},!row.rawDate?'缺年份':'地名没认出'):el('span',{class:'g'},`${fa} → ${ta}`)));});}
    if(added){playT=0;RESET_YEARS=true;$('yFrom').innerHTML='';$('yTo').innerHTML='';rebuild();}
    say(fail&&!added?fail:`识别出 ${added} 段${dup?`，${dup} 段重复已跳过`:''}${need?`；${need} 段要在「检查表格」里补全`:''}${fail?`（${fail}）`:''}`,fail&&!added?'err':need?'':'ok');}
  finally{SHOT_BUSY=false;$('btnShots').disabled=false;$('shotFile').value='';}}
if(SHOTS_ON&&!EN()){$('shotAdd').hidden=false;$('btnShots').addEventListener('click',()=>$('shotFile').click());$('shotFile').addEventListener('change',e=>shotsAdd([...e.target.files].slice(0,12)));}
/* ---------- language switch: static text in i18n.js, everything rendered from code re-renders here ---------- */
function natOptions(){const sel=$('nat'),keep=sel.value||'CN';sel.innerHTML='';const lab=v=>EN()?`${v[0]} · ${v[2]}`:`${v[1]} · ${v[2]}`;
  Object.entries(NAMES).sort((a,b)=>EN()?a[1][0].localeCompare(b[1][0],'en'):a[1][1].localeCompare(b[1][1],'zh')).forEach(([k,v])=>{const o=document.createElement('option');o.value=k;o.textContent=lab(v);sel.appendChild(o);});sel.value=keep;}
// nationality: the sample is a Chinese traveller; once the data is the user's own and they have not picked one, use the browser's region
let NAT_TOUCHED=false;
function natForUser(){if(NAT_TOUCHED)return;const m=(navigator.language||'').match(/[-_]([A-Za-z]{2})\b/),r=m?m[1].toUpperCase():/^zh/i.test(navigator.language||'')?'CN':'';if(r&&NAMES[r])$('nat').value=r;}
$('nat').addEventListener('change',()=>{NAT_TOUCHED=true;});
function onLangChange(){if(typeof HOME!=='undefined')HOME.relang();initGuide();if(Object.keys(NAMES).length)natOptions();if(!playing)stopPlay();qaUpdate();if(S)rebuild();}
$('btnLang').addEventListener('click',()=>setLang(EN()?'zh':'en'));
/* ---------- hero: the traveller's numbers, counted up like a flight-log readout ---------- */
let HERO_ANIM=0,HERO_MINE=false;
function heroStats(){const box=$('heroStats');if(!box||!S)return;const F=S.ok?S.final:{n:0,km:0,cc:0,min:0},to={n:F.n,km:F.km,cc:F.cc,h:Math.round(F.min/60)},id=++HERO_ANIM,t0=performance.now(),reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  /* the board says whose numbers these are: the fictional sample until the visitor's own flights are in, then theirs (with a notice) */
  const mine=SOURCE!=='demo',who=$('heroWho'),nm=mine?(($('name').value||'').trim()||L('你','You')):L('林小舟','Lin Xiaozhou');who.textContent='';
  who.append(el('span',{},mine?L('你的航迹 · ','Your flight log · '):L('示例旅客 · ','Sample traveller · '),el('b',{},nm)),el('span',{cls:'tag'},mine?L('已换成你的数据','YOUR DATA'):L('虚构示例','FICTIONAL')));
  who.parentElement.classList.toggle('mine',mine);const note=$('heroNote');note.textContent='';
  if(mine)note.append(L('地球、数字和成就都已换成你的航班。','The globe, the numbers and the medals now show your flights.'));else note.append(L('这是示例。','This is a sample. '),el('a',{href:'#/studio/s1','data-go':'studio:s1'},L('导入你的航班','Import your flights')),L('后，这里会换成你的名字和数字。',' and this becomes your name and numbers.'));
  if(mine&&!HERO_MINE&&S.ok){const t=$('toast');t.textContent='';t.append(L('首页的地球和数字已换成你的航迹','The home page now shows your flights'),el('a',{href:'#/home','data-go':'home',on:{click:()=>t.classList.remove('on')}},L('去看看 →','See it →')));t.classList.add('on');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('on'),7000);}
  HERO_MINE=mine&&S.ok;
  $('heroLine').textContent=S.ok?L(`绕地球 ${(F.km/40075).toFixed(2)} 圈 · ${yearsLabel(S,' — ')}`,`${(F.km/40075).toFixed(2)}× around the Earth · ${yearsLabel(S,' — ')}`):L('导入航班后，这里会显示你的数字','Your numbers appear here once your flights are in');
  if(typeof HOME!=='undefined'){for(const [key,v] of Object.entries(to))HOME.flap(box.querySelector(`[data-k="${key}"]`),fmt(v));HOME.update();return;} /* split-flap board (home.js) */
  const step=now=>{if(id!==HERO_ANIM)return;const k=reduce?1:Math.min(1,(now-t0)/900),e=1-Math.pow(1-k,3);for(const [key,v] of Object.entries(to))box.querySelector(`[data-k="${key}"]`).textContent=fmt(v*e);if(k<1)requestAnimationFrame(step);};requestAnimationFrame(step);}
$('btnStart').addEventListener('click',()=>HOME.go('studio','s1'));
document.querySelectorAll('.introBtn').forEach(b=>b.addEventListener('click',()=>$('btnIntro').click()));
// the intro film (720p, loaded only when opened)
/* three short kinetic cuts (A rapid fire, B one pass, C departures board): a different one each time */
let INTRO_LAST=-1;
$('btnIntro').addEventListener('click',()=>{const d=$('intro'),v=$('introV');let k=Math.floor(Math.random()*3);if(k===INTRO_LAST)k=(k+1)%3;INTRO_LAST=k;const src=`promo/intro-${'abc'[k]}.mp4`;if(!v.src.endsWith(src))v.src=src;if(d.showModal)d.showModal();else d.setAttribute('open','');v.play().catch(()=>{});});
const closeIntro=()=>{$('introV').pause();$('intro').close?$('intro').close():$('intro').removeAttribute('open');};$('btnIntroX').addEventListener('click',closeIntro);$('intro').addEventListener('close',()=>$('introV').pause());
$('btnMakeM').addEventListener('click',()=>{$('h3').scrollIntoView({behavior:'smooth',block:'start'});if(S&&S.ok&&!exporting)$('btnMake').click();});
initSegs();initGuide();
