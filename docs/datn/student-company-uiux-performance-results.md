# Student & Company UI/UX + Performance — giai đoạn 2/3

Thực thi **2026-11-04 (+07)**. PR **#66 giữ Draft**, không merge/force push.
Không thực hiện thao tác tắt/restart/sleep/hibernate Windows hoặc đặt lịch nguồn.

## 1. Baseline

Tiếp tục branch `design/datn-ui-ux-refresh-20261102` từ
`ee6d62ed1a08de8350490217ae908e349310cef8`, không reset/stash/rebase. Giữ dirt
có sẵn `frontend/tsconfig.app.tsbuildinfo`, `.agents/`, `skills-lock.json` ngoài commit.
Đã kiểm tra PID/command line và log trước khi chạy tiếp; không còn Maven integration
suite chạy. Demo Vite PID 27452 được giữ. Không chạy hai Backend integration suites
hoặc hai Playwright processes đồng thời. Production measurements đã hoàn tất trước
khi chạy full regression để tránh tranh CPU với tests.

Baseline riêng `uiux-*` capture một lần, từ chối ghi đè: API inventory,
PostgreSQL strict/content digests, PRIMARY password/identity/profile/preferences,
runtime read-back năm aliases. Trước đo: **30 aliases**, **16 PRIMARY Jobs**,
**2 PRIMARY CV**, **3 PRIMARY Applications**, **1 PRIMARY bookmark**; inventory có
**14 CV metadata rows, 4 READY**, giữ cả
histories Student V3 **72 runs / 1,440 results**, Company V3 **48 runs / 144 results**.
Các con số này bao gồm dữ liệu đã có sau giai đoạn 1, không quay về 28 aliases.

Build baseline được giữ tại `e2e/.local/uiux-before-dist`, preview riêng 5176.
Build sau sửa preview 5177; Backend/PostgreSQL/AI không rebuild/restart trong phase 2.
Các checkpoints `after`, `after-final`, `after-accepted` là bằng chứng trung gian;
**`uiux-final-performance.json`** là lượt đo cuối của source bàn giao.

## 2. Task interpretation và audit hành trình

Phạm vi Frontend Student/Company và tooling kiểm chứng; không triển khai Admin,
module Backend mới, migration hoặc thay thuật toán. Audit source, production build,
browser hành động thật và baseline regression; không suy diễn route smoke thành
business integration. Bảng dưới chỉ rõ evidence cho từng hành trình.

| Hành trình | Kiểm tra có thực hiện / evidence |
| --- | --- |
| Register/login/role/navigation/logout | B02/B10/N06/S02; U02 real 401 tiếng Việt, focus, giữ draft; U07 lazy chunk offline/reload; R01 chỉ inventory 79 routes |
| Student dashboard/profile | D02 đối chiếu API/offline không tạo zero giả; B03; P01–P04 atomic save/two-tab 409/validation rollback/offline/double-click/explicit reload |
| PDF/DOCX upload/analysis/activation | A03/A11/A12/B13; U11 DOCX tên dài qua upload thật, NOT_READY → explicit analyze → READY, detail năm viewport và dialog; không tự đổi CV active |
| Recommendation PRIMARY/FALLBACK/reasons/history | A04/B04/L02 + reliability isolated; persisted READY snapshot, ordering/tiers, generation timeout/recovery/session isolation; đo production read-only |
| Jobs/search/save/apply/reapply/withdraw/history | B01/B05/B06/B08, A05/A06/A09, L01/L02; cancel/offline/double-click/terminal transitions; không reset WITHDRAWN |
| Student settings/password/notifications | N01–N04/N06/N07, P04, S02, settings/reliability isolated; secondary password change/restore và stale draft |
| Company dashboard/reports/CSV | D01 + analytics isolated SQL oracle; U04 keyboard scroll; production axe/screenshots; không suy diễn dữ liệu chart từ mock |
| Company profile/account/preferences | B11/N01–N03/P04 + reliability CAS; U10 bỏ control giả; existing positive B11 save/restore vẫn giữ nguyên |
| DRAFT/submit/moderation/Job list | B12/J01–J03/M01–M04; U01 blank validation zero POST/focus; U08 debounce search; secondary DRAFT và Admin setup APIs hợp lệ theo baseline tests |
| Applications/CV/review/accept/reject | B06/L01/L02/C01/A07/S01; owner-scoped CV streaming và terminal/foreign denial |
| Saved Candidate/note revisions/ranking | C01–C05/A10/B07 + reliability; U05 tên vùng bảng phân biệt PRIMARY/FALLBACK; offline/409/ownership/pagination/session |
| Loading/error/empty/success và long content | Existing negative/offline/empty fixtures; new U02/U07/U09/U11; retained snapshot/draft không báo thành công giả |

