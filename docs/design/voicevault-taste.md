# VoiceVault — taste skill application

`design-taste-frontend` was installed from `taste-skill-main/taste-skill-main/skills/taste-skill`
into the Codex skills directory; all 38 file checksums matched. The **app screens** workflow keeps HTML/CSS/JS local.

## Current direction: Swiss Cobalt

The user explicitly requested richer saturation after reviewing the earlier neutral design.
The resulting direction is **Swiss Cobalt**: a strong blue frame (`#001d6c`), cobalt actions (`#0f62fe`),
white work surfaces, dark readable text and a geometric mark. Keep Segoe UI for offline use.
The stronger frame gives the workspace a recognizable identity while preserving readable case records and voting controls.
The selected composition is **framed-sheet**, seed **22102027**, with palette and typography retained.
The user's explicit rejection of the washed-out achromatic version authorizes the strong blue frame as an exception
to the taste workflow's neutral/light sidebar guidance. Action hover is `#0043ce`, surface `#ffffff`, ink `#10203a`,
Success text uses deep teal `#00665e` on `#d9f5ee`; warning text uses `#684500` on `#fff1c7`.
These darker text variants preserve contrast while retaining the researched teal/amber roles.

Research references supplied for this direction:

- [IBM Carbon color tokens](https://www.carbondesignsystem.com/building-blocks/foundations/color/tokens).
- [Radix palette composition: understanding the scale](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale).
- [Letterform Archive: Bauhaus introduction](https://exhibitions.letterformarchive.org/bauhaus/exhibit/introduction).

These references inform color roles, scale and geometric composition. **Swiss Cobalt is our interpretation**
for VoiceVault, rather than an official Carbon/Radix theme or a reproduction of a Bauhaus exhibit.
The selected hex values and their application belong to this project's design decisions.

Current revision verification:

- Runtime/browser suite: 28 passed, 0 failed (15 runtime, 13 browser), including English copy, native validation and existing privacy/voting flows.
- Overview and Voting inspected at 1440, 768 and 390 px: each has 0 FAIL and 2 WARN. All six screenshots were visually inspected.
- Strong color share (25–27% on desktop) is intentional: the user requested a saturated frame. This is a documented deviation from the neutral-chrome default, not a contrast failure.
- The small-text warning concerns 11–12px metadata and supporting labels; primary content and voter names use 13–14px, with 44px phone controls.
- Source lint: 0 FAIL and 4 WARN for the existing dialog context label and actual floating dialog/toast shadows.
- Read-only review found no Important/Critical issues. Three minor English label corrections were applied.
- English source/document scan has no untranslated Vietnamese prose or comments. Demo names use ASCII transliterations; actual user input remains unrestricted.

Do not infer LIVE protection from these visual and MOCK checks.

## Earlier direction retained as history: Achromatic ledger

Direction: **Achromatic ledger**, seed **22102026**, kind `workspace`, light theme,
with system Segoe UI retained for offline opening. No redraw was performed. It was selected because the main work is
reviewing records and making decisions; neutral chrome made voting state easy to recognize.

Face: the N/T numbers and seal mark drawn from VoiceVault's own workflow. The signature was the voting-progress list
with vote totals, N/T and the independent condition on each record. All totals were computed from session data.
Blue was used only for progress backed by actual votes; zero was not drawn as an artificial progress segment.
The current direction also retains the rule that progress must reflect real data.

## Role and navigation polish

The four overview metrics now share neutral surfaces and explicit arrow links, hover and keyboard-focus states.
The personal metric is **Votes awaiting you** and uses current runtime capabilities, while visible activity is
reported separately. It is not styled as a selected tab. The sidebar has its own vertical scroll region and
non-shrinking sections so its message and workspace footer remain reachable on short windows.

LIVE session status uses the semantic success palette; MOCK retains its amber notice. The LIVE text deliberately
describes runtime/session connectivity without claiming Fabric verification. All simulation selectors are hidden in LIVE.

## Each screen's question

| Screen | Main question |
| --- | --- |
| Overview | Which cases are progressing, and how many voting rounds remain? |
| Ideas | Which ideas are awaiting endorsement or a decision? |
| Reports | Which cases can this session view, and can it request identity verification? |
| Voting | Which rounds can I vote in, and how many approvals and independent votes are still needed? |
| Council | Who currently serves, and which changes are still proposals? |
| Audit | Which operations were recorded, and what enforced them? |

## Earlier before-and-after evidence

The earlier inspector run used Chrome at 1440, 768 and 390 px. Its initial version had 7 FAIL:
undersized uppercase labels, a gradient, button shadows, low contrast, colored icon chips,
text below 11 px and a headline wrapping onto too many lines on phones.

The subsequent Achromatic ledger version replaced the dark sidebar with a light surface, removed the welcome banner
and decorative shield, combined KPIs into one strip, and placed cases and voting progress first. H1 was 24px,
body text 14px and metadata 11–12px; text had at least 4.5:1 contrast. Navigation collapsed on tablets/phones,
and mobile controls were 44px. Desktop/tablet/mobile screenshots were inspected and used for corrections,
rather than relying only on measurements.

No check failures received allowances. The warning about the ratio of small text was retained because those fields were
metadata, the simulated session and annotations; case titles, navigation and primary content used 14px.
Lint warnings for dialog/toast shadows were justified by actual overlays; dialog context labels served a purpose.
The earlier final inspector/lint results are recorded in the plan; images and JSON were generated in `.taste-skill/` (uncommitted).

The original inspector serves local files over HTTP, which correctly locks VoiceVault under its LIVE rules. The inspection
harness in `.superpowers/taste-inspect.mjs` therefore preserves `file://` and adds headless flags suited to this machine;
it does not change product bootstrap or the installed skill's code.

Sample data to replace during LIVE integration: ten synthetic personas (An Nguyen, Binh Tran, Chi Le, Dave Pham,
Eva Do, Frank Vu, Grace Hoang, Henry Ly, Iris Phan and Mai Tran), council v1 containing Eva/Frank/Grace/Henry/Iris,
three ideas, three reports with N=4/3/5, and `@example.test` email addresses. No customers, growth statistics,
reviews or cryptographic evidence are invented to decorate the UI.
