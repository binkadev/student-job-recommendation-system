# Real-world E2E (local only)

## Company analytics

`company-analytics.spec.mjs` bổ sung D01/D02 (default suite66 =64 cũ +2 read-only
journeys): Company Dashboard/Reports/CSV đối chiếu API, Student main totals và offline
unknown/recovery. Không mock HTTP. Large dataset không seed vào demo.

```powershell
# Repo root; six isolated analytics journeys, two Companies with130 Jobs/362 histories each.
.\scripts\run-settings-notifications-isolated-e2e.ps1 -JavaHome $env:JAVA_HOME -Suite analytics
# Run default6 notification cases separately, unchanged default Suite.
.\scripts\run-settings-notifications-isolated-e2e.ps1 -JavaHome $env:JAVA_HOME
```

Analytics config riêng `analytics-isolated.playwright.config.mjs`; disposable
PostgreSQL + random Backend port + Vite5175. Q01–Q06 verify SQL-independent totals,
7/30/90 days, histories vs distinct Students, month/Job/status filtering, detail
pages, full362-row RFC4180 CSV (BOM/Vietnamese/formula/multiline), ownership/BLOCKED,
offline/stale filters/account switch, five viewports. SQL uses BEGIN READ ONLY;
core application digests compare before/after. No authenticated trace/video.
Runtime metrics/counts/CSV/downloads/credentials remain gitignored `.local`/test-results.
`analytics-csv.mjs` only parses assertions, not production export generation.
See [contract/calculations/preservation evidence](../docs/datn/company-dashboard-reports-results.md).

N07 dùng context riêng mỗi role/viewport (10 contexts), giữ35 screenshots và mọi
assertion; không retry hoặc tăng timeout. Một lượt full có transient blank Company
Settings; fresh long-sequence diagnostic không tái hiện, nên không kết luận đã sửa
production bug. Chạy diagnostic riêng (read-only, không mặc định thêm vào66 cases):

```powershell
npx playwright test --config=analytics-settings-diagnostic.playwright.config.mjs
```

Preservation package analytics dùng namespace riêng, không ghi đè các settings/
candidate baselines cũ: `verify-candidate-preservation.mjs --analytics --capture`
và `--analytics --cv-content --capture`; `verify-settings-preservation.mjs --analytics --capture`.
Chụp `summarize-state.mjs` vào `analytics-baseline.json` trước mutations. Sau test:
`verify-preservation.mjs analytics-baseline.json`, strict row comparator (giữ mismatch
evidence nếu A03 đổi CV updated_at), content comparator và security/profile-content
comparator. `verify-settings-runtime-persistence.mjs --analytics --capture` chụp thêm
analytics responses trước Backend-only recreate; chạy không capture để compare.
Analytics capture từ chối overwrite snapshot đã có. Không chia sẻ raw artifacts/PII.

## Settings / notifications

`settings-notifications.spec.mjs` bổ sung 10 journeys, giữ 54 cases cũ (tổng 64).
Mutations dùng `studentUi`, `companyUi`, `frontend` và Job riêng của `companyB`;
password/preferences được restore trong finally. N04 tạo 12 thông báo bằng
application lifecycle hợp lệ (6 histories REJECTED), rồi soft-close Job riêng.
Không SQL write vào demo DB, không reset volume. Đọc cả bốn preferences không
đồng nghĩa cả bốn loại đã có producer; Company demo inbox hiện rỗng.

```powershell
$env:E2E_USE_DEV_SEED_ADMIN='1'
npx playwright test settings-notifications.spec.mjs
```

Populated Company/Student inbox, missing/foreign/closed reference, signed expired
JWT và response loss sau commit dùng **stack PostgreSQL Testcontainers riêng**:

```powershell
# Repo root; Java 21, Docker, frontend/e2e dependencies phải đã có.
.\scripts\run-settings-notifications-isolated-e2e.ps1 -JavaHome $env:JAVA_HOME
```

