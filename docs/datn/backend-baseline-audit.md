# ĐATN Backend Baseline & Gap Audit

## 1. Baseline

| Item | Execution evidence của audit |
|---|---|
| Repository | `https://github.com/binkadev/student-job-recommendation-system` |
| Branch | `master` |
| Commit | `e1335d5e0177b35647dd12e841df9b693be71682` |
| Đồng bộ | `git switch master`: Already on master; `git pull --ff-only origin master`: Already up to date |
| Working tree trước audit | `git status --short`: rỗng; đủ điều kiện tiếp tục |
| Command tự chạy | `cd backend` → `.\mvnw.cmd -B -ntp clean verify`; sau đó các lệnh audit chạy ở repository root |
| Build | **BUILD SUCCESS**, exit `0`; Maven total time `02:20 min` |
| Execution date | **2026-10-13**, kết thúc `2026-10-13T14:17:42+07:00` (Asia/Bangkok) |
| Surefire | 40 report suites; tests `246`, failures `0`, errors `0`, skipped `0` |
| Failsafe | 31 report suites; tests `210`, failures `0`, errors `0`, skipped `0` |
| Tổng | **456 tests; 0 failures; 0 errors; 0 skipped** |

Tổng được đối chiếu từ Maven output và tổng attributes trong `backend/target/surefire-reports/TEST-*.xml`, `backend/target/failsafe-reports/TEST-*.xml`; `failsafe-summary.xml` ghi completed `210`, errors/failures/skipped/flakes đều `0`. Reports là build artifacts bị Git ignore, không được thêm vào thay đổi tài liệu. [DatabaseMigrationIT](../../backend/src/test/java/com/tttn/jobrecommendation/integration/DatabaseMigrationIT.java) đã chạy, kiểm tra PostgreSQL 17, Flyway đủ 18 migrations SUCCESS, không pending, Hibernate schema validation. [Integration config](../../backend/src/test/resources/application-integration.yml) dùng `ddl-auto: validate`.

Không chạy AI pytest, offline evaluation, Compose smoke hoặc real API/browser E2E trong audit này. Các AI/Frontend tests được dẫn dưới đây là **test source đã đọc**, không phải execution mới. Backend API integration tests dùng AI HTTP stub; PASS không đồng nghĩa đã chạy FastAPI thật. [final-verification.md](../final-verification.md) và [project-status.md](../project-status.md) ghi commit `56a21db4e99815dbcfd25d4da6ca9f7bd404cd69`, ngày 2026-08-03, Backend 388/AI 646/Frontend 51: chỉ là lịch sử.

## 2. Architecture

```text
React Frontend
      ↓ REST / user JWT
Spring Boot Backend
      ↙             ↘ internal API key
PostgreSQL         Stateless FastAPI AI Service
```

Giữ nguyên architecture. [RestAiServiceClient](../../backend/src/main/java/com/tttn/jobrecommendation/infrastructure/ai/client/RestAiServiceClient.java) gửi internal API key và request tracing, không forward JWT; parsing gọi `/internal/v2/cv/parse`, Student scoring gọi `/internal/v3/recommendations`. [AI V3 service](../../ai-service/v3/service.py) là computation trên request, không quyết định authentication/ownership/official rank. [V2 CV service](../../ai-service/v2/cv_service.py) giữ extraction/preprocessing pipeline. Không thêm BERT, embeddings, LLM, vector DB, collaborative/learned ranking, queue hoặc microservice.

Frontend có API client ở [recommendedJobsService](../../frontend/src/features/candidate/recommendedJobs/recommendedJobsService.ts), [candidateProfileService](../../frontend/src/features/candidate/profile/candidateProfileService.ts) và [candidateDashboardService](../../frontend/src/features/candidate/dashboard/candidateDashboardService.ts), đồng thời còn `frontend/src/services/mock/`. Kết luận là **có wiring API trong source, chưa chứng minh toàn bộ browser integration trên baseline này**. Không gọi toàn bộ UI là mock-only, cũng không nhận ảnh README làm runtime evidence.

## 3. Backend responsibility và mức ưu tiên modules

Quy ước evidence: `B = backend/src/main/java/com/tttn/jobrecommendation/`; `T = backend/src/test/java/com/tttn/jobrecommendation/`; `A = ai-service/`; `M = backend/src/main/resources/db/migration/`. Path rút gọn trong các bảng được ghép với prefix này, đều thuộc commit baseline. Test names là class/file, không suy rộng thành coverage của mọi method.

