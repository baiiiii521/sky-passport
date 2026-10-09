"""Score locked to the video timeline (tl.json): 112 BPM grid, one chord per bar,
per-flight takeoff plucks, year downbeat accents, pandemic breakdown,
ending: stop - hang - SLAM (stamp) - groove returns - close on poster."""
import numpy as np, json
from scipy.signal import butter, sosfilt
from scipy.io import wavfile
TL=json.load(open('../out/tl.json'))
SR=44100; DUR=TL['T_END']; N=int(SR*DUR)+SR
rng=np.random.default_rng(11)
BAR=TL['bar']; BEAT=BAR/4
L=np.zeros(N); R=np.zeros(N)
def lp(x,fc,o=2): return sosfilt(butter(o,fc/(SR/2),'low',output='sos'),x)
def hp(x,fc,o=2): return sosfilt(butter(o,fc/(SR/2),'high',output='sos'),x)
def mtof(m): return 440*2**((m-69)/12)
def add(st,x,g=1.0,pan=0.5):
    i=int(st*SR)
    if i>=N or i<0: return
    n=min(len(x),N-i); L[i:i+n]+=x[:n]*g*(1-pan)*2*0.5+x[:n]*g*0.5*(1-abs(pan-0.5)); R[i:i+n]+=x[:n]*g*pan*2*0.5+x[:n]*g*0.5*(1-abs(pan-0.5))
CH=[[53,57,60,64,69],[52,55,59,62,67],[50,53,57,60,65],[48,52,55,59,62]]  # Fmaj7 Em7 Dm7 Cmaj7(9)
BASS=[41,40,38,36]
T_OPEN,T_F0,T_FE,T_STAMP,T_ZOOM,T_CARD=[TL[k] for k in ('T_OPEN','T_F0','T_FE','T_STAMP','T_ZOOM','T_CARD')]
years={y['y']:(y['t'],y['end']) for y in TL['years']}
def section(t):
    if t<T_OPEN: return 'intro'
    if t<T_F0: return 'reveal'
    if t>=T_FE and t<T_ZOOM: return 'hang'
    if t>=T_CARD: return 'outro'
    if t>=T_ZOOM: return 'return'
    for y,(a,b) in years.items():
        if a<=t<b:
            if y==2016: return 'light'
            if y in (2021,2022,2023,2024): return 'gap'
            if y==2027: return 'dream'
            return 'full'
    return 'full'
nbars=int(np.ceil(DUR/BAR))
# ---- pad + bass per bar
for b in range(nbars):
    t0=b*BAR; sec=section(t0+0.01)
    if sec=='hang':
        continue
    ch=CH[b%4]; n=int(BAR*SR*1.25); tt=np.arange(n)/SR
    pad=np.zeros(n)
    for m in ch:
        f=mtof(m)
        for d in (-0.07,0.07):
            ff=f*(1+d/100*12); pad+=0.5*(2*((ff*tt)%1)-1)+0.5*np.sin(2*np.pi*ff*tt)
    fc={'gap':650,'intro':900,'outro':1000,'dream':1600}.get(sec,1400)
    env=np.minimum(1,tt/0.35)*np.minimum(1,np.maximum(0,(n/SR-tt)/0.45))
    # if next bar is the hang, stop fast (150ms) at bar end
    if section(t0+BAR+0.01)=='hang':
        env*=np.clip((BAR+0.15-tt)/0.15,0,1)
    pad=lp(pad,fc)*env*(0.03 if sec!='gap' else 0.026)
    add(t0,pad,1,0.45); add(t0+0.004,pad,1,0.55)
    if sec in ('intro',): continue
    f=mtof(BASS[b%4]); bn=int(BAR*SR); bt=np.arange(bn)/SR
    bs=(np.sin(2*np.pi*f*bt)+0.3*np.sin(4*np.pi*f*bt))*np.minimum(1,bt/0.01)*np.exp(-bt*0.5)
    if section(t0+BAR+0.01)=='hang': bs*=np.clip((BAR+0.0-bt)/0.15,0,1)
    add(t0,bs,0.10 if sec!='gap' else 0.06)
# ---- drums
def kick(n=int(0.45*SR)):
    t=np.arange(n)/SR; f=48+95*np.exp(-t*32); return np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t*7.5)
def snare(n=int(0.28*SR)):
    t=np.arange(n)/SR; return hp(rng.standard_normal(n),1400)*np.exp(-t*17)*0.6+np.sin(2*np.pi*185*t)*np.exp(-t*24)*0.4
def hat(n=int(0.07*SR),open_=False):
    t=np.arange(n if not open_ else int(0.3*SR))/SR; return hp(rng.standard_normal(len(t)),7500)*np.exp(-t*(45 if not open_ else 12))
def crash(n=int(1.6*SR)):
    t=np.arange(n)/SR; return hp(rng.standard_normal(n),4000)*np.exp(-t*2.6)
