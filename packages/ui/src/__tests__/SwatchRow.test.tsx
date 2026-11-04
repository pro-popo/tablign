import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useState } from "react";
import { SwatchRow, SELECT_RING_COLOR } from "../SwatchRow";

const COLORS = ["#E9E4FE", "#FEDFE2", "#FFE1CF"];

function Harness(props: { initial?: string; keepOpenSelector?: string; onChange?: (h: string) => void }) {
  const [v, setV] = useState(props.initial ?? COLORS[0]);
  return (
    <div>
      <SwatchRow colors={COLORS} value={v} onChange={(h) => { setV(h); props.onChange?.(h); }} columns={7} keepOpenSelector={props.keepOpenSelector} />
      <button type="button">바깥</button>
      <div data-keep="1"><button type="button">미리보기</button></div>
    </div>
  );
}
const ring = (el: HTMLElement) => el.style.boxShadow.includes(SELECT_RING_COLOR);
const custom = () => screen.getByRole("button", { name: "직접 고르기" });
const pop = () => screen.queryByRole("dialog", { name: "직접 고르기" });

afterEach(() => { delete (window as unknown as { EyeDropper?: unknown }).EyeDropper; });

describe("SwatchRow", () => {
  it("지금 색 칸만 하늘색 링", () => {
    render(<Harness initial="#FEDFE2" />);
    const btns = COLORS.map((c) => screen.getByRole("button", { name: c }));
    expect(btns.map(ring)).toEqual([false, true, false]);
    expect(ring(custom())).toBe(false);
  });

  it("칸을 누르면 그 색", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "#FFE1CF" }));
    expect(onChange).toHaveBeenCalledWith("#FFE1CF");
  });

  it("목록에 없는 색이면 무지개 칸이 그 색으로 채워지고 링을 받는다", () => {
    render(<Harness initial="#123456" />);
    expect(custom().style.background).toContain("rgb(18, 52, 86)");
    expect(ring(custom())).toBe(true);
  });

  it("무지개 칸 → 칸 줄 아래 팝오버, 다시 누르면 닫힘", () => {
    render(<Harness />);
    fireEvent.click(custom());
    expect(pop()).toBeInTheDocument();
    expect(custom()).toHaveAttribute("aria-expanded", "true");
    // 열림 표시로 링을 겹쳐 그리지 않는다
    expect(ring(custom())).toBe(false);
    fireEvent.click(custom());
    expect(pop()).toBeNull();
  });

  it("바깥을 누르거나 Esc면 닫히고, 열어 둘 곳을 누르면 그대로", () => {
    render(<Harness keepOpenSelector="[data-keep]" />);
    fireEvent.click(custom());
    fireEvent.pointerDown(screen.getByRole("button", { name: "미리보기" }));
    expect(pop()).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole("button", { name: "바깥" }));
    expect(pop()).toBeNull();
    fireEvent.click(custom());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(pop()).toBeNull();
  });

  it("팝오버 색 코드를 바꾸면 그 색", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(custom());
    fireEvent.change(screen.getByRole("textbox", { name: "색 코드" }), { target: { value: "#0E7C66" } });
    expect(onChange).toHaveBeenLastCalledWith("#0E7C66");
    expect(pop()).toBeInTheDocument();
  });

  it("스포이드는 크롬이 지원할 때만, 딴 색으로 바꾼다", async () => {
    const { unmount } = render(<Harness />);
    fireEvent.click(custom());
    expect(screen.queryByRole("button", { name: "화면에서 색 따기" })).toBeNull();
    unmount();
    (window as unknown as { EyeDropper: unknown }).EyeDropper = class { open() { return Promise.resolve({ sRGBHex: "#abcdef" }); } };
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(custom());
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "화면에서 색 따기" })); });
    expect(onChange).toHaveBeenLastCalledWith("#ABCDEF");
  });
});