| Priority / module | Current behavior và source evidence | Test evidence đã chạy | Status / ĐATN action |
|---|---|---|---|
| P0 recommendation | `B modules/recommendation/controller/RecommendationController.java`, `service/impl/RecommendationGenerationServiceImpl.java`, transaction/validator/query services; Student V3 orchestration, validation, official ranking, persistence/history | `T integration/CvAnalysisRecommendationApiIT.java`, `RecommendationPersistenceFailureIT.java`, `RecommendationV3PersistenceIT.java`; `modules/recommendation/service/impl/*V3*Test.java` | IMPLEMENTED + TESTED; bổ sung school-feature evidence, đồng bộ docs |
| P0 cv | `B modules/cv/service/impl/CvServiceImpl.java`, `CvAnalysisServiceImpl.java`, `CvAnalysisPersistenceService.java`; upload, ownership, active CV, parse V2, analysis state, persisted snapshot; không cho manual extracted-data patch | `T integration/CvApiIT.java`, `CvActiveTransactionIT.java`, `CvDeleteFailureIT.java`, `CvReanalysisStateIT.java`, `CvAnalysisRecommendationApiIT.java`; CV service tests | IMPLEMENTED + TESTED cho lifecycle; structured major/experience/education extraction MISSING |
| P0 job | `B modules/job/service/JobServiceImpl.java`, `PublicJobServiceImpl.java`, `repository/JobRepository.java`; Company ownership, lifecycle, public visibility, job skills/corpus | `T integration/PublicJobApiIT.java`, `JobListQueryCountIT.java`, `RecommendationCorpusQueryCountIT.java`, `RepositoryFilterIT.java` | IMPLEMENTED + TESTED cho visibility/query behavior; không mặc định các test này phủ toàn bộ CRUD/status |
| P0 application | `B modules/application/service/ApplicationServiceImpl.java`; own Student CV, own Company Job, role transitions, protected CV streaming, reapply sau latest REJECTED | `T integration/ApplicationApiIT.java`, `ApplicationReapplyApiIT.java`, `DatabaseConstraintIT.java`; `modules/application/service/ApplicationServiceImplTest.java` | IMPLEMENTED + TESTED; sửa mô tả duplicate rule ở task docs riêng |
| P0 student | `B modules/student/service/impl/StudentServiceImpl.java`, DTOs/mapper/entities; own profile, major, free-text education/experience, profile search text | Đọc `T integration/CvAnalysisRecommendationApiIT.java` cho selected-CV isolation; chưa tìm thấy dedicated Student profile GET/PUT test trong suite files | IMPLEMENTED BUT NEEDS DATN EVIDENCE; bổ sung profile/CV separation evidence, không trộn profile vào V3 |
| P0 statistics/dashboard | `B modules/statistics/service/impl/PublicStatisticsServiceImpl.java`, `repository/PublicStatisticsRepository.java`; 4 aggregate counts. Role dashboards còn tổng hợp từ list APIs; không có chuyên biệt dashboard time-series API trong Backend source | `T integration/PublicStatisticsApiIT.java` (visibility, exact envelope, route auth, aggregate query count) | PARTIAL ở mức school dashboard; aggregate support IMPLEMENTED + TESTED; chưa có approved dashboard acceptance/UI E2E |
| P1 auth/security | `B modules/auth/service/impl/AuthServiceImpl.java`, `common/config/SecurityConfig.java`, `common/security/JwtAuthenticationFilter.java`; BCrypt, JWT, roles, disabled-user rejection, no ADMIN self-register | `T integration/PasswordChangeApiIT.java`, `CvAnalysisRecommendationApiIT.java`, `PublicStatisticsApiIT.java`: password/auth/role boundaries; không phải comprehensive auth suite | IMPLEMENTED + TESTED cho named boundaries; register/login negative matrix cần evidence thêm |
| P1 company | `B modules/company/service/impl/CompanyServiceImpl.java`, `PublicCompanyServiceImpl.java`, `AdminCompanyServiceImpl.java`; profile, verified visibility, admin status; registration hiện tạo VERIFIED | `T integration/RepositoryFilterIT.java`, `SavedCandidateApiIT.java`; saved-candidate service tests | IMPLEMENTED + TESTED cho public visibility/bookmarks; dedicated profile/admin-status coverage UNPROVEN |
| P1 admin/user | `B modules/user/service/impl/AdminUserServiceImpl.java`; list/detail/status, self-disable guard; company/job/application admin flows ở modules tương ứng | `T integration/ApplicationApiIT.java` cho Admin applications; password tests. Dedicated AdminUser/AdminCompany lifecycle test chưa tìm thấy | IMPLEMENTED BUT NEEDS DATN EVIDENCE cho phần còn lại; không thay approval policy |
| P1 skill | `B modules/skill/service/impl/SkillServiceImpl.java`, `StudentSkillServiceImpl.java`, `B infrastructure/ai/skill/SkillCatalogCanonicalizer.java`; catalog + confirmed Student skills; CV skills lưu riêng | `T integration/StudentSkillApiIT.java`, `modules/...` canonicalizer tests tại `infrastructure/ai/skill/SkillCatalogCanonicalizerTest.java` | IMPLEMENTED + TESTED cho Student skills/canonicalization; profile levels/years không thành score components |
| Extension candidateranking | `B modules/candidateranking/`; submitted CV + own Job applications, V3 independent PRIMARY/FALLBACK limits/ranks; M V16/V17 | `T integration/CandidateRanking*IT.java`, `modules/candidateranking/service/*V3Test.java` | EXTENSION; không chọn enhancement khi Student core còn gaps |

Backend sở hữu auth/roles, ownership, eligibility, business transitions, transactions, AI orchestration/response validation, official ordering/ranks, run/result persistence và public envelope. Không chuyển các trách nhiệm này cho AI. JSON dùng `ApiResponse<T>`; raw CV streaming là exception hiện hữu ([API contract](../api-contract.md), Recommendation/CV controllers).

## 4. Student Recommendation trace

Public generation: `POST /api/students/me/recommendations/generate`; request `{cvId, threshold, limit}`. GET history/detail/latest đều scoped theo authenticated Student.

