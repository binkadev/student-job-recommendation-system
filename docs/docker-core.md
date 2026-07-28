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

Docker hóa không thay đổi:

- `/internal/v2/cv/parse`;
- `/internal/v2/recommendations`;
- `tfidf-cosine-hybrid`;
- `bilingual-recommendation-v2`;
- `bilingual-nlp-v2-skills-v1`;
- công thức scoring;
- quyền sở hữu `rankPosition` của Backend;
- Flyway migration hiện có.

## Acceptance trước khi merge

Branch Docker chỉ được merge khi đã xác nhận:

1. `docker compose config` hợp lệ;
2. hai image build thành công;
3. ba service khởi động và healthy;
4. Flyway áp dụng đầy đủ migration;
5. Swagger và AI health truy cập được;
6. upload một CV thật qua Backend;
7. CV chuyển sang `READY`;
8. recommendation run chuyển sang `SUCCESS`;
9. Backend trả `rankPosition` liên tục;
10. `docker compose down -v` dọn sạch môi trường test.

Sau khi core stack được xác nhận, bước tiếp theo là bổ sung `scripts/smoke-core.ps1` để tự động hóa acceptance flow qua Backend.
