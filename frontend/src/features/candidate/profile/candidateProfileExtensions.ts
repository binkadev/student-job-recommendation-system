import { z } from "zod";

/** Mirrors W2-A1 ValidHttpUrl: absolute HTTP(S), host, no user info or whitespace. */
export function isProfileHttpUrl(value: string) {
  const text = value.trim();
  if (!text) return true;
  if (!/^https?:\/\//i.test(text) || /[\s\\]/u.test(text) || /%(?![a-f\d]{2})/i.test(text) || /[<>"{}|^`]/.test(text)) return false;
  const authority = text.replace(/^https?:\/\//i, "").split(/[/?#]/)[0];
  if (!authority || authority.includes("@")) return false;
  try {
    const url = new URL(text);
    // Java URI.getHost() accepts ASCII DNS hosts and bracketed IP literals, not IDNs or underscores.
    if (!url.hostname || /[^a-z\d.:[\]-]/i.test(authority)) return false;
    if (!authority.startsWith("[")) {
      const host = authority.split(":")[0];
      if (host.split(".").some((label, index, labels) => !(label === "" && index === labels.length - 1) && !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label))) return false;
    }
    return !url.username && !url.password;
  } catch { return false; }
}
export const profileUrlSchema = z.string().max(500, "URL tối đa 500 ký tự.").refine(isProfileHttpUrl, "Nhập URL HTTP/HTTPS hợp lệ, không có thông tin đăng nhập hoặc khoảng trắng.");
const text = (max: number) => z.string().max(max, `Tối đa ${max} ký tự.`);
const required = (max: number) => text(max).refine((value) => Boolean(value.trim()), "Vui lòng nhập thông tin.");
export const profileExtensionsSchema = z.object({
  githubUrl: profileUrlSchema, linkedinUrl: profileUrlSchema, portfolioUrl: profileUrlSchema,
  certificates: z.array(z.object({ id: z.string(), name: required(255), issuer: text(255), issuedAt: text(100), expiresAt: text(100), code: text(150), url: profileUrlSchema })).max(50, "Tối đa 50 chứng chỉ."),
  languages: z.array(z.object({ id: z.string(), name: required(100), level: required(100) })).max(50, "Tối đa 50 ngoại ngữ."),
});
