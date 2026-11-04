# Company Dashboard & Reports — accurate analytics / real E2E

Work package 2026-11-04, branch `design/datn-ui-ux-refresh-20261102`, baseline
`5b16e9c6`. PR #66 luôn Draft; không merge/force push. Dirt có sẵn:
`frontend/tsconfig.app.tsbuildinfo`, `.agents/`, `skills-lock.json` giữ ngoài commit.

## Audit / before-after

Đọc AGENTS/CODEX_GUARDRAILS, API/schema/Flyway V1–V20, Company own-jobs/application
filter contracts, V18 reapply/lifecycle, moderation, Dashboard/Reports và Student
Dashboard source, các báo cáo/testing/preservation của package trước.

Before: Company Dashboard/Reports gọi mixed-scope `/jobs?page=1&size=100` rồi
lọc companyId; chỉ lấy100 applications. Dashboard total có thể120/360 trong khi
status/trends/performance chỉ tính100; 7/30/90 đều bị `Math.min(days,14)`.
Reports filter/export chỉ slice đã tải. Unit regression trước fix **2 FAIL**:
130 owned Jobs hiện100,360 histories báo100. Không dùng mock làm real E2E evidence.

After: Backend SQL aggregate toàn bộ owned dataset; frontend chỉ hiển thị response
aggregates và trang chi tiết. Không kéo1000+ rows về browser để tính lại.

## API / schema / calculations

Không migration mới, Flyway vẫn V20. Thêm CompanyAnalytics Controller/Service/JDBC
Repository và validated filter/response DTO trong module Company hiện hữu.
Role COMPANY, Company identity từ JWT, không nhận client companyId/userId/sort.
PENDING/BLOCKED Company vẫn đọc own internal analytics; không suy count internal
ACTIVE thành số Job đang public. Public visibility/moderation giữ nguyên.

- GET `/api/companies/me/dashboard-summary?days=7|30|90` (default30): all-time
  owned job status counts/total, all-time application status counts/total,
  uniqueStudents, acceptedRate; trend riêng đúng N ngày UTC, gồm today và zero
  buckets. Top10 Jobs toàn history; recent5 applications `applied_at DESC,id DESC`,
  kèm total/limit metadata. Expiring: owned ACTIVE, deadline từ today đến today+14
  inclusive; exact count + tối đa5 rows theo deadline ASC,id ASC; null/past bỏ.
- GET `/api/companies/me/recruitment-report`: optional `from`,`to` ISO dates,
  positive `jobId`, enum status, keyword≤255, page≥1/size1–100 (default1/10).
  Dates/status/keyword/Job đều AND trong WHERE **trước count/group/limit**.
  Keyword case-insensitive literal partial match Student name/email, Job title,
  original CV filename; escape `%`, `_`, backslash. Job foreign/missing404;
  invalid filter400, invalid date range400, unsupported/duplicate query400.
- Report trả normalized scope, status counts, total histories, distinctStudents,
  acceptedRate, monthly nonempty buckets, Top10 matching Jobs (explicit limit),
  và paginated application details. Empty scope: status zeros, total0, trend/rows
  empty, rate null. Không gộp V18 reapplications thành một đơn.
- Accepted rate = current ACCEPTED history rows / **all histories trong filter**,
  gồm PENDING/REVIEWED/REJECTED/WITHDRAWN, ×100, BigDecimal HALF_UP 2 decimals.
  Zero denominator →null/UI “Không áp dụng (0 đơn)”. Không coi đây là distinct
  student hire rate, transition-date cohort hay model accuracy.
- Date semantics **explicit UTC**: applied_at nằm trong `[from 00:00,to+1 00:00)`;
  dashboard lấy today từ `ZoneOffset.UTC`, không default host timezone. Existing
  columns là TIMESTAMP WITHOUT TIME ZONE: analytics đọc stored civil values theo
  convention UTC, không đoán/chuyển lại lịch sử hoặc sửa timestamp producers.
  Historical rows ghi bằng timezone khác không có offset để phục hồi; đây là
  limitation cần reviewed timestamp migration riêng nếu đổi business timezone.
