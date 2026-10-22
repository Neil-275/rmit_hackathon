(function(global){
  'use strict';
  var V=global.VoiceVaultView,h=V.el,dialogGeneration=0;
  V.closeDialog=function(){dialogGeneration++;var dialog=document.getElementById('app-dialog');if(dialog&&dialog.open)dialog.close();};
  function open(title,description,content){
    dialogGeneration++;
    var dialog=document.getElementById('app-dialog'),previous=document.activeElement;
    if(dialog.open)dialog.close();
    dialog.replaceChildren(h('div',{class:'dialog-heading'},h('div',{},h('p',{class:'eyebrow'},'VOICEVAULT'),h('h2',{id:'dialog-title'},title)),V.button(V.icon('close'),function(){dialog.close();},{class:'icon-button','aria-label':'Close','data-dialog-close':''})),h('p',{class:'dialog-description'},description),content);
    dialog.onclose=function(){if(!dialog.open){dialogGeneration++;dialog.replaceChildren();if(previous&&previous.isConnected)previous.focus();}};
    dialog.showModal();
    var first=dialog.querySelector('form input:not([disabled]), form textarea, form select:not([disabled])');if(first)first.focus();
    return dialog;
  }
  function formDialog(ctx,title,description,fields,submitLabel,method,inputBuilder,successMessage){
    var form=h('form',{class:'dialog-form'}),error=h('div',{class:'form-error',role:'alert',hidden:true});
    var submit=h('button',{type:'submit',class:'button primary'},submitLabel,V.icon('arrow',16));
    form.append(error,fields,h('div',{class:'dialog-actions'},V.button('Cancel',V.closeDialog,{class:'button secondary'}),submit));
    form.addEventListener('submit',async function(event){
      event.preventDefault();if(submit.disabled||!form.reportValidity())return;
      var label=Array.from(submit.childNodes);submit.disabled=true;submit.setAttribute('aria-busy','true');submit.replaceChildren('Submitting…');error.hidden=true;
      try{
        var args=inputBuilder(form);
        var result=await ctx.call(method,args),stillOpen=form.isConnected&&document.getElementById('app-dialog').open;
        // A success still refreshes the page if the dialog was closed while the request was in flight.
        if(result.ok){if(stillOpen)V.closeDialog();ctx.notify(successMessage?successMessage(result.data):'Your changes have been recorded.');await ctx.refresh({keep:true});}
        else if(stillOpen){error.textContent=V.errorText(result.error);error.hidden=false;}
        else ctx.notify(V.errorText(result.error),true);
      }catch(problem){error.textContent=problem&&problem.userFacing?problem.message:'Check your input before submitting.';error.hidden=false;}
      finally{submit.disabled=false;submit.removeAttribute('aria-busy');submit.replaceChildren.apply(submit,label);}
    });
    return open(title,description,form);
  }
  V.newIdea=function(ctx){
    var title=V.field('Idea title','title',{required:true,minlength:5,maxlength:160,placeholder:'What would you like to improve?'});
    var description=V.field('Describe your idea','description',{required:true,minlength:20,maxlength:6000,rows:5,placeholder:'Describe the problem, proposed solution and expected impact...'},'textarea');
    var category=V.field('Category','category',{},'select');
    Object.keys(V.categories).forEach(function(key){category.input.append(h('option',{value:key},V.categories[key]));});
    var consent=h('input',{type:'checkbox',name:'publishCreditOnApproval'});
    formDialog(ctx,'Submit an idea','Ideas are reviewed before their authors are publicly credited.'+(ctx.runtime.mode==='MOCK'?' Use synthetic data only in this preview.':''),h('div',{},title.node,description.node,category.node,h('label',{class:'check-field'},consent,h('span',{},'Publish my name as the originator if this idea is approved. Leave unticked to stay unnamed.'))),'Submit an idea','submitIdea',function(){return [{title:title.input.value,description:description.input.value,category:category.input.value,publishCreditOnApproval:consent.checked}];},function(){return 'Idea submitted. Reviewers see it without your name.';});
  };
  V.newReport=function(ctx){
    var title=V.field('Report title','title',{required:true,minlength:5,maxlength:160,placeholder:'Summarize the concern to be reviewed'});
    var details=V.field('Details and supporting evidence','evidenceDetails',{required:true,minlength:20,maxlength:8000,rows:5,placeholder:ctx.runtime.mode==='MOCK'?'Describe the scenario using synthetic data.':'Describe the concern and evidence that needs verification.'},'textarea');
    var choices=h('fieldset',{class:'person-options'},h('legend',{},'People involved (select at least one)'));
    var directory=((ctx.state.directory&&ctx.state.directory.people)||[]).filter(function(p){return p.id!==ctx.state.session.subject;});
    // One id per dialog: a retry after a lost response cannot create a second report.
    var clientRequestId=V.randomId();
    directory.forEach(function(p){choices.append(h('label',{class:'person-option'},h('input',{type:'checkbox',name:'accused-'+p.id,value:p.id}),V.avatar(p.displayName,true),h('span',{},h('strong',{},p.displayName),h('small',{},p.title))));});
    var contact=V.field('Contact email (optional)','contact',{type:'email',maxlength:160,autocomplete:'off',placeholder:ctx.runtime.mode==='MOCK'?'Use a synthetic email, such as an@example.test':'Your contact email'});
    var consent=h('input',{type:'checkbox',name:'consent',required:true});
    formDialog(ctx,'Submit a report','Select all people involved. Eligible voters will be selected from the established council.',h('div',{},title.node,details.node,h('p',{class:'field-hint'},V.icon('alert',14),'Your name is sealed, but details only you would know can still identify you.'),choices,contact.node,h('label',{class:'check-field'},consent,h('span',{},'I understand my identity can be revealed only to one designated recipient, after at least two-thirds of the assigned voters approve, including an independent member.'))),'Submit a report','submitReport',function(form){var accused=Array.from(form.querySelectorAll('input[name^="accused-"]:checked')).map(function(input){return input.value;});if(!accused.length)throw V.userError('Select at least one person involved.');return [{title:title.input.value,evidenceDetails:details.input.value,accusedPersonIds:accused,contact:contact.input.value,consent:consent.checked,clientRequestId:clientRequestId}];},function(report){return report.status==='AWAITING_ELIGIBLE_JURY'?'Report saved. It is waiting for enough eligible council members.':'Report submitted. '+report.voterCount+' voters were assigned.';});
  };
  V.voteDialog=function(ctx,round,decision){
    var reason=V.field('Reason for your decision','reason',{required:true,minlength:3,maxlength:1000,rows:4,placeholder:'Explain the basis for your decision...'},'textarea');
    formDialog(ctx,decision==='APPROVE'?'Approve this request':'Deny this request','Your vote is bound to this round, its selected voters and the council version.',h('div',{},h('div',{class:'context-box'},h('strong',{},(round.operation==='CHANGE_COUNCIL'?'Council change':'Identity review request')+V.roundSubject(ctx,round)),h('p',{},'Council v'+round.councilVersion+' · '+round.voterCount+' voters · Requires '+round.quorumRequired+' approvals, including an independent member.'),round.operation==='REVEAL_REPORT_IDENTITY'&&round.recipientSubject?h('p',{},'Identity recipient: '+V.personName(ctx,round.recipientSubject,round.recipientName)+(round.purpose?' · Purpose: '+round.purpose:'')):null,ctx.runtime.mode==='MOCK'?V.tag('Simulated','purple'):null),reason.node),decision==='APPROVE'?'Confirm approval':'Confirm denial','castVote',function(){return [round.id,{decision:decision,reason:reason.input.value}];},function(view){return view.status==='READY'?'Your vote has been recorded. The approval threshold is now met.':'Your vote has been recorded.';});
  };
  V.decisionDialog=function(ctx,idea,decision){
    var reason=V.field(decision==='REJECT'?'Reason for rejection':'Note (optional)','reason',{required:decision==='REJECT',minlength:decision==='REJECT'?5:0,maxlength:1000,rows:4},'textarea');
    formDialog(ctx,decision==='APPROVE'?'Approve idea':'Reject idea','“'+idea.title+'” · '+(decision==='APPROVE'?'Approval is final. The author is named only if they consented when submitting.':'Rejection is final. The author’s identity is not published.'),reason.node,decision==='APPROVE'?'Approve idea':'Confirm rejection','decideIdea',function(){return [idea.id,{decision:decision,reason:reason.input.value,expectedVersion:idea.version}];},function(view){return view.status==='APPROVED'?(view.publicCredit?'Idea approved. The originator is now credited.':'Idea approved. The author did not consent to be named.'):'Idea rejected. The author’s identity is not published.';});
  };
  V.newCouncil=function(ctx){
    var council=ctx.state.council,directory=ctx.state.directory.people;
    var rows=h('div',{class:'council-editor'});
    directory.forEach(function(p){
      var existing=council.members.find(function(m){return m.subject===p.id;});
      var role=h('select',{name:'role-'+p.id,'aria-label':'Role for '+p.displayName},h('option',{value:'MEMBER'},'Member'),h('option',{value:'CHAIR'},'Chair'));role.value=existing?existing.membershipRole:'MEMBER';
      var member=h('input',{type:'checkbox',name:'member-'+p.id,checked:!!existing}),independent=h('input',{type:'checkbox',name:'independent-'+p.id,checked:!!existing&&existing.independent}),active=h('input',{type:'checkbox',name:'active-'+p.id,checked:!existing||existing.active});
      var row=h('div',{class:'council-editor-row'});
      var sync=function(){row.classList.toggle('is-member',member.checked);[independent,active,role].forEach(function(control){control.disabled=!member.checked;});};member.addEventListener('change',sync);
      rows.append(row);row.append(h('label',{class:'member-choice'},member,h('span',{},h('strong',{},p.displayName),h('small',{},p.title))),h('label',{class:'mini-check'},independent,'Independent'),h('label',{class:'mini-check'},active,'Active'),role);sync();
    });
    var min=V.field('Minimum voters','minVoters',{type:'number',min:3,max:5,value:council.selectionPolicy.minVoters,required:true});
    var max=V.field('Maximum voters','maxVoters',{type:'number',min:3,max:5,value:council.selectionPolicy.maxVoters,required:true});
    var reason=V.field('Reason for this proposal','reason',{required:true,minlength:10,maxlength:2000,rows:3,placeholder:'Why does the council need to change?'} ,'textarea');
    formDialog(ctx,'Propose a council change','Current roster v'+council.version+' changes only after sufficient valid approvals and explicit application.',h('div',{},rows,h('div',{class:'field-grid'},min.node,max.node),reason.node),'Submit proposal for voting','submitCouncilChange',function(form){
      if(Number(max.input.value)<Number(min.input.value))throw V.userError('Maximum voters must be at least the minimum.');
      var proposed=directory.filter(function(p){return form.elements['member-'+p.id].checked;}).map(function(p){return {subject:p.id,independent:form.elements['independent-'+p.id].checked,active:form.elements['active-'+p.id].checked,membershipRole:form.elements['role-'+p.id].value};});
      return [{expectedCouncilVersion:council.version,reason:reason.input.value,proposedMembers:proposed,proposedSelectionPolicy:{minVoters:Number(min.input.value),maxVoters:Number(max.input.value)}}];
    },function(change){return change.status==='AWAITING_ELIGIBLE_JURY'?'Proposal saved. It is waiting for enough eligible voters; the current roster stays in effect.':'Proposal submitted for voting. The current roster stays in effect.';});
  };
  // Applying is irreversible and invalidates every other open round on the current roster.
  V.applyDialog=function(ctx,change,openRounds){
    var next=change.baseCouncilVersion+1;
    formDialog(ctx,'Apply roster v'+next,change.reason,h('div',{class:'context-box'},h('strong',{},'This cannot be undone'),h('p',{},'Roster v'+next+' replaces v'+change.baseCouncilVersion+' for every new assignment.'),h('p',{'data-open-rounds':openRounds},'Every other open voting round on v'+change.baseCouncilVersion+' becomes stale and its votes stop counting'+(openRounds?' ('+openRounds+' visible to you).':'.'))),'Apply roster v'+next,'applyCouncilChange',function(){return [change.id,change.baseCouncilVersion];},function(view){return view.status==='APPLIED'?'Roster v'+next+' is now in effect.':'Roster application is pending. The current roster remains in effect.';});
  };
  V.newUnmask=function(ctx,item){
    var purpose=V.field('Reason for identity review','purpose',{required:true,minlength:10,maxlength:1000,rows:3,placeholder:'Explain the verification purpose for this report'},'textarea');
    formDialog(ctx,'Request identity review','Retain the same '+item.voterCount+' assigned voters. Requires '+item.quorumRequired+' approvals, including an independent member.',purpose.node,'Create voting request','createUnmaskRequest',function(){return [item.id,{recipientSubject:ctx.state.session.subject,purpose:purpose.input.value}];});
  };
  V.detail=function(ctx,item,kind){
    var content=h('div',{class:'detail-body'},h('div',{class:'card-tags'},V.badge(item.status),kind==='IDEA'?V.tag(V.categories[item.category]):null,kind==='IDEA'?V.credit(ctx,item):V.sealed(item.status)),h('p',{class:'detail-text'},item.description||item.evidenceDetails));
    if(item.voting)content.append(V.votePanel(ctx,item.voting));
    else if(kind==='REPORT')content.append(item.voterCount?h('section',{class:'context-box assignment'},h('strong',{},'Assigned voters · N = '+item.voterCount+' · T = '+item.quorumRequired),h('p',{},item.voters&&item.voters.length?item.voters.map(function(v){return v.displayName+(v.independent?' (independent)':'');}).join(', '):'Voter names are unavailable in this response.'),h('p',{},'No identity review has been requested. The assignment stays fixed for any request on this report.')):h('section',{class:'context-box assignment'},h('strong',{},'Saved · Awaiting an eligible jury'),h('p',{},'Fewer than three eligible council members, or no independent member, remain after conflicts of interest are excluded. The threshold is never lowered.')));
    if(kind==='REPORT'&&item.capabilities&&item.capabilities.canRequestUnmask)content.append(h('div',{class:'card-actions'},V.button('Request identity review',function(){V.newUnmask(ctx,item);},{class:'button primary','data-action':'request-unmask'})));
    content.append(h('div',{class:'dialog-actions'},V.button('Close',V.closeDialog,{class:'button secondary','data-dialog-close':''})));
    open(item.title,'Record '+item.id+' · '+V.date(item.createdAt),content);
  };
  V.identity=async function(ctx,kind,item,round){
    var generation=dialogGeneration,session=ctx.state.session,page=ctx.state.page;
    var result=await ctx.call('revealIdentity',[kind,item.id,round?round.id:undefined]);
    if(generation!==dialogGeneration||ctx.state.session!==session||ctx.state.page!==page||!session.authenticated)return;
    if(!result.ok){ctx.notify(V.errorText(result.error),true);return;}
    var identity=result.data;
    open('Authorized identity view',identity.simulated?'This is entirely synthetic data, not evidence of TideCloak decryption.':'Do not share or retain this information beyond the authorized scope.',h('div',{class:'identity-view'},V.tag(identity.simulated?'Simulated':'Authorized session','purple'),V.avatar(identity.displayName),h('h3',{},identity.displayName),identity.contact?h('p',{},identity.contact):null,h('div',{class:'dialog-actions'},V.button('Close identity view',V.closeDialog,{class:'button primary','data-dialog-close':''}))));
    identity=null;
  };
}(window));
