# Docker Core Stack

Tài liệu này mô tả cách chạy PostgreSQL, FastAPI AI Service và Spring Boot Backend bằng Docker Compose.

## Phạm vi

Compose này phục vụ local development và handoff cho thành viên trong nhóm. Nó chưa phải cấu hình production cuối cùng.

Kiến trúc giữ nguyên:

```text
Client -> Spring Boot Backend -> FastAPI AI Service
                         |
                         v
                    PostgreSQL
```

Frontend không gọi AI Service trực tiếp.

## Chuẩn bị

Yêu cầu:

- Docker Desktop hoặc Docker Engine;
- Docker Compose V2;
- Windows PowerShell 5.1 hoặc PowerShell 7;
- các port 5432, 8000 và 8080 chưa bị chiếm, hoặc chỉnh trong `.env`.

Từ thư mục gốc repository:

```powershell
Copy-Item .env.example .env
```

Các giá trị trong `.env.example` chỉ dành cho local development. Không dùng chúng trên staging hoặc production.

## Build và khởi động

```powershell
docker compose up --build -d
```

Kiểm tra trạng thái:

```powershell
docker compose ps
```

Kiểm tra AI:

```text
http://localhost:8000/health
http://localhost:8000/docs
```

Kiểm tra Backend:

```text
http://localhost:8080/swagger-ui.html
http://localhost:8080/api/public/statistics
```

Backend chạy với profile `dev`, vì vậy local demo seeder được bật. Flyway tự áp dụng migration khi Backend khởi động.

## Chạy smoke test một lệnh

Chạy từ thư mục gốc repository sau khi chuẩn bị `.env`. `smoke-core.ps1` chuyển tiếp sang `run-recommendation-real-e2e.ps1`; runner tự build, khởi động và chờ stack E2E healthy, không cần khởi động stack dev trước:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-core.ps1
```

Với PowerShell 7:

```powershell
pwsh -File .\scripts\smoke-core.ps1
```

Script dùng project Compose riêng `recommendation-real-e2e`, với `docker-compose.yml` và `docker-compose.e2e.yml`, profile Backend `e2e` và các port `15432`, `18000`, `18080`. Luồng kiểm tra:

1. reset volumes của project E2E, build và chờ stack healthy (`--wait-timeout 180`);
2. đăng ký Student và Company qua public API, sau đó đăng nhập Student;
3. seed trực tiếp vào PostgreSQL một CV có persisted analysis snapshot `READY`, tiếng Anh, và hai Job tiếng Anh/Việt cùng canonical skills;
4. tạo recommendation run qua Student API với `threshold=0`, `limit=10`;
5. xác nhận metadata V3 và hai tier PRIMARY/FALLBACK;
6. xác nhận PRIMARY có `rankingScore=overallScore`, FALLBACK có `textScore=null`, `overallScore=null`, `rankingScore=skillScore=1`;
7. xác nhận PRIMARY đứng trước FALLBACK, global/tier ranks do Backend gán và `score` alias `rankingScore`;
8. đối chiếu FALLBACK đã persist, không còn run `PROCESSING`, đúng một AI call V3 và không có recommendation call V2.

Smoke này kiểm tra recommendation từ snapshot đã lưu; không upload hoặc parse/reanalyze CV thật.

Thành công trả exit code `0` và in marker:

```text
Real Student Recommendation V3 E2E passed.
```

Script không in password, JWT, raw CV text hoặc đường dẫn lưu file nội bộ.

### Cấu hình smoke test

Wrapper và runner chỉ nhận switch `-KeepE2EStack`, dùng để giữ stack sau khi chạy để debug:

```powershell
.\scripts\smoke-core.ps1 -KeepE2EStack
```

URL, fixture, timeout, threshold, limit và tài khoản test được cố định trong runner; các biến `SMOKE_*` và tham số của smoke cũ không còn được hỗ trợ. Không chạy với production credentials hoặc production database. `.env` phải dùng database/user mặc định `student_job_recommendation`/`postgres` như runner.

Mỗi lần chạy reset dữ liệu E2E trước khi seed fixture. Mặc định runner xóa containers và volumes của project E2E trong `finally`; khi giữ stack để debug, dọn bằng:

```powershell
docker compose -p recommendation-real-e2e -f docker-compose.yml -f docker-compose.e2e.yml down -v --remove-orphans
```

## Xem log

```powershell
docker compose logs -f postgres
docker compose logs -f ai-service
docker compose logs -f backend
```

Xem log tất cả service:

```powershell
docker compose logs -f
```

## Dữ liệu được lưu ở đâu

Compose sử dụng hai named volume:

```text
postgres_data
cv_uploads
```

- `postgres_data` lưu PostgreSQL data;
- `cv_uploads` lưu file CV do Backend quản lý.

Không mount upload directory từ source tree và không bake CV vào container image.

## Dừng hệ thống

Giữ lại database và CV:

```powershell
docker compose down
```

Xóa toàn bộ database và CV local:

```powershell
docker compose down -v
```

`down -v` là thao tác phá hủy dữ liệu local.

## Rebuild sau khi sửa code

```powershell
docker compose build --no-cache ai-service backend
docker compose up -d
```

## Các biến môi trường chính

```text
POSTGRES_DB
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_PORT
BACKEND_PORT
AI_PORT
APP_JWT_SECRET
APP_JWT_EXPIRATION_MS
APP_CV_MAX_FILE_SIZE_BYTES
AI_CV_MAX_FILE_SIZE_BYTES
APP_AI_SERVICE_CONNECT_TIMEOUT
APP_AI_SERVICE_READ_TIMEOUT
JAVA_OPTS
```

Backend trong Compose luôn gọi AI qua internal hostname:

```text
http://ai-service:8000
```

Backend gọi PostgreSQL qua:

```text
jdbc:postgresql://postgres:5432/<database>
```

## Contract không thay đổi

Docker hóa và smoke test không thay đổi:

- `/internal/v2/cv/parse`;
- `/internal/v3/recommendations` (smoke kiểm tra V3; V2 vẫn là compatibility path);
- `tfidf-cosine-hybrid`;
- `bilingual-recommendation-v3`;
- `bilingual-nlp-v2-skills-v1`;
- công thức scoring;
- quyền sở hữu `rankPosition` của Backend;
- Flyway migration hiện có.

## Acceptance trước khi merge

Branch smoke test chỉ được merge khi đã xác nhận:

1. script parse thành công trên Windows PowerShell 5.1 hoặc PowerShell 7;
2. core stack khởi động healthy từ clean volumes;
3. script trả exit code `0` và in `Real Student Recommendation V3 E2E passed.`;
4. fixture CV được seed với persisted analysis snapshot `READY`;
5. recommendation run đạt `SUCCESS`;
6. cùng ngôn ngữ và khác ngôn ngữ dùng đúng strategy;
7. `rankPosition` liên tục và thứ tự đúng;
8. script không in secrets hoặc raw CV text;
9. stack E2E được dọn sau khi chạy, trừ khi dùng `-KeepE2EStack`;
10. `git status` vẫn sạch sau khi chạy.
