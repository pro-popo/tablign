import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppShell } from "../AppShell";

describe("AppShell", () => {
  it("left/center/right 슬롯을 렌더한다", () => {
    render(
      <AppShell
        leftOpen rightOpen
        onToggleLeft={() => {}} onToggleRight={() => {}}
        left={<div>LEFT</div>} right={<div>RIGHT</div>}
      >
        <div>CENTER</div>
      </AppShell>,
    );
    expect(screen.getByText("LEFT")).toBeInTheDocument();
    expect(screen.getByText("CENTER")).toBeInTheDocument();
    expect(screen.getByText("RIGHT")).toBeInTheDocument();
  });

  it("right가 닫히면 right 내용이 숨고 열기 버튼이 보인다", () => {
    const onToggleRight = vi.fn();
    render(
      <AppShell
        leftOpen rightOpen={false}
        onToggleLeft={() => {}} onToggleRight={onToggleRight}
        left={<div>LEFT</div>} right={<div>RIGHT</div>}
      >
        <div>CENTER</div>
      </AppShell>,
    );
    expect(screen.queryByText("RIGHT")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "열린 탭 열기" }));
    expect(onToggleRight).toHaveBeenCalled();
  });
});
