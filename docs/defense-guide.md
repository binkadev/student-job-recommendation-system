# Hướng dẫn bảo vệ đồ án

## 1. Bài toán và lý do đây là hệ thống xếp hạng

Hệ thống hỗ trợ doanh nghiệp sàng lọc các Application thuộc một Job cụ thể.
Mỗi ứng viên được chấm điểm dựa trên nội dung CV đã phân tích và kỹ năng
canonical của Job, sau đó được sắp xếp thành Top K. Đây là
recommendation/ranking system vì đầu ra là danh sách có thứ tự và điểm phù
hợp, không chỉ là bộ lọc đúng/sai.

Đây là content-based recommendation: hệ thống so sánh đặc trưng của CV và Job
hiện tại. Không dùng collaborative filtering hay lịch sử hành vi người dùng.

## 2. Cách tính điểm

TF-IDF biểu diễn văn bản bằng trọng số từ/ngram: từ xuất hiện quan trọng trong
một tài liệu nhưng ít phổ biến trong corpus có trọng số cao hơn. Cosine
Similarity đo góc giữa vector Job và vector CV, cho điểm từ 0 đến 1 trong
pipeline này.

Skill matching canonical hóa alias kỹ thuật, rồi tính:

```text
skillScore = số kỹ năng Job có trong CV / tổng số kỹ năng canonical của Job
```

Với cặp cùng ngôn ngữ và Job có skill:

```text
score = 0.65 * textScore + 0.35 * skillScore
```

Nếu Job cùng ngôn ngữ nhưng không khai báo skill, `score = textScore`. Với cặp
khác ngôn ngữ, mixed, unknown hoặc confidence thấp, `textScore = null` và
`score = skillScore`; strategy là `CROSS_LANGUAGE_SKILL_BASED`.

Candidate Ranking dùng “reverse Candidate-only TF-IDF”: AI fit một
`TfidfVectorizer` duy nhất trên toàn bộ CV Candidate cùng ngôn ngữ, không đưa
Job vào corpus fit. Sau đó Job được preprocess và transform đúng một lần trong
vector space đó, rồi so sánh với mọi CV. Làm như vậy giữ cho các điểm giữa các
Candidate cùng một run có thể so sánh. Nếu fit riêng từng Candidate hoặc từng
batch thì các vector space khác nhau và điểm không nên được ghép lại.

Ngưỡng lọc trước khi chọn Top K. Tie-break là `score DESC`, sau đó
`applicationId ASC` ở AI để chọn tập kết quả; Backend thực hiện validation và
sắp xếp chính thức lại, rồi gán `rankPosition` liên tục từ 1.

## 3. Phân công service

- Frontend: đăng nhập, form threshold/limit, hiển thị trạng thái, điểm, skill,
  lịch sử, CV, lưu Candidate và cập nhật Application qua Backend.
- Backend: system of record; xác thực JWT/role, ownership Company, lọc
  Application eligible, tạo run, request ID, gọi AI, validate toàn bộ response,
  sort/rank, tạo reason và lưu PostgreSQL.
- AI: stateless FastAPI; parse PDF/DOCX, detect ngôn ngữ, preprocess, canonical
  skill, TF-IDF/Cosine và trả component scores. AI không nhận user JWT, không
  truy cập DB, không lưu run và không gán rank/reason public.

Preparation được commit thành `PROCESSING`. External AI call chạy ngoài
transaction. Thành công reload và kiểm tra fingerprint rồi lưu toàn bộ results
và `SUCCESS` trong transaction; lỗi dùng transaction độc lập để chuyển
`FAILED` với message đã sanitize. Partial result không được giữ lại.

`X-Request-Id` là tracing metadata; `requestId` trong JSON là correlation
field. Backend-to-AI endpoint được bảo vệ bằng `X-Internal-Api-Key`. Không log
JWT, key, raw CV, Job text hoặc đường dẫn storage.

## 4. Câu hỏi thường gặp

**TF-IDF có phải model deep learning đã train không?** Không. Đây là phép
biến đổi thống kê/deterministic của scikit-learn trên corpus của run.

**Có dùng BERT, LLM, embeddings hay learning-to-rank không?** Không. Chưa có
semantic multilingual embeddings và chưa có learned ranking model.

**Tại sao không fit Job cùng Candidate?** Để Job không làm thay đổi IDF của
corpus ứng viên và để đo cùng một không gian Candidate; Job chỉ được transform
một lần sau khi fit.

**AI có trả rank không?** Không. AI trả application/cv id và component scores.
Backend mới là nguồn chính thức, sort tie-break và gán rank.

**Vì sao cross-language không dùng textScore?** TF-IDF lexical giữa hai ngôn
ngữ không đáng tin trong contract hiện tại; hệ thống fallback về canonical skill
overlap và ghi rõ strategy.

**Threshold và Top K khác nhau thế nào?** Threshold loại điểm thấp; limit
giới hạn số kết quả trả về sau khi đã đánh giá toàn bộ corpus eligible.

**Nếu không có Candidate đủ điều kiện?** Backend tạo run `SUCCESS` với zero
results, giữ counters và không gọi AI.

**Có thể gọi đây là tuyển người tự động không?** Không. Ranking chỉ hỗ trợ
screening. Dữ liệu CV, skill khai báo và bias của recruiter có thể ảnh hưởng
điểm; quyết định cuối cùng phải do con người kiểm tra.

**Bằng chứng kiểm thử gồm gì?** Có unit/integration tests ở Backend, AI,
Frontend và isolated real-process E2E nếu runner đã pass. Fixture E2E chứng minh
tích hợp và tính tái lập, không chứng minh ranking phù hợp với đánh giá con
người.
