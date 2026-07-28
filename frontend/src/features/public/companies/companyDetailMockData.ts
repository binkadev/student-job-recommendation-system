import { publicJobs } from "../jobs/jobsListMockData";
import { publicCompanies } from "./companiesListMockData";
import type { PublicCompanyDetail } from "./companyDetailTypes";

const detailExtras: Record<string, Omit<PublicCompanyDetail, keyof (typeof publicCompanies)[number]>> = {
  "1": {
    website: "https://vietnext.example.vn",
    address: "Tầng 8, tòa nhà Innovation Hub, Cầu Giấy, Hà Nội",
    foundedYear: 2018,
    mission: "Xây dựng các sản phẩm phần mềm giúp doanh nghiệp Việt Nam vận hành hiệu quả hơn bằng dữ liệu và trải nghiệm người dùng rõ ràng.",
    coreValues: ["Chất lượng kỹ thuật", "Minh bạch", "Học hỏi liên tục", "Tôn trọng người dùng"],
    branches: ["Hà Nội", "Đà Nẵng"],
    benefits: [
      { title: "Lương thưởng", description: "Lương cạnh tranh, review 2 lần/năm và thưởng theo hiệu quả dự án." },
      { title: "Bảo hiểm", description: "Đầy đủ BHXH, BHYT, BHTN và gói khám sức khỏe định kỳ." },
      { title: "Đào tạo", description: "Ngân sách học tập, mentor kỹ thuật và workshop nội bộ hàng tháng." },
      { title: "Thiết bị", description: "Cấp laptop, màn hình phụ và công cụ làm việc cần thiết." },
      { title: "Nghỉ phép", description: "12 ngày phép/năm, nghỉ linh hoạt theo chính sách đội nhóm." },
      { title: "Hoạt động nội bộ", description: "Team building, tech talk và câu lạc bộ thể thao sau giờ làm." },
    ],
    gallery: [
      { id: "vn-1", title: "Không gian làm việc", description: "Khu làm việc mở, nhiều ánh sáng tự nhiên.", tone: "bg-gradient-to-br from-slate-800 to-brand-700" },
      { id: "vn-2", title: "Tech talk", description: "Buổi chia sẻ kỹ thuật giữa các team sản phẩm.", tone: "bg-gradient-to-br from-blue-900 to-slate-700" },
      { id: "vn-3", title: "Khu thảo luận", description: "Không gian họp nhóm và review thiết kế nhanh.", tone: "bg-gradient-to-br from-emerald-800 to-slate-800" },
      { id: "vn-4", title: "Hoạt động đội nhóm", description: "Các hoạt động gắn kết sau sprint.", tone: "bg-gradient-to-br from-amber-700 to-slate-900" },
    ],
  },
};

const defaultBenefits = [
  { title: "Lương thưởng", description: "Chính sách lương rõ ràng, thưởng theo năng lực và đóng góp." },
  { title: "Bảo hiểm", description: "Đầy đủ bảo hiểm bắt buộc và hỗ trợ chăm sóc sức khỏe." },
  { title: "Đào tạo", description: "Đào tạo nội bộ, mentor và hỗ trợ chi phí học tập liên quan." },
  { title: "Thiết bị", description: "Trang bị thiết bị làm việc phù hợp với từng vị trí." },
  { title: "Nghỉ phép", description: "Chính sách nghỉ phép minh bạch và hỗ trợ cân bằng công việc." },
  { title: "Hoạt động nội bộ", description: "Hoạt động văn hóa, sinh nhật, team building và chia sẻ kiến thức." },
];

export const publicCompanyDetails: PublicCompanyDetail[] = publicCompanies.map((company, index) => {
  const extra = detailExtras[company.id];

  return {
    ...company,
    website: extra?.website ?? `https://${company.name.toLowerCase().replaceAll(" ", "-")}.example.vn`,
    address: extra?.address ?? `Văn phòng ${company.location}, Việt Nam`,
    foundedYear: extra?.foundedYear ?? 2015 + (index % 8),
    mission: extra?.mission ?? `${company.name} hướng tới xây dựng môi trường làm việc chuyên nghiệp, giúp nhân sự phát triển năng lực và tạo ra sản phẩm có giá trị thực tế.`,
    coreValues: extra?.coreValues ?? ["Chính trực", "Hiệu quả", "Hợp tác", "Đổi mới"],
    branches: extra?.branches ?? [company.location, company.location === "Remote" ? "Hà Nội" : "Remote"],
    benefits: extra?.benefits ?? defaultBenefits,
    gallery: extra?.gallery ?? [
      { id: `${company.id}-1`, title: "Văn phòng", description: "Không gian làm việc chính của công ty.", tone: company.cover },
      { id: `${company.id}-2`, title: "Hoạt động nhóm", description: "Các hoạt động nội bộ giúp đội ngũ kết nối.", tone: "bg-gradient-to-br from-slate-800 to-emerald-700" },
      { id: `${company.id}-3`, title: "Phỏng vấn", description: "Không gian trao đổi và phỏng vấn ứng viên.", tone: "bg-gradient-to-br from-slate-900 to-blue-700" },
      { id: `${company.id}-4`, title: "Đào tạo", description: "Buổi đào tạo, onboarding và chia sẻ kiến thức.", tone: "bg-gradient-to-br from-zinc-900 to-amber-700" },
    ],
  };
});

export function getCompanyJobs(companyName: string) {
  return publicJobs.filter((job) => job.companyName === companyName);
}