Mutations mới U11 dùng alias phụ `incomplete`; chỉ xóa CV mới không active,
không tham chiếu application do chính test tạo. PRIMARY chỉ đọc trong tests mới.
Full default suite giữ nguyên các positive PRIMARY save/restore có sẵn; không dùng
PRIMARY tạo negative scenarios. Không tuyên bố chức năng chưa có Backend là đã kết nối.

## 3. Root cause / defects có bằng chứng

| ID / mức độ | Before / nguyên nhân | Sửa và bằng chứng sau |
| --- | --- | --- |
| UX01 / Medium | Login đọc trực tiếp Backend English `Invalid email or password`; lỗi chưa được focus, password thiếu mô tả lỗi | Dùng central Vietnamese mapper, focus alert, liên kết cả password; real 401 U02 giữ credentials |
| UX02 / Medium | Toast `w-full right-4` ở 375 px có x = -16; live content nằm ngoài landmark | Giới hạn width theo viewport, mobile bottom, named polite region, nút đóng 44 px; U09 bounds/announcement |
| UX03 / Medium | Tên DOCX dài không ngắt trong intrinsic grid track, detail/analysis và delete dialog tràn nội dung | `minmax(0,1fr)`, `min-w-0`, wrap-anywhere; U11 thật upload/analyze, 5 widths, keyboard/cancel |
| AX01 / Medium | Timestamp/sidebar text slate-400 contrast thấp (timestamp 2.56); nested complementary landmarks, duplicate unnamed table regions, scroll table không focus | slate-600, named regions, loại nested landmarks, distinct tier table names, focusable trend scroll; U03–U05 và 50 axe audits |
| UX04 / Low | Header `Công ty mẫu` là button không handler | Static label `Tài khoản doanh nghiệp`; U10 không còn button giả; không tạo company switch |
| PF01 / Medium | Router eager-import toàn bộ pages/charts; login tải entry 1.30 MB raw | Route-level lazy, navigation giữ mounted; chart chỉ tải khi cần; U07 failure/reload và 2 unit tests boundary |
| PF02 / Medium | Gõ `Java` tạo 4 GET keyword J/Ja/Jav/Java | Debounce 300 ms, đổi filter flush keyword, reset page trong cùng update; U08 đúng 1 GET, không đổi server filters |

Before failures được giữ local: `uiux-before-regression-results.json`,
`uiux-before-search-results.json`, `uiux-before-toast-results.json`,
`uiux-before-header-results.json`, `uiux-long-cv-overflow-before-results.json`
và logs tương ứng. Không bỏ assertion để chuyển FAIL thành PASS.

Phân biệt lỗi setup: lần đầu U11 giả định upload 201 và tự READY; API thực tế upload
200/NOT_READY, cần explicit reanalyze. Đã sửa test theo contract; không sửa production
upload/parser. Một CV mới còn lại do assert trước khi capture ID được xác minh đúng
unique filename, inactive, không thuộc baseline rồi xóa qua API; evidence
`uiux-long-cv-setup-cleanup.json`. Overflow sau đó được tái hiện độc lập trước fix.

## 4. Implementation và measurements

