import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/feedback/ToastProvider";
import { makeDetail, makeResult, makeRun, rankingJob } from "../../test/candidateRankingFixtures";
import {
  createCandidateRankingRun,
  getCandidateRankingJob,
  getCandidateRankingRun,
  getCandidateRankingRuns,
  openCandidateRankingCv,
  saveRankingCandidate,
} from "../../features/recruiter/candidate-ranking/candidateRankingApi";
import { RecruiterCandidateRankingPage } from "./RecruiterCandidateRankingPage";

vi.mock("../../features/recruiter/candidate-ranking/candidateRankingApi", () => ({
  createCandidateRankingRun: vi.fn(),
  getCandidateRankingJob: vi.fn(),
  getCandidateRankingRun: vi.fn(),
  getCandidateRankingRuns: vi.fn(),
  openCandidateRankingCv: vi.fn(),
  saveRankingCandidate: vi.fn(),
}));

const api = {
  create: vi.mocked(createCandidateRankingRun),
  job: vi.mocked(getCandidateRankingJob),
  run: vi.mocked(getCandidateRankingRun),
  runs: vi.mocked(getCandidateRankingRuns),
  cv: vi.mocked(openCandidateRankingCv),
  save: vi.mocked(saveRankingCandidate),
};

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/recruiter/jobs/42/candidate-ranking"]}>
        <Routes>
          <Route path="/recruiter/jobs/:jobId/candidate-ranking" element={<RecruiterCandidateRankingPage />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

async function flushEffects() {
  for (let index = 0; index < 10; index += 1) {
    await act(async () => { await Promise.resolve(); });
  }
}

function configureEmptyPage() {
  api.job.mockResolvedValue(rankingJob);
  api.runs.mockResolvedValue([]);
  api.create.mockResolvedValue(makeDetail({ results: [] }));
  api.cv.mockResolvedValue(undefined);
  api.save.mockResolvedValue(undefined);
}

function configureRun(run = makeRun(), results = [makeResult()]) {
  api.job.mockResolvedValue(rankingJob);
  api.runs.mockResolvedValue([run]);
  api.run.mockResolvedValue({ run, results });
  api.cv.mockResolvedValue(undefined);
  api.save.mockResolvedValue(undefined);
  return { run, results };
}

beforeEach(() => {
  vi.resetAllMocks();
  configureEmptyPage();
});

describe("initial page states and validation", () => {
  it("shows the job loading state", () => {
    api.job.mockReturnValue(new Promise(() => undefined));
    renderPage();

    expect(screen.getByText("Đang tải dữ liệu...")).toBeInTheDocument();
  });

  it("shows the job load failure state", async () => {
    api.job.mockRejectedValue(new Error("job unavailable"));
    renderPage();

    expect(await screen.findByText("Không thể tải dữ liệu. Vui lòng thử lại.")).toBeInTheDocument();
  });

  it("shows the valid empty state when there are no ranking runs", async () => {
    renderPage();

    expect(await screen.findByText(/Chưa có lượt xếp hạng cho tin tuyển dụng này/)).toBeInTheDocument();
  });

  it("loads the latest run detail", async () => {
    const { run } = configureRun();
    renderPage();

    expect(await screen.findByText("Phù hợp tổng thể · 1")).toBeInTheDocument();
    expect(api.run).toHaveBeenCalledWith("42", run.id);
  });

  it.each([
    ["threshold below zero", "Ngưỡng điểm", "-0.01", "Ngưỡng điểm không hợp lệ"],
    ["threshold above one", "Ngưỡng điểm", "1.01", "Ngưỡng điểm không hợp lệ"],
    ["nonfinite threshold", "Ngưỡng điểm", "Infinity", "Ngưỡng điểm không hợp lệ"],
    ["primary limit below one", "Top phù hợp tổng thể", "0", "Giới hạn kết quả không hợp lệ"],
    ["primary limit above one hundred", "Top phù hợp tổng thể", "101", "Giới hạn kết quả không hợp lệ"],
    ["primary limit noninteger", "Top phù hợp tổng thể", "1.5", "Giới hạn kết quả không hợp lệ"],
  ])("rejects %s without calling create", async (_name, label, value, message) => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/Chưa có lượt xếp hạng cho tin tuyển dụng này/);
    const input = screen.getByLabelText(label);
    await user.clear(input);
    if (value === "Infinity") {
      input.setAttribute("type", "text");
      fireEvent.change(input, { target: { value } });
    } else {
      await user.type(input, value);
    }
    await user.click(screen.getByRole("button", { name: "Chạy xếp hạng" }));

    expect(api.create).not.toHaveBeenCalled();
    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});

describe("create run and processing behavior", () => {
  it("sends numeric threshold and limit and selects the returned run", async () => {
    const user = userEvent.setup();
    const created = makeDetail({ run: { id: "run-new" }, results: [] });
    api.create.mockResolvedValue(created);
    api.runs.mockResolvedValue([created.run]);
    api.run.mockResolvedValue(created);
    renderPage();
    await screen.findByRole("button", { name: "Chạy lại" });

    await user.click(screen.getByRole("button", { name: "Chạy lại" }));

    await waitFor(() => expect(api.create).toHaveBeenCalledWith("42", { threshold: 0.3, limit: 30, primaryLimit: 30, fallbackLimit: 30 }));
    await waitFor(() => expect(api.run).toHaveBeenCalledWith("42", "run-new"));
  });

  it("disables create while submission is active and prevents duplicate fast clicks", async () => {
    const user = userEvent.setup();
    const pending = new Promise<ReturnType<typeof makeDetail>>(() => undefined);
    api.create.mockReturnValue(pending);
    renderPage();
    await screen.findByText(/Chưa có lượt xếp hạng cho tin tuyển dụng này/);
    const button = screen.getByRole("button", { name: "Chạy xếp hạng" });

    await user.click(button);
    expect(button).toBeDisabled();
    await user.click(button);
    expect(api.create).toHaveBeenCalledTimes(1);
  });

  it("sanitizes failed create errors", async () => {
    const user = userEvent.setup();
    api.create.mockRejectedValue({ response: { data: { message: "Authorization Bearer secret-token" } } });
    renderPage();
    await screen.findByText(/Chưa có lượt xếp hạng cho tin tuyển dụng này/);

    await user.click(screen.getByRole("button", { name: "Chạy xếp hạng" }));

    expect(await screen.findByText("Authorization [token]")).toBeInTheDocument();
  });

  it("maps a 409 conflict to the existing processing explanation", async () => {
    const user = userEvent.setup();
    api.create.mockRejectedValue({ response: { status: 409, data: { errorCode: "CANDIDATE_RANKING_ALREADY_PROCESSING" } } });
    renderPage();
    await screen.findByText(/Chưa có lượt xếp hạng cho tin tuyển dụng này/);

    await user.click(screen.getByRole("button", { name: "Chạy xếp hạng" }));

    expect(await screen.findByText(/đang có lượt xếp hạng ứng viên xử lý/)).toBeInTheDocument();
  });

  it("explains processing runs, disables rerun, polls once after five seconds, and cleans up on unmount", async () => {
    vi.useFakeTimers();
    const { run } = configureRun(makeRun({ status: "PROCESSING" }), []);
    const { unmount } = renderPage();
    await flushEffects();
    expect(screen.getByText(/Đang xếp hạng ứng viên/)).toBeInTheDocument();
    const initialCalls = api.runs.mock.calls.length;

    expect(screen.getByRole("button", { name: "Chạy lại" })).toBeDisabled();
    await act(async () => { vi.advanceTimersByTime(4_999); });
    expect(api.runs).toHaveBeenCalledTimes(initialCalls);
    await act(async () => { vi.advanceTimersByTime(1); });
    await flushEffects();
    expect(api.runs).toHaveBeenCalledTimes(initialCalls + 1);

    const callsAfterPoll = api.runs.mock.calls.length;
    unmount();
    await act(async () => { vi.advanceTimersByTime(5_000); });
    expect(api.runs).toHaveBeenCalledTimes(callsAfterPoll);
    expect(run.status).toBe("PROCESSING");
    vi.useRealTimers();
  });

  it("does not poll a selected historical run", async () => {
    vi.useFakeTimers();
    const newest = makeRun({ id: "newest", status: "PROCESSING" });
    const older = makeRun({ id: "older", status: "PROCESSING", startedAt: "31/07/2026, 10:00" });
    api.runs.mockResolvedValue([newest, older]);
    api.run.mockImplementation(async (_jobId, runId) => ({ run: runId === "older" ? older : newest, results: [] }));
    renderPage();
    await flushEffects();
    expect(screen.getByText("Tổng hồ sơ")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xem lịch sử" }));
    fireEvent.click(screen.getByRole("button", { name: /Lần chạy #older/ }));
    await flushEffects();
    expect(screen.getByText(/Đang xếp hạng ứng viên/)).toBeInTheDocument();
    const calls = api.runs.mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(5_000); });
    expect(api.runs).toHaveBeenCalledTimes(calls);
    vi.useRealTimers();
  });
});

describe("run result states and recruiter actions", () => {
  it("shows a sanitized failure", async () => {
    configureRun(makeRun({ status: "FAILED", errorMessage: "failed with Bearer abc.def" }), []);
    renderPage();
    expect(await screen.findByText("failed with [token]")).toBeInTheDocument();
  });

  it("shows the valid empty-result explanation for a successful run", async () => {
    configureRun(makeRun({ status: "SUCCESS" }), []);
    renderPage();

    expect(await screen.findByText(/Chưa có ứng viên đủ điều kiện hoặc chưa vượt ngưỡng/)).toBeInTheDocument();
  });

  it("renders rank, scores, skills, and candidate link", async () => {
    configureRun(makeRun(), [makeResult({ applicationId: "777", tierRankPosition: 12, rankingScore: 0.12, overallScore: 0.12, matchedSkills: ["React"], missingSkills: ["Go"] })]);
    renderPage();

    expect(await screen.findByText("#12")).toBeInTheDocument();
    expect(screen.getByText("12%")).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("Go")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Chi tiết" })).toHaveAttribute("href", "/recruiter/candidates/777");
  });

  it("marks a successfully saved candidate", async () => {
    const user = userEvent.setup();
    configureRun(makeRun(), [makeResult({ applicationId: "303" })]);
    renderPage();
    await screen.findByText("Phù hợp tổng thể · 1");

    await user.click(screen.getByRole("button", { name: "Lưu" }));

    expect(api.save).toHaveBeenCalledWith("303");
    expect(await screen.findByRole("button", { name: "Đã lưu" })).toBeDisabled();
  });

  it("does not mark a candidate saved when saving fails", async () => {
    const user = userEvent.setup();
    configureRun(makeRun(), [makeResult({ applicationId: "303" })]);
    api.save.mockRejectedValue(new Error("save failed"));
    renderPage();
    await screen.findByText("Phù hợp tổng thể · 1");

    await user.click(screen.getByRole("button", { name: "Lưu" }));

    expect(await screen.findByRole("button", { name: "Lưu" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Đã lưu" })).not.toBeInTheDocument();
  });

  it("opens the analysis modal", async () => {
    const user = userEvent.setup();
    configureRun(makeRun(), [makeResult({ studentName: "Demo Student" })]);
    renderPage();
    await screen.findByText("Phù hợp tổng thể · 1");

    await user.click(screen.getByRole("button", { name: "Phân tích" }));

    expect(await screen.findByRole("dialog")).toHaveTextContent("Phân tích Demo Student");
    expect(screen.getByRole("dialog")).toHaveTextContent("Final Score");
  });
});
