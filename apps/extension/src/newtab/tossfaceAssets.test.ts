import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../..");
const fontDir = resolve(root, "public/fonts/tossface");

describe("Tossface 번들", () => {
  it("공식 dist CSS와 라이선스 전문이 로컬에 번들되어 있다", () => {
    expect(existsSync(resolve(fontDir, "tossface.css"))).toBe(true);
    expect(existsSync(resolve(fontDir, "LICENSE"))).toBe(true);
  });

  it("최소 한 개의 woff2 폰트 파일이 있다", () => {
    expect(existsSync(resolve(fontDir, "TossFaceFontMac-00.woff2"))).toBe(true);
  });

  it("newtab.html이 로컬 tossface.css를 참조한다(CDN 아님)", () => {
    const html = readFileSync(resolve(root, "newtab.html"), "utf8");
    expect(html).toContain("/fonts/tossface/tossface.css");
    expect(html).not.toContain("cdn.jsdelivr.net");
  });
});
