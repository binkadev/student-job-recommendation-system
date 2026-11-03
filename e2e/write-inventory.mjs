// Generate a reviewable route/control matrix from actual browser observations.
// Navigation is deliberately never promoted to business PASS.
import fs from 'node:fs';
import path from 'node:path';
import { local, root, readLocal } from './helpers.mjs';

const evidence = readLocal('route-evidence.json');
if (evidence.rows.length !== 79) throw new Error('Route inventory is incomplete; do not publish a full-coverage matrix.');
const escape = value => String(value).replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
const unsupported = /\/(interviews|invitations|messages|members)(\/|$)|settings\/(privacy|recruitment-process|email-templates)$|edit-extracted-data$|\/(forgot-password|reset-password)$/;

function policy(route) {
  if (/^\/recruiter\/jobs\/:jobId\/(preview|statistics)$/.test(route)) return ['UNSUPPORTED', 'GET /jobs/{id} chỉ tải metadata; không preview/statistics operation', 'Hiện trang giải thích và link về chi tiết; không coi metadata là thống kê', 'P1'];
  if (unsupported.test(route)) return ['UNSUPPORTED', 'Không có business API/schema khả dụng; extracted-data trả 501', 'Không thu thập hay báo lưu thành công; cần thiết kế API/rules trước', 'P1'];
  if (/campaigns|career-resources/.test(route)) return ['UI_ONLY', 'Campaign là alias job list; career là nội dung static', 'Không coi đây là campaign CRUD hoặc CMS', 'P2'];
  if (route.includes('recommended') && route.startsWith('/candidate')) return ['PARTIAL', 'POST /students/me/recommendations/generate; GET /students/me/recommendation-runs[/id]', 'V3 READY snapshot, PRIMARY trước FALLBACK, Backend rank, 0.65/0.35; A04/B05', 'P0'];
  if (route.includes('candidate-ranking')) return ['PARTIAL', 'POST/GET /companies/me/jobs/{jobId}/candidate-ranking-runs[/runId]', 'Own Job, eligible submitted CV, independent tier limits/ranks; A10/B07', 'P0'];
  if (route.startsWith('/candidate/cvs')) return ['PARTIAL', 'GET/POST /students/me/cv; PATCH /{id}/active; GET /{id}/file/analysis; POST /{id}/reanalyze; DELETE /{id}', 'Own CV, một active, protected delete, READY không giả; A03/A11/A12/B04/B13', 'P1'];
  if (route.includes('/candidate/profile')) return ['PARTIAL', 'GET/PUT /students/me/profile-aggregate; legacy PUT /students/me[/profile|/skills] + If-Match', 'Own Student; multiline; empty string clear; ba write chưa atomic; A02/B03', 'P0'];
  if (route.includes('/recruiter/company')) return ['PARTIAL', 'GET/PUT /companies/me; GET /jobs', 'Own Company; verification submit/logo không hỗ trợ; registration tự VERIFIED là policy gap; B11', 'P0'];
  if (route.startsWith('/recruiter/jobs')) return ['PARTIAL', 'GET /companies/me/jobs; POST /jobs; GET/PUT /jobs/{id}; PATCH /jobs/{id}/status; DELETE /jobs/{id}', 'JWT-owned DB pages/count/filters, createdAt+id sort; moderation giữ nguyên; J01/J02/J03 + 260-row PostgreSQL IT; preview/statistics chưa triển khai', 'P1'];
  if (route.includes('saved-candidates')) return ['PARTIAL', 'GET/POST /companies/me/saved-candidates; DELETE /companies/me/saved-candidates/{id}', 'Unique company+student; source application không thay unique key; A10', 'P1'];
  if (route.startsWith('/recruiter/candidate')) return ['PARTIAL', 'GET /companies/me/applications[/id]; PATCH /applications/{id}/status; GET /companies/me/applications/{id}/cv/file; POST /companies/me/saved-candidates', 'Own Job/application; candidateId thực ra applicationId; không global candidate search; A06/A07/B06', 'P0'];
  if (route.includes('applications')) return ['PARTIAL', 'GET /students/me/applications[/id]; PATCH /applications/{id}/status', 'Own Student; PENDING→WITHDRAWN confirmation/read-back UI; rejected reapply qua Job detail; latest WITHDRAWN chặn; L01/L02/A06/A09/B06', 'P1'];
  if (route.includes('notifications')) return ['PARTIAL', 'GET /notifications, /notifications/unread-count; PATCH /notifications/{id}/read, /notifications/read-all; GET/PUT /users/me/notification-settings', 'Own recipient/settings; A06/A11; browser mark-read/save chưa kiểm chứng', 'P1'];
  if (route.includes('settings')) return ['PARTIAL', 'GET/PUT /students/me hoặc /companies/me; PATCH /users/me/password; GET/PUT /users/me/notification-settings', 'Own user; privacy/2FA không khả dụng; password runtime chưa kiểm chứng', 'P1'];
  if (/^\/(login|register)/.test(route)) return ['PARTIAL', 'POST /auth/register, /auth/login; GET /auth/me', 'STUDENT/COMPANY register; role redirect; credentials chỉ local; B02/B10', 'P1'];
  if (/^\/candidate\/jobs/.test(route)) return ['PARTIAL', 'GET /jobs[/id]; GET/POST/DELETE /students/me/saved-jobs; POST /jobs/{id}/apply; GET/POST/PUT/DELETE /students/me/saved-searches', 'ACTIVE/deadline, own CV, active uniqueness, latest REJECTED only; A05/A06/A08/A09/B06', 'P0'];
  if (/dashboard|reports/.test(route)) return ['PARTIAL', 'Các GET list profile/jobs/applications/recommendation/notifications hiện hữu', 'Bounded sample, company scope, không suy ra global analytics; API totals chưa audit toàn diện', 'P1'];
  if (/^\/(jobs|companies)(\/|$)|^\/$/.test(route)) return ['PARTIAL', 'GET /public/jobs[/id], /public/companies[/id], /public/statistics; Student save/apply nếu đăng nhập', 'Chỉ public eligible data; không PII/CV; A01/B01/B08', 'P1'];
  return ['UI_ONLY', 'Không có mutation API cho nội dung static/navigation', 'Nội dung hiện có không chứng minh CMS/contact submission', 'P2'];
}

