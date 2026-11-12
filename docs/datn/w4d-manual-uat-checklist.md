# W4-D — Checklist UAT và tổng duyệt demo

Baseline: `master@58a494806bc63fadb3bc904bb6f05294839fea32`. Checklist dành cho người trình bày; đây **không phải** kết quả chạy Playwright. Chưa có người thực hiện các bước dưới đây trong W4-D, nên mọi kết quả đều là **NOT TESTED**. Chỉ người kiểm tra mới đổi thành PASS/FAIL sau khi thao tác, ghi ngày và bằng chứng. Kết quả automated xem [báo cáo nghiệm thu](w4d-final-acceptance-report.md).

Người thực hiện: ______ · Ngày/giờ: ______ · Commit triển khai: ______ · URL UAT: ______ · Múi giờ: ______

## Chuẩn bị trước buổi trình bày

- Dùng môi trường UAT được cho phép, PostgreSQL 17 và dữ liệu tổng hợp; không reset, hash hay kiểm tra nội dung database demo đang được bảo toàn trong tác vụ này. Không dùng dữ liệu cá nhân thật.
- Chuẩn bị Student S1/S2, Company C1/C2 và Admin A1. Admin do người quản trị cấp qua quy trình hiện có; không đăng ký công khai vai trò Admin. Giữ mật khẩu/JWT ngoài checklist và ảnh chụp.
- Chuẩn bị hai CV tổng hợp PDF/DOCX có văn bản đọc được, bộ Job tiếng Anh/Việt, kỹ năng canonical và deadline tương lai. Trình bày rõ corpus tổng hợp; không coi thứ hạng mong muốn do tác giả đặt ra là ground truth đánh giá.
- Company mới phải PENDING; Admin xác minh, Company tạo DRAFT/gửi duyệt, Admin duyệt thành ACTIVE. Không bypass SQL để làm dữ liệu trình diễn trông hợp lệ.
- Dùng Job/Application riêng cho các nhánh rút đơn, từ chối, nhận lời mời và huỷ phỏng vấn. Không reset lịch sử terminal để tái sử dụng một fixture.
- Mở DevTools Network nhưng che Authorization, cookie, request/response nhạy cảm. Chỉ ghi method/path/status, ID tổng hợp, revision và số lượng. Nếu cần SQL, chỉ người có quyền đọc **database UAT tách biệt** thực hiện; không copy raw CV/message/password hash vào báo cáo.
- Không trình diễn password recovery. Không hứa realtime messaging, exactly-once delivery, chứng nhận bảo mật hoặc production readiness.

## Công khai và đăng nhập

| ID | Điều kiện / vai trò | Các bước UI | Kết quả mong đợi | API/DB hữu ích | Kết quả | Gợi ý ảnh |
|---|---|---|---|---|---|---|
| P01 | Khách; dữ liệu UAT đã chuẩn bị | Mở `/`, tới `/jobs` và `/companies`; reload | Trang tải được; số liệu/danh sách đến từ API hoặc có thông báo lỗi rõ; không dùng placeholder làm bằng chứng chức năng | GET `/api/public/statistics`, `/api/public/jobs`, `/api/public/companies` | NOT TESTED | Trang chủ và danh sách, không có thông tin đăng nhập |
| P02 | Khách; Job ACTIVE thuộc Company VERIFIED, chưa hết hạn | Tìm kiếm/lọc Job; mở chi tiết; Back/Forward/reload deep link | Kết quả/phân trang đúng; chi tiết giữ cùng ID; Job không đủ điều kiện không xuất hiện công khai | GET `/api/public/jobs/{id}`; đối chiếu status/Company/deadline trong UAT nếu cần | NOT TESTED | Bộ lọc và chi tiết Job |
| P03 | Khách; Company có hồ sơ | Tìm Company; mở `/companies/{id}` và Job của Company | Hồ sơ công khai đúng; không lộ metadata tài liệu xác minh, private path hay CV | Public Company response; tuyệt đối không chụp private storage key | NOT TESTED | Hồ sơ công khai |
| S01 | Khách; email tổng hợp chưa tồn tại | `/register/candidate`; đăng ký; đăng nhập; logout; login lại | Tạo STUDENT; tới dashboard ứng viên; lỗi nhập liệu không tạo tài khoản thừa | POST `/api/auth/register`, `/api/auth/login`; chỉ ghi status và role | NOT TESTED | Form không hiện mật khẩu và dashboard |
| G01 | S1/C1/A1 sẵn có | Mỗi vai trò login; thử URL của vai trò khác; logout rồi mở deep link được bảo vệ | Tới dashboard đúng vai trò; sai role tới 403; chưa login tới login; Backend vẫn chặn truy cập trái quyền | Chỉ ghi 401/403 và route; không ghi token | NOT TESTED | 403 và màn hình sau logout |

