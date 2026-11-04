# Student & Company Settings + Notifications — real E2E

Ngày kiểm chứng: **2026-11-04 (+07)**. Branch `design/datn-ui-ux-refresh-20261102`,
baseline `1d6e5becc588fcd375ee8b18e6d7db54efd80543`. Tiếp tục đúng task branch/PR #66;
remote master `e019f7a4` đã fetch/đối chiếu, không switch/rebase hay lấy legacy behavior.
PR luôn **Draft, không merge**.

Baseline working tree: `frontend/tsconfig.app.tsbuildinfo` modified; `.agents/` và
`skills-lock.json` untracked. Đây là dirt có sẵn, giữ ngoài commit. Docker ban đầu
chưa chạy; khởi động lại Docker Desktop, giữ containers/named volumes hiện hữu.
Chỉ Backend demo được rebuild cho API mới; không reset PostgreSQL/CV storage.

## Audit và actual contract

Đã đối chiếu AGENTS/CODEX_GUARDRAILS, API/schema/migrations V12/V13/V19/V20,
Notification Controller/Service/Repository/settings, password DTO/service,
Student/Company settings/inbox/header và các báo cáo atomic-profile, lifecycle,
moderation, own-jobs/B06, candidate-management. Latest executable behavior là nguồn
nghiệm thu; inventory lịch sử không tự trở thành browser PASS.

| Hành động | Actual API / persistence / authorization |
|---|---|
| Student account | GET/PUT `/api/students/me`; name/phone; email chỉ đọc. PUT dùng captured `If-Match` từ snapshot đang sửa. Thiếu 428, stale 409; V19 revision transaction giữ nguyên |
| Company account | GET/PUT `/api/companies/me`; companyName/taxCode/description/website/address/phone/industry. Client không gửi status; verification chỉ Admin quản lý |
| Password cả hai role | PATCH `/api/users/me/password`, current/new required, new ≥6 ký tự, cả hai ≤72 UTF-8 bytes; current sai 400 `INVALID_CURRENT_PASSWORD`; BCrypt, không trả password/hash |
| Password session | Stateless JWT chưa có revocation; đổi mật khẩu không thu hồi token cũ. Login tiếp theo dùng password mới |
| Preferences | GET/PUT `/api/users/me/notification-settings`; bốn boolean bắt buộc, JWT user scope. V13 unique user_id + upsert. Missing row đọc all-true, GET không insert. PUT full replacement, chưa có ETag |
| Inbox | GET `/api/notifications?page=1&size=20&unread=true&type=SYSTEM`; owner từ JWT. Optional unread true/unread, false/read, absent/both; optional enum type |
| Ordering / totals | PostgreSQL Specification WHERE owner/read/type trước count/LIMIT/OFFSET; fixed `createdAt DESC, id DESC`, page 1-based, size1–100. `totalItems/totalPages` theo filter |
| Unread badge | GET `/api/notifications/unread-count`: toàn bộ unread của user, độc lập current page/type. Không suy từ số items |
| Read-one | PATCH `/api/notifications/{id}/read`; owned + idempotent; foreign/missing/0/negative ID 404 `RESOURCE_NOT_FOUND`, không lộ row |
| Read-all | PATCH `/api/notifications/read-all`; bulk update unread riêng user; không xóa record |

Enum thực tế chỉ gồm `APPLICATION_STATUS_CHANGED`, `JOB_STATUS_CHANGED`, `SYSTEM`,
`RECOMMENDATION`. **Chỉ application-status có automatic producer**, gửi Student khi
Company/Admin đổi trạng thái hợp lệ và preference bật. Apply/withdraw không tạo
notification này. Không thêm producer hoặc sửa generation rules. Notifications có
polymorphic reference_type/reference_id, không có FK tới mọi target; resource API
tiếp tục quyết định quyền truy cập/404 khi mở reference.

Giữ `ApiResponse<T>` và PageResponse; query invalid non-empty enum/boolean →400
BAD_REQUEST; page/size ngoài range →400 VALIDATION_ERROR; unauthenticated →401.
Backward compatibility: bỏ filters vẫn trả tất cả owned records; tie-break ID làm
ordering xác định. Không schema/migration mới, không thêm dependency production.

## Before / after và regression

