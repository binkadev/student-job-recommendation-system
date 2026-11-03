# Real-world E2E (local only)

Chạy từ PowerShell tại `e2e/`; Backend/AI/PostgreSQL và Vite phải đang chạy đúng source branch. Node 24/Python 3.11 đã dùng để kiểm chứng. Playwright Test **1.56.1** là dependency dev được khóa riêng trong `package-lock.json`; không thêm dependency production. Chromium tương ứng được tải bằng Playwright.

```powershell
npm.cmd ci
.\node_modules\.bin\playwright.cmd install chromium
$env:E2E_USE_DEV_SEED_ADMIN='1'
npm.cmd run setup
npm.cmd test
```

`E2E_USE_DEV_SEED_ADMIN=1` chỉ dành cho môi trường dev local có sẵn tài khoản Admin do `DataSeeder` tạo: script đọc định danh từ source, login hợp lệ và chỉ duyệt record E2E qua API. Không đăng ký Admin, không SQL write, không bypass verification. Setup chỉ xác thực Company vừa tạo cho fixture cần publish; không tự verify/unblock/reset Company cũ. Thiếu Admin hợp lệ khi cần tạo dữ liệu công khai sẽ dừng với lỗi rõ ràng. Không bật flag với một môi trường khác.

Chạy riêng:

```powershell
npm.cmd run test:api
npm.cmd run test:browser
.\node_modules\.bin\playwright.cmd test routes.spec.mjs
.\node_modules\.bin\playwright.cmd test moderation.spec.mjs
```

Mọi endpoint mặc định là localhost. Đổi port bằng `E2E_BACKEND_URL`/`E2E_FRONTEND_URL`, vẫn bắt buộc loopback. Không mock HTTP trong các test này; offline dùng Chromium offline mode. Một worker, không chạy hai setup/test process cùng lúc. `setup` idempotent theo email, tên CV, company/title; giữ manual profile edits sau lần populate đầu. Manifest là snapshot của lượt setup; dùng API/DB read-back khi cần trạng thái mới nhất. Các run/history và reapplication REJECTED là record lịch sử mới hợp lệ mỗi lần chạy, không phải duplicate active applications. Không tự cleanup tài khoản chính.

Credentials nằm ở **`e2e/.local/credentials.json`** trên máy này. Mở file bằng editor local để xem các alias `student` và `company` (hai tài khoản chính), hoặc `studentUi`/`companyUi` (đăng ký từ browser). Không paste file vào issue/chat/report. Mật khẩu ngẫu nhiên đủ mạnh; không đổi lại account hiện hữu nếu login thất bại. Mất file credentials có thể khiến setup báo email collision: dừng và phục hồi file, không xóa DB để chạy tiếp. Không có email nào được gửi ra ngoài.

Generated CV, manifest, logs, JSON results, screenshots và trace nằm trong `.local/`, `test-results/`; tất cả bị gitignore. Các report artifact chỉ dùng local và có thể chứa dữ liệu tổng hợp. Trace/video cho phiên đăng nhập tắt vì Playwright lưu password/Authorization; chỉ B01 ghi `public-trace.zip` trước login. Không bật trace auth rồi chia sẻ. Mở trace public:

```powershell
.\node_modules\.bin\playwright.cmd show-trace .local/public-trace.zip
```

`routes.spec.mjs` kiểm kê controls và điều hướng của 79 route, **không** kiểm chứng mọi hành động. Business assertions ở `api.spec.mjs` và `browser.spec.mjs`. Báo cáo có thể commit ở `docs/datn/`; không commit credential hay raw artifact. Khi một test có thể tái sử dụng record, nó xác minh record hiện hữu thay vì tạo trùng; B06 thực hiện submit/status transition khi application chưa tồn tại/PENDING. Muốn kiểm tra chuỗi mới hoàn toàn, dùng database dev E2E riêng qua cấu hình hợp lệ, không reset volume hiện tại.

Route scanner đóng browser context sau mỗi sáu route và login lại bằng form thật. Việc giữ một context qua hàng chục Vite full reload đã gây `ERR_INSUFFICIENT_RESOURCES` khi mỗi reload tải hàng trăm source modules; không bỏ route, không retry và không giảm assertions để xử lý lỗi này. Có thể đối chiếu production preview bằng `E2E_FRONTEND_URL`, vẫn dùng Backend thật.

Sau một lượt hoàn chỉnh, tạo lại tài liệu đã lược bỏ secrets:

```powershell
node summarize-state.mjs
node write-manifest.mjs
node write-inventory.mjs
```

Inventory generator từ chối xuất full matrix nếu chưa có đủ 79 route observations. `security.spec.mjs` bổ sung raw CV/run ownership và đổi mật khẩu tài khoản phụ rồi phục hồi. Không chia sẻ file JSON report gốc mà chưa rà soát dù trace auth đã tắt.

`moderation.spec.mjs` dùng alias riêng `moderationCompany` (thêm vào credentials local, giữ nguyên chín alias cũ) và bốn Job có namespace `[p0-e2e]`. New register phải PENDING; chỉ Admin API được verify/block/approve/reject. Tests kiểm cả UI close→draft→edit→submit→withdraw, Student/public visibility và ba lượt cạnh tranh approve/reject. Kết thúc Company riêng PENDING, không có Job riêng ACTIVE. Không đổi trạng thái các Job PRIMARY để kiểm moderation. Fixture có thể tái sử dụng; report ghi rõ nếu registration được reuse.

Đối chiếu dữ liệu bằng API snapshot trước/sau (chỉ đọc):

```powershell
node summarize-state.mjs
Copy-Item .local/final-state.json .local/p0-moderation-baseline.json
# Chạy setup/tests hoặc rebuild Backend, giữ volumes.
node summarize-state.mjs
node verify-preservation.mjs
```

Comparator xác nhận mọi alias baseline giữ user/resource ID/status, CV metadata baseline, các trường Job PRIMARY đã snapshot (id/title/status/deadline/skills) và application PRIMARY ban đầu. Không tuyên bố snapshot này so sánh toàn bộ bytes/file/database. Không ghi đè baseline trong lúc chạy.
