import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useState } from "react";
import { GradientEditor } from "../GradientEditor";
import { defaultGradient, type ThemeGradient } from "../gradient";

const QUICK = ["#BAC8FF", "#FFD8C2", "#C3F0DC", "#FFC9DE", "#FFF0B3", "#D0BCFF"];
const W = 244, H = 170;

function Harness({ initial = defaultGradient(), onChange, onPreview }: { initial?: ThemeGradient; onChange?: (g: ThemeGradient) => void; onPreview?: (g: ThemeGradient) => void }) {
  const [g, setG] = useState(initial);
  return (
    <div>
      <GradientEditor value={g} onChange={(n) => { setG(n); onChange?.(n); }} onPreview={onPreview} quickColors={QUICK} viewport={[W, H]} />
      <button type="button">바깥</button>
    </div>
  );
}
const preview = () => document.querySelector("[data-gradient-preview]") as HTMLElement;
const stub = () => { preview().getBoundingClientRect = () => ({ left: 0, top: 0, width: W, height: H, right: W, bottom: H, x: 0, y: 0, toJSON() {} }); };
const at = (x: number, y: number) => ({ bubbles: true, cancelable: true, clientX: x / 100 * W, clientY: y / 100 * H });
const down = (el: Element, x: number, y: number) => act(() => { el.dispatchEvent(new MouseEvent("pointerdown", at(x, y))); });
const move = (x: number, y: number) => act(() => { window.dispatchEvent(new MouseEvent("pointermove", at(x, y))); });
const up = () => act(() => { window.dispatchEvent(new MouseEvent("pointerup", { bubbles: true })); });
const handles = () => preview().querySelectorAll("[data-stop]");
const tool = (name: string) => screen.getByRole("button", { name });

describe("GradientEditor", () => {
  it("직선 처음 값: 점 둘, 점선으로 잇고, 두 색이면 빼기가 꺼진다", () => {
    render(<Harness />);
    expect(handles()).toHaveLength(2);
    expect(preview().querySelector("line[stroke-dasharray]")).toBeTruthy();
    expect(tool("빼기")).toBeDisabled();
    expect(screen.getByRole("button", { name: "직선" })).toHaveAttribute("aria-pressed", "true");
  });

  it("원형으로 바꾸면 처음 자리(정가운데)로", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "원형" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ type: "radial", points: [[50, 50], [88, 88]] }));
    expect(preview().querySelector("ellipse")).toBeTruthy();
  });

  it("선 위를 누르면 그 자리에 안 쓴 빠른 색이 생기고 바로 끌 수 있다", () => {
    const onChange = vi.fn(), onPreview = vi.fn();
    render(<Harness onChange={onChange} onPreview={onPreview} />);
    stub();
    down(preview(), 50, 50);
    expect(handles()).toHaveLength(3);
    move(30, 31);
    expect(onPreview).toHaveBeenCalled();
    up();
    const g = onChange.mock.lastCall![0] as ThemeGradient;
    expect(g.stops).toHaveLength(3);
    expect(g.stops[1].color).toBe("#C3F0DC");
    expect(g.stops[1].pos).toBeLessThan(40);
  });

  it("선에서 먼 곳은 아무 일 없다", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    stub();
    down(preview(), 90, 10);
    up();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("끝점을 끄는 동안엔 미리 보기만, 놓으면 저장", () => {
    const onChange = vi.fn(), onPreview = vi.fn();
    render(<Harness onChange={onChange} onPreview={onPreview} />);
    stub();
    down(handles()[1], 90, 88);
    move(90, 12);
    expect(onPreview).toHaveBeenLastCalledWith(expect.objectContaining({ points: [[10, 12], [90, 12]] }));
    expect(onChange).not.toHaveBeenCalled();
    up();
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ points: [[10, 12], [90, 12]] }));
  });

  it("누르기만 하면 그 점을 고른다(링)", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    stub();
    down(handles()[0], 10, 12);
    up();
    expect(onChange).not.toHaveBeenCalled();
    expect(handles()[0]).toHaveAttribute("aria-pressed", "true");
  });

  it("뒤집기·추가·빼기·초기화", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(tool("색 뒤집기"));
    expect(onChange.mock.lastCall![0].stops.map((s: { color: string }) => s.color)).toEqual(["#FFD8C2", "#BAC8FF"]);
    fireEvent.click(tool("색 추가"));
    expect(onChange.mock.lastCall![0].stops).toHaveLength(3);
    expect(tool("빼기")).not.toBeDisabled();
    fireEvent.click(tool("빼기"));
    expect(onChange.mock.lastCall![0].stops).toHaveLength(2);
    fireEvent.click(tool("초기화"));
    expect(onChange.mock.lastCall![0]).toEqual(defaultGradient("linear"));
  });

  it("지우기 키로 고른 색을 뺀다(입력 칸에선 안 함)", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(tool("색 추가"));
    fireEvent.keyDown(document.body, { key: "Delete" });
    expect(onChange.mock.lastCall![0].stops).toHaveLength(2);
    fireEvent.click(tool("색 추가"));
    fireEvent.click(screen.getByRole("button", { name: "직접 고르기" }));
    const n = onChange.mock.calls.length;
    fireEvent.keyDown(screen.getByRole("textbox", { name: "색 코드" }), { key: "Backspace" });
    expect(onChange.mock.calls.length).toBe(n);
  });

  it("빠른 색은 고른 점 색을 바꾸고, 팝오버는 미리보기를 눌러도 열려 있다", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    stub();
    down(handles()[0], 10, 12); up();
    fireEvent.click(screen.getByRole("button", { name: "#FFF0B3" }));
    expect(onChange.mock.lastCall![0].stops[0].color).toBe("#FFF0B3");
    fireEvent.click(screen.getByRole("button", { name: "직접 고르기" }));
    expect(screen.getByRole("dialog", { name: "직접 고르기" })).toBeInTheDocument();
    down(handles()[1], 90, 88); up();
    expect(screen.getByRole("dialog", { name: "직접 고르기" })).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole("button", { name: "바깥" }));
    expect(screen.queryByRole("dialog", { name: "직접 고르기" })).toBeNull();
  });
});