Runner compile test-only `NotificationBrowserFixture`, tạo PostgreSQL tạm và
Backend port ngẫu nhiên + Vite 5175, seed 48 records mỗi role (Company có thêm ba
reference), chạy sáu browser checks rồi đóng đúng processes/container do runner
tạo. Không trỏ fixture vào DB demo; không thêm notification producer vào runtime.
Maven dependency plugin 3.8.1 chỉ xuất test classpath, không thêm production
dependency. Config riêng không thay testDir/default suite. Không chạy đồng thời
hai Playwright suites. HTTP thật; offline/response throttling dùng CDP, không
route mock/fulfil. Credentials/expired JWT/raw artifacts giữ trong `.local/`.

Preservation của package này: capture `summarize-state` vào
`settings-notifications-baseline.json` trước mutations; SQL digests history/CV/Job
trong `settings-db-baseline.json` và content variant bỏ riêng CV `updated_at`.
`node verify-settings-preservation.mjs --capture` chụp thêm PRIMARY identity/password,
preferences và profile content; từ chối ghi đè baseline đã tồn tại. Sau regression
chạy `node summarize-state.mjs`, `node verify-preservation.mjs settings-notifications-baseline.json`
và `node verify-settings-preservation.mjs`. Không chia sẻ digests/credentials/raw JSON.
`node verify-settings-runtime-persistence.mjs --capture` chụp exact account/preferences/
inbox/unread của PRIMARY và ba secondary trước Backend-only recreate; chạy lại
không `--capture` để đối chiếu sau recreate. Không overwrite baseline giữa lượt.
Xem [report và giới hạn](../docs/datn/student-company-settings-notifications-results.md).

Chạy từ PowerShell tại `e2e/`; Backend/AI/PostgreSQL và Vite phải đang chạy đúng source branch. Node 24/Python 3.11 đã dùng để kiểm chứng. Playwright Test **1.56.1** là dependency dev được khóa riêng trong `package-lock.json`; không thêm dependency production. Chromium tương ứng được tải bằng Playwright.

```powershell
npm.cmd ci
.\node_modules\.bin\playwright.cmd install chromium
$env:E2E_USE_DEV_SEED_ADMIN='1'
npm.cmd run setup
npm.cmd test
```

`E2E_USE_DEV_SEED_ADMIN=1` chỉ dành cho môi trường dev local có sẵn tài khoản Admin do `DataSeeder` tạo: script đọc định danh từ source, login hợp lệ và chỉ duyệt record E2E qua API. Không đăng ký Admin, không SQL write, không bypass verification. Setup chỉ xác thực Company vừa tạo cho fixture cần publish; không tự verify/unblock/reset Company cũ. Thiếu Admin hợp lệ khi cần tạo dữ liệu công khai sẽ dừng với lỗi rõ ràng. Không bật flag với một môi trường khác.

Chạy riêng:

```powershell
npm.cmd run test:api
npm.cmd run test:browser
.\node_modules\.bin\playwright.cmd test routes.spec.mjs
.\node_modules\.bin\playwright.cmd test moderation.spec.mjs
```

Mọi endpoint mặc định là localhost. Đổi port bằng `E2E_BACKEND_URL`/`E2E_FRONTEND_URL`, vẫn bắt buộc loopback. Không mock HTTP trong các test này; offline dùng Chromium offline mode. Một worker, không chạy hai setup/test process cùng lúc. `setup` idempotent theo email, tên CV, company/title; giữ manual profile edits sau lần populate đầu. Manifest là snapshot của lượt setup; dùng API/DB read-back khi cần trạng thái mới nhất. Các run/history và reapplication REJECTED là record lịch sử mới hợp lệ mỗi lần chạy, không phải duplicate active applications. Không tự cleanup tài khoản chính.

Credentials nằm ở **`e2e/.local/credentials.json`** trên máy này. Mở file bằng editor local để xem các alias `student` và `company` (hai tài khoản chính), hoặc `studentUi`/`companyUi` (đăng ký từ browser). Không paste file vào issue/chat/report. Mật khẩu ngẫu nhiên đủ mạnh; không đổi lại account hiện hữu nếu login thất bại. Mất file credentials có thể khiến setup báo email collision: dừng và phục hồi file, không xóa DB để chạy tiếp. Không có email nào được gửi ra ngoài.

