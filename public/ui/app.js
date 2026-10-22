(function(global){
  'use strict';var V=global.VoiceVaultView,h=V.el;
  var navigation=[{id:'overview',label:'Tổng quan',icon:'grid',description:'Theo dõi sáng kiến, phản ánh và các quyết định đang chờ.'},{id:'ideas',label:'Sáng kiến',icon:'bulb',description:'Những ý tưởng tốt luôn xứng đáng có cơ hội.'},{id:'reports',label:'Phản ánh',icon:'shield',description:'Một nơi để lên tiếng về những điều cần được xem xét.'},{id:'votes',label:'Bỏ phiếu',icon:'vote',description:'Cùng xem xét, cùng chịu trách nhiệm cho quyết định.'},{id:'council',label:'Hội đồng',icon:'users',description:'Danh sách rõ ràng. Mỗi thay đổi đều cần đồng thuận.'},{id:'audit',label:'Nhật ký',icon:'activity',description:'Theo dõi các hoạt động và nguồn thực thi của từng kết quả.'}];
  function startupError(code){V.closeDialog();var root=document.getElementById('app');root.replaceChildren(h('section',{class:'startup error'},h('span',{class:'brand-mark'},'V'),h('h1',{},'Không thể mở không gian'),h('p',{},'Giao diện và runtime chưa tương thích hoặc kết nối chưa sẵn sàng.'),h('code',{},code)));document.body.dataset.appState='error';}
  global.VoiceVaultUI={mount:async function(runtime){
    if(!runtime||runtime.contractVersion!=='v1'||!['MOCK','LIVE'].includes(runtime.mode)){startupError('CONTRACT_MISMATCH');return;}
    if(typeof runtime.init!=='function'||typeof runtime.getSession!=='function'){startupError('CONTRACT_MISMATCH');return;}
    var init;try{init=await runtime.init();}catch(error){startupError('POLICY_UNAVAILABLE');return;}
    if(!init||!init.ok){startupError(init&&init.error?init.error.code:'CONTRACT_MISMATCH');return;}
    var state={page:navigation.some(function(p){return '#'+p.id===location.hash;})?location.hash.slice(1):'overview',search:'',session:init.data,ideas:{items:[]},reports:{items:[]},changes:{items:[]},audit:{items:[]},council:null,directory:{people:[]},results:{}};
    var revision=0,toastTimer;
    var ctx={runtime:runtime,state:state};
    ctx.notify=function(message,isError){var region=document.getElementById('toast-region');region.replaceChildren(h('div',{class:'toast'+(isError?' is-error':'')},V.icon(isError?'alert':'check',18),h('span',{},message)));clearTimeout(toastTimer);toastTimer=setTimeout(function(){region.replaceChildren();},5000);};
    ctx.call=async function(method,args){try{if(typeof runtime[method]!=='function')throw new Error('CONTRACT_MISMATCH');var result=await runtime[method].apply(runtime,args||[]);if(!result||result.contractVersion!=='v1'||typeof result.ok!=='boolean')throw new Error('CONTRACT_MISMATCH');return result;}catch(error){return {ok:false,contractVersion:'v1',error:{code:'POLICY_UNAVAILABLE',message:'Kết nối chưa sẵn sàng. Vui lòng thử lại sau.',enforcement:runtime.mode==='MOCK'?'SIMULATED':'APP'}};}};
    ctx.act=async function(method,args){V.closeDialog();var result=await ctx.call(method,args);if(result.ok){ctx.notify('Thao tác đã được ghi nhận.');await ctx.refresh();}else ctx.notify(result.error.message,true);return result;};
    var root=document.getElementById('app');root.replaceChildren();
    var sidebar=h('aside',{class:'sidebar',id:'sidebar','aria-label':'Điều hướng chính'},h('a',{class:'brand',href:'#overview'},h('span',{class:'brand-mark'},'V'),h('span',{},h('strong',{},'VoiceVault'),h('small',{},'Mỗi tiếng nói đều có giá trị'))));
    var nav=h('nav',{class:'navigation','aria-label':'Các mục'});navigation.forEach(function(item){nav.append(V.button([V.icon(item.icon,20),h('span',{},item.label),item.id==='ideas'?h('span',{class:'nav-dot'}):null],function(){ctx.navigate(item.id);},{class:'nav-button','data-page':item.id}));});
    sidebar.append(h('p',{class:'sidebar-caption'},'Không gian làm việc'),nav,h('div',{class:'sidebar-bottom'},h('div',{class:'sidebar-note'},V.icon('shield',23),h('strong',{},'Lên tiếng tạo đổi thay'),h('p',{},'Sáng kiến được lắng nghe. Quyết định có nhiều người cùng tham gia.')),h('div',{class:'workspace'},h('span',{class:'workspace-logo'},'R'),h('span',{},h('strong',{},'RMIT Hackathon'),h('small',{},'Không gian minh họa')),V.icon('down',15))));
    var menu=V.button(V.icon('menu'),function(){var isOpen=document.body.classList.toggle('nav-open');menu.setAttribute('aria-expanded',String(isOpen));},{class:'icon-button mobile-menu',id:'menu-toggle','aria-label':'Mở điều hướng','aria-controls':'sidebar','aria-expanded':'false'});
    var search=h('input',{type:'search',id:'search',placeholder:'Tìm trong không gian…','aria-label':'Tìm kiếm trong trang',autocomplete:'off',oninput:function(event){state.search=event.target.value;renderPage();}});
    var identity=h('div',{class:'session-chip',id:'session-chip'});
    var main=h('main',{class:'main'},h('header',{class:'topbar'},h('div',{class:'topbar-location'},menu,h('span',{class:'breadcrumb'},'Không gian của bạn'),V.icon('chevron',13),h('span',{id:'breadcrumb-current'},'Tổng quan')),h('div',{class:'topbar-right'},h('label',{class:'search-box'},V.icon('search',17),search),identity)),h('div',{class:'main-inner'},h('div',{class:'mode-banner',id:'mode-banner'},V.icon(runtime.mode==='MOCK'?'spark':'shield',16),h('span',{},runtime.mode==='MOCK'?'Dữ liệu mô phỏng — không kết nối TideCloak':'Đang kết nối hệ thống LIVE'),V.tag(runtime.mode)),h('div',{id:'simulation-controls',class:'simulation-controls'}),h('div',{class:'page-heading'},h('div',{},h('p',{class:'eyebrow'},'TIẾNG NÓI TỪ BẠN · THAY ĐỔI CHO TẤT CẢ'),h('h1',{id:'page-title'},'Tổng quan'),h('p',{id:'page-description',class:'page-description'})),h('span',{class:'today'},V.icon('clock',15),new Intl.DateTimeFormat('vi-VN',{weekday:'short',day:'numeric',month:'long',timeZone:'Asia/Bangkok'}).format(new Date()))),h('div',{id:'page-content',tabindex:'-1'}),h('footer',{class:'footer'},h('span',{},'VoiceVault'),h('span',{},runtime.mode==='MOCK'?'Bản xem thử · Dữ liệu giả · Chỉ lưu trong phiên':'Mỗi tiếng nói đều có giá trị'))));
    root.append(sidebar,V.button('',function(){document.body.classList.remove('nav-open');menu.setAttribute('aria-expanded','false');},{class:'nav-overlay','aria-label':'Đóng điều hướng'}),main);
    function closeSensitive(){V.closeDialog();document.getElementById('toast-region').replaceChildren();}
    function controls(){
      identity.replaceChildren(V.avatar(state.session.displayName,true),h('span',{id:'persona-name'},state.session.displayName),V.button(V.icon(state.session.authenticated?'logout':'arrow',16),async function(){closeSensitive();await ctx.call(state.session.authenticated?'logout':'login',[]);await ctx.refresh();},{class:'icon-button','aria-label':state.session.authenticated?'Đăng xuất':'Đăng nhập'}));
      var region=document.getElementById('simulation-controls');region.replaceChildren();
      if(runtime.mode==='MOCK'&&runtime.simulation){
        var persona=h('select',{id:'persona-select','aria-label':'Chọn nhân vật mô phỏng'},runtime.simulation.personas.map(function(p){return h('option',{value:p.id},p.displayName+' · '+p.title);}));persona.value=state.session.subject||'an';
        persona.addEventListener('change',async function(){closeSensitive();await ctx.call('login',[persona.value]);await ctx.refresh();});
        var scenario=h('select',{id:'scenario-select','aria-label':'Chọn tình huống mô phỏng'},runtime.simulation.scenarios.map(function(s){return h('option',{value:s.id},s.label);}));scenario.value=runtime.simulation.getScenario();
        scenario.addEventListener('change',function(){closeSensitive();runtime.simulation.setScenario(scenario.value);ctx.refresh();});
        region.append(h('label',{},h('span',{},V.icon('users',14),'Nhân vật'),persona),h('label',{},h('span',{},V.icon('spark',14),'Tình huống'),scenario),h('small',{},'Chuyển nhân vật chỉ mô phỏng vai trò trong phiên này.'));
      }
    }
    function renderPage(){
      var current=navigation.find(function(p){return p.id===state.page;});
      document.getElementById('page-title').textContent=current.label;document.getElementById('page-description').textContent=current.description;document.getElementById('breadcrumb-current').textContent=current.label;document.title=current.label+' · VoiceVault';
      document.querySelectorAll('[data-page]').forEach(function(button){button.classList.toggle('active',button.dataset.page===state.page);if(button.dataset.page===state.page)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
      var content=document.getElementById('page-content');
      if(!state.session.authenticated){content.replaceChildren(V.empty('Đăng nhập để tiếp tục',runtime.mode==='MOCK'?'Chọn lại một nhân vật giả để khám phá bản xem thử.':'Đăng nhập bằng tài khoản của tổ chức để tiếp tục.',V.button('Đăng nhập',async function(){await ctx.call('login',[]);await ctx.refresh();},{class:'button primary'})));return;}
      var key={overview:'ideas',ideas:'ideas',reports:'reports',votes:'reports',council:'council',audit:'audit'}[state.page];
      var result=state.results[key];
      if(result&&!result.ok){content.replaceChildren(h('div',{class:'error-state',role:'alert'},V.icon('alert',26),h('h2',{},'Chưa thể tải nội dung'),h('p',{},result.error.message),V.tag(result.error.code,'amber'),V.button('Thử lại',ctx.refresh,{class:'button secondary'})));return;}
      content.replaceChildren(V[state.page](ctx));
    }
    ctx.refresh=async function(){
      var ticket=++revision;document.body.dataset.appState='loading';
      var content=document.getElementById('page-content');content.replaceChildren(h('div',{class:'loading-state',role:'status'},h('span',{class:'spinner'}),'Đang cập nhật không gian…'));
      var sessionResult=await ctx.call('getSession',[]);if(ticket!==revision)return;
      state.session=sessionResult.ok?sessionResult.data:{authenticated:false,displayName:'Chưa đăng nhập',capabilities:{}};
      var names=['ideas','reports','council','changes','audit','directory'],methods=['listIdeas','listReports','getCouncil','listCouncilChanges','listAudit','getDirectory'];
      if(state.session.authenticated){var results=await Promise.all(methods.map(function(method){return ctx.call(method,[{}]);}));if(ticket!==revision)return;names.forEach(function(name,index){state.results[name]=results[index];state[name]=results[index].ok?results[index].data:(['ideas','reports','changes','audit'].includes(name)?{items:[]}:name==='directory'?{people:[]}:null);});}
      else {state.ideas={items:[]};state.reports={items:[]};state.changes={items:[]};state.audit={items:[]};state.council=null;state.directory={people:[]};state.results={};}
      controls();renderPage();document.body.dataset.page=state.page;document.body.dataset.persona=state.session.subject||'';document.body.dataset.appState='ready';
    };
    ctx.navigate=function(page){if(!navigation.some(function(p){return p.id===page;}))return;closeSensitive();state.page=page;state.search='';search.value='';if(location.hash!=='#'+page)location.hash=page;document.body.classList.remove('nav-open');menu.setAttribute('aria-expanded','false');ctx.refresh();window.scrollTo(0,0);};
    global.onhashchange=function(){var page=location.hash.slice(1);if(page!==state.page)ctx.navigate(page);};
    await ctx.refresh();
  }};
}(window));
