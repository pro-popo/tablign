import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        newtab: resolve(__dirname, "newtab.html"),
        background: resolve(__dirname, "src/background.ts"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]",
        // 자주 안 바뀌고 덩치 큰 vendor 라이브러리를 별도 청크로 분리 — 초기 청크 크기를 줄이고 캐시 효율을 높인다.
        // (@emoji-mart/data는 OrgFormDialog의 동적 import 청크에 남겨 온디맨드로만 로드한다.
        //  dnd-kit(~4KB)은 react와 순환 청크가 생겨 분리하지 않고 앱 청크에 둔다.)
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("react-dom") || /[\\/]react[\\/]/.test(id) || id.includes("react/jsx")) return "vendor-react";
        },
      },
    },
  },
});
