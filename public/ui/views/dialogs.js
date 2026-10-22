(function(global){
  'use strict';
  var V=global.VoiceVaultView,h=V.el,dialogGeneration=0;
  V.closeDialog=function(){dialogGeneration++;var dialog=document.getElementById('app-dialog');if(dialog&&dialog.open)dialog.close();};
  function open(title,description,content){
    dialogGeneration++;
    var dialog=document.getElementById('app-dialog'),previous=document.activeElement;
    if(dialog.open)dialog.close();
    dialog.replaceChildren(h('div',{class:'dialog-heading'},h('div',{},h('p',{class:'eyebrow'},'VOICEVAULT'),h('h2',{id:'dialog-title'},title)),V.button(V.icon('close'),function(){dialog.close();},{class:'icon-button','aria-label':'Đóng','data-dialog-close':''})),h('p',{class:'dialog-description'},description),content);
    dialog.onclose=function(){if(!dialog.open){dialogGeneration++;dialog.replaceChildren();if(previous&&previous.isConnected)previous.focus();}};
    dialog.showModal();return dialog;
  }
  function formDialog(ctx,title,description,fields,submitLabel,method,inputBuilder){
    var form=h('form',{class:'dialog-form'}),error=h('div',{class:'form-error',role:'alert',hidden:true});
    var submit=h('button',{type:'submit',class:'button primary'},submitLabel,V.icon('arrow',16));
    form.append(error,fields,h('div',{class:'dialog-actions'},V.button('Hủy',V.closeDialog,{class:'button secondary'}),submit));
    form.addEventListener('submit',async function(event){
      event.preventDefault();if(!form.reportValidity())return;
      submit.disabled=true;error.hidden=true;
      try{
        var args=inputBuilder(form);
        var result=await ctx.call(method,args);
        if(!form.isConnected||!document.getElementById('app-dialog').open)return;
        if(result.ok){V.closeDialog();ctx.notify('Đã ghi nhận thay đổi.');await ctx.refresh();}
        else{error.textContent=result.error.message+' ('+result.error.code+')';error.hidden=false;}
      }catch(problem){error.textContent='Vui lòng kiểm tra dữ liệu trước khi gửi.';error.hidden=false;}
      finally{submit.disabled=false;}
    });
    return open(title,description,form);
  }
  V.newIdea=function(ctx){
    var title=V.field('Tên sáng kiến','title',{required:true,minlength:5,maxlength:160,placeholder:'Bạn muốn cải thiện điều gì?'});
    var description=V.field('Mô tả ý tưởng','description',{required:true,minlength:20,maxlength:6000,rows:5,placeholder:'Vấn đề hiện tại, hướng giải quyết và tác động mong đợi…'},'textarea');
    var category=V.field('Lĩnh vực','category',{},'select');
    Object.keys(V.categories).forEach(function(key){category.input.append(h('option',{value:key},V.categories[key]));});
    var consent=h('input',{type:'checkbox',name:'publishCreditOnApproval',checked:true});
    formDialog(ctx,'Gửi một sáng kiến','Ý tưởng được đánh giá trước khi công khai tác giả.'+(ctx.runtime.mode==='MOCK'?' Chỉ sử dụng dữ liệu giả trong bản xem thử.':''),h('div',{},title.node,description.node,category.node,h('label',{class:'check-field'},consent,h('span',{},'Tôi đồng ý công khai tên để nhận ghi nhận nếu ý tưởng được duyệt.'))),'Gửi sáng kiến','submitIdea',function(){return [{title:title.input.value,description:description.input.value,category:category.input.value,publishCreditOnApproval:consent.checked}];});
  };
  V.newReport=function(ctx){
    var title=V.field('Tiêu đề phản ánh','title',{required:true,minlength:5,maxlength:160,placeholder:'Mô tả ngắn nội dung cần xem xét'});
    var details=V.field('Nội dung và căn cứ','evidenceDetails',{required:true,minlength:20,maxlength:8000,rows:5,placeholder:ctx.runtime.mode==='MOCK'?'Mô tả tình huống bằng dữ liệu giả.':'Mô tả tình huống cụ thể và căn cứ cần xác minh.'},'textarea');
    var choices=h('fieldset',{class:'person-options'},h('legend',{},'Các bên có liên quan'));
    var directory=(ctx.state.directory&&ctx.state.directory.people)||[];
    directory.forEach(function(p){choices.append(h('label',{class:'person-option'},h('input',{type:'checkbox',name:'accused-'+p.id,value:p.id}),V.avatar(p.displayName,true),h('span',{},h('strong',{},p.displayName),h('small',{},p.title))));});
    var contact=V.field('Email liên hệ (tùy chọn)','contact',{type:'email',maxlength:160,autocomplete:'off',placeholder:ctx.runtime.mode==='MOCK'?'Chỉ nhập email giả, ví dụ an@example.test':'Email liên hệ của bạn'});
    var consent=h('input',{type:'checkbox',name:'consent',required:true});
    formDialog(ctx,'Gửi phản ánh','Bạn có thể chọn nhiều người liên quan. Hệ thống sẽ chọn người được vote từ hội đồng đã xác lập.',h('div',{},title.node,details.node,choices,contact.node,h('label',{class:'check-field'},consent,h('span',{},'Tôi đồng ý với quy trình xem xét danh tính theo phê duyệt.'))),'Gửi phản ánh','submitReport',function(form){return [{title:title.input.value,evidenceDetails:details.input.value,accusedPersonIds:Array.from(form.querySelectorAll('input[name^="accused-"]:checked')).map(function(input){return input.value;}),contact:contact.input.value,consent:consent.checked}];});
  };
  V.voteDialog=function(ctx,round,decision){
    var reason=V.field('Lý do cho ý kiến của bạn','reason',{required:true,minlength:3,maxlength:2000,rows:4,placeholder:'Nêu căn cứ cho quyết định này…'},'textarea');
    formDialog(ctx,decision==='APPROVE'?'Phê duyệt yêu cầu':'Không thông qua yêu cầu','Phiếu gắn với đúng lượt, danh sách người vote và phiên bản hội đồng hiện tại.',h('div',{},h('div',{class:'context-box'},h('strong',{},round.operation==='CHANGE_COUNCIL'?'Thay đổi hội đồng':'Yêu cầu xem danh tính'),h('p',{},'Hội đồng v'+round.councilVersion+' · '+round.voterCount+' người · Cần '+round.quorumRequired+' phiếu và thành viên độc lập.'),ctx.runtime.mode==='MOCK'?V.tag('Mô phỏng','purple'):null),reason.node),decision==='APPROVE'?'Xác nhận phê duyệt':'Xác nhận không thông qua','castVote',function(){return [round.id,{decision:decision,reason:reason.input.value}];});
  };
  V.decisionDialog=function(ctx,idea,decision){
    var reason=V.field(decision==='REJECT'?'Lý do từ chối':'Ghi chú (tùy chọn)','reason',{required:decision==='REJECT',minlength:decision==='REJECT'?5:0,maxlength:2000,rows:4},'textarea');
    formDialog(ctx,decision==='APPROVE'?'Duyệt sáng kiến':'Từ chối sáng kiến',idea.title,reason.node,decision==='APPROVE'?'Duyệt sáng kiến':'Xác nhận từ chối','decideIdea',function(){return [idea.id,{decision:decision,reason:reason.input.value,expectedVersion:idea.version}];});
  };
  V.newCouncil=function(ctx){
    var council=ctx.state.council,directory=ctx.state.directory.people;
    var rows=h('div',{class:'council-editor'});
    directory.forEach(function(p){
      var existing=council.members.find(function(m){return m.subject===p.id;});
      var role=h('select',{name:'role-'+p.id,'aria-label':'Vai trò '+p.displayName},h('option',{value:'MEMBER'},'Thành viên'),h('option',{value:'CHAIR'},'Chủ tịch'));role.value=existing?existing.membershipRole:'MEMBER';
      rows.append(h('div',{class:'council-editor-row'},h('label',{class:'member-choice'},h('input',{type:'checkbox',name:'member-'+p.id,checked:!!existing}),h('span',{},h('strong',{},p.displayName),h('small',{},p.title))),h('label',{class:'mini-check'},h('input',{type:'checkbox',name:'independent-'+p.id,checked:!!existing&&existing.independent}),'Độc lập'),h('label',{class:'mini-check'},h('input',{type:'checkbox',name:'active-'+p.id,checked:!existing||existing.active}),'Hoạt động'),role));
    });
    var min=V.field('Số người vote tối thiểu','minVoters',{type:'number',min:3,max:5,value:council.selectionPolicy.minVoters,required:true});
    var max=V.field('Số người vote tối đa','maxVoters',{type:'number',min:3,max:5,value:council.selectionPolicy.maxVoters,required:true});
    var reason=V.field('Lý do đề xuất thay đổi','reason',{required:true,minlength:10,maxlength:2000,rows:3,placeholder:'Vì sao hội đồng cần thay đổi?'} ,'textarea');
    formDialog(ctx,'Đề xuất thay đổi hội đồng','Roster hiện hành v'+council.version+' chỉ thay đổi sau khi đủ phiếu hợp lệ và được áp dụng.',h('div',{},rows,h('div',{class:'field-grid'},min.node,max.node),reason.node),'Tạo đề xuất để biểu quyết','submitCouncilChange',function(form){
      var proposed=directory.filter(function(p){return form.elements['member-'+p.id].checked;}).map(function(p){return {subject:p.id,independent:form.elements['independent-'+p.id].checked,active:form.elements['active-'+p.id].checked,membershipRole:form.elements['role-'+p.id].value};});
      return [{expectedCouncilVersion:council.version,reason:reason.input.value,proposedMembers:proposed,proposedSelectionPolicy:{minVoters:Number(min.input.value),maxVoters:Number(max.input.value)}}];
    });
  };
  V.newUnmask=function(ctx,item){
    var purpose=V.field('Lý do cần mở danh tính','purpose',{required:true,minlength:10,maxlength:2000,rows:3,placeholder:'Mục đích xác minh trong phạm vi hồ sơ này'},'textarea');
    formDialog(ctx,'Đề nghị mở danh tính','Giữ nguyên '+item.voterCount+' người đã được phân công. Cần '+item.quorumRequired+' phiếu phê duyệt và có thành viên độc lập.',purpose.node,'Tạo yêu cầu biểu quyết','createUnmaskRequest',function(){return [item.id,{recipientSubject:ctx.state.session.subject,purpose:purpose.input.value}];});
  };
  V.detail=function(ctx,item,kind){
    var content=h('div',{class:'detail-body'},h('div',{class:'card-tags'},V.badge(item.status),kind==='IDEA'?V.tag(V.categories[item.category]):null,V.sealed()),h('p',{class:'detail-text'},item.description||item.evidenceDetails));
    if(item.voting)content.append(V.votePanel(ctx,item.voting));
    if(kind==='REPORT'&&item.capabilities&&item.capabilities.canRequestUnmask)content.append(h('div',{class:'card-actions'},V.button('Đề nghị mở danh tính',function(){V.newUnmask(ctx,item);},{class:'button primary','data-action':'request-unmask'})));
    content.append(h('div',{class:'dialog-actions'},V.button('Đóng',V.closeDialog,{class:'button secondary','data-dialog-close':''})));
    open(item.title,'Hồ sơ '+item.id+' · '+V.date(item.createdAt),content);
  };
  V.identity=async function(ctx,kind,item,round){
    var generation=dialogGeneration,session=ctx.state.session,page=ctx.state.page;
    var result=await ctx.call('revealIdentity',[kind,item.id,round?round.id:undefined]);
    if(generation!==dialogGeneration||ctx.state.session!==session||ctx.state.page!==page||!session.authenticated)return;
    if(!result.ok){ctx.notify(result.error.message,true);return;}
    var identity=result.data;
    open('Danh tính trong phiên xem',identity.simulated?'Dữ liệu minh họa hoàn toàn giả; đây không phải bằng chứng giải mã TideCloak.':'Không chia sẻ hoặc lưu thông tin ngoài phạm vi được phép.',h('div',{class:'identity-view'},V.tag(identity.simulated?'Mô phỏng':'Phiên được phép','purple'),V.avatar(identity.displayName),h('h3',{},identity.displayName),identity.contact?h('p',{},identity.contact):null,h('div',{class:'dialog-actions'},V.button('Đóng phiên xem',V.closeDialog,{class:'button primary','data-dialog-close':''}))));
    identity=null;
  };
}(window));
