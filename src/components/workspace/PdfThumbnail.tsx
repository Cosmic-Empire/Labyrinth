"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, LoaderCircle } from "lucide-react";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";

type Props = { url: string; name: string };

export function PdfThumbnail({ url, name }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | undefined;
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (cancelled) return;
        setState("loading");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        loadingTask = pdfjs.getDocument({ url, disableAutoFetch: true });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        const page = await pdf.getPage(1);
        if (cancelled) return;
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d", { alpha: false });
        if (!canvas || !context) throw new Error("PDF canvas is unavailable.");

        const natural = page.getViewport({ scale: 1 });
        const scale = Math.min(1.4, 280 / natural.width, 340 / natural.height);
        const viewport = page.getViewport({ scale });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.round(viewport.width * ratio));
        canvas.height = Math.max(1, Math.round(viewport.height * ratio));
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        await page.render({ canvas, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0], background: "#f6f5f2" }).promise;
        if (!cancelled) setState("ready");
      } catch {
        if (!cancelled) setState("failed");
      }
    })();
    return () => {
      cancelled = true;
      if (loadingTask) void loadingTask.destroy();
    };
  }, [url]);

  return (
    <>
      <canvas ref={canvasRef} role="img" aria-label={`First page preview of ${name}`} className="max-h-full max-w-full shadow-md" />
      {state === "failed" ? (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-white/[0.035]"><FileText className="size-7 text-white/50" /></span>
      ) : state === "loading" ? (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-[#f6f5f2]"><LoaderCircle className="size-5 animate-spin text-zinc-400" /></span>
      ) : null}
    </>
  );
}
