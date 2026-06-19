import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom에는 chrome 전역이 없다. supabase 클라이언트가 모듈 로드 시 chrome.storage를
// 참조하므로 테스트 환경용 최소 스텁을 제공한다.
vi.stubGlobal("chrome", {
  storage: {
    local: {
      get: (_keys: unknown, cb?: (items: Record<string, unknown>) => void) => cb?.({}),
      set: (_items: unknown, cb?: () => void) => cb?.(),
      remove: (_keys: unknown, cb?: () => void) => cb?.(),
    },
  },
});
