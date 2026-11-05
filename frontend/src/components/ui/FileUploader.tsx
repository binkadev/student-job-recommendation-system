import { UploadCloud } from "lucide-react";
import { useId, useState } from "react";

interface FileUploaderProps {
  label: string;
  accept?: string;
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export function FileUploader({ label, accept, onFileSelect, disabled = false }: FileUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const helpId = useId();
  return (
    <label
      onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file && !disabled) onFileSelect(file);
      }}
      className={`flex min-h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100 ${disabled ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60" : dragging ? "cursor-copy border-brand-500 bg-brand-50" : "cursor-pointer border-slate-300 bg-slate-50 hover:border-brand-400 hover:bg-brand-50/50"}`}
    >
      <span className="mb-2 rounded-2xl border border-brand-100 bg-white p-3 text-brand-600"><UploadCloud aria-hidden="true" size={28} /></span>
      <span className="mt-2 text-sm font-medium text-slate-700">{label}</span>
      <span id={helpId} className="mt-2 text-xs leading-5 text-slate-500">Kéo thả hoặc chọn tệp từ máy tính</span>
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        aria-describedby={helpId}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelect(file);
          event.target.value = "";
        }}
      />
    </label>
  );
}
