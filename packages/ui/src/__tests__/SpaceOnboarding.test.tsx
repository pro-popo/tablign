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

  it("CTA 외에 다른 버튼은 두지 않는다", () => {
    // 가져오기 진입점은 조직 헤더 더보기 메뉴에만 둔다 — 온보딩에서는 뺐다
    render(<SpaceOnboarding onCreate={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("브라우저 팬터마임 그래픽은 장식이라 보조기기에 노출하지 않는다", () => {
    const { container } = render(<SpaceOnboarding onCreate={() => {}} />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
