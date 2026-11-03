# P0 — Student profile atomic save và concurrency safety

Branch `design/datn-ui-ux-refresh-20261102`, baseline `3bd7a88d2eb620d261687cf24aaafd2dd668d1aa`, PR #66 Draft. HEAD/working tree thực tế đã kiểm trước sửa; master `e019f7a4` vẫn là ancestor. Giữ ngoài commit các thay đổi có sẵn: `frontend/tsconfig.app.tsbuildinfo`, `.agents/`, `skills-lock.json`.

## Audit và before/after

Nguồn đối chiếu: AGENTS/CODEX_GUARDRAILS, API contract, released Flyway V1–V18, StudentController/StudentServiceImpl, StudentSkillController/Service, mapper/DTO/entity/security, candidateProfileService/editor/preferences/settings, unit/integration/E2E và active V3 contract.

Trước sửa, editor đọc ba API riêng và lưu tuần tự `PUT /students/me` → `/students/me/profile` → `/students/me/skills`. Ba service method có transaction riêng; lỗi bước ba không rollback hai bước đầu. Không có revision. Runtime probe trên **secondary `studentUi`**, trước rebuild, đã chứng minh **200 → 200 → 404**: User name/Profile summary mới còn lưu dù skill ID không tồn tại; skills cũ giữ nguyên. Editable fields được phục hồi ngay. Không dùng PRIMARY cho negative probe.

Các semantics đã xác minh:

- Basic fields: fullName chỉ cập nhật khi nonblank; phone/major/university/location/headline non-null được trim, blank → null; graduationYear null/absent giữ nguyên, 1900–2100. headline thuộc StudentProfile, phone/fullName thuộc User.
- Profile text null/absent giữ nguyên; blank → null; enum preferredJobType null giữ nguyên. search text/completeness là dữ liệu dẫn xuất hiện hữu. GPA/educationLevel/preferredWorkingModel chưa có DTO/editor update, phải giữ nguyên.
- Legacy skills là **complete confirmed list** theo contract hiện hành: ID hoặc normalized custom name, level (alias proficiencyLevel), years nullable, source MANUAL/CV_EXTRACTED/ADMIN_SEEDED. Omitted rows bị remove khi chủ động thay cả list; custom catalog skill trước đây dùng REQUIRES_NEW.
- CV parsing lưu `cv_files.extractedSkills`/processedText/language/version riêng, không tự sync `student_skills`. V3 chỉ dùng persisted CV READY snapshot; không dùng profile text/manual skills thay thế. Không suy diễn source CV_EXTRACTED của một confirmed link là quyền ghi CV analysis.
- UI hỗ trợ basic fields, văn bản profile, preferences và skills; không thêm persistence giả cho certificates/links/languages/GPA. Preferences và Settings là hai legacy PUT consumers khác ngoài editor.
- Nhóm của skill có sẵn thuộc catalog chung, không phải field per-Student. Editor hiện khóa nhóm trên existing catalog ID; chỉ cho chọn nhóm khi tạo custom skill mới, và giải thích metadata catalog được tái sử dụng. MANUAL level/years vẫn sửa được. Null years được giữ nếu không chỉnh, không âm thầm đổi thành 0.

Sau sửa, editor đọc một snapshot và một lần save gọi **một PUT aggregate**. Backend CAS revision, basic/profile/skills và custom catalog cùng transaction. Frontend chỉ gửi scalar delta và manualSkills khi thực sự thay đổi; field ngoài request và metadata null được giữ. Không có chuỗi partial writes hoặc read-after-save có thể lấy nhầm revision từ writer khác.

## API và DB/versioning

`GET /api/students/me/profile-aggregate` trả `ApiResponse<{revision,student,profile,skills}>`, ETag `"N"`, isolation REPEATABLE_READ. `skills` gồm mọi nguồn đã xác nhận; DTO student/profile giữ các field thực sự được hỗ trợ. GET không ghi revision. JWT xác định owner; chỉ STUDENT được đọc/ghi.