| Component | Implementation path (B nếu không ghi khác) | Current behavior | Relevant tests (T) | V3 compliant? | DATN action required? |
|---|---|---|---|---|---|
| Public API → Controller | `modules/recommendation/controller/RecommendationController.java`; `dto/request/GenerateRecommendationRequest.java` | STUDENT role; userId từ SecurityUtils; unknown fields rejected; threshold [0,1], default .1; limit [1,100], default 20 | `integration/CvAnalysisRecommendationApiIT.java#generationUsesJwtOwnershipStrictRequestAndStudentRole` | Có | Docs public hiện vẫn mô tả V2 |
| Authenticated Student | `common/security/JwtAuthenticationFilter.java`; `common/utils/SecurityUtils.java`; `RecommendationTransactionService#createProcessingRunV3` | JWT xác định user → `studentRepository.findByUserId`; không nhận studentId/client ownership | cùng API test phía trên | Có | Bổ sung negative auth evidence ngoài named cases nếu cần |
| Selected CV ownership | `modules/recommendation/service/impl/RecommendationTransactionService.java` | `findByIdAndStudentId`; selected CV, không tự chọn active CV/profile | `CvAnalysisRecommendationApiIT#twoCvsKeepDifferentExtractedSkillsAndGenerationUsesTheSelectedCv`; `RecommendationTransactionServiceV3Test` | Có | Giữ selected-CV isolation |
| READY validation | cùng transaction service | READY + nonblank processedText/languageCode + confidence [0,1] + exact processingVersion; không yêu cầu extractedText cho V3 | `RecommendationTransactionServiceV3Test#rejectsInvalidV3ReadinessBeforeCorpusPreparation`; API FAILED/PROCESSING cases | Có, với DB language constraint | Docs readiness lỗi thời; supported code allowlist được V15/AI schema đảm bảo, service chỉ check nonblank |
| Persisted snapshot | cùng service; `AiRecommendationV3RequestMapper.java` | processedText, canonicalized extractedSkills, languageCode/confidence, processingVersion lấy cùng CV; không reparse/preprocess CV | `RecommendationTransactionServiceV3Test` (raw text không cần, mixed/unknown/low confidence); `infrastructure/ai/dto/AiV3WireDtoTest.java` | Có | Evidence major/experience/education qua text còn thiếu |
| Eligible Job corpus | `EligibleJobCorpusV3Builder.java`; `modules/job/repository/JobRepository.java` | ACTIVE, VERIFIED company, deadline null/today/future; batched job skills, canonical sorted; >100 canonical Job skills fail, không truncate; text TITLE/DESCRIPTION/REQUIREMENTS/SKILLS | `EligibleJobCorpusV3BuilderTest`; `integration/RecommendationCorpusQueryCountIT.java`; eligibility API case | Có | Job major/experience/education chỉ có thể nằm trong description/requirements, không structured independent input |
| AI V3 request | `AiRecommendationV3RequestMapper.java`; `infrastructure/ai/dto/AiRecommendationV3Request.java` | Request UUID, selected persisted CV, full eligible Jobs, threshold, global limit; không kèm profile/JWT/storage path | `RecommendationTransactionServiceV3Test`, `AiV3WireDtoTest`, `RestAiServiceClientV3Test` | Có | Request UUID chưa persist vào Student run |
| AI call / transaction boundary | `RecommendationGenerationServiceImpl.java`; `RecommendationTransactionService.java`; `RestAiServiceClient.java` | PROCESSING được commit trước call; orchestration không @Transactional; AI call ngoài DB transaction; empty corpus skip AI, SUCCESS với V3 metadata | `CvAnalysisRecommendationApiIT#processingRunIsCommittedBeforeExternalCall`; `RecommendationGenerationServiceImplTest` | Có | Synchronous limitations phải ghi trong report |
| Language routing / component scoring | `A v3/service.py`, `v3/recommender.py`, `v2/recommender.py` | CV persisted language; Job detect/preprocess; PRIMARY nếu cùng en/vi và cả confidence ≥.65; TF-IDF fit Job corpus, transform persisted CV; FALLBACK skill-only | `A tests/test_v3_recommendation_scoring.py`, `test_v3_contract.py`, `test_v3_http_api.py` (source reviewed, NOT executed) | Source phù hợp | BAO cung cấp execution/evaluation evidence đúng V3 |
| AI response validation | `modules/recommendation/service/impl/AiRecommendationV3ResponseValidator.java`; strict client deserialization | Exact requestId/algorithm/version; count≤limit, unique corpus IDs, scores [0,1] precision≤8; raw threshold before rounding; canonical exact intersection/difference; recompute skill coverage and hybrid formula; bounded nonblank reason; reject whole invalid response | `AiRecommendationV3ResponseValidatorTest`; `RestAiServiceClientV3Test`; invalid/threshold API cases | Có cho returned-result semantics | Không tái tính TF-IDF/language tại Backend; không chứng minh AI không bỏ sót global Top-K chỉ bằng returned subset |
| Official sorting | cùng validator | PRIMARY trước FALLBACK; score DESC trong tier, jobId ASC tie-break; không compare cross-tier overall scale | `AiRecommendationV3ResponseValidatorTest#validatesEvidenceFormulaAndOfficialTierOrdering` | Có | Cần real FastAPI evidence cho Top-K membership, không đổi order |
| rankPosition / tierRankPosition | cùng validator; `ValidatedRecommendationV3Response.java` | global rank 1..N; riêng mỗi tier 1..n; Backend gán trước persistence rounding 5 decimals | cùng validator test; serialization/mapper tests | Có | Không thêm official rank vào AI |
| Run persistence | `RecommendationTransactionService#createProcessingRunV3/completeSuccessV3/markFailed`; `entity/RecommendationRun.java` | source CV, PROCESSING→SUCCESS/FAILED, scanned count, algorithm/version, timestamps; failed error sanitized ở REQUIRES_NEW | `CvAnalysisRecommendationApiIT`; `RecommendationPersistenceFailureIT` | Có | Thiếu Student threshold/limit/requestId/CV-version/corpus snapshot cho reproducibility |
| Result persistence | cùng transaction service; `entity/RecommendationResult.java`; M V15/V17 | score column maps rankingScore; nullable overall/text FALLBACK; tier, two ranks, skill evidence/reason; saveAllAndFlush atomic cùng SUCCESS | `RecommendationV3PersistenceIT`; `RecommendationPersistenceFailureIT`; `DatabaseRecommendationRankingV3MigrationIT` | Có | Giữ historical nullable tier khi thiếu strategy metadata |
| Public response/history | `RecommendationQueryServiceImpl.java`, `RecommendationMapper.java`, repositories | owned run; rank order từ DB; latest SUCCESS bỏ FAILED/PROCESSING; typed V3 fields; legacy score alias; titles/companyName từ current Job relation | `CvAnalysisRecommendationApiIT` history/foreign/legacy cases; `RecommendationMapperTest`; `RankingResponseSerializationTest` | Có | API docs cần sync; lịch sử không phải immutable full input/text snapshot |

Locked semantics đã đối chiếu: PRIMARY=`SAME_LANGUAGE_HYBRID`, `rankingScore=overallScore`, .65 text+.35 skill khi Job có canonical skills; nếu không có skills thì overall=text và skill=0. FALLBACK=`CROSS_LANGUAGE_SKILL_BASED`, `rankingScore=skillScore`, overall/text=null. Threshold `>=` áp dụng rankingScore; threshold=0 giữ zero scores khi limit cho phép. Student có một global limit, PRIMARY trước FALLBACK. Versions: `tfidf-cosine-hybrid`, `bilingual-recommendation-v3`, CV `bilingual-nlp-v2-skills-v1`. Không thay bất kỳ semantics nào.

Giới hạn kiểm chứng: Backend validator xác minh tier↔strategy và score formula/evidence, không tự detect Job language hay xác thực cosine độc lập; AI contract không gửi Job language metadata để Backend tái xác định từng tier. Đây là boundary hiện hữu, không phải căn cứ để thêm preprocessing vào Backend. Internal V2 compatibility còn trong client/AI/test source; public generation đã dùng V3. Không claim toàn bộ AI V2 regression PASS ở lượt này.

## 5. Database status

Source of truth là [migrations](../../backend/src/main/resources/db/migration/). Flyway hiện **V1–V18**; JPA core mappings và PostgreSQL/Hibernate validation PASS trên database test. Audit quick diff phát hiện documentation drift dưới đây; không kết luận production DB của mọi môi trường đã apply V18.

