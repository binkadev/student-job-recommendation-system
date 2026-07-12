import { UploadCloud } from "lucide-react";

interface FileUploaderProps {
  label: string;
  accept?: string;
  onFileSelect: (file: File) => void;
}

export function FileUploader({ label, accept, onFileSelect }: FileUploaderProps) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:bg-slate-100">
      <UploadCloud className="text-slate-500" />
      <span className="mt-2 text-sm font-medium text-slate-700">{label}</span>
      <span className="mt-1 text-xs text-slate-500">Kéo thả hoặc chọn tệp từ máy tính</span>
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelect(file);
        }}
      />
    </label>
  );
}
