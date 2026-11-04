import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ScoreMeter } from "./ScoreMeter";

it("exposes the exact backend score without rescaling ranks or changing precision", () => {
  render(<ScoreMeter label="Match Score" tier="PRIMARY" value={0.612345} />);
  expect(screen.getByRole("meter", { name: "Match Score" })).toHaveAttribute("aria-valuenow", "0.612345");
});
it("labels FALLBACK as a separate skill score and preserves actual zero", () => {
  render(<ScoreMeter label="Skill Score" tier="FALLBACK" value={0} />);
  expect(screen.getByRole("meter", { name: "Skill Score" })).toHaveAttribute("data-tier", "FALLBACK");
  expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0");
});
it.each([null, undefined, NaN, Infinity, -0.1, 1.1])("does not invent a meter for unavailable or invalid score %s", value => {
  render(<ScoreMeter label="Điểm tổng thể" tier="FALLBACK" value={value} />);
  expect(screen.queryByRole("meter")).not.toBeInTheDocument();
});