| Entity/table | Flyway hiện tại ↔ JPA | DB schema / ERD | Evidence / action |
|---|---|---|---|
| users | V1/V8; `B modules/user/entity/User.java`: email unique, last_login_at | Các field core được mô tả | `DatabaseMigrationIT`, `DatabaseConstraintIT#rejectsDuplicateUserEmail`; không thấy core mismatch trong phạm vi quick audit |
| students / student_profiles | V2/V9; `B modules/student/entity/Student.java`, `StudentProfile.java`: major, education/experience TEXT, education_level/gpa DB/entity | Core fields có | educationLevel/gpa có DB/entity nhưng profile public DTO không expose/update; đó là API feature gap, không phải thiếu migration |
| companies | V2/V9; `B modules/company/entity/Company.java`: unique user_id, status VARCHAR | Core fields có | Runtime registration VERIFIED khác default PENDING không phải schema lỗi; không suy ra approval flow từ default |
| jobs | V4; `B modules/job/entity/Job.java`: Job text/lifecycle, company FK | Core fields có; không structured major/education/experience | `PublicJobApiIT`, `DatabaseMigrationIT`; không thêm schema cho trường nghiên cứu khi chưa chốt requirement |
| skills / student_skills / job_skills | V3/V4/V11; `B modules/skill/entity/Skill.java`, `StudentSkill.java`, `B modules/job/entity/JobSkill.java`; unique relationships | Có fields core; ERD normalized_name unique không biểu diễn explicit predicate V11 `WHERE normalized_name IS NOT NULL` | `StudentSkillApiIT`, canonicalizer tests; levels/years/importance/minLevel không phải scoring components hiện tại |
| cv_files | V5/V10/V15; `B modules/cv/entity/CvFile.java`: active unique partial + analysis snapshot/metadata | Thiếu toàn bộ V15 extracted_skills/status/error/language/confidence/version/warnings/analyzed_at; description còn gọi future storage | V15 + `DatabaseAiContractV2MigrationIT`, `CvApiIT`, `CvReanalysisStateIT`; cần sync docs |
| applications | V5 rồi **V18**; `B modules/application/entity/JobApplication.java` không còn unique pair annotation; active partial index ở DB | Schema/ERD còn unique `(student_id,job_id)` toàn lịch sử | **Mismatch**: index `uk_applications_student_job_active` chỉ PENDING/REVIEWED/ACCEPTED; REJECTED history có thể reapply; WITHDRAWN latest vẫn bị service chặn. `ApplicationReapplyApiIT`, `DatabaseConstraintIT` đã PASS |
| recommendation_runs | V6/V15; `B modules/recommendation/entity/RecommendationRun.java`: algorithm/version/scanned count | Docs/ERD vẫn skeleton, thiếu V15 metadata | `DatabaseMigrationIT`, API tests; cần sync, không invent Student request/fingerprint columns |
| recommendation_results | V6/V15/V17; `B modules/recommendation/entity/RecommendationResult.java`: physical score=rankingScore, component scores, tier, overall, ranks, evidence/reason | Docs/ERD thiếu V15/V17 columns/checks/tier indexes | `RecommendationV3PersistenceIT`, `DatabaseRecommendationRankingV3MigrationIT`; historical incomplete rows cố ý tier=null |
| Các tables khác | V12 notifications; V13 saved_candidates/user_notification_settings; V14 saved_searches; V16/V17 candidate ranking | Schema/ERD có notifications nhưng thiếu V13/V14/V16 tables và V17 extension fields; intro còn ghi V1–V11 | Drift tài liệu, không phải yêu cầu tạo migration; giữ saved-candidate uniqueness company+student |

[database-schema.md](../database-schema.md) và [database-erd.dbml](../database-erd.dbml) chưa đủ dùng trực tiếp làm ERD ĐATN hiện hành. AGENTS/API docs cũng giữ duplicate-application rule cũ; audit dùng executable source + V18 theo thứ tự ưu tiên người dùng yêu cầu, không sửa business rule về dạng cũ.

## 6. Requirement gaps

Xem [matrix](requirement-traceability.md) cho mỗi yêu cầu và owner. Ưu tiên school/core; không audit extension ngang mức core.

| ID | Gap / status | Priority | Owner / hành động cần làm sau duyệt |
|---|---|---|---|
| G01 | Major/experience/education có profile và đường text chung, nhưng thiếu structured CV extraction; preservation/coverage theo fixture ĐATN chưa chứng minh | P0 | SHARED: chốt diễn giải yêu cầu; HAI chứng minh persisted snapshot/contract flow; BAO chứng minh NLP giữ nội dung cần thiết. Không mặc định phải có 4 independent scores |
| G02 | Human-labeled quality evidence MISSING; F1@K tooling MISSING; runner V2 không đại diện V3 | P0 | BAO metrics/dataset/runner; SHARED ground-truth rubric + V3 ordering; HAI chuẩn bị prediction/input evidence sau khi contract được chốt |
| G03 | API contract vẫn raw CV V2, flat score sort/version, readiness cần extractedText; còn TODO skill validation dù V3 đã implement | P1 | HAI/SHARED sync docs ở task riêng, giữ public/internal source contracts |
| G04 | DB schema/ERD thiếu V15/V17 và lệch V18; historical project-status còn V16 | P1 | HAI cập nhật đúng released Flyway trong task riêng; không migration |
| G05 | Student run reproducibility PARTIAL; thiếu threshold/limit/requestId, processingVersion/analyzedAt snapshot, immutable scoring input/corpus/hash; không có official Backend prediction export riêng | P1 | HAI đề xuất minimal evidence/export contract cùng BAO; ưu tiên script dùng APIs đã có nếu đủ, không mặc định thêm API/schema |
| G06 | Full upload→real NLP→snapshot→recommendation→history→browser school-feature journey UNPROVEN tại baseline | P0 evidence | HAI làm NEXT TASK phía API/stack trước; SHARED browser/report evidence sau. Runner hiện seed snapshot trực tiếp |
| G07 | Dashboard có aggregates/list support; scoped totals/time-series và browser acceptance chưa chốt | P1 | HAI chốt dashboard requirement trước khi chọn thêm Backend endpoint; không làm feature cho đẹp |
| G08 | Dedicated Student profile/Admin user/company lifecycle và exhaustive auth negative coverage chưa chứng minh | P1 | HAI thêm meaningful tests/evidence sau core; không suy rộng 456 tests thành 100% requirements coverage |
| G09 | Deployment assets có; production/demo target deployment, backup/restore/rollback evidence chưa tự chạy trong audit | P1 | HAI chọn target ĐATN và lưu reproducible deployment evidence; không claim production-ready |
| G10 | Concurrent CV reanalysis không có attempt-id/row lock ở markProcessing/saveParsedAnalysis; chưa chứng minh isolation giữa overlapping attempts | P1 residual correctness | HAI kiểm chứng trước khi quyết định sửa. `CvReanalysisStateIT` là state-path evidence, không mặc định race proof. Không sửa task audit |

G01 không tự động nghĩa là sửa scoring. Nội dung major/experience/education có thể là lexical content của same-language text component; FALLBACK chỉ kỹ năng theo contract. Nếu nhà trường yêu cầu extraction có cấu trúc riêng, đó là gap thật cần BAO + contract/schema review riêng, không được lén thêm vào V3.

## 7. School-specific CV feature audit

Phân biệt `student_profiles.processed_text` (normalize profile text) và `cv_files.processed_text` (AI NLP snapshot). V3 chỉ dùng cái thứ hai; việc field có trong profile không chứng minh nó được đưa vào recommendation.

