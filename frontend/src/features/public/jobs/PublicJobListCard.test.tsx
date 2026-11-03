import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { PublicJobListCard } from "./PublicJobListCard";
import type { PublicJobListItem } from "./jobsListTypes";

it("distinguishes an unverified disabled apply action from an existing application", () => {
  const job: PublicJobListItem = {
    id: "11", logo: "E2E", title: "Backend Intern", companyName: "Synthetic Company", salary: "Thỏa thuận", salaryMax: 0,
    location: "Hồ Chí Minh", industry: "Software", experienceYears: null, experienceLabel: null, level: null,
    jobType: "Thực tập", workMode: "Hybrid", skills: [], postedAt: "2026-11-03", deadline: "2027-06-30", applicants: 0, status: "published", matchScore: 0,
  };
  render(<MemoryRouter><PublicJobListCard job={job} saved={false} applied={false} applyDisabled applyLabel="Chưa xác minh ứng tuyển" onApply={vi.fn()} onToggleSave={vi.fn()} /></MemoryRouter>);
  expect(screen.getByRole("button", { name: "Chưa xác minh ứng tuyển" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Đã ứng tuyển" })).not.toBeInTheDocument();
});
