# Real-world full-stack E2E — 2026-11-03

Checkpoint lịch sử tại `caa33f54`. Gap G01 (Company verification / Job moderation) đã được xử lý trong work package P0 tiếp theo: xem [chính sách](company-job-moderation-policy.md) và [kết quả mới](company-job-moderation-results.md). Counts/nhận định bên dưới mô tả lượt baseline trước thay đổi đó.

## Kết luận và giới hạn

Đã chạy các hành trình chính bằng Chromium, Spring Boot, PostgreSQL và AI thật; đã tái hiện/sửa lỗi lưu hồ sơ có kỹ năng, saved/application state khi mất mạng, kích hoạt CV từ danh sách và upload quá kích thước. **Chưa nghiệm thu toàn bộ sản phẩm**: còn policy gap P0, các action chưa kiểm chứng và các module chưa có Backend. Xem [matrix hành động](student-company-functional-gaps.md), không suy ra business PASS từ navigation smoke.

## Baseline và phạm vi

- Repository `binkadev/student-job-recommendation-system`, branch `design/datn-ui-ux-refresh-20261102`, HEAD đầu `e56b3efb81709ac598d79bb9d49b8ff58c6200e9`.
- Fetch lại master `e019f7a45d4799c2f2c7d0dcfe5ca1e68784d686`, xác nhận là ancestor. Tiếp tục PR #66, giữ Draft, không merge/force push.
- Có sẵn `.agents/`, `skills-lock.json`, `frontend/tsconfig.app.tsbuildinfo` chưa commit; loại khỏi stage. Không đổi các module ngoài lỗi được xác định.
- Phạm vi được phép: fixture/API/browser E2E, sửa Frontend/Backend nhỏ có regression, tài liệu. AI scoring, authorization policy, state machine, DB/Flyway không được tự thiết kế lại.
- Source đã đối chiếu: AGENTS, CODEX_GUARDRAILS, README, active V3/API/schema/ERD, các tài liệu audit trước, controllers/DTO/service/security, migrations V1–V18, router/pages/hooks/API services, AI V2 parsing/V3 schemas và automated tests liên quan. Tài liệu cũ không được dùng như chứng nhận runtime.

## Môi trường và dữ liệu

| Thành phần | Quan sát |
|---|---|
| Frontend | Vite dev localhost:5173, React 18.3.1; Node 24.18.1/npm 11.16.0; production build Vite 6.4.3 |
| Backend | Spring Boot 3.5.16/Java 21, localhost:8080, container build lại sau sửa multipart |
| AI | localhost:8000; parse V2 và recommendation/candidate-ranking V3 có HTTP 200 thật trong container log |
| AI health caveat | `/health` vẫn quảng bá metadata recommendation V2 và `supportedContracts=[v1,v2]`; đây không phải bằng chứng V3 không tồn tại. V3 được xác minh bằng lời gọi thực tế |
| DB | PostgreSQL 17.11, host 127.0.0.1:55432; Flyway 18 successful; kiểm tra read-only |
| Docker | Engine 29.8.2; ba container healthy ở baseline |
| Browser | Playwright Test 1.56.1, Chromium 141.0.7390.37/build 1194, một worker, không mock HTTP |
| DB strategy | Dùng local dev hiện hữu, không reset/xóa volume/SQL write; record E2E namespace riêng; chỉ xóa CV phụ do test tạo |
| Dataset | 9 alias E2E; Company chính 16 jobs (15 fixture API + 1 browser DRAFT); 4 CV READY bền vững, trong đó Student chính có VI DOCX và EN PDF |

Baseline public statistics: 10 jobs, 1 company, 1 student, 0 applications. Các trường thống kê public có filtering semantics riêng; không đồng nhất với tổng số row DB. Trạng thái cuối/ID cụ thể ở [manifest](e2e-test-data-manifest.md). Dữ liệu nghề nghiệp là tổng hợp, không phải JD/doanh nghiệp/CV thật; [nguồn tham khảo](e2e-external-data-sources.md).

