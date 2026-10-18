const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;
const MAX_BATCH_SIZE = 100;

export function splitNoteIntoChunks(title: string, html: string, maxCharacters = 900): string[] {
  const text = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  if (!text) return [];

  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxCharacters, text.length);
    if (end < text.length) {
      const boundary = Math.max(text.lastIndexOf("\n", end), text.lastIndexOf(". ", end), text.lastIndexOf(" ", end));
      if (boundary > start + Math.floor(maxCharacters * 0.55)) end = boundary + (text[boundary] === "." ? 1 : 0);
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    start = Math.max(start + 1, end - 120);
    while (start < text.length && /\s/.test(text[start])) start += 1;
  }

  return chunks.map((chunk) => `title: ${title.trim() || "none"} | text: ${chunk}`);
}

export async function embedTexts(texts: string[], taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY", apiKey: string): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (let offset = 0; offset < texts.length; offset += MAX_BATCH_SIZE) {
    const batch = texts.slice(offset, offset + MAX_BATCH_SIZE);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ requests: batch.map((text) => ({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBEDDING_DIMENSIONS,
      })) }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Gemini embeddings returned HTTP ${response.status}.`);
    const payload = await response.json() as { embeddings?: Array<{ values?: number[] }> };
    if (!Array.isArray(payload.embeddings) || payload.embeddings.length !== batch.length) {
      throw new Error("Gemini returned an invalid embedding batch.");
    }
    for (const item of payload.embeddings) {
      if (!Array.isArray(item.values) || item.values.length !== EMBEDDING_DIMENSIONS || item.values.some((value) => !Number.isFinite(value))) {
        throw new Error("Gemini returned an invalid embedding vector.");
      }
      embeddings.push(item.values);
    }
  }
  return embeddings;
}
