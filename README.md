## Project overview

**VoiceVault** is an employee voice platform for anonymous ideas and whistleblowing reports, built on TideCloak so that no single administrator holds the keys to a speaker's identity.

### Problem
Idea boxes and ethics hotlines fail for the same reason: whoever runs the channel can see who is speaking. Employees hold back bold ideas (fear of ridicule, credit theft) and misconduct reports (fear of retaliation, especially when the accused sits on the review board).

### What VoiceVault does
- **Sealed ideas.** The author's identity is encrypted in the browser with TideCloak before submission. Reviewers see only the content. If the idea is approved and the author opted in, credit is published; otherwise it stays sealed.
- **Protected reports.** For each report the app excludes the accused from the ethics council, draws a random jury size N (3–5), then draws N members with at least one independent member. Revealing the reporter requires T = ⌈2N/3⌉ approvals, including the independent member. A single valid DENY closes the request.
- **Council changes go through the same vote.** There is no "edit roster" button; changes are proposals that need a quorum and go stale if the roster changes first.

### What is enforced where (honest scope)
| Guarantee | Enforced by |
| --- | --- |
| Login, roles, client-side encryption of identity | TideCloak (Tide Cybersecurity Fabric) |
| Server never receives plaintext identity | Browser runtime design; server stores ciphertext only |
| Conflict-of-interest exclusion, N/T draw, quorum counting, council-change voting | VoiceVault app (labelled **APP**) |
| Identity release gated by Tide policy | Under verification; where not yet verified the demo labels the step **SIMULATED** |

Every error and audit event in the UI shows its source (APP, FABRIC, SIMULATED), so the demo never overclaims.

## Run locally
```bash
npm install
npm run init        # provisions the TideCloak realm (Docker TideCloak on :8080)
npm run dev         # http://localhost:3000 -> /ui/index.html
npm run test:p0     # contract tests
```
Opening `public/ui/index.html` directly from disk runs the UI against mock data (labelled MOCK).