G16=BEAT/4
tq=0.0
k=0
while tq<DUR:
    sec=section(tq+1e-4); q=k%16
    if sec in ('light','full','return'):
        if q in (0,8) or (sec!='light' and q in (6,10)): add(tq,kick(),0.34 if q in (0,8) else 0.22)
        if sec!='light' and q in (4,12): add(tq,snare(),0.11)
        if q%2==0 or sec=='full' or sec=='return':
            sw=0.012 if q%2 else 0
            add(tq+sw,hat(open_=(q==14 and sec!='light')),(0.035 if q%2 else 0.05)*(0.8 if sec=='light' else 1),0.62)
    elif sec=='dream':
        if q%4==2: add(tq,hat(),0.025,0.65)
    k+=1; tq=k*G16
# ---- year downbeat accents (skip gap years) + open + zoom
for y,(a,b) in years.items():
    if y in (2021,2023,2024): add(a,crash()*0.4,0.05,0.4); continue
    add(a,crash(),0.08,0.38)
add(T_OPEN,crash(),0.07,0.5); add(T_OPEN,kick(),0.3)
add(T_ZOOM,crash(),0.12,0.5); add(T_ZOOM,kick(),0.36)
# ---- per-flight takeoff plucks (chord tones, register by distance)
def pluck(f,dur=0.9,bright=1.0):
    n=int(dur*SR); t=np.arange(n)/SR
    x=(np.sin(2*np.pi*f*t)+0.35*bright*np.sin(2*np.pi*2*f*t)*np.exp(-t*9)+0.15*bright*np.sin(2*np.pi*3.01*f*t)*np.exp(-t*14))
    return x*np.exp(-t*4.2)*np.minimum(1,t/0.003)
for i,fl in enumerate(TL['flights']):
    b=int(fl['t0']/BAR); ch=CH[b%4]
    idx=i%5; m=ch[idx]+12
    if fl['km']>5000: m=ch[0]+24
    if fl['up']: m=ch[(i%3)+2]+24
    g=0.07
    x=pluck(mtof(m),1.2 if fl['km']>5000 or fl['up'] else 0.8, 0.5 if fl['vd'] else 1.0)
    if fl['vd']: x=lp(x,1500); g=0.05
    if fl['km']>5000: g=0.09; add(fl['t0'],pluck(mtof(m-12),1.4),0.05,0.4)
    add(fl['t0'],x,g,0.3+0.4*((i*7)%10)/10)
# ---- intro & outro motif (3 notes, bell)
def bell(f,dur=1.6):
    n=int(dur*SR); t=np.arange(n)/SR
    return (np.sin(2*np.pi*f*t)+0.4*np.sin(2*np.pi*2.76*f*t)*np.exp(-t*5))*np.exp(-t*2.4)*np.minimum(1,t/0.004)
MOT=[81,79,76]  # A5 G5 E5
for st in (BEAT*1, T_CARD+BEAT*1):
    for j,m in enumerate(MOT): add(st+j*BEAT*0.75,bell(mtof(m)),0.06,0.4+0.1*j)
for st in (BAR+BEAT, T_CARD+BAR+BEAT):
    for j,m in enumerate([m-2 for m in MOT]): add(st+j*BEAT*0.75,bell(mtof(m)),0.05,0.6-0.1*j)
# ---- hang: tiny rising tone into the slam
n=int((T_STAMP-T_FE)*SR); t=np.arange(n)/SR; f=600+900*(t/t[-1])**2
add(T_FE,np.sin(2*np.pi*np.cumsum(f)/SR)*(t/t[-1])**2*0.5,0.025)
# ---- SLAM: stamp
n=int(0.6*SR); t=np.arange(n)/SR
thump=np.sin(2*np.pi*np.cumsum(40+110*np.exp(-t*25))/SR)*np.exp(-t*8)
slap=hp(rng.standard_normal(n),900)*np.exp(-t*38)
ink=lp(rng.standard_normal(n),3000)*np.exp(-t*12)*0.3
add(T_STAMP+0.15,thump,0.55); add(T_STAMP+0.15,slap,0.22); add(T_STAMP+0.17,ink,0.1)
# ---- final low pluck on tonic at the close
add(T_CARD,pluck(mtof(29),3.0,0.6),0.25); add(T_CARD,crash()*0.5,0.06)
# ---- vinyl
cr=np.zeros(N); idx=rng.integers(0,N,int(DUR*8)); cr[idx]=rng.uniform(-1,1,len(idx))
cr=hp(cr,2000)*0.12+lp(rng.standard_normal(N),5000)*0.0035
L+=cr; R+=cr
L=lp(L,8000); R=lp(R,8000)
mx=np.tanh(np.stack([L,R],1)*1.5)[:int(DUR*SR)]
fi=int(0.8*SR); fo=int(2.5*SR)
mx[:fi]*=np.linspace(0,1,fi)[:,None]; mx[-fo:]*=np.linspace(1,0,fo)[:,None]**1.5
mx/=np.abs(mx).max()/0.89
wavfile.write('../out/music.wav',SR,(mx*32767).astype(np.int16))
print('ok',round(DUR,2))
