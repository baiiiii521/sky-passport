import pandas as pd, json, sys, re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from airports import A
x=pd.read_excel(sys.argv[1],sheet_name=None)
v=x['无效票 34'].copy()
VD={2:'2021-04-29',3:'2020-04-05',4:'2020-04-05',5:'2020-04-05',6:'2020-04-05',7:'2020-04-07',8:'2018-08-27',9:'2018-08-27',10:'2018-03-27',11:'2018-04-25',
 15:'2018-07-10',16:'2019-01-20',17:'2019-01-20',18:'2017-08-16',19:'2017-08-16',20:'2017-08-16',21:'2017-08-16',22:'2017-08-16',23:'2017-08-16',
 24:'2020-04-07',25:'2020-04-07',26:'2020-04-07',27:'2020-12-15',28:'2021-03-15',29:'2023-06-15',30:'2020-02-10',31:'2020-02-10',32:'2020-02-10',33:'2020-02-10'}
VT={20:'09:00',19:'10:00',18:'11:00',23:'13:00',22:'14:00',21:'15:00',7:'08:20',26:'12:00',25:'16:00',24:'20:00',33:'08:00',32:'14:00',31:'20:00',30:'23:00',17:'09:00',16:'15:00',3:'09:00',4:'12:00',5:'18:00',6:'21:00',8:'09:00',9:'18:00'}
for i,dd in VD.items():
    y,m,dy=dd.split('-');v.loc[i,'日期']=f'{int(y)}年{int(m)}月{int(dy)}日'
for i in v.index:
    if v.loc[i,'出发时间']=='--': v.loc[i,'出发时间']=VT.get(i,'12:00')
    if v.loc[i,'到达时间']=='--': v.loc[i,'到达时间']=None
    if v.loc[i,'航班号']=='--': v.loc[i,'航班号']='TRANSFER'
v['航班号']=[f if f!='TRANSFER' else 'SURFACE' for f in v['航班号']]
d=pd.concat([x['待出行 4'].assign(up=1,vd=0),x['已结束 188'].assign(up=0,vd=0),v.assign(up=0,vd=1)])
d=d[~((d['出发城市']=='伊比萨')&(d['到达城市']=='博洛尼亚'))]
out=[];seen=set()
for _,r in d.iterrows():
    m=re.match(r'(\d+)年(\d+)月(\d+)日',r['日期']); y,mo,da=map(int,m.groups())
    if (y,mo,da)==(2018,1,6) and r['航班号']=='S7505': y=2019
    key=(y,mo,da,r['航班号'],r['出发城市'],r['到达城市'],str(r['客票号']) if r['vd'] else '')
    if key in seen: continue
    seen.add(key)
    a,b=A[r['出发城市']],A[r['到达城市']]
    h,mi=map(int,r['出发时间'].split(':')); dep=datetime(y,mo,da,h,mi,tzinfo=ZoneInfo(a[3]))
    est=int(r['里程数'].replace('公里',''))/780*60+35
    at=r['到达时间'] if isinstance(r['到达时间'],str) else None
    if at is None: arr=dep+timedelta(minutes=est)
    else:
        h,mi=map(int,at.split(':')); arr=datetime(y,mo,da,h,mi,tzinfo=ZoneInfo(b[3]))
    cands=[int((arr+timedelta(days=k)-dep).total_seconds()//60) for k in (-1,0,1,2)]
    dur=min([c for c in cands if c>0],key=lambda c:abs(c-est))
    out.append(dict(date=f'{y:04d}-{mo:02d}-{da:02d}',t=r['出发时间'],fn=r['航班号'],al=r['航空公司'],
      f=a[0],to=b[0],fc=a[4],tc=b[4],km=int(str(r['里程数']).replace('公里','')),min=dur,up=int(r['up']),vd=int(r['vd'])))
out.sort(key=lambda o:(o['date'],o['t']))
ap={k[0]:dict(lat=k[1],lon=k[2],c=k[4]) for k in A.values()}
json.dump(dict(flights=out,airports=ap),open('../data/private/data.json','w'),ensure_ascii=False)
print(len(out), sum(o['km'] for o in out), sum(o['min'] for o in out)/60)
print(len({o['al'] for o in out}), len({o['f'] for o in out}|{o['to'] for o in out}))
cs=[];[cs.append(c) for o in out for c in (o['fc'],o['tc']) if c not in cs];print(cs)
for o in out:
    sp=o['km']/(o['min']/60)
    if sp<350 or sp>950: print('CHECK',o,round(sp))
