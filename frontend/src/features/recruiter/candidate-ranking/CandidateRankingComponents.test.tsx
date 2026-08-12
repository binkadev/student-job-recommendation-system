import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { makeResult, makeRun } from "../../../test/candidateRankingFixtures";
import { CandidateRankingAnalysisModal } from "./CandidateRankingAnalysisModal";
import { CandidateRankingRunHistory } from "./CandidateRankingRunHistory";
import { CandidateRankingSummary } from "./CandidateRankingSummary";
import { CandidateRankingTable } from "./CandidateRankingTable";

function renderTable(result = makeResult(), overrides: Partial<React.ComponentProps<typeof CandidateRankingTable>> = {}) {
  return render(
    <MemoryRouter>
      <CandidateRankingTable
        results={[result]}
        savedApplicationIds={new Set()}
        onAnalyze={vi.fn()}
        onSave={vi.fn()}
        {...overrides}
      />
    </MemoryRouter>,
  );
}

describe("CandidateRankingTable", () => {
  it("displays Backend rankPosition and all score components without recalculating them", () => {
    renderTable(makeResult({ tierRankPosition: 7, rankingScore: 0.61, overallScore: 0.61, textScore: null, skillScore: 0 }));

    expect(screen.getByText("#7")).toBeInTheDocument();
    expect(screen.getByText("61%")).toBeInTheDocument();
    expect(screen.getByText(/Text Score:/)).toBeInTheDocument();
    expect(screen.getByText(/Không áp dụng/)).toBeInTheDocument();
    expect(screen.getByText(/Skill Score:/)).toBeInTheDocument();
    expect(screen.getByText(/0%/)).toBeInTheDocument();
  });

  it("renders matched and missing skills with the existing overflow indicator", () => {
    renderTable();

    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("CSS")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
    expect(screen.getByText("Docker")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL")).toBeInTheDocument();
  });

  it("links candidate detail by applicationId and does not render the CV action", () => {
    renderTable(makeResult({ cvFileId: null, applicationId: "555" }));

    expect(screen.queryByRole("button", { name: "CV" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chi tiết" })).toHaveAttribute("href", "/recruiter/candidates/555");
  });

  it("displays the saved state and disables the save action", () => {
    renderTable(makeResult({ applicationId: "101" }), { savedApplicationIds: new Set(["101"]) });

    expect(screen.getByRole("button", { name: "Đã lưu" })).toBeDisabled();
  });

  it("emits the analysis result", async () => {
    const user = userEvent.setup();
    const result = makeResult();
    const onAnalyze = vi.fn();
    renderTable(result, { onAnalyze });

    await user.click(screen.getByRole("button", { name: "Phân tích" }));

    expect(onAnalyze).toHaveBeenCalledWith(result);
  });
});

describe("candidate ranking summary, history, and analysis", () => {
  it("shows the real run status and counters", () => {
    render(<CandidateRankingSummary run={makeRun({ status: "PROCESSING", totalApplications: 8, eligibleCandidates: 5, resultCount: 3 })} />);

    expect(screen.getByText("Đang xử lý")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("preserves history order and selects the requested run", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const runs = [makeRun({ id: "newest" }), makeRun({ id: "older" })];
    render(<CandidateRankingRunHistory runs={runs} selectedRunId="older" onSelect={onSelect} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("Lần chạy #newest");
    expect(buttons[1]).toHaveTextContent("Lần chạy #older");
    await user.click(buttons[1]);
    expect(onSelect).toHaveBeenCalledWith("older");
  });

  it("shows complete skills, Backend reason, and the Backend rank in analysis", () => {
    const result = makeResult({ tierRankPosition: 9, matchedSkills: ["React", "TypeScript"], missingSkills: ["Docker", "Kubernetes"] });
    render(
      <MemoryRouter>
        <CandidateRankingAnalysisModal result={result} run={makeRun()} onClose={vi.fn()} onOpenCv={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("dialog")).toHaveTextContent("#9");
    expect(screen.getByRole("dialog")).toHaveTextContent("React");
    expect(screen.getByRole("dialog")).toHaveTextContent("Kubernetes");
    expect(screen.getByRole("dialog")).toHaveTextContent("Ứng viên phù hợp 2/4 kỹ năng");
  });
});
