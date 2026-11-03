import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../components/feedback/ToastProvider";
import { CandidateProfilePage } from "../../../pages/candidate/CandidateProfilePage";
import { httpClient } from "../../../services/api/httpClient";
import { CandidatePreferencesView } from "./CandidatePreferencesView";
import { getCandidateProfileData, updateCandidateProfileData } from "./candidateProfileService";

vi.mock("../../../services/api/httpClient", () => ({ httpClient: { get: vi.fn(), put: vi.fn() } }));
const envelope = (data: unknown) => ({ data: { success: true, data } });
const studentSeed = {
  id: 12, userId: 20, email: "student@example.test", fullName: "Sinh viên thử nghiệm", phone: "0901234567",
  headline: "Frontend Developer", location: "Hà Nội", major: "Công nghệ thông tin", university: "Trường IT", graduationYear: 2026,
};
const detailsSeed = {
  id: 4, studentId: 12, headline: "Frontend Developer", summary: "Giới thiệu", education: "Nội dung học vấn độc lập\nGPA 3.5",
  experience: "Dòng kinh nghiệm gốc\nDòng thứ hai", projects: "Dự án gốc\nReact, TypeScript",
  targetPosition: "Backend Developer", preferredLocation: "Đà Nẵng", preferredJobType: "INTERNSHIP", profileCompleteness: 75,
};
let student = { ...studentSeed };
let details = { ...detailsSeed };
beforeEach(() => {
  vi.resetAllMocks(); student = { ...studentSeed }; details = { ...detailsSeed };
  vi.mocked(httpClient.get).mockImplementation(async (url) => {
    if (url === "/students/me") return envelope(student);
    if (url === "/students/me/profile") return envelope(details);
    if (url === "/students/me/skills") return envelope([]);
    if (url === "/skills") return envelope({ items: [] });
    throw new Error(`Unexpected endpoint: ${url}`);
  });
  vi.mocked(httpClient.put).mockImplementation(async (url, payload) => {
    if (url === "/students/me") student = { ...student, ...payload as object };
    if (url === "/students/me/profile") details = { ...details, ...payload as object };
    return envelope(url === "/students/me/profile" ? details : student);
  });
});

function renderProfile(path = "/candidate/profile/edit") {
  return render(<ToastProvider><MemoryRouter initialEntries={[path]}><CandidateProfilePage mode="edit" /></MemoryRouter></ToastProvider>);
}

