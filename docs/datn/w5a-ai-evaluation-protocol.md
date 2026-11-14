# W5-A — Protocol đánh giá Student Recommendation V3 bằng nhãn người

**Trạng thái: PROTOCOL READY FOR EXECUTION — HUMAN LABELS REQUIRED. Thí nghiệm chất lượng thật: NOT EXECUTED.** Đây là kế hoạch và kiểm chứng tooling, không phải kết quả chất lượng recommendation. Các số cỡ mẫu bên dưới là **mục tiêu**, không xác nhận đã có dữ liệu/người tham gia. Không có Precision@5/Recall@5/F1@5/NDCG@5 thật để công bố.

Chuẩn bị ngày 2026-11-12 từ remote `master@7715e12ed691dec1e544395a70768f0bbd1372f3`, đã xác minh trước worktree; branch `docs/datn-w5a-recommendation-evaluation-protocol`, worktree `.worktrees/datn-w5a-recommendation-evaluation-protocol`. Chỉ thêm ba tài liệu W5-A: protocol này, [hướng dẫn chấm](w5a-human-annotation-guide.md), [mẫu báo cáo](w5a-ai-evaluation-report-template.md). Không thay production AI/Backend/Frontend/Auth, V1–V25, dependency, weights, tier/rank hoặc password recovery.

## 1. Câu hỏi và phạm vi

Câu hỏi nghiên cứu: với một corpus Job đủ điều kiện đã đóng băng, năm Job đầu của **Student Recommendation V3** phù hợp tới mức nào với đánh giá độc lập của người am hiểu tuyển dụng IT, xét kỹ năng, định hướng/chuyên ngành, kinh nghiệm và trình độ thể hiện trong CV?

| Loại bằng chứng | Ý nghĩa | Không được suy ra |
|---|---|---|
| Functional correctness: CI/Core Smoke/E2E ở [W4-D](w4d-final-acceptance-report.md) | API, persistence và V3 semantics hoạt động trong coverage đã ghi | Không chứng minh độ phù hợp với nhu cầu người dùng |
| Ranking effectiveness: thí nghiệm này | So thứ tự Backend thực với ground truth người chấm | Cần nhãn độc lập, không lấy score/explanation làm nhãn |
| Production readiness | Deployment, vận hành, security, backup/restore | Ngoài thí nghiệm học thuật; audit sạch/metric cao không chứng nhận production |

Chỉ nghiên cứu luồng **Student CV → Job**. Không gộp Company Candidate Ranking hoặc legacy V2 component experiment vào kết quả Student V3. Không dùng nhãn/pilot này để tune rồi báo như held-out test; nếu phát triển model sau nghiên cứu phải có tập đánh giá độc lập mới.

## 2. Tooling hiện có và dữ liệu thực sự sẵn có

Đã audit toàn bộ tài liệu/script/template/example tracked trong `ai-service/evaluation/` và năm test modules evaluation. Source of truth: [README](../../ai-service/evaluation/README.md), [V3 guide](../../ai-service/evaluation/v3-prediction-evaluation.md), [V3 contract](../recommendation-ranking-v3-contract.md).

| Module | Vai trò được xác nhận |
|---|---|
| [annotation.py](../../ai-service/evaluation/annotation.py) | Prepare packet shuffle riêng theo reviewer; review kiểm đủ cặp/nội dung bất biến, exact agreement và blank disagreements; finalize xuất CSV sau quyết định thủ công |
| [dataset.py](../../ai-service/evaluation/dataset.py) | JSON/CSV schema, unique IDs, labels 0/1/2, đúng một nhãn/cặp và Cartesian completeness; `prediction_evaluation=True` chấp nhận all-zero CV |
| [predictions.py](../../ai-service/evaluation/predictions.py) | Load actual V3 run/envelope; ưu tiên persisted rankPosition, kiểm tiers/counts/nullability/score consistency; không chạy scoring |
| [prediction_runner.py](../../ai-service/evaluation/prediction_runner.py) | Đánh giá frozen V3 predictions với external labels, macro metrics, hashes và sanitized artifacts; standard library, không gọi API/AI/DB |
| [metrics.py](../../ai-service/evaluation/metrics.py) | Precision, Recall, per-query F1, graded DCG/NDCG theo các quy ước ở §7 |
| [runner.py](../../ai-service/evaluation/runner.py) | **Legacy V2**: gọi production V2 và dựng component rankings; chỉ kiểm tooling/compatibility, không dùng làm thí nghiệm V3 |
| Templates, `__init__.py`, `examples/toy-v1/` và annotation fixtures | Format/example hỗ trợ; toy có 2 CV, 6 Job, 12 nhãn và 2 prediction runs **tự viết SYNTHETIC**, không phải human study hoặc persisted Backend runs |

