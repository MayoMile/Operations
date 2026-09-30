import { useRef, useState } from "react";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { uploadRateConfirmation } from "@/lib/api";

// Front door for the rate-confirmation intake pipeline. This replaces the
// old email-attachment trigger — dropping/picking a file here uploads it to
// Blob Storage and kicks off the same n8n OCR/extraction pipeline that used
// to run off an inbox check. OCR happens after this page hands off, so a
// successful upload only means processing has started, not that the load is
// in the database yet.

const ACCEPTED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

type Status = "idle" | "uploading" | "success" | "error";

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

function validate(file: File): string | null {
  if (!ACCEPTED_EXTENSIONS.includes(extensionOf(file.name))) {
    return "Unsupported file type. Upload a PDF, JPG, PNG, or WEBP file.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return "File is too large. The limit is 10 MB.";
  }
  return null;
}

export function UploadPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const validationError = validate(file);
    if (validationError) {
      setStatus("error");
      setMessage(validationError);
      setFileName(null);
      return;
    }

    setFileName(file.name);
    setStatus("uploading");
    setMessage(null);
    try {
      await uploadRateConfirmation(file);
      setStatus("success");
      setMessage("Uploaded — processing has started. It'll show up on Loads once OCR finishes.");
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  }

  const busy = status === "uploading";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Upload"
        subtitle="Upload a rate confirmation to kick off OCR and load extraction"
      />

      <Card className="max-w-xl">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${
            isDragOver
              ? "border-accent bg-accent-muted"
              : "border-border dark:border-dark-border"
          }`}
        >
          <p className="font-body text-sm text-ink-muted dark:text-dark-ink-muted">
            Drag a rate confirmation here, or
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="rounded-md bg-accent px-4 py-2 font-body text-sm font-semibold uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70"
          >
            {busy ? "Uploading…" : "Choose File"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(",")}
            onChange={handlePick}
            disabled={busy}
            className="hidden"
          />
          <p className="font-body text-xs text-ink-faint dark:text-dark-ink-muted">
            PDF, JPG, PNG, or WEBP · up to 10 MB
          </p>
        </div>

        {fileName && status !== "error" && (
          <p className="mt-3 font-body text-xs text-ink-muted dark:text-dark-ink-muted">
            {fileName}
          </p>
        )}

        {status === "success" && message && (
          <p className="mt-3 rounded-md bg-positive-muted p-3 font-body text-sm text-positive">
            {message}
          </p>
        )}
        {status === "error" && message && (
          <p className="mt-3 rounded-md bg-negative-muted p-3 font-body text-sm text-negative">
            {message}
          </p>
        )}
      </Card>
    </div>
  );
}