Generated CV, manifest, logs, JSON results, screenshots và trace nằm trong `.local/`, `test-results/`; tất cả bị gitignore. Các report artifact chỉ dùng local và có thể chứa dữ liệu tổng hợp. Trace/video cho phiên đăng nhập tắt vì Playwright lưu password/Authorization; chỉ B01 ghi `public-trace.zip` trước login. Không bật trace auth rồi chia sẻ. Mở trace public:

```powershell
.\node_modules\.bin\playwright.cmd show-trace .local/public-trace.zip
```

`routes.spec.mjs` kiểm kê controls và điều hướng của 79 route, **không** kiểm chứng mọi hành động. Business assertions ở `api.spec.mjs` và `browser.spec.mjs`. Báo cáo có thể commit ở `docs/datn/`; không commit credential hay raw artifact. Khi một test có thể tái sử dụng record, nó xác minh record hiện hữu thay vì tạo trùng; B06 thực hiện submit/status transition khi application chưa tồn tại/PENDING. Muốn kiểm tra chuỗi mới hoàn toàn, dùng database dev E2E riêng qua cấu hình hợp lệ, không reset volume hiện tại.

Route scanner đóng browser context sau mỗi sáu route và login lại bằng form thật. Việc giữ một context qua hàng chục Vite full reload đã gây `ERR_INSUFFICIENT_RESOURCES` khi mỗi reload tải hàng trăm source modules; không bỏ route, không retry và không giảm assertions để xử lý lỗi này. Có thể đối chiếu production preview bằng `E2E_FRONTEND_URL`, vẫn dùng Backend thật.

Sau một lượt hoàn chỉnh, tạo lại tài liệu đã lược bỏ secrets:

```powershell
node summarize-state.mjs
node write-manifest.mjs
node write-inventory.mjs
```

Inventory generator từ chối xuất full matrix nếu chưa có đủ 79 route observations. `security.spec.mjs` bổ sung raw CV/run ownership và đổi mật khẩu tài khoản phụ rồi phục hồi. Không chia sẻ file JSON report gốc mà chưa rà soát dù trace auth đã tắt.

`moderation.spec.mjs` dùng alias riêng `moderationCompany` (thêm vào credentials local, giữ nguyên chín alias cũ) và bốn Job có namespace `[p0-e2e]`. New register phải PENDING; chỉ Admin API được verify/block/approve/reject. Tests kiểm cả UI close→draft→edit→submit→withdraw, Student/public visibility và ba lượt cạnh tranh approve/reject. Kết thúc Company riêng PENDING, không có Job riêng ACTIVE. Không đổi trạng thái các Job PRIMARY để kiểm moderation. Fixture có thể tái sử dụng; report ghi rõ nếu registration được reuse.

Đối chiếu dữ liệu bằng API snapshot trước/sau (chỉ đọc):

```powershell
node summarize-state.mjs
Copy-Item .local/final-state.json .local/p0-moderation-baseline.json
# Chạy setup/tests hoặc rebuild Backend, giữ volumes.
node summarize-state.mjs
node verify-preservation.mjs
```

Comparator xác nhận mọi alias baseline giữ user/resource ID/status, CV metadata baseline, các trường Job PRIMARY đã snapshot (id/title/status/deadline/skills) và application PRIMARY ban đầu. Không tuyên bố snapshot này so sánh toàn bộ bytes/file/database. Không ghi đè baseline trong lúc chạy.

`profile-atomic.spec.mjs` thêm P01–P04 trên alias phụ **studentUi**: hai tab đăng nhập thật cùng revision, atomic basic/profile/manual skills save, 409 giữ draft, GET đối chiếu và confirm reload/retry; DTO/skill rollback; ba legacy PUT thiếu If-Match 428, stale 409; offline và hai legacy UI consumers. Không dùng PRIMARY để tạo negative profile cases. 36 tests cũ giữ assertions; B03 đổi response predicate sang aggregate, A02 legacy ghi với revision explicit. Helpers không tự lấy tag mới để overwrite draft.

