import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../components/feedback/ToastProvider";
import { httpClient } from "../../../services/api/httpClient";
import { CandidateProfilePage } from "../../../pages/candidate/CandidateProfilePage";
import { CandidatePreferencesView } from "./CandidatePreferencesView";
import { getCandidateProfileData, updateCandidateProfileData } from "./candidateProfileService";

vi.mock("../../../services/api/httpClient", () => ({ httpClient: { get: vi.fn(), put: vi.fn() } }));
const URL = "/students/me/profile-aggregate";
const studentSeed = { id: 2, userId: 4, email: "synthetic@example.test", fullName: "Original Student", phone: "01234", headline: "Developer", location: "Hà Nội", major: "Software", university: "IT University", graduationYear: 2026 };
const detailsSeed = { id: 2, studentId: 2, summary: "Existing summary", education: "School one\nSchool two", experience: "Experience one\nExperience two", projects: "Project one\nProject two", targetPosition: "Backend Developer", preferredLocation: "Đà Nẵng", preferredJobType: "INTERNSHIP", profileCompleteness: 75 };
let student = { ...studentSeed }, details = { ...detailsSeed }, revision = 5;
let skillRows: Array<{ studentSkillId: number; skillId: number; skillName: string; category: string; proficiencyLevel: string; source: string; yearsOfExperience: number | null }> = [];
const envelope = (data: unknown) => ({ data: { success: true, data }, headers: { etag: `"${revision}"` } });
const snapshot = () => ({ revision, student: { ...student }, profile: { ...details }, skills: skillRows.map(s => ({ ...s })) });
beforeEach(() => {
  vi.resetAllMocks(); student = { ...studentSeed }; details = { ...detailsSeed }; revision = 5; skillRows = [];
  vi.mocked(httpClient.get).mockImplementation(async (url) => {
    if (url === URL) return envelope(snapshot());
    if (url === "/students/me/profile") return envelope({ ...details });
    throw new Error(`Unexpected GET: ${url}`);
  });
  vi.mocked(httpClient.put).mockImplementation(async (url, body) => {
    const payload = body as { student?: object; profile?: object };
    if (url === URL) {
      student = { ...student, ...payload.student }; details = { ...details, ...payload.profile }; revision++;
      return envelope(snapshot());
    }
    if (url === "/students/me/profile") { details = { ...details, ...body as object }; revision++; return envelope({ ...details }); }
    throw new Error(`Unexpected PUT: ${url}`);
  });
});
function renderProfile(path = "/candidate/profile/edit") {
  return render(<ToastProvider><MemoryRouter initialEntries={[path]}><CandidateProfilePage mode="edit" /></MemoryRouter></ToastProvider>);
}

