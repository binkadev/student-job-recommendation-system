# Documentation Map

Tài liệu trong repository mô tả trạng thái hiện hành của `master`. Contract V2,
scoring và ownership boundary chỉ thay đổi qua một quyết định kiến trúc được
review; checklist hoặc runbook không phải bằng chứng một bước production đã
được thực thi.

## Architecture and Contract

- [Repository source of truth](../AGENTS.md) — kiến trúc, ownership và quy tắc
  đóng góp.
- [API contract](api-contract.md) — public Backend APIs, internal Contract V2,
  errors và transport headers.
- [Database schema](database-schema.md) — mô hình persistence hiện hành.
- [Database ERD](database-erd.dbml) — sơ đồ DBML.

## Local Development

- [Root README](../README.md) — tổng quan, quick start và trạng thái dự án.
- [Backend README](../backend/README.md) — chạy Spring Boot, cấu hình và business
  behavior.
- [AI Service README](../ai-service/README.md) — chạy FastAPI, Contract V2 và
  pipeline song ngữ.
- [Frontend README](../frontend/README.md) — Node setup, lint/build/dev và
  runtime states.

## Docker and GHCR

- [Docker core stack](docker-core.md) — PostgreSQL, Backend và AI Service chạy
  bằng Compose.
- [Container images and GHCR runbook](container-images.md) — workflow build/
  publish, tag policy, pull và rollback procedure.

Workflow và runbook đã được triển khai. Việc package/release cụ thể đã được
publish, pull hoặc rollback chỉ được đánh dấu hoàn thành khi có evidence tương
ứng.

## Security and Observability

- [Request tracing](operations/request-tracing.md) — `X-Request-Id`, correlation
  Backend → AI và safe logging.
- [API common transport headers](api-contract.md#common-transport-headers) —
  Bearer JWT, internal API key và tracing metadata.

Internal `X-Internal-Api-Key` authentication và request tracing đã được triển
khai. Production monitoring và alerting hoàn chỉnh vẫn còn pending.

## Testing and Performance

- [Postman regression](postman-regression.md) — API regression setup.
- [E2E demo checklist](testing/e2e-demo-checklist.md) — evidence table cho
  Student, Company, Admin, authorization và recommendation flow.
- [Performance guide](../performance/README.md) — benchmark procedure.
- [Backend performance baseline](backend-performance-baseline.md) — baseline và
  phạm vi evidence.
- [Performance result format](../performance/results/README.md) — cấu trúc lưu
  kết quả.

## Evaluation

- [Offline ranking evaluation](../ai-service/evaluation/README.md) — dataset
  schema, runner, annotation workflow, adjudication và metrics.

Framework và human annotation workflow đã có. Dataset thật chưa được freeze,
annotation độc lập và adjudication chưa hoàn tất, vì vậy chưa có Precision@5,
Recall@5 hoặc NDCG@5 chính thức.

## Demo and Production Readiness

- [Demo script](demo-script.md) — khung demo 7–10 phút, không dùng metric giả.
- [Production-readiness plan](production-readiness-plan.md) — trạng thái và lộ
  trình còn lại.
- [Production-readiness checklist](production-readiness-checklist.md) — các gate
  tách biệt giữa implementation và runtime verification.
