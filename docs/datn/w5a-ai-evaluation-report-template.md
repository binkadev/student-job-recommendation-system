# W5-A — Mẫu báo cáo thực nghiệm Student Recommendation V3

**HUMAN LABELS REQUIRED — REAL EXPERIMENT NOT EXECUTED.** Mẫu để điền sau khi thực hiện [protocol](w5a-ai-evaluation-protocol.md) và [annotation guide](w5a-human-annotation-guide.md). Hiện chưa có dataset/labels/predictions thật được xác minh cho W5-A. Để trống các số liệu dưới đây; **ô trống không phải metric0**. Không lấy toy-v1, tests, CI hoặc Core Smoke làm kết quả chất lượng học thuật.

Baseline chuẩn bị: `7715e12ed691dec1e544395a70768f0bbd1372f3`. Experiment ID thực: ______ · Protocol frozen SHA: ______ · Người phụ trách: ______ · Ngày chốt trước thu thập: ______ · Ngày thực thi thực: ______

Những trường/notes chứa thông tin thật phải điền vào bản private/work, không vào Git/PR khi chưa có quyền công bố. Chỉ xuất aggregates và ví dụ đã được phép, đã kiểm lại ẩn danh.

## 1. Research question

Trong corpus Job đủ điều kiện cố định, Top5 Job do **Student Recommendation V3** tạo từ CV phù hợp thế nào với relevance judgments độc lập của con người?

Phạm vi/population và câu hỏi cụ thể đã chốt: ______

Không diễn giải thành câu hỏi model confidence, classification accuracy, Company Candidate Ranking hoặc production readiness.

## 2. Evaluation objectives

- Định lượng binary Precision@5, Recall@5 và **F1@5** với human relevance threshold1.
- Bổ sung NDCG@5 cho grades0/1/2 và vị trí trong ranking official.
- Mô tả per-CV variability, corpus coverage/all-zero, trường hợp phù hợp/không phù hợp và giới hạn pilot.
- Không tune labels/threshold/K/corpus theo kết quả, không claim ưu thế so phương pháp khác nếu không có comparator được đăng ký và chạy hợp lệ.

Objective/hypothesis bổ sung đã đăng ký trước (nếu không có, ghi không có): ______

## 3. Dataset construction

Mục tiêu chuẩn bị là khoảng 10 CV, 30–50 Job; **không điền các target này vào cột actual** khi chưa thu thập. Số cặp cuối phải bằng N×J, mỗi cặp đúng một adjudicated label.

| Nội dung | Actual / bằng chứng |
|---|---|
| Dataset/label version, freeze date và hashes | |
| CV count / số người riêng biệt / Job count / judgment count | |
| CV VI / EN / mixed; Job VI / EN; technical-role distribution | |
| Nguồn được phép, consent references, access/retention controls | |
| De-identification/deduplication procedure và exclusion log | |
| Số CV không relevant Job; số queries không có prediction; operational failures | |
| Authoritative cohort denominator và deviations so target/protocol | |

Phân biệt annotation `text/skills` đã ẩn danh với actual persisted CV analysis snapshot dùng scoring. Cách kiểm chúng thuộc cùng CV/source: ______

## 4. Sampling strategy and limitations

Mô tả pool, recruitment, purposive strata/quotas, eligibility và lý do chọn/loại trước scores: ______

Ghi actual gaps giữa target và sample, duplicate controls, giới hạn Student/internship/junior IT, kỹ năng được nêu và bilingual coverage: ______

Không loại CV all-zero hoặc ít prediction để tăng macro mean. Pool thuận tiện/cỡ nhỏ không đại diện toàn thị trường; mọi CV cùng corpus Job không phải các quan sát hoàn toàn độc lập. Không suy ra Recall trên toàn bộ Job ngoài frozen corpus.

## 5. Annotation rubric

Rubric version được chốt trước main annotation: ______ · Training bằng SYNTHETIC ngoài sample: ______

