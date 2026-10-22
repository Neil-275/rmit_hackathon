# VoiceVault — open the UI directly

Open `index.html` in Chrome or Edge (double-click it, or drag the file into the browser).
Next.js, npm, Docker and a server are unnecessary. The address must start with `file://`.

This is a **MOCK**, using synthetic data stored only in the tab's memory. Reloading
restores the sample data. This version performs no encryption, real authentication or TideCloak operations.

## Things to try

- Six pages: Overview, Ideas, Reports, Voting, Council, Audit.
- An submits an idea; Binh endorses it; Chi approves or rejects it. Author credit is published only with consent.
- An submits a report and selects multiple accused people. The jury is drawn from the current roster after conflict exclusions.
- An assigned member opens the report and chooses **Request identity access**, entering a purpose to create a voting round.
  N and the assigned voters remain unchanged. T = ceil(2N/3), and an independent approval is required.
- Frank, Grace and Henry can try sample `report-101`: N=4, T=3. After three APPROVE votes,
  Frank, the recipient, can view the synthetic identity. Two votes are insufficient, even when Grace has approved.
- Frank proposes a council change. Selected members vote; the proposer can apply it only after sufficient approvals.
  READY does not change the roster; APPLIED increases its version and marks older rounds STALE.
- Select a simulation scenario to try empty lists, missing permissions, expiry, policy errors or insufficient jurors.

Persona and scenario controls appear only in MOCK. They are UI testing tools, not authentication.
Closing the identity view, navigating, switching personas or signing out clears the identity-view session; late reveal responses are discarded.

## Tests

Run from the project root in PowerShell:

```powershell
& ./public/ui/tests/run.ps1 -Suite all
```

You can select `runtime` or `browser`. The script uses Node from PATH, or the Node
runtime embedded in VS Code at its default installation path. The browser suite needs Chrome/Edge;
set `VOICEVAULT_CHROME` if the browser is installed elsewhere. No dependency installation is required.
Everyday UI use needs only a browser, without the test runtime.

## Connect Tung's system

HTTP(S) accepts only LIVE v1. If `public/integration/runtime.generated.js` or a
compatible factory is missing, an error appears and functionality stays locked. Running `python -m http.server`
does not switch automatically to the demo.

See the [integration and merge guide](../../docs/integration/static-ui-handoff.md)
and [design notes](../../docs/design/voicevault-taste.md).

## Overview and connection status

The overview distinguishes visible voting activity from **Votes awaiting you**. The personal count
uses each round's `canVote` capability and excludes rounds where you have already voted; it never
infers voting rights from being the reporter. All four metric cards link to their corresponding pages.

Persona/Scenario selectors are MOCK-only. LIVE uses the authenticated SessionView and shows a green
**LIVE — Runtime connected** banner after session confirmation. Signed-out sessions show **Sign in required**.
The banner does not claim that a TideCloak Fabric connection or security gate has been verified.
