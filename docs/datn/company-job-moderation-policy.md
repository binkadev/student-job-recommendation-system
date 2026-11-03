# Company verification và Job moderation

Baseline: `caa33f54`, branch `design/datn-ui-ux-refresh-20261102`, PR #66 Draft. Chính sách dưới đây thực thi yêu cầu P0 ngày 2026-11-03, thay cho setter status không giới hạn. Master `e019f7a4` vẫn là ancestor. Không đổi scoring/corpus V3 hoặc dữ liệu cũ hàng loạt.

## Đối chiếu trước implementation

- Flyway V2 đã mặc định Company PENDING; AuthServiceImpl ghi đè VERIFIED lúc register. Yêu cầu mới bỏ override này, không cần migration/backfill.
- Public Job list/detail và V3 corpus đã yêu cầu Job ACTIVE + Company VERIFIED + deadline hợp lệ. Giữ nguyên các query này. Generic `/api/jobs` và Apply còn thiếu company-status gate, sẽ được đồng bộ để không lộ/nhận đơn vào tin của Company chưa đủ điều kiện.
- CreateJobRequest nhận status; JobServiceImpl cho mọi enum, applyStatus không kiểm role/edge. API contract hiện chỉ mô tả DTO và ownership, không có state machine ngược với yêu cầu mới. Các fixture test tạo ACTIVE trực tiếp trong PostgreSQL Testcontainers là dữ liệu chuẩn bị cho regression, không phải chứng nhận API cho phép self-approve.
- Frontend đã nói cần Admin duyệt và kiểm VERIFIED khi gửi duyệt, nhưng vẫn cho sửa ACTIVE và chưa có action rút/đưa về nháp. Cần phản ánh rõ trước mutation, không tự đổi status khi sửa.

## Company

Đăng ký COMPANY tạo PENDING; account User vẫn ACTIVE để login, hoàn thiện hồ sơ và lưu nháp. Company status và User login status là hai domain khác nhau. Chỉ Admin API hiện hữu được đổi Company status.

Admin được chuyển giữa PENDING, VERIFIED, BLOCKED (và gọi lại cùng status idempotent 200). Bao gồm VERIFIED→PENDING để thu hồi xác thực và BLOCKED→VERIFIED để khôi phục theo quyết định Admin. Không có Company self-verification hay self-unblock.

Không cascade status Job khi block/unverify. Public/corpus filter hiện hữu lập tức ẩn ACTIVE jobs của Company không VERIFIED; Admin xác minh lại sẽ khôi phục khả năng hiển thị các Job vẫn ACTIVE và chưa quá hạn. Đây là khôi phục tường minh do Admin, không phải Job được Company tự duyệt lại. Content sửa đổi luôn phải qua DRAFT/review. Company vẫn xem tài nguyên riêng và có thể đưa tin về nháp/đóng; không được gửi duyệt khi chưa VERIFIED. Existing applications/CVs/history không bị xóa hoặc đổi trạng thái.

## Job — role, edge và HTTP

Company phải sở hữu Job; Admin quản trị tất cả; Student không được mutation Job/Company. Sai role/ownership trả `403 ACCESS_DENIED`. Edge không hợp lệ trả `400 BAD_REQUEST`. Company gọi ACTIVE/REJECTED/EXPIRED luôn 403, kể cả cùng status. Payload sai/unknown field PUT Job trả 400. Successful Job mutations giữ HTTP 200 và ApiResponse.

