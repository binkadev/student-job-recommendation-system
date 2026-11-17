import { Cpu, FileCheck, Layers, Send, UserCheck, Sparkles, CheckCircle2 } from "lucide-react";
import { SectionHeader } from "../../../components/common/SectionHeader";

const steps = [
  { step: "Tạo hồ sơ", desc: "Đăng ký tài khoản sinh viên IT và thiết lập mục tiêu sự nghiệp.", icon: UserCheck },
  { step: "Tải CV", desc: "Tải lên CV file PDF hoặc DOCX để hệ thống phân tích tức thì.", icon: FileCheck },
  { step: "Nhận gợi ý", desc: "Hệ thống tính toán TF-IDF & Cosine Similarity để xếp hạng việc làm.", icon: Cpu },
  { step: "Ứng tuyển", desc: "Nộp hồ sơ trực tiếp đến các doanh nghiệp công nghệ uy tín.", icon: Send },
];

export function NovaProcessSection() {
  return (
    <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      {/* Cột 1: Giải thích thuật toán */}
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#237d70]">
            <Sparkles size={14} className="text-[#237d70]" />
            <span>Thuật toán Content-Based Filtering</span>
          </div>
          <h2 className="mt-2 text-lg font-bold text-[#0c111c]">
            Hệ thống gợi ý từ CV hoạt động thế nào?
          </h2>

          <div className="mt-5 space-y-3.5 text-sm leading-relaxed text-[#52637a]">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#237d70]/10 text-[#237d70] mt-0.5">
                <CheckCircle2 size={15} />
              </span>
              <p>
                <strong className="text-[#0c111c]">Trích xuất đa ngữ:</strong> Tải CV PDF hoặc DOCX, hoàn tất tiền xử lý ngôn ngữ và trích xuất kỹ năng quy chuẩn (Canonical Skills).
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#237d70]/10 text-[#237d70] mt-0.5">
                <CheckCircle2 size={15} />
              </span>
              <p>
                <strong className="text-[#0c111c]">Đối sánh TF-IDF & Cosine:</strong> Với cặp CV và việc làm đủ điều kiện cùng ngôn ngữ, hệ thống đối sánh nội dung bằng TF-IDF và Cosine Similarity kết hợp độ phủ kỹ năng (Hybrid 65% Text - 35% Skills).
              </p>
            </div>

            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#237d70]/10 text-[#237d70] mt-0.5">
                <CheckCircle2 size={15} />
              </span>
              <p>
                <strong className="text-[#0c111c]">Minh bạch lý do:</strong> Nhóm đối sánh kỹ năng được hiển thị riêng, kèm kỹ năng khớp, kỹ năng còn thiếu và lý do gợi ý rõ ràng.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-[#237d70]/20 bg-[#237d70]/5 p-3.5 flex items-center justify-between text-xs text-[#134b43] font-medium">
          <span className="inline-flex items-center gap-1.5">
            <Layers size={15} className="text-[#237d70]" /> Xếp hạng V3 phân tầng: PRIMARY & FALLBACK độc lập
          </span>
          <span className="font-bold text-[#237d70]">Deterministic</span>
        </div>
      </div>

      {/* Cột 2: Quy trình 4 bước */}
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
        <SectionHeader title="Quy trình sử dụng" />

        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((item, index) => {
            const Icon = item.icon;
            return (
              <li
                key={item.step}
                className="nova-process-step flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="nova-step-number">{index + 1}</span>
                    <Icon size={18} className="text-[#9bb0c9]" />
                  </div>
                  <h3 className="mt-3.5 text-sm font-bold text-[#0c111c]">{item.step}</h3>
                  <p className="mt-1.5 text-xs leading-5 text-[#52637a]">{item.desc}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