## Student: hồ sơ, CV và gợi ý

| ID | Điều kiện / vai trò | Các bước UI | Kết quả mong đợi | API/DB hữu ích | Kết quả | Gợi ý ảnh |
|---|---|---|---|---|---|---|
| S02 | S1 đã login | `/candidate/profile/edit`; sửa học vấn/GPA/kỹ năng/chứng chỉ/ngôn ngữ/liên kết; nhập GPA sai ở tab ẩn rồi lưu; sửa đúng và lưu/reload | Lỗi mở đúng tab và focus đúng ô; không gửi khi invalid; một aggregate save giữ dữ liệu ngoài phần sửa | `/api/students/me/profile-aggregate`, captured revision/ETag; không tự lấy revision mới để đè draft cũ | NOT TESTED | Tab invalid và hồ sơ sau reload |
| S03 | Hai phiên S1; snapshot cùng revision | Soạn draft; phiên khác lưu thay đổi; quay lại lưu draft cũ; dùng chức năng đối chiếu | 409 giữ draft; không tự retry/overwrite; chỉ reload sau quyết định rõ của người dùng | Aggregate response 409; so captured revision trước/sau | NOT TESTED | Thông báo conflict và draft còn nguyên |
| S04 | S1; PDF tổng hợp mới | `/candidate/cvs/upload`; tải PDF thật; mở chi tiết/analysis; bấm Phân tích nếu cần; chờ trạng thái cuối | Upload thành công; real AI tạo READY với snapshot/skills/language/version, hoặc báo lỗi thật; không thay bằng CV đã READY sẵn | POST `/api/students/me/cv`; GET `/{cvId}/analysis`, POST `/{cvId}/reanalyze` khi chủ động; CV UAT READY và analyzedAt | NOT TESTED | READY cùng ID CV; che nội dung CV nếu cần |
| S05 | S1; DOCX tổng hợp mới | Lặp lại upload→analysis với DOCX; reload kết quả | DOCX đi qua parser thật; READY được lưu, không mất sau reload | Cùng các endpoint CV; access log AI parse V2 và metadata UAT, không raw text | NOT TESTED | Loại file DOCX và trạng thái phân tích |
| S06 | S1 có ít nhất hai CV | Chọn CV active; chuyển sang CV còn lại; reload danh sách | Chỉ một CV active; CV khác và lịch sử không bị xóa; gợi ý sử dụng đúng CV được chọn/READY | PATCH `/api/students/me/cv/{id}/active`; kiểm đếm active chỉ trong UAT của S1 | NOT TESTED | Danh sách có một active |
| S07 | S1, CV READY; corpus Job hợp lệ có cùng/khác ngôn ngữ | `/candidate/jobs/recommended`; chọn CV, threshold/limit nếu UI hỗ trợ; chủ động tạo gợi ý; mở scores/explanation | Real Backend→AI V3; PRIMARY đứng trước FALLBACK; hybrid 0.65 text + 0.35 skill khi Job có skills; FALLBACK skill-only, text/overall null; không gọi score là độ chính xác | POST `/api/students/me/recommendations/generate`; owned run ID; SQL results/ranks; V3=1 cho một generation, không thay bằng V2 | NOT TESTED | Hai tier và giải thích/điểm thành phần |
| S08 | S1 đã có SUCCESS run | Reload gợi ý/history, mở lại kết quả; login S2 thử ID run S1 | Đọc lại kết quả đã lưu, không tự generate; S2 không xem được run S1 | GET recommendation-runs/detail/latest; phân biệt read và generation | NOT TESTED | History với run ID và thứ hạng |
| S09 | S1; Job hợp lệ | Lưu Job từ danh sách/chi tiết; tới `/candidate/jobs/saved`; reload; bỏ lưu | Chỉ thay đổi saved Job của S1; không tạo Application | Saved Jobs API và count của S1 | NOT TESTED | Danh sách đã lưu |
| S10 | S1; CV thuộc S1; Job đủ điều kiện | Ứng tuyển; mở `/candidate/applications/{id}`; reload; thử gửi trùng | Application PENDING giữ đúng submitted CV; trùng active bị chặn; lịch sử không bị thay | POST `/api/jobs/{id}/apply`; owned application/detail; 409 APPLICATION_ALREADY_ACTIVE | NOT TESTED | Chi tiết đơn và trạng thái |
| S11 | Hai Application riêng: một PENDING, một được Company REJECTED | Student rút đơn PENDING; kiểm tra không apply lại trên latest WITHDRAWN. Với nhánh REJECTED, chủ động apply lại | PENDING→WITHDRAWN; WITHDRAWN chặn reapply. Latest REJECTED và không có active cho phép **row PENDING mới**, giữ row cũ | PATCH `/api/applications/{id}/status`; IDs/count/status trong UAT; không reset row cũ | NOT TESTED | Hai dòng lịch sử của nhánh reapply |

