import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../components/feedback/ToastProvider";
import { CandidateProfilePage } from "../../../pages/candidate/CandidateProfilePage";
import { httpClient } from "../../../services/api/httpClient";

vi.mock("../../../services/api/httpClient", () => ({ httpClient: { get: vi.fn(), put: vi.fn() } }));
const snapshot = () => ({
  revision: 42,
  student: { id: 9001, userId: 9002, fullName: "Synthetic Student", email: "private@example.test", phone: "PRIVATE-PHONE", location: "PRIVATE-ADDRESS", studentCode: "PRIVATE-STUDENT-CODE", headline: "Backend Engineer", major: "Software Engineering", university: "Synthetic University", graduationYear: 2026 },
  profile: { id: 9003, studentId: 9001, summary: "Backend summary\nSecond summary line", education: "Persisted education", experience: "Persisted experience\nSecond experience line", projects: "Persisted projects", educationLevel: "Cử nhân", gpa: 3.75, targetPosition: "Developer", preferredWorkingModel: "REMOTE", profileCompleteness: 80, rawText: "PRIVATE-RAW-TEXT", processedText: "PRIVATE-PROCESSED-TEXT", updatedAt: "PRIVATE-TIMESTAMP",
    certificates: [{ name: "Synthetic certificate", issuer: "Synthetic issuer", issuedAt: "2025", expiresAt: "2028", code: "PRIVATE-CREDENTIAL-CODE", url: "https://example.test/certificate" }],
    languages: [{ name: "English", level: "B2" }], githubUrl: "https://github.com/synthetic", linkedinUrl: "https://example.test/linkedin", portfolioUrl: "https://example.test/portfolio" },
  skills: [{ studentSkillId: 9004, skillId: 9005, skillName: "Java", proficiencyLevel: "ADVANCED", yearsOfExperience: 2, source: "CV_EXTRACTED", category: "Backend" }],
});
const envelope = (data: unknown) => ({ data: { success: true, data } });
beforeEach(() => { vi.resetAllMocks(); vi.mocked(httpClient.get).mockResolvedValue(envelope(snapshot())); });
function renderPage() { return render(<ToastProvider><MemoryRouter><CandidateProfilePage /></MemoryRouter></ToastProvider>); }
async function openPreview() {
  const trigger = await screen.findByRole("button", { name: "Xem trước hồ sơ" });
  await userEvent.click(trigger);
  return { trigger, dialog: screen.getByRole("dialog", { name: "Xem trước hồ sơ ứng viên" }) };
}

