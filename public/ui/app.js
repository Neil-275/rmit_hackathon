(function(global){
  'use strict';var V=global.VoiceVaultView,h=V.el;
  var navigation=[{id:'overview',label:'Overview',icon:'grid',description:'Track ideas, reports and decisions awaiting review.'},{id:'ideas',label:'Ideas',icon:'bulb',description:'Give good ideas a fair hearing and their authors due credit.'},{id:'reports',label:'Reports',icon:'shield',description:'Raise concerns and follow the review process.'},{id:'votes',label:'Voting',icon:'vote',description:'Review the evidence. Make the decision together.'},{id:'council',label:'Council',icon:'users',description:'An established roster. Every change requires a vote.'},{id:'audit',label:'Audit log',icon:'activity',description:'Follow recorded actions and their enforcement source.'}];
  function startupError(code){V.closeDialog();var root=document.getElementById('app');root.replaceChildren(h('section',{class:'startup error'},h('span',{class:'brand-mark'},'V'),h('h1',{},'Unable to open the workspace'),h('p',{},'The interface and runtime are incompatible, or the connection is unavailable.'),h('code',{},code)));document.body.dataset.appState='error';}
  global.VoiceVaultUI={mount:async function(runtime){
    if(!runtime||runtime.contractVersion!=='v1'||!['MOCK','LIVE'].includes(runtime.mode)){startupError('CONTRACT_MISMATCH');return;}
    if(typeof runtime.init!=='function'||typeof runtime.getSession!=='function'){startupError('CONTRACT_MISMATCH');return;}
    var init;try{init=await runtime.init();}catch(error){startupError('POLICY_UNAVAILABLE');return;}
    if(!init||!init.ok){startupError(init&&init.error?init.error.code:'CONTRACT_MISMATCH');return;}
    var state={page:navigation.some(function(p){return '#'+p.id===location.hash;})?location.hash.slice(1):'overview',search:'',session:init.data,ideas:{items:[]},reports:{items:[]},changes:{items:[]},audit:{items:[]},council:null,directory:{people:[]},results:{}};
    var revision=0,toastTimer;
    var ctx={runtime:runtime,state:state,loading:true};
    ctx.notify=function(message,isError){var region=document.getElementById('toast-region');region.replaceChildren(h('div',{class:'toast'+(isError?' is-error':'')},V.icon(isError?'alert':'check',18),h('span',{},message)));clearTimeout(toastTimer);toastTimer=setTimeout(function(){region.replaceChildren();},5000);};
    ctx.call=async function(method,args){try{if(typeof runtime[method]!=='function')throw new Error('CONTRACT_MISMATCH');var result=await runtime[method].apply(runtime,args||[]);if(!result||result.contractVersion!=='v1'||typeof result.ok!=='boolean')throw new Error('CONTRACT_MISMATCH');return result;}catch(error){return {ok:false,contractVersion:'v1',error:{code:'POLICY_UNAVAILABLE',message:'The connection is unavailable. Please try again later.',enforcement:runtime.mode==='MOCK'?'SIMULATED':'APP',retryable:true}};}};
    // The clicked button is disabled while its action runs; the refresh re-renders it either way.
    ctx.act=async function(method,args,button,busyLabel){
      if(button){button.disabled=true;button.setAttribute('aria-busy','true');if(busyLabel)button.textContent=busyLabel;}
      V.closeDialog();var result=await ctx.call(method,args);if(result.ok)ctx.notify('Your action has been recorded.');else ctx.notify(V.errorText(result.error),true);await ctx.refresh({keep:true});return result;
    };
    var root=document.getElementById('app');root.replaceChildren();
    var sidebar=h('aside',{class:'sidebar',id:'sidebar','aria-label':'Main navigation'},h('a',{class:'brand',href:'#overview'},h('span',{class:'brand-mark'},'V'),h('span',{},h('strong',{},'VoiceVault'),h('small',{},'Every voice matters'))));
    var nav=h('nav',{class:'navigation','aria-label':'Workspace pages'});navigation.forEach(function(item){nav.append(V.button([V.icon(item.icon,20),h('span',{},item.label),item.id==='ideas'?h('span',{class:'nav-dot'}):null],function(){ctx.navigate(item.id);},{class:'nav-button','data-page':item.id}));});
    sidebar.append(h('p',{class:'sidebar-caption'},'Workspace'),nav,h('div',{class:'sidebar-bottom'},h('div',{class:'sidebar-note'},V.icon('shield',23),h('strong',{},'Speak up. Shape change.'),h('p',{},'Ideas deserve a fair hearing. Important decisions deserve more than one voice.')),h('div',{class:'workspace'},h('span',{class:'workspace-logo'},'R'),h('span',{},h('strong',{},'RMIT Hackathon'),h('small',{},'Demonstration workspace')),V.icon('down',15))));
    var menu=V.button(V.icon('menu'),function(){var isOpen=document.body.classList.toggle('nav-open');menu.setAttribute('aria-expanded',String(isOpen));},{class:'icon-button mobile-menu',id:'menu-toggle','aria-label':'Open navigation','aria-controls':'sidebar','aria-expanded':'false'});
    var search=h('input',{type:'search',id:'search',placeholder:'Search this page...','aria-label':'Search this page',autocomplete:'off',oninput:function(event){state.search=event.target.value;renderPage();}});
    var identity=h('div',{class:'session-chip',id:'session-chip'});
    var main=h('main',{class:'main'},h('header',{class:'topbar'},h('div',{class:'topbar-location'},menu,h('span',{class:'breadcrumb'},'Your workspace'),V.icon('chevron',13),h('span',{id:'breadcrumb-current'},'Overview')),h('div',{class:'topbar-right'},h('label',{class:'search-box'},V.icon('search',17),search),identity)),h('div',{class:'main-inner'},h('div',{class:'mode-banner',id:'mode-banner'},V.icon(runtime.mode==='MOCK'?'spark':'shield',16),h('span',{},runtime.mode==='MOCK'?'Simulation mode — TideCloak is not connected':'LIVE — Checking session'),V.tag(runtime.mode)),h('div',{id:'simulation-controls',class:'simulation-controls'}),h('div',{class:'page-heading'},h('div',{},h('p',{class:'eyebrow'},'Your voice. Shared accountability.'),h('h1',{id:'page-title'},'Overview'),h('p',{id:'page-description',class:'page-description'})),h('span',{class:'today'},V.icon('clock',15),new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'long',timeZone:'Asia/Bangkok'}).format(new Date()))),h('div',{id:'page-content',tabindex:'-1'}),h('footer',{class:'footer'},h('span',{},'VoiceVault'),h('span',{},runtime.mode==='MOCK'?'Preview · Synthetic data · In-memory session':'Every voice matters'))));
    root.append(sidebar,V.button('',function(){document.body.classList.remove('nav-open');menu.setAttribute('aria-expanded','false');},{class:'nav-overlay','aria-label':'Close navigation'}),main);
    function closeSensitive(){V.closeDialog();document.getElementById('toast-region').replaceChildren();}
    async function authenticate(method,args){
      closeSensitive();var result=await ctx.call(method,args);
      if(!result.ok)ctx.notify(V.errorText(result.error),true);
      await ctx.refresh();
    }
    function controls(){
      var unavailable=state.results.session&&!state.results.session.ok;
      // Native replaceChildren renders null as text, so the sign-in/out button is appended separately.
      identity.replaceChildren(V.avatar(state.session.displayName,true),h('span',{id:'persona-name'},state.session.displayName));
      if(!unavailable)identity.append(V.button(V.icon(state.session.authenticated?'logout':'arrow',16),function(){authenticate(state.session.authenticated?'logout':'login',[]);},{class:'icon-button','aria-label':state.session.authenticated?'Sign out':'Sign in'}));
      var region=document.getElementById('simulation-controls');region.replaceChildren();
      region.hidden=runtime.mode!=='MOCK'||!runtime.simulation;
      var banner=document.getElementById('mode-banner');banner.dataset.mode=runtime.mode;
      if(runtime.mode==='LIVE'){
        var connected=state.session.authenticated===true;
        banner.dataset.connection=unavailable?'unavailable':connected?'connected':'signed-out';
        // LIVE identifies the adapter; it does not prove a Fabric connection or policy gate.
        banner.replaceChildren(V.icon(unavailable?'alert':connected?'check':'lock',16),h('span',{},unavailable?'LIVE — Session unavailable':connected?'LIVE — Runtime connected':'LIVE — Sign in required'),V.tag('LIVE'));
        // Simulated TideCloak runs the real API and data, but sign-in, roles and envelopes are not Tide-enforced.
        if(runtime.simulatedTide===true){banner.dataset.connection=unavailable?'unavailable':connected?'simulated':'signed-out';banner.replaceChildren(V.icon('spark',16),h('span',{},'Simulated TideCloak — real API and data; sign-in, roles and identity envelopes are simulated, not Tide-enforced'+(connected?'':' · Sign in required')),V.tag('SIMULATED'));}
      }
      if(runtime.mode==='MOCK'&&runtime.simulation){
        var persona=h('select',{id:'persona-select','aria-label':'Choose a demo persona'},state.session.authenticated?null:h('option',{value:'',disabled:true},unavailable?'Session unavailable':'Signed out'),runtime.simulation.personas.map(function(p){return h('option',{value:p.id},p.displayName+' · '+p.title);}));persona.value=state.session.subject||'';
        persona.addEventListener('change',function(){authenticate('login',[persona.value]);});
        var scenario=h('select',{id:'scenario-select','aria-label':'Choose a simulation scenario'},runtime.simulation.scenarios.map(function(s){return h('option',{value:s.id},s.label);}));scenario.value=runtime.simulation.getScenario();
        scenario.addEventListener('change',function(){closeSensitive();runtime.simulation.setScenario(scenario.value);ctx.refresh();});
        region.append(h('label',{},h('span',{},V.icon('users',14),'Persona'),persona),h('label',{},h('span',{},V.icon('spark',14),'Scenario'),scenario),h('small',{},'Switching personas only simulates roles in this session.'));
      }
    }
    function renderPage(){
      if(ctx.loading)return;
      var current=navigation.find(function(p){return p.id===state.page;});
      document.getElementById('page-title').textContent=current.label;document.getElementById('page-description').textContent=current.description;document.getElementById('breadcrumb-current').textContent=current.label;document.title=current.label+' · VoiceVault';
      document.querySelectorAll('[data-page]').forEach(function(button){button.classList.toggle('active',button.dataset.page===state.page);if(button.dataset.page===state.page)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
      var content=document.getElementById('page-content');content.dataset.view=state.page;content.removeAttribute('aria-busy');
      search.closest('.search-box').hidden=state.page==='overview';
      var sessionError=V.loadError(ctx,'session','Session unavailable');if(sessionError){content.replaceChildren(sessionError);return;}
      if(!state.session.authenticated){content.replaceChildren(V.empty('Sign in to continue',runtime.mode==='MOCK'?'Choose a demo persona to explore the preview.':'Sign in with your organization account to continue.',V.button('Sign in',function(){authenticate('login',[]);},{class:'button primary'})));return;}
      var key={ideas:'ideas',reports:'reports',council:'council',audit:'audit'}[state.page];
      var result=state.results[key];
      if(result&&!result.ok){content.replaceChildren(V.loadError(ctx,key,'Unable to load content'));return;}
      content.replaceChildren(V[state.page](ctx));
    }
    // keep:true (after an action on the same page) leaves current content visible to avoid a scroll jump.
    // Session and page changes always clear first so one persona's data never lingers for another.
    ctx.refresh=async function(options){
      var ticket=++revision;ctx.loading=true;document.body.dataset.appState='loading';
      var content=document.getElementById('page-content');
      if(options&&options.keep===true&&content.dataset.view===state.page)content.setAttribute('aria-busy','true');
      else content.replaceChildren(h('div',{class:'loading-state',role:'status'},h('span',{class:'spinner'}),'Updating the workspace...'));
      var sessionResult=await ctx.call('getSession',[]);if(ticket!==revision)return;
      var unavailable=!sessionResult.ok&&sessionResult.error.code!=='UNAUTHENTICATED';
      state.session=sessionResult.ok?sessionResult.data:{authenticated:false,displayName:unavailable?'Session unavailable':'Signed out',capabilities:{}};
      var names=['ideas','reports','council','changes','audit','directory'],methods=['listIdeas','listReports','getCouncil','listCouncilChanges','listAudit','getDirectory'];
      if(state.session.authenticated){var results=await Promise.all(methods.map(function(method){
        // A runtime may declare a feature absent from its build; skip the call instead of showing an outage.
        if(method==='listCouncilChanges'&&V.isOff(ctx,'changes'))return {ok:true,contractVersion:'v1',data:{items:[],nextCursor:null}};
        return ctx.call(method,[{}]);}));if(ticket!==revision)return;names.forEach(function(name,index){state.results[name]=results[index];state[name]=results[index].ok?results[index].data:(['ideas','reports','changes','audit'].includes(name)?{items:[]}:name==='directory'?{people:[]}:null);});}
      else {V.closeDialog();state.ideas={items:[]};state.reports={items:[]};state.changes={items:[]};state.audit={items:[]};state.council=null;state.directory={people:[]};state.results={};}
      state.results.session=unavailable?sessionResult:null;
      ctx.loading=false;controls();renderPage();
      if(!document.getElementById('app-dialog').open&&(document.activeElement===document.body||!document.activeElement))document.getElementById('page-content').focus({preventScroll:true});
      document.body.dataset.page=state.page;document.body.dataset.persona=state.session.subject||'';document.body.dataset.appState='ready';
    };
    ctx.navigate=function(page){if(!navigation.some(function(p){return p.id===page;}))return;closeSensitive();state.page=page;state.search='';search.value='';if(location.hash!=='#'+page)location.hash=page;document.body.classList.remove('nav-open');menu.setAttribute('aria-expanded','false');ctx.refresh();window.scrollTo(0,0);};
    global.onhashchange=function(){var page=location.hash.slice(1);if(page!==state.page)ctx.navigate(page);};
    await ctx.refresh();
  }};
}(window));
