# Manual final demo — dữ liệu thật và kết quả kiểm chứng

Ngày bàn giao: **05/11/2026, Asia/Bangkok**. Frontend: **http://localhost:5173**.
Hai tài khoản đã được tạo bằng registration API, rồi đăng nhập lại bằng credentials
đọc từ file local; không reset password tài khoản cũ.

| Tài khoản chính | Email | Trạng thái |
|---|---|---|
| Nguyễn Minh An — STUDENT | `manual.student@datn-e2e.invalid` | ACTIVE |
| Minh Phát Technology Demo — COMPANY | `manual.company@datn-e2e.invalid` | User ACTIVE, Company VERIFIED |

Mật khẩu ngẫu nhiên riêng biệt chỉ nằm trong `e2e/.local/manual-final-credentials.json`
và bản hướng dẫn local `e2e/.local/manual-final-accounts.txt`. Cả hai được gitignored;
không ghi password/JWT vào tài liệu này, Git hay PR. Hai ứng viên phụ thuộc namespace
`datn-manual-final-v1` chỉ phục vụ fixture; không phải tài khoản chính bàn giao.

**Kết luận:** dữ liệu manual và 31 màn browser đã kiểm chứng hoạt động; **không công bố
FULL/all checks PASS** vì strict original-row preservation vẫn FAIL ở một user Admin
sau đăng nhập hợp lệ. Giữ nguyên evidence và comparator. Các giới hạn UTC và chức năng
UNSUPPORTED bên dưới vẫn áp dụng. Theo yêu cầu bàn giao tiếp nối, commit/push chỉ
chứa scripts và báo cáo đã kiểm tra, đồng thời giữ công khai strict FAIL và phần
Admin business history chưa đủ dữ liệu đối chiếu. Không seed lại ở lượt bàn giao.

## Baseline và phạm vi

