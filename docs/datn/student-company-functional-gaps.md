# Student/Company — functional gaps và kiểm kê hành động

Snapshot lịch sử tại `caa33f54`. G01 bên dưới đã được xử lý theo [chính sách P0](company-job-moderation-policy.md), có [HTTP/browser evidence mới](company-job-moderation-results.md). Inventory controls và các gap còn lại giữ nội dung baseline; không coi chúng là assertion moderation mới.

G02 profile atomicity/concurrency cũng đã được xử lý tiếp trên baseline `3bd7a88d`: [thiết kế, rollback và two-tab evidence](student-profile-atomic-save-results.md). Các dòng gap bên dưới là snapshot lịch sử, không phải trạng thái current của G01/G02.

Ngày: 2026-11-03. Sinh bởi `node e2e/write-inventory.mjs` từ source inventory + quan sát browser thật. 104 route khai báo; 79 Public/Auth/Student/Company được điều hướng, 25 Admin ngoài phạm vi UI. Chi tiết gap/defect trong [kết quả](real-world-e2e-results.md).

**Không có route nào được đánh PASS chỉ vì render.** Mỗi nút/link hiện có trong main content ở trạng thái dữ liệu khảo sát được liệt kê dưới đây. Các nút trong modal/tab chỉ hiện sau tương tác nằm trong các business test được nêu và source audit trước đó; mọi nhánh chưa mở là NOT_VERIFIED. Đây không phải tuyên bố exhaustive coverage của mọi tổ hợp dữ liệu/trạng thái. Bộ quét không click các action này.

- REAL + VERIFIED / PASS: action được nêu có business assertion API/browser, đúng phạm vi ghi ở evidence.
- REAL IMPLEMENTATION / E2E NOT VERIFIED: source có API, action cụ thể chưa kiểm chứng.
- PARTIAL: nhóm chức năng có phần thật và còn gap.
- UNSUPPORTED: thiếu API/schema hoặc chủ đích trả 501; UI thông báo không phải hoàn thành tính năng.
- UI_ONLY: static/alias/navigation. BLOCKED: thiếu quyết định nghiệp vụ/chưa tạo lỗi môi trường kiểm thử an toàn.

Precondition chung: đúng role, resource thuộc tài khoản E2E, Backend/AI/PostgreSQL thật; Public/Auth dùng guest. Expected chung: API quyết định dữ liệu, reload phải giữ persistence, lỗi không được báo thành công. Recommendation chung: test action NOT_VERIFIED trước khi nâng trạng thái; không triển khai policy mới khi chưa quyết định. R01 chứng minh điều hướng/không pageerror, không thay thế điều kiện này.

## Gap ưu tiên

| ID | Mức | Gap/actual | Đề xuất/checkpoint |
|---|---|---|---|
| G01 | P0 | Register tự VERIFIED; status setter thiếu approval/state machine dù UI nói phải Admin | Cần quyết định chính sách, không âm thầm sửa domain; fixture được Admin duyệt qua API |
| G02 | P0 | Profile ba API chưa atomic/version check | Thiết kế aggregate/concurrency được review; test đồng thời chưa thực hiện |
| G03 | P0/P1 | /jobs mixed scope, frontend giới hạn 100 trước khi lọc own | Own-company query contract/pagination; chưa tạo >100 jobs |
| G04 | P1 | Withdrawal có API, chưa có action UI; reapply UI theo từng màn hình chưa audit hết | Thêm confirm/status mutation với regression theo V18 sau |
| G05 | P1 | Interviews/invitations/messages/members/privacy/pipeline/email/2FA thiếu nghiệp vụ | Cần API/schema/rules; không fake persistence |
| G06 | P1 | Company verification upload, logo/cover; candidate global search/campaign còn thiếu | Tách alias/UI placeholder khỏi khả năng thật |
| G07 | P2 | CV review và public profile/certificates/links không có full contract; job preview/statistics unavailable | Liệt kê UI-only; không dùng score trang trí làm AI evidence |
| G08 | P1/P2 | AI timeout/outage, session expiry/transfer, browser password/notification mutations chưa đủ E2E | Dùng isolated stack và record phụ ở lượt tiếp theo |
| G09 | P2 | Bảng ranking desktop cần cuộn ngang nội bộ; nhiều kết quả mobile rất dài; nested main | Audit keyboard/landmarks/target size/contrast; không claim WCAG compliance |

## Từng route và control đã quan sát

### F001 — public — `/`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Chỉ public eligible data; không PII/CV; A01/B01/B08. API source: `GET /public/jobs[/id], /public/companies[/id], /public/statistics; Student save/apply nếu đăng nhập` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/public-01.png`; read requests: `/api/public/statistics (200)`, `/api/public/companies (200)`, `/api/public/jobs (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F001-A01 | Tìm việc | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F001-A02 | Tải CV | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F001-A03 | Xem tất cả | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F001-A04 | TEBackend Java English Intern [datn-e2e-v1]Đang tuyểnSao Mai Technology E2E | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F001-A05 | Lưu việc làm | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F001-A06 | Xem chi tiết | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F001-A07 | TEMobile Developer Intern [datn-e2e-v1]Đang tuyểnSao Mai Technology E2E | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F001-A08 | TEDevOps Intern [datn-e2e-v1]Đang tuyểnSao Mai Technology E2E | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F001-A09 | TEQA Tester Intern [datn-e2e-v1]Đang tuyểnSao Mai Technology E2E | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F001-A10 | TEData Analyst Intern [datn-e2e-v1]Đang tuyểnSao Mai Technology E2E | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F001-A11 | TEPython Backend Intern [datn-e2e-v1]Đang tuyểnSao Mai Technology E2E | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F001-A12 | UEHải Đăng UI E2EChưa cập nhậtChưa cập nhậtChưa cập nhật0 tin đang tuyểnĐã xác thực | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F001-A13 | SEBắc Đẩu Software E2ESoftware DevelopmentChưa cập nhậtThành phố Hồ Chí Minh — văn phòng giả định E2E0 tin đang tuyểnĐã xác thực | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F001-A14 | TESao Mai Technology E2ESoftware DevelopmentChưa cập nhậtThành phố Hồ Chí Minh — văn phòng giả định E2E11 tin đang tuyểnĐã xác thực | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F001-A15 | TCDemo Tech CompanySoftware DevelopmentChưa cập nhậtHo Chi Minh City10 tin đang tuyểnĐã xác thực | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: keyword (input); location (select). Số lượng/định danh DOM là quan sát, không thay validation test.

### F002 — public — `/jobs`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Chỉ public eligible data; không PII/CV; A01/B01/B08. API source: `GET /public/jobs[/id], /public/companies[/id], /public/statistics; Student save/apply nếu đăng nhập` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/jobs`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/public-02.png`; read requests: `/api/public/jobs (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F002-A01 | Tìm kiếm | REAL + VERIFIED — PASS trong phạm vi evidence; expected theo rule/API ở trên | B01 |
| F002-A02 | Xóa toàn bộ filter | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F002-A03 | Lọc | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F002-A04 | Tải lại | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F002-A05 | TEBackend Java English Intern [datn-e2e-v1]Sao Mai Technology E2E | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F002-A06 | Lưu việc làm | REAL + VERIFIED — PASS trong phạm vi evidence; expected theo rule/API ở trên | A05/B08 |
| F002-A07 | Xem chi tiết | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F002-A08 | Ứng tuyển | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F002-A09 | TEMobile Developer Intern [datn-e2e-v1]Sao Mai Technology E2E | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F002-A10 | TEDevOps Intern [datn-e2e-v1]Sao Mai Technology E2E | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F002-A11 | TEQA Tester Intern [datn-e2e-v1]Sao Mai Technology E2E | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F002-A12 | TEData Analyst Intern [datn-e2e-v1]Sao Mai Technology E2E | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F002-A13 | TEPython Backend Intern [datn-e2e-v1]Sao Mai Technology E2E | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F002-A14 | Trước | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F002-A15 | Sau | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: keyword (input); location (select); :r5: (input); :r7: (select); :r9: (select). Số lượng/định danh DOM là quan sát, không thay validation test.

