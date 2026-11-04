# Company candidate management — functional completion

Ngày 2026-11-04, Asia/Bangkok. Baseline `a591ea23e197c0de6b0cb2986f9eeecf4a629449`, branch `design/datn-ui-ux-refresh-20261102`. PR #66 giữ **Draft**, không merge/force push. Đã fetch và xác nhận `origin/master` (`e019f7a4`) là ancestor. Dirt có sẵn: `frontend/tsconfig.app.tsbuildinfo`, `.agents/`, `skills-lock.json`; giữ ngoài commit. Docker Desktop ban đầu chưa chạy; khởi động lại trên Windows 11, giữ các containers/volumes hiện hữu, rồi chỉ rebuild/recreate Backend.

## 1. Audit và phạm vi

Đã đọc AGENTS/CODEX_GUARDRAILS, README/project-status/final-verification, API/active V3 contracts, schema/DBML/Flyway, SavedCandidate controller/service/repository/entity/mapper/DTO/tests, Company Application APIs và CV streaming, Recruiter candidate/saved pages, auth/session/async hooks và Playwright hiện hữu.

| Chức năng trước sửa | Thực trạng executable source |
| --- | --- |
| Company xem ứng viên/application/CV | Đã gọi Backend thật; application/CV ownership dựa vào Job của Company. CV streaming chỉ nhận application ID. |
| Save/unsave | Đã có POST/DELETE, persistence V13, unique `(company_id, student_id)`; `application_id` là nguồn, không phải Saved Application uniqueness. |
| Ghi chú | **Đã có nullable TEXT `note` và POST nhận note tối đa 2.000 ký tự. Chưa có API sửa note.** UI luôn gửi null và không có editor. |
| Tìm kiếm/pagination | Backend đã có keyword/page/size/sort; saved UI chỉ phân trang, chưa có controls search/filter. |
| Trạng thái saved candidate | Response chưa có application status; UI saved không thể thể hiện trạng thái hiện tại của đơn nguồn. |
| Loading/error/concurrency | Save/unsave chưa có synchronous action lock/confirmation; có thể click lặp. Note chưa có draft revision để chống lost update. |

Đây là thay đổi Backend/DB/Frontend/integration cho quản lý ứng viên, không thay thuật toán, Application state machine hoặc CV processing. Skill UI dùng: `ui-ux-pro-max` (focus/modal/loading/error/responsive), giữ components/design hiện có. Không dùng Sites/AI-generated UI hay mock Backend trong E2E.

## 2. Thay đổi đã triển khai

- `PATCH /api/companies/me/saved-candidates/{id}/note` nhận `{note, revision}`. Trim note; null/blank xóa nội dung; giới hạn 2.000 ký tự; revision bắt buộc và không âm; reject unknown fields. Response là `ApiResponse<SavedCandidateResponse>`.
- **V20** chỉ thêm `revision BIGINT NOT NULL DEFAULT 0` cho `saved_candidates`, map Hibernate `@Version`. V1–V19 không sửa. Note text, source application và uniqueness cũ được giữ. PostgreSQL upgrade test thực sự migrate schema V19 có bookmark/note lên V20 rồi so sánh mọi field cũ.
- Response thêm `revision`, `applicationStatus`. Status đọc trực tiếp từ persisted **source application**, không suy luận candidate-wide từ note, score, saved flag hoặc application khác. Sau reapply, bookmark vẫn trỏ đơn nguồn cũ; UI ghi rõ điều đó.
- GET thêm `studentId`, `jobId`, `applicationStatus`; keyword thêm note, escape `%`, `_`, backslash như ký tự literal. Ownership predicates, count, filter và pagination chạy trong database; default newest với `id DESC` tie-breaker.
- Save/delete/note update khóa Company row trong transaction để tuần tự hóa mutations cùng owner. Unique constraint vẫn là lớp bảo vệ DB. Không giữ transaction cho AI call; các thao tác này không gọi AI.
- Saved UI có search, Job nguồn, trạng thái đơn nguồn, page size 1/10/25, phân trang, reload, note editor/counter, xác nhận bỏ lưu có giải thích note sẽ bị xóa. Không client-filter sau LIMIT. Empty page sau bỏ lưu có đường về trang đầu.
- Các thao tác save/note/delete có pending/error state và ref lock chặn double-click/overlap. Không báo success trước API. Note thất bại giữ draft; stale draft cần explicit read-back/compare, không fetch revision mới rồi tự ghi đè. Reload/relogin đọc persistence thật.
- Candidate list/detail khóa Save khi saved state chưa tải/xác minh. Workspace và mutation completions được cô lập theo phiên. HTTP 401 từ request của phiên cũ không xóa token của phiên Company mới; 401 đúng phiên vẫn expire như trước.
- Mapper saved không fallback sang stored filename nếu original filename thiếu. Chi tiết ứng tuyển dựa vào `cvFileId` để hiển thị nút CV; không suy ra mất file từ thiếu display filename.

