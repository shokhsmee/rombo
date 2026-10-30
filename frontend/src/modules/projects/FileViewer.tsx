import { ChevronLeft, ChevronRight, Download, ExternalLink, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Spinner } from "@/components/ui";
import { notifyError } from "@/lib/notify";

import { downloadProjectFile, mimeOf, projectFileUrl, type ProjectFile } from "./api";

/** Full-screen viewer for a Loyiha's drawings: images and PDF, with ‹ › between the viewable files. */
export function FileViewer({ projectId, files, start, onClose }: {
  projectId: number; files: ProjectFile[]; start: number; onClose: () => void;
}) {
  const [i, setI] = useState(start);
  const [url, setUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const f = files[i];
  const close = useRef(onClose);
  close.current = onClose;
  const fileId = f?.id;
  const pdf = f && mimeOf(f.name) === "application/pdf";

  useEffect(() => {
    const file = files.find((x) => x.id === fileId);
    if (!file) return;
    let alive = true;
    let made: string | null = null;
    setUrl(null);
    setZoom(false);
    projectFileUrl(projectId, file)
      .then((u) => { made = u; if (alive) setUrl(u); else URL.revokeObjectURL(u); })
      .catch((e) => { notifyError(e); close.current(); });
    return () => { alive = false; if (made) URL.revokeObjectURL(made); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, fileId]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      else if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, files.length - 1));
      else if (e.key === "ArrowLeft") setI((x) => Math.max(x - 1, 0));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [files.length]);

  if (!f) return null;
  const btn = "press grid size-9 place-items-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-30";

  return createPortal(
    <div className="anim-fade fixed inset-0 z-[70] flex flex-col bg-scrim/95 backdrop-blur-sm" onMouseDown={onClose}>
      <header className="flex items-center gap-2 px-4 py-2.5 text-white" onMouseDown={(e) => e.stopPropagation()}>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{f.name}</span>
        {files.length > 1 && <span className="text-xs tabular text-white/60">{i + 1} / {files.length}</span>}
        <button type="button" className={btn} title="Yangi oynada ochish" disabled={!url} onClick={() => url && window.open(url, "_blank")}>
          <ExternalLink className="size-4" />
        </button>
        <button type="button" className={btn} title="Yuklab olish" onClick={() => downloadProjectFile(projectId, f).catch(notifyError)}>
          <Download className="size-4" />
        </button>
        <button type="button" className={btn} title="Yopish (Esc)" onClick={onClose}><X className="size-5" /></button>
      </header>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-4">
        {files.length > 1 && (
          <button type="button" className={`${btn} absolute left-3`} disabled={i === 0} title="Oldingi (←)"
            onMouseDown={(e) => e.stopPropagation()} onClick={() => setI(i - 1)}><ChevronLeft className="size-6" /></button>
        )}
        {!url ? <Spinner className="size-6 text-white" /> : pdf ? (
          <iframe title={f.name} src={url} className="h-full w-full max-w-5xl rounded-lg bg-white" onMouseDown={(e) => e.stopPropagation()} />
        ) : (
          <div className={`h-full w-full ${zoom ? "overflow-auto" : "flex items-center justify-center"}`} onMouseDown={(e) => e.stopPropagation()}>
            <img src={url} alt={f.name} onClick={() => setZoom(!zoom)}
              className={zoom ? "max-w-none cursor-zoom-out" : "max-h-full max-w-full cursor-zoom-in rounded-lg object-contain shadow-2xl"} />
          </div>
        )}
        {files.length > 1 && (
          <button type="button" className={`${btn} absolute right-3`} disabled={i === files.length - 1} title="Keyingi (→)"
            onMouseDown={(e) => e.stopPropagation()} onClick={() => setI(i + 1)}><ChevronRight className="size-6" /></button>
        )}
      </div>
    </div>,
    document.body,
  );
}