Backend hiện cần Flyway V19. Setup đi qua aggregate một transaction khi populate hồ sơ, giữ manual edits cũ. Mọi caller legacy phải gửi ETag đã đọc trong `If-Match`; signature helper `api/ok(method,route,token,body,headers)` hỗ trợ header explicit, không tự retry conflict. Credentials, CVs, Jobs và existing alias moderation được giữ.

Read-back trước/sau recreate Backend, **không reset volumes**:

```powershell
node verify-profile-persistence.mjs --capture
# Tại repo root: docker compose up -d --no-deps --force-recreate backend
# Đợi Backend healthy, quay lại e2e/:
node verify-profile-persistence.mjs
node summarize-state.mjs
node verify-preservation.mjs profile-atomic-baseline.json
```

Comparator profile dùng baseline local `profile-primary-content-baseline.json` đã chụp trước work package; nếu chạy trong môi trường mới, chụp lại qua GET basic/profile/skills trước khi chạy. `--capture` chỉ ghi snapshot local và không sửa DB. Snapshot exact của PRIMARY/secondary (cả revision/timestamps) phải còn nguyên sau recreate. Xem [report](../docs/datn/student-profile-atomic-save-results.md) để phân biệt baseline nội dung với snapshot persistence.

`own-jobs.spec.mjs` kiểm tra phân trang/filters Backend thật, giữ kết quả khi offline, phục hồi explicit và năm viewport. J02 dùng đúng một DRAFT riêng `[p1-e2e]` của `companyB`, tạo qua UI ở lần đầu rồi tái sử dụng; edit/submit/withdraw và kết thúc DRAFT, không publish. Bộ 130+130 Job nằm trong PostgreSQL Testcontainers của `CompanyOwnJobsApiIT`, không tạo hàng trăm fixture trong database demo.

B06 diagnostic chạy riêng, không tăng timeout/retry, không mock Backend và không sửa application:

```powershell
$env:E2E_RESULTS_FILE = '.local/b06-results.json'
npx playwright test --config=b06.playwright.config.mjs
node collect-b06-server-evidence.mjs
```

Ba cases gồm 6 fresh sessions, 12 reload và 12 route remount. Native XHR instrumentation chỉ quan sát, giữ nguyên open/send; đối chiếu HTTP/body shape/Request-ID với Backend logs, session fingerprint (không lưu token), DOM state và lỗi resource/console đã redact. Artifacts chứa dữ liệu môi trường nên giữ gitignored. Nếu không tái hiện, kết luận **UNRESOLVED / NOT REPRODUCED**, không coi diagnostic pass là đã sửa B06. Xem [report](../docs/datn/company-jobs-pagination-b06-results.md).

Trước work package riêng, `node verify-own-jobs-preservation.mjs --capture` chụp PRIMARY aggregate local; không ghi đè baseline khi đang chạy. Sau tests, chạy `summarize-state.mjs`, `verify-preservation.mjs own-jobs-baseline.json` và `verify-own-jobs-preservation.mjs`. Comparator cuối kiểm PRIMARY content (loại revision/timestamps do positive regression saves) và đúng một secondary DRAFT/benefits đã persist. Baseline aliases/jobs/applications được chụp riêng bằng summarize-state trước sửa như workflow phía trên.

`application-lifecycle.spec.mjs` dùng Student `frontend` và Company `companyB`; alias `data` chỉ kiểm foreign permission/logout isolation. Không mutation các Application PRIMARY. L01/L02 tạo tối đa hai Job phụ/run, DRAFT→PENDING_APPROVAL→Admin ACTIVE qua API hợp lệ, kết thúc soft-CLOSED và bỏ saved links do test tạo. WITHDRAWN không thể reset nên lần chạy mới dùng fixture mới; giữ history thật và không hard-delete/reset volume. Chỉ chọn CV READY có sẵn, không tạo/đổi CV. Hai browser workflows gồm offline/cancel/double-click/read-back, Company terminal controls, stale review400, rejected/new history/duplicate409, public/candidate/saved/recommended/modal entry points, cross-tab invalidation, logout/login và năm viewports. L02 tạo Recommendation V3 secondary qua API hiện hữu với threshold0/limit100 để kiểm entry point, không chỉnh scoring.