`PUT` cùng URL yêu cầu body revision integer ≥ 0; optional `student`, `profile`, `manualSkills`, `clearFields`:

- Null/omitted group/scalar → keep. Empty/blank optional text → clear to null; blank fullName → keep theo legacy, không xóa required name.
- `clearFields: ["graduationYear", "preferredJobType"]` là cách clear numeric/enum tường minh; không đổi nghĩa null của legacy. Không set non-null và clear cùng field; unknown clear field → 400.
- manualSkills null/omitted → giữ; list thay **chỉ MANUAL**, `[]` chỉ xóa MANUAL. Non-MANUAL IDs/source/level/years giữ nguyên; trùng non-MANUAL skill hoặc giả provenance → 400. UI source khác MANUAL chỉ đọc.
- Unsupported root/basic/profile fields, ownership IDs/email/GPA/links/languages không được âm thầm ghi. Empty groups/revision-only không sửa content/timestamps; mọi successful mutation vẫn tăng revision đúng một lần.
- Response 200 là snapshot đã flush, sau transaction service commit, revision N+1; lỗi rollback không trả false success. Không mở transaction qua AI/network calls.

Flyway **V19** chỉ thêm `students.profile_revision BIGINT NOT NULL DEFAULT 0`, CHECK nonnegative. Không sửa released migration, không backfill content, reset IDs hoặc đổi constraints cũ. Revision do **SQL compare-and-swap** quản lý; entity column không insert/update bằng Hibernate. First write của mọi profile transaction:

```sql
UPDATE students SET profile_revision = profile_revision + 1
WHERE user_id = :authenticatedUserId AND profile_revision = :expected;
```

PostgreSQL serialize writers của cùng Student và recheck predicate sau khi đợi transaction trước. Một writer thắng; loser affectedRows=0 → 409. CAS và toàn bộ business writes commit/rollback cùng nhau. Native version không bị Hibernate full-row update ghi lùi. User dùng DynamicUpdate để login/password/status/timestamp write từ snapshot cũ không ghi đè fullName/phone vừa commit; có real ORM concurrency regression riêng.

Custom catalog UPSERT dùng `ON CONFLICT DO NOTHING` trong transaction caller, sau đó đọc row thắng. Phải xử lý cả unique name và partial unique normalized_name từ V3/V11; targeted conflict chỉ một index từng gây 23505 ở full suite. Không dùng REQUIRES_NEW, không để catalog orphan sau rollback.

## Legacy compatibility và breaking precondition đã chốt

Theo lựa chọn tường minh của người dùng: giữ **URL, request payload, response body** của cả ba API legacy; bắt buộc **If-Match** từ GET snapshot đã chỉnh sửa. GET/successful PUT thêm ETag; không thêm revision field vào body legacy. CORS expose ETag.

| Request | Expected HTTP/error | Quy tắc |
|---|---|---|
| Legacy PUT không If-Match | 428 PROFILE_REVISION_REQUIRED | Không có unconditional overwrite |
| Legacy/aggregate stale N | 409 PROFILE_REVISION_CONFLICT | Dùng 409 thống nhất theo application contract, không xen 412 |
| Weak/wildcard/multiple/malformed/overflow ETag | 400 BAD_REQUEST | Không dùng `*` để bypass |
| Aggregate version missing/null/negative/fraction/string | 400 | Strict integer, Jakarta validation |
| Successful legacy PUT | 200, body cũ, ETag N+1 | Cùng CAS transaction, invalidate snapshot aggregate cũ |

Legacy null/empty/full-list semantics giữ nguyên. Riêng legacy confirmed-skills replacement vẫn cho thay toàn bộ confirmed links theo source contract; nó **không** ghi CV snapshots. Aggregate/editor chỉ thay MANUAL để không vô tình xóa provenance khác.

Đây là **breaking precondition** cho client bên ngoài không có If-Match; không tuyên bố wire compatibility cho unconditional PUT cũ. Không phát hiện external consumer trong repository; chưa chứng nhận client/deployment bên ngoài. Repository consumers được migrate: editor aggregate; Preferences/Settings lưu captured ETag và gửi lại, không fetch tag mới trước write; setup aggregate; legacy E2E/StudentSkillApiIT dùng precondition explicit. Không silently retry 409 với revision mới.

