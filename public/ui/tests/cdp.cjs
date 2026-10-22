const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const delay = ms => new Promise(resolve => setTimeout(resolve,ms));

async function launchBrowser() {
  // Windows (system and per-user installs), then macOS, then Linux.
  const candidates = [process.env.VOICEVAULT_CHROME,'C:/Program Files/Google/Chrome/Application/chrome.exe',process.env.LOCALAPPDATA&&path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge','/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean);
  const executable = candidates.find(file => fs.existsSync(file));
  if (!executable) throw new Error('An existing Chrome/Edge is required for browser tests. Set VOICEVAULT_CHROME.');
  const tempRoot = path.resolve(os.tmpdir());
  const profile = fs.mkdtempSync(path.join(tempRoot,'voicevault-test-'));
  const chrome = spawn(executable,['--headless','--no-sandbox','--disable-gpu','--disable-gpu-sandbox','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
  const portFile = path.join(profile,'DevToolsActivePort');
  const deadline = Date.now()+15000;
  while(!fs.existsSync(portFile)) { if(Date.now()>deadline){chrome.kill();throw new Error('Chrome DevTools did not start');}await delay(80); }
  const [port,endpoint] = fs.readFileSync(portFile,'utf8').trim().split(/\r?\n/);
  const socket = new WebSocket('ws://127.0.0.1:'+port+endpoint);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let seq=0;const pending=new Map(),listeners=[];
  socket.addEventListener('message',event=>{
    const message=JSON.parse(String(event.data));
    if(message.id&&pending.has(message.id)){const p=pending.get(message.id);pending.delete(message.id);clearTimeout(p.timer);message.error?p.reject(new Error(message.error.message)):p.resolve(message.result);}
    else listeners.forEach(fn=>fn(message));
  });
  function call(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},15000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,sessionId}));});}
  const target=await call('Target.createTarget',{url:'about:blank'});
  const attached=await call('Target.attachToTarget',{targetId:target.targetId,flatten:true});
  const session=attached.sessionId;
  const command=(method,params)=>call(method,params,session);
  await command('Page.enable');await command('Runtime.enable');await command('Network.enable');
  const errors=[],requests=[];
  listeners.push(message=>{if(message.sessionId!==session)return;if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);if(message.method==='Network.requestWillBeSent')requests.push(message.params.request.url);});
  async function evaluate(expression){const result=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;}
  async function waitFor(expression,timeout=8000){const end=Date.now()+timeout;while(Date.now()<end){if(await evaluate(expression))return;await delay(40);}throw new Error('Timed out waiting for '+expression+'\n'+await evaluate('document.body.innerText.slice(0,1200)'));}
  return {
    command,evaluate,waitFor,errors,requests,
    async navigate(url){errors.length=0;requests.length=0;await command('Page.navigate',{url});await waitFor("document.readyState === 'complete'");},
    async click(selector){await evaluate('document.querySelector('+JSON.stringify(selector)+').click()');},
    async screenshot(filename,width=1440,height=1000){await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});await delay(100);const result=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,Buffer.from(result.data,'base64'));},
    async close(){try{await call('Browser.close');}catch{}socket.close();chrome.kill();if(path.dirname(path.resolve(profile))===tempRoot&&path.basename(profile).startsWith('voicevault-test-')){try{fs.rmSync(profile,{recursive:true,force:true});}catch{}}}
  };
}
module.exports={launchBrowser,delay};