Chạy targeted: `npx playwright test application-lifecycle.spec.mjs` (cần `E2E_USE_DEV_SEED_ADMIN=1`). Artifacts safe HTTP/body shape/Request-ID ở `.local/lifecycle-evidence*.json`; fixture IDs theo run ở `.local/lifecycle-fixtures-*.json`. `node collect-b06-server-evidence.mjs lifecycle-evidence.json lifecycle-server-evidence.json` đối chiếu normal Company detail requests; không phải chạy lại diagnostic60 observations. B06 giữ UNRESOLVED / NOT REPRODUCED nếu không có failure mới. Trước/sau work package dùng `summarize-state.mjs` và `verify-preservation.mjs application-lifecycle-baseline.json`; không ghi đè baseline giữa lượt chạy.

`company-candidates.spec.mjs` thêm C01–C05, giữ 49 cases cũ (tổng 54). Cần Backend/Flyway V20 và `E2E_USE_DEV_SEED_ADMIN=1`. Company PRIMARY chỉ đọc applicant/profile/CV; mutations dùng Company B và hai Student synthetic mới mỗi worker/run, một CV qua AI parser thật, một Job được Admin duyệt hợp lệ. AfterAll chỉ unsave bookmarks do test tạo và soft-close Job riêng; giữ credentials/CV/application history. Không dùng route mock. Có save/note/delete concurrency, stale revision409, ownership401/403/404, Company BLOCKED internal-management policy (restore VERIFIED trong finally), offline note/save/delete, reload/relogin, Backend search/status/Job/page-size/page controls, account isolation và năm viewports. Note là dữ liệu private của Company trên bookmark, status là source application thật. B08 cũ thêm prerequisite xác nhận application history trước khi offline; mọi assertion cũ giữ nguyên.

```powershell
npx playwright test company-candidates.spec.mjs
node verify-candidate-roundtrip.mjs
```

Round-trip tool chỉ dùng secondary fixture gần nhất sau browser cleanup, từ chối sửa bookmark có sẵn; save/update/clear/delete qua API thật rồi đọc PostgreSQL bằng `BEGIN READ ONLY`, so hash note/owner/source/revision và Application/CV trước/sau. Không in note/JWT/credential. `candidates-browser-evidence.json`, `candidates-db-roundtrip.json`, screenshots `saved-candidates-*.png` và logs nằm local.

Trước full regression, capture `summarize-state` vào `candidates-baseline.json`, PRIMARY profile bằng `verify-own-jobs-preservation.mjs --capture`, SQL digests bằng `verify-candidate-preservation.mjs --capture`. A03 vốn activate CV rồi restore active flag, nên strict full-row CV digest có thể khác do `updated_at`; không diễn giải thành toàn DB unchanged. Chế độ `--cv-content --capture` ghi baseline **riêng** loại duy nhất CV `updated_at`; `--cv-content` so tất cả field còn lại và existing PRIMARY/V3 history rows. Không ghi đè/reinterpret strict baseline. Kết quả/mismatch đều giữ local. Xem [functional report và phạm vi evidence](../docs/datn/company-candidate-management-results.md).

## Reliability/security isolated suite (V21)

V21 Company account và notification preferences PUT yêu cầu captured `If-Match`
từ đúng snapshot của draft: thiếu 428, stale 409. Các consumers trong suite gửi
header tường minh, không helper GET-and-retry mutation. Chưa đổi scoring V3 hoặc
parser V2. Xem [contract/evidence](../docs/datn/student-company-reliability-security-results.md).

```powershell
# Từ repository root, chạy riêng từng suite; không chạy hai Playwright cùng lúc.
powershell -File scripts/run-settings-notifications-isolated-e2e.ps1 -Suite reliability -JavaHome C:\path\to\jdk21
powershell -File scripts/run-settings-notifications-isolated-e2e.ps1 -Suite notifications -JavaHome C:\path\to\jdk21
powershell -File scripts/run-settings-notifications-isolated-e2e.ps1 -Suite analytics -JavaHome C:\path\to\jdk21
```

