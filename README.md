<div align="center">

# 🎯 Hệ thống Gợi ý Việc làm cho Sinh viên CNTT

**Nền tảng tuyển dụng và gợi ý việc làm dựa trên nội dung CV, hỗ trợ tiếng Việt và tiếng Anh bằng Content-Based Filtering, TF-IDF, Cosine Similarity và đối sánh kỹ năng chuẩn hóa.**

[![Backend CI](https://github.com/binkadev/student-job-recommendation-system/actions/workflows/backend-ci.yml/badge.svg?branch=master)](https://github.com/binkadev/student-job-recommendation-system/actions/workflows/backend-ci.yml)
[![AI Service CI](https://github.com/binkadev/student-job-recommendation-system/actions/workflows/ai-ci.yml/badge.svg?branch=master)](https://github.com/binkadev/student-job-recommendation-system/actions/workflows/ai-ci.yml)
![Java](https://img.shields.io/badge/Java-21-E76F00?logo=openjdk&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.5.x-6DB33F?logo=springboot&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-Contract%20V2-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![Status](https://img.shields.io/badge/Trạng%20thái-Production--readiness%20in%20progress-orange)

</div>

## 1. Giới thiệu

Dự án xây dựng một hệ thống Web hỗ trợ sinh viên Công nghệ Thông tin tìm kiếm và ứng tuyển việc làm. Hệ thống quản lý người dùng, hồ sơ, kỹ năng, CV, doanh nghiệp, tin tuyển dụng, đơn ứng tuyển và cung cấp danh sách công việc được gợi ý từ nội dung CV.

Giải pháp hiện tại kết hợp:

- nội dung văn bản của CV và tin tuyển dụng;
- tập kỹ năng chuẩn hóa của CV và công việc;
- phát hiện ngôn ngữ tiếng Việt, tiếng Anh, nội dung trộn hoặc không đủ tin cậy;
- TF-IDF và Cosine Similarity cho dữ liệu cùng ngôn ngữ;
- skill matching cho dữ liệu khác ngôn ngữ;
- matched skills, missing skills và lý do gợi ý có tính xác định.

Nhánh tích hợp chính thức là `master`. Các branch cá nhân hoặc branch legacy không được dùng làm nguồn nghiệp vụ.

## 2. Trạng thái hiện tại

| Thành phần | Trạng thái |
|---|---|
| PostgreSQL và Flyway migration | ✅ Đã hoàn thành các migration chính, hiện đến V15 |
| Spring Boot Backend | ✅ Hoàn thành các API và nghiệp vụ chính của MVP |
| AI Service Contract V2 | ✅ Đã tích hợp, hỗ trợ tiếng Việt và tiếng Anh |
| Phân tích PDF/DOCX | ✅ Đã triển khai và kiểm thử |
| Backend + AI + PostgreSQL + JWT integration | ✅ Đã chạy real-stack smoke thành công |
| Backend CI | ✅ Đã hoàn thành |
| AI Service CI | ✅ Đã hoàn thành |
| Docker Compose core stack PostgreSQL + AI Service + Backend | ✅ Đã hoàn thành |
| Automated acceptance smoke qua Backend | ✅ Đã hoàn thành |
| GHCR images | ⚠️ Chưa hoàn thành |
| Production hardening | ⚠️ Chưa hoàn thành |
| Frontend E2E | ⚠️ Chưa có bằng chứng runtime trên `master` |
| Human-labeled ranking quality evaluation | ⚠️ Chưa thực hiện |

> Bộ test hiện tại chứng minh tính đúng đắn của pipeline, contract, công thức, persistence và luồng tích hợp. Bộ test này chưa chứng minh công việc được gợi ý có phù hợp với đánh giá của con người hay không.

## 3. Kiến trúc hệ thống

```text
Client / Frontend
        |
        v
Spring Boot Backend
   |             |
   v             v
PostgreSQL   FastAPI AI Service
```

### Backend chịu trách nhiệm

- xác thực JWT, phân quyền và ownership;
- nghiệp vụ Student, Company, Job, Application, CV, Notification và Recommendation;
- PostgreSQL, Flyway và transaction boundaries;
- lọc eligible jobs;
- gọi AI Service và kiểm tra response;
- sắp xếp theo `score DESC`, sau đó `jobId ASC`;
- tạo `rankPosition` liên tục;
- lưu recommendation run và recommendation result;
- cung cấp public API cho frontend.

### AI Service chịu trách nhiệm

- đọc PDF và DOCX;
- phát hiện ngôn ngữ;
- preprocessing tiếng Việt và tiếng Anh;
- canonical skill extraction và alias mapping;
- tính `textScore`, `skillScore` và `score`;
- trả matched skills, missing skills và reason;
- không truy cập PostgreSQL;
- không nhận JWT của người dùng;
- không trả `rank` hoặc `rankPosition`.

Frontend không được gọi AI Service trực tiếp.

## 4. Contract V2 và thuật toán

Internal endpoints:

```text
POST /internal/v2/cv/parse
POST /internal/v2/recommendations
```

Metadata đóng băng:

```text
algorithm         = tfidf-cosine-hybrid
algorithmVersion  = bilingual-recommendation-v2
processingVersion = bilingual-nlp-v2-skills-v1
```

### Chiến lược scoring

| CV ↔ Job | Strategy | textScore | Final score |
|---|---|---:|---:|
| English ↔ English | `SAME_LANGUAGE_HYBRID` | Có | `0.65 * textScore + 0.35 * skillScore` khi Job có skills |
| Vietnamese ↔ Vietnamese | `SAME_LANGUAGE_HYBRID` | Có | `0.65 * textScore + 0.35 * skillScore` khi Job có skills |
| English ↔ Vietnamese | `CROSS_LANGUAGE_SKILL_BASED` | `null` | `skillScore` |
| Vietnamese ↔ English | `CROSS_LANGUAGE_SKILL_BASED` | `null` | `skillScore` |
| Mixed/low-confidence pair | `CROSS_LANGUAGE_SKILL_BASED` | `null` | `skillScore` |

Khi Job cùng ngôn ngữ không khai báo skills:

```text
score = textScore
skillScore = 0
```

Skill score:

```text
skillScore = số kỹ năng Job xuất hiện trong CV / tổng số kỹ năng canonical của Job
```

AI không tạo rank. Backend là nguồn chính thức của `rankPosition`.

## 5. Quy tắc nghiệp vụ quan trọng

1. Mỗi Student chỉ có tối đa một CV active.
2. CV dùng để tạo recommendation phải ở trạng thái `READY`.
3. Recommendation sử dụng snapshot phân tích đã lưu của chính CV được chọn, không fallback sang `student_skills`.
4. Một Student không thể ứng tuyển cùng một Job hai lần.
5. Public Job phải `ACTIVE`, thuộc Company `VERIFIED` và chưa hết hạn.
6. Company chỉ được quản lý Job và Application thuộc sở hữu của mình.
7. Saved Candidate unique theo `company_id + student_id`; `application_id` chỉ ghi nhận nguồn hồ sơ.
8. CV đang được dữ liệu nghiệp vụ tham chiếu không được xóa.
9. External AI call không được giữ database transaction mở.
10. Backend phải từ chối toàn bộ AI response nếu có bất kỳ result nào vi phạm contract.
11. Không lưu một phần recommendation result khi response AI không hợp lệ.
12. Không sửa migration Flyway đã phát hành; thay đổi schema phải thêm migration mới.

## 6. Luồng CV và recommendation

### Phân tích CV

```text
Upload PDF/DOCX
→ NOT_READY
→ POST reanalyze
→ PROCESSING
→ Backend đọc file gốc
→ AI /internal/v2/cv/parse
→ Backend validate
→ READY hoặc FAILED
```

### Tạo recommendation

```text
Student chọn CV READY
→ Backend lọc eligible jobs
→ Backend gọi AI /internal/v2/recommendations
→ AI chọn strategy theo từng Job
→ Backend validate toàn bộ response
→ Backend sort + tạo rankPosition
→ Backend lưu run/results
→ Client đọc latest successful results
```

## 7. Công nghệ

### Backend

- Java 21
- Spring Boot 3.5.x
- Spring Security và JWT
- Spring Data JPA / Hibernate
- PostgreSQL 17
- Flyway
- Testcontainers
- Maven Wrapper
- Swagger/OpenAPI

### AI Service

- Python 3.11
- FastAPI
- Pydantic V2
- scikit-learn
- underthesea
- pdfplumber
- python-docx
- pytest

## 8. Cấu trúc repository

```text
student-job-recommendation-system/
├── .github/workflows/       # GitHub Actions
├── ai-service/              # FastAPI AI Service
├── backend/                 # Spring Boot Backend
├── docs/                    # Contract, regression và production plan
├── frontend/                # Mock-data UI; chưa có bằng chứng Backend E2E
├── performance/             # Benchmark và evidence
├── scripts/
│   └── smoke-core.ps1       # Automated acceptance smoke qua Backend
├── docker-compose.yml       # Chạy PostgreSQL, AI Service và Backend
├── AGENTS.md                # Source of truth và quy tắc đóng góp
└── README.md
```

## 9. Chạy demo hiện tại

### 9.1 Cách khuyến nghị: Docker core stack và automated smoke

Yêu cầu Docker Desktop hoặc Docker Engine có Docker Compose V2 và Windows PowerShell 5.1/PowerShell 7. Từ thư mục gốc repository, chạy:

```powershell
Copy-Item .env.example .env -Force
docker compose up --build -d
docker compose ps
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\smoke-core.ps1
```

Compose khởi động PostgreSQL, AI Service và Backend. Smoke script chạy luồng thật qua Backend; kết quả thành công kết thúc bằng:

```text
SMOKE RESULT: PASS
```

Các endpoint local chính:

```text
AI health:      http://localhost:8000/health
AI OpenAPI:     http://localhost:8000/docs
Backend Swagger: http://localhost:8080/swagger-ui.html
```

### 9.2 Tùy chọn phát triển: chạy Java/Python thủ công

Cách này dành cho phát triển từng service và yêu cầu Java 21, Python 3.11 cùng PostgreSQL. Trước tiên khởi động database:

```powershell
docker compose up -d postgres
```

Trong một terminal, khởi động AI Service:

```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install --require-hashes -r requirements.lock
python -m pip check
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Trong terminal khác, khởi động Backend:

```powershell
cd backend
$env:SPRING_DATASOURCE_PASSWORD="change-this-local-postgres-password"
$env:APP_AI_SERVICE_BASE_URL="http://localhost:8000"
.\mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=dev
```

Giá trị `SPRING_DATASOURCE_PASSWORD` phải khớp `POSTGRES_PASSWORD` trong `.env`; nếu đã tùy chỉnh database name hoặc username thì đặt các biến `SPRING_DATASOURCE_*` tương ứng.

### Tài khoản demo

Mật khẩu local development: `123456`

```text
admin@example.com
student@example.com
company@example.com
```

Các tài khoản và giá trị trong `.env.example` chỉ phục vụ môi trường phát triển/demo, không được dùng cho production.

## 10. Kiểm thử

### Backend

Backend CI hiện có tại [`.github/workflows/backend-ci.yml`](.github/workflows/backend-ci.yml) và chạy Java 21 cùng toàn bộ Maven `clean verify`.

```powershell
cd backend
.\mvnw.cmd -B -ntp test
.\mvnw.cmd -B -ntp clean verify
```

`clean verify` sử dụng Testcontainers, PostgreSQL 17, Flyway và Hibernate mapping checks.

### AI Service

AI Service CI hiện có tại [`.github/workflows/ai-ci.yml`](.github/workflows/ai-ci.yml). Workflow dùng Python 3.11.9, cài `requirements.lock` với `--require-hashes`, chạy `pip check` và chạy toàn bộ test bằng `python -m pytest`.

```powershell
cd ai-service
.\.venv\Scripts\Activate.ps1
python -m pip check
python -m pytest
```

Kết quả gần nhất được ghi nhận:

```text
424 passed
0 failed
0 skipped
1 Starlette/httpx deprecation warning
```

Bộ test AI bao phủ:

- strict V2 schemas;
- PDF/DOCX decoding;
- preprocessing tiếng Việt và tiếng Anh;
- canonical skill aliases;
- same-language hybrid scoring;
- cross-language skill-only scoring;
- corpus isolation;
- deterministic ordering và reason;
- exact response keys;
- V1 compatibility;
- sanitized HTTP errors.

### Docker acceptance smoke

Automated smoke tại [`scripts/smoke-core.ps1`](scripts/smoke-core.ps1) đã chứng minh luồng tích hợp thật đi qua Backend:

- upload CV DOCX tiếng Việt thật;
- reanalysis đạt `READY` với `languageCode = vi`;
- recommendation run đạt `SUCCESS`;
- có cả `SAME_LANGUAGE_HYBRID` và `CROSS_LANGUAGE_SKILL_BASED`;
- `rankPosition` liên tục và thứ tự kết quả đúng;
- latest results đã persist khớp với run vừa tạo.

Đây là bằng chứng về correctness, contract và persistence của core stack; không phải bằng chứng ranking quality theo đánh giá của con người.

### Phạm vi kiểm thử cần phân biệt

**Functional testing:** API, parsing, language detection, formula, threshold, sorting và persistence.

**Contract testing:** exact DTO, score range, strategy semantics, no AI rank fields và invalid-response rejection.

**Integration testing:** FastAPI, Spring Boot, PostgreSQL, Flyway, JWT và recommendation persistence.

**Ranking-quality evaluation:** cần dữ liệu do con người gán nhãn và các metric như Precision@5, Recall@5, NDCG@5. Phần này chưa được thực hiện.

## 11. Hạn chế hiện tại

- chưa publish Backend/AI images lên GHCR;
- chưa hoàn thành production profile và security hardening, gồm environment validation, CORS, Swagger, internal Backend–AI authentication và production log hardening;
- chưa hoàn chỉnh observability, monitoring/alerting và quy trình backup/restore;
- chưa có frontend E2E với Backend và AI được chứng minh bằng runtime trên `master`;
- chưa có tập dữ liệu người gán nhãn để đánh giá ranking quality;
- hệ thống vì vậy chưa được xem là production-ready.

## 12. Hướng phát triển production

Đã hoàn thành:

1. ✅ chuẩn hóa repository truth và tài liệu nguồn;
2. ✅ Docker core stack PostgreSQL + AI Service + Backend — PR #20;
3. ✅ automated acceptance smoke qua Backend — PR #21;
4. ✅ AI Service CI — PR #22.

Bước kế tiếp:

5. ⏭️ publish Backend và AI images lên GHCR bằng tag commit SHA.

Sau đó mới thực hiện:

6. production profile và security hardening;
7. observability, monitoring và alerting;
8. backup/restore procedure, restore drill và rollback runbook;
9. human-labeled ranking evaluation với Precision@5, Recall@5 và NDCG@5;
10. tích hợp frontend với Backend và chạy full E2E.

Chi tiết xem:

- [`docs/production-readiness-plan.md`](docs/production-readiness-plan.md)
- [`docs/production-readiness-checklist.md`](docs/production-readiness-checklist.md)

## 13. Tài liệu kỹ thuật

- [`AGENTS.md`](AGENTS.md)
- [`backend/README.md`](backend/README.md)
- [`ai-service/README.md`](ai-service/README.md)
- [`docs/api-contract.md`](docs/api-contract.md)
- [`docs/postman-regression.md`](docs/postman-regression.md)
- [`performance/README.md`](performance/README.md)

## 14. Đóng góp và duy trì

Repository hiện được duy trì tại GitHub `@binkadev`. Thông tin thành viên, phân công và đóng góp học thuật cần được ghi nhận trong báo cáo đồ án hoặc tài liệu nhóm chính thức; README không thay thế danh sách tác giả của đồ án.

Quy ước đóng góp:

1. cập nhật `master` trước khi tạo branch mới;
2. dùng branch `feat/`, `fix/`, `docs/`, `test/`, `perf/` hoặc `chore/`;
3. không sửa migration đã phát hành;
4. không thay đổi contract hoặc nghiệp vụ ngoài phạm vi PR;
5. không commit secret, `.env`, upload runtime, build output hoặc IDE config;
6. chạy test phù hợp trước khi mở PR;
7. chỉ merge sau khi review và CI đạt yêu cầu.

---

**Trạng thái:** phần lõi Backend + AI đã có Docker handoff, automated acceptance smoke và CI cho cả hai service. Repository vẫn đang trong giai đoạn production-readiness và chưa nên được gọi là production-ready cho đến khi hoàn thành GHCR publishing, security hardening, observability, backup/restore, human-labeled ranking evaluation và frontend end-to-end.