| Role | Trước | Action / sau | Điều kiện | Expected HTTP |
|---|---|---|---|---|
| COMPANY / ADMIN | Chưa có Job | Create DRAFT (default) | Company hiện hữu; Company actor luôn dùng owner hiện tại | 200 |
| COMPANY / ADMIN | Chưa có Job | Create PENDING_APPROVAL | Owner Company VERIFIED | 200, nếu chưa VERIFIED: 403 |
| COMPANY | Chưa có Job | Create ACTIVE/REJECTED/EXPIRED | Không cho Company gán quyết định duyệt/expire | 403 |
| ADMIN | Chưa có Job | Create ACTIVE/REJECTED/EXPIRED/CLOSED | Phải đi qua creation/review workflow | 400 |
| COMPANY / ADMIN | DRAFT | PUT nội dung | Chỉ DRAFT được sửa; salary/skills/DTO validations giữ nguyên | 200 |
| COMPANY / ADMIN | Bất kỳ khác DRAFT | PUT nội dung | Phải chủ động đưa về DRAFT trước, không auto-unpublish | 400 |
| COMPANY / ADMIN | DRAFT | PENDING_APPROVAL | Owner Company VERIFIED | 200 / 403 |
| ADMIN | PENDING_APPROVAL | ACTIVE | Owner Company VERIFIED; không publish Company PENDING/BLOCKED | 200 / 403 |
| ADMIN | PENDING_APPROVAL | REJECTED | Admin quyết định review | 200 |
| COMPANY / ADMIN | PENDING_APPROVAL | DRAFT | Rút khỏi review, sau đó mới sửa | 200 |
| COMPANY / ADMIN | REJECTED / CLOSED / EXPIRED | DRAFT | Chuẩn bị/sửa/mở lại; chưa công khai | 200 |
| COMPANY / ADMIN | Bất kỳ khác CLOSED | CLOSED (PATCH hoặc DELETE) | Được đóng/rút tin, kể cả Company không VERIFIED | 200 |
| ADMIN | ACTIVE | EXPIRED | Phân loại hết hiệu lực thủ công; không thêm scheduler/date rule mới | 200 |
| COMPANY / ADMIN | DRAFT / CLOSED | Cùng status | Idempotent; ownership vẫn bắt buộc | 200 |
| COMPANY / ADMIN | PENDING_APPROVAL | Cùng status | Idempotent; Company VERIFIED vẫn bắt buộc | 200 / 403 |
| ADMIN | ACTIVE / REJECTED / EXPIRED | Cùng status | Idempotent; ACTIVE vẫn yêu cầu Company VERIFIED | 200 / 403 |
| Bất kỳ | Mọi edge khác | — | Không có đường mở trực tiếp CLOSED→ACTIVE hoặc DRAFT→ACTIVE | 400 (hoặc 403 nếu role không được gán target) |

`publishedAt` giữ semantics first publication; `closedAt` chỉ đặt khi vào CLOSED, xóa khi rời CLOSED; no-op không ghi lại timestamp. Deadline/null và public/apply date checks giữ semantics hiện có, không tự thêm điều kiện duyệt deadline. Hai yêu cầu approve/reject cạnh tranh phải được serialize ở DB, không cùng quyết định thành công từ snapshot cũ. Company verification updates cùng dùng row lock với Job moderation để không approve bằng Company status stale.

## Thực thi, dữ liệu và kiểm chứng

Backend chịu validation/authorization/state machine. Không thêm endpoint hoặc role, không sửa released migration. Frontend chỉ hiện action hợp lệ: DRAFT edit/submit, pending withdraw, active close, closed/rejected/expired return-to-draft; không có self-publish/reject. Trang edit deep link ngoài DRAFT giải thích trạng thái và cung cấp bước về nháp phù hợp.

E2E setup chỉ xác minh Company mới do setup vừa tạo qua Admin API hợp lệ; không tự unblock/verify Company cũ hoặc chuyển status hàng loạt. Hai PRIMARY, chín alias baseline và CV/jobs được snapshot trước thay đổi. Negative runtime tests dùng record riêng có namespace, không sửa tin ACTIVE của PRIMARY để test. Nếu không có Admin hợp lệ thì workflow mới bị BLOCKED, không bypass SQL.

Evidence expected/actual, test counts và bảo toàn dữ liệu sẽ ghi tại `company-job-moderation-results.md`. Trước triển khai, negative integration assertions phải tái hiện register VERIFIED/self-publish/unrestricted transitions trên baseline. Sau sửa chạy lại full PostgreSQL, FE và real E2E. Những dữ liệu legacy không tuân workflow mới không bị tự backfill.

Company profile PUT cũng phải lấy cùng row lock trước khi đọc entity: Hibernate ghi các cột từ snapshot có thể ghi đè quyết định BLOCKED vừa commit của Admin bằng VERIFIED cũ. Regression PostgreSQL dùng Admin API trong transaction giữ lock và profile PUT cạnh tranh, đợi đúng DB lock rồi commit; status phải giữ BLOCKED và nội dung hồ sơ mới phải được lưu. Không thêm optimistic version/schema hoặc mở rộng sang profile aggregate khác.
