import type { SupabaseClient } from "@supabase/supabase-js";
import { unzipSync, strFromU8 } from "fflate";
import { DRIVE_BUCKET } from "@/src/lib/drive-constants";

const MAX_TEXT_PER_FILE = 12_000;
const MAX_CONTEXT_CHARS = 100_000;
const MAX_SOURCE_FILES = 300;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 32 * 1024 * 1024;
const MAX_SELECTED_CONTEXT_CHARS = 72_000;
const MAX_SELECTED_SOURCES = 24;

export type WorkspaceSource = { id: string; type: "note" | "file"; name: string; text: string; date: string; storagePath?: string };
export type WorkspaceContext = { sources: WorkspaceSource[]; context: string; truncated: boolean };

function htmlToText(html: string): string {
  return html.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\s*\/(p|div|li|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
}

function decodeXmlText(xml: string): string {
  return xml.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

function unpackOfficeFile(bytes: Uint8Array, prefix: string): Array<[string, string]> {
  try {
    const archive = unzipSync(bytes, { filter: (file) => file.name.startsWith(prefix) && file.name.endsWith(".xml") });
    let uncompressedSize = 0;
    return Object.entries(archive).sort(([a], [b]) => {
      const aNumber = Number(a.match(/(\d+)\.xml$/)?.[1] ?? 0);
      const bNumber = Number(b.match(/(\d+)\.xml$/)?.[1] ?? 0);
      return aNumber - bNumber;
    }).map(([path, data]) => {
      uncompressedSize += data.byteLength;
      if (uncompressedSize > MAX_UNCOMPRESSED_BYTES) throw new Error("Office document exceeds text extraction limits.");
      return [path, strFromU8(data)];
    });
  } catch {
    return [];
  }
}

function extractDocxText(bytes: Uint8Array): string {
  const xml = unpackOfficeFile(bytes, "word/document.xml").find(([path]) => path === "word/document.xml")?.[1];
  if (!xml) return "";
  return xml.replace(/<w:tab\b[^>]*\/>/g, "\t").replace(/<w:(?:br|cr)\b[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n").replace(/<w:t\b[^>]*>/g, "").replace(/<\/w:t>/g, "")
    .replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").slice(0, MAX_TEXT_PER_FILE);
}

function extractPptxText(bytes: Uint8Array): string {
  return unpackOfficeFile(bytes, "ppt/slides/slide").map(([path, xml]) => {
    const slideNumber = path.match(/slide(\d+)\.xml$/)?.[1] ?? "?";
    const text = xml.replace(/<a:br\b[^>]*\/>/g, "\n").replace(/<a:t\b[^>]*>/g, "")
      .replace(/<\/a:t>/g, "\n");
    return `Slide ${slideNumber}: ${decodeXmlText(text)}`;
  }).join("\n").slice(0, MAX_TEXT_PER_FILE);
}

function extractXlsxText(bytes: Uint8Array): string {
  const sharedXml = unpackOfficeFile(bytes, "xl/sharedStrings.xml").find(([path]) => path === "xl/sharedStrings.xml")?.[1] ?? "";
  const sharedStrings = [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => decodeXmlText(match[1]));
  const sheets = unpackOfficeFile(bytes, "xl/worksheets/sheet");
  return sheets.map(([path, xml], index) => {
    const sheetData = xml.match(/<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/)?.[1] ?? "";
    const rows = [...sheetData.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((row) =>
      [...row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)].map((cell) => {
        const rawValue = cell[2].match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? "";
        return /\bt="s"/.test(cell[1]) ? sharedStrings[Number(rawValue)] ?? "" : decodeXmlText(rawValue);
      }).join("\t"),
    );
    return `Sheet ${index + 1} (${path.split("/").pop()}):\n${rows.join("\n")}`;
  }).join("\n\n").slice(0, MAX_TEXT_PER_FILE);
}

async function extractFileText(client: SupabaseClient, file: {
  name: string; type: string; storage_path: string; extracted_text: string | null; size: number;
}): Promise<string> {
  if (file.extracted_text?.trim()) return file.extracted_text.slice(0, MAX_TEXT_PER_FILE);
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const supported = file.type.startsWith("text/") || file.type === "application/json" || file.type === "application/pdf" ||
    extension === "docx" || extension === "xlsx" || extension === "csv" || extension === "pptx";
  if (!supported || file.size > MAX_FILE_BYTES) return "";
  const { data, error } = await client.storage.from(DRIVE_BUCKET).download(file.storage_path);
  if (error || !data || data.size > MAX_FILE_BYTES) return "";

  try {
    if (file.type === "application/pdf" || extension === "pdf") {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
      const task = pdfjs.getDocument({
        data: new Uint8Array(await data.arrayBuffer()),
        useSystemFonts: true,
        isEvalSupported: false,
      });
      try {
        const pdf = await task.promise;
        const pages: string[] = [];
        let count = 0;
        for (let pageNo = 1; pageNo <= Math.min(pdf.numPages, 40); pageNo += 1) {
          const page = await pdf.getPage(pageNo);
          const pageText = (await page.getTextContent()).items.map((item) => "str" in item ? item.str : "").join(" ");
          pages.push(pageText);
          count += pageText.length;
          if (count >= MAX_TEXT_PER_FILE) break;
        }
        return pages.join("\n").slice(0, MAX_TEXT_PER_FILE);
      } finally {
        await task.destroy();
      }
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (extension === "docx") return extractDocxText(bytes);
    if (extension === "pptx") return extractPptxText(bytes);
    if (extension === "xlsx") return extractXlsxText(bytes);
    if (extension === "csv") return new TextDecoder().decode(bytes).slice(0, MAX_TEXT_PER_FILE);
    if (file.type === "text/html") return htmlToText(new TextDecoder().decode(bytes)).slice(0, MAX_TEXT_PER_FILE);
    if (file.type.startsWith("text/") || file.type === "application/json") return new TextDecoder().decode(bytes).slice(0, MAX_TEXT_PER_FILE);
  } catch (error) {
    console.warn(`Labora could not extract text from ${file.name}.`, error);
  }
  return "";
}

function tokenizeForSearch(text: string): Set<string> {
  return new Set((text.toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []).filter((word) => !STOP_WORDS.has(word)));
}

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "and", "any", "are", "can", "could", "does", "for", "from", "have",
  "how", "into", "its", "just", "more", "most", "not", "our", "please", "that", "the", "their", "them",
  "then", "there", "these", "they", "this", "those", "was", "were", "what", "when", "where", "which",
  "who", "why", "with", "would", "you", "your",
]);

function rankSources(sources: WorkspaceSource[], question: string): WorkspaceSource[] {
  const queryWords = tokenizeForSearch(question);
  if (queryWords.size === 0) return sources;
  return sources.map((source, index) => {
    const sourceWords = tokenizeForSearch(`${source.name} ${source.text}`);
    let score = 0;
    for (const word of queryWords) if (sourceWords.has(word)) score += word.length > 5 ? 2 : 1;
    const titleWords = tokenizeForSearch(source.name);
    for (const word of queryWords) if (titleWords.has(word)) score += 4;
    return { source, index, score };
  }).sort((a, b) => b.score - a.score || a.index - b.index).map(({ source }) => source);
}

export async function getWorkspaceContext(client: SupabaseClient, userId: string, question = ""): Promise<WorkspaceContext> {
  const [{ data: notes, error: notesError }, { data: files, error: filesError }] = await Promise.all([
    client.from("notes").select("id,title,content,updated_at,is_deleted").eq("user_id", userId).eq("is_deleted", false).order("updated_at", { ascending: false }).limit(MAX_SOURCE_FILES),
    client.from("files").select("id,name,type,storage_path,extracted_text,size,status,created_at,is_deleted").eq("user_id", userId).eq("is_deleted", false).eq("status", "ready").order("created_at", { ascending: false }).limit(MAX_SOURCE_FILES),
  ]);
  if (notesError) throw notesError;
  if (filesError) throw filesError;

  const sources: WorkspaceSource[] = (notes ?? []).map((note) => ({
    id: note.id,
    type: "note",
    name: note.title.trim() || "Untitled note",
    text: `${note.title}\n${htmlToText(note.content)}`.slice(0, MAX_TEXT_PER_FILE),
    date: note.updated_at,
  }));
  const extractedFiles = await Promise.all((files ?? []).map(async (file) => ({
    id: file.id, type: "file" as const, name: file.name, text: await extractFileText(client, file), date: file.created_at, storagePath: file.storage_path,
  })));
  sources.push(...extractedFiles.filter((file) => file.text.trim().length > 0));

  const rankedSources = rankSources(sources, question);
  let remaining = Math.min(MAX_CONTEXT_CHARS, MAX_SELECTED_CONTEXT_CHARS);
  const contextParts: string[] = [];
  const selectedSources: WorkspaceSource[] = [];
  for (const source of rankedSources) {
    if (remaining <= 0 || selectedSources.length >= MAX_SELECTED_SOURCES) break;
    const label = `[${source.type.toUpperCase()}: ${source.name} | id=${source.id}]\n`;
    const excerpt = source.text.slice(0, Math.max(0, remaining - label.length));
    if (!excerpt) continue;
    contextParts.push(`${label}${excerpt}`);
    selectedSources.push(source);
    remaining -= label.length + excerpt.length + 10;
  }
  return {
    sources: selectedSources,
    context: contextParts.join("\n\n---\n\n"),
    truncated: selectedSources.length < sources.length || remaining <= 0 || (notes?.length ?? 0) >= MAX_SOURCE_FILES || (files?.length ?? 0) >= MAX_SOURCE_FILES,
  };
}
