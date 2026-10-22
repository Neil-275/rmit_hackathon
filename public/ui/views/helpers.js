(function(global){
  'use strict';
  var V={};
  V.el=function(tag,attrs){
    var node=document.createElement(tag),children=Array.prototype.slice.call(arguments,2);
    Object.keys(attrs||{}).forEach(function(key){var value=attrs[key];if(value===null||value===undefined||value===false)return;
      if(key==='class')node.className=value;
      else if(key==='text')node.textContent=value;
      else if(key.slice(0,2)==='on'&&typeof value==='function')node.addEventListener(key.slice(2),value);
      else if(['checked','disabled','selected','required','multiple'].includes(key))node[key]=!!value;
      else if(key==='value')node.value=value;
      else node.setAttribute(key,String(value));
    });
    if(['input','textarea','select'].includes(tag)){
      // Keep validation copy in English even when the browser uses another language.
      node.addEventListener('invalid',function(){
        node.setCustomValidity('');
        var validity=node.validity,message='';
        if(validity.valueMissing)message='Please complete this field.';
        else if(validity.typeMismatch)message=node.type==='email'?'Enter a valid email address.':'Enter a valid value.';
        else if(validity.tooShort)message='Use at least '+node.minLength+' characters.';
        else if(validity.tooLong)message='Use no more than '+node.maxLength+' characters.';
        else if(validity.rangeUnderflow)message='Enter a value of at least '+node.min+'.';
        else if(validity.rangeOverflow)message='Enter a value no greater than '+node.max+'.';
        else if(validity.stepMismatch)message='Enter a value that matches the required step.';
        else if(validity.patternMismatch)message='Use the requested format.';
        else if(validity.badInput)message='Enter a valid number.';
        node.setCustomValidity(message);
      });
      ['input','change'].forEach(function(event){node.addEventListener(event,function(){node.setCustomValidity('');});});
    }
    function append(child){if(Array.isArray(child))child.forEach(append);else if(child!==null&&child!==undefined&&child!==false)node.appendChild(child instanceof Node?child:document.createTextNode(String(child)));}
    children.forEach(append);return node;
  };
  var paths={
    grid:['M3 3h7v7H3z','M14 3h7v7h-7z','M3 14h7v7H3z','M14 14h7v7h-7z'],
    bulb:['M9 18h6','M10 21h4','M9 15a6 6 0 1 1 6 0v3H9z'],
    shield:['M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z','M9 12l2 2 4-4'],
    vote:['M8 3h8v8H8z','M6 9H4l-2 8v4h20v-4l-2-8h-2','M2 17h20','M10 7l1 1 2-2'],
    users:['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8','M22 21v-2a4 4 0 0 0-3-3.87','M16 3.13a4 4 0 0 1 0 7.75'],
    activity:['M3 12h4l3-8 4 16 3-8h4'],
    arrow:['M5 12h14','M13 6l6 6-6 6'],
    plus:['M12 5v14','M5 12h14'],
    lock:['M5 10h14v11H5z','M8 10V7a4 4 0 0 1 8 0v3','M12 14v3'],
    search:['M21 21l-5-5','M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14'],
    chevron:['M9 5l7 7-7 7'],
    down:['M6 9l6 6 6-6'],
    close:['M6 6l12 12','M18 6L6 18'],
    check:['M5 12l4 4L19 6'],
    clock:['M12 8v5l3 2','M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20'],
    alert:['M12 3L2 21h20z','M12 9v5','M12 17h.01'],
    menu:['M3 6h18','M3 12h18','M3 18h18'],
    logout:['M9 3H4v18h5','M9 12h12','M16 7l5 5-5 5'],
    document:['M14 2H6v20h12V6z','M14 2v5h5','M9 12h6','M9 16h6'],
    spark:['M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z'],
    mail:['M3 5h18v14H3z','M3 5l9 7 9-7'],
    refresh:['M20 7v5h-5','M4 17v-5h5','M6 6a8 8 0 0 1 13 3','M18 18A8 8 0 0 1 5 15']
  };
  V.icon=function(name,size){var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width',size||20);svg.setAttribute('height',size||20);svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.65');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');(paths[name]||paths.document).forEach(function(d){var p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',d);svg.appendChild(p);});return svg;};
  V.button=function(label,fn,attrs){return V.el('button',Object.assign({type:'button',class:'button',onclick:fn},attrs||{}),label);};
  V.labels={RESOLVED:'Resolved',UNDER_REVIEW:'Under review',ENDORSED:'Endorsed',APPROVED:'Approved',REJECTED:'Rejected',INVESTIGATING:'Under investigation',AWAITING_ELIGIBLE_JURY:'Awaiting eligible jury',COLLECTING:'Collecting votes',READY:'Ready',GRANTED:'Access granted',APPLIED:'Applied',DENIED:'Denied',EXPIRED:'Expired',STALE:'Stale',APPLYING:'Applying'};
  // READY (threshold met) must never look like APPLIED/GRANTED (completed); APPLYING is its own state.
  var tones={APPROVED:'green',APPLIED:'green',GRANTED:'green',RESOLVED:'green',READY:'ready',APPLYING:'neutral',REJECTED:'red',DENIED:'red',EXPIRED:'amber',STALE:'amber',AWAITING_ELIGIBLE_JURY:'amber'};
  V.badge=function(status){return V.el('span',{class:'badge '+(tones[status]||'purple'),'data-status':status},V.el('span',{class:'badge-dot'}),V.labels[status]||status);};
  var sources={APP:['purple','Application check'],FABRIC:['green','TideCloak policy'],QEA:['violet','Governance approval'],CLIENT:['neutral','Browser check'],SIMULATED:['amber','Preview only']};
  V.source=function(enforcement){var s=sources[enforcement]||['neutral','Unknown source'];return V.el('span',{class:'tag '+s[0],title:s[1]},enforcement||'UNKNOWN');};
  V.errorText=function(error){return error.message+' ('+error.code+(error.enforcement?' · '+error.enforcement:'')+')';};
  V.loadError=function(ctx,key,title){
    var result=ctx.state.results[key];
    if(!result||result.ok)return null;
    return V.el('div',{class:'error-state',role:'alert','data-load-error':key},V.icon('alert',26),V.el('h2',{},title),V.el('p',{},result.error.message),V.tag(result.error.code,'amber'),' ',V.source(result.error.enforcement),result.error.retryable===false?null:V.button('Try again',function(){ctx.refresh();},{class:'button secondary'}));
  };
  V.more=function(page){return page&&page.nextCursor?V.el('p',{class:'muted more-note'},'Showing the first '+page.items.length+' records. More exist, but paging is not available yet.'):null;};
  V.tag=function(label,kind){return V.el('span',{class:'tag '+(kind||'')},label);};
  V.categories={PROCESS:'Process',CULTURE:'Culture',SUSTAINABILITY:'Sustainability',PRODUCT:'Product'};
  V.avatar=function(name,small){var initials=String(name||'?').split(' ').filter(Boolean).slice(0,2).map(function(s){return s[0];}).join('').toUpperCase();return V.el('span',{class:'avatar'+(small?' small':'')},initials);};
  V.date=function(value){return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',timeZone:'Asia/Bangkok'}).format(new Date(value));};
  V.dateTime=function(value){return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Bangkok'}).format(new Date(value));};
  V.srOnly=function(text){return V.el('span',{class:'sr-only'},text);};
  // Thrown by form input builders; its message is shown to the user as-is.
  V.userError=function(message){var error=new Error(message);error.userFacing=true;return error;};
  V.randomId=function(){return Array.from(global.crypto.getRandomValues(new Uint8Array(16)),function(b){return b.toString(16).padStart(2,'0');}).join('');};
  V.matches=function(value,query){function normalize(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u0111/g,'d').toLowerCase();}return normalize(value).includes(normalize(query));};
  V.empty=function(title,detail,action){return V.el('div',{class:'empty-state'},V.el('span',{class:'empty-icon'},V.icon('document',27)),V.el('h3',{},title),V.el('p',{},detail),action);};
  V.sectionTitle=function(title,aside){return V.el('div',{class:'section-title'},V.el('h2',{},title),aside);};
  V.sealed=function(status){return V.el('span',{class:'sealed'},V.icon('lock',13),status==='REJECTED'?'Identity is not published after rejection':'Identity sealed');};
  V.field=function(label,name,attrs,kind){var input=V.el(kind||'input',Object.assign({name:name,id:'field-'+name},attrs||{}));return {input:input,node:V.el('label',{class:'field',for:'field-'+name},V.el('span',{},label),input)};};
  global.VoiceVaultView=V;
}(window));
