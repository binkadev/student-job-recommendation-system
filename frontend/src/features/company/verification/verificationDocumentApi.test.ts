import type { InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../../../services/api/httpClient";
import { AUTH_TOKEN_STORAGE_KEY } from "../../../services/auth/sessionVersion";
import { COMPANY_DOCUMENT_ENDPOINT, downloadVerificationDocument, getVerificationDocument, uploadVerificationDocument } from "./verificationDocumentApi";

const originalAdapter = httpClient.defaults.adapter;
beforeEach(() => {
  sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "synthetic-jwt");
  Object.defineProperty(URL, "createObjectURL", { configurable: true, writable: true, value: vi.fn(() => "blob:private-test") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, writable: true, value: vi.fn() });
});
afterEach(() => { httpClient.defaults.adapter = originalAdapter; sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY); vi.useRealTimers(); vi.restoreAllMocks(); });
function response(config: InternalAxiosRequestConfig, data: unknown, headers: Record<string, string> = {}) { return { config, data, headers, status: 200, statusText: "OK" }; }

describe("Private document transport through the real Axios interceptors (mock adapter)", () => {
  it("keeps multipart FormData intact despite the client's default JSON header and attaches JWT", async () => {
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => response(config, { success: true, data: { submitted: true, revision: 8 } }, { etag: '"8"' }));
    httpClient.defaults.adapter = adapter;
    const file = new File(["synthetic"], "document.pdf", { type: "application/pdf" });
    const saved = await uploadVerificationDocument(file, { submitted: false, revision: 7, etag: '"7"' });
    const config = adapter.mock.calls[0][0];
    expect(config.url).toBe(COMPANY_DOCUMENT_ENDPOINT); expect(config.data).toBeInstanceOf(FormData);
    expect([...config.data.keys()]).toEqual(["file"]); expect(config.data.get("file")).toBe(file);
    expect(config.headers.getContentType()).not.toBe("application/json");
    expect(config.headers.getContentType()).not.toBe("multipart/form-data");
    expect(config.headers.get("Authorization")).toBe("Bearer synthetic-jwt");
    expect(config.headers.get("If-Match")).toBe('"7"'); expect(saved).toEqual({ submitted: true, revision: 8, etag: '"8"' });
  });
  it.each([undefined, '"9"', 'W/"7"'])("rejects an absent or mismatched captured ETag %s", async (etag) => {
    httpClient.defaults.adapter = async config => response(config, { success: true, data: { submitted: false, revision: 7 } }, etag ? { etag } : {});
    await expect(getVerificationDocument(COMPANY_DOCUMENT_ENDPOINT)).rejects.toThrow(/phiên bản tài liệu/);
  });
  it("downloads as a JWT-authenticated Blob, uses a fixed filename and revokes the URL", async () => {
    vi.useFakeTimers();
    let filename = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { filename = this.download; });
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => response(config, new Blob(["synthetic"], { type: "image/jpeg" }), { "content-type": "image/jpeg", "content-disposition": "attachment; filename=PRIVATE-KEY.jpg" }));
    httpClient.defaults.adapter = adapter;
    await downloadVerificationDocument(COMPANY_DOCUMENT_ENDPOINT);
    expect(adapter.mock.calls[0][0].responseType).toBe("blob");
    expect(adapter.mock.calls[0][0].headers.get("Authorization")).toBe("Bearer synthetic-jwt");
    expect(filename).toBe("tai-lieu-xac-thuc.jpg");
    expect(document.querySelector('a[href^="blob:"]')).toBeNull();
    await vi.advanceTimersByTimeAsync(1000); expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:private-test");
  });
  it("does not download a JSON/error response disguised as a successful request", async () => {
    httpClient.defaults.adapter = async config => response(config, new Blob(["private error"], { type: "application/json" }), { "content-type": "application/json" });
    await expect(downloadVerificationDocument(COMPANY_DOCUMENT_ENDPOINT)).rejects.toThrow(/không hợp lệ/);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
