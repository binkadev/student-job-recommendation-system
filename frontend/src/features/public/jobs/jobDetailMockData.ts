import { publicJobs } from "./jobsListMockData";
import type { PublicJobDetail } from "./jobDetailTypes";

const companyProfiles: Record<string, Pick<PublicJobDetail, "companyId" | "companyVerified" | "companyIndustry" | "companySize" | "companyLocation" | "companyDescription">> = {
  "VietNext Software": {
    companyId: "1",
    companyVerified: true,
    companyIndustry: "Công nghệ thông tin",
    companySize: "100-300 nhân sự",
    companyLocation: "Hà Nội",
    companyDescription: "VietNext Software phát triển sản phẩm web và nền tảng nội bộ cho doanh nghiệp, tập trung vào trải nghiệm người dùng và chất lượng kỹ thuật.",
  },
  "TechCore Solutions": {
    companyId: "2",
    companyVerified: true,
    companyIndustry: "Phần mềm doanh nghiệp",
    companySize: "300-500 nhân sự",
    companyLocation: "TP. Hồ Chí Minh",
    companyDescription: "TechCore Solutions cung cấp giải pháp backend, ERP và tích hợp dữ liệu cho khách hàng trong lĩnh vực bán lẻ, tài chính và logistics.",
  },
  "DataAide Analytics": {
    companyId: "3",
    companyVerified: true,
    companyIndustry: "Phân tích dữ liệu",
    companySize: "50-100 nhân sự",
    companyLocation: "Đà Nẵng",
    companyDescription: "DataAide Analytics hỗ trợ doanh nghiệp khai thác dữ liệu, xây dashboard và tự động hóa báo cáo vận hành.",
  },
};

function getCompanyProfile(companyName: string, fallbackLocation: string, fallbackIndustry: string) {
  return companyProfiles[companyName] ?? {
    companyId: companyName.toLowerCase().replaceAll(" ", "-"),
    companyVerified: true,
    companyIndustry: fallbackIndustry,
    companySize: "50-200 nhân sự",
    companyLocation: fallbackLocation,
    companyDescription: `${companyName} là doanh nghiệp đang mở rộng đội ngũ và tuyển dụng các vị trí phù hợp với ứng viên trẻ có tinh thần học hỏi.`,
  };
}

export const publicJobDetails: PublicJobDetail[] = publicJobs.map((job, index) => {
  const company = getCompanyProfile(job.companyName, job.location, job.industry);
  const isExpired = ["7", "13"].includes(job.id);
  const isClosed = job.id === "19";

  return {
    ...job,
    ...company,
    hiringQuantity: index % 3 + 1,
    views: 320 + index * 47,
    description: `${job.companyName} đang tìm kiếm ${job.title} tham gia vào đội ngũ ${job.industry}. Vị trí phù hợp với ứng viên muốn phát triển năng lực chuyên môn, làm việc trong môi trường có quy trình rõ ràng và được hỗ trợ bởi mentor.`,
    responsibilities: [
      "Tham gia phân tích yêu cầu, lập kế hoạch và triển khai công việc theo sprint.",
      "Phối hợp với các thành viên trong nhóm để đảm bảo tiến độ và chất lượng đầu ra.",
      "Chủ động cập nhật tình trạng công việc, ghi nhận rủi ro và đề xuất hướng xử lý.",
      "Đóng góp ý tưởng cải tiến quy trình, tài liệu và trải nghiệm người dùng nội bộ.",
    ],
    requirements: [
      `Có nền tảng phù hợp với vị trí ${job.title}.`,
      `Có kinh nghiệm ở mức ${job.experienceLabel} hoặc dự án cá nhân/liên quan.`,
      "Có khả năng giao tiếp, đọc hiểu tài liệu và làm việc nhóm.",
      "Có tinh thần học hỏi, chủ động nhận phản hồi và cải thiện chất lượng công việc.",
    ],
    requiredSkills: job.skills,
    preferredSkills: ["Git", "Agile", "Tiếng Anh đọc hiểu"],
    benefits: [
      "Lương thưởng cạnh tranh theo năng lực và kết quả công việc.",
      "Được hướng dẫn bởi mentor và tham gia dự án thực tế.",
      "Môi trường làm việc cởi mở, có cơ hội học hỏi công nghệ và nghiệp vụ mới.",
      "Hỗ trợ thiết bị làm việc, gửi xe và các hoạt động nội bộ.",
    ],
    workplace: `${company.companyLocation}, ${job.location}`,
    workingTime: job.jobType === "Bán thời gian" ? "Linh hoạt 24-30 giờ/tuần" : "Thứ 2 - Thứ 6, 08:30 - 17:30",
    recruitmentProcess: ["Sàng lọc CV", "Phỏng vấn chuyên môn", "Bài kiểm tra ngắn nếu cần", "Trao đổi offer"],
    detailStatus: isClosed ? "closed" : isExpired ? "expired" : "open",
  };
});
