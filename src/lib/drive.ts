"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { Upload } from "tus-js-client";
import type { DriveFile, DriveFileStatus } from "@/src/lib/drive-types";
import { DRIVE_BUCKET, DRIVE_RESUMABLE_CHUNK_BYTES, getDriveFileType, validateDriveFile } from "@/src/lib/drive-constants";
import { createDrivePreview } from "@/src/lib/drive-preview";

export { DRIVE_ALLOWED_TYPES, DRIVE_BUCKET, DRIVE_MAX_BYTES, DRIVE_RESUMABLE_CHUNK_BYTES, DRIVE_STORAGE_LIMIT_BYTES, getDriveFileType, validateDriveFile } from "@/src/lib/drive-constants";

export async function listDriveFiles(client: SupabaseClient, userId: string): Promise<DriveFile[]> {
  const { data, error } = await client
    .from("files")
    .select("id,user_id,name,type,size,storage_path,thumbnail_path,note_id,status,extracted_text,created_at,sort_order,is_deleted")
    .eq("user_id", userId)
    .eq("is_deleted", false)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;

  const files = (data ?? []) as DriveFile[];
  const ready = files.filter((file) => file.status === "ready");
  const signed = new Map<string, string>();
  const signedThumbnails = new Map<string, string>();
  for (let start = 0; start < ready.length; start += 100) {
    const batch = ready.slice(start, start + 100);
    const { data: urls, error: signedError } = await client.storage
      .from(DRIVE_BUCKET)
      .createSignedUrls(batch.map((file) => file.storage_path), 3600);
    if (signedError) throw signedError;
    for (const url of urls ?? []) {
      if (url.path && url.signedUrl) signed.set(url.path, url.signedUrl);
    }
  }
  const thumbnails = ready.filter((file) => file.thumbnail_path);
  for (let start = 0; start < thumbnails.length; start += 100) {
    const batch = thumbnails.slice(start, start + 100);
    const paths = batch.flatMap((file) => file.thumbnail_path ? [file.thumbnail_path] : []);
    const { data: urls, error: signedError } = await client.storage.from(DRIVE_BUCKET).createSignedUrls(paths, 3600);
    if (signedError) throw signedError;
    for (const url of urls ?? []) {
      if (url.path && url.signedUrl) signedThumbnails.set(url.path, url.signedUrl);
    }
  }

  return files.map((file) => ({
    ...file,
    size: Number(file.size),
    sort_order: Number(file.sort_order),
    signed_url: signed.get(file.storage_path),
    thumbnail_url: file.thumbnail_path ? signedThumbnails.get(file.thumbnail_path) : undefined,
  }));
}

function storageBaseUrl(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("Supabase URL is not configured.");
  const parsed = new URL(supabaseUrl);
  if (parsed.hostname.endsWith(".supabase.co")) {
    parsed.hostname = parsed.hostname.replace(".supabase.co", ".storage.supabase.co");
  }
  return parsed.origin;
}

export async function getDriveStorageUsage(client: SupabaseClient): Promise<number> {
  const { data, error } = await client.rpc("get_drive_storage_usage");
  if (error) throw error;
  return Number(data ?? 0);
}

export async function copyDriveFileToClipboard(file: DriveFile): Promise<void> {
  if (!file.signed_url) throw new Error("This file’s download link is unavailable. Refresh Drive and try again.");

  if (file.type.startsWith("text/") || file.type === "application/json") {
    const response = await fetch(file.signed_url);
    if (!response.ok) throw new Error("Could not download the file contents for copying.");
    await navigator.clipboard.writeText(await response.text());
    return;
  }

  if (file.type.startsWith("image/") && file.type !== "image/svg+xml") {
    const response = await fetch(file.signed_url);
    if (!response.ok) throw new Error("Could not download the image for copying.");
    const blob = await response.blob();
    const supportedType = ["image/png", "image/jpeg", "image/webp"].includes(blob.type) ? blob.type : null;
    if (supportedType && typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
      await navigator.clipboard.write([new ClipboardItem({ [supportedType]: blob })]);
      return;
    }
  }

  await navigator.clipboard.writeText(file.signed_url);
}

