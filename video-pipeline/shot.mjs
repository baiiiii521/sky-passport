import { chromium } from 'playwright-core';
import fs from 'fs';
const exe=process.env.CHROME_PATH||undefined; // e.g. /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
const b=await chromium.launch({executablePath:exe,channel:exe?undefined:'chrome',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:1080,height:1920}});
p.on('console',m=>console.log('LOG',m.text()));p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://localhost:8765/video-pipeline/renderer.html'); // serve the repo root: python3 -m http.server 8765
await p.waitForFunction('window.READY===true',null,{timeout:30000});
const total=await p.evaluate('TOTAL_FRAMES');console.log('frames',total, await p.evaluate('[T_ZOOM,T_CARD]'));
fs.mkdirSync('../out',{recursive:true});fs.writeFileSync('../out/tl.json',JSON.stringify(await p.evaluate('TL')));
const mode=process.argv[2];
if(mode==='test'){
  for(const s of process.argv.slice(3)){const i=Math.round(parseFloat(s)*30);await p.evaluate(i=>renderFrame(i),i);await p.screenshot({path:`test_${s}.png`});}
}else{
  const {spawn}=await import('child_process');
  const ff=spawn('ffmpeg',['-y','-f','image2pipe','-framerate','30','-i','-','-c:v','libx264','-pix_fmt','yuv420p','-crf','18','-preset','medium','-movflags','+faststart','../out/out_noaudio.mp4'],{stdio:['pipe','inherit','inherit']});
  for(let i=0;i<total;i++){await p.evaluate(i=>renderFrame(i),i);const buf=await p.screenshot({type:'jpeg',quality:95});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));if(i%150===0)console.log(i);}
  ff.stdin.end();await new Promise(r=>ff.on('close',r));
}
await b.close();
