"use strict";
/* ================= music (synthesised to the same grid) ================= */
// 112 BPM, one chord per bar (Fmaj7–Em7–Dm7–Cmaj7). Two buses: dry (drums, leads, sfx) and bed (pad/keys/bass, side-chained to the kick).
// Leads feed a dotted-8th ping-pong delay and a Freeverb-style room. Master: glue comp → −14 LUFS → look-ahead limiter at −1.2 dBFS.
function bqC(type,fc,sr,Q=0.7071,db=0){const A=Math.pow(10,db/40),w=2*Math.PI*fc/sr,c=Math.cos(w),s=Math.sin(w),al=s/(2*Q);let b0,b1,b2,a0,a1,a2;
  if(type==='lp'){b0=(1-c)/2;b1=1-c;b2=b0;a0=1+al;a1=-2*c;a2=1-al;}
  else if(type==='hp'){b0=(1+c)/2;b1=-(1+c);b2=b0;a0=1+al;a1=-2*c;a2=1-al;}
  else if(type==='bp'){b0=al;b1=0;b2=-al;a0=1+al;a1=-2*c;a2=1-al;}
  else if(type==='ls'){const q=2*Math.sqrt(A)*al;b0=A*((A+1)-(A-1)*c+q);b1=2*A*((A-1)-(A+1)*c);b2=A*((A+1)-(A-1)*c-q);a0=(A+1)+(A-1)*c+q;a1=-2*((A-1)+(A+1)*c);a2=(A+1)+(A-1)*c-q;}
  else{const q=2*Math.sqrt(A)*al;b0=A*((A+1)+(A-1)*c+q);b1=-2*A*((A-1)+(A+1)*c);b2=A*((A+1)+(A-1)*c-q);a0=(A+1)-(A-1)*c+q;a1=2*((A-1)-(A+1)*c);a2=(A+1)-(A-1)*c-q;} // 'hs' high shelf
  return [b0/a0,b1/a0,b2/a0,a1/a0,a2/a0];}
function bq(x,type,fc,sr,Q=0.7071,db=0,out){const [b0,b1,b2,a1,a2]=bqC(type,fc,sr,Q,db);const y=out||new Float32Array(x.length);let x1=0,x2=0,y1=0,y2=0;
  for(let i=0;i<x.length;i++){const v0=x[i],v=b0*v0+b1*x1+b2*x2-a1*y1-a2*y2;x2=x1;x1=v0;y2=y1;y1=v;y[i]=v;}return y;}
function lufs(L,R,SR){ // ITU-R BS.1770 integrated loudness (K-weighting, 400 ms blocks, absolute + relative gate)
  const hop=Math.floor(0.1*SR),nh=Math.floor(L.length/hop),e=new Float64Array(nh);
  for(const X of [L,R]){const k=bq(bq(X,'hs',1681.97,SR,0.7071,4),'hp',38.13,SR,0.5);for(let h=0;h<nh;h++){let a=0;for(let i=h*hop,j=i+hop;i<j;i++)a+=k[i]*k[i];e[h]+=a;}}
  const ms=[];for(let h=0;h+4<=nh;h++)ms.push((e[h]+e[h+1]+e[h+2]+e[h+3])/(4*hop));
  const ld=m=>-0.691+10*Math.log10(m+1e-12),avg=a=>a.reduce((p,q)=>p+q,0)/a.length;let g=ms.filter(m=>ld(m)>-70);if(!g.length)return -70;
  const rel=ld(avg(g))-10;g=g.filter(m=>ld(m)>rel);return ld(avg(g));}
function glue(L,R,SR,thrDb,ratio){const ka=Math.exp(-1/(0.012*SR)),kr=Math.exp(-1/(0.16*SR)),thr=Math.pow(10,thrDb/20),ex=1/ratio-1;let env=0;
  for(let i=0;i<L.length;i++){const x=Math.max(Math.abs(L[i]),Math.abs(R[i]));env=x>env?ka*env+(1-ka)*x:kr*env+(1-kr)*x;if(env>thr){const g=Math.pow(env/thr,ex);L[i]*=g;R[i]*=g;}}}
function limiter(L,R,SR,ceil){const n=L.length,g=new Float32Array(n);for(let i=0;i<n;i++){const p=Math.max(Math.abs(L[i]),Math.abs(R[i]));g[i]=p>ceil?ceil/p:1;}
  const ka=1-Math.exp(-1/(0.0015*SR)),kr=1-Math.exp(-1/(0.09*SR));for(let i=n-2;i>=0;i--){const v=g[i+1]+(1-g[i+1])*ka;if(v<g[i])g[i]=v;} // backward pass = look-ahead attack
  let r=1;for(let i=0;i<n;i++){r=Math.min(g[i],r+(1-r)*kr);L[i]*=r;R[i]*=r;}}
