# Real-world E2E — kế hoạch và checkpoint 2026-11-03

Baseline: branch `design/datn-ui-ux-refresh-20261102`, HEAD `e56b3efb81709ac598d79bb9d49b8ff58c6200e9`; master `e019f7a4` là ancestor (fetch lại). PR #66 open/Draft. Giữ nguyên `.agents/`, `skills-lock.json`, `frontend/tsconfig.app.tsbuildinfo` có sẵn.

## Chiến lược dữ liệu

- Chỉ chạy localhost:5173/8080/8000, PostgreSQL dev 55432. Không reset DB, không xóa volume, không sửa tài khoản demo/người dùng.
- Namespace cố định `datn-e2e-v1`, email `@datn-e2e.invalid`. Hai tài khoản chính và record demo tồn tại lâu dài. Credentials sinh ngẫu nhiên vào `e2e/.local/credentials.json` bị gitignore; không ghi password/JWT vào báo cáo.
- Mọi write qua API public/authenticated; không seed analysis hay nâng quyền qua SQL. Admin chỉ dùng login dev seed hiện hữu để duyệt record E2E qua API. Không tạo ADMIN. Nếu không login được thì báo BLOCKED.
- Job tạo DRAFT → PENDING_APPROVAL qua Company; duyệt ACTIVE qua Admin hiện hữu. Company tự VERIFIED khi register và status API thiếu state machine là policy gap cần quyết định riêng, không sửa chính sách âm thầm.
- CV PDF Anh, DOCX Việt/Anh có text trích xuất; negative tests dùng record phụ. Idempotency dựa email cố định, title/file name và manifest local. Chạy tuần tự, một worker; chưa hỗ trợ hai process setup đồng thời.
- Không gửi email, không dùng danh tính/doanh nghiệp thật. JD, lương và nhân vật là tổng hợp dành cho local testing.

## Thứ tự và bằng chứng

1. Đọc executable source, migrations V1–V18, V3 contract, API/schema và inventory 104 routes.
2. Kiểm tra runtime, nguồn gốc branch, fixture và login lại hai tài khoản.
3. API thật: profile, CV/AI, recommendation, applications/status/notifications, candidate ranking, ownership, invalid input, duplicate/concurrency, persistence qua đọc lại.
4. Browser Chromium: public/search/detail, login/role/reload, profile edit/save, CV upload/analysis, recommend, apply, company status và ranking. Không mock HTTP trong Real E2E.
5. Route inventory đầy đủ Student/Company/Public: liệt kê hành động từng route, đánh dấu action nào có bằng chứng; render route chỉ là smoke.
6. Viewport 375/430/768/1024/1440; overflow, focus/keyboard/dialog, console và network. Screenshot local bị gitignore. Trace xác thực tắt vì chứa Authorization/password; trace public chỉ ghi khi không có session.
7. Sửa tối thiểu lỗi có tái hiện, thêm regression unit tests riêng (mocked, ghi rõ). Rerun real tests. Ghi gap/policy/blocked trung thực.
8. Frontend lint/build/unit; Backend fast/full PostgreSQL; AI locked dependency check/tests khi môi trường cho phép. Commit đúng phạm vi, push branch, cập nhật PR giữ Draft.

## Điều kiện kiểm chứng

Không suy ra REAL từ unit mock, từ HTTP 200 đơn thuần hoặc page render. Mỗi hành động cần assertion dữ liệu và đọc lại sau mutation/reload; mỗi chuỗi cross-role cần kiểm tra đúng resource và sai ownership. Ranking phải assert version, tier/strategy, null FALLBACK, formula, rank/order và history. Lỗi AI/timeout chưa được tạo thực tế phải ghi NOT_VERIFIED.

## Checkpoint theo phase

| Phase | Trạng thái ban đầu |
|---|---|
| 1 — source/runtime baseline | Đúng HEAD/branch, master ancestor; 104 declared routes từ source hiện có |
| 2 — môi trường | Docker 29.8.2, 3 container healthy; HTTP 200 cả ba URL; 10 jobs/1 company/1 student/0 application |
| 3 — nguồn công khai | O*NET, Spring, React được truy cập; xem e2e-external-data-sources.md |
| 4 — dataset | 9 aliases; 16 jobs ở Company chính; 4 CV READY bền vững; API hợp lệ, credentials local |
| 5–8 — journeys/cross-role/V3 | Các cases A/B/S đã chạy thật; phạm vi và phần chưa kiểm chứng trong results, không nghiệm thu toàn bộ |
| 9 — UX/browser | 5 viewports, keyboard menu/dialog, 79 route controls/screenshots; chưa kiểm contrast/WCAG đầy đủ |
| 10 — sửa lỗi | Frontend `b3958ff1`; Backend `e7cd9d86`; regression unit + real E2E |
| 11 — rerun/report | 32/32 real E2E; 138 FE / 457 Backend / 887 AI; có ghi các lần fail và recovery |
| 12 — review package | Source fix commits và tooling/reports trên task branch; PR #66 yêu cầu giữ Draft, không merge |
