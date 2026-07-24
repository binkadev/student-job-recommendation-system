import type { AppRoute } from "../types/navigation";
import { breadcrumbLabels } from "../constants/breadcrumbs";

export interface MetricCard {
  label: string;
  value: string;
  hint: string;
}

export interface DataRecord {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  meta: string;
}

export interface PageContent {
  title: string;
  description: string;
  primaryAction: string;
  secondaryAction: string;
  metrics: MetricCard[];
  records: DataRecord[];
  workflow: string[];
  statuses: string[];
  notes: string[];
}

const copyByPath: Record<string, Pick<PageContent, "title" | "description">> = {
  "/": {
    title: "Trang chủ",
    description: "Tổng quan việc làm IT, công ty nổi bật, gợi ý nhanh và điểm truy cập cho ứng viên hoặc nhà tuyển dụng.",
  },
  "/jobs": {
    title: "Danh sách việc làm",
    description: "Tìm kiếm, lọc và xem nhanh các việc làm IT phù hợp với kỹ năng, địa điểm và mức lương mong muốn.",
  },
  "/jobs/:jobId": {
    title: "Chi tiết việc làm",
    description: "Thông tin vị trí, công ty, kỹ năng yêu cầu, quyền lợi và mức độ phù hợp với hồ sơ ứng viên.",
  },
  "/companies": {
    title: "Danh sách công ty",
    description: "Khám phá doanh nghiệp đang tuyển dụng, quy mô, lĩnh vực và số lượng việc làm đang mở.",
  },
  "/companies/:companyId": {
    title: "Chi tiết công ty",
    description: "Hồ sơ doanh nghiệp, môi trường làm việc, quyền lợi và danh sách việc làm của công ty.",
  },
  "/career-resources": {
    title: "Cẩm nang nghề nghiệp",
    description: "Bài viết hướng dẫn viết CV, phỏng vấn, định hướng kỹ năng và lộ trình nghề nghiệp IT.",
  },
  "/career-resources/:slug": {
    title: "Chi tiết cẩm nang",
    description: "Nội dung bài viết nghề nghiệp kèm các gợi ý thực hành cho sinh viên IT.",
  },
  "/about": {
    title: "Giới thiệu",
    description: "Thông tin về hệ thống gợi ý việc làm dựa trên CV, hồ sơ cá nhân và nhu cầu tuyển dụng.",
  },
  "/contact": {
    title: "Liên hệ",
    description: "Kênh liên hệ hỗ trợ ứng viên, nhà tuyển dụng và quản trị hệ thống.",
  },
  "/privacy-policy": {
    title: "Chính sách bảo mật",
    description: "Quy định về thu thập, lưu trữ và sử dụng dữ liệu hồ sơ, CV và thông tin tuyển dụng.",
  },
  "/terms": {
    title: "Điều khoản sử dụng",
    description: "Điều kiện sử dụng nền tảng, trách nhiệm người dùng và quy định đăng tin tuyển dụng.",
  },
  "/register": {
    title: "Đăng ký tài khoản",
    description: "Chọn loại tài khoản phù hợp để bắt đầu sử dụng hệ thống.",
  },
  "/register/candidate": {
    title: "Đăng ký ứng viên",
    description: "Khởi tạo tài khoản ứng viên, bổ sung hồ sơ cá nhân và tải CV ở bước sau.",
  },
  "/register/recruiter": {
    title: "Đăng ký nhà tuyển dụng",
    description: "Khởi tạo tài khoản doanh nghiệp và chuẩn bị thông tin xác thực công ty.",
  },
  "/forgot-password": {
    title: "Quên mật khẩu",
    description: "Nhập email để nhận hướng dẫn đặt lại mật khẩu.",
  },
  "/reset-password": {
    title: "Đặt lại mật khẩu",
    description: "Thiết lập mật khẩu mới cho tài khoản.",
  },
  "/candidate/dashboard": {
    title: "Tổng quan ứng viên",
    description: "Theo dõi mức độ hoàn thiện hồ sơ, CV, việc làm gợi ý, lịch phỏng vấn và trạng thái ứng tuyển.",
  },
  "/candidate/jobs": {
    title: "Tìm việc",
    description: "Danh sách việc làm phù hợp cho ứng viên với bộ lọc theo kỹ năng, địa điểm, kinh nghiệm và mức lương.",
  },
  "/candidate/jobs/:jobId": {
    title: "Chi tiết việc làm",
    description: "Xem mô tả công việc, yêu cầu kỹ năng, quyền lợi, thông tin công ty và thao tác lưu hoặc ứng tuyển.",
  },
  "/candidate/jobs/recommended": {
    title: "Việc làm gợi ý",
    description: "Các công việc được xếp hạng theo mức độ phù hợp với CV, kỹ năng và mong muốn nghề nghiệp.",
  },
  "/candidate/jobs/saved": {
    title: "Việc làm đã lưu",
    description: "Danh sách việc làm ứng viên đã lưu để theo dõi và ứng tuyển sau.",
  },
  "/candidate/jobs/saved-searches": {
    title: "Tìm kiếm đã lưu",
    description: "Quản lý các bộ lọc tìm kiếm đã lưu và bật thông báo việc làm mới.",
  },
  "/candidate/profile": {
    title: "Hồ sơ cá nhân",
    description: "Thông tin cá nhân, mục tiêu nghề nghiệp, học vấn, kinh nghiệm và kỹ năng của ứng viên.",
  },
  "/candidate/profile/edit": {
    title: "Chỉnh sửa hồ sơ",
    description: "Cập nhật thông tin cơ bản, mục tiêu nghề nghiệp, kinh nghiệm, học vấn và kỹ năng.",
  },
  "/candidate/profile/preferences": {
    title: "Mong muốn nghề nghiệp",
    description: "Thiết lập vị trí mong muốn, địa điểm làm việc, mức lương, hình thức làm việc và công nghệ quan tâm.",
  },
  "/candidate/cvs": {
    title: "Quản lý CV",
    description: "Theo dõi danh sách CV, CV mặc định, trạng thái tải lên và kết quả phân tích.",
  },
  "/candidate/cvs/upload": {
    title: "Tải CV",
    description: "Tải lên CV, theo dõi tiến trình phân tích và chuẩn bị dữ liệu trích xuất.",
  },
  "/candidate/cvs/:cvId": {
    title: "Chi tiết CV",
    description: "Xem thông tin CV, kỹ năng trích xuất, kinh nghiệm, học vấn và trạng thái xác nhận dữ liệu.",
  },
  "/candidate/cvs/:cvId/analysis": {
    title: "Kết quả phân tích CV",
    description: "Kết quả phân tích kỹ năng, kinh nghiệm, học vấn và các cảnh báo thiếu thông tin.",
  },
  "/candidate/cvs/:cvId/edit-extracted-data": {
    title: "Chỉnh sửa dữ liệu trích xuất",
    description: "Kiểm tra, chỉnh sửa và xác nhận dữ liệu được hệ thống đọc từ CV.",
  },
  "/candidate/cvs/:cvId/review": {
    title: "Đánh giá CV",
    description: "Nhận xét mức độ hoàn thiện CV và gợi ý cải thiện nội dung trước khi ứng tuyển.",
  },
  "/candidate/applications": {
    title: "Lịch sử ứng tuyển",
    description: "Theo dõi các đơn ứng tuyển, trạng thái xử lý, lịch phỏng vấn và phản hồi từ nhà tuyển dụng.",
  },
  "/candidate/applications/:applicationId": {
    title: "Chi tiết đơn ứng tuyển",
    description: "Thông tin vị trí đã ứng tuyển, CV đã chọn, thư giới thiệu và timeline xử lý.",
  },
  "/candidate/applications/:applicationId/status": {
    title: "Timeline trạng thái ứng tuyển",
    description: "Các mốc xử lý đơn ứng tuyển từ lúc gửi hồ sơ đến khi có kết quả.",
  },
  "/candidate/interviews": {
    title: "Lịch phỏng vấn",
    description: "Danh sách lịch phỏng vấn, hình thức, người phỏng vấn và trạng thái xác nhận.",
  },
  "/candidate/interviews/:interviewId": {
    title: "Chi tiết phỏng vấn",
    description: "Thông tin buổi phỏng vấn, địa điểm hoặc liên kết họp, người phụ trách và ghi chú chuẩn bị.",
  },
  "/candidate/invitations": {
    title: "Lời mời ứng tuyển",
    description: "Các lời mời ứng tuyển từ nhà tuyển dụng kèm thao tác chấp nhận hoặc từ chối.",
  },
  "/candidate/invitations/:invitationId": {
    title: "Chi tiết lời mời",
    description: "Thông tin công việc được mời, lý do phù hợp và lựa chọn tiếp tục ứng tuyển.",
  },
  "/candidate/messages": {
    title: "Tin nhắn",
    description: "Danh sách hội thoại với nhà tuyển dụng, lịch phỏng vấn và trao đổi về đơn ứng tuyển.",
  },
  "/candidate/messages/:conversationId": {
    title: "Chi tiết hội thoại",
    description: "Nội dung trao đổi giữa ứng viên và nhà tuyển dụng.",
  },
  "/candidate/notifications": {
    title: "Thông báo",
    description: "Thông báo về việc làm gợi ý, CV, đơn ứng tuyển, phỏng vấn và lời mời.",
  },
  "/candidate/settings": {
    title: "Cài đặt ứng viên",
    description: "Quản lý tài khoản, bảo mật, quyền riêng tư và thông báo.",
  },
  "/recruiter/dashboard": {
    title: "Tổng quan nhà tuyển dụng",
    description: "Theo dõi tin tuyển dụng, ứng viên mới, lịch phỏng vấn, pipeline và hiệu quả tuyển dụng.",
  },
  "/recruiter/company": {
    title: "Hồ sơ công ty",
    description: "Thông tin doanh nghiệp, thương hiệu tuyển dụng, trạng thái xác thực và việc làm đang mở.",
  },
  "/recruiter/jobs": {
    title: "Danh sách tin tuyển dụng",
    description: "Quản lý tin tuyển dụng theo trạng thái bản nháp, chờ duyệt, đang hiển thị hoặc đã đóng.",
  },
  "/recruiter/jobs/create": {
    title: "Tạo tin tuyển dụng",
    description: "Nhập thông tin cơ bản, mô tả công việc, kỹ năng, câu hỏi sàng lọc và xem trước tin.",
  },
  "/recruiter/candidates": {
    title: "Tất cả ứng viên",
    description: "Danh sách ứng viên đã ứng tuyển, điểm phù hợp, CV và trạng thái trong quy trình tuyển dụng.",
  },
  "/recruiter/pipeline": {
    title: "Pipeline tuyển dụng",
    description: "Bảng Kanban theo dõi ứng viên qua từng cột trạng thái tuyển dụng.",
  },
  "/recruiter/recommended-candidates": {
    title: "Ứng viên được gợi ý",
    description: "Danh sách ứng viên phù hợp với tin tuyển dụng dựa trên kỹ năng, kinh nghiệm và CV.",
  },
  "/recruiter/interviews": {
    title: "Phỏng vấn",
    description: "Quản lý lịch phỏng vấn, người phỏng vấn, hình thức và trạng thái xác nhận.",
  },
  "/admin/dashboard": {
    title: "Tổng quan quản trị",
    description: "Theo dõi người dùng, doanh nghiệp, tin tuyển dụng, CV phân tích và hoạt động hệ thống.",
  },
  "/admin/jobs/pending": {
    title: "Tin chờ duyệt",
    description: "Danh sách tin tuyển dụng cần kiểm tra nội dung trước khi hiển thị công khai.",
  },
  "/admin/companies": {
    title: "Doanh nghiệp",
    description: "Quản lý doanh nghiệp, hồ sơ công ty và trạng thái xác thực.",
  },
  "/admin/categories": {
    title: "Danh mục",
    description: "Quản lý ngành nghề, chức danh, kỹ năng, địa điểm, loại việc làm và cấp bậc kinh nghiệm.",
  },
  "/admin/cv-analysis": {
    title: "CV và thuật toán gợi ý",
    description: "Theo dõi thống kê phân tích CV, lỗi trích xuất và cấu hình hệ thống gợi ý.",
  },
};

