# ĐATN Backend Baseline & Gap Audit

Đề tài: **Thiết kế và xây dựng Hệ thống Gợi ý Việc làm cho Sinh viên Công nghệ Thông tin sử dụng Content-Based Filtering.**

Audit ngày **2026-10-13**, trên latest `master` sau `git pull --ff-only origin master`, commit **`e1335d5e0177b35647dd12e841df9b693be71682`**. Đây là baseline của hệ thống phát triển tiếp từ TTTN; không phải thiết kế lại hệ thống.

- [Requirement Traceability Matrix](requirement-traceability.md): yêu cầu chính thức, evidence, trạng thái, owner và hành động ĐATN.
- [Backend baseline audit](backend-baseline-audit.md): execution evidence, trace Student Recommendation V3, DB/ERD, bốn nội dung CV, evaluation gaps và đúng một NEXT TASK cho Hải.

Backend verification do audit này tự chạy: `cd backend; .\mvnw.cmd -B -ntp clean verify`, **BUILD SUCCESS**, exit `0`; **456 tests**, failures `0`, errors `0`, skipped `0` (Surefire `246`, Failsafe `210`). Maven kết thúc lúc `2026-10-13T14:17:42+07:00`. Không dùng số liệu TTTN cũ làm kết quả hiện tại.

Core là **Student CV → Job Recommendation**. Company Candidate Ranking là **EXTENSION**. Backend orchestration/ranking/persistence có implementation và tests; readiness ĐATN còn thiếu evidence của các nội dung major/experience/education, evaluation V3/F1@K và ground truth thật. DB documentation/API documentation còn lệch source hiện hành. Có Frontend gọi API trong source, nhưng audit này không chạy browser journey nên không chứng nhận toàn bộ UI đã tích hợp E2E.

Thứ tự nguồn khi mâu thuẫn: executable source + released Flyway → [V3 contract](../recommendation-ranking-v3-contract.md) → [API contract](../api-contract.md) → [DB schema](../database-schema.md)/[ERD](../database-erd.dbml) → [README](../../README.md)/historical docs. Đọc [AGENTS.md](../../AGENTS.md), [project-status](../project-status.md) và [final-verification](../final-verification.md); hai tài liệu cuối ghi baseline lịch sử, không phải execution của commit audit.

Audit chỉ tạo ba file trong thư mục này. Không sửa production source, AI, Frontend, scoring, contracts, schema hoặc migrations; không commit/push/merge. NEXT TASK là đề xuất chờ duyệt, chưa triển khai. HAI sở hữu Backend/System; BAO sở hữu AI/NLP/evaluation; SHARED sở hữu contract, diễn giải yêu cầu CV và evidence E2E.