Không có ADMIN mới. Runner login dev seed Admin hiện hữu, duyệt jobs E2E qua API. Company chính đi DRAFT → PENDING_APPROVAL → Admin ACTIVE. Không tự đặt VERIFIED bằng SQL. Company C chuyển về PENDING qua Admin API để khảo sát mô hình, không nâng quyền. Hai tài khoản chính không bị xóa/đổi mật khẩu; đọc lại/login lại sau container recreate.

## Hành trình và cross-role evidence

| ID | Intent / route | API, rule và actual | Kết quả / evidence |
|---|---|---|---|
| J01 | Guest khám phá `/`, `/jobs`, `/companies/:id` | Public search/detail trả đúng job/company tổng hợp; không public job DRAFT/PENDING/CLOSED/EXPIRED/past deadline | PASS A01/B01; public trace không có phiên đăng nhập |
| J02 | Đăng ký/login/refresh/logout | STUDENT/COMPANY register qua API và browser; login redirect đúng workspace, refresh giữ session, role route sang 403; keyboard menu Escape khôi phục focus | PASS B02/B10; đăng ký browser thực hiện lần đầu, rerun tái sử dụng alias |
| J03 | Student profile edit/reload/clear | GET/PUT own Student/profile/skills; multiline projects giữ nguyên; clear experience qua empty string; graduation invalid 400; catalog page size đúng 100 | PASS A02/B03; atomic concurrent edit NOT_VERIFIED và chưa được hỗ trợ aggregate |
| J04 | CV upload/AI/language/active | PDF EN, DOCX VI; parse thật, READY, persisted processedText/skills/language/version; active duy nhất; raw download; secondary upload/analysis qua UI | PASS A03/B04; language vi/en confidence 1 ở fixture; không chèn analysis DB |
| J05 | CV negative/error | TXT 400, extracted-data 501, used CV DELETE 409; secondary delete/read 404; NOT_READY/FAILED chặn scoring; malformed PDF thất bại và lưu FAILED; >10 MB hiện trả 413 | PASS A03/A06/A11/A12; parser failure khác timeout/outage |
| J06 | Student Recommendation V3 | Generate hai CV, threshold=0, limit=100; kiểm tier/strategy/null/formula/order/tie/global rank/history và snapshot không đổi analyzedAt/processedText | PASS A04; browser generate/history/evidence modal B05 |
| J07 | Save/unsave/re-save | Own saved jobs; ba rounds hai POST đồng thời, mỗi round chỉ một row; offline unsave giữ confirmed state, retry lỗi applications không biến thành empty | PASS A05/B08; concurrency chỉ là bằng chứng thực nghiệm 3 rounds + DB constraints, không chứng minh mọi interleaving |
| J08 | Apply → Company review → Student thấy cập nhật | Own READY CV nộp cùng cover letter theo ngữ cảnh; Company đọc đúng job/CV; PATCH REVIEWED; Student xem lại và reload; notification có record thật | PASS A06/B06; B06 lần đầu submit và transition, rerun đọc lại application REVIEWED để không phá demo |
| J09 | Duplicate/reapply/withdrawn | Active duplicate 409; ba rounds apply song song mỗi round 200+409; REJECTED tạo history mới; latest WITHDRAWN chặn 400 | PASS A09; withdrawal UI chưa có, reapply UI từng màn hình chưa audit hết |
| J10 | Job eligibility | Apply DRAFT/PENDING/CLOSED/EXPIRED/past deadline đều 400; STUDENT create Job hợp lệ bị 403; unauth own Student 401 | PASS A08 |
| J11 | Company profile/job form | Company save/reload/restore; job form validation; tạo/sửa persistent DRAFT bằng browser, không public; fixture có nhiều status qua API | PASS B11/B12; preview/statistics không có nghiệp vụ thực hiện |
| J12 | Candidate Ranking V3 | Corpus 3 application của job; primaryLimit=1/fallbackLimit=2; đúng 1 PRIMARY/2 FALLBACK, formula/null/tier rank/order/history; browser tạo/xem history/reload | PASS A10/B07; không thay scoring |
| J13 | Saved candidate | Unique company+student trên source application; save và duplicate không tạo hai row | PASS A10 API; UI unsave/note chưa kiểm chứng |
| J14 | Ownership | Company B PUT/PATCH job A bị từ chối; Student khác đọc CV/analysis/application hoặc dùng CV A bị chặn; foreign generation/ranking bị chặn, response data=null | PASS A07; raw file/run mutations bổ sung S01, xem verification cuối |
| J15 | Settings/password | Notification settings PUT/read-back qua API; password secondary đổi/login/restore được test riêng S02 | API A11/S02; browser notification/password mutations NOT_VERIFIED |
| J16 | 79 route/control inventory | Source 104 route: 29 Student, 33 Recruiter, 17 Public/Auth, 25 Admin. R01 điều hướng/capture controls/screenshot | Không gán business PASS cho route; xem matrix và checkpoint môi trường |

