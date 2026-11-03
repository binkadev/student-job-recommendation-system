# ĐATN Backend Baseline & Gap Audit

## P1 Student application lifecycle — 2026-11-04

- [Transition matrix, PostgreSQL race, withdrawal/reapply UI và browser evidence](student-application-lifecycle-results.md).
- Rút PENDING có confirmation/read-back; rejected reapply tạo history mới, WITHDRAWN vẫn chặn. G04 được xử lý trong phạm vi các entry points đã kiểm thử; không thay business rules hoặc V3. B06 vẫn UNRESOLVED / NOT REPRODUCED.

## P1 Own-company Job pagination / B06 — 2026-11-03

- [API, PostgreSQL 260-fixture tests, browser và bảo toàn dữ liệu](company-jobs-pagination-b06-results.md).
- Danh sách quản lý dùng owner scope/filter/count/page trong Backend, sort có ID tie-break. G03 được xử lý cho trang quản lý; Dashboard/Reports còn giới hạn riêng. B06 giữ **UNRESOLVED / NOT REPRODUCED**; không tuyên bố đã sửa lỗi reload application.

## P0 Student profile atomic save — 2026-11-03

- [Thiết kế API/DB/versioning, rollback, hai tab và data preservation](student-profile-atomic-save-results.md).
- Aggregate một transaction; V19 additive revision; legacy PUT giữ URL/body nhưng bắt buộc If-Match (428 thiếu / 409 stale). G02 trong audit cũ được xử lý; PR #66 giữ Draft.

## P0 Company verification / Job moderation — 2026-11-03

- [Chính sách, đối chiếu source và state transitions](company-job-moderation-policy.md).
- [Kết quả kiểm chứng, HTTP evidence và bảo toàn dữ liệu](company-job-moderation-results.md).
- Bổ sung Backend state machine/authorization, Company register PENDING và UI phản ánh action hợp lệ. G01 trong audit trước được xử lý theo yêu cầu P0 này; các gap khác vẫn giữ phạm vi cũ. PR #66 tiếp tục Draft, không merge.

## Full-stack real E2E — 2026-11-03

- [Kế hoạch và chiến lược dữ liệu](real-world-e2e-test-plan.md).
- [Kết quả, defects, verification và giới hạn](real-world-e2e-results.md): 32/32 real E2E; 138 Frontend tests; 457 Backend tests; 887 AI tests. Không đồng nghĩa nghiệm thu toàn bộ sản phẩm.
- [Matrix 79 route và các action/gap](student-company-functional-gaps.md): phân biệt action đã kiểm chứng với navigation smoke/unsupported.
- [Manifest dữ liệu demo bền vững](e2e-test-data-manifest.md), [nguồn tham khảo](e2e-external-data-sources.md), [login local](e2e-local-login.md).
- [Runner và hướng dẫn chạy lại](../../e2e/README.md). Credentials/raw browser artifacts không commit. PR #66 giữ Draft.

## Baseline lịch sử — 2026-10-13

Đề tài: **Thiết kế và xây dựng Hệ thống Gợi ý Việc làm cho Sinh viên Công nghệ Thông tin sử dụng Content-Based Filtering.**

Audit ngày **2026-10-13**, trên latest `master` sau `git pull --ff-only origin master`, commit **`e1335d5e0177b35647dd12e841df9b693be71682`**. Đây là baseline của hệ thống phát triển tiếp từ TTTN; không phải thiết kế lại hệ thống.

- [Requirement Traceability Matrix](requirement-traceability.md): yêu cầu chính thức, evidence, trạng thái, owner và hành động ĐATN.
- [Backend baseline audit](backend-baseline-audit.md): execution evidence, trace Student Recommendation V3, DB/ERD, bốn nội dung CV, evaluation gaps và đúng một NEXT TASK cho Hải.

Backend verification do audit này tự chạy: `cd backend; .\mvnw.cmd -B -ntp clean verify`, **BUILD SUCCESS**, exit `0`; **456 tests**, failures `0`, errors `0`, skipped `0` (Surefire `246`, Failsafe `210`). Maven kết thúc lúc `2026-10-13T14:17:42+07:00`. Không dùng số liệu TTTN cũ làm kết quả hiện tại.

Core là **Student CV → Job Recommendation**. Company Candidate Ranking là **EXTENSION**. Backend orchestration/ranking/persistence có implementation và tests; readiness ĐATN còn thiếu evidence của các nội dung major/experience/education, evaluation V3/F1@K và ground truth thật. DB documentation/API documentation còn lệch source hiện hành. Có Frontend gọi API trong source, nhưng audit này không chạy browser journey nên không chứng nhận toàn bộ UI đã tích hợp E2E.

Thứ tự nguồn khi mâu thuẫn: executable source + released Flyway → [V3 contract](../recommendation-ranking-v3-contract.md) → [API contract](../api-contract.md) → [DB schema](../database-schema.md)/[ERD](../database-erd.dbml) → [README](../../README.md)/historical docs. Đọc [AGENTS.md](../../AGENTS.md), [project-status](../project-status.md) và [final-verification](../final-verification.md); hai tài liệu cuối ghi baseline lịch sử, không phải execution của commit audit.

Audit chỉ tạo ba file trong thư mục này. Không sửa production source, AI, Frontend, scoring, contracts, schema hoặc migrations; không commit/push/merge. NEXT TASK là đề xuất chờ duyệt, chưa triển khai. HAI sở hữu Backend/System; BAO sở hữu AI/NLP/evaluation; SHARED sở hữu contract, diễn giải yêu cầu CV và evidence E2E.