const publicRecords: DataRecord[] = [
  { id: "JOB-101", title: "Frontend Developer Intern", subtitle: "FPT Software - Hà Nội", status: "Đang tuyển", meta: "React, TypeScript, 8-12 triệu" },
  { id: "JOB-102", title: "Java Backend Fresher", subtitle: "VNG Corporation - TP. Hồ Chí Minh", status: "Phù hợp 86%", meta: "Spring Boot, PostgreSQL" },
  { id: "JOB-103", title: "Data Analyst Intern", subtitle: "TopCV Tech - Hybrid", status: "Mới đăng", meta: "SQL, Python, Dashboard" },
];

const candidateRecords: DataRecord[] = [
  { id: "APP-001", title: "Frontend Developer Intern", subtitle: "CV React Intern.pdf", status: "Đang xem xét", meta: "Phù hợp 92%" },
  { id: "CV-002", title: "CV Backend Fresher", subtitle: "Đã phân tích 24 kỹ năng", status: "Cần xác nhận", meta: "Cập nhật 10/07/2026" },
  { id: "INV-003", title: "Lời mời từ Tiki Tech", subtitle: "Junior Java Developer", status: "Chờ phản hồi", meta: "Hạn trả lời: 15/07/2026" },
];

const recruiterRecords: DataRecord[] = [
  { id: "JOB-201", title: "Java Backend Fresher", subtitle: "42 ứng viên, 8 ứng viên phù hợp cao", status: "Đang hiển thị", meta: "Hết hạn sau 18 ngày" },
  { id: "CAN-202", title: "Nguyễn Văn An", subtitle: "React, TypeScript, Spring Boot", status: "Phù hợp 91%", meta: "Đang ở vòng CV" },
  { id: "INT-203", title: "Phỏng vấn với Lê Minh", subtitle: "Google Meet - 14:00", status: "Đã xác nhận", meta: "12/07/2026" },
];

