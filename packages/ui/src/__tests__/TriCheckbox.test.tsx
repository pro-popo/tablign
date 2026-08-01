import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TriCheckbox, triCheckboxCss } from "../TriCheckbox";

describe("TriCheckbox", () => {
  it("세 상태를 data-state와 aria-checked로 함께 노출한다", () => {
    const { rerender } = render(<TriCheckbox state="on" label="개발 포함" onToggle={() => {}} />);
    const box = screen.getByRole("checkbox", { name: "개발 포함" });
    expect(box).toHaveAttribute("data-state", "on");
    expect(box).toHaveAttribute("aria-checked", "true");

    rerender(<TriCheckbox state="some" label="개발 포함" onToggle={() => {}} />);
    expect(box).toHaveAttribute("data-state", "some");
    expect(box).toHaveAttribute("aria-checked", "mixed");

    rerender(<TriCheckbox state="none" label="개발 포함" onToggle={() => {}} />);
    expect(box).toHaveAttribute("data-state", "none");
    expect(box).toHaveAttribute("aria-checked", "false");
  });

  it("상태가 바뀌어도 같은 DOM 노드를 유지한다(전환이 돌 수 있게)", () => {
    const { rerender } = render(<TriCheckbox state="none" label="x" onToggle={() => {}} />);
    const before = screen.getByRole("checkbox");
    rerender(<TriCheckbox state="on" label="x" onToggle={() => {}} />);
    expect(screen.getByRole("checkbox")).toBe(before);
  });

  it("체크 표시는 SVG 선 두 개다 — 테두리 회전이 아니다", () => {
    const { container } = render(<TriCheckbox state="on" label="x" onToggle={() => {}} />);
    expect(container.querySelector("path.tbl-cbx-tick")).not.toBeNull();
    expect(container.querySelector("path.tbl-cbx-bar")).not.toBeNull();
  });

  it("클릭과 Enter·Space로 토글한다", () => {
    const onToggle = vi.fn();
    render(<TriCheckbox state="none" label="x" onToggle={onToggle} />);
    const box = screen.getByRole("checkbox");
    fireEvent.click(box);
    fireEvent.keyDown(box, { key: "Enter" });
    fireEvent.keyDown(box, { key: " " });
    expect(onToggle).toHaveBeenCalledTimes(3);
  });

  it("다른 키는 무시한다", () => {
    const onToggle = vi.fn();
    render(<TriCheckbox state="none" label="x" onToggle={onToggle} />);
    fireEvent.keyDown(screen.getByRole("checkbox"), { key: "a" });
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("부모의 클릭 핸들러로 이벤트가 새지 않는다", () => {
    const onParent = vi.fn();
    const onToggle = vi.fn();
    render(
      <div onClick={onParent}>
        <TriCheckbox state="none" label="x" onToggle={onToggle} />
      </div>,
    );
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onParent).not.toHaveBeenCalled();
  });

  it("스타일에 체크 선 전환과 reduced-motion 예외가 들어있다", () => {
    expect(triCheckboxCss).toContain("stroke-dashoffset");
    expect(triCheckboxCss).toContain('[data-state="on"] .tbl-cbx-tick');
    expect(triCheckboxCss).toContain("prefers-reduced-motion");
  });
});