Giới hạn tooling cần giữ nguyên, không lách bằng thay nhãn:

- Annotation source loader cần ít nhất một skill string ở mỗi CV/Job và tối đa 100 Job. Primary pilot chọn tài liệu IT có kỹ năng **thực sự được nêu**; ghi hạn chế này trong sampling. Không bịa skill để qua prepare. Nếu muốn nghiên cứu nguồn `skills=[]`, cần ghi deviation trước freeze và tổ chức annotation external đầy đủ, không âm thầm loại vì model làm kém.
- Finalizer cũ yêu cầu ít nhất một nhãn >0/CV; **review** vẫn nhận packet all-zero. V3 dataset loader/evaluator chấp nhận all-zero. [Guide §5](w5a-human-annotation-guide.md#5-hoàn-thành-ground-truth-và-cv-all-zero) mô tả export ba cột thủ công + validate V3, không sửa nhãn hoặc code.
- CLI `HUMAN_LABELED` là lời khai của operator, không xác minh consent hay reviewer độc lập. Adapter không tái tính cosine/skill coverage/hybrid formula từ historical inputs; Backend vẫn là chủ thể validate/rank.

Trong worktree mới chưa có `evaluation/private/`; `evaluation/work/w5a-tooling/` chỉ chứa kiểm chứng SYNTHETIC của W5-A. Workspace gốc có thư mục ignored private; chỉ kiểm tra metadata tồn tại, **không mở/copy private contents**. Chưa được cung cấp bộ consent, reviewers, adjudication hoặc capture thật đã xác minh cho tác vụ này. Không kết luận dữ liệu không tồn tại ở nơi khác; kết luận đúng là **chưa có dataset/predictions thật được xác minh để tính final metrics**.

## 3. Thiết kế pilot và sampling trước khi xem predictions

**Mục tiêu khoảng 10 CV của 10 người IT khác nhau, 30–50 Job; điểm hoạch định là 40 Job.** Như vậy có 300–500 cặp ground truth (điểm hoạch định 400), hai reviewer chấm 600–1.000 quyết định ban đầu (điểm hoạch định 800), cộng adjudication các bất đồng. Giả định lập lịch 1–3 phút/cặp/reviewer tương đương khoảng 10–50 giờ-người, chưa gồm đào tạo/de-identification/adjudication; đây không phải thời gian đã đo. Không có reviewer nào được gán danh tính trong tài liệu này.

Sampling có phân tầng có chủ đích từ pool được phép tiếp cận, không tuyên bố probability sample đại diện thị trường. Người quản lý ghi pool size, thứ tự tuyển, tiêu chí, lựa chọn/từ chối và lý do **trước** annotation/predictions; không chọn CV/Job dựa vào score. Cỡ mẫu thực tế và mọi thay đổi quota phải chốt trước khi chạy, không thay sau khi xem kết quả.

| Nguồn | Inclusion dự kiến | Exclusion / kiểm soát |
|---|---|---|
| CV | IT Student/sắp tốt nghiệp/mới tốt nghiệp, hướng internship/junior; bản PDF/DOCX đọc được và bản text ẩn danh giữ đủ ý; có consent và ít nhất một skill được nêu; một CV/người | Không consent, không được phép chuyển giao, không thể de-identify, trùng người/template gần như giống hệt; log lý do trước freeze. Không loại do không có Job phù hợp, low confidence hay điểm thấp |
| Job | Internship/junior IT có title/description/requirements đủ để chấm, kỹ năng được nêu, nguồn được phép dùng; trạng thái đủ điều kiện trong isolated study Backend | Không có quyền sử dụng/confidential chưa được phép, thiếu nội dung, duplicate/near-duplicate cùng role, senior-only ngoài population đã chọn; không chỉ chọn Job dễ/khớp CV |
| Phạm vi kỹ thuật | Backend, frontend/fullstack, mobile, QA/testing, data/ML và DevOps/cloud; gồm adjacent-role/hard negatives tự nhiên | Không đồng nhất relevance với đếm keyword; không tạo negatives giả để nâng metric |
| Ngôn ngữ | Mục tiêu CV: 4 tiếng Việt, 4 tiếng Anh, 2 bilingual/mixed; Job khoảng cân bằng VI/EN, giữ nguyên thuật ngữ kỹ thuật | Là quota dự kiến, ghi actual riêng; không dịch lại CV/Job để ép PRIMARY. Low-confidence/mixed xử lý theo production V3 và được phân tích mô tả |

Phân tích này chỉ nói về **frozen corpus 30–50 Job**. Recall không có nghĩa tìm hết Job phù hợp trên thị trường. Không cố bảo đảm mỗi CV có nhãn dương bằng sửa corpus sau annotation. Không claim statistical significance hoặc generalization mạnh từ pilot ~10 CV; báo từng CV, phân bố label, trường hợp lỗi và sự phụ thuộc do dùng chung Job corpus.

## 4. Quyền sử dụng, ẩn danh và đóng băng

1. Trước khi thu thập, coordinator có authorization/consent phù hợp mục đích luận văn, phạm vi xử lý, ai được đọc, retention/deletion date và quyền rút trước freeze. Lưu consent reference riêng, không đưa giấy tờ/danh tính vào packet. Nếu rút sau freeze, dừng phát hành, xử lý theo consent và version lại toàn bộ dataset/experiment; không lặng lẽ bớt CV để tăng mean.
2. Gỡ tên, email, điện thoại, địa chỉ, ngày sinh, ảnh/chữ ký, mã SV, profile/GitHub/LinkedIn URL, tên file/metadata PDF-DOCX, tên khách hàng/project/công ty nội bộ và chi tiết có thể tái nhận diện. Tổng quát hoá cơ sở đào tạo/nơi làm việc khi cần, giữ degree/major/technical responsibilities/experience-level. Coordinator kiểm thủ công bản export, metadata và text; ghi log thay thế riêng. Không gửi CV thật chưa được phép tới dịch vụ ngoài.
3. Store actual research material **chỉ dưới** ignored `ai-service/evaluation/private/` và `ai-service/evaluation/work/`. Từ `ai-service/`, dùng `evaluation/private/pilot-v1/` cho source đã ẩn danh, consent references/mapping tách quyền truy cập, `cvs.json`, `jobs.json`, sau này `judgments.csv`, frozen captures/manifest; `evaluation/work/pilot-v1-*` cho packets, reviews, notes, evaluation output. Bản gốc cần giữ chỉ trong private với quyền chặt hơn; không sao chép vào Git/PR/CI/chat.
4. Gitignore không phải access control. Dùng thư mục nghiên cứu có OS/drive permissions: coordinator giữ mapping/consent; mỗi reviewer chỉ nhận packet của mình, không đọc packet người kia/predictions; operator capture không đồng thời là người chấm. Notes cũng là private research material; không ghi thêm PII vào notes.
5. CV/Job JSON dùng **đúng** `id` positive integer, `text` nonblank, `skills` array; không thêm metadata vào object schema. `text` là raw text đã ẩn danh để người đọc đánh giá, không thay bằng processedText. `skills` lấy từ nguồn khai báo/curation có chứng cứ, không lấy AI matched/missing skills hoặc score để tạo nhãn. Freeze file bytes UTF-8 không BOM, nguồn/phiên bản và mọi chỉnh sửa ẩn danh trước packet.
6. Primary ID policy: sau provisioning môi trường riêng, dùng **actual positive Backend CV/Job IDs** trong JSON và judgments ngay từ đầu, giữ pseudonym S01/J01 ở mapping private. Hai namespace phải có mapping đóng băng và hash; không dùng student/user ID thay CV ID. Không remap sau khi xem kết quả. Nếu relocation bắt buộc remap, version mới, lưu raw GET gốc và map song ánh tất cả CV/Job IDs nhất quán; tuyệt đối không sửa ranks/scores hay tự viết predictions.
7. Freeze corpus chỉ gồm J Job `ACTIVE`, Company `VERIFIED`, deadline null hoặc chưa hết hạn tại ngày Backend. Xác nhận đúng **membership IDs, text, requirements, canonical/declared skills**, company/status/deadline và timestamps trước/sau từng generation; không chỉ count. Dùng cùng corpus cho mọi CV, không có hidden eligible Job khác. Dự kiến deadline có buffer qua toàn bộ collection window; ghi timezone/ngày server. Provision/verify qua API Admin/Company hợp lệ, không bypass moderation hoặc sửa demo DB.
8. Snapshot CV file được upload thực, persisted READY `processedText`, extracted/canonical skills, languageCode/confidence, processingVersion, analyzedAt và hash trước/sau capture. Model chỉ dùng snapshot READY; không tái preprocess/detect CV trong V3. Nguồn annotation vẫn là bản ẩn danh đầy đủ; parser lỗi/mất nội dung là điều cần quan sát, không sửa nhãn để khớp parser.

## 5. Hai reviewer và ground truth

Hai người có năng lực đánh giá internship/junior IT và đọc VI/EN chấm độc lập theo [guide](w5a-human-annotation-guide.md). A01/A02 chỉ là **mã vai trò mẫu**, chưa có danh tính/chữ ký/nhãn thực. Loại/xử lý conflict of interest trước phân công, không để chủ CV tự chấm. Tập huấn bằng ví dụ SYNTHETIC ngoài sample; chốt rubric rồi khoá trước main annotation.

Prepare packet bằng workflow hiện có; reviewers chỉ thấy CV/Job đã ẩn danh, không có AI score/rank/tier/explanation/matched-skill output hay metrics. Mỗi reviewer chấm **mọi cặp**, không chỉ top5. Review giữ raw decisions, đo exact agreement trước thảo luận; người chấm giải quyết bất đồng từng cặp thủ công, ghi căn cứ. Không average/majority vote tự động, không để model chốt. Nếu không thể thống nhất, chuyển người adjudicator được chỉ định trước; nếu vẫn chưa có nhãn cuối, **HUMAN LABELS REQUIRED**, chưa evaluate. Tool không tính Cohen's kappa; không gọi exact agreement là kappa hoặc statistical significance.

Ground truth cuối `judgments.csv` có đúng header `cv_id,job_id,relevance`, đúng **N×J dòng dữ liệu**, unique/known pairs, một label integer 0/1/2 mỗi cặp, không blank. All-zero CV được giữ và tính vào macro. Giữ raw independent packets, disagreement log và hash từng artifact trong private/work; người quản lý kiểm tra completeness và signing sheet trước freeze `adjudicated-v1`. Không thay labels/K/corpus/threshold sau khi mở predictions để làm metric đẹp hơn.

## 6. Capture predictions thật: procedure, chưa thực thi

**NOT EXECUTED trong W5-A.** Không gọi Backend, Docker hoặc database; không kết nối, query, hash hay mutate preserved demo DB. Người vận hành sau này phải có môi trường nghiên cứu disposable riêng, đúng source SHA, owned project/images/volumes/storage, loopback/ports và cleanup đã review. Không dùng Core Smoke pre-READY fixture, runner V2 hoặc runner dùng shared resources để giả một study cohort. Chưa có provisioning/capture runtime của cohort thật được xác nhận ở đây.

Protocol collection gồm hai giai đoạn: bước1 là chuẩn bị sau G0, trước source/packet freeze và annotation; bước2–8 chỉ sau G3 (nhãn đã được kiểm và đóng băng):

1. Provision đúng corpus và CV đã ẩn danh từ §4 qua existing auth/upload/analysis/moderation APIs, ghi IDs trước annotation. Hoàn tất READY snapshot trước scoring; không dùng production/demo data. Không đổi production weights, preprocessing, tier rule, eligibility hoặc ranking. Sau annotation/adjudication freeze, operator mở generation; reviewers tiếp tục không được xem model output cho tới khi labels khoá.
2. Đăng nhập bằng **Student sở hữu từng CV**. Tạo đúng một scheduled request/CV: `POST /api/students/me/recommendations/generate`, body `{ "cvId": <actualCvId>, "threshold": 0, "limit": J }`. J là **actual frozen Job count** 30–50, không chuỗi "J" và không con số lấy sau results; giới hạn public 1–100 đáp ứng. Chọn threshold0/limitJ để capture toàn bộ candidate ordering, không bỏ zero-score Job và sau đó evaluator mới lấy K5. Đây là cấu hình thí nghiệm cố định, không sửa default/production scoring.
3. Trước khi POST, lưu request body/threshold/global limit, owner pseudonym/CV ID, source/algorithm/catalog versions, corpus/snapshot hashes và thời điểm/timezone vào manifest private. Không log password/JWT/header; chỉ giữ token trong memory/session bảo vệ. Exclusive collection window, không sửa Job/Company/CV hoặc reanalyze giữa các run. Nếu corpus/text/hash/date eligibility thay đổi, stop; không trộn runs từ corpus khác.
4. Nhận runId từ response, xác nhận SUCCESS; **bắt buộc gọi thật** `GET /api/students/me/recommendation-runs/{runId}` bằng owner tương ứng. Lưu nguyên JSON body GET vào `evaluation/private/pilot-v1/captures/run-<id>.json` bằng UTF-8 (exact response bytes nếu collector hỗ trợ), ghi method/path/status, capture time và SHA-256 file. Không lấy latest-results-only, generation response thay GET, screen scrape hay mẫu JSON tự viết làm prediction evidence. Chỉ có synthetic fixture khi kiểm tooling, không cho study thật.
5. Check GET `id`, `cvId`, `sourceType=CV`, SUCCESS, `algorithm=tfidf-cosine-hybrid`, `algorithmVersion=bilingual-recommendation-v3`, `totalJobsScanned=J`, `totalRecommended=len(results)` và actual CV identity. Với planned threshold0/limitJ, đối chiếu returned Job IDs với frozen corpus; thiếu/thừa không mong đợi là gate cần điều tra, không tự fill/rerank hoặc bớt judgments. `totalJobsScanned=J` **không tự chứng minh membership**; cần snapshots nguyên corpus trước/sau và môi trường không có writers khác.
6. Dùng persisted `rankPosition` contiguous 1..N làm **official order**; giữ `tierRankPosition` đúng trong mỗi tier. PRIMARY trước FALLBACK kể cả FALLBACK score cao hơn; trong tier score không tăng. Không sort lại rounded scores hoặc jobId khi score tie: Backend rank trước làm tròn 5 decimals. **Không dùng `--allow-unranked`** cho primary study. Snapshot score components nullability/tier/strategy phải đúng V3; adapter không thay thế Backend semantic validation.
7. Gộp **nguyên run envelopes/data từ các GET thật** thành JSON array private `predictions.json`, đúng một chosen SUCCESS cho mỗi CV nhãn; không sửa score/rank hoặc tạo run SUCCESS giả. Policy một scheduled attempt/CV, không thử nhiều run rồi chọn tốt nhất. Timeout/FAILED/missing/ambiguous provenance: ghi operational failure và stop final cohort evaluation; không âm thầm bỏ CV, coi failed request là empty SUCCESS, hoặc retry để chọn điểm đẹp. Sửa setup thì version experiment/capture lại theo quyết định đã ghi trước khi mở metric; giữ audit trail.
8. Record/hashes CV snapshot/corpus lần nữa; freeze captures + manifest + predictions array sau khi mọi check đạt. Evaluation offline không gọi lại scoring, không split TF-IDF corpus/batch. Source job text/metadata có thể thay đổi theo thời gian nên historical read không thay cho input snapshots tại generation.

Các API/eligibility đã đối chiếu [RecommendationController](../../backend/src/main/java/com/tttn/jobrecommendation/modules/recommendation/controller/RecommendationController.java), [request DTO](../../backend/src/main/java/com/tttn/jobrecommendation/modules/recommendation/dto/request/GenerateRecommendationRequest.java), [corpus builder](../../backend/src/main/java/com/tttn/jobrecommendation/modules/recommendation/service/impl/EligibleJobCorpusV3Builder.java), [JobRepository](../../backend/src/main/java/com/tttn/jobrecommendation/modules/job/repository/JobRepository.java), [run entity](../../backend/src/main/java/com/tttn/jobrecommendation/modules/recommendation/entity/RecommendationRun.java) và [API contract](../api-contract.md). Student history hiện **không persist** requestId, score threshold/global limit, immutable corpus/text fingerprint hoặc CV analysis input snapshot. Phải ghi ở thời điểm collection; thiếu historical provenance thì để UNKNOWN, không điền guessed values/hashes rồi claim exact scoring replay.

## 7. Metrics đăng ký trước và quy ước evaluator

Primary: **Precision@5, Recall@5, F1@5**, binary relevant iff human label **≥1**. Supplementary: **NDCG@5**, dùng cả grades 0/1/2. Không thay K/label threshold hoặc thêm tuned subgroup sau khi thấy scores. Generation score threshold0 là tham số **khác** binary relevance threshold1 và cutoffK5.

Với CV q, tập Job cố định D; y(q,j)∈{0,1,2}; Lq là thứ tự prediction official; mq=min(5,|Lq|), hq là số label≥1 trong mq kết quả đầu, aq là số label≥1 trong **toàn D**:

$$P_q@5=\begin{cases}h_q/m_q&m_q>0\\0&m_q=0\end{cases},\quad R_q@5=\begin{cases}h_q/a_q&a_q>0\\0&a_q=0\end{cases}$$

$$F1_q@5=\begin{cases}2(P_q@5)(R_q@5)/((P_q@5)+(R_q@5))&P_q@5+R_q@5>0\\0&\text{otherwise}\end{cases}$$

$$DCG_q@5=\sum_{r=1}^{m_q}\frac{2^{y(q,L_q[r])}-1}{\log_2(r+1)},\quad NDCG_q@5=\begin{cases}DCG_q@5/IDCG_q@5&IDCG_q@5>0\\0&IDCG_q@5=0\end{cases}$$

IDCG lấy grades của **tất cả Job đã chấm**, sắp lý tưởng giảm dần rồi lấy tối đa5; không chỉ lấy predictions. Với M là từng metric trên, macro(M)=sum_q Mq/N, mọi CV có trọng số bằng nhau, gồm all-zero. Macro F1 là **mean của per-CV F1**, không harmonic mean của macro P/R. `summary.json` và CSV format metrics 6 decimals; evaluator tính trước rounding summary. Không tính lại công thức bằng spreadsheet riêng để thay kết quả evaluator.

| Edge case | Quy ước hiện có, giữ nguyên |
|---|---|
| Ít hơn 5 predictions hợp lệ | Precision chia mq thực có, **không padding tới5**; Recall vẫn chia mọi relevant Job trong D; NDCG ideal vẫn từ D. Ghi retrievedCountAtK để không giấu short lists. Khác quy ước fixed-denominator P@5 khi trả <5, phải nêu khi so nghiên cứu khác |
| Không prediction | Per-CV P/R/F1/NDCG =0; chỉ áp dụng cho **actual valid SUCCESS empty run**, không fabricated run cho lỗi vận hành |
| Không relevant Job | Tại primary threshold1, tất cả labels0 → P/R/F1/NDCG=0; vẫn nằm trong macro N. Không loại để tăng mean |
| Chỉ label1 ở secondary threshold2 | Binary R/F1 có thể0 nhưng graded NDCG vẫn dương; pilot này **không chạy threshold2**, nhắc để không hiểu sai quy ước |
| Unjudged/missing/duplicate/unknown pair hoặc invalid ranks | Fail validation; không mặc định label0, không tạo partial academic results |

`rankingScore` không phải Precision/Recall/F1, probability, model confidence hoặc “độ chính xác”. PRIMARY hybrid0.65/0.35 và FALLBACK skill-only không cùng calibrated overall scale; giữ tier order khi evaluate. Một FALLBACK skillScore1 không có nghĩa recommendation quality100%. Các định nghĩa triển khai là [metrics.py](../../ai-service/evaluation/metrics.py); tham khảo nền tảng IR [Manning, Raghavan & Schütze, chương Evaluation](https://nlp.stanford.edu/IR-book/pdf/08eval.pdf). Công thức/quy ước cụ thể của study được đối chiếu code, không quy mọi biến thể short-list/gain cho tài liệu tham khảo.

## 8. Provenance và gates trước final metrics

Coordinator điền rồi đóng băng bản ghi private sau, không commit thông tin thực vào protocol công khai. `experiment.json` phải là JSON object khi dùng CLI; tool chỉ hash bytes của nó, không tự chứng nhận các trường.

Phân tách **input manifest** và **execution record**: `experiment.json` freeze sau capture/G4, trước evaluation; không chứa hash của chính nó, output hashes hoặc evaluationId chưa tạo. Hash của manifest cùng output hashes/evaluationId lưu vào bản ghi hậu kiểm riêng dưới `evaluation/work/pilot-v1-result-v1/` sau execution; không sửa input manifest đã hash để tránh tự tham chiếu hoặc đổi identity của experiment.

| Trường cần ghi | Giá trị thật / hash / người xác nhận (để trống khi chưa có) |
|---|---|
| protocol version/SHA, ngày chốt trước annotation/results; deviations | |
| datasetVersion, labelVersion, sampling pool/quota thực, inclusion/exclusion log | |
| consent/anonymization/retention references; reviewer eligibility/conflicts/blinding sign-off | |
| raw independent packets, agreement summary, manual adjudication log, final judgments hashes | |
| source commit Backend/AI, image digests/build recipe, runtime/installed package inventory, requirements.lock SHA; skill/alias catalog SHA | |
| frozen corpus IDs, source text/requirements/skills/status/Company/deadline snapshots và hashes trước/sau mỗi run | |
| private ID map hash; sanitized CV file SHA; annotation text/skills source; persisted READY snapshot hash + language/confidence/version/analyzedAt | |
| per-CV generation body threshold0/limitJ/CV ID, request time/timezone; actual GET runId/status/timestamps; raw GET file hash | |
| cvs.json, jobs.json, judgments.csv, predictions.json exact input file SHA-256; manifest SHA; evaluator module hashes | |
| failure/attempt log và chosen-run rule; complete coverage N×J, exactly one real SUCCESS/CV; no corpus drift sign-off | |
| output hashes/evaluationId, Python version, pip check/environment evidence; approval to publish anonymized aggregates only | |

Gates: **G0** authority/de-identification → **G1** frozen source/corpus/IDs/protocol → **G2** two independent complete packets → **G3** manual adjudication/completeness/final-label freeze → **G4** verified real captures/provenance/no drift → **G5** offline validation/evaluation. Bất kỳ thiếu nhãn thật: **HUMAN LABELS REQUIRED**; thiếu prediction/provenance: **REAL PREDICTIONS REQUIRED / NOT EXECUTED**. W5-A dừng trước G5 cho study thật.

Chỉ sau G0–G4, từ `ai-service/`, trong environment Python3.11 đã xác minh:

```powershell
# FUTURE REAL STUDY ONLY — không thực thi bằng dữ liệu thật trong W5-A
python -m evaluation.prediction_runner --dataset evaluation/private/pilot-v1 --predictions evaluation/private/pilot-v1/predictions.json --ground-truth-kind HUMAN_LABELED --k 5 --relevance-threshold 1 --dataset-version pilot-v1 --label-version adjudicated-v1 --experiment-manifest evaluation/private/pilot-v1/experiment.json --output-dir evaluation/work/pilot-v1-result-v1
```

Không ghi đè inputs hoặc output cũ; dùng output version riêng. Giữ bốn artifacts `summary.json`, `per_cv.csv`, `rankings.csv`, `predictions.json` dưới work. `summary` hash exact bytes inputs, manifest, evaluator modules, requirements.lock và Python version, có run identities/order sources và evaluationId. Hash lock không chứng minh installed packages; record môi trường capture và evaluator riêng. Reproduce evaluation từ frozen predictions không đồng nghĩa tái tạo historical scoring. Identical bytes/config/tooling/Python và cùng dataset basename cho output byte identity; đổi newline, mapping hoặc manifest là input version mới. Sanitized output vẫn có IDs và relevance, không tự động được phép công bố.

## 9. Kiểm chứng W5-A thực chạy, chỉ SYNTHETIC/tooling

Python **3.11.9**, pytest **9.1.1**; tái sử dụng interpreter `.worktrees/datn-w4b-integrated-regression/ai-service/.venv/Scripts/python.exe` có sẵn để chạy source/tests từ worktree W5-A, `PYTHONDONTWRITEBYTECODE=1`. Không install/update hay sửa package ở worktree kia; không claim có OS read-only mount. Hai requirements.lock bằng nhau, SHA-256 `3078134f7fbc3d1c1de848300df28f8ca1dd32a317d94cc8b6712270af46fc37`; `pip check` exit0, “No broken requirements found”. Đây là compatibility check, không phải re-certification wheel hashes hay environment của study chưa chạy.

Từ `ai-service/`, `$taskPython` là interpreter trên (resolve absolute path), đã thực thi:

```powershell
$taskPython = [IO.Path]::GetFullPath('../../datn-w4b-integrated-regression/ai-service/.venv/Scripts/python.exe')
$env:PYTHONDONTWRITEBYTECODE = '1'
& $taskPython -m pip check
& $taskPython -m pytest tests/test_evaluation_metrics.py tests/test_evaluation_dataset.py tests/test_evaluation_runner.py tests/test_evaluation_annotation.py tests/test_evaluation_predictions.py -q --junitxml=evaluation/work/w5a-tooling/evaluation-tests.xml
& $taskPython -m evaluation.annotation prepare --dataset evaluation/examples/toy-v1 --annotators A01 A02 --output-dir evaluation/work/w5a-tooling/SYNTHETIC-blank-packets --seed w5a-synthetic-only
& $taskPython -m evaluation.annotation review --dataset evaluation/examples/toy-v1 --annotations-dir evaluation/examples/toy-v1/annotations --output-dir evaluation/work/w5a-tooling/SYNTHETIC-review
& $taskPython -m evaluation.annotation finalize --dataset evaluation/examples/toy-v1 --adjudication evaluation/examples/toy-v1/annotations/judgments.adjudication.synthetic-completed.csv --output evaluation/work/w5a-tooling/SYNTHETIC-finalized/judgments.csv
& $taskPython -m evaluation.prediction_runner --dataset evaluation/examples/toy-v1 --predictions evaluation/examples/toy-v1/student-v3.predictions.synthetic.json --ground-truth-kind SYNTHETIC --k 5 --relevance-threshold 1 --dataset-version toy-v1 --label-version synthetic-v1 --output-dir evaluation/work/w5a-tooling/SYNTHETIC-v3-output
```

**114 PASS, 0 FAIL/ERROR/SKIP, 3.72s**: metrics33, dataset24, legacy runner4, annotation16, predictions37. Existing tests kiểm all-zero/empty/short-list/threshold/macros, packet completeness/tampering/manual conflicts, V3 official rounded ties/tier order, malformed evidence, privacy export, hashes/determinism. Không thêm/bớt/relax tests. Bốn CLIs demo exit0; prepare sinh packet **blank**, review/finalize đọc **completed synthetic fixtures có sẵn**, không điền nhãn cho người thật. V3 demo: 2 CV/6 Job/12 nhãn, four artifacts có đủ, declared SYNTHETIC, orderSource=rankPosition. Không đưa toy metric values vào luận văn hoặc bảng kết quả thật.

Logs/JUnit/demo artifacts chỉ ở ignored `evaluation/work/w5a-tooling/`. Không chạy Backend/Frontend/AI full regression, HTTP capture, database, Docker hoặc evaluation HUMAN_LABELED. Markdown/local references/CLI flags/blank result tables và diff được kiểm trước commit. Không có production/helper change; các giới hạn hiện tại giải quyết bằng protocol và existing V3 external-CSV path.
