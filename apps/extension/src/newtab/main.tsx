import { createRoot } from "react-dom/client";
import { ToastProvider, applyTokens, theme } from "@tablign/ui";
import { NewTab } from "./NewTab";
import { readThemeCache, systemPrefersDark, themeTokens } from "../lib/themeSettings";

// theme.ts의 색은 CSS 변수라, 첫 렌더 전에 기기에 기억한 테마로 값을 넣어 둔다(새 탭이 깜빡이지 않게)
applyTokens(document.documentElement, themeTokens(readThemeCache(), systemPrefersDark()));
// 배경은 화면 전체(조직 레일까지)에 깐다
document.body.style.background = theme.page;

createRoot(document.getElementById("root")!).render(
  <ToastProvider>
    <NewTab />
  </ToastProvider>,
);