### F003 — public — `/jobs/:jobId`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Chỉ public eligible data; không PII/CV; A01/B01/B08. API source: `GET /public/jobs[/id], /public/companies[/id], /public/statistics; Student save/apply nếu đăng nhập` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/jobs/11`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/public-03.png`; read requests: `/api/public/jobs/11 (200)`, `/api/public/companies/2 (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F003-A01 | Ứng tuyển | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F003-A02 | Lưu việc | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F003-A03 | Chia sẻ | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F003-A04 | Xem công ty | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F004 — public — `/companies`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Chỉ public eligible data; không PII/CV; A01/B01/B08. API source: `GET /public/jobs[/id], /public/companies[/id], /public/statistics; Student save/apply nếu đăng nhập` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/companies`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/public-04.png`; read requests: `/api/public/companies (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F004-A01 | Tìm kiếm | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F004-A02 | Xem Hải Đăng UI E2E | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F004-A03 | UE | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F004-A04 | Hải Đăng UI E2E | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F004-A05 | 0 việc đang tuyển | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F004-A06 | Xem công ty | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F004-A07 | Xem Bắc Đẩu Software E2E | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F004-A08 | SE | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F004-A09 | Bắc Đẩu Software E2E | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F004-A10 | Xem Sao Mai Technology E2E | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F004-A11 | TE | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F004-A12 | Sao Mai Technology E2E | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F004-A13 | 11 việc đang tuyển | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F004-A14 | Xem Demo Tech Company | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F004-A15 | TC | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F004-A16 | Demo Tech Company | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F004-A17 | 10 việc đang tuyển | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F004-A18 | Trước | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F004-A19 | Sau | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: keyword (input); location (input); industry (input); sort (select). Số lượng/định danh DOM là quan sát, không thay validation test.

### F005 — public — `/companies/:companyId`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Chỉ public eligible data; không PII/CV; A01/B01/B08. API source: `GET /public/jobs[/id], /public/companies[/id], /public/statistics; Student save/apply nếu đăng nhập` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/companies/2`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/public-05.png`; read requests: `/api/public/companies/2 (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F005-A01 | Copy website | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F005-A02 | Copy địa chỉ | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F005-A03 | Giới thiệu | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F005-A04 | Việc làm đang tuyển | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F005-A05 | Phúc lợi | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F005-A06 | Hình ảnh | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F005-A07 | Mở việc làm | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F005-A08 | Mở website | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F006 — public — `/career-resources`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không coi đây là campaign CRUD hoặc CMS. API source: `Campaign là alias job list; career là nội dung static` (prefix `/api`). Nhóm: **UI_ONLY**. Priority: **P2**. Actual: R01 tới `/career-resources`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/public-06.png`; read requests: không quan sát API response trong cửa sổ route này.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F006-A01 | 6 phútCVCách viết CV IT nổi bật cho sinh viên mới ra trườngTập trung vào kỹ năng, dự án cá nhân, môn học liên quan và cách trình bày CV rõ ràng để nhà tuyển dụng dễ đánh giá. | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F006-A02 | 8 phútPhỏng vấnChuẩn bị phỏng vấn Frontend Developer trong 7 ngàyÔn lại HTML, CSS, JavaScript, React, cách gọi API và chuẩn bị demo dự án để trả lời tự tin hơn. | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F006-A03 | 10 phútĐịnh hướngLộ trình học Backend Java Spring BootMột lộ trình thực tế để sinh viên IT đi từ Java core đến REST API, database, bảo mật và triển khai ứng dụng. | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F007 — public — `/career-resources/:slug`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không coi đây là campaign CRUD hoặc CMS. API source: `Campaign là alias job list; career là nội dung static` (prefix `/api`). Nhóm: **UI_ONLY**. Priority: **P2**. Actual: R01 tới `/career-resources/cv-tips`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/public-07.png`; read requests: không quan sát API response trong cửa sổ route này.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F007-READ | Đọc trạng thái/nội dung | UI_ONLY; R01 navigation only | Chưa chứng minh mutation |

### F008 — public — `/about`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Nội dung hiện có không chứng minh CMS/contact submission. API source: `Không có mutation API cho nội dung static/navigation` (prefix `/api`). Nhóm: **UI_ONLY**. Priority: **P2**. Actual: R01 tới `/about`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/public-08.png`; read requests: `/api/public/statistics (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F008-READ | Đọc trạng thái/nội dung | UI_ONLY; R01 navigation only | Chưa chứng minh mutation |

### F009 — public — `/contact`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Nội dung hiện có không chứng minh CMS/contact submission. API source: `Không có mutation API cho nội dung static/navigation` (prefix `/api`). Nhóm: **UI_ONLY**. Priority: **P2**. Actual: R01 tới `/contact`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/public-09.png`; read requests: không quan sát API response trong cửa sổ route này.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F009-READ | Đọc trạng thái/nội dung | UI_ONLY; R01 navigation only | Chưa chứng minh mutation |

### F010 — public — `/privacy-policy`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Nội dung hiện có không chứng minh CMS/contact submission. API source: `Không có mutation API cho nội dung static/navigation` (prefix `/api`). Nhóm: **UI_ONLY**. Priority: **P2**. Actual: R01 tới `/privacy-policy`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/public-10.png`; read requests: không quan sát API response trong cửa sổ route này.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F010-READ | Đọc trạng thái/nội dung | UI_ONLY; R01 navigation only | Chưa chứng minh mutation |

### F011 — public — `/terms`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Nội dung hiện có không chứng minh CMS/contact submission. API source: `Không có mutation API cho nội dung static/navigation` (prefix `/api`). Nhóm: **UI_ONLY**. Priority: **P2**. Actual: R01 tới `/terms`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/public-11.png`; read requests: không quan sát API response trong cửa sổ route này.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F011-READ | Đọc trạng thái/nội dung | UI_ONLY; R01 navigation only | Chưa chứng minh mutation |

### F012 — auth — `/login`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: STUDENT/COMPANY register; role redirect; credentials chỉ local; B02/B10. API source: `POST /auth/register, /auth/login; GET /auth/me` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/login`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/auth-12.png`; read requests: không quan sát API response trong cửa sổ route này.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F012-A01 | Hiện mật khẩu | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F012-A02 | Đăng nhập | REAL + VERIFIED — PASS trong phạm vi evidence; expected theo rule/API ở trên | B02 |
| F012-A03 | Đăng ký ngay | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: email (email); password (password). Số lượng/định danh DOM là quan sát, không thay validation test.

### F013 — auth — `/register`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: STUDENT/COMPANY register; role redirect; credentials chỉ local; B02/B10. API source: `POST /auth/register, /auth/login; GET /auth/me` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/register`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/auth-13.png`; read requests: không quan sát API response trong cửa sổ route này.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F013-A01 | Tôi là ứng viênTạo hồ sơ, tải CV, lưu việc làm và ứng tuyển các vị trí IT đang tuyển.Đăng ký ứng viên | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F013-A02 | Tôi là doanh nghiệpTạo tài khoản công ty, đăng tin tuyển dụng và theo dõi hồ sơ ứng viên.Đăng ký doanh nghiệp | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F013-A03 | Đăng nhập | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F014 — auth — `/register/candidate`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: STUDENT/COMPANY register; role redirect; credentials chỉ local; B02/B10. API source: `POST /auth/register, /auth/login; GET /auth/me` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/register/candidate`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/auth-14.png`; read requests: không quan sát API response trong cửa sổ route này.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F014-A01 | Đăng ký | REAL + VERIFIED — PASS trong phạm vi evidence; expected theo rule/API ở trên | B10 |
| F014-A02 | Quay lại | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: email (email); fullName (input); phone (input); password (password); confirmPassword (password). Số lượng/định danh DOM là quan sát, không thay validation test.

### F015 — auth — `/register/recruiter`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: STUDENT/COMPANY register; role redirect; credentials chỉ local; B02/B10. API source: `POST /auth/register, /auth/login; GET /auth/me` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/register/recruiter`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/auth-15.png`; read requests: không quan sát API response trong cửa sổ route này.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F015-A01 | Đăng ký | REAL + VERIFIED — PASS trong phạm vi evidence; expected theo rule/API ở trên | B10 |
| F015-A02 | Quay lại | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: email (email); companyName (input); contactName (input); phone (input); taxCode (input, disabled); password (password); companyIntro (textarea, disabled); confirmPassword (password). Số lượng/định danh DOM là quan sát, không thay validation test.

