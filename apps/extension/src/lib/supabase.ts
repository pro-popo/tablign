import { createClient } from "@supabase/supabase-js";

/** Supabase 세션을 chrome.storage.local에 보관하는 어댑터 */
const chromeStorageAdapter = {
  getItem: (key: string): Promise<string | null> =>
    new Promise((resolve) =>
      chrome.storage.local.get(key, (res) => resolve(res[key] ?? null)),
    ),
  setItem: (key: string, value: string): Promise<void> =>
    new Promise((resolve) => chrome.storage.local.set({ [key]: value }, () => resolve())),
  removeItem: (key: string): Promise<void> =>
    new Promise((resolve) => chrome.storage.local.remove(key, () => resolve())),
};

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  {
    auth: {
      storage: chromeStorageAdapter,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      // 확장에서 구글 로그인 시 chrome.identity로 받은 code를 직접 교환하므로 PKCE 필요
      flowType: "pkce",
    },
  },
);
