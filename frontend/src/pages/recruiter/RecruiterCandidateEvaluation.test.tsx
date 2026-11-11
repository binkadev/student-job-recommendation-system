import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/feedback/ToastProvider";
import { httpClient } from "../../services/api/httpClient";
import { RecruiterCandidatesPage } from "./RecruiterCandidatesPage";

vi.mock("../../services/api/httpClient", () => ({
  AUTH_TOKEN_STORAGE_KEY: "job-system:auth-token",
  httpClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));

const populatedApplication = {
  id: 91,
  studentId: 12,
  studentName: "Nguyễn Văn A",
  studentEmail: "student.a@example.test",
  companyId: 7,
  companyName: "Aurora Tech",
  jobId: 42,
  jobTitle: "Backend Java Engineer",
  status: "PENDING" as const,
  coverLetter: "Em có kinh nghiệm phát triển REST API với Spring Boot và PostgreSQL.",
  cvFileId: 301,
  cvFileName: "cv-nguyen-van-a.pdf",
  appliedAt: "2026-11-05T09:00:00",
  reviewedAt: null,
  createdAt: "2026-11-05T09:00:00",
  updatedAt: "2026-11-05T09:00:00",
};

const savedCandidateRecord = {
  id: 501,
  applicationId: 91,
  applicationStatus: "PENDING" as const,
  revision: 3,
  studentId: 12,
  studentName: "Nguyễn Văn A",
  studentEmail: "student.a@example.test",
  university: "Đại học Bách Khoa",
  major: "Kỹ thuật phần mềm",
  headline: "Java Backend Intern",
  jobId: 42,
  jobTitle: "Backend Java Engineer",
  cvFileId: 301,
  cvFileName: "cv-nguyen-van-a.pdf",
  note: "Ứng viên nắm vững nền tảng Java 21.",
  savedAt: "2026-11-05T10:00:00",
  updatedAt: "2026-11-05T10:00:00",
};

const envelope = (data: unknown) => ({ data: { success: true, data } });
const page = (items: unknown[]) => ({ items, totalItems: items.length, page: 1, size: 100, totalPages: 1 });

function renderEvaluationRoute(initialEntry = "/recruiter/candidates/91/evaluation") {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/recruiter/candidates/:candidateId/evaluation" element={<RecruiterCandidatesPage mode="evaluation" />} />
          <Route path="/recruiter/candidates/:candidateId" element={<RecruiterCandidatesPage mode="detail" />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.setItem("job-system:auth-token", "company-token");
});

describe("RecruiterCandidateEvaluation (/recruiter/candidates/:candidateId/evaluation)", () => {
  it("renders applicant, job, cover letter, CV, profile info, factual review, V3 ranking link, and updates saved note with revision", async () => {
    const user = userEvent.setup();
    vi.mocked(httpClient.get).mockImplementation(async (url) => {
      if (url === "/companies/me/jobs") return envelope(page([{ id: 42, companyId: 7, title: "Backend Java Engineer" }]));
      if (url === "/companies/me/applications/91") return envelope(populatedApplication);
      if (url === "/companies/me/saved-candidates") return envelope(page([savedCandidateRecord]));
      throw new Error(`Unexpected GET ${url}`);
    });
    vi.mocked(httpClient.patch).mockResolvedValueOnce(
      envelope({
        ...savedCandidateRecord,
        revision: 4,
        note: "Ứng viên nắm vững nền tảng Java 21. Phù hợp phỏng vấn vòng kỹ thuật.",
      }),
    );

    renderEvaluationRoute("/recruiter/candidates/91/evaluation");

    expect(await screen.findByRole("heading", { name: "Đánh giá hồ sơ ứng viên" })).toBeInTheDocument();
    expect(await screen.findByTestId("saved-note-editor")).toBeInTheDocument();

    expect(screen.getByText("#91")).toBeInTheDocument();
    expect(screen.getByText("#12")).toBeInTheDocument();
    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(screen.getByText("student.a@example.test")).toBeInTheDocument();
    expect(screen.getByText("Backend Java Engineer (#42)")).toBeInTheDocument();
    expect(screen.getByText("Aurora Tech")).toBeInTheDocument();
    expect(screen.getByText("Đại học Bách Khoa")).toBeInTheDocument();
    expect(screen.getByText("Kỹ thuật phần mềm")).toBeInTheDocument();
    expect(screen.getByText("Java Backend Intern")).toBeInTheDocument();
    expect(screen.getByText(/Em có kinh nghiệm phát triển REST API/)).toBeInTheDocument();
    expect(screen.getAllByText("cv-nguyen-van-a.pdf").length).toBeGreaterThanOrEqual(2);

    expect(screen.getByTestId("factual-available-summary")).toHaveTextContent("Đã xác nhận 4/5 nhóm thông tin");
    expect(screen.getByTestId("factual-missing-summary")).toHaveTextContent("Còn thiếu hoặc chờ bổ sung 1 mục");

    const v3Card = screen.getByTestId("v3-ranking-link-card");
    expect(within(v3Card).getByText(/không tự suy diễn điểm số AI/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mở xếp hạng ứng viên AI (V3)" })).toHaveAttribute(
      "href",
      "/recruiter/jobs/42/candidate-ranking",
    );
    expect(screen.getByRole("link", { name: "Xem chi tiết đơn" })).toHaveAttribute("href", "/recruiter/candidates/91");

    expect(screen.getByText(/Hồ sơ đã lưu #501 · Phiên bản v3/)).toBeInTheDocument();
    const noteInput = screen.getByLabelText("Ghi chú đánh giá");
    expect(noteInput).toHaveValue("Ứng viên nắm vững nền tảng Java 21.");

    await user.clear(noteInput);
    await user.type(noteInput, "Ứng viên nắm vững nền tảng Java 21. Phù hợp phỏng vấn vòng kỹ thuật.");
    await user.click(screen.getByRole("button", { name: "Lưu ghi chú" }));

    await waitFor(() => {
      expect(httpClient.patch).toHaveBeenCalledWith("/companies/me/saved-candidates/501/note", {
        note: "Ứng viên nắm vững nền tảng Java 21. Phù hợp phỏng vấn vòng kỹ thuật.",
        revision: 3,
      });
    });
    expect(await screen.findByText(/Hồ sơ đã lưu #501 · Phiên bản v4/)).toBeInTheDocument();
  });

  it("keeps note editing unavailable until the candidate is saved through the existing workflow", async () => {
    const user = userEvent.setup();
    let savedList: unknown[] = [];
    vi.mocked(httpClient.get).mockImplementation(async (url) => {
      if (url === "/companies/me/jobs") return envelope(page([{ id: 42, companyId: 7, title: "Backend Java Engineer" }]));
      if (url === "/companies/me/applications/91") return envelope(populatedApplication);
      if (url === "/companies/me/saved-candidates") return envelope(page(savedList));
      throw new Error(`Unexpected GET ${url}`);
    });
    const newlySaved = {
      ...savedCandidateRecord,
      id: 610,
      revision: 0,
      note: null,
    };
    vi.mocked(httpClient.post).mockImplementation(async (url, body) => {
      if (url === "/companies/me/saved-candidates") {
        expect(body).toEqual({ applicationId: 91, note: null });
        savedList = [newlySaved];
        return envelope(newlySaved);
      }
      throw new Error(`Unexpected POST ${url}`);
    });
    vi.mocked(httpClient.patch).mockResolvedValueOnce(
      envelope({
        ...newlySaved,
        revision: 1,
        note: "Ghi chú đầu tiên sau khi lưu hồ sơ.",
      }),
    );

    renderEvaluationRoute("/recruiter/candidates/91/evaluation");

    const lockSection = await screen.findByTestId("unsaved-note-lock");
    expect(within(lockSection).getByText(/Chưa thể chỉnh sửa ghi chú/)).toBeInTheDocument();
    expect(screen.getByLabelText("Ghi chú đánh giá")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Lưu ghi chú" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Lưu hồ sơ để ghi chú" }));

    await waitFor(() => {
      expect(httpClient.post).toHaveBeenCalledWith("/companies/me/saved-candidates", {
        applicationId: 91,
        note: null,
      });
    });

    expect(await screen.findByTestId("saved-note-editor")).toBeInTheDocument();
    const noteInput = screen.getByLabelText("Ghi chú đánh giá");
    expect(noteInput).toBeEnabled();

    await user.type(noteInput, "Ghi chú đầu tiên sau khi lưu hồ sơ.");
    await user.click(screen.getByRole("button", { name: "Lưu ghi chú" }));

    await waitFor(() => {
      expect(httpClient.patch).toHaveBeenCalledWith("/companies/me/saved-candidates/610/note", {
        note: "Ghi chú đầu tiên sau khi lưu hồ sơ.",
        revision: 0,
      });
    });
  });

  it("preserves draft on revision conflict and allows reloading current server note", async () => {
    const user = userEvent.setup();
    let currentRecord = { ...savedCandidateRecord, revision: 3 };
    vi.mocked(httpClient.get).mockImplementation(async (url) => {
      if (url === "/companies/me/jobs") return envelope(page([]));
      if (url === "/companies/me/applications/91") return envelope(populatedApplication);
      if (url === "/companies/me/saved-candidates") return envelope(page([currentRecord]));
      throw new Error(`Unexpected GET ${url}`);
    });
    vi.mocked(httpClient.patch).mockRejectedValueOnce({
      response: { status: 409, data: { message: "Ghi chú đã được cập nhật ở phiên làm việc khác." } },
    });

    renderEvaluationRoute("/recruiter/candidates/91/evaluation");

    await screen.findByTestId("saved-note-editor");
    const noteInput = screen.getByLabelText("Ghi chú đánh giá");
    await user.clear(noteInput);
    await user.type(noteInput, "Bản nháp đang gõ dở");
    await user.click(screen.getByRole("button", { name: "Lưu ghi chú" }));

    expect(await screen.findByText(/Chưa lưu bản nháp/)).toBeInTheDocument();
    expect(screen.getByText("Ghi chú đã được cập nhật ở phiên làm việc khác.")).toBeInTheDocument();
    expect(noteInput).toHaveValue("Bản nháp đang gõ dở");

    currentRecord = {
      ...savedCandidateRecord,
      revision: 5,
      note: "Ghi chú mới nhất từ đồng nghiệp.",
    };
    await user.click(screen.getByRole("button", { name: "Tải ghi chú hiện tại" }));

    await waitFor(() => {
      expect(noteInput).toHaveValue("Ghi chú mới nhất từ đồng nghiệp.");
    });
    expect(screen.getByText(/Hồ sơ đã lưu #501 · Phiên bản v5/)).toBeInTheDocument();
  });

  it("handles missing cover letter, missing CV, unauthorized/error states, and retry", async () => {
    const user = userEvent.setup();
    let shouldFail = true;
    vi.mocked(httpClient.get).mockImplementation(async (url) => {
      if (url === "/companies/me/jobs") return envelope(page([]));
      if (url === "/companies/me/saved-candidates") return envelope(page([]));
      if (url === "/companies/me/applications/91") {
        if (shouldFail) {
          throw { response: { status: 403, data: { message: "Bạn không có quyền truy cập đơn ứng tuyển này." } } };
        }
        return envelope({
          ...populatedApplication,
          coverLetter: null,
          cvFileId: null,
          cvFileName: null,
        });
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    renderEvaluationRoute("/recruiter/candidates/91/evaluation");

    expect(await screen.findByText("Bạn không có quyền truy cập đơn ứng tuyển này.")).toBeInTheDocument();
    shouldFail = false;

    await user.click(screen.getByRole("button", { name: "Thử lại" }));

    expect(await screen.findByText("Ứng viên chưa nhập thư giới thiệu.")).toBeInTheDocument();
    expect(screen.getByText("Hồ sơ ứng tuyển chưa có CV.")).toBeInTheDocument();
    expect(screen.getByTestId("factual-available-summary")).toHaveTextContent("Đã xác nhận 1/5 nhóm thông tin");
    expect(screen.getByTestId("factual-missing-summary")).toHaveTextContent("Còn thiếu hoặc chờ bổ sung 4 mục");
  });
});
