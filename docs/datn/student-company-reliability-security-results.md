# Student & Company Reliability / Security — giai đoạn 1/3

Ngày thực thi: **2026-11-04 (+07)**. PR **#66 giữ Draft**, không merge/force push.
Yêu cầu mới nhất **cấm mọi thao tác nguồn Windows**; các ghi chú shutdown trong
báo cáo lịch sử không còn là chỉ dẫn vận hành. Không chạy shutdown/restart/sleep
Windows trong work package này.

## 1. Baseline và khôi phục

Branch `design/datn-ui-ux-refresh-20261102`, remote/source baseline
`f6b52be43fdff7e07ddb0c09f0feb07e039860da`. Fetch master chỉ để đối chiếu;
tiếp tục task branch được chỉ định, không reset/rebase/stash. Dirt có sẵn:
`frontend/tsconfig.app.tsbuildinfo`, `.agents/`, `skills-lock.json`; giữ ngoài commit.

Sau ngắt phiên, kiểm tra PID/parent/command line: không còn Maven/Surefire/Failsafe
chạy; Vite PID 27452 vẫn phục vụ demo. Thu log đã hoàn tất trước khi chạy tiếp.
Không kill Java/Node/Docker hàng loạt, không chạy hai Backend integration suites
hoặc hai Playwright processes đồng thời. Ba dịch vụ demo ban đầu healthy;
named volumes `student-job-recommendation-system_postgres_data` và
`student-job-recommendation-system_cv_uploads` giữ nguyên.

Baseline riêng `reliability-*` được capture một lần trước thử lỗi: **28 aliases,
13 CV metadata records / 4 READY**, PRIMARY **2 CV, 16 Jobs, 3 Applications**, 1 bookmark,
69 Recommendation runs/1380 results, 46 Ranking runs/138 results. Strict và
CV-content comparators đều PASS khi khôi phục, identity/password/preferences và
Student profile content không đổi. Namespace mới không thay đổi phép so sánh;
baseline strict không bị ghi đè hoặc thay bằng baseline content.

## 2. Source audit và phạm vi

Đối chiếu AGENTS, `docs/datn/CODEX_GUARDRAILS.md`, active V3 contract, API/schema/ERD,
settings-notifications và analytics reports, các tests/harness hiện hữu; audit
AuthProvider, Axios interceptors, authService, useAsyncData/useSessionAlive,
settings snapshots, Company row lock, notification SQL, V3 generation/transaction
services/validators, RestAiServiceClient và read-back UI.

Backend vẫn là source of truth cho JWT/RBAC/ownership, validation, persisted
runs/results, official ranks. Không sửa AI source/dependency/processing V2,
TF-IDF/Cosine/0.65–0.35/tiers/limits hoặc endpoints V3. Không làm Admin feature,
không thêm module nghiệp vụ. Moderation test chỉ giữ regression khóa dùng chung.

## 3. Bug evidence trước sửa

| Regression | Expected | Actual trước sửa | Nguyên nhân |
|---|---|---|---|
| `authSession: a pending login cannot restore a session after logout` | Reject, token vẫn trống | Promise resolve user cũ, token cũ được lưu | `loginRequest` luôn storeToken sau await, không kiểm phiên/attempt |
| `authSession: a failed old login cannot clear a newer session` | Giữ `new-token` | actual `null` | Catch cũ luôn clearToken |
| `httpClient: binds a mutation to its caller session before a synchronous logout/login switch` | Mutation dùng token A; late response bị reject | Promise resolve với Authorization của account B | Axios request interceptor mặc định async đọc token sau thời điểm gọi, khi session đã đổi |
| `SettingsConcurrencyIT.staleCompanyTabCannotOverwriteConfirmedAccount` | Tab B stale 409, A được giữ | HTTP 200, persisted `Tab B stale` | Row lock tuần tự hóa writer nhưng không kiểm revision của draft |
| `SettingsConcurrencyIT.stalePreferencesTabCannotOverwriteFirstInsert` | Tab B stale 409 | HTTP 200, UPSERT thay toàn bộ flags | Unique user_id ngăn duplicate row, không ngăn lost update |
| `RestAiServiceClientV3Test.tcpResetWhileReadingResponseBodyIsUnavailable` | `AI_SERVICE_UNAVAILABLE` | `AI_SERVICE_INVALID_RESPONSE` | Spring bọc SocketException lúc đọc body trong base RestClientException, không phải ResourceAccessException |

