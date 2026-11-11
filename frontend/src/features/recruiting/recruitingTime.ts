// LocalDateTime is a wall-clock value, not an instant. Never append Z or call toISOString().
export function localStamp(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
export function formatWallTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]} (giờ máy chủ)` : "Chưa xác nhận thời gian";
}
function wallParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?$/.exec(value);
  return match ? match.slice(1).map(Number) : null;
}
const leap = (year: number) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
export function validWallTime(value: string) {
  const parts = wallParts(value); if (!parts) return false;
  const [year, month, day, hour, minute, second] = parts;
  const days = [31, leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1]
    && hour <= 23 && minute <= 59 && (second || 0) <= 59;
}
// Gregorian calendar-field arithmetic only: no parsing as a browser/UTC instant, including across DST.
function wallSeconds(value: string) {
  const [year, month, day, hour, minute, second] = wallParts(value)!;
  const prior = year - 1;
  const monthDays = [31, leap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const days = 365 * prior + Math.floor(prior / 4) - Math.floor(prior / 100) + Math.floor(prior / 400)
    + monthDays.slice(0, month - 1).reduce((a, b) => a + b, 0) + day - 1;
  return days * 86400 + hour * 3600 + minute * 60 + (second || 0);
}
export function appearsFinished(start: string, duration: number, now = new Date()) {
  if (!validWallTime(start) || !Number.isInteger(duration) || duration < 15 || duration > 480) return false;
  return wallSeconds(start) + duration * 60 <= wallSeconds(localStamp(now));
}
export function safeMeetingUrl(value: string) {
  const authority = /^https?:\/\/([^/?#]+)(?:[/?#]|$)/i.exec(value)?.[1];
  if (!authority || authority.includes("@") || /\s/u.test(value) || value.includes("\\") || /[^\x21-\x7e]/.test(authority)) return false;
  try {
    const url = new URL(value);
    return /^https?:$/i.test(url.protocol) && Boolean(url.hostname) && !url.hostname.includes("_") && (!url.port || Number(url.port) >= 1) && !url.username && !url.password;
  } catch { return false; }
}
export const timeGuidance = "Nhập và đọc thời gian theo giờ máy chủ, không quy đổi UTC. Gợi ý thời điểm thao tác dùng đồng hồ thiết bị; hệ thống kiểm tra chính thức khi gửi.";
