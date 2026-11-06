import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { setLocale } from "@tablign/ui";
import { SettingsPanel } from "./SettingsPanel";
import { DEFAULT_THEME } from "../lib/themeSettings";

function renderPanel({ onClose = () => {}, onChange = () => {} }: { onClose?: () => void; onChange?: (fn: (s: typeof DEFAULT_THEME) => typeof DEFAULT_THEME) => void } = {}) {
  return render(<SettingsPanel settings={DEFAULT_THEME} onChange={onChange} onClose={onClose} viewport={[1000, 700]} />);
}

describe("SettingsPanel", () => {
  afterEach(() => {
    localStorage.removeItem("tablign.locale");
    setLocale("ko");
  });

  it("머리·언어·테마 순서이고, 지금 언어가 눌려 있다", () => {
    renderPanel();
    expect(screen.getByText("설정")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "한국어" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("언어").compareDocumentPosition(screen.getByText("테마"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("English를 누르면 바로 영어로 바뀌고 기기에 저장된다", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("tablign.locale")).toBe("en");
  });

  it("닫기를 누르면 onClose", () => {
    const onClose = vi.fn();
    renderPanel({ onClose });
    fireEvent.click(screen.getByRole("button", { name: "설정 닫기" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("기본으로 되돌리기는 테마만 처음 값으로", () => {
    const onChange = vi.fn();
    renderPanel({ onChange });
    fireEvent.click(screen.getByRole("button", { name: "기본으로 되돌리기" }));
    expect(onChange.mock.calls[0][0]({ ...DEFAULT_THEME, mode: "dark" })).toEqual(DEFAULT_THEME);
  });

  it("패널 안에 안내 문구를 두지 않는다", () => {
    const { container } = renderPanel();
    expect(container.textContent).not.toMatch(/해요|돼요/);
  });
});