### F016 — auth — `/forgot-password`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không thu thập hay báo lưu thành công; cần thiết kế API/rules trước. API source: `Không có business API/schema khả dụng; extracted-data trả 501` (prefix `/api`). Nhóm: **UNSUPPORTED**. Priority: **P1**. Actual: R01 tới `/forgot-password`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/auth-16.png`; read requests: không quan sát API response trong cửa sổ route này.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F016-A01 | Quay lại đăng nhập | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F017 — auth — `/reset-password`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không thu thập hay báo lưu thành công; cần thiết kế API/rules trước. API source: `Không có business API/schema khả dụng; extracted-data trả 501` (prefix `/api`). Nhóm: **UNSUPPORTED**. Priority: **P1**. Actual: R01 tới `/reset-password`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/auth-17.png`; read requests: `/api/auth/login (200)`, `/api/students/me (200)`, `/api/students/me/profile (200)`, `/api/students/me/saved-jobs (200)`, `/api/public/jobs (200)`, `/api/students/me/applications (200)`, `/api/students/me/cv (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F017-A01 | Quay lại đăng nhập | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F018 — candidate — `/candidate/dashboard`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Bounded sample, company scope, không suy ra global analytics; API totals chưa audit toàn diện. API source: `Các GET list profile/jobs/applications/recommendation/notifications hiện hữu` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/candidate/dashboard`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-18.png`; read requests: `/api/notifications (200)`, `/api/students/me/cv/active (200)`, `/api/students/me/profile (200)`, `/api/notifications/unread-count (200)`, `/api/auth/me (200)`, `/api/students/me (200)`, `/api/public/jobs (200)`, `/api/students/me/saved-jobs (200)`, `/api/students/me/cv (200)`, `/api/students/me/applications (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F018-A01 | Hoàn thiện hồ sơ | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F018-A02 | Tải CV | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F018-A03 | Việc đang tuyển20 việc | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F018-A04 | Việc đã lưu1 việc | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F018-A05 | Đơn ứng tuyển3 đơn | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F018-A06 | Tổng CV2 CV | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F018-A07 | Xem gợi ý việc làm | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F018-A08 | Xem tất cả | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F018-A09 | Backend Java English Intern [datn-e2e-v1] | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F018-A10 | Lưu việc làm | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F018-A11 | Xem chi tiết | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F018-A12 | Mobile Developer Intern [datn-e2e-v1] | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F018-A13 | DevOps Intern [datn-e2e-v1] | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F018-A14 | QA Tester Intern [datn-e2e-v1] | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F018-A15 | Backend Java Intern [datn-e2e-v1]Sao Mai Technology E2E • Ứng tuyển: 18:16 03/11/2026Đã xemXem chi tiết | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F018-A16 | Java Spring Boot Fresher [datn-e2e-v1]Sao Mai Technology E2E • Ứng tuyển: 18:13 03/11/2026Đang chờXem chi tiết | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F018-A17 | Backend Java English Intern [datn-e2e-v1]Sao Mai Technology E2E • Ứng tuyển: 18:13 03/11/2026Đã xemXem chi tiết | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F018-A18 | Xem | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F018-A19 | Tải CV mới | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F018-A20 | Application status updatedYour application for Backend Java Intern [datn-e2e-v1] has been updated to REVIEWED.18:16 03/11/2026 | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F018-A21 | Application status updatedYour application for Backend Java English Intern [datn-e2e-v1] has been updated to REVIEWED.18:13 03/11/2026 | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F019 — candidate — `/candidate/jobs`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: ACTIVE/deadline, own CV, active uniqueness, latest REJECTED only; A05/A06/A08/A09/B06. API source: `GET /jobs[/id]; GET/POST/DELETE /students/me/saved-jobs; POST /jobs/{id}/apply; GET/POST/PUT/DELETE /students/me/saved-searches` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/candidate/jobs`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-19.png`; read requests: `/api/auth/me (200)`, `/api/students/me/saved-jobs (200)`, `/api/jobs (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F019-A01 | Backend Intern — Hạn nộp đã qua [datn-e2e-v1] | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F019-A02 | Lưu việc làm | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F019-A03 | Xem chi tiết | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F019-A04 | Backend Java English Intern [datn-e2e-v1] | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F019-A05 | Mobile Developer Intern [datn-e2e-v1] | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F019-A06 | DevOps Intern [datn-e2e-v1] | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F019-A07 | QA Tester Intern [datn-e2e-v1] | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F019-A08 | Data Analyst Intern [datn-e2e-v1] | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F019-A09 | Trước | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F019-A10 | Sau | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (input); :r5: (select); :r7: (select); :r9: (select). Số lượng/định danh DOM là quan sát, không thay validation test.

### F020 — candidate — `/candidate/jobs/:jobId`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: ACTIVE/deadline, own CV, active uniqueness, latest REJECTED only; A05/A06/A08/A09/B06. API source: `GET /jobs[/id]; GET/POST/DELETE /students/me/saved-jobs; POST /jobs/{id}/apply; GET/POST/PUT/DELETE /students/me/saved-searches` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/candidate/jobs/11`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-20.png`; read requests: `/api/auth/me (200)`, `/api/jobs/11 (200)`, `/api/students/me/saved-jobs (200)`, `/api/students/me/applications (200)`, `/api/jobs (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F020-A01 | Đã ứng tuyển | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F020-A02 | Bỏ lưu việc làm | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F021 — candidate — `/candidate/jobs/recommended`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: V3 READY snapshot, PRIMARY trước FALLBACK, Backend rank, 0.65/0.35; A04/B05. API source: `POST /students/me/recommendations/generate; GET /students/me/recommendation-runs[/id]` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/candidate/jobs/recommended`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-21.png`; read requests: `/api/auth/me (200)`, `/api/students/me/saved-jobs (200)`, `/api/students/me/cv (200)`, `/api/students/me/applications (200)`, `/api/students/me/recommendation-runs (200)`, `/api/students/me/recommendation-results/latest (200)`, `/api/students/me/cv/2/analysis (200)`, `/api/students/me/cv/1/analysis (200)`, `/api/public/jobs/11 (200)`, `/api/public/jobs/17 (200)`, `/api/public/jobs/12 (200)`, `/api/public/jobs/14 (200)`, `/api/public/jobs/16 (200)`, `/api/public/jobs/1 (200)`, `/api/public/jobs/8 (200)`, `/api/public/jobs/7 (200)`, `/api/public/jobs/6 (200)`, `/api/public/jobs/18 (200)`, `/api/public/jobs/19 (200)`, `/api/public/jobs/20 (200)`, `/api/public/jobs/4 (200)`, `/api/public/jobs/15 (200)`, `/api/public/jobs/2 (200)`, `/api/public/jobs/5 (200)`, `/api/public/jobs/13 (200)`, `/api/public/jobs/9 (200)`, `/api/public/jobs/3 (200)`, `/api/public/jobs/10 (200)`, `/api/public/companies/1 (200)`, `/api/public/companies/2 (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F021-A01 | Quản lý CV | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A02 | Cập nhật gợi ý | REAL + VERIFIED — PASS trong phạm vi evidence; expected theo rule/API ở trên | B05 |
| F021-A03 | Tải lại | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A04 | Xem việc đã ẩn (0) | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A05 | Backend Java Intern [datn-e2e-v1] | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A06 | Xem phân tích | REAL + VERIFIED — PASS trong phạm vi evidence; expected theo rule/API ở trên | B05 |
| F021-A07 | Bỏ lưu | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A08 | Đã ứng tuyển | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A09 | Xem chi tiết | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A10 | Ẩn | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A11 | Java Spring Boot Fresher [datn-e2e-v1] | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A12 | Lưu | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A13 | QA Tester Intern [datn-e2e-v1] | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A14 | Ứng tuyển | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A15 | Fullstack Java React [datn-e2e-v1] | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A16 | Data Analyst Intern [datn-e2e-v1] | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A17 | Backend Developer Intern | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A18 | Tester Intern | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A19 | DevOps Intern | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A20 | Mobile Developer Intern | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A21 | DevOps Intern [datn-e2e-v1] | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A22 | Mobile Developer Intern [datn-e2e-v1] | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A23 | Backend Java English Intern [datn-e2e-v1] | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A24 | Fullstack Developer Intern | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A25 | Java Spring Boot Intern | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A26 | Python Backend Intern [datn-e2e-v1] | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A27 | Data Analyst Intern | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A28 | Database Intern | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A29 | React Frontend Intern [datn-e2e-v1] | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A30 | Frontend Developer Intern | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F021-A31 | Web Developer Intern | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (select); :r5: (number); :r7: (number); :rp: (select); :r9: (select); :rb: (select); :rd: (select); :rf: (select); :rh: (select). Số lượng/định danh DOM là quan sát, không thay validation test.

