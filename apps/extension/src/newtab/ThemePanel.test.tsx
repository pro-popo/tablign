import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { ThemePanel } from "./ThemePanel";
import { getT } from "@tablign/ui";
import { DEFAULT_THEME, type ThemeSettings } from "../lib/themeSettings";

function Harness({ initial = DEFAULT_THEME, spy, onPreview, onUpload, uploadState, uploadUrl }: {
  initial?: ThemeSettings; spy?: (s: ThemeSettings) => void; onPreview?: (s: ThemeSettings) => void;
  onUpload?: (f: File) => void; uploadState?: "idle" | "uploading" | "error"; uploadUrl?: string | null;
}) {
  const [s, setS] = useState(initial);
  return <ThemePanel settings={s} onChange={(fn) => setS((p) => { const n = fn(p); spy?.(n); return n; })}
    onPreview={onPreview} onUpload={onUpload ?? (() => {})} uploadState={uploadState} uploadUrl={uploadUrl} viewport={[1000, 700]} />;
}

describe("ThemePanel", () => {
  it("모드 셋 중 지금 모드가 눌려 있고, 누르면 바뀐다", () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    expect(screen.getByRole("button", { name: "라이트" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "다크" }));
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ mode: "dark" }));
    expect(screen.getByRole("button", { name: "다크" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "시스템" }));
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ mode: "system" }));
  });

  it("강조색 프리셋을 누르면 그 번호, 이름이 뜬다", () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    expect(screen.getByText(getT().themeSettings.accents[0], { selector: "em" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "보라" }));
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ accent: { preset: 7 } }));
    expect(screen.getByText("보라", { selector: "em" })).toBeInTheDocument();
  });

  it("직접 고르기로 고른 색은 custom", () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    fireEvent.click(screen.getAllByRole("button", { name: "직접 고르기" })[0]);
    fireEvent.change(screen.getByRole("textbox", { name: "색 코드" }), { target: { value: "#0E7C66" } });
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ accent: { custom: "#0E7C66" } }));
    expect(screen.getByText("직접 고른 색", { selector: "em" })).toBeInTheDocument();
  });

  it("기본으로 되돌리기는 테마 묶음 안에 있고, 누르면 처음 값으로", () => {
    const spy = vi.fn();
    render(<Harness initial={{ ...DEFAULT_THEME, mode: "dark", accent: { custom: "#123456" }, glass: 60 }} spy={spy} />);
    fireEvent.click(screen.getByRole("button", { name: "기본으로 되돌리기" }));
    expect(spy).toHaveBeenLastCalledWith(DEFAULT_THEME);
  });

  it("배경 종류를 바꿔도 다른 종류의 값은 남는다", () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    expect(screen.queryByRole("slider", { name: "투명도" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "단색" }));
    fireEvent.click(screen.getByRole("button", { name: "#FFE1CF" }));
    fireEvent.click(screen.getByRole("button", { name: "그라데이션" }));
    expect(document.querySelector("[data-gradient-preview]")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "단색" }));
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ background: expect.objectContaining({ kind: "solid", solid: "#FFE1CF" }) }));
    expect(screen.getByRole("button", { name: "#FFE1CF" })).toHaveAttribute("aria-pressed", "true");
  });

  it("투명도: 끄는 동안 미리 보기, 놓으면 저장", () => {
    const spy = vi.fn(), onPreview = vi.fn();
    render(<Harness spy={spy} onPreview={onPreview} initial={{ ...DEFAULT_THEME, background: { ...DEFAULT_THEME.background, kind: "solid" } }} />);
    const r = screen.getByRole("slider", { name: "투명도" });
    fireEvent.change(r, { target: { value: "55" } });
    expect(onPreview).toHaveBeenLastCalledWith(expect.objectContaining({ glass: 55 }));
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ glass: 55 }));
  });

  it("사진: 예시를 고르고, 올리기 칸은 파일을 받는다", () => {
    const spy = vi.fn(), onUpload = vi.fn();
    render(<Harness spy={spy} onUpload={onUpload} initial={{ ...DEFAULT_THEME, background: { ...DEFAULT_THEME.background, kind: "photo" } }} />);
    fireEvent.click(screen.getByRole("button", { name: "바다" }));
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ background: expect.objectContaining({ photo: expect.objectContaining({ source: "sea" }) }) }));
    const file = new File(["x"], "a.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("photo-file"), { target: { files: [file] } });
    expect(onUpload).toHaveBeenCalledWith(file);
    expect(screen.getByRole("slider", { name: "덮개" })).toBeInTheDocument();
  });

  it("올린 사진이 있는데 고르지 않았으면 누르면 고른다, 실패하면 빨간 테두리", () => {
    const spy = vi.fn();
    const initial: ThemeSettings = { ...DEFAULT_THEME, background: { ...DEFAULT_THEME.background, kind: "photo", photo: { source: "sea", path: "u1/p.jpg", veil: 35 } } };
    const { rerender } = render(<Harness spy={spy} initial={initial} uploadUrl="blob:x" />);
    fireEvent.click(screen.getByRole("button", { name: "올린 사진" }));
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ background: expect.objectContaining({ photo: expect.objectContaining({ source: "upload" }) }) }));
    rerender(<Harness spy={spy} initial={initial} uploadUrl="blob:x" uploadState="error" />);
    expect(screen.getByRole("button", { name: "올린 사진" }).style.boxShadow).toContain("inset 0 0 0 1.5px");
  });
});