function reverbInto(x,SR,oL,oR,wet){const sc=SR/44100,CT=[1116,1188,1277,1356,1422,1491,1557,1617],AT=[556,441,341,225],PD=Math.round(0.015*SR),n=x.length,acc=new Float32Array(n);
  [oL,oR].forEach((o,ch)=>{acc.fill(0);
    for(const c0 of CT){const D=Math.round((c0+23*ch)*sc),buf=new Float32Array(D);let j=0,fs=0;for(let i=0;i<n;i++){const y=buf[j];fs=y*0.8+fs*0.2;buf[j]=(i>=PD?x[i-PD]:0)*0.015+fs*0.84;acc[i]+=y;if(++j===D)j=0;}}
    for(const a0 of AT){const D=Math.round((a0+23*ch)*sc),buf=new Float32Array(D);let j=0;for(let i=0;i<n;i++){const b=buf[j],v=acc[i];acc[i]=b-v;buf[j]=v+b*0.5;if(++j===D)j=0;}}
    for(let i=0;i<n;i++)o[i]+=acc[i]*wet;});}
function pingInto(x,SR,dt,oL,oR,wet,fb=0.36){const D=Math.round(dt*SR),n=x.length,bl=new Float32Array(D),br=new Float32Array(D);let j=0,zl=0,zr=0;
  for(let i=0;i<n;i++){const yl=bl[j],yr=br[j];zl+=(x[i]+fb*yr-zl)*0.33;zr+=(yl-zr)*0.33;bl[j]=zl;br[j]=zr;oL[i]+=yl*wet;oR[i]+=yr*wet;if(++j===D)j=0;}}
