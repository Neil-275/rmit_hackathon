# RMIT Hackathon 2026 — UNLOCKED

This document summarizes **Challenge 2: UNLOCKED**, presented by RMIT and Tide. It paraphrases the [official challenge page](https://tide.org/unlocked/), checked on **22 October 2026**.

> This document preserves the competition context; it does not introduce an implemented product. For submission, place a **Project overview of no more than 300 words** about the actual project at the top of the README, with setup instructions in a separate section. TideCloak descriptions below reflect the challenge brief; they do not claim that this repository implements or verifies those capabilities.

## Contents

- [1. Mission and challenge](#1-mission-and-challenge)
- [2. TideCloak and Emergent Authority](#2-tidecloak-and-emergent-authority)
- [3. From idea to demo](#3-from-idea-to-demo)
- [4. Submission requirements](#4-submission-requirements)
- [5. Deadlines](#5-deadlines)
- [6. Judging criteria](#6-judging-criteria)
- [7. All 12 suggested ideas](#7-all-12-suggested-ideas)
- [8. Frequently asked questions](#8-frequently-asked-questions)
- [9. Resources and support](#9-resources-and-support)
- [10. Submission preparation checklist](#10-submission-preparation-checklist)

## 1. Mission and challenge

Guiding question: **What would you build if trust were no longer the bottleneck?**

Many useful products currently require users to grant too much power to one party. For example, hospitals want to collaborate but must decide who controls shared records; AI could provide more assistance but needs access limits; communities want to manage shared resources without giving one person complete authority.

Teams should choose a capability constrained by that trade-off and build a **small, working prototype with TideCloak integrated**. The prototype must show that no individual administrator, organization or AI can unilaterally bypass the rules protecting users' data and decisions.

The focus is demonstrating **a valuable new capability**, while explaining why removing unilateral control makes it possible. A complete product or deep cybersecurity and cryptography expertise is unnecessary.

Source: [Mission](https://tide.org/unlocked/#challenge).

## 2. TideCloak and Emergent Authority

### TideCloak is the integration tool

According to the challenge brief, TideCloak provides user authentication, authorization and data protection. It uses Emergent Authority so applications can perform sensitive operations without granting an administrator, server or provider the ability to disable safeguards on their own.

### What is Emergent Authority?

In a conventional model, one entity ultimately holds the power to decrypt data, approve access or change rules. Securing a master key still requires trusting whoever holds it.

Emergent Authority changes how authority is formed: independent nodes in the Tide network coordinate to perform a protected operation when **identity, policy and required approvals** are all satisfied. No individual node, application server or administrator has the complete authority to perform that operation alone. Applications can use authority formed through coordination without retaining a reusable master key.

Teams define their product's access and approval rules, then use TideCloak to incorporate those protections into the application.

### What the entry must demonstrate

TideCloak must change what the product can reliably do. If replacing it with conventional login and backend access controls leaves the experience and guarantees identical, the challenge asks teams to develop the idea further.

Avoid making a login demo, security tool or generic permissions dashboard the main deliverable. Explain the new benefit users gain.

Sources: [TideCloak](https://tide.org/unlocked/#tool), [Emergent Authority](https://tide.org/unlocked/#superpower), [Judging](https://tide.org/unlocked/#judging).

## 3. From idea to demo

### Step 1 — Choose a useful capability

Find a situation currently constrained by trust, privacy or security. Use the 12 ideas below as inspiration, and discuss, test and clarify ideas with Hackbot on the website.

### Step 2 — Connect a coding agent

Add Tide's MCP server to the coding agent so it has tools and instructions for integrating TideCloak. The challenge page mentions Claude Code, Cursor, VS Code and other MCP-compatible agents.

Instructions: [Connect your coding agent](https://tide.org/agent-plugins).

### Step 3 — Build the prototype

Describe the application, access model and rules to the agent. Build a small flow with TideCloak integrated, use synthetic data and mock external systems. Prioritize a scenario that can be demonstrated convincingly.

**Alternative:** MCP is optional. If MCP causes problems or you prefer manual integration, use the [TideCloak Quickstart](https://docs.tide.org/get-started/Tidecloak%20Quickstart). It provides a sample website with TideCloak integrated as a starting point, usable with other editors/models or without AI.

### Step 4 — Demonstrate and submit

Show the new capability working and explain TideCloak's role. Prepare the repository, write the project overview, record a two-minute video and submit the link through the form.

Sources: [Start building](https://tide.org/unlocked/#start), [Build kit](https://tide.org/unlocked/#build-kit).

## 4. Submission requirements

Submit a **public GitHub repository link** through the [official Google Form](https://forms.gle/HRHYjnqB86j1LFS97). The two main components are prototype code and a demo video, both placed in the repository.

### 4.1. Repository and README overview

The repository must contain working prototype code integrated with TideCloak. The **Project overview** must appear at the top of the README, include a one-sentence product description and answer all five questions below in **no more than 300 words total**. Short paragraphs or bullets are acceptable; keep installation instructions separate.

| Section | Questions to answer |
|---|---|
| Vision & originality | What new product, service, experience or way of working do you propose? What makes the idea distinctive? |
| Trust constraint insight | What is currently difficult, risky or impossible because of trust, privacy or security barriers? What becomes possible when that barrier is removed? |
| Value & impact | Who benefits? How does their life or work improve? Give a concrete example. |
| Why TideCloak matters | How does the application use TideCloak? How does the integration enable the capability being demonstrated? |
| Prototype & storytelling | What does the prototype currently prove? Which key interaction should judges watch? |

The **drafting outline** below was prepared around the five questions; it is not copied from the website's Copy README template button:

```markdown
## Project overview

[One-sentence product description.]

### Vision & originality
[The idea and its distinguishing features.]

### Trust constraint insight
[The current barrier and the new capability made possible by removing it.]

### Value & impact
[Beneficiaries and a concrete example.]

### Why TideCloak matters
[The actual integration and TideCloak's essential role.]

### Prototype & storytelling
[Working flows and the interaction to watch in the demo.]
```

### 4.2. Demo video

- Duration: **two minutes**.
- Format: **`.mp4`**.
- Size: **under 100 MB**, as required on the page.
- Location: inside the submission's GitHub repository.
- Content: show the new capability actually working.

The organizers suggest this storytelling structure:

1. **Capability:** what has the team chosen to build?
2. **Barrier:** what trust problem stands in the way?
3. **Prototype:** demonstrate the working flow and TideCloak's role.
4. **Change:** what can users now do that was previously constrained?

Source: [What to submit](https://tide.org/unlocked/#submit).

## 5. Deadlines

The official page and FAQ list the following industry challenge submission deadlines:

| Location | Published deadline |
|---|---|
| Vietnam | **Thursday, 22 October 2026, 18:00 local time** |
| Malaysia | Thursday, 22 October 2026, 18:00 local time |
| Melbourne | Friday, 23 October 2026, 10:00 AEDT |

**Source note:** these deadlines are transcribed by location, rather than converted between time zones. They do not represent the same instant. For teams in Vietnam, this document retains **18:00 on 22 October 2026** as published; ask the organizers through their official support channel if the discrepancy needs resolving.

Sources: [Deadline](https://tide.org/unlocked/#submit), [FAQ](https://tide.org/unlocked/#help).

## 6. Judging criteria

| Criterion | Weight | What to demonstrate |
|---|---:|---|
| Vision & originality | **25%** | A fresh, ambitious approach that addresses the spirit of the challenge. |
| Trust constraint insight | **20%** | Identify what trust, privacy, custody or decision authority currently prevents. |
| Value & impact | **20%** | Meaningful value for individuals, organizations or society. |
| Why TideCloak matters | **20%** | TideCloak makes a substantive difference to what the product can reliably do. |
| Prototype & storytelling | **15%** | The idea is easy to understand and demonstrated through a working flow. |
| **Total** | **100%** | |

Judges read the README project overview alongside the demo video. The five README questions correspond to these five criteria.

Source: [How your app will be judged](https://tide.org/unlocked/#judging).

## 7. All 12 suggested ideas

These ideas are **optional inspiration**, not mandatory tracks. Teams can choose any domain or propose their own idea.

### 7.1. Care Passport — Patient-controlled medical records

- **Idea:** use synthetic records so patients share individual referrals, test results or care plans with specific clinicians.
- **Barrier:** receiving care in multiple places often requires sharing excessive medical history and trusting a service holding the entire record.
- **Tide's role:** end-to-end encryption tied to clinician sessions and roles limits who can decrypt each record; the operator does not automatically read everything.
- **Demo:** let a general practitioner view one record and a physiotherapist view another; revoke the therapist's future access and show the next decryption request being denied.

### 7.2. Research Consent Vault — Data governed by research consent

- **Idea:** participants contribute datasets, surveys or synthetic documents and consent to use by specific researchers.
- **Barrier:** after contributing sensitive data, participants struggle to know who can use it and whether consent remains valid.
- **Tide's role:** encrypt data and authenticate researcher roles, tying access to current consent; the platform does not need to read all plaintext data.
- **Demo:** approve a researcher, open the authorized data, withdraw consent and block the next access attempt.

### 7.3. Rental Application Passport — Reusable rental applications

- **Idea:** reuse income records, references and identification documents; share only what each rental application needs.
- **Barrier:** every application can create another complete copy of sensitive documents in a different email inbox or database.
- **Tide's role:** documents are encrypted and only valid recipients can open them; the platform does not need to decrypt every applicant's records.
- **Demo:** one property manager receives income evidence and another receives a reference letter; neither can open the other's package.

### 7.4. Blind Portfolio Review — Review before identity disclosure

- **Idea:** in recruitment or education, reviewers see the work and criteria first; authorized staff reveal identities only at the appropriate stage.
- **Barrier:** hiding names in the interface does not stop the backend or people with overly broad privileges from reading identifying data.
- **Tide's role:** decryption permissions for individual fields depend on role and review stage.
- **Demo:** conduct an anonymous review; attempt early identity access and show it being blocked, then advance the stage and allow an authorized role to view it.

### 7.5. Unreleased — Collaborating on unpublished work

- **Idea:** a preview space for musicians, filmmakers, designers or agencies; invite collaborators to specific projects and assets.
- **Barrier:** collaboration platforms can often access all valuable unpublished work.
- **Tide's role:** end-to-end encryption and role-based permissions coordinate collaboration without giving the service universal decryption access.
- **Demo:** let a reviewer hear one unreleased track; other tracks remain unreadable, including from an operator account.

### 7.6. Supplier Evidence Exchange — Sharing supplier evidence

- **Idea:** a B2B portal sharing certifications, audit evidence and manufacturing documents with selected customers or auditors.
- **Barrier:** proving compliance often places sensitive commercial documents in broadly accessible data rooms.
- **Tide's role:** cross-organization identity, scoped permissions and encrypted data let each party read only its assigned package; threshold governance protects sensitive permission changes.
- **Demo:** customers and auditors open different packages; attempt to expand access using only one administrator.

### 7.7. Matter Room — Case document workspace

- **Idea:** clients, lawyers, experts and counterparties have different access levels to case files, evidence or transaction documents.
- **Barrier:** overly powerful platform administrators can read confidential documents or change who has access.
- **Tide's role:** document encryption, tamper-resistant authorization and changes requiring co-approval separate system administration from access to everyone's data.
- **Demo:** request a sensitive case file; a single administrator cannot open it or silently modify the required roles.

### 7.8. Dual-Control Expense Desk — Multi-party expense approvals

- **Idea:** a workflow for high-value expenses, supporting documents and designated approvers; mock the payment system.
- **Barrier:** approval workflows become meaningless if an administrator can assign themselves the approver role.
- **Tide's role:** protect identities and approver roles, and require sufficient approvals for permission changes, preventing an administrator from granting themselves approval authority.
- **Demo:** submit a simulated expense and collect sufficient approvals; attempt to bypass the workflow by having an administrator change their own role.

### 7.9. Guild Treasury — Shared in-game treasury

- **Idea:** manage fictional credits, shared transactions or scarce items; members propose spending and guild officers approve high-value actions.
- **Barrier:** shared assets depend on a moderator or administrator with excessive power.
- **Tide's role:** tamper-resistant roles and threshold governance protect changes to treasury permissions.
- **Demo:** propose a purchase using simulated credits, obtain sufficient approvals, then show that one person cannot unilaterally elevate privileges.

### 7.10. Coalition Intel Exchange — Reports shared between fictional agencies

- **Idea:** an entirely fictional system using synthetic reports with release conditions such as AUS-only or AUS/NZ.
- **Barrier:** knowing a report exists does not mean being allowed to read it; shared login alone cannot govern interagency disclosure.
- **Tide's role:** encryption, roles and policies enforce release limits; sensitive permission changes require sufficient approvals.
- **Demo:** a partner analyst finds a report, but only the correct organization and role can open it. Use synthetic data throughout.

### 7.11. CreatorVault — Content encrypted by subscription entitlement

- **Idea:** a creator application with public posts, subscriber content and individually unlocked files; simulate subscriptions and purchases.
- **Barrier:** secret URLs or backend permission flags do not eliminate the platform's ability to read all premium content.
- **Tide's role:** encrypted content opens only for identities with the matching entitlement; operators do not need to read everything.
- **Demo:** simulate a purchase to unlock a premium file, remove the entitlement and deny future decryption requests.

### 7.12. Community Ballot — Community voting

- **Idea:** voting for student societies, communities or councils; check eligibility, accept one secret ballot per member, and require co-approval for sensitive rule changes or opening the tally.
- **Barrier:** voters must trust a server and several operators controlling the voter list, ballots, rules and result.
- **Tide's role:** bind ballot submission and tally access to identity, roles and policy; quorum protects permission changes. According to the idea description, authentication also avoids a centralized password-hash store.
- **Application responsibilities:** separate voter identity from encrypted ballots, check duplicate votes and build a verifiable audit trail; these do not appear automatically when TideCloak is added.
- **Demo:** conduct a simulated ballot, reject a second vote and attempts by one administrator to change eligibility or count votes early; publish results and the audit trail only after sufficient approvals, without revealing individual choices.

**Shared limitation stated for every idea:** use synthetic data. Revocation blocks future authorized access; it cannot recover content a recipient has already viewed or copied.

Source: [Ideas to get you started](https://tide.org/unlocked/#ideas), including the detail panels for all 12 ideas.

## 8. Frequently asked questions

| Question | Paraphrased answer from the brief |
|---|---|
| Is cybersecurity or cryptography experience required? | No. Bring an idea and willingness to build; a coding agent with MCP can help with integration. |
| Are AI coding tools allowed? | Yes; this is the encouraged workflow. The walkthrough shows Claude Code in VS Code, but other MCP-compatible agents can be used. |
| Is Tide MCP mandatory? | No. You can use the Quickstart and integrate manually. |
| Are synthetic data and mocks allowed? | Yes; they are recommended for healthcare, finance, government and sensitive situations. Mock payments, records or external systems to focus on demonstrating the experience. |
| How complete must the prototype be? | Small but working, integrated with TideCloak and demonstrating a compelling new capability; a finished product is unnecessary. |
| Must teams choose a suggested idea? | No. The ideas are references; original ideas in other domains are welcome. |
| What is submitted and where? | A public GitHub link through the Google Form; the repository contains code, a two-minute MP4 video and a README beginning with an overview answering the five questions. See the deadlines above. |
| What should be avoided? | Projects that are mainly login demos, security tools or generic permissions dashboards. Show a new user capability. |
| Where is help available? | A coding agent with Tide MCP for code/integration, Discord for setup errors, and Hackbot for ideas and competition rules. |

Source: [FAQ and Help](https://tide.org/unlocked/#help).

## 9. Resources and support

| Resource | Purpose |
|---|---|
| [UNLOCKED challenge brief](https://tide.org/unlocked/) | Primary source for Challenge 2; includes launch and walkthrough videos. |
| [TideCloak overview](https://tide.org/tidecloak) | Overview of the tool and what it provides to applications. |
| [Connect a coding agent / MCP](https://tide.org/agent-plugins) | Setup instructions for coding agents. |
| [TideCloak Quickstart](https://docs.tide.org/get-started/Tidecloak%20Quickstart) | Start from an integrated sample website without MCP. |
| [TideCloak documentation](https://docs.tide.org/) | Technical and integration reference. |
| [Emergent Authority beyond cybersecurity](https://tide.org/blog/emergent-authority-beyond-cybersecurity) | The brief's first suggested reading for understanding the approach and product opportunities. |
| [Emergent Authority in the AI era — RMIT presentation](https://tide.org/blog/cyber-immunity-emergent-authority-ai-era) | Additional context and inspiration. |
| [Tide Discord](https://discord.gg/XBMd9ny2q5) | Ask about setup errors in `#support`, including the error message and attempted solutions. |
| [Hackbot on UNLOCKED](https://tide.org/unlocked/#help) | Discuss ideas, rules, demos and READMEs using the page's Ask Hackbot button. |
| [Submission Google Form](https://forms.gle/HRHYjnqB86j1LFS97) | Submit the public repository link. |

The challenge page links to these resources; this document does not replace their integration documentation or include video transcripts.

## 10. Submission preparation checklist

This checklist collects the requirements above. Items remain unchecked because this document does not confirm the project's implementation status.

- [ ] Choose a new capability and identify the current trust barrier.
- [ ] Identify beneficiaries and a concrete example of impact.
- [ ] Build a small working prototype with TideCloak integrated.
- [ ] Show why no individual party can bypass the protective rules.
- [ ] Explain the substantive difference from conventional login and backend permissions.
- [ ] Use synthetic data and mock external systems in sensitive scenarios.
- [ ] Make the GitHub repository public and include the prototype code.
- [ ] Put Project overview at the top of the README, with one descriptive sentence and five answers, totaling no more than 300 words.
- [ ] Put setup instructions in a separate section.
- [ ] Include a two-minute `.mp4` demo video under 100 MB in the repository.
- [ ] Show the capability, barrier, working TideCloak flow and resulting change for users in the video.
- [ ] Submit the repository link through the Google Form before the deadline for the team's location.

---

Content source: [Tide — UNLOCKED, Challenge 2 of the RMIT hackathon](https://tide.org/unlocked/). This paraphrase preserves working context; check official organizer announcements when information changes or differs.
