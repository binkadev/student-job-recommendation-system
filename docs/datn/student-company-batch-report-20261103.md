# Báo cáo đợt Student / Company — 03/11/2026

## Branch, commit và PR

- Branch: `design/datn-ui-ux-refresh-20261102`.
- Baseline thực tế: `ed93c70ffa40d37953ab0ccca7730ee6773f6bf8`.
- Commit Student: `23394d97` — bảo toàn hồ sơ và bằng chứng Recommendation từ Backend.
- Commit Company/Public: `33a9589d` — phạm vi báo cáo, số liệu và chức năng chưa hỗ trợ.
- PR [#66](https://github.com/binkadev/student-job-recommendation-system/pull/66): tiếp tục PR hiện tại, giữ Draft, không merge. Commit tài liệu theo sau hai commit implementation trên.

Đây là một đợt sửa có giới hạn theo ưu tiên P0/P1, không phải hoàn tất toàn bộ master task. [Functional inventory](student-company-functional-audit-20261103.md) có API/service/dữ liệu/rules/lỗi/ưu tiên/cách kiểm chứng; [route inventory](student-company-route-inventory-20261103.md) liệt kê 104 route thực tế: 29 Student, 33 Recruiter, 17 Public/Auth, 25 Admin.

## Student

| Nhóm chức năng | Đã làm / bằng chứng | Trạng thái cuối đợt |
|---|---|---|
| Hồ sơ, học vấn, kinh nghiệm, dự án, kỹ năng | Sửa mất dữ liệu khi lưu lại; dùng văn bản nguyên gốc; đúng trường mục tiêu/địa điểm; validation, pending và lỗi lưu một phần; tests HTTP mock | PARTIAL; live NOT_VERIFIED |
| Mong muốn nghề nghiệp | Xóa được trường text theo semantics Backend; giữ các trường còn lại; có lỗi và chặn gửi lặp | PARTIAL; live NOT_VERIFIED |
| CV upload/active/analysis/download/delete | Đối chiếu API/ownership/MVP restriction; giữ code hiện tại và tests có sẵn | PARTIAL / NOT_VERIFIED; chỉnh dữ liệu trích xuất UNSUPPORTED |
| Recommendation V3 | Bỏ lý do tự dựng và việc dùng tier rank thay global rank; giữ null FALLBACK và bằng chứng từ Backend; regression tests | PARTIAL; live AI NOT_VERIFIED |
| Tìm việc, ứng tuyển, lịch sử, lưu việc | Có API thật trong source; ghi rõ lỗi đồng bộ và thiếu UI rút đơn | PARTIAL / NOT_VERIFIED |
| Notifications, tài khoản, mật khẩu | Có API thật; chỉ đối chiếu source trong đợt này | NOT_VERIFIED live |
| Privacy, phỏng vấn, lời mời, tin nhắn | Hiển thị chưa hỗ trợ; bỏ trạng thái giả và các điều khiển không lưu | UNSUPPORTED; chưa triển khai nghiệp vụ |

## Recruiter / Company

| Nhóm chức năng | Đã làm / bằng chứng | Trạng thái cuối đợt |
|---|---|---|
| Hồ sơ/xác minh công ty | Đối chiếu source/API; ghi GAP logo, tài liệu xác minh và các trường chưa hỗ trợ | PARTIAL; live NOT_VERIFIED |
| Tin tuyển dụng, nháp, trạng thái, đóng tin | Giữ luồng hiện tại; phát hiện giới hạn truy vấn và chênh lệch chính sách duyệt giữa UI/Backend | PARTIAL; P0 còn mở |
| Đơn ứng tuyển, CV, Saved Candidate | Đối chiếu status/ownership/unique company+student; tests workspace hiện tại vẫn PASS | PARTIAL; live NOT_VERIFIED |
| Candidate Ranking V3 | Giữ implementation và toàn bộ tests hiện có; không sửa scoring/corpus/ranking | NOT_VERIFIED live |
| Reports | Lọc tin của công ty trước khi tổng hợp; phân biệt số đơn với số người; hiển thị số bản ghi/phạm vi tối đa 100; refresh/retry; tests | PARTIAL; đây vẫn là báo cáo trên mẫu dữ liệu tải |
| Phỏng vấn/thành viên/tin nhắn | Route phỏng vấn được map đúng; thông báo thiếu capability; bỏ form/roles/CTA giả và link sai vai trò | UNSUPPORTED; chưa triển khai nghiệp vụ |
| Cài đặt | Bỏ Save giả cho pipeline/email, bỏ switch 2FA giả; giữ API mật khẩu/thông báo hiện tại | PARTIAL; các capability nêu trên UNSUPPORTED |

## Public/Auth, business logic và UI/UX

- Trang chủ dùng DTO thống kê thật; số 0 thật khác với lỗi/missing/giá trị không hợp lệ. Không lấy count từ truy vấn khác để thay thế. Lỗi danh sách không hiện như truy vấn rỗng thành công; có retry.
- Quên/đặt lại mật khẩu chưa có Backend: bỏ form và toast thành công giả, mô tả đúng khả năng hiện tại.
- Bỏ nhánh lưu hồ sơ không validation; trạng thái pending khóa các trường và thao tác, giữ draft khi lỗi; focus tới trường không hợp lệ kể cả khi ở tab khác. Thay đổi kỹ năng cũng hiện cảnh báo chưa lưu.
- Chỉnh hồ sơ đúng mô hình text của Backend; không tạo cột DB hoặc giả lập dữ liệu structured. Thông báo Clipboard chỉ thành công sau khi ghi thật.
- Dùng shared components và hướng dẫn UI UX Pro Max về lỗi tại trường, phản hồi và phục hồi lỗi. Không thêm design system, thư viện, 3D, video hoặc animation mới.

**REAL:** chưa có Backend-dependent flow nào được nâng lên REAL trong phiên này vì chưa chạy được live E2E/reload. Có implementation gọi API thật và automated tests cho các sửa đổi nêu trên; đây không phải bằng chứng PostgreSQL/AI runtime.

## Thay đổi và kiểm thử

- Frontend: 26 file implementation/tests, chia hai commit theo nhóm; tài liệu và documentation map đi trong commit riêng.
- Backend/AI/DB/Flyway: không thay đổi. Không sửa role model, public API, V3 weights/threshold/corpus/order hoặc processing pipeline.
- `cd frontend; npm.cmd run lint`: **PASS**.
- `cd frontend; npm.cmd run build`: **PASS**, TypeScript + Vite. Bundle chính 1,324.37 kB / 365.97 kB gzip; cảnh báo chunk >500 kB vẫn còn.
- `cd frontend; npm.cmd run test -- --run`: **PASS — 19 files, 129 tests** (baseline 16 files, 95 tests; thêm 34 tests).
- `git diff --check`: **PASS** sau sửa whitespace.
- Build/test phải chạy ngoài filesystem sandbox vì esbuild bị chặn đọc thư mục cấu hình trong sandbox. Không cài lại dependencies.
- Backend/AI suites: **chưa chạy**, không claim PASS do không sửa các phần đó.
- Browser/visual năm viewport, bàn phím, contrast, console/network, performance đo thực tế: **NOT_VERIFIED**. Không tuyên bố WCAG 2.2 AA đầy đủ.
- Student→Company apply/status/reload, CV→AI→Recommendation và Company Ranking với Backend thật: **NOT_VERIFIED**. Không có browser tool; Docker daemon pipe không tồn tại, localhost 8080/8000 chưa kết nối được. PostgreSQL port chỉ nhận TCP, chưa xác minh dịch vụ.
- Không xóa volumes/reset dữ liệu, không chạy destructive tests trên dữ liệu người dùng.
- Các mục local có sẵn `.agents/`, `skills-lock.json`, `frontend/tsconfig.app.tsbuildinfo` được loại khỏi stage/commit; không commit secrets, environment hoặc build artifacts.

## P0/P1 còn lại và đợt tiếp theo

Ưu tiên tiếp theo: xác lập/enforce chính sách duyệt Job và xác minh Company ở Backend; sửa hook đồng bộ apply/saved không được biến lỗi thành dữ liệu rỗng; API phân trang tin riêng của Company; giao dịch lưu hồ sơ nguyên tử/concurrency; CV activation pending/error; UI rút đơn PENDING với xác nhận và reload. Các công việc này cần tests Backend/contract/PostgreSQL tương ứng khi thay Backend.

Khi có môi trường runtime, chạy ít nhất một Student và một Company flow thật, reload và thử sai quyền trước khi nâng trạng thái REAL. Sau đó mới triển khai nghiệp vụ phỏng vấn/thành viên/invitation/messages với contract, schema, quyền và state machine được xác định rõ. Việc hiện thông báo chưa hỗ trợ không hoàn thành các tính năng đó.

Admin chỉ có inventory/backlog: kiểm tra users/companies/jobs/applications và quyền; analytics có phạm vi rõ; content/CMS/violation reports/audit logs/system settings cần đối chiếu API riêng. Không redesign Admin trong đợt này.
