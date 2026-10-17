export const DRIVE_BUCKET = "drive-files";
export const DRIVE_MAX_BYTES = 100 * 1024 * 1024;
export const DRIVE_STORAGE_LIMIT_BYTES = 500 * 1024 * 1024;
export const DRIVE_RESUMABLE_CHUNK_BYTES = 6 * 1024 * 1024;
export const DRIVE_ALLOWED_TYPES = [
  "application/pdf", "application/rtf", "application/json", "application/zip",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv", "text/markdown", "text/html",
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/avif", "image/heic", "image/heif",
  "audio/mpeg", "audio/mp4", "audio/ogg", "audio/webm", "audio/wav", "audio/x-wav", "audio/aac",
  "video/mp4", "video/webm", "video/quicktime", "video/x-matroska",
] as const;

type DriveFileInput = { name: string; type: string; size: number };

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf", rtf: "application/rtf", json: "application/json", zip: "application/zip",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", csv: "text/csv", md: "text/markdown", html: "text/html", htm: "text/html",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  avif: "image/avif", heic: "image/heic", heif: "image/heif",
  mp3: "audio/mpeg", m4a: "audio/mp4", ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/ogg", weba: "audio/webm",
  wav: "audio/wav", aac: "audio/aac", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", mkv: "video/x-matroska",
};

export function getDriveFileType(file: Pick<DriveFileInput, "name" | "type">): string | null {
  const type = file.type || MIME_BY_EXTENSION[file.name.split(".").pop()?.toLowerCase() ?? ""];
  return type && DRIVE_ALLOWED_TYPES.includes(type as (typeof DRIVE_ALLOWED_TYPES)[number]) ? type : null;
}

export function validateDriveFile(file: DriveFileInput): string | null {
  if (file.size <= 0) return "Empty files can’t be uploaded.";
  if (file.size > DRIVE_MAX_BYTES) return "Files must be 100 MB or smaller.";
  if (!getDriveFileType(file)) return "This file type isn’t supported.";
  return null;
}
