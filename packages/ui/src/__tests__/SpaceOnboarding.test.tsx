import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpaceOnboarding } from "../SpaceOnboarding";

describe("SpaceOnboarding", () => {
  it("온보딩 안내 문구와 CTA를 보여준다", () => {
    render(<SpaceOnboarding onCreate={() => {}} />);
    expect(screen.getByText("매일 여는 탭, 매번 찾고 있나요?")).toBeInTheDocument();
    expect(screen.getByText(/자주 쓰는 탭은 스페이스에 담아두세요/)).toBeInTheDocument();
    expect(screen.getByText(/한 번에 다시 열 수 있어요/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /첫 스페이스 만들기/ })).toBeInTheDocument();
  });

  it("CTA 클릭 시 onCreate를 호출한다", () => {
    const onCreate = vi.fn();
    render(<SpaceOnboarding onCreate={onCreate} />);
    fireEvent.click(screen.getByRole("button", { name: /첫 스페이스 만들기/ }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("onImport를 주면 CTA 아래에 북마크·Toby 가져오기를 노출한다", () => {
    const onCreate = vi.fn();
    const onImport = vi.fn();
    render(<SpaceOnboarding onCreate={onCreate} onImport={onImport} />);

    fireEvent.click(screen.getByRole("button", { name: /북마크·Toby 가져오기/ }));
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("onImport가 없으면 가져오기를 노출하지 않는다", () => {
    render(<SpaceOnboarding onCreate={() => {}} />);
    expect(screen.queryByRole("button", { name: /북마크·Toby 가져오기/ })).not.toBeInTheDocument();
  });

  it("브라우저 팬터마임 그래픽은 장식이라 보조기기에 노출하지 않는다", () => {
    const { container } = render(<SpaceOnboarding onCreate={() => {}} />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
