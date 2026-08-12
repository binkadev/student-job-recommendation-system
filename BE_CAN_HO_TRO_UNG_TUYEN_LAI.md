# Ghi chú BE cần hỗ trợ: Ứng tuyển lại sau khi bị từ chối

## Yêu cầu nghiệp vụ

Khi ứng viên đã ứng tuyển một tin tuyển dụng và đơn bị nhà tuyển dụng từ chối (`REJECTED`), ứng viên được phép ứng tuyển lại vào cùng tin đó.

FE sẽ hiển thị:

- Nếu đơn hiện tại còn đang xử lý: khóa nút, hiển thị `Đã ứng tuyển`.
- Nếu đơn gần nhất bị từ chối: cho phép bấm `Ứng tuyển lại`.
- Trang chi tiết việc làm cần hiển thị lịch sử các lần ứng tuyển vào tin đó.

## Lý do hiện tại chưa làm được chỉ bằng FE

Backend hiện đang chặn ứng tuyển lại ở tầng service và database.

Trong `ApplicationServiceImpl.apply(...)`, BE kiểm tra:

```java
applicationRepository.existsByStudentIdAndJobId(student.getId(), job.getId())
```

Nếu đã có đơn của sinh viên với tin tuyển dụng đó, BE trả lỗi:

```text
Student already applied to this job
```

Ngoài ra bảng `applications` đang có unique constraint:

```text
uk_applications_student_job: student_id + job_id
```

Vì vậy `POST /api/jobs/{jobId}/apply` luôn trả lỗi khi ứng viên từng ứng tuyển job đó, kể cả đơn cũ đã `REJECTED`.

## BE cần chỉnh

### Phương án 1: Cho phép tạo đơn mới sau REJECTED

Nên dùng nếu muốn lưu đúng lịch sử nhiều lần ứng tuyển.

BE cần:

- Bỏ hoặc thay đổi unique constraint `student_id + job_id`.
- Chỉ chặn tạo đơn mới nếu đang tồn tại đơn cùng `student_id + job_id` ở trạng thái đang xử lý:
  - `PENDING`
  - `REVIEWED`
  - `ACCEPTED`
- Cho phép tạo đơn mới nếu đơn gần nhất là:
  - `REJECTED`
  - `WITHDRAWN` nếu nghiệp vụ cho phép rút rồi ứng tuyển lại.
- API `GET /api/students/me/applications` cần trả đủ nhiều đơn cùng job để FE hiển thị lịch sử.

### Phương án 2: Reopen đơn cũ

Nên dùng nếu hệ thống chỉ cho 1 bản ghi ứng tuyển cho mỗi student-job.

BE cần:

- Thêm API riêng, ví dụ:

```http
POST /api/students/me/applications/{id}/reapply
```

- Chỉ cho phép khi đơn thuộc ứng viên hiện tại và trạng thái hiện tại là `REJECTED`.
- Cập nhật đơn về `PENDING`.
- Cập nhật `cvFileId`, `coverLetter`, `updatedAt`.
- Nếu cần lịch sử chi tiết, thêm bảng trạng thái/hành động ứng tuyển, ví dụ `application_status_history`.

## API FE mong muốn

Ưu tiên phương án 1:

```http
POST /api/jobs/{jobId}/apply
```

Payload giữ như hiện tại:

```json
{
  "cvFileId": 1,
  "coverLetter": "Nội dung thư giới thiệu"
}
```

Response giữ `ApplicationResponse`.

Logic mong muốn:

- Nếu chưa từng ứng tuyển: tạo đơn mới `PENDING`.
- Nếu từng ứng tuyển và đơn gần nhất là `REJECTED`: tạo đơn mới `PENDING`.
- Nếu đang có đơn `PENDING`, `REVIEWED`, hoặc `ACCEPTED`: trả lỗi rõ ràng, ví dụ `APPLICATION_ALREADY_ACTIVE`.

## Field lịch sử FE cần hiển thị

`GET /api/students/me/applications` hoặc API chi tiết theo job nên trả được:

