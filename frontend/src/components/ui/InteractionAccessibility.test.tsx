import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";
import { Drawer } from "./Drawer";
import { Dropdown } from "./Dropdown";
import { FileUploader } from "./FileUploader";
import { Input } from "./Input";

function DialogExample() {
  const [open, setOpen] = useState(false);
  const [nested, setNested] = useState(false);
  return <>
    <button onClick={() => setOpen(true)}>Mở phân tích</button>
    <Modal open={open} title="Phân tích CV" onClose={() => setOpen(false)}>
      <input aria-label="Ghi chú" />
      <button onClick={() => setNested(true)}>Mở chi tiết</button>
      <Drawer open={nested} title="Chi tiết" onClose={() => setNested(false)}><button>Lưu</button></Drawer>
    </Modal>
  </>;
}

describe("dialog keyboard interaction", () => {
  it("traps Tab, closes with Escape, returns focus and restores body scrolling", async () => {
    const user = userEvent.setup();
    render(<DialogExample />);
    const trigger = screen.getByRole("button", { name: "Mở phân tích" });
    await user.click(trigger);
    const close = within(screen.getByRole("dialog", { name: "Phân tích CV" })).getByRole("button", { name: "Đóng" });
    expect(close).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Mở chi tiết" })).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("closes only the topmost dialog and keeps the parent scroll lock", async () => {
    const user = userEvent.setup();
    render(<DialogExample />);
    await user.click(screen.getByText("Mở phân tích"));
    await user.click(screen.getByText("Mở chi tiết"));
    const parent = screen.getByRole("dialog", { name: "Phân tích CV" });
    const child = screen.getByRole("dialog", { name: "Chi tiết" });
    expect(child.getAttribute("aria-labelledby")).not.toBe(parent.getAttribute("aria-labelledby"));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Chi tiết" })).not.toBeInTheDocument();
    expect(parent).toBeInTheDocument();
    expect(screen.getByText("Mở chi tiết")).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    await user.keyboard("{Escape}");
    expect(document.body.style.overflow).toBe("");
  });
});

describe("action menu", () => {
  function Example({ action }: { action: () => void }) {
    const [open, setOpen] = useState(false);
    return <><Dropdown open={open} onOpenChange={setOpen} trigger="Thao tác" items={[{ label: "Xem", onClick: action }, { label: "Ẩn", onClick: action }]} /><button>Ngoài menu</button></>;
  }
  it("supports arrow keys, Home, End, Escape and selection", async () => {
    const action = vi.fn();
    const user = userEvent.setup();
    render(<Example action={action} />);
    const trigger = screen.getByRole("button", { name: "Thao tác" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Xem" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByRole("menuitem", { name: "Ẩn" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Xem" })).toHaveFocus();
    await user.keyboard("{ArrowUp}{Home}{Escape}");
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    await user.keyboard("{Enter}");
    expect(action).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });
  it("dismisses on outside click and allows Tab to leave", async () => {
    const user = userEvent.setup();
    render(<Example action={vi.fn()} />);
    await user.click(screen.getByText("Thao tác"));
    await user.tab();
    expect(screen.getByText("Ngoài menu")).toHaveFocus();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await user.click(screen.getByText("Thao tác"));
    await user.click(screen.getByText("Ngoài menu"));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("CV uploader and form feedback", () => {
  it("passes both chosen and dropped files to the existing validation callback", async () => {
    const onFileSelect = vi.fn();
    const user = userEvent.setup();
    render(<FileUploader label="Chọn CV" accept=".pdf,.docx" onFileSelect={onFileSelect} />);
    const file = new File(["CV"], "student.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText(/Chọn CV/), file);
    expect(onFileSelect).toHaveBeenLastCalledWith(file);
    fireEvent.drop(screen.getByText("Chọn CV").closest("label")!, { dataTransfer: { files: [file] } });
    expect(onFileSelect).toHaveBeenCalledTimes(2);
  });
  it("does not accept a drop while uploading is disabled", () => {
    const onFileSelect = vi.fn();
    render(<FileUploader label="Chọn CV" disabled onFileSelect={onFileSelect} />);
    fireEvent.drop(screen.getByText("Chọn CV").closest("label")!, { dataTransfer: { files: [new File(["CV"], "cv.pdf")] } });
    expect(onFileSelect).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Chọn CV/)).toBeDisabled();
  });
  it("links errors and help text without duplicate IDs for matching field names", () => {
    render(<><p id="email-help">Dùng email cá nhân</p><Input label="Email đăng ký" name="email" aria-describedby="email-help" error="Email không hợp lệ" /><Input label="Email liên hệ" name="email" /></>);
    const invalid = screen.getByLabelText("Email đăng ký");
    expect(invalid).toHaveAttribute("aria-invalid", "true");
    expect(invalid).toHaveAccessibleDescription("Dùng email cá nhân Email không hợp lệ");
    expect(invalid.id).not.toBe(screen.getByLabelText("Email liên hệ").id);
  });
});