Router lazy pages + `RouteContent` Suspense/error boundary trong Public/Dashboard
layouts giữ navbar/sidebar khi chunk đang tải/lỗi; explicit reload hoặc đổi menu
để phục hồi, không remount normal route theo key. Shared router cũng defer những
exports Admin đã tồn tại để tránh kéo charts vào login; không sửa page/module Admin.
Các fixes khác nằm ở Login/AuthFlow/apiErrors, Sidebar/Dashboard, CompanyAnalytics,
Table/RankingTier, Toast, Company header, RecruiterJobs và CV detail/analysis/modal.
Existing request/session ownership, retained query snapshot và disabled stale actions
vẫn giữ. Chỉ sửa late-search unit test để chờ request cũ thực sự bắt đầu trước khi
gửi keyword mới; toàn bộ assertions race cũ giữ nguyên.

Dependency mới duy nhất: dev-only `e2e/@axe-core/playwright@4.10.2`, pinned lock,
dùng audit accessibility; không thêm runtime Frontend dependency. Preservation scripts
chỉ thêm namespace `--uiux`, không đổi digest/normalization/assertions.

### Production bundle

| Chỉ số | Before | Final |
| --- | ---: | ---: |
| Entry JS raw bytes | 1,304,583 | 365,584 |
| Entry gzip bytes | 364,360 | 113,810 |
| Tổng JS tất cả chunks raw bytes | 1,382,779 | 1,412,564 |
| Chart chunk raw/gzip bytes | Gộp vào entry | 363,411 / 106,500 |
| Build >500 KB chunk warning | Có | Không |

Entry gzip giảm **68.8%**. Tổng JS tăng **2.2%** do chia chunks và bổ sung recovery;
không tuyên bố tổng mã ứng dụng nhỏ hơn. Login không còn tải chart pages.

### Điều kiện và kết quả load

Windows, headless Chromium **141.0.7390.37**, production Vite preview loopback,
Backend/PostgreSQL thật không đổi dữ liệu trong cặp đo; no network/CPU throttle,
1440×1000, DPR 1, reduced motion. Mỗi màn 3 contexts mới: cold cache cleared/enabled,
warm reload cùng context/cache enabled có thể revalidate. `readyMs` đến heading và
loading-state biến mất; resources thu sau networkidle. Đây là operational readiness,
không phải React profiler commit time hay full response của mọi request. Ghi cả
resource duration/encoded/decoded/transfer, LCP/CLS/long tasks và browser errors.
Không đo Lighthouse, INP, SSR hydration hoặc thiết bị/WAN thật.

Mỗi phase **60 samples + 50 viewport audits/screenshots**. Giữ cùng baseline data
và runtime exact read-back trước/sau lượt đo; chỉ sau đó chạy mutation regression.
Median/max dưới đây có n=3, không dùng p95 hoặc suy diễn ý nghĩa thống kê.
JS transfer là Resource Timing gồm overhead, KiB; cache revalidation overhead tăng
với nhiều chunks là số đo thật. Số request API không bao gồm API login bootstrap
ngoài page context. [Metrics đã lược dữ liệu riêng](student-company-uiux-performance-metrics.json)
có đầy đủ LCP/CLS, median/max và payload/network counts.