function synth(sc,SR=48000){
  const DUR=sc.T_END,N=Math.ceil(SR*DUR)+SR;const rnd=rngF(11);const noise=n=>{const a=new Float32Array(n);for(let i=0;i<n;i++)a[i]=rnd()*2-1;return a;};
  const nrm=a=>{let m=0;for(let i=0;i<a.length;i++)m=Math.max(m,Math.abs(a[i]));if(m>0)for(let i=0;i<a.length;i++)a[i]/=m;return a;};
  const DRL=new Float32Array(N),DRR=new Float32Array(N),BDL=new Float32Array(N),BDR=new Float32Array(N),RVS=new Float32Array(N),DLS=new Float32Array(N),DUCK=new Float32Array(N).fill(1);
  const put=(bl,br,st,x,g=1,pan=.5,rv=0,dl=0)=>{const i0=Math.round(st*SR);if(i0>=N||!g)return;const s=Math.max(0,-i0),n=Math.min(x.length,N-i0);
    const gl=g*Math.cos(pan*Math.PI/2)*1.41,gr=g*Math.sin(pan*Math.PI/2)*1.41,gv=g*rv,gd=g*dl;
    for(let i=s;i<n;i++){const v=x[i],k=i0+i;bl[k]+=v*gl;br[k]+=v*gr;if(gv)RVS[k]+=v*gv;if(gd)DLS[k]+=v*gd;}};
  const dry=(st,x,g,pan,rv,dl)=>put(DRL,DRR,st,x,g,pan,rv,dl),bed=(st,x,g,pan,rv)=>put(BDL,BDR,st,x,g,pan,rv,0);
  const duckAt=(st,depth)=>{const i0=Math.round(st*SR),A=Math.round(0.005*SR),Rl=Math.round(0.2*SR);for(let i=0;i<A+Rl;i++){const k=i0+i;if(k<0||k>=N)continue;const e=i<A?i/A:Math.pow(1-(i-A)/Rl,2),v=1-depth*e;if(v<DUCK[k])DUCK[k]=v;}};
  const mtof=m=>440*Math.pow(2,(m-69)/12);const memo=new Map(),M=(k,f)=>{let v=memo.get(k);if(!v){v=f();memo.set(k,v);}return v;};
  const CH=[[53,57,60,64,69],[52,55,59,62,67],[50,53,57,60,65],[48,52,55,59,62]],BASS=[41,40,38,36],chordAt=t=>Math.floor(t/BAR+1e-6)%4,G16=BEAT/4,calm=(sc.style||sc.P&&sc.P.mstyle)==='calm'; // 舒缓: no kick/snare grid, long bass and keys; the year crashes and motif stay
  const section=t=>{if(t<T_OPEN)return'intro';if(t<T_F0)return'reveal';if(t>=sc.T_FE&&t<sc.T_ZOOM)return'hang';if(t>=sc.T_CARD)return'outro';if(t>=sc.T_ZOOM)return'return';
    for(let k=0;k<sc.years.length;k++){const y=sc.years[k];if(y.t<=t&&t<y.end){if(k===0)return'light';if(y.gap)return'gap';if(y.dream)return'dream';return'full';}}return'full';};
  /* ---- voices (mono, cached) ---- */
  const kick=()=>M('k',()=>{const n=Math.floor(0.45*SR),a=new Float32Array(n),ck=nrm(bq(noise(Math.floor(0.015*SR)),'bp',3200,SR,0.9));let ph=0;
    for(let i=0;i<n;i++){const tt=i/SR;ph+=2*Math.PI*(50+130*Math.exp(-tt*30))/SR;let v=Math.sin(ph)*Math.exp(-tt*8.5)+0.35*Math.sin(2*ph)*Math.exp(-tt*28);if(i<ck.length)v+=ck[i]*0.45*Math.exp(-tt*300);a[i]=Math.tanh(v*1.8);}return nrm(a);});
  const snare=()=>M('s',()=>{const n=Math.floor(0.32*SR),nz=bq(bq(noise(n),'hp',1200,SR),'lp',9000,SR),a=new Float32Array(n);
    for(let i=0;i<n;i++){const tt=i/SR;a[i]=nz[i]*Math.exp(-tt*15)*0.6+(Math.sin(2*Math.PI*190*tt)*0.5+Math.sin(2*Math.PI*330*tt)*0.25)*Math.exp(-tt*26)*Math.min(1,tt/0.0015);}return nrm(a);});
  const clap=()=>M('c',()=>{const n=Math.floor(0.25*SR),nz=bq(noise(n),'bp',1300,SR,0.9),a=new Float32Array(n);
    for(let i=0;i<n;i++){const tt=i/SR;let e=0;for(const o of [0,0.011,0.022]){const d=tt-o;if(d>=0)e=Math.max(e,Math.exp(-d*(o<0.02?140:22)));}a[i]=nz[i]*e;}return nrm(a);});
  const metal=(n,fs,seed)=>{const a=new Float32Array(n),ph=fs.map((_,k)=>hash(seed+k));for(let i=0;i<n;i++){const tt=i/SR;let v=0;for(let k=0;k<fs.length;k++)v+=((fs[k]*tt+ph[k])%1<0.5?1:-1);a[i]=v;}return a;};
  const hat=open=>M('h'+open,()=>{const n=Math.floor((open?0.42:0.09)*SR),m=nrm(bq(bq(metal(n,[263,400,421,474,587,845],1),'bp',10000,SR,0.7),'hp',7000,SR)),nz=nrm(bq(noise(n),'hp',8000,SR)),a=new Float32Array(n);
    for(let i=0;i<n;i++){const tt=i/SR;a[i]=(m[i]*0.65+nz[i]*0.45)*Math.exp(-tt*(open?8:48))*Math.min(1,tt/0.0008);}return nrm(a);});
  const shaker=()=>M('sh',()=>{const n=Math.floor(0.09*SR),nz=bq(bq(noise(n),'bp',6500,SR,1.2),'hp',3000,SR);for(let i=0;i<n;i++){const tt=i/SR;nz[i]*=Math.min(1,tt/0.008)*Math.exp(-tt*38);}return nrm(nz);});
  const crash=()=>M('cr',()=>{const n=Math.floor(2.4*SR),m=nrm(bq(metal(n,[340,483,527,612,741,958],9),'hp',4500,SR)),nz=nrm(bq(noise(n),'hp',3800,SR)),a=new Float32Array(n);
    for(let i=0;i<n;i++){const tt=i/SR;a[i]=(nz[i]*0.7+m[i]*0.4)*Math.exp(-tt*1.9)*Math.min(1,tt/0.002);}return nrm(a);});
  const tom=f=>M('t'+f,()=>{const n=Math.floor(0.45*SR),a=new Float32Array(n);let ph=0;for(let i=0;i<n;i++){const tt=i/SR;ph+=2*Math.PI*f*(1+0.6*Math.exp(-tt*30))/SR;a[i]=Math.sin(ph)*Math.exp(-tt*9)*Math.min(1,tt/0.002);}return a;});
  const padBar=(ci,fc,stop)=>M(`p${ci}|${fc}|${stop}`,()=>{const n=Math.floor(BAR*SR*1.25),L=new Float32Array(n),R=new Float32Array(n);
    for(const m of CH[ci]){const f=mtof(m);[-0.0075,-0.0025,0.004,0.0085].forEach((d,j)=>{const ff=f*(1+d),o=j%2?R:L,p0=hash(m*7+j);for(let i=0;i<n;i++){const ph=(ff*i/SR+p0)%1;o[i]+=0.45*(2*ph-1)+0.45*Math.sin(2*Math.PI*ph);}});}
    const fL=bq(bq(L,'lp',fc,SR,0.6),'lp',fc*1.6,SR,0.6),fR=bq(bq(R,'lp',fc,SR,0.6),'lp',fc*1.6,SR,0.6);
    for(let i=0;i<n;i++){const tt=i/SR;let e=Math.min(1,tt/0.35)*Math.min(1,Math.max(0,(n/SR-tt)/0.45));if(stop)e*=clamp((BAR+0.15-tt)/0.15);fL[i]*=e;fR[i]*=e;}return [fL,fR];});
  const ep=(m,len,vel,kind)=>M(`e${m}|${len.toFixed(3)}|${vel}|${kind}`,()=>{const f=mtof(m),n=Math.floor((len+0.5)*SR),a=new Float32Array(n),gl=kind==='glass';
    for(let i=0;i<n;i++){const tt=i/SR,I=(gl?1.2:2*vel)*Math.exp(-tt*(gl?1.5:3.2));let v=Math.sin(2*Math.PI*f*tt+I*Math.sin(2*Math.PI*f*(gl?3.5:1)*tt));if(!gl)v+=0.1*vel*Math.sin(2*Math.PI*f*14*tt)*Math.exp(-tt*40); // FM electric piano / glass
      a[i]=v*vel*Math.min(1,tt/0.004)*Math.exp(-tt*(gl?0.9:1.7))*(tt<len?1:Math.max(0,1-(tt-len)/0.25));}return a;});
  const bassN=(m,len,kind)=>M(`b${m}|${len.toFixed(3)}|${kind}`,()=>{const f=mtof(m),n=Math.floor((len+0.15)*SR),a=new Float32Array(n),gv=kind==='groove';
    for(let i=0;i<n;i++){const tt=i/SR;a[i]=Math.sin(2*Math.PI*f*tt)+(gv?0.28:0.12)*(2*((f*tt)%1)-1)+(gv?0:0.3*Math.sin(4*Math.PI*f*tt));}let y=bq(a,'lp',gv?900:500,SR,0.8);
    for(let i=0;i<n;i++)y[i]=Math.tanh(y[i]*1.7)*0.8;y=bq(y,'lp',1800,SR,0.7);
    const att=kind==='soft'?0.06:0.004,rel=gv?0.03:0.12;for(let i=0;i<n;i++){const tt=i/SR;y[i]*=Math.min(1,tt/att)*(gv?0.75+0.25*Math.exp(-tt*8):Math.exp(-tt*0.5))*(tt<len?1:Math.max(0,1-(tt-len)/rel));}return y;});
  const pluck=(m,dur,br)=>M(`pl${m}|${dur}|${br}`,()=>{const f=mtof(m),n=Math.floor(dur*SR),a=new Float32Array(n); // soft 6 ms attack, upper partials enter later
    for(let i=0;i<n;i++){const tt=i/SR;a[i]=(Math.sin(2*Math.PI*f*tt)+0.35*br*Math.sin(4*Math.PI*f*tt)*Math.exp(-tt*9)*Math.min(1,tt/0.010)+0.15*br*Math.sin(2*Math.PI*3.01*f*tt)*Math.exp(-tt*14)*Math.min(1,tt/0.016))*Math.exp(-tt*4.2)*Math.min(1,tt/0.006);}return a;});
  const voice=(kind,m,len)=>M(`v${kind}|${m}|${len.toFixed(3)}`,()=>{const f=mtof(m),n=Math.floor((len+1.6)*SR),a=new Float32Array(n);
    for(let i=0;i<n;i++){const tt=i/SR,T=2*Math.PI*f*tt;let v=0,e=1;
      if(kind==='celesta'){v=Math.sin(T)+0.4*Math.sin(2.76*T)*Math.exp(-tt*5)+0.2*Math.sin(4*T)*Math.exp(-tt*9);e=Math.exp(-tt*2.4)*Math.min(1,tt/0.004);}
      else if(kind==='marimba'){v=Math.sin(T)+0.35*Math.sin(3.93*T)*Math.exp(-tt*22)+0.12*Math.sin(9.2*T)*Math.exp(-tt*40);e=Math.exp(-tt*5.5)*Math.min(1,tt/0.002);}
      else if(kind==='kalimba'){v=Math.sin(T)+0.28*Math.sin(5.4*T)*Math.exp(-tt*24)+0.1*Math.sin(2*T)*Math.exp(-tt*8);e=Math.exp(-tt*3.2)*Math.min(1,tt/0.003);}
      else if(kind==='vibes'){v=(Math.sin(T)+0.22*Math.sin(4*T)*Math.exp(-tt*5))*(1-0.35*(0.5+0.5*Math.sin(2*Math.PI*5.6*tt)));e=Math.exp(-tt*1.5)*Math.min(1,tt/0.003);}
      else if(kind==='flute'){const T2=T*(1+0.004*Math.sin(2*Math.PI*5.1*tt)*Math.min(1,tt/0.25));v=Math.sin(T2)+0.18*Math.sin(2*T2)+0.06*Math.sin(3*T2);e=Math.min(1,tt/0.045)*(tt<len?1:Math.max(0,1-(tt-len)/0.12));}
      else if(kind==='glock'){v=Math.sin(T)+0.5*Math.sin(2.756*T)*Math.exp(-tt*6)+0.25*Math.sin(5.404*T)*Math.exp(-tt*11);e=Math.exp(-tt*2)*Math.min(1,tt/0.0015);}
      else{v=Math.sin(T+1.1*Math.exp(-tt*1.4)*Math.sin(3.5*T));e=Math.min(1,tt/0.02)*Math.exp(-tt*1.1);} // glass
      a[i]=v*e;}
    if(kind==='flute'){const b=nrm(bq(noise(n),'bp',f*2,SR,2.5));for(let i=0;i<n;i++){const tt=i/SR;a[i]+=b[i]*0.12*Math.min(1,tt/0.03)*(tt<len?1:Math.max(0,1-(tt-len)/0.12));}}
    return a;});
  const pop=m=>M('pop'+m,()=>{const f=mtof(m),n=Math.floor(0.12*SR),a=new Float32Array(n);let ph=0;for(let i=0;i<n;i++){const tt=i/SR;ph+=2*Math.PI*f*(0.7+0.3*Math.min(1,tt/0.02))/SR;a[i]=Math.sin(ph)*Math.min(1,tt/0.0015)*Math.exp(-tt*38);}return a;});
  const tick=()=>M('tk',()=>{const n=Math.floor(0.012*SR),x=bq(noise(n),'bp',3800,SR,1.5);for(let i=0;i<n;i++)x[i]*=Math.exp(-(i/SR)*500);return nrm(x);});
  const swish=(dur,f0,f1)=>{const n=Math.floor(dur*SR),x=noise(n),y=new Float32Array(n);let lo=0,bd=0;
    for(let i=0;i<n;i++){const u=i/n,F=2*Math.sin(Math.PI*f0*Math.pow(f1/f0,u)/SR);lo+=F*bd;const hi=x[i]-lo-0.9*bd;bd+=F*hi;y[i]=bd*Math.pow(Math.sin(Math.PI*u),1.6);}return nrm(y);};
  const thud=()=>M('thud',()=>{const n=Math.floor(0.35*SR),a=new Float32Array(n),nz=bq(noise(n),'lp',900,SR),sl=nrm(bq(noise(n),'bp',1600,SR,0.9));let ph=0;
    for(let i=0;i<n;i++){const tt=i/SR;ph+=2*Math.PI*(52+70*Math.exp(-tt*30))/SR;a[i]=(Math.sin(ph)*Math.exp(-tt*14)+nz[i]*0.6*Math.exp(-tt*40)+sl[i]*0.55*Math.exp(-tt*55))*Math.min(1,tt/0.002);}return nrm(a);});
  /* ---- pad, keys, bass: one chord per bar ---- */
  const nb=Math.ceil(DUR/BAR);
  for(let b=0;b<nb;b++){const t0=b*BAR,sec=section(t0+0.01);if(sec==='hang')continue;const ci=b%4,ch=CH[ci],stop=section(t0+BAR+0.01)==='hang';
    const fc={gap:650,intro:900,outro:1000,dream:1600}[sec]||1400;const [pl,pr]=padBar(ci,fc,stop);const pg=sec==='gap'?0.036:sec==='intro'?0.058:0.042;put(BDL,BDR,t0,pl,pg,0,0.09);put(BDL,BDR,t0,pr,pg,1,0.09);
    if(sec==='intro')continue;
    const kp=!calm&&(sec==='full'||sec==='return')?[[0,5,0.6],[6,3,0.42],[10,5,0.5]]:sec==='light'||sec==='reveal'||sec==='outro'||sec==='dream'?[[0,15,0.5]]:[];
    for(const [s,l,v] of kp){const tt=t0+s*G16,ss=section(tt+1e-4);if(ss==='hang'||ss==='gap')continue;const len=Math.min(l*G16,stop?BAR-s*G16-0.1:9)*0.92,kind=sec==='dream'?'glass':'ep';
      ch.slice(1).forEach((m,j)=>bed(tt+j*0.006,ep(m,len,v,kind),kind==='glass'?0.03:0.042,0.35+0.1*j,0.2));}
    if(!calm&&(sec==='full'||sec==='return')){for(const [s,iv,l] of [[0,0,3],[3,0,1],[6,12,2],[8,0,3],[11,7,1],[12,0,2],[14,12,2]]){const tt=t0+s*G16,ss=section(tt+1e-4);if(ss!=='full'&&ss!=='return')continue;
        let len=l*G16*0.9;if(tt<sc.T_FE)len=Math.min(len,sc.T_FE-tt-0.02);if(len>0.03)bed(tt,bassN(BASS[ci]+iv,len,'groove'),0.1,0.5);}}
    else bed(t0,bassN(BASS[ci],stop?BAR-0.15:BAR,sec==='dream'?'soft':'whole'),sec==='gap'?0.06:0.09,0.5);}
  /* ---- drums on the 16th grid; a tom fill leads into each new year ---- */
  const fill=new Set();
  for(let k=1;k<sc.years.length&&!calm;k++){const y=sc.years[k];if(section(y.t-BEAT*0.5)!=='full'||section(y.t+1e-3)==='gap')continue;const k0=Math.round((y.t-BEAT)/G16);for(let j=0;j<4;j++)fill.add(k0+j);
    [196,165,139,110].forEach((f,j)=>dry(y.t-BEAT+j*G16,tom(f),0.13,0.3+0.13*j,0.12));dry(y.t-G16,snare(),0.05,0.5,0.1);}
  for(let k=0;k*G16<DUR;k++){const tq=k*G16,sec=section(tq+1e-4),q=k%16,inFill=fill.has(k);
    if(calm&&(sec==='light'||sec==='full'||sec==='return')){if(q%4===2)dry(tq,hat(false),0.022,0.65);if(q%2===1)dry(tq,shaker(),0.018,0.4);}
    else if(sec==='light'){if((q===0||q===8)&&!inFill){dry(tq,kick(),0.3,0.5);duckAt(tq,0.18);}if(q%2===0)dry(tq,hat(false),0.04,0.62);else dry(tq,shaker(),0.026,0.38);}
    else if(sec==='full'||sec==='return'){if(!inFill){if(q===0||q===8||q===6||q===10){const big=q===0||q===8;dry(tq,kick(),big?0.34:0.22,0.5);duckAt(tq,big?0.32:0.2);}
        if(q===4||q===12){dry(tq,snare(),0.11,0.5,0.1);dry(tq+0.004,clap(),0.06,0.55,0.14);}}
      dry(tq+(q%2?0.012:0),hat(q===14),q===14?0.05:(q%2?0.035:0.05),0.62);}
    else if(sec==='dream'){if(q%4===2)dry(tq,hat(false),0.025,0.65);if(q%2===1)dry(tq,shaker(),0.016,0.4);}}
  for(const y of sc.years){const g=y.gap?0.02:0.08;dry(y.t,crash(),g,0.38,0.1);dry(y.t+0.007,crash(),g*0.5,0.7);}
  dry(T_OPEN,crash(),0.07,0.5,0.1);dry(T_OPEN,kick(),0.3,0.5);dry(sc.T_ZOOM,crash(),0.12,0.5,0.12);dry(sc.T_ZOOM,kick(),0.36,0.5);duckAt(sc.T_ZOOM,0.4);
  /* ---- takeoff plucks: chord tones, register by distance ---- */
  sc.flights.forEach((fl,i)=>{const ch=CH[chordAt(fl.t0)];let m=ch[i%5]+12;if(fl.km>5000)m=ch[0]+24;if(fl.up)m=ch[(i%3)+2]+24;const long=fl.km>5000||fl.up;let x=pluck(m,long?1.2:0.8,fl.vd?0.5:1);let g=0.07;
    if(fl.vd){x=M(`vd${m}|${long}`,()=>bq(x,'lp',1500,SR));g=0.05;}if(fl.km>5000){g=0.09;dry(fl.t0,pluck(m-12,1.4,1),0.05,0.4,0.12,0.1);}
    dry(fl.t0,x,g*(sc.flights.length>300?0.7:1),0.3+0.4*((i*7)%10)/10,0.14,0.2);});
  /* ---- the three-note motif (A–G–E over Fmaj7): every year states it on its own instrument, moved to that bar's chord ---- */
  const SCL=[0,2,4,5,7,9,11],down=m=>SCL.includes((m+119)%12)?m-1:m-2,motif=ci=>{const c=CH[ci],a=c[4]+12;return [a,down(a),c[3]+12];};
  const KINDS=['celesta','marimba','kalimba','vibes','flute','glock'],KG={celesta:.065,marimba:.075,kalimba:.075,vibes:.065,flute:.05,glock:.05,glass:.05};
  const phrase=(st,ci,kind,g,pan)=>motif(ci).forEach((m,j)=>dry(st+j*BEAT*0.75,voice(kind,m,j<2?BEAT*0.65:BEAT*0.95),g,pan+0.08*(j-1),0.3,0.22));
  let yk=0;for(const y of sc.years){const s=section(y.t+1e-3);if(s==='gap')continue;const kind=s==='dream'?'glass':KINDS[yk++%KINDS.length];
    phrase(y.t,chordAt(y.t),kind,KG[kind],0.56);for(let b=1;b<Math.floor(y.bars);b++){const st=y.t+b*BAR+2*BEAT;if(st<y.end)phrase(st,chordAt(st),kind,KG[kind]*0.6,0.44);}}
  const MOT=[81,79,76];for(const st of [BEAT,sc.T_CARD+BEAT])MOT.forEach((m,j)=>dry(st+j*BEAT*0.75,voice('celesta',m,1.2),0.06,0.4+0.1*j,0.3,0.15));
  for(const st of [BAR+BEAT,sc.T_CARD+BAR+BEAT])MOT.forEach((m,j)=>dry(st+j*BEAT*0.75,voice('celesta',m-2,1.2),0.05,0.6-0.1*j,0.3,0.15));
  /* ---- sound on the picture's events ---- */
  let fi=0;for(const c of sc.order){if(c===sc.P.nat)continue;const tt=sc.visit[c];dry(tt,pop(CH[chordAt(tt)][(fi%3)+2]+24),0.045,0.25+0.5*((fi*3)%7)/6,0.15,0.12);fi++;} // a flag pops in
  for(let k=0;k<88;k+=2)dry(T_OPEN+0.15+BAR*(0.35+0.6*(k+1)/88),tick(),0.05*(0.7+0.3*hash(k+1)),0.35+0.3*hash(k+3)); // MRZ types itself
  {const n=Math.floor(BAR*0.9*SR),x=nrm(bq(noise(n),'bp',1900,SR,2));for(let i=0;i<n;i++){const u=i/n;x[i]*=Math.pow(Math.sin(Math.PI*u),0.6)*(0.55+0.45*Math.sin(2*Math.PI*28*i/SR));}dry(T_OPEN,x,0.03,0.5,0.05);} // map prints row by row
  const c0=sc.T_CARD-0.55;dry(O0,swish(SWG,320,2600),0.1,0.4,0.15);dry(O0+SWG,thud(),0.1,0.5,0.1);dry(c0,swish(SWG,2400,300),0.1,0.6,0.15);dry(c0+SWG,thud(),0.24,0.5,0.2); // cover opens / shuts
  for(const st of [0.9,sc.T_CARD+0.25]){const c=CH[chordAt(st)];[c[1],c[2],c[3],c[4],c[1]+12,c[2]+12].forEach((m,j)=>dry(st+j*BEAT/8,voice('glass',m+24,0.2),0.022*(1-j*0.1),0.2+0.12*j,0.4,0.25));} // foil glint
  {const st=sc.T_FE,T=sc.T_STAMP+0.15,n=Math.floor((T-st)*SR),x=nrm(bq(noise(n),'hp',4500,SR)),r=new Float32Array(n);let ph=0; // hang: reverse swell into the slam
    for(let i=0;i<n;i++){const u=i/n;x[i]*=u*u*u;ph+=2*Math.PI*(600+900*u*u)/SR;r[i]=Math.sin(ph)*u*u*0.5;}dry(st,x,0.06,0.5,0.25);dry(st,r,0.025,0.5,0.2);
    const m=Math.floor(0.9*SR),th=new Float32Array(m),boom=new Float32Array(m);ph=0;for(let i=0;i<m;i++){const tt=i/SR;ph+=2*Math.PI*(40+110*Math.exp(-tt*25))/SR;th[i]=Math.sin(ph)*Math.exp(-tt*8);boom[i]=Math.sin(2*Math.PI*44*tt)*Math.exp(-tt*3.2)*Math.min(1,tt/0.006);}
    const sl=bq(noise(m),'hp',900,SR),ink=bq(noise(m),'lp',3000,SR),wood=nrm(bq(noise(m),'bp',420,SR,2.2)),paper=nrm(bq(noise(m),'bp',2400,SR,0.8));
    for(let i=0;i<m;i++){const tt=i/SR;sl[i]*=Math.exp(-tt*38);ink[i]*=Math.exp(-tt*12)*0.3;wood[i]*=Math.exp(-tt*30);paper[i]*=Math.exp(-tt*45);}
    dry(T-0.14,swish(0.14,5200,900),0.05,0.5);dry(T,th,0.42,0.5,0.08);dry(T,boom,0.16,0.5);dry(T,sl,0.3,0.5,0.35);dry(T+0.02,ink,0.1,0.5,0.2);dry(T,wood,0.34,0.5,0.25);dry(T,paper,0.3,0.5,0.3);
    const rn=Math.floor(0.3*SR),rt=nrm(bq(noise(rn),'bp',2800,SR,1.2));for(let i=0;i<rn;i++){const s=i/SR;rt[i]*=Math.abs(Math.sin(s*95))*(1-s/0.3);}dry(sc.T_STAMP+0.16,rt,0.035,0.5,0.1);} // page rattles with the shake
  {const st=sc.T_STAMP+0.75,n=Math.floor((sc.T_ZOOM-st)*SR);if(n>0){const x=nrm(bq(crash().slice(0,n),'hp',2500,SR).reverse());dry(st,x,0.05,0.5,0.2);}}
  for(let k=0;k*G16<2*BAR;k++){const tq=sc.T_ZOOM+k*G16;if(tq>=sc.T_CARD)break;const c=CH[chordAt(tq)];dry(tq,voice('celesta',c[[1,2,3,4,3,2][k%6]]+24,G16*0.9),0.022*(1-k/48),0.2+0.6*((k*5)%8)/7,0.3,0.2);} // route light pulses
  dry(sc.T_CARD,pluck(29,3.0,0.6),0.25,0.5,0.15);dry(sc.T_CARD,crash(),0.03,0.5,0.1);
  {const r2=rngF(23),ck=bq(Float32Array.from({length:64},(_,i)=>i?0:1),'hp',2000,SR);for(let k=0;k<DUR*8;k++){const st=r2()*DUR,g=(r2()*2-1)*0.1;dry(st,ck,g,r2());} // vinyl tick
    for(let i=0;i<N;i++){const v=(r2()*2-1)*0.0012;DRL[i]+=v;DRR[i]+=v;}}
  /* ---- mixdown ---- */
  pingInto(DLS,SR,BEAT*0.75,DRL,DRR,0.45);reverbInto(RVS,SR,DRL,DRR,1.1);
  const len=Math.floor(DUR*SR),L=new Float32Array(len),R=new Float32Array(len);for(let i=0;i<len;i++){const d=DUCK[i];L[i]=DRL[i]+BDL[i]*d;R[i]=DRR[i]+BDR[i]*d;}
  for(const X of [L,R]){bq(X,'hp',32,SR,0.7071,0,X);bq(X,'ls',110,SR,0.7071,-3.5,X);bq(X,'hs',3000,SR,0.7071,2,X);bq(X,'lp',16500,SR,0.7071,0,X);}
  const gainDb=db=>{const k=Math.pow(10,db/20);for(let i=0;i<len;i++){L[i]*=k;R[i]*=k;}};const CEIL=Math.pow(10,-1.6/20),TARGET=-14;
  gainDb(-18-lufs(L,R,SR));glue(L,R,SR,-15,2);gainDb(TARGET+0.6-lufs(L,R,SR));limiter(L,R,SR,CEIL);
  const got=lufs(L,R,SR);if(got<TARGET-0.3){gainDb(Math.min(3,TARGET-got));limiter(L,R,SR,CEIL);}
  const fi0=Math.floor(0.3*SR),fo=Math.floor(2.5*SR);for(let i=0;i<fi0;i++){L[i]*=i/fi0;R[i]*=i/fi0;}for(let i=Math.max(0,len-fo);i<len;i++){const g=Math.pow((len-i)/fo,1.5);L[i]*=g;R[i]*=g;}
  return {L,R,SR};
}