- Mỗi response dùng read-only REPEATABLE_READ, các queries trong cùng snapshot.
  Offset pages và export requests khác nhau không phải một frozen dataset session.

## CSV

GET `/api/companies/me/recruitment-report/export` nhận cùng filters, **không page/size**.
Full filtered dataset, deterministic order; count>10000 →422
`REPORT_EXPORT_LIMIT_EXCEEDED`, không cắt âm thầm. Count và export cùng read-only
transaction snapshot. JSON `ApiResponse` chứa UTF-8 CSV string, rowCount, scope,
encoding/maxRows; giữ guardrail chỉ raw CV stream được bỏ envelope.

CSV BOM UTF-8, CRLF, quote/escape double quotes và embedded newline. Text bắt đầu
`= + - @` sau strip-leading-whitespace hoặc tab/CR/LF được prefix apostrophe chống
spreadsheet formula execution. Fields chỉ application/student IDs, Student name/
email, Job ID/title/status, applied/reviewed timestamps và **original** CV filename;
không password/hash/private storage path. Authenticated Company scope enforced ở API.
Browser tạo file sau HTTP success, hiển thị actual rowCount; nếu count khác snapshot
cũ báo dữ liệu thay đổi. Không commit/download artifact thật lên PR.

## UI / Student audit

Dashboard cards all-time; range selector chỉ điều khiển daily trend có label dates
UTC. Reports month-range/Job-ID/status/keyword chạy Backend; page reset1 khi filter
đổi, details phân trang. Job ID input cho phép mọi owned Job, không dropdown100-row
sample. Charts có bảng số liệu/labels và top10 explicit. Job statistics route hiện
unsupported, không có sampled implementation để thay; giữ honest unsupported view.

Loading/error/unknown giữ snapshot cuối cùng **kèm scope cũ**; disable export khi
filter/lần tải mới chưa xác nhận, explicit retry. Effect/session guards bỏ late
responses và reset theo account token; không tự hiện old scope như new filter.

Student Dashboard main stats đã đúng: public/saved server totals, complete own
application/CV arrays; recent5 riêng, unread count từ endpoint. Promise.all fail
propagate error thay vì fabricated0. Thêm regression totals900/180/150/2 và source
failure, không sửa Student production behavior khi chưa có lỗi count được chứng minh.

## Verification checkpoint (sẽ cập nhật theo execution evidence)

Independent PostgreSQL expected/actual (mỗi Company, không dùng production query để
tạo oracle):

| Check | Expected | Actual |
|---|---:|---:|
| Owned Jobs / all application histories |130 /362|130 /362|
| Distinct Students |360|360|
| PENDING / REVIEWED / ACCEPTED / WITHDRAWN |72 mỗi trạng thái|72 mỗi trạng thái|
| REJECTED (gồm2 history cũ) |74|74|
| Accepted/all histories |19.89%|19.89%|
| Daily 90-day trend |90 buckets ×4 =360|90 ×4 =360|
| REVIEWED trong30 ngày |24|24|
| First Job + REJECTED histories / Students |2 /1|2 /1|
| Expiring ACTIVE / preview limit |22 /5|22 /5|
| Full CSV (kể cả khi table ởpage2/size100) |362 rows|362 rows|
| Month + owned Job + PENDING / CSV |1 /1|1 /1|
| Empty scope rate / details |null /0|null /0|
| Invalid/foreign/unauth/Student/export-over-cap |400/404/401/403/422|400/404/401/403/422|

Các totals/trend/CSV được đối chiếu bằng SQL độc lập; application history IDs/order
trong CSV bằng SQL ID array, không chỉ khớp metadata rowCount. Formula-like name,
Vietnamese, embedded newline và header10 columns đều PASS. Không thay đổi rows do
GET/export; complete Job/Application before/after digests trong isolated run PASS.