- `id`
- `jobId`
- `jobTitle`
- `companyName`
- `status`
- `cvFileId`
- `cvFileName`
- `coverLetter`
- `appliedAt`
- `reviewedAt`
- `updatedAt`

Nếu có bảng history riêng, mỗi dòng history nên có:

- `applicationId`
- `fromStatus`
- `toStatus`
- `changedAt`
- `changedByRole`
- `note`

---

# Ghi chú BE cần hỗ trợ: Lưu kỹ năng tự nhập của ứng viên

## Yêu cầu nghiệp vụ

Ở trang hồ sơ cá nhân role `STUDENT`, ứng viên muốn tự nhập kỹ năng mới, bấm `Lưu mục hiện tại`, sau đó kỹ năng đó phải được lưu lại và hiển thị trên FE.

Ví dụ:

- Ứng viên nhập `Next.js`
- Chọn nhóm `Frontend`
- Nhập mức độ và số năm kinh nghiệm
- Bấm lưu
- Tải lại trang vẫn thấy kỹ năng `Next.js`

## Lý do hiện tại FE chưa lưu được vào DB thật

Backend hiện tại chỉ cho cập nhật kỹ năng ứng viên bằng `skillId`.

API hiện có:

```http
PUT /api/students/me/skills
```

Payload hiện cần dạng:

```json
{
  "skills": [
    {
      "skillId": 1,
      "proficiencyLevel": "BEGINNER",
      "yearsOfExperience": 1,
      "source": "MANUAL"
    }
  ]
}
```

Trong BE, `StudentSkillItemRequest` yêu cầu `skillId`, và `StudentSkillServiceImpl` sẽ báo lỗi nếu thiếu:

```text
skillId is required
```

Vì vậy nếu FE cho nhập kỹ năng tự do chưa có trong bảng `skills`, FE không có `skillId` để gửi về BE.

## FE đang xử lý tạm

FE hiện tại:

- Kỹ năng nào khớp danh mục `/api/skills` thì gửi về BE bằng `skillId`.
- Kỹ năng tự nhập chưa có trong DB thì lưu tạm theo tài khoản ở local storage để vẫn hiển thị trên FE.

Đây chỉ là xử lý tạm ở FE, không phải lưu DB thật.

## BE cần chỉnh

### Phương án 1: Cho phép STUDENT tạo skill mới khi cập nhật hồ sơ

Nên dùng nếu muốn thao tác của ứng viên đơn giản nhất.

BE có thể cho `PUT /api/students/me/skills` nhận thêm `skillName`:

```json
{
  "skills": [
    {
      "skillId": 1,
      "skillName": "Java",
      "proficiencyLevel": "INTERMEDIATE",
      "yearsOfExperience": 1,
      "source": "MANUAL"
    },
    {
      "skillName": "Next.js",
      "category": "FRONTEND",
      "proficiencyLevel": "BEGINNER",
      "yearsOfExperience": 0,
      "source": "MANUAL"
    }
  ]
}
```

Logic mong muốn:

- Nếu có `skillId`: dùng skill đã có.
- Nếu không có `skillId` nhưng có `skillName`: tìm skill theo normalized name.
- Nếu chưa tồn tại: tạo mới skill trong bảng `skills`, sau đó tạo `student_skills`.
- Chặn trùng kỹ năng theo normalized name trong cùng hồ sơ ứng viên.

### Phương án 2: Thêm API tạo skill riêng

Nếu muốn quản lý skill catalog chặt hơn, BE có thể thêm API:

```http
POST /api/skills/suggest
```

Hoặc:

```http
POST /api/students/me/skills/custom
```

Payload:

```json
{
  "name": "Next.js",
  "category": "FRONTEND",
  "proficiencyLevel": "BEGINNER",
  "yearsOfExperience": 0
}
```

API này tạo skill mới hoặc tạo pending skill tùy nghiệp vụ, rồi trả về `skillId` để FE gọi lại `PUT /api/students/me/skills`.

## Response FE cần

