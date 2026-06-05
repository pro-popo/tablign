import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    env: {
      // .env.test에서 로드
    },
    setupFiles: [],
    testTimeout: 20000,
  },
});
