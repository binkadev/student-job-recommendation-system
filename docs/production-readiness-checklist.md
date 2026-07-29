# Production-Readiness Checklist

Checklist phản ánh `master` sau PR #37. `[x]` chỉ có nghĩa hạng mục được nêu đã
có implementation/evidence tương ứng; không suy rộng sang production-ready.

## Architecture and Contract Gate

- [x] Frontend chỉ gọi Spring Boot Backend.
- [x] Backend sở hữu JWT, authorization, business rules, eligible-job filtering,
  AI validation, sorting, `rankPosition` và persistence.
- [x] AI Service stateless, không truy cập DB, không nhận user JWT và không trả
  rank.
- [x] Contract V2 metadata và scoring 65/35 được ghi đúng.
- [x] Backend sort `score DESC`, rồi `jobId ASC`.

## CI and Core Stack Gate

- [x] Backend CI được triển khai.
- [x] AI Service CI được triển khai.
- [x] Frontend Node 24 lint/build CI được triển khai — PR #28.
- [x] Docker core stack PostgreSQL + Backend + AI Service — PR #20.
- [x] Automated acceptance smoke — PR #21, CI PR #29.
- [x] Latest recorded smoke: `PASS`, CV `vi`, 11 Job scanned, 11 results
  persisted, ranks 1..11 và cả hai strategy.

## Container and Release Gate

- [x] GHCR build/publish workflow được triển khai — PR #23.
- [x] Container tag/pull/rollback runbook tồn tại.
- [ ] GHCR package visibility và quyền pull đã được kiểm chứng cho target
  environment.
- [ ] Image theo commit SHA đã được pull và chạy trong release verification.
- [ ] Release tag đầy đủ đã được kiểm chứng với image digest.
- [ ] Rollback drill đầy đủ đã được chạy và lưu evidence.

`v1.0.0-demo` là tag demo hiện có; nó không tự hoàn thành các mục verification
ở trên.

## Security and Observability Gate

- [x] Hardened production profile được triển khai — PR #30.
- [x] Production datasource password fail-fast — PR #26.
- [x] Backend → AI `/internal/v2/**` dùng `X-Internal-Api-Key` — PR #32.
- [x] `X-Request-Id` được propagate Backend → AI — PR #36.
- [x] Request-completion logging được giới hạn vào safe metadata.
- [x] Password, JWT, raw CV text và storage path không xuất hiện trong latest
  recorded smoke output.
- [ ] Production log retention/redaction review có evidence.
- [ ] Monitoring dashboard cho health, latency và failures hoàn chỉnh.
- [ ] Alerting có threshold, owner và escalation path.
- [ ] Backup/restore monitoring và incident drill hoàn chỉnh.

## Frontend and Manual E2E Gate

- [x] Frontend API integration và handoff đã merge — PR #25.
- [x] Candidate CV/recommendation runtime-state fixes đã merge — PR #37.
- [ ] Full Student browser flow đã chạy trên clean `master`.
- [ ] Full Company browser flow đã chạy trên clean `master`.
- [ ] Full Admin browser flow đã chạy trên clean `master`.
- [ ] Wrong-role và cross-owner denial cases có evidence.
- [ ] Company → Admin → Student → recommendation → apply flow có evidence.

Theo dõi từng case tại [E2E demo checklist](testing/e2e-demo-checklist.md).

## Ranking-Quality Evaluation Gate

- [x] Offline evaluation framework được triển khai — PR #34.
- [x] Independent annotation/adjudication workflow được triển khai — PR #35.
- [ ] Real `jobs.json` đã được review và freeze.
- [ ] Private CV input đã được phép sử dụng và ẩn danh.
- [ ] Có annotation độc lập từ 2–3 người.
- [ ] Manual adjudication đã hoàn thành.
- [ ] Ground truth đã freeze.
- [ ] Precision@5, Recall@5 và NDCG@5 thật đã được tính.
- [ ] Báo cáo phân biệt production hybrid với baseline/toy example.

Framework hoàn thành không đồng nghĩa ranking-quality evaluation hoàn thành.

## Production Declaration Gate

- [ ] Mọi mục bắt buộc phía trên có evidence và owner xác nhận.
- [ ] Known limitations, rollback và incident procedure đã được review.
- [ ] Nhóm phê duyệt tuyên bố production-ready.

Cho đến khi gate này hoàn thành, hệ thống vẫn ở trạng thái
production-readiness in progress.