## Rollback, concurrent requests và browser evidence

Integration source: [StudentProfileAtomicApiIT](../../backend/src/test/java/com/tttn/jobrecommendation/integration/StudentProfileAtomicApiIT.java). Real browser: [P01–P04](../../e2e/tests/profile-atomic.spec.mjs). Unit transport/UI dùng HTTP mock và được ghi đúng là unit, không thay runtime evidence.

| Tình huống | Expected | Actual evidence |
|---|---|---|
| Full basic/profile/custom skill success | 200, N+1, tất cả persisted | IT fullSave; P01 chỉ một PUT chứa các nhóm chỉnh sửa |
| DTO summary quá dài | 400, không ghi bất kỳ phần/revision | IT nested validation; P02 full snapshot equality |
| Skill ID không tồn tại sau basic/profile edits | 404, rollback tất cả | IT skillResolution; P02 giữ nguyên complete snapshot |
| DB CHECK làm insert skill thất bại | 500 sanitized, rollback fields/catalog/revision | IT realSkillDatabaseFailure: user/profile đã flush, catalog upsert; sau lỗi snapshot bằng before và không còn catalog/studentSkill mới |
| Tab A/B cùng N | A 200/N+1; B 409, không đè A | IT staleTab + P01 hai tab login Student thật |
| Xem bản mới sau conflict | GET only; bản nháp B giữ nguyên | P01 giữ input, không thêm PUT; bảng so sánh hiện A/B |
| Retry bằng bản mới sau xác nhận | 200/N+2 | P01 xác nhận thay draft, nhập lại, save/reload/read-back |
| Hai aggregate requests cùng N trên PostgreSQL | Đúng một 200 và một 409 | IT realConcurrentPostgresRequests; winner basic/profile cùng giá trị, không torn state |
| Legacy vs aggregate cùng N | Đúng một 200 và một 409 | IT legacyAndAggregateCompete |
| 3 legacy PUT, missing/stale/current ETag | 428/409/200; mỗi success +1 | IT legacyEndpoints + P02 cả ba đường ghi |
| Non-MANUAL bảo toàn/giả provenance | ID/level/years giữ; giả/trùng bị 400 | IT manualReplacement + unit read-only source controls |
| Omitted/null/empty/explicit clear | Giữ/xóa theo contract, ngoài request không mất | IT clears + revision-only; unit scalar delta/null skill metadata |
| Student B gửi Student A ID; sai role | 400 injection / 403 role | IT ownership; P02 PRIMARY before/after equality |
| Hai Student tạo cùng custom catalog skill | Cả hai 200, một shared catalog ID | IT concurrentStudentsCreatingSameCustomCatalogNameReuseOneSkill |
| Auth-like stale timestamp write | Không undo name/phone aggregate | IT unrelatedStaleUserTimestampWrite |
| Offline/retry/double-click | Không false success; giữ draft; một successful mutation | P03 offline thật + Chromium network latency, không HTTP mock |
| Preferences/Settings tab cũ | 409 với captured If-Match, giữ draft | P04 hai consumer thật, không tự refresh tag/overwrite |

Frontend 409 giữ mọi scalar/skills draft, disable Save cũ, cho GET đối chiếu. GET mới không rebase draft; chỉ sau confirm dialog mới thay draft bằng server snapshot. Lỗi mạng cho retry có chủ đích bằng revision đã có; nếu request trước đã commit nhưng response mất, retry nhận 409 và phải đối chiếu. Không tự chọn bản thắng hay merge nội dung cho người dùng.

SQL execution evidence của DB-failure test trong log cuối: `22:10:37.331` CAS Student revision; `.340` UPDATE student_profiles; `.341` UPDATE users; `.346` INSERT catalog ON CONFLICT; `.356` INSERT student_skills; `.359` CHECK `atomic_test_failure` từ chối. Response 500 sanitized; GET sau rollback bằng toàn bộ snapshot trước và không có custom catalog/link mới. CHECK này chỉ tồn tại tạm trong isolated Testcontainers và được bỏ trong finally, không áp vào dev database.

