export type DriveFileStatus = "uploading" | "ready" | "failed";

export type DriveFile = {
  id: string;
  user_id: string;
  name: string;
  type: string;
  size: number;
  storage_path: string;
  thumbnail_path: string | null;
  note_id: string | null;
  status: DriveFileStatus;
  extracted_text: string | null;
  created_at: string;
  sort_order: number;
  is_deleted: boolean;
  signed_url?: string;
  thumbnail_url?: string;
};

export type UploadingDriveFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  progress: number;
  status: "uploading" | "failed";
  error?: string;
};
