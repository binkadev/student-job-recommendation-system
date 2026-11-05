import { lazy, type ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Link, Route, Routes } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { RouteContent } from "./RouteContent";

function mount(content: ReactNode) {
  return render(<MemoryRouter initialEntries={["/slow"]}><Routes><Route element={<><nav><Link to="/safe">Trang khác</Link></nav><RouteContent /></>}>
    <Route path="/slow" element={content} /><Route path="/safe" element={<main>Trang an toàn</main>} />
  </Route></Routes></MemoryRouter>);
}
it("keeps navigation while the route chunk loads, then replaces the loading main", async () => {
  let finish!: (module: { default: () => ReactNode }) => void;
  const Page = lazy(() => new Promise<{ default: () => ReactNode }>(resolve => { finish = resolve; }));
  mount(<Page />);
  expect(screen.getByRole("navigation")).toBeVisible(); expect(screen.getByRole("status")).toHaveTextContent("Đang tải trang");
  await act(async () => finish({ default: () => <main>Nội dung đã tải</main> }));
  expect(screen.getByRole("main")).toHaveTextContent("Nội dung đã tải"); expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
it("contains a failed chunk and permits navigation to another route", () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  function Failed(): ReactNode { throw new Error("Synthetic failed route chunk"); }
  try {
    mount(<Failed />); expect(screen.getByRole("alert")).toHaveTextContent("Không thể tải trang");
    expect(screen.getByRole("button", { name: "Tải lại trang" })).toBeVisible();
    fireEvent.click(screen.getByRole("link", { name: "Trang khác" }));
    expect(screen.getByRole("main")).toHaveTextContent("Trang an toàn"); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  } finally { log.mockRestore(); }
});