describe("Atomic profile transport and draft safety (mocked HTTP; PostgreSQL/browser tested separately)", () => {
  it("reads one coherent snapshot and saves one mutation with its captured revision", async () => {
    const profile = await getCandidateProfileData();
    expect(profile.revision).toBe(5); expect(httpClient.get).toHaveBeenCalledTimes(1);
    const result = await updateCandidateProfileData({ ...profile, header: { ...profile.header, name: "Edited Student" } });
    expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, { revision: 5, student: { fullName: "Edited Student" }, profile: {} });
    expect(httpClient.get).toHaveBeenCalledTimes(1);
    expect(result.revision).toBe(6); expect(result.header.name).toBe("Edited Student");
  });

  it("preserves independent fields and multiline sections across repeated saves", async () => {
    const profile = await getCandidateProfileData();
    const saved = await updateCandidateProfileData({ ...profile, summary: "New summary" });
    await updateCandidateProfileData(saved);
    expect(details).toMatchObject({ ...detailsSeed, summary: "New summary" });
    expect(student).toMatchObject(studentSeed);
    expect(httpClient.put).toHaveBeenLastCalledWith(URL, { revision: 6, student: {}, profile: {} });
  });

  it("sends custom skills by name without catalog requests and preserves nullable manual metadata", async () => {
    skillRows = [{ studentSkillId: 3, skillId: 7, skillName: "Git", category: "Tools", proficiencyLevel: "INTERMEDIATE", yearsOfExperience: null, source: "MANUAL" }];
    const profile = await getCandidateProfileData();
    profile.skills.tools.push({ id: "custom", name: "Next.js", level: "Khá", years: 1, source: "MANUAL" });
    await updateCandidateProfileData(profile);
    const body = vi.mocked(httpClient.put).mock.calls[0][1] as { manualSkills: object[] };
    expect(body.manualSkills).toEqual([
      { skillId: 7, proficiencyLevel: "INTERMEDIATE", yearsOfExperience: null, source: "MANUAL" },
      { skillName: "Next.js", category: "Tools", proficiencyLevel: "INTERMEDIATE", yearsOfExperience: 1, source: "MANUAL" },
    ]);
    expect(httpClient.get).toHaveBeenCalledTimes(1);
  });

  it("distinguishes empty text clears from numeric and enum clears", async () => {
    const profile = await getCandidateProfileData();
    await updateCandidateProfileData({ ...profile, summary: "", record: { ...profile.record!, graduationYear: null }, header: { ...profile.header, preferredJobType: null } });
    expect(httpClient.put).toHaveBeenCalledWith(URL, { revision: 5, student: {}, profile: { summary: "" }, clearFields: ["graduationYear", "preferredJobType"] });
  });

  it("does not submit non-MANUAL skills and makes their controls read-only", async () => {
    skillRows = [{ studentSkillId: 4, skillId: 8, skillName: "Java", category: "Backend", proficiencyLevel: "ADVANCED", yearsOfExperience: 2, source: "CV_EXTRACTED" }];
    renderProfile("/candidate/profile/edit?section=skills");
    expect(await screen.findByLabelText("Tên kỹ năng")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Xóa" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, { revision: 5, student: {}, profile: {} }));
  });

  it("requires the loaded record and revision before writing", async () => {
    const profile = await getCandidateProfileData();
    await expect(updateCandidateProfileData({ ...profile, record: undefined })).rejects.toThrow(/tải lại hồ sơ/);
    await expect(updateCandidateProfileData({ ...profile, revision: undefined })).rejects.toThrow(/tải lại hồ sơ/);
    expect(httpClient.put).not.toHaveBeenCalled();
  });

  it("keeps shared catalog grouping read-only while manual proficiency and years remain editable", async () => {
    skillRows = [{ studentSkillId: 3, skillId: 7, skillName: "Git", category: "Tools", proficiencyLevel: "INTERMEDIATE", yearsOfExperience: null, source: "MANUAL" }];
    renderProfile("/candidate/profile/edit?section=skills");
    await screen.findByLabelText("Tên kỹ năng");
    expect(screen.getByLabelText("Nhóm")).toBeDisabled();
    expect(screen.getByLabelText("Mức độ")).toBeEnabled();
    expect(screen.getByLabelText("Số năm kinh nghiệm")).toBeEnabled();
  });

  it("keeps all draft fields and reports a failed atomic save without partial-success messaging", async () => {
    renderProfile(); const name = await screen.findByLabelText("Họ tên");
    await userEvent.clear(name); await userEvent.type(name, "Draft survives");
    vi.mocked(httpClient.put).mockRejectedValueOnce({ response: { data: { errorCode: "VALIDATION_ERROR" } } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Dữ liệu nhập chưa hợp lệ/);
    expect(name).toHaveValue("Draft survives"); expect(student.fullName).toBe(studentSeed.fullName);
    expect(screen.queryByText("Đã lưu hồ sơ")).not.toBeInTheDocument(); expect(httpClient.put).toHaveBeenCalledTimes(1);
  });

  it("keeps stale edits, compares without rebasing, and reloads only after explicit confirmation", async () => {
    renderProfile(); const name = await screen.findByLabelText("Họ tên");
    await userEvent.clear(name); await userEvent.type(name, "Tab B draft");
    vi.mocked(httpClient.put).mockRejectedValueOnce({ response: { status: 409, data: { errorCode: "PROFILE_REVISION_CONFLICT" } } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/phiên khác/);
    expect(name).toHaveValue("Tab B draft"); expect(screen.getByRole("button", { name: "Lưu hồ sơ" })).toBeDisabled();
    student = { ...student, fullName: "Tab A committed" }; revision = 6;
    await userEvent.click(screen.getByRole("button", { name: "Tải bản mới để đối chiếu" }));
    await screen.findByRole("heading", { name: "Đối chiếu hồ sơ" });
    expect(name).toHaveValue("Tab B draft"); expect(httpClient.put).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Thay bản nháp bằng bản mới" }));
    expect(name).toHaveValue("Tab B draft");
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận tải lại" }));
    expect(name).toHaveValue("Tab A committed");
    await userEvent.clear(name); await userEvent.type(name, "Reviewed edit");
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await screen.findByText("Đã lưu hồ sơ");
    expect(httpClient.put).toHaveBeenLastCalledWith(URL, { revision: 6, student: { fullName: "Reviewed edit" }, profile: {} });
  });

  it("allows a controlled retry after a network error without fetching or overwriting a new version", async () => {
    renderProfile(); const name = await screen.findByLabelText("Họ tên");
    await userEvent.clear(name); await userEvent.type(name, "Retry draft");
    vi.mocked(httpClient.put).mockRejectedValueOnce(new Error("Network unavailable"));
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Chưa xác nhận/);
    expect(name).toHaveValue("Retry draft"); expect(screen.queryByText("Đã lưu hồ sơ")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await screen.findByText("Đã lưu hồ sơ");
    expect(httpClient.put).toHaveBeenCalledTimes(2); expect(httpClient.get).toHaveBeenCalledTimes(1);
  });

  it("blocks editing and double submission while pending", async () => {
    renderProfile(); await screen.findByLabelText("Họ tên");
    vi.mocked(httpClient.put).mockReturnValue(new Promise(() => undefined));
    const save = screen.getByRole("button", { name: "Lưu hồ sơ" }); await userEvent.dblClick(save);
    await waitFor(() => expect(httpClient.put).toHaveBeenCalledTimes(1));
    expect(save).toBeDisabled(); expect(screen.getByLabelText("Họ tên")).toBeDisabled();
  });

  it("validates hidden sections and focuses the invalid field without writes", async () => {
    renderProfile(); await userEvent.click(await screen.findByRole("button", { name: "Giới thiệu" }));
    const target = screen.getByLabelText("Vị trí mong muốn"); await userEvent.clear(target); await userEvent.type(target, "a".repeat(256));
    await userEvent.click(screen.getByRole("button", { name: "Thông tin cá nhân" }));
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(screen.getByLabelText("Vị trí mong muốn")).toHaveFocus()); expect(httpClient.put).not.toHaveBeenCalled();
  });

  it("announces skill-only unsaved changes without writing", async () => {
    renderProfile("/candidate/profile/edit?section=skills"); await screen.findByRole("button", { name: "Thêm" });
    await userEvent.click(screen.getByRole("button", { name: "Thêm" }));
    expect(screen.getByText("Bạn có thay đổi chưa lưu.")).toBeInTheDocument(); expect(httpClient.put).not.toHaveBeenCalled();
  });

  it("legacy preferences send the captured If-Match and only the requested fields", async () => {
    render(<ToastProvider><MemoryRouter><CandidatePreferencesView /></MemoryRouter></ToastProvider>);
    const target = await screen.findByLabelText("Vị trí mong muốn"); await userEvent.clear(target);
    await userEvent.clear(screen.getByLabelText("Địa điểm mong muốn"));
    vi.mocked(httpClient.put).mockRejectedValueOnce({ response: { data: { errorCode: "PROFILE_REVISION_CONFLICT" } } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu thiết lập" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/phiên khác/); expect(target).toHaveValue("");
    expect(screen.queryByText("Đã lưu mong muốn nghề nghiệp")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Lưu thiết lập" }));
    await screen.findByText("Đã lưu mong muốn nghề nghiệp");
    expect(httpClient.put).toHaveBeenLastCalledWith("/students/me/profile", { targetPosition: "", preferredLocation: "", preferredJobType: "INTERNSHIP" }, { headers: { "If-Match": '"5"' } });
  });
});
