"use strict";
/* ================= export ================= */
let DL=null;let lastBlob=null,lastName='';
async function saveFile(name,blob){
  try{if(!DL&&window.claude&&window.claude.use)DL=await window.claude.use('downloads');}catch(e){}
  if(DL){try{await DL.save({filename:name,data:blob});setStatus(L('已交给浏览器保存。','Handed to the browser to save.'));return true;}catch(e){if(e&&e.code==='declined'){setStatus(L('已取消保存。','Saving cancelled.'));return false;}setStatus(L('这里无法保存文件（','Files cannot be saved here (')+(e&&e.code||'unavailable')+L('）。可以在上方视频上长按或右键另存。','). Long-press or right-click the video above to save it.'),true);return false;}}
  try{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();return true;}catch(e){setStatus(L('无法保存文件，请在视频上右键另存。','Could not save the file; right-click the video to save it.'),true);return false;}
}
const IS_WX=/MicroMessenger/i.test(navigator.userAgent);$('wxTip').hidden=!IS_WX;
// phones: the system share sheet offers 「存储视频」 (saves to the photo album); desktop: a normal download
async function saveVideo(){if(!lastBlob)return;if(IS_WX){setStatus(L('微信里不能保存文件：请点右上角「···」→「在浏览器打开」，再生成一次并保存。','WeChat cannot save files: tap ··· (top right) → Open in browser, then make and save the film again.'),true);return;}
  const file=new File([lastBlob],lastName,{type:lastBlob.type||'video/mp4'});
  if(matchMedia('(pointer:coarse)').matches&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:L('航迹护照','Sky Passport')});setStatus(L('在弹出的面板里选「存储视频」即可存到相册。','Choose “Save Video” in the share sheet to put it in your photos.'));return;}catch(e){if(e&&e.name==='AbortError')return;}}
  saveFile(lastName,lastBlob);}