## Company và Admin

| ID | Điều kiện / vai trò | Các bước UI | Kết quả mong đợi | API/DB hữu ích | Kết quả | Gợi ý ảnh |
|---|---|---|---|---|---|---|
| C01 | Company đăng ký mới | `/register/recruiter`; login; `/recruiter/company/edit`; sửa companySize/logo/cover rồi lưu/reload | Company PENDING; field không ghép dữ liệu cũ khi bắt đầu nhập; giữ revision/If-Match; URL lỗi có fallback | `/api/companies/me` GET/PUT; captured ETag; reload persisted fields | NOT TESTED | Hồ sơ PENDING sau lưu |
| C02 | C1 PENDING; PDF/PNG tổng hợp | `/recruiter/company/verification`; upload PDF, download; thay bằng PNG, download lại | Byte download khớp file; revision tăng; thay file dọn bản cũ; Company vẫn PENDING | Owned verification-document upload/download; kiểm byte cục bộ, không ghi storage key | NOT TESTED | Trạng thái tài liệu và revision |
| C03 | Hai phiên C1; form chọn file cũ revision | Phiên khác cập nhật profile; upload từ draft cũ; reload có chủ ý | 409 giữ lựa chọn, không retry tự động; reload lấy ETag mới | Status 409; request count; metadata revision | NOT TESTED | Conflict và file còn được chọn |
| A01 | A1; C1 có tài liệu PENDING | `/admin/companies`; mở đúng C1; tải tài liệu; xác minh | Chỉ Admin được xác minh; download có auth; C1 thành VERIFIED, dữ liệu/profile cũ giữ nguyên | Admin Company/status/document APIs; Company revision/status UAT | NOT TESTED | Company VERIFIED, không chụp tài liệu riêng tư |
| C04 | C1; thêm C2 PENDING để thử chặn | Tạo Job DRAFT; sửa; C2 thử gửi duyệt; C1 VERIFIED gửi PENDING_APPROVAL | Lưu nháp được; Company chưa VERIFIED không submit; Company không tự ACTIVE/REJECTED | POST/PUT `/api/jobs`, PATCH `/{id}/status`; 403 cho self-approve/sai role | NOT TESTED | DRAFT và trạng thái chờ duyệt |
| A02 | A1; hai Job PENDING_APPROVAL riêng | `/admin/jobs/pending`; duyệt một Job ACTIVE, từ chối Job khác; xem Public search | ACTIVE chỉ khi Company VERIFIED; nhánh REJECTED không công khai; sửa nội dung cần về DRAFT và review lại | Admin Job status API; public visibility; không cascade/hard-delete Applications | NOT TESTED | Quyết định review và Job công khai |
| C05 | C1 có Application hợp lệ | Trang applicants; mở chi tiết, tải CV qua auth; chuyển PENDING→REVIEWED rồi ACCEPTED hoặc REJECTED trên nhánh riêng | Đúng owner/Student/CV; status theo lifecycle; Company khác bị chặn; terminal không bị mở lại | Company-owned applications/CV file API, PATCH application status; không lấy CV từ URL công khai | NOT TESTED | Applicant detail đã che thông tin nhạy cảm |
| C06 | C1; owned Job có Applications/CV READY thực; đủ hai tier nếu muốn giải thích | Từ Job mở Candidate Ranking; chủ động chạy, xem các tier và history; C2 thử deep link | Real Company V3 trên corpus owned; hai tier có limit/rank riêng; FALLBACK không là overall match; không rơi sang CV active mới thay submitted CV | POST `/api/companies/me/jobs/{jobId}/candidate-ranking-runs`; detail/history; SQL run fingerprint/results; AI V3 endpoint | NOT TESTED | Hai tier, counters và run ID |

## Interviews, invitations, messaging và phiên

