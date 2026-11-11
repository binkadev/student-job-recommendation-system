import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../../services/api/httpClient";
import { RecruiterCompanyPage } from "./RecruiterCompanyPage";

const showToast = vi.hoisted(() => vi.fn());
vi.mock("../../hooks/useToast", () => ({ useToast: () => ({ showToast }) }));
vi.mock("../../services/api/httpClient", () => ({ httpClient: { get: vi.fn(), put: vi.fn() } }));
const URL = "/companies/me";
const seed = { id: 7, userId: 9, revision: 4, email: "company@example.test", companyName: "Synthetic Company", taxCode: "TAX-7", description: "Existing description", website: "https://example.test", address: "Hà Nội", phone: "0123456789", industry: "Software", companySize: "51-200" as string | null, logoUrl: "https://cdn.example.test/logo.png" as string | null, coverImageUrl: null as string | null, status: "VERIFIED", createdAt: "2026-11-01T10:00:00", updatedAt: "2026-11-01T10:00:00" };
let company = { ...seed };
const envelope = (data: unknown) => ({ data: { success: true, data }, headers: { etag: `"${company.revision}"` } });
const getCompanyCalls = () => vi.mocked(httpClient.get).mock.calls.filter(([url]) => url === URL);
function show(mode: "view" | "edit" = "edit") { return render(<MemoryRouter><RecruiterCompanyPage mode={mode} /></MemoryRouter>); }
const expectedPayload = (changes: object = {}) => ({ companyName: seed.companyName, taxCode: seed.taxCode, description: seed.description, website: seed.website, address: seed.address, phone: seed.phone, industry: seed.industry, companySize: seed.companySize, logoUrl: seed.logoUrl, coverImageUrl: seed.coverImageUrl ?? "", ...changes });
beforeEach(() => {
  vi.resetAllMocks(); company = { ...seed };
  vi.mocked(httpClient.get).mockImplementation(async (url) => {
    if (url === URL) return envelope({ ...company });
    if (url === "/companies/me/jobs") return envelope({ items: [], page: 1, size: 5, totalItems: 0, totalPages: 0 });
    throw new Error(`Unexpected GET ${url}`);
  });
  vi.mocked(httpClient.put).mockImplementation(async (url, payload) => {
    if (url !== URL) throw new Error(`Unexpected PUT ${url}`);
    const fields = payload as typeof company;
    company = { ...company, ...fields, companySize: fields.companySize || null, logoUrl: fields.logoUrl || null, coverImageUrl: fields.coverImageUrl || null, revision: company.revision + 1 };
    return envelope({ ...company });
  });
});