| Label | Định nghĩa dùng trong study |
|---|---|
| 0 | Irrelevant: thiếu cơ sở phù hợp/khác core role hoặc hard requirement không được evidence hỗ trợ |
| 1 | Relevant: có nền tảng/transferable evidence để cân nhắc, có khoảng thiếu có thể đào tạo |
| 2 | Highly relevant: phù hợp trực tiếp với role/level và phần lớn yêu cầu chính, không có gap trọng yếu |

Người chấm xét kỹ năng, định hướng/chuyên ngành, kinh nghiệm/project và trình độ theo evidence, không tái tính score AI. Cách xử lý thiếu evidence, hard/preferred requirements và language differences theo guide: ______

Không gán nhãn từ keyword-count, applications, score/rank/tier hoặc explanation. Không dùng một formula AI-like để thay judgment người.

## 6. Reviewer agreement and adjudication

Reviewer A01/A02 là mã vai trò dự kiến, chưa xác nhận người thật ở W5-A. Sau nghiên cứu, ghi eligibility/bilingual competence, blinding, conflicts và sign-off private: ______

| Pre-adjudication | A01 | A02 |
|---|---|---|
| Số cặp đã chấm độc lập | | |
| Label0 / label1 / label2 | | |
| Phiên làm việc / notes về fatigue | | |

| Agreement/adjudication | Verified value / evidence |
|---|---|
| N×J pairs; unanimous pairs; disagreement pairs | |
| Exact agreement = unanimous pairs / all pairs, trước adjudication | |
| Manual resolution/escalation method, chưa thống nhất còn bao nhiêu | |
| Raw packet/review/adjudication/final-label hashes và freeze sign-off | |
| Có all-zero CV? External three-column CSV path đã validate V3? | |

Exact agreement hiện có trong tooling không phải Cohen's kappa hoặc evidence statistical significance. Không công bố agreement từ synthetic fixtures như kết quả người thật; không sửa raw packets sau consensus.

## 7. Frozen prediction collection

Runtime/source SHA thật, image digests và installed environment: ______ · Frozen corpus manifest: ______ · Múi giờ/window: ______

Giữ cùng eligible corpus: Job ACTIVE, Company VERIFIED, deadline hợp lệ; membership/text/skills hashes trước/sau mỗi run: ______

Planned generation config: **score threshold0; global limitJ** (J là actual frozen Job count). Evaluation config khác: **K5, human threshold1**. Mỗi CV một scheduled attempt, một verified persisted SUCCESS run và actual owned `GET /api/students/me/recommendation-runs/{runId}`; không chọn tốt nhất từ nhiều run. Cách xử lý fail/timeout/missing evidence và deviations: ______

| CV pseudonym/actual ID | Chosen actual runId | Request threshold/limit/time | GET capture hash | CV snapshot/corpus hashes pre/post | Coverage/status |
|---|---|---|---|---|---|
| | | | | | |

Kiểm identities, algorithm/version, scanned corpus count **và membership**, counts/results, PRIMARY trước FALLBACK, global rankPosition/tierRankPosition, nullability và scores: ______

Giữ official persisted rankPosition, không sort lại rounded-score ties hoặc globally so PRIMARY/FALLBACK scores; không dùng allow-unranked cho study này. Source raw GET và mapping nằm private; không dùng manually authored synthetic predictions/latest-results arrays làm capture thật. Student history không lưu đủ threshold/limit/input snapshot; mục thiếu provenance phải ghi UNKNOWN, không đoán.

## 8. Metric definitions and formulas

Các công thức sau mô tả evaluator hiện có, không phải code tính lại. Với q là CV, D là toàn corpus, y(q,j)∈{0,1,2}, Lq là official order; mq=min(5,|Lq|), hq là số label≥1 ở mq vị trí đầu, aq là tổng label≥1 trong D:

$$P_q@5=\begin{cases}h_q/m_q&m_q>0\\0&m_q=0\end{cases},\quad R_q@5=\begin{cases}h_q/a_q&a_q>0\\0&a_q=0\end{cases}$$

$$F1_q@5=\begin{cases}2(P_q@5)(R_q@5)/((P_q@5)+(R_q@5))&P_q@5+R_q@5>0\\0&\text{otherwise}\end{cases}$$