| ID | Điều kiện / vai trò | Các bước UI | Kết quả mong đợi | API/DB hữu ích | Kết quả | Gợi ý ảnh |
|---|---|---|---|---|---|---|
| R01 | C1 VERIFIED, owned live Application; S1 | C1 tạo lịch ONLINE/ONSITE trong tương lai; S1 mở `/candidate/interviews`, xác nhận; cả hai reload | SCHEDULED→CONFIRMED; giờ hiển thị thống nhất múi giờ máy chủ; Application giữ nguyên | Owned interviews POST/list/PATCH, captured expectedStatus; SQL status | NOT TESTED | Lịch trước/sau Student xác nhận |
| R02 | Lịch riêng cho huỷ; hai phiên để tạo stale state | C1 huỷ; phiên S1 cũ thử respond; reload thủ công | CANCELLED; stale expectedStatus trả 409, giữ dữ liệu xác nhận trước khi reload; không tạo lịch/đơn khác | RECRUITMENT_STATE_CONFLICT; full-row Application không đổi | NOT TESTED | Conflict và status sau reload |
| R03 | C1 có applicant/saved candidate liên quan, Job ACTIVE đủ điều kiện | Mở launcher lời mời, gửi; thử duplicate PENDING; S1 accept một lời mời, decline lời mời khác | Duplicate 409 giữ draft; response bền vững; accept **không tự tạo Application** | Owned invitations POST/PATCH; INVITATION_ALREADY_PENDING; Application count/history giữ nguyên | NOT TESTED | Invitation status và deep link Job |
| M01 | S1/C1 là participants của cùng Application | Mở launcher nhắn tin từ Application ở cả hai role; mở deep link/reload | Tạo/reuse cùng conversation; không có bản trùng; scope theo Application, kể cả lịch sử terminal | POST `/api/conversations` chỉ applicationId; unique application_id | NOT TESTED | Hai role cùng conversation ID |
| M02 | Hội thoại trên; tài khoản ở hai cửa sổ riêng | S1 gửi text tổng hợp; C1 refresh thủ công; C1 trả lời; S1 reload | Nội dung/chronology được lưu; sender do JWT quyết định; mỗi lần gửi đã xác nhận thêm một row; không hứa realtime hoặc exactly-once | POST/GET `conversations/{id}/messages`; SQL chỉ count/IDs, không copy nội dung vào evidence | NOT TESTED | Tin tổng hợp và thời gian |
| M03 | Có incoming unread và outbound | Xem history, rồi chủ động đánh dấu đã đọc; lặp lại; gửi thêm incoming | GET không mark-read; PATCH chỉ incoming, lần hai markedCount=0; incoming mới chưa đọc | PATCH `/api/conversations/{id}/read` không body; read flags UAT | NOT TESTED | Trạng thái đọc trước/sau |
| M04 | Nhiều conversation/messages và S2/C2 | Deep link ngoài trang đầu; chuyển trang tin nhắn; thử ID foreign/unknown; chuyển account khi request đang tải | Dữ liệu owned đúng trang; không lộ nội dung foreign; không giữ draft/cache người trước; API lỗi không thành danh sách rỗng giả | GET page/size, 401/403/404; hủy/bỏ late response khi logout | NOT TESTED | Trang sau và inbox tài khoản mới |
| N01 | S1/C1 có sự kiện tạo notification được hệ thống hỗ trợ | Mở Notifications, reload, đọc một mục/đọc tất cả nếu UI hỗ trợ; đổi account | Chỉ notification owned, trạng thái đọc lưu; không suy diễn Interview/Invitation/Message sinh notification vì các module này không có producer tương ứng | Owned notifications list/read/unread-count APIs; chỉ kiểm những event hiện có | NOT TESTED | Notification list và read state |
| G02 | S1/C1/A1; có private page đang mở | Logout; Back/Forward/reload; login role khác trong cùng tab; mở lại URL cũ | Không flash/cache nội dung trước; wrong role 403; guest redirect login; request cũ không ghi đè phiên mới | Route guards, abort/cancel và scoped API status; không chụp JWT | NOT TESTED | Guest login, 403 và dashboard mới |

## Kết thúc tổng duyệt

Ghi FAIL với ID bước, hành động, expected/actual, method/path/status và ảnh đã che dữ liệu. Không đổi assertion hay sửa database để ghi PASS. Bước không đủ dữ liệu/môi trường giữ NOT TESTED kèm lý do. Sau khi người kiểm tra hoàn tất, ghi số PASS/FAIL/NOT TESTED và các nhánh chưa chạy; không lấy 26 browser cases tự động làm kết quả manual.

Tổng manual: PASS ___ · FAIL ___ · NOT TESTED ___ · Người xác nhận ___ · Link bằng chứng đã làm sạch ___

Trước khi lên trình bày cần tổng duyệt đặc biệt S04–S08 và C06: W4-D chưa chạy fresh-upload Student journey hoặc Company Candidate Ranking bằng các runner cũ vì rủi ro isolation; Core Smoke chỉ chứng minh V3 với snapshot READY tổng hợp. Nếu các luồng này chưa được người trình bày chạy thành công trên môi trường UAT được phép, phải nói rõ giới hạn, không giới thiệu như đã nghiệm thu trọn vẹn.