function checked(route, label) {
  if (route.startsWith('/candidate/applications') && label === 'Rút đơn ứng tuyển') return 'L01 (secondary PENDING, cancel/offline/confirm/read-back)';
  if (route === '/login' && label === 'Đăng nhập') return 'B02';
  if (['/register/candidate', '/register/recruiter'].includes(route) && label === 'Đăng ký') return 'B10';
  if (route === '/jobs' && label === 'Tìm kiếm') return 'B01';
  if (route === '/jobs' && ['Lưu việc làm', 'Bỏ lưu việc làm'].includes(label)) return 'A05/B08';
  if (route === '/candidate/profile/edit' && label === 'Lưu hồ sơ') return 'B03';
  if (route === '/candidate/cvs/upload' && label === 'Tải lên') return 'B04 (secondary CV)';
  if (/^\/candidate\/cvs\/:cvId\/analysis$/.test(route) && /^Phân tích/.test(label)) return 'B04 (secondary CV)';
  if (route === '/candidate/cvs' && label === 'Đặt làm CV đang dùng') return 'A03/B13 (offline failure)';
  if (route === '/candidate/jobs/recommended' && label === 'Cập nhật gợi ý') return 'B05';
  if (route === '/candidate/jobs/recommended' && label === 'Xem phân tích') return 'B05';
  if (route === '/candidate/jobs/:jobId' && /Ứng tuyển/.test(label)) return 'B06 (submit in first run; subsequent reuse)';
  if (route === '/recruiter/company/edit' && label === 'Lưu hồ sơ') return 'B11';
  if (/^\/recruiter\/jobs\/(create|:jobId\/edit)$/.test(route) && label === 'Lưu nháp') return 'B12';
  if (route.endsWith('/candidate-ranking') && /Chạy lại|Chạy xếp hạng|Xem lịch sử/.test(label)) return 'B07';
  if (route === '/recruiter/candidates/:candidateId' && label === 'Cập nhật trạng thái') return 'B06';
  return null;
}