| Feature | Present in Student profile? | Extracted from CV? | Structured? | Persisted from CV analysis? | Present in processedText? | Sent to Recommendation? | Direct scoring feature? | Shown in UI/API? | Evidence path | Gap vs school requirement? |
|---|---|---|---|---|---|---|---|---|---|---|
| Skill | Có, `student_skills`, tách CV skills | **Có**, canonical skill extractor từ raw CV | Có list canonical; profile có level/years/source, CV không có skill-level extraction | Có `cv_files.extracted_skills` JSONB + processed text | Text kỹ năng đi qua NLP nếu token giữ lại; direct skill list độc lập processedText | **Có**, selected CV skills; không lấy manual student_skills | **Có skillScore**; matched/total Job canonical skills; .35 PRIMARY khi Job có skills, toàn bộ FALLBACK | CV analysis API skills; profile skill API; recommendation matchedKeywords/missingSkills; UI API wiring thấy trong source | `A v2/cv_service.py`, `v2/skill_extractor.py`, `v2/skill_canonicalizer.py`; `B modules/cv/service/impl/CvAnalysisPersistenceService.java`; V3 mapper/validator; `T integration/StudentSkillApiIT.java`, `CvAnalysisRecommendationApiIT.java` | IMPLEMENTED + TESTED Backend; extraction AI test source reviewed. Chưa có human quality evaluation |
| Major / chuyên ngành | Có `students.major` | Chỉ whole-document extraction; **MISSING dedicated major extractor/field** | Profile string; CV structured major MISSING | Chỉ trong raw/processed full text nếu tồn tại/giữ lại; không field major trong CV snapshot | **UNPROVEN riêng major**; general whole-text tokenizer tạo khả năng lexical inclusion, không đảm bảo semantic extraction/retention | Không gửi students.major; chỉ gián tiếp CV processedText khi có tokens | Không independent major score; có thể ảnh hưởng PRIMARY textScore khi từ vựng trùng; không dùng trong FALLBACK | Student API major; UI `candidateProfileService` đọc/ghi; không CV-analysis major field; runtime UI chưa chạy | `B modules/student/entity/Student.java`, `StudentServiceImpl.java`, `StudentMapper.java`; `A v2/cv_service.py`, `v2/preprocessor.py`; `B .../AiRecommendationV3RequestMapper.java`; `frontend/.../candidateProfileService.ts` | **PARTIAL**; cần fixture/proof từ CV→persisted text→V3. Không claim chuyên ngành phù hợp như semantic domain classifier |
| Experience / kinh nghiệm | Có `student_profiles.experience` TEXT; student_skills.years_of_experience là manual skill-specific, khác CV extraction | Whole text; **MISSING structured work entries/duration extractor** | Profile named free-text field; CV structured experience/duration MISSING | Trong full raw/processed text, không field riêng | Có test source giữ `3 years experience` / `kinh_nghiệm`; không chứng minh dates/duration/company/seniority extraction hoặc toàn bộ section | Không gửi profile.experience hoặc skill years; chỉ CV processedText | Không independent experience score/seniority rule; lexical PRIMARY only nếu token được giữ; FALLBACK bỏ text | Profile API experience; UI serialize experiences thành text; CV API raw/processed text, không work entries | `B modules/student/entity/StudentProfile.java`, `StudentServiceImpl#updateSearchText`, profile DTO/mapper; `A tests/test_preprocessor.py`, `test_vietnamese_preprocessor.py`, `tests/test_v3_recommendation_scoring.py` (not executed); V3 mapper | **PARTIAL**; có lexical evidence trong tests nhưng thiếu school end-to-end evidence/structured extraction; không suy ra matching years |
| Education / trình độ học vấn | Có profile.education TEXT; DB/entity educationLevel/gpa có | Whole text; **MISSING dedicated degree/level extractor/field** | Profile free text; DB education_level/gpa không có trong current StudentProfileUpdateRequest/Response; CV structured level MISSING | Chỉ full raw/processed text nếu có/giữ lại; không persisted extracted education | **UNPROVEN riêng degree/level**; whole-text preprocessing không bảo đảm nhận dạng/chuẩn hóa bằng cấp | Không gửi profile.education/educationLevel/gpa; chỉ CV processedText | Không independent educationScore hoặc degree eligibility; lexical PRIMARY only, FALLBACK skill-only | Profile API education; UI education serialization; structured educationLevel/gpa **không expose** profile DTO; CV analysis không degree field | `B modules/student/entity/StudentProfile.java`, `dto/request/StudentProfileUpdateRequest.java`, `dto/response/StudentProfileResponse.java`, mapper; V2 CV schemas/service và V3 mapper; `frontend/.../candidateProfileService.ts` | **PARTIAL**; degree/level extraction MISSING; lexical inclusion needs evidence. Chốt requirement trước khi thêm field/contract |

Evidence đầy đủ cho API schema của snapshot: [CvAnalysisResponse](../../backend/src/main/java/com/tttn/jobrecommendation/modules/cv/dto/response/CvAnalysisResponse.java), [CvFile](../../backend/src/main/java/com/tttn/jobrecommendation/modules/cv/entity/CvFile.java), [CV parsing](../../ai-service/v2/cv_service.py), [preprocessor](../../ai-service/v2/preprocessor.py). Không có major/experience/education typed output trong luồng này. Profile fields là user-confirmed, không được claim tự động extracted từ CV.

Job side tương ứng: `Job` có title/description/requirements và canonical `job_skills`, không dedicated major/experience/education matching fields. JobSkill importance/minLevel và StudentSkill level/years có data, nhưng V3 request chỉ dùng canonical skill names. TextScore dùng TF-IDF cosine chung trên processed text; không giải thích nó như ba component scores khác.

## 8. Evaluation-support gap

