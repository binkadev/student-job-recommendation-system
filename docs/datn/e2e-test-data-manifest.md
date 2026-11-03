# Manifest dữ liệu E2E local

Namespace: `datn-e2e-v1`; email chỉ trong miền reserved `datn-e2e.invalid`. Snapshot đọc lại qua API: **2026-11-03T11:55:16.621Z (UTC)**. Tên người/công ty/JD/CV là tổng hợp. Không chứa password, JWT, email, stored filename hoặc storage path.

## Tài khoản bền vững

| Alias | Role | User ID | Student/Company ID | Status | CV / application history rows |
|---|---|---|---|---|---|
| student (PRIMARY) | STUDENT | 4 | 2 | ACTIVE | 2 / 3 |
| frontend | STUDENT | 5 | 3 | ACTIVE | 1 / 2 |
| data | STUDENT | 6 | 4 | ACTIVE | 1 / 31 |
| incomplete | STUDENT | 7 | 5 | ACTIVE | 0 / 0 |
| company (PRIMARY) | COMPANY | 8 | 2 | VERIFIED | 0 / 0 |
| companyB | COMPANY | 9 | 3 | VERIFIED | 0 / 0 |
| companyC | COMPANY | 10 | 4 | PENDING | 0 / 0 |
| studentUi | STUDENT | 11 | 6 | ACTIVE | 0 / 0 |
| companyUi | COMPANY | 12 | 5 | VERIFIED | 0 / 0 |

Hai PRIMARY được giữ lâu dài, login/reload được kiểm chứng. Student chính: Nguyễn Minh Khoa, năm cuối Công nghệ phần mềm, mục tiêu Backend Intern/Fresher; hồ sơ multiline có học vấn/kinh nghiệm dự án học tập/mong muốn/kỹ năng. Company chính: Sao Mai Technology E2E, Software Development, văn phòng giả định Hồ Chí Minh. Không có tax ID/contact của người thật; không gán size không có trong update DTO.

Company status khi register tự VERIFIED theo source hiện hành, là policy gap chưa thay đổi. Company C được Admin hiện hữu chuyển PENDING qua API. Không có account ADMIN mới hoặc SQL nâng quyền. Alias studentUi/companyUi được đăng ký qua browser lần đầu và tái sử dụng khi rerun.

## CV tồn tại sau test

| Alias | CV ID | Tên file tổng hợp | Language | Analysis | Active |
|---|---|---|---|---|---|
| student | 2 | datn-e2e-v1-khoa-en.pdf | en | READY | false |
| student | 1 | datn-e2e-v1-khoa-vi.docx | vi | READY | true |
| frontend | 3 | datn-e2e-v1-frontend-en.docx | en | READY | true |
| data | 4 | datn-e2e-v1-data-en.docx | en | READY | true |

Processing version: `bilingual-nlp-v2-skills-v1`. File có văn bản trích xuất được, sinh bởi `e2e/generate-cvs.py`; PDF EN, DOCX VI/EN. Không seed processedText/skills hay điểm AI vào DB. Mọi analysis qua Backend → real AI. Fixture phụ low-skills/corrupt PDF/oversize chỉ dùng negative tests. CV phụ được upload và DELETE qua API nếu không có reference; hai CV chính không bị cleanup. ID tạm trong kết quả A11/A12/B04 là bằng chứng theo lượt chạy, không phải dữ liệu demo bền vững; không có journal đầy đủ mọi ID tạm của các lần thăm dò trước.

## Jobs của Company chính

