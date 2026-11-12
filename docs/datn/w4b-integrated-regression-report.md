# DATN W4-B — Integrated Regression & Release Readiness

Ngày chạy: **2026-11-12, Asia/Bangkok (UTC+07)**. Repository: `binkadev/student-job-recommendation-system`.

**Quyết định: NOT READY.** Các bộ Backend, Frontend, AI, Core Smoke, Company Verification và Application Messaging được chạy dưới đây đều đạt. Tuy nhiên, chưa đủ điều kiện xác nhận integrated release vì:

1. Recruiting browser E01–E10 không khởi động được trên schema hiện tại. Hai lần chạy độc lập đều dừng tại [RecruitingWorkflowsBrowserFixture.java:117](../../backend/src/test/java/com/tttn/jobrecommendation/integration/RecruitingWorkflowsBrowserFixture.java#L117): fixture yêu cầu Flyway cuối là `24`, trong khi master đã có `25`. Đây là lỗi tương thích test harness sau khi tích hợp V25, chưa phải bằng chứng lỗi nghiệp vụ Interview/Invitation.
2. `npm audit` xác nhận 24 affected package entries, gồm 11 high; `--omit=dev` vẫn báo 11 entries, gồm 8 high. Chưa có đánh giá reachability hoặc khắc phục. Không quy kết mọi advisory đều khai thác được trong ứng dụng, nhưng chưa thể thông qua security release gate.

Không sửa production code, test assertion, dependency, workflow hoặc Flyway để đổi kết luận. Hai blocker cần PR riêng và xác minh lại.

## Baseline, workspace và phạm vi

| Mục | Giá trị đã kiểm tra |
|---|---|
| Remote `master` | `1158dd7abb8868f7fd03b74a3584ea78522de741` |
| So với baseline yêu cầu | Không thay đổi; `git ls-remote` và GitHub commit API đồng nhất; kiểm tra lại sau test vẫn cùng SHA |
| Branch | `test/datn-w4b-integrated-regression` |
| Worktree riêng | `.worktrees/datn-w4b-integrated-regression` |
| Latest migration | `V25__application_messaging.sql`; đúng 25 versioned migrations V1–V25 |
| Workspace gốc | `master@1158dd7a`; giữ `M frontend/tsconfig.app.tsbuildinfo`, `?? .agents/`, `?? .worktrees/`, `?? skills-lock.json` |
| Worktrees | Giữ 28 đăng ký có sẵn, gồm các entry prunable; thêm đúng 1, tổng 29; không prune/remove/reset/stash workspace khác |
| Files giao review | Báo cáo này và [machine-readable matrix](w4b-regression-matrix.json) |

Lệnh baseline/worktree đã thực hiện từ workspace gốc:

```powershell
git status --short
git worktree list --porcelain
git ls-remote origin refs/heads/master
gh api repos/binkadev/student-job-recommendation-system/commits/master --jq '.sha'
git fetch origin master
git worktree add .worktrees/datn-w4b-integrated-regression -b test/datn-w4b-integrated-regression 1158dd7abb8868f7fd03b74a3584ea78522de741
```

Đã đối chiếu AGENTS, CODEX_GUARDRAILS, V3 contract, Core Smoke repair, ba isolated E2E documents/runners/fixtures, workflows, API/schema/DBML và migration hiện hành. Các trang tổng quan cũ vẫn chứa nội dung lịch sử V16/V20 hoặc ghi “Backend only”; dùng executable source, released migrations, V3 contract và phần V24/V25 mới hơn để phân xử. Báo cáo này không chuyển các claim cũ thành bằng chứng runtime mới.

Phạm vi là regression/evidence. Giữ nguyên TF-IDF/Cosine, persisted READY CV snapshot, PRIMARY/FALLBACK, trọng số 0.65/0.35, global Student Top-K, independent Company tier limits, Backend-owned official ranks, AI stateless boundary, Auth/public APIs và V1–V25. Password recovery được loại trừ.

## Môi trường thực tế

| Thành phần | Phiên bản quan sát |
|---|---|
| OS / shell | Windows 11 amd64 / Windows PowerShell 5.1 |
| Java dùng Maven/fixtures | Microsoft OpenJDK **21.0.11**; `JAVA_HOME=C:\Users\haiho\.jdks\ms-21.0.11` |
| Java mặc định trên PATH | Temurin 17.0.17; không dùng để xác nhận Backend |
| Maven wrapper | 3.9.16 |
| Node / npm | 24.18.1 / 11.16.0 |
| Python / pip của venv mới | 3.11.9 / 24.0 |
| PostgreSQL local Testcontainers | **17.11**, image `postgres:17-alpine`; SQL và DatabaseMigrationIT xác nhận major 17 |
| Docker Desktop / Engine / Compose | 4.95.0 / 29.8.2 / 5.6.0, Linux amd64 qua WSL2 |
| Playwright / Chromium | 1.56.1 / 141.0.7390.37, headless, 1 worker, 0 retries |
| AI packages | FastAPI 0.139.2, Pydantic 2.13.4, scikit-learn 1.9.0, NumPy 2.4.6, underthesea 9.5.0, pytest 9.1.1 |

Core Smoke dùng Dockerfiles không đổi: Temurin Java 21 build/runtime và Python 3.11.9; không thu riêng Java patch version bên trong stack đã dọn. Phiên bản Java 21.0.11 ở bảng là JVM thực sự chạy Maven/browser fixtures. Dependency Frontend/E2E được cài mới theo lockfile trong worktree riêng; AI dùng venv mới, hash lock và binary wheels. Không dùng junction tới node_modules của worktree khác.

Docker daemon ban đầu không hoạt động. Đã khởi động Docker Desktop một lần, không restart daemon, không prune. Restart policy tự khởi động lại ba container demo có sẵn. Inventory bảo toàn bên dưới được chụp **sau lần khởi động đó, trước các regression Docker suites**. Không gửi SQL/API regression tới demo stack; không có snapshot nội dung DB trước startup để chứng minh các tác động nội bộ do application startup.

## Phân loại bằng chứng và CI

1. **RERUN_EXACT_MASTER:** thực thi local với production/test source nguyên trạng tại SHA baseline; generated buildinfo được khôi phục trước commit.
2. **CI_EXACT_MASTER:** GitHub `head_sha` chính xác bằng baseline; không tính thành lượt chạy local.
3. **HISTORICAL_NOT_RERUN:** khác commit hoặc kết quả trong PR/document cũ; không kế thừa PASS.
4. **NOT RUN:** scenario chưa thực thi, khác với framework skip. Recruiting setup FAIL không được biến thành 10 PASS hoặc 10 skipped.

CI audit: `gh api .../actions/runs?head_sha=1158dd7abb8868f7fd03b74a3584ea78522de741&per_page=100` và commit check-runs trả đúng hai workflows trên SHA này:

| Workflow | Kết quả đúng baseline | Evidence |
|---|---|---|
| Core Smoke CI, push master | **completed / success** | [run 43070720428](https://github.com/binkadev/student-job-recommendation-system/actions/runs/43070720428), [job 130697526129](https://github.com/binkadev/student-job-recommendation-system/actions/runs/43070720428/job/130697526129) |
| Pages build/deployment | completed / success | [run 43070719633](https://github.com/binkadev/student-job-recommendation-system/actions/runs/43070719633); không thay thế application regression |
| Backend / Frontend / AI / Container Images | Không có run trên chính SHA này | Workflows có path filters; PR #95 không thay source tương ứng |

Core Smoke CI hoàn tất ngày 2026-11-11 17:45 UTC, không còn PENDING tại thời điểm audit. Đã đọc job steps và logs: có diagnostics 1 PRIMARY/1 FALLBACK, PostgreSQL17, V1–V25, 1 V3/0 V2, zero PROCESSING, PASS marker và owned-stack cleanup marker. Không tự rerun failed jobs, dispatch workflow hoặc bypass checks.

CI gần nhất theo từng workflow dưới đây **chỉ là lịch sử**, kể cả source production có thể trùng:

| Workflow lịch sử | SHA | Kết quả/link |
|---|---|---|
| Backend | `6e2720006bffae4b50cf08780a47b56e7cc3a0a6` | [SUCCESS 43064732131](https://github.com/binkadev/student-job-recommendation-system/actions/runs/43064732131) |
| Frontend | `bf4fd415bee1d8829b137cabadcc06e7ad43595f` | [SUCCESS 43061520057](https://github.com/binkadev/student-job-recommendation-system/actions/runs/43061520057) |
| AI | `e019f7a45d4799c2f2c7d0dcfe5ca1e68784d686` | [SUCCESS 38409079935](https://github.com/binkadev/student-job-recommendation-system/actions/runs/38409079935) |

Đã kiểm tra GitHub metadata và `git merge-base --is-ancestor` cho từng merge commit:

| PR đã merge vào master | Nội dung | Merge SHA (rút gọn) |
|---|---|---|
| [#88](https://github.com/binkadev/student-job-recommendation-system/pull/88) | Company Verification isolated E2E | `53c14944` |
| [#89](https://github.com/binkadev/student-job-recommendation-system/pull/89) | Interviews/Invitations Backend, V24 | `f58217dd` |
| [#90](https://github.com/binkadev/student-job-recommendation-system/pull/90) | Recruiting Frontend | `d8174a8e` |
| [#91](https://github.com/binkadev/student-job-recommendation-system/pull/91) | Recruiting E01–E10 | `37e9d86f` |
| [#92](https://github.com/binkadev/student-job-recommendation-system/pull/92) | Messaging Backend, V25 | `c50f4409` |
| [#93](https://github.com/binkadev/student-job-recommendation-system/pull/93) | Messaging Frontend | `bf4fd415` |
| [#94](https://github.com/binkadev/student-job-recommendation-system/pull/94) | Messaging M01–M10 | `6e272000` |
| [#95](https://github.com/binkadev/student-job-recommendation-system/pull/95) | Core Smoke fixture/ownership repair | `1158dd7a` |

Mọi merge commit trên đều là ancestor của baseline. Kết quả E01–E10 **10 PASS lịch sử** trong [document PR #91](recruiting-workflows-isolated-e2e.md) được thực thi trên baseline V24 `d8174a8e...`, không phải kết quả mới trên V25. Company 6 PASS cũ, Messaging 10 PASS cũ và W4-A local smoke cũ cũng không được cộng vào totals lần này.

## Các lệnh và kết quả chạy lại

Các suites chạy tuần tự: Backend → Frontend → AI → Core Smoke → Company → Recruiting → Messaging. Không có hai heavyweight Docker/PostgreSQL suites chạy đồng thời. Logs, JSON reporter và XML gốc nằm dưới `e2e/.local/` được gitignore; chỉ whitelist summary được đưa vào matrix.

| Lượt thực thi | Kết quả thực tế | Fail / error / skip |
|---|---|---|
| Backend fast `test` | 249 PASS, 41 Surefire classes | 0 / 0 / 0 |
| Backend `clean verify` | **681 PASS**: 249 Surefire + 432 Failsafe, 41 + 47 classes | 0 / 0 / 0 |
| Frontend Vitest | **564 PASS / 57 files** | 0 failures, 0 pending/skipped |
| Frontend TypeScript / ESLint / build | Ba bước exit 0 | Không bỏ qua bước nào |
| AI locked install / pip check | exit 0 / “No broken requirements found.” | Không thay lock/environment khác |
| AI pytest | **887 PASS**, 17.42s | 0 / 0 / 0; 1 deprecation warning |
| Core Smoke local | **PASS**, exit 0 | Tất cả acceptance assertions nguyên trạng |
| Company, acceptance `integration` | **6 PASS**, 13.8s | 0 failed, 0 skipped |
| Recruiting, hai fresh-stack attempts | **Setup FAIL cả hai**; **E01–E10 NOT RUN** | 0 browser cases executed; không có results.json |
| Messaging | **10 PASS**, 29.0s | 0 failed, 0 skipped |
| npm full / omit-dev audits | Cả hai exit 1 do advisory findings | Ghi riêng; không gọi là lỗi Vitest/build |

Tổng distinct automated test cases thực thi đạt: **2148**, chưa cộng Core Smoke và không cộng lại fast 249 hoặc Company supplementary 6. Đây là số test cases, không phải tỷ lệ coverage hay chứng nhận mọi flow. Vitest JSON đếm 122 nested suites nhưng chỉ 57 files; không trình bày 122 thành file count.

Backend, từ `backend/`:

```powershell
$env:JAVA_HOME='C:/Users/haiho/.jdks/ms-21.0.11'
.\mvnw.cmd -version
.\mvnw.cmd -B -ntp test
.\mvnw.cmd -B -ntp clean verify
```

Frontend, từ `frontend/`:

```powershell
npm.cmd ci
npm.cmd run test:run -- --reporter=default --reporter=json --outputFile=../e2e/.local/w4b/frontend-vitest.json
& .\node_modules\.bin\tsc.cmd -b
npm.cmd run lint
npm.cmd run build
npm.cmd audit --json
npm.cmd audit --omit=dev --json
```

AI, từ `ai-service/`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --require-hashes --only-binary=:all: -r requirements.lock
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m pytest --junitxml=../e2e/.local/w4b/ai-junit.xml
```

AI warning: `StarletteDeprecationWarning` về `httpx` TestClient. Không thêm `httpx2`, không đổi dependency để làm mất warning. Evaluation-tool unit tests có chạy trong pytest; không chạy một academic evaluation dataset hoặc công bố relevance metrics.

E2E setup: `cd e2e; npm.cmd ci` đạt, 5 packages/0 audit findings. Chromium có sẵn; version được xác minh bằng browser headless riêng rồi đóng ngay. Các lệnh từ worktree root:

```powershell
# Mỗi runner được chạy trong process-local integration profile rồi khôi phục env cũ.
$taskOldProfile=$env:SPRING_PROFILES_ACTIVE
try {
    $env:SPRING_PROFILES_ACTIVE='integration'
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/run-company-verification-isolated-e2e.ps1 -JavaHome 'C:/Users/haiho/.jdks/ms-21.0.11'
} finally { $env:SPRING_PROFILES_ACTIVE=$taskOldProfile }

# Cùng wrapper env/finally ở trên, chạy từng invocation riêng:
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/run-recruiting-workflows-isolated-e2e.ps1 -JavaHome 'C:/Users/haiho/.jdks/ms-21.0.11'
# Lặp đúng invocation Recruiting một lần trên stack mới để tái hiện setup failure.
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/run-application-messaging-isolated-e2e.ps1 -JavaHome 'C:/Users/haiho/.jdks/ms-21.0.11'
```

Mỗi invocation thực tế redirect stdout/stderr vào `e2e/.local/w4b/{suite}.log` và lưu `$LASTEXITCODE`. Không chạy specs trực tiếp trên service sẵn có. Company first attempt không có env wrapper đạt 6/6 nhưng inherited `SPRING_PROFILES_ACTIVE=dev` làm bật seeder **chỉ trong database disposable mới**. Đã loại lượt này khỏi acceptance totals, kiểm cleanup, chạy lại runner nguyên trạng với profile integration; server log lần chấp nhận xác nhận đúng một profile `integration`. Full Backend tests cũng xác nhận chỉ integration/no-db profiles tương ứng.

## Core Smoke thật: local và CI đúng master

Đã inspect wrapper/child runner/Compose trước khi chạy. Child runner tạo UUID project, env/credentials mới, image tags và volumes riêng; PostgreSQL không publish host port; Backend/AI bind random loopback ports. Không có pre-start down hoặc orphan cleanup. `down --volumes` cuối lượt chỉ nhận đúng project/override do invocation tạo.

Checkout Windows có CRLF ở `backend/mvnw`. Để Linux Docker build dùng canonical Git content như CI, đã kiểm nội dung với `git show HEAD:backend/mvnw`, chuyển CRLF→LF tạm thời và khôi phục **nguyên byte ban đầu** bằng finally. Không sửa Dockerfile/wrapper đã commit hoặc test logic. Thao tác chính xác quanh smoke:

```powershell
$taskWrapper=Join-Path (Get-Location) 'backend/mvnw'
$taskOriginal=[IO.File]::ReadAllBytes($taskWrapper)
$taskCanonical=(& git show HEAD:backend/mvnw) -join "`n"
$taskNormalized=[Text.Encoding]::UTF8.GetString($taskOriginal).Replace("`r`n","`n")
if($taskNormalized.TrimEnd("`n") -ne $taskCanonical.TrimEnd("`n")){throw 'Wrapper differs from canonical content.'}
try {
    [IO.File]::WriteAllText($taskWrapper,$taskNormalized,[Text.UTF8Encoding]::new($false))
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-core.ps1 *> e2e/.local/w4b/core-local.log
    $taskExit=$LASTEXITCODE
} finally { [IO.File]::WriteAllBytes($taskWrapper,$taskOriginal) }
```

Local owned run: `core-smoke-9e84a22c51fe4f508c523f3e0434b8de`. Registration trả Company PENDING; Admin API xác minh; cả hai Jobs đi DRAFT→PENDING_APPROVAL→ACTIVE qua đúng actor. Ba forbidden mutations trả 403, mỗi Job có owner/deadline/public eligibility đúng. SQL xác nhận hai eligible Jobs, đúng successful V1–V25/checksums và Hibernate validate tại startup.

| Persisted tier | Strategy | rankingScore | textScore | skillScore | overallScore | global / tier rank |
|---|---|---:|---:|---:|---:|---|
| PRIMARY | SAME_LANGUAGE_HYBRID | 0.35000 | 0.00000 | 1.00000 | 0.35000 | 1 / 1 |
| FALLBACK | CROSS_LANGUAGE_SKILL_BASED | 1.00000 | null | 1.00000 | null | 2 / 1 |

Đúng **1 PRIMARY + 1 FALLBACK**, PRIMARY đứng trước dù score nhỏ hơn. PRIMARY kiểm `0.65*textScore + 0.35*skillScore` tại sai số NUMERIC(8,5), FALLBACK skill-only/null text/overall; hai SQL rows khớp API và persisted public read-back. AI logs: đúng **1 V3 request/1 V3 HTTP200/0 V2 substitution**. Một completed SUCCESS run, zero PROCESSING toàn bảng. Không mock AI/Backend response.

Giới hạn smoke: CV là persisted synthetic READY snapshot được seed; không upload/parse CV mới. PRIMARY textScore=0 hợp lệ với fixture này; các trường hợp textScore khác 0/ngôn ngữ khác được kiểm ở unit/contract tests, không suy từ riêng smoke. Không đồng nhất score với accuracy.

CI diagnostics riêng trên baseline cho cùng persisted values và tier/AI/run counts. CI PASS và local PASS là hai evidence records riêng trong matrix. CI log có cleanup marker; local cleanup JSON xác nhận 0 owned containers, 0 volumes, 0 networks, `clean=true`, và generated image tags được gỡ.

## Recruiting failure và browser evidence

Hai attempts không đổi source:

| Attempt | Owned run | Quan sát |
|---|---|---|
| 1 | `recruiting-workflows-c80547637b22492fa6ae2b1caaa144a9` | Apply 25 migrations thành công, current v25; sau đó `IllegalStateException: V24 validation failed`, line117; exit1 |
| 2 | `recruiting-workflows-299c8238be5740bf83546f4e8c9b341f` | Cùng assertion/cùng kết quả trên PostgreSQL mới; exit1 |

Không tạo fixture.json, không khởi động Vite/Playwright, không có browser results.json; E01–E10 đều **NOT RUN**. Backend `RecruitingWorkflowApiIT` 33 cases và `RecruitingWorkflowMigrationIT` 2 cases vẫn PASS, bao gồm state/ownership/concurrency và explicit populated V23→V24 migration. Không sửa migration hoặc đổi app xuống V24 để chạy fixture. Follow-up nên cập nhật strict latest-schema expectation của test fixture lên đúng V25, giữ nguyên intermediate migration tests và mọi E01–E10 assertions, rồi chạy lại suite; không thực hiện sửa trong evidence PR này.

Runner chỉ ghi cleanup.json sau khi fixture metadata tồn tại, vì vậy **hai failed setup attempts không có cleanup.json**. Không diễn giải việc thiếu file là cleanup PASS. Kiểm tra độc lập sau JVM exit: từng owned container ID lấy từ startup log đều vắng mặt; từng fixture JVM đã thoát; không có Vite được tạo; không còn directory prefix `sjrs-recruiting-e2e-*` trong temp root. Global inventory sau tất cả suites không có container/volume mới còn lại. Đây là bằng chứng cleanup độc lập, đồng thời là khoảng trống observability của runner khi thất bại trước readiness.

Company acceptance run `company-verification-4c56e18e091440c0a42fc5c7610d3eb7`: B3-01…06 PASS với real Backend/PostgreSQL/Vite, revision409, multipart PDF/PNG, byte-exact private download, replacement cleanup và role/metadata isolation. Chỉ image-request fallback được điều khiển theo spec; không mock Backend API. `cleanup.json` đủ bốn true: PostgreSQL stopped, JVM stopped, Vite stopped, storage removed. Supplementary inherited-dev run cũng cleanup đủ bốn true.

Messaging run `application-messaging-7d073c0e53d146d0966ccd59474d15cd`: M01…M10 PASS; real JWT/login/UI/HTTP, persisted participants, scoped pagination, Unicode send/reply, incoming-only read/idempotence, terminal histories, denied Admin/foreign access và validation. M09 dùng Chromium offline thật: attempt đó không commit, draft còn, automatic retries=0, manual refresh/confirmation/resend commit đúng một lần. **Không kiểm after-commit response loss hoặc exactly-once delivery.** M10 dùng real PostgreSQL table lock: waiting query confirmed, 1 pending request trước logout, 1 request bị hủy, draft cũ biến mất và UI chỉ còn account mới. Không fulfil/mock JWT/Backend/SQL response.

## Integration risk matrix

Định nghĩa PASS ở đây chỉ áp dụng cho phần validation ghi trong dòng đó; không có nghĩa mọi flow, browser hoặc môi trường đã covered. Matrix JSON có contract, test names/counts, actual validation, limitations, evidence locations và phân loại lịch sử cho từng dòng.

| ID | Miền | Actual validation trên baseline | Trạng thái / giới hạn chính |
|---|---|---|---|
| R01 | Auth/RBAC | Full Backend + Company B3-06 + Messaging M08/login | PASS; không phải pentest; recovery excluded |
| R02 | Company verification/Job moderation | JobModeration9, private-doc30, real Core Smoke và Company Admin UI | PASS; không rerun trọn Admin browser moderation journey |
| R03 | Profiles/concurrency | Student atomic18, settings races33, Company cover33/doc30, stale browser409 | PASS; Student full profile browser suite chưa rerun |
| R04 | CV upload/active/analysis | CV API14, active transaction1, analysis API15/reanalysis6 + AI parser tests | PASS cho các boundary đã test; chưa chạy fresh-upload→real-AI→recommendation journey |
| R05 | Student Recommendation V3 | Real smoke local/CI, SQL scores/ranks, AI-counts và V3 contracts | PASS; không suy luận academic relevance quality |
| R06 | Company Ranking V3 | Backend corpus4/orchestration15/persistence15/public31 + AI V3 tests | PASS cho test boundaries; IT có AI doubles; real cross-service ranking E2E NOT RUN |
| R07 | Applications/saved candidates | Application21/lifecycle6/reapply2/saved-candidate26, Messaging history checks | PASS; không full browser apply/bookmark rerun |
| R08 | Notifications | Automatic13/list5/settings9/settings concurrency33 + Frontend tests | PASS; dedicated notification browser suite NOT RUN |
| R09 | Interviews/Invitations | Backend33+2 PASS; browser setup fail tái hiện hai lần | **NOT RUN E01–E10**; V24 fixture incompatible V25 |
| R10 | Application messages | Backend15+2; real browser M01–M10; independent SQL | PASS; no after-commit loss/idempotency guarantee |
| R11 | Private storage/download | Company real bytes/replacement/roles + Backend CV/private path/failure tests | PASS; production ACL/crash reconciliation NOT RUN |
| R12 | Session switching/late requests | Vitest + Messaging real SQL-lock/offline/cancellation | PASS phạm vi Messaging; Recruiting E09 và multi-browser stress chưa chứng minh |
| R13 | PostgreSQL/data preservation | V1–V25, Hibernate validate, populated upgrade snapshots, protected row fingerprints | PASS disposable DB; không hash demo hoặc rehearsal backup/restore |
| R14 | Dependency security | npm audit full + omit-dev, current lockfile | **FAIL release gate**; chưa triage/remediate high findings |

Tổng matrix: **12 PASS / 1 NOT RUN / 1 FAIL**. R09 có Backend evidence đạt nhưng integrated browser validation chưa thực hiện. R14 là phát hiện bổ sung từ install thực tế, không phải một production fix trong PR này.

## Data integrity và security findings

Mọi DB được regression truy vấn là PostgreSQL17 disposable do Testcontainers hoặc owned Compose runner tạo. Browser runners chỉ nối datasource của container vừa tạo; Vite chỉ proxy Backend loopback riêng. Core runner không đọc demo .env/credentials. Các mock AI ở Backend IT được phân biệt với smoke gọi FastAPI thật; AI unit tests dùng test client.

Messaging kiểm full-row SHA-256/count của các protected tables so với snapshot ban đầu trong mỗi SQL validation:

| Table | Ban đầu | Cuối | Kết quả |
|---|---:|---:|---|
| applications | 108 | 108 | Fingerprint không đổi |
| jobs | 108 | 108 | Fingerprint không đổi |
| cv_files | 1 | 1 | Fingerprint không đổi |
| interviews | 1 | 1 | Fingerprint không đổi |
| job_invitations | 1 | 1 | Fingerprint không đổi |
| conversations | 106 | 108 | Hai conversations đúng hành động scenario |
| messages | 26 | 31 | Năm sends thành công được xác nhận |

Tuple/sender/last-message mismatch counts đều **0**. Application fingerprint cuối = đầu: `dcd98f53b436380b63d9dfa3de2de6ece600c861d2778f4486d9d711eb9415df`. Flyway checksums giữ nguyên V1–V25. Backend populated V24→V25 migration test kiểm snapshots không đổi của users/students/companies/jobs/CVs/applications/interviews/invitations; V23→V24 và các intermediate/backfill tests vẫn chạy đúng target riêng.

Dependency audit trên lockfile không đổi:

| Graph | Moderate | High | Critical | Tổng affected package entries |
|---|---:|---:|---:|---:|
| Full | 13 | 11 | 0 | 24 |
| `--omit=dev` | 3 | 8 | 0 | 11 |

Đây là số package entries, không phải số advisory độc lập. Installed direct packages liên quan gồm axios1.18.1, zod4.4.3, react-router-dom6.30.4; audit graph còn chứa build/transitive packages như Vite/PostCSS, nên “omit-dev” không đồng nghĩa mọi finding nằm trong browser bundle hoặc có đường khai thác. Matrix lưu version/severity/advisory URLs và trạng thái chưa kiểm reachability. Ví dụ primary advisory records: [Axios fetch adapter gadget](https://github.com/advisories/GHSA-vh66-26gq-q6x8), [Zod constrained collections](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), [React Router DOM redirect/XSS](https://github.com/advisories/GHSA-jjmj-jmhj-qwj2). Không chạy `npm audit fix`, không upgrade packages hoặc thay lockfile. Chưa chạy vulnerability scanner riêng cho Java/Python/images; không gọi npm audit là security audit toàn hệ thống.

Chỉ đưa whitelisted summaries vào hai tài liệu: counts/status, synthetic IDs, fingerprints, score rows, protocol method/path/status và public advisory metadata. Không copy credentials, JWT/headers/keys, password hashes, private message bodies, CV text, raw SQL replies hoặc storage metadata từ fixture vào artifact đã commit. Raw runtime logs, credentials, generated files, browser artifacts và local helper đều ở ignored paths; không upload artifacts nhạy cảm lên PR. Traces/videos của dedicated browser suites tắt. Kiểm diff và pattern scan của staged content trước commit; không coi scan này là chứng minh tuyệt đối không có mọi loại bí mật.

## Cleanup và giới hạn còn lại

Core cleanup JSON: remaining containers/volumes/networks đều 0, clean=true; owned image tags đã gỡ. Company acceptance/supplementary cleanup đủ bốn true. Messaging cleanup đủ sáu checks true: PostgreSQL/JVM/Vite stopped, private storage removed, scratch removed, owned build link condition satisfied; không bật KeepE2EStack hay CleanupProbe trong lượt này. Full Backend Testcontainers/Ryuk cũng vắng mặt sau suite. Recruiting cleanup được kiểm độc lập như trên, không giả định tồn tại cleanup.json.

Inventory cuối so với snapshot sau Docker startup: cả **4 containers có sẵn** (3 demo running + 1 stopped) giữ nguyên ID/image/StartedAt/state; cả **3 volumes có sẵn** còn nguyên tập tên. Không có container/volume mới còn lại; không có owned JVM/Vite hoặc matching Recruiting temp directory còn lại. 13 pre-existing process PID/name records vẫn tồn tại, gồm các Windows PostgreSQL processes. Không blanket process termination, Docker prune, unknown-project down, cleanup demo volumes hoặc shutdown máy. Root status vẫn đúng bốn dòng có sẵn. Chỉ khôi phục buildinfo do lượt build này sinh trong worktree mới; không khôi phục file ở workspace gốc.

Không có demo DB content hash trước/sau: daemon ban đầu tắt, startup tự phục hồi demo containers; không truy vấn DB demo để lấy hash. Vì vậy chỉ chứng minh không gửi regression mutations tới demo và bảo toàn resource metadata **sau startup**, không claim nội dung demo bất biến qua các tác động tự chạy của ứng dụng.

Các phần **NOT RUN/chưa chứng minh**, ngoài Recruiting, gồm fresh-upload real parsing/scoring journey; real Company Ranking cross-service E2E; dedicated Notifications/Student profile/apply browser suites; Firefox/WebKit/mobile/multi-timezone/load/stress; after-commit message response loss; production ACL/deployment/backup/restore/rollback; vulnerability reachability; human-labeled recommendation quality. Backend API tests, AI tests hoặc một smoke PASS không thay thế các phần này.

Điều kiện xem xét lại release: PR riêng sửa strict Recruiting harness compatibility/early-failure cleanup observability và rerun E01–E10 trên V25; PR riêng triage/fix dependency findings với lockfile/test evidence. Không merge evidence PR này tự động, không tuyên bố production-ready hoặc không còn regression. Các suites đã chạy không phát hiện product failure; khoảng trống browser và security gate vẫn chặn quyết định READY.

Sau review/merge thành công và xử lý blocker, Wave5 là đánh giá độc lập Student Recommendation V3 bằng human-labeled relevance judgments và Precision@K, Recall@K, F1@K, có thể thêm NDCG@K. Lượt W4-B này không có labeled evaluation experiment và không công bố các metrics đó.