| Gap tái hiện | Before | After / evidence |
|---|---|---|
| Lọc sau pagination | Hai màn hình filter `.items` sau LIMIT, type options chỉ từ slice; thiếu kết quả ở trang khác | Shared NotificationsPanel gửi filters về Backend, reset page1 khi đổi filter; options đủ bốn enum; PostgreSQL filter/count trước pagination |
| Backend bỏ qua filters | 48 owned rows, `unread=true&type=SYSTEM` expected8, actual48; invalid enum expected400, actual200 | NotificationApiIT đúng8/3 pages với size3, invalid400; stable ties exact descending IDs |
| Ties không ổn định | Cùng created_at, expected first ID48, actual3 | `createdAt DESC,id DESC`; exact pagination assertions |
| Student read failure | Rejected promise không được catch/feedback | Inline alert + error toast; giữ confirmed list, chặn retry đến GET read-back; pending ref chặn double clicks |
| Header badge giả | Chấm đỏ cố định dù không có unread | Count từ Backend; unknown/stale không hiển thị như confirmed0; refetch sau mutation, explicit refresh, focus/online; không realtime |
| Save feedback/draft | Success sau PUT nhưng GET chạy nền có thể mất; duplicate/session guards thiếu nhất quán | Chỉ success sau PUT + GET xác nhận fields; input lock khi pending; uncertain/conflict giữ draft và snapshot cũ |
| Student stale account | Legacy If-Match phải được giữ | 409 giữ original ETag và draft, disable save; GET đối chiếu không rebase. Chỉ explicit two-step confirmation mới thay draft bằng server snapshot |
| Unsupported 2FA | Student có interactive no-op switch | Bỏ switch; cả hai role giải thích chưa hỗ trợ. Privacy/pipeline/email templates không có fake form/save |

Backend regression chạy **trước fix: 5/5 FAIL**, không skip; sau fix **5/5 PASS**.
SQL fixture 48 Student +1 foreign Company, bốn types/read states, cố tình cùng
timestamp. Test count/union pages/read=false/default/empty/out-of-range/invalid,
401/404, idempotent readAt và bốn concurrent read-one/read-all requests.

`useSettingsForm` giữ riêng draft, confirmed snapshot và server review. Lỗi mạng
hoặc lỗi sau write có thể đã commit: disable retry, GET đối chiếu trước quyết định.
Không tự lấy revision mới để ghi đè draft. Password không có GET plaintext/read-back;
khi uncertain, UI yêu cầu xác minh bằng logout/login, không tự gửi lại password
change. Password chỉ trong component memory, autocomplete phù hợp, clear khi thành
công/unmount; không ghi localStorage/sessionStorage/log.

## Browser / HTTP evidence

Default stack: Vite5173 → Backend8080 → PostgreSQL17 + AI8000 thật, một worker,
không HTTP route mock/fulfil. Negative settings/password chỉ trên secondary accounts.

| Journey | Expected / actual | Scope |
|---|---|---|
| N01 × Student/Company | PUT200, GET đúng fields; double click đúng1 write; offline giữ draft; read-back + confirm trước retry | `studentUi`/`companyUi`, restore original field trong finally; Company status nguyên |
| N02 × hai role | PUT/GET bốn flags, reload còn; offline giữ draft, explicit replace review | Restore preferences trong finally |
| N03 × hai role | Wrong-current400, change200, old-login401, new browser login200, restore/login200 | Chỉ secondary passwords; không đổi PRIMARY |
| N04 Student inbox | Tạo12 notices qua6 REJECTED application histories; page2 thật; SYSTEM filter0/page1; offline/read-one200/read-all200/reload unread0; foreign404 | `frontend` + Job riêng Company B, cuối CLOSED; mở application của Job CLOSED vẫn200 |
| N05 Company demo | Filter/totals Backend thật; empty0; API read-all200 idempotent; UI action disabled khi0 | Demo không có Company producer; không giả record để claim flow |
| N06 isolation/session | Logout/login không mang inbox/account cũ; invalid secondary token →401, clear/redirect/relogin | Invalid-token rejection; clock expiry kiểm riêng I03 |
| N07 responsive/a11y |375/430/768/1024/1440, bảy screens,35 screenshots, không document overflow; labels/focus/keyboard | Native controls, inline alert/status, không chứng nhận exhaustive WCAG |