FLOW A được chứng minh từng mắt xích: jobs tạo/gửi duyệt/duyệt qua API fixture; Student public search/save, UI apply; Company UI review; Student UI read/reload. Không tuyên bố Admin approval UI hoặc browser job publish đã chạy. FLOW B: primary CV parse/generate thật; UI secondary upload/parse và UI primary generate; application thuộc Company chính. FLOW C: A10/B07. FLOW D/E: A07/S01. FLOW F: A08. FLOW G: B08/B13 dùng offline thật; AI malformed CV dùng parser thật; AI scoring timeout/outage chưa tạo. FLOW H: A05/A09 + frontend double-click regression; concurrent profile editors NOT_VERIFIED.

## Defect log và root cause

| ID / mức | Tái hiện, expected / actual trước sửa | Root cause / file | Sửa / regression / trạng thái |
|---|---|---|---|
| E2E-01 P1 | Student có skill → sửa summary → Lưu hồ sơ. Expected lưu/reload; actual GET `/skills?size=200` 400, chưa tới PUT profile | `candidateProfileService.ts` vượt `SkillFilterRequest.@Max(100)`; unit mock không enforce query limit | Paginate catalog 100/page; regression kỹ năng trang 2 + B03 thật PASS |
| E2E-02 P1 | Save job → offline → unsave. Expected giữ trạng thái confirmed; actual nút thành chưa lưu dù DB còn row | `useSavedJobs.ts` optimistic event trước request rồi refresh catch xóa array | Chỉ publish sau mutation success; giữ cache + syncError/retry; guard pending/stale response/session; unit + B08 PASS |
| E2E-03 P1 | Refresh applied history lỗi. Expected unknown/error, giữ lịch sử đã xác nhận, chặn gửi chưa xác minh; actual catch đặt [] như chưa apply | `useAppliedJobs.ts`; public card dùng cùng boolean cho disabled và actual applied | Giữ history, error/initial sync gate, discard late user response, retry; tách disable khỏi đã-apply; hook/card tests và B08 offline retry PASS |
| E2E-04 P1 | CV list, CV khác chưa active → offline → activate. Expected feedback/retry, active cũ giữ; actual rejected promise không được catch, không toast | `CandidateCvsPage.tsx` list handler thiếu try/catch/pending guard (detail handler đã có catch) | Catch/error toast/finally + pending disable/ref guard; unit 2 cases + B13 baseline fail rồi PASS |
| E2E-05 P2 | POST multipart >10 MB. Expected lỗi kích thước 413; actual 500 generic | `GlobalExceptionHandler.java` thiếu handler `MaxUploadSizeExceededException` | `UPLOAD_TOO_LARGE` + sanitized ApiResponse 413; MVC regression + rebuilt Backend A12 PASS; API contract cập nhật |

Fix commits được ghi trong PR history; Backend và Frontend fixes tách commit khỏi report/tooling để review. Chưa có fix policy G01/G02/G03: đó là thiếu quyết định/contract, không giả định đã sửa.

