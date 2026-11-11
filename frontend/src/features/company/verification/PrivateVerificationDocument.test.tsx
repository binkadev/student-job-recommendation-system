import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../components/feedback/ToastProvider";
import { AdminCompaniesPage } from "../../../pages/admin/AdminCompaniesPage";
import { RecruiterCompanyPage } from "../../../pages/recruiter/RecruiterCompanyPage";
import { httpClient } from "../../../services/api/httpClient";

vi.mock("../../../services/api/httpClient", () => ({ httpClient: { get: vi.fn(), put: vi.fn(), patch: vi.fn() } }));
const OWN = "/companies/me/verification-document", ADMIN = "/admin/companies/7/verification-document";
const seed = { id: 7, userId: 9, revision: 5, email: "synthetic@example.test", companyName: "Synthetic Company", taxCode: "TAX", companySize: "51-200", logoUrl: null, coverImageUrl: null, status: "PENDING", description: "Existing description", industry: "Software", website: "https://example.test", phone: "012345", address: "Hà Nội", createdAt: "2026-11-01", updatedAt: "2026-11-01" };
let company = { ...seed }, metadata = { submitted: false, revision: 7 };
const envelope = (data: unknown, revision = metadata.revision) => ({ data: { success: true, data }, headers: { etag: `"${revision}"` } });
const count = (url: string) => vi.mocked(httpClient.get).mock.calls.filter(([path]) => path === url).length;
const pdf = (name = "verification.pdf") => new File(["synthetic test bytes"], name, { type: "application/pdf" });
let click: ReturnType<typeof vi.spyOn>;
function showCompany() { return render(<ToastProvider><MemoryRouter><RecruiterCompanyPage mode="verification" /></MemoryRouter></ToastProvider>); }
function showAdmin(mode: "detail" | "verification" = "detail", id = 7) {
  return render(<ToastProvider><MemoryRouter initialEntries={[`/admin/companies/${id}`]}><Routes><Route path="/admin/companies/:companyId" element={<AdminCompaniesPage mode={mode} />} /></Routes></MemoryRouter></ToastProvider>);
}
async function choose(file = pdf()) {
  const input = await screen.findByLabelText("Chọn tài liệu xác thực");
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.setup({ applyAccept: false }).upload(input, file); return { input, file };
}
beforeEach(() => {
  vi.resetAllMocks(); company = { ...seed }; metadata = { submitted: false, revision: 7 };
  Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: vi.fn(() => "blob:private-download") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: vi.fn() });
  click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  vi.mocked(httpClient.get).mockImplementation(async (url) => {
    if (url === OWN || url === ADMIN) return envelope({ ...metadata });
    if (url === `${OWN}/file` || url === `${ADMIN}/file`) return { data: new Blob(["private document"], { type: "application/pdf" }), headers: { "content-type": "application/pdf", "content-disposition": "attachment; filename=PRIVATE-STORAGE-KEY.pdf" } };
    if (url === "/companies/me" || url === "/admin/companies/7") return envelope({ ...company }, company.revision);
    if (url === "/admin/companies") return envelope({ items: [{ ...company }], page: 1, size: 10, totalItems: 1, totalPages: 1 });
    if (url === "/companies/me/jobs") return envelope({ items: [], page: 1, size: 5, totalItems: 0, totalPages: 0 });
    throw new Error(`Unexpected GET ${url}`);
  });
  vi.mocked(httpClient.put).mockImplementation(async (url, body) => {
    if (url === OWN) {
      metadata = { submitted: true, revision: metadata.revision + 1 }; company = { ...company, revision: metadata.revision }; return envelope({ ...metadata });
    }
    if (url === "/companies/me") { company = { ...company, ...body as object, revision: company.revision + 1 }; return envelope({ ...company }, company.revision); }
    throw new Error(`Unexpected PUT ${url}`);
  });
  vi.mocked(httpClient.patch).mockImplementation(async (_url, body) => { company = { ...company, ...body as object }; return envelope({ ...company }); });
});
afterEach(() => { vi.restoreAllMocks(); });