Populated Company notification browser evidence chạy riêng bằng
`NotificationBrowserFixture`: một **PostgreSQL Testcontainer mới**, Backend random
loopback port, Vite5175. Seed qua repositories chỉ vào DB disposable (48 notifications
mỗi Student/Company/foreignCompany, Company có thêm3 references). Không seed SQL vào
database demo hoặc thay production producer. Test helper không chạy ngầm trong
Backend JUnit suite; runner/config tách riêng để tái chạy có chủ đích.

| Isolated journey | Expected / actual |
|---|---|
| I01 × Company/Student | Populated pages, RECOMMENDATION12/filtered-unread8, read-one200→7, foreign404, read-all200→global unread0, badge/reload persistence; offline giữ confirmed rows |
| I02 references | Owned CLOSED Job200, foreign DRAFT Job403, missing Application404; browser hiển thị owned target/error, không bypass quyền |
| I03 × hai role | JWT ký đúng isolated key nhưng expired →401 thật, clear session/redirect và relogin |
| I04 response loss | Throttle response bytes bằng CDP, Node GET xác nhận commit trước disconnect; UI không false success, đúng1 PUT, giữ draft, GET đối chiếu trước retry |

Failure history giữ local: N07 lần đầu locator chọn hai h1; lần tiếp keyboard chạy
trước list loaded nên chưa có enabled next target. Sửa locator đúng heading và chờ
loading kết thúc, giữ assertions. Isolated lần đầu foreign synthetic email dùng
mixed-case khi insert repository, trái normalization của register; sửa fixture
lowercase, không sửa auth production để che lỗi harness.
Runner lần đầu còn bị PowerShell coi Node color warning trên stderr là terminating
error. Sửa runner để giữ diagnostic stderr và kiểm exit code native process;
không thay test assertions, retry, skip hoặc timeout để làm xanh.

## Verification checkpoint

- Backend `.\mvnw.cmd -B -ntp clean verify`: **507 PASS =247 Surefire +260 PostgreSQL Failsafe**, 0 failure/error/skip. Không đổi 502 regression cũ; thêm5 NotificationApiIT.
- Frontend `test:run`: **203 PASS/30 files**; lint PASS; TypeScript/Vite build PASS. Bundle warning >500kB còn như baseline. Unit HTTP mocks chỉ là regression, không thay real E2E.
- AI locked install `--require-hashes`, pip check PASS, **887 pytest PASS**, một Starlette/httpx deprecation warning; không sửa AI/dependency/scoring.
- Default Playwright: **64/64 PASS**, giữ toàn bộ54 cũ +10 mới, **408.18s**, 0 failure/skip/flaky/retry. JSON start `2026-11-04T05:56:13.773Z`; R01 đủ79 route observations, B06 normal pass và P04 stale Settings409 giữ draft.
- Isolated runner: **6/6 PASS**, **11.77s**, 0 failure/skip/flaky/retry, start `2026-11-04T06:05:14.040Z`. Tất cả I01–I04 chạy qua browser/Backend/PostgreSQL thật, không HTTP mocks. Runner đóng Vite/JVM/Testcontainer riêng sau chạy.
- Backend-only `docker compose up -d --no-deps --force-recreate backend`: PASS. Exact account/preferences/inbox/unread snapshots của PRIMARY Student/Company + studentUi/companyUi/frontend bằng trước recreate, cả timestamps/readAt. Ba demo containers healthy; PostgreSQL/AI không recreate; Flyway **V20/success**, không migration mới.
- API preservation và PRIMARY identity/password/preferences/profile-content: PASS; SQL strict ghi rõ2 CV timestamp mismatches, content comparison PASS như dưới.
- `git diff --check` và `git diff --cached --check`: PASS. Staged secret/artifact scan **PASS/33 paths**, đối chiếu31 actual local credential/env-secret values, 0 issue; không private/generated artifact, JWT literal hoặc unrelated dirt được stage.

Raw logs/JSON/screenshots/credentials/expired JWT nằm gitignored trong `e2e/.local`
và `e2e/test-results`. Traces/video authenticated tắt. Chỉ report/source/tooling được
commit; không upload raw artifacts lên PR.

## Data preservation và contract safety

API baseline trước mutations: `settings-notifications-baseline.json`; SQL strict
digests của PRIMARY Application/CV/Job/bookmarks/existing V3 history ở
`settings-db-baseline.json`, content variant bỏ riêng CV updated_at được chụp riêng
trước full suite. Không diễn giải strict timestamp mismatch thành unchanged.
PRIMARY identity/password/preferences digests và profile content chụp riêng trước
full regression; comparator không in passwords/hashes/profile text.