describe("Student profile persistence contract (mocked HTTP, not E2E)", () => {
  it("preserves independent preferences and original multiline sections across repeated saves and reads", async () => {
    const profile = await getCandidateProfileData();
    const reloaded = await updateCandidateProfileData({ ...profile, header: { ...profile.header, name: "Tên mới" } });
    await updateCandidateProfileData(reloaded);
    expect(student).toMatchObject({ fullName: "Tên mới", headline: "Frontend Developer", location: "Hà Nội", university: "Trường IT", graduationYear: 2026 });
    expect(details).toMatchObject(detailsSeed);
    expect(vi.mocked(httpClient.put).mock.calls.filter(([url]) => url === "/students/me/profile")[1][1]).toMatchObject({
      education: detailsSeed.education, experience: detailsSeed.experience, projects: detailsSeed.projects,
      targetPosition: "Backend Developer", preferredLocation: "Đà Nẵng",
    });
  });

  it("sends empty strings to clear text because null means keep the stored value", async () => {
    const profile = await getCandidateProfileData();
    await updateCandidateProfileData({ ...profile, summary: "", careerGoal: "", header: { ...profile.header, phone: "", location: "", currentTitle: "" },
      record: { ...profile.record!, education: "", experience: "", projects: "", preferredLocation: "" } });
    expect(httpClient.put).toHaveBeenCalledWith("/students/me/profile", expect.objectContaining({ summary: "", targetPosition: "", education: "", experience: "", projects: "", preferredLocation: "" }));
    expect(httpClient.put).toHaveBeenCalledWith("/students/me", expect.objectContaining({ phone: "", location: "", headline: "" }));
  });

  it("does not start writes when the skill catalog cannot be read", async () => {
    const profile = await getCandidateProfileData();
    profile.skills.frontend.push({ id: "new", name: "React", level: "Khá", years: 1 });
    vi.mocked(httpClient.get).mockRejectedValueOnce(new Error("Catalog unavailable"));
    await expect(updateCandidateProfileData(profile)).rejects.toThrow("Catalog unavailable");
    expect(httpClient.put).not.toHaveBeenCalled();
  });

  it("requires the original scalar record before writing", async () => {
    const profile = await getCandidateProfileData();
    await expect(updateCandidateProfileData({ ...profile, record: undefined })).rejects.toThrow(/tải lại hồ sơ/);
    expect(httpClient.put).not.toHaveBeenCalled();
  });

  it("keeps the draft and reports a partial save when the second API fails", async () => {
    const user = userEvent.setup();
    renderProfile();
    const name = await screen.findByLabelText("Họ tên");
    await user.clear(name); await user.type(name, "Tên chưa lưu hết");
    vi.mocked(httpClient.put).mockResolvedValueOnce(envelope(student)).mockRejectedValueOnce({ response: { data: { errorCode: "VALIDATION_ERROR" } } });
    await user.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Một phần hồ sơ đã được lưu/);
    expect(screen.getByRole("alert")).toHaveTextContent(/Dữ liệu nhập chưa hợp lệ/);
    expect(name).toHaveValue("Tên chưa lưu hết");
    expect(screen.queryByText("Đã lưu hồ sơ")).not.toBeInTheDocument();
    expect(httpClient.put).toHaveBeenCalledTimes(2);
  });

  it("blocks editing and repeat submissions while a real request is pending", async () => {
    const user = userEvent.setup(); renderProfile();
    await screen.findByLabelText("Họ tên");
    vi.mocked(httpClient.put).mockReturnValue(new Promise(() => undefined));
    const save = screen.getByRole("button", { name: "Lưu hồ sơ" });
    await user.dblClick(save);
    await waitFor(() => expect(httpClient.put).toHaveBeenCalledTimes(1));
    expect(save).toBeDisabled(); expect(screen.getByLabelText("Họ tên")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Lưu mục hiện tại" })).not.toBeInTheDocument();
  });

  it("validates hidden sections and focuses the invalid field without writing", async () => {
    const user = userEvent.setup(); renderProfile();
    await user.click(await screen.findByRole("button", { name: "Giới thiệu" }));
    const target = screen.getByLabelText("Vị trí mong muốn");
    await user.clear(target); await user.type(target, "a".repeat(256));
    await user.click(screen.getByRole("button", { name: "Thông tin cá nhân" }));
    await user.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    expect(await screen.findByText("Vui lòng kiểm tra các trường có lỗi trước khi lưu.")).toHaveAttribute("role", "alert");
    await waitFor(() => expect(screen.getByLabelText("Vị trí mong muốn")).toHaveFocus());
    expect(httpClient.put).not.toHaveBeenCalled();
  });

  it("edits raw text and announces skill-only unsaved changes", async () => {
    const user = userEvent.setup(); renderProfile("/candidate/profile/edit?section=experience");
    expect(await screen.findByLabelText("Nội dung kinh nghiệm")).toHaveValue(detailsSeed.experience);
    await user.click(screen.getByRole("button", { name: "Kỹ năng" }));
    await user.click(screen.getByRole("button", { name: "Thêm" }));
    expect(screen.getByText("Bạn có thay đổi chưa lưu.")).toBeInTheDocument();
    expect(httpClient.put).not.toHaveBeenCalled();
  });

  it("reports preference errors and clears preferences using the actual API semantics", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><MemoryRouter><CandidatePreferencesView /></MemoryRouter></ToastProvider>);
    await user.clear(await screen.findByLabelText("Vị trí mong muốn"));
    await user.clear(screen.getByLabelText("Địa điểm mong muốn"));
    vi.mocked(httpClient.put).mockRejectedValueOnce({ response: { data: { errorCode: "ACCESS_DENIED" } } });
    await user.click(screen.getByRole("button", { name: "Lưu thiết lập" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/không có quyền/);
    expect(screen.queryByText("Đã lưu mong muốn nghề nghiệp")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lưu thiết lập" }));
    await screen.findByText("Đã lưu mong muốn nghề nghiệp");
    expect(httpClient.put).toHaveBeenLastCalledWith("/students/me/profile", expect.objectContaining({ targetPosition: "", preferredLocation: "", education: detailsSeed.education }));
  });
});
