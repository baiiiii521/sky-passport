"use strict";
/* ================= language: 中文 / English for the page (the film itself is bilingual by design) =================
   Static text: elements carry data-en (innerHTML), data-en-ph (placeholder), data-en-aria (aria-label), data-en-alt (alt);
   the Chinese original is kept in data-zh-* the first time English is applied.
   Code: L('中文','English') picks one at call time, so a language switch only needs a re-render, never a reload. */
const LANG_KEY='skypassport.lang';
let LANG=(()=>{try{const q=new URLSearchParams(location.search);const l=q.get('lang');if(l==='en'||l==='zh'){localStorage.setItem(LANG_KEY,l);return l;}
  if(q.has('render')||q.has('site'))return'zh'; // server renders and promo pages stay Chinese unless asked
  const s=localStorage.getItem(LANG_KEY);if(s==='en'||s==='zh')return s;}catch(e){}
  return /^zh/i.test(navigator.language||'')?'zh':'en';})();
const L=(zh,en)=>LANG==='en'?en:zh;
const EN=()=>LANG==='en';
function applyStatic(){
  const en=EN();document.documentElement.lang=en?'en':'zh-CN';
  for(const [attr,prop] of [['en','innerHTML'],['enPh','placeholder'],['enAria','aria-label'],['enAlt','alt']])
    for(const e of document.querySelectorAll('[data-'+attr.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+']')){
      const keep='zh'+attr.slice(2);if(!(keep in e.dataset))e.dataset[keep]=prop==='innerHTML'?e.innerHTML:(e.getAttribute(prop)||'');
      const v=en?e.dataset[attr]:e.dataset[keep];if(prop==='innerHTML')e.innerHTML=v;else e.setAttribute(prop,v);}
  document.title=L('航迹手帐 Sky Passport · 把航班记录做成一本会动的护照','Sky Passport · Turn your flights into a passport film');
  const b=document.getElementById('btnLang');if(b){b.textContent=en?'中文':'EN';b.setAttribute('aria-label',en?'切换到中文':'Switch to English');}}
function setLang(l){if(l===LANG)return;LANG=l;try{localStorage.setItem(LANG_KEY,l);}catch(e){}applyStatic();
  if(typeof onLangChange==='function')onLangChange();}
