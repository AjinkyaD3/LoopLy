"use client";

import { Upload } from "lucide-react";

interface BillPhotoInputProps {
  file: File | null;
  onFileSelect: (file: File | null, error: string | null) => void;
}

export const ALLOWED_BILL_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_BILL_BYTES = 5 * 1024 * 1024;

/**
 * Bill photo picker with client-side validation, reused from the original
 * VisitRequestButton design. Presentational only — the caller (JoinFlow) owns the actual
 * submission, since a visit request bundles customer + membership + VisitRequest creation
 * in one call and shouldn't be split across two independent submission paths.
 */
export default function BillPhotoInput({ file, onFileSelect }: BillPhotoInputProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;

    if (!selected) {
      onFileSelect(null, null);
      return;
    }

    if (!ALLOWED_BILL_TYPES.includes(selected.type)) {
      onFileSelect(null, "Only JPG, PNG, and WEBP images are accepted.");
      return;
    }

    if (selected.size > MAX_BILL_BYTES) {
      onFileSelect(null, "File must be under 5 MB.");
      return;
    }

    onFileSelect(selected, null);
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-slate-700 mb-1">Bill Photo</label>
      <label className="block">
        <span className="sr-only">Choose bill image</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
          onChange={handleChange}
        />
      </label>

      {file && (
        <p className="text-[11px] text-slate-500 flex items-center gap-1">
          <Upload className="w-3 h-3" />
          Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
        </p>
      )}

      <p className="text-[10px] text-slate-400">JPG, PNG or WEBP · Max 5 MB</p>
    </div>
  );
}
