import { Download, Eye, FileImage, FileText, Paperclip, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { ConfirmDialog, IconButton, Spinner } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { notifyError, notifyOk } from "@/lib/notify";

import { downloadProjectFile, useProjectFiles, viewable, type ProjectFile } from "./api";
import { FileViewer } from "./FileViewer";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.dwg,.dxf,.zip";

const size = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

function Icon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="size-4 text-bad" />;
  if (["png", "jpg", "jpeg", "webp"].includes(ext ?? "")) return <FileImage className="size-4 text-info" />;
  return <Paperclip className="size-4 text-muted" />;
}

/** The card's "Чертеж": several files, drop or pick to upload; images and PDFs open in the viewer, the rest download. */
export function Drawings({ projectId, files, canEdit }: { projectId: number; files: ProjectFile[]; canEdit: boolean }) {
  const { upload, remove } = useProjectFiles(projectId);
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [del, setDel] = useState<ProjectFile | null>(null);
  const shown = files.filter((f) => viewable(f.name));
  const [view, setView] = useState<number | null>(null);
  const open = (f: ProjectFile) => {
    const at = shown.findIndex((x) => x.id === f.id);
    if (at >= 0) setView(at);
    else downloadProjectFile(projectId, f).catch(notifyError);
  };

  const send = (list: FileList | null) => {
    Array.from(list ?? []).forEach((f) =>
      upload.mutate(f, { onSuccess: () => notifyOk(`Yuklandi: ${f.name}`), onError: notifyError }));
  };

  return (
    <div className="grid gap-2">
      {files.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-line">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-0">
              <Icon name={f.name} />
              <button type="button" onClick={() => open(f)} title={viewable(f.name) ? "Ko'rish" : "Yuklab olish"}
                className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-accent-ink hover:underline">
                {f.name}
              </button>
              <span className="hidden text-xs text-muted sm:inline">{f.uploaded_by} · {fmtDateTime(f.created_at)}</span>
              <span className="text-xs tabular text-muted">{size(f.size)}</span>
              {viewable(f.name) && (
                <IconButton label="Ko'rish" onClick={() => open(f)}><Eye className="size-4" /></IconButton>
              )}
              <IconButton label="Yuklab olish" onClick={() => downloadProjectFile(projectId, f).catch(notifyError)}>
                <Download className="size-4" />
              </IconButton>
              {canEdit && (
                <IconButton label="O'chirish" className="hover:text-bad" onClick={() => setDel(f)}>
                  <Trash2 className="size-4" />
                </IconButton>
              )}
            </div>
          ))}
        </div>
      )}
      {canEdit && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); send(e.dataTransfer.files); }}
          className={`flex items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-4 text-sm transition-colors ${
            over ? "border-accent bg-accent-soft text-accent-ink" : "border-line-strong text-muted hover:border-accent hover:text-ink"}`}
        >
          {upload.isPending ? <Spinner /> : <Upload className="size-4" />}
          Chizmani tashlang yoki tanlang
          <span className="text-xs text-faint">PDF, rasm, DWG, DXF, ZIP · 25 MB gacha</span>
        </button>
      )}
      {!canEdit && files.length === 0 && <p className="text-sm text-muted">Chizma yuklanmagan</p>}
      <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { send(e.target.files); e.target.value = ""; }} />
      {view !== null && <FileViewer projectId={projectId} files={shown} start={view} onClose={() => setView(null)} />}
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} danger confirmLabel="O'chirish" busy={remove.isPending}
        title="Chizmani o'chirish" text={`«${del?.name}» o'chiriladi. Bu tarixda qayd etiladi.`}
        onConfirm={() => del && remove.mutate(del.id, { onSuccess: () => setDel(null), onError: notifyError })} />
    </div>
  );
}