describe("Company size and logo URL with captured ETag", () => {
  it("loads real fields, edits both, preserves existing values and uses the refreshed ETag after success", async () => {
    show();
    const size = await screen.findByLabelText("Quy mô công ty");
    expect(size).toHaveValue("51-200"); expect(screen.getByLabelText("URL logo")).toHaveValue(seed.logoUrl);
    expect(screen.getByLabelText("Mã số thuế")).toHaveValue(seed.taxCode);
    await userEvent.clear(size); await userEvent.type(size, "201-500");
    await userEvent.clear(screen.getByLabelText("URL logo")); await userEvent.type(screen.getByLabelText("URL logo"), "https://cdn.example.test/new.png");
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, expectedPayload({ companySize: "201-500", logoUrl: "https://cdn.example.test/new.png" }), { headers: { "If-Match": '"4"' } }));
    await waitFor(() => expect(getCompanyCalls()).toHaveLength(2));
    expect(await screen.findByLabelText("Quy mô công ty")).toHaveValue("201-500");
    expect(screen.getByLabelText("Giới thiệu công ty")).toHaveValue(seed.description);
    expect(company).toEqual({ ...seed, companySize: "201-500", logoUrl: "https://cdn.example.test/new.png", revision: 5 });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(httpClient.put).toHaveBeenLastCalledWith(URL, expectedPayload({ companySize: "201-500", logoUrl: "https://cdn.example.test/new.png" }), { headers: { "If-Match": '"5"' } }));
  });

  it("clears both nullable fields using empty strings and reloads the cleared values", async () => {
    show(); await userEvent.clear(await screen.findByLabelText("Quy mô công ty"));
    await userEvent.clear(screen.getByLabelText("URL logo"));
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, expectedPayload({ companySize: "", logoUrl: "" }), { headers: { "If-Match": '"4"' } }));
    await waitFor(() => expect(getCompanyCalls()).toHaveLength(2));
    expect(await screen.findByLabelText("Quy mô công ty")).toHaveValue("");
    expect(screen.getByLabelText("URL logo")).toHaveValue("");
    expect(company).toEqual({ ...seed, companySize: null, logoUrl: null, revision: 5 });
  });

  it("loads null values without introducing defaults or upload controls", async () => {
    company = { ...company, companySize: null, logoUrl: null };
    show(); expect(await screen.findByLabelText("Quy mô công ty")).toHaveValue("");
    expect(screen.getByLabelText("URL logo")).toHaveValue("");
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(screen.queryByText(/chưa hỗ trợ lưu logo và ảnh bìa/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("URL ảnh bìa")).toBeEnabled();
    expect(screen.getByText(/hiện hỗ trợ ảnh qua URL/)).toBeInTheDocument();
  });

  it("validates 100/500 character boundaries before writing", async () => {
    show(); await screen.findByLabelText("URL logo");
    const prefix = "https://cdn.example.test/";
    const validUrl = prefix + "a".repeat(500 - prefix.length);
    fireEvent.change(screen.getByLabelText("Quy mô công ty"), { target: { value: "a".repeat(101) } });
    fireEvent.change(screen.getByLabelText("URL logo"), { target: { value: validUrl + "x" } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    expect(screen.getByText("Quy mô công ty tối đa 100 ký tự.")).toBeInTheDocument();
    expect(screen.getByText("URL logo tối đa 500 ký tự.")).toBeInTheDocument(); expect(httpClient.put).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Quy mô công ty"), { target: { value: "a".repeat(100) } });
    fireEvent.change(screen.getByLabelText("URL logo"), { target: { value: validUrl } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, expectedPayload({ companySize: "a".repeat(100), logoUrl: validUrl }), { headers: { "If-Match": '"4"' } }));
  });

  it.each(["javascript:alert(1)", "data:image/png;base64,abc", "ftp://example.test/logo.png", "/relative.png", "//example.test/logo.png", "https:///logo.png", "https://", "https://user:pass@example.test/logo.png", "https://@example.test/logo.png", "https://example.test/logo image.png", " https://example.test/logo.png", "https://example.test/logo.png ", " ", "https://bad_host.test/logo.png", "https://example.test/%zz"])("rejects unsafe or malformed logo URL %s without writes", async (value) => {
    show(); const logo = await screen.findByLabelText("URL logo");
    fireEvent.change(logo, { target: { value } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    expect(logo).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(/HTTP\/HTTPS/); expect(httpClient.put).not.toHaveBeenCalled();
  });

  it.each(["http://cdn.example.test/logo.png", "HTTPS://cdn.example.test/logo.png", "https://[::1]:8080/logo.png", "https://cdn.example.test/logo%20image.png"])("accepts absolute HTTP(S) URL %s", async (value) => {
    show(); fireEvent.change(await screen.findByLabelText("URL logo"), { target: { value } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, expectedPayload({ logoUrl: value }), { headers: { "If-Match": '"4"' } }));
  });

  it("preserves every draft field on 409 and never fetches or retries automatically", async () => {
    show(); await screen.findByLabelText("URL logo");
    for (const [label, value] of [["Tên công ty", "Draft Company"], ["Mã số thuế", "DRAFT-TAX"], ["Quy mô công ty", "Draft size"], ["URL logo", "https://cdn.example.test/draft.png"], ["URL ảnh bìa", "https://cdn.example.test/draft-cover.png"], ["Giới thiệu công ty", "Draft description"]]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
    vi.mocked(httpClient.put).mockRejectedValueOnce({ response: { status: 409, data: { errorCode: "SETTINGS_REVISION_CONFLICT", message: "Conflict" } } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Bản đang soạn vẫn được giữ/);
    for (const [label, value] of [["Tên công ty", "Draft Company"], ["Mã số thuế", "DRAFT-TAX"], ["Quy mô công ty", "Draft size"], ["URL logo", "https://cdn.example.test/draft.png"], ["URL ảnh bìa", "https://cdn.example.test/draft-cover.png"], ["Giới thiệu công ty", "Draft description"]]) expect(screen.getByLabelText(label)).toHaveValue(value);
    const save = screen.getByRole("button", { name: "Lưu hồ sơ" }); expect(save).toBeDisabled();
    await userEvent.click(save);
    expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, expectedPayload({ companyName: "Draft Company", taxCode: "DRAFT-TAX", companySize: "Draft size", logoUrl: "https://cdn.example.test/draft.png", coverImageUrl: "https://cdn.example.test/draft-cover.png", description: "Draft description" }), { headers: { "If-Match": '"4"' } });
    expect(getCompanyCalls()).toHaveLength(1); expect(company).toEqual(seed);
    expect(showToast).not.toHaveBeenCalledWith(expect.objectContaining({ type: "success" }));
  });

  it("allows a manual retry of network failure with the original captured ETag", async () => {
    show(); fireEvent.change(await screen.findByLabelText("Quy mô công ty"), { target: { value: "Retry draft" } });
    vi.mocked(httpClient.put).mockRejectedValueOnce(new Error("Network failure"));
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await screen.findByRole("alert"); expect(getCompanyCalls()).toHaveLength(1);
    expect(screen.getByLabelText("Quy mô công ty")).toHaveValue("Retry draft");
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(httpClient.put).toHaveBeenCalledTimes(2));
    expect(httpClient.put).toHaveBeenLastCalledWith(URL, expectedPayload({ companySize: "Retry draft" }), { headers: { "If-Match": '"4"' } });
  });

  it("blocks edits and duplicate writes while a save is pending", async () => {
    show(); await screen.findByLabelText("URL logo");
    vi.mocked(httpClient.put).mockReturnValue(new Promise(() => undefined));
    const save = screen.getByRole("button", { name: "Lưu hồ sơ" });
    await userEvent.dblClick(save);
    expect(httpClient.put).toHaveBeenCalledTimes(1);
    expect(save).toBeDisabled(); expect(screen.getByLabelText("URL logo")).toBeDisabled();
    expect(screen.getByLabelText("Quy mô công ty")).toBeDisabled();
    expect(screen.getByLabelText("URL ảnh bìa")).toBeDisabled();
  });

  it("tries a newly saved logo URL after a previous image failed", async () => {
    const view = show("view"); fireEvent.error(await screen.findByRole("img", { name: "Logo Synthetic Company" }));
    expect(screen.getByRole("img", { name: "Logo mặc định của Synthetic Company" })).toBeInTheDocument();
    view.rerender(<MemoryRouter><RecruiterCompanyPage mode="edit" /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText("URL logo"), { target: { value: "https://cdn.example.test/replacement.png" } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(getCompanyCalls()).toHaveLength(2));
    await screen.findByLabelText("URL logo");
    view.rerender(<MemoryRouter><RecruiterCompanyPage /></MemoryRouter>);
    expect(await screen.findByRole("img", { name: "Logo Synthetic Company" })).toHaveAttribute("src", "https://cdn.example.test/replacement.png");
  });

  it("shows saved company size and a remote logo with safe image attributes", async () => {
    show("view"); const logo = await screen.findByRole("img", { name: "Logo Synthetic Company" });
    expect(logo).toHaveAttribute("src", seed.logoUrl); expect(logo).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(logo).toHaveAttribute("width", "64"); expect(logo).toHaveAttribute("height", "64");
    expect(screen.getAllByText("51-200")).toHaveLength(2);
    fireEvent.error(logo);
    expect(screen.queryByRole("img", { name: "Logo Synthetic Company" })).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Logo mặc định của Synthetic Company" })).toHaveTextContent("SC");
  });

  it.each([null, "", "javascript:alert(1)", "https://user:pass@example.test/logo.png", "https://example.test/logo image.png", "https://example.test/" + "a".repeat(500)])("uses the hero fallback without requesting invalid/missing logo %s", async (logoUrl) => {
    company = { ...company, companySize: null, logoUrl };
    show("view"); expect(await screen.findByRole("img", { name: "Logo mặc định của Synthetic Company" })).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("Quy mô:")).toHaveTextContent("Chưa cập nhật");
  });
  it("loads a saved cover, edits it with the captured ETag and preserves all other fields", async () => {
    company = { ...company, coverImageUrl: "https://cdn.example.test/saved-cover.png" };
    show(); const cover = await screen.findByLabelText("URL ảnh bìa");
    expect(cover).toHaveValue("https://cdn.example.test/saved-cover.png");
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(httpClient.get).toHaveBeenCalledTimes(2);
    fireEvent.change(cover, { target: { value: "https://cdn.example.test/edited-cover.png" } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, expectedPayload({ coverImageUrl: "https://cdn.example.test/edited-cover.png" }), { headers: { "If-Match": '"4"' } }));
    await waitFor(() => expect(getCompanyCalls()).toHaveLength(2));
    expect(await screen.findByLabelText("URL ảnh bìa")).toHaveValue("https://cdn.example.test/edited-cover.png");
    expect(company).toEqual({ ...seed, coverImageUrl: "https://cdn.example.test/edited-cover.png", revision: 5 });
    // A subsequent edit to another field retains the saved cover and advances the captured ETag.
    fireEvent.change(screen.getByLabelText("Lĩnh vực"), { target: { value: "Updated industry" } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(httpClient.put).toHaveBeenLastCalledWith(URL, expectedPayload({ coverImageUrl: "https://cdn.example.test/edited-cover.png", industry: "Updated industry" }), { headers: { "If-Match": '"5"' } }));
  });

  it("clears only the saved cover with an empty string and reloads its nullable value", async () => {
    company = { ...company, coverImageUrl: "https://cdn.example.test/saved-cover.png" };
    show(); await userEvent.clear(await screen.findByLabelText("URL ảnh bìa"));
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, expectedPayload({ coverImageUrl: "" }), { headers: { "If-Match": '"4"' } }));
    await waitFor(() => expect(getCompanyCalls()).toHaveLength(2));
    expect(await screen.findByLabelText("URL ảnh bìa")).toHaveValue("");
    expect(company).toEqual({ ...seed, coverImageUrl: null, revision: 5 });
  });

  it("enforces the cover URL 500-character boundary before saving", async () => {
    show(); const cover = await screen.findByLabelText("URL ảnh bìa");
    expect(cover).toHaveValue("");
    const prefix = "https://cdn.example.test/", valid = prefix + "a".repeat(500 - prefix.length);
    fireEvent.change(cover, { target: { value: valid + "x" } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    expect(screen.getByText("URL ảnh bìa tối đa 500 ký tự.")).toBeInTheDocument();
    expect(httpClient.put).not.toHaveBeenCalled();
    fireEvent.change(cover, { target: { value: valid } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, expectedPayload({ coverImageUrl: valid }), { headers: { "If-Match": '"4"' } }));
  });

  it.each(["javascript:alert(1)", "data:image/png;base64,abc", "ftp://example.test/cover.png", "/relative.png", "//example.test/cover.png", "https:///cover.png", "https://", "https://user:pass@example.test/cover.png", "https://@example.test/cover.png", "https://example.test/cover image.png", " https://example.test/cover.png", "https://example.test/cover.png ", " ", "https://bad_host.test/cover.png", "https://example.test/%zz"])("rejects cover URL %s using the shared image validator", async (value) => {
    show(); const cover = await screen.findByLabelText("URL ảnh bìa");
    fireEvent.change(cover, { target: { value } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    expect(cover).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(/HTTP\/HTTPS/);
    expect(httpClient.put).not.toHaveBeenCalled();
    expect(getCompanyCalls()).toHaveLength(1);
  });

  it.each(["http://cdn.example.test/cover.png", "HTTPS://cdn.example.test/cover.png", "https://[::1]:8080/cover.png", "https://cdn.example.test/cover%20image.png"])("saves valid HTTP(S) cover URL %s", async (value) => {
    show(); fireEvent.change(await screen.findByLabelText("URL ảnh bìa"), { target: { value } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, expectedPayload({ coverImageUrl: value }), { headers: { "If-Match": '"4"' } }));
  });

  it("renders the saved cover safely behind readable hero text and falls back after an image error", async () => {
    company = { ...company, coverImageUrl: "https://cdn.example.test/saved-cover.png" };
    show("view"); await screen.findByRole("heading", { name: "Synthetic Company" });
    const cover = screen.getByAltText("");
    expect(cover).toHaveAttribute("src", company.coverImageUrl);
    expect(cover).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(cover).toHaveAttribute("aria-hidden", "true");
    expect(cover).toHaveClass("absolute", "object-cover");
    const hero = cover.parentElement!;
    expect(hero).toHaveClass("aurora-panel", "min-h-48");
    expect(hero.querySelector('div[aria-hidden="true"]')).toHaveClass("bg-slate-950/75");
    expect(screen.getByRole("heading", { name: "Synthetic Company" })).toHaveClass("text-white");
    fireEvent.error(cover);
    expect(screen.queryByAltText("")).not.toBeInTheDocument();
    expect(hero).toHaveClass("aurora-panel");
    expect(hero.querySelector('div[aria-hidden="true"]')).toBeNull();
    expect(screen.getByRole("heading", { name: "Synthetic Company" })).toBeVisible();
    expect(httpClient.get).toHaveBeenCalledTimes(2); expect(httpClient.put).not.toHaveBeenCalled();
  });

  it.each([null, "", "javascript:alert(1)", "https://user:pass@example.test/cover.png", "https://example.test/cover image.png", "https://example.test/" + "a".repeat(500)])("keeps the Neo-Aurora fallback for missing/invalid cover %s", async (coverImageUrl) => {
    company = { ...company, coverImageUrl };
    show("view"); const name = await screen.findByRole("heading", { name: "Synthetic Company" });
    expect(name.closest(".aurora-panel")).toBeInTheDocument();
    expect(screen.queryByAltText("")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Logo Synthetic Company" })).toBeInTheDocument();
    expect(httpClient.get).toHaveBeenCalledTimes(2); expect(httpClient.put).not.toHaveBeenCalled();
  });

  it("renders a newly saved cover after an earlier URL failed without extra API requests", async () => {
    company = { ...company, coverImageUrl: "https://cdn.example.test/broken-cover.png" };
    const view = show("view"); await screen.findByRole("heading", { name: "Synthetic Company" });
    fireEvent.error(screen.getByAltText("")); expect(screen.queryByAltText("")).not.toBeInTheDocument();
    view.rerender(<MemoryRouter><RecruiterCompanyPage mode="edit" /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText("URL ảnh bìa"), { target: { value: "https://cdn.example.test/recovered-cover.png" } });
    await userEvent.click(screen.getByRole("button", { name: "Lưu hồ sơ" }));
    await waitFor(() => expect(getCompanyCalls()).toHaveLength(2));
    await screen.findByLabelText("URL ảnh bìa");
    view.rerender(<MemoryRouter><RecruiterCompanyPage /></MemoryRouter>);
    expect(screen.getByAltText("")).toHaveAttribute("src", "https://cdn.example.test/recovered-cover.png");
    expect(httpClient.get).toHaveBeenCalledTimes(3);
    expect(httpClient.put).toHaveBeenCalledExactlyOnceWith(URL, expectedPayload({ coverImageUrl: "https://cdn.example.test/recovered-cover.png" }), { headers: { "If-Match": '"4"' } });
  });

});