### F022 — candidate — `/candidate/jobs/saved`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: ACTIVE/deadline, own CV, active uniqueness, latest REJECTED only; A05/A06/A08/A09/B06. API source: `GET /jobs[/id]; GET/POST/DELETE /students/me/saved-jobs; POST /jobs/{id}/apply; GET/POST/PUT/DELETE /students/me/saved-searches` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/candidate/jobs/saved`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-22.png`; read requests: `/api/auth/me (200)`, `/api/students/me/saved-jobs (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F022-A01 | Backend Java Intern [datn-e2e-v1] | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F022-A02 | Bỏ lưu | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F022-A03 | Xem chi tiết | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F022-A04 | Trước | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F022-A05 | Sau | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F023 — candidate — `/candidate/profile`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own Student; multiline; empty string clear; ba write chưa atomic; A02/B03. API source: `GET/PUT /students/me, /students/me/profile, /students/me/skills; GET /skills` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/candidate/profile`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-23.png`; read requests: `/api/auth/me (200)`, `/api/students/me (200)`, `/api/students/me/profile (200)`, `/api/students/me/skills (200)`, `/api/auth/login (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F023-A01 | Copy email | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F023-A02 | Copy số điện thoại | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F023-A03 | Chỉnh sửa | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F023-A04 | Xem hồ sơ công khai | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F023-A05 | Thêm thông tin | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F023-A06 | Cập nhật hồ sơ | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F023-A07 | Mong muốn nghề nghiệp | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F024 — candidate — `/candidate/profile/edit`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own Student; multiline; empty string clear; ba write chưa atomic; A02/B03. API source: `GET/PUT /students/me, /students/me/profile, /students/me/skills; GET /skills` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/candidate/profile/edit`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-24.png`; read requests: `/api/students/me (200)`, `/api/students/me/profile (200)`, `/api/students/me/saved-jobs (200)`, `/api/students/me/applications (200)`, `/api/public/jobs (200)`, `/api/students/me/cv (200)`, `/api/auth/me (200)`, `/api/students/me/skills (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F024-A01 | Lưu hồ sơ | REAL + VERIFIED — PASS trong phạm vi evidence; expected theo rule/API ở trên | B03 |
| F024-A02 | Hủy thay đổi | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F024-A03 | Xem hồ sơ | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F024-A04 | Thông tin cá nhân | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F024-A05 | Giới thiệu | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F024-A06 | Kinh nghiệm | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F024-A07 | Học vấn | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F024-A08 | Kỹ năng | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F024-A09 | Dự án | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: name (input); :r5: (input); phone (tel); location (input); currentTitle (input); availability (select). Số lượng/định danh DOM là quan sát, không thay validation test.

### F025 — candidate — `/candidate/profile/preferences`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own Student; multiline; empty string clear; ba write chưa atomic; A02/B03. API source: `GET/PUT /students/me, /students/me/profile, /students/me/skills; GET /skills` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/candidate/profile/preferences`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-25.png`; read requests: `/api/auth/me (200)`, `/api/students/me/skills (200)`, `/api/students/me (200)`, `/api/students/me/profile (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F025-A01 | Lưu thiết lập | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: targetPosition (input); preferredLocation (input); preferredJobType (select); :r9: (textarea, disabled); :rb: (textarea, disabled); :rd: (textarea, disabled); :rf: (textarea, disabled). Số lượng/định danh DOM là quan sát, không thay validation test.

### F026 — candidate — `/candidate/cvs`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own CV, một active, protected delete, READY không giả; A03/A11/A12/B04/B13. API source: `GET/POST /students/me/cv; PATCH /{id}/active; GET /{id}/file/analysis; POST /{id}/reanalyze; DELETE /{id}` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/candidate/cvs`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-26.png`; read requests: `/api/auth/me (200)`, `/api/students/me/cv (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F026-A01 | Tải CV mới | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F026-A02 | Xóa CV | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F026-A03 | Xem | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F026-A04 | Mở file | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F026-A05 | Phân tích lại | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F026-A06 | Đặt làm CV đang dùng | REAL + VERIFIED — PASS trong phạm vi evidence; expected theo rule/API ở trên | A03/B13 (offline failure) |

### F027 — candidate — `/candidate/cvs/upload`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own CV, một active, protected delete, READY không giả; A03/A11/A12/B04/B13. API source: `GET/POST /students/me/cv; PATCH /{id}/active; GET /{id}/file/analysis; POST /{id}/reanalyze; DELETE /{id}` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/candidate/cvs/upload`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-27.png`; read requests: `/api/auth/me (200)`, `/api/students/me/cv (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F027-A01 | Tải lên | REAL + VERIFIED — PASS trong phạm vi evidence; expected theo rule/API ở trên | B04 (secondary CV) |
| F027-A02 | Hủy | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: không có name (file). Số lượng/định danh DOM là quan sát, không thay validation test.