Nhóm file chính: Company DTO/controller/service/entity/mapper; migration V20 và migration inventory tests; `SavedCandidateApiIT`; `RecruiterCandidatesPage`; `features/recruiter/saved-candidates/*`; HTTP client và tests; real Playwright journeys, preservation/SQL round-trip tooling; API/schema/DBML/report.

## 3. Business rules và HTTP thực tế

| Tình huống | Expected HTTP | Actual/evidence |
| --- | --- | --- |
| Save từ owned application | 200 | PostgreSQL IT, C02 và DB round-trip |
| Save đồng thời cùng Company/Student | Một 200, một 409 `SAVED_CANDIDATE_ALREADY_EXISTS` | Controlled PostgreSQL IT và hai requests thật C03 |
| Save application Company khác | 403 `ACCESS_DENIED` | IT/C03; không tạo bookmark |
| Save application không tồn tại | 404 `RESOURCE_NOT_FOUND` | C03 |
| GET saved list/filter Company khác | 200, chỉ dữ liệu của JWT owner / empty filter | IT/C03/C05 |
| Note update hợp lệ/clear | 200, note mới/null và revision phù hợp | IT/C02/SQL round-trip |
| Hai note drafts cùng revision, nội dung khác | Một 200, một 409 `SAVED_CANDIDATE_REVISION_CONFLICT` | IT stale write + real concurrent C03; component test giữ stale draft |
| Note thiếu/âm revision, unknown field, >2.000 ký tự | 400 | PostgreSQL IT; C03 kiểm độ dài |
| Note/delete bookmark Company khác hoặc ID không còn | 404 `SAVED_CANDIDATE_NOT_FOUND` | IT/C03; không tiết lộ bookmark foreign |
| Hai delete đồng thời | Một 200, một 404 | PostgreSQL IT/C03 |
| Student gọi Company GET/POST/PATCH | 403 | IT/C03 |
| Không token | 401 | IT/C03 |
| CV/detail application Company khác | 403; missing/no-CV/file-missing theo API 404 | C01 foreign detail/CV 403; existing CV security regression giữ nguyên |
| Company BLOCKED quản lý applicant/bookmark của mình | 200 theo policy hiện hữu | IT/C03 GET/save/note/delete; secondary Company được restore VERIFIED trong finally |
| Note/unsave/save offline | Không success giả; không DB mutation tương ứng | C04, component tests, GET/SQL read-back |

Company verification gate điều khiển publication/visibility của Job, không tự cấm internal applicant/bookmark operations. Không lẫn **Company BLOCKED** với inactive/blocked **User** trong authentication. Student/Company khác không đọc note qua Application DTO, ranking response hay saved list. App/CV/Student/Job không bị xóa khi unsave. Withdrawn application vẫn saveable như contract cũ.

`applicationStatus` là trạng thái đơn nguồn ở thời điểm đọc, không phải realtime push. Focus/storage signals chỉ invalidation/refetch; không truyền note, CV, JWT hoặc payload cá nhân qua cross-tab signal.

## 4. Role-play và verification