Commit Backend: `e7cd9d86`. Commit Frontend: `b3958ff1`. Các lỗi E2E-01/02/03/04 nằm trong commit Frontend; E2E-05 nằm trong commit Backend.

Các failure của test do assumptions/locator được sửa theo executable contract, không bỏ assertion nghiệp vụ: public list không có status field; canonical skills lowercase; extracted-data 501; CV_IN_USE 409; foreign ranking run 404; no-skill Job PRIMARY dùng text-only; nhãn REVIEWED là “Đã xem”; section heading có số lượng; HCM option “TP. Hồ Chí Minh”. Bộ low-skill DOCX ban đầu quá ít language evidence nhận 422 từ AI, sau đó dùng nội dung tự nhiên dài hơn cho case ít kỹ năng; malformed-document case vẫn giữ riêng. Không giảm threshold hay tắt validation để làm test xanh.

## UI/UX và khả năng truy cập

- Đã chụp Public/company detail, Student recommendation và Company ranking ở 375/430/768/1024/1440; assertion document không overflow ngang. Không đồng nghĩa mọi component tại mọi viewport đã đạt.
- Keyboard: menu tài khoản Enter/Escape/focus restore; recommendation analysis dialog Tab giữ focus trong modal và Escape trả focus. Các modal còn lại, toàn bộ sidebar/mobile drawer và contrast/target-size chưa được audit định lượng.
- Đã kiểm console page errors cho business tests, API statuses và offline failures. `ERR_ABORTED` do navigation và font tải bên ngoài được giữ trong local log, không tự coi là business failure. Không log Authorization/password/raw CV.
- Table ranking desktop cần horizontal scroll nội bộ để tới cột cuối; recommendation 20 kết quả ở 375px rất dài; có nested `main` trên một số CV detail. Đây là P2 follow-up, không có tuyên bố WCAG compliance/hiệu năng production từ smoke.
- Preview/statistics job là unsupported message; company verification upload/logo, public student profile/certificates/links chưa có đầy đủ API. Interviews/messages/invitations/members, privacy, custom pipeline/email templates và 2FA chưa có nghiệp vụ tương ứng.

## Contract safety

Giữ nguyên CV parsing V2, TF-IDF/Cosine, canonical extraction, V3 persisted READY snapshot, language thresholds, PRIMARY/FALLBACK mapping, FALLBACK null text/overall, weights 0.65/0.35, text-only khi Job không skills, global Student Top-K/ordering và independent Company tier limits. Backend tiếp tục validate, gán rank và persist; AI stateless, không user JWT/DB. Không đổi eligible corpus, thresholds, RBAC hoặc status/reapply semantics. Không có schema/migration mới. Public API chỉ bổ sung error handling multipart 413 có ghi contract; không đổi success DTO.

## Verification và checkpoint môi trường

| Check | Kết quả đã chạy |
|---|---|
| Frontend `test:run` | PASS — 22 files / 138 tests; regression HTTP mock, không dùng thay E2E |
| Frontend lint/build | PASS — zero lint warnings; TypeScript + Vite; existing bundle >500 kB warning còn |
| Backend `clean verify` sau fix | PASS — 247 Surefire + 210 PostgreSQL Failsafe = 457, 0 failure/error/skip |
| AI locked install / pip check | PASS — requirements.lock hashes; no broken requirements |
| AI pytest | PASS — 887, 1 Starlette/httpx deprecation warning |
| API thật | A01–A12 PASS, gồm real AI parsing/failure, V3 và multipart 413 |
| Browser business | B01–B13, gồm 5 viewport variants: 17 tests PASS trong lượt trước khi quét routes |
| PostgreSQL | Read-only version/Flyway/counts; đọc lại CV/profile/application/run và login sau container recreate |
| Route scan | Có một lượt R01 đi đủ 79 routes; các lượt sau có fail ngắt quãng — xem ghi nhận bên dưới và trạng thái cuối |