const adminRecords: DataRecord[] = [
  { id: "ADM-301", title: "Công ty ABC Tech", subtitle: "Hồ sơ xác thực doanh nghiệp", status: "Chờ duyệt", meta: "Gửi lúc 09:30" },
  { id: "ADM-302", title: "Tin tuyển dụng Java Backend", subtitle: "Nội dung cần kiểm tra", status: "Chờ duyệt", meta: "Nhà tuyển dụng: VNG" },
  { id: "ADM-303", title: "CV lỗi trích xuất", subtitle: "Không đọc được kinh nghiệm", status: "Cần xử lý", meta: "Mã CV: CV-889" },
];

const publicWorkflow = ["Tìm kiếm việc làm", "Xem danh sách", "Mở chi tiết", "Đăng nhập hoặc đăng ký", "Ứng tuyển"];
const candidateWorkflow = ["Hoàn thiện hồ sơ", "Tải CV", "Xác nhận dữ liệu CV", "Xem việc làm gợi ý", "Ứng tuyển", "Theo dõi trạng thái"];
const recruiterWorkflow = ["Xác thực công ty", "Tạo tin tuyển dụng", "Gửi duyệt", "Xem ứng viên", "Chuyển pipeline", "Tạo lịch phỏng vấn"];
const adminWorkflow = ["Kiểm tra dữ liệu", "Xem chi tiết", "Duyệt hoặc từ chối", "Ghi lý do", "Cập nhật trạng thái", "Theo dõi nhật ký"];

