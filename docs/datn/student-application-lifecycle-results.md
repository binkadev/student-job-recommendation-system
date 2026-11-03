# P1 — Student application lifecycle

Ngày 2026-11-04 (Asia/Bangkok). Branch `design/datn-ui-ux-refresh-20261102`; baseline thực tế `851fb5bdd85fa78184be5cd82d981b9543488a7e`; PR #66 giữ Draft, không merge/force push. Đã fetch và xác nhận master `e019f7a4` là ancestor. Dirt có sẵn `frontend/tsconfig.app.tsbuildinfo`, `.agents/`, `skills-lock.json` được giữ ngoài commit.

## Audit, gap và phạm vi

Đối chiếu AGENTS/CODEX_GUARDRAILS, API/active V3, Flyway V18/V19, Application controller/service/repository/entity/DTO, notification/preferences, Student application pages, Apply modal, useAppliedJobs/consumers, Job cards/detail/recommendations/saved, Company controls và E2E runner/tests.

Business rules hiện hữu đủ rõ và được giữ nguyên. Gap UI: list/detail/status chỉ đọc, không có withdrawal; Candidate Job Detail coi có bất kỳ history là đã apply và chặn rejected reapply; Public Detail lấy failed/missing history thành array rỗng (NEVER_APPLIED), fallback shared hook không chạy vì enum string luôn truthy; hook event thiếu user scope và không có cross-tab invalidation. Modal chưa chặn double-click bằng synchronous guard, không xác minh eligibility mới khi mở và hiển thị mọi CV, kể cả chưa READY.

Backend status check/write ở trong transaction nhưng đọc row không khóa, không có version/CAS. Đã tái hiện trên PostgreSQL Testcontainers bằng source đọc cũ: giữ row lock đến khi hai request cùng chờ, release → **withdraw200 + review200**. Đây là lost state transition, không phải thay đổi chính sách cần duyệt. Artifact `lifecycle-baseline-race.log` giữ expected FAIL thực tế. Fixed source được khôi phục trong finally sau thí nghiệm cô lập.

## Implementation và UI trước/sau

- Backend thêm `findByIdForStatusUpdate` với PESSIMISTIC_WRITE trên riêng Application table; ownership/state validation, write và notification cùng transaction giữ khóa. Không fetch-join nullable CV khi FOR UPDATE, không thêm schema/version/migration hoặc đổi HTTP errors.
- Student list/detail/status có nút **Rút đơn ứng tuyển** chỉ khi PENDING. Dialog ghi đúng: “Đơn đã rút sẽ không thể ứng tuyển lại vào cùng vị trí theo chính sách hiện tại.” Hủy không mutation; pending khóa confirm/close/action và synchronous ref chặn lặp; chỉ response thành công mới cập nhật/toast success.
- HTTP400/409 được đọc lại bằng GET current-owner detail; Company REVIEWED thắng trước thì UI nhận REVIEWED, không overwrite. Network/HTTP failure giữ confirmed data và error, có explicit GET “Tải lại trạng thái” trước controlled retry. Nếu request đã commit nhưng mất ACK, read-back có thể xác nhận WITHDRAWN mà không gửi PATCH lần hai. Không tự retry mutation.
- Application page giữ confirmed data khi tải lại lỗi, có reload; bảo vệ retained detail bằng user ID và resource ID, sort appliedAt DESC/id DESC, correction last client page sau filter/mutation. Không coi initial error là empty history.
- `useAppliedJobs`: UNKNOWN khác NEVER_APPLIED; mọi active row chặn apply theo Backend; latest rejected/withdrawn dùng appliedAt rồi ID. User-scoped events, request generation bỏ stale responses, session change ẩn dữ liệu cũ; malformed history không thành empty. Same-window confirmed change cập nhật đúng ID rồi refetch Backend; localStorage chỉ chứa user ID + random invalidation nonce, không application/CV/token; tab khác hoặc focus đọc lại Backend. Failure giữ snapshot và khóa apply chưa xác minh.
- Candidate/Public detail, Candidate list/Saved entry links và Recommended actions dùng trạng thái chung. REJECTED cho “Ứng tuyển lại”; WITHDRAWN có lý do chặn; latest pending sau reapply dẫn tới đúng application ID mới. Public history không còn loader rỗng ghi đè trạng thái thật. Application Detail giữ link sang Job để kiểm latest state/eligibility, không suy ra reapply từ một record REJECTED cũ.
- Modal dùng GET Job mới khi mở/refresh để kiểm ACTIVE/deadline; Backend Student GET cũng thực thi visibility VERIFIED. CV selection chỉ hiển thị owned READY; giữ lựa chọn không CV theo API hiện hữu. Cover letter mới được giữ khi POST lỗi, refetch trước retry; one-flight ref và pending chặn double submit; async completion sau unmount/user change không phát state/toast cho tài khoản mới. Không tạo synthetic application history để giả success.
- Company terminal controls đã có đúng rule trong source: WITHDRAWN/REJECTED/ACCEPTED không update tiếp; giữ nguyên implementation và kiểm bằng browser/API. Không sửa production Company Application loader/Auth để suy đoán B06.

