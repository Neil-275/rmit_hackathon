> **Trạng thái dự án:** WIP. Tích hợp Tide LIVE chưa hoàn tất.

## Run the current UI

Open [public/ui/index.html](public/ui/index.html) directly in Chrome/Edge; Next.js and Docker are unnecessary.
This is a **MOCK using synthetic data**, with no TideCloak/LIVE backend connection. See the
[usage guide](public/ui/README.md).
The sections below describe product goals and architecture that require verification during LIVE integration.

## Project overview

**VoiceVault** is a proposed cryptographically enforced employee voice platform protecting bottom-up ideas and whistleblowing reports without requiring employees to trust their organization's hierarchy or administrators.

### Vision & originality
Idea boxes and whistleblowing hotlines both fail because whoever controls the channel controls the speaker's identity. VoiceVault unifies them: **Sealed-Credited Ideas** keep authors anonymous during review—if rejected, the identity is not published, reducing fear of ridicule, while unlocking credit upon approval with consent. **Protected Reports** pair conflict-free random jury selection with threshold identity decryption.

### Trust constraint insight
Employees withhold bold ideas fearing ridicule if judged infeasible, or credit theft by middle managers if successful. Whistleblowers stay silent because admins or executives can unmask them—especially when the accused sits on the review board. Removing unilateral control is the intended protection.

### Value & impact
Employees could innovate and report misconduct safely; companies could capture unvarnished ideas and early risk warnings. When engineer An submits an idea, manager Binh should be unable to alter credit. When An reports misconduct involving an ethics committee member, that member should be excluded before a random jury is assigned.

### Why TideCloak matters
The planned integration uses TideCloak's Emergent Authority for encrypted identities and policy-controlled decryption, requiring formal idea approval or a quorum of ceil(2N/3), including an independent approval, from a conflict-free jury. No admin or CEO should override this unilaterally. LIVE enforcement remains unimplemented and unverified.

### Prototype & storytelling
The offline MOCK simulates Engineer, Manager, Director, IT Admin, and Ethics Pool workflows. It demonstrates submission, credit consent, conflict exclusions, voting and council changes. Intended LIVE demonstrations include blocked authorship alteration, administrator self-assignment and identity access without a valid quorum; the current UI does not demonstrate TideCloak enforcement.
