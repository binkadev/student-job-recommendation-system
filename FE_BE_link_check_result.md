# FE-BE Link Check Result

Ngày kiểm tra: 28/07/2026

## 1. Trạng thái branch

- Branch hiện tại: `THI_FE`
- Commit hiện tại: `589ae31702ae7de463200d1b0dc5379afad564b7`
- Remote: `origin https://github.com/binkadev/student-job-recommendation-system.git`
- So với `origin/THI_FE`: `0 ahead / 0 behind`
- So với ref local `origin/master`: `18 ahead / 0 behind`

Lưu ý: kết quả trên dựa trên ref remote hiện có trong máy tại thời điểm kiểm tra. Chưa chạy `git fetch` hoặc `git pull` để tránh thay đổi code đang chỉnh.

## 2. Các mục chưa có API đã được ẩn khỏi menu demo

Các route vẫn được giữ để không vỡ điều hướng trực tiếp, nhưng đã bị ẩn khỏi sidebar/menu chính để tránh hiểu nhầm là chức năng đã link API đầy đủ.

### Candidate

Đã ẩn khỏi menu:

- `/candidate/interviews`
- `/candidate/invitations`
- `/candidate/messages`

Các trang này hiện chỉ hiển thị empty state rõ ràng vì backend chưa có API tương ứng.

### Recruiter

Đã ẩn khỏi menu:

- `/recruiter/campaigns`
- `/recruiter/recommended-candidates`
- `/recruiter/candidate-search`
- `/recruiter/interviews`
- `/recruiter/messages`
- `/recruiter/members`

Các trang này chưa có API backend đầy đủ nên không đưa vào luồng demo chính.

### Admin

Đã ẩn khỏi menu:

- `/admin/cv-analysis`
- `/admin/recommendation-system`
- `/admin/content`
- `/admin/reports`
- `/admin/audit-logs`
- `/admin/system-settings`

Các route vẫn giữ empty/unsupported state nếu truy cập trực tiếp.

## 3. Các luồng core vẫn giữ trong menu demo

### Candidate

- Dashboard
- Tìm việc
- Việc làm gợi ý
- Việc làm đã lưu
- Tìm kiếm đã lưu
- Hồ sơ cá nhân
- Quản lý CV
- Lịch sử ứng tuyển
- Thông báo
- Cài đặt

### Recruiter

- Dashboard
- Danh sách tin tuyển dụng
- Tạo tin tuyển dụng
- Tất cả ứng viên
- Pipeline tuyển dụng
- Hồ sơ đã lưu
- Báo cáo
- Hồ sơ công ty
- Cài đặt

### Admin

- Dashboard
- Người dùng
- Nhà tuyển dụng
- Doanh nghiệp
- Tin tuyển dụng
- Đơn ứng tuyển
- Danh mục
- Thống kê

## 4. Kết quả build/lint

### Build

Lệnh:

```bash
npm run build
```

Kết quả: thành công.

Ghi chú: Vite có cảnh báo chunk lớn hơn 500 KB. Đây là warning tối ưu bundle, không phải lỗi build.

### Lint

Lệnh:

```bash
npm run lint
```

Kết quả: không có error, còn 8 warning cũ:

- `AuthProvider.tsx`: Fast refresh warning
- `ToastProvider.tsx`: Fast refresh warning
- `AdminAnalyticsPage.tsx`: useMemo dependency warning
- `AdminCategoriesPage.tsx`: useMemo dependency warning
- `RecruiterReportsPage.tsx`: useMemo dependency warning

Các warning này không phát sinh từ phần chỉnh menu mục 5-7.

## 5. Kết luận

Các chức năng chưa có API backend đã được loại khỏi menu demo chính. Core FE-BE còn lại tập trung vào các luồng đã có API thật: auth, public jobs/companies/statistics, student CV/apply/saved jobs/recommendation, recruiter jobs/applications/saved candidates/reports/company/settings, admin users/companies/jobs/applications/categories/analytics.
