# Production-Readiness Checklist

## Documentation gate

- [ ] README mô tả đúng trạng thái `master`.
- [ ] Backend + AI real-stack integration được ghi là đã kiểm thử.
- [ ] Frontend end-to-end được ghi là chưa có bằng chứng runtime trên `master`.
- [ ] Functional/contract/integration testing được tách khỏi ranking-quality evaluation.
- [ ] Không có tuyên bố Precision@K, Recall@K hoặc NDCG@K khi chưa có dữ liệu người gán nhãn.
- [ ] Không có tuyên bố một tác giả duy nhất nếu phạm vi đóng góp chưa được nhóm xác nhận.

## Docker gate

- [ ] PostgreSQL, AI Service và Backend có Dockerfile/Compose reproducible.
- [ ] `docker compose up --build -d` chạy được từ clean clone.
- [ ] Có healthcheck và named volumes.
- [ ] Không có secret trong image hoặc repository.

## Acceptance gate

- [ ] Upload CV tiếng Việt qua Backend.
- [ ] Reanalysis chuyển `READY`, `languageCode = vi`.
- [ ] Recommendation run `SUCCESS`.
- [ ] Có cả same-language và cross-language strategy.
- [ ] Backend trả `rankPosition` liên tục.

## CI/CD gate

- [ ] Backend CI pass.
- [ ] AI CI pass.
- [ ] Backend và AI image được publish lên GHCR với tag SHA.
- [ ] Có release tag và rollback instructions.

## Production hardening gate

- [ ] Production profile không chạy demo seeder.
- [ ] CORS cấu hình qua environment.
- [ ] Swagger production được tắt hoặc bảo vệ.
- [ ] Có internal authentication Backend–AI.
- [ ] Logs không chứa password, JWT, raw CV hoặc internal file path.
- [ ] Có backup và restore runbook.

## Quality-evaluation gate

- [ ] Có dataset được con người gán nhãn.
- [ ] Có Precision@5, Recall@5 và NDCG@5.
- [ ] Có so sánh text-only, skill-only và production hybrid.
- [ ] Không dùng chính thuật toán để tạo ground truth.
