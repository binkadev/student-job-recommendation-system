# W4-C2 — Frontend dependency security remediation

## Decision and provenance

**Scoped dependency security gate: PASS, proposed for independent review. Overall W4-B: NOT READY.** The final locked graph has zero npm advisories in both full and omit-dev audits; all 564 existing Frontend tests pass. This is neither a production risk approval nor a claim that the complete system is vulnerability-free. W4-B remains NOT READY until Recruiting repair evidence and this remediation have both been independently reviewed and a new release-readiness assessment is recorded.

- Repository: `binkadev/student-job-recommendation-system`.
- Verified remote `master` before worktree creation and again before delivery: `947ad0d5cc925061b9d5b04e7250f5a8e56b75d2` (merge of Recruiting repair PR #97). It matches this work package's requested baseline. No legacy branch was used.
- Dedicated branch: `fix/datn-w4c2-frontend-dependency-security`; worktree relative to the preserved root: `.worktrees/datn-w4c2-frontend-dependency-security`.
- Evidence collected 2026-11-12, Windows, PowerShell 5.1, Node **24.18.1**, npm **11.16.0**, TypeScript **5.6.3**, React/ReactDOM **18.3.1**. Audit data is a dated registry observation.
- Read `AGENTS.md`, `docs/datn/CODEX_GUARDRAILS.md`, current Frontend manifests/config/source/tests, HTTP/session conventions and `.github/workflows/frontend-ci.yml`.
- Historical W4-B evidence was read at PR #96 head `67c34a81fa1feefdd0a5c0ee0cdf96f99664f4be`: [report](https://github.com/binkadev/student-job-recommendation-system/blob/67c34a81fa1feefdd0a5c0ee0cdf96f99664f4be/docs/datn/w4b-integrated-regression-report.md), [matrix](https://github.com/binkadev/student-job-recommendation-system/blob/67c34a81fa1feefdd0a5c0ee0cdf96f99664f4be/docs/datn/w4b-regression-matrix.json). PR #96 stays OPEN/DRAFT with that same head; neither modified nor merged here.
- The expected 564-test/57-file pre-change result is **historical W4-B evidence**, not a newly rerun pre-upgrade test suite. The baseline audits/install/tree and post-change checks below were actually executed in this worktree.

## Reproduced audits and acceptance checks

Commands executed from `frontend/` (PowerShell). Raw output was redirected to ignored `e2e/.local/w4c2/`, not committed. Exit codes were captured immediately after each command; audit exit 1 before remediation means findings, not an unavailable audit service.

```powershell
# Before any manifest/lock change
npm.cmd ci
npm.cmd audit --json
npm.cmd audit --omit=dev --json
npm.cmd ls --all
npm.cmd ls --all --json

# Final acceptance, after compatibility repairs, fresh locked install
npm.cmd ci
npm.cmd run test:run -- --reporter=default --reporter=json --outputFile=../e2e/.local/w4c2/tests-post-ci.json
npx.cmd tsc -b
npm.cmd run lint
npm.cmd run build
npm.cmd audit --json
npm.cmd audit --omit=dev --json
npm.cmd ls --all --json
```

| Check | Baseline freshly executed | Final freshly executed |
|---|---|---|
| Locked install | exit 0 | exit 0; no lock mutation |
| Full audit: critical / high / moderate / low | 0 / 11 / 13 / 0 (24 package entries), exit 1 | 0 / 0 / 0 / 0, exit 0 |
| Omit-dev audit: critical / high / moderate / low | 0 / 8 / 3 / 0 (11 package entries), exit 1 | 0 / 0 / 0 / 0, exit 0 |
| Dependency tree | exit 0 | exit 0, no invalid/peer dependency errors |
| Existing Vitest suite | historical 564/57; not rerun before upgrades | **564 PASS, 0 FAIL, 0 SKIP, 57 files**, exit 0 |
| TypeScript `tsc -b` | not rerun before upgrades | PASS, exit 0 |
| ESLint | not rerun before upgrades | PASS, exit 0 |
| Production build (`tsc -b && vite build`) | not rerun before upgrades | PASS, exit 0 |
| Real HTTP/PostgreSQL isolated E2E / Backend / AI | NOT RUN in W4-C2 | NOT RUN; outside this dependency task |

There are **61 unique baseline advisory IDs** (30 high, 27 moderate, 4 low) behind the 24 affected package entries, including meta-vulnerable dependents. Package-entry severity uses each package's maximum severity, so low advisories can exist even when the package-entry low count is zero. Do not add package-entry counts to advisory counts. `--omit=dev` follows npm manifest classification, which includes `@vitejs/plugin-react` under dependencies; it is not a browser reachability test. Three additional advisories were reviewed during patch selection (two candidate-only, one maintainer advisory not yet returned by the baseline audit). All 64 mapped IDs below are FIXED; no remaining finding is dismissed as NOT REACHABLE or self-approved as ACCEPTED RISK.

Local evidence names: `audit-before.json`, `audit-prod-before.json`, `tree-before.json`; acceptance `install-post-ci.log`, `tests-post-ci.{json,log}`, `types-post-ci.log`, `lint-post-ci.log`, `build-post-ci.log`, `audit-post-ci.json`, `audit-prod-post-ci.json`, `tree-post-ci.json`, `checks-post-ci.json`. These files are ignored; the tables and sanitized trees in this document retain the reviewable results without machine paths or raw payloads.

Frontend GitHub CI on [Draft PR #98](https://github.com/binkadev/student-job-recommendation-system/pull/98): initial [run 43162106476](https://github.com/binkadev/student-job-recommendation-system/actions/runs/43162106476), source commit `2f6fb9c560cd1c14430fde4d8ed2475af3c4064e`, **FAIL: 563 PASS / 1 FAIL**, Ubuntu, Node 24.22.2, npm 11.19.1. Company form initial hydration race is documented below and repaired after this run. ESLint/build were skipped after the failing test step, not claimed as successful CI checks. No job was rerun. The new repair commit `de7c5cc98ce67add4d4e56855d8da32bf0c7359c` received **SUCCESS** in [run 43162577628](https://github.com/binkadev/student-job-recommendation-system/actions/runs/43162577628): locked install, **564 PASS / 57 files**, ESLint and production build all succeeded, completed 2026-11-12 05:38:20 UTC. These are new-commit CI results, not a retry of the failed run. CI uses Node 24.22.2/npm 11.19.1; audits and the explicit additional TypeScript invocation are local evidence (CI's build also runs `tsc -b`). The later documentation-only evidence update retains the same Frontend Git tree `a507440970bbe75502a06e7a53273d67fc426f4b`; this cited run is tied specifically to the repair commit, not mislabelled as a new run on a later documentation commit.

## Version changes and compatibility

Direct security dependencies are pinned exactly in both manifests: Axios 1.20.0, Zod 4.6.6, React Router DOM 7.18.5, Vite 6.4.6, PostCSS 8.5.23, Vitest 4.1.12. Other direct dependency ranges remain unchanged. Targeted `npm install`/`npm update` were used; no `npm audit fix --force`, legacy-peer bypass, security suppression, or mass major upgrade was used.

All changed installed instance versions, including dependency-induced additions/removals, follow. A removed package has no final instance; the lockfile retains exact versions/integrity for added dependencies.

| Installed package path | Before | After |
|---|---|---|
| `node_modules/@isaacs/nonrecursive-glob-match` | absent | 1.1.0 |
| `node_modules/@remix-run/router` | 1.23.3 | removed |
| `node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion` | 5.0.7 | 5.0.13 |
| `node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch` | 10.2.5 | 11.0.8 |
| `node_modules/@vitest/expect` | 4.1.10 | 4.1.12 |
| `node_modules/@vitest/mocker` | 4.1.10 | 4.1.12 |
| `node_modules/@vitest/pretty-format` | 4.1.10 | 4.1.12 |
| `node_modules/@vitest/runner` | 4.1.10 | 4.1.12 |
| `node_modules/@vitest/snapshot` | 4.1.10 | 4.1.12 |
| `node_modules/@vitest/spy` | 4.1.10 | 4.1.12 |
| `node_modules/@vitest/utils` | 4.1.10 | 4.1.12 |
| `node_modules/axios` | 1.18.1 | 1.20.0 |
| `node_modules/baseline-browser-mapping` | 2.10.42 | 2.11.36 |
| `node_modules/brace-expansion` | 1.1.16 | 1.1.22 |
| `node_modules/browserslist` | 4.28.5 | 4.29.5 |
| `node_modules/caniuse-lite` | 1.0.30001803 | 1.0.30001826 |
| `node_modules/chai` | 6.2.2 | 6.3.0 |
| `node_modules/cookie` | absent | 1.1.1 |
| `node_modules/cssesc` | 3.0.0 | removed |
| `node_modules/electron-to-chromium` | 1.5.389 | 1.5.482 |
| `node_modules/follow-redirects` | 1.16.0 | 1.16.3 |
| `node_modules/js-yaml` | 4.3.0 | 4.3.2 |
| `node_modules/nanoid` | 3.3.15 | 3.3.20 |
| `node_modules/node-releases` | 2.0.51 | 2.0.63 |
| `node_modules/postcss` | 8.5.16 | 8.5.23 |
| `node_modules/postcss-selector-parser` | 6.1.4 | 6.1.6 |
| `node_modules/react-router` | 6.30.4 | 7.18.5 |
| `node_modules/react-router-dom` | 6.30.4 | 7.18.5 |
| `node_modules/set-cookie-parser` | absent | 2.7.3 |
| `node_modules/source-map-js` | 1.2.1 | 1.2.2 |
| `node_modules/tinyrainbow` | 3.1.1 | 3.2.0 |
| `node_modules/undici` | 8.9.0 | 8.12.4 |
| `node_modules/update-browserslist-db` | 1.2.3 | 1.3.4 |
| `node_modules/vite` | 6.4.3 | 6.4.6 |
| `node_modules/vitest` | 4.1.10 | 4.1.12 |
| `node_modules/zod` | 4.4.3 | 4.6.6 |

The only direct major upgrade is React Router 6→7. The [official upgrade guide](https://github.com/remix-run/react-router/blob/react-router%407.18.0/docs/upgrading/v6.md) requires Node ≥20 and React/DOM ≥18, satisfied here. This is a browser SPA using `createBrowserRouter`/`createRoot`, with module-level lazy components, no SSR/hydration/RSC, route loaders/actions/fetchers, or relative navigation under a multi-segment splat. Existing route paths, guards and API calls remain in place. The transition scheduling change was assessed through focused navigation/session tests and the full suite, with three essential timing repairs below. No React major upgrade was needed.

The narrow override `@typescript-eslint/typescript-estree > minimatch = 11.0.8` crosses a transitive major because minimatch 10 remains affected by the baseline amplification advisory. Updating the parent alone was insufficient: even typescript-eslint 8.72.2 still declared minimatch `^10.2.2` when checked. Upstream's minimatch 11 change to internal `Minimatch.set` shape is a compatibility risk. The actual consumer calls the public `minimatch(filePath, pattern, {dot:true})` API; project ESLint configuration does not enable projectService/allowDefaultProject or optimizationLevel 2. ESLint plus an additional real parser/projectService probe passed (below). The old minimatch 3 branch under ESLint is unaffected by the ≥7 advisory and remains 3.1.5; only its vulnerable brace-expansion child is patched. The override must be reevaluated when upstream adopts a fixed supported version. New `@isaacs/nonrecursive-glob-match` is the locked minimatch 11 matcher implementation; cookie/set-cookie-parser are Router transitive requirements, not new application features.

Intermediate candidates were not accepted merely because an earlier advisory was patched: Router 7.18.0 exposed newly published RSC finding GHSA-qwww-vcr4-c8h2 and Vite 6.4.4 had GHSA-8g5g-mxqh-grgj. Final versions are 7.18.5/6.4.6. Minimatch was raised to 11.0.8 for the maintainer's additional GHSA-c859-jr93-m5j4. See authoritative links/ranges below.

## Scope, attack paths and remediation groups

Each advisory row references a group here for its actual dependency chain, feature, reachability assessment and compatibility risk. Static absence of an exposed path is qualified, not a substitute for patching. All groups were patched.

| Group / package | Actual chain and feature | Scope / reachability assessment | Remediation / compatibility validation |
|---|---|---|---|
| G01 Axios | direct `axios` → `src/services/api/httpClient.ts`; JSON API requests, downloads, auth/session interceptor | Production browser. Default adapters are xhr/http/fetch; browser package mapping disables Node HTTP/platform. No app adapter override. Node HTTP2, proxies/NO_PROXY, redirects, data-URI server paths are not used by this SPA. Prototype-pollution prerequisites are not established by static review; Axios still consumes partially untrusted responses/config inputs. No exploit claimed. | 1.18.1→1.20.0; HTTP/session/account-switch tests. Base URL, timeout, headers, JWT/session-version handling, cancellation and API shapes unchanged. Axios now types `params` as unknown: only three mock-test files need explicit bounded casts. |
| G02 follow-redirects | `axios → follow-redirects` | Node HTTP adapter transitive dependency. Normal browser XHR handles redirects itself; library is not the browser redirect handler. No deployed Node Axios service in this frontend. Node reuse elsewhere was not audited. | 1.16.0→1.16.3; patched despite absent Node deployment path. |
| G03 Zod | direct `zod`; `CandidateProfileEditView`, `candidateProfileExtensions`, React Hook Form resolver | Production browser validation of user forms/profile data. Certificates/languages max 50 and bounded strings/URLs reduce normal input size; do not prove old parse/amplification behavior unreachable for manipulated state/oversized input. Backend remains validation authority. | 4.4.3→4.6.6; profile persistence/invalid-field tests, unchanged schemas and payload shapes. |
| G04 Router/core DOM | direct `react-router-dom → react-router`; routes, protected role layouts, links and redirects | Production browser security boundary. No server framework, RSC or hydration; server-only advisory prerequisites absent here. Arbitrary redirect/URL patterns still deserve patching; static review is not a universal browser exploitability proof. | 6.30.4→7.18.5; reviewed major, role/route/session/recruiting/messaging tests; focus/draft scheduling repairs below. |
| G05 Vite | direct dev `vite`; dev/preview server, plugin-react, build | Build/development. Default dev server is local, but `dev:network` explicitly exposes 0.0.0.0; cannot universally call it unreachable. No proof of external deployment/access controls. Production static bundle does not include a Vite server. Malicious requests/imports can matter when a dev server is exposed. | 6.4.3→6.4.6; production build and three real loopback denied-file HTTP probes, each 403. No actual secret used. |
| G06 PostCSS | direct dev `postcss`; Vite/Tailwind/autoprefixer → PostCSS | Build/development CSS parsing. Inputs are repository styles/config; no frontend route sends user CSS to this parser. Malicious PR/build inputs can still consume CI resources. | 8.5.16→8.5.23; lint/build with unchanged PostCSS config. |
| G07 Browserslist / baseline mapping | plugin-react → Babel → helper-compilation-targets → browserslist; autoprefixer → browserslist → baseline-browser-mapping | Build-time browser-target query/statistics/database resolution. No user-provided browser query/custom stats endpoint found. Repository config/CI inputs can be untrusted; not dismissed as safe because transitive. | browserslist 4.28.5→4.29.5, mapping 2.10.42→2.11.36; coherent caniuse/electron/node target data refresh; production build. |
| G08 nanoid / source-map-js | PostCSS → nanoid/source-map-js; CSS node IDs/source map processing | Build-time, not session-token generation. Auth/session code uses its own existing browser mechanisms (including crypto.randomUUID); unchanged. No public source-map generation/upload processing found; malicious source/maps in a checkout can affect tooling. | nanoid 3.3.15→3.3.20, source-map-js 1.2.1→1.2.2; build. No claim that lack of a public upload makes all CI inputs trusted. |
| G09 brace-expansion / minimatch | ESLint → config-array → minimatch 3 → brace 1; typescript-eslint → typescript-estree → minimatch 10→11 → brace 5 | Node lint/project file globs, dev-only graph. File paths/config patterns are repo-controlled in usual use, potentially attacker-controlled in contributions. ReDoS/amplification/escape findings are patched. | brace 1.1.16→1.1.22 and 5.0.7→5.0.13; narrow minimatch 10.2.5→11.0.8 override; full ESLint plus real typed parser probe. |
| G10 js-yaml | ESLint → js-yaml (also Tailwind config ecosystem) | Node tooling/config YAML, not uploaded CV parsing. This Frontend has no user YAML loader. YAML from untrusted build inputs still poses CPU/memory/merge risk. | 4.3.0→4.3.2; ESLint/build. |
| G11 postcss-selector-parser | Tailwind → postcss-selector-parser; selector transformation | CSS build tooling. No runtime user selector processor; crafted repo CSS still relevant to CI. | 6.1.4→6.1.6; production build. |
| G12 undici | dev `jsdom → undici`, Vitest jsdom environment | Node test/network implementation. Not Axios browser XHR, nor the app's Node HTTP/cache/WebSocket server. No corresponding deployed server behavior found; test/resource inputs can still be untrusted. | 8.9.0→8.12.4; full jsdom test suite. |
| G13 Vitest / mocker | direct dev `vitest → @vitest/mocker` | Test tooling. No standalone `mockerPlugin`/`interceptorPlugin` or browser WebSocket test configuration in this repo. No claim about other machines' server exposure. | 4.1.10→4.1.12 and coherent internal @vitest packages; 564 tests. |

The six typescript-eslint audit entries (`typescript-eslint` plus eslint-plugin/parser/type-utils/typescript-estree/utils) are propagated meta-vulnerabilities from the minimatch chain, not six additional independent advisory IDs. Their installed versions remain 8.63.0; changing the vulnerable child resolves these entries without an unrelated parent upgrade.

## Advisory-to-package mapping

Authoritative ranges/first patched releases were read from GitHub advisory metadata, joined to the actual installed versions. `D` = direct, `T` = transitive; group links to the chain/feature/risk analysis above. The range shown is the advisory branch affecting the observed before-version, not every historical release line. Installed final versions were semver-checked outside each matching affected range. For multi-instance packages all final instances were checked. “First patch” may be lower than the selected patch because subsequent advisories also require remediation.

### 61 IDs returned by the fresh baseline audit

| Advisory / severity | Package (D/T), before → after | Affected range; first patch | Group / disposition |
|---|---|---|---|
| [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) / high | `js-yaml` (T), 4.3.0 → 4.3.2 | >= 4.0.0, < 4.3.2; 4.3.2 | G10 / FIXED |
| [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) / high | `nanoid` (T), 3.3.15 → 3.3.20 | < 3.3.16; 3.3.16 | G08 / FIXED |
| [GHSA-2gqq-gqf2-x968](https://github.com/advisories/GHSA-2gqq-gqf2-x968) / low | `undici` (T), 8.9.0 → 8.12.4 | >= 8.0.0, < 8.10.2; 8.10.2 | G12 / FIXED |
| [GHSA-2jfj-6hjv-fm6j](https://github.com/advisories/GHSA-2jfj-6hjv-fm6j) / moderate | `undici` (T), 8.9.0 → 8.12.4 | >= 8.0.0, < 8.10.2; 8.10.2 | G12 / FIXED |
| [GHSA-2m5v-pch6-74hx](https://github.com/advisories/GHSA-2m5v-pch6-74hx) / high | `undici` (T), 8.9.0 → 8.12.4 | >= 8.0.0, < 8.12.2; 8.12.2 | G12 / FIXED |
| [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) / high | `nanoid` (T), 3.3.15 → 3.3.20 | < 3.3.18; 3.3.18 | G08 / FIXED |
| [GHSA-337j-9hxr-rhxg](https://github.com/advisories/GHSA-337j-9hxr-rhxg) / moderate | `react-router` (T), 6.30.4 → 7.18.5 | >= 6.4.0, < 7.18.0; 7.18.0 | G04 / FIXED |
| [GHSA-3pq3-5fj3-cg6v](https://github.com/advisories/GHSA-3pq3-5fj3-cg6v) / high | `axios` (D), 1.18.1 → 1.20.0 | >= 1.13.0, < 1.20.0; 1.20.0 | G01 / FIXED |
| [GHSA-3wwx-pv8p-q78v](https://github.com/advisories/GHSA-3wwx-pv8p-q78v) / moderate | `undici` (T), 8.9.0 → 8.12.4 | >= 8.1.0, < 8.10.2; 8.10.2 | G12 / FIXED |
| [GHSA-3xpg-4rpp-hhhm](https://github.com/advisories/GHSA-3xpg-4rpp-hhhm) / moderate | `undici` (T), 8.9.0 → 8.12.4 | >= 8.0.0, < 8.10.2; 8.10.2 | G12 / FIXED |
| [GHSA-44g4-m2mj-wpvx](https://github.com/advisories/GHSA-44g4-m2mj-wpvx) / moderate | `axios` (D), 1.18.1 → 1.20.0 | >= 1.15.0, < 1.20.0; 1.20.0 | G01 / FIXED |
| [GHSA-4hqw-qxg8-jxx2](https://github.com/advisories/GHSA-4hqw-qxg8-jxx2) / moderate | `axios` (D), 1.18.1 → 1.20.0 | >= 1.12.0, < 1.20.0; 1.20.0 | G01 / FIXED |
| [GHSA-4qv8-2p9j-2685](https://github.com/advisories/GHSA-4qv8-2p9j-2685) / moderate | `undici` (T), 8.9.0 → 8.12.4 | >= 8.0.0, < 8.12.2; 8.12.2 | G12 / FIXED |
| [GHSA-4w7w-5xrc-9h26](https://github.com/advisories/GHSA-4w7w-5xrc-9h26) / high | `undici` (T), 8.9.0 → 8.12.4 | >= 8.0.0, < 8.12.2; 8.12.2 | G12 / FIXED |
| [GHSA-542g-h47m-68v8](https://github.com/advisories/GHSA-542g-h47m-68v8) / high | `axios` (D), 1.18.1 → 1.20.0 | >= 1.13.0, < 1.20.0; 1.20.0 | G01 / FIXED |
| [GHSA-55wc-3pg8-jfw6](https://github.com/advisories/GHSA-55wc-3pg8-jfw6) / moderate | `undici` (T), 8.9.0 → 8.12.4 | >= 8.0.0, < 8.12.2; 8.12.2 | G12 / FIXED |
| [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) / high | `vite` (D), 6.4.3 → 6.4.6 | <= 6.4.3; 6.4.4 | G05 / FIXED |
| [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) / high | `js-yaml` (T), 4.3.0 → 4.3.2 | >= 4.0.0, < 4.3.1; 4.3.1 | G10 / FIXED |
| [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) / high | `source-map-js` (T), 1.2.1 → 1.2.2 | >= 1.0.0, < 1.2.2; 1.2.2 | G08 / FIXED |
| [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv) / moderate | `vite` (D), 6.4.3 → 6.4.6 | <= 6.4.3; 6.4.4 | G05 / FIXED |
| [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) / high | `brace-expansion` (T), 5.0.7, 1.1.16 → 5.0.13, 1.1.22 | >= 4.0.0, < 5.0.10; < 1.1.19; 5.0.10, 1.1.19 | G09 / FIXED |
| [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g) / high | `browserslist` (T), 4.28.5 → 4.29.5 | <= 4.28.6; 4.28.7 | G07 / FIXED |
| [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) / moderate | `@vitest/mocker` (T), 4.1.10 → 4.1.12 | >= 2.1.0, < 4.1.11; 4.1.11 | G13 / FIXED |
| [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) / moderate | `vitest` (D), 4.1.10 → 4.1.12 | >= 2.1.0, < 4.1.11; 4.1.11 | G13 / FIXED |
| [GHSA-8436-99hf-9mmv](https://github.com/advisories/GHSA-8436-99hf-9mmv) / low | `undici` (T), 8.9.0 → 8.12.4 | >= 8.0.0, < 8.10.2; 8.10.2 | G12 / FIXED |
| [GHSA-8r9p-f939-6h3c](https://github.com/advisories/GHSA-8r9p-f939-6h3c) / high | `follow-redirects` (T), 1.16.0 → 1.16.3 | >= 1.16.0, < 1.16.1; 1.16.1 | G02 / FIXED |
| [GHSA-9fm3-97px-rjf6](https://github.com/advisories/GHSA-9fm3-97px-rjf6) / moderate | `undici` (T), 8.9.0 → 8.12.4 | >= 8.0.0, < 8.12.2; 8.12.2 | G12 / FIXED |
| [GHSA-9fr6-4gfg-395g](https://github.com/advisories/GHSA-9fr6-4gfg-395g) / moderate | `axios` (D), 1.18.1 → 1.20.0 | >= 1.0.0, < 1.20.0; 1.20.0 | G01 / FIXED |
| [GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw) / low | `vite` (D), 6.4.3 → 6.4.6 | <= 6.4.3; 6.4.4 | G05 / FIXED |
| [GHSA-c29m-xwm3-cm6r](https://github.com/advisories/GHSA-c29m-xwm3-cm6r) / high | `axios` (D), 1.18.1 → 1.20.0 | >= 1.16.1, < 1.20.0; 1.20.0 | G01 / FIXED |
| [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) / high | `browserslist` (T), 4.28.5 → 4.29.5 | <= 4.28.6; 4.28.7 | G07 / FIXED |
| [GHSA-f72v-6w45-q472](https://github.com/advisories/GHSA-f72v-6w45-q472) / moderate | `undici` (T), 8.9.0 → 8.12.4 | >= 8.0.0, < 8.12.2; 8.12.2 | G12 / FIXED |
| [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) / moderate | `postcss` (D), 8.5.16 → 8.5.23 | <= 8.5.22; 8.5.23 | G06 / FIXED |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) / moderate | `minimatch` (T), 10.2.5, 3.1.5 → 11.0.8, 3.1.5 | >= 7.0.0, < 11.0.1; 11.0.1 | G09 / FIXED |
| [GHSA-j8rh-479h-cp32](https://github.com/advisories/GHSA-j8rh-479h-cp32) / moderate | `axios` (D), 1.18.1 → 1.20.0 | >= 1.0.0, < 1.20.0; 1.20.0 | G01 / FIXED |
| [GHSA-jjmj-jmhj-qwj2](https://github.com/advisories/GHSA-jjmj-jmhj-qwj2) / moderate | `react-router-dom` (D), 6.30.4 → 7.18.5 | >= 6.30.2, <= 6.30.5; 6.30.6 | G04 / FIXED |
| [GHSA-m8m8-qj5v-23w3](https://github.com/advisories/GHSA-m8m8-qj5v-23w3) / high | `axios` (D), 1.18.1 → 1.20.0 | >= 1.15.2, < 1.20.0; 1.20.0 | G01 / FIXED |
| [GHSA-mghh-pgcx-3jjj](https://github.com/advisories/GHSA-mghh-pgcx-3jjj) / high | `axios` (D), 1.18.1 → 1.20.0 | >= 1.15.0, < 1.20.0; 1.20.0 | G01 / FIXED |
| [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) / high | `brace-expansion` (T), 5.0.7, 1.1.16 → 5.0.13, 1.1.22 | >= 4.0.0, < 5.0.8; < 1.1.17; 5.0.8, 1.1.17 | G09 / FIXED |
| [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) / high | `zod` (D), 4.4.3 → 4.6.6 | < 4.6.6; 4.6.6 | G03 / FIXED |
| [GHSA-mrwp-f3q8-3g9p](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p) / high | `follow-redirects` (T), 1.16.0 → 1.16.3 | >= 1.16.0, <= 1.16.1; 1.16.2 | G02 / FIXED |
| [GHSA-pmjh-fq2x-6v4x](https://github.com/advisories/GHSA-pmjh-fq2x-6v4x) / moderate | `undici` (T), 8.9.0 → 8.12.4 | >= 8.0.0, < 8.10.2; 8.10.2 | G12 / FIXED |
| [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) / moderate | `brace-expansion` (T), 5.0.7, 1.1.16 → 5.0.13, 1.1.22 | >= 4.0.0, < 5.0.12; < 1.1.21; 5.0.12, 1.1.21 | G09 / FIXED |
| [GHSA-q3jh-wrc6-jgq8](https://github.com/advisories/GHSA-q3jh-wrc6-jgq8) / high | `follow-redirects` (T), 1.16.0 → 1.16.3 | >= 1.16.0, < 1.16.1; 1.16.1 | G02 / FIXED |
| [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) / high | `brace-expansion` (T), 5.0.7, 1.1.16 → 5.0.13, 1.1.22 | >= 4.0.0, < 5.0.11; < 1.1.20; 5.0.11, 1.1.20 | G09 / FIXED |
| [GHSA-qrxm-fqhp-jwvm](https://github.com/advisories/GHSA-qrxm-fqhp-jwvm) / high | `undici` (T), 8.9.0 → 8.12.4 | >= 8.0.0, < 8.12.2; 8.12.2 | G12 / FIXED |
| [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) / moderate | `@vitest/mocker` (T), 4.1.10 → 4.1.12 | >= 2.1.0-beta.7, < 4.1.12; 4.1.12 | G13 / FIXED |
| [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) / high | `postcss` (D), 8.5.16 → 8.5.23 | <= 8.5.17; 8.5.18 | G06 / FIXED |
| [GHSA-r4gj-5m52-g5wh](https://github.com/advisories/GHSA-r4gj-5m52-g5wh) / high | `axios` (D), 1.18.1 → 1.20.0 | >= 1.17.0, < 1.20.0; 1.20.0 | G01 / FIXED |
| [GHSA-r53p-7pc4-xj5r](https://github.com/advisories/GHSA-r53p-7pc4-xj5r) / low | `undici` (T), 8.9.0 → 8.12.4 | >= 8.0.0, < 8.10.2; 8.10.2 | G12 / FIXED |
| [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw) / moderate | `vite` (D), 6.4.3 → 6.4.6 | <= 6.4.3; 6.4.4 | G05 / FIXED |
| [GHSA-rfgv-xxqx-mfg5](https://github.com/advisories/GHSA-rfgv-xxqx-mfg5) / high | `undici` (T), 8.9.0 → 8.12.4 | >= 8.0.0, < 8.10.2; 8.10.2 | G12 / FIXED |
| [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) / high | `brace-expansion` (T), 5.0.7, 1.1.16 → 5.0.13, 1.1.22 | < 1.1.18; >= 4.0.0, < 5.0.9; 1.1.18, 5.0.9 | G09 / FIXED |
| [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) / moderate | `postcss-selector-parser` (T), 6.1.4 → 6.1.6 | < 6.1.5; 6.1.5 | G11 / FIXED |
| [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22) / moderate | `vite` (D), 6.4.3 → 6.4.6 | <= 6.4.3; 6.4.4 | G05 / FIXED |
| [GHSA-rx4f-c7p8-82vq](https://github.com/advisories/GHSA-rx4f-c7p8-82vq) / moderate | `undici` (T), 8.9.0 → 8.12.4 | >= 8.0.0, < 8.10.2; 8.10.2 | G12 / FIXED |
| [GHSA-vh66-26gq-q6x8](https://github.com/advisories/GHSA-vh66-26gq-q6x8) / moderate | `axios` (D), 1.18.1 → 1.20.0 | >= 1.7.0, < 1.20.0; 1.20.0 | G01 / FIXED |
| [GHSA-w293-vg96-wgc3](https://github.com/advisories/GHSA-w293-vg96-wgc3) / high | `undici` (T), 8.9.0 → 8.12.4 | >= 8.0.0, < 8.10.2; 8.10.2 | G12 / FIXED |
| [GHSA-w5vr-8v7q-w6rv](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) / moderate | `baseline-browser-mapping` (T), 2.10.42 → 2.11.36 | >= 2.0.0, < 2.11.0; 2.11.0 | G07 / FIXED |
| [GHSA-wrjc-x8rr-h8h6](https://github.com/advisories/GHSA-wrjc-x8rr-h8h6) / moderate | `react-router` (T), 6.30.4 → 7.18.5 | >= 6.0.0, < 7.18.0; 7.18.0 | G04 / FIXED |
| [GHSA-x97p-jq2g-jp4f](https://github.com/advisories/GHSA-x97p-jq2g-jp4f) / high | `axios` (D), 1.18.1 → 1.20.0 | >= 1.15.1, < 1.20.0; 1.20.0 | G01 / FIXED |
| [GHSA-xjj6-f33q-929c](https://github.com/advisories/GHSA-xjj6-f33q-929c) / high | `undici` (T), 8.9.0 → 8.12.4 | >= 8.0.0, < 8.12.2; 8.12.2 | G12 / FIXED |

### Candidate-only advisories (not present on baseline Router 6 / Vite 6.4.3)

| Advisory / severity | Package (D/T), before → after | Affected range; first patch | Group / disposition |
|---|---|---|---|
| [GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2) / high | `react-router` (T), 7.18.0 → 7.18.5 | >= 7.12.0, < 7.18.2; 7.18.2 | G04 / FIXED |
| [GHSA-8g5g-mxqh-grgj](https://github.com/advisories/GHSA-8g5g-mxqh-grgj) / moderate | `vite` (D), 6.4.4 → 6.4.6 | = 6.4.4; 6.4.5 | G05 / FIXED |

### Additional maintainer finding, not returned by baseline npm audit

| Advisory / severity | Package (D/T), before → after | Affected range; first patch | Group / disposition |
|---|---|---|---|
| [GHSA-c859-jr93-m5j4](https://github.com/isaacs/minimatch/security/advisories/GHSA-c859-jr93-m5j4) / moderate | `minimatch` (T), 10.2.5, 3.1.5 → 11.0.8, 3.1.5 | >= 7.4.0, <= 11.0.7; 11.0.8 | G09 / FIXED |

## Functional regression evidence, including failed attempts

Focused commands, all from `frontend/`, were run after logically grouped updates:

```powershell
# Axios/Zod/redirects
npm.cmd run test:run -- src/services/api/httpClient.test.ts src/services/auth/authSession.test.ts src/features/candidate/profile
# Router: guards/navigation/session plus recruiting/messaging consumers
npm.cmd run test:run -- src/app/router src/app/providers/AuthProvider.test.tsx src/services/auth src/services/api src/features/recruiting src/features/messaging src/pages/UnsupportedCapabilities.test.tsx
# Tooling group
npm.cmd run lint
npm.cmd run test:run -- src/features/candidate/profile/candidateProfileExtensions.test.ts src/app/router/RouteContent.test.tsx src/features/messaging/messagingApi.test.ts src/features/recruiting/recruitingApi.test.ts
# Final compatibility focus, then complete acceptance suite above
npm.cmd run test:run -- src/pages/recruiter/RecruiterCandidateEvaluation.test.tsx src/features/candidate/profile/CandidateProfilePersistence.test.tsx src/features/messaging/MessagingPage.test.tsx src/features/recruiting/RecruitingPage.test.tsx src/pages/recruiter/RecruiterOwnJobs.test.tsx
# CI-discovered Company form hydration race, unchanged assertions
npm.cmd run test:run -- src/pages/recruiter/RecruiterCompanyProfile.test.tsx
```

Counts recorded in ignored logs: runtime group **83/6 files PASS**; initial Router group **160/11 PASS**, final Router patch **160/11 PASS**; tooling focus **67/4 PASS** plus lint; compatibility focus **125/4 PASS**, final compatibility focus including candidate evaluation **129/5 PASS**; Company hydration compatibility **64/1 PASS**. These are overlapping subsets, not additional unique coverage to add to 564.

Two complete acceptance attempts failed before the final passing run; their diagnostics were retained (`tests-final.*`, `types-final.log`, `build-final.log`, `tests-verified.*`) rather than overwritten/deleted or hidden as retries:

1. **562 PASS / 2 FAIL of 564**: `CandidateProfilePersistence.test.tsx`, “validates hidden certificate fields and focuses the invalid nested input” and “rejects invalid GPA abc, opens its tab and focuses without writing”. Router's transition can commit a query-param tab switch after urgent focus state; the old effect consumed/cleared pending focus while the input was not mounted. Minimal fix waits until `activeTab` matches the field's target tab before focusing. Validation rules and assertions unchanged. That attempt also exposed **18 TypeScript errors** across three HTTP mock test files: Axios's `params` is now unknown. Added explicit pagination/Filters casts only in mocks; no weakening of request assertions or production types.
2. **563 PASS / 1 FAIL of 564**: `RecruiterCandidateEvaluation.test.tsx` “preserves draft on revision conflict and allows reloading current server note”. Expected only the user's new synthetic draft; received old server note concatenated with it. The editor could render through `matchedSaved` before passive initial note hydration, allowing a user clear to happen against an empty value before hydration. An isolated diagnostic run of the unchanged file passed **4/4**, so reproduction was scheduling-dependent, not reported as deterministic. Minimal fix moves only initial/snapshot note hydration to `useLayoutEffect`, before an interactive paint; existing noteDirty/draftStale/revision predicates remain intact. No auto-retry, conflict policy, mutation endpoint or ranking behavior changed.

After those two repairs, the first local acceptance passed **564/564**, types/lint/build and both audits. CI then exposed a third timing issue: `RecruiterCompanyProfile.test.tsx` “loads real fields, edits both, preserves existing values and uses the refreshed ETag after success” expected `companySize: 201-500` but received `51-200201-500`. The component already initializes its form from props, then repeats that snapshot in a passive effect. If the user clears before that pending effect, the effect restores the old text before subsequent typing. The repair moves only that existing snapshot synchronization to `useLayoutEffect`, before the form becomes interactive; ETag capture, validation and save payload logic are untouched. Its unchanged 64-test file passed, then a new complete acceptance sequence was executed (the final result table above). The earlier CI failure is retained and is not an automatically rerun job or dismissed as environment-only.

After all three timing repairs the final fresh locked install and **564/564** suite, tsc, lint and build all pass. No assertion was removed, skipped, relaxed or given retries. Existing focused tests cover invalid-field focus; candidate note revision conflict/draft retention; Company form snapshot/ETag retention; role guards; exact owned API paths/pagination; 409/403 handling; late-request cancellation, session switching and cross-account state invalidation. These are jsdom/component/service tests with mocked HTTP where already established. They do **not** establish new real Backend/PostgreSQL E2E evidence, real browser XHR exploitation tests, persistence integrity or production deployment hardening.

### Additional targeted real-tool probes

Ignored `compatibility-probes.mjs` was run with `node ../e2e/.local/w4c2/compatibility-probes.mjs` from frontend. It calls the actual @typescript-eslint parser's projectService with a matching `allowDefaultProject` pattern, confirms a typed Program with overridden minimatch 11.0.8, and clears parser caches. It also starts an owned Vite instance on **127.0.0.1/random port**, creates one synthetic `.env.w4c2-probe-*` file with exclusive creation, requests it with `?raw`, `?import&raw`, `?import&url&inline`, requires **403 and absent synthetic marker** for all three, closes its server, and removes only that owned file. Results: parser PASS; 3/3 denied HTTP probes PASS; Vite closed true; synthetic file removed true; Backend requests 0. These bounded checks do not prove every Vite vulnerability unexploitable.


For reproduction, save this probe as the ignored file named above, create `e2e/.local/w4c2/` if absent, and execute the recorded Node command from `frontend/` after `npm ci`:

```javascript
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const cwd = process.cwd();
const output = path.resolve('../e2e/.local/w4c2');
const require = createRequire(path.join(cwd, 'package.json'));
const parser = require('@typescript-eslint/parser');
const estreeRequire = createRequire(require.resolve('@typescript-eslint/typescript-estree'));
const minimatchVersion = estreeRequire('minimatch/package.json').version;
assert.equal(minimatchVersion, '11.0.8');
try {
  const result = parser.parseForESLint('export const value: number = 1;', {
    filePath: path.join(cwd, 'w4c2-compatibility-probe.ts'),
    sourceType: 'module', tsconfigRootDir: cwd,
    projectService: { allowDefaultProject: ['w4c2-compatibility-probe.ts'], defaultProject: 'tsconfig.app.json' },
  });
  assert.equal(result.ast.type, 'Program');
  assert.ok(result.services.program);
} finally {
  parser.clearCaches();
}

const { createServer } = await import(pathToFileURL(path.join(cwd, 'node_modules/vite/dist/node/index.js')).href);
const filename = `.env.w4c2-probe-${crypto.randomUUID()}`;
const envPath = path.join(cwd, filename);
const marker = 'synthetic-w4c2-private-file-marker';
fs.writeFileSync(envPath, marker, { flag: 'wx' });
let server;
const responses = [];
try {
  server = await createServer({ root: cwd, cacheDir: path.join(output, 'probe-vite-cache'),
    server: { host: '127.0.0.1', port: 0, strictPort: true, open: false } });
  await server.listen();
  const port = server.httpServer.address().port;
  for (const query of ['?raw', '?import&raw', '?import&url&inline']) {
    const response = await fetch(`http://127.0.0.1:${port}/${filename}${query}`);
    const body = await response.text();
    assert.equal(response.status, 403);
    assert.ok(!body.includes(marker));
    responses.push({ query, status: response.status, syntheticFileContentAbsent: true });
  }
} finally {
  if (server) await server.close();
  fs.unlinkSync(envPath);
}
const summary = { minimatchVersion, realParserProjectServicePassed: true, viteLoopbackDenyChecks: responses,
  ownedViteClosed: true, syntheticProbeFileRemoved: !fs.existsSync(envPath), backendRequestsSent: 0 };
fs.writeFileSync(path.join(output, 'compatibility-probes.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));

```

## Preservation, limits and review gate

- Only the dependency manifests/lock, three essential Frontend timing repairs, three test-only Axios typing adaptations and this report change. Generated `tsconfig.app.tsbuildinfo` is restored only in the dedicated worktree. No Backend, AI, Auth business rule, V1–V25 migration, workflow definition, API request shape, V3 weight/order or recruiting/interview/invitation lifecycle change.
- No Docker/PostgreSQL suite, demo DB connection, migration or application-data mutation was executed. Existing containers, volumes, manual services and other worktrees were left alone. No cleanup/prune/blanket termination was used. Root's existing `frontend/tsconfig.app.tsbuildinfo`, `.agents/`, `.worktrees/`, `skills-lock.json` state is preserved.
- No raw audit, npm tree path metadata, browser artifacts, local environment, password/hash, JWT, private message body or confidential CV content is committed. Committed sanitized trees contain dependency names/versions/edges only; URLs are public advisories. All test data/probe content was synthetic.
- No remaining npm advisory in this dated final graph; no risk acceptance requested. Unknown/new advisories, actual dev-server exposure, other deployment environments and complete browser/backend security remain outside the proof. Keep Node 24 support and the scoped minimatch override under review.
- PR #97's Recruiting repair evidence is historical relative to this Frontend dependency branch; it was not rerun here. W4-B report/matrix and NOT READY classification stay intact. Independent review of both repairs and a new release assessment are still required. Password recovery and academic relevance metrics remain excluded.

## Sanitized initial and final dependency trees

The following trees are rendered from the actually executed `npm ls --all --json` snapshots. They preserve resolved names, versions and child edges, stripping registry URLs, filesystem paths, machine environment and other raw metadata. Identical resolved subtrees are expanded once and then referenced as `[expanded above]`; missing optional/platform/peer entries are labelled `[not installed]`, not counted as an invalid install. The lockfiles additionally record all platform artifacts/integrity. This is graph deduplication for readability, not omission of changed versions.

<details>
<summary>Initial resolved dependency tree</summary>

```text
student-job-recommendation-frontend@0.1.0
  @dnd-kit/core@6.3.1
    @dnd-kit/accessibility@3.1.1
      react@18.3.1
      tslib@2.8.1
    @dnd-kit/utilities@3.2.2
    react@18.3.1
    react-dom@18.3.1
    tslib@2.8.1
  @dnd-kit/sortable@10.0.0
    @dnd-kit/core@6.3.1
    @dnd-kit/utilities@3.2.2
    react@18.3.1
    tslib@2.8.1
  @dnd-kit/utilities@3.2.2
    react@18.3.1
    tslib@2.8.1
  @eslint/js@9.39.4
  @gsap/react@2.1.2
    gsap@3.15.0
    react@18.3.1
  @hookform/resolvers@5.4.0
    @standard-schema/utils@0.3.0
    react-hook-form@7.81.0
  @testing-library/jest-dom@7.0.0
    @adobe/css-tools@4.5.0
    @testing-library/dom@10.4.1
      @babel/code-frame@7.29.7
        @babel/helper-validator-identifier@7.29.7
        js-tokens@4.0.0
        picocolors@1.1.1
      @babel/runtime@7.29.7
      @types/aria-query@5.0.4
      aria-query@5.3.0
      dom-accessibility-api@0.5.16
      lz-string@1.5.0
      picocolors@1.1.1
      pretty-format@27.5.1
        ansi-regex@5.0.1
        ansi-styles@5.2.0
        react-is@17.0.2
    aria-query@5.3.0
      dequal@2.0.3
    css.escape@1.5.1
    dom-accessibility-api@0.6.3
    picocolors@1.1.1
    redent@3.0.0
      indent-string@4.0.0
      strip-indent@3.0.0
        min-indent@1.0.1
  @testing-library/react@16.3.2
    @babel/runtime@7.29.7
    @testing-library/dom@10.4.1
    @types/react@18.3.31
    @types/react-dom@18.3.7
    react@18.3.1
    react-dom@18.3.1
  @testing-library/user-event@14.6.1
    @testing-library/dom@10.4.1
  @types/react@18.3.31
    @types/prop-types@15.7.15
    csstype@3.2.3
  @types/react-dom@18.3.7
    @types/react@18.3.31
  @vitejs/plugin-react@4.7.0
    @babel/core@7.29.7
      @babel/code-frame@7.29.7
      @babel/generator@7.29.7
        @babel/parser@7.29.7
        @babel/types@7.29.7
        @jridgewell/gen-mapping@0.3.13
        @jridgewell/trace-mapping@0.3.31
          @jridgewell/resolve-uri@3.1.2
          @jridgewell/sourcemap-codec@1.5.5
        jsesc@3.1.0
      @babel/helper-compilation-targets@7.29.7
        @babel/compat-data@7.29.7
        @babel/helper-validator-option@7.29.7
        browserslist@4.28.5
        lru-cache@5.1.1
          yallist@3.1.1
        semver@6.3.1
      @babel/helper-module-transforms@7.29.7
        @babel/core@7.29.7
        @babel/helper-module-imports@7.29.7
          @babel/traverse@7.29.7
          @babel/types@7.29.7
        @babel/helper-validator-identifier@7.29.7
        @babel/traverse@7.29.7
      @babel/helpers@7.29.7
        @babel/template@7.29.7
        @babel/types@7.29.7
      @babel/parser@7.29.7
        @babel/types@7.29.7
      @babel/template@7.29.7
        @babel/code-frame@7.29.7
        @babel/parser@7.29.7
        @babel/types@7.29.7
      @babel/traverse@7.29.7
        @babel/code-frame@7.29.7
        @babel/generator@7.29.7
        @babel/helper-globals@7.29.7
        @babel/parser@7.29.7
        @babel/template@7.29.7
        @babel/types@7.29.7
        debug@4.4.3
      @babel/types@7.29.7
        @babel/helper-string-parser@7.29.7
        @babel/helper-validator-identifier@7.29.7
      @jridgewell/remapping@2.3.5
        @jridgewell/gen-mapping@0.3.13
        @jridgewell/trace-mapping@0.3.31
      convert-source-map@2.0.0
      debug@4.4.3
      gensync@1.0.0-beta.2
      json5@2.2.3
      semver@6.3.1
    @babel/plugin-transform-react-jsx-self@7.29.7
      @babel/core@7.29.7
      @babel/helper-plugin-utils@7.29.7
    @babel/plugin-transform-react-jsx-source@7.29.7
      @babel/core@7.29.7
      @babel/helper-plugin-utils@7.29.7
    @rolldown/pluginutils@1.0.0-beta.27
    @types/babel__core@7.20.5
      @babel/parser@7.29.7
      @babel/types@7.29.7
      @types/babel__generator@7.27.0
        @babel/types@7.29.7
      @types/babel__template@7.4.4
        @babel/parser@7.29.7
        @babel/types@7.29.7
      @types/babel__traverse@7.28.0
        @babel/types@7.29.7
    react-refresh@0.17.0
    vite@6.4.3
  autoprefixer@10.5.2
    browserslist@4.28.5
      baseline-browser-mapping@2.10.42
      caniuse-lite@1.0.30001803
      electron-to-chromium@1.5.389
      node-releases@2.0.51
      update-browserslist-db@1.2.3
        browserslist@4.28.5
        escalade@3.2.0
        picocolors@1.1.1
    caniuse-lite@1.0.30001803
    fraction.js@5.3.4
    picocolors@1.1.1
    postcss@8.5.16
    postcss-value-parser@4.2.0
  axios@1.18.1
    follow-redirects@1.16.0
    form-data@4.0.6
      asynckit@0.4.0
      combined-stream@1.0.8
        delayed-stream@1.0.0
      es-set-tostringtag@2.1.0
        es-errors@1.3.0
        get-intrinsic@1.3.0
          call-bind-apply-helpers@1.0.2
            es-errors@1.3.0
            function-bind@1.1.2
          es-define-property@1.0.1
          es-errors@1.3.0
          es-object-atoms@1.1.2
            es-errors@1.3.0
          function-bind@1.1.2
          get-proto@1.0.1
            dunder-proto@1.0.1
              call-bind-apply-helpers@1.0.2
              es-errors@1.3.0
              gopd@1.2.0
            es-object-atoms@1.1.2
          gopd@1.2.0
          has-symbols@1.1.0
          hasown@2.0.4
          math-intrinsics@1.1.0
        has-tostringtag@1.0.2
          has-symbols@1.1.0
        hasown@2.0.4
      hasown@2.0.4
        function-bind@1.1.2
      mime-types@2.1.35
        mime-db@1.52.0
    https-proxy-agent@5.0.1
      agent-base@6.0.2
        debug@4.4.3
      debug@4.4.3
    proxy-from-env@2.1.0
  date-fns@4.4.0
  eslint@9.39.4
    @eslint-community/eslint-utils@4.9.1
      eslint@9.39.4
      eslint-visitor-keys@3.4.3
    @eslint-community/regexpp@4.12.2
    @eslint/config-array@0.21.2
      @eslint/object-schema@2.1.7
      debug@4.4.3
      minimatch@3.1.5
    @eslint/config-helpers@0.4.2
      @eslint/core@0.17.0
    @eslint/core@0.17.0
      @types/json-schema@7.0.15
    @eslint/eslintrc@3.3.5
      ajv@6.15.0
      debug@4.4.3
      espree@10.4.0
      globals@14.0.0
      ignore@5.3.2
      import-fresh@3.3.1
        parent-module@1.0.1
          callsites@3.1.0
        resolve-from@4.0.0
      js-yaml@4.3.0
        argparse@2.0.1
      minimatch@3.1.5
      strip-json-comments@3.1.1
    @eslint/js@9.39.4
    @eslint/plugin-kit@0.4.1
      @eslint/core@0.17.0
      levn@0.4.1
        prelude-ls@1.2.1
        type-check@0.4.0
    @humanfs/node@0.16.8
      @humanfs/core@0.19.2
        @humanfs/types@0.15.0
      @humanfs/types@0.15.0
      @humanwhocodes/retry@0.4.3
    @humanwhocodes/module-importer@1.0.1
    @humanwhocodes/retry@0.4.3
    @types/estree@1.0.9
    ajv@6.15.0
      fast-deep-equal@3.1.3
      fast-json-stable-stringify@2.1.0
      json-schema-traverse@0.4.1
      uri-js@4.4.1
        punycode@2.3.1
    chalk@4.1.2
      ansi-styles@4.3.0
        color-convert@2.0.1
          color-name@1.1.4
      supports-color@7.2.0
        has-flag@4.0.0
    cross-spawn@7.0.6
      path-key@3.1.1
      shebang-command@2.0.0
        shebang-regex@3.0.0
      which@2.0.2
        isexe@2.0.0
    debug@4.4.3
      ms@2.1.3
    escape-string-regexp@4.0.0
    eslint-scope@8.4.0
      esrecurse@4.3.0
        estraverse@5.3.0
      estraverse@5.3.0
    eslint-visitor-keys@4.2.1
    espree@10.4.0
      acorn@8.17.0
      acorn-jsx@5.3.2
        acorn@8.17.0
      eslint-visitor-keys@4.2.1
    esquery@1.7.0
      estraverse@5.3.0
    esutils@2.0.3
    fast-deep-equal@3.1.3
    file-entry-cache@8.0.0
      flat-cache@4.0.1
        flatted@3.4.2
        keyv@4.5.4
          json-buffer@3.0.1
    find-up@5.0.0
      locate-path@6.0.0
        p-locate@5.0.0
          p-limit@3.1.0
            yocto-queue@0.1.0
      path-exists@4.0.0
    glob-parent@6.0.2
      is-glob@4.0.3
    ignore@5.3.2
    imurmurhash@0.1.4
    is-glob@4.0.3
      is-extglob@2.1.1
    jiti@1.21.7
    json-stable-stringify-without-jsonify@1.0.1
    lodash.merge@4.6.2
    minimatch@3.1.5
      brace-expansion@1.1.16
        balanced-match@1.0.2
        concat-map@0.0.1
    natural-compare@1.4.0
    optionator@0.9.4
      deep-is@0.1.4
      fast-levenshtein@2.0.6
      levn@0.4.1
      prelude-ls@1.2.1
      type-check@0.4.0
        prelude-ls@1.2.1
      word-wrap@1.2.5
  eslint-plugin-react-hooks@5.2.0
    eslint@9.39.4
  eslint-plugin-react-refresh@0.4.26
    eslint@9.39.4
  globals@15.15.0
  gsap@3.15.0
  jsdom@30.0.1
    @asamuzakjp/css-color@6.0.5
      @csstools/css-calc@3.3.0
        @csstools/css-parser-algorithms@4.0.0
        @csstools/css-tokenizer@4.0.0
      @csstools/css-color-parser@4.1.10
        @csstools/color-helpers@6.1.0
        @csstools/css-calc@3.3.0
        @csstools/css-parser-algorithms@4.0.0
        @csstools/css-tokenizer@4.0.0
      @csstools/css-parser-algorithms@4.0.0
        @csstools/css-tokenizer@4.0.0
      @csstools/css-tokenizer@4.0.0
      lru-cache@11.5.2
    @asamuzakjp/dom-selector@8.3.2
      bidi-js@1.0.3
        require-from-string@2.0.2
      css-tree@3.2.1
      is-potential-custom-element-name@1.0.1
      lru-cache@11.5.2
    @bramus/specificity@2.4.2
      css-tree@3.2.1
    @csstools/css-syntax-patches-for-csstree@1.1.7
      css-tree@3.2.1
    @exodus/bytes@1.15.1
      @noble/hashes@[not installed]
    canvas@[not installed]
    css-tree@3.2.1
      mdn-data@2.27.1
      source-map-js@1.2.1
    data-urls@7.0.0
      whatwg-mimetype@5.0.0
      whatwg-url@16.0.1
        @exodus/bytes@1.15.1
        tr46@6.0.0
        webidl-conversions@8.0.1
    decimal.js@10.6.0
    html-encoding-sniffer@6.0.0
      @exodus/bytes@1.15.1
    is-potential-custom-element-name@1.0.1
    lru-cache@11.5.2
    parse5@8.0.1
      entities@8.0.0
    saxes@6.0.0
      xmlchars@2.2.0
    symbol-tree@3.2.4
    tough-cookie@6.0.2
      tldts@7.4.10
        tldts-core@7.4.10
    undici@8.9.0
    w3c-xmlserializer@5.0.0
      xml-name-validator@5.0.0
    webidl-conversions@8.0.1
    whatwg-mimetype@5.0.0
    whatwg-url@17.1.0
      @exodus/bytes@1.15.1
      tr46@6.0.0
        punycode@2.3.1
      webidl-conversions@8.0.1
    xml-name-validator@5.0.0
  lucide-react@0.468.0
    react@18.3.1
  postcss@8.5.16
    nanoid@3.3.15
    picocolors@1.1.1
    source-map-js@1.2.1
  react@18.3.1
    loose-envify@1.4.0
  react-dom@18.3.1
    loose-envify@1.4.0
      js-tokens@4.0.0
    react@18.3.1
    scheduler@0.23.2
      loose-envify@1.4.0
  react-hook-form@7.81.0
    react@18.3.1
  react-router-dom@6.30.4
    @remix-run/router@1.23.3
    react@18.3.1
    react-dom@18.3.1
    react-router@6.30.4
      @remix-run/router@1.23.3
      react@18.3.1
  recharts@3.9.2
    @reduxjs/toolkit@2.12.0
      @standard-schema/spec@1.1.0
      @standard-schema/utils@0.3.0
      immer@11.1.11
      react@18.3.1
      react-redux@9.3.0
      redux@5.0.1
      redux-thunk@3.1.0
        redux@5.0.1
      reselect@5.2.0
    clsx@2.1.1
    decimal.js-light@2.5.1
    es-toolkit@1.49.0
    eventemitter3@5.0.4
    immer@11.1.11
    react@18.3.1
    react-dom@18.3.1
    react-is@19.2.7
    react-redux@9.3.0
      @types/react@18.3.31
      @types/use-sync-external-store@0.0.6
      react@18.3.1
      redux@5.0.1
      use-sync-external-store@1.6.0
    reselect@5.2.0
    tiny-invariant@1.3.3
    use-sync-external-store@1.6.0
      react@18.3.1
    victory-vendor@37.3.6
      @types/d3-array@3.2.2
      @types/d3-ease@3.0.2
      @types/d3-interpolate@3.0.4
        @types/d3-color@3.1.3
      @types/d3-scale@4.0.9
        @types/d3-time@3.0.4
      @types/d3-shape@3.1.8
        @types/d3-path@3.1.1
      @types/d3-time@3.0.4
      @types/d3-timer@3.0.2
      d3-array@3.2.4
        internmap@2.0.3
      d3-ease@3.0.1
      d3-interpolate@3.0.1
        d3-color@3.1.0
      d3-scale@4.0.2
        d3-array@3.2.4
        d3-format@3.1.2
        d3-interpolate@3.0.1
        d3-time@3.1.0
        d3-time-format@4.1.0
          d3-time@3.1.0
      d3-shape@3.2.0
        d3-path@3.1.0
      d3-time@3.1.0
        d3-array@3.2.4
      d3-timer@3.0.1
  tailwindcss@3.4.19
    @alloc/quick-lru@5.2.0
    arg@5.0.2
    chokidar@3.6.0
      anymatch@3.1.3
        normalize-path@3.0.0
        picomatch@2.3.2
      braces@3.0.3
        fill-range@7.1.1
          to-regex-range@5.0.1
            is-number@7.0.0
      fsevents@[not installed]
      glob-parent@5.1.2
        is-glob@4.0.3
      is-binary-path@2.1.0
        binary-extensions@2.3.0
      is-glob@4.0.3
      normalize-path@3.0.0
      readdirp@3.6.0
        picomatch@2.3.2
    didyoumean@1.2.2
    dlv@1.1.3
    fast-glob@3.3.3
      @nodelib/fs.stat@2.0.5
      @nodelib/fs.walk@1.2.8
        @nodelib/fs.scandir@2.1.5
          @nodelib/fs.stat@2.0.5
          run-parallel@1.2.0
            queue-microtask@1.2.3
        fastq@1.20.1
          reusify@1.1.0
      glob-parent@5.1.2 [expanded above]
      merge2@1.4.1
      micromatch@4.0.8
    glob-parent@6.0.2
    is-glob@4.0.3
    jiti@1.21.7
    lilconfig@3.1.3
    micromatch@4.0.8
      braces@3.0.3
      picomatch@2.3.2
    normalize-path@3.0.0
    object-hash@3.0.0
    picocolors@1.1.1
    postcss@8.5.16
    postcss-import@15.1.0
      postcss@8.5.16
      postcss-value-parser@4.2.0
      read-cache@1.0.0
        pify@2.3.0
      resolve@1.22.12
    postcss-js@4.1.0
      camelcase-css@2.0.1
      postcss@8.5.16
    postcss-load-config@6.0.1
      jiti@1.21.7
      lilconfig@3.1.3
      postcss@8.5.16
      tsx@[not installed]
      yaml@[not installed]
    postcss-nested@6.2.0
      postcss@8.5.16
      postcss-selector-parser@6.1.4
    postcss-selector-parser@6.1.4
      cssesc@3.0.0
      util-deprecate@1.0.2
    resolve@1.22.12
      es-errors@1.3.0
      is-core-module@2.16.2
        hasown@2.0.4
      path-parse@1.0.7
      supports-preserve-symlinks-flag@1.0.0
    sucrase@3.35.1
      @jridgewell/gen-mapping@0.3.13
        @jridgewell/sourcemap-codec@1.5.5
        @jridgewell/trace-mapping@0.3.31
      commander@4.1.1
      lines-and-columns@1.2.4
      mz@2.7.0
        any-promise@1.3.0
        object-assign@4.1.1
        thenify-all@1.6.0
          thenify@3.3.1
            any-promise@1.3.0
      pirates@4.0.7
      tinyglobby@0.2.17
      ts-interface-checker@0.1.13
  typescript@5.6.3
  typescript-eslint@8.63.0
    @typescript-eslint/eslint-plugin@8.63.0
      @eslint-community/regexpp@4.12.2
      @typescript-eslint/parser@8.63.0
      @typescript-eslint/scope-manager@8.63.0
        @typescript-eslint/types@8.63.0
        @typescript-eslint/visitor-keys@8.63.0
      @typescript-eslint/type-utils@8.63.0
        @typescript-eslint/types@8.63.0
        @typescript-eslint/typescript-estree@8.63.0
        @typescript-eslint/utils@8.63.0
        debug@4.4.3
        eslint@9.39.4
        ts-api-utils@2.5.0
        typescript@5.6.3
      @typescript-eslint/utils@8.63.0
      @typescript-eslint/visitor-keys@8.63.0
        @typescript-eslint/types@8.63.0
        eslint-visitor-keys@5.0.1
      eslint@9.39.4
      ignore@7.0.6
      natural-compare@1.4.0
      ts-api-utils@2.5.0
        typescript@5.6.3
      typescript@5.6.3
    @typescript-eslint/parser@8.63.0
      @typescript-eslint/scope-manager@8.63.0
      @typescript-eslint/types@8.63.0
      @typescript-eslint/typescript-estree@8.63.0
      @typescript-eslint/visitor-keys@8.63.0
      debug@4.4.3
      eslint@9.39.4
      typescript@5.6.3
    @typescript-eslint/typescript-estree@8.63.0
      @typescript-eslint/project-service@8.63.0
        @typescript-eslint/tsconfig-utils@8.63.0
        @typescript-eslint/types@8.63.0
        debug@4.4.3
        typescript@5.6.3
      @typescript-eslint/tsconfig-utils@8.63.0
        typescript@5.6.3
      @typescript-eslint/types@8.63.0
      @typescript-eslint/visitor-keys@8.63.0
      debug@4.4.3
      minimatch@10.2.5
        brace-expansion@5.0.7
          balanced-match@4.0.4
      semver@7.8.5
      tinyglobby@0.2.17
      ts-api-utils@2.5.0
      typescript@5.6.3
    @typescript-eslint/utils@8.63.0
      @eslint-community/eslint-utils@4.9.1
      @typescript-eslint/scope-manager@8.63.0
      @typescript-eslint/types@8.63.0
      @typescript-eslint/typescript-estree@8.63.0
      eslint@9.39.4
      typescript@5.6.3
    eslint@9.39.4
    typescript@5.6.3
  vite@6.4.3
    @types/node@[not installed]
    esbuild@0.25.12
      @esbuild/aix-ppc64@[not installed]
      @esbuild/android-arm@[not installed]
      @esbuild/android-arm64@[not installed]
      @esbuild/android-x64@[not installed]
      @esbuild/darwin-arm64@[not installed]
      @esbuild/darwin-x64@[not installed]
      @esbuild/freebsd-arm64@[not installed]
      @esbuild/freebsd-x64@[not installed]
      @esbuild/linux-arm@[not installed]
      @esbuild/linux-arm64@[not installed]
      @esbuild/linux-ia32@[not installed]
      @esbuild/linux-loong64@[not installed]
      @esbuild/linux-mips64el@[not installed]
      @esbuild/linux-ppc64@[not installed]
      @esbuild/linux-riscv64@[not installed]
      @esbuild/linux-s390x@[not installed]
      @esbuild/linux-x64@[not installed]
      @esbuild/netbsd-arm64@[not installed]
      @esbuild/netbsd-x64@[not installed]
      @esbuild/openbsd-arm64@[not installed]
      @esbuild/openbsd-x64@[not installed]
      @esbuild/openharmony-arm64@[not installed]
      @esbuild/sunos-x64@[not installed]
      @esbuild/win32-arm64@[not installed]
      @esbuild/win32-ia32@[not installed]
      @esbuild/win32-x64@0.25.12
    fdir@6.5.0
      picomatch@4.0.5
    fsevents@[not installed]
    jiti@1.21.7
    less@[not installed]
    lightningcss@[not installed]
    picomatch@4.0.5
    postcss@8.5.16
    rollup@4.62.2
      @rollup/rollup-android-arm-eabi@[not installed]
      @rollup/rollup-android-arm64@[not installed]
      @rollup/rollup-darwin-arm64@[not installed]
      @rollup/rollup-darwin-x64@[not installed]
      @rollup/rollup-freebsd-arm64@[not installed]
      @rollup/rollup-freebsd-x64@[not installed]
      @rollup/rollup-linux-arm-gnueabihf@[not installed]
      @rollup/rollup-linux-arm-musleabihf@[not installed]
      @rollup/rollup-linux-arm64-gnu@[not installed]
      @rollup/rollup-linux-arm64-musl@[not installed]
      @rollup/rollup-linux-loong64-gnu@[not installed]
      @rollup/rollup-linux-loong64-musl@[not installed]
      @rollup/rollup-linux-ppc64-gnu@[not installed]
      @rollup/rollup-linux-ppc64-musl@[not installed]
      @rollup/rollup-linux-riscv64-gnu@[not installed]
      @rollup/rollup-linux-riscv64-musl@[not installed]
      @rollup/rollup-linux-s390x-gnu@[not installed]
      @rollup/rollup-linux-x64-gnu@[not installed]
      @rollup/rollup-linux-x64-musl@[not installed]
      @rollup/rollup-openbsd-x64@[not installed]
      @rollup/rollup-openharmony-arm64@[not installed]
      @rollup/rollup-win32-arm64-msvc@[not installed]
      @rollup/rollup-win32-ia32-msvc@[not installed]
      @rollup/rollup-win32-x64-gnu@4.62.2
      @rollup/rollup-win32-x64-msvc@4.62.2
      @types/estree@1.0.9
      fsevents@[not installed]
    sass@[not installed]
    sass-embedded@[not installed]
    stylus@[not installed]
    sugarss@[not installed]
    terser@[not installed]
    tinyglobby@0.2.17
      fdir@6.5.0 [expanded above]
      picomatch@4.0.5
    tsx@[not installed]
    yaml@[not installed]
  vitest@4.1.10
    @edge-runtime/vm@[not installed]
    @opentelemetry/api@[not installed]
    @types/node@[not installed]
    @vitest/browser-playwright@[not installed]
    @vitest/browser-preview@[not installed]
    @vitest/browser-webdriverio@[not installed]
    @vitest/coverage-istanbul@[not installed]
    @vitest/coverage-v8@[not installed]
    @vitest/expect@4.1.10
      @standard-schema/spec@1.1.0
      @types/chai@5.2.3
        @types/deep-eql@4.0.2
        assertion-error@2.0.1
      @vitest/spy@4.1.10
      @vitest/utils@4.1.10
      chai@6.2.2
      tinyrainbow@3.1.1
    @vitest/mocker@4.1.10
      @vitest/spy@4.1.10
      estree-walker@3.0.3
        @types/estree@1.0.9
      magic-string@0.30.21
      msw@[not installed]
      vite@6.4.3
    @vitest/pretty-format@4.1.10
      tinyrainbow@3.1.1
    @vitest/runner@4.1.10
      @vitest/utils@4.1.10
      pathe@2.0.3
    @vitest/snapshot@4.1.10
      @vitest/pretty-format@4.1.10
      @vitest/utils@4.1.10
      magic-string@0.30.21
      pathe@2.0.3
    @vitest/spy@4.1.10
    @vitest/ui@[not installed]
    @vitest/utils@4.1.10
      @vitest/pretty-format@4.1.10
      convert-source-map@2.0.0
      tinyrainbow@3.1.1
    es-module-lexer@2.3.1
    expect-type@1.4.0
    happy-dom@[not installed]
    jsdom@30.0.1
    magic-string@0.30.21
      @jridgewell/sourcemap-codec@1.5.5
    obug@2.1.4
    pathe@2.0.3
    picomatch@4.0.5
    std-env@4.2.0
    tinybench@2.9.0
    tinyexec@1.3.0
    tinyglobby@0.2.17
    tinyrainbow@3.1.1
    vite@6.4.3
    why-is-node-running@2.3.0
      siginfo@2.0.0
      stackback@0.0.2
  zod@4.4.3
```

</details>

<details>
<summary>Final resolved dependency tree</summary>

```text
student-job-recommendation-frontend@0.1.0
  @dnd-kit/core@6.3.1
    @dnd-kit/accessibility@3.1.1
      react@18.3.1
      tslib@2.8.1
    @dnd-kit/utilities@3.2.2
    react@18.3.1
    react-dom@18.3.1
    tslib@2.8.1
  @dnd-kit/sortable@10.0.0
    @dnd-kit/core@6.3.1
    @dnd-kit/utilities@3.2.2
    react@18.3.1
    tslib@2.8.1
  @dnd-kit/utilities@3.2.2
    react@18.3.1
    tslib@2.8.1
  @eslint/js@9.39.4
  @gsap/react@2.1.2
    gsap@3.15.0
    react@18.3.1
  @hookform/resolvers@5.4.0
    @standard-schema/utils@0.3.0
    react-hook-form@7.81.0
  @testing-library/jest-dom@7.0.0
    @adobe/css-tools@4.5.0
    @testing-library/dom@10.4.1
      @babel/code-frame@7.29.7
        @babel/helper-validator-identifier@7.29.7
        js-tokens@4.0.0
        picocolors@1.1.1
      @babel/runtime@7.29.7
      @types/aria-query@5.0.4
      aria-query@5.3.0
      dom-accessibility-api@0.5.16
      lz-string@1.5.0
      picocolors@1.1.1
      pretty-format@27.5.1
        ansi-regex@5.0.1
        ansi-styles@5.2.0
        react-is@17.0.2
    aria-query@5.3.0
      dequal@2.0.3
    css.escape@1.5.1
    dom-accessibility-api@0.6.3
    picocolors@1.1.1
    redent@3.0.0
      indent-string@4.0.0
      strip-indent@3.0.0
        min-indent@1.0.1
  @testing-library/react@16.3.2
    @babel/runtime@7.29.7
    @testing-library/dom@10.4.1
    @types/react@18.3.31
    @types/react-dom@18.3.7
    react@18.3.1
    react-dom@18.3.1
  @testing-library/user-event@14.6.1
    @testing-library/dom@10.4.1
  @types/react@18.3.31
    @types/prop-types@15.7.15
    csstype@3.2.3
  @types/react-dom@18.3.7
    @types/react@18.3.31
  @vitejs/plugin-react@4.7.0
    @babel/core@7.29.7
      @babel/code-frame@7.29.7
      @babel/generator@7.29.7
        @babel/parser@7.29.7
        @babel/types@7.29.7
        @jridgewell/gen-mapping@0.3.13
        @jridgewell/trace-mapping@0.3.31
          @jridgewell/resolve-uri@3.1.2
          @jridgewell/sourcemap-codec@1.5.5
        jsesc@3.1.0
      @babel/helper-compilation-targets@7.29.7
        @babel/compat-data@7.29.7
        @babel/helper-validator-option@7.29.7
        browserslist@4.29.5
        lru-cache@5.1.1
          yallist@3.1.1
        semver@6.3.1
      @babel/helper-module-transforms@7.29.7
        @babel/core@7.29.7
        @babel/helper-module-imports@7.29.7
          @babel/traverse@7.29.7
          @babel/types@7.29.7
        @babel/helper-validator-identifier@7.29.7
        @babel/traverse@7.29.7
      @babel/helpers@7.29.7
        @babel/template@7.29.7
        @babel/types@7.29.7
      @babel/parser@7.29.7
        @babel/types@7.29.7
      @babel/template@7.29.7
        @babel/code-frame@7.29.7
        @babel/parser@7.29.7
        @babel/types@7.29.7
      @babel/traverse@7.29.7
        @babel/code-frame@7.29.7
        @babel/generator@7.29.7
        @babel/helper-globals@7.29.7
        @babel/parser@7.29.7
        @babel/template@7.29.7
        @babel/types@7.29.7
        debug@4.4.3
      @babel/types@7.29.7
        @babel/helper-string-parser@7.29.7
        @babel/helper-validator-identifier@7.29.7
      @jridgewell/remapping@2.3.5
        @jridgewell/gen-mapping@0.3.13
        @jridgewell/trace-mapping@0.3.31
      convert-source-map@2.0.0
      debug@4.4.3
      gensync@1.0.0-beta.2
      json5@2.2.3
      semver@6.3.1
    @babel/plugin-transform-react-jsx-self@7.29.7
      @babel/core@7.29.7
      @babel/helper-plugin-utils@7.29.7
    @babel/plugin-transform-react-jsx-source@7.29.7
      @babel/core@7.29.7
      @babel/helper-plugin-utils@7.29.7
    @rolldown/pluginutils@1.0.0-beta.27
    @types/babel__core@7.20.5
      @babel/parser@7.29.7
      @babel/types@7.29.7
      @types/babel__generator@7.27.0
        @babel/types@7.29.7
      @types/babel__template@7.4.4
        @babel/parser@7.29.7
        @babel/types@7.29.7
      @types/babel__traverse@7.28.0
        @babel/types@7.29.7
    react-refresh@0.17.0
    vite@6.4.6
  autoprefixer@10.5.2
    browserslist@4.29.5
      baseline-browser-mapping@2.11.36
      caniuse-lite@1.0.30001826
      electron-to-chromium@1.5.482
      node-releases@2.0.63
      update-browserslist-db@1.3.4
        browserslist@4.29.5
        escalade@3.2.0
        picocolors@1.1.1
    caniuse-lite@1.0.30001826
    fraction.js@5.3.4
    picocolors@1.1.1
    postcss@8.5.23
    postcss-value-parser@4.2.0
  axios@1.20.0
    follow-redirects@1.16.3
    form-data@4.0.6
      asynckit@0.4.0
      combined-stream@1.0.8
        delayed-stream@1.0.0
      es-set-tostringtag@2.1.0
        es-errors@1.3.0
        get-intrinsic@1.3.0
          call-bind-apply-helpers@1.0.2
            es-errors@1.3.0
            function-bind@1.1.2
          es-define-property@1.0.1
          es-errors@1.3.0
          es-object-atoms@1.1.2
            es-errors@1.3.0
          function-bind@1.1.2
          get-proto@1.0.1
            dunder-proto@1.0.1
              call-bind-apply-helpers@1.0.2
              es-errors@1.3.0
              gopd@1.2.0
            es-object-atoms@1.1.2
          gopd@1.2.0
          has-symbols@1.1.0
          hasown@2.0.4
          math-intrinsics@1.1.0
        has-tostringtag@1.0.2
          has-symbols@1.1.0
        hasown@2.0.4
      hasown@2.0.4
        function-bind@1.1.2
      mime-types@2.1.35
        mime-db@1.52.0
    https-proxy-agent@5.0.1
      agent-base@6.0.2
        debug@4.4.3
      debug@4.4.3
    proxy-from-env@2.1.0
  date-fns@4.4.0
  eslint@9.39.4
    @eslint-community/eslint-utils@4.9.1
      eslint@9.39.4
      eslint-visitor-keys@3.4.3
    @eslint-community/regexpp@4.12.2
    @eslint/config-array@0.21.2
      @eslint/object-schema@2.1.7
      debug@4.4.3
      minimatch@3.1.5
    @eslint/config-helpers@0.4.2
      @eslint/core@0.17.0
    @eslint/core@0.17.0
      @types/json-schema@7.0.15
    @eslint/eslintrc@3.3.5
      ajv@6.15.0
      debug@4.4.3
      espree@10.4.0
      globals@14.0.0
      ignore@5.3.2
      import-fresh@3.3.1
        parent-module@1.0.1
          callsites@3.1.0
        resolve-from@4.0.0
      js-yaml@4.3.2
        argparse@2.0.1
      minimatch@3.1.5
      strip-json-comments@3.1.1
    @eslint/js@9.39.4
    @eslint/plugin-kit@0.4.1
      @eslint/core@0.17.0
      levn@0.4.1
        prelude-ls@1.2.1
        type-check@0.4.0
    @humanfs/node@0.16.8
      @humanfs/core@0.19.2
        @humanfs/types@0.15.0
      @humanfs/types@0.15.0
      @humanwhocodes/retry@0.4.3
    @humanwhocodes/module-importer@1.0.1
    @humanwhocodes/retry@0.4.3
    @types/estree@1.0.9
    ajv@6.15.0
      fast-deep-equal@3.1.3
      fast-json-stable-stringify@2.1.0
      json-schema-traverse@0.4.1
      uri-js@4.4.1
        punycode@2.3.1
    chalk@4.1.2
      ansi-styles@4.3.0
        color-convert@2.0.1
          color-name@1.1.4
      supports-color@7.2.0
        has-flag@4.0.0
    cross-spawn@7.0.6
      path-key@3.1.1
      shebang-command@2.0.0
        shebang-regex@3.0.0
      which@2.0.2
        isexe@2.0.0
    debug@4.4.3
      ms@2.1.3
    escape-string-regexp@4.0.0
    eslint-scope@8.4.0
      esrecurse@4.3.0
        estraverse@5.3.0
      estraverse@5.3.0
    eslint-visitor-keys@4.2.1
    espree@10.4.0
      acorn@8.17.0
      acorn-jsx@5.3.2
        acorn@8.17.0
      eslint-visitor-keys@4.2.1
    esquery@1.7.0
      estraverse@5.3.0
    esutils@2.0.3
    fast-deep-equal@3.1.3
    file-entry-cache@8.0.0
      flat-cache@4.0.1
        flatted@3.4.2
        keyv@4.5.4
          json-buffer@3.0.1
    find-up@5.0.0
      locate-path@6.0.0
        p-locate@5.0.0
          p-limit@3.1.0
            yocto-queue@0.1.0
      path-exists@4.0.0
    glob-parent@6.0.2
      is-glob@4.0.3
    ignore@5.3.2
    imurmurhash@0.1.4
    is-glob@4.0.3
      is-extglob@2.1.1
    jiti@1.21.7
    json-stable-stringify-without-jsonify@1.0.1
    lodash.merge@4.6.2
    minimatch@3.1.5
      brace-expansion@1.1.22
        balanced-match@1.0.2
        concat-map@0.0.1
    natural-compare@1.4.0
    optionator@0.9.4
      deep-is@0.1.4
      fast-levenshtein@2.0.6
      levn@0.4.1
      prelude-ls@1.2.1
      type-check@0.4.0
        prelude-ls@1.2.1
      word-wrap@1.2.5
  eslint-plugin-react-hooks@5.2.0
    eslint@9.39.4
  eslint-plugin-react-refresh@0.4.26
    eslint@9.39.4
  globals@15.15.0
  gsap@3.15.0
  jsdom@30.0.1
    @asamuzakjp/css-color@6.0.5
      @csstools/css-calc@3.3.0
        @csstools/css-parser-algorithms@4.0.0
        @csstools/css-tokenizer@4.0.0
      @csstools/css-color-parser@4.1.10
        @csstools/color-helpers@6.1.0
        @csstools/css-calc@3.3.0
        @csstools/css-parser-algorithms@4.0.0
        @csstools/css-tokenizer@4.0.0
      @csstools/css-parser-algorithms@4.0.0
        @csstools/css-tokenizer@4.0.0
      @csstools/css-tokenizer@4.0.0
      lru-cache@11.5.2
    @asamuzakjp/dom-selector@8.3.2
      bidi-js@1.0.3
        require-from-string@2.0.2
      css-tree@3.2.1
      is-potential-custom-element-name@1.0.1
      lru-cache@11.5.2
    @bramus/specificity@2.4.2
      css-tree@3.2.1
    @csstools/css-syntax-patches-for-csstree@1.1.7
      css-tree@3.2.1
    @exodus/bytes@1.15.1
      @noble/hashes@[not installed]
    canvas@[not installed]
    css-tree@3.2.1
      mdn-data@2.27.1
      source-map-js@1.2.2
    data-urls@7.0.0
      whatwg-mimetype@5.0.0
      whatwg-url@16.0.1
        @exodus/bytes@1.15.1
        tr46@6.0.0
        webidl-conversions@8.0.1
    decimal.js@10.6.0
    html-encoding-sniffer@6.0.0
      @exodus/bytes@1.15.1
    is-potential-custom-element-name@1.0.1
    lru-cache@11.5.2
    parse5@8.0.1
      entities@8.0.0
    saxes@6.0.0
      xmlchars@2.2.0
    symbol-tree@3.2.4
    tough-cookie@6.0.2
      tldts@7.4.10
        tldts-core@7.4.10
    undici@8.12.4
    w3c-xmlserializer@5.0.0
      xml-name-validator@5.0.0
    webidl-conversions@8.0.1
    whatwg-mimetype@5.0.0
    whatwg-url@17.1.0
      @exodus/bytes@1.15.1
      tr46@6.0.0
        punycode@2.3.1
      webidl-conversions@8.0.1
    xml-name-validator@5.0.0
  lucide-react@0.468.0
    react@18.3.1
  postcss@8.5.23
    nanoid@3.3.20
    picocolors@1.1.1
    source-map-js@1.2.2
  react@18.3.1
    loose-envify@1.4.0
  react-dom@18.3.1
    loose-envify@1.4.0
      js-tokens@4.0.0
    react@18.3.1
    scheduler@0.23.2
      loose-envify@1.4.0
  react-hook-form@7.81.0
    react@18.3.1
  react-router-dom@7.18.5
    react@18.3.1
    react-dom@18.3.1
    react-router@7.18.5
      cookie@1.1.1
      react@18.3.1
      react-dom@18.3.1
      set-cookie-parser@2.7.3
  recharts@3.9.2
    @reduxjs/toolkit@2.12.0
      @standard-schema/spec@1.1.0
      @standard-schema/utils@0.3.0
      immer@11.1.11
      react@18.3.1
      react-redux@9.3.0
      redux@5.0.1
      redux-thunk@3.1.0
        redux@5.0.1
      reselect@5.2.0
    clsx@2.1.1
    decimal.js-light@2.5.1
    es-toolkit@1.49.0
    eventemitter3@5.0.4
    immer@11.1.11
    react@18.3.1
    react-dom@18.3.1
    react-is@19.2.7
    react-redux@9.3.0
      @types/react@18.3.31
      @types/use-sync-external-store@0.0.6
      react@18.3.1
      redux@5.0.1
      use-sync-external-store@1.6.0
    reselect@5.2.0
    tiny-invariant@1.3.3
    use-sync-external-store@1.6.0
      react@18.3.1
    victory-vendor@37.3.6
      @types/d3-array@3.2.2
      @types/d3-ease@3.0.2
      @types/d3-interpolate@3.0.4
        @types/d3-color@3.1.3
      @types/d3-scale@4.0.9
        @types/d3-time@3.0.4
      @types/d3-shape@3.1.8
        @types/d3-path@3.1.1
      @types/d3-time@3.0.4
      @types/d3-timer@3.0.2
      d3-array@3.2.4
        internmap@2.0.3
      d3-ease@3.0.1
      d3-interpolate@3.0.1
        d3-color@3.1.0
      d3-scale@4.0.2
        d3-array@3.2.4
        d3-format@3.1.2
        d3-interpolate@3.0.1
        d3-time@3.1.0
        d3-time-format@4.1.0
          d3-time@3.1.0
      d3-shape@3.2.0
        d3-path@3.1.0
      d3-time@3.1.0
        d3-array@3.2.4
      d3-timer@3.0.1
  tailwindcss@3.4.19
    @alloc/quick-lru@5.2.0
    arg@5.0.2
    chokidar@3.6.0
      anymatch@3.1.3
        normalize-path@3.0.0
        picomatch@2.3.2
      braces@3.0.3
        fill-range@7.1.1
          to-regex-range@5.0.1
            is-number@7.0.0
      fsevents@[not installed]
      glob-parent@5.1.2
        is-glob@4.0.3
      is-binary-path@2.1.0
        binary-extensions@2.3.0
      is-glob@4.0.3
      normalize-path@3.0.0
      readdirp@3.6.0
        picomatch@2.3.2
    didyoumean@1.2.2
    dlv@1.1.3
    fast-glob@3.3.3
      @nodelib/fs.stat@2.0.5
      @nodelib/fs.walk@1.2.8
        @nodelib/fs.scandir@2.1.5
          @nodelib/fs.stat@2.0.5
          run-parallel@1.2.0
            queue-microtask@1.2.3
        fastq@1.20.1
          reusify@1.1.0
      glob-parent@5.1.2 [expanded above]
      merge2@1.4.1
      micromatch@4.0.8
    glob-parent@6.0.2
    is-glob@4.0.3
    jiti@1.21.7
    lilconfig@3.1.3
    micromatch@4.0.8
      braces@3.0.3
      picomatch@2.3.2
    normalize-path@3.0.0
    object-hash@3.0.0
    picocolors@1.1.1
    postcss@8.5.23
    postcss-import@15.1.0
      postcss@8.5.23
      postcss-value-parser@4.2.0
      read-cache@1.0.0
        pify@2.3.0
      resolve@1.22.12
    postcss-js@4.1.0
      camelcase-css@2.0.1
      postcss@8.5.23
    postcss-load-config@6.0.1
      jiti@1.21.7
      lilconfig@3.1.3
      postcss@8.5.23
      tsx@[not installed]
      yaml@[not installed]
    postcss-nested@6.2.0
      postcss@8.5.23
      postcss-selector-parser@6.1.6
    postcss-selector-parser@6.1.6
      util-deprecate@1.0.2
    resolve@1.22.12
      es-errors@1.3.0
      is-core-module@2.16.2
        hasown@2.0.4
      path-parse@1.0.7
      supports-preserve-symlinks-flag@1.0.0
    sucrase@3.35.1
      @jridgewell/gen-mapping@0.3.13
        @jridgewell/sourcemap-codec@1.5.5
        @jridgewell/trace-mapping@0.3.31
      commander@4.1.1
      lines-and-columns@1.2.4
      mz@2.7.0
        any-promise@1.3.0
        object-assign@4.1.1
        thenify-all@1.6.0
          thenify@3.3.1
            any-promise@1.3.0
      pirates@4.0.7
      tinyglobby@0.2.17
      ts-interface-checker@0.1.13
  typescript@5.6.3
  typescript-eslint@8.63.0
    @typescript-eslint/eslint-plugin@8.63.0
      @eslint-community/regexpp@4.12.2
      @typescript-eslint/parser@8.63.0
      @typescript-eslint/scope-manager@8.63.0
        @typescript-eslint/types@8.63.0
        @typescript-eslint/visitor-keys@8.63.0
      @typescript-eslint/type-utils@8.63.0
        @typescript-eslint/types@8.63.0
        @typescript-eslint/typescript-estree@8.63.0
        @typescript-eslint/utils@8.63.0
        debug@4.4.3
        eslint@9.39.4
        ts-api-utils@2.5.0
        typescript@5.6.3
      @typescript-eslint/utils@8.63.0
      @typescript-eslint/visitor-keys@8.63.0
        @typescript-eslint/types@8.63.0
        eslint-visitor-keys@5.0.1
      eslint@9.39.4
      ignore@7.0.6
      natural-compare@1.4.0
      ts-api-utils@2.5.0
        typescript@5.6.3
      typescript@5.6.3
    @typescript-eslint/parser@8.63.0
      @typescript-eslint/scope-manager@8.63.0
      @typescript-eslint/types@8.63.0
      @typescript-eslint/typescript-estree@8.63.0
      @typescript-eslint/visitor-keys@8.63.0
      debug@4.4.3
      eslint@9.39.4
      typescript@5.6.3
    @typescript-eslint/typescript-estree@8.63.0
      @typescript-eslint/project-service@8.63.0
        @typescript-eslint/tsconfig-utils@8.63.0
        @typescript-eslint/types@8.63.0
        debug@4.4.3
        typescript@5.6.3
      @typescript-eslint/tsconfig-utils@8.63.0
        typescript@5.6.3
      @typescript-eslint/types@8.63.0
      @typescript-eslint/visitor-keys@8.63.0
      debug@4.4.3
      minimatch@11.0.8
        @isaacs/nonrecursive-glob-match@1.1.0
        brace-expansion@5.0.13
          balanced-match@4.0.4
      semver@7.8.5
      tinyglobby@0.2.17
      ts-api-utils@2.5.0
      typescript@5.6.3
    @typescript-eslint/utils@8.63.0
      @eslint-community/eslint-utils@4.9.1
      @typescript-eslint/scope-manager@8.63.0
      @typescript-eslint/types@8.63.0
      @typescript-eslint/typescript-estree@8.63.0
      eslint@9.39.4
      typescript@5.6.3
    eslint@9.39.4
    typescript@5.6.3
  vite@6.4.6
    @types/node@[not installed]
    esbuild@0.25.12
      @esbuild/aix-ppc64@[not installed]
      @esbuild/android-arm@[not installed]
      @esbuild/android-arm64@[not installed]
      @esbuild/android-x64@[not installed]
      @esbuild/darwin-arm64@[not installed]
      @esbuild/darwin-x64@[not installed]
      @esbuild/freebsd-arm64@[not installed]
      @esbuild/freebsd-x64@[not installed]
      @esbuild/linux-arm@[not installed]
      @esbuild/linux-arm64@[not installed]
      @esbuild/linux-ia32@[not installed]
      @esbuild/linux-loong64@[not installed]
      @esbuild/linux-mips64el@[not installed]
      @esbuild/linux-ppc64@[not installed]
      @esbuild/linux-riscv64@[not installed]
      @esbuild/linux-s390x@[not installed]
      @esbuild/linux-x64@[not installed]
      @esbuild/netbsd-arm64@[not installed]
      @esbuild/netbsd-x64@[not installed]
      @esbuild/openbsd-arm64@[not installed]
      @esbuild/openbsd-x64@[not installed]
      @esbuild/openharmony-arm64@[not installed]
      @esbuild/sunos-x64@[not installed]
      @esbuild/win32-arm64@[not installed]
      @esbuild/win32-ia32@[not installed]
      @esbuild/win32-x64@0.25.12
    fdir@6.5.0
      picomatch@4.0.5
    fsevents@[not installed]
    jiti@1.21.7
    less@[not installed]
    lightningcss@[not installed]
    picomatch@4.0.5
    postcss@8.5.23
    rollup@4.62.2
      @rollup/rollup-android-arm-eabi@[not installed]
      @rollup/rollup-android-arm64@[not installed]
      @rollup/rollup-darwin-arm64@[not installed]
      @rollup/rollup-darwin-x64@[not installed]
      @rollup/rollup-freebsd-arm64@[not installed]
      @rollup/rollup-freebsd-x64@[not installed]
      @rollup/rollup-linux-arm-gnueabihf@[not installed]
      @rollup/rollup-linux-arm-musleabihf@[not installed]
      @rollup/rollup-linux-arm64-gnu@[not installed]
      @rollup/rollup-linux-arm64-musl@[not installed]
      @rollup/rollup-linux-loong64-gnu@[not installed]
      @rollup/rollup-linux-loong64-musl@[not installed]
      @rollup/rollup-linux-ppc64-gnu@[not installed]
      @rollup/rollup-linux-ppc64-musl@[not installed]
      @rollup/rollup-linux-riscv64-gnu@[not installed]
      @rollup/rollup-linux-riscv64-musl@[not installed]
      @rollup/rollup-linux-s390x-gnu@[not installed]
      @rollup/rollup-linux-x64-gnu@[not installed]
      @rollup/rollup-linux-x64-musl@[not installed]
      @rollup/rollup-openbsd-x64@[not installed]
      @rollup/rollup-openharmony-arm64@[not installed]
      @rollup/rollup-win32-arm64-msvc@[not installed]
      @rollup/rollup-win32-ia32-msvc@[not installed]
      @rollup/rollup-win32-x64-gnu@4.62.2
      @rollup/rollup-win32-x64-msvc@4.62.2
      @types/estree@1.0.9
      fsevents@[not installed]
    sass@[not installed]
    sass-embedded@[not installed]
    stylus@[not installed]
    sugarss@[not installed]
    terser@[not installed]
    tinyglobby@0.2.17
      fdir@6.5.0 [expanded above]
      picomatch@4.0.5
    tsx@[not installed]
    yaml@[not installed]
  vitest@4.1.12
    @edge-runtime/vm@[not installed]
    @opentelemetry/api@[not installed]
    @types/node@[not installed]
    @vitest/browser-playwright@[not installed]
    @vitest/browser-preview@[not installed]
    @vitest/browser-webdriverio@[not installed]
    @vitest/coverage-istanbul@[not installed]
    @vitest/coverage-v8@[not installed]
    @vitest/expect@4.1.12
      @standard-schema/spec@1.1.0
      @types/chai@5.2.3
        @types/deep-eql@4.0.2
        assertion-error@2.0.1
      @vitest/spy@4.1.12
      @vitest/utils@4.1.12
      chai@6.3.0
      tinyrainbow@3.2.0
    @vitest/mocker@4.1.12
      @vitest/spy@4.1.12
      estree-walker@3.0.3
        @types/estree@1.0.9
      magic-string@0.30.21
      msw@[not installed]
      vite@6.4.6
    @vitest/pretty-format@4.1.12
      tinyrainbow@3.2.0
    @vitest/runner@4.1.12
      @vitest/utils@4.1.12
      pathe@2.0.3
    @vitest/snapshot@4.1.12
      @vitest/pretty-format@4.1.12
      @vitest/utils@4.1.12
      magic-string@0.30.21
      pathe@2.0.3
    @vitest/spy@4.1.12
    @vitest/ui@[not installed]
    @vitest/utils@4.1.12
      @vitest/pretty-format@4.1.12
      convert-source-map@2.0.0
      tinyrainbow@3.2.0
    es-module-lexer@2.3.1
    expect-type@1.4.0
    happy-dom@[not installed]
    jsdom@30.0.1
    magic-string@0.30.21
      @jridgewell/sourcemap-codec@1.5.5
    obug@2.1.4
    pathe@2.0.3
    picomatch@4.0.5
    std-env@4.2.0
    tinybench@2.9.0
    tinyexec@1.3.0
    tinyglobby@0.2.17
    tinyrainbow@3.2.0
    vite@6.4.6
    why-is-node-running@2.3.0
      siginfo@2.0.0
      stackback@0.0.2
  zod@4.6.6
```

</details>