function detectArea(path: string) {
  if (path.startsWith("/candidate")) return "candidate";
  if (path.startsWith("/recruiter")) return "recruiter";
  if (path.startsWith("/admin")) return "admin";
  return "public";
}

function metricsFor(path: string): MetricCard[] {
  if (path.includes("/cvs")) {
    return [
      { label: "CV đã tải", value: "3", hint: "1 CV đang đặt mặc định" },
      { label: "Kỹ năng trích xuất", value: "24", hint: "React, Java, SQL, Docker" },
      { label: "Độ hoàn thiện", value: "82%", hint: "Cần bổ sung dự án cá nhân" },
    ];
  }

  if (path.includes("/applications") || path.includes("/pipeline")) {
    return [
      { label: "Mới nhận", value: "12", hint: "Tăng 4 so với tuần trước" },
      { label: "Đang xử lý", value: "8", hint: "Có 3 hồ sơ cần phản hồi" },
      { label: "Phỏng vấn", value: "5", hint: "2 lịch trong hôm nay" },
    ];
  }

  if (path.includes("/jobs")) {
    return [
      { label: "Việc làm phù hợp", value: "128", hint: "Dựa trên kỹ năng và CV" },
      { label: "Mức phù hợp cao", value: "18", hint: "Từ 85% trở lên" },
      { label: "Đã lưu", value: "7", hint: "Có 2 việc sắp hết hạn" },
    ];
  }

  if (path.includes("/admin")) {
    return [
      { label: "Người dùng", value: "2.418", hint: "124 tài khoản mới trong tháng" },
      { label: "Tin chờ duyệt", value: "16", hint: "Ưu tiên kiểm tra hôm nay" },
      { label: "CV lỗi", value: "9", hint: "Cần xem log trích xuất" },
    ];
  }

  if (path.includes("/recruiter")) {
    return [
      { label: "Tin đang tuyển", value: "6", hint: "2 tin sắp hết hạn" },
      { label: "Ứng viên mới", value: "42", hint: "8 ứng viên phù hợp cao" },
      { label: "Lịch phỏng vấn", value: "5", hint: "3 lịch đã xác nhận" },
    ];
  }

  return [
    { label: "Việc làm IT", value: "1.248", hint: "Đang mở trên hệ thống" },
    { label: "Công ty tuyển dụng", value: "326", hint: "Đã xác thực hồ sơ" },
    { label: "Ứng viên hoạt động", value: "8.540", hint: "Cập nhật hồ sơ trong 30 ngày" },
  ];
}

