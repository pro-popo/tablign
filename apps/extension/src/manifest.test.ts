import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const read = (p: string) => JSON.parse(readFileSync(resolve(__dirname, "../public", p), "utf8"));

it("설명은 _locales에서 오고, 기본 언어 파일이 있다", () => {
  const m = read("manifest.json");
  expect(m.default_locale).toBe("en");
  expect(m.description).toBe("__MSG_appDesc__");
  expect(read("_locales/en/messages.json").appDesc.message).toBe("Visual bookmark & tab manager");
  expect(read("_locales/ko/messages.json").appDesc.message).toBe("시각적 북마크·탭 관리");
});

it("새 탭은 줄 높이를 정해 둔다 — 비워 두면 한글(대체 글꼴)과 영어의 줄 높이가 달라 언어를 바꾸면 높이가 변한다", () => {
  const html = readFileSync(resolve(__dirname, "../newtab.html"), "utf8");
  expect(html).toMatch(/body\s*\{[^}]*line-height:\s*1\.265/);
  // 버튼·입력은 브라우저 기본값(normal)이 물려받기를 막는다
  expect(html).toMatch(/button,\s*input,\s*select,\s*textarea\s*\{\s*line-height:\s*inherit/);
});
