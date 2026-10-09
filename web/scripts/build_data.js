const fs=require('fs');
const arr=require('@nwpr/airport-codes');const AP=(arr.default||arr);
const countries=require('i18n-iso-countries');countries.registerLocale(require('i18n-iso-countries/langs/en.json'));
const dn=new Intl.DisplayNames(['en'],{type:'region'});
const name2iso={};
for(const c of Object.keys(countries.getAlpha2Codes())){name2iso[dn.of(c).toLowerCase()]=c;const n=countries.getName(c,'en');if(n)name2iso[n.toLowerCase()]=c;
  const alls=countries.getNames('en',{select:'all'})[c];if(Array.isArray(alls))alls.forEach(a=>name2iso[a.toLowerCase()]=c);}
Object.assign(name2iso,{'macau':'MO','hong kong':'HK','south korea':'KR','north korea':'KP','russia':'RU','vietnam':'VN','taiwan':'TW','laos':'LA','burma':'MM','myanmar':'MM','iran':'IR','syria':'SY','czech republic':'CZ','united states':'US','united kingdom':'GB','east timor':'TL','cote d\'ivoire':'CI',"cote d'ivoire":'CI','congo (kinshasa)':'CD','congo (brazzaville)':'CG','brunei':'BN','bolivia':'BO','venezuela':'VE','tanzania':'TZ','moldova':'MD','macedonia':'MK','palestine':'PS','west bank':'PS','cape verde':'CV','swaziland':'SZ','micronesia':'FM','virgin islands':'VI','british virgin islands':'VG','reunion':'RE','saint helena':'SH','svalbard':'SJ','wallis and futuna':'WF','falkland islands':'FK','netherlands antilles':'CW','turks and caicos islands':'TC','saint kitts and nevis':'KN','saint vincent and the grenadines':'VC','saint lucia':'LC','saint pierre and miquelon':'PM','johnston atoll':'UM','wake island':'UM','midway islands':'UM','christmas island':'CX','cocos (keeling) islands':'CC','north macedonia':'MK','kosovo':'XK'});
const miss=new Set();const rows=[];
for(const a of AP){ if(!a.iata||a.iata.length!==3||!/^[A-Z]{3}$/.test(a.iata))continue;
  const iso=name2iso[(a.country||'').toLowerCase()];if(!iso){miss.add(a.country);continue;}
  rows.push([a.iata,+a.latitude.toFixed(3),+a.longitude.toFixed(3),a.tz&&a.tz!=='\\N'?a.tz:'',iso,a.city||'',a.name||'']);}
// prefer larger/known entries for duplicate IATA: keep first
const seen=new Set();const out=[];for(const r of rows){if(seen.has(r[0]))continue;seen.add(r[0]);out.push(r);}
// add missing modern airports
const extra=[['PKX',39.509,116.410,'Asia/Shanghai','CN','Beijing','Beijing Daxing International Airport'],['TFU',30.313,104.444,'Asia/Shanghai','CN','Chengdu','Chengdu Tianfu International Airport'],['BER',52.367,13.503,'Europe/Berlin','DE','Berlin','Berlin Brandenburg Airport'],['SAI',13.371,104.224,'Asia/Phnom_Penh','KH','Siem Reap','Siem Reap-Angkor International Airport'],['EHU',30.341,115.034,'Asia/Shanghai','CN','Ezhou','Ezhou Huahu Airport'],['YIA',-7.905,110.057,'Asia/Jakarta','ID','Yogyakarta','Yogyakarta International Airport'],['NQZ',51.022,71.467,'Asia/Almaty','KZ','Astana','Nursultan Nazarbayev International Airport'],['IST',41.262,28.742,'Europe/Istanbul','TR','Istanbul','Istanbul Airport'],['ZHY',37.573,105.154,'Asia/Shanghai','CN','Zhongwei','Zhongwei Shapotou Airport'],['AXF',38.748,105.589,'Asia/Shanghai','CN','Alxa Left Banner','Alxa Left Banner Bayanhot Airport'],['UBN',47.646,106.820,'Asia/Ulaanbaatar','MN','Ulaanbaatar','Chinggis Khaan International Airport'],['VDO',21.118,107.415,'Asia/Ho_Chi_Minh','VN','Van Don','Van Don International Airport'],['HZG',33.134,107.206,'Asia/Shanghai','CN','Hanzhong','Hanzhong Chenggu Airport'],
['INC',38.322,106.393,'Asia/Shanghai','CN','Yinchuan','Yinchuan Hedong International Airport'],['NTG',32.071,120.976,'Asia/Shanghai','CN','Nantong','Nantong Xingdong Airport'],['HSC',24.081,113.420,'Asia/Shanghai','CN','Shaoguan','Shaoguan Danxia Airport'],['YYA',29.312,113.281,'Asia/Shanghai','CN','Yueyang','Yueyang Sanhe Airport'],['XAI',32.541,114.079,'Asia/Shanghai','CN','Xinyang','Xinyang Minggang Airport'],['WHA',31.100,118.660,'Asia/Shanghai','CN','Wuhu','Wuhu Xuanzhou Airport'],['TVS',39.717,118.003,'Asia/Shanghai','CN','Tangshan','Tangshan Sannuhe Airport'],['BZX',31.738,106.645,'Asia/Shanghai','CN','Bazhong','Bazhong Enyang Airport'],['WSK',31.064,109.709,'Asia/Shanghai','CN','Wushan','Chongqing Wushan Airport'],['FSZ',34.796,138.189,'Asia/Tokyo','JP','Shizuoka','Mt. Fuji Shizuoka Airport'],['UTR',17.628,100.096,'Asia/Bangkok','TH','Uttaradit','Uttaradit Airport'],['THD',19.902,105.468,'Asia/Ho_Chi_Minh','VN','Thanh Hoa','Tho Xuan Airport']];
for(const e of extra){const i=out.findIndex(r=>r[0]===e[0]);if(i>=0)out[i]=e;else out.push(e);}
console.log('airports',out.length,'missing countries',[...miss].slice(0,40));
const zh=require('./zh_airports.js');const ids=new Set(out.map(r=>r[0]));
console.log('zh keys',Object.keys(zh).length,'unknown iata',Object.entries(zh).filter(([k,v])=>!ids.has(v)));
// iso numeric for world-atlas
const num={};for(const c of Object.keys(countries.getAlpha2Codes())){num[c]=+countries.alpha2ToNumeric(c);}
const names={};for(const c of Object.keys(num)){names[c]=[dn.of(c), new Intl.DisplayNames(['zh-CN'],{type:'region'}).of(c), countries.alpha2ToAlpha3(c)];}
fs.writeFileSync('public/airports.json',JSON.stringify({cols:['iata','lat','lon','tz','iso','city','name'],rows:out,zh,num,names}));
// flags
const flags={};for(const f of fs.readdirSync('node_modules/flag-icons/flags/1x1')){flags[f.replace('.svg','').toUpperCase()]='data:image/svg+xml;base64,'+fs.readFileSync('node_modules/flag-icons/flags/1x1/'+f).toString('base64');}
fs.writeFileSync('public/flags.json',JSON.stringify(flags));
fs.copyFileSync('node_modules/world-atlas/countries-50m.json','public/world-50m.json');