describe("Private verification document Company UI", () => {
  it("loads dedicated metadata, sends one multipart file using its ETag and refreshes both revisions", async () => {
    const view = showCompany();
    expect(await screen.findByText("Chưa gửi tài liệu xác thực.")).toBeInTheDocument();
    expect(screen.getByText(/tối đa 5 MiB/)).toBeInTheDocument();
    const { file } = await choose();
    await userEvent.click(screen.getByRole("button", { name: "Gửi tài liệu xác thực" }));
    await screen.findByText(/Đã gửi tài liệu xác thực. Trạng thái/);
    const [path, body, config] = vi.mocked(httpClient.put).mock.calls[0];
    expect(path).toBe(OWN); expect(body).toBeInstanceOf(FormData);
    const form = body as FormData; expect([...form.keys()]).toEqual(["file"]); expect(form.get("file")).toBe(file);
    expect(config?.headers).toEqual({ "Content-Type": null, "If-Match": '"7"' });
    await waitFor(() => expect(count(OWN)).toBe(2)); await waitFor(() => expect(count("/companies/me")).toBe(2));
    expect(company.status).toBe("PENDING"); expect(httpClient.patch).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Chọn tài liệu xác thực")).toHaveValue("");
    expect(screen.queryByRole("button", { name: /Xóa tài liệu|Xem trước/ })).not.toBeInTheDocument();
    view.rerender(<ToastProvider><MemoryRouter><RecruiterCompanyPage mode="edit" /></MemoryRouter></ToastProvider>);
    await userEvent.click(await screen.findByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(httpClient.put).toHaveBeenLastCalledWith("/companies/me", expect.objectContaining({ companySize: "51-200", description: "Existing description" }), { headers: { "If-Match": '"8"' } }));
  });

  it.each(["application/pdf", "image/png", "image/jpeg"])("replaces a submitted document with %s without changing moderation", async (type) => {
    metadata.submitted = true; showCompany();
    await screen.findByText("Đã gửi tài liệu xác thực.");
    const extension = type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : "pdf";
    await choose(new File(["synthetic"], `document.${extension}`, { type }));
    await userEvent.click(screen.getByRole("button", { name: "Thay thế tài liệu" }));
    await screen.findByText(/Đã gửi tài liệu xác thực. Trạng thái/);
    expect(httpClient.put).toHaveBeenCalledTimes(1); expect(httpClient.patch).not.toHaveBeenCalled();
  });

  it.each([
    ["empty", new File([], "empty.pdf", { type: "application/pdf" }), /Tệp đang trống/],
    ["oversize", new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.pdf", { type: "application/pdf" }), /Tệp tối đa 5 MiB/],
    ["wrong format", new File(["text"], "text.txt", { type: "text/plain" }), /Chỉ chấp nhận/],
    ["wrong MIME", new File(["text"], "fake.pdf", { type: "text/html" }), /Chỉ chấp nhận/],
  ] as const)("rejects %s selection with accessible guidance", async (_name, file, message) => {
    showCompany(); const { input } = await choose(file);
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Gửi tài liệu xác thực" })).toBeDisabled(); expect(httpClient.put).not.toHaveBeenCalled();
  });

  it("accepts exactly 5 MiB as a client hint and leaves content validation to the server", async () => {
    showCompany(); await choose(new File([new Uint8Array(5 * 1024 * 1024)], "boundary.pdf", { type: "application/pdf" }));
    expect(screen.getByRole("button", { name: "Gửi tài liệu xác thực" })).toBeEnabled();
    expect(screen.getByText(/Nội dung tệp sẽ được kiểm tra khi gửi/)).toBeInTheDocument();
  });

  it("keeps the selected file and captured revision on 409 without refetch or automatic retry", async () => {
    metadata.submitted = true; showCompany(); const { input, file } = await choose();
    vi.mocked(httpClient.put).mockRejectedValueOnce({ response: { status: 409 } });
    const send = screen.getByRole("button", { name: "Thay thế tài liệu" }); await userEvent.click(send);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Tệp đã chọn vẫn được giữ/);
    expect((input as HTMLInputElement).files?.[0]).toBe(file); expect(send).toBeDisabled();
    await userEvent.click(send); expect(httpClient.put).toHaveBeenCalledTimes(1);
    expect(vi.mocked(httpClient.put).mock.calls[0][2]?.headers).toMatchObject({ "If-Match": '"7"' });
    expect(count(OWN)).toBe(1); expect(count("/companies/me")).toBe(1);
  });

  it("retains the file after a network error and allows only a manual retry with the original ETag", async () => {
    showCompany(); const { input, file } = await choose();
    vi.mocked(httpClient.put).mockRejectedValueOnce(new Error("network"));
    await userEvent.click(screen.getByRole("button", { name: "Gửi tài liệu xác thực" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Chưa xác nhận gửi thành công/);
    expect((input as HTMLInputElement).files?.[0]).toBe(file); expect(count(OWN)).toBe(1);
    await userEvent.click(screen.getByRole("button", { name: "Gửi tài liệu xác thực" }));
    await screen.findByText(/Đã gửi tài liệu xác thực. Trạng thái/);
    expect(httpClient.put).toHaveBeenCalledTimes(2);
    expect(vi.mocked(httpClient.put).mock.calls[1][2]?.headers).toMatchObject({ "If-Match": '"7"' });
  });

  it.each([400, 403, 413])("keeps the selection after rejected upload %i", async (status) => {
    showCompany(); const { input, file } = await choose();
    vi.mocked(httpClient.put).mockRejectedValueOnce({ response: { status, data: { message: "PRIVATE-SERVER-PATH" } } });
    await userEvent.click(screen.getByRole("button", { name: "Gửi tài liệu xác thực" }));
    await screen.findByRole("alert");
    expect((input as HTMLInputElement).files?.[0]).toBe(file); expect(count(OWN)).toBe(1);
    expect(document.body).not.toHaveTextContent("PRIVATE-SERVER-PATH");
  });

  it("blocks duplicate upload and file changes while pending", async () => {
    showCompany(); const { input } = await choose();
    vi.mocked(httpClient.put).mockReturnValue(new Promise(() => undefined));
    const send = screen.getByRole("button", { name: "Gửi tài liệu xác thực" }); await userEvent.dblClick(send);
    expect(httpClient.put).toHaveBeenCalledTimes(1); expect(input).toBeDisabled(); expect(send).toBeDisabled();
  });

  it("does not invent submission state on metadata failure and supports an explicit retry", async () => {
    const get = vi.mocked(httpClient.get).getMockImplementation()!;
    vi.mocked(httpClient.get).mockImplementation(async (url, config) => { if (url === OWN && count(OWN) === 1) throw new Error("network"); return get(url, config); });
    showCompany(); expect(await screen.findByRole("alert")).toHaveTextContent(/Không tải được trạng thái/);
    expect(screen.queryByText("Chưa gửi tài liệu xác thực.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Chọn tài liệu xác thực")).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Tải lại trạng thái tài liệu" }));
    await screen.findByText("Chưa gửi tài liệu xác thực.");
  });

  it("keeps a confirmed revision even when post-upload profile refresh fails", async () => {
    const get = vi.mocked(httpClient.get).getMockImplementation()!;
    vi.mocked(httpClient.get).mockImplementation(async (url, config) => { if (url === "/companies/me" && count("/companies/me") === 2) throw new Error("network"); return get(url, config); });
    const view = showCompany(); await choose(); await userEvent.click(screen.getByRole("button", { name: "Gửi tài liệu xác thực" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Tài liệu đã được gửi nhưng chưa tải lại được thông tin công ty/);
    expect(screen.getByLabelText("Chọn tài liệu xác thực")).toHaveValue("");
    view.rerender(<ToastProvider><MemoryRouter><RecruiterCompanyPage mode="edit" /></MemoryRouter></ToastProvider>);
    await userEvent.click(await screen.findByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(vi.mocked(httpClient.put).mock.calls[1][2]?.headers).toMatchObject({ "If-Match": '"8"' }));
  });

  it("reports post-upload metadata refresh failure without resubmitting the file", async () => {
    const get = vi.mocked(httpClient.get).getMockImplementation()!;
    vi.mocked(httpClient.get).mockImplementation(async (url, config) => { if (url === OWN && count(OWN) === 2) throw new Error("network"); return get(url, config); });
    showCompany(); await choose(); await userEvent.click(screen.getByRole("button", { name: "Gửi tài liệu xác thực" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Tài liệu đã được gửi nhưng chưa tải lại được trạng thái/);
    expect(screen.getByLabelText("Chọn tài liệu xác thực")).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Tải lại trạng thái tài liệu" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(httpClient.put).toHaveBeenCalledTimes(1);
  });

  it("downloads through authenticated httpClient Blob transport and revokes its transient URL", async () => {
    metadata.submitted = true; showCompany();
    await userEvent.click(await screen.findByRole("button", { name: "Tải tài liệu xác thực" }));
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(httpClient.get).toHaveBeenCalledWith(`${OWN}/file`, expect.objectContaining({ responseType: "blob" }));
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(document.querySelector('a[href*="verification-document"], iframe, embed')).toBeNull();
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:private-download"), { timeout: 2000 });
  });
});

describe("Private verification document Admin UI", () => {
  it.each([true, false])("shows selected-company submitted=%s only on its detail screen", async (submitted) => {
    metadata.submitted = submitted; showAdmin("verification");
    expect(await screen.findByText(submitted ? "Đã gửi tài liệu xác thực." : "Chưa gửi tài liệu xác thực.")).toBeInTheDocument();
    expect(count(ADMIN)).toBe(1); expect(count(OWN)).toBe(0);
    expect(screen.queryByRole("button", { name: "Tải tài liệu xác thực" }) !== null).toBe(submitted);
    expect(screen.queryByLabelText("Chọn tài liệu xác thực")).not.toBeInTheDocument();
    expect(httpClient.patch).not.toHaveBeenCalled(); expect(httpClient.put).not.toHaveBeenCalled();
    expect(screen.getByText("Chờ xác thực")).toBeInTheDocument();
  });

  it("downloads only through the Admin authorized Blob endpoint", async () => {
    metadata.submitted = true; showAdmin();
    await userEvent.click(await screen.findByRole("button", { name: "Tải tài liệu xác thực" }));
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect(httpClient.get).toHaveBeenCalledWith(`${ADMIN}/file`, expect.objectContaining({ responseType: "blob" }));
    expect(document.body).not.toHaveTextContent("PRIVATE-STORAGE-KEY");
    expect(httpClient.patch).not.toHaveBeenCalled();
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledOnce(), { timeout: 2000 });
  });

  it.each([401, 403, 404, 500])("reports download status %i without exposing private server errors", async (status) => {
    metadata.submitted = true;
    const get = vi.mocked(httpClient.get).getMockImplementation()!;
    vi.mocked(httpClient.get).mockImplementation(async (url, config) => { if (url === `${ADMIN}/file`) throw { response: { status, data: new Blob(["PRIVATE-SERVER-PATH"]) } }; return get(url, config); });
    showAdmin(); await userEvent.click(await screen.findByRole("button", { name: "Tải tài liệu xác thực" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(status === 404 ? /Không tìm thấy/ : status === 500 ? /Không tải được/ : /không có quyền/);
    expect(document.body).not.toHaveTextContent("PRIVATE-SERVER-PATH"); expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("does not turn a metadata error into a false not-submitted status", async () => {
    const get = vi.mocked(httpClient.get).getMockImplementation()!;
    vi.mocked(httpClient.get).mockImplementation(async (url, config) => { if (url === ADMIN) throw { response: { status: 403 } }; return get(url, config); });
    showAdmin(); expect(await screen.findByRole("alert")).toHaveTextContent(/không có quyền/);
    expect(screen.queryByText("Chưa gửi tài liệu xác thực.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tải tài liệu xác thực" })).not.toBeInTheDocument();
  });

  it("isolates document status when the selected Admin company changes", async () => {
    const get = vi.mocked(httpClient.get).getMockImplementation()!;
    let release: (value: ReturnType<typeof envelope>) => void = () => {};
    vi.mocked(httpClient.get).mockImplementation(async (url, config) => {
      if (url === ADMIN) return new Promise(resolve => { release = resolve; });
      if (url === "/admin/companies/8") return envelope({ ...company, id: 8, companyName: "Second Company" }, 9);
      if (url === "/admin/companies/8/verification-document") return envelope({ submitted: false, revision: 9 }, 9);
      return get(url, config);
    });
    render(<ToastProvider><MemoryRouter initialEntries={["/admin/companies/7"]}><Routes><Route path="/admin/companies/:companyId" element={<><Link to="/admin/companies/8">Công ty tiếp theo</Link><AdminCompaniesPage mode="detail" /></>} /></Routes></MemoryRouter></ToastProvider>);
    await waitFor(() => expect(count(ADMIN)).toBe(1));
    await userEvent.click(screen.getByRole("link", { name: "Công ty tiếp theo" }));
    await screen.findByText("Chưa gửi tài liệu xác thực.");
    await act(async () => { release(envelope({ submitted: true, revision: 7 })); });
    expect(screen.getByText("Chưa gửi tài liệu xác thực.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tải tài liệu xác thực" })).not.toBeInTheDocument();
  });

  it("leaves list moderation controls unchanged and never fetches document metadata for list rows", async () => {
    render(<ToastProvider><MemoryRouter><AdminCompaniesPage /></MemoryRouter></ToastProvider>);
    await screen.findByText("Synthetic Company");
    expect(count(ADMIN)).toBe(0); expect(screen.queryByText("Tài liệu xác thực riêng tư")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Trạng thái" }));
    const dialog = screen.getByRole("dialog");
    await userEvent.selectOptions(within(dialog).getByLabelText("Trạng thái"), "VERIFIED");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cập nhật" }));
    await waitFor(() => expect(httpClient.patch).toHaveBeenCalledExactlyOnceWith("/admin/companies/7/status", { status: "VERIFIED" }));
    expect(count(ADMIN)).toBe(0);
  });
});
