import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CollectionOnboarding } from "../CollectionOnboarding";

function setup(over: Partial<React.ComponentProps<typeof CollectionOnboarding>> = {}) {
  const props = {
    windowCount: 2,
    tabCount: 7,
    onSaveOpenWindows: vi.fn(),
    onCreateEmpty: vi.fn(),
    onImportCode: vi.fn(),
    ...over,
  };
  render(<CollectionOnboarding {...props} />);
  return props;
}

describe("CollectionOnboarding", () => {
  it("확정 문구(헤드라인·서랍)를 보여준다", () => {
    setup();
    expect(screen.getByText("탭을 담을 첫 컬렉션을 만들어요")).toBeInTheDocument();
    expect(screen.getByText("컬렉션은 탭을 모아두는 서랍이에요")).toBeInTheDocument();
  });

  it("세 경로를 모두 보여주고 각각 핸들러를 호출한다", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: /열린 창 2개를 그대로 담기/ }));
    fireEvent.click(screen.getByRole("button", { name: /빈 컬렉션 만들기/ }));
    fireEvent.click(screen.getByRole("button", { name: /공유 코드로 추가/ }));
    expect(p.onSaveOpenWindows).toHaveBeenCalledTimes(1);
    expect(p.onCreateEmpty).toHaveBeenCalledTimes(1);
    expect(p.onImportCode).toHaveBeenCalledTimes(1);
  });

  it("창이 여러 개면 창 수와 탭 수를 함께 알린다", () => {
    setup({ windowCount: 3, tabCount: 21 });
    expect(screen.getByText("열린 창 3개를 그대로 담기")).toBeInTheDocument();
    expect(screen.getByText("창별로 컬렉션 1개씩 · 탭 21개")).toBeInTheDocument();
  });

  it("창이 1개면 '창별로'가 아니라 '지금 창의 탭 N개'로 문구가 갈린다", () => {
    setup({ windowCount: 1, tabCount: 5 });
    expect(screen.getByText("지금 창의 탭 5개 담기")).toBeInTheDocument();
    expect(screen.queryByText(/창별로/)).not.toBeInTheDocument();
  });

  it("담을 수 있는 탭이 0개면 첫 카드를 비활성하고 이유를 보여준다", () => {
    const p = setup({ windowCount: 0, tabCount: 0 });
    const dead = screen.getByRole("button", { name: /열린 창 담기/ });
    expect(dead).toBeDisabled();
    expect(screen.getByText("담을 탭 0개")).toBeInTheDocument();
    expect(screen.getByText("브라우저 내부 페이지만 열려 있어요")).toBeInTheDocument();
    fireEvent.click(dead);
    expect(p.onSaveOpenWindows).not.toHaveBeenCalled();
  });

  it("순서는 담기 → 공유 코드 → 빈 컬렉션 — 중립색 카드가 맨 아래", () => {
    setup();
    const titles = screen.getAllByRole("button").map((b) => b.textContent ?? "");
    expect(titles[0]).toMatch(/열린 창 2개를 그대로 담기/);
    expect(titles[1]).toMatch(/공유 코드로 추가/);
    expect(titles[2]).toMatch(/빈 컬렉션 만들기/);
  });

  it("아이콘 색은 개념별로 다르다 — 담기 accent · 공유 초록 · 빈 컬렉션 중립", () => {
    setup();
    const iconOf = (name: RegExp) =>
      screen.getByRole("button", { name }).querySelector(".tablign-choice-icon") as HTMLElement;
    expect(iconOf(/열린 창 2개를 그대로 담기/).style.background).toContain("rgb(59, 91, 219)");
    expect(iconOf(/공유 코드로 추가/).style.background).toContain("rgb(47, 158, 99)");
    // 중립은 surface2 — 흰 글리프가 아니라 회색 글리프
    expect(iconOf(/빈 컬렉션 만들기/).style.background).toContain("rgb(241, 243, 245)");
    expect(iconOf(/빈 컬렉션 만들기/).style.color).toContain("rgb(92, 99, 107)");
  });

  it("비활성 카드는 accent를 쓰지 않는다 — 못 누르는 것에 주 색을 주지 않는다", () => {
    setup({ windowCount: 0, tabCount: 0 });
    const icon = screen.getByRole("button", { name: /열린 창 담기/ })
      .querySelector(".tablign-choice-icon") as HTMLElement;
    expect(icon.style.background).not.toContain("rgb(59, 91, 219)");
    expect(icon.style.background).toContain("rgb(241, 243, 245)");
  });

  it("담을 탭이 0개여도 나머지 두 경로는 그대로 눌린다 — 레이아웃이 흔들리지 않는다", () => {
    const p = setup({ windowCount: 0, tabCount: 0 });
    expect(screen.getAllByRole("button")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /빈 컬렉션 만들기/ }));
    fireEvent.click(screen.getByRole("button", { name: /공유 코드로 추가/ }));
    expect(p.onCreateEmpty).toHaveBeenCalledTimes(1);
    expect(p.onImportCode).toHaveBeenCalledTimes(1);
  });
});
