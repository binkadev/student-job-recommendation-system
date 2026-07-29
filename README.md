<div align="center">

# Hệ thống Gợi ý Việc làm cho Sinh viên CNTT

**Nền tảng tuyển dụng và gợi ý việc làm dựa trên nội dung CV, hỗ trợ tiếng Việt và tiếng Anh bằng TF-IDF, Cosine Similarity và đối sánh kỹ năng chuẩn hóa.**

[![Backend CI](https://github.com/binkadev/student-job-recommendation-system/actions/workflows/backend-ci.yml/badge.svg?branch=master)](https://github.com/binkadev/student-job-recommendation-system/actions/workflows/backend-ci.yml)
[![AI Service CI](https://github.com/binkadev/student-job-recommendation-system/actions/workflows/ai-ci.yml/badge.svg?branch=master)](https://github.com/binkadev/student-job-recommendation-system/actions/workflows/ai-ci.yml)
[![Frontend CI](https://github.com/binkadev/student-job-recommendation-system/actions/workflows/frontend-ci.yml/badge.svg?branch=master)](https://github.com/binkadev/student-job-recommendation-system/actions/workflows/frontend-ci.yml)

![Java](https://img.shields.io/badge/Java-21-E76F00?logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5.x-6DB33F?logo=springboot&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![Status](https://img.shields.io/badge/Trạng%20thái-Production--readiness%20in%20progress-orange)

</div>

## Tổng quan

Hệ thống hỗ trợ Student quản lý CV, tìm và ứng tuyển việc làm; Company quản lý doanh nghiệp, tin tuyển dụng và hồ sơ ứng viên; Admin quản trị dữ liệu và trạng thái nghiệp vụ. Pipeline gợi ý sử dụng nội dung CV, nội dung Job và kỹ năng canonical để tạo kết quả có thành phần điểm và lý do giải thích.

`master` là nhánh tích hợp chính thức. Các nhánh legacy hoặc nhánh cá nhân không phải nguồn hành vi nghiệp vụ.

## Trạng thái hiện tại

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Backend core và API MVP | Hoàn thành | Backend là system of record |
| PostgreSQL và Flyway | Hoàn thành | Migration hiện đến V15 |
| AI Contract V2 song ngữ | Hoàn thành | PDF/DOCX, tiếng Việt và tiếng Anh |
| Frontend tích hợp Backend | Đã merge | Candidate runtime-state fixes đã có trên `master`; full manual E2E còn pending |
| Backend, AI và Frontend CI | Hoàn thành | Có workflow riêng cho ba thành phần |
| Docker core stack | Hoàn thành | PostgreSQL + Backend + AI Service |
| Automated core smoke | Hoàn thành | Luồng thật đi qua Backend và persistence |
| GHCR automation | Đã triển khai workflow/runbook | Chưa coi release/pull/rollback là đã kiểm chứng nếu chưa có evidence |
| Production profile hardening | Hoàn thành | Cấu hình production fail-fast và không chạy demo seeder |
| Internal Backend → AI auth | Hoàn thành | Shared `X-Internal-Api-Key` cho `/internal/v2/**` |
| Request tracing | Hoàn thành | `X-Request-Id` xuyên suốt Backend → AI, kèm safe completion logging |
| Offline evaluation framework | Hoàn thành | Dataset schema, runner, metrics và annotation workflow đã có |
| Human-labeled ranking evaluation | Chưa hoàn thành | Còn review dataset, annotation, adjudication và metric thật |
| Production monitoring/alerting | Chưa hoàn thành | Chưa đủ điều kiện tuyên bố production-ready |

## Kiến trúc

```text
Frontend / Client
       |
       v
Spring Boot Backend ------> FastAPI AI Service
       |
       v
PostgreSQL
```

- Frontend chỉ gọi public API của Backend, không gọi AI Service trực tiếp.
- Backend sở hữu JWT, authorization, business rules, eligible-job filtering, AI response validation, sorting, `rankPosition`, transaction và persistence.
- AI Service là dịch vụ tính toán stateless: không truy cập database, không nhận user JWT và không trả rank.
- Backend gọi các route V2 của AI bằng shared internal API key và truyền `X-Request-Id` để correlation log.

Chi tiết trách nhiệm từng service xem tại [Backend README](backend/README.md), [AI Service README](ai-service/README.md) và [Frontend README](frontend/README.md).

## Contract V2 và scoring đóng băng

Internal endpoints:

```text
POST /internal/v2/cv/parse
POST /internal/v2/recommendations
```

Metadata:

```text
algorithm         = tfidf-cosine-hybrid
algorithmVersion  = bilingual-recommendation-v2
processingVersion = bilingual-nlp-v2-skills-v1
```

Quy tắc scoring:

- cùng ngôn ngữ và Job có skills: `score = 0.65 * textScore + 0.35 * skillScore`;
- cùng ngôn ngữ và Job không có skills: `score = textScore`;
- khác ngôn ngữ, mixed hoặc không đủ tin cậy: `textScore = null`, `score = skillScore`;
- Backend sắp xếp `score DESC`, rồi `jobId ASC`, sau đó tạo `rankPosition` liên tục.

Chi tiết wire contract nằm trong [API contract](docs/api-contract.md).

## Chạy local

### Docker core stack

Yêu cầu Docker Desktop hoặc Docker Engine có Docker Compose V2. Từ repository root:

```powershell
Copy-Item .env.example .env
docker compose up --build -d
docker compose ps
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-core.ps1
```

Không dùng các giá trị development trong `.env.example` cho production và không commit file `.env`.

Các URL local chính:

```text
Frontend:        http://localhost:5173
Backend Swagger: http://localhost:8080/swagger-ui.html
AI health:       http://localhost:8000/health
AI OpenAPI:      http://localhost:8000/docs
```

Compose core không khởi động Frontend; hướng dẫn chạy Frontend nằm trong [frontend/README.md](frontend/README.md).

### Chạy từng service

- Backend: [backend/README.md](backend/README.md)
- AI Service: [ai-service/README.md](ai-service/README.md)
- Frontend: [frontend/README.md](frontend/README.md)

Tài khoản local development:

```text
admin@example.com
student@example.com
company@example.com
```

Thông tin đăng nhập development được cấu hình cho demo local và tuyệt đối không được tái sử dụng trong production.

## Bằng chứng kiểm thử hiện có

Automated core smoke mới nhất được ghi nhận:

```text
SMOKE RESULT: PASS
CV language: vi
Eligible jobs scanned: 11
Persisted results: 11
Rank sequence: 1..11
Strategies: SAME_LANGUAGE_HYBRID, CROSS_LANGUAGE_SKILL_BASED
```

Smoke cũng xác nhận `requestId` được propagate giữa Backend và AI. Output không in password, JWT, raw CV text hoặc storage path.

Đây là bằng chứng về functional correctness, Contract V2, orchestration, sorting và persistence của core stack. Nó không thay thế full manual E2E cho Student/Company/Admin và không chứng minh chất lượng ranking theo đánh giá con người.

Các lệnh kiểm tra chính:

```powershell
# Backend
cd backend
.\mvnw.cmd -B -ntp test
.\mvnw.cmd -B -ntp clean verify

# AI Service
cd ..\ai-service
python -m pip install --require-hashes -r requirements.lock
python -m pip check
python -m pytest

# Frontend
cd ..\frontend
npm ci
npm run lint
npm run build
```

CI tương ứng nằm tại:

- [Backend CI](.github/workflows/backend-ci.yml)
- [AI Service CI](.github/workflows/ai-ci.yml)
- [Frontend CI](.github/workflows/frontend-ci.yml)
- [Core Smoke CI](.github/workflows/core-smoke-ci.yml)
- [Container Images](.github/workflows/container-images.yml)

## Việc còn lại trước production

- chạy và lưu evidence full manual E2E cho Student, Company, Admin và authorization;
- review rồi freeze evaluation `jobs.json`;
- hoàn thành annotation độc lập bởi 2–3 người và manual adjudication;
- tính Precision@5, Recall@5 và NDCG@5 trên ground truth đã duyệt;
- kiểm chứng release tag, pull image và rollback drill đầy đủ;
- hoàn thiện production monitoring và alerting.

Hệ thống hiện **chưa được tuyên bố production-ready**.

## Bản đồ tài liệu

Điểm bắt đầu đầy đủ: [docs/README.md](docs/README.md).

| Nhóm | Tài liệu |
|---|---|
| Kiến trúc và contract | [AGENTS.md](AGENTS.md), [API contract](docs/api-contract.md), [Database schema](docs/database-schema.md), [ERD](docs/database-erd.dbml) |
| Service | [Backend](backend/README.md), [AI Service](ai-service/README.md), [Frontend](frontend/README.md) |
| Local/Docker | [Docker core](docs/docker-core.md), [Container images và GHCR](docs/container-images.md) |
| Security/observability | [Request tracing](docs/operations/request-tracing.md) |
| Testing/performance | [Postman regression](docs/postman-regression.md), [Performance](performance/README.md), [E2E demo checklist](docs/testing/e2e-demo-checklist.md) |
| Evaluation | [Offline evaluation](ai-service/evaluation/README.md) |
| Demo/release readiness | [Demo script](docs/demo-script.md), [Production plan](docs/production-readiness-plan.md), [Production checklist](docs/production-readiness-checklist.md) |

## Đóng góp

1. Bắt đầu từ `master` mới nhất và làm việc trên branch riêng.
2. Không sửa migration Flyway đã phát hành.
3. Không thay đổi Contract V2, scoring hoặc ownership boundary nếu chưa có quyết định kiến trúc được review.
4. Không commit secret, `.env`, private CV/dataset, upload runtime, build output hoặc IDE config.
5. Chạy kiểm tra phù hợp, mở pull request và chỉ merge sau review.
