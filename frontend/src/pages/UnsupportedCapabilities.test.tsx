import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CandidateMessagesPage } from "./candidate/CandidateMessagesPage";
import { RecruiterMembersPage } from "./recruiter/RecruiterMembersPage";
import { RecruiterSettingsPage } from "./recruiter/RecruiterSettingsPage";
import { CandidateSettingsPage } from "./candidate/CandidateSettingsPage";
import { AuthFlowPage } from "./auth/AuthFlowPage";

vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({ logout: vi.fn() }) }));
vi.mock("../hooks/useToast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("../services/api/httpClient", async original => ({ ...await original<typeof import("../services/api/httpClient")>(), httpClient: { get: vi.fn(() => new Promise(() => undefined)) } }));

describe("unsupported capabilities remain explicit", () => {
  it.each([
    <RecruiterMembersPage />, <RecruiterMembersPage mode="invite" />,
  ])("explains the missing capability without claiming a successfully empty query (%#)", (page) => {
    render(<MemoryRouter>{page}</MemoryRouter>);
    expect(screen.getByText("Chức năng chưa được hỗ trợ")).toBeInTheDocument();
    expect(screen.queryByText(/Chưa có (lịch|dữ liệu|lời mời)/)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mời thành viên|Gửi lời mời/ })).not.toBeInTheDocument();
  });
  it.each(["candidate", "recruiter"] as const)("keeps the %s message recovery link inside its role", (role) => {
    render(<MemoryRouter><CandidateMessagesPage role={role} /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Xem đơn ứng tuyển" })).toHaveAttribute("href", role === "recruiter" ? "/recruiter/candidates" : "/candidate/applications");
    expect(screen.getByText("Chức năng chưa được hỗ trợ")).toBeInTheDocument();
    expect(screen.queryByText("Chưa có tin nhắn.")).not.toBeInTheDocument();
  });
  it("does not imply that privacy settings have been applied", () => {
    render(<MemoryRouter><CandidateSettingsPage section="privacy" /></MemoryRouter>);
    expect(screen.getByText("Chức năng chưa được hỗ trợ")).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });
  it.each(["recruitment-process", "email-templates"] as const)("does not offer a fake save for %s", (section) => {
    render(<MemoryRouter><RecruiterSettingsPage section={section} /></MemoryRouter>);
    expect(screen.getByText("Chức năng chưa được hỗ trợ")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lưu cấu hình" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it.each(["forgot", "reset"] as const)("does not fake a successful password recovery for %s", (type) => {
    render(<MemoryRouter><AuthFlowPage type={type} /></MemoryRouter>);
    expect(screen.getByText("Chức năng chưa được hỗ trợ")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText("Đã ghi nhận thông tin")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quay lại đăng nhập" })).toHaveAttribute("href", "/login");
  });
});