| Kiểm tra | Kết quả |
| --- | --- |
| Backend `mvnw.cmd -B -ntp test` (Java 21) | **247 PASS**, exit 0 |
| Backend `mvnw.cmd -B -ntp clean verify` | **502 PASS** =247 Surefire +255 PostgreSQL Failsafe; 0 failures/errors/skips; 1m47s, kết thúc 12:02:03+07 |
| SavedCandidate PostgreSQL IT | **26 PASS**, gồm migration preservation, ownership, current status, literal note search, pagination, race save/delete và stale notes |
| Frontend `npm.cmd run test:run` | **193 PASS /29 files**, exit 0; gồm 7 saved-candidate component/hook cases và 2 HTTP session tests |
| Frontend lint / TypeScript + Vite production build | **PASS**, exit 0; bundle >500 kB warning hiện hữu còn |
| Existing locked AI env `pip check`, `pytest` | **PASS**, 887 pytest; một Starlette/httpx deprecation warning; không sửa AI/dependencies |
| New real browser C01–C05, targeted | **5/5 PASS**, 36.8s, không route mock/retry/skip |
| Full real Playwright (49 cũ +5 mới) | **54/54 PASS**, 328.9s; 0 unexpected/flaky/skipped, retries=0; chạy 12:17:10–12:22:39+07 |
| SQL note/save/clear/unsave round-trip + data comparators | **PASS** theo phạm vi bên dưới; strict initial timestamp mismatch được giữ riêng |

C01 đăng nhập Company PRIMARY, chọn Job của mình, đọc applicant/profile/CV thật, xác minh Company B bị 403 khi truy cập detail/CV. Không mutation PRIMARY trong cases mới. C02 Company B save bằng double-click chỉ một request thành công, thêm/tìm/sửa note, reload và đăng nhập lại, mở CV, xác nhận unsave, đối chiếu Application còn nguyên. C03 kiểm HTTP/ownership, save/note/delete concurrency, status source PENDING→REVIEWED trên secondary application và BLOCKED Company policy. C04 dùng Chromium offline thật cho note/unsave/save, giữ dữ liệu đã xác nhận và draft. C05 kiểm hai trang Backend thật, đổi filter nhanh, năm kích thước màn hình và logout/login Company khác không thấy note.

Responsive saved list/modal: **375/430/768/1024/1440 PASS**, không horizontal overflow; screenshots local. Deterministic unit tests kiểm response cũ đến sau filter mới, mutation completion sau đổi session, pending save không được xen unsave và double unsave không gửi hai request. Các unit mocks này được phân biệt với real Backend browser/SQL evidence.

Lỗi verification ban đầu được giữ local: ba migration inventories còn kỳ vọng V19 (sửa thành V20 và thêm upgrade preservation assertion); C03 locator chọn hidden option thay vì table cell (đổi locator, không bỏ assertion); TSC phát hiện `exact` của Playwright bị dùng trong Testing Library test (bỏ option không hợp lệ, giữ assertions). Full run đầu **53/54**, B08 offline quá sớm khi application history chưa xác nhận: thêm một assertion chờ nút “Đã ứng tuyển” trước offline; toàn bộ 49 case/assertions cũ giữ nguyên. Không tăng timeout, không skip/retry hoặc mock HTTP để làm xanh.

## 5. Data preservation và giới hạn comparator

API baseline chụp trước sửa lúc `2026-11-04T04:49:05.918Z`. `summarize-state`/`verify-preservation` giữ 10 alias cũ, 4 CV baseline, 16 PRIMARY Jobs và 3 PRIMARY Applications. PRIMARY profile content được so sánh riêng; positive profile regression tăng revision nhưng restore nội dung, không tự retry draft conflict.

Checkpoint cuối 12:23:22+07: profile revision **30→40**, nội dung khớp; secondary draft31 giữ DRAFT/benefits. Public totals vẫn **20 Jobs/4 Companies**; Student6→16 và Application70→92 do 5 fixture workers (10 Student/5 CV/10 applications) cùng secondary lifecycle/reapply history trong hai full runs, không reset dữ liệu để test lại. 10 alias baseline giữ nguyên IDs/status; 10 alias mới có namespace riêng trong credentials local.