P01 lượt full cuối: cùng tải **revision 25**, A gửi **một PUT** có `student/profile/manualSkills` → **200/revision 26**; B dùng 25 → **409**, draft giữ nguyên. GET đối chiếu không ghi/rebase. Sau confirm reload và nhập lại, B → **200/revision 27**, reload giữ dữ liệu. P02 tăng qua ba legacy successes; P03 offline retry tăng một; P04 session khác tăng một; snapshot secondary cuối **revision 32**.

## Verification và data preservation

- Backend `cd backend; .\mvnw.cmd -B -ntp clean verify`: **BUILD SUCCESS, 481 tests = 247 Surefire + 234 PostgreSQL Failsafe**, 0 failures/errors/skips; kết thúc `2026-11-03T22:10:38+07:00`. **15 StudentProfileAtomicApiIT** cases pass, cộng 4 legacy StudentSkillApiIT và toàn bộ Auth/CV/Application/Recommendation/Ranking/moderation regression cũ.
- Frontend `npm.cmd run test:run`: **152 tests / 23 files PASS**; lint zero warnings; TypeScript/Vite production build PASS. Existing >500 kB bundle warning còn. Unit mock được dùng cho transport/draft behavior; không dùng làm bằng chứng E2E.
- AI existing locked environment: pip check PASS, **887 pytest PASS**, một Starlette/httpx deprecation warning. Chạy regression theo AGENTS, không sửa/reinstall dependency, NLP, CV pipeline hoặc scoring.
- Real Chromium/Backend/PostgreSQL/AI full suite: **40/40 PASS**, 0 fail/skip/flaky/retry ở lượt cuối, một worker: 36 tests cũ + P01–P04. Bắt đầu `2026-11-03T15:31:05.506Z`, duration **142.98 giây**. P02 ghi 15 expected/actual HTTP checks, 0 mismatch; P01/P03/P04 có browser/read-back assertions riêng. Không mock HTTP; offline/latency là network controls của Chromium.
- Đã có một lượt trước **39/40** do B06 Company application detail báo lỗi tải sau reload dù Backend log HTTP 200. Không đủ client transport evidence để chốt root cause. Giữ artifact, bổ sung request-failure/body-status evidence cho tab Company và context cleanup trong finally; **giữ toàn bộ UI/persistence assertions**, thêm assert response 200/REVIEWED. Lượt full sau pass; không thêm retry/skip/tăng timeout hay thay production Application flow. Không tuyên bố chưa từng có lỗi môi trường/browser.
- Setup aggregate chạy hai lần PASS, không replace hồ sơ đã populate. Toàn bộ profile PUT consumers trong frontend/e2e/tests đã cập nhật; audit thêm scripts/performance chỉ thấy GET/POST ngoài các đường đã xử lý, không tìm thêm legacy profile PUT caller. Không chứng nhận consumers bên ngoài repo.

Rebuild bằng `docker compose up -d --no-deps --build backend`; sau full suite capture API snapshots rồi chạy `docker compose up -d --no-deps --force-recreate backend`. Không down/reset/volume rm hoặc SQL write vào dev. PostgreSQL/AI giữ containers tạo `2026-11-03T11:44:31Z`; Backend sau recreate tạo `15:34:14.681Z`; cả ba healthy. Named volumes `student-job-recommendation-system_postgres_data` và `student-job-recommendation-system_cv_uploads` giữ nguyên. Read-only SQL xác nhận **19 successful migrations / max V19**, **0 null/negative revisions**.

Read-back sau recreate lúc **2026-11-03T15:36:35.782Z** bằng [verify-profile-persistence](../../e2e/verify-profile-persistence.mjs): complete aggregate snapshots của PRIMARY và studentUi bằng trước recreate, **cả revision/timestamps/skills**. PRIMARY revision **15**, secondary **32**. Nội dung PRIMARY basic/profile/skills cũng bằng baseline trước task khi bỏ timestamps; revision tăng do các positive A02/B03 regression có cleanup, không do negative cases. Không dùng PRIMARY để tạo conflict/rollback/DB-failure scenarios.

