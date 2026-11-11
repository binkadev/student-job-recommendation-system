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
const detailsSeed = { gpa: 3.25 as number | null, educationLevel: "Đại học" as string | null, preferredWorkingModel: "HYBRID" as string | null, githubUrl: "https://github.com/example", linkedinUrl: "https://example.test/linkedin", portfolioUrl: "https://example.test", certificates: [{ name: "Existing certificate", issuer: null as string | null, issuedAt: "2025", expiresAt: "", code: "CERT-1", url: "https://example.test/cert" }], languages: [{ name: "English", level: "B2" }], id: 2, studentId: 2, summary: "Existing summary", education: "School one\nSchool two", experience: "Experience one\nExperience two", projects: "Project one\nProject two", targetPosition: "Backend Developer", preferredLocation: "Đà Nẵng", preferredJobType: "INTERNSHIP", profileCompleteness: 75 };
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
    const payload = body as { student?: object; profile?: object; certificates?: typeof details.certificates; languages?: typeof details.languages; clearFields?: string[] };
    if (url === URL) {
      student = { ...student, ...payload.student }; details = { ...details, ...payload.profile }; revision++;
      if (payload.certificates) details.certificates = payload.certificates;
      if (payload.languages) details.languages = payload.languages;
      for (const field of payload.clearFields ?? []) {
        if (field === "certificates" || field === "languages") details[field] = [];
        else Object.assign(details, { [field]: null });
      }
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
  it("maps null extensions to empty UI values without sending invented data", async () => {
    vi.mocked(httpClient.get).mockResolvedValueOnce(envelope({ ...snapshot(), profile: { ...details, certificates: null, languages: null, githubUrl: null, linkedinUrl: null, portfolioUrl: null } }));
    const profile = await getCandidateProfileData();
    expect(profile.certificates).toEqual([]); expect(profile.languages).toEqual([]);
    expect(profile.links).toEqual({ github: "", linkedIn: "", portfolio: "", website: "" });
    await updateCandidateProfileData(profile);
    expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, { revision: 5, student: {}, profile: {} });
  });

  it("removes one item by replacing only its changed collection and supports cancel", async () => {
    details = { ...details, languages: [...details.languages, { name: "Vietnamese", level: "Native" }] };
    renderProfile("/candidate/profile/edit?section=languages");
    await userEvent.click(await screen.findByRole("button", { name: "Xóa ngoại ngữ 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.getAllByLabelText("Tên ngoại ngữ")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Xóa ngoại ngữ 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Xóa" }));
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await screen.findByText("Đã lưu hồ sơ");
    expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, { revision: 5, student: {}, profile: {}, languages: [{ name: "Vietnamese", level: "Native" }] });
  });

  it("loads real certificates, languages and links and displays every saved DTO field", async () => {
    const profile = await getCandidateProfileData();
    expect(profile.certificates[0]).toMatchObject({ name: "Existing certificate", issuer: "", issuedAt: "2025", expiresAt: "", code: "CERT-1", url: "https://example.test/cert" });
    expect(profile.languages[0]).toMatchObject({ name: "English", level: "B2" });
    expect(profile.links).toMatchObject({ github: details.githubUrl, linkedIn: details.linkedinUrl, portfolio: details.portfolioUrl });
    render(<ToastProvider><MemoryRouter><CandidateProfilePage /></MemoryRouter></ToastProvider>);
    expect(await screen.findByText("Existing certificate")).toBeInTheDocument();
    expect(screen.getByText("Mã chứng chỉ: CERT-1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Xem chứng chỉ/ })).toHaveAttribute("href", details.certificates[0].url);
    expect(screen.getByText("English")).toBeInTheDocument();
    expect(screen.getByText("B2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", details.githubUrl);
  });

  it("edits and adds certificates using only exact DTO fields and preserves all other data", async () => {
    renderProfile("/candidate/profile/edit?section=certificates");
    const name = await screen.findByLabelText("Tên chứng chỉ");
    expect(name).toHaveValue("Existing certificate");
    await userEvent.clear(name); await userEvent.type(name, "Updated certificate");
    await userEvent.click(screen.getByRole("button", { name: "Thêm chứng chỉ" }));
    await userEvent.type(screen.getAllByLabelText("Tên chứng chỉ")[1], "New certificate");
    await userEvent.type(screen.getAllByLabelText("Đơn vị cấp")[1], "Issuer");
    await userEvent.type(screen.getAllByLabelText("Thời gian cấp")[1], "Tháng 5/2026");
    await userEvent.type(screen.getAllByLabelText("Thời gian hết hạn")[1], "Không hết hạn");
    await userEvent.type(screen.getAllByLabelText("Mã chứng chỉ")[1], "NEW-1");
    await userEvent.type(screen.getAllByLabelText("URL chứng chỉ")[1], "https://example.test/new");
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await screen.findByText("Đã lưu hồ sơ");
    expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, { revision: 5, student: {}, profile: {}, certificates: [
      { ...detailsSeed.certificates[0], name: "Updated certificate", expiresAt: null },
      { name: "New certificate", issuer: "Issuer", issuedAt: "Tháng 5/2026", expiresAt: "Không hết hạn", code: "NEW-1", url: "https://example.test/new" },
    ] });
    expect(details).toEqual({ ...detailsSeed, certificates: details.certificates });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(httpClient.put).toHaveBeenLastCalledWith(URL, { revision: 6, student: {}, profile: {} }));
  });

  it("adds and edits languages as free text with exact DTO fields", async () => {
    renderProfile("/candidate/profile/edit?section=languages");
    const level = await screen.findByLabelText("Trình độ ngoại ngữ");
    expect(level).toHaveValue("B2");
    await userEvent.clear(level); await userEvent.type(level, "IELTS 7.0");
    await userEvent.click(screen.getByRole("button", { name: "Thêm ngoại ngữ" }));
    await userEvent.type(screen.getAllByLabelText("Tên ngoại ngữ")[1], "Tiếng Nhật");
    await userEvent.type(screen.getAllByLabelText("Trình độ ngoại ngữ")[1], "JLPT N2");
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await screen.findByText("Đã lưu hồ sơ");
    expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, { revision: 5, student: {}, profile: {}, languages: [{ name: "English", level: "IELTS 7.0" }, { name: "Tiếng Nhật", level: "JLPT N2" }] });
    expect(details).toEqual({ ...detailsSeed, languages: details.languages });
  });

  it("removes certificates and languages only after confirmation and clears empty collections", async () => {
    renderProfile("/candidate/profile/edit?section=certificates");
    await userEvent.click(await screen.findByRole("button", { name: "Xóa chứng chỉ 1" }));
    expect(screen.getByLabelText("Tên chứng chỉ")).toHaveValue("Existing certificate");
    await userEvent.click(screen.getByRole("button", { name: "Xóa" }));
    await userEvent.click(screen.getByRole("button", { name: "Ngoại ngữ" }));
    await userEvent.click(screen.getByRole("button", { name: "Xóa ngoại ngữ 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Xóa" }));
    expect(httpClient.put).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await screen.findByText("Đã lưu hồ sơ");
    expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, { revision: 5, student: {}, profile: {}, clearFields: ["certificates", "languages"] });
    expect(details).toEqual({ ...detailsSeed, certificates: [], languages: [] });
  });

  it("edits one URL and clears the other URLs without touching lists or academic data", async () => {
    renderProfile("/candidate/profile/edit?section=links");
    const github = await screen.findByLabelText("URL GitHub");
    expect(github).toHaveValue(detailsSeed.githubUrl);
    await userEvent.clear(github); await userEvent.type(github, "https://github.com/updated");
    await userEvent.clear(screen.getByLabelText("URL LinkedIn"));
    await userEvent.clear(screen.getByLabelText("URL Portfolio"));
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await screen.findByText("Đã lưu hồ sơ");
    expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, { revision: 5, student: {}, profile: { githubUrl: "https://github.com/updated" }, clearFields: ["linkedinUrl", "portfolioUrl"] });
    expect(details).toEqual({ ...detailsSeed, githubUrl: "https://github.com/updated", linkedinUrl: null, portfolioUrl: null });
  });

  it("validates hidden certificate fields and focuses the invalid nested input", async () => {
    renderProfile("/candidate/profile/edit?section=certificates");
    await userEvent.clear(await screen.findByLabelText("Tên chứng chỉ"));
    await userEvent.click(screen.getByRole("button", { name: "Thông tin cá nhân" }));
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(screen.getByLabelText("Tên chứng chỉ")).toHaveFocus());
    expect(screen.getByLabelText("Tên chứng chỉ")).toHaveAttribute("aria-invalid", "true");
    expect(httpClient.put).not.toHaveBeenCalled();
  });

  it("rejects invalid language levels and unsafe profile URLs without writes", async () => {
    renderProfile("/candidate/profile/edit?section=languages");
    await userEvent.clear(await screen.findByLabelText("Trình độ ngoại ngữ"));
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(screen.getByLabelText("Trình độ ngoại ngữ")).toHaveAttribute("aria-invalid", "true"));
    await userEvent.type(screen.getByLabelText("Trình độ ngoại ngữ"), "B2");
    await userEvent.click(screen.getByRole("button", { name: "Liên kết" }));
    await userEvent.clear(screen.getByLabelText("URL GitHub"));
    await userEvent.type(screen.getByLabelText("URL GitHub"), "https://user:pass@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(screen.getByLabelText("URL GitHub")).toHaveAttribute("aria-invalid", "true"));
    expect(httpClient.put).not.toHaveBeenCalled();
  });

  it("retains lists and links on conflict, compares without rebasing and reloads only after confirmation", async () => {
    renderProfile("/candidate/profile/edit?section=languages");
    await userEvent.clear(await screen.findByLabelText("Trình độ ngoại ngữ"));
    await userEvent.type(screen.getByLabelText("Trình độ ngoại ngữ"), "Draft level");
    await userEvent.click(screen.getByRole("button", { name: "Chứng chỉ" }));
    await userEvent.clear(screen.getByLabelText("Tên chứng chỉ"));
    await userEvent.type(screen.getByLabelText("Tên chứng chỉ"), "Draft certificate");
    await userEvent.click(screen.getByRole("button", { name: "Liên kết" }));
    await userEvent.clear(screen.getByLabelText("URL GitHub"));
    vi.mocked(httpClient.put).mockRejectedValueOnce({ response: { status: 409, data: { errorCode: "PROFILE_REVISION_CONFLICT" } } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/phiên khác/);
    details = { ...details, languages: [{ name: "English", level: "Server level" }], githubUrl: "https://github.com/server" }; revision = 6;
    await userEvent.click(screen.getByRole("button", { name: "Tải bản mới để đối chiếu" }));
    await screen.findByRole("heading", { name: "Đối chiếu hồ sơ" });
    expect(screen.getByRole("cell", { name: /Tên: Draft certificate/ })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "English: Draft level" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "English: Server level" })).toBeInTheDocument();
    expect(screen.getByLabelText("URL GitHub")).toHaveValue("");
    expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, { revision: 5, student: {}, profile: {}, certificates: [{ ...detailsSeed.certificates[0], name: "Draft certificate", expiresAt: null }], languages: [{ name: "English", level: "Draft level" }], clearFields: ["githubUrl"] });
    expect(screen.getByRole("button", { name: "Lưu hồ sơ" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Thay bản nháp bằng bản mới" }));
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận tải lại" }));
    expect(screen.getByLabelText("URL GitHub")).toHaveValue("https://github.com/server");
    await userEvent.click(screen.getByRole("button", { name: "Ngoại ngữ" }));
    expect(screen.getByLabelText("Trình độ ngoại ngữ")).toHaveValue("Server level");
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await screen.findByText("Đã lưu hồ sơ");
    expect(httpClient.put).toHaveBeenLastCalledWith(URL, { revision: 6, student: {}, profile: {} });
  });

  it("loads real academic and working-model values, saves only changes, and displays the saved snapshot", async () => {
    skillRows = [{ studentSkillId: 3, skillId: 7, skillName: "Git", category: "Tools", proficiencyLevel: "INTERMEDIATE", yearsOfExperience: null, source: "MANUAL" }];
    const view = renderProfile("/candidate/profile/edit?section=education");
    const gpa = await screen.findByLabelText("GPA (thang 4)");
    expect(gpa).toHaveValue("3.25");
    expect(screen.getByLabelText("Trình độ học vấn")).toHaveValue("Đại học");
    await userEvent.clear(gpa); await userEvent.type(gpa, "3.75");
    await userEvent.clear(screen.getByLabelText("Trình độ học vấn"));
    await userEvent.type(screen.getByLabelText("Trình độ học vấn"), "Cử nhân");
    await userEvent.click(screen.getByRole("button", { name: "Thông tin cá nhân" }));
    expect(screen.getByLabelText("Hình thức làm việc mong muốn")).toHaveValue("HYBRID");
    await userEvent.selectOptions(screen.getByLabelText("Hình thức làm việc mong muốn"), "REMOTE");
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await screen.findByText("Đã lưu hồ sơ");
    expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, { revision: 5, student: {}, profile: { gpa: 3.75, educationLevel: "Cử nhân", preferredWorkingModel: "REMOTE" } });
    expect(details).toEqual({ ...detailsSeed, gpa: 3.75, educationLevel: "Cử nhân", preferredWorkingModel: "REMOTE" });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(httpClient.put).toHaveBeenLastCalledWith(URL, { revision: 6, student: {}, profile: {} }));
    view.unmount();
    render(<ToastProvider><MemoryRouter><CandidateProfilePage /></MemoryRouter></ToastProvider>);
    expect(await screen.findByText("Trình độ học vấn: Cử nhân")).toBeInTheDocument();
    expect(screen.getByText("GPA (thang 4): 3.75")).toBeInTheDocument();
    expect(screen.getByText("Từ xa")).toBeInTheDocument();
  });

  it("loads unset fields without inventing defaults or clearing unrelated data", async () => {
    details = { ...details, gpa: null, educationLevel: null, preferredWorkingModel: null };
    renderProfile("/candidate/profile/edit?section=education");
    expect(await screen.findByLabelText("GPA (thang 4)")).toHaveValue("");
    expect(screen.getByLabelText("Trình độ học vấn")).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Thông tin cá nhân" }));
    expect(screen.getByLabelText("Hình thức làm việc mong muốn")).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await screen.findByText("Đã lưu hồ sơ");
    expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, { revision: 5, student: {}, profile: {} });
  });

  it("clears all nullable academic/preference values through clearFields and reloads empty values", async () => {
    renderProfile("/candidate/profile/edit?section=education");
    await userEvent.clear(await screen.findByLabelText("GPA (thang 4)"));
    await userEvent.clear(screen.getByLabelText("Trình độ học vấn"));
    await userEvent.click(screen.getByRole("button", { name: "Thông tin cá nhân" }));
    await userEvent.selectOptions(screen.getByLabelText("Hình thức làm việc mong muốn"), "");
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await screen.findByText("Đã lưu hồ sơ");
    expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, { revision: 5, student: {}, profile: {}, clearFields: ["gpa", "educationLevel", "preferredWorkingModel"] });
    expect(screen.getByLabelText("Hình thức làm việc mong muốn")).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Học vấn" }));
    expect(screen.getByLabelText("GPA (thang 4)")).toHaveValue("");
    expect(screen.getByLabelText("Trình độ học vấn")).toHaveValue("");
    expect(details).toEqual({ ...detailsSeed, gpa: null, educationLevel: null, preferredWorkingModel: null });
  });

  it.each(["-0.01", "4.01", "3.456", "abc", "1e0", "3,5"])("rejects invalid GPA %s, opens its tab and focuses without writing", async (value) => {
    renderProfile("/candidate/profile/edit?section=education");
    const gpa = await screen.findByLabelText("GPA (thang 4)");
    await userEvent.clear(gpa); await userEvent.type(gpa, value);
    await userEvent.click(screen.getByRole("button", { name: "Thông tin cá nhân" }));
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(screen.getByLabelText("GPA (thang 4)")).toHaveFocus());
    expect(screen.getByLabelText("GPA (thang 4)")).toHaveAttribute("aria-invalid", "true");
    expect(httpClient.put).not.toHaveBeenCalled();
  });

  it.each(["0.00", "4.00"])("saves boundary GPA %s as a number", async (value) => {
    renderProfile("/candidate/profile/edit?section=education");
    const gpa = await screen.findByLabelText("GPA (thang 4)");
    await userEvent.clear(gpa); await userEvent.type(gpa, value);
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await screen.findByText("Đã lưu hồ sơ");
    expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, { revision: 5, student: {}, profile: { gpa: Number(value) } });
    expect(gpa).toHaveValue(value);
  });

  it("validates the education-level length and accepts 100 characters", async () => {
    renderProfile("/candidate/profile/edit?section=education");
    const level = await screen.findByLabelText("Trình độ học vấn");
    await userEvent.clear(level); await userEvent.type(level, "a".repeat(101));
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    expect(await screen.findByText("Trình độ học vấn tối đa 100 ký tự.")).toBeInTheDocument();
    expect(httpClient.put).not.toHaveBeenCalled();
    await userEvent.clear(level); await userEvent.type(level, "a".repeat(100));
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await screen.findByText("Đã lưu hồ sơ");
    expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, { revision: 5, student: {}, profile: { educationLevel: "a".repeat(100) } });
  });

  it("keeps academic/preference drafts and the original revision after conflict and comparison", async () => {
    renderProfile("/candidate/profile/edit?section=education");
    const gpa = await screen.findByLabelText("GPA (thang 4)");
    await userEvent.clear(gpa); await userEvent.type(gpa, "3.80");
    await userEvent.clear(screen.getByLabelText("Trình độ học vấn"));
    await userEvent.click(screen.getByRole("button", { name: "Thông tin cá nhân" }));
    await userEvent.selectOptions(screen.getByLabelText("Hình thức làm việc mong muốn"), "ONSITE");
    vi.mocked(httpClient.put).mockRejectedValueOnce({ response: { status: 409, data: { errorCode: "PROFILE_REVISION_CONFLICT" } } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/phiên khác/);
    details = { ...details, gpa: 4, educationLevel: "Thạc sĩ", preferredWorkingModel: "REMOTE" }; revision = 6;
    await userEvent.click(screen.getByRole("button", { name: "Tải bản mới để đối chiếu" }));
    await screen.findByRole("heading", { name: "Đối chiếu hồ sơ" });
    expect(screen.getByRole("cell", { name: "3.80" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "4.00" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Tại văn phòng" })).toBeInTheDocument();
    expect(screen.getByLabelText("Hình thức làm việc mong muốn")).toHaveValue("ONSITE");
    expect(screen.getByRole("button", { name: "Lưu hồ sơ" })).toBeDisabled();
    expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, { revision: 5, student: {}, profile: { gpa: 3.8, preferredWorkingModel: "ONSITE" }, clearFields: ["educationLevel"] });
    await userEvent.click(screen.getByRole("button", { name: "Học vấn" }));
    expect(screen.getByLabelText("GPA (thang 4)")).toHaveValue("3.80");
    expect(screen.getByLabelText("Trình độ học vấn")).toHaveValue("");
  });

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