$$DCG_q@5=\sum_{r=1}^{m_q}\frac{2^{y(q,L_q[r])}-1}{\log_2(r+1)},\quad NDCG_q@5=\begin{cases}DCG_q@5/IDCG_q@5&IDCG_q@5>0\\0&IDCG_q@5=0\end{cases}$$

IDCG từ tất cả labels trong D, lý tưởng giảm dần lấy tối đa5. Macro(M)=sum_q Mq/N, **unweighted**, gồm all-zero CV. Mean per-CV F1 khác F1 tính từ macro P/R. Summary rounds6 decimals; không round inputs/individual calculations trước aggregation.

Short-list Precision dùng denominator mq thực có, không fixed5/padding; ghi rõ để so sánh có nghĩa. Recall denominator gồm cả relevant Jobs không được trả về. Valid SUCCESS empty prediction → bốn metrics0. Tại primary threshold1, CV tất cả label0 → bốn metrics0, giữ trong N. FAILED request không được đổi thành empty SUCCESS. NDCG dùng graded gains, không đổi theo binary threshold; missing labels/ranks không được chữa bằng mặc định0.

Nguồn implementation: [metrics.py](../../ai-service/evaluation/metrics.py), [prediction runner](../../ai-service/evaluation/prediction_runner.py), [V3 evaluation guide](../../ai-service/evaluation/v3-prediction-evaluation.md). Tài liệu nền tảng để trình bày related work: [Manning, Raghavan & Schütze — IR evaluation](https://nlp.stanford.edu/IR-book/pdf/08eval.pdf); [Järvelin & Kekäläinen (2002), *Cumulated Gain-based Evaluation of IR Techniques*, TOIS20(4),422–446, DOI10.1145/582415.582418 — author institution record](https://researchportal.tuni.fi/en/publications/cumulated-gain-based-evaluation-of-ir-techniques/). Công thức gain/short-list chính xác trong study theo code ở trên; không tuyên bố mọi biến thể đều là cùng một định nghĩa trong các tài liệu tham khảo.

`rankingScore` là evidence ranking, không phải P/R/F1, accuracy, probability hay confidence. Không gọi FALLBACK skillScore là overall fit. Tính metrics trên thứ tự Backend chính thức, không trộn scale của hai tier.

## 9. Results — để trống đến khi verified

**Trạng thái hiện tại: HUMAN LABELS REQUIRED / REAL EXPERIMENT NOT EXECUTED.** Chỉ điền khi G0–G5 ở protocol đều có bằng chứng. Không copy số toy, số assertions PASS hoặc số W4-D vào các ô metrics.

| Model / cohort actual | N CV | J Job | Precision@5 macro | Recall@5 macro | F1@5 macro | NDCG@5 macro | evaluationId |
|---|---|---|---|---|---|---|---|
| Student Recommendation V3 | | | | | | | |

| CV pseudonym | runId | Retrieved at5 | Total relevant in D | P@5 | R@5 | F1@5 | NDCG@5 |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

Operational counts (attempted/failed/complete/zero prediction/all-zero labels), thực tế và lý do: ______

Giải thích kết quả dựa trên per_cv.csv/rankings.csv và corpus, không chọn riêng CV tốt. Không claim statistically significant ở pilot nhỏ; không giới thiệu micro mean/mean-of-rounded-values khác evaluator như cùng một kết quả.

## 10. Error analysis and representative cases

Chọn case theo rule mô tả đã nêu trước, không chỉ minh hoạ thành công: top5 label0 (false positive), relevant outside top5 (false negative), nhầm adjacent technical roles/experience level, khác ngôn ngữ hoặc parser/canonical-skill gap. Phân tích bằng actual CV/Job evidence và human rationale **sau khi labels freeze**, không sửa labels để thuận theo model.

| Actual case ID (private mapping) | Error type | Official position/tier | Human label/evidence | Plausible cause vs verified fact | Limitation |
|---|---|---|---|---|---|
| | | | | | |

Ví dụ diễn giải **SYNTHETIC ONLY**: giả sử một Job khác core role lọt top5 nhưng người chấm cho0, đó là case để xem parser/skill alias/text overlap; không tự chứng minh nguyên nhân là TF-IDF hoặc tạo metric cho một cohort thật. Không coi explanation của model là chứng cứ ground truth. Case excerpts chỉ được công bố sau authorization/ẩn danh; chưa có representative real failure case trong W5-A.

## 11. Threats to validity

Điền tác động thực tế và biện pháp, không viết như đã loại hết bias:

- **Construct:** relevance chủ quan, 0/1/2 coarse; form/skills/text có thể thiếu evidence; một số kỳ vọng tuyển dụng không được model biểu diễn riêng.
- **Internal:** reviewer expertise/conflict/fatigue, blinding, duplicate/selection bias, data leakage từ AI; đồng thuận sau thảo luận không thay thế raw agreement. Mismatch parser/annotation source và corpus drift cần kiểm.
- **External:** ~10 CV/30–50 Job mục tiêu, purposive/convenience sample, quota VI/EN/skills/level, hạn chế nguồn phải có skills; không khái quát toàn bộ sinh viên/thị trường/ngôn ngữ.
- **Statistical:** ít CV, shared Job corpus, không có comparator/held-out model tuning; không claim significance. Short-list denominator và zero conventions ảnh hưởng so sánh nghiên cứu khác.
- **Reproducibility:** public history mutable relations và thiếu generation params/input snapshot; chỉ replay frozen metrics được nếu input capture/provenance không đầy đủ.

Actual deviations/remaining uncertainty: ______

## 12. Reproducibility and experiment provenance

| Evidence | Actual version/hash/reference |
|---|---|
| Frozen protocol/code/Backend/AI SHAs, image digests, runtime + installed dependency inventory | |
| Consent/anonymization/sampling/blinding/adjudication references, datasetVersion/labelVersion | |
| cvs.json / jobs.json / judgments.csv SHA-256 exact bytes | |
| Raw per-run GET files, predictions.json, private ID map và experiment.json SHA-256 | |
| Per-CV source file + READY snapshot metadata/hash; full eligible corpus membership/text/skills hashes | |
| Generation threshold/limit/CV identities/timezone, complete attempt/failure log | |
| Evaluator/tooling/requirements.lock hashes, Python version, pip-check evidence | |
| Exact CLI/config, summary evaluationId, output hashes, original vs rerun equality | |

Actual command đã chạy và kiểm tra artifacts: ______

Input `experiment.json` được freeze trước evaluation, không chứa hash của chính nó/output hashes/evaluationId. Ghi các giá trị hậu kiểm này trong execution record riêng dưới ignored work; không cập nhật input manifest để tạo vòng tự tham chiếu hay làm thay evaluationId sau khi tính.

Tool outputs: summary.json, per_cv.csv, rankings.csv, sanitized predictions.json dưới ignored work. `HUMAN_LABELED` chỉ là operator declaration, cần bằng chứng người thật độc lập. Input/hash/config/Python change làm evaluationId đổi; exact bytes/newline và cùng dataset basename cần giữ để so output byte identity. Replay metric không tái dựng scoring input lịch sử. Không xuất raw CV, message, JWT/password, reviewer notes hoặc private company text vào public artifacts.

## 13. Conclusion and possible future improvements

Chỉ sau khi verified: trả lời research question bằng actual metrics, per-CV/error evidence và giới hạn: ______

Không kết luận “mô hình chính xác X%” từ rankingScore; không khẳng định production-ready từ human relevance. Cải thiện nghiên cứu có thể là sample độc lập lớn hơn, đa dạng nguồn/level/ngôn ngữ hoặc comparator preregistered; nếu dùng pilot để phát triển phương pháp thì cần held-out evaluation mới. Không đề xuất đổi weights/ranking của V3 ngay trong báo cáo preparation như thể đã có experiment chứng minh.

**Kết luận được phép ở giai đoạn W5-A hiện tại:** protocol/tooling đã sẵn sàng để tổ chức thí nghiệm; cần authorized anonymized dataset, hai independent reviews + adjudication và verified persisted Backend V3 captures trước khi có final academic metrics. Không có kết quả hiệu quả xếp hạng thật để điền vào mẫu này.