[Comparator](../../e2e/verify-preservation.mjs) với baseline `profile-atomic-baseline.json` lúc `14:43:31.148Z` và after lúc `15:36:35.848Z` PASS:

- Giữ **10 alias hiện hữu** (9 E2E cũ + moderation), cùng User ID/resource ID/role/status, không thêm/xóa alias hoặc đổi credentials.
- Giữ **4 CV cũ READY**, ID/filename/active/language/processingVersion; PRIMARY CV 1 VI DOCX active và CV 2 EN PDF còn nguyên.
- Giữ **16 Job PRIMARY** theo các trường snapshot id/title/status/deadline/skills và **3 Application PRIMARY** 24/9/1 với job/status/CV cũ. Không đổi jobs/corpus hàng loạt; moderation fixtures riêng vẫn được tái dùng.
- Public counts giữ **20 Jobs / 4 Companies / 6 Students**. Application history **42→51** do 3 rounds reapplication phụ hợp lệ ở A09 trong ba lượt full suite; không duplicate active pairs hoặc thay PRIMARY history.
- studentUi là secondary fixture có nội dung được chỉnh có chủ đích để kiểm atomic save/two-tab/persistence. Không suy ra account đó giữ nguyên display name/profile text; PRIMARY content và tất cả identity/CV/Job protections mới là đối chiếu trước task. Comparator không chứng nhận byte toàn bộ database/CV files.

Artifacts local, gitignored: `profile-baseline-partial-evidence.json`, `profile-{targeted-backend,backend-verify,frontend-tests,frontend-lint,frontend-build,ai-pip-check,ai-tests,backend-rebuild,backend-recreate}.log`, `profile-setup-{1,2}.log`, `profile-final-{e2e.log,results.json}`, `profile-atomic-evidence.json`, `profile-before-recreate.json`, `profile-persistence-evidence.json`, `p0-preservation-evidence.json`, `profile-e2e-reload-failure.{json,log}`, `company-reload-evidence.json`. No authenticated traces/video; credentials/raw screenshots/CVs không commit. Git diff/check và staged credential/artifact scan **PASS: 47 paths, không có private/generated artifact hoặc local credential values**. Work-package diff không sửa AI, Recommendation/Candidate Ranking source, corpus/scoring hoặc released Flyway V1–V18.

## Giới hạn

Không thay AI/CV processing V2, TF-IDF/Cosine, Recommendation V3/Ranking V3, eligibility/corpus/ranks/scores. Manual profile search text giữ normalization cũ, không thay CV preprocessing. Các migration/V3 regression assertions cũ được giữ; chỉ expected latest migration tăng 18→19 và thêm default-zero checks trên legacy fixtures.

Revision bảo vệ owned profile state; không đại diện lịch sử chỉnh sửa metadata catalog chung bởi Admin. UI không hỗ trợ tự merge conflict, không phục hồi draft sau đóng tab hoàn toàn; draft được giữ trong tab sống với beforeunload warning. Preferences/Settings giữ precondition và draft khi conflict; người dùng có thể quay về profile editor để đối chiếu. Không có chứng nhận exhaustive accessibility/performance hoặc external client compatibility. PR #66 giữ Draft, không merge.

B06 có một lần reload/transport failure chưa chốt nguyên nhân như mô tả trên; lần full cuối có cả HTTP body và UI assertions PASS. Không coi lần pass sau là chứng minh nguyên nhân đã được sửa hoặc toàn bộ sản phẩm hết transient errors.

Điều tra tiếp trên baseline `71381b34`: xem [diagnostic B06 và P1 own-jobs](company-jobs-pagination-b06-results.md). Kết luận hiện tại vẫn **UNRESOLVED / NOT REPRODUCED**; giữ nguyên quan sát lỗi lịch sử ở báo cáo này.
