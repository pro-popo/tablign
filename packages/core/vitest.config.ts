import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    setupFiles: [],
    testTimeout: 20000,
  },
});
