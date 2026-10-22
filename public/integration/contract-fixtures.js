/* Synthetic v1 baseline. Tung owns this integration file after handoff. No real identities or credentials. */
(function (global) {
  'use strict';
  global.VoiceVaultFixtures = {
    contractVersion: 'v1', organizationId: 'voicevault-demo',
    people: [
      { id:'an', displayName:'An Nguyen', initials:'AN', role:'engineer', title:'Software engineer', department:'Engineering', managerId:'binh' },
      { id:'binh', displayName:'Binh Tran', initials:'BT', role:'manager', title:'Engineering manager', department:'Engineering', managerId:'chi' },
      { id:'chi', displayName:'Chi Le', initials:'CL', role:'director', title:'Director', department:'Leadership' },
      { id:'dave', displayName:'Dave Pham', initials:'DP', role:'it_admin', title:'System administrator', department:'IT' },
      { id:'eva', displayName:'Eva Do', initials:'ED', role:'ethics_pool', title:'Council chair', department:'Finance' },
      { id:'frank', displayName:'Frank Vu', initials:'FV', role:'ethics_pool', title:'Legal counsel', department:'Legal' },
      { id:'grace', displayName:'Grace Hoang', initials:'GH', role:'ethics_pool', title:'Independent representative', department:'Board' },
      { id:'henry', displayName:'Henry Ly', initials:'HL', role:'ethics_pool', title:'Employee representative', department:'Operations' },
      { id:'iris', displayName:'Iris Phan', initials:'IP', role:'ethics_pool', title:'Compliance specialist', department:'Compliance' },
      { id:'mai', displayName:'Mai Tran', initials:'MT', role:'employee', title:'Research specialist', department:'Research' }
    ],
    council: { version:1, rosterHash:'simulated-roster-v1', selectionPolicy:{minVoters:3,maxVoters:5}, members:[
      {subject:'eva', independent:false, active:true, membershipRole:'CHAIR'},
      {subject:'frank', independent:false, active:true, membershipRole:'MEMBER'},
      {subject:'grace', independent:true, active:true, membershipRole:'MEMBER'},
      {subject:'henry', independent:false, active:true, membershipRole:'MEMBER'},
      {subject:'iris', independent:false, active:true, membershipRole:'MEMBER'}
    ]},
    ideas: [
      {id:'idea-101', title:'A shared knowledge library', description:'Create an internal knowledge library so expertise stays with the team when people move between projects. Review each contribution and credit its author.', category:'CULTURE',status:'UNDER_REVIEW',authorSubject:'an',publishCreditOnApproval:true,ageHours:2},
      {id:'idea-102', title:'Automate shift quality checks', description:'Combine equipment readings and checklists into one short review so teams can identify problems before production starts.',category:'PROCESS',status:'ENDORSED',authorSubject:'mai',publishCreditOnApproval:true,ageHours:7,endorsedBy:'Binh Tran'},
      {id:'idea-103', title:'Make meeting rooms work better',description:'Ask organizers to confirm bookings before meetings and release unused rooms. Pilot the process on one floor before expanding.',category:'SUSTAINABILITY',status:'APPROVED',authorSubject:'an',publishCreditOnApproval:true,ageHours:27,endorsedBy:'Binh Tran'}
    ],
    reports: [
      {id:'report-101',title:'Review supplier selection',evidenceDetails:'Synthetic scenario: some purchasing records are missing an independent review. Examine the selection process and the related approvals.',accusedPersonIds:['binh','eva'],reporterSubject:'an',recipientSubject:'frank',voterIds:['frank','grace','henry','iris'],ageHours:3},
      {id:'report-102',title:'Review overtime allocation',evidenceDetails:'Synthetic scenario: overtime summaries differ between teams. Verify the underlying records before drawing conclusions.',accusedPersonIds:['binh'],reporterSubject:'an',recipientSubject:'frank',voterIds:['frank','grace','henry'],ageHours:12},
      {id:'report-103',title:'Review project access rights',evidenceDetails:'Synthetic scenario: access permissions remain active after a project has ended. Review and revoke permissions that are no longer needed.',accusedPersonIds:['dave'],reporterSubject:'an',recipientSubject:'frank',voterIds:['eva','frank','grace','henry','iris'],ageHours:23}
    ],
    scenarios: [
      {id:'NORMAL',label:'Normal workflow'}, {id:'EMPTY',label:'Empty lists'},
      {id:'UNAUTHENTICATED',label:'Session expired'}, {id:'FORBIDDEN',label:'Access denied'},
      {id:'POLICY_UNAVAILABLE',label:'Policy unavailable'}, {id:'EXPIRED',label:'Voting round expired'},
      {id:'INTEGRITY_MISMATCH',label:'Integrity mismatch'}, {id:'VERSION_CONFLICT',label:'Version conflict'},
      {id:'INSUFFICIENT_ELIGIBLE_JURORS',label:'Insufficient eligible jurors'}
    ]
  };
}(window));