## Business transition matrix / HTTP expected–actual

| Role / trước | Hành động | Sau nếu thành công | Expected HTTP | Actual evidence |
|---|---|---|---|---|
| Student own PENDING | WITHDRAWN | WITHDRAWN | 200 | PostgreSQL + L01 browser/read-back |
| Student own WITHDRAWN | WITHDRAWN lần nữa | Giữ nguyên | 400 | IT + real API L01 |
| Student bất kỳ status | ACCEPTED/REJECTED | Giữ nguyên | 403 | Matrix IT; L01 ACCEPTED403 |
| Student REVIEWED/ACCEPTED/REJECTED/WITHDRAWN | WITHDRAWN hoặc unsupported edge | Giữ nguyên | 400 | 75-edge role/state matrix |
| Student khác / Company khác | Mutation foreign application | Giữ nguyên | 403 | IT + L01 secondary foreign Student |
| Company/Admin own PENDING | REVIEWED | REVIEWED | 200 | Matrix IT + L02 Company API |
| Company/Admin PENDING/REVIEWED | ACCEPTED/REJECTED | Target | 200 | Matrix IT; L02 browser REJECTED |
| Company/Admin terminal hoặc no-op | Review/accept/reject/other | Giữ nguyên | 400 | Matrix IT; L01 review/accept WITHDRAWN400 |
| Student PENDING vs Company PENDING | Concurrent withdraw/review | Chỉ một transition | Một200/một400 | 5 controlled PostgreSQL races; persisted winner và notification count |
| Student không history, eligible Job | Apply | New PENDING | 200 | L01/L02 browser, READY CV3 |
| Latest REJECTED, không active row, eligible Job | Reapply | New PENDING; old REJECTED giữ nguyên | 200 | IT + L02 cover letter/history/new ID |
| Có active PENDING/REVIEWED/ACCEPTED | Apply thêm | Không thêm row | 409 APPLICATION_ALREADY_ACTIVE | IT concurrent two POSTs; L02 duplicate409 |
| Latest WITHDRAWN | Apply lại | Không thêm row | 400 | IT + L01 API/UI |
| Job CLOSED/past deadline hoặc Company BLOCKED | Apply/reapply | Không thêm row | 400 | IT từng gate; L02 closed API400; modal CLOSED unit test chặn POST |
| Student dùng foreign CV | Apply | Không thêm row | 403 | PostgreSQL IT |
| Company | Apply Student endpoint | Không thêm row | 403 | PostgreSQL IT |

Foreign Student detail GET vẫn404 theo existing read contract; mutation foreign403. Status400 khi stale là existing state-machine rule rejection, không tự đổi thành409 hoặc thêm revision policy. Student profile If-Match/CAS không đổi.

Notifications: successful Company/Admin transition tạo đúng một APPLICATION_STATUS_CHANGED cho owning Student nếu preference enabled; Student withdrawal/apply/reapply không tạo loại notification này. Invalid/foreign/duplicate/losing race không tạo notification. Matrix và races kiểm DB count; existing NotificationSettingsApiIT tiếp tục kiểm disabled/enabled preferences. Không thêm notification nghiệp vụ mới.

## Automated verification

| Nhóm / lệnh | Kết quả thực chạy |
|---|---|
| Backend `mvnw.cmd -B -ntp clean verify` | **492 PASS** =247 Surefire +245 PostgreSQL Failsafe;0 failure/error/skip;1m41s; kết thúc00:21:31+07 |
| New ApplicationLifecycleApiIT | **6 PASS**, gồm75 transition checks,5 blocked-row races, concurrent reapply200/409, ordering/ties, ownership/eligibility/CV và notification assertions |
| Frontend `npm run test:run` | **184 PASS /27 files**,11.02s |
| Frontend lint / TypeScript + Vite build | PASS; existing >500kB bundle warning còn |
| Full Playwright (47 cũ +2 workflow mới) | **49/49 PASS**, 2.6m, 0 skipped/unexpected/flaky, retries0; lượt trước48/49 được giữ artifact |
| AI locked environment | pip check PASS; **887 pytest PASS**,5.59s;1 Starlette/httpx deprecation warning; không đổi dependency |
| Git diff/check, secret/artifact scan | **PASS,25 staged paths**; đối chiếu actual local credentials/env secrets, JWT-like literals và private/generated artifacts |

