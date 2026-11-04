import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OrgRail } from "./OrgRail";

function renderRail(invitationCount: number) {
  return render(
    <OrgRail organizations={[]} memberships={[]} activeOrgId={null} userEmail="u1@test.local" currentUserId="u1"
      onSelectOrg={() => {}} onCreateOrg={() => {}} onSignOut={() => {}}
      invitationCount={invitationCount} invitations={<div>초대 목록</div>} />,
  );
}

describe("OrgRail — 받은 초대함", () => {
  it("받은 초대가 없으면 개수 없이 '받은 초대'로 보인다", () => {
    renderRail(0);
    expect(screen.getByRole("button", { name: "받은 초대" })).toBeInTheDocument();
  });

  it("누르면 받은 초대 목록이 뜨고, 바깥을 누르면 닫힌다", () => {
    renderRail(2);
    fireEvent.click(screen.getByRole("button", { name: "받은 초대 2개" }));
    expect(screen.getByRole("dialog", { name: "받은 초대" })).toHaveTextContent("초대 목록");

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog", { name: "받은 초대" })).not.toBeInTheDocument();
  });

  it("Esc로 닫힌다", () => {
    renderRail(1);
    fireEvent.click(screen.getByRole("button", { name: "받은 초대 1개" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "받은 초대" })).not.toBeInTheDocument();
  });
});

describe("OrgRail — 테마", () => {
  it("팔레트 버튼은 테마 패널을 바꾸고, 열려 있으면 눌린 상태", () => {
    let calls = 0;
    const { rerender } = render(
      <OrgRail organizations={[]} memberships={[]} activeOrgId={null} userEmail="u1@test.local" currentUserId="u1"
        onSelectOrg={() => {}} onCreateOrg={() => {}} onSignOut={() => {}} invitationCount={0} invitations={null}
        onToggleTheme={() => { calls++; }} />,
    );
    const btn = screen.getByRole("button", { name: "테마" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(btn);
    expect(calls).toBe(1);
    rerender(
      <OrgRail organizations={[]} memberships={[]} activeOrgId={null} userEmail="u1@test.local" currentUserId="u1"
        onSelectOrg={() => {}} onCreateOrg={() => {}} onSignOut={() => {}} invitationCount={0} invitations={null}
        themeOpen onToggleTheme={() => { calls++; }} />,
    );
    expect(screen.getByRole("button", { name: "테마" })).toHaveAttribute("aria-pressed", "true");
  });

  it("onToggleTheme이 없으면 팔레트 버튼도 없다", () => {
    renderRail(0);
    expect(screen.queryByRole("button", { name: "테마" })).toBeNull();
  });
});