| Screen | Cache | Ready median ms before → final | Max ms | JS KiB | API requests |
| --- | --- | ---: | ---: | ---: | ---: |
| login | cold | 236 → 258 | 2975 → 267 | 356.1 → 119.8 | 0 → 0 |
| login | warm | 39 → 34 | 41 → 36 | 0.3 → 2.3 | 0 → 0 |
| student-dashboard | cold | 350 → 343 | 385 → 353 | 356.1 → 125.4 | 11 → 11 |
| student-dashboard | warm | 85 → 135 | 87 → 138 | 0.3 → 3.8 | 11 → 11 |
| student-profile | cold | 316 → 281 | 323 → 303 | 356.1 → 164.7 | 3 → 3 |
| student-profile | warm | 65 → 62 | 66 → 128 | 0.3 → 5.6 | 3 → 3 |
| student-cvs | cold | 317 → 319 | 321 → 322 | 356.1 → 124.3 | 3 → 3 |
| student-cvs | warm | 64 → 58 | 74 → 64 | 0.3 → 2.9 | 3 → 3 |
| student-recommendations | cold | 394 → 422 | 423 → 431 | 356.1 → 153.5 | 32 → 32 |
| student-recommendations | warm | 161 → 176 | 184 → 182 | 0.3 → 7.6 | 32 → 32 |
| company-dashboard | cold | 321 → 334 | 326 → 343 | 356.1 → 225.7 | 3 → 3 |
| company-dashboard | warm | 78 → 89 | 79 → 91 | 0.3 → 2.3 | 3 → 3 |
| company-jobs | cold | 314 → 322 | 315 → 323 | 356.1 → 133.2 | 4 → 4 |
| company-jobs | warm | 58 → 68 | 63 → 70 | 0.3 → 4.4 | 4 → 4 |
| company-ranking | cold | 307 → 318 | 330 → 319 | 356.1 → 133.7 | 5 → 5 |
| company-ranking | warm | 83 → 84 | 102 → 96 | 0.3 → 4.7 | 5 → 5 |
| company-reports | cold | 339 → 338 | 339 → 338 | 356.1 → 225.7 | 3 → 3 |
| company-reports | warm | 70 → 75 | 97 → 80 | 0.3 → 2.3 | 3 → 3 |
| company-settings | cold | 260 → 277 | 263 → 324 | 356.1 → 127.3 | 3 → 3 |
| company-settings | warm | 47 → 59 | 48 → 59 | 0.3 → 3.5 | 3 → 3 |

PASS cho payload entry/network cold giảm và search burst 4→1. **Readiness latency
hỗn hợp**, một số warm paths chậm hơn; không đặt SLA tùy tiện hoặc báo tất cả nhanh
hơn. Recommendation còn 32 GET, dashboard Student 11 GET trên fixture này; không
đổi V3/READY contracts để gom requests. Tables vẫn server-pagination, không thêm
virtualization/memoization khi chưa có profiling chứng minh cần thiết. Không có
React runtime/page errors ở hai lượt đo; không tuyên bố số render ít hơn vì chưa
thu React Profiler commit counts.

### Responsive / accessibility / screenshots

| Screens được đo | 375 | 430 | 768 | 1024 | 1440 |
| --- | --- | --- | --- | --- | --- |
| login, Student dashboard/profile edit/CV list/recommendations | PASS | PASS | PASS | PASS | PASS |
| Company dashboard/jobs/ranking/reports/account settings | PASS | PASS | PASS | PASS | PASS |
| U11 long DOCX detail sau fix | PASS | PASS | PASS | PASS | PASS |

Mỗi ô nhóm đầu có axe + document horizontal overflow + screenshot từng màn, không
chỉ route navigation. Baseline 83 rule observations lặp qua 50 audits, **5 unique
rules**: color-contrast, region, landmark-complementary-is-top-level,
landmark-unique, scrollable-region-focusable. Final **0 violations / 0 overflow**
trong 50 audits; hai phase **0 console/page errors** ở các page loads đo được.
Không coi 83 là 83 root causes hoặc tuyên bố WCAG AA toàn ứng dụng.

Before screenshots: `e2e/.local/uiux-before-{screen}-{width}.png`;
after: `e2e/.local/uiux-final-{screen}-{width}.png` (10 màn × 5 widths mỗi phase).
Toast pair `uiux-before-toast-375.png` / `uiux-after-toast-375.png`;
CV thêm `uiux-long-cv-{width}.png`. Chụp trực tiếp browser thật. Raw images có thể
chứa metadata/CV/PII nên giữ gitignored, không upload vào PR. Visual spot-check
không thay thế manual audit mọi trạng thái trên mọi thiết bị.

