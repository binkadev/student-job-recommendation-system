// Synthetic people, employer and job content. Sources: docs/datn/e2e-external-data-sources.md.
export const namespace = 'datn-e2e-v1';
export const accounts = {
  student: { fullName: 'Nguyễn Minh Khoa', role: 'STUDENT' },
  frontend: { fullName: 'Trần An E2E', role: 'STUDENT' },
  data: { fullName: 'Lê Bình E2E', role: 'STUDENT' },
  incomplete: { fullName: 'Hồ Châu E2E', role: 'STUDENT' },
  company: { fullName: 'Nhà tuyển dụng Sao Mai E2E', role: 'COMPANY', companyName: 'Sao Mai Technology E2E' },
  companyB: { fullName: 'Nhà tuyển dụng Bắc Đẩu E2E', role: 'COMPANY', companyName: 'Bắc Đẩu Software E2E' },
  companyC: { fullName: 'Nhà tuyển dụng Chờ duyệt E2E', role: 'COMPANY', companyName: 'Chờ duyệt Technology E2E' },
};

export const studentProfile = {
  summary: 'Sinh viên năm cuối ngành Công nghệ phần mềm, hướng tới vị trí Backend Developer Intern/Fresher. Mong muốn xây dựng dịch vụ dễ kiểm thử, làm việc có trách nhiệm và học hỏi qua code review. Đây là nhân vật tổng hợp phục vụ kiểm thử E2E.',
  education: '2022–2026: Chương trình đại học giả định phục vụ E2E, chuyên ngành Công nghệ phần mềm.\nHọc phần: cấu trúc dữ liệu, lập trình hướng đối tượng, cơ sở dữ liệu, kiểm thử phần mềm.',
  experience: 'Dự án học phần theo nhóm 4 sinh viên: phân chia công việc, viết tài liệu API, dùng Git và review pull request.\nChưa có kinh nghiệm làm việc chính thức.',
  projects: 'Cổng thư viện sinh viên: Java, Spring Boot, PostgreSQL, REST API. Phụ trách phân quyền, tìm kiếm sách và kiểm thử controller.\nTriển khai môi trường học tập bằng Docker Compose, quản lý mã nguồn bằng Git.',
  targetPosition: 'Backend Developer Intern / Fresher',
  preferredLocation: 'Thành phố Hồ Chí Minh',
  preferredJobType: 'INTERNSHIP',
};

// Only supported DTO fields are used. No tax ID, real contact or unsupported company size.
export const companyProfile = {
  companyName: accounts.company.companyName,
  industry: 'Software Development',
  address: 'Thành phố Hồ Chí Minh — văn phòng giả định E2E',
  description: 'Doanh nghiệp giả định phát triển phần mềm quản lý vận hành cho các nhóm bán lẻ và giáo dục. Nhóm kỹ thuật thực hành code review, kiểm thử tự động và giao phần việc phù hợp cho sinh viên có mentor. Hồ sơ này chỉ dùng kiểm thử và trình diễn local, không đại diện doanh nghiệp thật.',
  website: '', phone: '',
};