Frontend tests dùng **HTTP mocks**, không thay bằng chứng Backend/Browser thật: conditional withdrawal ba modes/bốn terminal statuses, confirmation cancel, deferred double-click/pending/no optimistic write, failure/reconcile400/network, reload snapshot, reapply READY CV/new letter, failed POST draft, WITHDRAWN/UNKNOWN/CLOSED block, public/candidate/saved/list entry labels, stale same-user request/user switch/foreign event/cross-tab invalidation và existing saved/applied error regressions. Pure-state test cũ dùng old PENDING + newer REJECTED (inconsistent history) được sửa thành valid rejected history; thêm assertion riêng active row luôn chặn, khớp Backend active-first rule, không làm yếu test.

Initial failures được giữ local: test probe đòi connection thứ tư trong pool3 → timeout, đã dùng blocker connection để quan sát; new unit locators chọn nhầm option/duplicate text và Testing Library không hỗ trợ exact option trong getByRole → sửa locator/types, assertions giữ nguyên. Browser L02 lần đầu gọi sai saved-job URL `/students/me/saved-jobs` →500; sửa runner sang contract `/students/me/saved-jobs/{id}`. Lượt full48/49 dừng L02 ở logout do tìm role button thay cho menuitem; đổi đúng accessible role. Không thêm retry, skip, timeout hoặc thay Backend rule để che lỗi.

## Browser thật và persistence

L01: secondary Student `frontend` gửi PENDING bằng CV READY có sẵn; Company `companyB` đọc đơn. Student list/detail/status + confirmation trên375/430/768/1024/1440, cancel không mutation. Offline PATCH failure giữ DB PENDING, online explicit GET + double-click confirm chỉ một successful PATCH; reload Student WITHDRAWN, Company reload WITHDRAWN và disabled terminal controls. Foreign/accepted/duplicate/review/accept/reapply negatives trả403/400 đúng matrix.

L02: browser initial apply → Company review trước Student confirm → stale withdrawal400, Student đọc lại REVIEWED. Company UI REJECTED; public detail/candidate list/detail/saved/application link/recommended/modal cho reapply. Recommendation V3 secondary chạy qua API hiện hữu threshold0/limit100 để đưa fixture vào real entry point; không tự dựng ranks/scores. Modal năm widths chọn READY CV, cover letter mới, double-click đúng một POST, hai history rows riêng old REJECTED/new PENDING, duplicate409. Tab Student đang mở nhận Backend PENDING qua invalidation; Company thấy application ID mới. Logout/login `data` không thấy history của `frontend`, login lại `frontend` lấy đúng latest. New fixture đóng thì apply400. Reload/persistence assertions dùng Backend thật, không HTTP mocks.

Raw evidence và screenshot nằm gitignored `e2e/.local/`: `lifecycle-{backend-verify,baseline-race,targeted-backend,frontend-tests,frontend-lint,frontend-build,final-e2e,ai-tests}.log`, `lifecycle-final-results.json`, `lifecycle-evidence-*.json`, `lifecycle-fixtures-*.json`, `screenshots/lifecycle-*.png`. Đã xem mobile withdrawal/reapply screenshots; không tuyên bố full WCAG compliance.

## Data preservation và B06

Final API comparators và SQL read-back **PASS**. Baseline `application-lifecycle-baseline.json` và `lifecycle-primary-profile-baseline.json` chụp trước thay đổi lúc00:04:22+07; kiểm sau full suite lúc00:33:24+07, không ghi đè baseline giữa các lượt. Giữ10 aliases (user/resource ID/role/status),4 CV READY (ID/filename/active/analysis metadata),16 PRIMARY Jobs (id/title/status/deadline/skills),3 PRIMARY Applications (id/job/status/CV). SQL xác nhận applications1/job20 REVIEWED/CV1,9/job12 PENDING/CV1,24/job11 REVIEWED/CV1; PRIMARY Job count16 và READY CV count4.

PRIMARY aggregate content cũng khớp sau khi loại revision/createdAt/updatedAt. Revision20→30 là10 positive saves hiện hữu của A02/B03 qua hai lượt full, mỗi lượt5 và restore nội dung; negative lifecycle/atomic cases đều ở secondary. Public totals vẫn20 Jobs/4 Companies/6 Students. Application total54→70:10 rows secondary lifecycle từ các lượt chạy và6 secondary reapplication rows của A09 qua hai lượt full. Không đổi3 Application PRIMARY để tạo case mới.