Sau khi lưu, BE nên trả danh sách kỹ năng mới nhất:

```json
[
  {
    "studentSkillId": 10,
    "skillId": 25,
    "skillName": "Next.js",
    "normalizedName": "next.js",
    "category": "FRONTEND",
    "proficiencyLevel": "BEGINNER",
    "yearsOfExperience": 0,
    "source": "MANUAL"
  }
]
```

## Lý do cần BE hỗ trợ

Nếu không có API lưu kỹ năng theo tên hoặc API tạo skill mới, FE không thể lưu kỹ năng tự nhập vào DB vì bảng liên kết `student_skills` cần `skill_id`.

---

# Ghi chú BE cần làm rõ: Điều kiện xóa CV của ứng viên

## Yêu cầu nghiệp vụ FE đang hiểu

Ở trang quản lý CV của role `STUDENT`:

- CV có trạng thái `Đang dùng` không được xóa.
- CV có trạng thái `Chưa dùng` nên được phép xóa nếu chưa bị ràng buộc bởi dữ liệu nghiệp vụ khác.

## Vấn đề hiện tại

Trên FE, nhãn `Chưa dùng` hiện chỉ có nghĩa là CV đó không phải CV active/default (`active = false`).

Tuy nhiên Backend hiện đang chặn xóa CV theo nghĩa rộng hơn:

- CV đã được dùng trong đơn ứng tuyển.
- CV đã được dùng trong recommendation run.
- CV đã được dùng trong candidate ranking result.
- Hoặc bị chặn bởi khóa ngoại DB `ON DELETE RESTRICT`.

Vì vậy có trường hợp CV hiển thị là `Chưa dùng` nhưng khi bấm xóa vẫn bị lỗi `CV_IN_USE`.

## Lý do cần BE kiểm tra/làm rõ

Trong `CvServiceImpl.deleteMyCvFile(...)`, BE có kiểm tra:

```java
applicationRepository.existsByCvFileId(cvId)
```

Nếu CV từng được dùng trong bảng `applications`, BE trả:

```text
CV_IN_USE
```

Ngoài ra DB còn có các ràng buộc:

```text
applications.cv_file_id -> cv_files.id ON DELETE RESTRICT
recommendation_runs.cv_file_id -> cv_files.id ON DELETE RESTRICT
candidate_ranking_results.cv_file_id -> cv_files.id ON DELETE RESTRICT
```

Nên dù FE gọi đúng:

```http
DELETE /api/students/me/cv/{cvId}
```

Backend vẫn có thể không cho xóa nếu CV đã từng tham gia các luồng trên.

## BE cần chốt rule chính thức

### Phương án 1: Giữ rule bảo toàn dữ liệu

Nếu BE muốn bảo toàn lịch sử ứng tuyển/gợi ý/xếp hạng:

- Giữ `CV_IN_USE`.
- FE sẽ hiển thị thông báo: `CV đã được dùng trong đơn ứng tuyển, gợi ý việc làm hoặc xếp hạng ứng viên nên chưa thể xóa.`
- Nên bổ sung field trong response CV để FE biết trước CV nào không thể xóa, ví dụ:

```json
{
  "id": 1,
  "active": false,
  "deletable": false,
  "deleteBlockedReason": "CV đã được dùng trong đơn ứng tuyển"
}
```

### Phương án 2: Cho phép xóa mềm CV

Nếu nghiệp vụ muốn CV `Chưa dùng` trên UI có thể xóa khỏi danh sách:

- BE nên đổi từ hard delete sang soft delete, ví dụ thêm `deleted_at` hoặc `visible_to_student`.
- Không xóa bản ghi thật khỏi DB để không vỡ lịch sử ứng tuyển/gợi ý/xếp hạng.
- API list CV của student chỉ trả CV chưa bị ẩn/xóa mềm.

## Khuyến nghị

Nên dùng phương án 1 hoặc soft delete. Không nên hard delete CV đã có ràng buộc nghiệp vụ vì sẽ làm mất dữ liệu lịch sử và có thể vi phạm khóa ngoại DB.
