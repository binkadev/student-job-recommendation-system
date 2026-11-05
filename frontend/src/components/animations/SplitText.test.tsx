import { StrictMode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SplitText from "./SplitText";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  context: vi.fn(),
  contextRevert: vi.fn(),
  splitRevert: vi.fn(),
  split: vi.fn(),
  registerPlugin: vi.fn(),
}));

vi.mock("gsap", () => ({ gsap: {
  from: mocks.from,
  registerPlugin: mocks.registerPlugin,
  context: mocks.context,
} }));
vi.mock("gsap/SplitText", () => ({
  SplitText: class {
    words: Element[];
    revert = mocks.splitRevert;
    constructor(element: Element) {
      mocks.split(element);
      this.words = [element];
    }
  },
}));

describe("Hero SplitText", () => {
  let motion: MediaQueryList;

  beforeEach(() => {
    vi.resetAllMocks();
    motion = Object.assign(new EventTarget(), { matches: false }) as unknown as MediaQueryList;
    vi.stubGlobal("matchMedia", vi.fn(() => motion));
    vi.stubGlobal("IntersectionObserver", undefined);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 100, bottom: 200, left: 0, right: 300, width: 300, height: 100,
      x: 0, y: 100, toJSON: () => ({}),
    });
    mocks.context.mockImplementation((setup: () => void) => {
      setup();
      return { revert: mocks.contextRevert };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the semantic heading visible with reduced motion and never starts GSAP", async () => {
    Object.assign(motion, { matches: true });
    render(<SplitText text="Bước tiếp theo cho sự nghiệp IT của bạn" className="text-3xl" />);
    expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
    expect(screen.getByRole("heading")).toHaveClass("text-3xl");
    await act(async () => {});
    expect(mocks.registerPlugin).not.toHaveBeenCalled();
  });

  it("animates once across rerenders and reverts on unmount in StrictMode", async () => {
    const view = render(<StrictMode><SplitText text="Hero title" /></StrictMode>);
    await waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(1));
    view.rerender(<StrictMode><SplitText text="Hero title" /></StrictMode>);
    expect(mocks.from).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(mocks.contextRevert).toHaveBeenCalledTimes(1);
    expect(mocks.splitRevert).toHaveBeenCalledTimes(1);
  });

  it("immediately restores text when reduced motion is enabled during playback", async () => {
    const view = render(<SplitText text="Hero title" />);
    await waitFor(() => expect(mocks.from).toHaveBeenCalledTimes(1));
    act(() => {
      Object.assign(motion, { matches: true });
      motion.dispatchEvent(new Event("change"));
    });
    expect(mocks.contextRevert).toHaveBeenCalledTimes(1);
    expect(mocks.splitRevert).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading")).toBeVisible();
    view.unmount();
    expect(mocks.contextRevert).toHaveBeenCalledTimes(1);
  });

  it("cancels pending work when unmounted before fonts finish loading", async () => {
    let resolveFonts!: () => void;
    const ready = new Promise<void>((resolve) => { resolveFonts = resolve; });
    Object.defineProperty(document, "fonts", { configurable: true, value: { ready } });
    const view = render(<SplitText text="Hero title" />);
    view.unmount();
    await act(async () => { resolveFonts(); await ready; });
    expect(mocks.from).not.toHaveBeenCalled();
    Reflect.deleteProperty(document, "fonts");
  });
});
