# Production-Readiness Checklist

## Documentation gate

- [x] README mô tả đúng trạng thái `master`.
- [x] Backend + AI real-stack integration được ghi là đã kiểm thử.
- [x] Frontend end-to-end được ghi là chưa có bằng chứng runtime trên `master`.
- [x] Functional/contract/integration testing được tách khỏi ranking-quality evaluation.
- [x] Không có tuyên bố Precision@K, Recall@K hoặc NDCG@K khi chưa có dữ liệu người gán nhãn.
- [x] Không có tuyên bố một tác giả duy nhất nếu phạm vi đóng góp chưa được nhóm xác nhận.

## Docker gate

- [x] Backend và AI Service có Dockerfile; Docker Compose reproducible chạy PostgreSQL, AI Service và Backend.
- [x] `docker compose up --build -d` chạy được từ working tree sạch với fresh volumes.
- [x] Có healthcheck và named volumes.
- [x] Không có secret trong image hoặc repository.
- [ ] Clean clone riêng biệt đã được xác nhận trên môi trường khác hoặc CI.

## Acceptance gate

- [x] Upload CV tiếng Việt qua Backend.
- [x] Reanalysis chuyển `READY`, `languageCode = vi`.
- [x] Recommendation run `SUCCESS`.
- [x] Có cả same-language và cross-language strategy.
- [x] Backend trả `rankPosition` liên tục.

## CI/CD gate

- [x] Backend CI pass.
- [x] AI CI pass.
- [ ] Backend và AI image được publish lên GHCR với tag SHA.
- [ ] Có release tag và rollback instructions.

## Production hardening gate

- [ ] Production profile không chạy demo seeder.
- [ ] CORS cấu hình qua environment.
- [ ] Swagger production được tắt hoặc bảo vệ.
- [ ] Có internal authentication Backend–AI.
- [ ] Production logs không chứa password, JWT, raw CV hoặc internal file path.
- [ ] Có backup và restore runbook.

## Quality-evaluation gate

- [ ] Có dataset được con người gán nhãn.
- [ ] Có Precision@5, Recall@5 và NDCG@5.
- [ ] Có so sánh text-only, skill-only và production hybrid.
- [ ] Không dùng chính thuật toán để tạo ground truth.