- Branch `design/datn-ui-ux-refresh-20261102`, HEAD `2cdc9134bb6834764faba7c7ceac2197f5e2ae21`.
- Đúng branch/baseline người dùng chỉ định; tiếp tục work package trên branch này.
- Dirt có sẵn giữ nguyên: `frontend/tsconfig.app.tsbuildinfo`, `.agents/`, `skills-lock.json`.
- PR [#66](https://github.com/binkadev/student-job-recommendation-system/pull/66)
  được đọc lại: OPEN, Draft=true, merged=false. Không cập nhật/merge PR.
- Gap ban đầu: chưa có bộ manual-final; không cần sửa Backend/AI/Frontend/schema.
- Đã đọc guardrails, V3 contract, moderation/lifecycle/profile/settings contracts,
  source/DTO/controller/migrations liên quan và các evidence hiện hữu.
- Trước seed: snapshot **19 business tables / 2.867 rows** và hai named volumes.
  Hash bao gồm timestamps; không export password hashes hoặc raw CV vào report.
- Admin fixture dev hiện hữu đã xác thực; Company verification và Job approval
  đều qua Admin API. Không tạo Admin, không sửa Admin UI/module, không SQL writes.

## Dữ liệu đã persist

Company ID **7**, Student ID **31**, user IDs chính **38/39**. Job IDs **78–88**.
Profile Student có tên/ngành/trường giả định/năm tốt nghiệp/địa điểm, summary,
education, experience, projects, 7 manual skills (Java, Spring Boot, PostgreSQL,
SQL, Git, Docker, REST API). Career preferences lưu thật qua Student profile API:
Backend Java Intern/Fresher, Thành phố Hồ Chí Minh, INTERNSHIP.
Company có mô tả, ngành, địa chỉ và website giả định hợp lệ; phone để trống.
Notification preferences của hai tài khoản lưu qua API với bốn flags hợp lệ.

| CV chính | Ngôn ngữ / confidence | Trạng thái | Extracted skills | Active |
|---|---|---|---|---|
| **121**, PDF tiếng Anh | en / 1.00 | READY | 8 | Có |
| **122**, DOCX tiếng Việt | vi / 0.96 | READY | 10 | Không |

Cả hai upload/analyze qua Backend → parser AI thật, có persisted processedText,
language metadata và processingVersion `bilingual-nlp-v2-skills-v1`.
Student download cả hai HTTP200; Company download CV qua application HTTP200.
Hai ứng viên phụ có CV READY **123/124**. Tổng CV mới: **4**.

| Job status | Số lượng |
|---|---:|
| ACTIVE | 8 |
| DRAFT | 1 |
| PENDING_APPROVAL | 1 |
| CLOSED | 1 |
| Tổng | **11** |

Các vị trí Backend Java, Java Fresher, React, Fullstack, Python Backend,
Data Analyst, QA và DevOps có nội dung Việt/Anh, requirements, canonical skills,
location, salary/benefits, deadline 2027-12-31. Tất cả khởi tạo DRAFT, publish qua
PENDING_APPROVAL → Admin ACTIVE; tin CLOSED đi qua ACTIVE → Company CLOSED.

| Application status | Student chính | Toàn Company |
|---|---:|---:|
| PENDING | 2 | 7 |
| REVIEWED | 1 | 2 |
| ACCEPTED | 1 | 1 |
| REJECTED | 2 | 2 |
| WITHDRAWN | 1 | 1 |
| Tổng history rows | **7** | **13** |

Company có **3 unique Students**. Application **283 REJECTED → 284 PENDING** là
hai history rows reapply hợp lệ trên Job83. WITHDRAWN được Student thực hiện;
không reset trạng thái terminal. Browser thực hiện thêm REVIEWED cho application
**287** của ứng viên phụ. Saved Jobs **3**; Saved Candidates **3** (IDs69–71),
ghi chú thực sự persisted với V20 revision **1/1/2** sau chỉnh sửa browser.
Student chính có **4** notification APPLICATION_STATUS_CHANGED thật từ producer
application lifecycle. Company inbox **0**, đúng producer hiện hành, không fake.

## V3, dashboard, reports và CSV

| Loại / Run | CV hoặc Job | Results | PRIMARY / FALLBACK |
|---|---|---:|---|
| Recommendation91 | CV121 | 28 | 18 / 10 |
| Recommendation92 | CV122 | 28 | 10 / 18 |
| Recommendation93 — browser | CV121 | 28 | 18 / 10 |
| Candidate Ranking53 | Job78 | 3 | 0 / 3 |
| Candidate Ranking54 | Job79 | 3 | 1 / 2 |
| Candidate Ranking55 — browser | Job79 | 3 | 1 / 2 |

Tất cả persisted SUCCESS. Tổng **3 Recommendation runs / 84 results** và
**3 Candidate Ranking runs / 9 results**; SQL đối chiếu API khớp.
Job78 thực tế cho toàn FALLBACK; không sửa language/score để tạo PRIMARY giả.
Verifier kiểm tra finite [0,1], deprecated score alias, strategy/tier/nullability,
0.65/0.35 formula, ordering/tie break, global Student rank, tier ranks, explanation,
history và quyền truy cập. Không thay TF-IDF/Cosine/V3/Top-K hay AI boundary.

Dashboard total11 Jobs/13 applications/3 Students, status counts khớp SQL.
Dashboard 7/30/90 trả đủ số buckets; browser kiểm tra cả ba lựa chọn.
Reports khoảng 7/30/90 kết thúc **2026-11-05** lần lượt bắt đầu
2026-10-30 / 2026-10-07 / 2026-08-08: đều **13** application rows.
CSV mỗi khoảng **13** data rows, đối chiếu toàn bộ application IDs với Backend.
Browser download CSV thật và xác nhận **13** rows với report API.

**Giới hạn thời gian:** cả13 application timestamps mới có civil date2026-11-05.
Tại lúc kiểm tra, clock UTC là2026-11-04 trong khi application producer dùng
local datetime +07. Dashboard UTC trend kết thúc2026-11-04 nên cả7/30/90 có0
trong trend, dù all-time total13. Verifier xác nhận0 khớp chính date filter đó;
không diễn giải thành không có application. Đây là timestamp convention limitation
đã được ghi trong analytics contract/evidence cũ; không sửa producer hoặc SQL
backdate trong task này. Reports không lọc ngày và khoảng explicit gồm05/11 có đủ
13. Chưa có lịch sử nhiều ngày; không claim trend hoạt động tuyển dụng dài hạn.

## Browser thật: PASS trong lượt hoàn tất

Chromium headless qua frontend **localhost:5173**, login bằng UI và credentials
đã lưu; không intercept/mock HTTP, không inject JWT vào storage. **31 màn** được
mở rồi reload, real HTTP evidence và screenshots giữ local:

| Vai trò | Màn đã đọc/reload và đối chiếu |
|---|---|
| Student —17 màn | Dashboard; Profile/view/edit; Career Preferences; CV list; detail và analysis cho cả2CV; Recommendations; Saved Jobs; Applications; Notifications; Settings Account/Security/Privacy/Notifications |
| Company —14 màn | Dashboard; Company Profile/view/edit; Jobs list/detail; Applications; Candidate detail; Saved Candidates; Job79 Ranking; Reports; Notifications; Settings Account/Notifications/Security |

Các mutation thực hiện bằng UI và xác nhận HTTP success, reload persistence:
profile aggregate PUT; career preference PUT; recommendation POST; internal note
PATCH; application status PATCH; ranking POST. Ngoài ra đã mở candidate CV,
ranking history, recommendation explanation dialog, xuất CSV và kiểm role guards.
Các flow registration/job moderation/upload/application/save ban đầu chạy bằng
API seed thật; không claim mọi action trên từng màn đã được bấm bằng browser.
Không đổi mật khẩu qua browser vì cần giữ credentials bàn giao.
Lượt hoàn tất: **0 console errors, 0 pageerrors, không API HTTP lỗi**.
Student truy cập Company route và Company truy cập Student route →403.
API role checks403, anonymous401, foreign Student CV404 do scoped lookup.

Lượt browser đầu sandbox: **FAIL** sau15 màn, ERR_NETWORK_ACCESS_DENIED và
ERR_INSUFFICIENT_RESOURCES. Giữ `manual-final-browser-first-failure.json`.
Lượt hoàn tất dùng quyền thực thi phù hợp và context mới mỗi nhóm màn để tránh
tích lũy Vite modules; không retry/mask assertions, không chuyển sang mock API.

### REAL và UNSUPPORTED

REAL: profile/career preferences, CV parser/analysis/files, V3 recommendation,
saved Jobs/applications/Student notifications; Company profile/moderated Jobs,
applications/CV, Saved Candidates/private notes, V3 ranking/history, SQL analytics,
reports/CSV, account settings và notification preference persistence.

UNSUPPORTED theo source hiện hành: Student privacy visibility switches; chỉnh email
đăng nhập/avatar; interviews/chat/invitations; Company members/team permissions;
email/SMS/push realtime; 2FA/session-management additions. Security page có đổi
password thật nhưng task này chỉ kiểm tra hiển thị, không đổi credentials.
Company inbox empty là trạng thái thật; chưa có Company event producer.
Không thêm module để làm đầy các màn UNSUPPORTED, không fake success toast.

## Bảo toàn dữ liệu và các checks

- Strict comparison từ baseline trước seed: **FAIL đúng1 row**, `users.id=1`
  (Admin fixture). **2.866/2.867 original rows** giữ nguyên hash.
  AuthServiceImpl.login gọi `setLastLoginAt(LocalDateTime.now())` rồi save;
  các lần login Admin hợp lệ làm fingerprint row này đổi. Baseline chỉ giữ row
  hashes, không có per-column before image, nên không claim đã chứng minh chỉ
  hai timestamp fields đổi. Không restore timestamp bằng SQL, không đổi comparator.
- Toàn bộ original CV rows (kể cả updated_at), Jobs, Applications, PRIMARY/E2E
  business data, Saved Candidates, Recommendation/Ranking runs/results khớp strict
  baseline hiện tại. Giữ riêng strict FAIL và content comparator evidence cũ của
  work package trước; task này không sửa hoặc thay thế chúng.
- Hai named volumes PostgreSQL/CV giữ nguyên tên/creation identity. Không reset
  DB/volume, không recreate/restart demo containers, không chạy fixture cleanup.
- Auto-review từ chối lần xin chạy seed lại ban đầu do script sẽ login Admin.
  Sửa seed để lazy-auth Admin chỉ khi thực sự cần Admin action. Rerun mới được
  chấp thuận và **PASS 19tables/3.062rows**, không thêm/trùng dữ liệu hoặc ghi đè
  browser edits. Chỉ bỏ login metadata của4 task-owned users trong comparator
  rerun riêng; **mọi old user, kể cả Admin, phải exact match**. Đây không phải
  thay thế hay làm xanh strict original baseline đang FAIL.
- Backend `clean verify`: **520PASS =249Surefire+271Failsafe**,0fail/error/skip.
  PostgreSQL integration chạy Testcontainers riêng, không dùng demo DB.
  Lượt `test` sandbox ban đầu không resolve được Maven parent do network denied;
  full verify với quyền mạng phù hợp đã chạy cả fast và integration tests.
- AI hash-locked install và pip check PASS; **887pytest PASS**,1 existing warning.
- Seed rerun/API verifier/SQL verifier PASS. Flyway deployed vẫn **V21**;
  không đổi public contract, migrations, Backend/AI/frontend product source.
- Credentials ignore check, syntax checks và `git diff --check` PASS.
- Demo frontend5173, Backend8080, AI8000, PostgreSQL55432 được để chạy.
  Không tắt/restart/sleep Windows.

## Scripts và evidence để tiếp tục

```powershell
# Handoff hiện tại: không seed, không generate lại, không sửa business data.
node e2e/manual-final-verify.mjs
node e2e/manual-final-sql-verify.mjs
node e2e/manual-final-browser.mjs --read-only
node e2e/manual-final-snapshot.mjs
node e2e/manual-final-admin-audit.mjs
```

Lệnh snapshot cuối vẫn exit1 đúng mismatch Admin. **Không chạy seed hoặc
rerun-check trong handoff này.** `manual-final-seed.mjs` là tool khởi tạo có mutation;
snapshot `--baseline` chỉ dùng môi trường mới và từ chối thay baseline có sẵn.
Rerun checker hiện yêu cầu explicit `--execute-seed` để tránh vô tình seed lại.

`manual-final-verify.mjs`, `manual-final-sql-verify.mjs`, snapshot comparator là
read-only với business data; auth verifier login có cập nhật metadata của task-owned
accounts. Browser và rerun-check có mutation rõ ràng, chỉ dùng cho bộ manual này;
không chạy khi người dùng đang chỉnh sửa. Seed checkpoint bảo toàn nội dung/status
đã hoàn tất; không tự repair/reset tài khoản nếu login sai, không reset password
khi email collision. Không chạy generic E2E cleanup.

Files mới: seed, CV generator, API verifier, SQL verifier, strict snapshot,
browser verifier, rerun checker, read-only Admin audit và tài liệu này. Private baseline/state, credentials,
API/SQL/browser/preservation/idempotency evidence và test logs đều nằm dưới
`e2e/.local/manual-final-*`; không commit/upload raw evidence.

## Handoff tiếp nối — không seed lại

API login từ credentials local và read-only SQL verifier đã chạy lại: hai tài khoản
chính ACTIVE, Company VERIFIED; CV121/122 READY;11Jobs/13applications;
3SavedJobs/3SavedCandidates;3RecommendationSUCCESS/84results và
3RankingSUCCESS/9results. Không POST generate, không upload, không đổi status/note,
không chạy seed/rerun-check/cleanup. Browser handoff dùng `--read-only`: chỉ GET
và POST auth/login được phép trong HTTP evidence; mutation journal cũ chỉ được
tham chiếu như historical evidence, không được tính là vừa thực hiện lại.
Private handoff browser evidence được lưu riêng, không ghi đè lượt browser cũ.
Lượt handoff đã hoàn tất **PASS31/31màn,0console errors,0pageerrors**; CSV download
13rows khớp Backend và role guards403. HTTP assertion xác nhận không có business
mutation. API/SQL verifier cũng PASS trên dữ liệu hiện hữu. Chỉ cập nhật scripts/docs
trong lượt này; không chạy lại Backend/AI suites vì product source không đổi;
520Backend/887AI PASS ở phần trên là kết quả thực thi cùng work package ban đầu.

### Mismatch Admin: field evidence và mức độ chắc chắn

Strict baseline lúc2026-11-04T17:01:25.145Z chứa hash cả row; kiểm tra tiếp nối vẫn
chỉ khác **table `users`, ID1**. Không sửa/reset row này và không login Admin trong
handoff. `manual-final-admin-audit.mjs` đọc metadata/digests bằng transaction
READ ONLY; không sửa strict comparator hoặc baseline.

| Field | Giá trị hiện tại (stored local datetime) | Kết luận có thể chứng minh |
|---|---|---|
| `last_login_at` | `2026-11-05T00:03:06.186409` | Login source gán LocalDateTime.now(); đây là field metadata dự kiến bị đổi bởi devAdmin login ban đầu. Không có before value để đối chiếu độc lập. |
| `updated_at` | `2026-11-05T00:03:06.186988` | User entity dùng Hibernate @UpdateTimestamp, nên save login cập nhật metadata này. Không có before value để đối chiếu độc lập. |
| `id` | 1 | Cùng identity record được tìm lại; row không bị mất. |
| `role`, `status` | ADMIN, ACTIVE | Đúng trạng thái hiện tại; chưa có before-column snapshot để chứng minh lịch sử từng field. |
| `email`, `password_hash`, `full_name`, `phone`, `created_at` | Không đưa dữ liệu riêng tư/hash ra report | Không có per-column baseline; không claim từng field chắc chắn unchanged. |

Thao tác đã thực hiện ở lượt đầu: helper `devAdmin()` gọi auth/login trước các
Admin API verification/approval; phiên bản seed ban đầu login Admin ở đầu script.
AuthServiceImpl.login chỉ gán lastLoginAt; User entity @DynamicUpdate và
@UpdateTimestamp giải thích hai metadata fields trên. Attribution này là **suy
luận từ source + lịch sử thao tác**, không phải full historical before/after proof.
Backend logs được đọc thử nhưng không có SQL update statements/column values để
khôi phục before image. Không có bằng chứng thay đổi business bất thường; cũng
không thể loại trừ tuyệt đối thay đổi trong Admin row chỉ từ whole-row hash.

Business-content comparison tương ứng được ghi **PARTIAL_PASS**:

- **2.866/2.867** original rows exact-match cả business fields và timestamps,
  bao gồm mọi CV/Job/Application/SavedCandidate/V3 run/result và user cũ khác.
- Riêng Admin1: historical business-only comparator **INCONCLUSIVE**, không có
  original content digest/per-column image. Không loại hai timestamp khỏi hash
  hiện tại rồi gọi đó là baseline trước seed.
- Có checkpoint business digest và full-row digest Admin tại thời điểm audit
  handoff để xác nhận row ổn định trong cửa sổ bàn giao. Checkpoint mới chỉ chứng
  minh cửa sổ hiện tại; **không thay thế baseline trước seed**.
- Strict overall vẫn **FAIL**, không đổi thành PASS và không restore timestamps.

### Idempotency và bảo toàn chỉnh sửa

Không seed lại để kiểm tra. Dùng evidence đã chạy lúc17:11:54.752Z:
19tables/3.062rows matched, tất cả old users kể cả Admin matched trong rerun đó;
browser summary edit, candidate note revision2 và application287REVIEWED giữ nguyên.
Review source xác nhận checkpoint `once()` bỏ qua các stage đã hoàn tất, existing
CV/Job/application/run/saved-item lookup trước create, không DELETE/cleanup,
không reset password/status terminal, Admin auth lazy chỉ khi còn action cần Admin.
Browser/Backend regressions trước đó không xóa manual data; full Backend verify
dùng Testcontainers riêng. Rerun safety giả định **sequential execution và giữ
nguyên local credentials/state journal**; chưa claim concurrent seed hoặc recovery
sau mất journal là exactly-once. Một crash giữa API commit và journal checkpoint
cần review stage trước khi tiếp tục, không tự seed mù.
