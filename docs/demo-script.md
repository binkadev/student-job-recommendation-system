# Demo Script (7–10 phút)

Kịch bản này trình bày architecture và một luồng nghiệp vụ thật. Chỉ dùng dữ
liệu demo được phép công khai; không hiển thị secret, JWT, raw CV, private
dataset hoặc internal storage path.

## Chuẩn bị trước demo

- checkout đúng commit `master` cần trình bày;
- chạy PostgreSQL, Backend, AI Service và Frontend;
- xác nhận `/health`, Backend health và các tài khoản demo;
- chuẩn bị một Company/Job có thể duyệt và một PDF/DOCX không chứa dữ liệu
  riêng tư;
- chạy trước các bước trong
  [manual E2E checklist](testing/e2e-demo-checklist.md), ghi evidence thật;
- mở log Backend và AI với một bộ lọc `requestId`, nhưng không bật body logging;
- không dùng kết quả toy evaluation như metric sản phẩm.

Nếu một bước chưa được xác minh trước demo, nói rõ trạng thái thay vì thay thế
bằng dữ liệu giả.

## 0:00–0:45 — Mục tiêu và kiến trúc

Trình bày ngắn:

```text
Frontend -> Spring Boot Backend -> FastAPI AI Service
                              -> PostgreSQL
```

Nêu ranh giới:

- Frontend chỉ gọi Backend.
- Backend sở hữu JWT, authorization, business rules, filtering, validation,
  sorting, `rankPosition` và persistence.
- AI Service stateless, không truy cập DB, không nhận user JWT và không trả rank.

## 0:45–1:30 — Security và tracing

- Cho thấy request public/protected đi qua Backend.
- Gửi hoặc quan sát một `X-Request-Id`.
- Giải thích Backend truyền ID sang AI cùng `X-Internal-Api-Key`; không hiển thị
  giá trị key.
- Dùng cùng `requestId` để tìm safe completion log ở hai service.

Nhấn mạnh `X-Request-Id` không phải auth token và khác body `requestId` của
Contract V2.

## 1:30–3:00 — Company chuẩn bị Job

- Đăng nhập Company.
- Mở hồ sơ Company và tạo/chọn Job demo.
- Chỉ ra trạng thái Job trước approval.
- Không truy cập tài nguyên Company khác.

Nếu Job đã được chuẩn bị sẵn để giữ thời lượng, nêu rõ đây là fixture của cùng
environment demo.

## 3:00–4:00 — Admin approval

- Đăng nhập Admin.
- Mở Company/Job cần duyệt.
- Thực hiện transition hợp lệ để Job có thể trở thành eligible.
- Nêu rằng role/ownership được Backend thực thi, không dựa vào việc ẩn nút ở UI.

## 4:00–6:00 — Student upload và phân tích CV

- Đăng nhập Student.
- Upload PDF/DOCX demo và đặt CV active nếu cần.
- Cho thấy CV chưa tự động được xem là `READY`.
- Bấm reanalyze; quan sát trạng thái và kết quả `READY`.
- Nêu Backend gửi file đến `POST /internal/v2/cv/parse` ngoài database
  transaction, rồi validate/persist snapshot.

Nếu phân tích không thành công, giữ nguyên failure state và dùng checklist để
ghi lỗi; không thay bằng response giả.

## 6:00–8:00 — Tạo và xem recommendation

- Chọn CV `READY`, threshold và limit hợp lệ.
- Generate recommendation.
- Mở run và latest persisted results.
- Chỉ ra `score`, `textScore`, `skillScore`, strategy, matched/missing skills và
  reason trên một vài kết quả.
- Giải thích AI dùng hybrid 65/35 cho cùng ngôn ngữ có Job skills, skill-only
  cho cross/mixed/unknown; Backend sort `score DESC`, `jobId ASC` và tạo
  `rankPosition`.

Không trình bày automated correctness smoke như bằng chứng human relevance.

## 8:00–9:00 — Apply và ownership

- Apply vào một Job từ kết quả.
- Mở lịch sử Application của Student.
- Nếu thời gian cho phép, quay lại Company để thấy Application thuộc Job của
  mình.
- Nhắc lại duplicate apply và cross-owner access bị Backend từ chối.

## 9:00–10:00 — Evidence và giới hạn

Evidence core smoke gần nhất có thể nêu:

- `SMOKE RESULT: PASS`;
- CV language `vi`;
- 11 eligible jobs scanned và 11 results persisted;
- ranks 1..11;
- có `SAME_LANGUAGE_HYBRID` và `CROSS_LANGUAGE_SKILL_BASED`;
- request ID được propagate và output không in password, JWT, raw CV text hoặc
  storage path.

Phân biệt rõ:

- CI, Docker core, internal auth, tracing và evaluation framework đã có;
- full manual Student/Company/Admin E2E cần evidence theo checklist;
- release/pull/rollback drill và monitoring/alerting production còn pending;
- ranking evaluation result: **TBD — chờ review/freeze dataset, annotation độc
  lập, adjudication và metric thật**;
- hệ thống chưa được tuyên bố production-ready.
