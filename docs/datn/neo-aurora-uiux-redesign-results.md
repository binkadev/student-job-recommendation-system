# Neo-Aurora UI/UX redesign — 2026-11-05

## Baseline and scope

- Repository `binkadev/student-job-recommendation-system`, existing task branch
  `design/datn-ui-ux-refresh-20261102`, starting HEAD
  `9517febbe9517a2bb435675ee6b1b1207ded053a`.
- Remote master/base verified as `e019f7a45d4799c2f2c7d0dcfe5ca1e68784d686`.
  Continued the existing PR #66; no branch reset, merge, or force push.
- Pre-existing local `frontend/tsconfig.app.tsbuildinfo`, `.agents/`, and
  `skills-lock.json` are excluded from this work package's commit.
- Production changes are presentation and accessibility in Public/Auth, Student,
  and Company. Backend production code, database migrations, AI code, scoring,
  ownership, moderation, CAS revisions, and persistence contracts are unchanged.
  The new Backend class is a disposable browser-test launcher, not a runtime API.
- Read AGENTS, repository guardrails, current V3/API contracts and previous
  UI/performance/manual-demo evidence. Existing mock services are not substituted
  for any real API. No Admin feature or page is redesigned. Theme overrides are
  scoped to `.neo-app` / `.neo-mobile`; shared external font loading was removed.

## 1. Design vision

Deep navy navigation and aurora panels frame readable light work surfaces.
Violet identifies primary actions; cyan accents conceptual matching and charts.
Forms, confirmations and dense tables remain practical. The core visual metaphor
is CV → content/skills → relevant opportunities, explicitly labeled as an
illustration. It contains no simulated result, score, probability or live activity.

## 2. Research and transferable principles