**Lượt cuối trên localhost:5173, sau recovery và sửa harness: 32/32 PASS, 0 fail, 0 skip** — A01–A12 (12), B01–B13 bao gồm năm viewport (17), R01 (1) và S01/S02 (2). R01 giữ đủ 79 route assertions, controls và screenshots. S01 chứng minh thêm ownership raw CV streams/run history/foreign mutation, Company owner stream 200; S02 đổi mật khẩu secondary, login bằng mật khẩu mới rồi restore/login lại. Source/tài khoản chính được giữ đúng trạng thái demo. File local `e2e/.local/final-results.json`, `final-run.log`, `api-evidence.json`, `browser-evidence.json`, `route-evidence.json`, `security-evidence.json` chứa kết quả đã chạy. Danh sách screenshot cuối: 79 route screenshots + 12 business/viewport screenshots, public trace ZIP riêng.

Ghi nhận môi trường bắt buộc giữ lại: lượt quét dài sau business tests có blank page trên một số route settings, không pageerror/API response; một lần Node worker hết heap và CLR không khởi tạo được. Sau đó phát hiện cả ba Docker containers có StartedAt **18:41:05 +07** cùng lúc, host 8080/8000 trả empty reply nhưng `wget` bên trong Backend vẫn 200 và dữ liệu còn nguyên. Đây là bằng chứng sự cố môi trường; chưa chứng minh nó giải thích mọi blank page trước đó. Recreate containers bằng cùng Compose/named volumes đã khôi phục host HTTP 200, không reset DB. Full E2E được chạy lại sau recovery; kết quả cuối được ghi ở phần tiếp theo. Production preview 5174 được khởi chạy phục vụ chẩn đoán; probe đầu cũng gặp host socket hang-up khi Docker ports đang lỗi, không dùng probe đó như chứng nhận build.

Chẩn đoán sau recovery xác nhận `ERR_INSUFFICIENT_RESOURCES` trên hàng loạt `/src/...` modules ở route trắng. Scanner cũ giữ một context qua 79 full reload của Vite (mỗi lần tải hàng trăm modules). Production preview trên 5174 đã pass đầy đủ 79 route với harness cũ sau khi ports hồi phục. Harness hiện đóng context sau mỗi sáu route, login lại bằng form thật; dev R01 pass targeted rồi full 32/32 pass. Không retry/skip route, không giảm assertion, không sửa ứng dụng để che lỗi này. Đây là correction của browser test resource lifetime; không gọi blank route cũ là business PASS. Preview 5174 do phiên QA tạo đã dừng; dev 5173 và ba service containers giữ healthy. Không suy ra mọi sự cố bộ nhớ của máy đã được khắc phục.

Runtime logs/screenshots/JSON/trace ở `e2e/.local` và `e2e/test-results` bị gitignore. Trace chỉ public trước login; authenticated trace/video tắt để tránh chứa secrets. Báo cáo commit không chứa raw artifacts. Hướng dẫn rerun và login local: [e2e README](../../e2e/README.md), [login](e2e-local-login.md).

## Việc còn lại để nghiệm thu đầy đủ

1. Chốt và enforce moderation/verification policy G01 qua reviewed design/tests, không dựa vào UI copy.
2. Thiết kế atomic/versioned profile writes; test hai editor đồng thời. Thêm own-company pagination và >100-record tests.
3. Hoàn thiện withdrawal UI, reapply UI nhất quán, saved searches CRUD, Company candidate note/unsave, account/notification/password browser mutation tests.
4. Định nghĩa Backend/schema/rules cho unsupported modules trước khi thêm forms.
5. Tạo isolated fault-injection stack cho AI timeout/outage/candidate scoring failures, auth expiry/transfer; không dừng AI đang phục vụ demo để fake test.
6. Accessibility/performance chuyên sâu và mọi state/modal/tab chưa được test. Không dùng score model làm accuracy hay UI-only form làm chứng nhận nghiệp vụ.

Hai tài khoản chính và các record demo được giữ. Task này tạo bộ QA có thể chạy lại và sửa các lỗi có bằng chứng; không phải tuyên bố mọi điều kiện nghiệm thu đã PASS.