SQL digest baseline strict chụp trước full regression giữ toàn bộ rows của PRIMARY applications, Jobs, saved candidates và existing Recommendation/Ranking V3 runs/results. Comparator strict đầu tiên **không PASS**: CV1/CV2 khác hash vì A03 vốn chủ động activate hai CV và restore active CV, làm thay `updated_at`. Giữ nguyên baseline/failure artifact; không tuyên bố toàn DB byte-for-byte unchanged.

Có baseline SQL **riêng** cho CV content (loại duy nhất `cv_files.updated_at`), không ghi đè/reinterpret snapshot strict. Kiểm lại activation A03/B13 và so sánh đầy đủ các field còn lại, gồm active flag cuối cùng, raw/processed/extracted analysis, processing/language metadata, ownership/storage metadata. API baseline từ đầu package vẫn là đối chiếu độc lập. Checkpoint cuối ghi số lượng rows/deltas và mọi mismatch, không giấu mismatch đầu.

SQL content comparator **PASS, mismatches=[]**: 3 PRIMARY Application rows, 2 CV content rows, 16 Job rows, 1 saved-candidate row, 57 Recommendation runs/1.140 results và 38 Ranking runs/114 results trong snapshot content. Replay riêng A03/B13 **2/2 PASS** trước compare. Snapshot strict cũ vẫn kiểm được 51 Recommendation runs/1.020 results và 34 Ranking runs/102 results có sẵn không bị sửa; các run/results mới là history hợp lệ.

`verify-candidate-roundtrip.mjs` dùng secondary fixture Job47, Applications150/151 và CV80 sau browser cleanup. Save note→revision0, sửa note→1, clear→2 đều HTTP200, MD5 note/ownership/application/revision trong PostgreSQL khớp và fresh login đọc lại đúng. DELETE200; SQL bookmark count=0. Toàn bộ hai Application rows và CV row trước/sau round-trip khớp strict hash. Đây là persistence evidence trực tiếp, không phải state trong browser hay mock response.

Case mới dùng mỗi worker/run hai Student synthetic, một CV thật qua parser hiện hữu, một Job Company B qua DRAFT→PENDING_APPROVAL→Admin ACTIVE, hai Applications thật. AfterAll chỉ bỏ bookmark do test tạo và soft-close Job riêng; giữ tài khoản/CV/application history. Worker restart sau lỗi locator tạo fixture riêng, không reset terminal status để tái dùng. Credentials lưu local, không commit/log trong report.

PostgreSQL và AI containers giữ creation time `2026-11-03T11:44:31Z`; giữ named volumes `student-job-recommendation-system_postgres_data`, `student-job-recommendation-system_cv_uploads`. Không reset volume, SQL write vào DB demo, hard-delete hồ sơ/application hay sửa AI. Testcontainers có database/schema riêng cho integration tests.

SQL cuối xác nhận Flyway **20 / success=true**, các Job fixture39/40/41/44/47 đều CLOSED, không còn bookmark nào trỏ các fixture này. Backend/PostgreSQL/AI healthy.

## 6. Contract safety

Student Recommendation V3, Candidate Ranking V3, CV parse/preprocessing V2, persisted READY snapshot, TF-IDF/Cosine, PRIMARY/FALLBACK mapping, 0.65/0.35, threshold/Top-K, official Backend ranks, eligible corpus và stateless AI boundary **không thay**. Existing Recommendation/Candidate Ranking tests và real A04/A10/B07 vẫn chạy. Application row locking/role transitions/reapply V18 và Student aggregate CAS V19 giữ nguyên.

Public API intentional additions: note PATCH, filter fields và saved response status/revision. Existing POST/DELETE URL/body/success envelope/error policy giữ; GET keyword bổ sung private note và literal wildcard semantics. Persistence intentional change duy nhất là V20 additive version. Không thêm dependency. API contract/schema/DBML đồng bộ với executable behavior.

