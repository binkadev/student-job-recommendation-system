import { useState } from "react";
import { restoreSampleData } from "../../utils/localStorage";
import { withMockDelay } from "../../utils/mockDelay";
import { useToast } from "../../hooks/useToast";
import { ConfirmDialog } from "./ConfirmDialog";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

export function RestoreMockDataButton() {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRestore() {
    setLoading(true);
    restoreSampleData();
    await withMockDelay(true);
    setLoading(false);
    setOpen(false);
    showToast({ type: "success", title: "Đã khôi phục dữ liệu mẫu" });
  }

  return (
    <>
      <Button type="button" variant="secondary" loading={loading} onClick={() => setOpen(true)}>
        Khôi phục dữ liệu mẫu
      </Button>
      <Modal open={open} title="Khôi phục dữ liệu mẫu" onClose={() => setOpen(false)}>
        <ConfirmDialog
          danger
          title="Xóa dữ liệu mock đã thay đổi?"
          description="Hành động này sẽ xóa dữ liệu mock trong localStorage. Dữ liệu ban đầu sẽ được tạo lại khi bạn mở lại các danh sách."
          confirmLabel="Khôi phục"
          onCancel={() => setOpen(false)}
          onConfirm={() => void handleRestore()}
        />
      </Modal>
    </>
  );
}
