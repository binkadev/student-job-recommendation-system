# Manual E2E Demo Checklist

Chạy checklist này trên clean `master` với Frontend, Backend, AI Service và
PostgreSQL cùng một environment. Ghi thời gian, commit SHA, browser, người chạy
và link/screenshot/log evidence vào từng dòng.

Trạng thái hợp lệ: `NOT RUN`, `PASS`, `FAIL`, `BLOCKED`. Không đổi thành `PASS`
nếu chưa thực thi đúng scenario và kiểm tra evidence.

| ID | Role | Scenario | Expected | Actual | Status | Evidence |
|---|---|---|---|---|---|---|
| ENV-01 | System | Khởi động clean core stack và Frontend từ commit được kiểm thử | PostgreSQL, Backend và AI healthy; Frontend mở được; không có secret trong output | — | NOT RUN | — |
| AUTH-01 | Anonymous | Mở public company/job/statistics pages | Public data tải từ Backend mà không cần JWT | — | NOT RUN | — |
| AUTH-02 | Anonymous | Gọi một protected Student endpoint không có JWT | Backend trả `401`; response có `X-Request-Id` hợp lệ | — | NOT RUN | — |
| AUTH-03 | Student | Gọi Company/Admin endpoint bằng Student JWT | Backend từ chối theo role; không có side effect | — | NOT RUN | — |
| AUTH-04 | Company | Truy cập Job/Application của Company khác | Backend không trả dữ liệu hoặc cho phép thay đổi tài nguyên không thuộc sở hữu | — | NOT RUN | — |
| AUTH-05 | Student | Truy cập CV/recommendation run của Student khác | Backend không để lộ metadata, file hoặc kết quả của owner khác | — | NOT RUN | — |
| COM-01 | Company | Đăng nhập và xem/cập nhật hồ sơ Company | Dữ liệu tải/lưu qua Backend và vẫn company-scoped | — | NOT RUN | — |
| COM-02 | Company | Tạo Job hợp lệ và gửi vào trạng thái cần duyệt | Job được persist với đúng Company và trạng thái nghiệp vụ | — | NOT RUN | — |
| COM-03 | Company | Xem danh sách/chi tiết Application của Job thuộc sở hữu | Chỉ Application thuộc Company được hiển thị; không lộ internal CV path | — | NOT RUN | — |
| ADM-01 | Admin | Đăng nhập và xem danh sách Company/Job chờ duyệt | Dữ liệu quản trị tải từ Backend bằng Admin JWT | — | NOT RUN | — |
| ADM-02 | Admin | Duyệt Company/Job được chuẩn bị cho demo | Trạng thái chuyển hợp lệ; Job đủ điều kiện xuất hiện ở public/eligible corpus | — | NOT RUN | — |
| STU-01 | Student | Đăng nhập, upload một PDF/DOCX hợp lệ và đặt active | CV được persist; UI không coi CV mới upload là `READY` | — | NOT RUN | — |
| STU-02 | Student | Reanalyze CV và theo dõi trạng thái | UI xử lý `NOT_READY`/`PROCESSING`; kết quả hợp lệ đạt `READY`; failure nếu có được hiển thị an toàn | — | NOT RUN | — |
| STU-03 | Student | Thử generate bằng CV chưa `READY` | UI chặn thao tác và Backend vẫn bảo vệ business rule | — | NOT RUN | — |
| REC-01 | Student | Generate recommendation bằng CV `READY` | Backend lọc eligible jobs, gọi AI V2 và persist một run kết thúc hợp lệ | — | NOT RUN | — |
| REC-02 | Student | Mở latest recommendation results | Kết quả theo `rankPosition`; Backend-owned order nhất quán; component scores/strategy/reason hiển thị theo contract | — | NOT RUN | — |
| REC-03 | Student | Kiểm tra run mới nhất failed/incomplete và một historical `SUCCESS` | UI không trình bày failed run như kết quả thành công; historical result được gắn nhãn rõ | — | NOT RUN | — |
| REC-04 | System | Correlate một generate request qua Backend và AI logs | Cùng `requestId` xuất hiện trong safe completion logs; không có JWT, internal key, raw CV/Job text hoặc file path | — | NOT RUN | — |
| STU-04 | Student | Apply vào Job eligible bằng CV đã chọn | Application được persist một lần và xuất hiện trong lịch sử Student | — | NOT RUN | — |
| STU-05 | Student | Apply lần hai vào cùng Job | Backend từ chối duplicate; không tạo bản ghi thứ hai | — | NOT RUN | — |
| FLOW-01 | Company → Admin → Student | Company tạo Job → Admin duyệt → Student upload/reanalyze CV → generate → xem recommendation → apply → Company xem Application | Toàn bộ luồng đi qua Frontend/Backend; AI chỉ nhận internal V2 calls; dữ liệu và ownership nhất quán | — | NOT RUN | — |

## Run Metadata

```text
Date/time:
Tester(s):
Commit SHA:
Environment:
Browser/version:
Backend URL:
AI health URL:
Dataset/fixture identifier:
Known deviations:
```

Không ghi JWT, internal API key, password, raw CV, private dataset hoặc internal
storage path vào checklist/evidence.