**B06 giữ UNRESOLVED / NOT REPRODUCED.** Existing normal B06 pass không đủ kết luận nguyên nhân cũ đã fixed; không có failure mới hoặc controlled reproduction mới cho B06 trong package này. Không thay trạng thái này từ kết quả của Company Saved Candidates.

## 7. Tính năng Company còn thiếu và ưu tiên tiếp theo

1. Chưa có messaging/email delivery, interview scheduling, invitations, team members, 2FA hoặc verification document upload; các màn hình placeholder không được báo là đã tích hợp.
2. Candidate search chỉ giới hạn tập đã ứng tuyển/saved; không có global Student/CV discovery hay quyền đọc arbitrary CV. Đây là ranh giới privacy hiện tại.
3. Note hiện là một nội dung của Company trên bookmark, không có audit history/author-per-recruiter, collaborative merge hoặc autosave. Unsave xóa note của bookmark sau confirmation; không xóa application.
4. Không realtime push; cần reload/focus/read-back khi request mơ hồ. Note conflicts cần người dùng đối chiếu; không tự merge/retry. Row lock Company tuần tự hóa internal mutations, cần benchmark nếu quy mô tuyển dụng tăng.
5. Save badges trên applicant list/detail còn đọc các saved pages hiện hữu; tối ưu batch membership theo trang khi có bằng chứng tải lớn. Saved management list đã dùng Backend pagination/filter thật. Job filter cho phép mã nguồn đang hiển thị hoặc keyword theo title, chưa có remote Job autocomplete.
6. Giữ B06 instrumentation và chỉ chốt khi tái hiện được; tiếp đó ưu tiên external legacy profile If-Match rollout, remaining Company flows và accessibility/performance audit toàn sản phẩm. Bundle warning chưa xử lý trong scope này.

## 8. Reproduce, artifacts và bàn giao

Logs/credentials/SQL digests/results/screenshots nằm trong ignored `e2e/.local/`, `e2e/test-results/`; không commit raw artifacts hoặc secrets. Command examples trên Windows:

Diff safety: `git diff --cached --check` PASS; scan **33 staged paths PASS**, không có credential local/JWT/private-key match, AI change, binary artifact, env file hoặc dirt có sẵn trong index. Nội dung secret chỉ được so sánh trong host process, không in ra logs/chat. Không thêm dependency, không sửa released migration.

```powershell
# Existing localhost stack; no docker volume reset.
$env:E2E_USE_DEV_SEED_ADMIN='1'
cd e2e
.\node_modules\.bin\playwright.cmd test
.\node_modules\.bin\playwright.cmd test company-candidates.spec.mjs
node verify-candidate-roundtrip.mjs
node summarize-state.mjs
node verify-preservation.mjs candidates-baseline.json
node verify-own-jobs-preservation.mjs
node verify-candidate-preservation.mjs --cv-content
```

Các baseline phải capture trước lượt kiểm tương ứng; không ghi đè giữa run. SQL tools chỉ chạy SELECT trong `BEGIN READ ONLY`; API round-trip tool chỉ dùng secondary fixture của browser journey gần nhất và từ chối sửa bookmark có sẵn. Xem thêm [E2E runner](../../e2e/README.md), [API](../api-contract.md), [schema](../database-schema.md), [moderation policy](company-job-moderation-policy.md), [lifecycle evidence](student-application-lifecycle-results.md).

Windows host được xác minh bằng OSVersion và Win32_OperatingSystem (Windows 11 Home 64-bit), không phải Docker/WSL. Lệnh fallback `shutdown.exe /s /t 21600` trả **exit 0**. Sau khi báo cáo/checkpoint, kiểm tra diff/secrets, commit/push và cập nhật Draft PR xong, hủy fallback rồi đặt lịch 120 giây; exit codes thực tế ghi local checkpoint cuối. Exit 0 chỉ xác nhận Windows chấp nhận lệnh, không chứng minh máy đã tắt.