U01 focus first invalid input + linked errors + zero writes; U02 focus alert;
U04 focus/ArrowDown scroll; U06 mobile menu Tab containment/Escape/return focus;
U11 dialog Tab/Escape/cancel. U09 toast polite live region và bounds; names/contrast/
landmarks được axe kiểm. Existing B02/B09/J03/N07 keyboard/viewport checks giữ nguyên.

## 5. Contract safety

Không đổi Backend/AI/migrations/public DTO hoặc API signatures. Student Recommendation,
TF-IDF/Cosine, PRIMARY/FALLBACK, weights 0.65/0.35, global Student Top-K, independent
Company tier limits, Backend-owned official rank/persistence, stateless AI boundary
và persisted READY CV snapshot giữ nguyên. CV preprocessing V2 không thay đổi.
Student V19, Saved Candidate V20 và Company/preferences V21 captured If-Match CAS
giữ nguyên; không tự GET tag mới để retry conflict. Company ownership, moderation,
application transitions và history uniqueness giữ nguyên.

## 6. Verification và preservation

| Check | Execution giai đoạn 2 |
| --- | --- |
| Backend `JAVA_HOME=...ms-21.0.12; mvnw.cmd -B -ntp clean verify` | **520 PASS = 249 Surefire + 271 Failsafe**, 0 failure/error/skip, BUILD SUCCESS |
| Frontend `npm run test -- --run`, `npm run lint`, `npm run build` | **226 PASS / 36 files**, baseline 224 + 2 boundary regressions; lint/build PASS |
| AI `.venv/Scripts/python -m pip install --require-hashes -r requirements.lock`, `pip check`, `pytest` | **887 PASS**, hash install/check PASS; 1 existing Starlette/httpx deprecation warning |
| UI acceptance production | **11/11 PASS, 15.2s**, gồm observed zero writes, inactive CV read-back, Tab/Shift+Tab wrap ở menu và modal; 0 skip/retry |
| Production measurement | 60 samples + 50 audits mỗi phase; final 0 axe/overflow/console/pageerror |

Full default lượt đầu trên demo dev `localhost:5173`: **63 PASS / 3 FAIL**, exit 1,
không tính là đạt. Giữ `uiux-default-first-results.json`, `uiux-default-first-run.log`
và `uiux-default-first-artifacts`. L02 `net::ERR_CONNECTION_REFUSED`; N07 thiếu switch
và screenshot trắng. Vite PID vẫn sống, chỉ listen IPv4 127.0.0.1; chưa chứng minh
nguyên nhân localhost/renderer/resource, không gán root cause hoặc gọi fixed.

D02 click offline rồi goBack trước route lazy mount: snapshot vẫn là confirmed
dashboard và không tạo request reload nên alert expectation sai prerequisite.
Warm module bằng navigation thật online rồi await lỗi API offline trước goBack;
giữ tất cả alert/no-fabricated-zero/recovery assertions cũ, thêm URL checks. Một
targeted attempt đòi application heading offline cũng sai vì branch lỗi API không
render heading; snapshot chỉ rõ alert. Sửa prerequisite thành API error thật.
Targeted D02 sau sửa **1 PASS**; L02/N07 **2 PASS** trên production preview IPv4.
Không dùng các lượt targeted thay trọn bộ 66; full production run thu riêng.

Full default production **66/66 PASS, 2.9 phút**, 0 fail/skip/flaky/retry,
`E2E_FRONTEND_URL=http://127.0.0.1:5177`, giữ config/assertions/timeout/retry.
Lượt dev đầu vẫn **FAIL**, không gộp hoặc xóa khỏi báo cáo. Không dùng kết quả này
để tuyên bố lỗi dev localhost lịch sử đã fixed.

Preservation sau hai full default runs và targeted L02:

