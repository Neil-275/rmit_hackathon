# Idea: Protected employee voice (VoiceVault)

> Proposed idea notes for Challenge 2: UNLOCKED. The TideCloak capabilities described here are based on the challenge brief and **must be checked against TideCloak documentation** before making claims in the submission.

## 1. Problem

The idea expands a "whistleblowing channel" into all **bottom-up employee voice** within a company, addressing two types of failure:

| | Reporting misconduct | Contributing ideas |
|---|---|---|
| Risk to the speaker | **Identity exposed** → retaliation | **Name removed** → lost credit |
| Who causes it | Those able to look up identities (HR, IT, leadership) | Intermediaries forwarding the idea (direct managers) |
| Consequence | Nobody dares to report | Nobody wants to contribute |

**Shared root cause:** whoever controls the communication channel also controls the speaker's identity and credit. In a conventional system, the "author" field is merely a database column: a manager, HR or IT administrator can read or change it, or simply decline to forward the submission.

**Example:** A proposes an idea and submits it to B (A's manager). When B presents it to higher management, B gives A no credit.

## 2. Evidence

- **Idea credit theft:** an OfficeTeam survey (2009) found that 29% of employees had experienced idea theft; 51% of them took no action. Another survey found that nearly one in five employees believed their boss took their credit. BambooHR ranked "boss taking credit" as the most disliked behavior.
- **Ideas withheld:** Morrison & Detert found that employees withhold improvement ideas as well as bad news. Leading reasons include fear of negative judgment and damaged relationships. Speaking up depends heavily on feeling that contributions **make an impact and receive recognition**.
- **Fear of retaliation when reporting:** 34% did not report because they feared retaliation by leadership, and 30% feared their direct supervisor (Ethics & Compliance Initiative, 2013).
- **Identity exposure happens:** in the Halliburton case (US Court of Appeals for the Fifth Circuit, 2014), the company traced the whistleblower, an internal email disclosed the identity, and colleagues ostracized the employee. The court held that disclosing the identity itself constituted retaliation.

> Note: many figures come from older surveys or solution vendors; use them illustratively and check the original sources before citing them.

## 3. Solution

Each submission has **three identity modes**, selected by its author:

1. **Credited:** the author's name is bound to the idea from creation. A manager can *endorse / escalate* it but **cannot remove or change the author**. Higher management always sees "Originator: A · Endorser: B".
2. **Sealed:** ideas are reviewed blindly on merit, without names, to reduce bias. Authors **reveal their identity to receive credit** when an idea is approved. A timestamp proves priority if someone later submits a version "of their own".
3. **Protected report:** the ethics council can read the content, but the reporter's identity is decrypted only after **the approval threshold is reached** (for example, two-thirds of members, including at least one independent member). The CEO, HR and IT administrators **cannot reveal it alone**. Council membership changes also require threshold approval.

## 4. Why TideCloak is necessary

| Conventional login + backend | TideCloak (Emergent Authority) |
|---|---|
| DBA/IT can run `UPDATE ideas SET author=...` | The author record is protected by identity + policy; no single party holds modification authority |
| The server holds the key → it can read whistleblower identities | Identities are encrypted; decryption authority emerges from policy + sufficient approvals, rather than residing on the server |
| Administrators assign themselves the "ethics council" role | Sensitive role changes require threshold approval |
| Employees must **trust** the company | Employees receive **mechanical guarantees**, even when leadership is accused |

In a conventional company, employees must trust the very organization to which they report or contribute. This product aims to remove that requirement.

## 5. Limitations

- **It cannot stop managers from rephrasing an idea verbally outside the system.** The product supplies *evidence of priority* and an *official channel that preserves credit*; its value depends on company rules requiring proposals to use that channel.
- **Report content may identify its author** (writing style, details known to only one person). TideCloak protects keys, not inferences from content.
- Timestamps, audit trails and escalation workflows are **application responsibilities**, not automatic consequences of adding TideCloak.
- Revocation blocks future access; it cannot recover content someone has already viewed.

## 6. Two-minute demo scenario

Characters: **An** (engineer), **Binh** (team lead), **Chi** (director), a three-person ethics council, and an **IT administrator**. All data is simulated.

| Time | Content |
|---|---|
| 0:00–0:20 | **Barrier:** 29% experienced idea credit theft; the Halliburton case exposed a whistleblower's identity. |
| 0:20–0:55 | **Idea:** An submits an idea (Credited) → Binh escalates it to Chi → Chi sees "Originator: An". Binh attempts to change the author → **denied**. |
| 0:55–1:15 | **Administrator overreach:** the IT administrator assigns themselves to the ethics council → **blocked, insufficient approvals**. |
| 1:15–1:45 | **Report:** An reports misconduct by Binh. The council can read the content. The CEO attempts to view the identity → **denied**. Two of three council members approve disclosure for legal proceedings → the identity is revealed. |
| 1:45–2:00 | **Change:** employees dare to speak up because the mechanism protects them, without needing to trust any individual. |

## 7. MVP scope

- **Required:** Credited mode (immutable authorship) + Protected report mode (threshold identity decryption).
- **Later:** Sealed / blind review — mention it in the README as an extension.
- Users, organizations and data are all simulated.

## 8. Judging criteria mapping

| Criterion | Strength of the idea |
|---|---|
| Vision & originality (25%) | Combines whistleblowing and idea credit into a single "bottom-up voice" problem; outside the 12 suggested ideas. |
| Trust constraint insight (20%) | Speakers must trust the organization/manager controlling the communication channel. |
| Value & impact (20%) | Employees receive recognition and safety; companies receive more ideas and earlier warnings. |
| Why TideCloak matters (20%) | No administrator/manager/CEO can unilaterally change authors, view identities or grant themselves privileges. |
| Prototype & storytelling (15%) | The An–Binh–Chi story is easy to follow, with clear "blocked" moments. |

## Sources

- [29% of employees say they've had ideas stolen at work](https://www.reliableplant.com/Articles/Print/20473)
- [Survey Shows Ideas Aren't Safe In The Office](https://wbjournal.com/article/survey-shows-ideas-arent-safe-in-the-office/)
- [HR Dive – Top bad boss behavior: taking credit](https://www.hrdive.com/news/the-top-bad-boss-behavior-taking-credit-for-employees-work/447400/)
- [JDP Infographic – Bosses](https://www.jdp.com/downloads/JDP-Infographic-Bosses.pdf)
- [Morrison 2014 – Employee voice and silence](https://explore.psychsafety.com/n/morrison-2014/)
- [Why People Don't Always Speak Up At Work](https://adigaskell.org/?p=26304)
- [UNC – Employees Have a Voice](https://execdev.unc.edu/have-a-voice)
- [UVM – Reporting, Non-Retaliation](https://www.uvm.edu/~complian/Newsletter/Winter2016/Helpline.html)
- [Halliburton: revealing whistleblower's identity is adverse action](https://whistleblowersblog.org/2014/11/articles/sox-whistleblowers/halliburton-revealing-whistleblowers-identity-to-colleagues-is-adverse-action)
- [Disclosing the Identity of a Complainant Can Constitute Retaliation (AFS Law)](https://www.afslaw.com/perspectives/alerts/disclosing-the-identity-complainant-can-constitute-retaliation-under-the)

## 1. Problem (updated)

| | Reporting misconduct | Contributing ideas |
|---|---|---|
| **Risk to the speaker** | **Identity exposed** → retaliation (especially when the accused sits on the oversight board) | **1. Fear of ridicule** if an idea is considered infeasible<br>**2. Name removed** → lost credit if the idea is good |
| **Who causes it** | Those able to look up identities (HR, IT, leadership, accused council members) | Direct managers or reviewers (personal bias or appropriation of credit) |
| **Consequence** | Nobody dares to report misconduct by superiors | Employees stay silent and avoid proposing breakthrough ideas |

## 3. Solution (updated mechanism)

1. **Sealed-Credited Idea (dual protection):**
   - **Submission & review:** the author's identity is encrypted (sealed). Superiors review blindly, entirely on the idea's merit, without identity bias.
   - **If rejected:** the identity **is not published** (no reveal request exists for rejected ideas) → employees need not fear ridicule or being judged poorly for ideas that are not yet feasible.
   - **If approved:** TideCloak policy conditions are satisfied → the system unlocks the original author's signature and clearly records: *"Originator: A · Endorser: B"*. B cannot change or remove A's name.
2. **Protected Report with a conflict-free random jury (CoI-Free Random Jury):**
   - When misconduct is reported, if an accused person belongs to the Ethics Pool, the system **automatically excludes** that person.
   - The system **randomly selects** a group (for example, three members) from the remaining uninvolved Pool members to form the case jury.
   - TideCloak decrypts the reporter's identity only when **the approval threshold (two-thirds)** is reached by that specific randomly assigned jury. The CEO, IT administrator and accused person are all blocked.
