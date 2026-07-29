# Production-Readiness Plan

## Mục tiêu

Đưa hệ thống từ demo kỹ thuật có thể tái lập đến production-grade MVP có thể
vận hành và rollback an toàn. Kế hoạch này phản ánh `master` sau PR #37 và
không coi việc có code/workflow là bằng chứng một release production đã được
kiểm chứng.

Hệ thống hiện **chưa production-ready**.

## Guardrails đóng băng

```text
Frontend -> Spring Boot Backend -> FastAPI AI Service
                              -> PostgreSQL
```

- Frontend không gọi AI Service trực tiếp.
- Backend sở hữu JWT, authorization, business rules, eligible-job filtering, AI
  response validation, sorting `score DESC` rồi `jobId ASC`, `rankPosition` và
  persistence.
- AI Service stateless, không truy cập DB, không nhận user JWT và không trả
  rank.

Contract V2:

```text
POST /internal/v2/cv/parse
POST /internal/v2/recommendations
algorithm         = tfidf-cosine-hybrid
algorithmVersion  = bilingual-recommendation-v2
processingVersion = bilingual-nlp-v2-skills-v1
```

Scoring:

- same language + Job có skills:
  `score = 0.65 * textScore + 0.35 * skillScore`;
- same language + Job không có skills: `score = textScore`;
- cross-language, mixed hoặc unknown: `textScore = null`,
  `score = skillScore`.

## Trạng thái triển khai trên `master`

| Hạng mục | Trạng thái | Evidence trong repository |
|---|---|---|
| Backend core/API MVP, PostgreSQL/Flyway V15 | Hoàn thành | Backend source, migrations và automated tests |
| Contract V2 song ngữ, PDF/DOCX | Hoàn thành | AI implementation và test suites |
| Docker core stack | Hoàn thành | PR #20, `docker-compose.yml`, Dockerfiles |
| Automated Backend-to-AI smoke | Hoàn thành | PR #21; CI automation PR #29; seed wait fix PR #31 |
| AI CI | Hoàn thành | PR #22 |
| GHCR build/publish workflow và runbook | Đã triển khai | PR #23, `container-images.yml`, `container-images.md` |
| Frontend CI | Hoàn thành | PR #28 |
| Production profile hardening | Hoàn thành phạm vi cấu hình | PR #30; datasource hardening PR #26 |
| Internal V2 API-key authentication | Hoàn thành | PR #32 |
| Offline ranking evaluation framework | Hoàn thành framework | PR #34 |
| Human annotation workflow | Hoàn thành workflow | PR #35 |
| Backend → AI request tracing/safe logging | Hoàn thành | PR #36 |
| Frontend candidate runtime-state fixes | Đã merge | PR #37 |

`v1.0.0-demo` tồn tại trong Git history, nhưng tag demo không tự chứng minh
quy trình release, image pull và rollback drill đầy đủ.

## Acceptance evidence mới nhất

Automated core smoke được ghi nhận:

```text
SMOKE RESULT: PASS
CV language: vi
Eligible jobs scanned: 11
Persisted results: 11
Rank sequence: 1..11
Strategies: SAME_LANGUAGE_HYBRID, CROSS_LANGUAGE_SKILL_BASED
```

Smoke còn xác nhận `requestId` được propagate giữa Backend và AI. Output không
in password, JWT, raw CV text hoặc storage path.

Evidence này chứng minh core functional/contract/integration behavior. Nó không
thay thế manual browser E2E hoặc human-labeled ranking-quality evaluation.

## Các workstream còn lại

### 1. Manual E2E và demo evidence

Chạy trên clean `master` stack và lưu evidence cho:

1. Company tạo/cập nhật Job và xem Application thuộc sở hữu.
2. Admin duyệt Company/Job và kiểm tra role boundaries.
3. Student upload CV, reanalyze đến `READY`, generate recommendation và apply.
4. Unauthorized, wrong-role và cross-owner requests.
5. Luồng xuyên suốt Company → Admin → Student → Backend → AI → persistence.

Không đánh PASS trước khi chạy. Dùng
[E2E demo checklist](testing/e2e-demo-checklist.md).

### 2. Ranking-quality evaluation

Framework và annotation workflow đã có; còn phải:

1. review và freeze Job corpus `jobs.json`;
2. chuẩn bị CV corpus đã ẩn danh và được phép sử dụng;
3. phân công 2–3 annotator độc lập;
4. chạy manual adjudication cho các bất đồng;
5. freeze ground truth;
6. chạy Precision@5, Recall@5 và NDCG@5;
7. báo cáo production hybrid 65/35 và các baseline được định nghĩa trong
   framework.

Không dùng output thuật toán để tạo ground truth và không công bố metric từ toy
dataset như kết quả sản phẩm.

### 3. GHCR release và rollback verification

Workflow build/publish và runbook đã được triển khai. Còn phải tạo evidence cho:

1. package visibility và quyền pull đúng môi trường;
2. image theo full commit SHA được pull và khởi động thành công;
3. release tag được ánh xạ đúng image digest;
4. rollback về SHA/tag trước đó;
5. dữ liệu PostgreSQL và CV volume vẫn an toàn sau drill;
6. thời gian, người thực hiện và kết quả drill được ghi nhận.

Không phụ thuộc duy nhất vào tag `latest`.

### 4. Monitoring và alerting

`X-Request-Id` propagation và safe request-completion logging đã hoàn thành.
Các phần còn thiếu:

- dashboard cho health/readiness, latency, error rate và AI failures;
- cảnh báo có owner, threshold và escalation path;
- log retention/redaction review;
- production backup/restore monitoring;
- drill xử lý incident và xác nhận correlation bằng `requestId`.

Request tracing là nền tảng observability, không đồng nghĩa monitoring/alerting
đã hoàn chỉnh.

## Definition of Done cho production MVP

- Clean release có thể deploy bằng image version bất biến.
- Database migrations chạy an toàn và service health/readiness đạt yêu cầu.
- Full manual E2E Student/Company/Admin và authorization có evidence.
- Contract V2, scoring và Backend-owned ranking không đổi.
- Secrets không nằm trong repository, image hoặc logs.
- Internal API key và request tracing hoạt động trong môi trường release.
- Image pull/release/rollback drill đã được thực thi và ghi nhận.
- Backup/restore procedure đã được kiểm chứng.
- Monitoring/alerting có owner và response procedure.
- Human-labeled dataset đã freeze và metric thật được báo cáo trung thực.
