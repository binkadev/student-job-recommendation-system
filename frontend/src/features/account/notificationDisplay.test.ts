import { describe, expect, it } from "vitest";
import { notificationMessage, notificationPath, notificationTitle, type Notification } from "./notificationsApi";

const base: Notification = {
  id: 1, type: "SYSTEM", title: "t", message: "m", referenceType: null, referenceId: null,
  isRead: false, readAt: null, createdAt: "2026-11-01T10:00:00",
};

describe("W1-C automatic notification display", () => {
  it("localises every Backend title and message template", () => {
    expect(notificationTitle("New application received")).toBe("Có đơn ứng tuyển mới");
    expect(notificationTitle("Application withdrawn")).toBe("Ứng viên đã rút đơn ứng tuyển");
    expect(notificationTitle("Job approved")).toBe("Tin tuyển dụng đã được duyệt");
    expect(notificationTitle("Job rejected")).toBe("Tin tuyển dụng bị từ chối");
    expect(notificationTitle("Company verified")).toBe("Công ty đã được xác thực");
    expect(notificationTitle("Company blocked")).toBe("Công ty đã bị khóa");
    expect(notificationTitle("Job recommendations are ready")).toBe("Gợi ý việc làm đã sẵn sàng");
    expect(notificationMessage("An Nguyen applied for Java Intern.")).toBe("An Nguyen đã ứng tuyển vào Java Intern.");
    expect(notificationMessage("An Nguyen withdrew the application for Java Intern.")).toBe("An Nguyen đã rút đơn ứng tuyển vào Java Intern.");
    expect(notificationMessage('Your job "Java Intern" was approved and is now active.')).toBe('Tin "Java Intern" đã được duyệt và đang hiển thị.');
    expect(notificationMessage('Your job "Java Intern" was rejected by an administrator.')).toBe('Tin "Java Intern" đã bị quản trị viên từ chối.');
    expect(notificationMessage("Your company account has been blocked by an administrator.")).toContain("bị quản trị viên khóa");
    expect(notificationMessage("Your recommendation run finished with 1 matching job.")).toBe("Lượt gợi ý đã hoàn tất với 1 việc làm phù hợp.");
    expect(notificationMessage("Your recommendation run finished with 7 matching jobs.")).toBe("Lượt gợi ý đã hoàn tất với 7 việc làm phù hợp.");
    expect(notificationMessage("Your application for Java Intern has been updated to REVIEWED.")).toContain("Đã xem xét");
  });

  it("shows unknown text unchanged and never interprets it as markup", () => {
    expect(notificationTitle("<b>Other</b>")).toBe("<b>Other</b>");
    expect(notificationMessage("Anything else")).toBe("Anything else");
  });

  it("navigates only to routes the role can open and falls back safely", () => {
    expect(notificationPath({ ...base, referenceType: "APPLICATION", referenceId: 9 }, "recruiter")).toBe("/recruiter/candidates/9");
    expect(notificationPath({ ...base, referenceType: "JOB", referenceId: 4 }, "recruiter")).toBe("/recruiter/jobs/4");
    expect(notificationPath({ ...base, referenceType: "RECOMMENDATION_RUN", referenceId: 3 }, "candidate")).toBe("/candidate/jobs/recommended");
    expect(notificationPath({ ...base, referenceType: "RECOMMENDATION_RUN", referenceId: 3 }, "recruiter")).toBe("/recruiter/settings/notifications");
    expect(notificationPath(base, "recruiter")).toBe("/recruiter/settings/notifications");
    expect(notificationPath({ ...base, referenceType: "COMPANY", referenceId: 3 }, "candidate")).toBe("/candidate/notifications");
  });
});
