# P1 — Company own-jobs pagination và điều tra B06

Branch `design/datn-ui-ux-refresh-20261102`, baseline thực tế `71381b3449b13b2a584cd0e332e5c527c610c41c`, PR #66 Draft. Kiểm tra HEAD/working tree trước sửa; fetch xác nhận origin branch cùng baseline, master `e019f7a4` là ancestor. Giữ ngoài commit dirt có sẵn: `frontend/tsconfig.app.tsbuildinfo`, `.agents/`, `skills-lock.json`.

Phân trang quản lý đã triển khai và kiểm thử trên PostgreSQL/Browser thật. **B06: UNRESOLVED / NOT REPRODUCED** sau 60 quan sát diagnostic; chưa xác định nguyên nhân lỗi reload lịch sử, không tuyên bố đã sửa.

## Audit và API trước/sau

Đã đối chiếu AGENTS, CODEX_GUARDRAILS, active V3/API contracts, released Flyway đến V19, Job controller/service/filter DTO/security/mapper/repository, Company verification, frontend loader/auth/http client và tests. Điều tra B06 được thực hiện trước khi sửa production pagination.

Trước: `RecruiterJobsPage` lấy `/jobs?page=1&size=100`. API generic đúng chủ đích discovery của nó: own Jobs cộng foreign ACTIVE Jobs của Company VERIFIED. Frontend lọc companyId sau LIMIT, tính tổng bằng độ dài phần còn lại rồi slice từng trang 8. Vì vậy foreign rows chiếm chỗ trong 100 đầu; own rows sau giới hạn bị mất và count/pages sai. Đây là lỗi dùng query discovery cho quản lý, không phải bằng chứng generic discovery vi phạm ownership.

Sau: **GET `/api/companies/me/jobs`**, role COMPANY; Backend lấy Company từ authenticated User ID. Specification bắt buộc `company.id = currentCompany.id` trước LIMIT/count; dùng Spring Data PostgreSQL Page, sort `createdAt DESC, id DESC`, batched Job skills mapper hiện hữu. Không có giới hạn tổng 100, không thêm migration/index/dependency. Query generic/public và các write policy không đổi.

Contract đầy đủ tại [API contract](../api-contract.md): page 1-based/default 1, size default 10/range 1–100, keyword title/description/requirements, location riêng, status/jobType/workingModel AND; enum/pagination validation. Tất cả six own statuses đều đọc được, kể cả Company PENDING/BLOCKED. Unknown params, gồm companyId/userId/sort, bị từ chối 400; không dùng input này để đổi ownership.

Frontend gọi một request/page size 8; render items/count/page từ response, không lọc own hoặc slice lại. Đổi filter reset page 1, reset/refresh và create/edit/status/close đọc lại Backend. Nếu last filtered page mất row sau mutation, response out-of-range dẫn tới tải last valid page. Khi pending/error, giữ confirmed snapshot và nhãn page/count của chính snapshot, cảnh báo bộ lọc/trang mới chưa được xác nhận; khóa pager và mutation actions. Empty chỉ hiện sau confirmed totalItems=0. Lần tải đầu không hiển thị count 0 giả; retry bằng action explicit. Hook hiện hữu dùng cleanup active flag để bỏ late responses; không thêm retry hoặc thay shared hook.

## PostgreSQL Testcontainers và HTTP evidence

`CompanyOwnJobsApiIT`: 5 integration methods, mỗi method tạo **130 A + 130 B** trong PostgreSQL 17 Testcontainers cô lập, mọi record có cùng createdAt; đủ 6 statuses, 4 jobTypes, 3 workingModels, keyword/location. JWT/security/controller/service/JPA thật qua MockMvc, không mock repository/database và không dùng H2. Không tạo 260 records trong database demo.