- Backend clean verify: **513 PASS =247 Surefire +266 PostgreSQL Failsafe**, 0
  failure/error/skip; six CompanyAnalyticsApiIT, hai Company ×130 Jobs/362 histories.
- AI locked install/pip check: PASS; **887 pytest PASS**, existing warning1.
- Frontend **211 PASS/32 files**, lint PASS, TypeScript/Vite build PASS; existing
  bundle>500kB warning còn. Covers scoped filters, stale responses, preserved
  offline snapshot/disabled export, authenticated export and Student count/error.
- Isolated analytics Q01–Q06 **6/6 PASS**,19.4s; old notification/settings isolated
  suite **6/6 PASS**,13.6s, unchanged assertions. Default new D01/D02 **2/2 PASS**,
 10.1s. Full default66 checkpoint **66/66 PASS**,422.77s,0 skip/flaky/retry; final
 full rerun sau table accessibility refinement đang chạy, sẽ ghi checkpoint cuối.
- Windows HOST verified (Desktop Windows NT, không `/proc/version`); fallback
  `shutdown /s /f /t 21600` schedule **exit0**. Final shutdown chỉ sau checkpoint
  verification/commit/push hoặc khi không thể tiếp tục; chưa tuyên bố máy đã tắt.

Các failure development giữ log local: no-db profile context yêu cầu disable các
new DB-only analytics beans; wrapper exports sửa compile; wildcard MockMvc dùng
explicit `.param` thay double-encoded URI. Q01 browser loop ban đầu bỏ bước chọn30
sau7; sửa loop chọn đúng range rồi cả6 pass. Không remove/skip assertions.

### N07 blank-page checkpoint

Lượt full sau table refinement có **65/66 PASS**: N07 không tìm thấy Company Settings
heading trong12s, còn65 cases gồm analytics đều pass. Last safe HTTP observations
có200, không pageerror; không đủ bằng chứng chốt root cause. Giữ log/JSON failure
và HTTP observations local. Fresh instrumented diagnostic30 settings +5 inbox
navigations **1/1 PASS**, không console/pageerror/non-aborted request failure;
không tuyên bố lỗi historical session đã fixed.

N07 harness giờ đóng context sau mỗi viewport (10 contexts cho2roles×5widths),
đăng nhập lại thật như route inventory hiện hữu, giữ mọi heading/input/switch/
keyboard/no-overflow assertions và35 screenshots. Không retry navigation bị fail,
không skip/bỏ assertion hoặc tăng timeout. Request-failure logging áp dụng cả các
context mới. Targeted N07 **PASS/35.2s**. Đây là resource-lifetime/isolation của test,
không sửa production Settings/Notifications; long-lived dev-reload failure root
cause vẫn chưa xác minh. Full default regression tiếp theo ghi ở checkpoint cuối.

Table analytics375px ban đầu ép dates thành nhiều dòng khó đọc; đã cho bảng
min-width640, vùng cuộn ngang có tên/Tab focus/ring và hướng dẫn mobile. Q06 giữ
document-no-overflow và thêm kiểm keyboard ArrowRight làm scrollLeft tăng.

## Preservation / boundaries

Read-only API baseline `analytics-baseline.json`:22 aliases (bao gồm20 baseline
package trước),16 PRIMARY Jobs,3 PRIMARY Applications,10 existing CV metadata (4READY).
Strict/content SQL digests chụp riêng trong analytics namespace trước mutation.
Không seed hàng trăm records vào demo; large fixtures chỉ disposable Testcontainers.
Không reset volumes. Không sửa AI/CV V2/V3 corpus/scoring/TF-IDF/Cosine, official
ranks/limits/weights, profile CAS V19, Saved Candidate revision V20, application
lifecycle, moderation hoặc notification/settings contracts.

**B06 tiếp tục UNRESOLVED / NOT REPRODUCED**, trừ khi có reproduction mới được ghi.
Remaining gaps: no audit timestamps for acceptance cohort, legacy timestamp offsets
không recoverable, no frozen export session; large exports>10000 cần narrow filter.