Toàn bộ7 secondary Job32–38 của các lượt thử đều Company3/CLOSED theo SQL. Final L01 application121 WITHDRAWN, one successful PATCH; L02 old122 REJECTED/new123 PENDING, history2 rows/one browser POST, duplicate409, stale withdraw400, CV3 READY; cross-tab và logout/login isolation PASS. Không xóa history để che failure hoặc giữ report sạch giả.

Fixtures chỉ trên secondary actors; mỗi full lifecycle run tạo tối đa2 Job mới và soft-close trong afterAll qua Company API, kể cả test fail; không hard-delete/history reset. CV3 chỉ đọc/chọn, không tạo CV. Alias `data` chỉ dùng foreign-denial/logout isolation, không mutation hồ sơ hay application của alias này. Admin chỉ duyệt các Job vừa tạo; không đổi Company verification/PRIMARY Job statuses. Các failure attempts cũng giữ history và đóng Job hợp lệ, không chuyển WITHDRAWN ngược PENDING để tái sử dụng.

Backend-only rebuild `docker compose up -d --no-deps --build backend`; giữ named volumes, PostgreSQL và AI containers. Không migration mới; Flyway vẫnV19. Không thay AI/CV processing V2, TF-IDF/Cosine, Recommendation/Ranking V3, PRIMARY/FALLBACK,0.65/0.35, Top-K, eligibility/corpus logic, official ordering/ranks/scores hoặc stateless AI boundary. Secondary runtime fixtures có thể tạm là eligible Job trong test; kết thúc CLOSED khôi phục public corpus count, không sửa nội dung16 PRIMARY Jobs.

SQL Flyway `19|t`; ba services healthy. PostgreSQL/AI creation time vẫn2026-11-03T11:44:31Z; volume names `student-job-recommendation-system_postgres_data` và `student-job-recommendation-system_cv_uploads` giữ nguyên.

**B06 giữ UNRESOLVED / NOT REPRODUCED sau60 observations của work package trước.** Không chạy lại diagnostic60. Full existing B06 và các normal Company detail reloads trong L01/L02 giữ HTTP/body/Request-ID instrumentation an toàn, trace/video tắt; không JWT/password/raw CV logs. Nếu không có failure mới, không nâng thành FIXED hoặc gán nguyên nhân cho lần lỗi cũ.

Lượt full cuối: B06 hiện hữu PASS; L01/L02 có11 normal Company detail responses200/success,11/11 Request-ID khớp Backend,0 unmatched và0 pageErrors. Có navigation `ERR_ABORTED` ngoài detail trong recorder; không tái hiện200→UIerror, không có evidence mới để chốt nguyên nhân lịch sử. Artifacts `lifecycle-server-evidence.json`, `lifecycle-preservation-evidence.json`, `lifecycle-primary-profile-preservation.json` giữ local.

## Giới hạn và checkpoint tắt máy

- Cross-tab invalidation cần localStorage khả dụng; nếu bị chặn thì focus/reload đọc Backend. Không polling hay push realtime từ Company, nên một tab Student đang ngủ có thể cần refocus/reload; mutation luôn do Backend quyết định.
- Không có server idempotency key mới: network failure sau commit được giải quyết bằng read-back và active uniqueness, không tự retry POST/PATCH. Dialog draft không persist sau đóng tab. Giữ current400/409 contract.
- Backend apply vẫn cho no-CV/owned non-READY CV theo rule cũ; READY là lựa chọn của giao diện này. Không tự siết Backend để hợp thức hóa UI.
- Dashboard/Reports bounded analytics và unsupported flows ngoài scope giữ các gap trước; không nghiệm thu toàn bộ sản phẩm.
- Windows HOST `shutdown.exe /s /f /t 21600 /c "DATN: automatic fallback shutdown"` đã trả exit0 ngay đầu task. Source/logs/report và tested commit/push được lưu trước bước cuối. Theo yêu cầu, bước kết thúc sẽ hủy fallback rồi đặt `/s /f /t 120`; checkpoint local ghi kết quả thực tế, không chạy tác vụ dài sau lịch cuối. Không can thiệp BIOS/wake.

PR #66 giữ Draft. Phần chưa hoàn thành hoặc verification FAIL phải được giữ đúng trạng thái trong report/checkpoint, không đổi thành PASS.