| Tình huống | Expected HTTP / dữ liệu | Actual evidence |
|---|---|---|
| A/B GET own, size17, pages1–8 | 200; total130/pages8, chỉ đúng owner, ID DESC khi createdAt bằng nhau | Cả hai owner đủ130 unique IDs, từng page khớp slice expected, không missing/duplicate |
| size100 pages1/2, default size | 200; 100+30; default10/pages13 | Assert trực tiếp PostgreSQL API response |
| page9/size17 | 200; items[], page9, total130/pages8 | PASS, không clamp page ở Backend |
| status/type/model/keyword và combined, size7 | 200; count trước limit, traverse đủ filtered IDs | Tất cả enum/keyword combinations đã nêu PASS cho A và B |
| Keyword không khớp | 200; items[], total0/pages0 | PASS |
| companyId/userId/sort hoặc page0/size0/size101/pageabc/statusUNKNOWN | 400 | Tất cả request bị chặn |
| Student/Admin GET quản lý | 403 | Cả hai roles PASS |
| B GET/PUT/PATCH internal DRAFT A | 403 | Không đọc/sửa/tự approve foreign Job |
| PENDING/BLOCKED Company đọc own | 200; total130, own DRAFT vẫn thấy | Cả hai verification states PASS |
| PENDING/BLOCKED gửi duyệt hoặc tự ACTIVE | 403 | Không suy yếu moderation |
| Public DRAFT; ACTIVE thuộc Company chưa VERIFIED | 404 | Public detail không lộ; Student generic detail cũng403 khi Company chưa VERIFIED |
| Public list / generic Company discovery | 200; chỉ public ACTIVE/VERIFIED; generic giữ own+eligible foreign ACTIVE | Count đúng dataset, giữ semantics cũ |
| Create DRAFT rồi soft-close | 200; draft count+1 rồi trở lại; closed list có row | SQL-filtered read-back PASS |

Sort tie-break được kiểm bằng expected ID order trên toàn bộ pages, không chỉ assert số lượng. Đây là offset pagination ổn định với dataset không đổi; không cung cấp snapshot xuyên nhiều request nếu có concurrent insert/delete.

## Browser thật và Frontend unit tests

`own-jobs.spec.mjs` thêm 7 cases, Chromium + Vite + Backend/AI/PostgreSQL thật, không mock HTTP:

- J01: Company PRIMARY có16 Jobs, page1 IDs26–19/page2 IDs18–11, size8/pages2. Offline sau đổi keyword vẫn giữ page2/count16/rows đã xác nhận, disable pager, không false empty; explicit retry online trả confirmed0. Reset và đổi Java→React nhanh hiển thị response cuối (3 matches), thêm DRAFT filter trả0. Không GET generic `/jobs` khi thao tác quản lý.
- J02: duy nhất secondary Company B fixture `Own paging draft [p1-e2e]`, Job31. Lần đầu tạo DRAFT qua UI với POST200 rồi edit PUT200; lượt đầu sau đó thất bại do locator test tìm title dạng link trong khi UI có text title và link “Xem” riêng. Sửa locator kiểm title text và href detail đúng ID, không sửa UI/assertion nghiệp vụ để hợp thức hóa. Các lượt PASS tái sử dụng đúng Job31: UI edit, submit PENDING_APPROVAL, withdraw DRAFT, reload/read-back; public404. Cuối cùng DRAFT, benefits lưu đúng; không Admin approve/publish và không tạo thêm Job trùng.
- J03: 375/430/768/1024/1440 đều render đúng Backend page/count, đủ8 titles/detail links, pager nhìn thấy, không document overflow. Có local screenshots; đã xem ảnh mobile. Không tuyên bố kiểm WCAG exhaustive.

`RecruiterOwnJobs.test.tsx` thêm **6 tests HTTP mock** riêng: authoritative count130/pages17, page/filter requests và reset, pending/empty, lỗi giữ snapshot + explicit retry, deferred stale response, last-page correction sau close. Đây là unit evidence cho React state, không thay bằng chứng PostgreSQL/browser. Existing moderation test đổi đúng endpoint fixture, giữ assertions.

## B06 — điều tra trước/sau, chưa chốt root cause

Artifact lịch sử `profile-e2e-reload-failure.{log,json}` ghi nhận39/40: Company reload application24, UI load-error, Backend GET200. `company-reload-evidence.json` ở lượt sau có body REVIEWED và UI PASS. Lần lỗi gốc thiếu client body/XHR/Request-ID đầy đủ nên không thể suy ra nguyên nhân từ HTTP200.