| ID | Title | Status | Deadline | Catalog skills |
|---|---|---|---|---|
| 26 | Quality Engineering Intern [datn-e2e-v1-browser] | DRAFT | 2027-06-30 | Git |
| 25 | Backend Intern — Hạn nộp đã qua [datn-e2e-v1] | ACTIVE | 2020-01-01 | Java, SQL |
| 24 | Data Engineering Intern — Hết hạn [datn-e2e-v1] | EXPIRED | 2027-06-30 | Python, SQL, Docker |
| 23 | Python Intern — Đã đóng [datn-e2e-v1] | CLOSED | 2027-06-30 | Python, SQL |
| 22 | React Intern — Chờ phê duyệt [datn-e2e-v1] | PENDING_APPROVAL | 2027-06-30 | React, TypeScript |
| 21 | Java Platform Intern — Bản nháp [datn-e2e-v1] | DRAFT | 2027-06-30 | Java, Spring Boot |
| 20 | Backend Java English Intern [datn-e2e-v1] | ACTIVE | 2027-06-30 | Java, Spring Boot, PostgreSQL, Docker |
| 19 | Mobile Developer Intern [datn-e2e-v1] | ACTIVE | 2027-06-30 | Java, Git |
| 18 | DevOps Intern [datn-e2e-v1] | ACTIVE | 2027-06-30 | Docker, Git |
| 17 | QA Tester Intern [datn-e2e-v1] | ACTIVE | 2027-06-30 | Git, SQL |
| 16 | Data Analyst Intern [datn-e2e-v1] | ACTIVE | 2027-06-30 | Python, SQL |
| 15 | Python Backend Intern [datn-e2e-v1] | ACTIVE | 2027-06-30 | Python, SQL, Docker |
| 14 | Fullstack Java React [datn-e2e-v1] | ACTIVE | 2027-06-30 | Java, React, Spring Boot, SQL |
| 13 | React Frontend Intern [datn-e2e-v1] | ACTIVE | 2027-06-30 | React, TypeScript, JavaScript, Git |
| 12 | Java Spring Boot Fresher [datn-e2e-v1] | ACTIVE | 2027-06-30 | Java, Spring Boot, SQL, Git |
| 11 | Backend Java Intern [datn-e2e-v1] | ACTIVE | 2027-06-30 | Java, Spring Boot, PostgreSQL, Docker |

16 jobs: 15 fixture API và 1 DRAFT browser; tiếng Việt/Anh, nhiều nhóm nghề, lương tổng hợp hoặc null. Công ty tạo DRAFT/gửi PENDING_APPROVAL, Admin dev hiện hữu duyệt ACTIVE. CLOSED/EXPIRED đi qua API, không gán ACTIVE trực tiếp để bỏ quy tắc. Job past-deadline cố ý giữ ACTIVE để xác minh deadline filtering; không đổi deadline của record người dùng. Python/SQL được thêm vào catalog qua API Admin vì dev seed chỉ có ít kỹ năng, không insert SQL.

## Applications và số liệu

- E2E application history: **36** rows từ các Student alias; số này tăng hợp lệ qua các lượt race/reapply sau REJECTED. Không tạo duplicate active row; không cleanup protected history.
- Primary Student:
  - Application 24, Job 11, CV 1, status REVIEWED.
  - Application 9, Job 12, CV 1, status PENDING.
  - Application 1, Job 20, CV 1, status REVIEWED.

Public statistics snapshot: jobs=20, companies=4, students=6, applications=36. Đây là DTO có public eligibility filtering, không phải raw row totals. Các count gốc đầu phiên: 10/1/1/0; record cũ được giữ.

## Rerun, persistence và credentials

- Setup theo email/title/filename cố định, không tạo account/job trùng; lịch sử recommendation/ranking và application sau REJECTED được tạo mới có chủ đích. Một worker; không chạy hai setup process đồng thời.
- Mọi record bền vững tạo/sửa qua API có xác thực; DB chỉ được kiểm tra read-only. Không reset volume. PostgreSQL/CV named volumes tồn tại qua container rebuild/recreate; read-back/login lại sau recovery.
- Credentials ở `e2e/.local/credentials.json` bị gitignore; [hướng dẫn login local](e2e-local-login.md). Không commit/chia sẻ file này. Password change chỉ dùng alias incomplete và đã restore/login lại, không đụng hai PRIMARY.
- Raw manifest `e2e/.local/manifest.json` là snapshot setup; `final-state.json` là snapshot read-back để tạo tài liệu này. Không coi snapshot cũ là live state.
- Những record/UI chưa thực thi không được suy ra từ fixture: phỏng vấn, tin nhắn, invitations, members, custom pipeline/email/2FA/privacy.