| Capability | Status / evidence | DATN action / owner |
|---|---|---|
| Dataset validation | IMPLEMENTED TOOLING: `A evaluation/dataset.py`, `tests/test_evaluation_dataset.py`; complete CV×Job judgments, relevance 0/1/2, each CV ≥1 relevant Job, ≤100 Jobs | BAO frozen authorized/anonymized dataset; test source only in audit |
| Human ground-truth workflow | IMPLEMENTED TOOLING: `A evaluation/annotation.py`, templates, `tests/test_evaluation_annotation.py`; independent packets, disagreement review, manual adjudication/finalize | BAO annotation thực tế; SHARED rubric. Tracked toy-v1 là synthetic, **human-labeled research quality evidence MISSING/UNPROVEN**; không đoán có/không private dataset ngoài repo |
| Precision@K / Recall@K | IMPLEMENTED TOOLING: `A evaluation/metrics.py`, `tests/test_evaluation_metrics.py`; relevance≥1; precision denominator min(K,available ranking); recall denominator all relevant labels | BAO chốt denominator/short-list policy cho V3 threshold/Top-K; không có metric execution/quality result trong audit |
| F1-score@K | **MISSING TOOLING**: metrics, runner dataclass/CSV/summary chỉ có Precision/Recall/NDCG; không có F1 implementation/output trong evaluation package | BAO thêm F1 theo reviewed metric convention; phân biệt macro mean per-CV F1 với F1 của macro P/R; không triển khai đây |
| NDCG@K | IMPLEMENTED TOOLING, optional extension metric: metrics.py gain `2^relevance-1`, discount log2(rank+1) | BAO quyết định có dùng trong report, không thay mandatory P/R/F1 |
| Prediction export | `A evaluation/runner.py` tạo summary.json/per_cv.csv/rankings.csv, **V2 offline**, not official Backend run export; Backend GET run detail/history/latest có persisted V3 predictions | HAI + BAO chốt mapping/export từ official rank, tier, scores; không gọi V2 rankings.csv là current V3 predictions |
| Current V3 evaluation | **PARTIAL/MISSING adapter**: runner import `v2.schemas`, gọi `v2.service.recommend_bilingual` từ raw CV và sort toàn corpus theo score; không dùng persisted V3 snapshot/PRIMARY-first | BAO reviewed V3 evaluation path; SHARED contract; không merge tiers thành một calibrated score scale |
| Reproducibility offline | V2 runner deterministic request UUID5 theo CV id, stable formatting, dataset name/K/counts/algorithmVersion; no execution timestamp in artifacts | BAO thêm evidence manifest commit/dependency lock/catalog/dataset hashes và V3 metadata khi chốt evaluation protocol |
| Backend reproducibility/history | IMPLEMENTED + TESTED history, CV id, algorithm/version, scanned count, components/evidence/ranks/timestamps; **PARTIAL** input reconstruction | HAI: Student run thiếu threshold/limit/requestId, CV processing-version/analyzed-at snapshot, corpus membership/text/fingerprint. Later Job titles đọc current relation; không thể reconstruct exact old input chỉ từ history |

Không có kết quả Precision/Recall/F1/NDCG được invent trong audit. Toy metrics, unit tests hay BUILD SUCCESS không chứng minh recommendation quality.

Backend hỗ trợ Bảo sau này: thống nhất sanitized prediction export lấy official `rankPosition` và `tierRankPosition`; mapping CV/Job anonymous dataset ids↔run ids; preserve tier/nullable score semantics; manifest threshold/K/corpus selection, algorithmVersion/processingVersion/source SHA/catalog/locks; frozen scoring input tại thời điểm experiment. Ưu tiên harness/script + GET detail đang có nếu đủ; bất kỳ API/schema persistence mới phải có requirement/contract review riêng. Ground-truth labels thuộc evaluation dataset, không suy ra từ applications, scores hay matched skills.

## 9. Extension vs Core và readiness

| Classification | Baseline conclusion |
|---|---|
| DONE | Backend Student Recommendation V3 orchestration/validation/ranks/persistence/history; CV lifecycle; eligible Job corpus; Application flow; named auth/ownership boundaries; PostgreSQL 17/Flyway V18 verification. Evidence là source + tests đã tự chạy |
| PARTIAL | School coverage major/experience/education; dedicated profile/admin evidence; dashboard scope; V3 reproducibility/evaluation/export; deployment/browser evidence; DB/API documentation consistency |
| MISSING | Typed major/experience/education CV extraction, F1@K tooling, reviewed current V3 evaluation adapter, human-labeled quality results proven by repository audit |
| EXTENSION | Company Candidate Ranking, optional NDCG research metric; không ưu tiên nâng extension trước Student core |
| OUT OF SCOPE | BERT/embeddings/LLM/vector DB/CF/learned ranking/new services/queue/OCR hoặc redesign không thuộc task audit; không biến chúng thành gap bắt buộc của đề tài |

Chưa chốt DONE toàn ĐATN và không claim production-ready. Missing structured CV fields không tự động kéo theo change scoring; school requirement interpretation cần quyết định SHARED dựa trên evidence.

## 10. Proposed next Backend task

**NEXT TASK** (đúng một task, chưa triển khai)

**Title:** Student Recommendation V3 — chứng minh school-feature flow từ CV upload đến persisted ranking/history.

**Why:** G01/G06 là P0 core evidence gap. Current real runner chứng minh scoring từ snapshot **seed trực tiếp vào cv_files**, không chứng minh PDF/DOCX→NLP→persisted processedText với major/experience/education. Đây là công việc Backend/integration giúp chốt requirement trước khi cân nhắc implementation thêm fields; ưu tiên hơn DB docs, export, dashboard hoặc Candidate Ranking enhancement.

**Scope:** Bổ sung/hoàn thiện isolated Student API/stack harness với CV synthetic được upload qua public Backend rồi phân tích qua FastAPI V2 thật; assert persisted READY snapshot và input V3, validation, tier ordering, ranks, persistence/history. Dùng fixture EN/VI có skill/major/experience/education rõ; lưu evidence matrix về tokens/text vs structured fields và giới hạn FALLBACK. Thêm Backend regression chứng minh profile edits/manual skills không thay selected-CV snapshot input. Chốt bằng tài liệu bốn school terms đang được hỗ trợ ở tầng nào; nếu đòi dedicated extraction thì ghi remaining gap và mở proposal riêng. Không sửa algorithm, parsing implementation, weights, schema, public API hoặc Frontend; không tính quality metrics từ synthetic fixture.

**Files likely involved:** `scripts/run-recommendation-real-e2e.ps1` (hoặc companion Student-only harness); `docker-compose.e2e.yml` chỉ nếu isolation hiện có không đủ; synthetic test CV assets dưới test fixtures; `backend/src/test/java/com/tttn/jobrecommendation/integration/CvAnalysisRecommendationApiIT.java`; `backend/src/test/java/com/tttn/jobrecommendation/modules/recommendation/service/impl/RecommendationTransactionServiceV3Test.java`; `docs/datn/` evidence. Đây là phạm vi dự kiến cho task sau, chưa edit trong audit.

**Contract risk:** Thấp nếu chỉ harness/tests/docs. Đóng băng V3 snapshot, confidence .65, .65/.35 weights, PRIMARY/FALLBACK/null semantics, threshold/global limit, versions và Backend rank ownership. Nếu phát hiện cần extracted major/experience/education fields thì **không** triển khai trong task evidence; cần reviewed contract/migration proposal riêng.