let text = `# Student/Company — functional gaps và kiểm kê hành động\n\nNgày: 2026-11-03. Sinh bởi \`node e2e/write-inventory.mjs\` từ source inventory + quan sát browser thật. 104 route khai báo; 79 Public/Auth/Student/Company được điều hướng, 25 Admin ngoài phạm vi UI. Chi tiết gap/defect trong [kết quả](real-world-e2e-results.md).\n\n**Không có route nào được đánh PASS chỉ vì render.** Mỗi nút/link hiện có trong main content ở trạng thái dữ liệu khảo sát được liệt kê dưới đây. Các nút trong modal/tab chỉ hiện sau tương tác nằm trong các business test được nêu và source audit trước đó; mọi nhánh chưa mở là NOT_VERIFIED. Đây không phải tuyên bố exhaustive coverage của mọi tổ hợp dữ liệu/trạng thái. Bộ quét không click các action này.\n\n- REAL + VERIFIED / PASS: action được nêu có business assertion API/browser, đúng phạm vi ghi ở evidence.\n- REAL IMPLEMENTATION / E2E NOT VERIFIED: source có API, action cụ thể chưa kiểm chứng.\n- PARTIAL: nhóm chức năng có phần thật và còn gap.\n- UNSUPPORTED: thiếu API/schema hoặc chủ đích trả 501; UI thông báo không phải hoàn thành tính năng.\n- UI_ONLY: static/alias/navigation. BLOCKED: thiếu quyết định nghiệp vụ/chưa tạo lỗi môi trường kiểm thử an toàn.\n\nPrecondition chung: đúng role, resource thuộc tài khoản E2E, Backend/AI/PostgreSQL thật; Public/Auth dùng guest. Expected chung: API quyết định dữ liệu, reload phải giữ persistence, lỗi không được báo thành công. Recommendation chung: test action NOT_VERIFIED trước khi nâng trạng thái; không triển khai policy mới khi chưa quyết định. R01 chứng minh điều hướng/không pageerror, không thay thế điều kiện này.\n\n## Gap ưu tiên\n\n| ID | Mức | Gap/actual | Đề xuất/checkpoint |\n|---|---|---|---|\n| G01 | P0 | Register tự VERIFIED; status setter thiếu approval/state machine dù UI nói phải Admin | Cần quyết định chính sách, không âm thầm sửa domain; fixture được Admin duyệt qua API |\n| G02 | P0 | Profile ba API chưa atomic/version check | Thiết kế aggregate/concurrency được review; test đồng thời chưa thực hiện |\n| G03 | P0/P1 | /jobs mixed scope, frontend giới hạn 100 trước khi lọc own | Own-company query contract/pagination; chưa tạo >100 jobs |\n| G04 | P1 | Withdrawal có API, chưa có action UI; reapply UI theo từng màn hình chưa audit hết | Thêm confirm/status mutation với regression theo V18 sau |\n| G05 | P1 | Interviews/invitations/messages/members/privacy/pipeline/email/2FA thiếu nghiệp vụ | Cần API/schema/rules; không fake persistence |\n| G06 | P1 | Company verification upload, logo/cover; candidate global search/campaign còn thiếu | Tách alias/UI placeholder khỏi khả năng thật |\n| G07 | P2 | CV review và public profile/certificates/links không có full contract; job preview/statistics unavailable | Liệt kê UI-only; không dùng score trang trí làm AI evidence |\n| G08 | P1/P2 | AI timeout/outage, session expiry/transfer, browser password/notification mutations chưa đủ E2E | Dùng isolated stack và record phụ ở lượt tiếp theo |\n| G09 | P2 | Bảng ranking desktop cần cuộn ngang nội bộ; nhiều kết quả mobile rất dài; nested main | Audit keyboard/landmarks/target size/contrast; không claim WCAG compliance |\n\n## Từng route và control đã quan sát\n`;

text = text.replace('\n\nNgày:', '\n\nCheckpoint: G01/G02 đã có moderation/atomic-profile reports. G03 trang quản lý đã có owner pagination; xem [P1 evidence](company-jobs-pagination-b06-results.md). G04 withdrawal/reapply có [lifecycle evidence](student-application-lifecycle-results.md). Dashboard/Reports còn query giới hạn riêng. B06 UNRESOLVED / NOT REPRODUCED. Các gap bên dưới là lịch sử.\n\nNgày:');

for (const [index, row] of evidence.rows.entries()) {
  const [status, api, rule, priority] = policy(row.route);
  const routeId = `F${String(index + 1).padStart(3, '0')}`;
  text += `\n### ${routeId} — ${row.role} — \`${row.route}\`\n\n`;
  text += `User intent: sử dụng màn hình tại route này; hành động cụ thể ở bảng. Precondition/rules: ${rule}. API source: \`${api}\` (prefix \`/api\`). Nhóm: **${status}**. Priority: **${priority}**. Actual: R01 tới \`${row.actualUrl}\`; business result từng control bên dưới. Evidence local: \`e2e/.local/routes/${row.id}.png\`; read requests: ${[...new Set(row.requests.map(r => `${r.path} (${r.status})`))].map(x => `\`${x}\``).join(', ') || 'không quan sát API response trong cửa sổ route này'}.\n\n`;
  text += '| ID | Hành động/control hiện có | Expected / actual verification | Evidence / recommendation |\n|---|---|---|---|\n';
  row.actions.forEach((action, actionIndex) => {
    const proof = checked(row.route, action);
    const missingAction = /^(Tải ảnh|Tải logo|Gửi hồ sơ xác thực|Xem hồ sơ công khai|Liên hệ$)/.test(action);
    const actual = status === 'UNSUPPORTED' || missingAction ? 'UNSUPPORTED — thiếu nghiệp vụ; không PASS' : proof ? 'REAL + VERIFIED — PASS trong phạm vi evidence' : status === 'UI_ONLY' ? 'UI_ONLY — business NOT_VERIFIED' : 'REAL IMPLEMENTATION / E2E NOT VERIFIED — NOT_VERIFIED cho action này';
    text += `| ${routeId}-A${String(actionIndex + 1).padStart(2, '0')} | ${escape(action)} | ${actual}; expected theo rule/API ở trên | ${proof || 'R01 chỉ thấy control; cần action assertion + reload'} |\n`;
  });
  if (!row.actions.length) text += `| ${routeId}-READ | Đọc trạng thái/nội dung | ${status}; R01 navigation only | Chưa chứng minh mutation |\n`;
  if (row.inputs.length) text += `\nForm controls: ${row.inputs.map(i => `${escape(i.name || 'không có name')} (${i.type}${i.disabled ? ', disabled' : ''})`).join('; ')}. Số lượng/định danh DOM là quan sát, không thay validation test.\n`;
}
fs.writeFileSync(path.join(root, '../docs/datn/student-company-functional-gaps.md'), text);
console.log(`Wrote ${evidence.rows.length} route sections with all observed main-content actions.`);
