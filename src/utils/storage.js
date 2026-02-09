import { supabase } from "../client";

export const ISSUE_IMAGES_BUCKET = "issue-images";

const buildFileName = (file) => {
  const extFromName = file?.name?.includes(".")
    ? file.name.split(".").pop()
    : "";
  const extFromType = file?.type?.includes("/")
    ? file.type.split("/").pop()
    : "";
  const ext = (extFromName || extFromType || "").toLowerCase();
  const base =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return ext ? `${base}.${ext}` : base;
};

export const uploadIssueImage = async (file, userId) => {
  if (!file) {
    return { publicUrl: null, path: null };
  }

  const fileName = buildFileName(file);
  const filePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(ISSUE_IMAGES_BUCKET)
    .upload(filePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return { error: uploadError };
  }

  const { data } = supabase.storage
    .from(ISSUE_IMAGES_BUCKET)
    .getPublicUrl(filePath);

  return { publicUrl: data?.publicUrl || null, path: filePath };
};

export const getIssueImagePathFromUrl = (url) => {
  if (!url) return null;

  const marker = `/storage/v1/object/public/${ISSUE_IMAGES_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;

  let path = url.slice(index + marker.length);
  if (!path) return null;

  path = path.split("?")[0];
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

export const deleteIssueImageByUrl = async (url) => {
  const path = getIssueImagePathFromUrl(url);
  if (!path) return { skipped: true };

  const { error } = await supabase.storage
    .from(ISSUE_IMAGES_BUCKET)
    .remove([path]);

  if (error) {
    return { error };
  }

  return { success: true };
};

export const resolveIssueImageUrl = (value) => {
  if (!value) return null;

  const trimmed = String(value).trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;

  const signedMarker = `/storage/v1/object/sign/${ISSUE_IMAGES_BUCKET}/`;
  if (trimmed.includes(signedMarker)) {
    const path = trimmed.split(signedMarker)[1]?.split("?")[0];
    if (!path) return null;
    const { data } = supabase.storage.from(ISSUE_IMAGES_BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const bucketPrefix = `${ISSUE_IMAGES_BUCKET}/`;
  const path = trimmed.startsWith(bucketPrefix)
    ? trimmed.slice(bucketPrefix.length)
    : trimmed;

  const { data } = supabase.storage.from(ISSUE_IMAGES_BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
};
