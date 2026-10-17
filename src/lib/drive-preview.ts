async function imagePreview(file: File): Promise<Blob | null> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || typeof createImageBitmap === "undefined") return null;
  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 480 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.78));
  } finally {
    image.close();
  }
}

async function textPreview(file: File): Promise<Blob | null> {
  if (!file.type.startsWith("text/") && file.type !== "application/json") return null;
  const text = await file.slice(0, 4096).text();
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 640;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return null;
  context.fillStyle = "#faf9f6";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#77736c";
  context.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
  const lines = text.replace(/\r/g, "").split("\n").slice(0, 34);
  let y = 34;
  for (const rawLine of lines) {
    const line = rawLine.slice(0, 58);
    context.fillText(line || " ", 24, y, 432);
    y += 17;
    if (y > 610) break;
  }
  return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.78));
}

async function videoPreview(file: File): Promise<Blob | null> {
  if (!file.type.startsWith("video/")) return null;
  const video = document.createElement("video");
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<Blob | null>((resolve) => {
      let settled = false;
      const finish = (blob: Blob | null) => {
        if (settled) return;
        settled = true;
        resolve(blob);
      };
      const timeout = window.setTimeout(() => finish(null), 4000);
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.onloadeddata = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
          window.clearTimeout(timeout);
          finish(null);
          return;
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        void new Promise<Blob | null>((resolveBlob) => canvas.toBlob(resolveBlob, "image/webp", 0.78))
          .then((blob) => { window.clearTimeout(timeout); finish(blob); });
      };
      video.onerror = () => { window.clearTimeout(timeout); finish(null); };
      video.src = objectUrl;
      video.load();
    });
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

async function pdfPreview(file: File): Promise<Blob | null> {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return null;
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const pdfDocument = await task.promise;
    const page = await pdfDocument.getPage(1);
    const natural = page.getViewport({ scale: 1 });
    const scale = Math.min(1, 480 / natural.width, 640 / natural.height);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return null;
    await page.render({ canvas, viewport, background: "#f6f5f2" }).promise;
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.78));
  } finally {
    await task.destroy();
  }
}

export async function createDrivePreview(file: File): Promise<Blob | null> {
  try {
    return (await imagePreview(file))
      ?? (await pdfPreview(file))
      ?? (await videoPreview(file))
      ?? (await textPreview(file));
  } catch {
    return null;
  }
}