describe("Student Profile self-preview using the already loaded aggregate", () => {
  it("opens from the profile action and shows the saved recruiter-facing data without new requests", async () => {
    renderPage();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const { trigger, dialog } = await openPreview();
    const view = within(dialog);
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    for (const value of ["Synthetic Student", "Backend Engineer", /Backend summary/, /Synthetic University/, /Software Engineering/, /Cử nhân/, /Tốt nghiệp 2026/, /GPA 3.75/, "Persisted education", /Persisted experience/, "Persisted projects", "Java", "Synthetic certificate", "Synthetic issuer", "Cấp: 2025", "Hết hạn: 2028", "English · B2"]) expect(view.getByText(value)).toBeInTheDocument();
    expect(view.getByText(/Second summary line/)).toHaveClass("whitespace-pre-wrap");
    for (const [name, href] of [[/GitHub/, "https://github.com/synthetic"], [/LinkedIn/, "https://example.test/linkedin"], [/Portfolio/, "https://example.test/portfolio"], [/Xem chứng chỉ/, "https://example.test/certificate"]] as const) {
      const link = view.getByRole("link", { name });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(view.getByText(/Bản xem trước dành cho bạn/)).toHaveTextContent(/chưa công khai hồ sơ/);
    expect(httpClient.get).toHaveBeenCalledExactlyOnceWith("/students/me/profile-aggregate");
    expect(httpClient.put).not.toHaveBeenCalled();
  });

  it("omits private contacts, student identifiers, credential codes and internal analysis metadata", async () => {
    renderPage(); const { dialog } = await openPreview();
    for (const privateValue of ["private@example.test", "PRIVATE-PHONE", "PRIVATE-ADDRESS", "PRIVATE-STUDENT-CODE", "PRIVATE-RAW-TEXT", "PRIVATE-PROCESSED-TEXT", "PRIVATE-TIMESTAMP", "PRIVATE-CREDENTIAL-CODE", "CV_EXTRACTED", "9001", "9002", "9003", "9004", "9005"]) expect(dialog).not.toHaveTextContent(privateValue);
    expect(within(dialog).queryByRole("link", { name: /Chỉnh sửa|Chia sẻ|Công khai/ })).not.toBeInTheDocument();
    expect(dialog.querySelector('a[href^="mailto:"], a[href^="tel:"]')).toBeNull();
  });

  it("handles empty fields and the email-as-name fallback without inventing profile information", async () => {
    const saved = snapshot();
    vi.mocked(httpClient.get).mockResolvedValue(envelope({ ...saved,
      student: { ...saved.student, fullName: null, headline: " ", major: null, university: null, graduationYear: null },
      profile: { ...saved.profile, summary: " ", education: null, experience: "", projects: null, educationLevel: null, gpa: null, certificates: [], languages: [], githubUrl: null, linkedinUrl: "", portfolioUrl: " " }, skills: [],
    }));
    renderPage(); const { dialog } = await openPreview(); const view = within(dialog);
    expect(view.getByRole("heading", { name: "Ứng viên" })).toBeInTheDocument();
    for (const section of ["chức danh", "giới thiệu", "học vấn", "kinh nghiệm", "dự án", "kỹ năng", "chứng chỉ", "ngoại ngữ"]) expect(view.getByText(`Chưa cập nhật ${section}.`)).toBeInTheDocument();
    expect(view.getByText("Chưa có liên kết hợp lệ.")).toBeInTheDocument();
    expect(view.queryAllByRole("link")).toHaveLength(0);
    expect(dialog).not.toHaveTextContent("private@example.test");
    expect(dialog).not.toHaveTextContent(/undefined|null|NaN|Cập nhật từ backend/);
  });

  it("filters invalid and credential-bearing links, leaves text escaped and displays zero GPA", async () => {
    const saved = snapshot();
    vi.mocked(httpClient.get).mockResolvedValue(envelope({ ...saved, profile: { ...saved.profile,
      gpa: 0, summary: '<script>alert("unsafe")</script>', githubUrl: "javascript:alert(1)", linkedinUrl: "https://user:pass@example.test", portfolioUrl: "https://example.test/with space",
      certificates: [{ ...saved.profile.certificates[0], url: "data:text/html,unsafe" }],
    } }));
    renderPage(); const { dialog } = await openPreview();
    expect(within(dialog).queryAllByRole("link")).toHaveLength(0);
    expect(within(dialog).getByText(/GPA 0.00/)).toBeInTheDocument();
    expect(within(dialog).getByText('<script>alert("unsafe")</script>')).toBeInTheDocument();
    expect(dialog.querySelector("script")).toBeNull();
    expect(dialog).not.toHaveTextContent("user:pass");
  });

  it("supports keyboard opening, traps Tab/Shift+Tab, closes on Escape and restores focus", async () => {
    renderPage(); const trigger = await screen.findByRole("button", { name: "Xem trước hồ sơ" });
    trigger.focus(); await userEvent.keyboard("{Enter}");
    const dialog = screen.getByRole("dialog"); const view = within(dialog);
    const close = view.getByRole("button", { name: "Đóng" });
    const footer = view.getByRole("button", { name: "Đóng bản xem trước" });
    await waitFor(() => expect(close).toHaveFocus());
    await userEvent.tab({ shift: true }); expect(footer).toHaveFocus();
    await userEvent.tab(); expect(close).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus(); expect(document.body.style.overflow).not.toBe("hidden");
    expect(httpClient.get).toHaveBeenCalledTimes(1); expect(httpClient.put).not.toHaveBeenCalled();
  });

  it.each(["header", "footer", "backdrop"])("closes via %s and can reopen the same saved data", async (action) => {
    renderPage(); const { trigger, dialog } = await openPreview();
    if (action === "backdrop") await userEvent.click(dialog.parentElement!);
    else await userEvent.click(within(dialog).getByRole("button", { name: action === "header" ? "Đóng" : "Đóng bản xem trước" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(trigger).toHaveFocus();
    await userEvent.click(trigger);
    expect(within(screen.getByRole("dialog")).getByText("Persisted projects")).toBeInTheDocument();
    expect(httpClient.get).toHaveBeenCalledTimes(1); expect(httpClient.put).not.toHaveBeenCalled();
  });
});
