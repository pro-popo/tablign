import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// 화면 문구는 사전(packages/ui/src/i18n)에만 둔다. 코드에 한국어를 직접 쓰면 여기서 걸린다.
const ROOT = resolve(__dirname, "../../..");
const DIRS = ["apps/extension/src", "packages/ui/src", "packages/core/src"];

/** 주석을 줄 수를 지키며 지운 뒤, 한국어가 남은 줄 번호(1부터) */
function koreanLines(src: string): number[] {
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""))
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  return code.split("\n").flatMap((line, i) => (/[가-힣]/.test(line) ? [i + 1] : []));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : sourceFiles(p);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

const offenders = DIRS.flatMap((d) => sourceFiles(join(ROOT, d)))
  .map((p) => relative(ROOT, p))
  .filter((f) => !f.startsWith("packages/ui/src/i18n/"))
  .flatMap((file) => koreanLines(readFileSync(join(ROOT, file), "utf8")).map((line) => ({ file, line })));

describe("코드 속 한국어 가드", () => {
  it("koreanLines는 주석은 무시하고 코드 속 한국어 줄만 센다", () => {
    expect(
      koreanLines(
        `const a = "가"; // 나\n/* 다\n라 */\nconst b = 1;\n<p>{/* 마 */}</p>\nconst u = "https://x.com/바";`,
      ),
    ).toEqual([1, 6]);
  });

  it("화면 문구는 사전에만 있다 — 코드 속 한국어 0줄", () => {
    expect(offenders.map((o) => `${o.file}:${o.line}`)).toEqual([]);
  });
});