| Comparator / dữ liệu | Kết quả |
| --- | --- |
| API inventory từ `uiux-baseline.json` | **PASS**: 30 aliases/14 old CV metadata (4 READY), 16 PRIMARY Jobs, 3 PRIMARY Applications |
| PRIMARY identity/password/preferences + Student profile content | **PASS**, không thay mật khẩu/ownership/content PRIMARY |
| SQL strict full-row | **FAIL / exit 1**: đúng 2 PRIMARY CV `updated_at` mismatches từ A03 activate/restore; không bỏ assertion |
| SQL separate content baseline bỏ duy nhất CV `updated_at` | **PASS / 0 mismatch**; tất cả field CV khác và rows Jobs/Applications/bookmark/history cũ nguyên vẹn |
| Old Student V3 history | **72 runs / 1,440 results** exact field digests preserved; thêm **6 runs / 120 results** từ hai positive suites |
| Old Company V3 history | **48 runs / 144 results** preserved; thêm **4 runs / 12 results** |
| PRIMARY Company account | Business fields exact; revision **2→6**, updatedAt đổi từ hai lần B11 save/restore mỗi full suite |
| Exact runtime năm snapshots trong cửa sổ đo performance | **5/5 PASS**: `uiux-measurement-runtime-preservation.json` |
| Exact runtime sau mutation regressions | **FAIL / exit 1**: chỉ Student PRIMARY exact; Company account revision/updatedAt và analytics totals đổi theo secondary applications, secondary preferences/account revisions và inbox history đổi theo positive cases |
| Docker | PostgreSQL/AI ID/image/StartedAt giữ nguyên so baseline phase 1; Backend StartedAt 11:52:36Z trước phase 2; cả 3 healthy, hai named volume name/CreatedAt/driver exact |

Không normalize runtime comparator để làm mất FAIL. `uiux-runtime-diff.json` ghi
field paths đã đổi, không ghi values riêng; đối chiếu PRIMARY account business fields
riêng bỏ đúng revision/updatedAt. Saved Candidate bookmark cũ **1 row** và PRIMARY
Applications **3 rows** giữ tất cả SQL field digests. Final **34 aliases**, public
statistics Students **26→30**, Applications **168→197** do secondary fixtures/history;
không xóa/reset history để ép số tổng quay về baseline. Existing WITHDRAWN không reset.
Chỉ CV mới do U11 tạo được xóa theo API hiện hữu, không hard-delete protected data.

Các suites riêng được chạy tuần tự bằng
`scripts/run-settings-notifications-isolated-e2e.ps1 -Suite notifications|analytics|reliability`
với Java 21:

| Isolated suite | Kết quả giai đoạn 2 |
| --- | --- |
| Settings/Notifications | **6/6 PASS**, 12.2s, direct runner exit 0 và cleanup |
| Analytics | **6/6 PASS**, 18.0s, full SQL oracle/362-row CSV/ownership/offline/5 viewports; direct runner exit 0 |
| Reliability | **26/26 PASS**, 2.4 phút, real PostgreSQL + AI, outage/timeout/TCP reset/recovery/CAS/session isolation; direct runner exit 0 |

Settings lượt đầu cũng ghi 6/6 PASS nhưng nested PowerShell wrapper không trả về,
runner parent đã biến mất và còn fixture/Vite orphan; giữ JSON/log, không gán lỗi
production. Xác minh không còn Playwright, thu kết quả trước; stop đúng wrapper và
Vite 5175 của lượt đó, gửi fixture stop file, xác minh port trống. Chạy trực tiếp
runner để xác nhận cả execution/cleanup exit 0. Không kill Java/Node/Docker hàng loạt.
Các isolated mutations chỉ nằm trong PostgreSQL dùng một lần, không dùng PRIMARY
để tạo negative cases. Final logs/JSON prefix `uiux-*`, raw artifacts gitignored.

