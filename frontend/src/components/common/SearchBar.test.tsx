import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { SearchBar } from "./SearchBar";

function Location() {
  const location = useLocation();
  return <output aria-label="Đường dẫn">{location.pathname}{location.search}</output>;
}

describe("public job search", () => {
  it("submits a trimmed and encoded keyword to the existing jobs route", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><SearchBar /><Location /></MemoryRouter>);
    await user.type(screen.getByRole("searchbox", { name: "Từ khóa tìm việc" }), "  C++ developer  ");
    await user.click(screen.getByRole("button", { name: "Tìm việc" }));
    expect(screen.getByLabelText("Đường dẫn")).toHaveTextContent("/jobs?keyword=C%2B%2B+developer");
  });
  it("supports Enter and opens all jobs for an empty keyword", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><SearchBar /><Location /></MemoryRouter>);
    await user.click(screen.getByRole("searchbox"));
    await user.keyboard("{Enter}");
    expect(screen.getByLabelText("Đường dẫn")).toHaveTextContent(/^\/jobs$/);
  });
});
