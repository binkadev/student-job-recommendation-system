import { describe, expect, it } from "vitest";
import { isProfileHttpUrl, profileExtensionsSchema } from "./candidateProfileExtensions";

const certificate = { id: "local", name: "Certificate", issuer: "", issuedAt: "", expiresAt: "", code: "", url: "" };
const language = { id: "local", name: "English", level: "B2" };
const empty = { githubUrl: "", linkedinUrl: "", portfolioUrl: "", certificates: [], languages: [] };

describe("W2-A1 profile extension validation", () => {
  it.each(["", "  ", "http://example.test", "https://example.test/path?q=a%20b#fragment", "HTTPS://example.test", "https://[::1]:8080/path"])("accepts optional or HTTP(S) URL %s", (url) => {
    expect(isProfileHttpUrl(url)).toBe(true);
  });
  it.each(["javascript:alert(1)", "ftp://example.test", "//example.test", "https:///example.test", "https://user:pass@example.test", "https://@example.test", "https://example.test/a b", "https://example.test/%zz", "https://example.test\\path", "https://bad_host.test", "https://éxample.test", "https://-bad.test"])("rejects URL outside Backend rules %s", (url) => {
    expect(isProfileHttpUrl(url)).toBe(false);
  });
  it.each([ ["name", 255], ["issuer", 255], ["issuedAt", 100], ["expiresAt", 100], ["code", 150] ] as const)("enforces certificate %s limit %i", (field, limit) => {
    expect(profileExtensionsSchema.safeParse({ ...empty, certificates: [{ ...certificate, [field]: "a".repeat(limit) }] }).success).toBe(true);
    expect(profileExtensionsSchema.safeParse({ ...empty, certificates: [{ ...certificate, [field]: "a".repeat(limit + 1) }] }).success).toBe(false);
  });
  it.each(["name", "level"])("enforces required language %s and 100 character limit", (field) => {
    for (const value of ["", "   ", "a".repeat(101)]) expect(profileExtensionsSchema.safeParse({ ...empty, languages: [{ ...language, [field]: value }] }).success).toBe(false);
    expect(profileExtensionsSchema.safeParse({ ...empty, languages: [{ ...language, [field]: "a".repeat(100) }] }).success).toBe(true);
  });
  it("requires certificate names and allows 50 items per list", () => {
    expect(profileExtensionsSchema.safeParse({ ...empty, certificates: [{ ...certificate, name: " " }] }).success).toBe(false);
    expect(profileExtensionsSchema.safeParse({ ...empty, certificates: Array(50).fill(certificate), languages: Array(50).fill(language) }).success).toBe(true);
    expect(profileExtensionsSchema.safeParse({ ...empty, certificates: Array(51).fill(certificate) }).success).toBe(false);
    expect(profileExtensionsSchema.safeParse({ ...empty, languages: Array(51).fill(language) }).success).toBe(false);
  });
  it("enforces 500 characters on all URLs including certificates", () => {
    const url = "https://example.test/";
    const valid = url + "a".repeat(500 - url.length);
    for (const field of ["githubUrl", "linkedinUrl", "portfolioUrl"]) {
      expect(profileExtensionsSchema.safeParse({ ...empty, [field]: valid }).success).toBe(true);
      expect(profileExtensionsSchema.safeParse({ ...empty, [field]: valid + "a" }).success).toBe(false);
    }
    expect(profileExtensionsSchema.safeParse({ ...empty, certificates: [{ ...certificate, url: valid }] }).success).toBe(true);
    expect(profileExtensionsSchema.safeParse({ ...empty, certificates: [{ ...certificate, url: valid + "a" }] }).success).toBe(false);
  });
});
