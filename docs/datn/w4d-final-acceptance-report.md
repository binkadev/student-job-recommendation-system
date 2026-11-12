# W4-D — Final Integrated Acceptance & Demo Readiness

Ngày thực thi: **2026-11-12, Asia/Bangkok (UTC+07)**. Repository: `binkadev/student-job-recommendation-system`.

**A. DEMO/UAT: READY WITH LIMITATIONS. B. PRODUCTION DEPLOYMENT: NOT VERIFIED.** Combined master đạt 564 Frontend tests, zero audit findings, 26 real browser cases và Core Smoke V3. Hai journey fresh CV upload→Student Recommendation và Company Candidate Ranking chưa được chạy trên baseline này vì runner cũ chưa đáp ứng isolation; chưa có người thực hiện manual UAT. Do đó không cam kết demo trọn vẹn hai journey AI này trước khi tổng duyệt trên môi trường UAT được phép. Bằng chứng dưới đây cho phép chuẩn bị demo có giới hạn, không phải xác nhận triển khai production, penetration test hay chứng nhận bảo mật.

Đây là **đánh giá mới trên baseline mới**, không sửa/merge hay thay thế âm thầm [Draft PR #96](https://github.com/binkadev/student-job-recommendation-system/pull/96). Báo cáo/matrix W4-B giữ nguyên kết luận **NOT READY trên master 1158dd7a**. Hai blocker cũ đã có repair merge riêng, rồi được kiểm lại trong phạm vi ghi rõ dưới đây; không chuyển PASS lịch sử thành lượt test mới.

## Baseline, source of truth và môi trường

| Mục | Quan sát |
|---|---|
| Remote master, trước worktree và sau các suite | `58a494806bc63fadb3bc904bb6f05294839fea32`, khớp yêu cầu |
| PR #97 | MERGED, merge `947ad0d5cc925061b9d5b04e7250f5a8e56b75d2`; Recruiting V25 repair |
| PR #98 | MERGED, merge chính là baseline W4-D; final head `8515c55a98c81b6f597bde180c3b3bca9229d67e` |
| Branch / worktree | `test/datn-w4d-final-acceptance` / `.worktrees/datn-w4d-final-acceptance` |
| Root workspace | Vẫn local `master@1158dd7a`; giữ `M frontend/tsconfig.app.tsbuildinfo`, `?? .agents/`, `?? .worktrees/`, `?? skills-lock.json`; không switch/reset/stash/prune worktree khác |
| Latest Flyway | `V25__application_messaging.sql`; 25 versioned migration files V1–V25; tất cả SHA-256 trước/sau không đổi |
| OS / shell | Windows / Windows PowerShell 5.1 |
| Java thực chạy fixtures / Maven | Microsoft OpenJDK **21.0.11** / Maven wrapper **3.9.16**; JAVA_HOME `C:\Users\haiho\.jdks\ms-21.0.11` |
| Node / npm | **24.18.1 / 11.16.0** |
| PostgreSQL browser fixtures | **17.11**, image `postgres:17-alpine`; Core Smoke xác nhận SQL major **17**, image `postgres:17` |
| Docker Engine / Compose | **29.8.2 / 5.6.0**, Linux containers |
| Browser tooling | Playwright **1.56.1**, Chromium **141.0.7390.37**, headless, một worker, zero retries |
| Python host dùng tổng hợp evidence | **3.11.9**; không có local AI pytest/venv rerun |

Core Smoke build/runtime dùng Java 21 và Python 3.11.9 theo Dockerfiles không đổi; không thu riêng patch/runtime package inventory bên trong container đã dọn. Không lấy phiên bản host làm phiên bản quan sát trong AI container.

Đã đọc AGENTS, CODEX_GUARDRAILS, W4-B report/matrix tại head #96 `67c34a81fa1feefdd0a5c0ee0cdf96f99664f4be`, tài liệu/runner/config/spec/fixture ba isolated suites, W4-C2 security report, workflows, V3 contract, API/security/domain/schema contracts liên quan V23–V25 và Compose/Dockerfiles. Chỗ tài liệu cũ còn ghi Core Smoke broken hoặc Backend-only được phân xử bằng executable source và evidence mới; không sửa lịch sử. Source Backend, AI, Core Smoke scripts/Compose không khác merge #97. Frontend Git tree đúng bản đã merge #98: `a507440970bbe75502a06e7a53273d67fc426f4b`.

Commands preflight từ root, trước khi tạo worktree:

```powershell
git status --short
git worktree list --porcelain
git ls-remote origin refs/heads/master
gh pr view 97 --json state,mergeCommit,headRefOid,url
gh pr view 98 --json state,mergeCommit,headRefOid,url
gh pr view 96 --json state,isDraft,headRefOid,url
git fetch origin master
git worktree add -b test/datn-w4d-final-acceptance .worktrees/datn-w4d-final-acceptance origin/master
```

## CI: đúng commit nào, không suy rộng

`gh run list --commit <SHA> --json databaseId,name,event,status,conclusion,headSha,url` và `gh run view <ID> --json headSha,event,status,conclusion,jobs,url` được kiểm tra. Không dispatch/rerun job, bỏ required check hoặc coi PENDING là PASS.

| Workflow / phạm vi | SHA | Kết quả thực tế / link |
|---|---|---|
| Frontend CI, post-merge master (**CI_EXACT_MASTER**) | `58a494806bc63fadb3bc904bb6f05294839fea32` | completed / **SUCCESS**, [43170108527](https://github.com/binkadev/student-job-recommendation-system/actions/runs/43170108527) |
| Frontend CI, final head PR #98 (**CI_OTHER_COMMIT**) | `8515c55a98c81b6f597bde180c3b3bca9229d67e` | completed / **SUCCESS**, [43162805308](https://github.com/binkadev/student-job-recommendation-system/actions/runs/43162805308) |
| Backend CI, merged PR #97 baseline (**CI_OTHER_COMMIT**) | `947ad0d5cc925061b9d5b04e7250f5a8e56b75d2` | completed / **SUCCESS**, [43158347494](https://github.com/binkadev/student-job-recommendation-system/actions/runs/43158347494) |
| Core Smoke CI, merged PR #97 baseline (**CI_OTHER_COMMIT**) | `947ad0d5cc925061b9d5b04e7250f5a8e56b75d2` | completed / **SUCCESS**, [43158347384](https://github.com/binkadev/student-job-recommendation-system/actions/runs/43158347384) |
| Pages deployment, current master | `58a494806bc63fadb3bc904bb6f05294839fea32` | SUCCESS [43170107638](https://github.com/binkadev/student-job-recommendation-system/actions/runs/43170107638); không chứng minh production Backend/DB/AI |

Không có Backend/Core Smoke/AI CI run trên chính SHA W4-D do path filters; không gọi evidence #97 là CI trên current master. Core Smoke được thực thi lại local trên baseline W4-D bên dưới. Backend/AI production source không đổi giữa hai merge, nhưng full Backend/JUnit và AI pytest không được chạy lại ở W4-D. Maven **test-compile** của cả ba dedicated fixtures đều BUILD SUCCESS, không được đếm là JUnit test execution.

## Frontend acceptance và Router 7

Thực chạy từ `frontend/`, dependency install mới trong worktree, không dùng shared node_modules junction:

```powershell
npm.cmd ci
npm.cmd run test:run -- --reporter=default --reporter=json --outputFile=../e2e/.local/w4d/frontend-tests.json
npx.cmd tsc -b
npm.cmd run lint
npm.cmd run build
npm.cmd audit --json
npm.cmd audit --omit=dev --json
```

| Check | Actual W4-D |
|---|---|
| Fresh locked install | PASS, exit 0, lockfile không đổi |
| Vitest | **564 PASS / 57 files, 0 FAIL, 0 SKIP**; 24.03s; khớp số lượng W4-C2 lịch sử nhưng là execution mới |
| TypeScript / ESLint / production build | **PASS / PASS / PASS**, tất cả exit 0 |
| Full audit | **0 critical, 0 high, 0 moderate, 0 low, 0 info**, exit 0 |
| Omit-dev audit | **0** mọi severity, exit 0 |

Không thay dependency hoặc lock: React/DOM 18.3.1, Router/core+DOM **7.18.5**, Axios **1.20.0**, Zod **4.6.6**, Vite **6.4.6**, PostCSS **8.5.23**, Vitest **4.1.12**. Giữ scoped override `@typescript-eslint/typescript-estree > minimatch = 11.0.8`; branch minimatch 3.1.5 của ESLint giữ nguyên. Đây là override vượt major của dependency gián tiếp, cần xem lại khi upstream hỗ trợ bản vá; audit sạch không chứng minh hệ thống không có lỗ hổng.

Router 7 vẫn có giới hạn/risks đã phân tích trong [W4-C2](w4c2-frontend-dependency-security.md): Node ≥20/React ≥18, SPA không SSR/RSC, thay đổi transition scheduling. W4-D không chạy lại riêng parser/security probes W4-C2 và không nhận chúng là evidence mới. Ba timing repairs đã merge được kiểm qua suite mới: `CandidateProfilePersistence` **37**, `RecruiterCandidateEvaluation` **4**, `RecruiterCompanyProfile` **64** tests nằm trong tổng 564, không cộng thêm lần nữa.

| Router/phiên | Validation mới | Giới hạn |
|---|---|---|
| Candidate / recruiter routes, deep links, reload/pagination | Recruiting E01–E10 và Messaging M01–M10 chạy browser thật trên Router 7; route suites messaging/recruiting 8+8 tests cũng nằm trong 564 | Không chứng minh mọi route/page của hai role |
| Admin / role guards / redirects | Company B3-05 login và thao tác Admin UI, B3-06 role boundaries; AuthProvider 3, RouteContent 2, HTTP client 7 tests trong full suite; source guards dùng login/403 redirect và keyed session outlet | Không có full browser crawl mọi Admin page, fresh registration manual chưa thực hiện |
| Logout / switching / late responses | E09 và M10 dùng real SQL table lock, mỗi case xác nhận một pending request và một cancellation; current account only | Không phải stress/load test hoặc kiểm thử mọi cross-tab/network timing |

## Runner safety trước khi chạy

Mọi heavyweight suite chạy **tuần tự**: Frontend acceptance → Recruiting → Messaging → Company Verification → Core Smoke. Không chạy hai Docker/PostgreSQL suites cạnh tranh. Không dùng demo URL 8080/8000/55432, demo credentials, docker prune, blanket process termination hay cleanup default Compose project.

| Runner | Project/ports/storage và cleanup đã inspect | Quyết định |
|---|---|---|
| Recruiting isolated | PostgreSQL17 Testcontainers, UUID label/ownership trước readiness; Backend/Vite random loopback, strictPort; JVM/Vite object riêng; Java sở hữu temp storage/container; cleanup query cả container stopped | RUN |
| Messaging isolated | PostgreSQL17 mới, ownership container ID; random loopback; scratch prefix/path containment; chỉ stop exact owned container, delete đúng scratch/junction do run tạo | RUN; kiểm thêm owned container **absence**, không chỉ stopped |
| Company isolated | PostgreSQL17 mới, random loopback, private-doc root OS-temp duy nhất; Java try-with-resources/finally; process PID do runner tạo | RUN; kiểm thêm absence/storage sau success. Early-readiness observability của runner cũ còn hạn chế, không có early-failure probe W4-D |
| `smoke-core.ps1` → recommendation runner | UUID project, random secrets/env-file, private images/volumes/network, random loopback ports; admission check; cleanup chỉ project và hai image tag của UUID | RUN |
| Student fresh-upload runner | Fixed `student-recommendation-upload-e2e`, ports 15432/18000/18080 qua e2e override; named-volume interpolation; có guard project labels nhưng build vẫn ghi shared `student-job-recommendation-backend:local` / `...-ai:local` đang dùng bởi manual stack; không có override parameter tách image/ports | **NOT RUN**: chưa fully isolated. Guard project không làm shared image tags thành tài nguyên owned |
| Candidate Ranking runner | Fixed `candidate-ranking-real-e2e`, cùng ports/named volumes/shared image tags; gọi `down --volumes --remove-orphans` **trước** startup, không admission/ownership check | **NOT RUN**: reject destructive fixed-project cleanup; không sửa runner hay production để lách isolation |

Không chuyển fixed runner sang demo DB hoặc thêm framework/endpoint khác để bù coverage. Nhận xét an toàn hai runner cuối là static inspection, không phải product failure được tái hiện. Không chạy chúng rồi ghi SKIP; chúng chưa được execute.

## Real browser E2E trên combined master

Prerequisite E2E: từ `e2e/`, `npm.cmd ci` theo lockfile không đổi; `node.exe node_modules/playwright/cli.js --version` xác nhận 1.56.1. Mỗi command dưới đây dùng runner dedicated nguyên trạng, từ worktree root, Java21 thực:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/run-recruiting-workflows-isolated-e2e.ps1 -JavaHome 'C:/Users/haiho/.jdks/ms-21.0.11'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/run-application-messaging-isolated-e2e.ps1 -JavaHome 'C:/Users/haiho/.jdks/ms-21.0.11'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/run-company-verification-isolated-e2e.ps1 -JavaHome 'C:/Users/haiho/.jdks/ms-21.0.11'
```

Các runner đều biên dịch fixture (không chạy JUnit):

```powershell
# Từ backend/, thay <suite> bằng recruiting-workflows / application-messaging / company-verification
.\mvnw.cmd -B -ntp test-compile org.apache.maven.plugins:maven-dependency-plugin:3.8.1:build-classpath '-Dmdep.outputFile=target/<suite>-browser-classpath.txt'
```

| Suite | Actual | Browser time | Owned run directory, dưới ignored `e2e/.local/` |
|---|---|---|---|
| Recruiting E01–E10 | **10 PASS, 0 FAIL/SKIP/retry**, runner exit 0 | 29.75s | `recruiting-workflows-7c9df6ab1fcd4ff0b09025d26798a285` |
| Messaging M01–M10 | **10 PASS, 0 FAIL/SKIP/retry**, runner exit 0 | 30.81s | `application-messaging-d54f86f309c44112831e509aeff6ae11` |
| Company B3-01–B3-06 | **6 PASS, 0 FAIL/SKIP/retry**, runner exit 0 | 16.24s | `company-verification-6a34366036df4ea080b35789b6ff7d95` |

Tổng **26/26 real browser cases**, một execution/suite, một worker, mọi case có đúng một attempt. Không retry, skip, đổi assertion, mock Backend/JWT/DB/API, nới timeout hay sửa production. Company suite chỉ kiểm soát các image media requests để thử fallback; API upload/download vẫn thật. Không nhầm 26 cases với manual UAT.

| Cases | Evidence được thực thi lại |
|---|---|
| E01–E03 | Company tạo ONLINE interview, Student SCHEDULED→CONFIRMED; huỷ lịch riêng; hoàn tất CONFIRMED lịch sử đã qua duration; SQL và reload khớp; terminal400 |
| E04–E06 | Applicant/saved-candidate launchers tạo owned invitations; Student ACCEPTED/DECLINED, persisted reload; không tạo/đổi Application |
| E07–E08 | Duplicate PENDING409 INVITATION_ALREADY_PENDING; stale expectedStatus409 RECRUITMENT_STATE_CONFLICT; giữ draft/status, không retry, reload thủ công |
| E09–E10 | Ownership/RBAC401/403; logout cancel real waiting SQL query; second Company only; deep page2, reload, unknown/foreign details và real403 không giả empty success |
| M01–M02 | Conversation creation/reuse theo đúng Application, một tuple/row, owned lists và UI navigation |
| M03–M05 | Student gửi, Company nhận/refresh và reply; SQL identity/order/content; recipient-only explicit mark-read idempotent, không mark outbound hoặc later incoming |
| M06–M08 | REJECTED/WITHDRAWN history tách riêng, page2 metadata và message pages/latest, deep links; actual401/403/404/400 cho wrong role/foreign/spoofing/invalid content |
| M09 | Chromium offline POST thật; SQL chứng minh chưa commit, giữ draft, không auto-retry; manual refresh rồi resend có chủ ý |
| M10 | Real messages-table lock, waiting query được xác nhận, logout cancel một request; Student mới không thấy draft/content người trước |
| B3-01–B3-03 | Company profile If-Match/reload/media fallback; PDF upload và authenticated byte-exact download; PNG replacement byte-exact và xoá file cũ |
| B3-04–B3-06 | Stale upload409 giữ lựa chọn; explicit reload/current ETag; Admin private download và verify; role/owner boundary, không lộ private metadata ở public/listing |

Messaging M09 chỉ bao phủ offline attempt **chưa commit**. Không có post-commit response-loss coverage, idempotency key hay chứng minh exactly-once delivery. GET history không mark-read, không có websocket/realtime guarantee. Network observer có thể ghi transport-failed cho intentional logout/navigation/offline; không đếm chúng thành product HTTP failure hoặc che một case thất bại.

## Migration, persistence và history integrity

Recruiting `validation.json`: PostgreSQL major17, đúng thứ tự **1…25**, current25, successfulVersionedMigrations25, Flyway checksums validated, Hibernate schema validation true. Messaging kiểm cùng danh sách/checksums/Flyway validation và mở EntityManagerFactory với ddl-auto=validate; mọi SQL snapshot giữ nguyên checksum list. Company startup log xác nhận PostgreSQL17.11, applied25 migrations và Hibernate initialization dưới integration config `ddl-auto: validate`; fixture Company không có independent SQL checksum-summary riêng như hai suite còn lại, không suy rộng rằng có.

Recruiting Application full-row fingerprint giữ **2 → 2** qua **10 matching SQL snapshots**: `b87c61953734d3c6b48a469b0c070cb3e79b74d09f763ac8b5123c603d46c3da`. Initial fixture: 5 Users, 2 Companies, 2 Students, 6 Jobs, 1 SavedCandidate. Interview/Invitation mutations là các transition chủ đích; Application history không reset hoặc viết lại. Không claim full-row fingerprint preservation cho mọi bảng trong Recruiting.

Messaging có **22 matching protected-business SQL snapshots** (không tính initial). Bảng dưới giữ count và full-row SHA-256 initial=final:

| Bảng | Initial → final | SHA-256 (disposable DB only) |
|---|---|---|
| `applications` | 108 → 108 | `6278fe95f5a78b52c62acbe938d6eb6558388f9e0e93081d601bf9107622a679` |
| `jobs` | 108 → 108 | `d89fc5d161b3b3ea33b5ea39dcaf8229faf026f29793643cbc27687fcd2f2501` |
| `cv_files` | 1 → 1 | `8408dc6dbc0be5747e6eeebe5716e0fccf03678998540a715cad1a0a190c06b7` |
| `interviews` | 1 → 1 | `c436d5503eb5921fe6a8527c137dd9988a140be04b8c4de0bf9eede8d5ae7a73` |
| `job_invitations` | 1 → 1 | `856e5b5bd117649c9b1bfd6fbfa59f451dc0dd2b60563cd763a319e82ceda1ce` |

Conversations **106 → 108**, messages **26 → 31**, đúng các tạo/gửi đã xác nhận. Conversation tuple mismatch, sender mismatch và last-message mismatch đều **0**. Các hash chỉ thuộc disposable fixture, không hash/query demo DB.

## Recommendation: Core Smoke PASS, hai journey NOT RUN

Command từ worktree root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-core.ps1
```

Lần đầu UUID `core-smoke-999eb3a699d74c76b5530cc066afd897` **SETUP FAIL**, exit1 trước API/scenario: Linux Docker build tại `RUN chmod +x mvnw && ./mvnw ... dependency:go-offline` báo `/bin/sh: ./mvnw: not found`/exit127. Chứng minh `git ls-files --eol backend/mvnw` là **i/lf, w/crlf**; byte CRLF-normalized bằng đúng `git show HEAD:backend/mvnw`. Đây là lỗi checkout/environment, không phải assertion product. Giữ ignored log lỗi và cleanup; không đổi Dockerfile hoặc wrapper đã commit.

Lượt thứ hai dùng byte canonical Git LF trong lúc Docker build rồi **khôi phục nguyên byte checkout ban đầu trong finally**. Không có thay đổi semantic/contract/test. Thao tác chính xác:

```powershell
$taskWrapperPath = Join-Path (Get-Location) 'backend/mvnw'
$taskWrapperOriginal = [IO.File]::ReadAllBytes($taskWrapperPath)
try {
    python -c "import pathlib,subprocess; p=pathlib.Path('backend/mvnw'); original=p.read_bytes(); canonical=subprocess.check_output(['git','show','HEAD:backend/mvnw']); assert original.replace(b'\r\n',b'\n') == canonical; p.write_bytes(canonical)"
    if ($LASTEXITCODE -ne 0) { throw 'Canonical wrapper check failed' }
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-core.ps1
    $taskSmokeExit = $LASTEXITCODE
} finally { [IO.File]::WriteAllBytes($taskWrapperPath, $taskWrapperOriginal) }
```

Owned run `core-smoke-4a05841f64f246809b5b02e2e682a6dd`: **PASS, exit0**. Exact 1 PRIMARY + 1 FALLBACK; PRIMARY `text=0`, `skill=1`, `overall=ranking=0.35` đúng `0.65*0 + 0.35*1`; FALLBACK `skill=ranking=1`, text/overall null, vẫn đứng thứ2 sau PRIMARY. SQL rows/ranks/scores và public read-back khớp. **Một V3 AI HTTP request thành công, zero V2 substitution, zero PROCESSING**; một SUCCESS run/hai persisted results. PostgreSQL SQL major17, versions1–25. Company đăng ký PENDING, Admin xác minh, Job review qua API hợp lệ; forbidden self-verification/self-publish403 được thử thật. Không dùng old invalid moderation fixture.

**Giới hạn quan trọng:** Core Smoke seed CV snapshot READY tổng hợp rồi gọi public Backend API tới AI thật; không chạy qua React recommendation UI, không upload/parse PDF/DOCX và không chứng minh fresh-upload journey. Runner upload cũ và Company Candidate Ranking cũ đều **NOT RUN** theo safety audit phía trên; không giữ PASS lịch sử của chúng trên baseline này. Không có newly executed Company V3 ranking trên owned Application corpus. Các luồng này nằm trong S04–S08/C06 của [manual checklist](w4d-manual-uat-checklist.md), hiện NOT TESTED. Không sửa TF-IDF/cosine, weights, threshold, order hoặc AI code để làm evidence xanh.

## Cleanup, dữ liệu và privacy

| Suite / attempt | Runner evidence | Kiểm tra bổ sung |
|---|---|---|
| Recruiting | status CLEAN, clean=true, reason COMPLETED; ownership/docker verified=true; PostgreSQL removed/stopped, JVM/Vite stopped, temp storage removed; forcedJvmStop=false, errors=[] | `docker ps -a --filter id=<owned-id>` không còn container; owned temp path không tồn tại |
| Messaging | PostgreSQL/JVM/Vite stopped; temp storage/scratch/build-link cleanup flags=true; cleanupProbe=false | Independent owned container absence và owned storage absence; backend target có sẵn từ Recruiting được giữ, không phải junction do Messaging tạo |
| Company | PostgreSQL/JVM/Vite stopped, private temporary storage removed: tất cả true | Independent owned container absence và owned storage absence |
| Core Smoke lần CRLF fail | clean=true, remaining containers/volumes/networks=0 | Chỉ owned UUID image tag được xóa; chưa có API execution |
| Core Smoke lần PASS | clean=true, remaining containers/volumes/networks=0 | Owned Backend/AI image tags removed; random env restored trong finally |

Inventory trước/sau: **4/4 pre-existing containers** giữ nguyên ID/name/image/StartedAt/state (3 running manual/demo services và 1 stopped Testcontainer có sẵn từ trước); **3/3 volumes** giữ nguyên tên; **13/13 pre-existing PID/name/CreationDate** còn nguyên; **0 new containers** còn lại. Không restart Docker daemon hoặc stop unrelated process. Không gửi API/SQL tới demo stack, không reset/hash demo content; không claim demo content fingerprint verification. Tất cả 25 migration-file hashes không đổi.


Sau khi tổng hợp whitelist evidence, đã xoá **49 file thuộc đúng các run W4-D**, gồm 3 credential `fixture.json`, 2 owned `stack.env`, raw SQL reply/scenario-state chứa nội dung tổng hợp và PNG input tổng hợp. Chỉ unlink file có absolute parent nằm trong đúng run UUID dưới worktree `e2e/.local`, không recursive delete, không chạm worktree/evidence lịch sử khác. Random JWT chỉ sống trong các Backend/browser đã đóng; credential fixtures/env secrets không còn. Sanitized result/count/fingerprint/cleanup diagnostics được giữ. Browser traces/videos tắt; browser artifacts/logs còn lại chỉ ở ignored local directories, không attach PR.

Không commit raw audit, test credentials, JWT, password/hash, message body, raw CV text, private storage path hoặc real PII. Báo cáo/matrix chỉ chứa status/count/synthetic-record fingerprint và relative evidence names. Secret-shape scan cùng diff review thực hiện trước commit. Generated Frontend `tsconfig.*.tsbuildinfo`/`vite.config.js` đã khôi phục chỉ trong worktree mới; wrapper có lại byte CRLF ban đầu. Không sửa production Backend/Frontend/AI/Auth, dependency, workflows hay V1–V25.

## Traceability và phạm vi chưa được kiểm

- [Machine-readable final matrix](w4d-final-status-matrix.json) chứa baseline, từng E01–E10/M01–M10/B3 case và attempt/retry counts, exact-commit CI, migration/integrity/cleanup và các NOT RUN. Đây là whitelist evidence, không phải raw npm/Playwright output.
- [Manual UAT checklist](w4d-manual-uat-checklist.md): mỗi bước có role/prerequisite, UI action, expected result, API/DB evidence, NOT TESTED và gợi ý ảnh. Không có human PASS trong W4-D.
- Ignored Frontend diagnostics: `e2e/.local/w4d/frontend-{install,tests,types,lint,build}.*`, `audit.json`, `audit-prod.json`, `frontend-checks.json`. E2E `results.json`, `evidence.json`, validation/SQL-integrity/session summaries và `cleanup.json` ở các run directory đã ghi; credential/raw reply files được dọn sau khi lưu whitelist summary. Core log lỗi/PASS tách riêng `core-smoke-run.log` và `core-smoke-lf-run.log`; từng UUID có own diagnostics/cleanup.
- Full Backend regression và AI pytest: **NOT RERUN ở W4-D**. CI #97 và W4-B unit/integration/AI evidence là lịch sử theo đúng SHA của chúng, không tính vào execution W4-D. Không có benchmark/stress, exhaustive race/security/route coverage, fresh PDF/DOCX analysis or Company V3 ranking journey trong execution mới.
- Zero audit là một tín hiệu dated registry; không chứng minh browser exploitability của mọi dependency, penetration testing hoặc production infrastructure security. Minimatch override/Router major risks vẫn cần theo dõi như W4-C2.
- Chưa có production deployment, access-control review ở môi trường production, backup/restore drill, operational monitoring hoặc infrastructure security validation. Vì vậy **PRODUCTION NOT VERIFIED**, kể cả Pages workflow thành công.

Không có product regression được chứng minh bởi 26 passing browser cases/564 Frontend tests; đây không phải claim không tồn tại regression ngoài coverage. Setup failure CRLF được giữ lại, giải thích và xác minh bằng canonical checkout. **DEMO/UAT READY WITH LIMITATIONS** chỉ áp dụng baseline và các luồng đã thực thi; hai AI journeys và checklist human còn là giới hạn rõ ràng, không bị che bằng Core Smoke PASS. Không đưa thêm feature roadmap hay academic relevance metrics trong work package này.
