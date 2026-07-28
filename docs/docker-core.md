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

Sau khi ba service đã healthy, chạy từ thư mục gốc repository:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-core.ps1
```

Với PowerShell 7:

```powershell
pwsh -File .\scripts\smoke-core.ps1
```

Script thực hiện luồng thật qua Spring Boot Backend:

1. chờ AI Service và Backend sẵn sàng;
2. đăng nhập tài khoản Student và Company được tạo bởi `DataSeeder`;
3. tìm hoặc tạo một Job tiếng Việt qua Company API;
4. upload fixture `vietnamese_cv.docx` qua Backend;
5. gọi reanalysis và xác nhận CV đạt `READY`, `languageCode=vi`;
6. tạo recommendation run;
7. xác nhận cả `SAME_LANGUAGE_HYBRID` và `CROSS_LANGUAGE_SKILL_BASED`;
8. xác nhận cross-language có `textScore=null` và `score=skillScore`;
9. xác nhận Backend tạo `rankPosition` liên tục, sắp xếp đúng và không trùng Job;
10. đối chiếu latest persisted results với run vừa tạo.

Kết quả thành công kết thúc bằng:

```text
SMOKE RESULT: PASS
```

Script không in password, JWT, raw CV text hoặc đường dẫn lưu file nội bộ.

### Cấu hình smoke test

Mặc định script dùng tài khoản local-dev trong `DataSeeder`:

```text
student@example.com
company@example.com
```

Có thể override bằng biến môi trường:

```powershell
$env:SMOKE_STUDENT_EMAIL = "student@example.com"
$env:SMOKE_COMPANY_EMAIL = "company@example.com"
$env:SMOKE_DEMO_PASSWORD = "123456"
```

Có thể đổi URL, fixture, timeout, threshold và limit:

```powershell
.\scripts\smoke-core.ps1 `
  -BackendBaseUrl "http://localhost:8080" `
  -AiBaseUrl "http://localhost:8000" `
  -CvPath ".\ai-service\tests\fixtures\vietnamese_cv.docx" `
  -TimeoutSeconds 120 `
  -Threshold 0.0 `
  -Limit 100
```

Các tài khoản và mật khẩu mặc định chỉ dành cho profile `dev`. Không chạy script này với production credentials hoặc production database.

Mỗi lần chạy sẽ tạo một CV và recommendation run mới. Job tiếng Việt dùng tên cố định nên được tái sử dụng khi vẫn `ACTIVE` và chưa hết hạn. Để reset hoàn toàn dữ liệu local:

```powershell
docker compose down -v --remove-orphans
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
- `/internal/v2/recommendations`;
- `tfidf-cosine-hybrid`;
- `bilingual-recommendation-v2`;
- `bilingual-nlp-v2-skills-v1`;
- công thức scoring;
- quyền sở hữu `rankPosition` của Backend;
- Flyway migration hiện có.

## Acceptance trước khi merge

Branch smoke test chỉ được merge khi đã xác nhận:

1. script parse thành công trên Windows PowerShell 5.1 hoặc PowerShell 7;
2. core stack khởi động healthy từ clean volumes;
3. script kết thúc bằng `SMOKE RESULT: PASS`;
4. CV thật được upload qua Backend và đạt `READY`;
5. recommendation run đạt `SUCCESS`;
6. cùng ngôn ngữ và khác ngôn ngữ dùng đúng strategy;
7. `rankPosition` liên tục và thứ tự đúng;
8. script không in secrets hoặc raw CV text;
9. chạy lại không tạo Job tiếng Việt trùng khi Job cũ còn hợp lệ;
10. `git status` vẫn sạch sau khi chạy.