Hai unit failures dùng deferred Axios adapter, không phải browser E2E. Fixture user
được làm đủ metadata sau đó; failure gốc không phụ thuộc trường metadata thiếu:
role hợp lệ map được và source thực sự ghi/xóa token. Hai concurrency failures
chạy Spring security/controller/service và PostgreSQL Testcontainer thật.
Log trước sửa giữ tại `e2e/.local/reliability-auth-before.log` và
`reliability-cas-before.log`; không ghi JWT/password/CV thật vào báo cáo/PR.
Regression dispatch được bổ sung khi audit sâu hơn; before-fix log riêng
`reliability-dispatch-before.log` giữ failure. Bản sửa dùng request interceptor
**synchronous** để capture token/counter ngay lúc gọi, ngăn draft A gửi dưới JWT B.
TCP reset được tái hiện qua hai V3 E2E, rồi deterministic socket/body regression
thất bại trước sửa (`reliability-reset-body-before.log`). Diagnostic chỉ ghi
exception class và root class: `RestClientException` → `SocketException`, không
message/body/header. Mapper giữ timeout priority, nhận root SocketException là
unavailable; malformed/empty/semantically invalid JSON vẫn invalid-response. Đây
là thay đổi error classification, không phải thay đổi scoring hay AI computation.

## 4. Implementation và contract cố ý đổi

### Session ownership

Thêm generation counter chỉ trong bộ nhớ của tab. Login attempt, store/clear token
đổi counter; response thành công chỉ được dùng nếu token và counter còn thuộc
phiên gửi request. Late 401 giữ lỗi gốc nhưng không expire phiên mới. Login cũ
không store/clear token của attempt mới. AuthProvider bảo vệ cả restore success,
restore failure và login/logout overlap. StrictMode cleanup không clear token từ
effect cũ. Protected Outlet keyed theo account/token; asynchronous GET và settings/
generation callbacks kiểm ownership trước khi cập nhật state/toast.

HTTP timeout hữu hạn **40 giây**, lớn hơn timeout AI Backend hiện có **15 giây**;
không tăng Backend AI timeout hay Playwright assertion/action/navigation timeout.
Không thêm refresh-token/revocation architecture. Password change vẫn theo
stateless JWT hiện hữu: password mới áp dụng cho login tiếp theo, JWT cũ không
tự bị thu hồi; password UI logout tab hiện tại sau xác nhận thành công.

### Company account và notification preferences

**V21 duy nhất**, additive: Company `account_revision`, preference `revision`,
BIGINT NOT NULL DEFAULT 0, CHECK nonnegative. Không sửa V1–V20.
GET và PUT thành công trả numeric `data.revision` và strong numeric ETag.
PUT yêu cầu captured `If-Match`: thiếu **428 SETTINGS_REVISION_REQUIRED**;
malformed/weak/wildcard/multiple/negative/overflow **400 BAD_REQUEST**;
stale **409 SETTINGS_REVISION_CONFLICT**. Unknown PUT fields vẫn bị reject.

Company kiểm revision và increment đúng một lần **dưới row lock cũ**, cùng transaction
với field edits; giữ serialization với status moderation. Preferences UPDATE có
`WHERE user_id AND revision`; absent revision 0 dùng INSERT revision 1,
`ON CONFLICT DO NOTHING`. Concurrent first writers: một winner, một conflict;
không duplicate row hay overwrite winner. GET absent vẫn không insert, defaults true.

Frontend giữ revision trong đúng draft; read-back sau conflict chỉ tạo review,
không ghép revision mới vào draft cũ. Xác nhận thay draft mới chấp nhận snapshot
mới. Cả Settings và Company profile editor gửi revision đã capture. Các E2E/API
consumers cập nhật header tường minh; fresh revision trong cleanup chỉ phục vụ
restoration có chủ ý, không nằm trong luồng tự retry mutation của ứng dụng.
Student V19 và Saved Candidate V20 invariants giữ nguyên.

### Generation recovery

Recommendation/Ranking UI khóa request trùng bằng ref và nút busy. Lỗi response
không tự gửi lại POST: giữ trạng thái chưa xác nhận, yêu cầu **đọc lại lịch sử**.
Nếu còn PROCESSING/PENDING thì tiếp tục khóa; GET lỗi cũng giữ khóa. Chỉ read-back
thành công và không còn run xử lý mới cho phép người dùng gửi lần chạy mới.
Không báo success trong catch và không dựng kết quả khi AI lỗi.

## 5. Isolated AI/security runtime

Harness tạo **PostgreSQL 17 + real AI image** riêng, fresh Spring Backend và Vite
5175; chỉ gateway/proxy loopback tiêm lỗi transport. Happy/recovery responses luôn
đến từ AI thật, không Playwright route mock/MSW. READY CV fixture là persisted
synthetic V2 analysis snapshot; không tuyên bố fixture này chạy parser. Parsing V2
được kiểm bởi suites hiện hữu và AI regression. Digest toàn CV row phải giữ nguyên.

