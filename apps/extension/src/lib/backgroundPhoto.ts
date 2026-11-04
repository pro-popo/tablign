import type { SupabaseClient } from "@supabase/supabase-js";

/** 배경 사진 — 비공개 버킷의 본인 폴더({user_id}/{uuid}.jpg). 기기에는 마지막 사진을 data URL로 둔다. */
const BUCKET = "backgrounds";
export const PHOTO_CACHE_KEY = "tablign.themePhoto";
const MAX_SIDE = 2560;

/** 긴 쪽을 maxSide 이하 JPEG로 줄인다(작으면 크기는 그대로, JPEG로만) */
export async function resizeImage(blob: Blob, maxSide = MAX_SIDE, quality = 0.85): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지를 줄이지 못했어요"))), "image/jpeg", quality));
}

export async function uploadBackground(client: SupabaseClient, userId: string, file: Blob): Promise<{ path: string; blob: Blob }> {
  const blob = await resizeImage(file);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await client.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;
  return { path, blob };
}

export async function downloadBackground(client: SupabaseClient, path: string): Promise<Blob> {
  const { data, error } = await client.storage.from(BUCKET).download(path);
  if (error || !data) throw error ?? new Error("사진을 받지 못했어요");
  return data;
}

export async function deleteBackground(client: SupabaseClient, path: string): Promise<void> {
  const { error } = await client.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

// ── 기기 캐시(chrome.storage.local) ──
export interface PhotoCache { path: string; dataUrl: string }

export function readPhotoCache(): Promise<PhotoCache | null> {
  return new Promise((resolve) => chrome.storage.local.get(PHOTO_CACHE_KEY, (r) => resolve((r?.[PHOTO_CACHE_KEY] as PhotoCache | undefined) ?? null)));
}

export async function writePhotoCache(path: string, blob: Blob): Promise<void> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
  await new Promise<void>((resolve) => chrome.storage.local.set({ [PHOTO_CACHE_KEY]: { path, dataUrl } }, () => resolve()));
}

export const dataUrlToBlob = async (url: string) => (await fetch(url)).blob();