Reviewed [Linear](https://linear.app/) for navigation and hierarchy,
[Vercel](https://vercel.com/) for dark framing,
[Stripe](https://stripe.com/) for content structure,
[Spline](https://spline.design/) for dimensional geometry and
[Rive](https://rive.app/) for purposeful interaction. Applied keyboard, focus,
zoom, feedback and motion principles from the
[Vercel interface guidelines](https://vercel.com/design/guidelines).
The requested [Awwwards](https://www.awwwards.com/) fetch timed out; no claim of
having inspected its visual content. No proprietary assets or layouts copied.
Used the local `ui-ux-pro-max` checklist/search and `sites` local-preview workflow.
No Sites deployment or external Figma document was created: delivery targets the
existing repository, local services and Draft PR.

## 3. Final tokens

`frontend/src/neo-aurora.css` owns the palette, elevations, focus and motion.
Tailwind brand utilities resolve scoped RGB variables with alpha support and
retain original blue fallbacks outside the new theme.

| Purpose | Value |
|---|---|
| Midnight / navy / elevated | `#0B1020` / `#111B30` / `#17213A` |
| Electric violet / cyan / blue | `#6D5EF9` / `#14D8FF` / `#3478F6` |
| Primary action / hover | `#5946D9` / `#4934B8` |
| Emerald / amber / coral | `#18D9A0` / `#FFBE55` / `#FF647A` |
| Pink | `#FF5BA8` |
| Canvas / card / border | `#F5F8FF` / `#FFFFFF` / `#E3E8F4` |
| Body / muted on light | `#17213A` / `#52617B` |
| Body / muted on dark | `#F5F8FF` / `#B9C6E0` |
| Chart pending / reviewed / accepted | amber / `#6C9EFF` / emerald |
| Chart rejected / withdrawn | coral / `#A0AEC6` |

The action violet is darker than the decorative violet to support white labels.
Vietnamese uses the system `Segoe UI` / system-ui stack, without a blocking Google
Fonts import. Headings use restrained tracking; data uses tabular numerals.
Cards use a 20px radius, important panels 24px; shadows and borders remain light.

## 4. Shared component changes

- Cards, primary/secondary button surfaces and 44px action targets.
- Page headers, navigation active states, public header and dark sidebar.
- Scoped focus outlines, placeholder contrast and 16px mobile form text.
- Table headers, row feedback, wrap behavior and retained named scroll regions.
- Mobile portal receives its own theme scope; Admin keeps its original defaults.
- Existing dialogs, error handling, toast announcements, validation, loading and
  disabled states remain connected to the established components.
- Removed the dashboard chrome's extra H1 for Student/Company; route content owns
  the page heading. Admin header markup keeps its default behavior.

## 5. Public and authentication

New Vietnamese hero, real Student/Company entry links, CV/skill/job illustration,
functional search/upload actions and real API statistics/listings. Career cards
now link to existing readable articles instead of “updated later” placeholders.
Removed the unsupported footer support email claim.
Login and registration share the dark visual identity; credential submission,
password visibility, validation, focused Vietnamese errors and role redirects
retain their real implementation. No password reset capability invented.

## 6. Student

- Personalized dashboard retains actual profile completeness, active CV,
  application summaries, saved-job counts and notifications; new aurora entry to
  recommendations. Generic job discovery is no longer described as CV matching.
- Removed the misleading dashboard appointment empty state for an unsupported
  capability. Existing unsupported routes still explain their limitations.
- Profile/preferences keep aggregate/CAS behavior; replaced nested `main` in the
  preferences form with a normal content group.
- CV extracted/processed text panels are labeled, focusable scroll regions.
- Recommendation V3 receives a dedicated hero and accessible score meters.
  Existing selectors, generation recovery, history, evidence, save/apply behavior
  and Backend-owned rank ordering are retained.
- Jobs, saved jobs, applications, notifications and settings receive the shared
  typography, navigation, controls and surfaces; their business flows are not
  rewritten or replaced by decorative controls.

## 7. Company

Dashboard/reports receive recruitment heroes, accent KPIs, status distributions,
trend and performance presentation. Job/candidate workspaces retain server
filtering, moderation transitions, pagination, notes and CV authorization.
Candidate Ranking gets a dedicated hero and exact-score meters, with independent
tiers preserved. Company identity gets an aurora header and a grid that contains
the wide owned-job table at narrow widths. Existing company fields and captured
If-Match remain editable through their current API.

## 8. Charts and actual date semantics

- Job/application distribution uses proportional segmented bars plus a complete
  textual legend with real counts, including true zeros. No decorative counts.
- PENDING amber, REVIEWED blue, ACCEPTED emerald, REJECTED coral, WITHDRAWN slate.
  Color supplements text. The legend remains readable without interpreting color.
- Recharts trend uses gradient rounded bars, integer ticks, responsive tick gaps,
  exact-value tooltips and an always-available keyboard-accessible data table.
  Animation is disabled so real values appear immediately.
- Job performance bars scale to the largest returned actual count. Full titles,
  counts, accepted counts/rates and links remain accessible; this is the Backend's
  top-10 leaderboard, not a complete inventory.
- Null rates stay unavailable; zero histories are never shown as a made-up rate.

Read-only SQL audit at `2026-11-04T18:32Z` found PostgreSQL `Etc/UTC`, Backend
container clock UTC, `applied_at` as `timestamp without time zone`, 11 owned Jobs,
13 histories / 3 distinct applicants. All 13 stored calendar dates were
`2026-11-05`; the current UTC date was still `2026-11-04`, producing 0 in the
dashboard's inclusive 30-day UTC calendar window. This reproduces the apparent
discrepancy without changing dates. The UI now explicitly presents “lượt trong kỳ
biểu đồ” separately from “toàn bộ lịch sử” and explains the stored-date convention.

Source: `JobApplication.appliedAt` is a `LocalDateTime` with `@CreationTimestamp`;
analytics uses UTC today, compares naive date boundaries, and groups the stored
calendar string. Original offsets cannot be recovered from this column. No
backdating, timezone guess, producer change or destructive migration performed.
Historical timestamp standardization remains a separate reviewed migration.
Existing PostgreSQL analytics integration tests and real isolated browser SQL
comparisons validate current boundaries; no changed Backend date contract is
claimed. The front-end calendar formatter never converts a naive value to a zone.

## 9. Motion and dimensional presentation

CSS transforms, layered cards, perspective, orbital outlines, restrained route
entrance and a pointer-only matching-core hover. Reduced motion disables route
entrance and hover movement; existing global reduced-motion rules remain.
No WebGL, new animation library, runtime timer, synthetic progress or heavy 3D
engine added. All decorative geometry has an immediate static fallback.

## 10. Vietnamese copy

Examples: “Phân bố hồ sơ ứng tuyển theo trạng thái xử lý”, “lượt trong kỳ biểu đồ”,
“Điểm nội dung”, “Điểm kỹ năng”, and actionable empty-period/filter guidance.
PRIMARY remains content-and-skill matching; FALLBACK remains skill-only coverage.
Both heroes explain that scores are not employment probabilities or decisions.
Official numbers, ranks, nullable scores and historical evidence are not altered.

## 11. Unsupported features

Removed Company logo/banner upload and document-submission buttons with no
persistence. The page describes the unavailable capability without a fake submit
or success toast. Existing editable business fields remain usable.
Clipboard success is now shown only after a successful awaited write; failure
produces one accurate error. Unsupported interviews, messages, email recovery,
2FA/privacy capabilities and absent Company notification producers remain
explicit limitations. No new capability or producer is claimed.

## 12. Responsive and accessibility verification

Baseline: 28 routes × 2 widths = 56 private screenshots, 0 page/console errors.
Detected existing Company-profile overflow, nested profile landmarks and CV
scroll focus failures. Intermediate audits also exposed registration contrast
errors; these were fixed rather than excluded from the audit.

Final production-browser audit: **28 routes × 5 widths = 140 screenshots;
0 overflowing pages, 0 axe violations, 0 console errors, 0 page errors**.
Keyboard checks include mobile Escape/focus return, dialog
focus cycling, chart-table scrolling and reduced motion. This is a scoped audit,
not whole-product WCAG 2.2 certification. No WAN, screen-reader user study or
hardware-device performance claim is made. Native browser zoom was not separately
automated. Calculated solid-color token contrast: action 6.36:1, action hover
8.51:1, body 15.97:1, muted-on-canvas 5.89:1, dark body 16.15:1, dark muted 9.99:1.

## 13. Bundle and performance

Original production entry gzip: **113,810 bytes**. Final build's entry remains
**113,978 bytes** (+168 bytes, +0.15%), retaining route-level splitting and lazy Recharts.
No package dependency or lockfile added/updated. The earlier 364KB→114KB gain is
not reversed. Exact assets, six-route cold/warm medians, requests, CLS and long
tasks are recorded in the sanitized metrics accompanying this report.

| Production artifact | Before | After |
|---|---:|---:|
| Entry JavaScript raw | 365,584 B | 365,923 B |
| Entry JavaScript gzip | 113,810 B | 113,978 B |
| Total JS raw | 1,412,564 B | 1,341,703 B |
| Sum of JS chunk gzip | 461,064 B | 432,621 B |
| Lazy Recharts gzip | 106,502 B | 106,503 B |
| CSS raw / gzip | 49,230 / 8,563 B | 62,716 / 11,702 B |

Seventy-two measurements: 3 cleared-cache/new-context cold and retained-context warm
pairs for each route/build. Real UI login precedes clearing cache on authenticated
routes. “Settled” includes networkidle's idle interval; it is not INP. Loopback,
headless Chromium and concurrent local test work limit latency interpretation.
All route medians, request counts, CLS and long-task observations are in
[sanitized metrics](neo-aurora-uiux-redesign-metrics.json). Cold medians improved
in this sample; warm medians are broadly unchanged. No observed long tasks in the
sample. Homepage max CLS remains **0.1043** (original max **0.2267**), slightly above
0.1; this is a remaining performance limitation, not a passing CLS certification.

## 14. Regression

| Check | Current execution |
|---|---|
| Backend `clean verify` | PASS 520 = 249 Surefire + 271 PostgreSQL Failsafe; 0 failures/errors/skips |
| AI hash-locked install / pip check | PASS |
| AI pytest | PASS 887; one existing Starlette/httpx deprecation warning |
| Final frontend build / lint | PASS; 0 lint errors/warnings |
| Final frontend tests | PASS 246, 39 files; 0 failures/skips |
| Settings isolated | PASS 6/6 |
| Analytics isolated | PASS 6/6 |
| Reliability isolated | PASS 26/26 |
| First default E2E | 64 PASS / 2 FAIL; no retries/skips |
| First UI acceptance | PASS 11/11 |
| Second default E2E, fixed build | PASS 66/66, including B02/B06/L02/N07 |
| Second UI acceptance | 10 PASS / 1 FAIL (U05 mixed-tier score-detail contrast) |
| Final default E2E, contrast-corrected build | PASS 66/66 |
| Final UI acceptance, contrast-corrected build | PASS 11/11; mixed-tier axe diagnostics empty |

Final existing E2E acceptance: **115 PASS = 66 default + 6 Settings + 6 Analytics +
26 Reliability + 11 UI**, with no skipped tests. The first/second failures above
are retained; this total does not count repeated runs as additional test cases.

First default failures: B02 found the extra dashboard H1 (fixed); N07 reached a
blank login page at the final Student viewport (root cause unproven). A build was
replaced during this first run, so it cannot establish a stable-build regression
result. U05's mixed fixture revealed muted score-detail text on a tinted panel;
secondary text was darkened, and detailed private axe diagnostics added without
changing the assertion. The final run uses a fresh database and a fixed production build. No test
assertion was weakened, skipped or automatically retried. Two existing unit
assertions were translated to assert the new Vietnamese score labels.

`run-neo-aurora-isolated-e2e.ps1` uses fresh Testcontainers PostgreSQL/real AI,
secondary synthetic accounts and a separate CV directory. `E2E_LOCAL_DIR` confines
credentials/manifests to a new ignored subdirectory. The live demo's credentials,
fixtures, CVs and statuses are never used for mutations. The default runner's
existing Admin API setup occurs only in this disposable runtime.

## 15. Screenshot and raw evidence inventory

Private, gitignored locations:

- `e2e/.local/neo-aurora-before/`: baseline, 56 screenshots.
- `e2e/.local/neo-aurora-release/`: final build, 28 routes at
  375/430/768/1024/1440, 140 screenshots.
- `neo-aurora-*-browser.json`: route, width, API methods, errors, overflow and axe.
- `neo-aurora-contrast-isolated/`: final default/UI JSON, isolated Backend/preview logs,
  synthetic credentials, fixture IDs, screenshots and API/browser evidence.
- `neo-aurora-*-e2e.log`, `neo-aurora-*-final.log`: suite/build/lint logs.
- `neo-aurora-performance.json`: raw timing/asset metrics without personal content.
- `neo-aurora-baseline.json`, `neo-aurora-preservation.json`,
  `neo-aurora-date-audit.json`: current-window preservation/date evidence.

Raw screenshots, JWTs, credentials, CV content and local logs are not committed
or uploaded. Use local paths during manual review.

## 16. Data preservation

Before demo login/visual work: independent checkpoint captured all 19 business
tables / 3,062 rows as digests plus existing database/CV volume identity and
creation metadata. It never replaces the old manual-final baseline/comparator.
The new checkpoint records both exact-row digests and a separate users-content
digest excluding only `last_login_at` and `updated_at`.

Comparison after the final screenshot/performance journeys: no added/removed/changed business content; volume identity
unchanged. Exact-row changes limited to login audit metadata for the two manual
demo accounts. Admin was not authenticated or changed on the live demo. Existing
CV analyses, histories, recommendation/ranking results and saved items remained
unchanged relative to this new checkpoint. Volume metadata is not a byte-by-byte
CV file backup; no demo storage write commands were executed.

The old SQL verifier already failed **before implementation** because a saved-item
count differed from its historical expectation. It was not repaired/reseeded.
The unchanged historical comparator was rerun: **FAIL**, only `users.id=1`
differs from the original pre-seed baseline; volumes remain preserved. The old
Admin1 mismatch remains historically INCONCLUSIVE; neither its comparator
nor baseline is edited or relaxed. A fresh current-window PASS does not establish
pre-seed historical preservation.

## 17. B06 / N07 / L02

Both later stable full default runs passed B06, L02 and N07. The final run passed
all 66 default cases, including the full N07 ten-context/five-width scenario.
Historical reports retain their original UNRESOLVED / NOT REPRODUCED status;
passing a fresh isolated browser case does not prove the historical root cause.
The first N07 blank symptom is retained in private failure evidence.

## 18. Remaining limits

- Historical naive timestamps remain ambiguous; UTC-period and all-time totals
  deliberately remain distinct. No timezone migration included.
- Individual Jobs/Applications/Profile/Settings/CV screens receive the shared
  redesign and accessibility fixes; they are not wholesale new information
  architectures. No unsupported product feature is introduced.
- This is browser/loopback evidence, not whole-product WCAG certification,
  production SLA, mobile hardware, WAN, native zoom or screen-reader certification.
- Homepage CLS is improved but still 0.1043 in the measured worst sample.
- Existing notification-producer gaps and historical preservation uncertainty
  remain visible. No Admin work, interview/messaging/email/2FA/upload capability.
- Shutdown is conditional on the saved/pushed checkpoint, no active relevant
  work, and a safe host state; command acceptance would not prove physical poweroff.

## 19. Manual review

While preview is running, open `http://127.0.0.1:5177`. After a restart, run
`cd frontend; npm.cmd run dev` and open the printed local URL. Then log in using the existing private
`e2e/.local/manual-final-credentials.json` accounts. Do not print/share the file.
Review Public → Login → Student dashboard/CV/recommendations/applications, then
Company dashboard/reports/jobs/ranking/profile. Compare period/all-time counts,
use the trend's accessible table, inspect PRIMARY/FALLBACK independently and try
mobile menus/Escape. Existing demo mutations are not needed for screenshot review.
Never run manual-final-seed, generic fixture setup, reset passwords or reset
terminal applications against the demo.

Isolated mutation regression command:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/run-neo-aurora-isolated-e2e.ps1 -RunName neo-aurora-review-unique -JavaHome <installed-java-21-directory>
```

Use a unique run name; existing private evidence is not overwritten. The runner
requires synthetic CV inputs already under `e2e/.local`, the built frontend and
the existing local AI image. It creates no demo data.

## Final verification checkpoint

- PASS: frontend production build/lint, 246 frontend tests, 520 Backend tests,
  887 AI tests, locked environment check and 115 existing real E2E cases.
- PASS: final 140 screenshot/axe audits, mobile menu/focus/reduced-motion checks;
  72 actual cold/warm measurements. Detailed scope and limits remain above.
- PASS in the new checkpoint window: all 3,062 rows' business content preserved;
  exact-row differences only two users' login audit metadata; volumes preserved.
  Historical strict comparison still FAIL on Admin1 and historically INCONCLUSIVE.
- PASS: source syntax, staged whitespace and scoped private-artifact/JWT/key scan
  are required before committing; no credentials or raw browser artifacts included.
- No Backend/AI production change, migration, ranking change or demo mutation.
- Delivery uses a normal commit/push on the existing branch. PR #66 remains
  Draft; no merge or force push. The exact pushed SHA and native Draft confirmation
  are recorded in the final handoff checkpoint and chat after Git completes.
- Shutdown is performed only after these saved checks, Git verification and
  process/document safety checks. Its actual scheduling result is recorded in
  the final handoff; this report does not claim physical poweroff.