$('btnSave').addEventListener('click',saveVideo);$('btnSave2').addEventListener('click',saveVideo);
$('btnCancel').addEventListener('click',()=>{cancelExport=true;});
$('btnMake').addEventListener('click',async()=>{
  if(!S||!S.ok||exporting)return;
  /* the real-time fallback records from an AudioContext: create and start it inside the tap itself — Safari keeps a context
     created later (after the awaits below) silent, which gave soundless videos */
  let AC=null;try{AC=new (window.AudioContext||window.webkitAudioContext)({sampleRate:48000});AC.resume();}catch(e){}
  stopPlay();exporting=true;cancelExport=false;$('btnMake').disabled=true;$('btnCancel').hidden=false;$('result').hidden=true;
  const prog=$('prog');const setP=p=>prog.style.width=(p*100).toFixed(1)+'%';
  try{
    setStatus(L('正在合成配乐…','Composing the score…'));await Promise.all([ensureFonts(),loadFlags(S.order)]);coverBuilt=false;const A=await ensureAudio();
    let blob,ext;
    if('VideoEncoder' in window&&'AudioEncoder' in window&&window.Mp4Muxer){[blob,ext]=await exportWebCodecs(A,setP,AC);}else{[blob,ext]=await exportRealtime(A,setP,AC);}
    if(!blob)return;lastBlob=blob;lastName=`${L('航迹护照','sky-passport')}_${(S.P.latin||'flight').replace(/\s+/g,'_')}_${S.years[0].y}-${S.years[S.years.length-1].y}.${ext}`;
    const v=$('outVideo');v.src=URL.createObjectURL(blob);$('result').hidden=false;$('saveBar').hidden=false;$('saveInfo').textContent=`${(blob.size/1048576).toFixed(1)} MB · ${ext.toUpperCase()}`;setP(1);setStatus(L(`完成：${(blob.size/1048576).toFixed(1)} MB · ${mmss(S.T_END)}。点「保存视频」下载。`,`Done: ${(blob.size/1048576).toFixed(1)} MB · ${mmss(S.T_END)}. Tap “Save video” to download it.`));
  }catch(e){console.error(e);setStatus(L('生成失败：','Could not make the film: ')+(e.message||e)+L('。换用最新版 Chrome / Edge 一般能解决。','. The latest Chrome or Edge usually works.'),true);}
  finally{exporting=false;$('btnMake').disabled=false;$('btnCancel').hidden=true;drawAt(playT);try{AC&&AC.close();}catch(e){}}
});
async function exportWebCodecs(A,setP,AC){
  const vcands=[['avc','avc1.640028'],['avc','avc1.4d0028'],['avc','avc1.42003e'],['vp9','vp09.00.40.08'],['av1','av01.0.08M.08']];let vcfg=null,vmux='avc';
  for(const [mx,c] of vcands){const cfg={codec:c,width:W,height:H,bitrate:8_000_000,framerate:FPS,latencyMode:'quality'}; /* 8 Mbps: ~28 MB for 30 s, easier to save and share than 10 Mbps */if(mx==='avc')cfg.avc={format:'avc'};try{const s=await VideoEncoder.isConfigSupported(cfg);if(s.supported){vcfg=cfg;vmux=mx;break;}}catch(e){}}
  if(!vcfg)return exportRealtime(A,setP,AC);
  /* AAC only: Opus inside MP4 plays in Chrome but is silent on iPhone, in QuickTime and in many apps; without AAC, record in real time instead */
  let acodec=null,acfg=null;for(const [mc,c] of [['aac','mp4a.40.2']]){const cfg={codec:c,sampleRate:A.SR,numberOfChannels:2,bitrate:192000};try{const s=await AudioEncoder.isConfigSupported(cfg);if(s.supported){acodec=mc;acfg=cfg;break;}}catch(e){}}
  if(!acodec)return exportRealtime(A,setP,AC);
  const muxer=new Mp4Muxer.Muxer({target:new Mp4Muxer.ArrayBufferTarget(),video:{codec:vmux,width:W,height:H,frameRate:FPS},audio:acodec?{codec:acodec,sampleRate:A.SR,numberOfChannels:2}:undefined,fastStart:'in-memory',firstTimestampBehavior:'offset'});
  let err=null;const ve=new VideoEncoder({output:(c,m)=>muxer.addVideoChunk(c,m),error:e=>err=e});ve.configure(vcfg);
  /* Safari/iOS hands back a whole MPEG-4 ES descriptor as decoderConfig.description (39 bytes) where the muxer expects the bare
     AudioSpecificConfig (2 bytes). Wrapped twice, the AAC track cannot be decoded and the MP4 plays silent (in the page, after saving,
     in Photos). Write the config ourselves: AAC-LC, the encoder's sample rate and channel count. */
  const FI=[96000,88200,64000,48000,44100,32000,24000,22050,16000,12000,11025,8000].indexOf(A.SR),ASC=new Uint8Array([(2<<3)|(FI>>1),((FI&1)<<7)|(2<<3)]);
  let ae=null,abytes=0;if(acodec){ae=new AudioEncoder({output:(c,m)=>{abytes+=c.byteLength;if(m&&m.decoderConfig)m={...m,decoderConfig:{...m.decoderConfig,description:ASC}};muxer.addAudioChunk(c,m);},error:e=>err=e});ae.configure(acfg);
    const CH=1024;for(let i=0;i<A.L.length;i+=CH){const n=Math.min(CH,A.L.length-i);const d=new Float32Array(n*2);d.set(A.L.subarray(i,i+n),0);d.set(A.R.subarray(i,i+n),n);
      const ad=new AudioData({format:'f32-planar',sampleRate:A.SR,numberOfFrames:n,numberOfChannels:2,timestamp:Math.round(i/A.SR*1e6),data:d});ae.encode(ad);ad.close();}}
  const N=S.frames,t0=performance.now();
  for(let i=0;i<N;i++){if(cancelExport){setStatus(L('已取消。','Cancelled.'));ve.close();ae&&ae.close();return [null];}if(err)throw err;
    renderFrame(i);const fr=new VideoFrame(cv,{timestamp:Math.round(i*1e6/FPS),duration:Math.round(1e6/FPS)});ve.encode(fr,{keyFrame:i%60===0});fr.close();
    if(ve.encodeQueueSize>6){const w0=performance.now();const ok=await new Promise(r=>{const chk=()=>ve.encodeQueueSize<=2?r(true):performance.now()-w0>8000?r(false):setTimeout(chk,5);chk();});
      if(!ok){console.warn('video encoder stalled');try{ve.close();ae&&ae.close();}catch(e){}return exportRealtime(A,setP,AC);}} /* an encoder that stops answering must not hang the page */
    if(i%15===0){setP(i/N);const el=(performance.now()-t0)/1000,eta=el/(i+1)*(N-i-1);setStatus(L(`正在渲染第 ${i+1} / ${N} 帧 · 预计还要 ${Math.ceil(eta)} 秒`,`Rendering frame ${i+1} / ${N} · about ${Math.ceil(eta)} s left`));await new Promise(r=>setTimeout(r,0));}}
  await ve.flush();if(ae)await ae.flush();if(err)throw err;
  if(abytes<A.L.length/48000*2000){console.warn('audio encoder produced no sound',abytes);return exportRealtime(A,setP,AC);} /* ≥ ~16 kbit/s or it did not really encode */
  muxer.finalize();
  return [new Blob([muxer.target.buffer],{type:'video/mp4'}),'mp4'];
}
async function exportRealtime(A,setP,AC){
  if(!cv.captureStream||!window.MediaRecorder)throw new Error(L('这个浏览器不支持在网页里生成视频','this browser cannot make videos in a web page'));
  setStatus(L('这个浏览器不支持快速编码，改为实时录制，需要和视频一样长的时间…','No fast encoder in this browser: recording in real time, which takes as long as the film…'));
  const ac=AC||new (window.AudioContext||window.webkitAudioContext)({sampleRate:A.SR});const buf=ac.createBuffer(2,A.L.length,A.SR);buf.copyToChannel(A.L,0);buf.copyToChannel(A.R,1);
  const src=ac.createBufferSource();src.buffer=buf;const dest=ac.createMediaStreamDestination();src.connect(dest);
  const vs=cv.captureStream(FPS);const stream=new MediaStream([...vs.getVideoTracks(),...dest.stream.getAudioTracks()]);
  const mime=['video/mp4;codecs=avc1,mp4a','video/mp4','video/webm;codecs=vp9,opus','video/webm'].find(m=>MediaRecorder.isTypeSupported(m))||'';
  const rec=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:8e6}:{});const parts=[];rec.ondataavailable=e=>e.data.size&&parts.push(e.data);
  const done=new Promise(r=>rec.onstop=r);rec.start(500);await ac.resume();src.start();const t0=ac.currentTime;
  await new Promise(res=>{const loop=()=>{const t=ac.currentTime-t0;if(cancelExport||t>=S.T_END){res();return;}renderFrame(Math.floor(t*FPS));setP(t/S.T_END);setStatus(L(`实时录制中 ${mmss(t)} / ${mmss(S.T_END)}`,`Recording ${mmss(t)} / ${mmss(S.T_END)}`));requestAnimationFrame(loop);};loop();});
  rec.stop();await done;try{src.stop();}catch(e){}if(ac!==AC)ac.close();if(cancelExport){setStatus(L('已取消。','Cancelled.'));return [null];}
  const isMp4=/mp4/.test(rec.mimeType||mime);return [new Blob(parts,{type:isMp4?'video/mp4':'video/webm'}),isMp4?'mp4':'webm'];
}

/* ================= boot ================= */
applyStatic();initGuide(); // language first, so nothing flashes in the other one
(async function boot(){
  ctx.fillStyle='#1a060b';ctx.fillRect(0,0,W,H);ctx.fillStyle='#e3bd84';ctx.font='600 40px sans-serif';ctx.textAlign='center';ctx.fillText(L('正在加载地图与机场数据…','Loading maps and airports…'),W/2,H/2);ctx.textAlign='left';
  try{await loadData();}catch(e){setStatus(L('数据加载失败，请刷新页面。','Could not load the data — please reload the page.'),true);return;}
  $('nat').value='CN';natOptions();$('nat').value='CN'; // the sample traveller is Chinese; a user's own data switches to their region (natForUser)
  await ensureFonts();
  RAW=demoRows();SOURCE='demo';
  buildScene();renderSummary();playT=S.T_END*0.62;drawAt(playT);playT=0;scheduleAudio();
})();