Các ca: AI listener offline, HTTP500/503, chậm vượt 15 giây, reset TCP qua
SO_LINGER(0), JSON malformed/thiếu required fields; persisted FAILED có 0 results,
SUCCESS cũ/score/ranks không đổi; recovery gọi AI thật. Theo dõi JWT leak counter
ở AI boundary bằng 0. Company concurrent same-Job trả 200/409 theo guard hiện hữu;
Student hiện cho phép hai explicit requests tạo hai independent SUCCESS runs,
không có idempotency contract mới. Browser double-click vẫn chỉ gửi một POST.

Gateway còn mô phỏng response mất và response chậm **sau Backend đã commit**;
UI phải dừng loading, không giả thành công, đọc persisted SUCCESS trước khi retry.
Hai tab Company account/preferences xác minh 200/409, revision N→N+1, winner giữ
nguyên và draft B giữ cả sau GET. Real expired/invalid JWT và late response kiểm
qua Backend thật. Không dừng hoặc fault-inject demo AI.

Harness failures được giữ riêng: lần đầu HTTP/2 upgrade của proxy gây upstream422;
sửa test transport HTTP/1.1. Lần hai test đọc nhầm response flattened thành
`data.run`; sửa test theo public contract. Lần ba graceful HTTP close không phải
TCP reset; thay bằng reset socket thực. Reset socket sau đó tìm được mapper bug
thực như trên, không nới expected code để cho PASS. Hai session tests bổ sung
StudentProfile/profileCompleteness=0 vào fixture; profile thiếu từng gây404 và một
startup constraint failure, không phải lỗi auth production. Targeted runner gọi
Node trực tiếp để regex grep không bị Windows batch diễn giải thành pipeline.
Một timeout browser xảy ra khi source còn
đang HMR; không suy diễn đây là product root cause. Không nới assertions/timeouts,
không retry/skip test. Các lần setup failure không được tính là PASS.

## 6. Verification

| Check | Execution evidence |
|---|---|
| Backend `mvnw -B -ntp clean verify` | **PASS 520 = 249 Surefire + 271 PostgreSQL Failsafe**, 0 failure/error/skip; giữ baseline 513 và thêm 4 CAS/precondition tests + 1 populated upgrade test + 2 real TCP transport tests |
| Frontend `npm run test:run`, lint, build | **PASS 224 / 35 files**, giữ baseline 211; lint 0 error/warning, build còn bundle-size warning cũ |
| AI locked install/hash + pip check + pytest | **PASS 887**, 1 warning hiện hữu, không đổi AI source/dependencies |
| New isolated reliability | **PASS 26/26**, 142.91s, 0 failure/skip/flaky/retry; 26 evidence cases; 6 responsive recovery screenshots (Student/Company ×390/768/1440) |
| Existing default 66 | **PASS 66/66**, 417.84s, 0 failure/skip/flaky/retry; đủ 79 routes và N07 35 screenshots/assertions |
| Existing settings isolated | **PASS 6/6**, 12.42s, 0 failure/skip/flaky/retry |
| Existing analytics isolated | **PASS 6/6**, 14.78s, 0 failure/skip/flaky/retry |
| B06 bounded diagnostics | **PASS 3/3**, 47.9s: 6 fresh-session +12 retained-reload +12 route-remount rounds, 30/30 PASS, 0 pageerror; historical issue **UNRESOLVED / NOT REPRODUCED** |
| N07 long-context diagnostic | **PASS 1/1**, 21.0s: 30 settings +5 inbox screens, 202 safe API summaries, 0 console/pageerror; request failures chỉ `ERR_ABORTED`; historical cause **UNRESOLVED / NOT REPRODUCED** |
| Final preservation | API metadata/identity/password/preferences/profile content PASS; strict CV full-row **FAIL/exit1, 2 updated_at mismatches**; separate content comparator **PASS/0 mismatch**, không đổi baseline |

Backend logs đầu có failure ở exact latest-version assertions và legacy `SELECT *`
copy sau additive schema change. Giữ `reliability-backend-{first,second}-verify.log`;
final `reliability-backend-verify.log` và XML counts là bằng chứng PASS sau cập nhật
fixtures/assertions đúng V21, không xóa hoặc bỏ qua các tests đó.
Artifacts dưới `e2e/.local/` gitignored, không upload raw credentials/HTTP artifacts.

## 7. B06/N07, preservation và diff

