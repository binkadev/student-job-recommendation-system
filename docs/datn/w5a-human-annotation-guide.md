# W5-A — Hướng dẫn gán nhãn relevance độc lập

**HUMAN LABELS REQUIRED. Chưa có reviewer hoặc nhãn thật được xác minh trong W5-A.** A01/A02 bên dưới là mã mẫu cho hai vai trò, không phải danh tính/người đã tham gia. Target khoảng 10 CV×30–50 Job là kế hoạch. Không lấy synthetic fixtures, AI scores, application status hay người dùng bấm Apply làm ground truth.

Đọc cùng [study protocol](w5a-ai-evaluation-protocol.md) và [report template](w5a-ai-evaluation-report-template.md). Workflow reuse [annotation.py](../../ai-service/evaluation/annotation.py), [dataset.py](../../ai-service/evaluation/dataset.py) và [hướng dẫn có sẵn](../../ai-service/evaluation/README.md#independent-annotation-workflow). Mọi dữ liệu thật/notes/sign-off ở ignored `evaluation/private/` hoặc `evaluation/work/` từ `ai-service/`, không điền thông tin cá nhân vào file guide đã commit này.

## 1. Phiếu điều phối để điền trong private workspace

| Mục | Điền khi có bằng chứng thật |
|---|---|
| Dataset/version, source freeze date, N CV/J Job actual | |
| Source hashes cvs.json/jobs.json và private ID map | |
| Consent/authorization references, kiểm ẩn danh và retention/deletion date | |
| A01: đủ năng lực IT/VI/EN, không conflict of interest; danh tính lưu riêng | |
| A02: đủ năng lực IT/VI/EN, không conflict of interest; danh tính lưu riêng | |
| Coordinator; adjudicator/escalation role nếu không đồng thuận | |
| Ngày tập huấn bằng SYNTHETIC ngoài sample; rubric version đã chốt | |
| Blinding sign-off: không thấy scores/ranks/tiers/reasons/AI matched-skill output | |
| Seed, packet filenames/hashes, cấp quyền riêng cho từng reviewer | |
| Ngày bắt đầu/kết thúc; cặp còn thiếu; số bất đồng; manual resolution sign-off | |
| Final labelVersion/hash, kiểm N×J unique pairs, ngày khoá nhãn trước predictions | |

Không tự điền tên, ngày ký, thời gian chấm, mức agreement hoặc số bất đồng. Cỡ công việc dự kiến: 300–500 cặp **mỗi reviewer**, tổng 600–1.000 decisions trước adjudication. Chia thành phiên ngắn có nghỉ để giảm fatigue; reviewer có thể đánh dấu cặp khó bằng notes nhưng không xem bài người kia. Thực tế thời lượng/khó khăn sẽ ghi sau, không giả làm số đã đo.

## 2. Rubric cố định: đánh giá cặp CV–Job

Xem toàn bộ evidence CV đã ẩn danh và yêu cầu Job, gồm kỹ năng nền tảng/công nghệ, nhiệm vụ/định hướng nghề, chuyên ngành, kinh nghiệm thể hiện qua học tập/project/thực tập và trình độ. Đánh giá khả năng **có lý do hợp lý để cân nhắc ứng tuyển internship/junior**, không phải dự đoán được tuyển hoặc nhân phẩm/năng lực tổng quát của người đó. Không gán weight số cho từng phần hoặc bắt chước công thức AI.

| Relevance | Ý nghĩa thao tác | Căn cứ cần xem |
|---|---|---|
| **0 — irrelevant** | Không có cơ sở hợp lý để khuyến nghị Job này từ evidence hiện có | Role/core technical domain không liên quan, hoặc thiếu điều kiện bắt buộc rõ ràng về trình độ/kinh nghiệm/kỹ năng mà không có evidence tương đương. Một từ khóa chung đơn lẻ không đủ làm relevant |
| **1 — relevant** | Cặp phù hợp ở mức có thể cân nhắc, có kỹ năng chuyển giao/nền tảng và khoảng thiếu có thể đào tạo ở cấp độ đã chọn | Định hướng/nhiệm vụ tương thích, có core evidence nhưng một số preferred skills/kinh nghiệm còn thiếu; không có hard incompatibility rõ ràng |
| **2 — highly relevant** | Cặp phù hợp mạnh và trực tiếp với role/level, phần lớn yêu cầu chính được evidence hỗ trợ, không có khoảng thiếu trọng yếu | Nội dung CV/project/experience và Job gần nhau về công việc/công nghệ, trình độ/level hợp lý; không chỉ là trùng nhiều keyword |

Các quy tắc chung:

- Phân biệt **bắt buộc** với **ưu tiên/có thể học** theo câu chữ Job. Không tự đoán kỹ năng/kinh nghiệm không xuất hiện trong CV. Nếu thiếu evidence cho hard requirement, nêu rõ lý do; thiếu preferred skill không tự động là0. Cặp vẫn khó phân loại thì giữ blank lúc làm dở, ghi câu hỏi private và hoàn thành trước review; không dùng nhãn3/NA/0.5.
- Chấp nhận chứng cứ project/học tập liên quan cho internship khi Job cho phép; không coi mọi Student thiếu kinh nghiệm làm việc là irrelevant. Không cho lợi thế vì trường/công ty nổi tiếng, giới tính/tuổi/địa chỉ hoặc thông tin đã bị loại.
- Đọc VI/EN theo cùng tiêu chuẩn, giữ tên kỹ thuật/alias có nghĩa tương đương khi có căn cứ. Khác ngôn ngữ văn bản **không tự động** là irrelevant. Nếu Job thật có hard language-competency requirement thì chỉ dùng evidence được nêu; không dùng AI languageConfidence/tier như đánh giá trình độ ngoại ngữ của ứng viên.
- Không nhìn recommendation list, rankPosition, rankingScore, explanations, matched/missing skills của AI, metric hoặc nhãn người kia. `cv_skills`/`job_skills` trong packet là nguồn khai báo/curation đã đóng băng, không phải oracle relevance hay evidence đã được AI match.
- Không cố tạo tỷ lệ label0/1/2 đẹp hoặc ép mỗi CV có Job relevant. Chấm hết Cartesian product, không chỉ top5, giữ cả cặp không liên quan và CV toàn0.

### Ví dụ hướng dẫn — SYNTHETIC ONLY

Đây là tình huống minh hoạ rubric, không phải nhãn study:

| Tình huống tổng hợp | Nhãn minh hoạ có điều kiện | Lý do |
|---|---|---|
| CV Student mô tả project Java/Spring/PostgreSQL; Job internship backend cùng stack, không đòi kinh nghiệm bắt buộc ngoài project | 2 | Evidence trực tiếp cho nhiệm vụ/level |
| CV Python API/project testing; Job junior backend chấp nhận ngôn ngữ tương đương và đào tạo framework mới | 1 | Nền tảng phù hợp nhưng khoảng thiếu framework cần học |
| CV chỉ frontend React; Job đòi kinh nghiệm chuyên sâu quản trị Kubernetes production bắt buộc, không có evidence tương đương | 0 | Thiếu core role và hard experience requirement |

Không suy ra nhãn thực chỉ từ bảng này; đọc đủ tài liệu từng cặp và rubric đã ký. Không có toy Precision/Recall/F1/NDCG nào là kết quả luận văn.

## 3. Tạo và hoàn thành packet

Các command trong §3–§5 là **quy trình cho dữ liệu thật sau authorization**, chưa chạy cho human pilot trong W5-A. Từ `ai-service/`, Python3.11 environment đã xác minh; chỉ khi `evaluation/private/pilot-v1/cvs.json` và `jobs.json` đã freeze:

```powershell
python -m evaluation.annotation prepare --dataset evaluation/private/pilot-v1 --annotators A01 A02 --output-dir evaluation/work/pilot-v1-packets --seed w5a-pilot-v1
```

Tool tạo `manifest.json` và hai `annotations-A01.csv`/`annotations-A02.csv`, mỗi packet N×J cặp một lần theo thứ tự shuffle độc lập, deterministic với seed/reviewer ID. Dùng output directory mới, không chạy prepare lại lên packet đang chấm vì có thể ghi đè edits. Giữ bản blank/hash ban đầu, giao riêng từng packet. Manifest không lưu cryptographic source hashes, nên coordinator phải ghi thêm source/packet hashes ở phiếu freeze.

Header generated packet **đúng 10 cột**:

```csv
pair_id,annotator_id,cv_id,job_id,cv_text,cv_skills,job_text,job_skills,relevance,notes
```

Reviewer chỉ sửa `relevance` (đúng `0`, `1` hoặc `2`) và optional `notes`. Không sửa ID/pair_id, text, skills JSON string hoặc thứ tự/schema cột. Mỗi note nên nêu evidence và hard/preferred gap ngắn gọn, không thêm PII hoặc suy diễn AI. Dùng CSV-aware editor giữ UTF-8 **không BOM**, multiline/quotes/commas, nguyên ID integer không chuyển scientific notation; không copy sang bảng làm mất newline rồi sửa text cho qua validator.

Prepare/source loader hiện yêu cầu skills nonempty và ≤100 Job. Nếu nguồn không đáp ứng, dừng kiểm eligibility/format theo protocol; không thêm skill giả. Primary pilot giới hạn 30–50 Job và nguồn có skill thực, phải ghi selection limitation. Bất kỳ phiên annotation external cho nguồn rỗng cần deviation trước freeze, không thay implementation.

Reviewer bàn giao packet complete cùng ngày/ký hiệu phiên ở sign-off private. Coordinator giữ bản raw independent, không sửa nhãn của họ. Check đủ cặp, không blank/invalid/duplicate và data source không bị đổi. Nếu phát hiện typo/thiếu text thật, dừng, sửa source có log **trước** freeze version mới, chuẩn bị lại packets; không đổi packet text đơn lẻ để qua review.

## 4. Review và adjudication thủ công

Chỉ khi cả hai packet đã hoàn tất:

```powershell
python -m evaluation.annotation review --dataset evaluation/private/pilot-v1 --annotations-dir evaluation/work/pilot-v1-packets --output-dir evaluation/work/pilot-v1-review
```

Tool đối chiếu từng pair/text/serialized skills với source và sinh:

- `agreement-summary.json`: exactAgreementRate, unanimousPairCount, disagreementPairCount và labelDistribution từng reviewer. Với hai reviewer, exact agreement = số cặp label bằng nhau / N×J. Đây là agreement **trước adjudication**, không phải accuracy/kappa/significance.
- `disagreements.csv`: nhãn riêng từng người; `final_relevance` và `adjudication_notes` trống.
- `judgments.adjudication.csv`: header `cv_id,job_id,relevance,requires_adjudication`; consensus có label, cặp bất đồng để blank.

Hai người thảo luận mỗi bất đồng dựa trên CV/Job và rubric, vẫn mù với AI output. Điền agreed `final_relevance` 0/1/2 và căn cứ vào disagreement log, rồi **copy chính nhãn đó** vào blank `relevance` của cặp tương ứng trong adjudication CSV. Không để tool average/vote/chọn theo AI. `requires_adjudication=true` ghi dấu cặp bất đồng ban đầu; giữ flag/log để audit, không coi flag này tự chứng minh cặp đã giải quyết. Coordinator xác nhận các quyết định manual và consensus rows không bị sửa tuỳ tiện.

Nếu chưa thống nhất, dùng escalation role đã định trước, ghi căn cứ/ai quyết định; không xoá cặp hoặc CV. Thiếu nhãn cuối → **HUMAN LABELS REQUIRED**, không final metrics. Không đổi original reviewer packets để trông như agreement cao hơn; nếu phát hiện lỗi data/rubric, ghi deviation/version mới, không sửa lịch sử.

## 5. Hoàn thành ground truth và CV all-zero

**Đường A — mọi CV có ≥1 label>0:** dùng finalizer hiện có sau khi mọi blank đã được quyết định thủ công:

```powershell
python -m evaluation.annotation finalize --dataset evaluation/private/pilot-v1 --adjudication evaluation/work/pilot-v1-review/judgments.adjudication.csv --output evaluation/private/pilot-v1/judgments.csv
```

Không dùng `--force` để ghi đè dataset đã freeze. Tool kiểm schema/pairs/labels nhưng không xác minh người chấm/consent hoặc tự biết quyết định nào đúng; sign-off vẫn bắt buộc.

**Đường B — có CV được chấm toàn0:** giữ nguyên toàn0. Finalizer legacy sẽ từ chối vì yêu cầu label dương; đây là restriction đã có, không có nghĩa ground truth sai. Vẫn dùng prepare→independent packets→review→manual adjudication như trên. Sau khi coordinator kiểm mọi nhãn cuối:

1. Tạo **bản copy** của adjudication CSV bằng CSV-aware editor; export chỉ ba cột `cv_id,job_id,relevance` theo thứ tự đó, giữ nguyên N×J labels đã được ký, **bỏ cột requires_adjudication trong bản export**, không sửa bản audit gốc.
2. Lưu UTF-8 không BOM thành `evaluation/private/pilot-v1/judgments.csv`, gồm cả mọi dòng0, không notes/cột thừa. Không tạo giá trị mới, trung bình nhãn hoặc lấy từ model.
3. Kiểm bằng **existing V3 dataset loader**, chưa cần predictions và không tính metrics:

```powershell
# Dùng sau adjudication cho cả đường A hoặc B; chỉ validate, không chấm chất lượng
python -c "from evaluation.dataset import load_dataset; d=load_dataset('evaluation/private/pilot-v1', prediction_evaluation=True); print('Validated CV/Job/pair counts:', len(d.cvs), len(d.jobs), d.judgment_count)"
```

Validator yêu cầu exactly one judgment cho mọi CV×Job và chấp nhận all-zero. Coordinator đối chiếu export với manual log, hash/freeze cả raw packets, review, adjudication và `judgments.csv`. Không sửa finalizer, không bịa một relevant Job, không loại CV all-zero. Khi evaluate primary threshold1, all-zero CV có P/R/F1/NDCG0 và vẫn nằm trong macro denominator; đây là thông tin corpus coverage cần báo trung thực.

Final schema (header thật, **không có dòng nhãn study minh hoạ để copy**):

```csv
cv_id,job_id,relevance
```

Để chuẩn bị study thật, **không** copy labels hoặc completed packet từ `examples/toy-v1/` vào private pilot. Các file toy chỉ dùng để tập cách vận hành bằng SYNTHETIC ngoài sample.

## 6. Checklist bàn giao ground truth

- [ ] Authorization/consent/de-identification và access restrictions đã có bằng chứng; N/J actual và sampling log đã chốt.
- [ ] Hai reviewer độc lập, đủ năng lực, không conflict; mỗi người chấm đầy đủ N×J, không thấy AI results/nhãn người kia.
- [ ] Source/packet content và IDs không thay đổi; exact agreement/distributions được giữ trước adjudication.
- [ ] Mọi bất đồng có quyết định thủ công/căn cứ; không còn blank; không thay original independent labels.
- [ ] `judgments.csv` đúng ba cột, 0/1/2 integer, known/unique pairs, exactly N×J; existing V3 loader validate PASS; all-zero được giữ.
- [ ] Hash/version/sign-off và retention/deletion date đã ghi; labels đã khoá trước mở predictions/metrics.
- [ ] Người quản lý chuyển sang capture/evaluation gates trong [protocol §6–§8](w5a-ai-evaluation-protocol.md), không chạy final metrics khi thiếu actual persisted V3 GET evidence.

Các ô này **chưa được tích trong W5-A**. Việc CLI SYNTHETIC chạy thành công không thay cho bất kỳ xác nhận con người nào ở đây.