### F028 — candidate — `/candidate/cvs/:cvId`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own CV, một active, protected delete, READY không giả; A03/A11/A12/B04/B13. API source: `GET/POST /students/me/cv; PATCH /{id}/active; GET /{id}/file/analysis; POST /{id}/reanalyze; DELETE /{id}` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/candidate/cvs/1`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-28.png`; read requests: `/api/auth/me (200)`, `/api/students/me/cv (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F028-A01 | Quay lại danh sách | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F028-A02 | Tải CV mới | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F028-A03 | Mở file CV | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F029 — candidate — `/candidate/cvs/:cvId/analysis`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own CV, một active, protected delete, READY không giả; A03/A11/A12/B04/B13. API source: `GET/POST /students/me/cv; PATCH /{id}/active; GET /{id}/file/analysis; POST /{id}/reanalyze; DELETE /{id}` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/candidate/cvs/1/analysis`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-29.png`; read requests: `/api/auth/me (200)`, `/api/students/me/cv (200)`, `/api/students/me/cv/1/analysis (200)`, `/api/students/me/cv/1 (200)`, `/api/auth/login (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F029-A01 | Phân tích lại | REAL + VERIFIED — PASS trong phạm vi evidence; expected theo rule/API ở trên | B04 (secondary CV) |
| F029-A02 | Chi tiết CV | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F029-A03 | Quay lại danh sách | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F030 — candidate — `/candidate/cvs/:cvId/edit-extracted-data`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không thu thập hay báo lưu thành công; cần thiết kế API/rules trước. API source: `Không có business API/schema khả dụng; extracted-data trả 501` (prefix `/api`). Nhóm: **UNSUPPORTED**. Priority: **P1**. Actual: R01 tới `/candidate/cvs/1/edit-extracted-data`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-30.png`; read requests: `/api/students/me (200)`, `/api/students/me/profile (200)`, `/api/students/me/cv (200)`, `/api/public/jobs (200)`, `/api/students/me/saved-jobs (200)`, `/api/students/me/applications (200)`, `/api/auth/me (200)`, `/api/students/me/cv/1 (200)`, `/api/students/me/cv/1/analysis (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F030-A01 | Xem phân tích CV | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F030-A02 | Quay lại danh sách CV | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F031 — candidate — `/candidate/cvs/:cvId/review`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own CV, một active, protected delete, READY không giả; A03/A11/A12/B04/B13. API source: `GET/POST /students/me/cv; PATCH /{id}/active; GET /{id}/file/analysis; POST /{id}/reanalyze; DELETE /{id}` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/candidate/cvs/1/review`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-31.png`; read requests: `/api/auth/me (200)`, `/api/students/me/cv (200)`, `/api/students/me/cv/1 (200)`, `/api/students/me/cv/1/analysis (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F031-A01 | Phân tích lại | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F031-A02 | Chi tiết CV | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F031-A03 | Quay lại danh sách | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F032 — candidate — `/candidate/applications`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own Student; PENDING→WITHDRAWN API có nhưng chưa UI; latest WITHDRAWN chặn reapply; A06/A09/B06. API source: `GET /students/me/applications[/id]; PATCH /applications/{id}/status` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/candidate/applications`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-32.png`; read requests: `/api/auth/me (200)`, `/api/students/me/applications (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F032-A01 | Xem chi tiết | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F032-A02 | Xem trạng thái | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F032-A03 | Xem việc làm | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F032-A04 | Trước | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F032-A05 | Sau | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (input); :r5: (select); :r7: (date); :r9: (date). Số lượng/định danh DOM là quan sát, không thay validation test.

### F033 — candidate — `/candidate/applications/:applicationId`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own Student; PENDING→WITHDRAWN API có nhưng chưa UI; latest WITHDRAWN chặn reapply; A06/A09/B06. API source: `GET /students/me/applications[/id]; PATCH /applications/{id}/status` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/candidate/applications/24`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-33.png`; read requests: `/api/auth/me (200)`, `/api/students/me/applications/24 (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F033-A01 | Xem việc làm | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F033-A02 | Xem CV | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F034 — candidate — `/candidate/applications/:applicationId/status`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own Student; PENDING→WITHDRAWN API có nhưng chưa UI; latest WITHDRAWN chặn reapply; A06/A09/B06. API source: `GET /students/me/applications[/id]; PATCH /applications/{id}/status` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/candidate/applications/24/status`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-34.png`; read requests: `/api/auth/me (200)`, `/api/students/me/applications/24 (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F034-A01 | Xem việc làm | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F034-A02 | Xem CV | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F035 — candidate — `/candidate/interviews`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không thu thập hay báo lưu thành công; cần thiết kế API/rules trước. API source: `Không có business API/schema khả dụng; extracted-data trả 501` (prefix `/api`). Nhóm: **UNSUPPORTED**. Priority: **P1**. Actual: R01 tới `/candidate/interviews`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-35.png`; read requests: `/api/auth/me (200)`, `/api/auth/login (200)`, `/api/students/me (200)`, `/api/students/me/profile (200)`, `/api/public/jobs (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F035-A01 | Xem đơn ứng tuyển | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F036 — candidate — `/candidate/interviews/:interviewId`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không thu thập hay báo lưu thành công; cần thiết kế API/rules trước. API source: `Không có business API/schema khả dụng; extracted-data trả 501` (prefix `/api`). Nhóm: **UNSUPPORTED**. Priority: **P1**. Actual: R01 tới `/candidate/interviews/1`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-36.png`; read requests: `/api/students/me/cv (200)`, `/api/students/me/applications (200)`, `/api/students/me/saved-jobs (200)`, `/api/notifications (200)`, `/api/students/me/cv/active (200)`, `/api/notifications/unread-count (200)`, `/api/auth/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F036-A01 | Xem đơn ứng tuyển | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F037 — candidate — `/candidate/invitations`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không thu thập hay báo lưu thành công; cần thiết kế API/rules trước. API source: `Không có business API/schema khả dụng; extracted-data trả 501` (prefix `/api`). Nhóm: **UNSUPPORTED**. Priority: **P1**. Actual: R01 tới `/candidate/invitations`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-37.png`; read requests: `/api/auth/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F037-A01 | Tìm việc | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F038 — candidate — `/candidate/invitations/:invitationId`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không thu thập hay báo lưu thành công; cần thiết kế API/rules trước. API source: `Không có business API/schema khả dụng; extracted-data trả 501` (prefix `/api`). Nhóm: **UNSUPPORTED**. Priority: **P1**. Actual: R01 tới `/candidate/invitations/1`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-38.png`; read requests: `/api/auth/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F038-A01 | Tìm việc | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F039 — candidate — `/candidate/messages`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không thu thập hay báo lưu thành công; cần thiết kế API/rules trước. API source: `Không có business API/schema khả dụng; extracted-data trả 501` (prefix `/api`). Nhóm: **UNSUPPORTED**. Priority: **P1**. Actual: R01 tới `/candidate/messages`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-39.png`; read requests: `/api/auth/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F039-A01 | Xem đơn ứng tuyển | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F040 — candidate — `/candidate/messages/:conversationId`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không thu thập hay báo lưu thành công; cần thiết kế API/rules trước. API source: `Không có business API/schema khả dụng; extracted-data trả 501` (prefix `/api`). Nhóm: **UNSUPPORTED**. Priority: **P1**. Actual: R01 tới `/candidate/messages/1`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-40.png`; read requests: `/api/auth/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F040-A01 | Xem đơn ứng tuyển | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F041 — candidate — `/candidate/notifications`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own recipient/settings; A06/A11; browser mark-read/save chưa kiểm chứng. API source: `GET /notifications, /notifications/unread-count; PATCH /notifications/{id}/read, /notifications/read-all; GET/PUT /users/me/notification-settings` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/candidate/notifications`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-41.png`; read requests: `/api/auth/me (200)`, `/api/notifications (200)`, `/api/notifications/unread-count (200)`, `/api/auth/login (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F041-A01 | Tất cả | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F041-A02 | Chưa đọc (2) | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F041-A03 | Đánh dấu tất cả đã đọc | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F041-A04 | Trạng thái ứng tuyển đã cập nhậtTrạng thái ứng tuyểnChưa đọcĐơn ứng tuyển cho Backend Java Intern [datn-e2e-v1] đã được cập nhật sang trạng thái Đã xem xét.18:16 03/11/2026 | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F041-A05 | Mở | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F041-A06 | Đánh dấu đã đọc | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F041-A07 | Trạng thái ứng tuyển đã cập nhậtTrạng thái ứng tuyểnChưa đọcĐơn ứng tuyển cho Backend Java English Intern [datn-e2e-v1] đã được cập nhật sang trạng thái Đã xem xét.18:13 03/11/2026 | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F041-A08 | Trước | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F041-A09 | Sau | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (select). Số lượng/định danh DOM là quan sát, không thay validation test.

### F042 — candidate — `/candidate/settings`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own user; privacy/2FA không khả dụng; password runtime chưa kiểm chứng. API source: `GET/PUT /students/me hoặc /companies/me; PATCH /users/me/password; GET/PUT /users/me/notification-settings` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/candidate/settings`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-42.png`; read requests: `/api/students/me (200)`, `/api/students/me/profile (200)`, `/api/public/jobs (200)`, `/api/students/me/saved-jobs (200)`, `/api/students/me/cv (200)`, `/api/students/me/applications (200)`, `/api/notifications (200)`, `/api/students/me/cv/active (200)`, `/api/auth/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F042-A01 | Tài khoản | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F042-A02 | Bảo mật | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F042-A03 | Quyền riêng tư | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F042-A04 | Thông báo | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F042-A05 | Tải ảnh đại diện | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F042-A06 | Cập nhật thông tin | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (input); :r5: (input, disabled); :r7: (input). Số lượng/định danh DOM là quan sát, không thay validation test.

### F043 — candidate — `/candidate/settings/account`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own user; privacy/2FA không khả dụng; password runtime chưa kiểm chứng. API source: `GET/PUT /students/me hoặc /companies/me; PATCH /users/me/password; GET/PUT /users/me/notification-settings` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/candidate/settings/account`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-43.png`; read requests: `/api/auth/me (200)`, `/api/students/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F043-A01 | Tài khoản | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F043-A02 | Bảo mật | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F043-A03 | Quyền riêng tư | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F043-A04 | Thông báo | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F043-A05 | Tải ảnh đại diện | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F043-A06 | Cập nhật thông tin | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (input); :r5: (input, disabled); :r7: (input). Số lượng/định danh DOM là quan sát, không thay validation test.

### F044 — candidate — `/candidate/settings/security`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own user; privacy/2FA không khả dụng; password runtime chưa kiểm chứng. API source: `GET/PUT /students/me hoặc /companies/me; PATCH /users/me/password; GET/PUT /users/me/notification-settings` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/candidate/settings/security`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-44.png`; read requests: `/api/auth/me (200)`, `/api/students/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F044-A01 | Tài khoản | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F044-A02 | Bảo mật | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F044-A03 | Quyền riêng tư | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F044-A04 | Thông báo | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F044-A05 | Đăng xuất phiên hiện tại | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F044-A06 | Đổi mật khẩu | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (password); :r5: (password); :r7: (password). Số lượng/định danh DOM là quan sát, không thay validation test.

### F045 — candidate — `/candidate/settings/privacy`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không thu thập hay báo lưu thành công; cần thiết kế API/rules trước. API source: `Không có business API/schema khả dụng; extracted-data trả 501` (prefix `/api`). Nhóm: **UNSUPPORTED**. Priority: **P1**. Actual: R01 tới `/candidate/settings/privacy`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-45.png`; read requests: `/api/auth/me (200)`, `/api/students/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F045-A01 | Tài khoản | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F045-A02 | Bảo mật | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F045-A03 | Quyền riêng tư | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F045-A04 | Thông báo | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F045-A05 | Xem đơn ứng tuyển | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F046 — candidate — `/candidate/settings/notifications`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own recipient/settings; A06/A11; browser mark-read/save chưa kiểm chứng. API source: `GET /notifications, /notifications/unread-count; PATCH /notifications/{id}/read, /notifications/read-all; GET/PUT /users/me/notification-settings` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/candidate/settings/notifications`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/candidate-46.png`; read requests: `/api/auth/me (200)`, `/api/students/me (200)`, `/api/users/me/notification-settings (200)`, `/api/auth/login (200)`, `/api/companies/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F046-A01 | Tài khoản | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F046-A02 | Bảo mật | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F046-A03 | Quyền riêng tư | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F046-A04 | Thông báo | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F046-A05 | Lưu cài đặt thông báo | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F047 — recruiter — `/recruiter/dashboard`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Bounded sample, company scope, không suy ra global analytics; API totals chưa audit toàn diện. API source: `Các GET list profile/jobs/applications/recommendation/notifications hiện hữu` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/recruiter/dashboard`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-47.png`; read requests: `/api/jobs (200)`, `/api/companies/me/applications (200)`, `/api/companies/me (200)`, `/api/auth/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F047-A01 | Tạo tin tuyển dụng | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F047-A02 | Xem hồ sơ ứng tuyển | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F047-A03 | Tin đang tuyển11 | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F047-A04 | Ứng viên mới4 | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F047-A05 | Đã xem xét2 | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F047-A06 | Đã nhận0 | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F047-A07 | Tổng ứng tuyển36 | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F047-A08 | 4 ứng viên chờ xử lý | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F047-A09 | 0 tin sắp hết hạn | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F047-A10 | 2 tin đã đóng/hết hạn/bị từ chối | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F047-A11 | Xem tất cả | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F047-A12 | Xem | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (select). Số lượng/định danh DOM là quan sát, không thay validation test.

### F048 — recruiter — `/recruiter/company`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own Company; verification submit/logo không hỗ trợ; registration tự VERIFIED là policy gap; B11. API source: `GET/PUT /companies/me; GET /jobs` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/recruiter/company`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-48.png`; read requests: `/api/auth/me (200)`, `/api/companies/me (200)`, `/api/jobs (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F048-A01 | Copy website | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F048-A02 | Copy địa chỉ | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F048-A03 | Chỉnh sửa | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F048-A04 | Xác thực doanh nghiệp | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F048-A05 | Xem trang công khai | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F048-A06 | Chi tiết | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F048-A07 | Tạo tin mới | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F048-A08 | Xem | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F048-A09 | Trước | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F048-A10 | Sau | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F049 — recruiter — `/recruiter/company/edit`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own Company; verification submit/logo không hỗ trợ; registration tự VERIFIED là policy gap; B11. API source: `GET/PUT /companies/me; GET /jobs` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/recruiter/company/edit`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-49.png`; read requests: `/api/auth/me (200)`, `/api/companies/me (200)`, `/api/jobs (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F049-A01 | Lưu hồ sơ | REAL + VERIFIED — PASS trong phạm vi evidence; expected theo rule/API ở trên | B11 |
| F049-A02 | Quay lại | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F049-A03 | Tải ảnh | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (input); :r5: (input); :r7: (input); :r9: (input); :rb: (input, disabled); :rd: (input); :rf: (textarea); :rh: (textarea). Số lượng/định danh DOM là quan sát, không thay validation test.

### F050 — recruiter — `/recruiter/company/verification`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own Company; verification submit/logo không hỗ trợ; registration tự VERIFIED là policy gap; B11. API source: `GET/PUT /companies/me; GET /jobs` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/recruiter/company/verification`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-50.png`; read requests: `/api/auth/me (200)`, `/api/companies/me (200)`, `/api/jobs (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F050-A01 | Gửi hồ sơ xác thực | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F050-A02 | Quay lại hồ sơ | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F051 — recruiter — `/recruiter/jobs`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Manage own Job; list mixed ACTIVE+own, UI lọc bounded sample; preview/statistics chưa triển khai; B12. API source: `GET/POST /jobs; GET/PUT /jobs/{id}; PATCH /jobs/{id}/status; DELETE /jobs/{id}` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/recruiter/jobs`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-51.png`; read requests: `/api/auth/me (200)`, `/api/companies/me (200)`, `/api/jobs (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F051-A01 | Tải lại | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F051-A02 | Tạo tin | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F051-A03 | Xem | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F051-A04 | Sửa | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F051-A05 | Gửi duyệt | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F051-A06 | Ứng viên phù hợp | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F051-A07 | Đóng | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F051-A08 | Trước | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F051-A09 | Sau | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (input); :r5: (select); :r7: (select); :r9: (select). Số lượng/định danh DOM là quan sát, không thay validation test.

### F052 — recruiter — `/recruiter/jobs/create`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Manage own Job; list mixed ACTIVE+own, UI lọc bounded sample; preview/statistics chưa triển khai; B12. API source: `GET/POST /jobs; GET/PUT /jobs/{id}; PATCH /jobs/{id}/status; DELETE /jobs/{id}` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/recruiter/jobs/create`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-52.png`; read requests: `/api/auth/me (200)`, `/api/companies/me (200)`, `/api/skills (200)`, `/api/auth/login (200)`, `/api/companies/me/applications (200)`, `/api/jobs (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F052-A01 | Tạo tin | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F052-A02 | Lưu nháp | REAL + VERIFIED — PASS trong phạm vi evidence; expected theo rule/API ở trên | B12 |
| F052-A03 | Quay lại | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (input); :r5: (select); :r7: (select); :r9: (select); :rb: (input); :rd: (input); :rf: (input, disabled); :rh: (date); :rj: (textarea); :rl: (textarea); :rn: (textarea); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox). Số lượng/định danh DOM là quan sát, không thay validation test.

### F053 — recruiter — `/recruiter/jobs/:jobId`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Manage own Job; list mixed ACTIVE+own, UI lọc bounded sample; preview/statistics chưa triển khai; B12. API source: `GET/POST /jobs; GET/PUT /jobs/{id}; PATCH /jobs/{id}/status; DELETE /jobs/{id}` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/recruiter/jobs/11`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-53.png`; read requests: `/api/jobs (200)`, `/api/auth/me (200)`, `/api/companies/me (200)`, `/api/jobs/11 (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F053-A01 | Ứng viên phù hợp | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F053-A02 | Sửa tin | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F053-A03 | Quay lại danh sách | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F054 — recruiter — `/recruiter/jobs/:jobId/edit`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Manage own Job; list mixed ACTIVE+own, UI lọc bounded sample; preview/statistics chưa triển khai; B12. API source: `GET/POST /jobs; GET/PUT /jobs/{id}; PATCH /jobs/{id}/status; DELETE /jobs/{id}` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/recruiter/jobs/11/edit`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-54.png`; read requests: `/api/auth/me (200)`, `/api/companies/me (200)`, `/api/jobs/11 (200)`, `/api/skills (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F054-A01 | Gửi duyệt | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F054-A02 | Lưu nháp | REAL + VERIFIED — PASS trong phạm vi evidence; expected theo rule/API ở trên | B12 |
| F054-A03 | Quay lại | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (input); :r5: (select); :r7: (select); :r9: (select); :rb: (input); :rd: (input); :rf: (input, disabled); :rh: (date); :rj: (textarea); :rl: (textarea); :rn: (textarea); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox); không có name (checkbox). Số lượng/định danh DOM là quan sát, không thay validation test.

