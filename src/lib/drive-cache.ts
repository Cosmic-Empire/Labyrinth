import type { DriveFile } from "@/src/lib/drive-types";

const cacheKey = (userId: string) => `labyrinth:drive:${userId}`;

export function readCachedDriveFiles(userId: string): DriveFile[] {
  try {
    const raw = window.localStorage.getItem(cacheKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isDriveFile).map((file) => ({ ...file, signed_url: undefined, thumbnail_url: undefined }));
  } catch {
    return [];
  }
}

export function cacheDriveFiles(userId: string, files: DriveFile[]): void {
  try {
    const cacheableFiles = files.map((file) => {
      const cacheable = { ...file };
      delete cacheable.signed_url;
      delete cacheable.thumbnail_url;
      return cacheable;
    });
    window.localStorage.setItem(cacheKey(userId), JSON.stringify(cacheableFiles));
  } catch (error) {
    console.warn("Unable to cache Drive file metadata.", error);
  }
}

function isDriveFile(value: unknown): value is DriveFile {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.user_id === "string" &&
    typeof row.name === "string" && typeof row.type === "string" &&
    typeof row.size === "number" && typeof row.storage_path === "string" &&
    typeof row.status === "string" && typeof row.created_at === "string" &&
    typeof row.sort_order === "number" && typeof row.is_deleted === "boolean";
}
