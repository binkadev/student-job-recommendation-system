import { ArrowUpRight, BriefcaseBusiness, FileText, ScanLine, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

/** Conceptual illustration only: no synthetic scores or simulated processing. */
export function MatchingIllustration() {
  return <div className="matching-scene" aria-hidden="true">
    <div className="matching-orbit matching-orbit-one" /><div className="matching-orbit matching-orbit-two" />
    <div className="matching-core"><ScanLine size={44} strokeWidth={1.2} /></div>
    <div className="matching-node matching-cv"><FileText size={24} /><span>CV của bạn</span><div className="matching-lines"><i /><i /><i /></div></div>
    <div className="matching-node matching-job"><BriefcaseBusiness size={23} /><span>Cơ hội phù hợp</span><div className="matching-skill">Nội dung + kỹ năng</div><ArrowUpRight size={20} /></div>
    <div className="matching-caption"><Sparkles size={14} /> Minh họa quy trình đối sánh</div>
  </div>;
}

export function AuroraHero({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <section className="aurora-panel aurora-hero">
    <div className="relative z-10 min-w-0">
      <p className="aurora-eyebrow"><Sparkles size={15} aria-hidden="true" />{eyebrow}</p>
      <h2 className="mt-3 text-xl font-semibold leading-snug sm:text-2xl">{title}</h2>
      <p className="aurora-description mt-3 max-w-2xl text-sm leading-7">{description}</p>
      {children ? <div className="mt-5 flex flex-wrap gap-3">{children}</div> : null}
    </div>
    <div className="aurora-emblem" aria-hidden="true"><ScanLine size={46} strokeWidth={1} /></div>
  </section>;
}