### F055 — recruiter — `/recruiter/jobs/:jobId/preview`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Hiện trang giải thích và link về chi tiết; không coi metadata là thống kê. API source: `GET /jobs/{id} chỉ tải metadata; không preview/statistics operation` (prefix `/api`). Nhóm: **UNSUPPORTED**. Priority: **P1**. Actual: R01 tới `/recruiter/jobs/11/preview`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-55.png`; read requests: `/api/auth/me (200)`, `/api/companies/me (200)`, `/api/jobs/11 (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F055-A01 | Xem chi tiết tin | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F055-A02 | Quay lại danh sách | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F056 — recruiter — `/recruiter/jobs/:jobId/statistics`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Hiện trang giải thích và link về chi tiết; không coi metadata là thống kê. API source: `GET /jobs/{id} chỉ tải metadata; không preview/statistics operation` (prefix `/api`). Nhóm: **UNSUPPORTED**. Priority: **P1**. Actual: R01 tới `/recruiter/jobs/11/statistics`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-56.png`; read requests: `/api/auth/me (200)`, `/api/companies/me (200)`, `/api/jobs/11 (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F056-A01 | Xem chi tiết tin | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F056-A02 | Quay lại danh sách | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F057 — recruiter — `/recruiter/jobs/:jobId/candidate-ranking`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own Job, eligible submitted CV, independent tier limits/ranks; A10/B07. API source: `POST/GET /companies/me/jobs/{jobId}/candidate-ranking-runs[/runId]` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/recruiter/jobs/11/candidate-ranking`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-57.png`; read requests: `/api/auth/me (200)`, `/api/jobs/11 (200)`, `/api/companies/me/jobs/11/candidate-ranking-runs (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F057-A01 | Quay lại việc làm | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F057-A02 | Xem lịch sử | REAL + VERIFIED — PASS trong phạm vi evidence; expected theo rule/API ở trên | B07 |
| F057-A03 | Tải lại | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F057-A04 | Chạy xếp hạng | REAL + VERIFIED — PASS trong phạm vi evidence; expected theo rule/API ở trên | B07 |