export async function uploadDriveFile(
  client: SupabaseClient,
  userId: string,
  file: File,
  onProgress: (progress: number) => void,
  id = crypto.randomUUID(),
): Promise<string> {
  const validationError = validateDriveFile(file);
  if (validationError) throw new Error(validationError);

  const safeOriginalName = file.name.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 180) || "file";
  const storagePath = `${userId}/${id}/${safeOriginalName}`;
  let thumbnailPath: string | null = null;
  let metadataCreated = false;
  let originalUploaded = false;
  const { error: insertError } = await client.rpc("reserve_drive_upload", {
    p_id: id,
    p_name: file.name,
    p_type: getDriveFileType(file)!,
    p_size: file.size,
    p_storage_path: storagePath,
    p_sort_order: Date.now(),
  });
  if (insertError) {
    if (insertError.message.toLowerCase().includes("storage limit")) {
      throw new Error("This upload would exceed your 500 MB Drive storage limit.");
    }
    throw insertError;
  }
  metadataCreated = true;

  try {
    const thumbnail = await createDrivePreview(file);
    if (thumbnail) {
      thumbnailPath = `${userId}/${id}/thumbnail.webp`;
      const { error: thumbnailError } = await client.storage.from(DRIVE_BUCKET).upload(thumbnailPath, thumbnail, {
        contentType: "image/webp",
        cacheControl: "3600",
        upsert: false,
      });
      if (thumbnailError) {
        await client.storage.from(DRIVE_BUCKET).remove([thumbnailPath]);
        thumbnailPath = null;
      }
    }

    const { data: { session }, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session?.access_token) throw new Error("Your session expired. Sign in again to upload.");

    await new Promise<void>((resolve, reject) => {
      const upload = new Upload(file, {
        endpoint: `${storageBaseUrl()}/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: { authorization: `Bearer ${session.access_token}` },
        fingerprint: async (uploadFile) => `${userId}/${storagePath}/${uploadFile.name}/${uploadFile.size}/${uploadFile.lastModified}`,
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: DRIVE_RESUMABLE_CHUNK_BYTES,
        metadata: {
          bucketName: DRIVE_BUCKET,
          objectName: storagePath,
          contentType: getDriveFileType(file)!,
          cacheControl: "3600",
        },
        onProgress: (sent, total) => onProgress(Math.min(99, Math.round((sent / total) * 100))),
        onError: reject,
        onSuccess: () => resolve(),
      });
      void upload.findPreviousUploads().then((previous) => {
        if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]);
        upload.start();
      }).catch(reject);
    });
    originalUploaded = true;

    const { error: readyError } = await client.from("files").update({
      thumbnail_path: thumbnailPath,
      status: "ready" satisfies DriveFileStatus,
    }).eq("id", id).eq("user_id", userId);
    if (readyError) throw readyError;
    onProgress(100);
    return id;
  } catch (error) {
    if (metadataCreated) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      await client.from("files").update({ status: "failed" satisfies DriveFileStatus })
        .eq("id", id).eq("user_id", userId);
      const cleanupPaths = [
        ...(originalUploaded ? [storagePath] : []),
        ...(thumbnailPath ? [thumbnailPath] : []),
      ];
      if (cleanupPaths.length > 0) await client.storage.from(DRIVE_BUCKET).remove(cleanupPaths);
      throw new Error(message);
    }
    throw error;
  }
}

export async function renameDriveFile(
  client: SupabaseClient,
  userId: string,
  file: DriveFile,
  nextName: string,
): Promise<void> {
  const name = nextName.trim();
  if (!name || name.length > 255) throw new Error("File names must be between 1 and 255 characters.");
  const validation = validateDriveFile({ name, type: file.type, size: file.size });
  if (validation) throw new Error(validation);
  const segments = file.storage_path.split("/");
  const safeName = name.replace(/[\\/\u0000-\u001f]/g, "_");
  const nextPath = `${segments[0]}/${segments[1]}/${safeName}`;
  const { error: moveError } = await client.storage.from(DRIVE_BUCKET).move(file.storage_path, nextPath);
  if (moveError) throw moveError;

  let nextThumbnailPath = file.thumbnail_path;
  if (nextThumbnailPath) {
    const thumbnailSegments = nextThumbnailPath.split("/");
    const movedThumbnailPath = `${thumbnailSegments[0]}/${thumbnailSegments[1]}/${safeName}.webp`;
    const { error: thumbnailMoveError } = await client.storage.from(DRIVE_BUCKET).move(nextThumbnailPath, movedThumbnailPath);
    if (thumbnailMoveError) {
      await client.storage.from(DRIVE_BUCKET).move(nextPath, file.storage_path);
      throw thumbnailMoveError;
    }
    nextThumbnailPath = movedThumbnailPath;
  }

  const { error: updateError } = await client.from("files").update({
    name,
    storage_path: nextPath,
    thumbnail_path: nextThumbnailPath,
  }).eq("id", file.id).eq("user_id", userId);
  if (updateError) {
    await client.storage.from(DRIVE_BUCKET).move(nextPath, file.storage_path);
    if (nextThumbnailPath && file.thumbnail_path) {
      await client.storage.from(DRIVE_BUCKET).move(nextThumbnailPath, file.thumbnail_path);
    }
    throw updateError;
  }
}

export async function deleteDriveFile(client: SupabaseClient, userId: string, file: DriveFile): Promise<void> {
  const paths = [file.storage_path, file.thumbnail_path].filter((path): path is string => Boolean(path));
  const { error: deleteError } = await client.storage.from(DRIVE_BUCKET).remove(paths);
  if (deleteError) throw deleteError;
  const { error: updateError } = await client.from("files").update({ is_deleted: true })
    .eq("id", file.id).eq("user_id", userId);
  if (updateError) throw updateError;
}