function statusesFor(path: string): string[] {
  if (path.includes("/cvs")) {
    return ["Chưa có CV", "Đang tải CV", "Tải CV thành công", "Đang phân tích CV", "Phân tích thành công", "Phân tích thất bại", "CV thiếu thông tin", "Dữ liệu cần xác nhận"];
  }
  if (path.includes("/applications")) {
    return ["Đã gửi", "Nhà tuyển dụng đã xem", "Đang xem xét", "Qua vòng hồ sơ", "Mời phỏng vấn", "Đã phỏng vấn", "Nhận offer", "Không phù hợp", "Ứng viên đã rút hồ sơ"];
  }
  if (path.includes("/pipeline")) {
    return ["Mới nhận", "Đang xem xét", "Qua vòng CV", "Phỏng vấn", "Offer", "Đã tuyển", "Không phù hợp"];
  }
  if (path.includes("/recruiter/jobs") || path.includes("/admin/jobs")) {
    return ["Bản nháp", "Chờ duyệt", "Đang hiển thị", "Tạm dừng", "Hết hạn", "Bị từ chối", "Đã đóng"];
  }
  return ["Đang hoạt động", "Cần cập nhật", "Chờ xác nhận", "Hoàn tất"];
}

function notesFor(path: string): string[] {
  if (path.includes("/settings")) return ["Cho phép chỉnh sửa cấu hình tài khoản.", "Chưa kết nối API lưu dữ liệu thật.", "Có thể dùng mock để kiểm tra trạng thái bật/tắt."];
  if (path.includes("/messages")) return ["Danh sách hội thoại dùng dữ liệu mẫu.", "Có ô nhập tin nhắn để kiểm tra bố cục.", "Chưa gửi dữ liệu ra backend."];
  if (path.includes("/interviews")) return ["Hiển thị thời gian, hình thức và người phụ trách.", "Có thao tác xác nhận hoặc đổi lịch ở mức giao diện.", "Không gửi email thật ở giai đoạn này."];
  if (path.includes("/recommendation") || path.includes("/recommended")) return ["Điểm phù hợp chỉ là dữ liệu minh họa.", "Chưa chạy thuật toán gợi ý thật.", "Dữ liệu dùng để kiểm tra luồng xem chi tiết."];
  return ["Dữ liệu đang ở dạng mock để kiểm tra điều hướng.", "Các thao tác chỉ thay đổi trạng thái trên giao diện.", "Chưa tích hợp API backend ở bước này."];
}