Form controls: :r3: (number); :r5: (number); :r7: (number). Số lượng/định danh DOM là quan sát, không thay validation test.

### F058 — recruiter — `/recruiter/campaigns`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không coi đây là campaign CRUD hoặc CMS. API source: `Campaign là alias job list; career là nội dung static` (prefix `/api`). Nhóm: **UI_ONLY**. Priority: **P2**. Actual: R01 tới `/recruiter/campaigns`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-58.png`; read requests: `/api/auth/me (200)`, `/api/companies/me (200)`, `/api/jobs (200)`, `/api/auth/login (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F058-A01 | Tải lại | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F058-A02 | Tạo tin | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F058-A03 | Xem | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F058-A04 | Sửa | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F058-A05 | Gửi duyệt | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F058-A06 | Ứng viên phù hợp | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F058-A07 | Đóng | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F058-A08 | Trước | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F058-A09 | Sau | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (input); :r5: (select); :r7: (select); :r9: (select). Số lượng/định danh DOM là quan sát, không thay validation test.

### F059 — recruiter — `/recruiter/campaigns/:campaignId`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không coi đây là campaign CRUD hoặc CMS. API source: `Campaign là alias job list; career là nội dung static` (prefix `/api`). Nhóm: **UI_ONLY**. Priority: **P2**. Actual: R01 tới `/recruiter/campaigns/1`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-59.png`; read requests: `/api/companies/me (200)`, `/api/companies/me/applications (200)`, `/api/jobs (200)`, `/api/auth/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F059-A01 | Tải lại | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F059-A02 | Tạo tin | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F059-A03 | Xem | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F059-A04 | Sửa | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F059-A05 | Gửi duyệt | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F059-A06 | Ứng viên phù hợp | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F059-A07 | Đóng | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F059-A08 | Trước | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F059-A09 | Sau | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (input); :r5: (select); :r7: (select); :r9: (select). Số lượng/định danh DOM là quan sát, không thay validation test.

### F060 — recruiter — `/recruiter/candidates`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own Job/application; candidateId thực ra applicationId; không global candidate search; A06/A07/B06. API source: `GET /companies/me/applications[/id]; PATCH /applications/{id}/status; GET /companies/me/applications/{id}/cv/file; POST /companies/me/saved-candidates` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/recruiter/candidates`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-60.png`; read requests: `/api/auth/me (200)`, `/api/companies/me/applications (200)`, `/api/companies/me/saved-candidates (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F060-A01 | Tải lại danh sách | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F060-A02 | Chi tiết | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F060-A03 | Lưu hồ sơ | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F060-A04 | Trạng thái | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F060-A05 | Trước | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F060-A06 | Sau | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (input); :r5: (select); :r7: (select); :r9: (select). Số lượng/định danh DOM là quan sát, không thay validation test.

### F061 — recruiter — `/recruiter/candidates/:candidateId`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own Job/application; candidateId thực ra applicationId; không global candidate search; A06/A07/B06. API source: `GET /companies/me/applications[/id]; PATCH /applications/{id}/status; GET /companies/me/applications/{id}/cv/file; POST /companies/me/saved-candidates` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/recruiter/candidates/24`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-61.png`; read requests: `/api/auth/me (200)`, `/api/companies/me/applications/24 (200)`, `/api/companies/me/saved-candidates (200)`, `/api/companies/me/applications (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F061-A01 | Quay lại danh sách | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F061-A02 | Đã lưu ứng viên | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F061-A03 | Liên hệ | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F061-A04 | Xem CV | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F061-A05 | Cập nhật trạng thái | REAL + VERIFIED — PASS trong phạm vi evidence; expected theo rule/API ở trên | B06 |

Form controls: :r3: (select). Số lượng/định danh DOM là quan sát, không thay validation test.

### F062 — recruiter — `/recruiter/candidates/:candidateId/evaluation`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own Job/application; candidateId thực ra applicationId; không global candidate search; A06/A07/B06. API source: `GET /companies/me/applications[/id]; PATCH /applications/{id}/status; GET /companies/me/applications/{id}/cv/file; POST /companies/me/saved-candidates` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/recruiter/candidates/24/evaluation`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-62.png`; read requests: `/api/auth/me (200)`, `/api/companies/me/applications/24 (200)`, `/api/companies/me/applications (200)`, `/api/companies/me/saved-candidates (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F062-A01 | Quay lại danh sách | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F062-A02 | Đã lưu ứng viên | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F062-A03 | Liên hệ | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F062-A04 | Xem CV | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F062-A05 | Cập nhật trạng thái | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (select). Số lượng/định danh DOM là quan sát, không thay validation test.

### F063 — recruiter — `/recruiter/recommended-candidates`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Nội dung hiện có không chứng minh CMS/contact submission. API source: `Không có mutation API cho nội dung static/navigation` (prefix `/api`). Nhóm: **UI_ONLY**. Priority: **P2**. Actual: R01 tới `/recruiter/jobs`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-63.png`; read requests: `/api/auth/me (200)`, `/api/companies/me (200)`, `/api/jobs (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F063-A01 | Tải lại | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F063-A02 | Tạo tin | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F063-A03 | Xem | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F063-A04 | Sửa | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F063-A05 | Gửi duyệt | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F063-A06 | Ứng viên phù hợp | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F063-A07 | Đóng | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F063-A08 | Trước | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F063-A09 | Sau | UI_ONLY — business NOT_VERIFIED; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (input); :r5: (select); :r7: (select); :r9: (select). Số lượng/định danh DOM là quan sát, không thay validation test.