const roles = [
  ['Backend Java Intern', ['Java', 'Spring Boot', 'PostgreSQL', 'Docker'], 'vi', 'ACTIVE'],
  ['Java Spring Boot Fresher', ['Java', 'Spring Boot', 'SQL', 'Git'], 'vi', 'ACTIVE'],
  ['React Frontend Intern', ['React', 'TypeScript', 'JavaScript', 'Git'], 'en', 'ACTIVE'],
  ['Fullstack Java React', ['Java', 'React', 'Spring Boot', 'SQL'], 'vi', 'ACTIVE'],
  ['Python Backend Intern', ['Python', 'SQL', 'Docker'], 'en', 'ACTIVE'],
  ['Data Analyst Intern', ['Python', 'SQL'], 'vi', 'ACTIVE'],
  ['QA Tester Intern', ['Git', 'SQL'], 'vi', 'ACTIVE'],
  ['DevOps Intern', ['Docker', 'Git'], 'en', 'ACTIVE'],
  ['Mobile Developer Intern', ['Java', 'Git'], 'en', 'ACTIVE'],
  ['Backend Java English Intern', ['Java', 'Spring Boot', 'PostgreSQL', 'Docker'], 'en', 'ACTIVE'],
  ['Java Platform Intern — Bản nháp', ['Java', 'Spring Boot'], 'vi', 'DRAFT'],
  ['React Intern — Chờ phê duyệt', ['React', 'TypeScript'], 'vi', 'PENDING_APPROVAL'],
  ['Python Intern — Đã đóng', ['Python', 'SQL'], 'en', 'CLOSED'],
  ['Data Engineering Intern — Hết hạn', ['Python', 'SQL', 'Docker'], 'vi', 'EXPIRED'],
  ['Backend Intern — Hạn nộp đã qua', ['Java', 'SQL'], 'vi', 'ACTIVE_PAST_DEADLINE'],
];

export const jobs = roles.map(([title, skillNames, language, targetStatus], index) => ({
  key: `job-${index + 1}`,
  skillNames, language, targetStatus,
  payload: {
    title: `${title} [${namespace}]`,
    description: language === 'vi'
      ? `Sao Mai Technology E2E tuyển ${title} cho nhóm xây dựng cổng quản lý vận hành. Bạn sẽ làm việc cùng người hướng dẫn, phân tích yêu cầu, phát triển chức năng nhỏ, viết kiểm thử và trao đổi trong buổi đánh giá mã nguồn. Công việc dành cho sinh viên CNTT muốn học cách giao sản phẩm có chất lượng. Đây là tin tổng hợp cho kiểm thử local. Các công nghệ sử dụng: ${skillNames.join(', ')}.`
      : `Join the synthetic Sao Mai E2E engineering team as a ${title}. Work with a mentor to deliver a small feature, review requirements, write automated tests and discuss code changes. The team builds an operations portal and values clear documentation and maintainable software. This fictional opening is for local quality assurance only. Technologies: ${skillNames.join(', ')}.`,
    requirements: language === 'vi'
      ? `Sinh viên năm cuối ngành CNTT hoặc mới tốt nghiệp; nắm kiến thức nền tảng, có dự án học tập và sẵn sàng giải thích lựa chọn kỹ thuật. Biết ${skillNames.join(', ')}; có thể đọc tài liệu, phối hợp theo nhóm và tiếp nhận phản hồi. Không yêu cầu kinh nghiệm chuyên nghiệp.`
      : `Final-year computing student or recent graduate with a coursework project. Understand ${skillNames.join(', ')} and basic software testing. Explain technical decisions, collaborate using version control, read documentation and accept review feedback. Professional experience is not required.`,
    benefits: language === 'vi' ? 'Có người hướng dẫn, thời gian trao đổi kỹ thuật hàng tuần và lịch làm việc linh hoạt theo lịch học. Trợ cấp là dữ liệu giả định E2E.' : 'Mentor support, weekly technical feedback and flexible study-compatible hours. Compensation is synthetic E2E data.',
    location: index % 3 === 0 ? 'Thành phố Hồ Chí Minh' : 'Ho Chi Minh City',
    jobType: index === 1 ? 'FULL_TIME' : 'INTERNSHIP',
    workingModel: index % 3 === 0 ? 'HYBRID' : index % 3 === 1 ? 'ONSITE' : 'REMOTE',
    salaryMin: index === 8 ? null : index === 1 ? 10000000 : 3000000,
    salaryMax: index === 8 ? null : index === 1 ? 16000000 : 6000000,
    currency: 'VND',
    deadline: index === 14 ? '2020-01-01' : '2027-06-30',
    status: 'DRAFT',
  },
}));