Kết quả sau recreate (`2026-11-04T06:07:05Z`): giữ **20 aliases baseline** (bao gồm
10 aliases gốc), cùng User/resource/role/status; **9 CV cũ**, gồm đúng **4 READY**
và5 NOT_READY; **16 PRIMARY Jobs**, **3 PRIMARY Applications24/9/1**, **1 PRIMARY
bookmark** nguyên vẹn. Có2 secondary aliases mới do full C01–C05 fixture; không
đổi email/password/status của PRIMARY. Public totals Jobs20/Companies4 giữ;
Students16→18, Application history92→112 do các secondary journeys/race/reapply
hợp lệ; không reset latest WITHDRAWN hoặc duplicate active pair.

Strict SQL baseline: **2 CV rows1/2 khác digest** do existing A03 activate/restore
đổi updated_at. Không sửa/ghi đè baseline để làm xanh. Content baseline riêng bỏ
**duy nhất CV updated_at**: 0 mismatch. Tất cả field còn lại của hai PRIMARY CV,
3 applications,16 Jobs,1 bookmark và existing V3 history giữ nguyên:57 Student
runs/1140 results,38 Company runs/114 results. Full regression thêm3 Student runs/
60 results và2 Company runs/6 results; không đổi history rows cũ. Đây không phải
chứng nhận toàn DB/CV bytes unchanged. Secondary settings/preferences/passwords
được restore trong finally và login/read-back xác nhận; notifications/application
histories do test tạo được giữ, các Job riêng cuối CLOSED.

Artifacts execution chính: `settings-backend-{before,targeted,verify,rebuild,recreate}.log`,
`settings-frontend-{tests,lint,build}.log`, `settings-ai-{install,pip-check,tests}.log`,
`settings-full-{browser.log,results.json}`, `settings-notifications-evidence.json`,
`settings-isolated-{runner.log,results.json,evidence.json}`, `settings-security-preservation.json`,
`settings-row-preservation.json`, `settings-runtime-persistence.json`,
`p0-preservation-evidence.json` và35 `settings-*.png` screenshots. Logs của các
failure trước giữ riêng; raw artifacts không stage/commit.

Giữ Recommendation/Ranking V3, CV parsing V2, persisted READY snapshots,
canonical skills/language/version, TF-IDF/Cosine, weights0.65/0.35, PRIMARY/FALLBACK,
null scores, thresholds, Student global Top-K, Company independent tier limits,
Backend official ordering/ranks/persistence và stateless AI. Không sửa application
lifecycle/locking/V18 uniqueness, moderation hoặc verification policy.

## Missing Backend features / remaining gaps / priorities

1. **UNSUPPORTED:** Company/job/recommendation/system automatic producers ngoài
   application-status Student; email/SMS/push realtime/2FA/privacy customization,
   email templates/custom recruitment process. Preferences bốn flags tồn tại,
   nhưng không biến missing producer/delivery thành chức năng đã triển khai.
2. Preferences/Company account chưa có revision/ETag. Hai editor cùng sửa có thể
   last-writer-wins; read-back phát hiện mismatch đã xảy ra trước GET nhưng không
   ngăn mọi overwrite về sau. Thiết kế reviewed concurrency contract là follow-up.
3. JWT refresh/revocation/logout-all chưa có. Password đổi xong token cũ còn sống
   đến expiry; UI nói rõ. Không claim revoke sessions hoặc password GET verification.
4. Draft giữ trong component sống; đổi tab/đóng trang có thể bỏ draft. Chưa có
   encrypted/offline draft storage, cross-tab realtime count hoặc cursor snapshot.
5. Responsive/keyboard checks chỉ bao phủ screens/actions ghi trên; workspace
   header và page có thể cùng h1 như baseline. Không tự mở rộng scope sửa global
   layout hoặc tuyên bố WCAG compliance/performance production.
6. **B06 tiếp tục UNRESOLVED / NOT REPRODUCED**. Normal pass không chứng minh lỗi
   lịch sử đã được sửa; không có controlled reproduction mới trong package này.

Ưu tiên tiếp: quyết định producer/delivery requirements, concurrency cho unversioned
settings, session revocation nếu có yêu cầu sản phẩm; sau đó audit accessibility
chuyên sâu. Không thêm chức năng giả để lấp các khoảng trống Backend.