Source trace: reload gọi auth/me, companies/me, company application detail24, cùng các loader ứng tuyển/saved-candidates/job selector; detail loader độc lập. Auth sessionStorage và Axios JWT interceptor, 401 clear session; React StrictMode chạy effects thêm trong dev. `useAsyncData` cleanup active flag bảo vệ setState sau unmount; parent loader failures không đủ để giải thích detail catch. Không tái hiện stale token/session-clear race nên không sửa AuthProvider theo suy đoán. Không sửa production Application flow.

Diagnostic riêng `b06.playwright.config.mjs`/`diagnostics/b06-reload.spec.mjs`: retries0, giữ timeout hiện hữu, login form thật, application PRIMARY chỉ đọc, không mutation/mocks. Quan sát safe body shape/status/role, X-Request-ID, Authorization **presence**; session SHA256 fingerprint rút gọn, không token. Native XHR giữ open/send, ghi event/status/JSON shape; MutationObserver chỉ boolean reviewed/error/loading; document UUID/lifecycle, resource count/heap, console/pageerror/requestfailed. Password/JWT/email được redact, trace/video tắt. `collect-b06-server-evidence.mjs` chỉ trích safe Request-ID summary từ Backend logs.

| Mode | Trước sửa pagination | Sau sửa/rebuild | Expected/actual |
|---|---|---|---|
| 6 phiên đăng nhập mới, reload mỗi phiên | 6/6 | 6/6 | HTTP200/success/REVIEWED, UI Đã xem |
| Một phiên giữ nguyên, 12 reload | 12/12 | 12/12 | Session fingerprint không đổi mỗi lượt, UI không load-error |
| 12 list→detail remount | 12/12 | 12/12 | Detail response hợp lệ, UI Đã xem |
| Server Request-ID correlation auth/detail | 172/172 | 175/175 | Tất cả200, 0 unmatched |

Tổng **60/60 quan sát**, 6 diagnostic test executions (3 trước +3 sau), 152 detail responses tính cả warm-load/StrictMode đều200/success/REVIEWED. 0 pageErrors và0 rounds có DOM load-error; XHR của các sampled detail chỉ load/loadend, không error/abort/timeout. Session giữ nguyên trong mỗi round. Console chỉ có React Router future-flag warning. Có `ERR_ABORTED` ở các loader trang khác/auth và Google font khi điều hướng; không ghi nhận abort target detail. Resource entries mỗi document182–188, heap Chromium báo khoảng44.7–56.8MB trong lượt sau; không chứng minh memory/resource nguyên nhân lịch sử. Vite module failures không xuất hiện trong các quan sát này.

**Kết luận: UNRESOLVED / NOT REPRODUCED.** Có thể đối chiếu hiện tượng 200→UIerror tốt hơn khi lỗi tái diễn; chưa có chứng cứ đủ để chỉ ra transport/JSON/render/session/resource cụ thể gây lần lỗi cũ. Không retry/skip/tăng timeout để che B06; diagnostic PASS không phải fix evidence.

## Verification và data preservation

| Lệnh / nhóm | Kết quả thực chạy |
|---|---|
| Backend `mvnw.cmd -B -ntp clean verify` | **486 PASS** =247 Surefire +239 PostgreSQL Failsafe; 0 failure/error/skip;87s; kết thúc2026-11-03 23:41:15+07 |
| Frontend `npm run test:run` | **158/158**,24 files,10.46s |
| Frontend lint / TypeScript + Vite build | PASS; bundle warning >500kB hiện hữu |
| Targeted own-jobs browser | **7/7**,11.5s sau sửa locator test |
| Full real Playwright | **47/47**,2.3m;40 cases cũ+7 mới;0 retry/skip/flaky |
| B06 targeted trước/sau | **3/3 +3/3**,20.9s/16.0s;60 quan sát, kết luận unresolved như trên |
| Existing locked AI environment | pip check PASS; **887 pytest PASS**,5.48s;1 Starlette/httpx deprecation warning; không sửa dependency/AI |
| Read-back/comparators | PASS:10 aliases,4 CV,16 PRIMARY Jobs,3 PRIMARY Applications và PRIMARY profile content |

