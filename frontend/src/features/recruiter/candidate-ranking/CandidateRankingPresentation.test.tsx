import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { makeResult, makeRun } from "../../../test/candidateRankingFixtures";
import { CandidateRankingAnalysisModal } from "./CandidateRankingAnalysisModal";
import { CandidateRankingRunHistory } from "./CandidateRankingRunHistory";
import { CandidateRankingTable } from "./CandidateRankingTable";

describe("Recruiter V3 presentation", () => {
  it("keeps FALLBACK skill-only and shows unavailable text/overall scores", () => {
    const result = makeResult({ rankingTier: "FALLBACK", scoringStrategy: "CROSS_LANGUAGE_SKILL_BASED", tierRankPosition: 4, overallScore: null, textScore: null, skillScore: 0.9, rankingScore: 0.9 });
    render(<MemoryRouter><CandidateRankingAnalysisModal result={result} run={makeRun()} onClose={vi.fn()} onOpenCv={vi.fn()} /></MemoryRouter>);
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText(/không so sánh điểm này với PRIMARY/)).toBeInTheDocument();
    expect(dialog.getByText("Final Score").parentElement).toHaveTextContent("Không áp dụng");
    expect(dialog.getByText("Text Score").parentElement).toHaveTextContent("Không áp dụng");
    expect(dialog.getByText("#4")).toBeInTheDocument();
  });

  it("preserves Backend row order and displays separate tier ranks", () => {
    const results = [makeResult({ id: "a", applicationId: "101", tierRankPosition: 8 }), makeResult({ id: "b", applicationId: "102", tierRankPosition: 2 })];
    render(<MemoryRouter><CandidateRankingTable results={results} savedApplicationIds={new Set()} onAnalyze={vi.fn()} onSave={vi.fn()} /></MemoryRouter>);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("#8");
    expect(rows[1]).toHaveTextContent("#2");
  });

  it("identifies the active latest run and allows keyboard selection of an older run", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<CandidateRankingRunHistory runs={[makeRun({ id: "newest" }), makeRun({ id: "older" })]} selectedRunId="" onSelect={onSelect} />);
    const latest = screen.getByRole("button", { name: /Lần chạy #newest/ });
    const older = screen.getByRole("button", { name: /Lần chạy #older/ });
    expect(latest).toHaveAttribute("aria-pressed", "true");
    expect(older).toHaveAttribute("aria-pressed", "false");
    older.focus();
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("older");
  });
});
