/* Classic-script handoff: local files simulate; HTTP(S) requires the LIVE adapter. */
(function(global){
  'use strict';
  var pending;
  function fail(code){throw new Error(code);}
  function problem(code){
    document.body.dataset.appState='error';
    var root=document.getElementById('app')||document.body;
    root.replaceChildren();
    var box=document.createElement('section');box.className='startup error';box.setAttribute('role','alert');
    var h=document.createElement('h1');h.textContent='Connection unavailable';
    var p=document.createElement('p');p.textContent=code==='CONTRACT_MISMATCH'?'The interface and runtime use different contract versions. Update them from the same handoff.':'The runtime could not open the workspace. Check the connection and runtime configuration.';
    var badge=document.createElement('code');badge.textContent=code;
    box.append(h,p,badge);root.appendChild(box);
  }
  function loadScript(src){
    return new Promise(function(resolve,reject){
      var script=document.createElement('script');
      var timer=setTimeout(function(){finish(new Error('LIVE_RUNTIME_UNAVAILABLE'));},10000);
      function finish(error){
        clearTimeout(timer);script.onload=null;script.onerror=null;
        if(error){script.remove();reject(error);}else resolve();
      }
      script.src=src;script.onload=function(){finish();};
      script.onerror=function(){finish(new Error('LIVE_RUNTIME_UNAVAILABLE'));};
      document.head.appendChild(script);
    });
  }
  async function start(options){
    var mode=null;
    var html=document.documentElement;
    html.dataset.vvState='loading';
    try{
      var protocol=global.location.protocol;
      if(protocol!=='file:'&&protocol!=='http:'&&protocol!=='https:')fail('UNSUPPORTED_ORIGIN');
      mode=protocol==='file:'?'MOCK':'LIVE';html.dataset.vvMode=mode;
      if(!global.VoiceVaultUI||typeof global.VoiceVaultUI.mount!=='function')fail('UI_UNAVAILABLE');
      var runtime;
      if(mode==='MOCK'){
        if(!global.VoiceVaultFixtures||global.VoiceVaultFixtures.contractVersion!=='v1')fail('CONTRACT_MISMATCH');
        if(typeof global.createVoiceVaultMock!=='function')fail('MOCK_RUNTIME_UNAVAILABLE');
        runtime=await global.createVoiceVaultMock(global.VoiceVaultFixtures);
      }else{
        try{await (options.loadScript||loadScript)(new URL('../integration/runtime.generated.js',global.location.href).href);}
        catch(error){fail('LIVE_RUNTIME_UNAVAILABLE');}
        if(typeof global.createVoiceVaultLiveRuntime!=='function')fail('LIVE_RUNTIME_UNAVAILABLE');
        runtime=await global.createVoiceVaultLiveRuntime();
      }
      if(!runtime||runtime.contractVersion!=='v1')fail('CONTRACT_MISMATCH');
      if(runtime.mode!==mode)fail('RUNTIME_MODE_MISMATCH');
      global.VoiceVaultRuntime=runtime;
      // mount owns init(), including its ApiResult/error presentation.
      await global.VoiceVaultUI.mount(runtime);
      if(document.body.dataset.appState==='error'){
        var badge=document.querySelector('#app .startup.error code');
        fail(badge?badge.textContent:'CONTRACT_MISMATCH');
      }
      html.dataset.vvState='mounted';
      return {state:'mounted',mode:mode,error:null};
    }catch(error){
      var candidate=error&&(error.code||error.message);
      var code=typeof candidate==='string'&&/^[A-Z][A-Z0-9_]+$/.test(candidate)?candidate:(mode==='MOCK'?'MOCK_RUNTIME_UNAVAILABLE':'LIVE_RUNTIME_UNAVAILABLE');
      html.dataset.vvState='error';problem(code);
      return {state:'error',mode:mode,error:{code:code}};
    }
  }
  var bootstrap={contractVersion:'v1',ready:null,run:function(options){
    if(!pending){pending=start(options||{});bootstrap.ready=pending;}
    return pending;
  }};
  global.VoiceVaultBootstrap=bootstrap;
  if(!global.VoiceVaultBootstrapConfig||global.VoiceVaultBootstrapConfig.autoStart!==false)bootstrap.run();
}(window));