B06 và N07 giữ **UNRESOLVED / NOT REPRODUCED** nếu bounded diagnostics không tái
hiện lỗi gốc. Passing normal case không chứng minh đã sửa nguyên nhân. B06 đo
fresh sessions/retained reloads/remounts, body/status/requestId/session fingerprint
và DOM; N07 giữ toàn bộ 35 screens/assertions hiện hữu, thêm isolated diagnostic
sequence có network/renderer/body flags, không lưu token hoặc private response body.

Migration upgrade test so sánh mọi field V20 cũ và constraints; các historical
migration tests giữ assertions, chỉ cập nhật latest version/count 21 và copy đầy
đủ cột schema V19 tường minh thay `SELECT *` từ schema mới. Không bỏ regression.
Strict comparator và content comparator vẫn riêng; mọi mismatch cuối phải ghi rõ.

Backend-only rebuild lên V21: migration **21/21 successful**. Separate upgrade
proof trên 5 accounts so sánh exact mọi field cũ (account/preferences/inbox/unread/
Company dashboard/report); chỉ thêm **7 response revision fields, tất cả 0**.
Không sửa strict comparator để bỏ revision. Sau capture snapshot V21, controlled
recreate riêng Backend: **5/5 exact snapshots PASS**. AI/PostgreSQL container ID,
image ID và StartedAt giữ nguyên; hai named volumes giữ name/driver/CreatedAt.
Evidence: `reliability-migration-preservation.json`, `reliability-runtime-persistence.json`,
`reliability-environment-preservation.json`. Không reset database/storage.

Final API inventory giữ **28/28 aliases cũ**, **13/13 CV metadata cũ với 4 READY**,
**16 PRIMARY Jobs, 3 PRIMARY Applications (24 REVIEWED, 9 PENDING, 1 REVIEWED)**,
1 PRIMARY bookmark. Demo cuối 30 aliases; thêm hai Student phụ của Saved Candidate
regression, public statistics Jobs20/Companies4 giữ, Students24→26,
Applications154→168 là legitimate secondary histories. Không reset WITHDRAWN,
không xóa protected data để tái sử dụng fixture.

SQL hashes xác nhận mọi field của **69 old Student runs/1380 results** và
**46 old Company runs/138 results** giữ nguyên. Positive default journeys thêm
3/60 và 2/6 tương ứng. Strict baseline vẫn báo CV IDs1/2 đổi digest vì A03 activate/
restore cập nhật `updated_at`; separate baseline bỏ **duy nhất CV updated_at** có
0 mismatch. Không tuyên bố toàn DB/files byte-for-byte unchanged. PRIMARY Company
account so riêng toàn bộ business fields: PASS; revision **0→2** và updatedAt
đổi đúng hai positive B11 save/restore, không bỏ những thay đổi này khỏi báo cáo.

Evidence local: `reliability-{auth,cas,dispatch,reset-body}-before.log`,
`reliability-backend-verify.log`, `reliability-frontend-{tests,lint,build}.log`,
`reliability-ai-{install,pip-check,tests}.log`, `reliability-isolated-{run.log,
results.json,evidence.json}`, bốn checkpoint isolated failure JSON/logs,
`reliability-{default,b06,n07}-{run.log,results.json}`, `reliability-b06-evidence.json`,
`reliability-settings-resource-evidence.json`, strict/content/security/row
preservation JSON và `reliability-final-company-content.json`. Không commit raw artifacts.

Diff review: **67 paths** thuộc source/tests/harness/docs của package; staged
`git diff --check` PASS sau bỏ một blank line EOF. Scan against **49 actual local
secret values**: PASS/0 finding, không in values. AI source/dependencies và V1–V20
migrations không thay đổi; chỉ additive V21. Pre-existing build metadata,
`.agents/`, `skills-lock.json` và `.local/` artifacts không stage/commit.

## 8. Remaining / acceptance

Đề xuất nghiệm thu phạm vi fixes/session/CAS/AI failure-recovery đã có execution
evidence ở trên, với strict timestamp exception và hai historical issues ghi rõ.
Giữ PR Draft để review precondition mới của hai PUT; client cũ thiếu If-Match sẽ
nhận428, không phải silent backward compatibility. B06/N07 chỉ được đổi trạng
thái khi có reproduction/root cause/failing regression chứng minh. Không thay
permission Windows, không lập lịch nguồn, không merge hoặc force push.
Logout/đổi mật khẩu vẫn không hủy request đã được Backend chấp nhận dưới JWT cũ
hoặc revoke các tab khác. Bản sửa bảo vệ identity lúc dispatch và việc dùng response;
không tuyên bố bảo đảm distributed cancellation hoặc exactly-once generation.
