# Production-Readiness Plan

## Mục tiêu

Chuyển hệ thống từ trạng thái demo kỹ thuật sang production-grade MVP có thể tái lập, bàn giao và vận hành an toàn, đồng thời giữ nguyên Contract V2 và các quy tắc nghiệp vụ đã chốt.

## Contract và nghiệp vụ đóng băng

Kiến trúc bắt buộc:

```text
Frontend -> Spring Boot Backend -> FastAPI AI Service
                              -> PostgreSQL
```

Backend tiếp tục sở hữu:

- JWT, phân quyền và ownership;
- nghiệp vụ, transaction và persistence;
- lọc eligible jobs;
- gọi và kiểm tra AI response;
- sắp xếp `score DESC`, rồi `jobId ASC`;
- tạo và lưu `rankPosition`.

AI Service tiếp tục:

- stateless;
- không truy cập PostgreSQL;
- không nhận JWT người dùng;
- không trả `rank` hoặc `rankPosition`;
- sở hữu parsing, NLP song ngữ, canonical skills, component scores và reason.

Contract V2 giữ nguyên:

- `POST /internal/v2/cv/parse`
- `POST /internal/v2/recommendations`
- `algorithm = tfidf-cosine-hybrid`
- `algorithmVersion = bilingual-recommendation-v2`
- `processingVersion = bilingual-nlp-v2-skills-v1`

Scoring giữ nguyên:

- EN ↔ EN và VI ↔ VI: `SAME_LANGUAGE_HYBRID`;
- EN ↔ VI và VI ↔ EN: `CROSS_LANGUAGE_SKILL_BASED`;
- cùng ngôn ngữ, có job skills: `0.65 * textScore + 0.35 * skillScore`;
- cùng ngôn ngữ, không có job skills: `score = textScore`;
- khác ngôn ngữ/không đủ tin cậy: `textScore = null`, `score = skillScore`.

## Trạng thái đã hoàn thành

- Backend core, security và các API chính của MVP.
- PostgreSQL và Flyway đến V15.
- AI Contract V2 song ngữ Việt–Anh.
- Phân tích PDF/DOCX, language detection, preprocessing và canonical skill extraction.
- Recommendation run/result persistence và Backend-owned ranking.
- Backend unit/integration tests, Testcontainers, Flyway validation và Backend CI.
- AI automated tests và real-stack Backend–AI–PostgreSQL smoke đã được thực hiện.
- Query fan-out optimization và benchmark evidence.

## Giới hạn hiện tại

- Docker Compose mới chỉ chạy PostgreSQL.
- Chưa có Docker image cho Backend và AI Service.
- Chưa có AI CI riêng.
- Chưa publish image lên GitHub Container Registry.
- Chưa có production profile, internal AI authentication, monitoring, alerting và backup/restore runbook hoàn chỉnh.
- Chưa chứng minh chất lượng ranking bằng tập dữ liệu do con người gán nhãn.
- Frontend end-to-end với Backend và AI chưa có bằng chứng runtime trên nhánh chuẩn.

## Phân biệt các loại kiểm thử

Automated test hiện tại chứng minh:

- functional correctness;
- contract compatibility;
- scoring formula correctness;
- deterministic ordering;
- persistence và integration behavior.

Automated test hiện tại không tự chứng minh công việc được gợi ý là phù hợp theo đánh giá của con người.

Cho đến khi có tập dữ liệu gán nhãn, tài liệu phải ghi rõ:

> Nhóm đã kiểm thử tính đúng đắn của pipeline, contract, công thức và luồng tích hợp; chưa thực hiện đánh giá chất lượng xếp hạng trên tập dữ liệu do con người gán nhãn.

## Lộ trình triển khai

### Giai đoạn 0 — Repository truth

- Đồng bộ README, AGENTS, Backend README, AI README và tài liệu API.
- Sửa wording English-only còn sót trong lỗi V2.
- Dọn legacy branch sau khi đã đối chiếu lịch sử.
- Không merge code V1 hoặc branch cá nhân cũ vào `master`.

### Giai đoạn 1 — Docker core stack

Tạo:

- `backend/Dockerfile`
- `backend/.dockerignore`
- `ai-service/Dockerfile`
- `ai-service/.dockerignore`
- `.env.example`
- Compose cho `postgres`, `ai-service`, `backend`

Yêu cầu:

- healthcheck cho PostgreSQL và AI;
- Backend dùng hostname `postgres` và `ai-service`;
- volume riêng cho database và CV uploads;
- không bake secrets vào image;
- `docker compose up --build -d` khởi động toàn bộ core stack.

### Giai đoạn 2 — Acceptance smoke

Tạo `scripts/smoke-core.ps1` chạy qua Backend:

1. Login Student.
2. Upload fixture CV tiếng Việt.
3. Reanalyze và xác nhận `READY`, `languageCode = vi`.
4. Generate recommendations.
5. Xác nhận cả `SAME_LANGUAGE_HYBRID` và `CROSS_LANGUAGE_SKILL_BASED`.
6. Xác nhận Backend trả `rankPosition` liên tục.

### Giai đoạn 3 — CI và container registry

- Thêm AI CI với Python 3.11.9, hashed lock, `pip check`, `pytest`.
- Build Backend và AI images.
- Publish lên GHCR với tag commit SHA và release tag.
- Không phụ thuộc duy nhất vào `latest`.

### Giai đoạn 4 — Production hardening

- Production profile và environment validation.
- Tắt demo seeder trong production.
- CORS allowlist theo environment.
- Bảo vệ Swagger production.
- Internal authentication Backend–AI.
- Upload/rate limits, sanitized logs và secret management.

### Giai đoạn 5 — Observability và reliability

- Structured logs và correlation ID.
- Health/readiness, latency và failure metrics.
- Backup PostgreSQL và CV volume.
- Restore test và rollback runbook.

### Giai đoạn 6 — Ranking-quality evaluation

Pilot tối thiểu:

- 10 CV;
- 30–50 jobs;
- 2–3 người gán nhãn;
- Precision@5, Recall@5, NDCG@5;
- so sánh text-only, skill-only và production hybrid 65/35.

Không tự tạo ground truth bằng chính thuật toán.

### Giai đoạn 7 — Frontend end-to-end

Frontend chỉ gọi Backend. Luồng cần chứng minh runtime:

```text
Login -> Company tạo Job -> Admin duyệt -> Student upload CV
-> reanalyze -> recommendation -> apply
```

## Thứ tự Pull Request

1. `docs: align repository truth and production-readiness status`
2. `chore(docker): containerize backend ai and postgres core stack`
3. `test(smoke): add reproducible backend-ai acceptance flow`
4. `ci(ai): add Python test workflow`
5. `ci(images): publish backend and ai images to GHCR`
6. `feat(security): harden production configuration and internal AI access`
7. `ops: add observability backup and restore procedures`
8. `test(evaluation): add offline ranking-quality evaluation framework`
9. `feat(frontend): integrate production backend APIs`

## Definition of Done cho production MVP

- Clean clone có thể chạy bằng Docker Compose.
- Database migration tự động và idempotent.
- Backend, AI và PostgreSQL healthy.
- Upload CV thật, reanalyze và generate recommendation thành công.
- Contract V2 và nghiệp vụ không đổi.
- CI bảo vệ Backend và AI.
- Container images có version và rollback được.
- Secrets không nằm trong repository/image.
- Có logs, health, backup và restore instructions.
- Tài liệu phân biệt rõ correctness testing và ranking-quality evaluation.