**Dependency on Bảo:** **CONTRACT ONLY** để thống nhất synthetic fixture text/tokens và school interpretation. Hải có thể bắt đầu Backend harness độc lập; không cần Bảo thay scoring/extraction để kiểm chứng current behavior. Chứng minh quality hoặc bổ sung structured extraction vẫn **BLOCKING** trên BAO dataset/NLP work ở các task tương lai.

**Acceptance criteria:**

1. Hai fixture synthetic EN/VI được upload/reanalyze qua Backend và FastAPI thật; không chèn sẵn processedText/skills làm evidence cho parsing.
2. Đối chiếu persisted processedText/skills/languageCode/confidence/processingVersion với scoring input V3; không reparse/preprocess CV trong generation.
3. Ghi rõ major/experience/education tokens nào giữ được, field nào không structured, profile data nào không gửi; không claim independent scores hoặc semantic duration/degree matching.
4. Prove one Student V3 call khi corpus nonempty; no scoring V2 call; PRIMARY trước FALLBACK, global Top-K, deterministic ties, nullable FALLBACK fields, official Backend ranks, persisted/history agreement; không so cross-tier overall scales.
5. Ownership/READY/invalid-AI regression và profile-vs-CV isolation PASS; dữ liệu riêng tư/credentials không vào evidence logs; isolated cleanup được kiểm tra.
6. Evidence ghi source SHA/date/commands/results/limitations; không gọi synthetic run là human-labeled quality evaluation. Không sửa production behavior/Frontend/AI implementation/schema.

**Tests required:** Backend `mvnw.cmd -B -ntp clean verify`; focused selected-CV/profile isolation integration regression; real isolated Student upload→parse→recommend→history harness với PostgreSQL 17 + Backend + FastAPI, EN/VI fixtures và cross-language FALLBACK. AI suites chỉ cần chạy nếu task sau sử dụng execution result để claim AI regression; browser journey/evaluation metrics không thuộc acceptance Backend harness này.

### Dependency on BAO theo nhóm

| Group | Work / trách nhiệm |
|---|---|
| NONE | HAI Backend ownership/validation/ranking/persistence/test evidence; DB/ERD/API doc sync; build verification; deploy/harness infrastructure |
| CONTRACT ONLY | SHARED fixture/rubric major/experience/education; V3 export/order/null semantics; current pipeline text-token expectations. NEXT TASK nằm nhóm này |
| BLOCKING | BAO real authorized/anonymized dataset + independent human annotation/adjudication; F1@K/current V3 evaluation implementation/results; dedicated structured NLP extraction nếu yêu cầu school xác nhận cần. Không chờ những việc này để sửa docs hay tạo Backend harness |

## 11. Verification of documentation-only audit

Cuối audit đã chạy `git diff --check` (exit `0`, không lỗi whitespace), `git status --short`, `git diff --stat`, `git diff`. Status chỉ có ba untracked files dưới `docs/datn/`; tracked diff/stat rỗng. Đã kiểm tra nội dung additions qua `git diff --no-index -- /dev/null <file>` và whitespace check tương ứng: không có whitespace-error diagnostics; no-index exit `1` biểu thị file mới khác empty input, không phải Backend build failure. Git có advisory LF→CRLF theo cấu hình working copy. Vì chưa stage/commit, plain `git diff`/`--stat` không hiển thị untracked additions: không dùng output rỗng làm bằng chứng đã review file mới. Mọi Markdown local link trong ba tài liệu đã được kiểm tra và resolve tới path hiện hữu.

Phạm vi thay đổi chỉ `docs/datn/README.md`, `docs/datn/requirement-traceability.md`, `docs/datn/backend-baseline-audit.md`. Không production/Frontend/AI/contract/migration changes; không commit/push/merge; chờ người dùng duyệt NEXT TASK.

## 12. Runtime supplement — Student full upload-to-ranking E2E (2026-10-13)

Supplement này được ghi **sau runtime PASS**, trên branch `feat/datn-student-recommendation-upload-e2e`, base commit `e1335d5e0177b35647dd12e841df9b693be71682` (khớp remote master lúc inspection). Các section 1–11 phía trên giữ nguyên nội dung audit trước đó; những phát biểu “chưa chạy real E2E” và NEXT TASK proposal ở đó thuộc baseline lịch sử. Supplement này thay thế evidence status cho **đúng flow English synthetic DOCX được kiểm chứng**, không chốt DONE toàn ĐATN.

Pre-existing work được bảo toàn: `AM docs/datn/CODEX_GUARDRAILS.md`, ba audit docs untracked. Guardrails/README và Git index không bị sửa trong task. Chỉ thêm [runner upload riêng](../../scripts/run-student-recommendation-upload-real-e2e.ps1) và append supplement vào audit/matrix sau PASS. Không production source, AI implementation, Frontend, API contract, schema, Flyway hoặc existing Compose changes. [Runner seeded-snapshot cũ](../../scripts/run-recommendation-real-e2e.ps1) được giữ nguyên; SHA256 trước/sau `5A51268C755D58D8C01952DDD3F87F68DADF4C00F891289E31D0D6AC2091BDE9`.

### Discovered real flow