function recordsFor(path: string): DataRecord[] {
  const area = detectArea(path);
  if (area === "candidate") return candidateRecords;
  if (area === "recruiter") return recruiterRecords;
  if (area === "admin") return adminRecords;
  return publicRecords;
}

function workflowFor(path: string): string[] {
  const area = detectArea(path);
  if (area === "candidate") return candidateWorkflow;
  if (area === "recruiter") return recruiterWorkflow;
  if (area === "admin") return adminWorkflow;
  return publicWorkflow;
}

function actionsFor(path: string) {
  if (path.includes("/admin")) return { primaryAction: "Duyệt mục đang chọn", secondaryAction: "Từ chối / yêu cầu chỉnh sửa" };
  if (path.includes("/recruiter")) return { primaryAction: "Chuyển trạng thái", secondaryAction: "Tạo ghi chú nội bộ" };
  if (path.includes("/candidate/jobs")) return { primaryAction: "Ứng tuyển", secondaryAction: "Lưu việc làm" };
  if (path.includes("/candidate/cvs")) return { primaryAction: "Xác nhận dữ liệu", secondaryAction: "Đặt làm CV mặc định" };
  if (path.includes("/candidate")) return { primaryAction: "Cập nhật thông tin", secondaryAction: "Xem bước tiếp theo" };
  return { primaryAction: "Xem chi tiết", secondaryAction: "Lưu quan tâm" };
}

function fallbackCopy(route: AppRoute) {
  const segments = route.path.split("/").filter(Boolean);
  const lastSegment = [...segments].reverse().find((segment) => !segment.startsWith(":"));
  const label = lastSegment ? (breadcrumbLabels[lastSegment] ?? lastSegment.replaceAll("-", " ")) : route.title;
  const area = detectArea(route.path);
  const prefix = area === "candidate" ? "Ứng viên" : area === "recruiter" ? "Nhà tuyển dụng" : area === "admin" ? "Quản trị viên" : "Công khai";
  const hasDynamicId = segments.some((segment) => segment.startsWith(":"));
  const hasCreate = segments.includes("create") || segments.includes("invite");
  const hasEdit = segments.includes("edit");
  const actionPrefix = hasDynamicId ? "Chi tiết" : hasCreate ? "Tạo mới" : hasEdit ? "Chỉnh sửa" : prefix;
  const cleanTitle = route.title
    .replace("Candidate Dashboard", "Tổng quan ứng viên")
    .replace("Recruiter Dashboard", "Tổng quan nhà tuyển dụng")
    .replace("Admin Dashboard", "Tổng quan quản trị");

  return {
    title: cleanTitle === route.title ? `${actionPrefix} - ${label.charAt(0).toUpperCase()}${label.slice(1)}` : cleanTitle,
    description: `Màn hình ${label} dùng dữ liệu mẫu để kiểm tra bố cục, trạng thái và luồng thao tác trước khi tích hợp API.`,
  };
}

export function getPageContent(route: AppRoute): PageContent {
  const copy = copyByPath[route.path] ?? fallbackCopy(route);
  const actions = actionsFor(route.path);

  return {
    ...copy,
    ...actions,
    metrics: metricsFor(route.path),
    records: recordsFor(route.path),
    workflow: workflowFor(route.path),
    statuses: statusesFor(route.path),
    notes: notesFor(route.path),
  };
}