Reliability runner chỉ tạo PostgreSQL/AI containers dùng một lần và processes riêng;
không stop demo services/volumes. Cần local image `student-job-recommendation-ai:local`.
Successful responses gọi AI thật qua HTTP/1.1 fault proxy; offline/500/503/read
timeout/TCP RST/malformed/missing JSON được tiêm chỉ trong fixture. Browser kiểm
response loss/40s client timeout sau commit, explicit run read-back, double-click,
real two-tab CAS, expired JWT/late401 và response thuộc session cũ. Synthetic READY
snapshot không thay parser; default suite vẫn kiểm parse thật. Control/evidence
endpoints chỉ tồn tại trong test fixture loopback, không vào production.

Giữ `reliability-*` namespace riêng cho API/SQL strict/content/password/profile
baselines; capture một lần, không ghi đè. `--before-migration` runtime snapshot riêng
với exact `before-recreate`; không dùng normalization migration để che mismatch
của comparator strict. Raw credentials, response logs và screenshots ở `.local/`.
B06 config chỉ discover ba bounded B06 cases; N07 diagnostic dùng
`E2E_DIAGNOSTIC_PREFIX=reliability` để giữ evidence package cũ.
Không có thao tác nguồn Windows trong runners này.

## Student/Company UI/UX production acceptance

`@axe-core/playwright@4.10.2` là dependency kiểm thử pinned, dùng cho accessibility
audit; không thêm dependency runtime vào Frontend. Xem
[kết quả và giới hạn phép đo](../docs/datn/student-company-uiux-performance-results.md).

Chạy production build/preview riêng trước phép đo; giữ nguyên demo dev server và
Backend/PostgreSQL/AI. Preview dùng Vite proxy hiện hữu, không HTTP mock. Từ `e2e/`:

```powershell
$env:UIUX_BASE_URL = 'http://127.0.0.1:5177'
$env:UIUX_DIST = '../frontend/dist'
# Dùng phase mới: tool từ chối ghi đè performance JSON đã tồn tại.
node measure-uiux.mjs review
# Comparator cần uiux-before-performance.json + immutable uiux-before-dist baseline.
node compare-uiux.mjs review
$env:UIUX_PHASE = 'after'
$env:E2E_RESULTS_FILE = '.local/uiux-acceptance-results.json'
node node_modules/playwright/cli.js test --config=uiux-acceptance.playwright.config.mjs
```

Measure chạy 10 màn × 3 cold/warm pairs, 5 viewport axe/overflow/screenshots mỗi
màn. Cache điều kiện, browser/version, readyMs, LCP/CLS/long tasks, resource timings
được ghi local. Không chạy browser suites/builds/heavy tests song song với phép đo;
không dùng số đo này thay Lighthouse/INP/WAN benchmark. Report 11 acceptance cases
gồm real401, validation, keyboard/mobile menu, offline lazy chunk recovery, debounce,
toast bounds và DOCX tên dài upload/analyze/detail/dialog trên alias phụ.
U11 cleanup chỉ xóa CV mới không active do chính test tạo.

Trước work package, copy summarize-state vào `uiux-baseline.json` một lần rồi capture
`verify-candidate-preservation.mjs --uiux --capture`, `--uiux --cv-content --capture`,
`verify-settings-preservation.mjs --uiux --capture` và
`verify-settings-runtime-persistence.mjs --uiux --capture`.
Sau tests chạy lại không `--capture`, cùng `verify-preservation.mjs uiux-baseline.json`.
Strict CV timestamp mismatch phải giữ nguyên kết quả FAIL/evidence, so content bằng
baseline riêng; không normalize strict để che mismatch. Runtime snapshot filename
`uiux-before-recreate.json` kế thừa từ tool, không có nghĩa phase này recreate service.
Raw logs/images có thể chứa metadata riêng; không stage/upload `.local/`.
