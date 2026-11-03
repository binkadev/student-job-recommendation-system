import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "../../../pages/public/HomePage";
import { httpClient } from "../../../services/api/httpClient";
import { getHomeData } from "./homeService";

vi.mock("../../../services/api/httpClient", () => ({ httpClient: { get: vi.fn() } }));
vi.mock("../../../hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock("../../../hooks/useSavedJobs", () => ({ useSavedJobs: () => ({ isSaved: () => false, toggleSavedJob: vi.fn() }) }));
vi.mock("../../../hooks/useToast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("../../../components/animations/SplitText", () => ({ default: ({ text }: { text: string }) => <h1>{text}</h1> }));

const envelope = (data: unknown) => ({ data: { success: true, data } });
let statistics: unknown;
let statisticsError = false;
beforeEach(() => {
  vi.resetAllMocks(); statisticsError = false;
  statistics = { totalJobs: 0, totalCompanies: 0, totalStudents: 0, totalApplications: 0 };
  vi.mocked(httpClient.get).mockImplementation(async (url) => {
    if (url === "/public/statistics") {
      if (statisticsError) throw new Error("Statistics unavailable");
      return envelope(statistics);
    }
    return envelope({ items: [], totalItems: 77, page: 1, size: 6, totalPages: 13 });
  });
});

describe("public statistics data states", () => {
  it("shows an actual zero only when returned by the statistics API", async () => {
    expect((await getHomeData()).statistics.map((item) => item.value)).toEqual(["0", "0", "0", "0"]);
  });
  it("does not convert request failures to zeros or totals from another query", async () => {
    statisticsError = true;
    const home = await getHomeData();
    expect(home.statisticsUnavailable).toBe(true);
    expect(home.statistics.map((item) => item.value)).toEqual([null, null, null, null]);
  });
  it("marks missing, negative, nonfinite and nonnumeric counts as unknown", async () => {
    statistics = { totalJobs: -1, totalCompanies: "12", totalStudents: Number.NaN };
    const home = await getHomeData();
    expect(home.statisticsUnavailable).toBe(false);
    expect(home.statistics.map((item) => item.value)).toEqual([null, null, null, null]);
    expect(home.statistics[0].unavailableReason).toBe("Chưa có số liệu hợp lệ");
  });
  it("offers retry for a statistics failure while preserving successful listing results", async () => {
    statisticsError = true;
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(await screen.findByRole("button", { name: "Thử lại thống kê" })).toBeEnabled();
    expect(screen.queryAllByText("0")).toHaveLength(0);
    expect(screen.getAllByText("Không tải được số liệu")).toHaveLength(4);
  });
  it("does not display a successful empty state when a required API fails", async () => {
    vi.mocked(httpClient.get).mockRejectedValue(new Error("Offline"));
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    await screen.findByRole("button", { name: "Thử lại" });
    expect(screen.queryByText("Chưa có việc làm đang tuyển.")).not.toBeInTheDocument();
    expect(screen.queryByText("Chưa có công ty nổi bật để hiển thị.")).not.toBeInTheDocument();
    expect(screen.queryAllByText("0")).toHaveLength(0);
  });
  it("shows loading feedback rather than numerical placeholders", () => {
    vi.mocked(httpClient.get).mockReturnValue(new Promise(() => undefined));
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    expect(screen.getAllByText("Đang tải số liệu…")).toHaveLength(4);
    expect(screen.queryAllByText("0")).toHaveLength(0);
  });
});