Kiểm tra bàn giao lúc **22:26 (+07)** sau khoảng gián đoạn thấy PID Vite demo 27452
đã biến mất và cổng 5173 không có listener; không suy diễn nguyên nhân hoặc liên hệ
nhân quả với failure dev trước đó. Khởi động lại **riêng frontend** hidden trên
127.0.0.1:5173, PID **36040**, giữ chạy để demo; HTTP frontend và proxy Backend thật
đều **200** (`uiux-demo-recovery.json`). Không restart ba containers/Windows.
Hai previews 5176/5177 là processes dùng riêng cho phép đo, được dọn theo PID/command
line sau bàn giao; demo mới không nằm trong cleanup. Cấm mọi thao tác nguồn Windows
vẫn giữ nguyên. Data comparators cuối chạy lại sau gián đoạn vẫn có cùng kết quả.

Bounded diagnostics chạy **một lượt riêng** trên dev `localhost:5173`, không đổi
instrumentation/timeout/retry/skip:

- B06 **3/3 PASS, 35.3s**, 6 fresh-session + 12 retained-reload + 12 remount rounds;
  **164/164 Request-ID** match Backend logs, không unmatched.
- N07 long-context **1/1 PASS, 21.4s**, 30 settings + 5 inbox visits,
  **228 safe API summaries**, 0 console/pageerror; 19 requestfailed đều ERR_ABORTED
  trong navigation, không coi aborted là HTTP success.

Artifacts `uiux-b06-{results,evidence,server-evidence}.json`, `uiux-n07-{results,evidence}.json`
và logs giữ local. Không dùng diagnostic PASS che failure dev đầu: B06 historical
cause vẫn UNRESOLVED / NOT REPRODUCED; N07 blank symptom observed ở full dev đầu,
root cause vẫn UNRESOLVED, không tái hiện trong lượt bounded này.

## 7. Diff safety

Chỉ Frontend UI/shared router và E2E tooling/docs. Không Backend/AI/Flyway/production
dependency changes. Không đổi timeout/retry/skip, không HTTP mock trong browser
acceptance. E2E fault injection chỉ ở isolated fixture theo suite hiện hữu. Raw
credentials/tokens/PII/screenshots/logs ở `.local` không stage. Baseline snapshots
không ghi đè. Dirt có trước giữ nguyên ngoài commit.

Staged review **33 paths**; `git diff --cached --check` PASS. Quét staged blobs
với **53 giá trị credential/token/secret thực tế** từ local fixtures/environment,
JWT/private-key patterns và generated/private paths: **PASS / 0 findings**.
Metrics JSON công khai chỉ có screen labels và số đo, không chứa response bodies,
email, CV text, JWT hoặc private notes. Không stage screenshots/raw reports.

## 8. Remaining risks / acceptance

- **B06: UNRESOLVED / NOT REPRODUCED. N07: UNRESOLVED; triệu chứng trang trắng đã
  quan sát lại trong lượt dev đầu.** Production targeted/full PASS không phủ nhận
  failure này. Giữ instrumentation; bounded diagnostic PASS chỉ xác nhận lượt quan
  sát, không chứng minh đã sửa nguyên nhân lịch sử.
- Performance acceptance là payload giảm và không regression chức năng trong
  evidence nêu trên; latency hỗn hợp cần ghi rõ khi bảo vệ ĐATN. Chưa đo WAN/mobile
  hardware hoặc INP; không claim Lighthouse/production SLA/whole-app WCAG.
- Recommendation 32 GET và warm chunk revalidation còn là optimization follow-up;
  không có bằng chứng để rewrite API/React architecture trong giai đoạn này.
- Các defects UI có reproduction nêu trên đã sửa; **N07 dev blank và L02 dev
  connection refusal vẫn chặn cam kết ổn định demo dev localhost** khi chưa có
  nguyên nhân. Không ký nghiệm thu toàn hệ thống khi B06/N07 chưa có root cause
  hoặc người nghiệm thu yêu cầu cam kết
  thiết bị/WAN/WCAG toàn bộ; PR tiếp tục Draft. Các placeholder/absent notification
  producers đã có trước không được coi là feature mới hoàn thành.
- Giai đoạn 3/3 chưa thuộc phạm vi triển khai này.
