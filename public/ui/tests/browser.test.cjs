const {test,before,after,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const http=require('node:http');
const {pathToFileURL}=require('node:url');
const {launchBrowser}=require('./cdp.cjs');
const publicRoot=path.resolve(__dirname,'../..');
const entry=path.join(publicRoot,'ui/index.html');
let page;
before(async()=>{assert.ok(fs.existsSync(entry),'Static UI entry must exist and be openable');page=await launchBrowser();});
after(async()=>{if(page)await page.close();});
beforeEach(async()=>{if(page){await page.command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await page.navigate(pathToFileURL(entry).href);await page.waitFor("document.body.dataset.appState === 'ready'");}});
async function persona(id){await page.evaluate("document.getElementById('persona-select').value="+JSON.stringify(id)+";document.getElementById('persona-select').dispatchEvent(new Event('change',{bubbles:true}))");await page.waitFor('window.VoiceVaultRuntime && document.body.dataset.persona === '+JSON.stringify(id));}
async function nav(id){await page.click('.nav-button[data-page="'+id+'"]');await page.waitFor('document.body.dataset.page === '+JSON.stringify(id)+" && document.body.dataset.appState === 'ready'");}
async function fill(name,value){await page.evaluate('var input=document.querySelector("dialog [name='+name+']");input.value='+JSON.stringify(value)+';input.dispatchEvent(new Event("input",{bubbles:true}));');}

test('the interface uses English across routes, labels and form content', async()=>{
  assert.equal(await page.evaluate('document.documentElement.lang'), 'en');
  const vietnamese = /[\u00c0-\u024f\u1e00-\u1eff]/u;
  for (const route of ['overview','ideas','reports','votes','council','audit']) {
    await nav(route);
    const copy = await page.evaluate(`document.body.innerText + ' ' + [...document.querySelectorAll('[aria-label], [placeholder]')].map(el=>(el.getAttribute('aria-label')||'')+' '+(el.getAttribute('placeholder')||'')).join(' ')`);
    assert.doesNotMatch(copy, vietnamese, route+' still contains untranslated copy');
  }
  await nav('ideas');await page.click('[data-action="new-idea"]');
  assert.match(await page.evaluate('document.querySelector("dialog").innerText'), /Submit an idea/);
  assert.doesNotMatch(await page.evaluate('document.querySelector("dialog").innerText'), vietnamese);
  assert.equal(await page.evaluate('var title=document.querySelector("dialog [name=title]");title.checkValidity();title.validationMessage'), 'Please complete this field.');
});

test('file preview boots offline and all six navigation destinations work',async()=>{
  assert.match(await page.evaluate('document.body.innerText'),/Simulation mode — TideCloak is not connected/);
  for(const id of ['ideas','reports','votes','council','audit','overview'])await nav(id);
  assert.deepEqual(page.errors,[]);
  assert.equal(page.requests.some(url=>/^https?:/.test(url)),false);
  await page.screenshot(path.join(__dirname,'.artifacts/desktop.png'));
});

test('overview separates visible activity from votes assigned to the current persona',async()=>{
  assert.match(await page.evaluate('document.querySelector("[data-metric-page=votes]").innerText'),/Votes awaiting you\s+0/);
  assert.match(await page.evaluate('document.querySelector(".overview-actions").innerText'),/0 awaiting your vote/);
  await persona('frank');
  assert.match(await page.evaluate('document.querySelector("[data-metric-page=votes]").innerText'),/Votes awaiting you\s+3/);
  const approval=await page.evaluate('window.VoiceVaultRuntime.castVote("vote-report-101",{decision:"APPROVE",reason:"Reviewed the report context."})');
  assert.equal(approval.ok,true,JSON.stringify(approval));
  assert.equal(approval.data.canVote,false);
  await nav('overview');
  assert.match(await page.evaluate('document.querySelector("[data-metric-page=votes]").innerText'),/Votes awaiting you\s+2/);
  for(const route of ['ideas','reports','votes','council']){
    await nav('overview');
    await page.click('[data-metric-page="'+route+'"]');
    await page.waitFor('document.body.dataset.page === '+JSON.stringify(route));
  }
});

test('sidebar content remains reachable on short desktop and phone viewports',async()=>{
  for(const size of [{width:1440,height:540},{width:390,height:540}]){
    await page.command('Emulation.setDeviceMetricsOverride',{...size,deviceScaleFactor:1,mobile:size.width<600});
    if(size.width<600)await page.click('#menu-toggle');
    const layout=await page.evaluate(`(()=>{
      const sidebar=document.querySelector('.sidebar');sidebar.scrollTop=sidebar.scrollHeight;
      const bounds=sidebar.getBoundingClientRect(),note=document.querySelector('.sidebar-note p').getBoundingClientRect(),workspace=document.querySelector('.workspace').getBoundingClientRect();
      return {overflow:getComputedStyle(sidebar).overflowY,notesFit:note.top>=bounds.top&&note.bottom<=bounds.bottom,workspaceFits:workspace.bottom<=innerHeight};
    })()`);
    assert.ok(['auto','scroll'].includes(layout.overflow));
    assert.equal(layout.notesFit,true);
    assert.equal(layout.workspaceFits,true);
    if(size.width<600)await page.click('.nav-overlay');
  }
});

test('LIVE presentation hides demo controls and shows truthful connection status',async()=>{
  await page.evaluate(`(()=>{
    let authenticated=true;
    const result=data=>Promise.resolve({ok:true,data,contractVersion:'v1',requestId:'presentation-test'});
    const session=()=>({authenticated,subject:authenticated?'runtime-user':null,displayName:authenticated?'Authenticated user':'Signed out',capabilities:{canSubmit:authenticated}});
    const empty=()=>result({items:[],nextCursor:null});
    window.presentationRuntime={mode:'LIVE',contractVersion:'v1',init:()=>result(session()),getSession:()=>result(session()),
      login:()=>{authenticated=true;return result(session());},logout:()=>{authenticated=false;return result(session());},
      listIdeas:empty,listReports:empty,listCouncilChanges:empty,listAudit:empty,
      getCouncil:()=>result({version:1,members:[],selectionPolicy:{minVoters:3,maxVoters:5},capabilities:{canPropose:false}}),getDirectory:()=>result({people:[]}),
      simulation:{personas:[],scenarios:[]}};
    return window.VoiceVaultUI.mount(window.presentationRuntime);
  })()`);
  await page.waitFor('document.body.dataset.persona === "runtime-user"');
  assert.equal(await page.evaluate('document.getElementById("simulation-controls").hidden'),true);
  assert.equal(await page.evaluate('document.querySelectorAll("#persona-select,#scenario-select").length'),0);
  assert.equal(await page.evaluate('document.getElementById("persona-name").textContent'),'Authenticated user');
  assert.match(await page.evaluate('document.getElementById("mode-banner").innerText'),/LIVE — Runtime connected/);
  assert.equal(await page.evaluate('document.getElementById("mode-banner").dataset.connection'),'connected');
  assert.equal(await page.evaluate('document.body.innerText.includes("Connected to TideCloak Fabric")'),false);
  await page.click('[aria-label="Sign out"]');
  await page.waitFor('document.body.dataset.persona === ""');
  assert.match(await page.evaluate('document.getElementById("mode-banner").innerText'),/Sign in required/);
  assert.equal(await page.evaluate('document.getElementById("mode-banner").dataset.connection'),'signed-out');
});

test('idea form validates input and renders HTML-looking titles as literal text',async()=>{
  await nav('ideas');await page.click('[data-action="new-idea"]');
  assert.equal(await page.evaluate('document.querySelector("dialog form").checkValidity()'),false);
  await fill('title','<img src=x onerror="window.injected=true">');
  await fill('description','A complete description for testing the safe rendering of submitted content.');
  await page.evaluate('document.querySelector("dialog form").requestSubmit()');
  await page.waitFor('!document.querySelector("dialog[open]")');
  assert.match(await page.evaluate('document.getElementById("page-content").innerText'),/<img src=x/);
  assert.equal(await page.evaluate('window.injected === true'),false);
  assert.equal(await page.evaluate('document.querySelectorAll("#page-content img").length'),0);
});

test('report form submits multiple accused IDs without revealing reporter details',async()=>{
  await nav('reports');await page.click('[data-action="new-report"]');
  await fill('title','Review the quarterly purchasing process');
  await fill('evidenceDetails','A synthetic test scenario confirming that a report can be submitted successfully.');
  await page.evaluate('document.querySelector("dialog [name=accused-binh]").checked=true;document.querySelector("dialog [name=accused-eva]").checked=true;document.querySelector("dialog [name=consent]").checked=true;document.querySelector("dialog form").requestSubmit()');
  await page.waitFor('!document.querySelector("dialog[open]")');
  assert.match(await page.evaluate('document.getElementById("page-content").innerText'),/Review the quarterly purchasing process/);
  assert.equal(await page.evaluate('document.body.innerText.includes("an@example.test")'),false);
});

test('vote UI keeps N=4 locked after two approvals and removes identity on dialog close',async()=>{
  await persona('frank');await nav('votes');
  assert.match(await page.evaluate('document.querySelector("[data-round-id=vote-report-101]").innerText'),/3\/4/);
  for(const id of ['frank','grace','henry']){
    await persona(id);await nav('votes');await page.click('[data-round-id="vote-report-101"] [data-action="approve-vote"]');
    await fill('reason','The context and conditions of this voting round have been reviewed.');
    await page.evaluate('document.querySelector("dialog form").requestSubmit()');await page.waitFor('!document.querySelector("dialog[open]")');
    if(id==='grace')assert.match(await page.evaluate('document.querySelector("[data-round-id=vote-report-101]").innerText'),/2.*3/s);
  }
  await persona('frank');await nav('votes');await page.click('[data-round-id="vote-report-101"] [data-action="reveal"]');
  await page.waitFor('document.querySelector("dialog[open]") && document.querySelector("dialog[open]").innerText.includes("an@example.test")');
  await page.click('dialog [data-dialog-close]');
  assert.equal(await page.evaluate('document.body.innerText.includes("an@example.test")'),false);
  assert.equal(await page.evaluate('localStorage.length'),0);
});

test('council UI does not offer direct member edits and shows proposals before application',async()=>{
  await persona('frank');await nav('council');await page.click('[data-action="new-council-change"]');
  await page.evaluate('document.querySelector("dialog [name=member-mai]").checked=true');
  await fill('reason','Add another independent representative for future reviews.');
  await page.evaluate('document.querySelector("dialog form").requestSubmit()');await page.waitFor('!document.querySelector("dialog[open]")');
  assert.match(await page.evaluate('document.getElementById("page-content").innerText'),/Change proposals/);
  const council=await page.evaluate('window.VoiceVaultRuntime.getCouncil().then(r=>r.data)');
  assert.equal(council.version,1);assert.equal(council.members.length,5);
});

test('assigned juror can initiate the report unmask vote from its detail dialog',async()=>{
  const report = await page.evaluate(`window.VoiceVaultRuntime.submitReport({title:'A report requiring further verification',evidenceDetails:'Synthetic content for testing role-based identity review requests.',accusedPersonIds:['binh'],consent:true}).then(r=>r.data)`);
  await persona(report.voters[0].id);await nav('reports');
  await page.evaluate(`[...document.querySelectorAll('.report-card')].find(card=>card.textContent.includes('A report requiring further verification')).querySelector('button').click()`);
  await page.click('dialog [data-action="request-unmask"]');
  await fill('purpose', 'Further evidence needs to be verified within the scope of this report.');
  await page.evaluate('document.querySelector("dialog form").requestSubmit()');
  await page.waitFor('!document.querySelector("dialog[open]")');
  await nav('votes');
  const round = await page.evaluate('window.VoiceVaultRuntime.listReports({}).then(r=>r.data.items.find(i=>i.id==='+JSON.stringify(report.id)+').voting)');
  assert.deepEqual(round.voters, report.voters);
  assert.equal(round.voterCount, report.voterCount);
  assert.match(await page.evaluate('document.querySelector("[data-round-id='+round.id+']").innerText'),/Identity review vote/);
});

test('empty, unauthenticated and incompatible-runtime states are visible',async()=>{
  await page.evaluate('document.getElementById("scenario-select").value="EMPTY";document.getElementById("scenario-select").dispatchEvent(new Event("change",{bubbles:true}))');
  await nav('ideas');assert.match(await page.evaluate('document.getElementById("page-content").innerText'),/No ideas yet/);
  await page.evaluate('document.getElementById("scenario-select").value="UNAUTHENTICATED";document.getElementById("scenario-select").dispatchEvent(new Event("change",{bubbles:true}))');
  await page.waitFor('document.body.innerText.includes("Sign in")');
  await page.evaluate('window.VoiceVaultUI.mount({contractVersion:"v2",mode:"MOCK"})');
  await page.waitFor('document.body.innerText.includes("CONTRACT_MISMATCH")');
});

test('mobile navigation works without horizontal overflow',async()=>{
  await page.command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await page.click('#menu-toggle');
  assert.equal(await page.evaluate('document.body.classList.contains("nav-open")'),true);
  await nav('council');
  assert.equal(await page.evaluate('document.body.classList.contains("nav-open")'),false);
  assert.equal(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'),true);
  await page.screenshot(path.join(__dirname,'.artifacts/mobile.png'),390,844);
});

test('HTTP startup without a LIVE bundle fails closed rather than opening a mock',async()=>{
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const filename=path.resolve(publicRoot,'.'+pathname);
    if(!filename.startsWith(publicRoot+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile()){res.writeHead(404);res.end('Not found');return;}
    res.setHeader('Content-Type',filename.endsWith('.js')?'text/javascript':filename.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(filename));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    await page.navigate('http://127.0.0.1:'+server.address().port+'/ui/index.html');
    await page.waitFor("document.body.dataset.appState === 'error'");
    assert.match(await page.evaluate('document.body.innerText'),/POLICY_UNAVAILABLE/);
    assert.equal(await page.evaluate('window.VoiceVaultRuntime && window.VoiceVaultRuntime.mode === "MOCK"'),undefined);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

for (const cancellation of ['persona', 'navigation', 'logout']) {
  test('late reveal is discarded after '+cancellation, async()=>{
    await persona('chi');await nav('ideas');
    await page.evaluate(`window.VoiceVaultRuntime.revealIdentity = function(){window.revealPending=true;return new Promise(resolve=>{window.finishReveal=resolve;});};
      [...document.querySelectorAll('#page-content button')].find(b=>b.textContent==='View author').click();`);
    await page.waitFor('window.revealPending === true');
    if (cancellation === 'persona') await persona('dave');
    if (cancellation === 'navigation') await nav('audit');
    if (cancellation === 'logout') {
      await page.click('[aria-label="Sign out"]');
      await page.waitFor('document.body.dataset.persona === ""');
    }
    await page.evaluate(`window.finishReveal({ok:true,contractVersion:'v1',data:{displayName:'Late sensitive response',contact:'late@example.test',simulated:true}});`);
    // Await the reveal continuation and two frames; no wall-clock timing assertion.
    await page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    assert.equal(await page.evaluate('document.querySelector("dialog").open'), false);
    assert.equal(await page.evaluate('document.body.innerText.includes("late@example.test")'), false);
  });
}

const cardText=title=>`[...document.querySelectorAll('.idea-card')].find(card=>card.querySelector('h3').textContent===${JSON.stringify(title)})`;

test('ideas show originator and endorser, and a credited detail is not marked sealed',async()=>{
  await nav('ideas');
  const approved=await page.evaluate(cardText('Make meeting rooms work better')+'.innerText');
  assert.match(approved,/Originator: An Nguyen/);assert.match(approved,/Endorser: Binh Tran/);
  const endorsed=await page.evaluate(cardText('Automate shift quality checks')+'.innerText');
  assert.match(endorsed,/Identity sealed/);assert.match(endorsed,/Endorser: Binh Tran/);assert.doesNotMatch(endorsed,/Originator/);
  await page.evaluate(cardText('Make meeting rooms work better')+'.querySelector("button").click()');
  const detail=await page.evaluate('document.querySelector("dialog[open]").innerText');
  assert.match(detail,/Originator: An Nguyen/);assert.doesNotMatch(detail,/Identity sealed/);
});

test('denials, expiry, round status and audit time are visible',async()=>{
  await persona('frank');
  const denial=await page.evaluate('window.VoiceVaultRuntime.castVote("vote-report-102",{decision:"DENY",reason:"Insufficient grounds."})');
  assert.equal(denial.ok,true);
  await nav('votes');
  assert.equal(await page.evaluate('document.querySelectorAll("[data-round-id=vote-report-102] .voter.has-denied").length'),1);
  assert.match(await page.evaluate('document.querySelector("[data-round-id=vote-report-102]").innerText'),/Frank Vu.*denied/s);
  assert.match(await page.evaluate('document.querySelector("[data-round-id=vote-report-101] .vote-footnote").innerText'),/Expires \d\d\/\d\d,? \d\d:\d\d/);
  await nav('overview');
  assert.match(await page.evaluate('document.querySelector(".round-row[data-round-id=vote-report-102]").innerText'),/Denied/);
  const first=await page.evaluate('document.querySelector(".round-row").dataset.roundId');
  const round=await page.evaluate('window.VoiceVaultRuntime.getVotingRequest('+JSON.stringify(first)+').then(r=>r.data)');
  assert.equal(round.canVote,true,'rounds awaiting the session are listed first');
  assert.equal(await page.evaluate('document.querySelector(".search-box").hidden'),true);
  await nav('audit');
  assert.match(await page.evaluate('document.querySelector(".audit-row time").innerText'),/\d\d\/\d\d,? \d\d:\d\d/);
});

test('repeated clicks on an action submit it once',async()=>{
  await persona('binh');await nav('ideas');
  await page.evaluate(`window.endorseCalls=0;const original=window.VoiceVaultRuntime.endorseIdea;window.VoiceVaultRuntime.endorseIdea=function(){window.endorseCalls++;return original.apply(this,arguments);};
    const button=document.querySelector('[data-action="endorse"]');button.click();button.click();`);
  await page.waitFor("document.body.dataset.appState === 'ready' && window.endorseCalls === 1 && !document.querySelector('[data-action=\"endorse\"]')");
  assert.equal(await page.evaluate('window.endorseCalls'),1);
  assert.equal(await page.evaluate('document.querySelectorAll(".toast.is-error").length'),0);
});

test('signed-out persona selector shows no persona and can sign back in',async()=>{
  await page.click('[aria-label="Sign out"]');await page.waitFor('document.body.dataset.persona === ""');
  assert.equal(await page.evaluate('document.getElementById("persona-select").value'),'');
  assert.match(await page.evaluate('document.getElementById("persona-select").selectedOptions[0].textContent'),/Signed out/);
  await persona('an');
});

test('a submission that succeeds after its dialog closes still refreshes the list',async()=>{
  await nav('ideas');await page.click('[data-action="new-idea"]');
  await page.evaluate(`const original=window.VoiceVaultRuntime.submitIdea;window.VoiceVaultRuntime.submitIdea=function(){const args=arguments,self=this;return new Promise(resolve=>{window.finishSubmit=()=>resolve(original.apply(self,args));});};`);
  await fill('title','Idea finished after closing');
  await fill('description','A complete description long enough to pass the validation rules.');
  await page.evaluate('document.querySelector("dialog form").requestSubmit()');
  await page.waitFor('typeof window.finishSubmit === "function"');
  await page.click('dialog [data-dialog-close]');
  await page.evaluate('window.finishSubmit()');
  await page.waitFor('document.getElementById("page-content").innerText.includes("Idea finished after closing")');
});

test('report form requires someone involved, excludes the reporter and sends a retry id',async()=>{
  await nav('reports');await page.click('[data-action="new-report"]');
  assert.equal(await page.evaluate('document.querySelectorAll("dialog [name=accused-an]").length'),0);
  await fill('title','Review the quarterly purchasing process');
  await fill('evidenceDetails','A synthetic test scenario confirming that a report can be submitted successfully.');
  await page.evaluate('document.querySelector("dialog [name=consent]").checked=true;document.querySelector("dialog form").requestSubmit()');
  await page.waitFor('!document.querySelector("dialog .form-error").hidden');
  assert.equal(await page.evaluate('document.querySelector("dialog .form-error").textContent'),'Select at least one person involved.');
  await page.evaluate(`const original=window.VoiceVaultRuntime.submitReport;window.VoiceVaultRuntime.submitReport=function(input){window.reportInput=input;return original.apply(this,arguments);};
    document.querySelector("dialog [name=accused-binh]").checked=true;document.querySelector("dialog form").requestSubmit();`);
  await page.waitFor('!document.querySelector("dialog[open]")');
  assert.match(await page.evaluate('window.reportInput.clientRequestId'),/^[0-9a-f]{32}$/);
});

test('council proposal lists roster differences and rejects inverted voter limits',async()=>{
  await persona('frank');await nav('council');await page.click('[data-action="new-council-change"]');
  await fill('minVoters','4');await fill('maxVoters','3');
  await fill('reason','Add another independent representative for future reviews.');
  await page.evaluate('document.querySelector("dialog [name=member-mai]").checked=true;document.querySelector("dialog [name=independent-mai]").checked=true;document.querySelector("dialog form").requestSubmit()');
  await page.waitFor('!document.querySelector("dialog .form-error").hidden');
  assert.equal(await page.evaluate('document.querySelector("dialog .form-error").textContent'),'Maximum voters must be at least the minimum.');
  await fill('minVoters','3');await fill('maxVoters','5');
  await page.evaluate('document.querySelector("dialog form").requestSubmit()');await page.waitFor('!document.querySelector("dialog[open]")');
  assert.match(await page.evaluate('document.querySelector(".diff-list").innerText'),/Added\s+Mai Tran — Member, independent/);
});

test('blocked sibling files show a folder-permission hint instead of loading forever',async()=>{
  const os=require('node:os');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'voicevault-alone-'));
  try{
    fs.copyFileSync(entry,path.join(dir,'index.html'));
    await page.navigate(pathToFileURL(path.join(dir,'index.html')).href);
    await page.waitFor("document.body.dataset.appState === 'error'",8000);
    assert.match(await page.evaluate('document.body.innerText'),/Files and Folders/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('READY is visually distinct from APPLIED, and terminal rounds explain themselves',async()=>{
  const classes=await page.evaluate(`['READY','APPLIED','COLLECTING','APPLYING','STALE'].map(s=>window.VoiceVaultView.badge(s).className)`);
  assert.equal(new Set(classes.slice(0,4)).size,4,'READY, APPLIED, COLLECTING and APPLYING need distinct styles: '+classes);
  await persona('frank');
  await page.evaluate('window.VoiceVaultRuntime.castVote("vote-report-102",{decision:"DENY",reason:"Insufficient grounds."})');
  for(const id of ['frank','grace']){await persona(id);await page.evaluate('window.VoiceVaultRuntime.castVote("vote-report-103",{decision:"APPROVE",reason:"Context reviewed."})');}
  for(const id of ['henry','iris']){await persona(id);await page.evaluate('window.VoiceVaultRuntime.castVote("vote-report-103",{decision:"APPROVE",reason:"Context reviewed."})');}
  await nav('votes');
  assert.match(await page.evaluate('document.querySelector("[data-round-id=vote-report-103] [data-status-note=READY]").innerText'),/Only the designated recipient/);
  await persona('frank');await nav('votes');
  assert.match(await page.evaluate('document.querySelector("[data-round-id=vote-report-102] [data-status-note=DENIED]").innerText'),/A denial ends this round/);
  const panel=await page.evaluate('document.querySelector("[data-round-id=vote-report-101]").innerText');
  assert.match(panel,/Simulated selection: 4 voters/);assert.match(panel,/Identity recipient\s+Frank Vu/);assert.match(panel,/Purpose\s+Simulated seed request/);
});

test('rejected ideas state that identity is not published',async()=>{
  await persona('chi');
  const ideas=await page.evaluate('window.VoiceVaultRuntime.listIdeas({}).then(r=>r.data.items)');
  const target=ideas.find(i=>i.status==='UNDER_REVIEW');
  assert.equal((await page.evaluate(`window.VoiceVaultRuntime.decideIdea(${JSON.stringify(target.id)},{decision:'REJECT',reason:'Not feasible this year.',expectedVersion:${target.version}})`)).ok,true);
  await nav('ideas');
  assert.match(await page.evaluate(cardText(target.title)+'.innerText'),/Identity is not published after rejection/);
});

test('report detail shows its fixed assignment, or that it was saved while awaiting a jury',async()=>{
  const report=await page.evaluate(`window.VoiceVaultRuntime.submitReport({title:'Assignment visibility check',evidenceDetails:'Synthetic content for checking how the assignment is shown.',accusedPersonIds:['binh'],consent:true}).then(r=>r.data)`);
  await persona(report.voters[0].id);await nav('reports');
  await page.evaluate(`[...document.querySelectorAll('.report-card')].find(card=>card.textContent.includes('Assignment visibility check')).querySelector('button').click()`);
  assert.match(await page.evaluate('document.querySelector("dialog .assignment").innerText'),new RegExp('N = '+report.voterCount+' · T = '+report.quorumRequired));
  await persona('an');
  await page.evaluate('document.getElementById("scenario-select").value="INSUFFICIENT_ELIGIBLE_JURORS";document.getElementById("scenario-select").dispatchEvent(new Event("change",{bubbles:true}))');
  await page.waitFor("document.body.dataset.appState === 'ready'");
  await nav('reports');await page.click('[data-action="new-report"]');
  await fill('title','Report without an eligible jury');
  await fill('evidenceDetails','Synthetic content checking the saved-but-waiting message.');
  await page.evaluate('document.querySelector("dialog [name=accused-binh]").checked=true;document.querySelector("dialog [name=consent]").checked=true;document.querySelector("dialog form").requestSubmit()');
  await page.waitFor('!document.querySelector("dialog[open]")');
  assert.match(await page.evaluate('document.getElementById("toast-region").innerText'),/Report saved\. It is waiting/);
});

test('errors and audit events name their enforcement source, and the roster hash is shown',async()=>{
  await persona('binh');await nav('ideas');
  await page.evaluate('document.getElementById("scenario-select").value="POLICY_UNAVAILABLE";document.getElementById("scenario-select").dispatchEvent(new Event("change",{bubbles:true}))');
  await page.waitFor("document.body.dataset.appState === 'ready'");
  await page.click('[data-action="endorse"]');
  await page.waitFor('document.querySelector(".toast.is-error")');
  assert.match(await page.evaluate('document.querySelector(".toast.is-error").innerText'),/POLICY_UNAVAILABLE · SIMULATED/);
  await page.evaluate('document.getElementById("scenario-select").value="NORMAL";document.getElementById("scenario-select").dispatchEvent(new Event("change",{bubbles:true}))');
  await nav('audit');
  assert.match(await page.evaluate('document.querySelector(".info-strip").innerText'),/FABRIC = TideCloak policy/);
  assert.equal(await page.evaluate('document.querySelector(".audit-row .tag[title]").title'),'Preview only');
  await nav('council');
  assert.match(await page.evaluate('document.querySelector(".roster-hash").innerText'),/simulated-roster-v1/);
});

test('forms start unticked and focused, actions keep focus in the page, and non-member settings are inert',async()=>{
  await nav('ideas');await page.click('[data-action="new-idea"]');
  assert.equal(await page.evaluate('document.querySelector("dialog [name=publishCreditOnApproval]").checked'),false,'credit consent must be explicit');
  assert.equal(await page.evaluate('document.activeElement.name'),'title');
  await page.click('dialog [data-dialog-close]');
  await persona('binh');await nav('ideas');
  await page.evaluate('document.querySelector("[data-action=endorse]").focus();document.querySelector("[data-action=endorse]").click()');
  await page.waitFor("document.body.dataset.appState === 'ready' && document.querySelector('.toast')");
  assert.notEqual(await page.evaluate('document.activeElement.tagName'),'BODY');
  await persona('frank');await nav('council');await page.click('[data-action="new-council-change"]');
  assert.equal(await page.evaluate('document.querySelector("dialog [name=independent-mai]").disabled'),true);
  await page.evaluate('const box=document.querySelector("dialog [name=member-mai]");box.checked=true;box.dispatchEvent(new Event("change"))');
  assert.equal(await page.evaluate('document.querySelector("dialog [name=independent-mai]").disabled'),false);
});

test('the vote dialog names the record being decided',async()=>{
  await persona('frank');await nav('votes');
  await page.click('[data-round-id="vote-report-101"] [data-action="approve-vote"]');
  assert.match(await page.evaluate('document.querySelector("dialog .context-box strong").textContent'),/Identity review request · Review supplier selection/);
});
