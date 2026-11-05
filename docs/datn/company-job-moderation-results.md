# P0 — Company verification và Job moderation: kết quả

Checkpoint lịch sử tại `3bd7a88d`. Gap profile aggregate được nêu trong giới hạn bên dưới đã được xử lý ở [P0 atomic save/concurrency](student-profile-atomic-save-results.md), cùng migration V19. Counts/HTTP moderation evidence dưới đây giữ nguyên mốc lịch sử.

Branch `design/datn-ui-ux-refresh-20261102`, baseline `caa33f540c0837554cc4220effed15765ddcbb89`, PR [#66 Draft](https://github.com/binkadev/student-job-recommendation-system/pull/66). Master `e019f7a4` là ancestor; HEAD/working tree đã kiểm trước sửa. Giữ ngoài commit các thay đổi có sẵn: `frontend/tsconfig.app.tsbuildinfo`, `.agents/`, `skills-lock.json`.

## Quyết định và thay đổi

[Chính sách](company-job-moderation-policy.md) đối chiếu Flyway, API, service/security/DTO/tests trước implementation. Không có contract bắt buộc self-verification/self-approval cần giữ lại. Các quyết định tường minh:

- COMPANY register → Company PENDING, User ACTIVE. Chỉ Admin xác thực/chặn; Company vẫn login, hoàn thiện hồ sơ, lưu DRAFT.
- Tạo tin chỉ DRAFT hoặc PENDING_APPROVAL; pending yêu cầu VERIFIED. Company không được gán ACTIVE/REJECTED/EXPIRED; Admin phải duyệt tin PENDING_APPROVAL.
- PUT nội dung chỉ DRAFT, cả Admin; field `status`/unknown bị từ chối. Chủ động withdraw/close/return-to-draft trước khi sửa; mở lại phải qua review.
- Block/unverify không cascade Job, không đổi Application/CV/history. Filter hiện hữu ẩn ACTIVE jobs; Admin reverify khôi phục tin vẫn ACTIVE và còn hạn. Đây là quyết định Admin tường minh.
- `publishedAt` giữ first publication; no-op không reset timestamp; manual EXPIRED giữ semantics hiện tại, không thêm scheduler/date validation lúc duyệt.

Backend thực thi state machine, role, ownership, Company status, visibility và apply gate. Company verification, profile writes và Job mutations cùng lấy Company row lock trước khi đọc/sửa; Job write sau đó lấy Job lock. Không giữ transaction qua AI call. Frontend hiển thị trạng thái thật, lưu DRAFT trước xác thực, disable gửi duyệt khi chưa VERIFIED, có withdraw/return-to-draft và close confirmation ở edit deep link. Không có nút Company self-approve/reject.

Không thay AI, CV pipeline V2, TF-IDF/Cosine, V3 scoring/weights/tier/official ranks hoặc corpus query. Public Job/corpus query ACTIVE+VERIFIED+deadline đã có sẵn được giữ nguyên. Generic authenticated `/jobs` thêm VERIFIED gate cho Student/cross-company view; deadline semantics cũ của API generic được giữ. Persisted recommendation/application history vẫn là lịch sử, không tự rewrite khi Company thay status.

## Negative evidence trước sửa

`JobModerationApiIT` chạy với production code baseline: **6 tests, 5 failures, 0 errors/skips**. Đã tái hiện Company register VERIFIED, illegal status trả 200, sửa nội dung ACTIVE trả 200, Admin DRAFT→ACTIVE trả 200, hai lượt approve/reject cùng trả 200. Ownership test đã pass từ baseline; giữ nguyên assertions. Ma trận baseline dừng ở assertion sai đầu tiên, không coi là đã chạy đủ 216 cases.

Rà soát cuối phát hiện thêm profile PUT có thể ghi Company status cũ đè lên Admin BLOCKED. Test PostgreSQL giữ transaction Admin API, cho profile PUT cạnh tranh, đợi DB lock rồi commit đã tái hiện **expected BLOCKED, actual VERIFIED**. Sửa profile PUT dùng cùng row lock; test buộc cả description mới được lưu và status vẫn BLOCKED. Observer lấy PID của transaction giữ lock trước khi Awaitility chạy trên connection khác; không dùng sleep tùy đoán hay mock repository.

Hai unit fixtures Application vốn không có Company (không thể có ở DB với FK) được bổ sung Company VERIFIED để kiểm constraint-error mapping cũ; không bỏ/đổi assertion hợp thức hóa lỗ hổng.

## Bảng transition: expected và actual

Evidence tự động tại [JobModerationApiIT](../../backend/src/test/java/com/tttn/jobrecommendation/integration/JobModerationApiIT.java), [Frontend tests](../../frontend/src/pages/recruiter/RecruiterJobModeration.test.tsx), [real moderation E2E M01–M04](../../e2e/tests/moderation.spec.mjs). Ký hiệu **J** = ma trận 216 PATCH cases (2 roles × 3 Company states × 6 from × 6 target), **C** = 36 creation cases + 6 omitted-status defaults, **V** = 9 Company transitions + 18 role denials; tất cả có HTTP và persisted-state assertions.

| Role / Company | Trạng thái trước | Hành động | Trạng thái sau | Expected HTTP | Actual evidence |
|---|---|---|---|---|---|
| Guest COMPANY register | Chưa có | Register | Company PENDING / User ACTIVE | 201 | IT register; real first M01 setup: 201/PENDING; login thành công |
| ADMIN | Company PENDING/VERIFIED/BLOCKED | Verify/block/return pending, kể cả no-op | Company target | 200 | V: cả 9 tổ hợp; M01–M04 dùng Admin API |
| COMPANY / STUDENT | Company bất kỳ | Admin Company status API | Giữ nguyên | 403 | V: 18 denials; M01/M02 |
| COMPANY / ADMIN, mọi Company state | Chưa có Job | Create DRAFT / bỏ status | DRAFT | 200 | C; M01 lưu nháp trên browser khi Company PENDING |
| COMPANY / ADMIN, VERIFIED | Chưa có Job | Create PENDING_APPROVAL | PENDING_APPROVAL | 200 | C |
| COMPANY / ADMIN, PENDING/BLOCKED | Chưa có Job | Create PENDING_APPROVAL | Không tạo | 403 | C; real M01: 403 |
| COMPANY | Chưa có Job | Create ACTIVE/REJECTED/EXPIRED | Không tạo | 403 | C; real M01: cả 3 trả 403 |
| COMPANY / ADMIN | Chưa có Job | Create CLOSED; Admin create ACTIVE/REJECTED/EXPIRED | Không tạo | 400 | C |
| COMPANY owner / ADMIN, VERIFIED | DRAFT | Submit | PENDING_APPROVAL | 200 | J; M02/M04 200; browser M02 submit rồi reload |
| COMPANY owner / ADMIN, PENDING/BLOCKED | DRAFT hoặc bất kỳ | Target PENDING_APPROVAL/ACTIVE | Giữ nguyên | 403 | J; M01 submit 403; M03 Admin activate 403 |
| ADMIN, VERIFIED | PENDING_APPROVAL | Approve | ACTIVE | 200 | J; M02/M03 200 |
| ADMIN | PENDING_APPROVAL | Reject | REJECTED | 200 | J; M02 200 |
| COMPANY | Bất kỳ | Target ACTIVE/REJECTED/EXPIRED, kể cả no-op | Giữ nguyên | 403 | J; real M01/M02 |
| COMPANY owner / ADMIN | PENDING_APPROVAL | Withdraw | DRAFT | 200 | J; browser M02 click/reload/read-back |
| COMPANY owner / ADMIN | REJECTED/CLOSED/EXPIRED | Prepare edit/reopen | DRAFT | 200 | J; M02 REJECTED→DRAFT; browser CLOSED→DRAFT |
| COMPANY owner / ADMIN | Bất kỳ | PATCH CLOSED; DELETE soft-close | CLOSED | 200 | J PATCH; browser M02 explicit confirm, fixture DELETE hợp lệ |
| ADMIN | ACTIVE | Mark EXPIRED | EXPIRED | 200 | J |
| COMPANY owner / ADMIN | DRAFT/CLOSED | Same-state | Giữ nguyên | 200 | J |
| COMPANY owner / ADMIN, VERIFIED | PENDING_APPROVAL | Same-state | Giữ nguyên | 200 | J |
| ADMIN | ACTIVE/REJECTED/EXPIRED | Same-state; ACTIVE cần VERIFIED | Giữ nguyên | 200 / 403 | J |
| COMPANY owner / ADMIN | DRAFT | PUT nội dung | DRAFT, content mới | 200 | IT content matrix; M01 browser save/reload |
| COMPANY owner / ADMIN | Non-DRAFT | PUT nội dung | Giữ nguyên | 400 | IT: cả 5 states × 2 roles; real M02 ACTIVE: 400 |
| COMPANY owner | DRAFT | PUT `{status: ACTIVE}` | DRAFT | 400 | IT + real M02: 400; FE PUT không gửi status |
| COMPANY B | Job của Company A | PUT/PATCH approve/DELETE | Giữ nguyên | 403 | IT ownership; M02 cả 3 API: 403 |
| STUDENT | Job/Company bất kỳ | Create/update/review/close/verify | Giữ nguyên | 403 | IT + M02; existing A08/S01 |
| COMPANY owner / ADMIN | Mọi edge khác | Ví dụ CLOSED→PENDING hoặc Admin DRAFT/CLOSED→ACTIVE | Giữ nguyên | 400 | J; real M02: 400 |
| ADMIN / profile owner cạnh tranh | Company VERIFIED | Admin block + Company profile PUT | BLOCKED, description mới | 200 / 200 | Deterministic PostgreSQL IT; trước fix bị revert VERIFIED |
| Hai ADMIN requests cạnh tranh | PENDING_APPROVAL | Approve vs reject | Chỉ một quyết định hợp lệ | 200 + 400 | IT; M04: ba rounds đều [200,400] |

Quyền/Company gate được kiểm trước edge: target bị cấm trả 403 dù edge cũng sai. Public/non-owner reads không thay dữ liệu:

| Người gọi | Điều kiện | Expected | Actual evidence |
|---|---|---|---|
| Guest/public search/detail | DRAFT/PENDING/REJECTED/CLOSED/EXPIRED hoặc Company không VERIFIED | Không hiện; detail 404 | Existing PublicJobApiIT + A01/A08; M01/M03 |
| Student generic list/detail | Company PENDING/BLOCKED với Job ACTIVE | List không có; detail 403 | IT visibility; real M03 |
| Student apply | Job ACTIVE nhưng Company PENDING/BLOCKED | 400, không tạo application | IT visibility; real M03 |
| Student UI / public search | Company BLOCKED | Error detail/không có kết quả | M03 Chromium; không có heading Job ở Student detail |
| Public sau Admin reverify | Job vẫn ACTIVE, còn hạn | 200, hiện lại | M03 browser; Job status/updatedAt không đổi qua block/unverify |

## Verification

- Backend full PostgreSQL lifecycle: `cd backend; .\mvnw.cmd -B -ntp clean verify` **BUILD SUCCESS, 466 PASS = 247 Surefire + 219 Failsafe**, 0 failures/errors/skips; kết thúc `2026-11-03T20:40:48+07:00`. Chín moderation integration tests đều pass. PostgreSQL destructive fixture cleanup chỉ chạy trong Testcontainers integration profile, không chạy vào dev database.
- Frontend: `npm.cmd run test:run` **148 tests / 23 files PASS**; lint PASS, zero warnings; TypeScript/Vite production build PASS. Existing bundle >500 kB warning vẫn còn.
- AI: existing locked environment `python -m pip check` PASS; `python -m pytest` **887 PASS**, một Starlette/httpx deprecation warning. Không thay dependency/model/corpus/scoring.
- Real Playwright: **36/36 PASS**, 0 fail/skip/flaky/retry, một worker, Backend/AI/PostgreSQL thật và Chromium. Gồm 12 API, 17 browser, 4 moderation, 1 scanner đủ 79 routes, 2 security/password. Navigation smoke không thay business assertions.
- M01–M04 ghi **53 expected/actual HTTP checks**, không mismatch, ngoài các browser/read-back/concurrency assertions. First run đã register thật Company mới 201/PENDING; các lần sau reuse alias rõ ràng.
- Existing regression gồm login/role guard, CV PDF/DOCX Việt/Anh/ownership, Apply/reapply, notifications, persisted Recommendation V3 hai tier/formula/null/ranks/immutable snapshot và Company Ranking V3 independent limits/ranks. Không suy ra exhaustive product acceptance.

## Dữ liệu và rebuild

`docker compose up -d --no-deps --build backend` chỉ recreate Backend; PostgreSQL và AI giữ container cũ. Named volumes `student-job-recommendation-system_postgres_data`, `student-job-recommendation-system_cv_uploads` được giữ; không dùng down/reset/volume rm. Flyway dev vẫn 18 successful migrations, không migration/backfill/SQL write vào dev. Setup mới chạy hai lần thành công qua API, không auto-verify/unblock/reset Company cũ, không sửa live Job thiếu kỹ năng một cách âm thầm.

API baseline lúc `2026-11-03T13:13:03.768Z`; [read-only comparator](../../e2e/verify-preservation.mjs) so với read-back cuối xác nhận:

- Giữ cả **9 alias cũ**, User ID/resource ID/role/status; hai PRIMARY không đổi.
- **4 CV cũ** giữ ID/filename/active flag/READY/language/processingVersion. PRIMARY CV 1 VI DOCX active, CV 2 EN PDF vẫn còn.
- **16 Job PRIMARY** giữ id/title/status/deadline/skills đã snapshot, không chuyển status hàng loạt. Job 11–25 và browser draft 26 còn nguyên.
- **3 Application PRIMARY** giữ id/job/status/CV: 24→Job11 REVIEWED, 9→Job12 PENDING, 1→Job20 REVIEWED.
- Thêm đúng **1 alias riêng** `moderationCompany`, Company 6, và **4 Job riêng** 27–30, không xóa sau test. Kết thúc Company riêng PENDING; Job 27 DRAFT, 28–30 CLOSED, không thêm tin công khai. Credentials mạnh/ngẫu nhiên lưu local với ACL cũ, không commit/log JWT/password.
- Public counts vẫn **20 jobs / 4 companies / 6 students**. Application history 36→42 do sáu reapplication phụ hợp lệ ở A09 qua hai lượt suite; không phải duplicate active pair hay mutation PRIMARY.

Comparator chỉ xác nhận các trường đã snapshot, không tuyên bố so sánh byte toàn bộ database/CV. Raw credentials, CVs, logs, Playwright JSON/screenshots/trace nằm trong `e2e/.local` và `test-results` bị gitignore; không đưa lên PR.

## Artifact map và giới hạn

Local logs: `p0-baseline-negative.log`, `p0-profile-race-before.log`, `p0-backend-verify.log`, `p0-frontend-{tests,lint,build}.log`, `p0-ai-{pip-check,tests}.log`, `p0-backend-rebuild.log`, `p0-setup-{1,2}.log`, `p0-final-{e2e.log,results.json}`, `moderation-evidence.json`, `p0-preservation-evidence.json`. `p0-first-{results,moderation-evidence}.json` giữ evidence đăng ký mới trước lượt rerun reuse alias. Credential/Authorization traces tắt; chỉ trace guest public được giữ như runner hiện hữu.

PR #66 giữ Draft, không merge. G01 được xử lý; profile aggregate atomicity, >100 own-job pagination, các unsupported modules, AI outage/session expiry và accessibility/performance sâu trong audit trước vẫn là gap riêng. Review UI Admin và upload chứng từ xác thực không thuộc scope; moderation dùng Admin API thật hiện hữu. Row locks serialize mutation trong cùng Company, chưa có throughput benchmark riêng cho đường ghi này.

Checkpoint cuối: image Backend cuối tạo `2026-11-03T13:42:32.955Z`; Playwright bắt đầu `13:42:53.427Z`, kết thúc sau 125.88 giây: 36 expected, 0 unexpected/skipped/flaky. Data comparator lúc `13:45:54.910Z` PASS. Ba services healthy; PostgreSQL/AI containers giữ thời điểm tạo `11:44:31Z`, hai named volumes giữ nguyên. Staged diff/check và scan credential/artifact PASS; không có thay đổi AI/V3 corpus/ranking/migrations trong diff của work package này.