| Step | Executable behavior / runtime assertion |
|---|---|
| Upload | STUDENT-authenticated `POST /api/students/me/cv?active=true`, multipart part **file**, DOCX MIME; upload stores binary/metadata, returns owned active CV. Runtime file size matches generated DOCX bytes |
| Initial state | `GET /api/students/me/cv/{cvId}/analysis` immediately returns NOT_READY, processedText=null, skills empty. Upload does **not** automatically analyze |
| Analysis | `POST /api/students/me/cv/{cvId}/reanalyze` is synchronous; source marks PROCESSING in a short transaction, calls real `/internal/v2/cv/parse` outside transaction, validates/persists READY. Transient PROCESSING is source/test evidence, not claimed as a polled runtime observation |
| READY polling | Bounded READY polling: default 30-second polling window; HTTP timeout 45 seconds per request. Live GET and PostgreSQL snapshot agree on processedText/skills/languageCode/confidence/processingVersion; analyzed_at present |
| Snapshot | Nonblank processedText; canonical extracted skills exactly docker/java/postgresql/spring boot; languageCode=en; finite confidence in [0,1] and >=.65; processingVersion=`bilingual-nlp-v2-skills-v1`. Runner never INSERTs/UPDATEs CV analysis; scoring leaves snapshot unchanged |
| V3 generation | `POST /api/students/me/recommendations/generate` twice, selected uploaded cvId, threshold=0, limits **3** and **2**. Both SUCCESS, sourceType=CV, algorithm=`tfidf-cosine-hybrid`, algorithmVersion=`bilingual-recommendation-v3`, totalJobsScanned=3 |
| Ranking / Top-K | Three eligible Jobs: identical English pair with five declared skills, Vietnamese Job with four. Full run returns 2 PRIMARY then 1 FALLBACK; identical PRIMARY scores tie and IDs ascend; higher numeric FALLBACK skill coverage follows PRIMARY. Limit=2 returns only the two PRIMARY Jobs |
| Score/evidence validation | Finite scores [0,1]; PRIMARY nonnull text/overall, positive textScore, rankingScore=overallScore, four matched skills + missing redis, coverage 4/5. Hybrid formula checked with tolerance for five-decimal persistence rounding, not a hard-coded cosine. FALLBACK has null text/overall, rankingScore=skillScore, four matched/no missing skills, coverage 4/4 |
| Official ranks | Backend global ranks 1/2/3 in full run, tier ranks PRIMARY 1/2 and FALLBACK 1. Top-K run global/tier PRIMARY ranks 1/2. AI receives no rank override and remains real computation service |
| Persistence | PostgreSQL recommendation_runs: 2 SUCCESS runs, 3 Jobs scanned each, selected cvId, algorithm/version and finish time. recommendation_results: **5 total rows** across runs; compare each returned row with DB tier/scores/strategy/skills/global+tier ranks. No PROCESSING run remains |
| History | `GET /api/students/me/recommendation-runs/{runId}` preserves every checked result field; list `/recommendation-runs` returns the two runs in newest-first order with correct status/version/CV; `/recommendation-results/latest` returns the latest run's official result IDs |
| Real AI calls | Isolated AI access logs: exactly **1** successful `POST /internal/v2/cv/parse`, **2** successful `POST /internal/v3/recommendations`, **0** `/internal/v2/recommendations` calls |
| Cleanup | Runner removes its isolated project containers, volumes and network; checks labels after down. It refuses to adopt pre-existing resources with the reserved project label, including stopped containers. Baseline had no running Docker containers; no existing application stack was stopped |

Synthetic fixture is generated as a minimal valid DOCX in memory using .NET ZIP/XML; no new dependency, real personal data or checked-in binary. Only minimal Job/skill corpus data is seeded. The isolated stack uses unchanged `docker-compose.yml` + `docker-compose.e2e.yml`, e2e profile and project `student-recommendation-upload-e2e`. No mock/proxy replaces parsing/scoring. Logs emit sanitized stage results/counters/classifications, never raw CV, JWT/password/internal key or private storage paths.

### School feature runtime evidence

Each concept has exactly one classification; scope is the uploaded English DOCX fixture.

| Feature | Runtime classification | Evidence and limit |
|---|---|---|
| Skill | **STRUCTURED_PROVEN** | Real extraction yields canonical list; persisted extracted_skills and public analysis match; recommendation matched/missing evidence and skillScore coverage agree |
| Major | **LEXICAL_PROVEN** | information/technology/computer/science tokens survive in persisted processedText, which current V3 source consumes; same-language run has positive textScore. No typed extracted major or independent major score |
| Experience | **LEXICAL_PROVEN** | backend/internship/project/experience tokens survive in the scored persisted text. No structured work entries, duration/seniority extraction or independent experience score |
| Education | **LEXICAL_PROVEN** | bachelor/degree/university tokens survive in the scored persisted text. No degree normalization/level extraction or independent education score |

The runner checks retained tokens without logging the CV text. Lexical classification proves representation in the snapshot used by the existing whole-text scoring path; it does **not** prove an individual feature's causal score contribution, semantic equivalence, or hiring quality. No manual profile fields are populated to substitute for extraction. Missing structured extraction and public educationLevel/gpa support recorded earlier remain missing; this task does not determine that new fields/components are required by the school.

### Executed verification

| Command / check | New execution evidence |
|---|---|
| `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-student-recommendation-upload-real-e2e.ps1` | **PASS**, exit 0 on 2026-10-13; upload/parse/snapshot/V3/Top-K/persistence/history/access counts/cleanup assertions passed |
| `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-recommendation-real-e2e.ps1` | **PASS**, exit 0 on 2026-10-13; 1 V3 scoring call, 0 V2; seeded-snapshot semantics runner intact; cleanup reported success |
| `cd backend; .\mvnw.cmd -B -ntp clean verify` | **BUILD SUCCESS**, exit 0; **456 tests**, 0 failures/errors/skipped; Surefire 246 + Failsafe 210; Maven total time `02:10 min`, finished `2026-10-13T15:02:27+07:00` |
| Test-count change | **None**: added an external PowerShell real-stack runner, not Java tests; existing Backend suite unchanged |
| Docker cleanup | Both named E2E projects removed; final read-only checks for project-labelled containers (including stopped), volumes and networks empty |
| Diff safety | `git diff --check` and untracked additions whitespace checks; only task runner + appended audit/matrix changes beyond expected pre-existing docs/index; no production-source change |

Retry notes: first attempt stopped before startup because Docker credential helper was absent from PATH; runner now temporarily includes the discovered Docker CLI directory and restores process PATH. A subsequent attempt proved upload/parse but hit the harness's PowerShell 5.1 JSON-array enumeration incompatibility; fixed explicit array flattening in the new runner and reran the complete isolated flow to PASS. Both failed attempts cleaned their project. These were environment/harness issues, not production-source bugs. Existing runner execution supplied Docker CLI directory in the invoking shell's PATH, without changing its file.

New runner SHA256 at successful execution: `2733147DF3560ED59D36E765AD8B882CE9463CA9748120CEF5801B82DFCEB3B1`. No production bug was found in the exercised path. TF-IDF/Cosine, PRIMARY/FALLBACK, .65/.35, language confidence, threshold, global Top-K/order, official Backend ranks, public API, DB/Flyway and Backend/AI responsibilities all remained unchanged. No commit/push/merge.

### Remaining gaps and one recommended next task

The English DOCX API/stack upload path is now proven. **Vietnamese CV upload, PDF upload, browser journeys, overlapping reanalysis isolation, exhaustive negative cases and production operations are not established by this runner**. Existing Backend tests continue to cover named ownership/READY/invalid-response boundaries. Full exact historical input/corpus reconstruction, V3 evaluation adapter, F1@K, authorized human ground truth and final Precision@K/Recall@K/F1@K quality results remain separate unfinished work; no evaluation metrics were generated or claimed here.

**RECOMMENDED NEXT TASK:** Add real Vietnamese CV upload evidence (DOCX/PDF) to the Student-only harness, checking persisted bilingual lexical content and V3 tier semantics with the unchanged parser/scorer. This follows the remaining core bilingual evidence gap, needs fixture/contract coordination with Bảo, and must not add extractors or alter production behavior. Do not implement it in this task.
