/* In-memory simulation, not authentication, encryption or cryptographic authorization. */
(function (global) {
  'use strict';
  var copy = function (value) { return JSON.parse(JSON.stringify(value)); };
  global.createVoiceVaultMock = function (fixtures) {
    if (!fixtures || fixtures.contractVersion !== 'v1') throw new Error('CONTRACT_MISMATCH');
    var data = copy(fixtures), people = data.people, council = data.council;
    var actorId = 'an', scenario = 'NORMAL', sequence = 200, requestSequence = 0;
    var ideas = [], reports = [], rounds = [], changes = [], audit = [], retries = {};
    var now = function () { return Date.now(); };
    var person = function (id) { return people.find(function (p) { return p.id === id; }); };
    var member = function (id) { return council.members.find(function (m) { return m.subject === id && m.active; }); };
    var current = function () { return person(actorId); };
    var id = function (prefix) { sequence += 1; return 'mock-' + prefix + '-' + sequence; };
    function fail(code, message) { var error = new Error(message || code); error.code = code; throw error; }
    var messages = {
      UNAUTHENTICATED:'Phiên đăng nhập không còn hiệu lực. Hãy chọn lại nhân vật mô phỏng.',
      FORBIDDEN:'Phiên hiện tại không có quyền thực hiện thao tác này.',
      INVALID_REQUEST:'Vui lòng kiểm tra và điền đầy đủ các trường bắt buộc.',
      VERSION_CONFLICT:'Dữ liệu đã thay đổi. Hãy tải lại trước khi thao tác.',
      COUNCIL_VERSION_CONFLICT:'Hội đồng đã có phiên bản mới. Phiếu cũ không còn áp dụng.',
      QUORUM_PENDING:'Chưa đủ phê duyệt hợp lệ, bao gồm thành viên độc lập.',
      APPROVAL_EXPIRED:'Lượt bỏ phiếu đã hết hạn. Không thể sử dụng phiếu cũ.',
      INTEGRITY_MISMATCH:'Thông tin không khớp với hồ sơ đã được phê duyệt.',
      POLICY_UNAVAILABLE:'Runtime LIVE và policy chưa được kết nối. Danh tính tiếp tục được giữ kín.',
      INSUFFICIENT_ELIGIBLE_JURORS:'Chưa đủ thành viên hợp lệ hoặc thiếu đại diện độc lập.',
      CONSENT_REQUIRED:'Tác giả chưa đồng ý công khai danh tính khi được duyệt.',
      ALREADY_VOTED:'Bạn đã bỏ phiếu cho lượt này.', NOT_FOUND:'Không tìm thấy hồ sơ được yêu cầu.'
    };
    function log(action, targetId, outcome) {
      var anonymous=['IDEA_SUBMITTED','REPORT_SUBMITTED'].includes(action);
      audit.unshift({id:id('event'),action:action,targetId:targetId,outcome:outcome||'ALLOWED',enforcement:'SIMULATED',actor:anonymous?'Người gửi ẩn danh':current()?current().displayName:'Phiên chưa đăng nhập',createdAt:new Date().toISOString()});
    }
    function authenticate() {
      if (!current() || scenario === 'UNAUTHENTICATED') fail('UNAUTHENTICATED');
      if (scenario === 'FORBIDDEN') fail('FORBIDDEN');
    }
    function operationGate() {
      authenticate();
      if (['POLICY_UNAVAILABLE','INTEGRITY_MISMATCH','VERSION_CONFLICT','EXPIRED'].includes(scenario)) {
        fail(scenario === 'EXPIRED' ? 'APPROVAL_EXPIRED' : scenario);
      }
    }
    function api(fn) {
      return async function () {
        var args = arguments;
        var requestId = 'simulated-request-' + (++requestSequence);
        try { return {ok:true,data:copy(await fn.apply(null,args)),requestId:requestId,contractVersion:'v1'}; }
        catch (error) {
          var code = error.code || 'INVALID_REQUEST';
          return {ok:false,error:{code:code,message:messages[code]||error.message||'Không thể thực hiện thao tác.',enforcement:'SIMULATED',retryable:code==='POLICY_UNAVAILABLE'},requestId:requestId,contractVersion:'v1'};
        }
      };
    }
    function text(value, min, max) { return typeof value === 'string' && value.trim().length >= min && value.length <= max; }
    function page(items, query) {
      var start = query && query.cursor ? Number(query.cursor) : 0;
      if (!Number.isInteger(start) || start < 0) start = 0;
      var limit = Math.max(1,Math.min(50,Number(query && query.limit)||50));
      if (scenario === 'EMPTY') return {items:[],nextCursor:null};
      return {items:items.slice(start,start+limit),nextCursor:start+limit<items.length?String(start+limit):null};
    }
    function session() {
      var p = current(), authenticated = !!p && scenario !== 'UNAUTHENTICATED';
      return {authenticated:authenticated,subject:authenticated?p.id:null,displayName:authenticated?p.displayName:'Chưa đăng nhập',initials:authenticated?p.initials:'?',title:authenticated?p.title:'',role:authenticated?p.role:null,capabilities:authenticated?{canSubmit:p.role!=='it_admin',canProposeCouncil:!!member(p.id)||p.role==='it_admin'}:{},organizationId:data.organizationId};
    }
    function randomInt(min,max) {
      var range=max-min, values=new Uint32Array(1), limit=Math.floor(4294967296/range)*range;
      do { global.crypto.getRandomValues(values); } while (values[0]>=limit);
      return min+values[0]%range;
    }
    function related(a,b) {
      function ancestors(start) { var found=[], cursor=person(start), seen={}; while(cursor&&cursor.managerId&&!seen[cursor.id]) {seen[cursor.id]=true;found.push(cursor.managerId);cursor=person(cursor.managerId);}return found; }
      return a===b || ancestors(a).includes(b) || ancestors(b).includes(a);
    }
    function select(excludedIds) {
      var eligible=council.members.filter(function(m){return m.active&&!excludedIds.includes(m.subject);});
      if (eligible.length<council.selectionPolicy.minVoters || !eligible.some(function(m){return m.independent;}) || scenario==='INSUFFICIENT_ELIGIBLE_JURORS') return null;
      var n=randomInt(council.selectionPolicy.minVoters,Math.min(council.selectionPolicy.maxVoters,eligible.length)+1), choices=[];
      function collect(from,selected) {
        if(selected.length===n){if(selected.some(function(m){return m.independent;}))choices.push(selected.slice());return;}
        for(var i=from;i<=eligible.length-(n-selected.length);i++){selected.push(eligible[i]);collect(i+1,selected);selected.pop();}
      }
      collect(0,[]);
      if(!choices.length)return null;
      return choices[randomInt(0,choices.length)].map(function(m){return {id:m.subject,displayName:person(m.subject).displayName,independent:m.independent};});
    }
    function newRound(resourceId,operation,voters,recipientSubject,roundId) {
      var round={id:roundId||id('vote'),resourceId:resourceId,operation:operation,voters:voters,voterCount:voters.length,quorumRequired:Math.ceil(2*voters.length/3),councilVersion:council.version,recipientSubject:recipientSubject,status:'COLLECTING',approvals:[],expiresAt:new Date(now()+86400000).toISOString()};
      rounds.unshift(round);return round;
    }
    function roundView(round) {
      if(!round)return null;
      var approved=round.approvals.filter(function(a){return a.decision==='APPROVE';});
      var independent=approved.some(function(a){return round.voters.some(function(v){return v.id===a.voterId&&v.independent;});});
      var expired=Date.parse(round.expiresAt)<=now()&&['COLLECTING','READY','GRANTED'].includes(round.status);
      var state=scenario==='EXPIRED'||expired?'EXPIRED':round.status;
      return {id:round.id,resourceId:round.resourceId,operation:round.operation,voters:round.voters,voterCount:round.voterCount,quorumRequired:round.quorumRequired,councilVersion:round.councilVersion,status:state,approvalCount:approved.length,validApprovals:round.approvals,independentApproved:independent,expiresAt:round.expiresAt,recipientSubject:round.recipientSubject,recipientName:person(round.recipientSubject).displayName,canVote:!!current()&&state==='COLLECTING'&&round.voters.some(function(v){return v.id===actorId;})&&!round.approvals.some(function(a){return a.voterId===actorId;}),canReveal:!!current()&&round.recipientSubject===actorId&&['READY','GRANTED'].includes(state)};
    }
    function ideaView(idea) {
      var p=current();
      return {id:idea.id,title:idea.title,description:idea.description,category:idea.category,status:idea.status,version:idea.version,createdAt:idea.createdAt,endorsedBy:idea.endorsedBy||null,publishCreditOnApproval:idea.publishCreditOnApproval,publicCredit:idea.status==='APPROVED'&&idea.publishCreditOnApproval?{displayName:person(idea.authorSubject).displayName,simulated:true}:null,capabilities:{canEndorse:!!p&&p.role==='manager'&&idea.status==='UNDER_REVIEW',canDecide:!!p&&p.role==='director'&&['UNDER_REVIEW','ENDORSED'].includes(idea.status),canReveal:!!p&&p.role==='director'&&idea.status==='APPROVED'&&idea.publishCreditOnApproval}};
    }
    function reportAssignment(report) {
      if(report.assignment)return report.assignment;
      var round=rounds.find(function(r){return r.id===report.roundId;});
      return round?{voters:round.voters,councilVersion:round.councilVersion}:null;
    }
    function canReadReport(report) {var assignment=reportAssignment(report);return current()&&(report.reporterSubject===actorId||(assignment&&assignment.voters.some(function(v){return v.id===actorId;})));}
    function reportView(report) {
      var round=rounds.find(function(r){return r.id===report.roundId;}),v=roundView(round);
      var assignment=reportAssignment(report),voters=assignment?assignment.voters:[];
      return {id:report.id,title:report.title,evidenceDetails:report.evidenceDetails,accusedPersonIds:report.accusedPersonIds,createdAt:report.createdAt,status:assignment?'INVESTIGATING':'AWAITING_ELIGIBLE_JURY',version:report.version,votingRequestId:round?round.id:null,voting:v,voters:voters,voterCount:voters.length,quorumRequired:Math.ceil(2*voters.length/3),capabilities:{canRequestUnmask:!round&&!!assignment&&assignment.councilVersion===council.version&&voters.some(function(j){return j.id===actorId;})}};
    }
    function changeView(change) {
      var round=rounds.find(function(r){return r.id===change.votingRequestId;}),v=roundView(round);
      return {id:change.id,title:'Cập nhật thành viên hội đồng',reason:change.reason,createdAt:change.createdAt,baseCouncilVersion:change.baseCouncilVersion,status:change.status==='APPLIED'?'APPLIED':v?v.status:'AWAITING_ELIGIBLE_JURY',proposedMembers:change.proposedMembers,proposedSelectionPolicy:change.proposedSelectionPolicy,votingRequestId:change.votingRequestId,voting:v,capabilities:{canApply:!!v&&v.status==='READY'&&round.recipientSubject===actorId}};
    }
    data.ideas.forEach(function(idea){ideas.push(Object.assign({},idea,{version:1,createdAt:new Date(now()-idea.ageHours*3600000).toISOString()}));});
    data.reports.forEach(function(report){
      var voters=report.voterIds.map(function(subject){var m=member(subject);return {id:subject,displayName:person(subject).displayName,independent:m.independent};});
      var round=newRound(report.id,'REVEAL_REPORT_IDENTITY',voters,report.recipientSubject,'vote-'+report.id);
      reports.push(Object.assign({},report,{roundId:round.id,version:1,createdAt:new Date(now()-report.ageHours*3600000).toISOString()}));
    });
    audit.push({id:'event-initial',actor:'Hệ thống mô phỏng',action:'COUNCIL_INITIALIZED',targetId:'council-v1',outcome:'ALLOWED',enforcement:'SIMULATED',createdAt:new Date(now()-172800000).toISOString()});
    var runtime={contractVersion:'v1',mode:'MOCK'};
    runtime.init=api(session);runtime.getSession=api(session);
    runtime.login=api(function(subject){if(subject&&!person(subject))fail('INVALID_REQUEST');actorId=subject||'an';return session();});
    runtime.logout=api(function(){actorId=null;return null;});
    runtime.listIdeas=api(function(query){authenticate();return page(ideas.map(ideaView),query);});
    runtime.submitIdea=api(function(input){
      authenticate();if(!session().capabilities.canSubmit)fail('FORBIDDEN');
      if(!input||!text(input.title,5,160)||!text(input.description,20,6000)||!['PROCESS','CULTURE','SUSTAINABILITY','PRODUCT'].includes(input.category)||typeof input.publishCreditOnApproval!=='boolean')fail('INVALID_REQUEST');
      var idea={id:id('idea'),title:input.title.trim(),description:input.description.trim(),category:input.category,publishCreditOnApproval:input.publishCreditOnApproval,authorSubject:actorId,status:'UNDER_REVIEW',version:1,createdAt:new Date().toISOString()};
      ideas.unshift(idea);log('IDEA_SUBMITTED',idea.id);return ideaView(idea);
    });
    runtime.endorseIdea=api(function(ideaId,version){operationGate();var idea=ideas.find(function(i){return i.id===ideaId;});if(!idea)fail('NOT_FOUND');if(current().role!=='manager')fail('FORBIDDEN');if(idea.version!==version||idea.status!=='UNDER_REVIEW')fail('VERSION_CONFLICT');idea.status='ENDORSED';idea.endorsedBy=current().displayName;idea.version++;log('IDEA_ENDORSED',idea.id);return ideaView(idea);});
    runtime.decideIdea=api(function(ideaId,input){
      operationGate();var idea=ideas.find(function(i){return i.id===ideaId;});if(!idea)fail('NOT_FOUND');if(current().role!=='director')fail('FORBIDDEN');
      if(!input||idea.version!==input.expectedVersion||!['UNDER_REVIEW','ENDORSED'].includes(idea.status))fail('VERSION_CONFLICT');
      if(!['APPROVE','REJECT'].includes(input.decision))fail('INVALID_REQUEST');
      if(input.decision==='APPROVE'&&idea.status!=='ENDORSED')fail('VERSION_CONFLICT');
      if(input.decision==='REJECT'&&!text(input.reason,5,2000))fail('INVALID_REQUEST');
      idea.status=input.decision==='APPROVE'?'APPROVED':'REJECTED';idea.version++;log('IDEA_'+idea.status,idea.id);return ideaView(idea);
    });
    runtime.listReports=api(function(query){authenticate();return page(reports.filter(canReadReport).map(reportView),query);});
    runtime.getDirectory=api(function(){authenticate();return {people:people.map(function(p){return {id:p.id,displayName:p.displayName,title:p.title,department:p.department};})};});
    runtime.submitReport=api(function(input){
      authenticate();if(!session().capabilities.canSubmit)fail('FORBIDDEN');
      if(!input||!text(input.title,5,160)||!text(input.evidenceDetails,20,8000)||!Array.isArray(input.accusedPersonIds)||!input.accusedPersonIds.length||input.accusedPersonIds.some(function(s){return !person(s);})||input.consent!==true)fail('INVALID_REQUEST');
      var signature=JSON.stringify([actorId,input.title,input.evidenceDetails,input.accusedPersonIds.slice().sort()]);
      if(input.clientRequestId&&retries[input.clientRequestId]){if(retries[input.clientRequestId].signature!==signature)fail('IDEMPOTENCY_CONFLICT');return reportView(reports.find(function(r){return r.id===retries[input.clientRequestId].id;}));}
      var accused=Array.from(new Set(input.accusedPersonIds));
      var excluded=council.members.filter(function(m){return accused.some(function(a){return related(m.subject,a);});}).map(function(m){return m.subject;});
      var voters=select(excluded),report={id:id('report'),title:input.title.trim(),evidenceDetails:input.evidenceDetails.trim(),accusedPersonIds:accused,reporterSubject:actorId,contact:input.contact||'',version:1,createdAt:new Date().toISOString()};
      if(voters)report.assignment={voters:voters,councilVersion:council.version};
      reports.unshift(report);if(input.clientRequestId)retries[input.clientRequestId]={id:report.id,signature:signature};log('REPORT_SUBMITTED',report.id);return reportView(report);
    });
    runtime.createUnmaskRequest=api(function(reportId,input){
      operationGate();var report=reports.find(function(r){return r.id===reportId;});if(!report)fail('NOT_FOUND');
      var assignment=reportAssignment(report),round=rounds.find(function(r){return r.id===report.roundId;});
      if(!assignment)fail('INSUFFICIENT_ELIGIBLE_JURORS');
      if(!assignment.voters.some(function(v){return v.id===actorId;}))fail('FORBIDDEN');
      if(assignment.councilVersion!==council.version)fail('COUNCIL_VERSION_CONFLICT');
      if(round){if(input&&input.recipientSubject&&input.recipientSubject!==round.recipientSubject)fail('VERSION_CONFLICT');}
      else{
        if(!input||!text(input.purpose,10,2000)||input.recipientSubject!==actorId)fail('INVALID_REQUEST');
        round=newRound(report.id,'REVEAL_REPORT_IDENTITY',copy(assignment.voters),actorId);report.roundId=round.id;
        log('UNMASK_REQUEST_CREATED',round.id);
      }
      return {id:round.id,votingRequestId:round.id,voting:roundView(round)};
    });
    runtime.getVotingRequest=api(function(roundId){authenticate();var round=rounds.find(function(r){return r.id===roundId;});if(!round)fail('NOT_FOUND');return roundView(round);});
    runtime.castVote=api(function(roundId,input){
      operationGate();var round=rounds.find(function(r){return r.id===roundId;});if(!round)fail('NOT_FOUND');
      if(round.councilVersion!==council.version||round.status==='STALE')fail('COUNCIL_VERSION_CONFLICT');
      if(Date.parse(round.expiresAt)<=now())fail('APPROVAL_EXPIRED');
      if(round.status!=='COLLECTING')fail('VERSION_CONFLICT');
      if(!round.voters.some(function(v){return v.id===actorId;}))fail('FORBIDDEN');
      if(round.approvals.some(function(a){return a.voterId===actorId;}))fail('ALREADY_VOTED');
      if(!input||!['APPROVE','DENY'].includes(input.decision)||!text(input.reason,3,2000))fail('INVALID_REQUEST');
      round.approvals.push({voterId:actorId,displayName:current().displayName,decision:input.decision,reason:input.reason,createdAt:new Date().toISOString()});
      if(input.decision==='DENY')round.status='DENIED';
      else {var view=roundView(round);if(view.approvalCount>=round.quorumRequired&&view.independentApproved)round.status='READY';}
      log('VOTE_'+input.decision,round.id);return roundView(round);
    });
    runtime.getCouncil=api(function(){authenticate();return {version:council.version,rosterHash:council.rosterHash,selectionPolicy:council.selectionPolicy,members:council.members.map(function(m){return Object.assign({},m,{id:m.subject,displayName:person(m.subject).displayName,title:person(m.subject).title});}),capabilities:{canPropose:session().capabilities.canProposeCouncil}};});
    runtime.listCouncilChanges=api(function(query){authenticate();return page(changes.map(changeView),query);});
    runtime.submitCouncilChange=api(function(input){
      operationGate();if(!session().capabilities.canProposeCouncil)fail('FORBIDDEN');
      if(!input||input.expectedCouncilVersion!==council.version)fail('COUNCIL_VERSION_CONFLICT');
      var target=input.proposedMembers, policy=input.proposedSelectionPolicy;
      if(!Array.isArray(target)||target.length>12||!text(input.reason,10,2000)||!policy||!Number.isInteger(policy.minVoters)||!Number.isInteger(policy.maxVoters)||policy.minVoters<3||policy.maxVoters>5||policy.minVoters>policy.maxVoters)fail('INVALID_REQUEST');
      if(new Set(target.map(function(m){return m.subject;})).size!==target.length||target.some(function(m){return !person(m.subject)||typeof m.active!=='boolean'||typeof m.independent!=='boolean'||!['MEMBER','CHAIR'].includes(m.membershipRole);}))fail('INVALID_REQUEST');
      var active=target.filter(function(m){return m.active;});if(active.length<policy.minVoters||!active.some(function(m){return m.independent;}))fail('INSUFFICIENT_ELIGIBLE_JURORS');
      var cleaned=target.map(function(m){return {subject:m.subject,independent:m.independent,active:m.active,membershipRole:m.membershipRole};}).sort(function(a,b){return a.subject.localeCompare(b.subject);});
      var signature=JSON.stringify([council.version,cleaned,policy.minVoters,policy.maxVoters]);
      var existing=changes.find(function(c){return c.signature===signature&&!['DENIED','EXPIRED','STALE','APPLIED'].includes(changeView(c).status);});if(existing)return changeView(existing);
      var changed=council.members.filter(function(old){var next=cleaned.find(function(m){return m.subject===old.subject;});return !next||['independent','active','membershipRole'].some(function(key){return old[key]!==next[key];});}).map(function(m){return m.subject;});
      if(!changed.length&&cleaned.length===council.members.length&&policy.minVoters===council.selectionPolicy.minVoters&&policy.maxVoters===council.selectionPolicy.maxVoters)fail('INVALID_REQUEST');
      var voters=select(changed),change={id:id('council'),reason:input.reason.trim(),baseCouncilVersion:council.version,proposedMembers:cleaned,proposedSelectionPolicy:copy(policy),status:'COLLECTING',signature:signature,createdAt:new Date().toISOString()};
      if(voters)change.votingRequestId=newRound(change.id,'CHANGE_COUNCIL',voters,actorId).id;else change.status='AWAITING_ELIGIBLE_JURY';
      changes.unshift(change);log('COUNCIL_CHANGE_PROPOSED',change.id);return changeView(change);
    });
    runtime.applyCouncilChange=api(function(changeId,version){
      operationGate();var change=changes.find(function(c){return c.id===changeId;});if(!change)fail('NOT_FOUND');
      if(version!==council.version||change.baseCouncilVersion!==council.version)fail('COUNCIL_VERSION_CONFLICT');
      var round=rounds.find(function(r){return r.id===change.votingRequestId;});if(!round)fail('INSUFFICIENT_ELIGIBLE_JURORS');
      if(Date.parse(round.expiresAt)<=now())fail('APPROVAL_EXPIRED');
      if(round.recipientSubject!==actorId)fail('FORBIDDEN');if(round.status!=='READY')fail('QUORUM_PENDING');
      council.members=copy(change.proposedMembers);council.selectionPolicy=copy(change.proposedSelectionPolicy);council.version++;council.rosterHash='simulated-roster-v'+council.version;
      change.status='APPLIED';round.status='APPLIED';
      rounds.forEach(function(r){if(r!==round&&['COLLECTING','READY'].includes(r.status))r.status='STALE';});
      log('COUNCIL_CHANGE_APPLIED',change.id);return changeView(change);
    });
    runtime.revealIdentity=api(function(kind,resourceId,roundId){
      operationGate();
      if(kind==='IDEA'){
        var idea=ideas.find(function(i){return i.id===resourceId;});if(!idea)fail('NOT_FOUND');
        if(current().role!=='director'||idea.status!=='APPROVED')fail('POLICY_DENIED');if(!idea.publishCreditOnApproval)fail('CONSENT_REQUIRED');
        return {displayName:person(idea.authorSubject).displayName,simulated:true};
      }
      var report=reports.find(function(r){return r.id===resourceId;}),round=rounds.find(function(r){return r.id===roundId;});
      if(!report||!round||round.resourceId!==resourceId||round.operation!=='REVEAL_REPORT_IDENTITY')fail('INTEGRITY_MISMATCH');
      if(round.councilVersion!==council.version)fail('COUNCIL_VERSION_CONFLICT');
      if(round.recipientSubject!==actorId)fail('FORBIDDEN');
      if(!['READY','GRANTED'].includes(round.status))fail('QUORUM_PENDING');
      if(Date.parse(round.expiresAt)<=now())fail('APPROVAL_EXPIRED');
      round.status='GRANTED';log('IDENTITY_VIEWED_SIMULATION',report.id);
      return {displayName:person(report.reporterSubject).displayName,contact:report.contact||report.reporterSubject+'@example.test',simulated:true};
    });
    runtime.listAudit=api(function(query){authenticate();return page(audit,query);});
    runtime.simulation={
      personas:copy(people),scenarios:copy(data.scenarios),
      setScenario:function(value){if(!data.scenarios.some(function(s){return s.id===value;}))throw new Error('INVALID_SCENARIO');scenario=value;},
      getScenario:function(){return scenario;}
    };
    return runtime;
  };
}(window));
