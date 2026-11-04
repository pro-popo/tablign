import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DARK, LIGHT } from "@tablign/ui";

vi.mock("@tablign/core", async (orig) => ({
  ...(await orig<typeof import("@tablign/core")>()),
  getThemeSettings: vi.fn(),
  saveThemeSettings: vi.fn(),
}));
vi.mock("./backgroundPhoto", () => ({
  uploadBackground: vi.fn(), downloadBackground: vi.fn(), deleteBackground: vi.fn(),
  readPhotoCache: vi.fn(), writePhotoCache: vi.fn(), dataUrlToBlob: vi.fn(),
}));
import { getThemeSettings, saveThemeSettings } from "@tablign/core";
import * as photo from "./backgroundPhoto";
import { useThemeSettings } from "./useThemeSettings";
import { DEFAULT_THEME, THEME_CACHE_KEY, THEME_PENDING_KEY, writeThemeCache, readThemeCache } from "./themeSettings";

const client = {} as SupabaseClient;
const get = vi.mocked(getThemeSettings), save = vi.mocked(saveThemeSettings);
const bgVar = () => document.documentElement.style.getPropertyValue("--tb-bg");
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

const ph = vi.mocked(photo);
beforeEach(() => {
  localStorage.clear(); get.mockReset(); save.mockReset(); get.mockResolvedValue(null); save.mockResolvedValue();
  Object.values(ph).forEach((f) => (f as ReturnType<typeof vi.fn>).mockReset());
  ph.readPhotoCache.mockResolvedValue(null); ph.writePhotoCache.mockResolvedValue(); ph.deleteBackground.mockResolvedValue();
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:test/${++n}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.useRealTimers());

describe("useThemeSettings", () => {
  it("기기 캐시로 바로 그린다", () => {
    writeThemeCache({ ...DEFAULT_THEME, mode: "dark" });
    const { result } = renderHook(() => useThemeSettings(client, null));
    expect(result.current.settings.mode).toBe("dark");
    expect(bgVar()).toBe(DARK.bg);
    expect(get).not.toHaveBeenCalled();
  });

  it("로그인하면 서버 값을 적용하고 캐시를 바꾼다", async () => {
    get.mockResolvedValue({ mode: "dark", accent: { preset: 2 } });
    const { result } = renderHook(() => useThemeSettings(client, "u1"));
    await flush();
    expect(get).toHaveBeenCalledWith(client, "u1");
    expect(result.current.settings.mode).toBe("dark");
    expect(readThemeCache().accent).toEqual({ preset: 2 });
    expect(bgVar()).toBe(DARK.bg);
  });

  it("서버 값이 오기 전에 바꿨으면 서버 값으로 덮지 않는다", async () => {
    let resolve!: (v: unknown) => void;
    get.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { result } = renderHook(() => useThemeSettings(client, "u1"));
    act(() => result.current.update((s) => ({ ...s, mode: "dark" })));
    resolve({ mode: "light" });
    await flush();
    expect(result.current.settings.mode).toBe("dark");
  });

  it("바꾸면 바로 적용하고, 0.5초 모아 한 번 저장한다", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useThemeSettings(client, "u1"));
    act(() => result.current.update((s) => ({ ...s, mode: "dark" })));
    expect(bgVar()).toBe(DARK.bg);
    act(() => result.current.update((s) => ({ ...s, glass: 50 })));
    expect(save).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][2]).toMatchObject({ mode: "dark", glass: 50 });
    await act(async () => { await Promise.resolve(); });
    expect(localStorage.getItem(THEME_PENDING_KEY)).toBeNull();
  });

  it("저장이 실패하면 표시를 남기고, 다음 새 탭에서 서버로 다시 보낸다", async () => {
    vi.useFakeTimers();
    save.mockRejectedValueOnce(new Error("offline"));
    const first = renderHook(() => useThemeSettings(client, "u1"));
    act(() => first.result.current.update((s) => ({ ...s, mode: "dark" })));
    await act(async () => { vi.advanceTimersByTime(500); await Promise.resolve(); });
    expect(localStorage.getItem(THEME_PENDING_KEY)).toBe("1");
    first.unmount();
    vi.useRealTimers();
    get.mockClear(); save.mockClear();
    renderHook(() => useThemeSettings(client, "u1"));
    await flush();
    expect(get).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][2]).toMatchObject({ mode: "dark" });
    expect(localStorage.getItem(THEME_PENDING_KEY)).toBeNull();
  });

  it("같은 기기 다른 새 탭에서 바꾸면 따라 바뀐다", () => {
    const { result } = renderHook(() => useThemeSettings(client, null));
    expect(bgVar()).toBe(LIGHT.bg);
    writeThemeCache({ ...DEFAULT_THEME, mode: "dark" });
    act(() => { window.dispatchEvent(new StorageEvent("storage", { key: THEME_CACHE_KEY })); });
    expect(result.current.settings.mode).toBe("dark");
    expect(bgVar()).toBe(DARK.bg);
  });

  it("로그인 전엔 서버에 보내지 않는다", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useThemeSettings(client, null));
    act(() => result.current.update((s) => ({ ...s, mode: "dark" })));
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(save).not.toHaveBeenCalled();
  });

  it("사진을 올리면 그 사진으로 바꾸고, 예전 사진은 지운다", async () => {
    writeThemeCache({ ...DEFAULT_THEME, background: { ...DEFAULT_THEME.background, photo: { source: "upload", path: "u1/old.jpg", veil: 35 } } });
    const blob = new Blob(["x"], { type: "image/jpeg" });
    ph.uploadBackground.mockResolvedValue({ path: "u1/new.jpg", blob });
    ph.readPhotoCache.mockResolvedValue({ path: "u1/new.jpg", dataUrl: "data:image/jpeg;base64,eA==" });
    ph.dataUrlToBlob.mockResolvedValue(blob);
    const { result } = renderHook(() => useThemeSettings(client, "u1"));
    await act(async () => { await result.current.uploadPhoto(new Blob(["raw"])); });
    await flush();
    expect(ph.uploadBackground).toHaveBeenCalledWith(client, "u1", expect.any(Blob));
    expect(ph.writePhotoCache).toHaveBeenCalledWith("u1/new.jpg", blob);
    expect(result.current.settings.background).toMatchObject({ kind: "photo", photo: { source: "upload", path: "u1/new.jpg" } });
    expect(ph.deleteBackground).toHaveBeenCalledWith(client, "u1/old.jpg");
    expect(result.current.uploadState).toBe("idle");
    expect(result.current.uploadUrl).toMatch(/^blob:/);
    expect(document.documentElement.style.getPropertyValue("--tb-page")).toContain(result.current.uploadUrl!);
  });

  it("올리기가 실패하면 예전 사진 그대로, 상태는 error", async () => {
    ph.uploadBackground.mockRejectedValue(new Error("big"));
    const { result } = renderHook(() => useThemeSettings(client, "u1"));
    await act(async () => { await result.current.uploadPhoto(new Blob(["raw"])); });
    expect(result.current.uploadState).toBe("error");
    expect(result.current.settings.background.kind).toBe("none");
  });

  it("캐시에 없는 사진은 내려받아 그리고 캐시한다", async () => {
    const blob = new Blob(["x"]);
    ph.downloadBackground.mockResolvedValue(blob);
    writeThemeCache({ ...DEFAULT_THEME, background: { ...DEFAULT_THEME.background, kind: "photo", photo: { source: "upload", path: "u1/p.jpg", veil: 35 } } });
    const { result } = renderHook(() => useThemeSettings(client, "u1"));
    await flush(); await flush();
    expect(ph.downloadBackground).toHaveBeenCalledWith(client, "u1/p.jpg");
    expect(ph.writePhotoCache).toHaveBeenCalledWith("u1/p.jpg", blob);
    expect(result.current.uploadUrl).toMatch(/^blob:/);
  });

  it("미리 보기는 저장하지 않고 화면에만 그린다", () => {
    const { result } = renderHook(() => useThemeSettings(client, "u1"));
    act(() => result.current.preview({ ...DEFAULT_THEME, background: { ...DEFAULT_THEME.background, kind: "solid", solid: "#FEDFE2" } }));
    expect(document.documentElement.style.getPropertyValue("--tb-page")).toBe("#FEDFE2");
    expect(result.current.settings.background.kind).toBe("none");
    expect(save).not.toHaveBeenCalled();
  });
});
