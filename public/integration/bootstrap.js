/* Minimal baseline owned by Tung. No LIVE implementation or credentials are included. */
(function(global){
  'use strict';
  function problem(code){
    document.body.dataset.appState='error';
    var root=document.getElementById('app');root.replaceChildren();
    var box=document.createElement('section');box.className='startup error';
    var h=document.createElement('h1');h.textContent='Connection unavailable';
    var p=document.createElement('p');p.textContent=code==='CONTRACT_MISMATCH'?'The interface and runtime use different contract versions. Update them from the same handoff.':'The LIVE runtime is unavailable. Open the HTML file directly for the simulation, or wait for the system connection to be configured.';
    var badge=document.createElement('code');badge.textContent=code;
    box.append(h,p,badge);root.appendChild(box);
  }
  async function start(){
    try{
      if(!global.VoiceVaultUI)throw new Error('CONTRACT_MISMATCH');
      var runtime;
      if(global.location.protocol==='file:'){
        if(!global.VoiceVaultFixtures||global.VoiceVaultFixtures.contractVersion!=='v1'||typeof global.createVoiceVaultMock!=='function')throw new Error('CONTRACT_MISMATCH');
        runtime=global.createVoiceVaultMock(global.VoiceVaultFixtures);
      }else{
        await new Promise(function(resolve,reject){
          var script=document.createElement('script'),timer=setTimeout(function(){reject(new Error('POLICY_UNAVAILABLE'));},10000);
          script.src=new URL('../integration/runtime.generated.js',global.location.href).href;
          script.onload=function(){clearTimeout(timer);resolve();};script.onerror=function(){clearTimeout(timer);reject(new Error('POLICY_UNAVAILABLE'));};document.head.appendChild(script);
        });
        if(typeof global.createVoiceVaultLiveRuntime!=='function')throw new Error('POLICY_UNAVAILABLE');
        runtime=await global.createVoiceVaultLiveRuntime();
        if(!runtime||runtime.mode!=='LIVE')throw new Error('CONTRACT_MISMATCH');
      }
      if(runtime.contractVersion!=='v1')throw new Error('CONTRACT_MISMATCH');
      global.VoiceVaultRuntime=runtime;
      await global.VoiceVaultUI.mount(runtime);
    }catch(error){problem(error.message==='CONTRACT_MISMATCH'?'CONTRACT_MISMATCH':'POLICY_UNAVAILABLE');}
  }
  start();
}(window));