Backend được rebuild bằng `docker compose up -d --no-deps --build backend`, giữ `student-job-recommendation-system_postgres_data` và `student-job-recommendation-system_cv_uploads`. PostgreSQL/AI giữ creation time2026-11-03T11:44:31Z; ba service healthy. SQL Flyway read-back `19|t`, không có migration mới, không reset volume.

SQL đọc trực tiếp cũng xác nhận `primary_jobs|16`, `cv_ready|4`, application PRIMARY `1|20|REVIEWED|1`, `9|12|PENDING|1`, `24|11|REVIEWED|1`, fixture `31|3|DRAFT` (id/company/status). Không SQL write vào database demo trong work package này.

Baseline local chụp trước sửa lúc2026-11-03T16:27:11Z. `summarize-state.mjs` + `verify-preservation.mjs own-jobs-baseline.json` đối chiếu alias user/resource IDs/status, existing CV metadata/READY, PRIMARY Job id/title/status/deadline/skills, application id/job/status/CV. Sau full suite: PRIMARY applications24 REVIEWED,9 PENDING,1 REVIEWED giữ nguyên; không đổi credentials/verification. Public totals giữ20Jobs/4Companies/6Students; applications51→54 do A09 tạo3 reapplication history rows cho secondary fixture theo V18. Đây không phải bulk status rewrite.

`verify-own-jobs-preservation.mjs`: PRIMARY aggregate content khớp baseline sau khi loại revision/createdAt/updatedAt. Revision15→20 là5 successful positive saves hiện hữu của A02/B03 trong full suite, nội dung được restore; negative atomic cases vẫn dùng secondary. Secondary Company3 có đúng một Job31 DRAFT/benefits persisted, public404. Không so sánh toàn bộ bytes/database; raw artifacts/credentials/snapshots giữ gitignored và không commit.

Chạy lại (không ghi đè baseline đã chụp):

```powershell
# e2e/, sau setup hợp lệ với local credentials hiện hữu
$env:E2E_USE_DEV_SEED_ADMIN = '1'
npx playwright test
npx playwright test --config=b06.playwright.config.mjs
node collect-b06-server-evidence.mjs
node summarize-state.mjs
node verify-preservation.mjs own-jobs-baseline.json
node verify-own-jobs-preservation.mjs
```

Evidence local: `own-jobs-backend-verify.log`, `own-jobs-frontend-{tests,lint,build}.log`, `own-jobs-final-{results.json,e2e.log}`, `own-jobs-browser-evidence.json`, `b06-{baseline,final}-{evidence,server}.json`, `own-jobs-preservation-evidence.json`, `own-jobs-profile-preservation.json`, `screenshots/own-jobs-*.png` dưới `e2e/.local/`. Logs không phải artifact được publish trong PR.

## Giới hạn còn lại

- B06 chưa root cause như trên. Chưa có bằng chứng lỗi tái hiện để sửa production một cách có căn cứ.
- G03 được xử lý cho Job management; Recruiter Dashboard/Reports vẫn dùng query mẫu size100 và có giới hạn count riêng, không nâng phạm vi thành analytics chính xác toàn bộ dataset.
- Offset pagination không giữ snapshot khi dataset thay đổi đồng thời; không bổ sung cursor/session pagination ngoài contract.
- Các unsupported flows và gaps khác trong [inventory lịch sử](student-company-functional-gaps.md) không được nghiệm thu bởi lượt này.
- Không thay AI/CV processing V2, TF-IDF/Cosine, Recommendation V3/Ranking V3, eligibility/corpus/weights/tiers/limits/ranks/scores; full Backend/AI/browser regression kiểm chứng trong phạm vi assertions hiện hữu.

`git diff --check`/`git diff --cached --check` và staged secret/artifact scan **PASS,20 paths**; đối chiếu actual local credentials/env secrets và JWT-like literals, không private/generated artifacts. Chỉ stage work package; ba dirt có sẵn giữ ngoài commit. PR #66 giữ Draft, không merge/force push.
