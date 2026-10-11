// Preview / upload the mini program from the Tencent Cloud server with the official miniprogram-ci
// (the developer's own network to WeChat's servers is too slow from abroad).
//   node mp_ci.js preview                 → /home/ubuntu/mp/preview.jpg (QR for the phone, valid ~25 min)
//   node mp_ci.js upload 1.0.0 "说明"     → uploads a version; then set it as 体验版 / submit for review in mp.weixin.qq.com
// Needs: the code-upload key at /home/ubuntu/.wx/private.key and this server's IP in the 小程序代码上传 IP whitelist.
'use strict';
const ci = require('miniprogram-ci');
const [mode = 'preview', version = '1.0.0', desc = '航迹手帐'] = process.argv.slice(2);
const project = new ci.Project({
  appid: 'wx49f39c4e21487f55',
  type: 'miniProgram',
  projectPath: '/home/ubuntu/mp/src',
  privateKeyPath: '/home/ubuntu/.wx/private.key',
  ignores: ['node_modules/**/*', 'README.md', 'ci/**/*'],
});
const setting = { es6: true, minify: true, minifyJS: true, minifyWXSS: true, minifyWXML: true, autoPrefixWXSS: true };

(async () => {
  if (mode === 'upload') {
    const r = await ci.upload({ project, version, desc, setting, robot: 1 });
    console.log('uploaded', version, JSON.stringify(r.subPackageInfo || r));
  } else {
    await ci.preview({ project, desc, setting, robot: 1, qrcodeFormat: 'image', qrcodeOutputDest: '/home/ubuntu/mp/preview.jpg' });
    console.log('preview QR → /home/ubuntu/mp/preview.jpg');
  }
})().catch(e => { console.error('FAILED:', e && (e.message || e)); process.exit(1); });
