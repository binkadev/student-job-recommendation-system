import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { StatusDistribution, JobPerformance } from "./AnalyticsVisuals";
import { calendarLabel } from "./analyticsCalendar";

it("exposes actual counts with Vietnamese status labels independent of color", () => {
  render(<StatusDistribution label="Hồ sơ theo trạng thái" items={[
    { key: "PENDING", label: "Chờ xử lý", count: 13, color: "--chart-pending" },
    { key: "WITHDRAWN", label: "Ứng viên rút đơn", count: 0, color: "--chart-withdrawn" },
  ]} />);
  const legend = screen.getByRole("list", { name: "Hồ sơ theo trạng thái" });
  expect(within(legend).getAllByRole("listitem")[0]).toHaveTextContent("Chờ xử lý13");
  expect(within(legend).getAllByRole("listitem")[1]).toHaveTextContent("Ứng viên rút đơn0");
  expect(screen.queryByText(/chưa có hồ sơ/i)).not.toBeInTheDocument();
});

it("keeps a zero distribution empty, with an accurate recovery message", () => {
  render(<StatusDistribution label="Hồ sơ" items={[{ key: "ACCEPTED", label: "Đã nhận", count: 0, color: "--chart-accepted" }]} />);
  expect(screen.getByText(/Chưa có hồ sơ trong phạm vi này/)).toBeVisible();
  expect(screen.getByTestId("status-ACCEPTED")).toHaveTextContent("0");
});

it("keeps full long Vietnamese job names and persisted counts available", () => {
  const title = "Thực tập sinh công nghệ thông tin phụ trách hệ thống tuyển dụng và phân tích dữ liệu doanh nghiệp";
  render(<MemoryRouter><JobPerformance rows={[{ jobId: 91, jobTitle: title, applications: 13, accepted: 2, acceptedRate: 15.38 }]} /></MemoryRouter>);
  expect(screen.getByRole("link", { name: title })).toHaveAttribute("href", "/recruiter/jobs/91");
  expect(screen.getByText("13 đơn")).toBeVisible();
  expect(screen.getByText(/2 được chấp nhận · 15.38%/)).toBeVisible();
});

it("does not turn a null acceptance rate into zero percent", () => {
  render(<MemoryRouter><JobPerformance rows={[{ jobId: 2, jobTitle: "Tin mới", applications: 0, accepted: 0, acceptedRate: null }]} /></MemoryRouter>);
  expect(screen.getByText(/Chưa có tỷ lệ/)).toBeVisible();
  expect(screen.queryByText(/0.00%/)).not.toBeInTheDocument();
});

it.each([["2026-11-05", "05/11"], ["2026-11", "11/2026"], ["2026-01-01", "01/01"]])("formats stored calendar %s without timezone conversion", (value, expected) => {
  expect(calendarLabel(value)).toBe(expected);
});