### F064 — recruiter — `/recruiter/saved-candidates`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Unique company+student; source application không thay unique key; A10. API source: `GET/POST /companies/me/saved-candidates; DELETE /companies/me/saved-candidates/{id}` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/recruiter/saved-candidates`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-64.png`; read requests: `/api/auth/me (200)`, `/api/companies/me/applications (200)`, `/api/companies/me/saved-candidates (200)`, `/api/auth/login (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F064-A01 | Chi tiết | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F064-A02 | Bỏ lưu | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F064-A03 | Trước | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F064-A04 | Sau | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F065 — recruiter — `/recruiter/candidate-search`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own Job/application; candidateId thực ra applicationId; không global candidate search; A06/A07/B06. API source: `GET /companies/me/applications[/id]; PATCH /applications/{id}/status; GET /companies/me/applications/{id}/cv/file; POST /companies/me/saved-candidates` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P0**. Actual: R01 tới `/recruiter/candidate-search`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-65.png`; read requests: `/api/companies/me (200)`, `/api/companies/me/applications (200)`, `/api/jobs (200)`, `/api/auth/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F065-A01 | Quay lại ứng viên ứng tuyển | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F066 — recruiter — `/recruiter/interviews`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không thu thập hay báo lưu thành công; cần thiết kế API/rules trước. API source: `Không có business API/schema khả dụng; extracted-data trả 501` (prefix `/api`). Nhóm: **UNSUPPORTED**. Priority: **P1**. Actual: R01 tới `/recruiter/interviews`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-66.png`; read requests: `/api/auth/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F066-A01 | Xem đơn ứng tuyển | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F067 — recruiter — `/recruiter/interviews/create`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không thu thập hay báo lưu thành công; cần thiết kế API/rules trước. API source: `Không có business API/schema khả dụng; extracted-data trả 501` (prefix `/api`). Nhóm: **UNSUPPORTED**. Priority: **P1**. Actual: R01 tới `/recruiter/interviews/create`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-67.png`; read requests: `/api/auth/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F067-A01 | Xem đơn ứng tuyển | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F068 — recruiter — `/recruiter/interviews/:interviewId`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không thu thập hay báo lưu thành công; cần thiết kế API/rules trước. API source: `Không có business API/schema khả dụng; extracted-data trả 501` (prefix `/api`). Nhóm: **UNSUPPORTED**. Priority: **P1**. Actual: R01 tới `/recruiter/interviews/1`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-68.png`; read requests: `/api/auth/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F068-A01 | Xem đơn ứng tuyển | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F069 — recruiter — `/recruiter/messages`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không thu thập hay báo lưu thành công; cần thiết kế API/rules trước. API source: `Không có business API/schema khả dụng; extracted-data trả 501` (prefix `/api`). Nhóm: **UNSUPPORTED**. Priority: **P1**. Actual: R01 tới `/recruiter/messages`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-69.png`; read requests: `/api/auth/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F069-A01 | Xem đơn ứng tuyển | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F070 — recruiter — `/recruiter/messages/:conversationId`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không thu thập hay báo lưu thành công; cần thiết kế API/rules trước. API source: `Không có business API/schema khả dụng; extracted-data trả 501` (prefix `/api`). Nhóm: **UNSUPPORTED**. Priority: **P1**. Actual: R01 tới `/recruiter/messages/1`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-70.png`; read requests: `/api/auth/me (200)`, `/api/auth/login (200)`, `/api/companies/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F070-A01 | Xem đơn ứng tuyển | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F071 — recruiter — `/recruiter/reports`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Bounded sample, company scope, không suy ra global analytics; API totals chưa audit toàn diện. API source: `Các GET list profile/jobs/applications/recommendation/notifications hiện hữu` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/recruiter/reports`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-71.png`; read requests: `/api/jobs (200)`, `/api/companies/me/applications (200)`, `/api/companies/me (200)`, `/api/auth/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F071-A01 | Tải lại báo cáo | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F071-A02 | Tìm kiếm | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F071-A03 | Export CSV | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (input); :r5: (select); :r7: (select); :r9: (month); :rb: (month). Số lượng/định danh DOM là quan sát, không thay validation test.

### F072 — recruiter — `/recruiter/members`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không thu thập hay báo lưu thành công; cần thiết kế API/rules trước. API source: `Không có business API/schema khả dụng; extracted-data trả 501` (prefix `/api`). Nhóm: **UNSUPPORTED**. Priority: **P1**. Actual: R01 tới `/recruiter/members`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-72.png`; read requests: `/api/auth/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F072-A01 | Xem hồ sơ công ty | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F073 — recruiter — `/recruiter/members/invite`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không thu thập hay báo lưu thành công; cần thiết kế API/rules trước. API source: `Không có business API/schema khả dụng; extracted-data trả 501` (prefix `/api`). Nhóm: **UNSUPPORTED**. Priority: **P1**. Actual: R01 tới `/recruiter/members/invite`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-73.png`; read requests: `/api/auth/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F073-A01 | Xem hồ sơ công ty | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F074 — recruiter — `/recruiter/settings`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own user; privacy/2FA không khả dụng; password runtime chưa kiểm chứng. API source: `GET/PUT /students/me hoặc /companies/me; PATCH /users/me/password; GET/PUT /users/me/notification-settings` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/recruiter/settings`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-74.png`; read requests: `/api/auth/me (200)`, `/api/companies/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F074-A01 | Tài khoản | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F074-A02 | Quy trình tuyển dụng | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F074-A03 | Mẫu email | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F074-A04 | Thông báo | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F074-A05 | Bảo mật | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F074-A06 | Lưu tài khoản | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (input); :r5: (input, disabled); :r7: (input); :r9: (input); :rb: (input); :rd: (input); :rf: (textarea); :rh: (textarea). Số lượng/định danh DOM là quan sát, không thay validation test.

### F075 — recruiter — `/recruiter/settings/account`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own user; privacy/2FA không khả dụng; password runtime chưa kiểm chứng. API source: `GET/PUT /students/me hoặc /companies/me; PATCH /users/me/password; GET/PUT /users/me/notification-settings` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/recruiter/settings/account`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-75.png`; read requests: `/api/auth/me (200)`, `/api/companies/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F075-A01 | Tài khoản | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F075-A02 | Quy trình tuyển dụng | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F075-A03 | Mẫu email | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F075-A04 | Thông báo | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F075-A05 | Bảo mật | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F075-A06 | Lưu tài khoản | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (input); :r5: (input, disabled); :r7: (input); :r9: (input); :rb: (input); :rd: (input); :rf: (textarea); :rh: (textarea). Số lượng/định danh DOM là quan sát, không thay validation test.

### F076 — recruiter — `/recruiter/settings/recruitment-process`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không thu thập hay báo lưu thành công; cần thiết kế API/rules trước. API source: `Không có business API/schema khả dụng; extracted-data trả 501` (prefix `/api`). Nhóm: **UNSUPPORTED**. Priority: **P1**. Actual: R01 tới `/recruiter/settings/recruitment-process`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-76.png`; read requests: `/api/auth/me (200)`, `/api/companies/me (200)`, `/api/auth/login (200)`, `/api/companies/me/applications (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F076-A01 | Tài khoản | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F076-A02 | Quy trình tuyển dụng | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F076-A03 | Mẫu email | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F076-A04 | Thông báo | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F076-A05 | Bảo mật | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F076-A06 | Xem đơn ứng tuyển | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F077 — recruiter — `/recruiter/settings/email-templates`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Không thu thập hay báo lưu thành công; cần thiết kế API/rules trước. API source: `Không có business API/schema khả dụng; extracted-data trả 501` (prefix `/api`). Nhóm: **UNSUPPORTED**. Priority: **P1**. Actual: R01 tới `/recruiter/settings/email-templates`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-77.png`; read requests: `/api/jobs (200)`, `/api/companies/me (200)`, `/api/companies/me/applications (200)`, `/api/auth/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F077-A01 | Tài khoản | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F077-A02 | Quy trình tuyển dụng | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F077-A03 | Mẫu email | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F077-A04 | Thông báo | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F077-A05 | Bảo mật | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F077-A06 | Xem đơn ứng tuyển | UNSUPPORTED — thiếu nghiệp vụ; không PASS; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

### F078 — recruiter — `/recruiter/settings/notifications`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own recipient/settings; A06/A11; browser mark-read/save chưa kiểm chứng. API source: `GET /notifications, /notifications/unread-count; PATCH /notifications/{id}/read, /notifications/read-all; GET/PUT /users/me/notification-settings` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/recruiter/settings/notifications`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-78.png`; read requests: `/api/auth/me (200)`, `/api/users/me/notification-settings (200)`, `/api/notifications (200)`, `/api/companies/me (200)`, `/api/notifications/unread-count (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F078-A01 | Tài khoản | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F078-A02 | Quy trình tuyển dụng | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F078-A03 | Mẫu email | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F078-A04 | Thông báo | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F078-A05 | Bảo mật | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F078-A06 | Lưu cấu hình | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F078-A07 | Tất cả | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F078-A08 | Chưa đọc (0) | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F078-A09 | Đánh dấu tất cả đã đọc | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F078-A10 | Trước | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F078-A11 | Sau | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (select). Số lượng/định danh DOM là quan sát, không thay validation test.

### F079 — recruiter — `/recruiter/settings/security`

User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: Own user; privacy/2FA không khả dụng; password runtime chưa kiểm chứng. API source: `GET/PUT /students/me hoặc /companies/me; PATCH /users/me/password; GET/PUT /users/me/notification-settings` (prefix `/api`). Nhóm: **PARTIAL**. Priority: **P1**. Actual: R01 tới `/recruiter/settings/security`; business result từng control bên dưới. Evidence local: `e2e/.local/routes/recruiter-79.png`; read requests: `/api/auth/me (200)`, `/api/companies/me (200)`.

| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |
|---|---|---|---|
| F079-A01 | Tài khoản | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F079-A02 | Quy trình tuyển dụng | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F079-A03 | Mẫu email | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F079-A04 | Thông báo | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F079-A05 | Bảo mật | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |
| F079-A06 | Đổi mật khẩu | REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này; expected theo rule/API ở trên | R01 chỉ thấy control; cần action assertion + reload |

Form controls: :r3: (password); :r5: (password). Số lượng/định danh DOM là quan sát, không thay validation test.
