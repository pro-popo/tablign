import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyTokens } from "@tablign/ui";
import { getThemeSettings, saveThemeSettings } from "@tablign/core";
import {
  normalizeTheme, readThemeCache, writeThemeCache, themeTokens, systemPrefersDark, viewportSize,
  THEME_CACHE_KEY, THEME_PENDING_KEY, type ThemeSettings,
} from "./themeSettings";
import { uploadBackground, downloadBackground, deleteBackground, readPhotoCache, writePhotoCache, dataUrlToBlob } from "./backgroundPhoto";

const SAVE_DELAY = 500;
const DARK_QUERY = "(prefers-color-scheme: dark)";

export type UploadState = "idle" | "uploading" | "error";

export function useSystemDark() {
  const [dark, setDark] = useState(systemPrefersDark);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const m = matchMedia(DARK_QUERY), on = () => setDark(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return dark;
}

/** 화면 크기 — 그라데이션 점이 화면 %라 크기가 바뀌면 다시 그린다 */
export function useViewport() {
  const [vp, setVp] = useState(viewportSize);
  useEffect(() => {
    const on = () => setVp(viewportSize());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return vp;
}

/**
 * 테마 설정 — 기기 캐시로 바로 그리고, 로그인하면 서버(user_settings)와 맞춘다.
 * 바꾸면 즉시 적용·캐시하고 0.5초 모아 서버에 저장한다. 못 보낸 변경은 표시해 두고 다음 새 탭에서 다시 보낸다.
 * 올린 사진은 기기 캐시가 같은 사진이면 그걸로, 아니면 내려받아 그리고 캐시한다.
 */
export function useThemeSettings(client: SupabaseClient, userId: string | null) {
  const [settings, setSettings] = useState(readThemeCache);
  const current = useRef(settings);
  const systemDark = useSystemDark();
  const viewport = useViewport();
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  /** 서버 값을 받기 전에 사용자가 바꿨나 — 바꿨으면 서버 값으로 덮지 않는다 */
  const touched = useRef(false);

  useLayoutEffect(() => {
    applyTokens(document.documentElement, themeTokens(settings, systemDark, viewport, uploadUrl));
  }, [settings, systemDark, viewport, uploadUrl]);

  /** 저장하지 않고 화면에만 그려 본다(그라데이션 점·슬라이더를 끄는 동안) */
  const preview = useCallback((s: ThemeSettings) => {
    applyTokens(document.documentElement, themeTokens(s, systemDark, viewport, uploadUrl));
  }, [systemDark, viewport, uploadUrl]);

  const push = useCallback(async (s: ThemeSettings) => {
    if (!userId) return;
    try {
      await saveThemeSettings(client, userId, s);
      localStorage.removeItem(THEME_PENDING_KEY);
    } catch { /* 표시가 남아 다음 변경·다음 새 탭에서 다시 보낸다 */ }
  }, [client, userId]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    touched.current = false;
    if (localStorage.getItem(THEME_PENDING_KEY)) { void push(current.current); return; }
    getThemeSettings(client, userId).then((raw) => {
      if (!alive || raw == null || touched.current) return;
      const s = normalizeTheme(raw);
      current.current = s;
      setSettings(s);
      writeThemeCache(s);
    }).catch(() => { /* 서버를 못 읽으면 캐시로 계속 그린다 */ });
    return () => { alive = false; };
  }, [client, userId, push]);

  // 같은 기기의 다른 새 탭에서 바꾸면 따라 바뀐다
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key !== THEME_CACHE_KEY) return;
      const s = readThemeCache();
      current.current = s;
      setSettings(s);
    };
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const update = useCallback((fn: (s: ThemeSettings) => ThemeSettings) => {
    const next = normalizeTheme(fn(current.current));
    current.current = next;
    touched.current = true;
    setSettings(next);
    writeThemeCache(next);
    if (!userId) return;
    localStorage.setItem(THEME_PENDING_KEY, "1");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void push(next), SAVE_DELAY);
  }, [userId, push]);

  // 올린 사진 그리기 — 캐시가 같은 사진이면 그걸로, 아니면 내려받는다
  const photo = settings.background.photo;
  const photoPath = photo.source === "upload" ? photo.path : null;
  useEffect(() => {
    if (!photoPath) { setUploadUrl(null); return; }
    let alive = true, url: string | null = null;
    const show = (b: Blob) => { if (!alive) return; const u = URL.createObjectURL(b); if (url) URL.revokeObjectURL(url); url = u; setUploadUrl(u); };
    (async () => {
      const cached = await readPhotoCache().catch(() => null);
      if (cached?.path === photoPath) { const b = await dataUrlToBlob(cached.dataUrl).catch(() => null); if (b) { show(b); return; } }
      if (!userId) return;
      try {
        const full = await downloadBackground(client, photoPath);
        show(full);
        writePhotoCache(photoPath, full).catch(() => { /* 캐시가 꽉 차도 화면은 그대로 */ });
      } catch { /* 못 받으면 배경 없이 그린다(설정은 그대로) */ }
    })();
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [photoPath, userId, client]);

  /** 사진 올리기 — 줄여서 올리고, 캐시한 뒤 배경을 그 사진으로 바꾸고, 예전 사진은 지운다 */
  const uploadPhoto = useCallback(async (file: Blob) => {
    if (!userId) return;
    setUploadState("uploading");
    try {
      const { path, blob } = await uploadBackground(client, userId, file);
      const old = current.current.background.photo.path;
      await writePhotoCache(path, blob).catch(() => { /* 없으면 내려받는다 */ });
      update((s) => ({ ...s, background: { ...s.background, kind: "photo", photo: { ...s.background.photo, source: "upload", path } } }));
      if (old && old !== path) deleteBackground(client, old).catch(() => { /* 남아도 본인 폴더라 괜찮다 */ });
      setUploadState("idle");
    } catch {
      setUploadState("error");
    }
  }, [client, userId, update]);

  return { settings, update, preview, systemDark, viewport, uploadUrl, uploadState, uploadPhoto };
}
